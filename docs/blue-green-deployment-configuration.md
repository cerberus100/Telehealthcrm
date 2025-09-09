# Blue-Green Deployment Configuration

## 🚀 Deployment Architecture

### Overview
Blue-Green deployment strategy ensures zero-downtime deployments by maintaining two identical production environments (Blue and Green) and switching traffic between them.

### Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐
│   Route 53      │    │   Route 53      │
│   (DNS)         │    │   (DNS)         │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│   Blue Environment │    │  Green Environment │
│   (Current)      │    │   (New)         │
│                  │    │                  │
│  ┌─────────────┐ │    │  ┌─────────────┐ │
│  │ App Runner  │ │    │  │ App Runner  │ │
│  │ (Blue)      │ │    │  │ (Green)     │ │
│  └─────────────┘ │    │  └─────────────┘ │
│                  │    │                  │
│  ┌─────────────┐ │    │  ┌─────────────┐ │
│  │   Database  │ │    │  │   Database  │ │
│  │  (Shared)   │ │    │  │  (Shared)   │ │
│  └─────────────┘ │    │  └─────────────┘ │
│                  │    │                  │
│  ┌─────────────┐ │    │  ┌─────────────┐ │
│  │    Redis    │ │    │  │    Redis    │ │
│  │  (Shared)   │ │    │  │  (Shared)   │ │
│  └─────────────┘ │    │  └─────────────┘ │
└─────────────────┘    └─────────────────┘
```

---

## 🔧 Infrastructure as Code

### Terraform Configuration

#### Main Configuration
```hcl
# main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"
  
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  
  availability_zones = var.availability_zones
  private_subnets    = var.private_subnets
  public_subnets     = var.public_subnets
}

# Database Configuration
module "database" {
  source = "./modules/database"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  
  db_instance_class    = var.db_instance_class
  db_allocated_storage  = var.db_allocated_storage
  db_engine_version    = var.db_engine_version
  
  private_subnet_ids = module.vpc.private_subnet_ids
}

# Redis Configuration
module "redis" {
  source = "./modules/redis"
  
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  
  redis_node_type      = var.redis_node_type
  redis_engine_version = var.redis_engine_version
  
  private_subnet_ids = module.vpc.private_subnet_ids
}

# App Runner Blue Environment
module "app_runner_blue" {
  source = "./modules/app-runner"
  
  environment = var.environment
  color       = "blue"
  
  vpc_connector_arn = module.vpc.vpc_connector_arn
  
  database_url = module.database.database_url
  redis_host   = module.redis.redis_host
  
  depends_on = [module.database, module.redis]
}

# App Runner Green Environment
module "app_runner_green" {
  source = "./modules/app-runner"
  
  environment = var.environment
  color       = "green"
  
  vpc_connector_arn = module.vpc.vpc_connector_arn
  
  database_url = module.database.database_url
  redis_host   = module.redis.redis_host
  
  depends_on = [module.database, module.redis]
}

# Route 53 Configuration
module "route53" {
  source = "./modules/route53"
  
  domain_name = var.domain_name
  
  blue_app_runner_url  = module.app_runner_blue.app_runner_url
  green_app_runner_url = module.app_runner_green.app_runner_url
  
  current_environment = var.current_environment
}
```

#### Variables Configuration
```hcl
# variables.tf
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "private_subnets" {
  description = "Private subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "public_subnets" {
  description = "Public subnet CIDRs"
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage"
  type        = number
  default     = 100
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "api.telehealth.com"
}

variable "current_environment" {
  description = "Current active environment (blue or green)"
  type        = string
  default     = "blue"
}
```

#### App Runner Module
```hcl
# modules/app-runner/main.tf
resource "aws_apprunner_service" "main" {
  service_name = "${var.environment}-telehealth-api-${var.color}"
  
  source_configuration {
    image_repository {
      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          NODE_ENV                    = "production"
          DATABASE_URL               = var.database_url
          REDIS_HOST                 = var.redis_host
          REDIS_PORT                 = "6379"
          COGNITO_USER_POOL_ID       = var.cognito_user_pool_id
          COGNITO_CLIENT_ID          = var.cognito_client_id
          JWT_SECRET_ARN            = var.jwt_secret_arn
          CLOUDWATCH_LOG_GROUP      = "/aws/apprunner/telehealth-api-${var.environment}"
          OTEL_SERVICE_NAME         = "telehealth-api-${var.environment}"
          CORS_ORIGINS              = var.cors_origins
          RATE_LIMIT_MAX_REQUESTS   = "300"
          HIPAA_COMPLIANCE_MODE     = "true"
          SOC2_COMPLIANCE_MODE      = "true"
        }
      }
      image_identifier      = var.image_identifier
      image_repository_type = "ECR"
    }
    auto_deployments_enabled = false
  }
  
  instance_configuration {
    cpu    = "1 vCPU"
    memory = "2 GB"
  }
  
  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = var.vpc_connector_arn
    }
  }
  
  tags = {
    Environment = var.environment
    Color       = var.color
    Service     = "telehealth-api"
  }
}

# Outputs
output "app_runner_url" {
  value = aws_apprunner_service.main.service_url
}

output "app_runner_arn" {
  value = aws_apprunner_service.main.arn
}

output "app_runner_id" {
  value = aws_apprunner_service.main.id
}
```

---

## 🚀 Deployment Scripts

### 1. Deployment Script
```bash
#!/bin/bash
# deploy.sh - Blue-Green Deployment Script

set -e

# Configuration
ENVIRONMENT=${1:-production}
CURRENT_COLOR=${2:-blue}
NEW_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")
IMAGE_TAG=${3:-latest}
DOMAIN_NAME="api.telehealth.com"

echo "🚀 Starting Blue-Green Deployment"
echo "Environment: $ENVIRONMENT"
echo "Current Color: $CURRENT_COLOR"
echo "New Color: $NEW_COLOR"
echo "Image Tag: $IMAGE_TAG"

# Step 1: Build and Push Docker Image
echo "📦 Building and pushing Docker image..."
docker build -t telehealth-api:$IMAGE_TAG .
docker tag telehealth-api:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/telehealth-api:$IMAGE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/telehealth-api:$IMAGE_TAG

# Step 2: Update Terraform Configuration
echo "🔧 Updating Terraform configuration..."
cd infrastructure/terraform
terraform plan -var="image_identifier=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/telehealth-api:$IMAGE_TAG" -var="current_environment=$CURRENT_COLOR"

# Step 3: Deploy to New Environment
echo "🚀 Deploying to $NEW_COLOR environment..."
terraform apply -var="image_identifier=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/telehealth-api:$IMAGE_TAG" -var="current_environment=$CURRENT_COLOR" -auto-approve

# Step 4: Wait for Deployment
echo "⏳ Waiting for deployment to complete..."
NEW_SERVICE_ARN=$(terraform output -raw "${NEW_COLOR}_app_runner_arn")
aws apprunner wait service-updated --service-arn $NEW_SERVICE_ARN

# Step 5: Health Check
echo "🏥 Running health checks..."
NEW_SERVICE_URL=$(terraform output -raw "${NEW_COLOR}_app_runner_url")
HEALTH_CHECK_URL="$NEW_SERVICE_URL/health"

for i in {1..10}; do
  if curl -f -s $HEALTH_CHECK_URL > /dev/null; then
    echo "✅ Health check passed"
    break
  else
    echo "❌ Health check failed (attempt $i/10)"
    sleep 30
  fi
  
  if [ $i -eq 10 ]; then
    echo "💥 Health check failed after 10 attempts. Rolling back..."
    exit 1
  fi
done

# Step 6: Smoke Tests
echo "🧪 Running smoke tests..."
npm run test:smoke -- --base-url=$NEW_SERVICE_URL

# Step 7: Switch Traffic
echo "🔄 Switching traffic to $NEW_COLOR environment..."
terraform apply -var="image_identifier=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/telehealth-api:$IMAGE_TAG" -var="current_environment=$NEW_COLOR" -auto-approve

# Step 8: Monitor for 5 minutes
echo "📊 Monitoring deployment for 5 minutes..."
sleep 300

# Step 9: Verify Deployment
echo "✅ Verifying deployment..."
FINAL_HEALTH_CHECK=$(curl -f -s https://$DOMAIN_NAME/health)
if [ $? -eq 0 ]; then
  echo "🎉 Deployment successful!"
  echo "New active environment: $NEW_COLOR"
else
  echo "💥 Deployment verification failed. Initiating rollback..."
  terraform apply -var="image_identifier=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/telehealth-api:$IMAGE_TAG" -var="current_environment=$CURRENT_COLOR" -auto-approve
  exit 1
fi

echo "🏁 Blue-Green deployment completed successfully!"
```

### 2. Rollback Script
```bash
#!/bin/bash
# rollback.sh - Emergency Rollback Script

set -e

# Configuration
ENVIRONMENT=${1:-production}
CURRENT_COLOR=${2:-green}
ROLLBACK_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")
DOMAIN_NAME="api.telehealth.com"

echo "🔄 Starting Emergency Rollback"
echo "Environment: $ENVIRONMENT"
echo "Current Color: $CURRENT_COLOR"
echo "Rollback Color: $ROLLBACK_COLOR"

# Step 1: Switch Traffic Back
echo "🔄 Switching traffic back to $ROLLBACK_COLOR environment..."
cd infrastructure/terraform
terraform apply -var="current_environment=$ROLLBACK_COLOR" -auto-approve

# Step 2: Verify Rollback
echo "✅ Verifying rollback..."
sleep 60
ROLLBACK_HEALTH_CHECK=$(curl -f -s https://$DOMAIN_NAME/health)
if [ $? -eq 0 ]; then
  echo "🎉 Rollback successful!"
  echo "Active environment: $ROLLBACK_COLOR"
else
  echo "💥 Rollback verification failed!"
  exit 1
fi

# Step 3: Stop Failed Environment
echo "🛑 Stopping failed $CURRENT_COLOR environment..."
CURRENT_SERVICE_ARN=$(terraform output -raw "${CURRENT_COLOR}_app_runner_arn")
aws apprunner stop-service --service-arn $CURRENT_SERVICE_ARN

echo "🏁 Emergency rollback completed!"
```

### 3. Health Check Script
```bash
#!/bin/bash
# health-check.sh - Comprehensive Health Check Script

set -e

SERVICE_URL=${1:-https://api.telehealth.com}
TIMEOUT=${2:-30}

echo "🏥 Running comprehensive health checks for $SERVICE_URL"

# Basic Health Check
echo "1. Basic health check..."
curl -f -s --max-time $TIMEOUT "$SERVICE_URL/health" | jq '.'

# Database Connectivity
echo "2. Database connectivity check..."
curl -f -s --max-time $TIMEOUT "$SERVICE_URL/health/database" | jq '.'

# Redis Connectivity
echo "3. Redis connectivity check..."
curl -f -s --max-time $TIMEOUT "$SERVICE_URL/health/redis" | jq '.'

# Authentication Check
echo "4. Authentication check..."
AUTH_RESPONSE=$(curl -f -s --max-time $TIMEOUT -X POST "$SERVICE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}')
echo $AUTH_RESPONSE | jq '.'

# API Endpoints Check
echo "5. API endpoints check..."
curl -f -s --max-time $TIMEOUT "$SERVICE_URL/consults?limit=1" | jq '.'

# Performance Check
echo "6. Performance check..."
RESPONSE_TIME=$(curl -w "%{time_total}" -f -s --max-time $TIMEOUT "$SERVICE_URL/health" -o /dev/null)
echo "Response time: ${RESPONSE_TIME}s"

if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
  echo "✅ Performance check passed"
else
  echo "⚠️  Performance check warning: Response time > 1s"
fi

echo "🏁 Health checks completed!"
```

---

## 📊 Monitoring and Alerting

### 1. Deployment Monitoring
```yaml
# CloudWatch Alarms for Deployment
DeploymentAlarms:
  - Name: "DeploymentHealthCheck"
    Metric: "HealthCheckStatus"
    Threshold: 0
    Comparison: "LessThanThreshold"
    Period: 60
    EvaluationPeriods: 2
    AlarmActions:
      - "arn:aws:sns:us-east-1:account:deployment-alerts"
  
  - Name: "DeploymentResponseTime"
    Metric: "ResponseTime"
    Threshold: 1000
    Comparison: "GreaterThanThreshold"
    Period: 300
    EvaluationPeriods: 2
    AlarmActions:
      - "arn:aws:sns:us-east-1:account:deployment-alerts"
```

### 2. Traffic Switching Monitoring
```bash
# Monitor traffic switching
aws route53 get-health-check-status \
  --health-check-id <health-check-id> \
  --query 'HealthCheckStatuses[0].Status'

# Monitor DNS propagation
dig +short api.telehealth.com
```

---

## 🔒 Security Considerations

### 1. Deployment Security
- **Secrets Management**: All secrets stored in AWS Secrets Manager
- **Network Security**: VPC with private subnets for database and Redis
- **Access Control**: IAM roles with least privilege principle
- **Encryption**: All data encrypted at rest and in transit

### 2. Rollback Security
- **Immediate Rollback**: Can rollback within 5 minutes
- **Data Integrity**: No data loss during rollback
- **Audit Logging**: All deployment actions logged
- **Access Control**: Only authorized personnel can trigger rollback

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Code review completed
- [ ] Tests passing (unit, integration, E2E)
- [ ] Security scan completed
- [ ] Performance tests passed
- [ ] Database migrations tested
- [ ] Configuration verified
- [ ] Monitoring configured
- [ ] Rollback plan ready

### During Deployment
- [ ] Docker image built and pushed
- [ ] New environment deployed
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Traffic switched
- [ ] Monitoring active
- [ ] Team notified

### Post-Deployment
- [ ] Monitor for 30 minutes
- [ ] Performance metrics reviewed
- [ ] Error rates reviewed
- [ ] User feedback collected
- [ ] Documentation updated
- [ ] Lessons learned documented

---

*Last Updated: 2025-01-03*  
*Version: 1.0*  
*Next Review: 2025-04-03*
