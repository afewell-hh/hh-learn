#!/bin/bash
# Issue #60 Verification Script
# Verifies OAuth-powered endpoints using HUBSPOT_PROJECT_ACCESS_TOKEN

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Issue #60 Verification Script"
echo "========================================="
echo ""

# Check environment variables
echo "Checking environment variables..."
if [ -z "$HUBSPOT_PROJECT_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ HUBSPOT_PROJECT_ACCESS_TOKEN not set${NC}"
    echo "Please set it first:"
    echo "  export HUBSPOT_PROJECT_ACCESS_TOKEN=\"<your-token>\""
    exit 1
fi
echo -e "${GREEN}✅ HUBSPOT_PROJECT_ACCESS_TOKEN is set${NC}"

if [ -z "$API_GATEWAY_URL" ]; then
    echo -e "${YELLOW}⚠️  API_GATEWAY_URL not set, using default${NC}"
    API_GATEWAY_URL="https://axo396gm7l.execute-api.us-west-2.amazonaws.com"
fi
echo -e "${GREEN}✅ API_GATEWAY_URL: $API_GATEWAY_URL${NC}"

if [ -z "$TEST_EMAIL" ]; then
    echo -e "${YELLOW}⚠️  TEST_EMAIL not set, using default${NC}"
    TEST_EMAIL="test@hedgehog.cloud"
fi
echo -e "${GREEN}✅ TEST_EMAIL: $TEST_EMAIL${NC}"
echo ""

# Create output directory
OUTPUT_DIR="/tmp/issue-60-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Step 1: Get BEFORE state of contact properties
echo "========================================="
echo "Step 1: Get BEFORE state"
echo "========================================="
curl -s -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/${TEST_EMAIL}?idProperty=email&properties=hhl_progress_state,hhl_progress_updated_at,hhl_progress_summary" \
  | jq '{
      id: .id,
      email: .properties.email,
      hhl_progress_state: .properties.hhl_progress_state,
      hhl_progress_updated_at: .properties.hhl_progress_updated_at,
      hhl_progress_summary: .properties.hhl_progress_summary
    }' | tee "$OUTPUT_DIR/contact-before.json"

echo ""
echo -e "${GREEN}✅ BEFORE state saved to $OUTPUT_DIR/contact-before.json${NC}"
echo ""

# Step 2: Test POST /events/track
echo "========================================="
echo "Step 2: Test POST /events/track"
echo "========================================="
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -X POST "${API_GATEWAY_URL}/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "contactIdentifier": {
      "email": "'"${TEST_EMAIL}"'"
    },
    "payload": {
      "module_slug": "test-module-oauth-'"$(date +%s)"'",
      "pathway_slug": "test-pathway-oauth",
      "ts": "'"${TIMESTAMP}"'"
    }
  }' | jq | tee "$OUTPUT_DIR/post-events-track.json"

echo ""
echo -e "${GREEN}✅ POST /events/track response saved to $OUTPUT_DIR/post-events-track.json${NC}"
echo ""

# Step 3: Wait for Lambda to process
echo "Waiting 10 seconds for Lambda to process..."
sleep 10
echo ""

# Step 4: Test GET /progress/read
echo "========================================="
echo "Step 3: Test GET /progress/read"
echo "========================================="
curl -X GET "${API_GATEWAY_URL}/progress/read?email=${TEST_EMAIL}" \
  -H "Content-Type: application/json" | jq | tee "$OUTPUT_DIR/get-progress-read.json"

echo ""
echo -e "${GREEN}✅ GET /progress/read response saved to $OUTPUT_DIR/get-progress-read.json${NC}"
echo ""

# Step 5: Get AFTER state of contact properties
echo "========================================="
echo "Step 4: Get AFTER state"
echo "========================================="
curl -s -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/${TEST_EMAIL}?idProperty=email&properties=hhl_progress_state,hhl_progress_updated_at,hhl_progress_summary" \
  | jq '{
      id: .id,
      email: .properties.email,
      hhl_progress_state: .properties.hhl_progress_state,
      hhl_progress_updated_at: .properties.hhl_progress_updated_at,
      hhl_progress_summary: .properties.hhl_progress_summary
    }' | tee "$OUTPUT_DIR/contact-after.json"

echo ""
echo -e "${GREEN}✅ AFTER state saved to $OUTPUT_DIR/contact-after.json${NC}"
echo ""

# Step 6: Show diff
echo "========================================="
echo "Step 5: Show BEFORE vs AFTER diff"
echo "========================================="
echo "=== BEFORE ==="
cat "$OUTPUT_DIR/contact-before.json"
echo ""
echo "=== AFTER ==="
cat "$OUTPUT_DIR/contact-after.json"
echo ""
echo "=== DIFF ==="
diff -u "$OUTPUT_DIR/contact-before.json" "$OUTPUT_DIR/contact-after.json" > "$OUTPUT_DIR/contact-diff.txt" || true
cat "$OUTPUT_DIR/contact-diff.txt"
echo ""

# Step 7: Summary
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo "All artifacts saved to: $OUTPUT_DIR"
echo ""
echo "Files:"
ls -lh "$OUTPUT_DIR"
echo ""
echo -e "${GREEN}✅ Verification complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Review artifacts in $OUTPUT_DIR"
echo "2. Redact PII (email addresses) if sharing publicly"
echo "3. Post to Issue #60: https://github.com/afewell-hh/hh-learn/issues/60"
