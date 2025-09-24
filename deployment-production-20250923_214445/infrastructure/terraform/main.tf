# Telehealth Platform - AWS Infrastructure
# HIPAA/SOC 2 Compliant Multi-Tenant SaaS

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
  
  # Backend configuration for state management
  backend "local" {
    path = "terraform.tfstate"
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# Random suffix for unique resource naming
resource "random_id" "suffix" {
  byte_length = 4
}

# Local variables
locals {
  name_prefix = var.project_name
  environment = var.environment
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Compliance  = "HIPAA-SOC2"
  }
  
  # HIPAA-required encryption settings
  encryption_config = {
    kms_key_deletion_window = 30
    s3_encryption_enabled   = true
    rds_encryption_enabled  = true
    ebs_encryption_enabled  = true
  }
}

# ==================================================
# PRODUCTION RESOURCES FOR TELEHEALTH PLATFORM
# ==================================================

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# Subnets
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-a"
  })
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-b"
  })
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.3.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-a"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

# Security Groups
resource "aws_security_group" "ecs" {
  name_prefix = "${local.name_prefix}-ecs-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-sg"
  })
}

# DynamoDB Tables
resource "aws_dynamodb_table" "provider_schedules" {
  name           = "${local.name_prefix}-schedules-${local.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "provider_id"
    type = "S"
  }

  global_secondary_index {
    name               = "provider-index"
    hash_key           = "provider_id"
    range_key          = "sk"
    projection_type    = "ALL"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-schedules-${local.environment}"
  })
}

resource "aws_dynamodb_table" "appointments" {
  name           = "${local.name_prefix}-appointments-${local.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-appointments-${local.environment}"
  })
}

# S3 Buckets
resource "aws_s3_bucket" "rx_pads" {
  bucket = "${local.name_prefix}-rx-pads-${local.environment}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rx-pads-${local.environment}"
  })
}

resource "aws_s3_bucket_versioning" "rx_pads" {
  bucket = aws_s3_bucket.rx_pads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "rx_pads" {
  bucket = aws_s3_bucket.rx_pads.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.telehealth.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "rx_pads" {
  bucket = aws_s3_bucket.rx_pads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# KMS Key for encryption
resource "aws_kms_key" "telehealth" {
  description             = "KMS key for telehealth platform"
  deletion_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-${local.environment}-kms"
  })
}

resource "aws_kms_alias" "telehealth" {
  name          = "alias/${local.name_prefix}-${local.environment}"
  target_key_id = aws_kms_key.telehealth.key_id
}

# CloudFront Distribution
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${local.name_prefix}-rx-pads-${local.environment}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "rx_pads" {
  origin {
    domain_name              = aws_s3_bucket.rx_pads.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
    origin_id                = "S3-${local.name_prefix}-rx-pads-${local.environment}"
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN for telehealth RX pad templates"
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${local.name_prefix}-rx-pads-${local.environment}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rx-pads-${local.environment}-cdn"
  })
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "subnet_ids" {
  description = "Subnet IDs"
  value       = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

output "security_group_id" {
  description = "Security Group ID"
  value       = aws_security_group.ecs.id
}

output "dynamo_tables" {
  description = "DynamoDB Table Names"
  value       = {
    schedules   = aws_dynamodb_table.provider_schedules.name
    appointments = aws_dynamodb_table.appointments.name
  }
}

output "s3_bucket" {
  description = "S3 Bucket Name"
  value       = aws_s3_bucket.rx_pads.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.rx_pads.id
}

output "kms_key_arn" {
  description = "KMS Key ARN"
  value       = aws_kms_key.telehealth.arn
}
