# 🔧 Environment Variables Setup Guide

## For App Team (Telehealth Platform)

**After backend handoff, you need to set these environment variables:**

---

## 📝 **Environment Variables to Add**

### **Amplify Console → App Settings → Environment Variables**

```bash
# API Configuration (Backend provided)
NEXT_PUBLIC_API_BASE_URL=https://api.eudaura.com
NEXT_PUBLIC_WS_URL=api.eudaura.com
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_ENV=production

# Video Visit System
NEXT_PUBLIC_VIDEO_ENABLED=true
TELEHEALTH_API_URL=https://api.eudaura.com
TELEHEALTH_ADMIN_TOKEN=<ASK_BACKEND_TEAM_FOR_THIS>

# Patient/Clinician APIs (Backend confirmed these exist)
AWS_REGION=us-east-1
AWS_DYNAMO_TABLE=telehealth-patient-provisional-prod
AWS_AUDIT_TABLE=telehealth-audit-logs-prod
AWS_S3_UPLOAD_BUCKET=telehealth-documents-prod-816bc6d1
SES_FROM_EMAIL=noreply@eudaura.com
SES_CONFIGURATION_SET=telehealth-ses-config-prod

# Cognito (Already configured)
COGNITO_USER_POOL_ID=us-east-1_yBMYJzyA1
COGNITO_CLIENT_ID=crsnkji5f4i7f7v739tf6ef0u
```

---

## 🔧 **CLI Commands to Set Variables**

### **Option 1: Via AWS CLI (Amplify)**

```bash
# Get your Amplify app ID
aws amplify list-apps --query 'apps[?name==`web`].appId' --output text

# Set each variable
aws amplify put-app \
  --app-id d1o2jv5ahrim0e \
  --environment-variables '{
    "NEXT_PUBLIC_API_BASE_URL": "https://api.eudaura.com",
    "NEXT_PUBLIC_VIDEO_ENABLED": "true",
    "TELEHEALTH_API_URL": "https://api.eudaura.com",
    "TELEHEALTH_ADMIN_TOKEN": "mock_access_admin@demo.health",
    "AWS_REGION": "us-east-1",
    "AWS_DYNAMO_TABLE": "telehealth-patient-provisional-prod",
    "SES_FROM_EMAIL": "noreply@eudaura.com"
  }'

# Trigger redeploy
aws amplify start-job \
  --app-id d1o2jv5ahrim0e \
  --branch-name main \
  --job-type RELEASE
```

### **Option 2: Via Amplify Console (Easier)**

1. Go to: https://console.aws.amazon.com/amplify/home
2. Click your app → Environment variables
3. Add each variable from the list above
4. Save → Redeploy

---

## 🧪 **For Local Testing**

### **Create `.env.local` file:**

```bash
cd /Users/alexsiegel/teleplatform/apps/web

cat > .env.local << 'EOF'
# Local Development Environment
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
NEXT_PUBLIC_WS_URL=127.0.0.1:3001
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_VIDEO_ENABLED=true

# Backend API
TELEHEALTH_API_URL=http://127.0.0.1:3001
TELEHEALTH_ADMIN_TOKEN=mock_access_admin@demo.health

# AWS (for local testing)
AWS_REGION=us-east-1
API_DEMO_MODE=true
EOF

echo "✅ Local environment variables created"
```

### **Start Development Server:**

```bash
cd apps/web
npm run dev

# Should start on: http://localhost:3000
# Test: http://localhost:3000/api/schedule-video-visit
```

---

## 📋 **Verification Checklist**

### **Test These Endpoints:**

```bash
# 1. Health check
curl http://localhost:3000/api/schedule-video-visit
# Expected: {"service":"video-visit-scheduler","status":"ok"}

# 2. Patient signup
curl -X POST http://localhost:3000/api/patient/provisional \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User", 
    "email": "test@example.com",
    "phone": "+15551234567",
    "dob": "1990-01-01",
    "address": {
      "address1": "123 Main St",
      "city": "Austin", 
      "state": "TX",
      "postalCode": "78701"
    },
    "insurance": {"hasInsurance": false},
    "preferredContact": "Email",
    "consent": true
  }'

# Expected: {"requestId": "patient_xyz", "contact": "test@example.com"}

# 3. Video join page
curl -I http://localhost:3000/j/testtoken
# Expected: 200 OK

# 4. Portal pages
curl -I http://localhost:3000/portal/visits
# Expected: 200 OK
```

---

## 🎯 **Next Steps**

1. **✅ Set environment variables** (use commands above)
2. **✅ Test locally** (verify all endpoints work)
3. **✅ Deploy to production** (Amplify auto-deploys)
4. **✅ Test production** (real signup flow)
5. **✅ Go live!** 🚀

**All code is ready. Just configure and deploy!**
