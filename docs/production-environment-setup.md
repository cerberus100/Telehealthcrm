# Production Environment Setup Guide

## 🏗️ Infrastructure Overview

### AWS Services Used
- **App Runner**: Containerized application hosting
- **RDS PostgreSQL**: Managed database service
- **ElastiCache Redis**: Managed Redis service
- **Cognito**: User authentication and management
- **Secrets Manager**: Secure secret storage
- **CloudWatch**: Monitoring and logging
- **VPC**: Network isolation and security
- **WAF**: Web application firewall
- **Route 53**: DNS management

---

## 🔧 Environment Configuration

### Required Environment Variables

#### Database Configuration
```bash
# Production Database
DATABASE_URL=postgresql://username:password@prod-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432/telehealth_prod

# Database Connection Pool
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
```

#### Redis Configuration
```bash
# Production Redis
REDIS_HOST=prod-redis.xyz.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS=true
```

#### Authentication Configuration
```bash
# Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1

# JWT Configuration
JWT_SECRET_ARN=arn:aws:secretsmanager:us-east-1:account:secret:jwt-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

#### AWS Configuration
```bash
# AWS Region
AWS_REGION=us-east-1

# Secrets Manager
SECRETS_MANAGER_REGION=us-east-1

# CloudWatch
CLOUDWATCH_LOG_GROUP=/aws/apprunner/telehealth-api-prod
CLOUDWATCH_LOG_STREAM=api
```

#### Observability Configuration
```bash
# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_API_KEY=your-honeycomb-api-key
OTEL_SERVICE_NAME=telehealth-api-prod
OTEL_SERVICE_VERSION=1.0.0
OTEL_SAMPLING_RATIO=0.1

# Sentry (Error Tracking)
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
```

#### Security Configuration
```bash
# CORS Configuration
CORS_ORIGINS=https://main.xyz.amplifyapp.com,https://admin.xyz.amplifyapp.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=300

# Security Headers
HELMET_ENABLED=true
HSTS_ENABLED=true
```

#### Feature Flags
```bash
# Feature Toggles
UPS_POLLING_ENABLED=true
REAL_TIME_NOTIFICATIONS=true
API_DEMO_MODE=false
HIPAA_COMPLIANCE_MODE=true
SOC2_COMPLIANCE_MODE=true
```

---

## 🚀 Deployment Process

### 1. Pre-Deployment Checklist

#### Code Quality
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code review completed
- [ ] Security scan completed
- [ ] Performance tests passed
- [ ] Documentation updated

#### Infrastructure
- [ ] Database migrations tested
- [ ] Redis configuration verified
- [ ] Cognito configuration verified
- [ ] Secrets Manager secrets updated
- [ ] CloudWatch alarms configured

#### Security
- [ ] Security audit completed
- [ ] HIPAA compliance verified
- [ ] SOC 2 compliance verified
- [ ] Penetration testing completed
- [ ] Access controls verified

### 2. Blue-Green Deployment Process

#### Step 1: Prepare Green Environment
```bash
# Build application
npm run build

# Run database migrations
npm run prisma:migrate:deploy

# Verify configuration
npm run config:verify
```

#### Step 2: Deploy to Green Environment
```bash
# Deploy to App Runner (Green)
aws apprunner start-deployment \
  --service-arn arn:aws:apprunner:us-east-1:account:service/telehealth-api-green \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "account.dkr.ecr.us-east-1.amazonaws.com/telehealth-api:latest",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "DATABASE_URL": "postgresql://...",
          "REDIS_HOST": "prod-redis.xyz.cache.amazonaws.com"
        }
      }
    }
  }'
```

#### Step 3: Health Check Green Environment
```bash
# Wait for deployment to complete
aws apprunner wait service-updated \
  --service-arn arn:aws:apprunner:us-east-1:account:service/telehealth-api-green

# Run health checks
curl -f https://green.telehealth-api.com/health

# Run smoke tests
npm run test:smoke -- --base-url=https://green.telehealth-api.com
```

#### Step 4: Switch Traffic to Green
```bash
# Update Route 53 to point to green environment
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.telehealth.com",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [{"Value": "green.telehealth-api.com"}]
      }
    }]
  }'
```

#### Step 5: Monitor and Verify
```bash
# Monitor metrics for 15 minutes
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name ResponseTime \
  --dimensions Name=LoadBalancer,Value=telehealth-api-green \
  --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

#### Step 6: Cleanup Blue Environment (if successful)
```bash
# Stop blue environment
aws apprunner stop-service \
  --service-arn arn:aws:apprunner:us-east-1:account:service/telehealth-api-blue
```

### 3. Rollback Process

#### Emergency Rollback
```bash
# Switch traffic back to blue environment
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.telehealth.com",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [{"Value": "blue.telehealth-api.com"}]
      }
    }]
  }'

# Stop green environment
aws apprunner stop-service \
  --service-arn arn:aws:apprunner:us-east-1:account:service/telehealth-api-green
```

---

## 🔒 Security Configuration

### 1. Network Security

#### VPC Configuration
```yaml
# VPC with private subnets
VPC:
  CIDR: 10.0.0.0/16
  Subnets:
    - Private: 10.0.1.0/24 (us-east-1a)
    - Private: 10.0.2.0/24 (us-east-1b)
    - Public: 10.0.3.0/24 (us-east-1a)
    - Public: 10.0.4.0/24 (us-east-1b)
```

#### Security Groups
```yaml
# App Runner Security Group
AppRunnerSG:
  Inbound:
    - Port: 443, Source: 0.0.0.0/0, Protocol: TCP
    - Port: 80, Source: 0.0.0.0/0, Protocol: TCP
  Outbound:
    - Port: 5432, Destination: DatabaseSG, Protocol: TCP
    - Port: 6379, Destination: RedisSG, Protocol: TCP
    - Port: 443, Destination: 0.0.0.0/0, Protocol: TCP

# Database Security Group
DatabaseSG:
  Inbound:
    - Port: 5432, Source: AppRunnerSG, Protocol: TCP
  Outbound: []

# Redis Security Group
RedisSG:
  Inbound:
    - Port: 6379, Source: AppRunnerSG, Protocol: TCP
  Outbound: []
```

### 2. Application Security

#### WAF Configuration
```yaml
# Web Application Firewall Rules
WAFRules:
  - Name: AWSManagedRulesCommonRuleSet
  - Name: AWSManagedRulesKnownBadInputsRuleSet
  - Name: AWSManagedRulesSQLiRuleSet
  - Name: RateLimitRule
    Priority: 1
    Action: BLOCK
    Conditions:
      - Type: RATE_BASED
        RateLimit: 2000
```

#### Secrets Management
```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "telehealth-api/jwt-secret" \
  --description "JWT signing secret" \
  --secret-string "your-jwt-secret-here"

aws secretsmanager create-secret \
  --name "telehealth-api/database-password" \
  --description "Database password" \
  --secret-string "your-db-password-here"
```

### 3. Compliance Configuration

#### HIPAA Compliance
```bash
# Enable encryption at rest
RDS_ENCRYPTION=true
RDS_KMS_KEY_ID=arn:aws:kms:us-east-1:account:key/key-id

# Enable encryption in transit
REDIS_TLS=true
DATABASE_SSL=true

# Enable audit logging
AUDIT_LOGGING_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years
```

#### SOC 2 Compliance
```bash
# Enable comprehensive logging
LOG_LEVEL=info
STRUCTURED_LOGGING=true
LOG_RETENTION_DAYS=90

# Enable monitoring
MONITORING_ENABLED=true
ALERTING_ENABLED=true
```

---

## 📊 Monitoring and Alerting

### 1. CloudWatch Alarms

#### Critical Alarms (P0)
```yaml
# API Health Check
api_health_check:
  metric: HealthCheckStatus
  threshold: 0
  comparison: LessThanThreshold
  period: 60
  evaluation_periods: 2
  alarm_actions:
    - arn:aws:sns:us-east-1:account:telehealth-critical-alerts

# High Response Time
high_response_time:
  metric: ResponseTime
  threshold: 500
  comparison: GreaterThanThreshold
  period: 300
  evaluation_periods: 2
  alarm_actions:
    - arn:aws:sns:us-east-1:account:telehealth-high-alerts
```

#### High Priority Alarms (P1)
```yaml
# Database CPU High
database_cpu_high:
  metric: CPUUtilization
  threshold: 80
  comparison: GreaterThanThreshold
  period: 300
  evaluation_periods: 2
  alarm_actions:
    - arn:aws:sns:us-east-1:account:telehealth-high-alerts

# Redis Memory High
redis_memory_high:
  metric: FreeableMemory
  threshold: 100000000  # 100MB
  comparison: LessThanThreshold
  period: 300
  evaluation_periods: 2
  alarm_actions:
    - arn:aws:sns:us-east-1:account:telehealth-high-alerts
```

### 2. Custom Metrics

#### Business Metrics
```typescript
// Record business metrics
telemetryService.recordMetric('business.consults.total', totalConsults);
telemetryService.recordMetric('business.shipments.delivered', deliveredShipments);
telemetryService.recordMetric('business.users.active', activeUsers);
```

#### Performance Metrics
```typescript
// Record performance metrics
telemetryService.recordHistogram('http.request.duration', duration, {
  method: 'POST',
  route: '/consults',
  status_code: '200'
});
```

---

## 🔄 Backup and Recovery

### 1. Database Backups

#### Automated Backups
```yaml
# RDS Automated Backups
RDSBackup:
  BackupRetentionPeriod: 30  # days
  BackupWindow: "03:00-04:00"  # UTC
  MaintenanceWindow: "sun:04:00-sun:05:00"  # UTC
  MultiAZ: true
  Encryption: true
```

#### Manual Backup Process
```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier telehealth-prod-db \
  --db-snapshot-identifier telehealth-prod-backup-$(date +%Y%m%d-%H%M%S)
```

### 2. Application Data Backups

#### Redis Backup
```bash
# Enable Redis persistence
RedisConfig:
  Snapshotting: true
  SnapshotFrequency: "900 1 300 10 60 10000"
  AppendOnlyFile: true
```

#### File Storage Backup
```bash
# S3 bucket with versioning and lifecycle
S3Bucket:
  Versioning: enabled
  LifecycleRules:
    - Name: "Delete old versions"
      Status: enabled
      NoncurrentVersionExpiration:
        NoncurrentDays: 30
```

### 3. Disaster Recovery

#### Recovery Time Objectives (RTO)
- **Critical Systems**: 1 hour
- **Important Systems**: 4 hours
- **Standard Systems**: 24 hours

#### Recovery Point Objectives (RPO)
- **Critical Data**: 15 minutes
- **Important Data**: 1 hour
- **Standard Data**: 24 hours

#### Recovery Procedures
1. **Database Recovery**:
   - Restore from latest snapshot
   - Apply transaction logs
   - Verify data integrity

2. **Application Recovery**:
   - Deploy to new environment
   - Restore configuration
   - Verify functionality

3. **Full System Recovery**:
   - Restore infrastructure
   - Restore data
   - Restore applications
   - Verify end-to-end functionality

---

## 📋 Production Checklist

### Pre-Production
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Backup procedures tested
- [ ] Disaster recovery plan tested

### Production Deployment
- [ ] Blue-green deployment executed
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Monitoring active
- [ ] Alerts active
- [ ] Documentation updated
- [ ] Team notified

### Post-Production
- [ ] Monitor for 24 hours
- [ ] Performance metrics reviewed
- [ ] Error rates reviewed
- [ ] User feedback collected
- [ ] Lessons learned documented
- [ ] Process improvements identified

---

*Last Updated: 2025-01-03*  
*Version: 1.0*  
*Next Review: 2025-04-03*
