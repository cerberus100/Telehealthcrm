#!/bin/bash
# Production Deployment Script

echo "🚀 Deploying Telehealth Platform to production"

# 1. Database Setup
echo "Run database migrations:"
echo "  psql $DATABASE_URL -f packages/db/migrations/20240101000000_update_user_roles.sql"
echo "  psql $DATABASE_URL -f packages/db/migrations/20250916_add_signature_events.sql"

# 2. Environment Variables
echo "Set these in AWS Systems Manager Parameter Store:"
echo "  NODE_ENV=production"
echo "  COGNITO_USER_POOL_ID=your-user-pool-id"
echo "  DYNAMODB_SCHEDULE_TABLE=telehealth-schedules-production"
echo "  S3_RX_PAD_BUCKET=telehealth-rx-pads-production"
echo "  OTEL_COLLECTOR_ENDPOINT=https://your-collector-endpoint"

# 3. AWS Infrastructure
echo "Create AWS resources:"
echo "  - DynamoDB tables (provider-schedules, appointment-bookings)"
echo "  - S3 buckets with versioning and CORS"
echo "  - CloudFront distribution"
echo "  - IAM roles and policies"

# 4. Deploy to ECS Fargate
echo "Deploy backend to ECS Fargate"

# 5. Deploy Frontend to Amplify
echo "Deploy frontend to AWS Amplify"

echo "✅ Deployment ready!"
