# =============================================================================
# APP RUNNER - SERVERLESS APPLICATION HOSTING
# =============================================================================

# IAM Role for App Runner
resource "aws_iam_role" "app_runner_role" {
  name = "${local.name_prefix}-app-runner-role-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-runner-role-${local.environment}"
  })
}

# IAM Role for App Runner Instance
resource "aws_iam_role" "app_runner_instance_role" {
  name = "${local.name_prefix}-app-runner-instance-role-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-runner-instance-role-${local.environment}"
  })
}

# App Runner Instance Role Policy
resource "aws_iam_role_policy" "app_runner_instance_policy" {
  name = "${local.name_prefix}-app-runner-instance-policy-${local.environment}"
  role = aws_iam_role.app_runner_instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.redis_credentials.arn,
          aws_secretsmanager_secret.cognito_client_secret.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [
          aws_kms_key.rds.arn,
          aws_kms_key.redis.arn,
          aws_kms_key.s3.arn,
          aws_kms_key.dynamodb.arn,
          aws_kms_key.sns.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.app_storage.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:ListUsers"
        ]
        Resource = data.aws_cognito_user_pool.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBClusters"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticache:DescribeReplicationGroups",
          "elasticache:DescribeCacheClusters"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.patient_provisional.arn,
          "${aws_dynamodb_table.patient_provisional.arn}/index/*",
          aws_dynamodb_table.clinician_applications.arn,
          "${aws_dynamodb_table.clinician_applications.arn}/index/*",
          aws_dynamodb_table.audit_logs.arn,
          "${aws_dynamodb_table.audit_logs.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail"
        ]
        Resource = [
          aws_ses_email_identity.noreply.arn,
          aws_ses_email_identity.admin.arn,
          aws_ses_configuration_set.main.arn
        ]
      }
    ]
  })
}

# App Runner Service (disabled - ECR repository not created yet)
# resource "aws_apprunner_service" "main" {
#   service_name = "${local.name_prefix}-api-${local.environment}"

#   source_configuration {
#     image_repository {
#       image_configuration {
#         port = "3000"
#         runtime_environment_variables = {
#           NODE_ENV                = "production"
#           API_PORT                = "3000"
#           API_DEMO_MODE           = "false"
#           DATABASE_URL            = "postgresql://telehealth_admin:${random_password.db_password.result}@${aws_db_instance.main.endpoint}/telehealth"
#           REDIS_URL               = "redis://:${random_password.redis_auth_token.result}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
#           COGNITO_USER_POOL_ID    = aws_cognito_user_pool.main.id
#           COGNITO_CLIENT_ID       = aws_cognito_user_pool_client.main.id
#           COGNITO_REGION          = var.aws_region
#           JWT_SECRET              = random_password.jwt_secret.result
#           AWS_REGION              = var.aws_region
#           LOG_LEVEL               = "info"
#         }
#         runtime_environment_secrets = {
#           DATABASE_PASSWORD       = "${aws_secretsmanager_secret.db_credentials.arn}:password::"
#           REDIS_AUTH_TOKEN        = "${aws_secretsmanager_secret.redis_credentials.arn}:auth_token::"
#           COGNITO_CLIENT_SECRET   = "${aws_secretsmanager_secret.cognito_client_secret.arn}:client_secret::"
#         }
#       }
#       image_identifier      = "${var.api_image_identifier}"
#       image_repository_type = "ECR"
#     }
#     auto_deployments_enabled = true
#   }

#   instance_configuration {
#     cpu    = var.app_cpu
#     memory = var.app_memory
#     instance_role_arn = aws_iam_role.app_runner_instance_role.arn
#   }

#   health_check_configuration {
#     healthy_threshold   = 1
#     interval           = 10
#     path               = "/health"
#     protocol           = "HTTP"
#     timeout            = 5
#     unhealthy_threshold = 5
#   }

#   tags = merge(local.common_tags, {
#     Name = "${local.name_prefix}-app-runner-${local.environment}"
#   })

#   depends_on = [
#     aws_iam_role_policy.app_runner_instance_policy
#   ]
# }

# =============================================================================
# ECS CLUSTER (Alternative to App Runner)
# =============================================================================

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-ecs-cluster-${local.environment}"

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-cluster-${local.environment}"
  })
}

# ECS Task Definition
resource "aws_ecs_task_definition" "main" {
  family                   = "${local.name_prefix}-api-${local.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.app_cpu
  memory                   = var.app_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = var.api_image_identifier
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "API_PORT"
          value = "3000"
        },
        {
          name  = "API_DEMO_MODE"
          value = "false"
        },
        {
          name  = "DATABASE_URL"
          value = "postgresql://telehealth_admin:${random_password.db_password.result}@${aws_db_instance.main.endpoint}/telehealth"
        },
        {
          name  = "REDIS_URL"
          value = "redis://:${random_password.redis_auth_token.result}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
        },
        {
          name  = "COGNITO_USER_POOL_ID"
          value = data.aws_cognito_user_pool.main.id
        },
        {
          name  = "COGNITO_CLIENT_ID"
          value = data.aws_cognito_user_pool_client.main.id
        },
        {
          name  = "COGNITO_REGION"
          value = var.aws_region
        },
        {
          name  = "JWT_SECRET"
          value = random_password.jwt_secret.result
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "LOG_LEVEL"
          value = "info"
        },
        {
          name  = "DEPLOYMENT_ENV"
          value = "production"
        },
        {
          name  = "CUSTOM_DOMAINS"
          value = "eudaura.com,app.eudaura.com,www.eudaura.com"
        },
        {
          name  = "AMPLIFY_APP_ID"
          value = "d1o2jv5ahrim0e"
        },
        {
          name  = "AWS_DYNAMO_TABLE"
          value = aws_dynamodb_table.patient_provisional.name
        },
        {
          name  = "AWS_AUDIT_TABLE"
          value = aws_dynamodb_table.audit_logs.name
        },
        {
          name  = "AWS_CLINICIAN_TABLE"
          value = aws_dynamodb_table.clinician_applications.name
        },
        {
          name  = "AWS_S3_UPLOAD_BUCKET"
          value = aws_s3_bucket.documents.bucket
        },
        {
          name  = "SES_FROM_EMAIL"
          value = var.ses_from_email
        },
        {
          name  = "SES_CONFIGURATION_SET"
          value = aws_ses_configuration_set.main.name
        },
        {
          name  = "SEED_ADMIN_EMAIL"
          value = var.admin_email
        }
      ]
      secrets = [
        {
          name      = "DATABASE_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:password::"
        },
        {
          name      = "REDIS_AUTH_TOKEN"
          valueFrom = "${aws_secretsmanager_secret.redis_credentials.arn}:auth_token::"
        },
        {
          name      = "COGNITO_CLIENT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.cognito_client_secret.arn}:client_secret::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs_api.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-task-${local.environment}"
  })
}

# ECS Service
resource "aws_ecs_service" "main" {
  name            = "${local.name_prefix}-api-service-${local.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.app_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy.ecs_execution_policy,
    aws_iam_role_policy.ecs_task_policy
  ]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-service-${local.environment}"
  })
}

# =============================================================================
# ECS SECURITY GROUPS
# =============================================================================

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${local.name_prefix}-ecs-tasks-${local.environment}"
  vpc_id      = aws_vpc.main.id

  # Allow inbound traffic from ALB
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "API traffic from ALB"
  }

  # Allow outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-tasks-sg-${local.environment}"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# ECS IAM ROLES
# =============================================================================

# ECS Execution Role
resource "aws_iam_role" "ecs_execution_role" {
  name = "${local.name_prefix}-ecs-execution-role-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-execution-role-${local.environment}"
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_policy" {
  name = "${local.name_prefix}-ecs-execution-policy-${local.environment}"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.redis_credentials.arn,
          aws_secretsmanager_secret.cognito_client_secret.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          aws_kms_key.rds.arn,
          aws_kms_key.redis.arn,
          aws_kms_key.s3.arn
        ]
      }
    ]
  })
}

# ECS Task Role
resource "aws_iam_role" "ecs_task_role" {
  name = "${local.name_prefix}-ecs-task-role-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-task-role-${local.environment}"
  })
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "${local.name_prefix}-ecs-task-policy-${local.environment}"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.app_storage.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:ListUsers"
        ]
        Resource = data.aws_cognito_user_pool.main.arn
      }
    ]
  })
}

# =============================================================================
# CLOUDWATCH LOG GROUPS
# =============================================================================

resource "aws_cloudwatch_log_group" "ecs_api" {
  name              = "/ecs/${local.name_prefix}-api-${local.environment}"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-api-logs-${local.environment}"
  })
}

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/ecs/${local.name_prefix}-exec-${local.environment}"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-exec-logs-${local.environment}"
  })
}

# =============================================================================
# ADDITIONAL SECRETS FOR COGNITO
# =============================================================================

# =============================================================================
# OUTPUTS
# =============================================================================

# output "app_runner_service_url" {
#   description = "App Runner Service URL"
#   value       = aws_apprunner_service.main.service_url
# }

# output "app_runner_service_arn" {
#   description = "App Runner Service ARN"
#   value       = aws_apprunner_service.main.arn
# }

output "ecs_cluster_name" {
  description = "ECS Cluster Name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ECS Cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "ECS Service Name"
  value       = aws_ecs_service.main.name
}

output "ecs_task_definition_arn" {
  description = "ECS Task Definition ARN"
  value       = aws_ecs_task_definition.main.arn
}
