# CloudWatch Dashboards Configuration

## 📊 Dashboard: Telehealth API - Overview

### Widget Configuration

```json
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "ResponseTime", "LoadBalancer", "telehealth-api"],
          [".", "TargetResponseTime", ".", "."],
          [".", "RequestCount", ".", "."]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "API Response Times",
        "period": 300,
        "stat": "Average"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", "LoadBalancer", "telehealth-api"],
          [".", "HTTPCode_Target_4XX_Count", ".", "."],
          [".", "HTTPCode_Target_5XX_Count", ".", "."]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "HTTP Status Codes",
        "period": 300,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "telehealth-db"],
          [".", "DatabaseConnections", ".", "."],
          [".", "FreeableMemory", ".", "."]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Database Metrics",
        "period": 300,
        "stat": "Average"
      }
    },
    {
      "type": "metric",
      "x": 8,
      "y": 6,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "telehealth-redis"],
          [".", "CurrConnections", ".", "."],
          [".", "FreeableMemory", ".", "."]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Redis Metrics",
        "period": 300,
        "stat": "Average"
      }
    },
    {
      "type": "metric",
      "x": 16,
      "y": 6,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/AppRunner", "ActiveInstances", "Service", "telehealth-api"],
          [".", "CPUUtilization", ".", "."],
          [".", "MemoryUtilization", ".", "."]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "App Runner Metrics",
        "period": 300,
        "stat": "Average"
      }
    }
  ]
}
```

---

## 📊 Dashboard: Telehealth API - Business Metrics

```json
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "business.consults.total"],
          [".", "business.consults.passed"],
          [".", "business.consults.failed"],
          [".", "business.consults.approved"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Consult Metrics",
        "period": 3600,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "business.shipments.total"],
          [".", "business.shipments.in_transit"],
          [".", "business.shipments.delivered"],
          [".", "business.shipments.exception"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Shipment Metrics",
        "period": 3600,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "business.prescriptions.total"],
          [".", "business.prescriptions.submitted"],
          [".", "business.prescriptions.dispensed"],
          [".", "business.prescriptions.rejected"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Prescription Metrics",
        "period": 3600,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "business.users.total"],
          [".", "business.users.active"],
          [".", "business.users.inactive"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "User Metrics",
        "period": 3600,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 12,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "business.notifications.total"],
          [".", "business.notifications.unread"],
          [".", "business.notifications.today"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Notification Metrics",
        "period": 3600,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 12,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "business.organizations.total"],
          [".", "business.organizations.active"],
          [".", "business.organizations.inactive"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Organization Metrics",
        "period": 3600,
        "stat": "Sum"
      }
    }
  ]
}
```

---

## 📊 Dashboard: Telehealth API - Security & Performance

```json
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "http.request.duration", "method", "GET"],
          [".", ".", ".", "POST"],
          [".", ".", ".", "PUT"],
          [".", ".", ".", "PATCH"],
          [".", ".", ".", "DELETE"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Request Duration by Method",
        "period": 300,
        "stat": "Average"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "http.request.count", "method", "GET"],
          [".", ".", ".", "POST"],
          [".", ".", ".", "PUT"],
          [".", ".", ".", "PATCH"],
          [".", ".", ".", "DELETE"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Request Count by Method",
        "period": 300,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "http.request.error.count", "error_type", "UnauthorizedException"],
          [".", ".", ".", "ForbiddenException"],
          [".", ".", ".", "NotFoundException"],
          [".", ".", ".", "BadRequestException"],
          [".", ".", ".", "InternalServerErrorException"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Error Count by Type",
        "period": 300,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "authentication.failures"],
          [".", "unauthorized.access.attempts"],
          [".", "rate.limit.exceeded"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Security Metrics",
        "period": 300,
        "stat": "Sum"
      }
    },
    {
      "type": "log",
      "x": 0,
      "y": 12,
      "width": 24,
      "height": 6,
      "properties": {
        "query": "SOURCE '/aws/apprunner/telehealth-api' | fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 100",
        "region": "us-east-1",
        "title": "Recent Errors",
        "view": "table"
      }
    }
  ]
}
```

---

## 📊 Dashboard: Telehealth API - External Services

```json
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "ups.api.response.time"],
          [".", "ups.api.error.count"],
          [".", "ups.api.success.count"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "UPS API Metrics",
        "period": 300,
        "stat": "Average"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "cognito.api.response.time"],
          [".", "cognito.api.error.count"],
          [".", "cognito.api.success.count"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Cognito API Metrics",
        "period": 300,
        "stat": "Average"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "websocket.connections.active"],
          [".", "websocket.messages.sent"],
          [".", "websocket.messages.failed"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "WebSocket Metrics",
        "period": 300,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["Custom/Telehealth", "database.query.duration"],
          [".", "database.connection.pool.active"],
          [".", "database.connection.pool.idle"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Database Performance",
        "period": 300,
        "stat": "Average"
      }
    }
  ]
}
```

---

## 🚨 CloudWatch Alarms Configuration

### Critical Alarms (P0)

```yaml
# API Health Check
api_health_check:
  alarm_name: "telehealth-api-health-check"
  metric_name: "HealthCheckStatus"
  namespace: "AWS/ApplicationELB"
  statistic: "Average"
  period: 60
  evaluation_periods: 2
  threshold: 0
  comparison_operator: "LessThanThreshold"
  alarm_actions:
    - "arn:aws:sns:us-east-1:account:telehealth-critical-alerts"

# High Response Time
high_response_time:
  alarm_name: "telehealth-api-high-response-time"
  metric_name: "ResponseTime"
  namespace: "AWS/ApplicationELB"
  statistic: "Average"
  period: 300
  evaluation_periods: 2
  threshold: 500
  comparison_operator: "GreaterThanThreshold"
  alarm_actions:
    - "arn:aws:sns:us-east-1:account:telehealth-high-alerts"

# High Error Rate
high_error_rate:
  alarm_name: "telehealth-api-high-error-rate"
  metric_name: "HTTPCode_Target_5XX_Count"
  namespace: "AWS/ApplicationELB"
  statistic: "Sum"
  period: 300
  evaluation_periods: 2
  threshold: 10
  comparison_operator: "GreaterThanThreshold"
  alarm_actions:
    - "arn:aws:sns:us-east-1:account:telehealth-high-alerts"
```

### High Priority Alarms (P1)

```yaml
# Database CPU High
database_cpu_high:
  alarm_name: "telehealth-db-cpu-high"
  metric_name: "CPUUtilization"
  namespace: "AWS/RDS"
  statistic: "Average"
  period: 300
  evaluation_periods: 2
  threshold: 80
  comparison_operator: "GreaterThanThreshold"
  alarm_actions:
    - "arn:aws:sns:us-east-1:account:telehealth-high-alerts"

# Redis Memory High
redis_memory_high:
  alarm_name: "telehealth-redis-memory-high"
  metric_name: "FreeableMemory"
  namespace: "AWS/ElastiCache"
  statistic: "Average"
  period: 300
  evaluation_periods: 2
  threshold: 100000000  # 100MB
  comparison_operator: "LessThanThreshold"
  alarm_actions:
    - "arn:aws:sns:us-east-1:account:telehealth-high-alerts"

# App Runner CPU High
apprunner_cpu_high:
  alarm_name: "telehealth-apprunner-cpu-high"
  metric_name: "CPUUtilization"
  namespace: "AWS/AppRunner"
  statistic: "Average"
  period: 300
  evaluation_periods: 2
  threshold: 80
  comparison_operator: "GreaterThanThreshold"
  alarm_actions:
    - "arn:aws:sns:us-east-1:account:telehealth-high-alerts"
```

### Medium Priority Alarms (P2)

```yaml
# Authentication Failures
auth_failures:
  alarm_name: "telehealth-auth-failures"
  metric_name: "authentication.failures"
  namespace: "Custom/Telehealth"
  statistic: "Sum"
  period: 300
  evaluation_periods: 3
  threshold: 50
  comparison_operator: "GreaterThanThreshold"
  alarm_actions:
    - "arn:aws:sns:us-east-1:account:telehealth-medium-alerts"

# Notification Delivery Failures
notification_failures:
  alarm_name: "telehealth-notification-failures"
  metric_name: "websocket.messages.failed"
  namespace: "Custom/Telehealth"
  statistic: "Sum"
  period: 300
  evaluation_periods: 3
  threshold: 20
  comparison_operator: "GreaterThanThreshold"
  alarm_actions:
    - "arn:aws:sns:us-east-1:account:telehealth-medium-alerts"
```

---

## 📈 Custom Metrics

### Business Metrics
- `business.consults.total`
- `business.consults.passed`
- `business.consults.failed`
- `business.consults.approved`
- `business.shipments.total`
- `business.shipments.in_transit`
- `business.shipments.delivered`
- `business.shipments.exception`
- `business.prescriptions.total`
- `business.prescriptions.submitted`
- `business.prescriptions.dispensed`
- `business.users.total`
- `business.users.active`
- `business.users.inactive`
- `business.organizations.total`
- `business.organizations.active`
- `business.notifications.total`
- `business.notifications.unread`

### Performance Metrics
- `http.request.duration`
- `http.request.count`
- `http.request.error.count`
- `database.query.duration`
- `database.connection.pool.active`
- `database.connection.pool.idle`
- `redis.cache.hit.rate`
- `redis.cache.miss.rate`

### Security Metrics
- `authentication.failures`
- `unauthorized.access.attempts`
- `rate.limit.exceeded`
- `jwt.token.expired`
- `jwt.token.invalid`

### External Service Metrics
- `ups.api.response.time`
- `ups.api.error.count`
- `ups.api.success.count`
- `cognito.api.response.time`
- `cognito.api.error.count`
- `cognito.api.success.count`

### WebSocket Metrics
- `websocket.connections.active`
- `websocket.connections.total`
- `websocket.messages.sent`
- `websocket.messages.failed`
- `websocket.heartbeat.failed`

---

*Configuration files for CloudWatch dashboards and alarms*
*Last Updated: [Current Date]*
*Version: 1.0*
