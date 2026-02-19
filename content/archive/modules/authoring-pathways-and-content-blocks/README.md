---
title: "Pathways & Content Blocks"
slug: "authoring-pathways-and-content-blocks"
difficulty: "intermediate"
estimated_minutes: 30
version: "v0.2"
validated_on: "2025-10-14"
tags:
  - content-authoring
  - pathways
  - content-blocks
  - learning-design
description: "Learn how to create pathways that group courses and modules into curated learning journeys with rich narrative content blocks for the Hedgehog Learn platform."
order: 250
---

# Pathways & Content Blocks

Create structured learning journeys that guide learners through multiple courses and modules. This module covers creating pathways with content blocks that add narrative context, callouts, and course/module references to enhance the learning experience.

## Learning Objectives

- Understand the role of pathways in the content hierarchy
- Create pathway JSON files with courses or modules
- Use content blocks to add narrative structure (text, callout, course_ref, module_ref)
- Sync and publish pathways to HubDB
- Verify pathway rendering and troubleshoot common issues
- Apply best practices for pathway design and learner guidance

## Prerequisites

- Completion of "Authoring Basics: Modules, Front Matter, and Sync" module
- Completion of "Assembling Courses from Modules" module (recommended)
- Understanding of JSON syntax and structure
- Access to the hh-learn repository
- Node 18+ installed
- HubSpot private app token configured in `.env` file

## Scenario: Creating a Learning Pathway

You're a learning architect who has created several courses and modules. Now you want to assemble them into a curated pathway that guides learners through a comprehensive learning journey. You'll create a pathway with narrative content blocks, sync it to HubDB, and verify it renders correctly.

### Step 1: Understand Pathway Structure

Pathways are the top level of the content hierarchy:

```
Pathways (Learning Journeys)
  └─ Courses (Structured Units)
      └─ Modules (Atomic Lessons)
```

Pathways are defined in JSON files at `content/pathways/<slug>.json`:

```bash
# Navigate to pathways directory
cd content/pathways

# List existing pathways
ls -la
```

You'll see examples like:
- `getting-started.json` (references modules directly)
- `getting-started-with-courses.json` (references courses)

**Key characteristics:**
- Group 1-5 courses or modules
- Add narrative structure with content blocks
- Award badges upon completion
- Track learner progress

### Step 2: Choose Your Pathway Type

Pathways can reference either courses or modules (or both):

**Type 1: Course-based pathway (recommended)**

```json
{
  "slug": "kubernetes-mastery",
  "title": "Kubernetes Mastery",
  "summary_markdown": "Comprehensive Kubernetes learning journey...",
  "courses": [
    "kubernetes-essentials",
    "kubernetes-advanced-networking",
    "kubernetes-production"
  ]
}
```

**Type 2: Module-based pathway (fallback)**

```json
{
  "slug": "docker-basics",
  "title": "Docker Basics",
  "summary_markdown": "Learn Docker fundamentals...",
  "modules": [
    "intro-to-docker",
    "docker-images",
    "docker-compose"
  ]
}
```

**Type 3: Mixed (both courses and modules)**

```json
{
  "slug": "cloud-native-journey",
  "title": "Cloud Native Journey",
  "summary_markdown": "Master cloud-native technologies...",
  "courses": [
    "kubernetes-essentials"
  ],
  "modules": [
    "intro-to-containers",
    "kubernetes-networking"
  ]
}
```

**Decision guide:**
- Use `courses` when you have structured multi-module learning units
- Use `modules` for simpler pathways or when courses don't exist yet
- Templates prefer courses when both are present

### Step 3: Create Your Pathway JSON File

Create a new pathway file:

```bash
# Create pathway file
cat > content/pathways/cloud-native-fundamentals.json << 'EOF'
{
  "slug": "cloud-native-fundamentals",
  "title": "Cloud Native Fundamentals",
  "summary_markdown": "Master the essential technologies and practices for building cloud-native applications.\n\nThis pathway covers containerization with Docker, orchestration with Kubernetes, and production best practices. You'll gain hands-on experience with the core tools used by modern DevOps teams.",
  "courses": [
    "getting-started-virtual-lab",
    "hedgehog-lab-foundations"
  ],
  "badge_image_url": "",
  "display_order": 5,
  "tags": "cloud-native,kubernetes,docker,getting-started"
}
EOF
```

**Required fields:**
- `slug`: Unique identifier (lowercase, hyphen-separated)
- `title`: Display name for the pathway
- `summary_markdown`: Rich description (2-4 paragraphs, Markdown supported)
- `courses` OR `modules`: At least one must be present

**Optional fields:**
- `badge_image_url`: Completion badge graphic
- `display_order`: Sorting weight (lower = earlier in list)
- `tags`: Comma-separated topics

Verify JSON syntax:

```bash
cat content/pathways/cloud-native-fundamentals.json | jq .
# Should parse and pretty-print without errors
```

### Step 4: Add Content Blocks for Narrative Structure

Content blocks add rich narrative between courses/modules. Let's enhance the pathway:

```bash
cat > content/pathways/cloud-native-fundamentals.json << 'EOF'
{
  "slug": "cloud-native-fundamentals",
  "title": "Cloud Native Fundamentals",
  "summary_markdown": "Master the essential technologies and practices for building cloud-native applications.\n\nThis pathway covers containerization with Docker, orchestration with Kubernetes, and production best practices. You'll gain hands-on experience with the core tools used by modern DevOps teams.",
  "courses": [
    "getting-started-virtual-lab",
    "hedgehog-lab-foundations"
  ],
  "badge_image_url": "",
  "display_order": 5,
  "tags": "cloud-native,kubernetes,docker,getting-started",
  "content_blocks": [
    {
      "id": "intro",
      "type": "text",
      "title": "Welcome to Cloud Native Fundamentals",
      "body_markdown": "Cloud-native applications are designed to run in dynamic, distributed environments like Kubernetes. This pathway will teach you the foundational skills needed to build, deploy, and manage cloud-native applications.\n\nYou'll start by setting up your learning environment, then progress through containerization and orchestration fundamentals."
    },
    {
      "id": "prerequisites",
      "type": "callout",
      "title": "Before You Begin",
      "body_markdown": "**Prerequisites:**\n- Basic command-line familiarity\n- Understanding of web applications and servers\n- A cloud account (Google Cloud, AWS, or Azure)\n\nEstimated total time: 90 minutes"
    },
    {
      "id": "section-setup",
      "type": "text",
      "title": "Part 1: Setting Up Your Environment",
      "body_markdown": "First, you'll learn how to access the Hedgehog Virtual Lab across different cloud providers. Choose the course that matches your cloud provider."
    },
    {
      "id": "course-vlab",
      "type": "course_ref",
      "course_slug": "getting-started-virtual-lab"
    },
    {
      "id": "section-foundations",
      "type": "text",
      "title": "Part 2: Kubernetes Fundamentals",
      "body_markdown": "Now that your environment is ready, dive into Kubernetes. This course covers the essential concepts and hands-on labs you need to deploy containerized applications."
    },
    {
      "id": "course-foundations",
      "type": "course_ref",
      "course_slug": "hedgehog-lab-foundations"
    },
    {
      "id": "next-steps",
      "type": "callout",
      "title": "What's Next?",
      "body_markdown": "Congratulations on completing Cloud Native Fundamentals! You're now ready to explore:\n\n- Advanced Kubernetes networking\n- Storage and persistence\n- Security and RBAC\n- CI/CD with GitOps"
    }
  ]
}
EOF
```

**Content block types:**

**1. text** - Narrative paragraphs
```json
{
  "id": "unique-id",
  "type": "text",
  "title": "Section Title (optional)",
  "body_markdown": "Markdown content..."
}
```

**2. callout** - Highlighted info boxes
```json
{
  "id": "unique-id",
  "type": "callout",
  "title": "Important Notice",
  "body_markdown": "**Warning:** or **Tip:**..."
}
```

**3. course_ref** - Reference to a course
```json
{
  "id": "unique-id",
  "type": "course_ref",
  "course_slug": "course-slug-here"
}
```

**4. module_ref** - Reference to a module
```json
{
  "id": "unique-id",
  "type": "module_ref",
  "module_slug": "module-slug-here"
}
```

Validate updated JSON:

```bash
cat content/pathways/cloud-native-fundamentals.json | jq '.content_blocks[] | {id, type}'
# Should show all blocks with their IDs and types
```

### Step 5: Validate Required Fields

Check that all required fields are present:

```bash
# Validate pathway structure
cat content/pathways/cloud-native-fundamentals.json | jq '{
  slug,
  title,
  has_summary: (.summary_markdown != null),
  has_courses: (.courses != null),
  has_modules: (.modules != null),
  course_count: (.courses | length // 0),
  module_count: (.modules | length // 0),
  content_block_count: (.content_blocks | length // 0)
}'
```

Expected output:
```json
{
  "slug": "cloud-native-fundamentals",
  "title": "Cloud Native Fundamentals",
  "has_summary": true,
  "has_courses": true,
  "has_modules": false,
  "course_count": 2,
  "module_count": 0,
  "content_block_count": 7
}
```

**Validation checklist:**
- ✅ `slug` present and unique
- ✅ `title` present
- ✅ `summary_markdown` present
- ✅ Either `courses` OR `modules` present (at least one)
- ✅ All content block IDs unique within pathway
- ✅ All `course_ref` slugs match existing courses
- ✅ All `module_ref` slugs match existing modules

### Step 6: Sync to HubDB (Dry Run)

Test the sync without making changes:

```bash
# Run dry-run sync
npm run sync:pathways -- --dry-run
```

Expected output:
```
📝 DRY RUN MODE - no changes will be made to HubDB

📄 Pathway: Cloud Native Fundamentals (cloud-native-fundamentals)
   Courses: 2
   Modules: 0
   Module count: 6 (computed from courses)
   Estimated minutes: 75
   Content blocks: 7
   Payload: {
     "slug": "cloud-native-fundamentals",
     ...
   }

✅ Dry run complete!
Summary: 1 succeeded, 0 failed
```

**What the script does:**
1. Reads pathway JSON files
2. Validates required fields
3. Computes total module count from courses
4. Computes total estimated minutes
5. Converts Markdown to HTML
6. Serializes arrays to JSON strings
7. Shows payload that would be sent

If validation fails, check error message and fix the JSON.

### Step 7: Sync to HubDB (Live)

Perform the live sync:

```bash
npm run sync:pathways
```

Expected output:
```
🔄 Starting pathways sync to HubDB...

Found 4 pathway(s) to sync:

  ✓ Updated: Getting Started
  ✓ Updated: Getting Started (Courses Demo)
  ✓ Updated: Getting Started with Hedgehog Lab
  ✓ Created: Cloud Native Fundamentals

📤 Publishing HubDB table...
✅ Sync complete! Table published.

Summary: 4 succeeded, 0 failed
```

The script:
- Creates/updates HubDB rows by slug (idempotent)
- Computes `module_count` from courses or modules
- Computes `total_estimated_minutes` from modules
- Publishes the pathways table

### Step 8: Verify Pathway Rendering

Visit your pathway page to verify it renders correctly:

```bash
echo "Live URL: https://hedgehog.cloud/learn/pathways/cloud-native-fundamentals"
echo "Debug URL: https://hedgehog.cloud/learn/pathways/cloud-native-fundamentals?debug=1"
```

**What to check:**
- ✅ Pathway title and summary display
- ✅ Course/module count is correct
- ✅ Estimated time computed correctly
- ✅ Content blocks render in order
- ✅ Text blocks show title and body
- ✅ Callout blocks are highlighted
- ✅ Course/module references link properly
- ✅ Progress bar is visible (if logged in)

In debug view (`?debug=1`):
- ✅ `pathway_slug` matches your slug
- ✅ `course_slugs_json` or `module_slugs_json` populated
- ✅ `content_blocks_json` contains all blocks
- ✅ `module_count` and `total_estimated_minutes` computed

### Step 9: Design Content Block Flow

Content blocks should tell a story. Follow this pattern:

**1. Introduction (text block)**
```json
{
  "id": "intro",
  "type": "text",
  "title": "Welcome",
  "body_markdown": "Brief overview of what learners will achieve..."
}
```

**2. Prerequisites (callout block)**
```json
{
  "id": "prereqs",
  "type": "callout",
  "title": "Before You Begin",
  "body_markdown": "List prerequisites, estimated time, tools needed..."
}
```

**3. Learning sections (alternating text + course/module refs)**
```json
{
  "id": "section-1",
  "type": "text",
  "title": "Part 1: Foundation",
  "body_markdown": "Context for this section..."
},
{
  "id": "course-1",
  "type": "course_ref",
  "course_slug": "foundation-course"
}
```

**4. Transitions (text blocks between sections)**
```json
{
  "id": "transition",
  "type": "text",
  "body_markdown": "Now that you understand X, let's explore Y..."
}
```

**5. Conclusion (callout block)**
```json
{
  "id": "next-steps",
  "type": "callout",
  "title": "What's Next?",
  "body_markdown": "Suggested next pathways, resources, or topics..."
}
```

### Step 10: Use Callouts Effectively

Callouts draw attention to important information:

**Prerequisites callout:**
```json
{
  "type": "callout",
  "title": "Prerequisites",
  "body_markdown": "**Required:**\n- Git installed\n- GitHub account\n- Basic shell skills\n\n**Recommended:**\n- Docker Desktop\n- VS Code"
}
```

**Warning callout:**
```json
{
  "type": "callout",
  "title": "⚠️ Important",
  "body_markdown": "This pathway assumes you have completed the Getting Started pathway. If you haven't, start there first."
}
```

**Tip callout:**
```json
{
  "type": "callout",
  "title": "💡 Pro Tip",
  "body_markdown": "Complete the modules in order for the best learning experience. Each builds on concepts from the previous one."
}
```

**Time estimate callout:**
```json
{
  "type": "callout",
  "title": "⏱️ Time Commitment",
  "body_markdown": "This pathway takes approximately 3 hours to complete. You can pause and resume anytime—your progress is automatically saved."
}
```

### Step 11: Reference Courses vs Modules

Choose the right reference type:

**Use course_ref when:**
- Content is organized into structured courses
- You want learners to complete multiple related modules
- Courses provide narrative context

Example:
```json
{
  "type": "course_ref",
  "course_slug": "kubernetes-essentials"
}
```

**Use module_ref when:**
- Pathway is module-based (no courses)
- You want to reference a specific module from a course
- Module provides a specific skill needed for the journey

Example:
```json
{
  "type": "module_ref",
  "module_slug": "intro-to-kubernetes"
}
```

**Mixing both:**
```json
{
  "courses": ["kubernetes-essentials"],
  "content_blocks": [
    {
      "type": "course_ref",
      "course_slug": "kubernetes-essentials"
    },
    {
      "type": "text",
      "body_markdown": "For networking deep dive, complete this bonus module:"
    },
    {
      "type": "module_ref",
      "module_slug": "kubernetes-advanced-networking"
    }
  ]
}
```

### Step 12: Avoid Common Mistakes

**❌ Mistake 1: No H1 headings in summary or body_markdown**

```json
{
  "summary_markdown": "# Welcome\n\nThis pathway..."
}
```

**✅ Fix:** Use H2-H6 or bold text, never H1

```json
{
  "summary_markdown": "**Welcome**\n\nThis pathway..."
}
```

**❌ Mistake 2: Duplicate content block IDs**

```json
{
  "content_blocks": [
    {"id": "intro", "type": "text", ...},
    {"id": "intro", "type": "callout", ...}
  ]
}
```

**✅ Fix:** Ensure unique IDs

```json
{
  "content_blocks": [
    {"id": "intro-text", "type": "text", ...},
    {"id": "intro-callout", "type": "callout", ...}
  ]
}
```

**❌ Mistake 3: Missing required course/module slug**

```json
{
  "type": "course_ref"
}
```

**✅ Fix:** Include slug field

```json
{
  "type": "course_ref",
  "course_slug": "getting-started"
}
```

**❌ Mistake 4: Summary too long**

```json
{
  "summary_markdown": "This pathway covers... (500 words of text)"
}
```

**✅ Fix:** Keep summary to 2-4 paragraphs (150-300 words)

### Step 13: Test Cross-References

Verify all course and module references are valid:

```bash
# Extract all course references
cat content/pathways/cloud-native-fundamentals.json | jq -r '.content_blocks[] | select(.type=="course_ref") | .course_slug'

# Check each course exists
for slug in $(cat content/pathways/cloud-native-fundamentals.json | jq -r '.content_blocks[]? | select(.type=="course_ref")? | .course_slug'); do
  if [ -f "content/courses/${slug}.json" ]; then
    echo "✓ Course exists: $slug"
  else
    echo "✗ Course missing: $slug"
  fi
done

# Extract all module references
cat content/pathways/cloud-native-fundamentals.json | jq -r '.content_blocks[] | select(.type=="module_ref") | .module_slug'

# Check each module exists
for slug in $(cat content/pathways/cloud-native-fundamentals.json | jq -r '.content_blocks[]? | select(.type=="module_ref")? | .module_slug'); do
  if [ -d "content/modules/${slug}" ]; then
    echo "✓ Module exists: $slug"
  else
    echo "✗ Module missing: $slug"
  fi
done
```

All references should show ✓ (exists).

### Step 14: Update or Modify a Pathway

Pathways are idempotent—you can resync with changes:

```bash
# Edit your pathway
nano content/pathways/cloud-native-fundamentals.json

# Make changes:
# - Add/remove courses or modules
# - Reorder content blocks
# - Update narrative text
# - Change metadata

# Sync again (updates existing row by slug)
npm run sync:pathways
```

**Common updates:**
- Adding new courses as they're created
- Reordering sections for better flow
- Updating callouts with new information
- Adding bonus modules
- Changing display_order for list sorting

After syncing, verify changes on the live page.

## Concepts & Deep Dive

### Content Hierarchy

The three-tier hierarchy provides different granularities:

```
Pathways (months-long journeys)
  ├─ Courses (weeks-long units)
  │   └─ Modules (hour-long lessons)
  │
  └─ Modules (direct reference)
```

**Design principles:**
- **Modules:** Atomic, self-contained lessons (20-45 min)
- **Courses:** Thematic groups of 3-8 modules (2-6 hours)
- **Pathways:** Comprehensive journeys of 1-5 courses (5-20 hours)

### Pathway vs Course Precedence

When a pathway has both `courses` and `modules`:

```json
{
  "courses": ["kubernetes-essentials"],
  "modules": ["intro-to-docker"]
}
```

Templates prefer `course_slugs_json` when rendering. The `modules` array serves as fallback or supplement.

**Best practice:** Use one or the other, not both, unless adding bonus/prerequisite modules.

### HubDB Pathways Schema

Pathways are stored in HubDB with this schema:

| Field | Type | Purpose |
|-------|------|---------|
| `slug` | Text | Unique identifier |
| `title` | Text | Display name |
| `summary_markdown` | Rich Text | HTML description |
| `course_slugs_json` | Rich Text | JSON array of course slugs |
| `module_slugs_json` | Rich Text | JSON array of module slugs |
| `module_count` | Number | Total modules (computed) |
| `total_estimated_minutes` | Number | Total time (computed) |
| `badge_image_url` | Text | Completion badge |
| `display_order` | Number | Sorting weight |
| `tags` | Text | Comma-separated topics |
| `content_blocks_json` | Rich Text | JSON array of blocks |

The sync script automatically computes:
- `module_count`: Sum of modules across courses
- `total_estimated_minutes`: Sum of all module durations

### Content Block Rendering

Templates process content blocks sequentially and render them based on type:

**text blocks:**
```html
<div class="pathway-text-block">
  <h3>Section Title</h3>
  <p>Body markdown rendered as HTML...</p>
</div>
```

**callout blocks:**
```html
<div class="pathway-callout">
  <h4>Important</h4>
  <p>Highlighted content...</p>
</div>
```

**course_ref blocks:**
```html
<div class="course-card">
  <h3><a href="/learn/courses/slug">Course Title</a></h3>
  <p>Course summary, module count, estimated time</p>
</div>
```

**module_ref blocks:**
```html
<div class="module-card">
  <h3><a href="/learn/slug">Module Title</a></h3>
  <p>Description, difficulty, estimated time</p>
</div>
```

### Progress Tracking

Pathways include localStorage-based progress tracking:

**How it works:**
1. Learner visits pathway page
2. JavaScript stores progress in `localStorage`
3. Pathway page shows progress bar
4. Module/course pages show "Back to pathway" link
5. Completion tracked per learner session

**For authors:**
- No configuration needed
- Templates handle progress UI
- Works without authentication
- Future: sync to CRM for authenticated users

### Badge Images

Badge images reward pathway completion:

**Specifications:**
- Size: 200 × 200 pixels (square)
- Format: PNG with transparency
- File size: < 50 KB
- Style: Icon or badge graphic

**Adding badges:**
```json
{
  "badge_image_url": "https://hedgehog.cloud/hubfs/badges/kubernetes-mastery.png"
}
```

If empty, no badge is displayed (learners still complete the pathway).

## Troubleshooting

### Pathway Not Syncing

**Symptom:** Sync fails with validation error

**Cause:** Missing required field or invalid JSON

**Fix:**

```bash
# Validate JSON syntax
cat content/pathways/your-pathway.json | jq .
# If error, check line number for syntax issue

# Check required fields
cat content/pathways/your-pathway.json | jq '{slug, title, summary_markdown, courses, modules}'
# All should show values, at least one of courses/modules must exist
```

### Content Blocks Not Rendering

**Symptom:** Pathway page shows courses/modules but no narrative blocks

**Cause:** `content_blocks` array missing or invalid

**Fix:**

```bash
# Check content_blocks structure
cat content/pathways/your-pathway.json | jq '.content_blocks[] | {id, type}'

# Validate each block has required fields:
# - id (unique)
# - type (text, callout, course_ref, or module_ref)
# - For course_ref: course_slug
# - For module_ref: module_slug
```

### Course/Module Reference Broken

**Symptom:** Reference block shows "Course not found" or doesn't link

**Cause:** Referenced slug doesn't exist

**Fix:**

```bash
# Check course exists
ls content/courses/ | grep "your-course-slug"

# Check module exists
ls content/modules/ | grep "your-module-slug"

# Fix slug typo or create missing content
```

### Module Count is 0

**Symptom:** Pathway shows "0 modules" even though courses have modules

**Cause:** Sync script couldn't read module front matter

**Fix:**

```bash
# Verify courses have modules
cat content/courses/your-course.json | jq '.modules'

# Check module front matter has estimated_minutes
grep "estimated_minutes" content/modules/intro-to-kubernetes/README.md

# Sync modules first, then pathways
npm run sync:content
npm run sync:pathways
```

### Estimated Minutes Wrong

**Symptom:** Total time doesn't match expected duration

**Cause:** Module front matter missing `estimated_minutes` or not synced

**Fix:**

```bash
# Check module durations
for module in $(cat content/pathways/your-pathway.json | jq -r '.modules[]?'); do
  echo -n "$module: "
  grep "estimated_minutes:" "content/modules/$module/README.md" | head -1
done

# Update missing values and sync
npm run sync:content
npm run sync:pathways
```

### Summary Has H1 Heading

**Symptom:** Pathway page has multiple H1 tags (accessibility/SEO issue)

**Cause:** `summary_markdown` contains `# Heading`

**Fix:**

```bash
# Check for H1 in summary
cat content/pathways/your-pathway.json | jq -r '.summary_markdown' | grep "^# "

# Replace with H2 or bold text
# ❌ "# Welcome\n\nThis pathway..."
# ✅ "**Welcome**\n\nThis pathway..."
```

### Duplicate Content Block IDs

**Symptom:** Sync succeeds but blocks render incorrectly

**Cause:** Multiple blocks with same ID

**Fix:**

```bash
# Check for duplicate IDs
cat content/pathways/your-pathway.json | jq -r '.content_blocks[].id' | sort | uniq -d
# Any output indicates duplicates

# Rename to make unique:
# intro-1, intro-2, etc.
```

## Resources

- [Course Authoring Guide](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/course-authoring.md) - Comprehensive authoring reference (see § Pathways)
- [Content Sync Runbook](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/content-sync.md) - Pathways sync details (see § Pathways Mapping)
- [Existing Pathways](https://github.com/hedgehog-cloud/hh-learn/tree/main/content/pathways) - Learn by example
- [Existing Courses](https://github.com/hedgehog-cloud/hh-learn/tree/main/content/courses) - Course examples for references
- [JSON Validator](https://jsonlint.com/) - Online JSON syntax validator
- [jq Documentation](https://stedolan.github.io/jq/manual/) - Command-line JSON processor
