#!/bin/bash

# Rollback ECS Deployment to Previous Stable Version
# Emergency rollback script for production incidents

set -e

echo "⏪ Eudaura ECS Rollback Script"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${1:-staging}
ROLLBACK_TO=${2:-previous}  # 'previous' or specific task definition revision
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "${RED}⚠️  WARNING: This will rollback ${ENVIRONMENT} environment${NC}"
echo -e "${RED}⚠️  Current services will be replaced with previous versions${NC}"
echo ""
read -p "Continue with rollback? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo -e "${YELLOW}Rollback cancelled${NC}"
  exit 0
fi

# Step 1: Get current task definitions
echo -e "\n${YELLOW}📋 Step 1: Getting current task definitions...${NC}"

API_TASK_DEF=$(aws ecs describe-services \
  --cluster telehealth-cluster-${ENVIRONMENT} \
  --services telehealth-api-${ENVIRONMENT} \
  --query 'services[0].taskDefinition' \
  --output text)

WEB_TASK_DEF=$(aws ecs describe-services \
  --cluster telehealth-cluster-${ENVIRONMENT} \
  --services telehealth-web-${ENVIRONMENT} \
  --query 'services[0].taskDefinition' \
  --output text)

echo -e "  Current API task: ${API_TASK_DEF}"
echo -e "  Current Web task: ${WEB_TASK_DEF}"

# Step 2: Determine rollback target
echo -e "\n${YELLOW}🎯 Step 2: Determining rollback target...${NC}"

if [ "$ROLLBACK_TO" == "previous" ]; then
  # Get previous revision
  API_FAMILY=$(echo $API_TASK_DEF | cut -d':' -f1-6)
  WEB_FAMILY=$(echo $WEB_TASK_DEF | cut -d':' -f1-6)
  
  CURRENT_API_REV=$(echo $API_TASK_DEF | rev | cut -d':' -f1 | rev)
  CURRENT_WEB_REV=$(echo $WEB_TASK_DEF | rev | cut -d':' -f1 | rev)
  
  PREVIOUS_API_REV=$((CURRENT_API_REV - 1))
  PREVIOUS_WEB_REV=$((CURRENT_WEB_REV - 1))
  
  if [ $PREVIOUS_API_REV -lt 1 ] || [ $PREVIOUS_WEB_REV -lt 1 ]; then
    echo -e "${RED}❌ No previous revision available${NC}"
    exit 1
  fi
  
  ROLLBACK_API_TASK="${API_FAMILY}:${PREVIOUS_API_REV}"
  ROLLBACK_WEB_TASK="${WEB_FAMILY}:${PREVIOUS_WEB_REV}"
else
  ROLLBACK_API_TASK="$ROLLBACK_TO"
  ROLLBACK_WEB_TASK="$ROLLBACK_TO"
fi

echo -e "  Rollback API to: ${ROLLBACK_API_TASK}"
echo -e "  Rollback Web to: ${ROLLBACK_WEB_TASK}"

# Step 3: Update services
echo -e "\n${YELLOW}⏪ Step 3: Rolling back services...${NC}"

echo -e "  Rolling back API service..."
aws ecs update-service \
  --cluster telehealth-cluster-${ENVIRONMENT} \
  --service telehealth-api-${ENVIRONMENT} \
  --task-definition ${ROLLBACK_API_TASK} \
  --force-new-deployment \
  --region ${AWS_REGION} \
  > /dev/null

echo -e "  Rolling back Web service..."
aws ecs update-service \
  --cluster telehealth-cluster-${ENVIRONMENT} \
  --service telehealth-web-${ENVIRONMENT} \
  --task-definition ${ROLLBACK_WEB_TASK} \
  --force-new-deployment \
  --region ${AWS_REGION} \
  > /dev/null

echo -e "${GREEN}✅ Rollback initiated${NC}"

# Step 4: Wait for stabilization
echo -e "\n${YELLOW}⏳ Step 4: Waiting for services to stabilize...${NC}"
echo -e "  This may take 3-5 minutes..."

aws ecs wait services-stable \
  --cluster telehealth-cluster-${ENVIRONMENT} \
  --services telehealth-api-${ENVIRONMENT} telehealth-web-${ENVIRONMENT} \
  --region ${AWS_REGION}

echo -e "${GREEN}✅ Services stable${NC}"

# Step 5: Health checks
echo -e "\n${YELLOW}🏥 Step 5: Verifying health...${NC}"

sleep 10

API_URL="https://api-${ENVIRONMENT}.eudaura.com"
WEB_URL="https://${ENVIRONMENT}.eudaura.com"

API_HEALTH=$(curl -sf ${API_URL}/health || echo "FAIL")
WEB_HEALTH=$(curl -sf ${WEB_URL}/api/health || echo "FAIL")

if [ "$API_HEALTH" == "FAIL" ] || [ "$WEB_HEALTH" == "FAIL" ]; then
  echo -e "${RED}❌ Health checks failed after rollback${NC}"
  echo -e "${RED}   Manual intervention required${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Health checks passed${NC}"

# Step 6: Summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Rollback Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Rolled back to:"
echo -e "  API: ${ROLLBACK_API_TASK}"
echo -e "  Web: ${ROLLBACK_WEB_TASK}"
echo ""
echo -e "Verify:"
echo -e "  curl ${API_URL}/health"
echo -e "  curl ${WEB_URL}/"
echo ""
echo -e "Monitor:"
echo -e "  aws logs tail /aws/ecs/telehealth-api --follow"
echo -e "  aws logs tail /aws/ecs/telehealth-web --follow"
echo ""

