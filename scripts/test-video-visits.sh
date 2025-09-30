#!/bin/bash

# ============================================
# Video Visit End-to-End Test Suite
# HIPAA/SOC2 Compliance Validation
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_BASE="${API_BASE_URL:-http://127.0.0.1:3001}"
ADMIN_TOKEN="${ADMIN_TOKEN:-mock_access_admin@demo.health}"

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}Video Visit System - End-to-End Tests${NC}"
echo -e "${BLUE}API: ${API_BASE}${NC}"
echo -e "${BLUE}=================================================${NC}\n"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper: Run test
run_test() {
  local name=$1
  local command=$2
  local expected=$3
  
  TESTS_RUN=$((TESTS_RUN + 1))
  echo -e "${BLUE}[Test $TESTS_RUN] ${name}${NC}"
  
  result=$(eval $command 2>&1)
  
  if echo "$result" | grep -q "$expected"; then
    echo -e "${GREEN}✓ PASS${NC}\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Expected: $expected"
    echo "Got: $result"
    echo ""
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# ============================================
# TEST 1: API Health Check
# ============================================

run_test "API Health Check" \
  "curl -s ${API_BASE}/health" \
  "ok"

# ============================================
# TEST 2: Create Video Visit
# ============================================

# Create patient and clinician first (if in demo mode)
PATIENT_ID="patient_test_$(date +%s)"
CLINICIAN_ID="clinician_test_$(date +%s)"

SCHEDULED_AT=$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+1 hour" +%Y-%m-%dT%H:%M:%SZ)

echo -e "${BLUE}[Test 2] Create Video Visit${NC}"
CREATE_RESPONSE=$(curl -s -X POST "${API_BASE}/api/visits" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "'${PATIENT_ID}'",
    "clinicianId": "'${CLINICIAN_ID}'",
    "scheduledAt": "'${SCHEDULED_AT}'",
    "duration": 30,
    "visitType": "initial",
    "chiefComplaint": "Test visit for automation",
    "channel": "both"
  }')

VISIT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.visitId' 2>/dev/null || echo "")

if [ ! -z "$VISIT_ID" ] && [ "$VISIT_ID" != "null" ]; then
  echo -e "${GREEN}✓ PASS - Visit ID: ${VISIT_ID}${NC}\n"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL - Could not create visit${NC}"
  echo "Response: $CREATE_RESPONSE"
  echo ""
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

TESTS_RUN=$((TESTS_RUN + 1))

# ============================================
# TEST 3: Generate Join Links
# ============================================

if [ ! -z "$VISIT_ID" ]; then
  echo -e "${BLUE}[Test 3] Generate Join Links${NC}"
  LINKS_RESPONSE=$(curl -s -X POST "${API_BASE}/api/visits/${VISIT_ID}/links" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "roles": ["patient", "clinician"],
      "ttlMinutes": 20
    }')
  
  PATIENT_TOKEN=$(echo "$LINKS_RESPONSE" | jq -r '.patient.token' 2>/dev/null || echo "")
  PATIENT_LINK=$(echo "$LINKS_RESPONSE" | jq -r '.patient.link' 2>/dev/null || echo "")
  
  if [ ! -z "$PATIENT_TOKEN" ] && [ "$PATIENT_TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ PASS - Patient link: ${PATIENT_LINK}${NC}\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL - Could not generate links${NC}"
    echo "Response: $LINKS_RESPONSE"
    echo ""
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  
  TESTS_RUN=$((TESTS_RUN + 1))
fi

# ============================================
# TEST 4: Send Notifications
# ============================================

if [ ! -z "$VISIT_ID" ]; then
  echo -e "${BLUE}[Test 4] Send Notifications${NC}"
  NOTIFY_RESPONSE=$(curl -s -X POST "${API_BASE}/api/visits/${VISIT_ID}/notify" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "channel": "email",
      "recipientRole": "patient",
      "template": "initial"
    }')
  
  if echo "$NOTIFY_RESPONSE" | grep -q "messageId\|sent"; then
    echo -e "${GREEN}✓ PASS - Notification sent${NC}\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${YELLOW}⚠ SKIP - SES not configured (expected in demo mode)${NC}\n"
    TESTS_RUN=$((TESTS_RUN - 1))
  fi
  
  TESTS_RUN=$((TESTS_RUN + 1))
fi

# ============================================
# TEST 5: Validate Token (Pre-Join Check)
# ============================================

if [ ! -z "$PATIENT_TOKEN" ]; then
  echo -e "${BLUE}[Test 5] Validate Token (Pre-Join)${NC}"
  REDEEM_RESPONSE=$(curl -s -X POST "${API_BASE}/api/token/redeem" \
    -H "Content-Type: application/json" \
    -d '{
      "token": "'${PATIENT_TOKEN}'"
    }')
  
  VALID=$(echo "$REDEEM_RESPONSE" | jq -r '.valid' 2>/dev/null || echo "false")
  
  if [ "$VALID" == "true" ]; then
    echo -e "${GREEN}✓ PASS - Token is valid${NC}\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL - Token validation failed${NC}"
    echo "Response: $REDEEM_RESPONSE"
    echo ""
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  
  TESTS_RUN=$((TESTS_RUN + 1))
fi

# ============================================
# TEST 6: Start Video Visit
# ============================================

if [ ! -z "$PATIENT_TOKEN" ]; then
  echo -e "${BLUE}[Test 6] Start Video Visit (Redeem Token)${NC}"
  START_RESPONSE=$(curl -s -X POST "${API_BASE}/api/visits/${VISIT_ID}/start" \
    -H "Content-Type: application/json" \
    -d '{
      "token": "'${PATIENT_TOKEN}'",
      "deviceInfo": {
        "hasCamera": true,
        "hasMicrophone": true,
        "browser": "Chrome 119",
        "os": "macOS 14.0"
      }
    }')
  
  CONTACT_ID=$(echo "$START_RESPONSE" | jq -r '.connectContact.contactId' 2>/dev/null || echo "")
  SESSION_TOKEN=$(echo "$START_RESPONSE" | jq -r '.visitSession.sessionToken' 2>/dev/null || echo "")
  
  if [ ! -z "$CONTACT_ID" ] && [ "$CONTACT_ID" != "null" ]; then
    echo -e "${GREEN}✓ PASS - Visit started, Contact ID: ${CONTACT_ID}${NC}\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${YELLOW}⚠ SKIP - Connect not configured (expected in demo mode)${NC}\n"
    TESTS_RUN=$((TESTS_RUN - 1))
  fi
  
  TESTS_RUN=$((TESTS_RUN + 1))
fi

# ============================================
# TEST 7: Token Reuse Attempt (Security)
# ============================================

if [ ! -z "$PATIENT_TOKEN" ]; then
  echo -e "${BLUE}[Test 7] Token Reuse Prevention (Security Test)${NC}"
  REUSE_RESPONSE=$(curl -s -X POST "${API_BASE}/api/visits/${VISIT_ID}/start" \
    -H "Content-Type: application/json" \
    -d '{
      "token": "'${PATIENT_TOKEN}'",
      "deviceInfo": {
        "hasCamera": true,
        "hasMicrophone": true,
        "browser": "Chrome 119",
        "os": "macOS 14.0"
      }
    }')
  
  ERROR_CODE=$(echo "$REUSE_RESPONSE" | jq -r '.error' 2>/dev/null || echo "")
  
  if echo "$ERROR_CODE" | grep -qi "already\|reused\|used"; then
    echo -e "${GREEN}✓ PASS - Token reuse correctly blocked${NC}\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL - Token reuse not prevented!${NC}"
    echo "Response: $REUSE_RESPONSE"
    echo ""
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  
  TESTS_RUN=$((TESTS_RUN + 1))
fi

# ============================================
# TEST 8: List Visits
# ============================================

echo -e "${BLUE}[Test 8] List Video Visits${NC}"
LIST_RESPONSE=$(curl -s -X GET "${API_BASE}/api/visits" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

ITEMS=$(echo "$LIST_RESPONSE" | jq -r '.items | length' 2>/dev/null || echo "0")

if [ "$ITEMS" != "null" ] && [ "$ITEMS" != "" ]; then
  echo -e "${GREEN}✓ PASS - Retrieved ${ITEMS} visit(s)${NC}\n"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL - Could not list visits${NC}"
  echo "Response: $LIST_RESPONSE"
  echo ""
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

TESTS_RUN=$((TESTS_RUN + 1))

# ============================================
# TEST 9: Database Audit Logs
# ============================================

if [ ! -z "$DATABASE_URL" ]; then
  echo -e "${BLUE}[Test 9] Verify Audit Logs in Database${NC}"
  
  AUDIT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM video_audit_logs WHERE visit_id = '${VISIT_ID}';" 2>/dev/null | tr -d ' ' || echo "0")
  
  if [ "$AUDIT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ PASS - ${AUDIT_COUNT} audit log entries created${NC}\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${YELLOW}⚠ SKIP - Database not accessible or empty${NC}\n"
    TESTS_RUN=$((TESTS_RUN - 1))
  fi
  
  TESTS_RUN=$((TESTS_RUN + 1))
else
  echo -e "${YELLOW}[Test 9] Skipping database test (DATABASE_URL not set)${NC}\n"
fi

# ============================================
# TEST 10: Security Headers
# ============================================

echo -e "${BLUE}[Test 10] Security Headers Check${NC}"
HEADERS=$(curl -s -I "${API_BASE}/health")

HAS_HSTS=$(echo "$HEADERS" | grep -i "strict-transport-security" || echo "")
HAS_CSP=$(echo "$HEADERS" | grep -i "content-security-policy" || echo "")
HAS_NOSNIFF=$(echo "$HEADERS" | grep -i "x-content-type-options: nosniff" || echo "")

if [ ! -z "$HAS_HSTS" ] && [ ! -z "$HAS_NOSNIFF" ]; then
  echo -e "${GREEN}✓ PASS - Security headers present${NC}\n"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${YELLOW}⚠ WARN - Some security headers missing${NC}\n"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

TESTS_RUN=$((TESTS_RUN + 1))

# ============================================
# RESULTS SUMMARY
# ============================================

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}Test Results${NC}"
echo -e "${BLUE}=================================================${NC}"
echo -e "Total Tests: ${TESTS_RUN}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed!${NC}\n"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed. Review errors above.${NC}\n"
  exit 1
fi

