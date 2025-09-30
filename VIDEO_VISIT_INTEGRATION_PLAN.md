# 🎥 **VIDEO VISIT SYSTEM - INTEGRATION PLAN**

## **📋 CURRENT STATUS**

**Date**: September 29, 2025  
**Request**: Frontend team has built a complete video visit system  
**Repository Status**: ⚠️ **Video visit files NOT YET PUSHED to `main` branch**

### **✅ Verification Complete**
- ✅ Checked repository for video-related files: **NONE FOUND**
- ✅ Reviewed recent commits: Only signup API infrastructure changes
- ✅ Checked `scripts/`, `docs/`, `apps/api/src/`: No video files present

**CONCLUSION**: Frontend team needs to push their code before we can deploy infrastructure.

---

## **🎯 WHAT FRONTEND TEAM BUILT (According to Their Message)**

### **Backend (8 files):**
- Database schema with 3 new models (VideoVisit, OneTimeToken, VideoAuditLog)
- KMS-signed JWT token service (ES256)
- Amazon Connect WebRTC integration
- SES/SMS notification service
- REST API with 9 endpoints
- Audit logging (7-year retention)

### **Frontend (6 files):**
- Amazon Chime SDK client wrapper
- Join page for one-time links (`/j/[shortCode]`)
- Device preview component (camera/mic test)
- Patient portal integration
- Clinician video desk (CCP embedded)
- CSP headers configured for WebRTC

### **Infrastructure:**
- Terraform configuration
- CLI deployment script

### **Documentation:**
- Complete technical spec (2,000 lines)
- Operations runbook
- Lander integration guide
- CLI deployment guide

---

## **🚨 IMMEDIATE ACTION REQUIRED FROM FRONTEND TEAM**

### **Subject: Video Visit System - Files Not Found in Repository**

**Hi Frontend Team,**

We've reviewed your message about the video visit system and are ready to deploy the infrastructure. However, we cannot find any video-related files in the repository.

**Files Missing:**
```
❌ scripts/deploy-video-infrastructure.sh
❌ scripts/test-video-visits.sh
❌ docs/VIDEO_DEPLOYMENT_CLI.md
❌ docs/VIDEO_VISIT_SYSTEM.md
❌ docs/VIDEO_VISIT_RUNBOOK.md
❌ docs/LANDER_VIDEO_INTEGRATION.md
❌ apps/api/src/video-visits/ (directory)
❌ apps/web/app/video/ (directory)
❌ packages/db/migrations/*video*.sql
```

**Please push all video visit files to the `main` branch so we can proceed with infrastructure deployment.**

**Once pushed, we'll:**
1. Review the infrastructure requirements
2. Integrate with our existing AWS resources (SES, KMS, S3, IAM)
3. Deploy video-specific infrastructure via Terraform
4. Run database migrations
5. Test the integration

**Timeline after you push:** ~2 hours for complete infrastructure deployment

---

## **🔧 OUR INFRASTRUCTURE INTEGRATION PLAN**

### **Phase 1: File Verification (When They Push)**

```bash
# Pull latest changes
git pull origin main

# Verify video files exist
find . -name "*video*" -type f
ls -la scripts/deploy-video-infrastructure.sh
ls -la docs/VIDEO_*.md
ls -la apps/api/src/video-visits/
ls -la apps/web/app/video/
ls -la packages/db/migrations/*video*.sql
```

### **Phase 2: Infrastructure Assessment**

**What We Already Have (Can Reuse):**
| Resource | Status | Integration |
|----------|--------|-------------|
| SES Email | ✅ `noreply@eudaura.com` | Use existing |
| KMS Keys | ✅ 5 keys (RDS, Redis, S3, DynamoDB, SNS) | Add video recording key |
| S3 Buckets | ✅ 5 buckets | Add video recordings bucket |
| PostgreSQL | ✅ RDS deployed | Run video visit migration |
| IAM Roles | ✅ ECS task role exists | Add Connect/Chime permissions |
| VPC | ✅ Production VPC | Reuse for Connect |

**What We Need to Create:**
1. ✅ New KMS key for video recording encryption
2. ✅ New S3 bucket with WORM Object Lock (7-year retention)
3. ✅ IAM policy for Amazon Connect + Chime SDK
4. ⚠️ Amazon Connect instance (or locate existing)
5. ✅ Database tables (via migration)

### **Phase 3: Terraform Configuration**

**File**: `infrastructure/terraform/video-visits.tf`

```hcl
# =============================================================================
# VIDEO VISIT SYSTEM INFRASTRUCTURE
# =============================================================================

# KMS Key for Video Recording Encryption
resource "aws_kms_key" "video_recordings" {
  description             = "KMS key for video recording encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-video-recordings-kms-${local.environment}"
  })
}

resource "aws_kms_alias" "video_recordings" {
  name          = "alias/${local.name_prefix}-video-recordings-${local.environment}"
  target_key_id = aws_kms_key.video_recordings.key_id
}

# S3 Bucket for Video Recordings (WORM Compliance - 7 Years)
resource "aws_s3_bucket" "video_recordings" {
  bucket        = "${local.name_prefix}-video-recordings-${local.environment}-${random_id.suffix.hex}"
  object_lock_enabled = true

  tags = merge(local.common_tags, {
    Name               = "${local.name_prefix}-video-recordings-${local.environment}"
    Compliance         = "HIPAA"
    DataClassification = "PHI"
    Retention          = "7-years"
  })
}

resource "aws_s3_bucket_versioning" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.video_recordings.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 2557  # 7 years for HIPAA compliance
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  rule {
    id     = "retention_rule"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 2557  # 7 years retention
    }
  }
}

resource "aws_s3_bucket_public_access_block" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "video_recordings" {
  bucket = aws_s3_bucket.video_recordings.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.video_recordings.arn,
          "${aws_s3_bucket.video_recordings.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "HIPAACompliance"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:DeleteObject"
        Resource = "${aws_s3_bucket.video_recordings.arn}/*"
      }
    ]
  })
}

# IAM Policy for Video Visit Functionality
data "aws_iam_policy_document" "video_visits" {
  # Amazon Connect permissions
  statement {
    effect = "Allow"
    actions = [
      "connect:StartWebRTCContact",
      "connect:GetCurrentMetricData",
      "connect:DescribeQueue",
      "connect:DescribeInstance",
      "connect:ListQueues"
    ]
    resources = ["*"]  # Scoped in production
  }

  # Amazon Chime SDK permissions
  statement {
    effect = "Allow"
    actions = [
      "chime:CreateMeeting",
      "chime:DeleteMeeting",
      "chime:GetMeeting",
      "chime:ListMeetings",
      "chime:CreateAttendee",
      "chime:DeleteAttendee",
      "chime:GetAttendee",
      "chime:ListAttendees"
    ]
    resources = ["*"]
  }

  # S3 permissions for video recordings
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket"
    ]
    resources = [
      aws_s3_bucket.video_recordings.arn,
      "${aws_s3_bucket.video_recordings.arn}/*"
    ]
  }

  # KMS permissions for video encryption
  statement {
    effect = "Allow"
    actions = [
      "kms:Decrypt",
      "kms:Encrypt",
      "kms:GenerateDataKey",
      "kms:DescribeKey"
    ]
    resources = [aws_kms_key.video_recordings.arn]
  }

  # SNS permissions for video notifications
  statement {
    effect = "Allow"
    actions = [
      "sns:Publish"
    ]
    resources = [aws_sns_topic.ses_notifications.arn]
  }
}

resource "aws_iam_policy" "video_visits" {
  name        = "${local.name_prefix}-video-visits-policy-${local.environment}"
  description = "Policy for video visit functionality (Connect, Chime, S3, KMS)"
  policy      = data.aws_iam_policy_document.video_visits.json

  tags = local.common_tags
}

# Attach policy to ECS task role
resource "aws_iam_role_policy_attachment" "ecs_task_video_visits" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.video_visits.arn
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "video_recordings_bucket_name" {
  description = "Video Recordings S3 Bucket Name"
  value       = aws_s3_bucket.video_recordings.bucket
}

output "video_recordings_bucket_arn" {
  description = "Video Recordings S3 Bucket ARN"
  value       = aws_s3_bucket.video_recordings.arn
}

output "video_recordings_kms_key_id" {
  description = "Video Recordings KMS Key ID"
  value       = aws_kms_key.video_recordings.key_id
}

output "video_recordings_kms_key_arn" {
  description = "Video Recordings KMS Key ARN"
  value       = aws_kms_key.video_recordings.arn
}
```

### **Phase 4: Update ECS Task Environment Variables**

Add to `infrastructure/terraform/app-runner.tf`:

```hcl
{
  name  = "VIDEO_RECORDINGS_BUCKET"
  value = aws_s3_bucket.video_recordings.bucket
},
{
  name  = "VIDEO_KMS_KEY_ID"
  value = aws_kms_key.video_recordings.key_id
},
{
  name  = "CHIME_SDK_ENABLED"
  value = "true"
},
{
  name  = "CONNECT_INSTANCE_ID"
  value = var.connect_instance_id != "" ? var.connect_instance_id : ""
}
```

Add to `infrastructure/terraform/variables.tf`:

```hcl
variable "connect_instance_id" {
  description = "Amazon Connect Instance ID for video visits"
  type        = string
  default     = ""
}

variable "connect_video_queue_id" {
  description = "Amazon Connect Video Queue ID"
  type        = string
  default     = ""
}
```

### **Phase 5: Database Migration**

**Steps:**
```bash
# 1. Get RDS connection details
cd infrastructure/terraform
terraform output -json > outputs.json

# 2. Extract database endpoint
export DB_HOST=$(cat outputs.json | jq -r '.rds_endpoint.value')
export DB_NAME="telehealth"
export DB_USER="telehealth_admin"
export DB_PASSWORD="<from secrets manager>"

# 3. Run migration (once frontend team provides file)
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
psql $DATABASE_URL < packages/db/migrations/20250929_video_visits_system.sql

# 4. Verify tables created
psql $DATABASE_URL -c "\dt video*"

# 5. Regenerate Prisma client
cd packages/db
pnpm prisma generate
```

### **Phase 6: Amplify Environment Variables**

Add to Amplify Console:

```bash
aws amplify update-branch \
  --app-id d1o2jv5ahrim0e \
  --branch-name main \
  --environment-variables \
    VIDEO_RECORDINGS_BUCKET=<from terraform output>,\
    VIDEO_KMS_KEY_ID=<from terraform output>,\
    CHIME_SDK_ENABLED=true,\
    NEXT_PUBLIC_VIDEO_ENABLED=true \
  --region us-east-1
```

---

## **📊 DEPLOYMENT TIMELINE**

| Phase | Task | Duration | Dependencies |
|-------|------|----------|--------------|
| **0** | Frontend pushes code | ? | Frontend team |
| **1** | File verification | 10 min | Phase 0 complete |
| **2** | Review infrastructure needs | 15 min | Phase 1 complete |
| **3** | Create Terraform config | 30 min | Phase 2 complete |
| **4** | Deploy infrastructure | 20 min | Phase 3 complete |
| **5** | Run database migration | 15 min | Phase 4 complete |
| **6** | Update env variables | 10 min | Phase 4 complete |
| **7** | Test integration | 30 min | Phases 5-6 complete |
| **TOTAL** | **2 hours 10 minutes** | | |

---

## **🧪 TESTING PLAN**

### **Test 1: Infrastructure Verification**
```bash
# Verify S3 bucket created
aws s3 ls | grep video-recordings

# Verify KMS key created
aws kms list-aliases | grep video-recordings

# Verify IAM policy attached
aws iam list-attached-role-policies \
  --role-name telehealth-ecs-task-role-prod \
  | grep video-visits
```

### **Test 2: Database Migration**
```bash
# Check tables exist
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'video%';"

# Expected output:
# video_visits
# one_time_tokens
# video_audit_logs
```

### **Test 3: API Endpoints (Once Deployed)**
```bash
# Test video visit creation
curl -X POST http://api.eudaura.com/api/visits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{
    "patientId": "test_patient",
    "providerId": "test_provider",
    "scheduledAt": "2025-09-30T10:00:00Z"
  }'

# Test one-time link generation
curl -X POST http://api.eudaura.com/api/visits/123/links \
  -H "Authorization: Bearer <JWT>"

# Test notification sending
curl -X POST http://api.eudaura.com/api/visits/123/notify \
  -H "Authorization: Bearer <JWT>"
```

---

## **🚨 RISK ASSESSMENT**

### **High Risk:**
- **Amazon Connect Setup**: Requires manual configuration (queue, routing profile, contact flow)
- **Cost Impact**: Chime SDK charges per attendee-minute (~$0.0015/min)
- **Database Migration**: Could fail if schema conflicts with existing tables

### **Medium Risk:**
- **IAM Permissions**: Too broad initially (needs scoping to specific Connect instance)
- **S3 Object Lock**: Cannot be removed once set (test carefully)

### **Low Risk:**
- **KMS Key Creation**: Standard operation
- **S3 Bucket Creation**: Standard operation
- **Environment Variables**: Easy to update

---

## **💰 COST ESTIMATE**

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| **Amazon Chime SDK** | 1,000 min/month | $1.50 |
| **Amazon Connect** | Basic usage | $0 (free tier) |
| **S3 Video Storage** | 100 GB | $2.30 |
| **KMS Key** | 1 key | $1.00 |
| **Data Transfer** | 50 GB out | $4.50 |
| **TOTAL** | | **~$10/month** |

**Note**: Scales with usage. At 10,000 video minutes/month: ~$25/month

---

## **✅ READY STATE CHECKLIST**

### **Before Deployment:**
- [ ] Frontend team pushes all video visit files to `main`
- [ ] We review their infrastructure requirements
- [ ] We confirm Amazon Connect instance (exists or create new)
- [ ] We verify no schema conflicts in database migration
- [ ] We confirm cost estimates with stakeholders

### **During Deployment:**
- [ ] Create `video-visits.tf` Terraform file
- [ ] Run `terraform plan` and review changes
- [ ] Run `terraform apply` to create resources
- [ ] Run database migration
- [ ] Update environment variables (ECS + Amplify)
- [ ] Verify IAM permissions applied

### **After Deployment:**
- [ ] Test S3 bucket accessibility
- [ ] Test KMS encryption/decryption
- [ ] Test API endpoints
- [ ] Test video visit creation flow
- [ ] Test one-time link generation
- [ ] Test SES/SMS notifications
- [ ] Monitor CloudWatch logs for errors

---

## **🎯 NEXT STEPS**

### **1. Respond to Frontend Team** (Copy/Paste This):

---

**Subject: Video Visit System - Awaiting Code Push**

Hi Frontend Team,

We've reviewed your video visit system implementation plan and are ready to deploy the infrastructure. However, we need you to **push all video visit files to the `main` branch first**.

**Files We're Looking For:**
```
✅ scripts/deploy-video-infrastructure.sh
✅ scripts/test-video-visits.sh
✅ docs/VIDEO_DEPLOYMENT_CLI.md
✅ docs/VIDEO_VISIT_SYSTEM.md
✅ docs/VIDEO_VISIT_RUNBOOK.md
✅ docs/LANDER_VIDEO_INTEGRATION.md
✅ apps/api/src/video-visits/ (directory)
✅ apps/web/app/video/ (directory)
✅ packages/db/migrations/*video*.sql
```

**Once You Push, We Will:**

1. ✅ Review your infrastructure requirements
2. ✅ Create Terraform configuration (integrating with our existing AWS resources)
3. ✅ Deploy video-specific infrastructure:
   - New S3 bucket for video recordings (WORM Object Lock)
   - New KMS key for video encryption
   - IAM policies for Connect + Chime SDK
   - Database migration
4. ✅ Update environment variables (ECS + Amplify)
5. ✅ Test the integration end-to-end

**Timeline After Push:** ~2 hours

**Questions Before You Push:**

1. **Amazon Connect**: Do we already have a Connect instance, or do we need to create one?
2. **Database Migration**: Will your migration conflict with existing tables?
3. **Cost**: Are stakeholders aware of Chime SDK costs (~$10-25/month for moderate usage)?

**We're ready to go as soon as you push the code!** 🚀

**Backend/DevOps Team**

---

### **2. Prepare Terraform Configuration**

Once they push, we'll:
1. Create `infrastructure/terraform/video-visits.tf`
2. Add variables to `variables.tf`
3. Update `app-runner.tf` with environment variables
4. Run `terraform plan` and review
5. Run `terraform apply`

### **3. Coordinate Deployment**

Once infrastructure is ready:
1. Run database migration
2. Update environment variables
3. Redeploy ECS tasks
4. Trigger Amplify build
5. Test end-to-end

---

## **📞 SUPPORT & ESCALATION**

**If Frontend Team Has Questions:**
- Infrastructure questions: DevOps team
- Database questions: Backend team
- Cost questions: Finance/Leadership
- HIPAA compliance: Security/Compliance team

**All systems ready to support video visit deployment!** 🎥

---

**CURRENT STATUS: AWAITING FRONTEND TEAM CODE PUSH** ⏳
