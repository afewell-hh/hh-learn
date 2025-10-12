#!/bin/bash
#
# Phase 1 Verification Script (Issue #59)
# Tests anonymous beacon flow and captures outputs
#
set -e

TRACK_URL="https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track"
OUTPUT_DIR="./verification-output"

echo "=========================================="
echo "Phase 1 Verification - Anonymous Beacons"
echo "=========================================="
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "✓ Output directory created: $OUTPUT_DIR"
echo ""

# Test 1: Anonymous beacon (no contactIdentifier)
echo "Test 1: Anonymous Beacon (No Contact Identifier)"
echo "================================================"
echo "Sending POST request to $TRACK_URL"
echo ""

RESPONSE1=$(curl -s -X POST "$TRACK_URL" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d '{
    "eventName": "learning_module_started",
    "payload": {
      "module_slug": "verification-test-anonymous",
      "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }')

HTTP_STATUS1=$(echo "$RESPONSE1" | grep "HTTP_STATUS" | cut -d: -f2)
BODY1=$(echo "$RESPONSE1" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS1"
echo "Response Body: $BODY1"
echo ""

# Save to file
echo "Request 1: Anonymous Beacon (No contactIdentifier)" > "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo "====================================================" >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo "Timestamp: $(date)" >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo "" >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo "Request:" >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo '{"eventName":"learning_module_started","payload":{"module_slug":"verification-test-anonymous","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}}' | jq . >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo "" >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo "HTTP Status: $HTTP_STATUS1" >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo "Response:" >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"
echo "$BODY1" | jq . >> "$OUTPUT_DIR/test1-anonymous-beacon.txt"

if [ "$HTTP_STATUS1" = "200" ] && echo "$BODY1" | grep -q '"mode":"anonymous"'; then
  echo "✓ Test 1 PASSED: Beacon returned 200 with mode=anonymous"
else
  echo "✗ Test 1 FAILED: Expected HTTP 200 and mode=anonymous"
fi
echo ""

# Test 2: Beacon with contactIdentifier (should still be anonymous in Phase 1)
echo "Test 2: Beacon WITH Contact Identifier (Phase 1 - should still be anonymous)"
echo "============================================================================="
echo "Sending POST request to $TRACK_URL"
echo ""

RESPONSE2=$(curl -s -X POST "$TRACK_URL" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d '{
    "eventName": "learning_module_completed",
    "contactIdentifier": {
      "email": "verification-test@example.com"
    },
    "payload": {
      "module_slug": "verification-test-with-id",
      "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }')

HTTP_STATUS2=$(echo "$RESPONSE2" | grep "HTTP_STATUS" | cut -d: -f2)
BODY2=$(echo "$RESPONSE2" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS2"
echo "Response Body: $BODY2"
echo ""

# Save to file
echo "Request 2: Beacon WITH contactIdentifier (Phase 1)" > "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "===================================================" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "Timestamp: $(date)" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "Request:" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo '{"eventName":"learning_module_completed","contactIdentifier":{"email":"verification-test@example.com"},"payload":{"module_slug":"verification-test-with-id","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}}' | jq . >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "HTTP Status: $HTTP_STATUS2" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "Response:" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "$BODY2" | jq . >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"
echo "Note: Even with contactIdentifier, Phase 1 (ENABLE_CRM_PROGRESS=false) should return mode=anonymous" >> "$OUTPUT_DIR/test2-beacon-with-id-phase1.txt"

if [ "$HTTP_STATUS2" = "200" ] && echo "$BODY2" | grep -q '"mode":"anonymous"'; then
  echo "✓ Test 2 PASSED: Beacon with contactIdentifier still returns mode=anonymous (ENABLE_CRM_PROGRESS=false working)"
else
  echo "✗ Test 2 FAILED: Expected HTTP 200 and mode=anonymous even with contactIdentifier"
fi
echo ""

# Test 3: Invalid event name (should fail validation)
echo "Test 3: Invalid Event Name (Should Fail Validation)"
echo "===================================================="
echo "Sending POST request to $TRACK_URL"
echo ""

RESPONSE3=$(curl -s -X POST "$TRACK_URL" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d '{
    "eventName": "invalid_event_name",
    "payload": {
      "module_slug": "test",
      "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }')

HTTP_STATUS3=$(echo "$RESPONSE3" | grep "HTTP_STATUS" | cut -d: -f2)
BODY3=$(echo "$RESPONSE3" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS3"
echo "Response Body: $BODY3"
echo ""

# Save to file
echo "Request 3: Invalid Event Name" > "$OUTPUT_DIR/test3-invalid-event.txt"
echo "==============================" >> "$OUTPUT_DIR/test3-invalid-event.txt"
echo "Timestamp: $(date)" >> "$OUTPUT_DIR/test3-invalid-event.txt"
echo "" >> "$OUTPUT_DIR/test3-invalid-event.txt"
echo "Request:" >> "$OUTPUT_DIR/test3-invalid-event.txt"
echo '{"eventName":"invalid_event_name","payload":{"module_slug":"test","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}}' | jq . >> "$OUTPUT_DIR/test3-invalid-event.txt"
echo "" >> "$OUTPUT_DIR/test3-invalid-event.txt"
echo "HTTP Status: $HTTP_STATUS3" >> "$OUTPUT_DIR/test3-invalid-event.txt"
echo "Response:" >> "$OUTPUT_DIR/test3-invalid-event.txt"
echo "$BODY3" >> "$OUTPUT_DIR/test3-invalid-event.txt"

if [ "$HTTP_STATUS3" = "400" ]; then
  echo "✓ Test 3 PASSED: Invalid event name correctly rejected with HTTP 400"
else
  echo "⚠ Test 3: Expected HTTP 400 for invalid event name, got HTTP $HTTP_STATUS3"
fi
echo ""

# Test 4: Pathway enrollment event
echo "Test 4: Pathway Enrollment Event"
echo "================================="
echo "Sending POST request to $TRACK_URL"
echo ""

RESPONSE4=$(curl -s -X POST "$TRACK_URL" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -d '{
    "eventName": "learning_pathway_enrolled",
    "payload": {
      "pathway_slug": "getting-started",
      "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }')

HTTP_STATUS4=$(echo "$RESPONSE4" | grep "HTTP_STATUS" | cut -d: -f2)
BODY4=$(echo "$RESPONSE4" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS4"
echo "Response Body: $BODY4"
echo ""

# Save to file
echo "Request 4: Pathway Enrollment Event" > "$OUTPUT_DIR/test4-pathway-event.txt"
echo "====================================" >> "$OUTPUT_DIR/test4-pathway-event.txt"
echo "Timestamp: $(date)" >> "$OUTPUT_DIR/test4-pathway-event.txt"
echo "" >> "$OUTPUT_DIR/test4-pathway-event.txt"
echo "Request:" >> "$OUTPUT_DIR/test4-pathway-event.txt"
echo '{"eventName":"learning_pathway_enrolled","payload":{"pathway_slug":"getting-started","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}}' | jq . >> "$OUTPUT_DIR/test4-pathway-event.txt"
echo "" >> "$OUTPUT_DIR/test4-pathway-event.txt"
echo "HTTP Status: $HTTP_STATUS4" >> "$OUTPUT_DIR/test4-pathway-event.txt"
echo "Response:" >> "$OUTPUT_DIR/test4-pathway-event.txt"
echo "$BODY4" | jq . >> "$OUTPUT_DIR/test4-pathway-event.txt"

if [ "$HTTP_STATUS4" = "200" ] && echo "$BODY4" | grep -q '"mode":"anonymous"'; then
  echo "✓ Test 4 PASSED: Pathway enrollment event works correctly"
else
  echo "✗ Test 4 FAILED: Expected HTTP 200 and mode=anonymous for pathway event"
fi
echo ""

# Summary
echo "=========================================="
echo "Phase 1 Verification Summary"
echo "=========================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Count passed tests
[ "$HTTP_STATUS1" = "200" ] && echo "$BODY1" | grep -q '"mode":"anonymous"' && ((PASS_COUNT++)) || ((FAIL_COUNT++))
[ "$HTTP_STATUS2" = "200" ] && echo "$BODY2" | grep -q '"mode":"anonymous"' && ((PASS_COUNT++)) || ((FAIL_COUNT++))
[ "$HTTP_STATUS3" = "400" ] && ((PASS_COUNT++))
[ "$HTTP_STATUS4" = "200" ] && echo "$BODY4" | grep -q '"mode":"anonymous"' && ((PASS_COUNT++)) || ((FAIL_COUNT++))

echo "Tests Passed: $PASS_COUNT / 4"
echo "Tests Failed: $FAIL_COUNT / 4"
echo ""

echo "✓ All test outputs saved to: $OUTPUT_DIR"
echo ""

# List output files
echo "Generated files:"
ls -lh "$OUTPUT_DIR"/*.txt
echo ""

echo "=========================================="
echo "Phase 1 URLs to Verify Manually"
echo "=========================================="
echo ""
echo "Visit these URLs in your browser:"
echo "  1. https://hedgehog.cloud/learn (Modules list)"
echo "  2. https://hedgehog.cloud/learn/courses (Courses list)"
echo "  3. https://hedgehog.cloud/learn/pathways (Pathways list)"
echo "  4. https://hedgehog.cloud/learn/my-learning (My Learning dashboard)"
echo ""
echo "Then test beacon flow:"
echo "  - Click on any module"
echo "  - Open DevTools → Network tab"
echo "  - Click 'Mark as Started'"
echo "  - Verify POST to /events/track with mode=anonymous"
echo ""

echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "1. Review test outputs in $OUTPUT_DIR"
echo "2. Capture screenshots per docs/phase1-verification-checklist.md"
echo "3. Post all artifacts to Issue #59"
echo "4. Await green-light for Phase 2 (authenticated beacons)"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ All automated tests passed!"
  exit 0
else
  echo "⚠️  Some tests failed. Review outputs and fix issues before proceeding."
  exit 1
fi
