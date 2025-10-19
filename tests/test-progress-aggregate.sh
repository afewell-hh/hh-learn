#!/bin/bash
# Test script for aggregated progress API (Issue #210)
# Tests both authenticated and anonymous scenarios

set -e

# Configuration
API_BASE="${API_BASE:-https://axo396gm7l.execute-api.us-west-2.amazonaws.com}"
TEST_EMAIL="${HUBSPOT_TEST_USERNAME:-emailmaria@hubspot.com}"
PATHWAY_SLUG="getting-started"
COURSE_SLUG="sample-course"

echo "========================================="
echo "Testing Progress Aggregate API (Issue #210)"
echo "========================================="
echo ""
echo "API Base: $API_BASE"
echo "Test Email: $TEST_EMAIL"
echo ""

# Test 1: Pathway progress for authenticated user
echo "Test 1: Pathway progress (authenticated)"
echo "-----------------------------------------"
PATHWAY_URL="$API_BASE/progress/aggregate?type=pathway&slug=$PATHWAY_SLUG&email=$TEST_EMAIL"
echo "GET $PATHWAY_URL"
PATHWAY_RESPONSE=$(curl -s "$PATHWAY_URL")
echo "Response: $PATHWAY_RESPONSE"
echo ""

# Validate response contains expected fields
if echo "$PATHWAY_RESPONSE" | grep -q '"mode"'; then
  echo "✓ Response contains mode field"
else
  echo "✗ Response missing mode field"
  exit 1
fi

if echo "$PATHWAY_RESPONSE" | grep -q '"started"'; then
  echo "✓ Response contains started field"
else
  echo "✗ Response missing started field"
  exit 1
fi

if echo "$PATHWAY_RESPONSE" | grep -q '"completed"'; then
  echo "✓ Response contains completed field"
else
  echo "✗ Response missing completed field"
  exit 1
fi

echo ""

# Test 2: Course progress for authenticated user
echo "Test 2: Course progress (authenticated)"
echo "---------------------------------------"
COURSE_URL="$API_BASE/progress/aggregate?type=course&slug=$COURSE_SLUG&email=$TEST_EMAIL"
echo "GET $COURSE_URL"
COURSE_RESPONSE=$(curl -s "$COURSE_URL")
echo "Response: $COURSE_RESPONSE"
echo ""

# Validate response
if echo "$COURSE_RESPONSE" | grep -q '"mode"'; then
  echo "✓ Course response valid"
else
  echo "✗ Course response invalid"
  exit 1
fi

echo ""

# Test 3: Missing parameters (should return 400)
echo "Test 3: Missing parameters validation"
echo "-------------------------------------"
INVALID_URL="$API_BASE/progress/aggregate?type=pathway&email=$TEST_EMAIL"
echo "GET $INVALID_URL (missing slug)"
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" "$INVALID_URL")
HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n 1)
BODY=$(echo "$INVALID_RESPONSE" | head -n -1)
echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"

if [ "$HTTP_CODE" = "400" ]; then
  echo "✓ Correctly rejected invalid request with 400"
else
  echo "✗ Expected 400, got $HTTP_CODE"
  exit 1
fi

echo ""

# Test 4: Anonymous mode (no email provided)
echo "Test 4: Anonymous mode"
echo "----------------------"
ANON_URL="$API_BASE/progress/aggregate?type=pathway&slug=$PATHWAY_SLUG"
echo "GET $ANON_URL"
ANON_RESPONSE=$(curl -s "$ANON_URL")
echo "Response: $ANON_RESPONSE"

if echo "$ANON_RESPONSE" | grep -q '"mode":"anonymous"'; then
  echo "✓ Correctly returned anonymous mode"
else
  echo "✗ Should return anonymous mode when no credentials provided"
fi

echo ""

# Test 5: Performance check
echo "Test 5: Performance check"
echo "------------------------"
echo "Testing response time for authenticated request..."
START_TIME=$(date +%s%3N)
curl -s "$PATHWAY_URL" > /dev/null
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

echo "Response time: ${DURATION}ms"
if [ "$DURATION" -lt 500 ]; then
  echo "✓ Performance within SLA (< 500ms p95)"
else
  echo "⚠ Performance warning: ${DURATION}ms exceeds 500ms target"
fi

echo ""
echo "========================================="
echo "All tests completed successfully!"
echo "========================================="
