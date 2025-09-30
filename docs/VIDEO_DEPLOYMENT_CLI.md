# 🚀 Video Visit Deployment - Complete CLI Guide

## Automated Infrastructure Provisioning via AWS CLI

**Prerequisites:**
- AWS CLI v2 installed and configured
- PostgreSQL client (`psql`) installed
- `jq` installed for JSON parsing
- Admin AWS credentials with permissions for: KMS, S3, IAM, Connect, SES, SNS, SSM

---

## Quick Start (5 Commands)

```bash
# 1. Deploy infrastructure
cd /Users/alexsiegel/teleplatform
bash scripts/deploy-video-infrastructure.sh

# 2. Run database migration
cd packages/db
psql $DATABASE_URL < migrations/20250929_video_visits_system.sql

# 3. Generate Prisma client
pnpm prisma generate

# 4. Install dependencies
cd ../../apps/api && pnpm install
cd ../web && pnpm install

# 5. Test
bash ../../scripts/test-video-visits.sh
```

---

## Detailed Step-by-Step

### Step 1: Prepare Environment

```bash
# Set AWS region
export AWS_REGION=us-east-1

# Set environment (dev/staging/prod)
export ENVIRONMENT=prod

# Set domain
export DOMAIN=eudaura.com
export ADMIN_EMAIL=admin@eudaura.com

# Verify AWS credentials
aws sts get-caller-identity
```

**Expected output:**
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/admin"
}
```

---

### Step 2: Run Infrastructure Script

```bash
cd /Users/alexsiegel/teleplatform
bash scripts/deploy-video-infrastructure.sh
```

**What it does automatically:**
- ✅ Creates KMS keys (JWT signing ES256 + recordings encryption)
- ✅ Creates S3 bucket with WORM Object Lock
- ✅ Configures SES email (sends verification emails)
- ✅ Sets up Pinpoint for SMS
- ✅ Creates IAM roles with least-privilege policies
- ✅ Creates Connect queue (if instance exists)
- ✅ Stores all config in SSM Parameter Store

**Manual steps (script will prompt):**
1. **SES Email Verification** - Check inbox for `noreply@eudaura.com` and `admin@eudaura.com`, click links
2. **SMS Number Purchase** - Go to Pinpoint Console, purchase number
3. **Connect Instance** - Provide existing instance ID or create new one
4. **Routing Profile** - Create via Console with video concurrency
5. **Contact Flow** - Import and configure via Console

**Duration:** 15-20 minutes (including manual steps)

**Output:** Script prints all environment variables to add to `.env`

---

### Step 3: Run Database Migration

```bash
cd packages/db

# Set your database URL
export DATABASE_URL="postgresql://user:pass@host:5432/telehealth"

# Run migration
psql $DATABASE_URL < migrations/20250929_video_visits_system.sql
```

**Verify migration:**
```bash
psql $DATABASE_URL -c "\dt video_*"
```

**Expected tables:**
```
 video_visits
 one_time_tokens  
 video_audit_logs
```

---

### Step 4: Generate Prisma Client

```bash
cd packages/db
pnpm prisma generate
```

**Expected output:**
```
✔ Generated Prisma Client (3.x.x) to ./node_modules/@prisma/client
```

---

### Step 5: Install Dependencies

```bash
# Backend (adds AWS SDK for Connect, SES, SNS)
cd apps/api
pnpm install

# Frontend (adds amazon-chime-sdk-js, amazon-connect-streams)
cd ../web
pnpm install
```

---

### Step 6: Configure Environment Variables

The deployment script outputs all required env vars. Add them to your `.env` files:

**Backend** (`apps/api/.env`):
```bash
# From script output
CONNECT_INSTANCE_ID=arn:aws:connect:us-east-1:123456789012:instance/12345678-1234-1234-1234-123456789012
CONNECT_VIDEO_FLOW_ID=arn:aws:connect:us-east-1:123456789012:instance/.../contact-flow/...
VIDEO_JWT_KMS_KEY_ID=12345678-1234-1234-1234-123456789012
VIDEO_RECORDINGS_KMS_KEY_ID=12345678-1234-1234-1234-123456789012
VIDEO_RECORDINGS_BUCKET=telehealth-video-recordings-prod-a1b2c3d4
SES_SENDER=noreply@eudaura.com
SES_CONFIGURATION_SET=video-visit-notifications-prod
CONNECT_SMS_NUMBER=+15551234567
VIDEO_JOIN_URL=https://visit.eudaura.com
NEXT_PUBLIC_APP_URL=https://app.eudaura.com
```

**Or load from SSM:**
```bash
# Automatically load all parameters from SSM
export CONNECT_INSTANCE_ID=$(aws ssm get-parameter --name "/telehealth/prod/connect/instance-id" --query 'Parameter.Value' --output text)
export CONNECT_VIDEO_FLOW_ID=$(aws ssm get-parameter --name "/telehealth/prod/connect/video-flow-id" --query 'Parameter.Value' --output text)
export VIDEO_JWT_KMS_KEY_ID=$(aws ssm get-parameter --name "/telehealth/prod/security/jwt-kms-key-id" --query 'Parameter.Value' --output text)
# ... etc
```

**Frontend** (`apps/web/.env.production`):
```bash
NEXT_PUBLIC_VIDEO_ENABLED=true
NEXT_PUBLIC_CONNECT_CCP_URL=https://your-instance.my.connect.aws/ccp-v2
```

---

### Step 7: Deploy Application

```bash
# Build backend
cd apps/api
pnpm build

# Build frontend
cd ../web
pnpm build

# Deploy (depends on your setup)
# - Amplify: git push origin main (auto-deploys)
# - ECS: docker build + push + update-service
# - Lambda: zip + update-function-code
```

---

### Step 8: Run Tests

```bash
# Set API base URL
export API_BASE_URL=https://api.eudaura.com
# Or for local: export API_BASE_URL=http://127.0.0.1:3001

# Set admin token (from Cognito or demo mode)
export ADMIN_TOKEN="Bearer eyJhbGc..."

# Run test suite
bash scripts/test-video-visits.sh
```

**Expected output:**
```
=================================================
Test Results
=================================================
Total Tests: 10
Passed: 10
Failed: 0

✅ All tests passed!
```

---

## Alternative: Terraform (Fully Automated)

If you prefer fully automated infrastructure (no manual steps):

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply (creates all resources)
terraform apply tfplan
```

**Note:** Amazon Connect WebRTC enablement and video concurrency settings may still require Console access (AWS API limitations).

---

## Verification Commands

### Check KMS Keys

```bash
# List KMS keys
aws kms list-aliases \
  --query "Aliases[?starts_with(AliasName, 'alias/video')]" \
  --region us-east-1

# Get public key (for JWT verification)
aws kms get-public-key \
  --key-id alias/video-jwt-signing-prod \
  --region us-east-1
```

---

### Check S3 Bucket

```bash
# List buckets
aws s3 ls | grep video-recordings

# Check encryption
aws s3api get-bucket-encryption \
  --bucket <BUCKET_NAME>

# Check Object Lock
aws s3api get-object-lock-configuration \
  --bucket <BUCKET_NAME>
```

---

### Check SES Status

```bash
# Verify email verification status
aws ses get-identity-verification-attributes \
  --identities noreply@eudaura.com admin@eudaura.com \
  --region us-east-1

# Expected: "VerificationStatus": "Success"

# Check sending enabled
aws ses get-account-sending-enabled \
  --region us-east-1

# Expected: { "Enabled": true }

# Check reputation
aws ses get-send-statistics \
  --region us-east-1
```

---

### Check Connect Configuration

```bash
# Describe instance
aws connect describe-instance \
  --instance-id <INSTANCE_ID> \
  --region us-east-1

# List queues
aws connect list-queues \
  --instance-id <INSTANCE_ID> \
  --region us-east-1

# Describe video queue
aws connect describe-queue \
  --instance-id <INSTANCE_ID> \
  --queue-id <QUEUE_ID> \
  --region us-east-1

# List contact flows
aws connect list-contact-flows \
  --instance-id <INSTANCE_ID> \
  --region us-east-1 \
  --query "ContactFlowSummaryList[?Name=='VideoVisitFlow']"
```

---

### Check SSM Parameters

```bash
# List all video visit parameters
aws ssm get-parameters-by-path \
  --path "/telehealth/prod" \
  --recursive \
  --region us-east-1

# Get specific parameter
aws ssm get-parameter \
  --name "/telehealth/prod/connect/instance-id" \
  --region us-east-1
```

---

## Cleanup (Teardown)

**⚠️ WARNING: This will delete all video visit infrastructure and data!**

```bash
# Delete S3 bucket (must empty first)
aws s3 rm s3://<RECORDINGS_BUCKET> --recursive
aws s3api delete-bucket --bucket <RECORDINGS_BUCKET>

# Schedule KMS key deletion (30-day waiting period)
aws kms schedule-key-deletion \
  --key-id <JWT_KEY_ID> \
  --pending-window-in-days 30 \
  --region us-east-1

aws kms schedule-key-deletion \
  --key-id <RECORDINGS_KEY_ID> \
  --pending-window-in-days 30 \
  --region us-east-1

# Delete IAM role
aws iam delete-role-policy \
  --role-name telehealth-video-api-lambda-prod \
  --policy-name ConnectWebRTCPolicy

aws iam detach-role-policy \
  --role-name telehealth-video-api-lambda-prod \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam delete-role \
  --role-name telehealth-video-api-lambda-prod

# Delete SES configuration
aws ses delete-configuration-set \
  --configuration-set-name video-visit-notifications-prod \
  --region us-east-1

# Delete SSM parameters
aws ssm delete-parameters \
  --names $(aws ssm get-parameters-by-path \
    --path "/telehealth/prod" \
    --query 'Parameters[].Name' \
    --output text) \
  --region us-east-1

# Delete database tables (IRREVERSIBLE!)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS video_audit_logs CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS one_time_tokens CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS video_visits CASCADE;"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS VideoVisitStatus CASCADE;"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS TokenStatus CASCADE;"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS VideoAuditEventType CASCADE;"
```

---

## Troubleshooting

### Error: "KMS key already exists"

```bash
# List existing aliases
aws kms list-aliases | grep video

# Use existing key instead of creating new one
export JWT_KEY_ID=$(aws kms describe-key \
  --key-id alias/video-jwt-signing-prod \
  --query 'KeyMetadata.KeyId' \
  --output text)
```

---

### Error: "S3 bucket name already taken"

```bash
# Bucket names are globally unique
# Script generates random suffix, but if conflict:
export BUCKET_SUFFIX=$(openssl rand -hex 8)  # Longer suffix
```

---

### Error: "SES identity not verified"

```bash
# Check verification status
aws ses get-identity-verification-attributes \
  --identities noreply@eudaura.com \
  --region us-east-1

# If "Pending", check spam folder for verification email
# Resend verification:
aws ses verify-email-identity \
  --email-address noreply@eudaura.com \
  --region us-east-1
```

---

### Error: "Connect instance not found"

```bash
# List all Connect instances
aws connect list-instances --region us-east-1

# If none exist, create via Console (WebRTC feature not in CLI yet):
# https://console.aws.amazon.com/connect/v2/home?region=us-east-1
```

---

## Cost Estimate

**One-Time Setup:**
- KMS keys: $2/month (2 keys × $1/month)
- S3 bucket creation: Free

**Ongoing (per 1,000 video visits/month):**
- Amazon Connect WebRTC: ~$540/month ($0.018/min × 30 min avg)
- S3 storage: ~$11.50/month (500 GB recordings)
- KMS API calls: ~$0.30/month
- SES emails: ~$0.10/month
- SMS: ~$6.45/month
- CloudWatch logs: ~$5/month

**Total: ~$565/month for 1,000 video visits**

---

## Post-Deployment Checklist

### Infrastructure
- [ ] KMS keys created and aliased
- [ ] S3 bucket with WORM Object Lock enabled
- [ ] SES sender email verified (check inbox!)
- [ ] SMS number purchased and noted
- [ ] IAM role created with policies attached
- [ ] Connect instance ID obtained
- [ ] Video queue created
- [ ] Routing profile created (with video concurrency)
- [ ] Contact flow imported
- [ ] SSM parameters populated

### Application
- [ ] Database migration applied
- [ ] Prisma client generated
- [ ] Dependencies installed (Chime SDK, Connect Streams)
- [ ] Environment variables set
- [ ] Application deployed

### Testing
- [ ] Health check passes
- [ ] Create visit API works
- [ ] Generate links API works
- [ ] Token validation works
- [ ] Token reuse blocked (security test)
- [ ] Audit logs populated
- [ ] Email delivered (check inbox)
- [ ] SMS delivered (check phone)

### Compliance
- [ ] HIPAA controls verified (see VIDEO_VISIT_COMPLETE.md)
- [ ] Audit logs immutable (test UPDATE query fails)
- [ ] Encryption at rest verified (KMS, S3)
- [ ] No PHI in logs verified (check CloudWatch)
- [ ] 7-year retention configured

---

## Integration with Existing Systems

### Load Configuration from SSM

Add this to your application startup:

```typescript
// apps/api/src/config/video-config.ts
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({ region: process.env.AWS_REGION });

export async function loadVideoConfig() {
  const params = [
    '/telehealth/prod/connect/instance-id',
    '/telehealth/prod/connect/video-flow-id',
    '/telehealth/prod/security/jwt-kms-key-id',
    '/telehealth/prod/messaging/sms-number',
    '/telehealth/prod/messaging/ses-sender'
  ];

  const values = await Promise.all(
    params.map(async (name) => {
      const response = await ssm.send(new GetParameterCommand({ Name: name }));
      return { name, value: response.Parameter?.Value };
    })
  );

  return Object.fromEntries(values.map(({ name, value }) => [
    name.split('/').pop()!,
    value
  ]));
}

// Usage in main.ts:
const config = await loadVideoConfig();
process.env.CONNECT_INSTANCE_ID = config['instance-id'];
// ... etc
```

---

## Rollback Procedure

If deployment fails or issues found:

```bash
# 1. Disable new video visit scheduling (feature flag)
aws ssm put-parameter \
  --name "/telehealth/prod/features/video-visits-enabled" \
  --value "false" \
  --overwrite

# 2. Complete in-progress visits (monitor queue)
aws connect get-current-metric-data \
  --instance-id <INSTANCE_ID> \
  --filters '{"Queues":["<QUEUE_ARN>"],"Channels":["VIDEO"]}' \
  --current-metrics '[{"Name":"CONTACTS_IN_QUEUE","Unit":"COUNT"}]'

# 3. Drain queue (wait for 0 contacts)

# 4. Revert database migration (if needed)
# WARNING: This deletes all visit data!
psql $DATABASE_URL < migrations/20250929_video_visits_system_rollback.sql

# 5. Remove code changes (git revert)
git revert <COMMIT_SHA>
git push origin main
```

---

## Monitoring Post-Deployment

### CloudWatch Dashboards

```bash
# Open dashboard
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=video-visits-prod"
```

### Real-Time Metrics

```bash
# Token failures (last 5 minutes)
aws cloudwatch get-metric-statistics \
  --namespace Telehealth/VideoVisits \
  --metric-name TokenFailureCount \
  --start-time $(date -u -v-5M +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1

# Queue depth
aws connect get-current-metric-data \
  --instance-id <INSTANCE_ID> \
  --filters '{"Queues":["<QUEUE_ARN>"]}' \
  --current-metrics '[{"Name":"CONTACTS_IN_QUEUE","Unit":"COUNT"}]' \
  --region us-east-1
```

### Audit Logs

```bash
# Query recent audit events
psql $DATABASE_URL -c "
SELECT 
  event_type,
  COUNT(*) as count,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed
FROM video_audit_logs
WHERE timestamp > now() - interval '1 hour'
GROUP BY event_type
ORDER BY count DESC;
"
```

---

## Quick Commands Reference

```bash
# Get all video config from SSM
aws ssm get-parameters-by-path \
  --path "/telehealth/prod" \
  --recursive \
  --region us-east-1 \
  --query 'Parameters[].{Name:Name,Value:Value}' \
  --output table

# Test SES sending
aws ses send-email \
  --from noreply@eudaura.com \
  --destination ToAddresses=admin@eudaura.com \
  --message Subject={Data="Test"},Body={Text={Data="Test video visit email"}} \
  --configuration-set-name video-visit-notifications-prod \
  --region us-east-1

# Test SMS sending
aws sns publish \
  --phone-number +15551234567 \
  --message "Test video visit SMS" \
  --region us-east-1

# Check KMS key status
aws kms describe-key \
  --key-id alias/video-jwt-signing-prod \
  --region us-east-1

# Force re-run infrastructure script (idempotent)
bash scripts/deploy-video-infrastructure.sh
```

---

## Success Criteria

✅ **Infrastructure ready when:**
- All SSM parameters populated
- SES sender verified (Status: "Success")
- SMS number active
- KMS keys created and aliased
- S3 bucket with Object Lock enabled
- IAM role with all policies attached
- Connect queue created
- Test script passes 10/10 tests

✅ **Application ready when:**
- Database migration applied successfully
- Prisma client generated
- All dependencies installed
- Environment variables configured
- Build completes without errors
- Deployment successful

✅ **Go-live ready when:**
- End-to-end test (real visit) successful
- Audit logs populating correctly
- CloudWatch alarms configured
- Runbook reviewed by ops team
- HIPAA compliance checklist complete

---

## 🎉 You're Done!

After running the deployment script and completing manual steps, you'll have:

- ✅ Production-ready video visit infrastructure
- ✅ HIPAA/SOC2 compliant security controls
- ✅ Automated monitoring and alerting
- ✅ Complete audit trail
- ✅ Encrypted PHI (at rest + in transit)

**Time to first video visit:** ~30 minutes after infrastructure deployment

**Questions?** Check `docs/VIDEO_VISIT_RUNBOOK.md` for troubleshooting or contact DevOps team.

