# TURN/STUN Server Configuration for Amazon Connect WebRTC
# HIPAA Compliance: Encrypted media relay for video visits

# Note: Amazon Connect/Chime provides managed TURN infrastructure
# This file documents the configuration strategy and fallback options

# ============================================
# 1. Primary: AWS-Managed TURN Servers
# ============================================
# Amazon Chime SDK automatically provides:
# - Geographic distribution (edge locations)
# - High availability (99.9% SLA)
# - TLS/DTLS encryption
# - No additional configuration needed

# The TURN endpoints are provided in the meeting response:
# meeting.mediaPlacement.turnControlUrl

# ============================================
# 2. Backup: Custom TURN Servers (Optional)
# ============================================
# For additional redundancy or on-premise requirements

resource "aws_ssm_parameter" "turn_servers_config" {
  name        = "/telehealth/${var.environment}/webrtc/turn-servers"
  description = "TURN server configuration for WebRTC fallback"
  type        = "String"
  
  # JSON configuration for multiple TURN servers
  value = jsonencode({
    primary = {
      urls = ["turns:turn1.${var.custom_domain}:443?transport=tcp"]
      username = "turn-user"
      credential_ssm = "/telehealth/${var.environment}/turn/credential-1"
      region = "us-east-1"
    }
    secondary = {
      urls = ["turns:turn2.${var.custom_domain}:443?transport=tcp"]
      username = "turn-user"
      credential_ssm = "/telehealth/${var.environment}/turn/credential-2"
      region = "us-west-2"
    }
    public_fallback = {
      # Public STUN servers for basic connectivity (NAT traversal only)
      urls = [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302"
      ]
    }
  })

  tags = merge(local.common_tags, {
    Name = "TURN Server Configuration"
    Purpose = "WebRTC Media Relay"
  })
}

# ============================================
# 3. ICE Transport Policy Configuration
# ============================================

resource "aws_ssm_parameter" "ice_transport_policy" {
  name        = "/telehealth/${var.environment}/webrtc/ice-policy"
  description = "ICE transport policy for HIPAA compliance"
  type        = "String"
  
  # Options:
  # - "all" (default): Try direct connection first, fall back to TURN
  # - "relay": Force all traffic through TURN (max privacy, slower)
  value = var.force_turn_relay ? "relay" : "all"

  tags = merge(local.common_tags, {
    Name = "ICE Transport Policy"
    Compliance = "HIPAA"
  })
}

# ============================================
# 4. WebRTC Configuration Parameters
# ============================================

resource "aws_ssm_parameter" "webrtc_config" {
  name        = "/telehealth/${var.environment}/webrtc/config"
  description = "WebRTC connection configuration"
  type        = "String"
  
  value = jsonencode({
    # Connection parameters
    iceServers = {
      aws_managed = true  # Use Chime SDK TURN servers
      custom_fallback = true  # Enable custom TURN servers as fallback
    }
    
    # Quality of Service
    bandwidth = {
      video = {
        min = 300  # kbps
        max = 2500 # kbps
        start = 800 # kbps
      }
      audio = {
        min = 12   # kbps
        max = 128  # kbps
      }
    }
    
    # Codec preferences
    codecs = {
      video = ["H264", "VP8", "VP9"]
      audio = ["opus", "PCMU", "PCMA"]
    }
    
    # Network resilience
    reconnection = {
      enabled = true
      max_attempts = 3
      initial_delay_ms = 1000
      max_delay_ms = 10000
    }
    
    # HIPAA: Media encryption
    encryption = {
      dtls_srtp = true  # Enforced
      tls_version = "1.2"
    }
  })

  tags = merge(local.common_tags, {
    Name = "WebRTC Configuration"
  })
}

# ============================================
# 5. TURN Server Credentials (Secrets Manager)
# ============================================

resource "aws_secretsmanager_secret" "turn_credential_1" {
  name_prefix             = "${local.name_prefix}-turn-credential-1-"
  description             = "TURN server credential for us-east-1"
  recovery_window_in_days = 7
  
  tags = merge(local.common_tags, {
    Name = "TURN Credential 1"
    Region = "us-east-1"
  })
}

resource "aws_secretsmanager_secret_version" "turn_credential_1" {
  secret_id     = aws_secretsmanager_secret.turn_credential_1.id
  secret_string = jsonencode({
    username = "turn-user-${var.environment}"
    password = random_password.turn_password_1.result
  })
}

resource "random_password" "turn_password_1" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "turn_credential_2" {
  name_prefix             = "${local.name_prefix}-turn-credential-2-"
  description             = "TURN server credential for us-west-2"
  recovery_window_in_days = 7
  
  tags = merge(local.common_tags, {
    Name = "TURN Credential 2"
    Region = "us-west-2"
  })
}

resource "aws_secretsmanager_secret_version" "turn_credential_2" {
  secret_id     = aws_secretsmanager_secret.turn_credential_2.id
  secret_string = jsonencode({
    username = "turn-user-${var.environment}"
    password = random_password.turn_password_2.result
  })
}

resource "random_password" "turn_password_2" {
  length  = 32
  special = true
}

# ============================================
# 6. Outputs
# ============================================

output "turn_config_ssm_parameter" {
  description = "SSM parameter name for TURN server configuration"
  value       = aws_ssm_parameter.turn_servers_config.name
}

output "ice_policy_ssm_parameter" {
  description = "SSM parameter name for ICE transport policy"
  value       = aws_ssm_parameter.ice_transport_policy.name
}

output "webrtc_config_ssm_parameter" {
  description = "SSM parameter name for WebRTC configuration"
  value       = aws_ssm_parameter.webrtc_config.name
}

# ============================================
# 7. IAM Permissions for API to Read Config
# ============================================

data "aws_iam_policy_document" "turn_config_access" {
  statement {
    sid    = "ReadTURNConfiguration"
    effect = "Allow"
    
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
    ]
    
    resources = [
      aws_ssm_parameter.turn_servers_config.arn,
      aws_ssm_parameter.ice_transport_policy.arn,
      aws_ssm_parameter.webrtc_config.arn,
    ]
  }
  
  statement {
    sid    = "ReadTURNCredentials"
    effect = "Allow"
    
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    
    resources = [
      aws_secretsmanager_secret.turn_credential_1.arn,
      aws_secretsmanager_secret.turn_credential_2.arn,
    ]
  }
}

# Attach to ECS task role
resource "aws_iam_role_policy" "ecs_turn_config_access" {
  name   = "${local.name_prefix}-ecs-turn-config-${local.environment}"
  role   = aws_iam_role.ecs_task_role.id
  policy = data.aws_iam_policy_document.turn_config_access.json
}

