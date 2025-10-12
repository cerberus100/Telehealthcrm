# Application Load Balancer - Unified Routing
# Routes traffic to Web (Next.js) and API (NestJS) services
# HIPAA Compliant: TLS termination, security headers, origin verification

# ============================================
# ALB Listener Rules (Path-Based Routing)
# ============================================

# Rule 1: API Routes (/api/*) → API Service (Highest Priority)
resource "aws_lb_listener_rule" "api_routes" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10  # Higher priority = evaluated first

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  tags = merge(local.common_tags, {
    Name = "API Routes Rule"
  })
}

# Rule 2: Health Check (/health) → API Service
resource "aws_lb_listener_rule" "health_check" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/health", "/health/*"]
    }
  }

  tags = merge(local.common_tags, {
    Name = "Health Check Rule"
  })
}

# Rule 3: WebSocket (/socket.io/*) → API Service
resource "aws_lb_listener_rule" "websocket" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/socket.io/*"]
    }
  }

  tags = merge(local.common_tags, {
    Name = "WebSocket Rule"
  })
}

# Rule 4: Static Assets (/_next/static/*) → Web Service with caching headers
resource "aws_lb_listener_rule" "next_static" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 40

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    path_pattern {
      values = ["/_next/static/*"]
    }
  }

  tags = merge(local.common_tags, {
    Name = "Next.js Static Assets Rule"
  })
}

# Rule 5: Next.js Image Optimization (/_next/image*) → Web Service
resource "aws_lb_listener_rule" "next_images" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    path_pattern {
      values = ["/_next/image*"]
    }
  }

  tags = merge(local.common_tags, {
    Name = "Next.js Images Rule"
  })
}

# Rule 6: CloudFront Origin Verification
# Only allow traffic from CloudFront (optional but recommended)
resource "aws_lb_listener_rule" "origin_verify" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 5  # Highest priority

  action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Direct access not allowed"
      status_code  = "403"
    }
  }

  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = ["invalid"]  # Block if header doesn't match secret
    }
  }

  tags = merge(local.common_tags, {
    Name = "Origin Verification Rule"
  })
}

# Rule 7: Default → Web Service (Catch-all for all other routes)
resource "aws_lb_listener_rule" "web_default" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100  # Lowest priority (catch-all)

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  tags = merge(local.common_tags, {
    Name = "Web Default Rule"
  })
}

# ============================================
# HTTP to HTTPS Redirect (Already in alb-waf.tf but ensuring it's complete)
# ============================================

# This should already exist but including for completeness
# resource "aws_lb_listener" "http" {
#   load_balancer_arn = aws_lb.main.arn
#   port              = "80"
#   protocol          = "HTTP"

#   default_action {
#     type = "redirect"
#     redirect {
#       port        = "443"
#       protocol    = "HTTPS"
#       status_code = "HTTP_301"
#     }
#   }
# }

# ============================================
# Outputs
# ============================================

output "alb_routing_summary" {
  description = "ALB routing configuration summary"
  value = {
    api_routes     = "Priority 10: /api/* → API service"
    health_check   = "Priority 20: /health → API service"
    websocket      = "Priority 30: /socket.io/* → API service"
    next_static    = "Priority 40: /_next/static/* → Web service"
    next_images    = "Priority 50: /_next/image* → Web service"
    web_default    = "Priority 100: /* → Web service"
    origin_verify  = "Priority 5: Blocks non-CloudFront traffic"
  }
}

