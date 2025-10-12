# CloudFront Distribution for Web Application
# HIPAA/SOC2 Compliant: CDN with WAF, SSL, and security headers

# ============================================
# 1. CloudFront Origin Access Identity
# ============================================

resource "aws_cloudfront_origin_access_identity" "web" {
  comment = "OAI for ${local.name_prefix} web application"
}

# ============================================
# 2. CloudFront Distribution
# ============================================

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Eudaura Telehealth Web Application"
  default_root_object = ""
  price_class         = "PriceClass_100"  # US, Canada, Europe
  http_version        = "http2and3"
  
  # Custom domain
  aliases = var.custom_domain != "" ? [var.custom_domain] : []

  # Origin: ALB (for SSR and API routes)
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
      origin_keepalive_timeout = 5
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.cloudfront_secret.result
    }
  }

  # Default cache behavior (SSR pages - low TTL)
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "alb-origin"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # Cache policy for SSR
    cache_policy_id = aws_cloudfront_cache_policy.ssr.id
    
    # Origin request policy
    origin_request_policy_id = aws_cloudfront_origin_request_policy.forward_all.id

    # Response headers policy (security headers)
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # Cache behavior: Static assets (/_next/static/*)
  ordered_cache_behavior {
    path_pattern     = "/_next/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-origin"
    compress         = true

    cache_policy_id          = aws_cloudfront_cache_policy.static_assets.id
    viewer_protocol_policy   = "redirect-to-https"
  }

  # Cache behavior: Next.js images (/_next/image*)
  ordered_cache_behavior {
    path_pattern     = "/_next/image*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-origin"
    compress         = true

    cache_policy_id        = aws_cloudfront_cache_policy.images.id
    viewer_protocol_policy = "redirect-to-https"
  }

  # Cache behavior: Public static files (/public/*)
  ordered_cache_behavior {
    path_pattern     = "/public/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-origin"
    compress         = true

    cache_policy_id        = aws_cloudfront_cache_policy.static_assets.id
    viewer_protocol_policy = "redirect-to-https"
  }

  # Cache behavior: API routes (no caching)
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-origin"
    compress         = false

    cache_policy_id            = aws_cloudfront_cache_policy.api.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.forward_all.id
    viewer_protocol_policy     = "redirect-to-https"
  }

  # SSL/TLS Configuration
  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn != "" ? var.certificate_arn : null
    cloudfront_default_certificate = var.certificate_arn == ""
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = var.certificate_arn != "" ? "sni-only" : null
  }

  # Geo-restriction (optional)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Custom error responses
  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 500
    response_code         = 500
    response_page_path    = "/500"
    error_caching_min_ttl = 0
  }

  # Logging
  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cloudfront_logs.bucket_domain_name
    prefix          = "web/"
  }

  # WAF integration
  web_acl_id = var.enable_waf ? aws_wafv2_web_acl.cloudfront[0].arn : null

  tags = merge(local.common_tags, {
    Name = "Web Application Distribution"
  })

  depends_on = [
    aws_lb.main,
    aws_lb_target_group.web
  ]
}

# ============================================
# 3. Cache Policies
# ============================================

# SSR pages - short TTL
resource "aws_cloudfront_cache_policy" "ssr" {
  name        = "${local.name_prefix}-ssr-cache-${local.environment}"
  comment     = "Cache policy for server-side rendered pages"
  default_ttl = 0
  max_ttl     = 86400   # 1 day max
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "all"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "CloudFront-Viewer-Country"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# Static assets - long TTL
resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "${local.name_prefix}-static-assets-${local.environment}"
  comment     = "Cache policy for static assets"
  default_ttl = 86400      # 1 day
  max_ttl     = 31536000   # 1 year
  min_ttl     = 3600       # 1 hour

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# Images - medium TTL
resource "aws_cloudfront_cache_policy" "images" {
  name        = "${local.name_prefix}-images-${local.environment}"
  comment     = "Cache policy for optimized images"
  default_ttl = 86400     # 1 day
  max_ttl     = 2592000   # 30 days
  min_ttl     = 3600      # 1 hour

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Accept"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"  # Image optimization uses query params
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

# API routes - no caching
resource "aws_cloudfront_cache_policy" "api" {
  name        = "${local.name_prefix}-api-no-cache-${local.environment}"
  comment     = "No caching for API routes"
  default_ttl = 0
  max_ttl     = 0
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "all"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "Content-Type", "X-Correlation-ID"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_gzip   = false
    enable_accept_encoding_brotli = false
  }
}

# ============================================
# 4. Origin Request Policy
# ============================================

resource "aws_cloudfront_origin_request_policy" "forward_all" {
  name    = "${local.name_prefix}-forward-all-${local.environment}"
  comment = "Forward all headers, cookies, and query strings"

  cookies_config {
    cookie_behavior = "all"
  }

  headers_config {
    header_behavior = "allViewer"
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

# ============================================
# 5. Response Headers Policy (Security)
# ============================================

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${local.name_prefix}-security-headers-${local.environment}"
  comment = "Security headers for HIPAA compliance"

  # Security headers
  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000  # 2 years
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }

  # Custom headers
  custom_headers_config {
    items {
      header   = "X-Content-Type-Options"
      value    = "nosniff"
      override = true
    }
    items {
      header   = "Permissions-Policy"
      value    = "camera=(self), microphone=(self), geolocation=()"
      override = true
    }
  }
}

# ============================================
# 6. CloudFront Logs Bucket
# ============================================

resource "aws_s3_bucket" "cloudfront_logs" {
  bucket = "${local.name_prefix}-cloudfront-logs-${data.aws_caller_identity.current.account_id}"

  tags = merge(local.common_tags, {
    Name = "CloudFront Logs"
  })
}

resource "aws_s3_bucket_versioning" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    expiration {
      days = 90  # Keep logs for 90 days
    }
  }
}

# ============================================
# 7. CloudFront Secret for Origin Verification
# ============================================

resource "random_password" "cloudfront_secret" {
  length  = 32
  special = false
}

resource "aws_ssm_parameter" "cloudfront_secret" {
  name  = "/telehealth/${var.environment}/cloudfront/origin-secret"
  type  = "SecureString"
  value = random_password.cloudfront_secret.result

  tags = merge(local.common_tags, {
    Name = "CloudFront Origin Verification Secret"
  })
}

# ============================================
# 8. Outputs
# ============================================

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.web.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_distribution_url" {
  description = "CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

