# CloudWatch Monitoring & Alerting
# SOC 2 / HIPAA Compliance: System monitoring and incident detection

# ============================================
# 1. SNS Topics for Alerts
# ============================================

resource "aws_sns_topic" "critical_alerts" {
  name              = "${local.name_prefix}-critical-alerts-${local.environment}"
  display_name      = "Critical System Alerts"
  kms_master_key_id = aws_kms_key.sns.id

  tags = merge(local.common_tags, {
    Name     = "Critical Alerts Topic"
    Severity = "critical"
  })
}

resource "aws_sns_topic" "warning_alerts" {
  name              = "${local.name_prefix}-warning-alerts-${local.environment}"
  display_name      = "Warning System Alerts"
  kms_master_key_id = aws_kms_key.sns.id

  tags = merge(local.common_tags, {
    Name     = "Warning Alerts Topic"
    Severity = "warning"
  })
}

# Email subscription (to be confirmed manually)
resource "aws_sns_topic_subscription" "critical_email" {
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
  
  # Requires manual confirmation via email
}

# ============================================
# 2. CloudWatch Dashboard
# ============================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-${local.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # API Health Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", { stat = "Average" }],
            [".", "MemoryUtilization", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "API Service Health"
        }
      },
      
      # Database Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections"],
            [".", "CPUUtilization"],
            [".", "FreeableMemory"]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Database Performance"
        }
      },
      
      # API Gateway / ALB Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "p99" }],
            [".", "RequestCount", { stat = "Sum" }],
            [".", "HTTPCode_Target_5XX_Count", { stat = "Sum" }]
          ]
          period = 60
          stat   = "Average"
          region = var.aws_region
          title  = "API Response Metrics"
        }
      },
      
      # Video Visits
      {
        type = "log"
        properties = {
          query   = "SOURCE '/aws/ecs/${local.name_prefix}' | fields @timestamp, @message | filter action = 'VISIT_STARTED' | stats count() by bin(5m)"
          region  = var.aws_region
          title   = "Video Visits Started (5min bins)"
        }
      }
    ]
  })
}

# ============================================
# 3. Alarms - API Service
# ============================================

# High CPU utilization
resource "aws_cloudwatch_metric_alarm" "api_high_cpu" {
  alarm_name          = "${local.name_prefix}-api-high-cpu-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "API service CPU utilization > 80%"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  
  dimensions = {
    ServiceName = aws_ecs_service.api.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = local.common_tags
}

# High memory utilization
resource "aws_cloudwatch_metric_alarm" "api_high_memory" {
  alarm_name          = "${local.name_prefix}-api-high-memory-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "API service memory utilization > 85%"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.api.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = local.common_tags
}

# API 5XX errors
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${local.name_prefix}-api-5xx-errors-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "API returning > 10 5XX errors per minute"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.api.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = local.common_tags
}

# High API latency (p99)
resource "aws_cloudwatch_metric_alarm" "api_high_latency" {
  alarm_name          = "${local.name_prefix}-api-high-latency-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "p99"
  threshold           = 2.0  # 2 seconds
  alarm_description   = "API p99 latency > 2s"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    TargetGroup  = aws_lb_target_group.api.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = local.common_tags
}

# ============================================
# 4. Alarms - Database
# ============================================

# High database CPU
resource "aws_cloudwatch_metric_alarm" "db_high_cpu" {
  alarm_name          = "${local.name_prefix}-db-high-cpu-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Database CPU > 80%"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = local.common_tags
}

# Low database storage
resource "aws_cloudwatch_metric_alarm" "db_low_storage" {
  alarm_name          = "${local.name_prefix}-db-low-storage-${local.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240  # 10 GB
  alarm_description   = "Database free storage < 10GB"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = local.common_tags
}

# High database connections
resource "aws_cloudwatch_metric_alarm" "db_high_connections" {
  alarm_name          = "${local.name_prefix}-db-high-connections-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80  # Adjust based on instance size
  alarm_description   = "Database connections > 80"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = local.common_tags
}

# ============================================
# 5. Alarms - Video Visits
# ============================================

# Video visit failures (log-based metric)
resource "aws_cloudwatch_log_metric_filter" "video_visit_failures" {
  name           = "${local.name_prefix}-video-visit-failures"
  log_group_name = "/aws/ecs/${local.name_prefix}"
  pattern        = "[time, request_id, level=ERROR, action=VISIT_STARTED or action=VISIT_FAILED]"

  metric_transformation {
    name      = "VideoVisitFailures"
    namespace = "Telehealth/${var.environment}"
    value     = "1"
    unit      = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "video_visit_failures" {
  alarm_name          = "${local.name_prefix}-video-failures-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "VideoVisitFailures"
  namespace           = "Telehealth/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Video visit failures > 5 in 5 minutes"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = local.common_tags
}

# ============================================
# 6. Alarms - Security Events
# ============================================

# Failed login attempts
resource "aws_cloudwatch_log_metric_filter" "failed_logins" {
  name           = "${local.name_prefix}-failed-logins"
  log_group_name = "/aws/ecs/${local.name_prefix}"
  pattern        = "[time, request_id, level, action=failed_login]"

  metric_transformation {
    name      = "FailedLoginAttempts"
    namespace = "Telehealth/${var.environment}"
    value     = "1"
    unit      = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "excessive_failed_logins" {
  alarm_name          = "${local.name_prefix}-failed-logins-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FailedLoginAttempts"
  namespace           = "Telehealth/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = 20
  alarm_description   = "Failed login attempts > 20 in 5 minutes (potential attack)"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = local.common_tags
}

# ============================================
# 7. Outputs
# ============================================

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "critical_alerts_topic_arn" {
  description = "SNS topic ARN for critical alerts"
  value       = aws_sns_topic.critical_alerts.arn
}

output "warning_alerts_topic_arn" {
  description = "SNS topic ARN for warning alerts"
  value       = aws_sns_topic.warning_alerts.arn
}

