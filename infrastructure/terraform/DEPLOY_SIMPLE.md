# Simplified Terraform Deployment - ECS Only

**The new Terraform files have dependencies on infrastructure that may not exist yet.**

**Solution**: Deploy in stages OR use existing infrastructure

---

## 🎯 RECOMMENDED: Use What's Already Working

Instead of fighting Terraform integration issues, let's deploy the working code:

### Step 1: Build Docker Images Locally
```bash
cd /Users/alexsiegel/teleplatform

# Get AWS account
export AWS_ACCOUNT_ID=337909762852
export AWS_REGION=us-east-1

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build API
cd apps/api
docker build -t ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-api:latest .
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-api:latest

# Build Web  
cd ../web
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 \
  --build-arg NEXT_PUBLIC_WS_URL=ws://localhost:3001 \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  -t ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-web:latest \
  .

# Check if ECR repo exists, create if needed
aws ecr describe-repositories --repository-names telehealth-web 2>/dev/null || \
  aws ecr create-repository --repository-name telehealth-web --region $AWS_REGION

docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/telehealth-web:latest
```

### Step 2: Use Existing ECS or Create Minimal Service
```bash
# Check if you have existing ECS cluster
aws ecs list-clusters

# If you have one, update the API service with new image
aws ecs update-service \
  --cluster <your-cluster-name> \
  --service <your-api-service> \
  --force-new-deployment

# For web, you may need to create a new service via console or use existing
```

---

## 💡 ALTERNATIVE: Deploy Web via Amplify, API via ECS

**Hybrid approach** (works TODAY):

### API: Already on ECS
- Push new API image (done above)
- Update ECS service

### Web: Use Amplify
- amplify.yml still exists
- Just connect Amplify to your repo
- All fixes are in git
- Auto-deploys

This gets you deployed in **30 minutes** with all fixes live!

---

## ✅ BEST IMMEDIATE PATH

Given the Terraform complexity, here's what will work RIGHT NOW:

```bash
# 1. Build and push API image
cd /Users/alexsiegel/teleplatform/apps/api
docker build -t 337909762852.dkr.ecr.us-east-1.amazonaws.com/telehealth-api:latest .

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  337909762852.dkr.ecr.us-east-1.amazonaws.com

docker push 337909762852.dkr.ecr.us-east-1.amazonaws.com/telehealth-api:latest

# 2. Deploy web via Amplify (simplest)
# AWS Console → Amplify → Connect to repo → Deploy

# OR build web Docker (if you have ECS service ready)
cd ../web
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.eudaura.com \
  -t 337909762852.dkr.ecr.us-east-1.amazonaws.com/telehealth-web:latest \
  .
docker push 337909762852.dkr.ecr.us-east-1.amazonaws.com/telehealth-web:latest
```

---

**Bottom Line**: Deploy API to existing ECS + Web to Amplify = WORKS TODAY with all your fixes! 🚀

