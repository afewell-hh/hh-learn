#!/bin/bash
# Test script to demonstrate orphan detection
# This creates a temporary course with invalid references to show error handling

set -e

echo "📝 Creating temporary test course with orphaned reference..."

# Create test course with invalid module reference
cat > content/courses/test-orphan-detection.json <<'EOF'
{
  "slug": "test-orphan-detection",
  "title": "Test Course with Orphaned References",
  "summary_markdown": "This is a test course to demonstrate orphan detection",
  "modules": [
    "authoring-basics",
    "non-existent-module",
    "another-missing-module"
  ],
  "content_blocks": [
    {
      "id": "test",
      "type": "module_ref",
      "module_slug": "invalid-content-block-ref"
    }
  ]
}
EOF

echo "✅ Test course created"
echo ""
echo "🔍 Running validation (should fail with clear error messages)..."
echo ""

# Run sync with dry-run - this should fail
npm run build > /dev/null 2>&1
node dist/src/sync/courses-to-hubdb.js --dry-run 2>&1 | grep -A 20 "VALIDATION FAILED" || echo "Validation passed (unexpected!)"

echo ""
echo "🧹 Cleaning up test file..."
rm -f content/courses/test-orphan-detection.json

echo "✅ Test complete!"
