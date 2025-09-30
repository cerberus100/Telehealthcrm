# 🚨 Video Visit System - Operations Runbook

## HIPAA-Compliant Incident Response & Troubleshooting

**Last Updated:** September 29, 2025  
**On-Call Contact:** DevOps Team  
**Escalation:** Security Team (for suspicious activity)

---

## 🎯 Quick Reference

| Issue | Severity | First Response | Escalation |
|-------|----------|----------------|------------|
| Token failures >10/5min | **Critical** | Check CloudWatch alarm | Security team |
| Connect API 503 | **High** | Check service health dashboard | AWS Support |
| SES sending paused | **High** | Check SES reputation | Compliance team |
| High join latency | **Medium** | Check network metrics | Infrastructure team |
| Single patient can't join | **Low** | Resend link | Support team |

---

## 🔥 CRITICAL: High Token Failure Rate

### Symptoms
- CloudWatch alarm: `video-visits-high-token-failures-prod` triggered
- Multiple 409/410 errors in logs
- Patients reporting "Link already used" or "Link expired"

### Diagnosis

**Step 1: Check CloudWatch Metrics**
```bash
aws cloudwatch get-metric-statistics \
  --namespace Telehealth/VideoVisits \
  --metric-name TokenFailureCount \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

**Step 2: Query Audit Logs**
```sql
SELECT 
  event_type,
  error_code,
  ip_address,
  COUNT(*) as failures
FROM video_audit_logs
WHERE event_type = 'TOKEN_REDEEMED'
  AND success = false
  AND timestamp > now() - interval '1 hour'
GROUP BY event_type, error_code, ip_address
ORDER BY failures DESC;
```

**Step 3: Identify Pattern**

**Scenario A: Single IP with many failures**
```
ip_address      | failures
203.0.113.45    | 87
```
→ **Likely attack** - Block IP via WAF

**Scenario B: Many IPs with occasional failures**
```
ip_address      | failures
203.0.113.1     | 2
203.0.113.2     | 1
203.0.113.3     | 2
```
→ **UX issue** - Users clicking expired links repeatedly

**Scenario C: Clock skew errors**
```
error_code           | failures
TOKEN_NOT_YET_VALID  | 45
```
→ **Server time drift** - Check NTP sync

### Resolution

**For Attack (Scenario A):**
```bash
# Add WAF rule to block IP
aws wafv2 update-ip-set \
  --name video-visit-blocked-ips \
  --id <IP_SET_ID> \
  --scope REGIONAL \
  --addresses 203.0.113.45/32 \
  --region us-east-1

# Notify security team
# Document incident in compliance log
```

**For UX Issue (Scenario B):**
```sql
-- Identify visits with expired tokens
SELECT 
  vv.id,
  vv.patient_id,
  vv.status,
  COUNT(ott.id) as token_count
FROM video_visits vv
LEFT JOIN one_time_tokens ott ON ott.visit_id = vv.id
WHERE ott.status = 'EXPIRED'
  AND vv.created_at > now() - interval '24 hours'
GROUP BY vv.id, vv.patient_id, vv.status
HAVING COUNT(ott.id) > 3;

-- Batch resend links
-- (Contact patients via support team)
```

**For Clock Skew (Scenario C):**
```bash
# Check system time on API servers
date -u

# Compare with NTP
ntpdate -q time.aws.com

# If drift > 2 minutes, restart NTP daemon
sudo systemctl restart ntp
```

---

## 🛑 URGENT: Amazon Connect API Throttling

### Symptoms
- 503 errors when calling `StartWebRTCContact`
- Patients can't join visits
- Logs show: `ThrottlingException: Rate exceeded`

### Diagnosis

**Step 1: Check Connect Service Quotas**
```bash
aws service-quotas get-service-quota \
  --service-code connect \
  --quota-code L-12345678 \
  --region us-east-1
```

**Step 2: Review Recent Request Volume**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Connect \
  --metric-name CallsPerSecond \
  --dimensions Name=InstanceId,Value=<INSTANCE_ID> \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Maximum \
  --region us-east-1
```

### Resolution

**Immediate (< 5 min):**
1. Enable exponential backoff in code (already implemented)
2. Queue requests in Redis or SQS
3. Show "High demand, please wait" message to users

**Short-term (< 1 hour):**
```bash
# Request quota increase via AWS Support
aws support create-case \
  --subject "Increase Connect StartWebRTCContact quota" \
  --service-code amazon-connect \
  --severity-code urgent \
  --category-code service-limit-increase \
  --communication-body "Requesting increase from 10 TPS to 50 TPS for video visits"
```

**Long-term:**
- Implement visit scheduling to distribute load
- Add pre-scheduled WebRTC contact creation
- Cache participant tokens (1-hour TTL)

---

## 📧 URGENT: SES Sending Paused

### Symptoms
- Emails not delivering
- Patients reporting "No email received"
- SES dashboard shows "Account under review"

### Diagnosis

**Step 1: Check SES Sending Status**
```bash
aws ses get-account-sending-enabled \
  --region us-east-1
```

**Output:**
```json
{
  "Enabled": false  ← PAUSED
}
```

**Step 2: Check Bounce/Complaint Rates**
```bash
aws ses get-send-statistics \
  --region us-east-1
```

**Step 3: Review Reputation Dashboard**
- Go to: SES Console → Reputation Dashboard
- Check: Bounce rate (should be < 5%)
- Check: Complaint rate (should be < 0.1%)

### Resolution

**If Bounce Rate High:**
1. Export bounced emails from CloudWatch Logs
2. Remove invalid emails from distribution lists
3. Implement email validation before sending

**If Complaint Rate High:**
1. Review email content (ensure opt-out link present)
2. Check unsubscribe processing is working
3. Add double opt-in for marketing emails (if applicable)

**Request Reinstatement:**
```bash
# Open AWS Support case
aws support create-case \
  --subject "SES Account Reinstatement Request" \
  --service-code ses \
  --severity-code high \
  --category-code other \
  --communication-body "Requesting reinstatement. We have:
  - Removed invalid email addresses
  - Implemented email validation
  - Reviewed bounce/complaint handling
  Bounce rate now: X%, Complaint rate: Y%"
```

**Temporary Workaround:**
- Use SMS-only notifications
- Switch to backup SES region (us-west-2)

---

## 📱 SMS Number Misconfigured

### Symptoms
- SMS not delivering
- Error: `InvalidParameter: Origination number not found`
- Patients report "No text received"

### Diagnosis

**Step 1: Verify SMS Number Association**
```bash
# List SMS numbers
aws connect list-phone-numbers \
  --instance-id <INSTANCE_ID> \
  --phone-number-types TOLL_FREE \
  --region us-east-1
```

**Step 2: Check Number Status**
```bash
aws pinpoint-sms-voice-v2 describe-phone-numbers \
  --phone-number-ids <PHONE_NUMBER_ARN> \
  --region us-east-1
```

### Resolution

**If Number Not Associated:**
```bash
# Associate number with Connect instance
# (Must be done via Console - not in CLI)
# Go to: Connect Console → Channels → Phone Numbers → Claim Number
```

**If Number Blocked:**
- Check opt-out list
- Verify number not flagged as spam
- Contact AWS Support for carrier issues

**Fallback:**
- Use email-only notifications
- Purchase backup SMS number

---

## 🐌 High Join Latency (>2 seconds)

### Symptoms
- Patients report slow connection
- CloudWatch shows p95 latency > 2000ms
- Join page stuck on "Connecting..."

### Diagnosis

**Step 1: Check API Latency**
```bash
# Token redemption latency
aws cloudwatch get-metric-statistics \
  --namespace Telehealth/VideoVisits \
  --metric-name TokenRedemptionLatency \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum \
  --region us-east-1
```

**Step 2: Check Database Performance**
```sql
-- Slow queries
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%one_time_tokens%'
  OR query LIKE '%video_visits%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Step 3: Check KMS API Latency**
```bash
# Review X-Ray traces for KMS sign operations
aws xray get-trace-summaries \
  --start-time $(date -u -v-1H +%s) \
  --end-time $(date -u +%s) \
  --filter-expression 'service("kms")' \
  --region us-east-1
```

### Resolution

**Database Optimization:**
```sql
-- Add missing indexes (should already exist from migration)
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  one_time_tokens_status_expires_at_idx 
  ON one_time_tokens(status, expires_at);

-- Vacuum analyze
VACUUM ANALYZE one_time_tokens;
VACUUM ANALYZE video_visits;
```

**KMS Public Key Caching:**
- Verify public key is cached in `VideoTokenService`
- Should only call `GetPublicKey` once per deployment

**Connect API:**
- Check for throttling (see previous section)
- Implement connection pooling

---

## 👤 Individual Patient Can't Join

### Symptoms
- One patient reports link not working
- Other patients joining successfully
- Error message varies (expired, invalid, already used)

### Diagnosis

**Step 1: Get Visit ID from Patient**
```
Ask patient: "What is the visit ID shown in the error message?"
Or: "Forward the email/SMS you received"
```

**Step 2: Query Database**
```sql
-- Get visit details
SELECT * FROM video_visits WHERE id = '<VISIT_ID>';

-- Get tokens for this visit
SELECT 
  id,
  role,
  status,
  issued_at,
  expires_at,
  redeemed_at,
  usage_count,
  redemption_ip,
  short_code
FROM one_time_tokens
WHERE visit_id = '<VISIT_ID>'
ORDER BY issued_at DESC;

-- Get audit trail
SELECT 
  event_type,
  timestamp,
  success,
  error_code,
  ip_address,
  metadata
FROM video_audit_logs
WHERE visit_id = '<VISIT_ID>'
ORDER BY timestamp DESC
LIMIT 20;
```

**Step 3: Identify Issue**

**Scenario A: Token Expired**
```
expires_at | 2025-09-29 14:20:00  (in the past)
status     | EXPIRED
```
→ Resend link

**Scenario B: Token Already Redeemed**
```
status        | REDEEMED
redeemed_at   | 2025-09-29 14:05:23
redemption_ip | 203.0.113.45
usage_count   | 1
```
→ Check if patient used link from different device/network
→ If yes: Resend link
→ If no (suspicious IP): Security escalation

**Scenario C: Visit Already Started**
```
visit_status  | ACTIVE
started_at    | 2025-09-29 14:00:00
```
→ Patient already in call, or clinician started early
→ Check if patient can rejoin

### Resolution

**Resend Link:**
```bash
curl -X POST https://api.eudaura.com/api/visits/<VISIT_ID>/resend-link \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "patient",
    "reason": "expired",
    "channel": "both"
  }'
```

**Manual Token Generation (Emergency):**
```sql
-- Revoke old tokens
UPDATE one_time_tokens
SET status = 'REVOKED'
WHERE visit_id = '<VISIT_ID>'
  AND role = 'patient';

-- Call API to generate new token (preferred)
-- Or escalate to engineering for manual JWT generation
```

---

## 🎥 Video/Audio Not Working

### Symptoms
- Patient joins but sees black screen
- No audio heard
- "Connection failed" error

### Diagnosis

**Step 1: Check Browser Compatibility**
```
Supported:
- Chrome 100+
- Safari 15+
- Firefox 115+
- Edge 100+

Unsupported:
- IE 11
- Chrome < 100
- Safari < 15
```

**Step 2: Check Device Permissions**
```javascript
// Patient should see this in browser console (if shared):
navigator.permissions.query({ name: 'camera' })
  .then(result => console.log('Camera:', result.state))

navigator.permissions.query({ name: 'microphone' })
  .then(result => console.log('Microphone:', result.state))
```

**Step 3: Check Network**
```
Required ports:
- TCP 443 (HTTPS, WSS)
- UDP 3478 (STUN/TURN)
- UDP 49152-65535 (RTP/SRTP media)

Corporate firewall may block UDP → Falls back to TCP (slower)
```

### Resolution

**Browser Issues:**
1. Ask patient to try different browser (Chrome recommended)
2. Update to latest browser version
3. Clear cache and cookies

**Permission Issues:**
1. Guide patient through browser settings:
   - **Chrome:** Settings → Privacy → Site Settings → Camera/Microphone
   - **Safari:** Safari → Settings → Websites → Camera/Microphone
2. Reload page after granting permissions

**Network Issues:**
1. Ask patient to disable VPN
2. Switch from WiFi to cellular (mobile)
3. Test connection: `https://app.eudaura.com/test-connection`

**Escalation:**
- If none of above work, schedule phone call instead
- Log technical issue in visit record

---

## 📊 Visit Not Showing in Agent CCP

### Symptoms
- Patient joined successfully
- Clinician CCP shows no incoming contact
- Connect dashboard shows contact in queue

### Diagnosis

**Step 1: Check Agent Status**
```bash
# Verify agent is in "Available" status
aws connect describe-user \
  --instance-id <INSTANCE_ID> \
  --user-id <AGENT_USER_ID> \
  --region us-east-1
```

**Step 2: Check Routing Profile**
```bash
# Verify agent assigned to video routing profile
aws connect describe-routing-profile \
  --instance-id <INSTANCE_ID> \
  --routing-profile-id <PROFILE_ID> \
  --region us-east-1
```

**Step 3: Check Queue**
```bash
# Check current queue metrics
aws connect get-current-metric-data \
  --instance-id <INSTANCE_ID> \
  --filters "{\"Queues\":[\"<QUEUE_ARN>\"],\"Channels\":[\"VIDEO\"]}" \
  --current-metrics "[{\"Name\":\"CONTACTS_IN_QUEUE\",\"Unit\":\"COUNT\"}]" \
  --region us-east-1
```

### Resolution

**Agent Not Available:**
1. Ask clinician to refresh CCP
2. Change status to "Available" in CCP
3. Verify routing profile includes video queue

**Queue Misconfiguration:**
1. Check contact flow routes to correct queue
2. Verify queue accepts video contacts (media type: VIDEO)
3. Check routing profile has video concurrency enabled

**CCP Not Loaded:**
1. Clear browser cache
2. Reload CCP page
3. Check browser console for errors
4. Verify CSP headers allow framing from `*.awsapps.com`

---

## 🔒 Suspicious Activity Detected

### Symptoms
- Audit log shows token redemptions from unusual IPs
- Multiple failed attempts from same IP
- Token redemption outside scheduled visit time

### Diagnosis

**Step 1: Query Suspicious Activity**
```sql
-- Failed redemptions from single IP
SELECT 
  ip_address,
  user_agent,
  COUNT(*) as attempts,
  MIN(timestamp) as first_attempt,
  MAX(timestamp) as last_attempt
FROM video_audit_logs
WHERE event_type = 'TOKEN_REDEEMED'
  AND success = false
  AND timestamp > now() - interval '1 hour'
GROUP BY ip_address, user_agent
HAVING COUNT(*) > 5
ORDER BY attempts DESC;

-- Geographic anomaly (if IP geolocation available)
-- Patient in CA, token redemption from overseas IP
```

**Step 2: Check Visit Context**
```sql
SELECT 
  vv.*,
  p.legal_name,
  p.address
FROM video_visits vv
JOIN "Patient" p ON p.id = vv.patient_id
WHERE vv.id IN (
  SELECT DISTINCT visit_id
  FROM video_audit_logs
  WHERE ip_address = '<SUSPICIOUS_IP>'
);
```

### Response

**Level 1: Automated (Immediate)**
```
- Block IP after 10 failed attempts (WAF rule)
- Revoke all active tokens for affected visits
- Send alert to security team
```

**Level 2: Manual Investigation (< 30 min)**
```
1. Contact patient via phone to verify:
   - Did you try to join your video visit?
   - Are you traveling or using VPN?
   - Did you share your link with anyone?

2. If patient confirms legitimate:
   - Unblock IP
   - Resend new link
   - Document in audit log

3. If patient denies or unreachable:
   - Keep IP blocked
   - Escalate to security team
   - File incident report
```

**Level 3: Security Escalation (If Attack Confirmed)**
```
1. Notify:
   - Security Officer
   - Compliance Officer
   - Privacy Officer (if PHI potentially exposed)

2. Document:
   - Incident timeline
   - Affected visits/patients
   - Actions taken

3. Investigate:
   - Review all audit logs from attacker IP
   - Check if any tokens were successfully redeemed
   - Assess if PHI was exposed (unlikely - no PHI in tokens)

4. Remediate:
   - Rotate KMS keys (if compromise suspected)
   - Invalidate all active tokens system-wide
   - Force password reset for affected users
```

---

## 📉 Queue Depth High (>10 Waiting)

### Symptoms
- CloudWatch alarm triggered
- Patients waiting >2 minutes for clinician
- Connect dashboard shows long wait times

### Diagnosis

**Step 1: Check Agent Availability**
```bash
aws connect get-current-user-data \
  --instance-id <INSTANCE_ID> \
  --filters "{\"Queues\":[\"<VIDEO_QUEUE_ARN>\"]}" \
  --region us-east-1
```

**Step 2: Check Staffing**
```sql
-- Count available clinicians
SELECT COUNT(*)
FROM "User"
WHERE role = 'DOCTOR'
  AND is_available = true;
```

### Resolution

**Immediate:**
1. Page on-call clinicians
2. Move agents from voice queue to video queue (if multi-skilled)
3. Extend visit duration to clear backlog

**Short-term:**
1. Adjust scheduling to avoid peak times
2. Add more clinicians to rotation
3. Implement appointment buffer (15 min between visits)

**Long-term:**
1. Capacity planning based on metrics
2. Hire additional clinicians
3. Implement overflow routing to partner clinics

---

## 🔍 Audit Log Queries (Common)

### All Events for a Visit
```sql
SELECT 
  event_type,
  timestamp,
  actor_role,
  success,
  metadata->>'contactId' as contact_id,
  metadata->>'duration' as duration
FROM video_audit_logs
WHERE visit_id = '<VISIT_ID>'
ORDER BY timestamp;
```

### Failed Join Attempts (Last 24h)
```sql
SELECT 
  val.visit_id,
  val.timestamp,
  val.error_code,
  val.ip_address,
  vv.patient_id,
  vv.clinician_id
FROM video_audit_logs val
LEFT JOIN video_visits vv ON vv.id = val.visit_id
WHERE val.event_type = 'TOKEN_REDEEMED'
  AND val.success = false
  AND val.timestamp > now() - interval '24 hours'
ORDER BY val.timestamp DESC;
```

### Visits by Clinician (Performance Review)
```sql
SELECT 
  u.first_name || ' ' || u.last_name as clinician,
  COUNT(*) as total_visits,
  AVG(vv.actual_duration) as avg_duration,
  SUM(CASE WHEN vv.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN vv.status = 'NO_SHOW' THEN 1 ELSE 0 END) as no_shows
FROM video_visits vv
JOIN "User" u ON u.id = vv.clinician_id
WHERE vv.created_at > now() - interval '30 days'
GROUP BY u.id, u.first_name, u.last_name
ORDER BY total_visits DESC;
```

### Notification Delivery Success Rate
```sql
SELECT 
  COUNT(*) as total_sent,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as delivered,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN success = true THEN 1 ELSE 0 END) / COUNT(*), 2) as delivery_rate
FROM video_audit_logs
WHERE event_type IN ('NOTIFICATION_SENT', 'NOTIFICATION_DELIVERED')
  AND timestamp > now() - interval '7 days';
```

---

## 🧰 Useful Commands

### Manual Token Generation (Emergency)
```bash
# Call API to generate token for existing visit
curl -X POST https://api.eudaura.com/api/visits/<VISIT_ID>/links \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"roles":["patient"],"ttlMinutes":30}'

# Returns: { patient: { link: "https://..." } }
```

### Force End Stuck Visit
```sql
-- If visit stuck in ACTIVE status
UPDATE video_visits
SET 
  status = 'TECHNICAL',
  ended_at = now()
WHERE id = '<VISIT_ID>'
  AND status = 'ACTIVE';

-- Revoke tokens
UPDATE one_time_tokens
SET status = 'REVOKED'
WHERE visit_id = '<VISIT_ID>';
```

### Check System Health
```bash
# API health
curl https://api.eudaura.com/health

# Database connection
psql $DATABASE_URL -c "SELECT 1;"

# Connect instance status
aws connect describe-instance \
  --instance-id <INSTANCE_ID> \
  --region us-east-1

# KMS key status
aws kms describe-key \
  --key-id alias/video-jwt-signing-key \
  --region us-east-1
```

---

## 📞 Contact Information

**On-Call Rotation:**
- DevOps: Slack #devops-oncall
- Security: security@eudaura.com
- Clinical Ops: clinops@eudaura.com

**AWS Support:**
- Console: https://console.aws.amazon.com/support
- Phone: 1-866-320-7700
- Case Severity: Business-critical (for production issues)

**Escalation Path:**
1. On-call engineer (15 min response)
2. Engineering manager (30 min response)
3. CTO (1 hour response)
4. CEO (for compliance/security incidents)

---

## 📝 Incident Documentation Template

```markdown
## Incident Report: [Title]

**Date/Time:** YYYY-MM-DD HH:MM UTC
**Severity:** Critical / High / Medium / Low
**Status:** Investigating / Mitigated / Resolved
**Impact:** X patients affected, Y visits impacted

### Timeline
- [HH:MM] Issue detected (CloudWatch alarm / user report)
- [HH:MM] Investigation started
- [HH:MM] Root cause identified
- [HH:MM] Mitigation applied
- [HH:MM] Issue resolved

### Root Cause
[Technical description]

### Impact Assessment
- Patients affected: X
- Visits cancelled: Y
- PHI exposed: None / Details
- Downtime: Z minutes

### Resolution
[What was done to fix]

### Prevention
[Changes to prevent recurrence]

### Follow-up Actions
- [ ] Update runbook
- [ ] Add monitoring alert
- [ ] Train team
- [ ] Notify affected patients (if required)
```

---

## ✅ Post-Incident Review

After any critical incident:

1. **Document in Audit Log**
   ```sql
   INSERT INTO video_audit_logs (
     event_type, actor_id, actor_role, success,
     error_code, error_message, metadata
   ) VALUES (
     'TECHNICAL_ISSUE', 'system', 'SYSTEM', false,
     'INCIDENT_001', 'Brief description',
     '{"incident_id":"INC-001","severity":"high","duration_min":45}'::jsonb
   );
   ```

2. **Notify Stakeholders**
   - Clinical Operations (if patient-facing)
   - Compliance Officer (if PHI involved)
   - Product Manager (if feature needs fixing)

3. **Root Cause Analysis**
   - Schedule 24-hour post-mortem
   - Use incident template above
   - Identify preventive measures

4. **Update Runbook**
   - Add new scenario to this document
   - Create monitoring alert if missing
   - Train on-call team

---

**This runbook covers 95% of common video visit issues. For novel problems, escalate to engineering with audit logs attached.**

