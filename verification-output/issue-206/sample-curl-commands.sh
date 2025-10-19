#!/bin/bash
# Sample curl commands for testing Issue #206 implementation
# These commands demonstrate the new enrollment tracking functionality

# Configuration
API_URL="${API_URL:-https://your-api-id.execute-api.us-west-2.amazonaws.com}"
TEST_EMAIL="${HUBSPOT_TEST_USERNAME:-test@hedgehog.cloud}"

echo "========================================="
echo "Issue #206: Enrollment Tracking Demo"
echo "========================================="
echo ""
echo "API_URL: $API_URL"
echo "TEST_EMAIL: $TEST_EMAIL"
echo ""

# 1. Get initial enrollment state
echo "1. Get initial enrollment state"
echo "========================================="
curl -s "${API_URL}/enrollments/list?email=${TEST_EMAIL}" | jq '.' | tee enrollment-before.json
echo ""
echo ""

# 2. Enroll in pathway from pathway page
echo "2. Enroll in pathway from pathway page (enrollment_source: pathway_page)"
echo "========================================="
curl -s -X POST "${API_URL}/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_pathway_enrolled",
    "contactIdentifier": {
      "email": "'${TEST_EMAIL}'"
    },
    "enrollment_source": "pathway_page",
    "pathway_slug": "test-pathway-demo",
    "payload": {
      "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }' | jq '.' | tee track-pathway-response.json
echo ""
echo ""

# Wait for persistence
echo "Waiting 2 seconds for CRM persistence..."
sleep 2
echo ""

# 3. Enroll in course from catalog
echo "3. Enroll in course from catalog (enrollment_source: catalog)"
echo "========================================="
curl -s -X POST "${API_URL}/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_course_enrolled",
    "contactIdentifier": {
      "email": "'${TEST_EMAIL}'"
    },
    "enrollment_source": "catalog",
    "course_slug": "test-course-demo",
    "payload": {
      "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }' | jq '.' | tee track-course-response.json
echo ""
echo ""

# Wait for persistence
echo "Waiting 2 seconds for CRM persistence..."
sleep 2
echo ""

# 4. Get updated enrollment state
echo "4. Get updated enrollment state (should show both enrollments)"
echo "========================================="
curl -s "${API_URL}/enrollments/list?email=${TEST_EMAIL}" | jq '.' | tee enrollment-after.json
echo ""
echo ""

# 5. Verify enrollment_source is persisted
echo "5. Verify enrollment_source field in response"
echo "========================================="
echo "Pathway enrollment source:"
cat enrollment-after.json | jq '.enrollments.pathways[] | select(.slug == "test-pathway-demo") | .enrollment_source'
echo ""
echo "Course enrollment source:"
cat enrollment-after.json | jq '.enrollments.courses[] | select(.slug == "test-course-demo") | .enrollment_source'
echo ""
echo ""

# 6. Test error cases
echo "6. Test error cases"
echo "========================================="
echo ""

echo "6a. Missing email/contactId (should return 400):"
curl -s "${API_URL}/enrollments/list" | jq '.'
echo ""
echo ""

echo "6b. Non-existent email (should return 404):"
curl -s "${API_URL}/enrollments/list?email=nonexistent-$(date +%s)@example.com" | jq '.'
echo ""
echo ""

# 7. Test backward compatibility (fields in payload)
echo "7. Test backward compatibility (enrollment_source in payload)"
echo "========================================="
curl -s -X POST "${API_URL}/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_pathway_enrolled",
    "contactIdentifier": {
      "email": "'${TEST_EMAIL}'"
    },
    "payload": {
      "pathway_slug": "test-backward-compat",
      "enrollment_source": "course_page",
      "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }' | jq '.' | tee track-backward-compat-response.json
echo ""
echo ""

echo "Waiting 2 seconds for CRM persistence..."
sleep 2
echo ""

echo "Verify backward compatibility enrollment:"
curl -s "${API_URL}/enrollments/list?email=${TEST_EMAIL}" | \
  jq '.enrollments.pathways[] | select(.slug == "test-backward-compat")' | \
  tee backward-compat-enrollment.json
echo ""
echo ""

echo "========================================="
echo "Demo complete!"
echo "========================================="
echo ""
echo "Files created:"
echo "  - enrollment-before.json"
echo "  - track-pathway-response.json"
echo "  - track-course-response.json"
echo "  - enrollment-after.json"
echo "  - track-backward-compat-response.json"
echo "  - backward-compat-enrollment.json"
