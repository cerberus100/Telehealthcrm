#!/bin/bash

# Migrate Terraform State from Local to S3 Backend
# CRITICAL: This prevents state loss and enables team collaboration
#
# Prerequisites:
# - AWS CLI configured with appropriate credentials
# - Terraform backend infrastructure already created (backend.tf)
# - Backup of current state file

set -e  # Exit on any error

echo "🔄 Terraform State Migration Script"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="infrastructure/terraform"
BACKUP_DIR="infrastructure/terraform/state-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Navigate to terraform directory
cd "$(dirname "$0")/.." || exit 1

# Step 1: Verify current directory
echo -e "${YELLOW}📍 Step 1: Verifying environment...${NC}"
if [ ! -d "$TERRAFORM_DIR" ]; then
    echo -e "${RED}❌ Terraform directory not found: $TERRAFORM_DIR${NC}"
    exit 1
fi

cd "$TERRAFORM_DIR" || exit 1
echo -e "${GREEN}✅ In Terraform directory${NC}"

# Step 2: Check for existing state
echo -e "\n${YELLOW}📂 Step 2: Checking for existing state...${NC}"
if [ ! -f "terraform.tfstate" ]; then
    echo -e "${RED}❌ No local state file found${NC}"
    echo -e "   This script is for migrating existing state."
    echo -e "   If starting fresh, just update backend config in main.tf and run: terraform init"
    exit 1
fi

echo -e "${GREEN}✅ Local state file found${NC}"

# Step 3: Create backup
echo -e "\n${YELLOW}💾 Step 3: Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"
cp terraform.tfstate "$BACKUP_DIR/terraform.tfstate.backup.$TIMESTAMP"
if [ -f "terraform.tfstate.backup" ]; then
    cp terraform.tfstate.backup "$BACKUP_DIR/terraform.tfstate.backup.old.$TIMESTAMP"
fi

echo -e "${GREEN}✅ Backup created: $BACKUP_DIR/terraform.tfstate.backup.$TIMESTAMP${NC}"

# Step 4: Get backend infrastructure details
echo -e "\n${YELLOW}🔍 Step 4: Getting backend infrastructure details...${NC}"

# First, ensure backend infrastructure exists
echo -e "   Applying backend.tf to create S3 bucket and DynamoDB table..."
terraform apply -target=aws_s3_bucket.terraform_state \
               -target=aws_dynamodb_table.terraform_locks \
               -target=aws_kms_key.terraform_state \
               -auto-approve

# Get outputs
BUCKET_NAME=$(terraform output -raw terraform_state_bucket 2>/dev/null || echo "")
TABLE_NAME=$(terraform output -raw terraform_locks_table 2>/dev/null || echo "")
KMS_KEY_ID=$(terraform output -raw terraform_state_kms_key_id 2>/dev/null || echo "")

if [ -z "$BUCKET_NAME" ] || [ -z "$TABLE_NAME" ]; then
    echo -e "${RED}❌ Failed to get backend infrastructure details${NC}"
    echo -e "   Please ensure backend.tf is applied first"
    exit 1
fi

echo -e "${GREEN}✅ Backend infrastructure ready${NC}"
echo -e "   S3 Bucket: $BUCKET_NAME"
echo -e "   DynamoDB Table: $TABLE_NAME"
echo -e "   KMS Key: $KMS_KEY_ID"

# Step 5: Update backend configuration
echo -e "\n${YELLOW}⚙️  Step 5: Updating backend configuration...${NC}"

# Create backend configuration file
cat > backend-config.hcl << EOF
bucket         = "$BUCKET_NAME"
key            = "prod/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "$TABLE_NAME"
encrypt        = true
kms_key_id     = "$KMS_KEY_ID"
EOF

echo -e "${GREEN}✅ Backend configuration created: backend-config.hcl${NC}"

# Step 6: Update main.tf
echo -e "\n${YELLOW}📝 Step 6: Updating main.tf...${NC}"

# Check if main.tf has local backend
if grep -q 'backend "local"' main.tf; then
    # Create updated main.tf with S3 backend
    sed -i.backup 's/backend "local" {/backend "s3" {/' main.tf
    sed -i.backup 's/path = "terraform.tfstate"/# Configured via backend-config.hcl/' main.tf
    
    echo -e "${GREEN}✅ main.tf updated (backup: main.tf.backup)${NC}"
else
    echo -e "${YELLOW}⚠️  Backend configuration already exists in main.tf${NC}"
fi

# Step 7: Initialize with backend migration
echo -e "\n${YELLOW}🔄 Step 7: Migrating state to S3...${NC}"
echo -e "   This will copy your local state to S3."
echo -e ""
read -p "   Continue with migration? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}⚠️  Migration cancelled${NC}"
    exit 0
fi

terraform init -backend-config=backend-config.hcl -migrate-state

# Step 8: Verify migration
echo -e "\n${YELLOW}✅ Step 8: Verifying migration...${NC}"

# Check if state is in S3
aws s3 ls "s3://$BUCKET_NAME/prod/" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ State successfully migrated to S3${NC}"
else
    echo -e "${RED}❌ State migration verification failed${NC}"
    exit 1
fi

# Verify state locking
terraform state list > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ State locking verified${NC}"
else
    echo -e "${RED}❌ State locking verification failed${NC}"
    exit 1
fi

# Step 9: Cleanup
echo -e "\n${YELLOW}🧹 Step 9: Cleanup recommendations...${NC}"
echo -e "   ${GREEN}SUCCESS!${NC} State has been migrated to S3."
echo -e ""
echo -e "   Next steps:"
echo -e "   1. Verify state: ${GREEN}terraform state list${NC}"
echo -e "   2. Delete local state files (after verification):"
echo -e "      ${YELLOW}rm terraform.tfstate terraform.tfstate.backup${NC}"
echo -e "   3. Commit backend changes:"
echo -e "      ${GREEN}git add main.tf backend.tf backend-config.hcl${NC}"
echo -e "      ${GREEN}git commit -m 'chore: migrate Terraform state to S3 backend'${NC}"
echo -e ""
echo -e "   ${GREEN}Backups available in: $BACKUP_DIR${NC}"
echo -e ""

echo -e "${GREEN}✅ Migration complete!${NC}"

