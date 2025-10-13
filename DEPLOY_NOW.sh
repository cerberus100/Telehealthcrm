#!/bin/bash

# EMERGENCY DEPLOYMENT - Fix Production Service
# Run after Docker build completes

set -e

echo "🚨 Emergency Deployment to Fix Production"
echo "=========================================="

export AWS_ACCOUNT_ID=337909762852
export AWS_REGION=us-east-1
export IMAGE_NAME=telehealth-api

echo "✅ Step 1: Login to ECR"
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo "✅ Step 2: Push Docker image"
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${IMAGE_NAME}:latest

echo "✅ Step 3: Force ECS service update"
aws ecs update-service \
  --cluster telehealth-ecs-cluster-prod \
  --service telehealth-api-service-prod \
  --force-new-deployment \
  --region $AWS_REGION

echo "✅ Step 4: Wait for service to stabilize"
aws ecs wait services-stable \
  --cluster telehealth-ecs-cluster-prod \
  --services telehealth-api-service-prod \
  --region $AWS_REGION

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Verify:"
echo "  aws ecs describe-services --cluster telehealth-ecs-cluster-prod --services telehealth-api-service-prod"
echo ""

