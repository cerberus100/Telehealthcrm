# 🎯 Amazon Connect Setup Guide

## ✅ **ALREADY IMPLEMENTED (Ready to Deploy)**

### **✅ Backend API Endpoints**
- `POST /connect/identify` - Lambda handler for caller identification
- `POST /connect/call-notes` - Attach call recordings and transcripts
- `POST /events/screen-pop` - Trigger provider notifications
- `PATCH /providers/availability` - Provider online/offline toggle

### **✅ Database Models**
- `PatientPhone` - E.164 phone indexing for fast lookup
- `CallLookupIndex` - Warm cache for repeat callers
- `IntakeLink` - Links intake forms to DID numbers
- `InboundCall` - Call logging and tracking
- `IntakeSubmission` - Form submissions linked to calls

### **✅ Phone System**
- E.164 phone normalization
- Fuzzy search by last 7/10 digits
- State-based provider routing
- Duplicate caller detection (24hr window)

### **✅ Frontend Components**
- Provider availability toggle
- Incoming call banner with screen-pop
- Real-time call notifications (demo simulation)

### **✅ Contact Flow JSON**
- `infrastructure/connect-flow.json` - Ready to import
- Lambda invocation → Set contact attributes → Queue routing

## ⚠️ **REQUIRES AWS CONSOLE SETUP**

### **1. Amazon Connect Instance**
```bash
# Create Connect instance
aws connect create-instance \
  --identity-management-type CONNECT_MANAGED \
  --instance-alias teleplatform-prod \
  --inbound-calls-enabled \
  --outbound-calls-enabled
```

### **2. Phone Numbers (DIDs)**
- **Purchase phone numbers** in Connect console
- **Assign numbers** to intake links (one DID per marketer campaign)
- **Configure routing** to contact flows

### **3. Lambda Deployment**
```bash
# Package and deploy Lambda
cd apps/api
zip -r connect-lambda.zip src/integrations/connect/
aws lambda create-function \
  --function-name teleplatform-connect-identify \
  --runtime nodejs20.x \
  --handler connect-lambda.handler \
  --zip-file fileb://connect-lambda.zip \
  --environment Variables='{DATABASE_URL=...,REDIS_URL=...}'
```

### **4. Contact Flow Import**
```bash
# Import contact flow
aws connect create-contact-flow \
  --instance-id $CONNECT_INSTANCE_ID \
  --name "Teleplatform Intake Flow" \
  --type CONTACT_FLOW \
  --content file://infrastructure/connect-flow.json
```

### **5. Queue Configuration**
- **Create queues** for each provider organization
- **Set routing profiles** based on state licensing
- **Configure hours of operation**

## 🔧 **WHAT I CAN IMPLEMENT NOW**

### **1. Enhanced Lambda Handler**
- Better error handling and logging
- State-based routing logic
- Provider availability checking

### **2. Real-time WebSocket**
- Actual WebSocket gateway (not just demo)
- Provider subscription management
- Screen-pop event emission

### **3. Call Recording Integration**
- S3 storage configuration
- Transcribe Medical setup
- PHI redaction pipeline

### **4. Advanced Phone Features**
- DTMF phone entry for blocked ANI
- Multiple patient disambiguation
- Call transfer and hold music

Would you like me to implement these enhanced features now, or should we focus on the AWS infrastructure setup first?

## 🎯 **RECOMMENDED NEXT STEPS**

### **Option A: Enhanced Demo (I can do now)**
- Implement real WebSocket for screen-pop
- Add DTMF phone entry simulation
- Enhanced call flow with recording simulation

### **Option B: AWS Infrastructure (Requires AWS access)**
- Set up Connect instance
- Deploy Lambda functions
- Configure phone numbers and routing

### **Option C: Both (Complete implementation)**
- Enhanced code features + AWS setup guide
- Production-ready Connect integration
- End-to-end call flow testing

**Which approach would you prefer?**
