#!/bin/bash

# ============================================
# Video Visit Infrastructure Deployment
# HIPAA/SOC2 Compliant - CLI Only
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${ENVIRONMENT:-prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="telehealth-video"
DOMAIN="${DOMAIN:-eudaura.com}"
SES_SENDER="noreply@${DOMAIN}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}Video Visit Infrastructure Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}=================================================${NC}\n"

# ============================================
# PHASE 1: KMS KEYS
# ============================================

echo -e "${GREEN}[1/10] Creating KMS Keys...${NC}"

# Create JWT signing key (ECC for ES256)
echo "  → Creating JWT signing key (ECC_NIST_P256)..."
JWT_KEY_ID=$(aws kms create-key \
  --key-spec ECC_NIST_P256 \
  --key-usage SIGN_VERIFY \
  --description "Video visit JWT signing key (ES256) - ${ENVIRONMENT}" \
  --tags TagKey=Name,TagValue="telehealth-video-jwt-signing-${ENVIRONMENT}" \
         TagKey=Environment,TagValue="${ENVIRONMENT}" \
         TagKey=Compliance,TagValue="HIPAA" \
  --region ${AWS_REGION} \
  --query 'KeyMetadata.KeyId' \
  --output text)

echo "  ✓ JWT Key ID: ${JWT_KEY_ID}"

# Create alias
aws kms create-alias \
  --alias-name "alias/video-jwt-signing-${ENVIRONMENT}" \
  --target-key-id ${JWT_KEY_ID} \
  --region ${AWS_REGION}

# Create recordings encryption key (symmetric)
echo "  → Creating recordings encryption key..."
RECORDINGS_KEY_ID=$(aws kms create-key \
  --key-spec SYMMETRIC_DEFAULT \
  --key-usage ENCRYPT_DECRYPT \
  --description "Video recordings encryption key - ${ENVIRONMENT}" \
  --tags TagKey=Name,TagValue="telehealth-video-recordings-${ENVIRONMENT}" \
         TagKey=Environment,TagValue="${ENVIRONMENT}" \
         TagKey=Compliance,TagValue="HIPAA-WORM" \
  --region ${AWS_REGION} \
  --query 'KeyMetadata.KeyId' \
  --output text)

echo "  ✓ Recordings Key ID: ${RECORDINGS_KEY_ID}"

# Create alias
aws kms create-alias \
  --alias-name "alias/video-recordings-${ENVIRONMENT}" \
  --target-key-id ${RECORDINGS_KEY_ID} \
  --region ${AWS_REGION}

# Enable automatic key rotation
aws kms enable-key-rotation \
  --key-id ${RECORDINGS_KEY_ID} \
  --region ${AWS_REGION}

echo -e "${GREEN}✓ KMS keys created successfully${NC}\n"

# ============================================
# PHASE 2: S3 BUCKETS
# ============================================

echo -e "${GREEN}[2/10] Creating S3 Buckets...${NC}"

# Generate unique suffix
BUCKET_SUFFIX=$(openssl rand -hex 4)

# Create recordings bucket
RECORDINGS_BUCKET="${PROJECT_NAME}-recordings-${ENVIRONMENT}-${BUCKET_SUFFIX}"
echo "  → Creating recordings bucket: ${RECORDINGS_BUCKET}..."

aws s3api create-bucket \
  --bucket ${RECORDINGS_BUCKET} \
  --region ${AWS_REGION} \
  --create-bucket-configuration LocationConstraint=${AWS_REGION} || true

# Enable versioning (required for Object Lock)
aws s3api put-bucket-versioning \
  --bucket ${RECORDINGS_BUCKET} \
  --versioning-configuration Status=Enabled \
  --region ${AWS_REGION}

# Enable Object Lock (WORM compliance)
aws s3api put-object-lock-configuration \
  --bucket ${RECORDINGS_BUCKET} \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Years": 7
      }
    }
  }' \
  --region ${AWS_REGION}

# Enable server-side encryption with KMS
aws s3api put-bucket-encryption \
  --bucket ${RECORDINGS_BUCKET} \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "'${RECORDINGS_KEY_ID}'"
      },
      "BucketKeyEnabled": true
    }]
  }' \
  --region ${AWS_REGION}

# Block all public access
aws s3api put-public-access-block \
  --bucket ${RECORDINGS_BUCKET} \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region ${AWS_REGION}

# Bucket policy: Require TLS + KMS
aws s3api put-bucket-policy \
  --bucket ${RECORDINGS_BUCKET} \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "RequireTLS",
        "Effect": "Deny",
        "Principal": "*",
        "Action": "s3:*",
        "Resource": [
          "arn:aws:s3:::'${RECORDINGS_BUCKET}'",
          "arn:aws:s3:::'${RECORDINGS_BUCKET}'/*"
        ],
        "Condition": {
          "Bool": {
            "aws:SecureTransport": "false"
          }
        }
      },
      {
        "Sid": "DenyUnencryptedUploads",
        "Effect": "Deny",
        "Principal": "*",
        "Action": "s3:PutObject",
        "Resource": "arn:aws:s3:::'${RECORDINGS_BUCKET}'/*",
        "Condition": {
          "StringNotEquals": {
            "s3:x-amz-server-side-encryption": "aws:kms"
          }
        }
      }
    ]
  }' \
  --region ${AWS_REGION}

# Lifecycle policy: Glacier after 90 days, delete after 7 years
aws s3api put-bucket-lifecycle-configuration \
  --bucket ${RECORDINGS_BUCKET} \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "archive-old-recordings",
      "Status": "Enabled",
      "Transitions": [{
        "Days": 90,
        "StorageClass": "GLACIER"
      }],
      "Expiration": {
        "Days": 2555
      }
    }]
  }' \
  --region ${AWS_REGION}

echo -e "${GREEN}✓ S3 bucket created: ${RECORDINGS_BUCKET}${NC}\n"

# ============================================
# PHASE 3: SES EMAIL CONFIGURATION
# ============================================

echo -e "${GREEN}[3/10] Configuring SES Email...${NC}"

# Verify sender email identity
echo "  → Verifying email: ${SES_SENDER}..."
aws ses verify-email-identity \
  --email-address ${SES_SENDER} \
  --region ${AWS_REGION}

echo -e "${YELLOW}  ⚠ ACTION REQUIRED: Check inbox for ${SES_SENDER}${NC}"
echo -e "${YELLOW}  ⚠ Click the verification link in the email from AWS${NC}"

# Verify admin email too
aws ses verify-email-identity \
  --email-address ${ADMIN_EMAIL} \
  --region ${AWS_REGION}

echo -e "${YELLOW}  ⚠ ACTION REQUIRED: Check inbox for ${ADMIN_EMAIL}${NC}"

# Wait for user confirmation
read -p "Press ENTER after clicking both verification links..."

# Check verification status
SES_STATUS=$(aws ses get-identity-verification-attributes \
  --identities ${SES_SENDER} \
  --region ${AWS_REGION} \
  --query "VerificationAttributes.\"${SES_SENDER}\".VerificationStatus" \
  --output text)

if [ "$SES_STATUS" != "Success" ]; then
  echo -e "${RED}✗ Email not verified yet. Please click the link and run this script again.${NC}"
  exit 1
fi

# Create configuration set
CONFIG_SET_NAME="video-visit-notifications-${ENVIRONMENT}"
echo "  → Creating SES configuration set: ${CONFIG_SET_NAME}..."

aws ses create-configuration-set \
  --configuration-set "{
    \"Name\": \"${CONFIG_SET_NAME}\",
    \"DeliveryOptions\": {
      \"TlsPolicy\": \"Require\"
    },
    \"ReputationOptions\": {
      \"ReputationMetricsEnabled\": true
    }
  }" \
  --region ${AWS_REGION} || echo "  (already exists)"

# Create CloudWatch event destination
aws ses put-configuration-set-event-destination \
  --configuration-set-name ${CONFIG_SET_NAME} \
  --event-destination "{
    \"Name\": \"cloudwatch-logs\",
    \"Enabled\": true,
    \"MatchingEventTypes\": [\"send\", \"delivery\", \"bounce\", \"complaint\", \"open\", \"click\"],
    \"CloudWatchDestination\": {
      \"DimensionConfigurations\": [{
        \"DimensionName\": \"ses:configuration-set\",
        \"DimensionValueSource\": \"messageTag\",
        \"DefaultDimensionValue\": \"${CONFIG_SET_NAME}\"
      }]
    }
  }" \
  --region ${AWS_REGION} || echo "  (already exists)"

echo -e "${GREEN}✓ SES configured successfully${NC}\n"

# ============================================
# PHASE 4: SMS CONFIGURATION (Pinpoint)
# ============================================

echo -e "${GREEN}[4/10] Configuring SMS (Amazon Pinpoint)...${NC}"

# Create Pinpoint project
PINPOINT_APP_ID=$(aws pinpoint create-app \
  --create-application-request "{
    \"Name\": \"${PROJECT_NAME}-sms-${ENVIRONMENT}\",
    \"tags\": {
      \"Environment\": \"${ENVIRONMENT}\",
      \"Purpose\": \"VideoVisitNotifications\"
    }
  }" \
  --region ${AWS_REGION} \
  --query 'ApplicationResponse.Id' \
  --output text 2>/dev/null || aws pinpoint get-apps --region ${AWS_REGION} --query "ApplicationsResponse.Item[?Name=='${PROJECT_NAME}-sms-${ENVIRONMENT}'].Id | [0]" --output text)

echo "  ✓ Pinpoint App ID: ${PINPOINT_APP_ID}"

# Enable SMS channel
aws pinpoint update-sms-channel \
  --application-id ${PINPOINT_APP_ID} \
  --sms-channel-request "{
    \"Enabled\": true
  }" \
  --region ${AWS_REGION} || echo "  (already enabled)"

echo -e "${YELLOW}  ⚠ MANUAL STEP REQUIRED: Purchase SMS Phone Number${NC}"
echo -e "${YELLOW}  1. Go to: https://console.aws.amazon.com/pinpoint/home?region=${AWS_REGION}#/sms-account-settings/phone-numbers${NC}"
echo -e "${YELLOW}  2. Click 'Request phone number'${NC}"
echo -e "${YELLOW}  3. Select: Toll-free or 10DLC${NC}"
echo -e "${YELLOW}  4. Use case: Transactional${NC}"
echo -e "${YELLOW}  5. Copy the purchased number (format: +1XXXXXXXXXX)${NC}\n"

read -p "Enter purchased SMS number (e.g., +15551234567): " SMS_NUMBER

if [ -z "$SMS_NUMBER" ]; then
  echo -e "${RED}✗ SMS number required. Exiting.${NC}"
  exit 1
fi

echo "  ✓ SMS Number: ${SMS_NUMBER}"

echo -e "${GREEN}✓ SMS configured${NC}\n"

# ============================================
# PHASE 5: IAM ROLES & POLICIES
# ============================================

echo -e "${GREEN}[5/10] Creating IAM Roles...${NC}"

# Video API Lambda role
ROLE_NAME="telehealth-video-api-lambda-${ENVIRONMENT}"
echo "  → Creating role: ${ROLE_NAME}..."

aws iam create-role \
  --role-name ${ROLE_NAME} \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": ["lambda.amazonaws.com", "connect.amazonaws.com"]
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }' \
  --tags Key=Name,Value="${ROLE_NAME}" Key=Environment,Value="${ENVIRONMENT}" \
  --region ${AWS_REGION} 2>/dev/null || echo "  (role already exists)"

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" \
  --region ${AWS_REGION} || true

# Create custom policy for Connect WebRTC
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name "ConnectWebRTCPolicy" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "ConnectWebRTCOperations",
        "Effect": "Allow",
        "Action": [
          "connect:StartWebRTCContact",
          "connect:StopContact",
          "connect:DescribeContact",
          "connect:GetContactAttributes",
          "connect:UpdateContactAttributes"
        ],
        "Resource": [
          "arn:aws:connect:'${AWS_REGION}':'${ACCOUNT_ID}':instance/*",
          "arn:aws:connect:'${AWS_REGION}':'${ACCOUNT_ID}':instance/*/contact/*"
        ]
      }
    ]
  }' \
  --region ${AWS_REGION}

# KMS policy
aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name "KMSJWTSigningPolicy" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "JWTSigningOperations",
        "Effect": "Allow",
        "Action": ["kms:Sign", "kms:GetPublicKey"],
        "Resource": "arn:aws:kms:'${AWS_REGION}':'${ACCOUNT_ID}':key/'${JWT_KEY_ID}'"
      },
      {
        "Sid": "RecordingEncryption",
        "Effect": "Allow",
        "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
        "Resource": "arn:aws:kms:'${AWS_REGION}':'${ACCOUNT_ID}':key/'${RECORDINGS_KEY_ID}'"
      }
    ]
  }' \
  --region ${AWS_REGION}

# S3 policy
aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name "S3RecordingsPolicy" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "RecordingsAccess",
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
        "Resource": [
          "arn:aws:s3:::'${RECORDINGS_BUCKET}'",
          "arn:aws:s3:::'${RECORDINGS_BUCKET}'/*"
        ]
      }
    ]
  }' \
  --region ${AWS_REGION}

# SES policy
aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name "SESEmailPolicy" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "SendEmail",
        "Effect": "Allow",
        "Action": ["ses:SendEmail", "ses:SendRawEmail"],
        "Resource": "*"
      }
    ]
  }' \
  --region ${AWS_REGION}

# SNS policy (for SMS)
aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name "SNSSMSPolicy" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "SendSMS",
        "Effect": "Allow",
        "Action": ["sns:Publish"],
        "Resource": "*"
      }
    ]
  }' \
  --region ${AWS_REGION}

echo -e "${GREEN}✓ IAM roles configured${NC}\n"

# ============================================
# PHASE 6: AMAZON CONNECT INSTANCE
# ============================================

echo -e "${GREEN}[6/10] Checking Amazon Connect Instance...${NC}"

# List existing instances
EXISTING_INSTANCE=$(aws connect list-instances \
  --region ${AWS_REGION} \
  --query "InstanceSummaryList[?InstanceAlias=='teleplatform-${ENVIRONMENT}'].Id | [0]" \
  --output text)

if [ "$EXISTING_INSTANCE" != "None" ] && [ ! -z "$EXISTING_INSTANCE" ]; then
  CONNECT_INSTANCE_ID=$EXISTING_INSTANCE
  echo "  ✓ Using existing instance: ${CONNECT_INSTANCE_ID}"
else
  echo -e "${YELLOW}  ⚠ MANUAL STEP REQUIRED: Create Amazon Connect Instance${NC}"
  echo -e "${YELLOW}  1. Go to: https://console.aws.amazon.com/connect/v2/home?region=${AWS_REGION}${NC}"
  echo -e "${YELLOW}  2. Click 'Create instance'${NC}"
  echo -e "${YELLOW}  3. Instance alias: teleplatform-${ENVIRONMENT}${NC}"
  echo -e "${YELLOW}  4. Identity management: Store users in Amazon Connect${NC}"
  echo -e "${YELLOW}  5. Enable: Inbound calls, Outbound calls${NC}"
  echo -e "${YELLOW}  6. IMPORTANT: Enable WebRTC for video${NC}"
  echo -e "${YELLOW}     → After creation: Instance settings → Telephony → Enable WebRTC${NC}\n"
  
  read -p "Enter Connect Instance ID (from Console): " CONNECT_INSTANCE_ID
  
  if [ -z "$CONNECT_INSTANCE_ID" ]; then
    echo -e "${RED}✗ Connect instance ID required. Exiting.${NC}"
    exit 1
  fi
fi

# Get instance ARN
CONNECT_INSTANCE_ARN=$(aws connect describe-instance \
  --instance-id ${CONNECT_INSTANCE_ID} \
  --region ${AWS_REGION} \
  --query 'Instance.Arn' \
  --output text)

echo "  ✓ Instance ARN: ${CONNECT_INSTANCE_ARN}"

# ============================================
# PHASE 7: CONNECT VIDEO QUEUE
# ============================================

echo -e "${GREEN}[7/10] Creating Connect Video Queue...${NC}"

# Get hours of operation ID (use default 24/7)
HOURS_ID=$(aws connect list-hours-of-operations \
  --instance-id ${CONNECT_INSTANCE_ID} \
  --region ${AWS_REGION} \
  --query "HoursOfOperationSummaryList[?Name=='Basic Hours'].Id | [0]" \
  --output text)

if [ "$HOURS_ID" == "None" ] || [ -z "$HOURS_ID" ]; then
  echo -e "${YELLOW}  Creating 24/7 hours of operation...${NC}"
  HOURS_ID=$(aws connect create-hours-of-operation \
    --instance-id ${CONNECT_INSTANCE_ID} \
    --name "24x7" \
    --time-zone "America/New_York" \
    --config '[
      {"Day":"MONDAY","StartTime":{"Hours":0,"Minutes":0},"EndTime":{"Hours":23,"Minutes":59}},
      {"Day":"TUESDAY","StartTime":{"Hours":0,"Minutes":0},"EndTime":{"Hours":23,"Minutes":59}},
      {"Day":"WEDNESDAY","StartTime":{"Hours":0,"Minutes":0},"EndTime":{"Hours":23,"Minutes":59}},
      {"Day":"THURSDAY","StartTime":{"Hours":0,"Minutes":0},"EndTime":{"Hours":23,"Minutes":59}},
      {"Day":"FRIDAY","StartTime":{"Hours":0,"Minutes":0},"EndTime":{"Hours":23,"Minutes":59}},
      {"Day":"SATURDAY","StartTime":{"Hours":0,"Minutes":0},"EndTime":{"Hours":23,"Minutes":59}},
      {"Day":"SUNDAY","StartTime":{"Hours":0,"Minutes":0},"EndTime":{"Hours":23,"Minutes":59}}
    ]' \
    --region ${AWS_REGION} \
    --query 'HoursOfOperationId' \
    --output text)
fi

echo "  ✓ Hours of Operation ID: ${HOURS_ID}"

# Create video queue
VIDEO_QUEUE_NAME="VideoVisitQueue"
echo "  → Creating queue: ${VIDEO_QUEUE_NAME}..."

VIDEO_QUEUE_ID=$(aws connect create-queue \
  --instance-id ${CONNECT_INSTANCE_ID} \
  --name ${VIDEO_QUEUE_NAME} \
  --description "Queue for video visit contacts" \
  --hours-of-operation-id ${HOURS_ID} \
  --max-contacts 50 \
  --tags Environment=${ENVIRONMENT},Type=VideoVisit \
  --region ${AWS_REGION} \
  --query 'QueueId' \
  --output text 2>/dev/null || aws connect list-queues \
  --instance-id ${CONNECT_INSTANCE_ID} \
  --region ${AWS_REGION} \
  --query "QueueSummaryList[?Name=='${VIDEO_QUEUE_NAME}'].Id | [0]" \
  --output text)

echo "  ✓ Queue ID: ${VIDEO_QUEUE_ID}"

VIDEO_QUEUE_ARN=$(aws connect describe-queue \
  --instance-id ${CONNECT_INSTANCE_ID} \
  --queue-id ${VIDEO_QUEUE_ID} \
  --region ${AWS_REGION} \
  --query 'Queue.QueueArn' \
  --output text)

echo "  ✓ Queue ARN: ${VIDEO_QUEUE_ARN}"

echo -e "${GREEN}✓ Video queue created${NC}\n"

# ============================================
# PHASE 8: CONNECT ROUTING PROFILE
# ============================================

echo -e "${GREEN}[8/10] Creating Routing Profile...${NC}"

echo -e "${YELLOW}  ⚠ MANUAL STEP: Create routing profile with video concurrency${NC}"
echo -e "${YELLOW}  Video concurrency cannot be set via CLI yet.${NC}"
echo -e "${YELLOW}  1. Go to: Connect Console → Routing → Routing profiles${NC}"
echo -e "${YELLOW}  2. Create new profile: 'VideoClinicianProfile'${NC}"
echo -e "${YELLOW}  3. Add queue: ${VIDEO_QUEUE_NAME}${NC}"
echo -e "${YELLOW}  4. Set concurrency: Voice=1, Video=1 (NEW option)${NC}"
echo -e "${YELLOW}  5. Copy the routing profile ID${NC}\n"

read -p "Enter Routing Profile ID: " ROUTING_PROFILE_ID

if [ -z "$ROUTING_PROFILE_ID" ]; then
  echo -e "${RED}✗ Routing profile ID required. Exiting.${NC}"
  exit 1
fi

echo "  ✓ Routing Profile ID: ${ROUTING_PROFILE_ID}"

# ============================================
# PHASE 9: CONTACT FLOW (Placeholder)
# ============================================

echo -e "${GREEN}[9/10] Contact Flow Configuration...${NC}"

echo -e "${YELLOW}  ⚠ MANUAL STEP: Import video contact flow${NC}"
echo -e "${YELLOW}  1. Go to: Connect Console → Routing → Contact flows${NC}"
echo -e "${YELLOW}  2. Create new flow: 'VideoVisitFlow'${NC}"
echo -e "${YELLOW}  3. Add blocks:${NC}"
echo -e "${YELLOW}     - Set contact attributes (visitId from Lambda)${NC}"
echo -e "${YELLOW}     - Transfer to queue: ${VIDEO_QUEUE_NAME}${NC}"
echo -e "${YELLOW}  4. Publish flow${NC}"
echo -e "${YELLOW}  5. Copy the Contact Flow ID${NC}\n"

read -p "Enter Contact Flow ID: " VIDEO_FLOW_ID

if [ -z "$VIDEO_FLOW_ID" ]; then
  echo -e "${RED}✗ Contact flow ID required. Exiting.${NC}"
  exit 1
fi

echo "  ✓ Contact Flow ID: ${VIDEO_FLOW_ID}"

# ============================================
# PHASE 10: SSM PARAMETERS (Configuration)
# ============================================

echo -e "${GREEN}[10/10] Storing Configuration in SSM Parameter Store...${NC}"

# Store all configuration
aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/connect/instance-id" \
  --value "${CONNECT_INSTANCE_ID}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/connect/instance-arn" \
  --value "${CONNECT_INSTANCE_ARN}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/connect/video-queue-id" \
  --value "${VIDEO_QUEUE_ID}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/connect/video-queue-arn" \
  --value "${VIDEO_QUEUE_ARN}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/connect/video-flow-id" \
  --value "${VIDEO_FLOW_ID}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/connect/routing-profile-id" \
  --value "${ROUTING_PROFILE_ID}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/security/jwt-kms-key-id" \
  --value "${JWT_KEY_ID}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/security/recordings-kms-key-id" \
  --value "${RECORDINGS_KEY_ID}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/storage/recordings-bucket" \
  --value "${RECORDINGS_BUCKET}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/messaging/ses-sender" \
  --value "${SES_SENDER}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/messaging/ses-config-set" \
  --value "${CONFIG_SET_NAME}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

aws ssm put-parameter \
  --name "/telehealth/${ENVIRONMENT}/messaging/sms-number" \
  --value "${SMS_NUMBER}" \
  --type "String" \
  --overwrite \
  --region ${AWS_REGION}

echo -e "${GREEN}✓ Configuration stored in SSM${NC}\n"

# ============================================
# SUMMARY
# ============================================

echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}✅ Infrastructure Deployment Complete!${NC}"
echo -e "${BLUE}=================================================${NC}\n"

echo -e "${GREEN}Created Resources:${NC}"
echo "  • KMS Keys:"
echo "    - JWT Signing: ${JWT_KEY_ID}"
echo "    - Recordings: ${RECORDINGS_KEY_ID}"
echo "  • S3 Bucket: ${RECORDINGS_BUCKET}"
echo "  • SES Sender: ${SES_SENDER} (verified)"
echo "  • SMS Number: ${SMS_NUMBER}"
echo "  • Connect Instance: ${CONNECT_INSTANCE_ID}"
echo "  • Video Queue: ${VIDEO_QUEUE_ID}"
echo "  • Routing Profile: ${ROUTING_PROFILE_ID}"
echo "  • Contact Flow: ${VIDEO_FLOW_ID}"
echo "  • IAM Role: ${ROLE_NAME}"

echo -e "\n${BLUE}Environment Variables (add to .env):${NC}"
echo "CONNECT_INSTANCE_ID=${CONNECT_INSTANCE_ID}"
echo "CONNECT_VIDEO_FLOW_ID=${VIDEO_FLOW_ID}"
echo "VIDEO_JWT_KMS_KEY_ID=${JWT_KEY_ID}"
echo "VIDEO_RECORDINGS_KMS_KEY_ID=${RECORDINGS_KEY_ID}"
echo "VIDEO_RECORDINGS_BUCKET=${RECORDINGS_BUCKET}"
echo "SES_SENDER=${SES_SENDER}"
echo "SES_CONFIGURATION_SET=${CONFIG_SET_NAME}"
echo "CONNECT_SMS_NUMBER=${SMS_NUMBER}"
echo "VIDEO_JOIN_URL=https://visit.${DOMAIN}"

echo -e "\n${BLUE}Next Steps:${NC}"
echo "1. Run database migration:"
echo "   cd packages/db && psql \$DATABASE_URL < migrations/20250929_video_visits_system.sql"
echo ""
echo "2. Generate Prisma client:"
echo "   pnpm prisma generate"
echo ""
echo "3. Install dependencies:"
echo "   cd apps/api && pnpm install"
echo "   cd apps/web && pnpm install"
echo ""
echo "4. Set environment variables in deployment (Amplify/ECS/Lambda)"
echo ""
echo "5. Deploy application"
echo ""
echo "6. Test end-to-end:"
echo "   bash scripts/test-video-visits.sh"

echo -e "\n${GREEN}🚀 Ready to deploy video visits!${NC}\n"

