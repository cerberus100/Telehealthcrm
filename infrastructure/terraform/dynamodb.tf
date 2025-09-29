# =============================================================================
# DYNAMODB TABLES - PATIENT PROVISIONAL DATA & AUDIT LOGS
# =============================================================================

# KMS Key for DynamoDB Encryption
resource "aws_kms_key" "dynamodb" {
  description             = "KMS key for DynamoDB encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-dynamodb-kms-${local.environment}"
  })
}

resource "aws_kms_alias" "dynamodb" {
  name          = "alias/${local.name_prefix}-dynamodb-${local.environment}"
  target_key_id = aws_kms_key.dynamodb.key_id
}

# =============================================================================
# PATIENT PROVISIONAL DATA TABLE
# =============================================================================

resource "aws_dynamodb_table" "patient_provisional" {
  name           = "${local.name_prefix}-patient-provisional-${local.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "email"
  range_key      = "createdAt"

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "N"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "verificationCode"
    type = "S"
  }

  # GSI for querying by status
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # GSI for querying by verification code
  global_secondary_index {
    name            = "VerificationCodeIndex"
    hash_key        = "verificationCode"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = merge(local.common_tags, {
    Name               = "${local.name_prefix}-patient-provisional-${local.environment}"
    Compliance         = "HIPAA"
    DataClassification = "PHI"
  })
}

# =============================================================================
# CLINICIAN APPLICATIONS TABLE
# =============================================================================

resource "aws_dynamodb_table" "clinician_applications" {
  name         = "${local.name_prefix}-clinician-applications-${local.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "applicationId"
  range_key    = "submittedAt"

  attribute {
    name = "applicationId"
    type = "S"
  }

  attribute {
    name = "submittedAt"
    type = "N"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  # GSI for querying by status
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "submittedAt"
    projection_type = "ALL"
  }

  # GSI for querying by email
  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    range_key       = "submittedAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }

  tags = merge(local.common_tags, {
    Name               = "${local.name_prefix}-clinician-applications-${local.environment}"
    Compliance         = "HIPAA"
    DataClassification = "PII"
  })
}

# =============================================================================
# AUDIT LOGS TABLE
# =============================================================================

resource "aws_dynamodb_table" "audit_logs" {
  name         = "${local.name_prefix}-audit-logs-${local.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "eventId"
  range_key    = "timestamp"

  attribute {
    name = "eventId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "action"
    type = "S"
  }

  attribute {
    name = "orgId"
    type = "S"
  }

  # GSI for querying by user
  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "userId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # GSI for querying by action type
  global_secondary_index {
    name            = "ActionIndex"
    hash_key        = "action"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # GSI for querying by organization
  global_secondary_index {
    name            = "OrgIdIndex"
    hash_key        = "orgId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }

  # Optional: Set TTL for audit log retention (7 years for HIPAA)
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = merge(local.common_tags, {
    Name               = "${local.name_prefix}-audit-logs-${local.environment}"
    Compliance         = "SOC2-HIPAA"
    DataClassification = "Audit"
  })
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "dynamodb_kms_key_id" {
  description = "DynamoDB KMS Key ID"
  value       = aws_kms_key.dynamodb.key_id
}

output "dynamodb_kms_key_arn" {
  description = "DynamoDB KMS Key ARN"
  value       = aws_kms_key.dynamodb.arn
}

output "patient_provisional_table_name" {
  description = "Patient Provisional DynamoDB Table Name"
  value       = aws_dynamodb_table.patient_provisional.name
}

output "patient_provisional_table_arn" {
  description = "Patient Provisional DynamoDB Table ARN"
  value       = aws_dynamodb_table.patient_provisional.arn
}

output "clinician_applications_table_name" {
  description = "Clinician Applications DynamoDB Table Name"
  value       = aws_dynamodb_table.clinician_applications.name
}

output "clinician_applications_table_arn" {
  description = "Clinician Applications DynamoDB Table ARN"
  value       = aws_dynamodb_table.clinician_applications.arn
}

output "audit_logs_table_name" {
  description = "Audit Logs DynamoDB Table Name"
  value       = aws_dynamodb_table.audit_logs.name
}

output "audit_logs_table_arn" {
  description = "Audit Logs DynamoDB Table ARN"
  value       = aws_dynamodb_table.audit_logs.arn
}
