# ECS Service for Next.js Web Application
# HIPAA/SOC2 Compliant: Containerized deployment with health checks and auto-scaling

# ============================================
# 1. ECR Repository for Web Images
# ============================================

resource "aws_ecr_repository" "web" {
  name                 = "${local.name_prefix}-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key        = aws_kms_key.s3.arn
  }

  tags = merge(local.common_tags, {
    Name = "Web Application Container Registry"
  })
}

# Lifecycle policy to keep only recent images
resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus     = "any"
        countType     = "imageCountMoreThan"
        countNumber   = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# ============================================
# 2. CloudWatch Log Group for Web Service
# ============================================

resource "aws_cloudwatch_log_group" "web" {
  name              = "/aws/ecs/${local.name_prefix}-web"
  retention_in_days = 30  # 30 days for operational logs, audit logs separate
  kms_key_id        = aws_kms_key.s3.arn

  tags = merge(local.common_tags, {
    Name = "Web Service Logs"
  })
}

# ============================================
# 3. ECS Task Definition for Web
# ============================================

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_prefix}-web-${local.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"   # 0.5 vCPU (can scale up)
  memory                   = "1024"  # 1 GB (Next.js needs memory for SSR)
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_web_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = "${aws_ecr_repository.web.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "NEXT_PUBLIC_API_URL"
          value = "https://api.${var.custom_domain}"
        },
        {
          name  = "NEXT_PUBLIC_WS_URL"
          value = "wss://api.${var.custom_domain}"
        },
        {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://${var.custom_domain}"
        },
        {
          name  = "PORT"
          value = "3000"
        }
      ]

      secrets = [
        # Add secrets from Secrets Manager as needed
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      # Resource limits
      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])

  tags = merge(local.common_tags, {
    Name = "Web Application Task"
  })
}

# ============================================
# 4. IAM Role for Web Task
# ============================================

resource "aws_iam_role" "ecs_web_task_role" {
  name = "${local.name_prefix}-ecs-web-task-role-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

# Policy for web task to access S3, DynamoDB, SES (for API route handlers)
resource "aws_iam_role_policy" "ecs_web_task_policy" {
  name = "${local.name_prefix}-ecs-web-task-policy-${local.environment}"
  role = aws_iam_role.ecs_web_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "${aws_s3_bucket.app_storage.arn}",
          "${aws_s3_bucket.app_storage.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.provider_schedules.arn,
          "${aws_dynamodb_table.provider_schedules.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [
          aws_kms_key.s3.arn,
          aws_kms_key.dynamodb.arn
        ]
      }
    ]
  })
}

# ============================================
# 5. Security Group for Web Service
# ============================================

resource "aws_security_group" "ecs_web" {
  name_prefix = "${local.name_prefix}-ecs-web-${local.environment}"
  description = "Security group for web ECS tasks"
  vpc_id      = aws_vpc.main.id

  # Allow inbound from ALB only
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow all outbound (for API calls, external services)
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "ECS Web Service SG"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# ============================================
# 6. ALB Target Group for Web
# ============================================

resource "aws_lb_target_group" "web" {
  name        = "${local.name_prefix}-web-${local.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  # Health check configuration
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  # Deregistration delay for graceful shutdown
  deregistration_delay = 30

  # Stickiness for session management
  stickiness {
    type            = "lb_cookie"
    enabled         = true
    cookie_duration = 86400  # 24 hours
  }

  tags = merge(local.common_tags, {
    Name = "Web Application Target Group"
  })
}

# ============================================
# 7. ECS Service for Web
# ============================================

resource "aws_ecs_service" "web" {
  name            = "${local.name_prefix}-web-${local.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 2  # Minimum 2 for high availability
  launch_type     = "FARGATE"
  
  # Platform version for Fargate
  platform_version = "LATEST"

  # Network configuration
  network_configuration {
    security_groups  = [aws_security_group.ecs_web.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  # Load balancer configuration
  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  # Deployment configuration
  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
    
    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }
  }

  # Service discovery (optional)
  # service_registries {
  #   registry_arn = aws_service_discovery_service.web.arn
  # }

  depends_on = [
    aws_iam_role_policy.ecs_execution_policy,
    aws_iam_role_policy.ecs_web_task_policy,
    aws_lb_listener.https
  ]

  tags = merge(local.common_tags, {
    Name = "Web Application Service"
  })
}

# ============================================
# 8. Auto Scaling for Web Service
# ============================================

resource "aws_appautoscaling_target" "web" {
  max_capacity       = 10  # Scale up to 10 containers
  min_capacity       = 2   # Always run at least 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale up based on CPU
resource "aws_appautoscaling_policy" "web_cpu" {
  name               = "${local.name_prefix}-web-cpu-${local.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Scale up based on memory
resource "aws_appautoscaling_policy" "web_memory" {
  name               = "${local.name_prefix}-web-memory-${local.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Scale based on ALB request count
resource "aws_appautoscaling_policy" "web_requests" {
  name               = "${local.name_prefix}-web-requests-${local.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label        = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.web.arn_suffix}"
    }
    target_value = 1000  # 1000 requests per target
  }
}

# ============================================
# 9. Outputs
# ============================================

output "web_ecr_repository_url" {
  description = "ECR repository URL for web application"
  value       = aws_ecr_repository.web.repository_url
}

output "web_service_name" {
  description = "ECS web service name"
  value       = aws_ecs_service.web.name
}

output "web_task_definition_arn" {
  description = "Web task definition ARN"
  value       = aws_ecs_task_definition.web.arn
}

output "web_target_group_arn" {
  description = "Web target group ARN"
  value       = aws_lb_target_group.web.arn
}

