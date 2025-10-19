#!/bin/bash
# Integration tests for payload validation in Lambda endpoints (Issue #214)
# Tests invalid payloads to ensure Lambda rejects them with HTTP 400 and descriptive errors

set -e

# Configuration
API_BASE="${API_BASE:-https://axo396gm7l.execute-api.us-west-2.amazonaws.com}"
TEST_EMAIL="test-validation@example.com"

echo "========================================="
echo "Testing Payload Validation (Issue #214)"
echo "========================================="
echo ""
echo "API Base: $API_BASE"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test endpoint
test_endpoint() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local payload="$4"
  local expected_status="$5"
  local should_contain="$6"

  echo "Test: $test_name"
  echo "-------------------------------------------"

  if [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -d "$payload" \
      "$API_BASE$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint")
  fi

  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)

  echo "HTTP Status: $http_code"
  echo "Response: $body"

  # Check HTTP status code
  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ HTTP status correct ($http_code)${NC}"
  else
    echo -e "${RED}✗ Expected $expected_status, got $http_code${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo ""
    return 1
  fi

  # Check response contains expected text
  if [ -n "$should_contain" ]; then
    if echo "$body" | grep -q "$should_contain"; then
      echo -e "${GREEN}✓ Response contains '$should_contain'${NC}"
      TESTS_PASSED=$((TESTS_PASSED + 1))
    else
      echo -e "${RED}✗ Response should contain '$should_contain'${NC}"
      TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
  else
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi

  echo ""
}

# Test 1: Valid track event payload
echo "=== Test Group 1: /events/track Endpoint ==="
echo ""

test_endpoint \
  "Valid module started event" \
  "POST" \
  "/events/track" \
  '{"eventName":"learning_module_started","contactIdentifier":{"email":"'$TEST_EMAIL'"},"payload":{"module_slug":"test-module","pathway_slug":"test-pathway"}}' \
  "200" \
  ""

# Test 2: Invalid event name
test_endpoint \
  "Invalid event name" \
  "POST" \
  "/events/track" \
  '{"eventName":"invalid_event","payload":{"module_slug":"test"}}' \
  "400" \
  "SCHEMA_VALIDATION_FAILED"

# Test 3: Invalid JSON
test_endpoint \
  "Malformed JSON" \
  "POST" \
  "/events/track" \
  '{invalid json}' \
  "400" \
  "INVALID_JSON"

# Test 4: Missing required field for module event
test_endpoint \
  "Module event missing module_slug" \
  "POST" \
  "/events/track" \
  '{"eventName":"learning_module_started","contactIdentifier":{"email":"'$TEST_EMAIL'"},"payload":{}}' \
  "400" \
  "details"

# Test 5: Invalid email format
test_endpoint \
  "Invalid email format" \
  "POST" \
  "/events/track" \
  '{"eventName":"learning_module_started","contactIdentifier":{"email":"not-an-email"},"payload":{"module_slug":"test","pathway_slug":"test"}}' \
  "400" \
  "details"

# Test 6: Pathway enrollment without pathway_slug
test_endpoint \
  "Pathway enrollment without slug" \
  "POST" \
  "/events/track" \
  '{"eventName":"learning_pathway_enrolled","contactIdentifier":{"email":"'$TEST_EMAIL'"}}' \
  "400" \
  "details"

# Test 7: Course enrollment without course_slug
test_endpoint \
  "Course enrollment without slug" \
  "POST" \
  "/events/track" \
  '{"eventName":"learning_course_enrolled","contactIdentifier":{"email":"'$TEST_EMAIL'"}}' \
  "400" \
  "details"

# Test 8: Page view without required fields
test_endpoint \
  "Page view without content_type/slug" \
  "POST" \
  "/events/track" \
  '{"eventName":"learning_page_viewed","contactIdentifier":{"email":"'$TEST_EMAIL'"},"payload":{}}' \
  "400" \
  "details"

# Test 9: Oversized payload
echo "Test: Oversized payload (>10KB)"
echo "-------------------------------------------"
large_payload='{"eventName":"learning_module_started","payload":{"module_slug":"test","pathway_slug":"test","data":"'
large_payload+=$(python3 -c "print('x' * 11000)")
large_payload+='"}}'

response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$large_payload" \
  "$API_BASE/events/track")

http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

echo "HTTP Status: $http_code"
echo "Response: ${body:0:200}..." # Truncate for readability

if [ "$http_code" = "400" ]; then
  echo -e "${GREEN}✓ HTTP status correct (400)${NC}"
  if echo "$body" | grep -q "PAYLOAD_TOO_LARGE"; then
    echo -e "${GREEN}✓ Response contains PAYLOAD_TOO_LARGE${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${YELLOW}⚠ Response should contain PAYLOAD_TOO_LARGE${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
else
  echo -e "${RED}✗ Expected 400, got $http_code${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test Group 2: /quiz/grade endpoint
echo "=== Test Group 2: /quiz/grade Endpoint ==="
echo ""

test_endpoint \
  "Valid quiz grade" \
  "POST" \
  "/quiz/grade" \
  '{"module_slug":"test-module","answers":[{"id":"q1","value":"answer1"}]}' \
  "200" \
  ""

test_endpoint \
  "Quiz grade missing module_slug" \
  "POST" \
  "/quiz/grade" \
  '{"answers":[{"id":"q1","value":"answer1"}]}' \
  "400" \
  "details"

test_endpoint \
  "Quiz grade with empty module_slug" \
  "POST" \
  "/quiz/grade" \
  '{"module_slug":"","answers":[{"id":"q1","value":"answer1"}]}' \
  "400" \
  "details"

test_endpoint \
  "Quiz grade missing answers" \
  "POST" \
  "/quiz/grade" \
  '{"module_slug":"test-module"}' \
  "400" \
  "details"

# Test Group 3: /progress/aggregate endpoint
echo "=== Test Group 3: /progress/aggregate Endpoint ==="
echo ""

test_endpoint \
  "Aggregate progress missing type" \
  "GET" \
  "/progress/aggregate?email=$TEST_EMAIL&slug=test-pathway" \
  "" \
  "400" \
  "details"

test_endpoint \
  "Aggregate progress missing slug" \
  "GET" \
  "/progress/aggregate?email=$TEST_EMAIL&type=pathway" \
  "" \
  "400" \
  "details"

test_endpoint \
  "Aggregate progress invalid type" \
  "GET" \
  "/progress/aggregate?email=$TEST_EMAIL&type=invalid&slug=test" \
  "" \
  "400" \
  "details"

test_endpoint \
  "Aggregate progress invalid email" \
  "GET" \
  "/progress/aggregate?email=not-an-email&type=pathway&slug=test" \
  "" \
  "400" \
  "details"

# Test Group 4: /enrollments/list endpoint
echo "=== Test Group 4: /enrollments/list Endpoint ==="
echo ""

test_endpoint \
  "Enrollments list missing identifier" \
  "GET" \
  "/enrollments/list" \
  "" \
  "400" \
  "details"

test_endpoint \
  "Enrollments list invalid email" \
  "GET" \
  "/enrollments/list?email=not-an-email" \
  "" \
  "400" \
  "details"

# Test Group 5: /progress/read endpoint
echo "=== Test Group 5: /progress/read Endpoint ==="
echo ""

test_endpoint \
  "Progress read with invalid email" \
  "GET" \
  "/progress/read?email=not-an-email" \
  "" \
  "400" \
  "details"

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All validation tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
