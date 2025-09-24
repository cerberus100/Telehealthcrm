# =============================================================================
# S3 BUCKETS - FILE STORAGE WITH WORM COMPLIANCE
# =============================================================================

# Main Application Storage Bucket
resource "aws_s3_bucket" "app_storage" {
  bucket = "${local.name_prefix}-app-storage-${local.environment}-${random_id.suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-storage-${local.environment}"
  })
}

# Application Storage Bucket Configuration
resource "aws_s3_bucket_versioning" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id

  rule {
    id     = "transition_to_ia"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
  }
}

# Call Recordings Bucket (HIPAA Compliant)
resource "aws_s3_bucket" "call_recordings" {
  bucket = "${local.name_prefix}-call-recordings-${local.environment}-${random_id.suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-call-recordings-${local.environment}"
    Compliance = "HIPAA"
    DataClassification = "PHI"
  })
}

# Call Recordings Bucket Configuration
resource "aws_s3_bucket_versioning" "call_recordings" {
  bucket = aws_s3_bucket.call_recordings.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "call_recordings" {
  bucket = aws_s3_bucket.call_recordings.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "call_recordings" {
  bucket = aws_s3_bucket.call_recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Object Lock Configuration for WORM Compliance
resource "aws_s3_bucket_object_lock_configuration" "call_recordings" {
  bucket = aws_s3_bucket.call_recordings.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 2557  # 7 years for HIPAA compliance
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "call_recordings" {
  bucket = aws_s3_bucket.call_recordings.id

  rule {
    id     = "retention_rule"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 2557  # 7 years retention
    }
  }
}

# Document Storage Bucket
resource "aws_s3_bucket" "documents" {
  bucket = "${local.name_prefix}-documents-${local.environment}-${random_id.suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-documents-${local.environment}"
    Compliance = "HIPAA"
    DataClassification = "PHI"
  })
}

# Document Storage Bucket Configuration
resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object_lock_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 2557  # 7 years for HIPAA compliance
    }
  }
}

# Audit Logs Bucket
resource "aws_s3_bucket" "audit_logs" {
  bucket = "${local.name_prefix}-audit-logs-${local.environment}-${random_id.suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-audit-logs-${local.environment}"
    Compliance = "SOC2-HIPAA"
    DataClassification = "Audit"
  })
}

# Audit Logs Bucket Configuration
resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object_lock_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 2557  # 7 years for SOC2 compliance
    }
  }
}

# Backup Storage Bucket
resource "aws_s3_bucket" "backups" {
  bucket = "${local.name_prefix}-backups-${local.environment}-${random_id.suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backups-${local.environment}"
    Compliance = "SOC2-HIPAA"
    DataClassification = "Backup"
  })
}

# Backup Storage Bucket Configuration
resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "backup_lifecycle"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 2557  # 7 years retention
    }
  }
}

# =============================================================================
# S3 BUCKET POLICIES
# =============================================================================

# Policy for Application Storage
resource "aws_s3_bucket_policy" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.app_storage.arn,
          "${aws_s3_bucket.app_storage.arn}/*"
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

# Policy for Call Recordings
resource "aws_s3_bucket_policy" "call_recordings" {
  bucket = aws_s3_bucket.call_recordings.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.call_recordings.arn,
          "${aws_s3_bucket.call_recordings.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "HIPAACompliance"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:DeleteObject"
        Resource = "${aws_s3_bucket.call_recordings.arn}/*"
      }
    ]
  })
}

# Policy for Documents
resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
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

# Policy for Audit Logs
resource "aws_s3_bucket_policy" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.audit_logs.arn,
          "${aws_s3_bucket.audit_logs.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "SOC2Compliance"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:DeleteObject"
        Resource = "${aws_s3_bucket.audit_logs.arn}/*"
      }
    ]
  })
}

# Policy for Backups
resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
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

# =============================================================================
# OUTPUTS
# =============================================================================

output "app_storage_bucket_name" {
  description = "Application Storage Bucket Name"
  value       = aws_s3_bucket.app_storage.bucket
}

output "app_storage_bucket_arn" {
  description = "Application Storage Bucket ARN"
  value       = aws_s3_bucket.app_storage.arn
}

output "call_recordings_bucket_name" {
  description = "Call Recordings Bucket Name"
  value       = aws_s3_bucket.call_recordings.bucket
}

output "call_recordings_bucket_arn" {
  description = "Call Recordings Bucket ARN"
  value       = aws_s3_bucket.call_recordings.arn
}

output "documents_bucket_name" {
  description = "Documents Bucket Name"
  value       = aws_s3_bucket.documents.bucket
}

output "documents_bucket_arn" {
  description = "Documents Bucket ARN"
  value       = aws_s3_bucket.documents.arn
}

output "audit_logs_bucket_name" {
  description = "Audit Logs Bucket Name"
  value       = aws_s3_bucket.audit_logs.bucket
}

output "audit_logs_bucket_arn" {
  description = "Audit Logs Bucket ARN"
  value       = aws_s3_bucket.audit_logs.arn
}

output "backups_bucket_name" {
  description = "Backups Bucket Name"
  value       = aws_s3_bucket.backups.bucket
}

output "backups_bucket_arn" {
  description = "Backups Bucket ARN"
  value       = aws_s3_bucket.backups.arn
}
