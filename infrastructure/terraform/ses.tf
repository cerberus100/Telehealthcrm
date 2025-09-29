# =============================================================================
# SES EMAIL SERVICE - OTP AND NOTIFICATION EMAILS
# =============================================================================

# SES Email Identity for sending emails
resource "aws_ses_email_identity" "noreply" {
  email = var.ses_from_email
}

# SES Email Identity for admin notifications
resource "aws_ses_email_identity" "admin" {
  email = var.admin_email
}

# SES Configuration Set for tracking and monitoring
resource "aws_ses_configuration_set" "main" {
  name = "${local.name_prefix}-ses-config-${local.environment}"

  delivery_options {
    tls_policy = "Require"
  }

  reputation_metrics_enabled = true
}

# SES Event Destination for bounces and complaints (CloudWatch)
resource "aws_ses_event_destination" "cloudwatch" {
  name                   = "${local.name_prefix}-ses-cloudwatch-${local.environment}"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["bounce", "complaint", "delivery", "reject", "send"]

  cloudwatch_destination {
    default_value  = "default"
    dimension_name = "ses:configuration-set"
    value_source   = "messageTag"
  }
}

# SNS Topic for SES bounce/complaint notifications
resource "aws_sns_topic" "ses_notifications" {
  name              = "${local.name_prefix}-ses-notifications-${local.environment}"
  display_name      = "SES Email Notifications"
  kms_master_key_id = aws_kms_key.sns.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ses-notifications-${local.environment}"
  })
}

# KMS Key for SNS Encryption
resource "aws_kms_key" "sns" {
  description             = "KMS key for SNS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sns-kms-${local.environment}"
  })
}

resource "aws_kms_alias" "sns" {
  name          = "alias/${local.name_prefix}-sns-${local.environment}"
  target_key_id = aws_kms_key.sns.key_id
}

# SNS Topic Policy for SES
resource "aws_sns_topic_policy" "ses_notifications" {
  arn = aws_sns_topic.ses_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.ses_notifications.arn
      }
    ]
  })
}

# SES Event Destination for bounces and complaints (SNS)
resource "aws_ses_event_destination" "sns" {
  name                   = "${local.name_prefix}-ses-sns-${local.environment}"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["bounce", "complaint"]

  sns_destination {
    topic_arn = aws_sns_topic.ses_notifications.arn
  }
}

# =============================================================================
# SES SENDING AUTHORIZATION
# =============================================================================

# IAM Policy for SES sending (attached to ECS task role)
data "aws_iam_policy_document" "ses_sending" {
  statement {
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
      "ses:SendTemplatedEmail"
    ]
    resources = [
      aws_ses_email_identity.noreply.arn,
      aws_ses_email_identity.admin.arn,
      aws_ses_configuration_set.main.arn
    ]
  }
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "ses_from_email" {
  description = "SES From Email Address"
  value       = aws_ses_email_identity.noreply.email
}

output "ses_admin_email" {
  description = "SES Admin Email Address"
  value       = aws_ses_email_identity.admin.email
}

output "ses_configuration_set_name" {
  description = "SES Configuration Set Name"
  value       = aws_ses_configuration_set.main.name
}

output "ses_notifications_topic_arn" {
  description = "SNS Topic ARN for SES Notifications"
  value       = aws_sns_topic.ses_notifications.arn
}
