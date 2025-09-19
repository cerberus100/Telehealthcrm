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
