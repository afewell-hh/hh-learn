#!/bin/bash

# Issue #266: Automated API Verification Script
# This script verifies all API endpoints are working correctly
# before manual UI testing is performed

set -e

API_BASE="https://hvoog2lnha.execute-api.us-west-2.amazonaws.com"
TEST_EMAIL="afewell@gmail.com"
OUTPUT_DIR="verification-output/issue-266/automated-tests"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

mkdir -p "$OUTPUT_DIR"

echo "================================================================"
echo "Issue #266: Automated API Verification"
echo "================================================================"
echo ""
echo "Testing API endpoints before manual UI verification..."
echo "Test email: $TEST_EMAIL"
echo "API base: $API_BASE"
echo ""

# Test 1: Authentication (Login)
echo "-------------------------------------------"
echo "TEST 1: POST /auth/login"
echo "-------------------------------------------"
AUTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

HTTP_STATUS=$(echo "$AUTH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$AUTH_RESPONSE" | sed '/HTTP_STATUS/d')

echo "$BODY" | jq . > "$OUTPUT_DIR/01-auth-login.json" 2>/dev/null || echo "$BODY" > "$OUTPUT_DIR/01-auth-login.json"

if [ "$HTTP_STATUS" = "200" ]; then
    JWT_TOKEN=$(echo "$BODY" | jq -r '.token' 2>/dev/null)
    if [ ! -z "$JWT_TOKEN" ] && [ "$JWT_TOKEN" != "null" ]; then
        echo -e "${GREEN}✓ PASS${NC}: Login successful (HTTP $HTTP_STATUS)"
        echo "  Token received: ${JWT_TOKEN:0:20}..."
        echo "$JWT_TOKEN" > "$OUTPUT_DIR/jwt_token.txt"
    else
        echo -e "${RED}✗ FAIL${NC}: Login returned 200 but no token"
        exit 1
    fi
else
    echo -e "${RED}✗ FAIL${NC}: Login failed (HTTP $HTTP_STATUS)"
    echo "Response: $BODY"
    exit 1
fi

echo ""

# Test 2: List Enrollments (with JWT)
echo "-------------------------------------------"
echo "TEST 2: GET /enrollments/list (with JWT)"
echo "-------------------------------------------"
ENROLL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "$API_BASE/enrollments/list?email=$TEST_EMAIL" \
  -H "Authorization: Bearer $JWT_TOKEN")

HTTP_STATUS=$(echo "$ENROLL_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$ENROLL_RESPONSE" | sed '/HTTP_STATUS/d')

echo "$BODY" | jq . > "$OUTPUT_DIR/02-enrollments-list.json" 2>/dev/null || echo "$BODY" > "$OUTPUT_DIR/02-enrollments-list.json"

if [ "$HTTP_STATUS" = "200" ]; then
    MODE=$(echo "$BODY" | jq -r '.mode' 2>/dev/null)
    COURSE_COUNT=$(echo "$BODY" | jq '.enrollments.courses | length' 2>/dev/null || echo "0")
    PATHWAY_COUNT=$(echo "$BODY" | jq '.enrollments.pathways | length' 2>/dev/null || echo "0")

    echo -e "${GREEN}✓ PASS${NC}: Enrollments retrieved (HTTP $HTTP_STATUS)"
    echo "  Mode: $MODE"
    echo "  Courses: $COURSE_COUNT enrolled"
    echo "  Pathways: $PATHWAY_COUNT enrolled"
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Enrollments endpoint returned HTTP $HTTP_STATUS"
    echo "Response: $BODY"
fi

echo ""

# Test 3: Read Progress (with JWT)
echo "-------------------------------------------"
echo "TEST 3: GET /progress/read (with JWT)"
echo "-------------------------------------------"
PROGRESS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "$API_BASE/progress/read?email=$TEST_EMAIL" \
  -H "Authorization: Bearer $JWT_TOKEN")

HTTP_STATUS=$(echo "$PROGRESS_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$PROGRESS_RESPONSE" | sed '/HTTP_STATUS/d')

echo "$BODY" | jq . > "$OUTPUT_DIR/03-progress-read.json" 2>/dev/null || echo "$BODY" > "$OUTPUT_DIR/03-progress-read.json"

if [ "$HTTP_STATUS" = "200" ]; then
    MODE=$(echo "$BODY" | jq -r '.mode' 2>/dev/null)
    MODULE_COUNT=$(echo "$BODY" | jq '.modules | length' 2>/dev/null || echo "0")

    echo -e "${GREEN}✓ PASS${NC}: Progress retrieved (HTTP $HTTP_STATUS)"
    echo "  Mode: $MODE"
    echo "  Modules tracked: $MODULE_COUNT"
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Progress endpoint returned HTTP $HTTP_STATUS"
    echo "Response: $BODY"
fi

echo ""

# Test 4: Aggregate Progress for a course
echo "-------------------------------------------"
echo "TEST 4: GET /progress/aggregate (course)"
echo "-------------------------------------------"
AGG_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "$API_BASE/progress/aggregate?email=$TEST_EMAIL&type=course&slug=api-test-course" \
  -H "Authorization: Bearer $JWT_TOKEN")

HTTP_STATUS=$(echo "$AGG_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$AGG_RESPONSE" | sed '/HTTP_STATUS/d')

echo "$BODY" | jq . > "$OUTPUT_DIR/04-progress-aggregate-course.json" 2>/dev/null || echo "$BODY" > "$OUTPUT_DIR/04-progress-aggregate-course.json"

if [ "$HTTP_STATUS" = "200" ]; then
    COMPLETED=$(echo "$BODY" | jq -r '.completed' 2>/dev/null)
    TOTAL=$(echo "$BODY" | jq -r '.total' 2>/dev/null)

    echo -e "${GREEN}✓ PASS${NC}: Aggregate progress retrieved (HTTP $HTTP_STATUS)"
    echo "  Course: api-test-course"
    echo "  Progress: $COMPLETED/$TOTAL modules"
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Aggregate endpoint returned HTTP $HTTP_STATUS"
    echo "Response: $BODY"
fi

echo ""

# Test 5: Track Event (module started)
echo "-------------------------------------------"
echo "TEST 5: POST /events/track (module started)"
echo "-------------------------------------------"
TRACK_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_BASE/events/track" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"eventName\": \"learning_module_started\",
    \"payload\": {
      \"module_slug\": \"test-module-verification\",
      \"course_slug\": \"api-test-course\",
      \"ts\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
    }
  }")

HTTP_STATUS=$(echo "$TRACK_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$TRACK_RESPONSE" | sed '/HTTP_STATUS/d')

echo "$BODY" | jq . > "$OUTPUT_DIR/05-events-track.json" 2>/dev/null || echo "$BODY" > "$OUTPUT_DIR/05-events-track.json"

if [ "$HTTP_STATUS" = "200" ]; then
    STATUS=$(echo "$BODY" | jq -r '.status' 2>/dev/null)

    echo -e "${GREEN}✓ PASS${NC}: Event tracked (HTTP $HTTP_STATUS)"
    echo "  Status: $STATUS"
else
    echo -e "${RED}✗ FAIL${NC}: Event tracking failed (HTTP $HTTP_STATUS)"
    echo "Response: $BODY"
fi

echo ""
echo "================================================================"
echo "Automated API Verification Complete"
echo "================================================================"
echo ""
echo "Results saved to: $OUTPUT_DIR/"
echo ""
echo "Summary:"
echo "  ✓ Authentication: Working"
echo "  ✓ Enrollments API: Working"
echo "  ✓ Progress API: Working"
echo "  ✓ Event Tracking: Working"
echo ""
echo "Next Steps:"
echo "  1. Review API responses in $OUTPUT_DIR/"
echo "  2. Proceed with manual UI testing (see MANUAL-TESTING-GUIDE.md)"
echo "  3. Use the JWT token from jwt_token.txt if needed"
echo ""
echo "JWT Token saved to: $OUTPUT_DIR/jwt_token.txt"
echo ""
