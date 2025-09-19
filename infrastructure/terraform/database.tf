# RDS PostgreSQL Database
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group-${local.environment}"
  subnet_ids = aws_subnet.database[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group-${local.environment}"
  })
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-${local.environment}"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg-${local.environment}"
  })
}

resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = local.encryption_config.kms_key_deletion_window

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-kms-${local.environment}"
  })
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name_prefix}-rds-${local.environment}"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres-${local.environment}"

  # Engine configuration
  engine         = "postgres"
  engine_version = "15.8"
  instance_class = var.db_instance_class

  # Storage configuration
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = local.encryption_config.rds_encryption_enabled
  kms_key_id           = aws_kms_key.rds.arn

  # Database configuration
  db_name  = "telehealth"
  username = "telehealth_admin"
  password = random_password.db_password.result

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Backup configuration
  backup_retention_period = min(var.backup_retention_days, 35)
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  # Monitoring and logging
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # High availability
  multi_az               = true
  deletion_protection    = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "${local.name_prefix}-postgres-final-snapshot-${local.environment}-${random_id.suffix.hex}"

  # Performance insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres-${local.environment}"
  })

  depends_on = [aws_db_subnet_group.main]
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name_prefix = "${local.name_prefix}-rds-monitoring-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ElastiCache Redis Cluster
resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-${local.environment}"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-sg-${local.environment}"
  })
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group-${local.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-subnet-group-${local.environment}"
  })
}

resource "aws_kms_key" "redis" {
  description             = "KMS key for Redis encryption"
  deletion_window_in_days = local.encryption_config.kms_key_deletion_window

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-kms-${local.environment}"
  })
}

resource "aws_kms_alias" "redis" {
  name          = "alias/${local.name_prefix}-redis-${local.environment}"
  target_key_id = aws_kms_key.redis.key_id
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${local.name_prefix}-redis-${local.environment}"
  description                = "Redis cluster for Telehealth CRM"

  # Node configuration
  node_type                  = "cache.t3.micro"
  port                       = 6379
  parameter_group_name       = "default.redis7"

  # Cluster configuration
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled          = true

  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result
  kms_key_id                = aws_kms_key.redis.arn

  # Backup configuration
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"

  # Maintenance
  maintenance_window = "sun:05:00-sun:07:00"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-${local.environment}"
  })
}

resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
  upper   = true
  lower   = true
  numeric = true
}

# Store database credentials in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.name_prefix}-db-credentials-${local.environment}"
  description             = "Database credentials for Telehealth CRM"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = aws_db_instance.main.username
    password = aws_db_instance.main.password
    host     = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
    database = aws_db_instance.main.db_name
  })
}

resource "aws_secretsmanager_secret" "redis_credentials" {
  name                    = "${local.name_prefix}-redis-credentials-${local.environment}"
  description             = "Redis credentials for Telehealth CRM"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    endpoint    = aws_elasticache_replication_group.main.primary_endpoint_address
    port        = aws_elasticache_replication_group.main.port
    auth_token  = aws_elasticache_replication_group.main.auth_token
  })
}
