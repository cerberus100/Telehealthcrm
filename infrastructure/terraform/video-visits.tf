# ============================================
# Video Visit System Infrastructure
# HIPAA/SOC2 Compliant
# Amazon Connect WebRTC + Chime SDK
# ============================================

# --------------------------------------------
# 1. KMS Keys
# --------------------------------------------

# Asymmetric key for JWT signing (ES256)
resource "aws_kms_key" "video_jwt_signing" {
  description              = "Video visit JWT signing key (ES256)"
  key_usage               = "SIGN_VERIFY"
  customer_master_key_spec = "ECC_NIST_P256"
  
  tags = {
    Name        = "telehealth-video-jwt-signing"
    Environment = var.environment
    Compliance  = "HIPAA"
    Purpose     = "JWT-Signing"
  }
}

resource "aws_kms_alias" "video_jwt_signing" {
  name          = "alias/video-jwt-signing-key"
  target_key_id = aws_kms_key.video_jwt_signing.key_id
}

# Symmetric key for video recordings encryption (WORM compliance)
resource "aws_kms_key" "video_recordings" {
  description             = "Video recording encryption key"
  key_usage              = "ENCRYPT_DECRYPT"
  enable_key_rotation    = true
  deletion_window_in_days = 30

  tags = {
    Name        = "telehealth-video-recordings"
    Environment = var.environment
    Compliance  = "HIPAA-WORM"
  }
}

resource "aws_kms_alias" "video_recordings" {
  name          = "alias/video-recordings-cmk"
  target_key_id = aws_kms_key.video_recordings.key_id
}

# --------------------------------------------
# 2. S3 Buckets
# --------------------------------------------

# Video recordings bucket (opt-in, WORM compliance)
resource "aws_s3_bucket" "video_recordings" {
  bucket = "telehealth-video-recordings-${var.environment}-${random_id.bucket_suffix.hex}"
  
  tags = {
    Name        = "Video Recordings"
    Environment = var.environment
    Compliance  = "HIPAA-WORM"
  }
}

# Enable versioning (required for Object Lock)
resource "aws_s3_bucket_versioning" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Object Lock (WORM: Write Once Read Many)
resource "aws_s3_bucket_object_lock_configuration" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  rule {
    default_retention {
      mode = "COMPLIANCE"  # Cannot be deleted, even by root
      years = 7            # HIPAA 7-year retention
    }
  }
}

# Server-side encryption with KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.video_recordings.arn
    }
    bucket_key_enabled = true
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: Require TLS
resource "aws_s3_bucket_policy" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyUnencryptedObjectUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.video_recordings.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      {
        Sid       = "RequireTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.video_recordings.arn,
          "${aws_s3_bucket.video_recordings.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid       = "AllowConnectService"
        Effect    = "Allow"
        Principal = {
          Service = "connect.amazonaws.com"
        }
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource  = "${aws_s3_bucket.video_recordings.arn}/*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# Lifecycle policy: Transition to Glacier after 90 days
resource "aws_s3_bucket_lifecycle_configuration" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  rule {
    id     = "archive-old-recordings"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555  # 7 years
    }
  }
}

# Access logging
resource "aws_s3_bucket_logging" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  target_bucket = aws_s3_bucket.audit_logs.id
  target_prefix = "video-recordings-access/"
}

# --------------------------------------------
# 3. IAM Roles
# --------------------------------------------

# Video API Lambda execution role
resource "aws_iam_role" "video_api_lambda" {
  name = "telehealth-video-api-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "connect.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "Video API Lambda Role"
    Environment = var.environment
  }
}

# Policy: Amazon Connect WebRTC operations
resource "aws_iam_role_policy" "video_api_connect" {
  name = "connect-webrtc-policy"
  role = aws_iam_role.video_api_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConnectWebRTCOperations"
        Effect = "Allow"
        Action = [
          "connect:StartWebRTCContact",
          "connect:StopContact",
          "connect:DescribeContact",
          "connect:GetContactAttributes",
          "connect:UpdateContactAttributes"
        ]
        Resource = [
          "arn:aws:connect:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/*",
          "arn:aws:connect:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/*/contact/*"
        ]
      }
    ]
  })
}

# Policy: KMS signing operations
resource "aws_iam_role_policy" "video_api_kms" {
  name = "kms-jwt-signing-policy"
  role = aws_iam_role.video_api_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "JWTSigningOperations"
        Effect = "Allow"
        Action = [
          "kms:Sign",
          "kms:GetPublicKey"
        ]
        Resource = aws_kms_key.video_jwt_signing.arn
      },
      {
        Sid    = "RecordingDecryption"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.video_recordings.arn
      }
    ]
  })
}

# Policy: S3 recordings access
resource "aws_iam_role_policy" "video_api_s3" {
  name = "s3-recordings-policy"
  role = aws_iam_role.video_api_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RecordingsAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.video_recordings.arn,
          "${aws_s3_bucket.video_recordings.arn}/*"
        ]
      }
    ]
  })
}

# Managed policy: Basic Lambda execution
resource "aws_iam_role_policy_attachment" "video_api_lambda_basic" {
  role       = aws_iam_role.video_api_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# --------------------------------------------
# 4. SES Email Configuration
# --------------------------------------------

# Email identity
resource "aws_ses_email_identity" "video_sender" {
  email = var.ses_sender_email
}

# Configuration set for tracking
resource "aws_ses_configuration_set" "video_notifications" {
  name = "video-visit-notifications-${var.environment}"

  delivery_options {
    tls_policy = "Require"  # TLS 1.2+ only
  }

  reputation_options {
    reputation_metrics_enabled = true
  }
}

# Event destination: CloudWatch Logs
resource "aws_ses_event_destination" "video_notifications_cloudwatch" {
  name                   = "cloudwatch-logs"
  configuration_set_name = aws_ses_configuration_set.video_notifications.name
  enabled                = true
  matching_types         = ["send", "delivery", "bounce", "complaint", "open", "click"]

  cloudwatch_destination {
    default_dimension_value = "video-notifications"
    dimension_configuration {
      dimension_name          = "ses:configuration-set"
      dimension_value_source  = "messageTag"
      default_dimension_value = aws_ses_configuration_set.video_notifications.name
    }
  }
}

# Email template (will be created separately via SES console or AWS SDK)
# aws ses create-template --cli-input-json file://ses-template.json

# --------------------------------------------
# 5. SSM Parameters (App Configuration)
# --------------------------------------------

resource "aws_ssm_parameter" "connect_instance_id" {
  name  = "/telehealth/${var.environment}/connect/instance-id"
  type  = "String"
  value = aws_connect_instance.main.id  # Reference existing or new instance

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "video_flow_id" {
  name  = "/telehealth/${var.environment}/connect/video-flow-id"
  type  = "String"
  value = aws_connect_contact_flow.video_visit.id

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "jwt_kms_key_id" {
  name  = "/telehealth/${var.environment}/security/jwt-key-id"
  type  = "String"
  value = aws_kms_key.video_jwt_signing.id

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "recordings_kms_key_arn" {
  name  = "/telehealth/${var.environment}/security/recordings-key-arn"
  type  = "String"
  value = aws_kms_key.video_recordings.arn

  tags = {
    Environment = var.environment
  }
}

# --------------------------------------------
# 6. CloudWatch Monitoring
# --------------------------------------------

# Log group for video visit audit events
resource "aws_cloudwatch_log_group" "video_audit" {
  name              = "/aws/video-visits/audit-${var.environment}"
  retention_in_days = 2555  # 7 years

  kms_key_id = aws_kms_key.video_recordings.arn

  tags = {
    Name        = "Video Visit Audit Logs"
    Environment = var.environment
    Compliance  = "HIPAA"
  }
}

# Metric filter: Token failures (security)
resource "aws_cloudwatch_log_metric_filter" "token_failures" {
  name           = "VideoTokenFailures"
  log_group_name = aws_cloudwatch_log_group.video_audit.name
  pattern        = "{ $.event_type = \"TOKEN_REDEEMED\" && $.success = false }"

  metric_transformation {
    name      = "TokenFailureCount"
    namespace = "Telehealth/VideoVisits"
    value     = "1"
  }
}

# Alarm: High token failure rate
resource "aws_cloudwatch_metric_alarm" "high_token_failure_rate" {
  alarm_name          = "video-visits-high-token-failures-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "TokenFailureCount"
  namespace           = "Telehealth/VideoVisits"
  period              = "300"  # 5 minutes
  statistic           = "Sum"
  threshold           = "10"   # >10 failures in 5 min
  alarm_description   = "High rate of token validation failures (possible attack)"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = {
    Environment = var.environment
    Severity    = "High"
  }
}

# Dashboard
resource "aws_cloudwatch_dashboard" "video_visits" {
  dashboard_name = "video-visits-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["Telehealth/VideoVisits", "VisitsScheduled", { stat = "Sum" }],
            [".", "VisitsStarted", { stat = "Sum" }],
            [".", "VisitsCompleted", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Video Visit Volume (Last 24h)"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["Telehealth/VideoVisits", "TokenFailureCount", { stat = "Sum" }],
            [".", "TokenRedemptionLatency", { stat = "Average" }]
          ]
          period = 300
          region = var.aws_region
          title  = "Token Security Metrics"
        }
      }
    ]
  })
}

# --------------------------------------------
# 7. SNS Topics
# --------------------------------------------

# Security alerts (token failures, suspicious activity)
resource "aws_sns_topic" "security_alerts" {
  name = "video-visit-security-alerts-${var.environment}"

  kms_master_key_id = "alias/aws/sns"

  tags = {
    Environment = var.environment
    Purpose     = "Security-Alerts"
  }
}

# --------------------------------------------
# 8. Outputs
# --------------------------------------------

output "video_jwt_kms_key_id" {
  description = "KMS key ID for JWT signing"
  value       = aws_kms_key.video_jwt_signing.id
}

output "video_recordings_bucket" {
  description = "S3 bucket for video recordings"
  value       = aws_s3_bucket.video_recordings.id
}

output "video_recordings_kms_key_arn" {
  description = "KMS key ARN for recordings encryption"
  value       = aws_kms_key.video_recordings.arn
}

output "video_audit_log_group" {
  description = "CloudWatch log group for video visit audits"
  value       = aws_cloudwatch_log_group.video_audit.name
}

output "connect_instance_id_ssm" {
  description = "SSM parameter for Connect instance ID"
  value       = aws_ssm_parameter.connect_instance_id.name
}

output "video_flow_id_ssm" {
  description = "SSM parameter for video contact flow ID"
  value       = aws_ssm_parameter.video_flow_id.name
}

# --------------------------------------------
# 9. Data Sources
# --------------------------------------------

data "aws_caller_identity" "current" {}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# --------------------------------------------
# 10. Variables
# --------------------------------------------

variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "ses_sender_email" {
  description = "SES verified sender email"
  type        = string
  default     = "noreply@eudaura.com"
}

# Note: Amazon Connect instance and contact flows must be created separately
# via AWS Console or Connect API (not fully supported in Terraform yet)
# Reference: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/connect_instance

