---
title: "Assembling Courses from Modules"
slug: "authoring-assembly-courses"
difficulty: "intermediate"
estimated_minutes: 25
version: "v0.2"
validated_on: "2025-10-14"
tags:
  - content-authoring
  - courses
  - documentation
  - learning-design
description: "Learn how to create and publish courses that assemble multiple learning modules into structured, narrative-driven learning units with the Hedgehog Learn platform."
order: 200
---

# Assembling Courses from Modules

Learn how to create courses in the Hedgehog Learn platform. Courses group multiple modules into structured, narrative-driven learning units that sit between individual modules and pathways in the content hierarchy.

## Learning Objectives

- Understand the role of courses in the Hedgehog Learn content hierarchy
- Create a course JSON file with proper structure and required fields
- Use content blocks to add narrative structure and guidance
- Sync and publish courses to HubDB
- Verify course rendering and troubleshoot common issues

## Prerequisites

- Basic familiarity with JSON syntax
- Understanding of the Hedgehog Learn platform and its module structure
- Access to the hh-learn repository
- Node 18+ installed (Node 22 LTS recommended)
- HubSpot private app token configured in `.env` file

## Scenario: Creating Your First Course

As a content author, you've created several related modules and want to group them into a cohesive learning experience. You'll create a course JSON file, add narrative content blocks to guide learners, and publish it to the platform.

### Step 1: Understand the Course Structure

Courses are defined in JSON files located at `content/courses/<slug>.json`. Each course references modules by their slugs and can include optional narrative content blocks.

Review an existing course to understand the structure:

```bash
cat content/courses/getting-started-virtual-lab.json
```

You'll see the core structure includes:
- `slug`: Unique identifier for the course
- `title`: Display name
- `summary_markdown`: Course description in Markdown
- `modules`: Array of module slugs in the desired order
- `content_blocks`: Optional narrative elements

### Step 2: Create Your Course JSON File

Create a new course file. We'll create a course about Kubernetes fundamentals:

```bash
cat > content/courses/kubernetes-essentials.json << 'EOF'
{
  "slug": "kubernetes-essentials",
  "title": "Kubernetes Essentials",
  "summary_markdown": "Master the essential concepts and operations of Kubernetes through hands-on labs.\n\nThis course covers everything from basic pod management to advanced networking and storage concepts. You'll gain practical experience deploying and managing applications in Kubernetes.",
  "modules": [
    "intro-to-kubernetes",
    "kubernetes-networking",
    "kubernetes-storage"
  ],
  "badge_image_url": "",
  "display_order": 10,
  "tags": "kubernetes,containers,orchestration,networking,storage"
}
EOF
```

**Key fields explained:**
- `slug`: URL-friendly identifier (lowercase, hyphen-separated)
- `modules`: Ordered array - the sequence defines the learning path
- `display_order`: Controls sorting in course lists (lower = earlier)
- `tags`: Comma-separated for filtering and search

Verify the file was created:

```bash
cat content/courses/kubernetes-essentials.json
```

### Step 3: Add Content Blocks for Narrative Structure

Content blocks add rich narrative elements between modules. Let's enhance our course with guidance:

```bash
cat > content/courses/kubernetes-essentials.json << 'EOF'
{
  "slug": "kubernetes-essentials",
  "title": "Kubernetes Essentials",
  "summary_markdown": "Master the essential concepts and operations of Kubernetes through hands-on labs.\n\nThis course covers everything from basic pod management to advanced networking and storage concepts. You'll gain practical experience deploying and managing applications in Kubernetes.",
  "modules": [
    "intro-to-kubernetes",
    "kubernetes-networking",
    "kubernetes-storage"
  ],
  "badge_image_url": "",
  "display_order": 10,
  "tags": "kubernetes,containers,orchestration,networking,storage",
  "content_blocks": [
    {
      "id": "intro",
      "type": "text",
      "title": "Welcome to Kubernetes Essentials",
      "body_markdown": "This course provides a comprehensive introduction to Kubernetes. You'll start with the fundamentals and progress through networking and storage - the critical building blocks of production Kubernetes deployments."
    },
    {
      "id": "prerequisites-note",
      "type": "callout",
      "title": "Before You Begin",
      "body_markdown": "Ensure you have:\n\n- Access to a Kubernetes cluster (kind, minikube, or cloud provider)\n- kubectl CLI installed and configured\n- Basic understanding of containers and Docker\n\nIf you haven't worked with containers before, consider starting with a Docker basics course first."
    },
    {
      "id": "module-intro",
      "type": "module_ref",
      "module_slug": "intro-to-kubernetes"
    },
    {
      "id": "section-advanced",
      "type": "text",
      "title": "Advanced Topics",
      "body_markdown": "Now that you understand the basics, let's explore networking and storage - two critical areas for production deployments."
    },
    {
      "id": "module-networking",
      "type": "module_ref",
      "module_slug": "kubernetes-networking"
    },
    {
      "id": "module-storage",
      "type": "module_ref",
      "module_slug": "kubernetes-storage"
    },
    {
      "id": "next-steps",
      "type": "callout",
      "title": "What's Next?",
      "body_markdown": "Congratulations on completing Kubernetes Essentials! You're now ready to explore:\n\n- Advanced scheduling and resource management\n- Security and RBAC\n- Monitoring and observability\n- GitOps and continuous deployment"
    }
  ]
}
EOF
```

**Content block types:**
- **text**: Narrative paragraphs with optional title
- **callout**: Highlighted boxes for important info
- **module_ref**: References to modules from your `modules` array

Verify the enhanced course:

```bash
cat content/courses/kubernetes-essentials.json | jq .
```

The `jq` command validates JSON syntax and pretty-prints the output.

### Step 4: Validate Required Fields

Before syncing, ensure all required fields are present:

```bash
# Check for required fields
cat content/courses/kubernetes-essentials.json | jq '{
  slug,
  title,
  has_summary: (.summary_markdown != null),
  module_count: (.modules | length)
}'
```

**Required fields:**
- `slug`: Must be unique across all courses
- `title`: Display name
- `summary_markdown`: Course description
- `modules`: At least one module slug (array must not be empty)

If any required field is missing, you'll see `null` in the output.

### Step 5: Sync to HubDB (Dry Run)

Test the sync process without making changes:

```bash
npm run sync:courses -- --dry-run
```

You should see output showing:
- Course found and validated
- Computed `estimated_minutes` (sum of module durations)
- Full payload that would be sent to HubDB

Example output:
```
📄 Course: Kubernetes Essentials (kubernetes-essentials)
   Modules: 3
   Estimated minutes: 85
   Content blocks: 7
```

**Common validation errors:**
- Missing required fields → Add them to your JSON
- Invalid module slugs → Check that referenced modules exist
- JSON syntax errors → Use `jq` to validate

### Step 6: Sync to HubDB (Live)

Once the dry run succeeds, perform the live sync:

```bash
npm run sync:courses
```

The script will:
1. Read your course JSON
2. Validate required fields
3. Compute `estimated_minutes` from module front matter
4. Convert `summary_markdown` to HTML
5. Serialize arrays to JSON strings for HubDB
6. Upsert the row to the courses table
7. Publish the table

Verify success:
```
✅ Sync complete!
Summary: 1 succeeded, 0 failed
```

### Step 7: Verify Course Rendering

Visit your course page to confirm it renders correctly:

```bash
echo "Visit: https://hedgehog.cloud/learn/courses/kubernetes-essentials"
echo "Debug view: https://hedgehog.cloud/learn/courses/kubernetes-essentials?debug=1"
```

**What to check:**
- Course title and summary appear correctly
- Module count matches your `modules` array
- Estimated time is computed correctly
- Content blocks render in the correct order
- All module references link properly

In the debug view (`?debug=1`), verify:
- `course_slug` shows your slug
- `module_slugs_json` contains all your module slugs
- `content_blocks_json` contains all content blocks

### Step 8: Update or Modify a Course

Courses are idempotent - you can re-run sync with changes:

```bash
# Edit your course JSON
nano content/courses/kubernetes-essentials.json

# Sync again (updates existing row by slug)
npm run sync:courses
```

Changes you might make:
- Add or remove modules
- Reorder modules in the array
- Add new content blocks
- Update summary or metadata

After syncing, visit your course page to verify the updates.

### Step 9: Troubleshooting Common Issues

**Issue: Module not found warning**

If a module slug in your `modules` array doesn't exist:

```bash
# List all available module slugs
ls content/modules/
```

Update your course JSON to reference only existing modules.

**Issue: estimated_minutes is 0**

The sync script computes duration by summing module front matter:

```bash
# Check module front matter
grep "estimated_minutes" content/modules/intro-to-kubernetes/README.md
```

Ensure each module has `estimated_minutes` in its front matter.

**Issue: Course not appearing in list**

Check the courses table was published:

```bash
# Verify sync output shows publish step
npm run sync:courses 2>&1 | grep -i publish
```

If publish failed, manually publish via HubSpot Design Manager → HubDB.

**Issue: Content blocks not rendering**

Validate your `content_blocks` array structure:

```bash
cat content/courses/kubernetes-essentials.json | jq '.content_blocks[] | {id, type}'
```

Each block must have:
- `id`: Unique within the course
- `type`: One of `text`, `callout`, or `module_ref`
- For `module_ref`: `module_slug` field pointing to a valid module

### Step 10: Best Practices

**Ordering**
- List modules in the sequence learners should follow
- Put foundational content before advanced topics
- The `modules` array is the single source of truth for ordering

**Content Blocks**
- Use `text` blocks to introduce sections
- Use `callout` blocks for important prerequisites or warnings
- Use `module_ref` blocks to reference modules in narrative order
- Do not use H1 headings in markdown (violates single-H1 rule)

**Metadata**
- Keep `summary_markdown` focused: 2-4 paragraphs
- Use `display_order` for manual sorting (lower numbers first)
- Add specific, searchable tags
- Leave `badge_image_url` empty initially (add badges later)

## Concepts & Deep Dive

### Course vs. Module vs. Pathway

**Modules** are atomic learning units:
- Self-contained lessons with hands-on labs
- Stored as `content/modules/<slug>/README.md`
- Focus on a single concept or skill

**Courses** assemble modules with narrative:
- Group 2-8 related modules
- Add context and guidance via content blocks
- Provide structured learning sequences
- Stored as `content/courses/<slug>.json`

**Pathways** group courses or modules:
- High-level learning journeys
- May span multiple courses
- Award completion badges
- Stored as `content/pathways/<slug>.json`

### The Sync Process

When you run `npm run sync:courses`:

1. **Read**: Script scans `content/courses/*.json`
2. **Validate**: Checks required fields and module references
3. **Compute**: Calculates `estimated_minutes` by summing module durations
4. **Transform**: Converts Markdown to HTML, serializes arrays to JSON strings
5. **Upsert**: Creates or updates HubDB row (matched by `slug`)
6. **Publish**: Makes changes live on the courses table

The process is **idempotent** - running multiple times with the same data produces no changes.

### HubDB Schema

Courses are stored in the HubDB courses table with these key fields:

| Field | Type | Purpose |
|-------|------|---------|
| `slug` | Text | Unique identifier, used for URLs |
| `title` | Text | Display name |
| `summary_markdown` | Rich Text | HTML-rendered description |
| `module_slugs_json` | Rich Text | JSON array of module slugs |
| `estimated_minutes` | Number | Auto-computed total time |
| `content_blocks_json` | Rich Text | JSON array of narrative blocks |
| `display_order` | Number | Manual sorting weight |
| `tags` | Text | Comma-separated topics |

The `module_slugs_json` and `content_blocks_json` fields store serialized JSON that templates parse on render.

### Content Block Rendering

Templates process content blocks sequentially:

- **text** blocks render as paragraphs with optional headings
- **callout** blocks render as highlighted boxes (yellow/blue background)
- **module_ref** blocks query the modules table and render module cards with:
  - Module title (linked to detail page)
  - Estimated duration
  - Difficulty badge
  - Short description

This allows rich narrative structure without embedding module content directly.

### Precedence and Fallbacks

Courses prefer the `content_blocks` array for rendering when present. If absent, templates fall back to a simple list of modules from `module_slugs_json`.

Both approaches work, but content blocks provide better learning experience by adding context between modules.

## Troubleshooting

### Validation Errors

**Symptom**: Sync fails with "Missing required field" error

**Cause**: Course JSON missing `slug`, `title`, `summary_markdown`, or `modules`

**Fix**: Add the missing field to your JSON file

```bash
# Validate structure
cat content/courses/your-course.json | jq 'has("slug") and has("title") and has("summary_markdown") and has("modules")'
# Should output: true
```

### Module Reference Errors

**Symptom**: Course syncs but module links don't work on live page

**Cause**: Module slug in `modules` array doesn't match any published module

**Fix**: Verify module exists and slug matches exactly

```bash
# List available modules
ls content/modules/

# Check if specific module exists
test -f content/modules/intro-to-kubernetes/README.md && echo "exists" || echo "missing"
```

### JSON Syntax Errors

**Symptom**: Sync fails with parsing error or `jq` reports syntax error

**Cause**: Invalid JSON (missing comma, extra comma, unquoted strings, etc.)

**Fix**: Use `jq` to validate and identify the error

```bash
cat content/courses/your-course.json | jq .
# jq will report the line number and type of syntax error
```

Common issues:
- Trailing commas in arrays or objects
- Missing quotes around string values
- Unclosed braces or brackets

### Sync Completes But Course Not Visible

**Symptom**: `npm run sync:courses` succeeds but course doesn't appear on `/learn/courses`

**Cause**: Table not published or cache delay

**Fix**: Verify table publish and wait briefly

```bash
# Check sync output
npm run sync:courses 2>&1 | grep -i "published"

# Wait 30 seconds for HubSpot cache, then check live site
```

### Estimated Minutes is 0 or Incorrect

**Symptom**: Course page shows 0 minutes or wrong duration

**Cause**: Module front matter missing `estimated_minutes` or sync didn't read it

**Fix**: Add `estimated_minutes` to module front matter and resync

```bash
# Check module front matter
head -20 content/modules/intro-to-kubernetes/README.md | grep estimated_minutes

# If missing, add to front matter:
# estimated_minutes: 30
```

Then resync both modules and courses:

```bash
npm run sync:content
npm run sync:courses
```

## Resources

- [Course Authoring Guide](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/course-authoring.md) - Official authoring reference
- [Content Sync Runbook](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/content-sync.md) - Technical sync details
- [Module Template](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/templates/module-README-template.md) - How to create modules
- [HubDB Documentation](https://developers.hubspot.com/docs/cms/data/hubdb) - Understanding HubDB tables
- [Existing Courses](https://github.com/hedgehog-cloud/hh-learn/tree/main/content/courses) - Examples to reference
