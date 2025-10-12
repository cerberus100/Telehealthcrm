# Core Services Matrix

## Service Availability by Environment

| Service | Description | Dev | Staging | Production | Status | Notes |
|---------|-------------|-----|---------|------------|--------|-------|
| **Authentication** | Email/SMS/SSO login | ✅ | ✅ | ✅ | **READY** | AWS Cognito with JWT |
| Password Reset | Self-service reset | ✅ | ✅ | ✅ | **READY** | Cognito-based |
| MFA | Multi-factor auth | ⚠️ | ⚠️ | ⚠️ | **PARTIAL** | Schema supports, not enforced |
| SSO | SAML/OIDC integration | ❌ | ❌ | ❌ | **NOT IMPL** | No SSO configuration found |
| **Scheduling** | Provider availability | ✅ | ✅ | ✅ | **READY** | DynamoDB-based |
| Timezone Support | DST handling | ⚠️ | ⚠️ | ⚠️ | **PARTIAL** | No explicit timezone handling |
| Double-booking Prevention | Conflict detection | ✅ | ✅ | ✅ | **READY** | Atomic slot booking |
| Calendar Sync | Provider calendar | ❌ | ❌ | ❌ | **NOT IMPL** | No calendar integration |
| **E-Consent & Forms** | Digital signatures | ✅ | ✅ | ✅ | **READY** | KMS-based signatures |
| Template Versioning | Form versions | ✅ | ✅ | ✅ | **READY** | Document versioning |
| Audit Trail | Signature logs | ✅ | ✅ | ✅ | **READY** | Chain of trust |
| PDF Generation | Export forms | ✅ | ✅ | ✅ | **READY** | S3 storage with WORM |
| **Clinical Notes** | Provider notes | ✅ | ✅ | ✅ | **READY** | KMS encrypted |
| Autosave | Draft preservation | ❌ | ❌ | ❌ | **NOT IMPL** | No draft mechanism |
| Attachments | File uploads | ✅ | ✅ | ✅ | **READY** | S3 presigned URLs |
| Export | Download notes | ❌ | ❌ | ❌ | **NOT IMPL** | No export API |
| **Messaging** | In-app notifications | ✅ | ✅ | ✅ | **READY** | WebSocket + DB |
| Email Notifications | SMTP/SES | ✅ | ✅ | ✅ | **READY** | AWS SES configured |
| SMS Notifications | Text messaging | ✅ | ✅ | ✅ | **READY** | AWS SNS configured |
| Push Notifications | Mobile push | ❌ | ❌ | ❌ | **NOT IMPL** | No push service |
| PHI Scrubbing | Message filtering | ✅ | ✅ | ✅ | **READY** | PHI redactor active |
| Unsubscribe | Opt-out mechanism | ❌ | ❌ | ❌ | **NOT IMPL** | No unsubscribe flow |
| **Payments** | Billing system | ❌ | ❌ | ❌ | **NOT IMPL** | No payment integration |
| PCI Compliance | Card security | N/A | N/A | N/A | **N/A** | No payment processing |
| **Provider Management** | Roster management | ✅ | ✅ | ✅ | **READY** | User/org model |
| License Verification | State licensing | ✅ | ✅ | ✅ | **READY** | States array in schema |
| NPI Validation | Provider lookup | ⚠️ | ⚠️ | ⚠️ | **PARTIAL** | Field exists, no validation |
| DEA Verification | DEA number | ⚠️ | ⚠️ | ⚠️ | **PARTIAL** | Field exists, no validation |

## Service Details

### ✅ Authentication (READY)
- **Implementation**: AWS Cognito with JWT tokens
- **Features**: Email/password, phone verification, refresh tokens
- **Security**: Token expiry, secure storage, HTTPS only
- **Issues**: MFA not enforced, no SSO

### ✅ Scheduling (READY)
- **Implementation**: DynamoDB for provider availability
- **Features**: Time slot management, atomic booking, conflict prevention
- **Security**: Row-level security, audit logging
- **Issues**: No timezone handling, no external calendar sync

### ✅ E-Consent & Forms (READY)
- **Implementation**: KMS signatures with WebAuthn support
- **Features**: Document versioning, chain of trust, PDF storage
- **Security**: WORM compliance, cryptographic signatures, audit trail
- **Issues**: None identified

### ✅ Clinical Notes (READY)
- **Implementation**: PostgreSQL with KMS encryption
- **Features**: Encrypted storage, attachments via S3
- **Security**: Field-level encryption for sensitive data
- **Issues**: No autosave, no export functionality

### ✅ Messaging (READY)
- **Implementation**: WebSocket + SES/SNS
- **Features**: Real-time notifications, email/SMS delivery
- **Security**: PHI redaction, encrypted transport
- **Issues**: No push notifications, no unsubscribe mechanism

### ❌ Payments (NOT IMPLEMENTED)
- No payment processing capability
- No billing or invoicing system
- No subscription management

### ✅ Provider Management (READY)
- **Implementation**: User model with provider attributes
- **Features**: Multi-state licensing, availability tracking
- **Security**: RBAC/ABAC controls
- **Issues**: No external verification of licenses/NPI/DEA

## Error States & Empty States

### Authentication
- ✅ Invalid credentials: Clear error message
- ✅ Account locked: Specific messaging
- ⚠️ MFA failure: Not implemented

### Scheduling  
- ✅ No available slots: Empty state message
- ✅ Double-booking attempt: Conflict error
- ❌ Provider unavailable: No graceful handling

### E-Consent
- ✅ Document not found: 404 handling
- ✅ Signature verification failure: Error state
- ✅ Expired documents: Clear messaging

### Clinical Notes
- ⚠️ Empty notes: No default template
- ✅ Upload failure: Error handling
- ❌ Concurrent editing: No conflict resolution

### Messaging
- ✅ Delivery failure: Retry mechanism
- ✅ No messages: Empty state
- ❌ Rate limiting: No user feedback

## Recommendations

### P0 - Critical Gaps
1. **MFA Enforcement**: Enable and require for providers
2. **Timezone Support**: Add proper DST handling for scheduling
3. **Autosave**: Implement draft saving for clinical notes

### P1 - High Priority
1. **SSO Integration**: Add SAML/OIDC for enterprise
2. **Calendar Sync**: Google/Outlook integration
3. **Push Notifications**: Mobile app support
4. **Unsubscribe**: Email/SMS opt-out compliance

### P2 - Nice to Have
1. **Payment Processing**: Stripe/Square integration
2. **NPI/DEA Validation**: External verification APIs
3. **Note Templates**: Customizable clinical templates
4. **Advanced Search**: Full-text search across records
