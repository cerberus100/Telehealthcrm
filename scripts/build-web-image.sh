#!/bin/bash

# Build Next.js Docker Image Locally
# For testing before pushing to ECR

set -e

echo "🏗️  Building Next.js Docker Image"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${1:-development}
IMAGE_NAME="telehealth-web"
IMAGE_TAG=${2:-latest}

echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Image: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo ""

# Set build arguments based on environment
case $ENVIRONMENT in
  production)
    API_URL="https://api.eudaura.com"
    WS_URL="wss://api.eudaura.com"
    APP_URL="https://app.eudaura.com"
    ;;
  staging)
    API_URL="https://api-staging.eudaura.com"
    WS_URL="wss://api-staging.eudaura.com"
    APP_URL="https://staging.eudaura.com"
    ;;
  *)
    API_URL="http://localhost:3001"
    WS_URL="ws://localhost:3001"
    APP_URL="http://localhost:3000"
    ;;
esac

echo -e "${YELLOW}📦 Building image...${NC}"
cd apps/web

docker build \
  --build-arg NEXT_PUBLIC_API_URL=$API_URL \
  --build-arg NEXT_PUBLIC_WS_URL=$WS_URL \
  --build-arg NEXT_PUBLIC_APP_URL=$APP_URL \
  --tag ${IMAGE_NAME}:${IMAGE_TAG} \
  --tag ${IMAGE_NAME}:latest \
  -f Dockerfile \
  .

cd ../..

echo -e "${GREEN}✅ Image built successfully${NC}"
echo ""
echo -e "Test locally:"
echo -e "  docker run -p 3000:3000 ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo -e "Push to ECR:"
echo -e "  aws ecr get-login-password | docker login --username AWS --password-stdin <ecr-url>"
echo -e "  docker tag ${IMAGE_NAME}:${IMAGE_TAG} <ecr-url>/${IMAGE_NAME}:${IMAGE_TAG}"
echo -e "  docker push <ecr-url>/${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

