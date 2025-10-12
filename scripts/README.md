# Deployment Scripts

**Purpose**: Automation scripts for building, deploying, and managing the Eudaura platform

---

## 🚀 Main Deployment Scripts

### `deploy-ecs.sh`
**NEW** - Deploy both API and Web to ECS

```bash
# Deploy to staging
./scripts/deploy-ecs.sh staging

# Deploy to production
./scripts/deploy-ecs.sh production
```

**What it does**:
1. Builds API and Web Docker images
2. Pushes to ECR
3. Updates ECS services
4. Waits for stabilization
5. Invalidates CloudFront cache
6. Runs health checks

**Time**: ~10 minutes

---

### `deploy-production.sh`
**LEGACY** - Original deployment script (keep for now)

```bash
./scripts/deploy-production.sh production
```

**Use for**: Infrastructure deployment (Terraform)

---

### `rollback-ecs.sh`
**NEW** - Emergency rollback for ECS deployments

```bash
# Rollback to previous version
./scripts/rollback-ecs.sh production

# Rollback to specific version
./scripts/rollback-ecs.sh production arn:aws:ecs:...:task-definition/...
```

**Time**: ~5 minutes

---

## 🏗️ Build Scripts

### `build-web-image.sh`
**NEW** - Build Next.js Docker image locally

```bash
# Build for testing
./scripts/build-web-image.sh development

# Build for staging
./scripts/build-web-image.sh staging

# Build with custom tag
./scripts/build-web-image.sh production v1.2.3
```

---

### `build-lambda-functions.sh`
Build Lambda functions for Connect/triggers

```bash
./scripts/build-lambda-functions.sh
```

---

## 🗄️ Infrastructure Scripts

### `deploy-infrastructure.sh`
Deploy Terraform infrastructure

```bash
./scripts/deploy-infrastructure.sh
```

---

### `migrate-terraform-state.sh`
**NEW** - Migrate from local to remote Terraform state

```bash
./scripts/migrate-terraform-state.sh
```

**CRITICAL**: Run this once before team collaboration

---

### `deploy-video-infrastructure.sh`
Deploy video-specific resources

```bash
./scripts/deploy-video-infrastructure.sh
```

---

## 🗃️ Database Scripts

### `migrate-database.sh`
Run database migrations

```bash
./scripts/migrate-database.sh
```

---

## 🧪 Testing Scripts

### `load-test.js`
k6 load testing script

```bash
k6 run scripts/load-test.js
```

---

### `test-video-visits.sh`
Test video visit functionality

```bash
./scripts/test-video-visits.sh
```

---

### `check-bundle.js`
Analyze bundle size and security

```bash
node scripts/check-bundle.js
```

---

## 🔄 Quick Commands

### Deploy Everything
```bash
# 1. Infrastructure
cd infrastructure/terraform
terraform apply

# 2. Application
./scripts/deploy-ecs.sh staging

# 3. Verify
curl https://staging.eudaura.com/api/health
```

### Emergency Rollback
```bash
# Immediate rollback
./scripts/rollback-ecs.sh production

# Or change DNS back to Amplify (if needed)
# Edit Route 53 manually or use prepared changeset
```

### Monitor Deployment
```bash
# Watch API logs
aws logs tail /aws/ecs/telehealth-api --follow

# Watch Web logs
aws logs tail /aws/ecs/telehealth-web --follow

# Check service status
aws ecs describe-services \
  --cluster telehealth-cluster-production \
  --services telehealth-api-production telehealth-web-production
```

---

## 📊 Deployment Comparison

| Feature | Amplify | ECS (New) |
|---------|---------|-----------|
| **Deploy command** | `git push` | `./scripts/deploy-ecs.sh` |
| **Build time** | 10-15 min | 8-12 min |
| **Rollback** | Via console | `./scripts/rollback-ecs.sh` |
| **Logs** | Amplify console | CloudWatch Logs |
| **Monitoring** | Split | Unified |
| **Cost** | $$$ | $$ |
| **Control** | Limited | Full |

---

## 🎯 Recommended Workflow

### Development
```bash
# Local development (no Docker needed)
pnpm dev

# Test Docker build locally
./scripts/build-web-image.sh development
docker run -p 3000:3000 telehealth-web:latest
```

### Staging
```bash
# Deploy after PR merge
./scripts/deploy-ecs.sh staging

# Verify
curl https://staging.eudaura.com/api/health

# Run E2E tests
pnpm run test:e2e
```

### Production
```bash
# Deploy (requires approval)
./scripts/deploy-ecs.sh production

# Monitor for 30 minutes
# Check CloudWatch dashboard

# If issues:
./scripts/rollback-ecs.sh production
```

---

*All scripts are ready for the Amplify → ECS migration.*

