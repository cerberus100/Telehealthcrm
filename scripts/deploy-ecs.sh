#!/bin/bash

# Deploy Eudaura Platform to ECS (Unified Web + API Deployment)
# Replaces Amplify with ECS-based Next.js deployment

set -e

echo "🚀 Eudaura ECS Deployment Script"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${1:-staging}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}Account: ${AWS_ACCOUNT_ID}${NC}"
echo ""

# Step 1: Build and push Docker images
echo -e "${YELLOW}📦 Step 1: Building Docker images...${NC}"

# Build API image
echo -e "  Building API image..."
cd apps/api
docker build -t telehealth-api:latest .
docker tag telehealth-api:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-api:latest
docker tag telehealth-api:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-api:${ENVIRONMENT}

# Build Web image
echo -e "  Building Web image..."
cd ../web
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api-${ENVIRONMENT}.eudaura.com \
  --build-arg NEXT_PUBLIC_WS_URL=wss://api-${ENVIRONMENT}.eudaura.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://${ENVIRONMENT}.eudaura.com \
  -t telehealth-web:latest \
  -f Dockerfile .
docker tag telehealth-web:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-web:latest
docker tag telehealth-web:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-web:${ENVIRONMENT}

cd ../..

echo -e "${GREEN}✅ Images built${NC}"

# Step 2: Login to ECR
echo -e "\n${YELLOW}🔐 Step 2: Logging in to ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo -e "${GREEN}✅ Logged in to ECR${NC}"

# Step 3: Push images
echo -e "\n${YELLOW}📤 Step 3: Pushing images to ECR...${NC}"

echo -e "  Pushing API image..."
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-api:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-api:${ENVIRONMENT}

echo -e "  Pushing Web image..."
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-web:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-web:${ENVIRONMENT}

echo -e "${GREEN}✅ Images pushed${NC}"

# Step 4: Update ECS services
echo -e "\n${YELLOW}🔄 Step 4: Updating ECS services...${NC}"

echo -e "  Updating API service..."
aws ecs update-service \
  --cluster telehealth-cluster-${ENVIRONMENT} \
  --service telehealth-api-${ENVIRONMENT} \
  --force-new-deployment \
  --region ${AWS_REGION} \
  > /dev/null

echo -e "  Updating Web service..."
aws ecs update-service \
  --cluster telehealth-cluster-${ENVIRONMENT} \
  --service telehealth-web-${ENVIRONMENT} \
  --force-new-deployment \
  --region ${AWS_REGION} \
  > /dev/null

echo -e "${GREEN}✅ Services updating${NC}"

# Step 5: Wait for deployment
echo -e "\n${YELLOW}⏳ Step 5: Waiting for deployment to stabilize...${NC}"
echo -e "  This may take 3-5 minutes..."

aws ecs wait services-stable \
  --cluster telehealth-cluster-${ENVIRONMENT} \
  --services telehealth-api-${ENVIRONMENT} telehealth-web-${ENVIRONMENT} \
  --region ${AWS_REGION}

echo -e "${GREEN}✅ Deployment stable${NC}"

# Step 6: Invalidate CloudFront cache
echo -e "\n${YELLOW}🔄 Step 6: Invalidating CloudFront cache...${NC}"

DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='Eudaura Telehealth Web Application'].Id" \
  --output text)

if [ -n "$DISTRIBUTION_ID" ]; then
  aws cloudfront create-invalidation \
    --distribution-id ${DISTRIBUTION_ID} \
    --paths "/*" \
    > /dev/null
  echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
else
  echo -e "${YELLOW}⚠️  CloudFront distribution not found, skipping invalidation${NC}"
fi

# Step 7: Health checks
echo -e "\n${YELLOW}🏥 Step 7: Running health checks...${NC}"

sleep 10  # Wait for ALB to pick up new containers

API_URL="https://api-${ENVIRONMENT}.eudaura.com"
WEB_URL="https://${ENVIRONMENT}.eudaura.com"

echo -e "  Checking API health..."
API_HEALTH=$(curl -sf ${API_URL}/health || echo "FAIL")
if [ "$API_HEALTH" == "FAIL" ]; then
  echo -e "${RED}❌ API health check failed${NC}"
  exit 1
fi

echo -e "  Checking Web health..."
WEB_HEALTH=$(curl -sf ${WEB_URL}/api/health || echo "FAIL")
if [ "$WEB_HEALTH" == "FAIL" ]; then
  echo -e "${RED}❌ Web health check failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ All health checks passed${NC}"

# Step 8: Summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Environment: ${ENVIRONMENT}"
echo -e "API URL: ${API_URL}"
echo -e "Web URL: ${WEB_URL}"
echo ""
echo -e "Next steps:"
echo -e "  1. Verify deployment: curl ${API_URL}/health"
echo -e "  2. Check logs: aws logs tail /aws/ecs/telehealth-web --follow"
echo -e "  3. Monitor metrics in CloudWatch dashboard"
echo ""
echo -e "Rollback: ./scripts/rollback-ecs.sh ${ENVIRONMENT}"
echo ""

