# MFA Enforcement Configuration Guide

**Purpose**: Enable Multi-Factor Authentication for HIPAA compliance  
**Priority**: P1 - High Priority  
**Impact**: Required for production deployment

---

## Current Status

- ✅ Database schema supports MFA (`mfaEnrolled` field in User model)
- ⚠️ Cognito MFA **NOT ENFORCED** (optional only)
- ⚠️ Application code doesn't require MFA for privileged roles

---

## Step 1: Enable MFA in Cognito (AWS Console)

### Via AWS Console
1. Navigate to Amazon Cognito → User Pools
2. Select pool: `us-east-1_yBMYJzyA1`
3. Go to **Sign-in experience** → **Multi-factor authentication**
4. Update MFA enforcement:
   - **Required**: For all users
   - **MFA methods**: TOTP (authenticator app) + SMS
   - **Preferred method**: TOTP (more secure)

### Via AWS CLI
```bash
aws cognito-idp set-user-pool-mfa-config \
  --user-pool-id us-east-1_yBMYJzyA1 \
  --mfa-configuration ON \
  --software-token-mfa-configuration Enabled=true \
  --sms-mfa-configuration SmsConfiguration={SnsCallerArn=<SNS_ROLE_ARN>}
```

---

## Step 2: Configure MFA by Role (Recommended)

### Enforce MFA for Privileged Roles Only

**High-risk roles requiring MFA**:
- `SUPER_ADMIN`
- `ADMIN`
- `ORG_ADMIN`
- `DOCTOR` (accessing PHI)
- `PHARMACIST` (accessing Rx)

**Low-risk roles (optional MFA)**:
- `SUPPORT` (read-only)
- `AUDITOR` (read-only)
- `MARKETER` (limited PHI access)

### Implementation Options

#### Option A: Cognito Advanced Security Features
```hcl
# In auth.tf (requires managed resource)
resource "aws_cognito_user_pool" "main" {
  # ... existing config ...
  
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }
  
  mfa_configuration = "OPTIONAL"  # Let application enforce per-role
}
```

#### Option B: Application-Level Enforcement (RECOMMENDED)
Implement in `apps/api/src/middleware/mfa.middleware.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { FastifyRequest, FastifyReply } from 'fastify'

const MFA_REQUIRED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN', 
  'ORG_ADMIN',
  'DOCTOR',
  'PHARMACIST'
]

@Injectable()
export class MfaMiddleware {
  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const claims = (req as any).claims
    
    if (!claims) {
      return next()
    }
    
    // Check if role requires MFA
    if (MFA_REQUIRED_ROLES.includes(claims.role)) {
      // Check if user has MFA enrolled
      const mfaEnrolled = claims['custom:mfa_enrolled'] === 'true'
      
      if (!mfaEnrolled) {
        throw new UnauthorizedException({
          code: 'MFA_REQUIRED',
          message: 'Multi-factor authentication required for this role',
          action: 'ENROLL_MFA'
        })
      }
    }
    
    next()
  }
}
```

---

## Step 3: Update Cognito Pre-Auth Lambda Trigger

**File**: `infrastructure/lambda/pre-auth/index.js`

```javascript
exports.handler = async (event) => {
  const userRole = event.request.userAttributes['custom:role']
  
  const mfaRequiredRoles = [
    'SUPER_ADMIN',
    'ADMIN',
    'ORG_ADMIN', 
    'DOCTOR',
    'PHARMACIST'
  ]
  
  if (mfaRequiredRoles.includes(userRole)) {
    // Require MFA for these roles
    if (!event.request.userAttributes['custom:mfa_enrolled']) {
      throw new Error('MFA enrollment required for this account')
    }
  }
  
  return event
}
```

---

## Step 4: Frontend MFA Enrollment Flow

### Add MFA Setup Component
**File**: `apps/web/components/MFAEnrollment.tsx`

```typescript
'use client'

import { useState } from 'react'
import QRCode from 'qrcode'

export function MFAEnrollment({ userId }: { userId: string }) {
  const [qrCode, setQrCode] = useState<string>('')
  const [secret, setSecret] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState<string>('')
  
  async function setupMFA() {
    // 1. Request TOTP setup
    const response = await fetch('/api/auth/mfa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    
    const { secretCode, qrCodeUrl } = await response.json()
    
    // 2. Generate QR code
    const qr = await QRCode.toDataURL(qrCodeUrl)
    setQrCode(qr)
    setSecret(secretCode)
  }
  
  async function verifyMFA() {
    // 3. Verify TOTP code
    const response = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        code: verificationCode,
        secret 
      })
    })
    
    if (response.ok) {
      alert('MFA successfully enrolled!')
      window.location.reload()
    }
  }
  
  return (
    <div className="mfa-enrollment">
      <h2>Set Up Two-Factor Authentication</h2>
      <p>Scan this QR code with your authenticator app:</p>
      {qrCode && <img src={qrCode} alt="MFA QR Code" />}
      <input 
        type="text"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value)}
        placeholder="Enter 6-digit code"
      />
      <button onClick={verifyMFA}>Verify & Enable</button>
    </div>
  )
}
```

---

## Step 5: API Endpoints for MFA

### Required API Routes
```typescript
// POST /api/auth/mfa/setup
// POST /api/auth/mfa/verify
// POST /api/auth/mfa/disable (admin only)
// GET /api/auth/mfa/status
```

### Implementation (CognitoService)
```typescript
async setupMFA(userId: string): Promise<{ secretCode: string; qrCodeUrl: string }> {
  const response = await this.cognitoClient.send(
    new AssociateSoftwareTokenCommand({
      AccessToken: accessToken
    })
  )
  
  const secretCode = response.SecretCode
  const qrCodeUrl = `otpauth://totp/Eudaura:${email}?secret=${secretCode}&issuer=Eudaura`
  
  return { secretCode, qrCodeUrl }
}

async verifyMFASetup(userId: string, code: string): Promise<boolean> {
  const response = await this.cognitoClient.send(
    new VerifySoftwareTokenCommand({
      AccessToken: accessToken,
      UserCode: code
    })
  )
  
  // Update user custom attribute
  await this.cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: this.userPoolId,
      Username: userId,
      UserAttributes: [
        { Name: 'custom:mfa_enrolled', Value: 'true' }
      ]
    })
  )
  
  return response.Status === 'SUCCESS'
}
```

---

## Step 6: Enforcement Strategy

### Phase 1: Soft Enforcement (Recommended First)
- Show MFA setup banner for privileged roles
- Allow 30-day grace period
- Send reminder emails
- Track enrollment metrics

### Phase 2: Hard Enforcement
- Block login for privileged roles without MFA
- Require immediate enrollment
- No grace period

### Implementation Timeline
```
Week 1: Deploy MFA setup UI
Week 2: Soft enforcement (banner + reminders)
Week 3: Monitor adoption rate
Week 4: Hard enforcement if > 80% adoption
```

---

## Step 7: Verify MFA Configuration

### Test Checklist
- [ ] MFA setup flow works for new users
- [ ] QR code generates correctly
- [ ] TOTP codes validate properly
- [ ] MFA required for DOCTOR role
- [ ] MFA optional for SUPPORT role
- [ ] Backup codes generated
- [ ] SMS fallback configured
- [ ] Account recovery process documented

### Monitoring
```bash
# Check MFA enrollment rate
aws cognito-idp list-users \
  --user-pool-id us-east-1_yBMYJzyA1 \
  --filter 'custom:mfa_enrolled = "true"' \
  | jq '.Users | length'
```

---

## Compliance Impact

### HIPAA Technical Safeguards
- ✅ §164.312(a)(2)(i) - Unique User Identification
- ✅ §164.312(d) - Person or Entity Authentication
- ⚠️ Currently not enforced (needs implementation)

### SOC 2 Controls
- ✅ CC6.1 - Logical and Physical Access Controls
- ⚠️ Multi-factor not required (gap)

**Risk**: Medium - MFA is security best practice for healthcare apps

---

## Rollout Plan

### Pre-Deployment
1. Create MFA enrollment UI components
2. Add API endpoints for MFA management
3. Test with pilot users
4. Create user documentation

### Deployment
1. Enable Cognito MFA (optional mode)
2. Deploy application code
3. Announce to users (30-day notice)
4. Monitor enrollment rate

### Post-Deployment
1. Track adoption metrics
2. Send reminder emails (weekly)
3. Support users with setup issues
4. Enforce after grace period

---

## Configuration Files

### Environment Variables
```bash
# .env.production
COGNITO_MFA_ENFORCEMENT=soft  # soft | hard | off
COGNITO_MFA_GRACE_PERIOD_DAYS=30
COGNITO_MFA_REQUIRED_ROLES=SUPER_ADMIN,ADMIN,ORG_ADMIN,DOCTOR,PHARMACIST
```

### Terraform Variables
```hcl
variable "mfa_enforcement" {
  description = "MFA enforcement mode"
  type        = string
  default     = "optional"  # optional | required
  validation {
    condition     = contains(["optional", "required"], var.mfa_enforcement)
    error_message = "MFA enforcement must be optional or required"
  }
}
```

---

## Next Steps

1. **Immediate**: Review and approve MFA strategy
2. **Week 1**: Implement MFA endpoints and UI
3. **Week 2**: Deploy in soft enforcement mode
4. **Week 3**: Monitor adoption, send reminders
5. **Week 4**: Enable hard enforcement

**Estimated Effort**: 2-3 developer days

---

*MFA enforcement is critical for HIPAA compliance and should be prioritized for production deployment.*

