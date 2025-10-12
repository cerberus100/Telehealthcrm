# Terraform Remote State Backend Configuration
# CRITICAL: Prevents state loss and enables team collaboration
# 
# This file configures:
# - S3 bucket for state storage
# - DynamoDB table for state locking
# - Encryption at rest (KMS)
# - Versioning for rollback capability
#
# IMPORTANT: Run this ONCE to create the backend infrastructure,
# then uncomment the backend block in main.tf and migrate state.

# ============================================
# S3 Bucket for Terraform State
# ============================================

resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-terraform-state-${data.aws_caller_identity.current.account_id}"
  
  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "Terraform State Bucket"
    Purpose = "Infrastructure State Management"
  })
}

# Enable versioning for rollback capability
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption with KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.terraform_state.arn
    }
    bucket_key_enabled = true
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: Require TLS
resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "RequireTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.terraform_state.arn,
          "${aws_s3_bucket.terraform_state.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# ============================================
# KMS Key for State Encryption
# ============================================

resource "aws_kms_key" "terraform_state" {
  description             = "KMS key for Terraform state encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "Terraform State KMS Key"
  })
}

resource "aws_kms_alias" "terraform_state" {
  name          = "alias/${var.project_name}-terraform-state"
  target_key_id = aws_kms_key.terraform_state.key_id
}

# ============================================
# DynamoDB Table for State Locking
# ============================================

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "${var.project_name}-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"  # No capacity planning needed
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.terraform_state.arn
  }

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "Terraform State Locks"
    Purpose = "State Locking for Concurrency Control"
  })
}

# ============================================
# Outputs
# ============================================

output "terraform_state_bucket" {
  description = "S3 bucket name for Terraform state"
  value       = aws_s3_bucket.terraform_state.id
}

output "terraform_state_bucket_arn" {
  description = "S3 bucket ARN for Terraform state"
  value       = aws_s3_bucket.terraform_state.arn
}

output "terraform_locks_table" {
  description = "DynamoDB table name for Terraform locks"
  value       = aws_dynamodb_table.terraform_locks.name
}

output "terraform_state_kms_key_id" {
  description = "KMS key ID for Terraform state encryption"
  value       = aws_kms_key.terraform_state.id
}

# ============================================
# Migration Instructions
# ============================================

# After applying this configuration:
#
# 1. Note the outputs:
#    terraform output
#
# 2. Update main.tf backend configuration:
#    terraform {
#      backend "s3" {
#        bucket         = "<terraform_state_bucket>"
#        key            = "prod/terraform.tfstate"
#        region         = "us-east-1"
#        dynamodb_table = "<terraform_locks_table>"
#        encrypt        = true
#        kms_key_id     = "<terraform_state_kms_key_id>"
#      }
#    }
#
# 3. Migrate existing state:
#    terraform init -migrate-state
#
# 4. Verify migration:
#    terraform state list
#
# 5. Delete local state file:
#    rm terraform.tfstate terraform.tfstate.backup

