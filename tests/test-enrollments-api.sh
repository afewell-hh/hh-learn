#!/bin/bash
# Integration test for /enrollments/list endpoint
# Tests both success and unauthorized flows

set -e

API_URL="${API_URL:-https://your-api-id.execute-api.us-west-2.amazonaws.com}"
TEST_EMAIL="${HUBSPOT_TEST_USERNAME:-test@hedgehog.cloud}"

echo "========================================="
echo "Integration Tests: /enrollments/list"
echo "========================================="
echo ""
echo "API_URL: $API_URL"
echo "TEST_EMAIL: $TEST_EMAIL"
echo ""

# Test 1: Request without email or contactId (should return 400)
echo "Test 1: Request without email or contactId (should return 400)"
echo "--------------------------------------"
HTTP_CODE=$(curl -s -o /tmp/test-enrollments-no-params.json -w "%{http_code}" \
  "${API_URL}/enrollments/list")

if [ "$HTTP_CODE" = "400" ]; then
  echo "✓ PASS: Got expected 400 Bad Request"
  cat /tmp/test-enrollments-no-params.json | jq '.'
else
  echo "✗ FAIL: Expected 400, got $HTTP_CODE"
  cat /tmp/test-enrollments-no-params.json | jq '.'
  exit 1
fi
echo ""

# Test 2: Request with valid email (should return 200 with enrollments)
echo "Test 2: Request with valid email (should return 200 with enrollments)"
echo "--------------------------------------"
HTTP_CODE=$(curl -s -o /tmp/test-enrollments-success.json -w "%{http_code}" \
  "${API_URL}/enrollments/list?email=${TEST_EMAIL}")

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ PASS: Got expected 200 OK"
  cat /tmp/test-enrollments-success.json | jq '.'

  # Verify structure
  MODE=$(cat /tmp/test-enrollments-success.json | jq -r '.mode')
  if [ "$MODE" = "authenticated" ]; then
    echo "✓ PASS: Response has mode=authenticated"
  else
    echo "✗ FAIL: Expected mode=authenticated, got $MODE"
    exit 1
  fi

  # Check enrollments structure exists
  HAS_ENROLLMENTS=$(cat /tmp/test-enrollments-success.json | jq 'has("enrollments")')
  if [ "$HAS_ENROLLMENTS" = "true" ]; then
    echo "✓ PASS: Response has enrollments object"

    # Check pathways and courses arrays exist
    HAS_PATHWAYS=$(cat /tmp/test-enrollments-success.json | jq '.enrollments | has("pathways")')
    HAS_COURSES=$(cat /tmp/test-enrollments-success.json | jq '.enrollments | has("courses")')

    if [ "$HAS_PATHWAYS" = "true" ] && [ "$HAS_COURSES" = "true" ]; then
      echo "✓ PASS: Enrollments has pathways and courses arrays"
    else
      echo "✗ FAIL: Missing pathways or courses in enrollments"
      exit 1
    fi
  else
    echo "✗ FAIL: Response missing enrollments object"
    exit 1
  fi
else
  echo "✗ FAIL: Expected 200, got $HTTP_CODE"
  cat /tmp/test-enrollments-success.json | jq '.'
  exit 1
fi
echo ""

# Test 3: Request with non-existent email (should return 404)
echo "Test 3: Request with non-existent email (should return 404)"
echo "--------------------------------------"
HTTP_CODE=$(curl -s -o /tmp/test-enrollments-not-found.json -w "%{http_code}" \
  "${API_URL}/enrollments/list?email=nonexistent-$(date +%s)@example.com")

if [ "$HTTP_CODE" = "404" ]; then
  echo "✓ PASS: Got expected 404 Not Found"
  cat /tmp/test-enrollments-not-found.json | jq '.'
else
  echo "✗ FAIL: Expected 404, got $HTTP_CODE"
  cat /tmp/test-enrollments-not-found.json | jq '.'
  exit 1
fi
echo ""

echo "========================================="
echo "All tests passed! ✓"
echo "========================================="
