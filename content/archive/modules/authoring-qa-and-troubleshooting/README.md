---
title: "QA & Troubleshooting: Sync, Beacons, and Verification"
slug: "authoring-qa-and-troubleshooting"
difficulty: "intermediate"
estimated_minutes: 35
version: "v0.2"
validated_on: "2025-10-14"
tags:
  - content-authoring
  - qa
  - troubleshooting
  - debugging
  - testing
  - content-sync
description: "Master quality assurance techniques for learning content, including sync troubleshooting, debug beacons, verification workflows, and common issue resolution."
order: 200
---

# QA & Troubleshooting: Sync, Beacons, and Verification

Ensure your learning content publishes correctly and renders as expected. This module covers quality assurance workflows for content authors, including sync troubleshooting, using debug beacons to verify content, validation techniques, and resolving common issues that arise during the content lifecycle.

## Learning Objectives

- Troubleshoot HubDB sync failures and API errors
- Use debug beacons to verify content rendering
- Validate metadata and content completeness
- Identify and resolve common authoring issues
- Test content across different environments
- Apply systematic QA workflows before publishing
- Debug Cloudflare WAF blocks and content restrictions

## Prerequisites

- Completion of "Authoring Basics: Modules, Front Matter, and Sync" module
- Familiarity with the content sync workflow (`npm run sync:content`)
- Access to `.env` configuration with HubSpot tokens
- Basic understanding of HTTP status codes
- Command-line proficiency (grep, curl, etc.)

## Scenario: Publishing a Module with Confidence

You've authored a new module about Kubernetes troubleshooting and you're ready to publish. You'll run through a comprehensive QA workflow to catch issues before they reach learners, troubleshoot sync problems, verify rendering with debug mode, and confirm everything works correctly in production.

### Step 1: Pre-Sync Validation Checklist

Before syncing, validate your module locally to catch common issues:

```bash
# Navigate to your module directory
cd content/modules/kubernetes-troubleshooting

# Verify front matter is valid YAML
head -30 README.md
```

Run through this checklist:

```bash
# 1. Check slug matches directory name
echo "Directory: $(basename $(pwd))"
grep "^slug:" README.md

# 2. Verify description length (aim for 120-160 chars)
grep "^description:" README.md | wc -c

# 3. Check all code blocks have language hints (should return empty)
grep -n '^```$' README.md

# 4. Verify required front matter fields
grep -E "^(title|slug|difficulty|estimated_minutes|tags|description):" README.md

# 5. Look for common YAML errors
head -30 README.md | grep -E "(^[^#].*:.*:)|(^[^-#].*  -)"
```

**Pre-sync validation checklist:**
- ✅ Slug in front matter matches directory name exactly
- ✅ Description is 120-160 characters
- ✅ All code blocks specify language (```bash, ```yaml, etc.)
- ✅ Required fields present: title, slug, difficulty, estimated_minutes, tags, description
- ✅ YAML syntax correct (no unquoted colons, proper array formatting)
- ✅ No trailing spaces or tabs after front matter closing `---`
- ✅ Tags are an array, not comma-separated string
- ✅ Estimated minutes is a number, not a string

### Step 2: Check for Content Restrictions

Certain content patterns can trigger HubSpot's Cloudflare WAF (Web Application Firewall), causing sync failures:

```bash
# Check for potentially problematic patterns
cd /home/ubuntu/afewell-hh/hh-learn

# Look for raw Host: headers
grep -n "^Host:" content/modules/kubernetes-troubleshooting/README.md

# Look for wget commands (prefer curl)
grep -n "wget " content/modules/kubernetes-troubleshooting/README.md

# Look for raw IP addresses in headers
grep -n "X-Forwarded-For:" content/modules/kubernetes-troubleshooting/README.md
```

**Common WAF triggers to avoid:**
- Raw HTTP headers like `Host: example.com`
- `wget` commands (prefer `curl` instead)
- IP addresses in header examples
- Suspicious URL patterns
- Large blocks of base64-encoded data

**Safer alternatives:**
```bash
# ❌ Avoid
wget http://example.com/file.tar.gz
curl -H "Host: example.com" http://127.0.0.1

# ✅ Prefer
curl -o file.tar.gz https://example.com/file.tar.gz
curl --resolve example.com:80:127.0.0.1 http://example.com
```

### Step 3: Run the Content Sync

Execute the sync and capture output for analysis:

```bash
# Ensure you're in repository root
cd /home/ubuntu/afewell-hh/hh-learn

# Run sync and capture output
npm run sync:content 2>&1 | tee sync-output.log
```

**Expected success output:**
```
🔄 Starting content sync to HubDB...
✓ Updated: Kubernetes Troubleshooting
✅ Sync complete! Table published.
Summary: 1 succeeded, 0 failed
```

**Watch for these indicators:**

✅ **Success markers:**
- `✓ Updated:` followed by your module title
- `Summary: N succeeded, 0 failed`
- `Table published` confirmation

❌ **Failure markers:**
- `Error:` messages with stack traces
- `Cannot parse content`
- `Authentication credentials not found`
- `requiredGranularScopes`
- `Cloudflare block detected`

### Step 4: Troubleshoot Sync Failures

If sync fails, diagnose the issue systematically:

```bash
# Check the full error message
cat sync-output.log | grep -A 10 "Error:"

# Verify environment variables are set
grep -E "HUBSPOT_PRIVATE_APP_TOKEN|HUBDB_MODULES_TABLE_ID" .env

# Test HubSpot API connectivity
TOKEN=$(grep HUBSPOT_PRIVATE_APP_TOKEN .env | cut -d'=' -f2)
TABLE_ID=$(grep HUBDB_MODULES_TABLE_ID .env | cut -d'=' -f2)

curl -H "Authorization: Bearer $TOKEN" \
  "https://api.hubapi.com/cms/v3/hubdb/tables/${TABLE_ID}" \
  2>&1 | head -20
```

**Common sync errors and solutions:**

**Error: `Authentication credentials not found` (401)**
```bash
# Symptom: API returns 401
# Cause: Missing or invalid token

# Fix: Verify token is set and valid
grep HUBSPOT_PRIVATE_APP_TOKEN .env
# Should show: HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-...

# If missing, add it:
echo "HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-your-token-here" >> .env
```

**Error: `requiredGranularScopes: ["hubdb"]`**
```bash
# Symptom: API returns 403 with scopes error
# Cause: Private app lacks HubDB permissions

# Fix:
# 1. Visit HubSpot → Settings → Integrations → Private Apps
# 2. Select your app
# 3. Enable "HubDB" read and write scopes
# 4. Generate new token
# 5. Update .env with new token
```

**Error: `Cannot parse content. No Content-Type defined.`**
```bash
# Symptom: Sync fails with parse error for specific module
# Cause: Content triggers Cloudflare WAF

# Fix: Identify problematic content
grep -n "Host:" content/modules/your-module/README.md
grep -n "wget" content/modules/your-module/README.md

# Rewrite to avoid triggers (see Step 2 above)
```

**Error: `Cloudflare block detected`**
```bash
# Symptom: HubSpot API rejects HTML due to WAF rules
# Cause: Suspicious strings in rendered content

# Fix: Simplify content
# - Use curl --resolve instead of raw Host: headers
# - Replace wget with curl
# - Avoid large IP/CIDR blocks in examples
# - Split very large modules into smaller ones

# Temporary workaround: Upload directly via HubSpot UI
# (Document this in your PR)
```

### Step 5: Verify HubDB Row Creation

Confirm your module was created/updated in HubDB:

```bash
# Check HubDB via API
TOKEN=$(grep HUBSPOT_PRIVATE_APP_TOKEN .env | cut -d'=' -f2)
TABLE_ID=$(grep HUBDB_MODULES_TABLE_ID .env | cut -d'=' -f2)

# List rows (filter by slug)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.hubapi.com/cms/v3/hubdb/tables/${TABLE_ID}/rows" \
  | jq '.results[] | select(.values.slug == "kubernetes-troubleshooting") | {id: .id, title: .values.title, slug: .values.slug}'
```

**Expected output:**
```json
{
  "id": "197554690681",
  "title": "Kubernetes Troubleshooting",
  "slug": "kubernetes-troubleshooting"
}
```

If your module doesn't appear:
- Sync may have failed silently
- Slug might be incorrect
- Table might not be published

### Step 6: Use Debug Beacons to Verify Content

The Hedgehog Learn platform includes debug beacons that display metadata when you append `?debug=1` to any module URL:

```bash
# Construct debug URL for your module
MODULE_SLUG="kubernetes-troubleshooting"
echo "Debug URL: https://hedgehog.cloud/learn/${MODULE_SLUG}?debug=1"

# Open in browser or fetch with curl
curl -s "https://hedgehog.cloud/learn/${MODULE_SLUG}?debug=1" | grep -A 20 "debug-info"
```

**Debug beacon displays:**
- Module slug
- Module title
- Estimated minutes
- `has full_content? true/false`
- Tags
- Difficulty
- Metadata fields

**Interpreting debug output:**

✅ **Good beacon:**
```
Module: kubernetes-troubleshooting
Title: Kubernetes Troubleshooting
has full_content? true
Estimated minutes: 45
Tags: kubernetes, troubleshooting, debugging, k8s
```

❌ **Problem beacon:**
```
Module: kubernetes-troubleshooting
Title: Kubernetes Troubleshooting
has full_content? false    <-- PROBLEM!
Estimated minutes: 0       <-- PROBLEM!
Tags: (empty)              <-- PROBLEM!
```

If `has full_content? false`:
1. Sync may have failed
2. Content was empty or not processed
3. HubDB row exists but `full_content` column is empty

### Step 7: Validate Full Content Rendering

Check that your module content renders completely:

```bash
# Visit the live URL (without debug param)
echo "Live URL: https://hedgehog.cloud/learn/kubernetes-troubleshooting"
```

**Visual validation checklist:**
- ✅ Title displays correctly
- ✅ Learning objectives section present
- ✅ Prerequisites section present
- ✅ All scenario steps render with commands
- ✅ Code blocks have syntax highlighting
- ✅ Concepts section present
- ✅ Troubleshooting section present
- ✅ Resources section present
- ✅ Images load (if any)
- ✅ Links are clickable
- ✅ No raw HTML or broken Markdown

**Check for rendering issues:**

```bash
# Fetch rendered page
curl -s "https://hedgehog.cloud/learn/kubernetes-troubleshooting" > rendered.html

# Look for raw Markdown that didn't render
grep "^##" rendered.html  # Should be empty
grep "^```" rendered.html  # Should be empty

# Check if content is present
grep -c "<p>" rendered.html  # Should be > 0
grep -c "<code>" rendered.html  # Should be > 0 if you have code blocks
```

### Step 8: Test Metadata Completeness

Verify all metadata fields are populated and correct:

```bash
# Check meta tags in rendered HTML
curl -s "https://hedgehog.cloud/learn/kubernetes-troubleshooting" | \
  grep -E "<meta (name|property)=" | head -10

# Verify specific tags
# Title tag
curl -s "https://hedgehog.cloud/learn/kubernetes-troubleshooting" | \
  grep "<title>"

# Description meta tag
curl -s "https://hedgehog.cloud/learn/kubernetes-troubleshooting" | \
  grep 'meta name="description"'

# Open Graph tags
curl -s "https://hedgehog.cloud/learn/kubernetes-troubleshooting" | \
  grep 'property="og:'
```

**Expected meta tags:**
```html
<title>Kubernetes Troubleshooting | Hedgehog Learn</title>
<meta name="description" content="Your 120-160 char description...">
<meta property="og:title" content="Kubernetes Troubleshooting">
<meta property="og:description" content="...">
<meta property="og:url" content="https://hedgehog.cloud/learn/kubernetes-troubleshooting">
```

### Step 9: Test Social Share Previews

Verify your module generates correct social previews:

```bash
# Test Open Graph with Facebook debugger
echo "Facebook Debugger: https://developers.facebook.com/tools/debug/"
echo "Enter URL: https://hedgehog.cloud/learn/kubernetes-troubleshooting"

# Test Twitter Card
echo "Twitter Validator: https://cards-dev.twitter.com/validator"
echo "Enter URL: https://hedgehog.cloud/learn/kubernetes-troubleshooting"
```

**Social preview checklist:**
- ✅ Title matches your module title
- ✅ Description matches your `description` field
- ✅ Image displays (custom or default)
- ✅ Image is 1200 × 630 pixels
- ✅ No errors in debugger tools

If social image doesn't appear:
- Check `social_image` field in front matter
- Verify image URL is publicly accessible (HTTPS)
- Use "Scrape Again" to refresh platform cache

### Step 10: Validate Module in List View

Check that your module appears correctly in the main `/learn` list:

```bash
# Visit list page
echo "List page: https://hedgehog.cloud/learn"

# Check if your module appears in API
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.hubapi.com/cms/v3/hubdb/tables/${TABLE_ID}/rows" \
  | jq '.results[] | select(.values.slug == "kubernetes-troubleshooting") | {title: .values.title, difficulty: .values.difficulty, tags: .values.tags}'
```

**List view validation:**
- ✅ Module card appears with correct title
- ✅ Description displays (truncated to fit card)
- ✅ Difficulty badge shows correct level
- ✅ Estimated time displays
- ✅ Tags render correctly
- ✅ Card is clickable and links to correct URL

If module doesn't appear in list:
- Table might not be published
- Module might be marked as archived
- Filtering might hide it (check tag filters)

### Step 11: Test Cross-Browser Compatibility

Verify your module renders correctly across browsers:

```bash
# Automated testing with multiple user agents
USER_AGENTS=(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15"
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Firefox/121.0"
)

for UA in "${USER_AGENTS[@]}"; do
  echo "Testing with: $UA"
  curl -s -A "$UA" "https://hedgehog.cloud/learn/kubernetes-troubleshooting" \
    -o /dev/null -w "HTTP %{http_code}\n"
done
```

**Expected:** All should return `HTTP 200`

**Manual testing checklist:**
- ✅ Chrome/Edge: All content renders, code highlighting works
- ✅ Firefox: Same behavior as Chrome
- ✅ Safari: No layout issues, fonts render correctly
- ✅ Mobile browsers: Content is responsive, readable on small screens

### Step 12: Verify Links and References

Check that all links in your content are valid:

```bash
# Extract all links from your module
grep -oP '(?<=\[)[^\]]+(?=\]\([^\)]+\))' content/modules/kubernetes-troubleshooting/README.md

# Extract URLs
grep -oP '(?<=\]\()[^\)]+(?=\))' content/modules/kubernetes-troubleshooting/README.md | sort -u > links.txt

# Test each link (basic check)
while read url; do
  if [[ $url == http* ]]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "$url")
    echo "$STATUS - $url"
  fi
done < links.txt
```

**Link validation checklist:**
- ✅ All external links return 200 status
- ✅ Internal module references resolve correctly
- ✅ Links open in appropriate target (same/new window)
- ✅ No broken anchor links
- ✅ HTTPS preferred over HTTP

### Step 13: Test Module Progress Tracking

Verify progress buttons work correctly (if applicable):

```bash
# Visit module page
echo "Module URL: https://hedgehog.cloud/learn/kubernetes-troubleshooting"

# In browser:
# 1. Click "Mark as started" button
# 2. Check browser localStorage for progress entry
# 3. Click "Mark complete" button
# 4. Verify completion is tracked
```

**Browser console check:**
```javascript
// Check localStorage
localStorage.getItem('hhProgressState')
// Should show JSON with your module slug
```

**Progress tracking checklist:**
- ✅ "Mark as started" button visible
- ✅ "Mark complete" button visible
- ✅ Buttons are keyboard accessible
- ✅ Progress persists in localStorage
- ✅ If accessed from pathway, "Back to pathway" link appears

### Step 14: Run Final QA Checklist

Before marking complete, run through the comprehensive QA checklist:

```bash
# Generate QA report
cat > qa-report.txt << EOF
Module QA Report: kubernetes-troubleshooting
Date: $(date +%Y-%m-%d)

✅ Pre-Sync Validation
  - Slug matches directory: $(basename $(pwd))
  - Front matter valid YAML
  - All code blocks have language hints
  - Description length: $(grep "^description:" README.md | wc -c) chars

✅ Sync Process
  - Sync completed successfully
  - HubDB row created/updated
  - Table published

✅ Debug Beacon
  - has full_content? true
  - All metadata fields populated
  - Estimated minutes: $(grep "^estimated_minutes:" README.md | cut -d' ' -f2)

✅ Content Rendering
  - Title displays correctly
  - All sections present and render
  - Code blocks have syntax highlighting
  - Images load (if applicable)
  - Links are functional

✅ Metadata & SEO
  - Meta description tag present
  - Open Graph tags present
  - Twitter Card tags present
  - Social image displays (if set)

✅ List View
  - Module appears in /learn list
  - Card displays correct title and description
  - Difficulty and time display
  - Tags render

✅ Cross-Browser
  - Chrome: OK
  - Firefox: OK
  - Safari: OK
  - Mobile: OK

✅ Final Approval
  - Ready for production
  - No known issues
  - Documentation updated

QA approved by: $(whoami)
EOF

cat qa-report.txt
```

**Final acceptance criteria:**
- ✅ `full_content` populated and published for the module
- ✅ Page renders correctly and shows "has full_content? true" in `?debug=1` banner
- ✅ `estimated_minutes`, `tags`, and relevant metadata set
- ✅ Links validated; screenshots added if helpful
- ✅ No Cloudflare WAF blocks or sync errors
- ✅ Social previews work on Facebook/Twitter/LinkedIn
- ✅ Module appears in list view with correct data

## Concepts & Deep Dive

### The Content Sync Architecture

Understanding how content flows from Markdown to HubDB to live pages:

**1. Local Markdown Files**
```
content/modules/<slug>/README.md
↓
Front matter (YAML) + Body (Markdown)
```

**2. Sync Script Processing**
```
npm run sync:content
↓
- Parse front matter
- Convert Markdown → HTML
- Build HubDB payload
- Validate required fields
```

**3. HubDB API**
```
POST/PATCH to HubSpot API
↓
- Create/update row by slug
- Store HTML in full_content column
- Publish table
```

**4. HubSpot Template Rendering**
```
Template reads HubDB row
↓
- Inject HTML into page
- Add meta tags from metadata
- Apply styling and scripts
```

**5. Cloudflare & CDN**
```
Request → Cloudflare → HubSpot → Response
↓
WAF rules applied, caching active
```

### Debug Beacon Implementation

Debug beacons are conditional rendering in the template:

```html
<!-- In module-page.html template -->
{% if request.query.debug == "1" %}
  <div class="debug-banner">
    <h3>Debug Info</h3>
    <pre>
Module: {{ content.slug }}
Title: {{ content.title }}
has full_content? {{ content.full_content is not empty }}
Estimated minutes: {{ content.estimated_minutes }}
Tags: {{ content.tags }}
Difficulty: {{ content.difficulty }}
    </pre>
  </div>
{% endif %}
```

Beacons help you verify:
- HubDB data is correct
- Fields are populated
- Template is reading correct values
- Content is present (not empty)

### HubDB Row Upsert Logic

The sync script uses "upsert" logic (update or insert):

```javascript
// Pseudo-code for sync logic
const existingRow = await findRowBySlug(slug);

if (existingRow) {
  // Update existing row
  await updateRow(existingRow.id, payload);
} else {
  // Create new row
  await createRow(payload);
}
```

This means:
- Re-syncing is safe (idempotent)
- Slug is the unique identifier
- Changing slug creates a new row
- Old slug row remains unless deleted

### Cloudflare WAF Rules

HubSpot uses Cloudflare's Web Application Firewall to protect against malicious content. Common triggers:

**Suspicious patterns:**
- Raw HTTP request/response headers
- SQL injection keywords
- XSS patterns (script tags in unusual contexts)
- IP address enumeration
- Large POST bodies with binary data

**Why content gets blocked:**
- Educational content often includes examples of HTTP headers, curl commands, and network debugging
- WAF can't distinguish between example and attack
- Sync fails with `Cannot parse content` error

**Mitigation strategies:**
- Rewrite examples to be less "suspicious"
- Use `curl --resolve` instead of raw `Host:` headers
- Prefer `curl` over `wget`
- Avoid large blocks of IPs or CIDR ranges
- Split very long modules into smaller ones
- Document WAF issues in PRs

### The HubDB Modules Table Schema

Understanding the table structure helps with debugging:

| Column | Type | Usage | Notes |
|--------|------|-------|-------|
| `hs_name` | System | Module title | Required for page routing |
| `hs_path` | System | URL slug | Drives `/learn/<slug>` routing |
| `slug` | Text | Duplicate slug | For cross-table references |
| `title` | Text | Duplicate title | For HubL filtering |
| `meta_description` | Text | SEO description | From `description` field |
| `difficulty` | Select | Beginner/Intermediate/Advanced | IDs: 1/2/3 |
| `estimated_minutes` | Number | Completion time | Integer value |
| `tags` | Text | Comma-separated topics | From array in front matter |
| `full_content` | Rich Text | HTML body | From Markdown conversion |
| `display_order` | Number | Sorting weight | From `order` field |

**Key points:**
- `hs_path` must be unique (enforced by HubDB)
- `full_content` is HTML, not Markdown
- Table must be published for changes to appear
- Select field (`difficulty`) uses numeric IDs

### Sync Script Retry Logic

The sync script includes automatic retry for transient errors:

```javascript
// Pseudo-code for retry logic
async function syncWithRetry(module, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await syncModule(module);
      return; // Success
    } catch (error) {
      if (error.status === 429 || error.status === 403) {
        // Rate limit or transient block
        const delay = 1000 * Math.pow(2, attempt); // Exponential backoff
        await sleep(delay);
      } else {
        throw error; // Permanent error, don't retry
      }
    }
  }
}
```

**Retry triggers:**
- 429 (Too Many Requests)
- 403 (Temporary Cloudflare block)

**No retry for:**
- 401 (Authentication - permanent)
- 400 (Bad Request - content issue)
- 404 (Not Found - config issue)

### Meta Tag Priority

When multiple sources provide metadata, priority order:

1. **Front matter** (highest priority)
   - `description` → `<meta name="description">`
   - `social_image` → Open Graph/Twitter image

2. **HubDB row data**
   - `meta_description` column
   - Other metadata fields

3. **Template defaults**
   - Default social image from `constants.json`
   - Fallback descriptions

4. **HubSpot CMS settings** (lowest priority)
   - Global site metadata

## Troubleshooting

### Debug Beacon Shows `has full_content? false`

**Symptom:** Page loads but shows no content, debug beacon reports false

**Cause:** HubDB `full_content` column is empty

**Fix:**
```bash
# 1. Check if sync reported success
npm run sync:content 2>&1 | grep -E "(succeeded|failed)"

# 2. Verify content is present in README
wc -l content/modules/your-module/README.md
# Should be > 50 lines typically

# 3. Check for front matter issues
head -30 content/modules/your-module/README.md
# Ensure closing --- is present

# 4. Re-sync
npm run sync:content

# 5. Verify in HubDB via API
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.hubapi.com/cms/v3/hubdb/tables/${TABLE_ID}/rows?slug=your-module" \
  | jq '.results[0].values.full_content' | head -20
# Should show HTML content, not null
```

### Module Not Appearing in List

**Symptom:** Sync succeeds, debug beacon works, but module invisible on `/learn`

**Cause:** Table not published, archived flag, or filtering

**Fix:**
```bash
# 1. Check if table is published
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.hubapi.com/cms/v3/hubdb/tables/${TABLE_ID}" \
  | jq '.published'
# Should be true

# 2. Check for archived flag
grep "^archived:" content/modules/your-module/README.md
# Should not exist or be false

# 3. Check display_order
grep "^order:" content/modules/your-module/README.md
# Very high values might push it out of view

# 4. Clear browser cache and hard refresh
# Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

### Sync Hangs or Times Out

**Symptom:** Sync script runs but never completes

**Cause:** Network issue, rate limiting, or very large content

**Fix:**
```bash
# 1. Check network connectivity
curl -I https://api.hubapi.com/cms/v3/hubdb/tables
# Should return 401 (auth required but endpoint reachable)

# 2. Check content size
wc -c content/modules/your-module/README.md
# > 50KB might cause issues

# 3. Kill sync and retry with single module
# Edit sync script temporarily to process only your module

# 4. Check for infinite loops in content
# Malformed Markdown might cause parser hangs
```

### Code Blocks Render Without Syntax Highlighting

**Symptom:** Code appears as plain text, no colors

**Cause:** Missing language hint in code fence

**Fix:**
```bash
# Find code blocks without language
grep -n '^```$' content/modules/your-module/README.md

# Add language to each:
# Before:
# ```
# kubectl get pods
# ```

# After:
# ```bash
# kubectl get pods
# ```

# Re-sync
npm run sync:content
```

### Social Preview Shows Default Image

**Symptom:** Custom social image doesn't appear in preview

**Cause:** Image URL not accessible or syntax error

**Fix:**
```bash
# 1. Verify social_image field syntax
grep "^social_image:" content/modules/your-module/README.md
# Should show: social_image: "https://..."

# 2. Test URL accessibility
IMAGE_URL=$(grep "^social_image:" content/modules/your-module/README.md | cut -d' ' -f2 | tr -d '"')
curl -I "$IMAGE_URL"
# Should return HTTP 200

# 3. Check image dimensions
curl -s "$IMAGE_URL" -o temp.jpg
file temp.jpg
# Should show 1200 x 630

# 4. Clear platform cache
# Use Facebook debugger "Scrape Again"

# 5. Re-sync
npm run sync:content
```

### Metadata Missing in Search Results

**Symptom:** Module appears in list but description is generic

**Cause:** Description field missing or not synced

**Fix:**
```bash
# 1. Verify description in front matter
grep "^description:" content/modules/your-module/README.md

# 2. Check character count
grep "^description:" content/modules/your-module/README.md | wc -c
# Should be 120-160

# 3. Ensure quotes around description
# Correct:
description: "Learn Kubernetes networking..."

# Incorrect:
description: Learn Kubernetes networking...

# 4. Re-sync
npm run sync:content
```

### Tags Not Displaying

**Symptom:** Module has tags in front matter but none display

**Cause:** Tags not formatted as array

**Fix:**
```bash
# Check tag format
grep -A 5 "^tags:" content/modules/your-module/README.md

# ❌ Wrong format (comma-separated string)
tags: kubernetes, networking, troubleshooting

# ✅ Correct format (YAML array)
tags:
  - kubernetes
  - networking
  - troubleshooting

# Re-sync after fixing
npm run sync:content
```

## Resources

- [Course Authoring Guide](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/course-authoring.md) - Complete authoring reference
- [Content Sync Runbook](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/content-sync.md) - Technical sync documentation
- [Module README Template](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/templates/module-README-template.md) - Starting template
- [HubDB API Documentation](https://developers.hubspot.com/docs/api/cms/hubdb) - Official HubSpot HubDB API reference
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) - Test Open Graph previews
- [Twitter Card Validator](https://cards-dev.twitter.com/validator) - Test Twitter Card previews
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) - Test LinkedIn previews
- [JSON Query Tool (jq)](https://stedolan.github.io/jq/) - Command-line JSON processing
- [YAML Linter](https://www.yamllint.com/) - Online YAML validation
- [Cloudflare WAF Documentation](https://developers.cloudflare.com/waf/) - Understanding WAF rules
