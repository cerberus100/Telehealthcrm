# =============================================================================
# COGNITO USER POOL - HIPAA COMPLIANT AUTHENTICATION
# =============================================================================

# Cognito User Pool (existing - not managed by Terraform)
# This resource exists in AWS but is not managed by Terraform to avoid breaking existing users
data "aws_cognito_user_pool" "main" {
  user_pool_id = "us-east-1_iN4LMb5az"
}

# Cognito User Pool Client (existing - not managed by Terraform)
data "aws_cognito_user_pool_client" "main" {
  client_id   = "6oftnb8tps7982js5t00dtdf90"
  user_pool_id = data.aws_cognito_user_pool.main.id
}

# Store Cognito Client Secret in Secrets Manager
resource "aws_secretsmanager_secret" "cognito_client_secret" {
  name                    = "${local.name_prefix}-cognito-client-secret-${local.environment}"
  description             = "Cognito User Pool Client Secret"
  recovery_window_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cognito-client-secret-${local.environment}"
  })
}

resource "aws_secretsmanager_secret_version" "cognito_client_secret" {
  secret_id = aws_secretsmanager_secret.cognito_client_secret.id
  secret_string = jsonencode({
    client_id     = data.aws_cognito_user_pool_client.main.id
    client_secret = data.aws_cognito_user_pool_client.main.client_secret
    user_pool_id  = data.aws_cognito_user_pool.main.id
    domain        = "telehealth-auth-prod"
  })
}

# JWT Secret for API
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = data.aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = data.aws_cognito_user_pool.main.arn
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = data.aws_cognito_user_pool_client.main.id
}

output "cognito_user_pool_endpoint" {
  description = "Cognito User Pool Endpoint"
  value       = "cognito-idp.${var.aws_region}.amazonaws.com/${data.aws_cognito_user_pool.main.id}"
}
