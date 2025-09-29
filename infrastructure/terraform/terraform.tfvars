# Terraform Variables for Telehealth CRM Production Deployment
# AWS Account: 337909762852
# Region: us-east-1

# Project Configuration
project_name = "telehealth"
environment = "prod"
aws_region = "us-east-1"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
database_subnet_cidrs = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

# Database Configuration
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_backup_retention_period = 30

# Application Configuration
app_cpu = 512
app_memory = 1024
app_desired_count = 2

# Security Configuration
allowed_cidr_blocks = ["0.0.0.0/0"]
enable_waf = true
enable_shield = false

# Monitoring and Compliance
enable_guardduty = true
enable_security_hub = true
enable_config = true
cloudtrail_retention_days = 2557

# Backup and Recovery
backup_retention_days = 2557
point_in_time_recovery = true

# Cost Optimization
enable_cost_anomaly_detection = true

# Notification Configuration
alert_email = "admin@telehealth.com"

# Domain Configuration
domain_name = ""
certificate_arn = ""

# API Configuration
api_image_identifier = "337909762852.dkr.ecr.us-east-1.amazonaws.com/telehealth-api:latest"

# SES Email Configuration
ses_from_email = "noreply@eudaura.com"
admin_email = "admin@eudaura.com"
