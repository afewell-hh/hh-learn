---
title: Contributor Guide – Hedgehog Learn
owner: hh-learn content lead
status: living
last-reviewed: 2025-10-14
---

# Contributor Guide – Hedgehog Learn

This guide walks you through the end-to-end process of authoring, testing, and publishing learning modules for Hedgehog Learn. Whether you're a subject-matter expert contributing your first module or an experienced author, this guide provides the step-by-step workflow you need.

For detailed content standards and requirements, see the [Content Standard](content-standard.md).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (10 Minutes)](#quick-start-10-minutes)
- [Detailed Authoring Workflow](#detailed-authoring-workflow)
- [Local Development](#local-development)
- [Content Validation](#content-validation)
- [Sync to HubDB](#sync-to-hubdb)
- [Verification](#verification)
- [Git Workflow](#git-workflow)
- [Publishing](#publishing)
- [Troubleshooting](#troubleshooting)
- [Getting Help](#getting-help)

## Prerequisites

Before you begin, ensure you have:

- **GitHub access**: Write access to the `hh-learn` repository
- **Node.js**: Version 18+ (Node 22 LTS recommended)
- **Git**: Installed and configured
- **Text editor**: VS Code, Sublime, vim, or your preferred editor
- **Command-line proficiency**: Basic familiarity with terminal commands

Optional (for local sync):
- **HubSpot private app token**: For syncing content to HubDB (ask the content lead)

## Quick Start (10 Minutes)

This quick start gets you from idea to draft in under 10 minutes:

### 1. Clone the Repository

```bash
git clone https://github.com/afewell-hh/hh-learn.git
cd hh-learn
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Your Module Folder

```bash
# Choose a descriptive slug (lowercase, hyphens only)
SLUG="intro-to-docker"
mkdir -p content/modules/$SLUG
```

### 4. Copy the Template

```bash
cp docs/templates/module-README-template.md content/modules/$SLUG/README.md
```

### 5. Edit the Front Matter

Open `content/modules/$SLUG/README.md` and update the front matter:

```yaml
---
title: "Introduction to Docker"
slug: "intro-to-docker"
difficulty: "beginner"
estimated_minutes: 45
tags: [docker, containers, getting-started]
description: "Learn Docker fundamentals by building and running your first containerized application in under an hour."
order: 100
---
```

### 6. Write Your Content

Fill in the required sections:
- **Learning Objectives**: 4–7 specific, actionable outcomes
- **Prerequisites**: Required knowledge, tools, and access
- **Scenario**: Realistic context for the learner
- **Lab Steps**: Hands-on commands with validation checks
- **Concepts & Deep Dive**: Explanations and background
- **Troubleshooting**: Common issues and fixes
- **Resources**: Links to official docs

### 7. Preview Locally

```bash
# View your markdown in your editor or use a markdown previewer
code content/modules/$SLUG/README.md
```

### 8. Open a Pull Request

```bash
git checkout -b module/$SLUG
git add content/modules/$SLUG/
git commit -m "feat(content): add $SLUG module"
git push origin module/$SLUG
# Open PR on GitHub
```

### 9. Request Review

Tag a reviewer in your PR and link to issue if applicable.

After merge, the content will sync automatically via CI (or run `npm run sync:content` manually).

## Detailed Authoring Workflow

### Step 1: Plan Your Module

Before writing, answer these questions:

1. **Who is the learner?**
   - Beginner, intermediate, or advanced?
   - What do they already know?

2. **What will they achieve?**
   - What specific skills or knowledge will they gain?
   - What will they build or deploy?

3. **What's the realistic scenario?**
   - What real-world problem does this solve?
   - What persona are they role-playing?

4. **What's the scope?**
   - 30–60 minutes for beginners
   - 45–90 minutes for intermediate
   - 60–120 minutes for advanced

### Step 2: Set Up Your Environment

#### Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b module/your-module-slug
```

#### Create Module Directory

```bash
SLUG="your-module-slug"
mkdir -p content/modules/$SLUG
```

### Step 3: Author Content

#### Copy Template

```bash
cp docs/templates/module-README-template.md content/modules/$SLUG/README.md
```

#### Write Front Matter

Refer to the [Content Standard](content-standard.md) § Front Matter Requirements for field details.

Example:
```yaml
---
title: "Deploy a Kubernetes Cluster on AWS"
slug: "deploy-k8s-on-aws"
difficulty: "intermediate"
estimated_minutes: 75
version: "k8s v1.30"
validated_on: "2025-10-14"
tags: [kubernetes, aws, eks, cloud-native]
description: "Deploy a production-ready Kubernetes cluster on AWS using eksctl, configure kubectl access, and verify cluster health."
order: 200
---
```

#### Write Sections

Follow the required structure from the [Content Standard](content-standard.md):

1. **Title (H1)**: Matches `title` field
2. **Introduction**: 2–3 sentences on what learners will do
3. **Learning Objectives**: 4–7 bulleted outcomes
4. **Prerequisites**: Tools, knowledge, and access required
5. **Scenario**: Realistic context (2–4 sentences)
6. **Lab Steps**: Numbered H3 subsections with commands and validation
7. **Concepts & Deep Dive**: Explanations and theory
8. **Troubleshooting**: Common issues with symptom/cause/fix
9. **Resources**: Links to official docs and tools

### Step 4: Add Images (Optional)

If your module includes screenshots or diagrams:

```bash
mkdir -p content/modules/$SLUG/images
```

Add images:
```markdown
![Kubernetes architecture diagram](./images/k8s-architecture.png)
```

Image guidelines:
- Use web-optimized formats (PNG, JPG, WebP)
- Compress images before committing
- Maximum width: 1200px
- Always include descriptive alt text

### Step 5: Test Commands

**IMPORTANT**: Test every command in your lab steps to ensure accuracy.

1. **Set up test environment**: Provision the prerequisites (cluster, tools, etc.)
2. **Run each command**: Copy and paste from your module
3. **Verify output**: Ensure validation checks produce expected results
4. **Document issues**: Note any errors or edge cases for troubleshooting

### Step 6: Self-Review

Use the QA checklist from the [Content Standard](content-standard.md) § Quality Assurance Checklist:

- [ ] All required sections present
- [ ] Front matter complete and valid
- [ ] Description is 120–160 characters
- [ ] All code blocks have language hints
- [ ] Commands are tested and validated
- [ ] Troubleshooting covers common errors
- [ ] Links are valid and descriptive
- [ ] Images include alt text
- [ ] Only one H1 heading
- [ ] No broken links

## Local Development

### Running the Sync Script Locally

You can test the sync script locally before opening a PR.

#### Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and add:
```env
HUBSPOT_PROJECT_ACCESS_TOKEN=pat-na1-your-token-here
HUBDB_MODULES_TABLE_ID=your-table-id
```

Ask the content lead for these values if you don't have them.

#### Dry-Run Mode

Preview what will sync without making changes:

```bash
npm run sync:content -- --dry-run
```

This outputs the HTML payload and shows what would be written to HubDB.

#### Live Sync

Sync your module to HubDB:

```bash
npm run sync:content
```

Expected output:
```
🔄 Starting content sync to HubDB...

✓ Synced: intro-to-docker
✓ Synced: kubernetes-networking
✓ Table published

Summary: 2 succeeded, 0 failed
```

### Preview Your Module

After syncing, visit the module page:

**Production URL:**
```
https://hedgehog.cloud/learn/<slug>
```

**Debug URL** (shows metadata):
```
https://hedgehog.cloud/learn/<slug>?debug=1
```

Verify:
- Module card appears on `/learn` list page
- Detail page renders correctly
- Debug banner shows "has full_content? true"
- Images load correctly
- Links work

## Content Validation

### Markdown Validation

Use a markdown linter to catch syntax issues:

```bash
# Install markdownlint-cli (optional)
npm install -g markdownlint-cli

# Run on your module
markdownlint content/modules/your-module-slug/README.md
```

### Front Matter Validation

Ensure front matter is valid YAML:

```bash
# Check YAML syntax (requires yq or similar)
yq eval content/modules/your-module-slug/README.md > /dev/null
```

If YAML is invalid, sync will fail.

### Link Checking

Verify external links are not broken:

```bash
# Install markdown-link-check (optional)
npm install -g markdown-link-check

# Check links
markdown-link-check content/modules/your-module-slug/README.md
```

## Sync to HubDB

### How Sync Works

The `npm run sync:content` script:

1. Reads all `content/modules/*/README.md` files
2. Parses front matter and markdown
3. Converts markdown to HTML
4. Creates or updates HubDB rows by `slug`
5. Publishes the HubDB table

### Sync Modes

**Dry-run** (preview only):
```bash
npm run sync:content -- --dry-run
```

**Live sync** (writes to HubDB):
```bash
npm run sync:content
```

### Deletion Behavior

By default, the sync script **deletes** HubDB rows for modules not found in `content/modules/`.

To prevent deletions:
```bash
SYNC_DELETE_MISSING=false npm run sync:content
```

### Archiving Modules

To archive a module without deleting it:

**Option 1**: Move to archive folder
```bash
mv content/modules/old-module content/archive/old-module
npm run sync:content
```

**Option 2**: Add `archived: true` to front matter
```yaml
---
title: "Old Module"
slug: "old-module"
archived: true
---
```

Archived modules are hidden from list views but remain accessible via direct link.

## Verification

### Pre-Sync Checklist

Before running sync, verify:

- [ ] Module folder name matches `slug` field
- [ ] Front matter is valid YAML
- [ ] All required fields are present
- [ ] Description is 120–160 characters
- [ ] Code blocks include language hints
- [ ] No broken internal links
- [ ] Images are optimized and include alt text

### Post-Sync Verification

After syncing, verify:

1. **List page**: Visit `/learn` and confirm module card appears
2. **Detail page**: Visit `/learn/<slug>` and check rendering
3. **Debug mode**: Visit `/learn/<slug>?debug=1` and verify:
   - "has full_content? true"
   - Metadata is correct (title, difficulty, tags)
4. **Mobile view**: Check responsive rendering
5. **Social preview**: Share URL and verify preview card

### Common Sync Issues

See [Content Sync Runbook](content-sync.md) § Troubleshooting for detailed solutions.

**WAF/Cloudflare blocks:**
- Avoid raw HTTP `Host:` headers in examples
- Use `curl --resolve` instead of `Host:` header examples
- Prefer `curl` over `wget` in code examples

**Missing content:**
- Verify `slug` matches folder name exactly
- Check for invalid YAML in front matter
- Ensure no unclosed code blocks

**Rate limiting:**
- The sync script includes automatic backoff and retry
- Wait 1–2 minutes between manual syncs

## Git Workflow

### Branch Naming

Use descriptive branch names:

```bash
# New module
git checkout -b module/intro-to-docker

# Update existing module
git checkout -b update/k8s-networking-refresh

# Fix typo or bug
git checkout -b fix/broken-links-in-intro-k8s
```

### Commit Messages

Follow conventional commit format:

```bash
# New module
git commit -m "feat(content): add intro-to-docker module"

# Update module
git commit -m "docs(content): refresh kubernetes-networking for v1.30"

# Fix issue
git commit -m "fix(content): correct broken links in intro-to-kubernetes"
```

Reference issue numbers:
```bash
git commit -m "feat(content): add intro-to-docker module (#118)"
```

### Opening a Pull Request

1. **Push your branch:**
   ```bash
   git push origin module/intro-to-docker
   ```

2. **Open PR on GitHub:**
   - Navigate to the repository
   - Click "Compare & pull request"
   - Fill in the PR template
   - Link related issue(s)

3. **PR Title:**
   ```
   feat(content): Add intro-to-docker module (#118)
   ```

4. **PR Description:**
   - Summarize changes
   - Link to issue
   - Include screenshots if applicable
   - Mention any sync considerations

5. **Request Review:**
   - Tag a reviewer (or use auto-assign)
   - Respond to feedback promptly

### Addressing Feedback

1. Make requested changes in your branch
2. Commit changes:
   ```bash
   git add .
   git commit -m "docs: address review feedback"
   git push origin module/intro-to-docker
   ```
3. Reply to review comments
4. Wait for approval

### Merging

After approval:
- Reviewer or author merges PR via GitHub UI
- CI automatically syncs content (or run manually)
- Verify live site reflects changes

## Publishing

### Automatic Publishing (CI)

When you merge to `main`, GitHub Actions automatically:
1. Runs `npm run sync:content`
2. Publishes HubDB table
3. Reports success or failure

Check the Actions tab for status.

### Manual Publishing

If CI is disabled or you need to publish immediately:

```bash
git checkout main
git pull origin main
npm run sync:content
```

### Verifying Publication

After publishing, verify:

1. **HubDB table**: Check HubSpot Design Manager → HubDB → Modules table
2. **List page**: Visit `/learn` and confirm module appears
3. **Detail page**: Visit `/learn/<slug>` and verify rendering
4. **Debug mode**: Visit `/learn/<slug>?debug=1` for metadata check

## Troubleshooting

### Issue: Sync Fails with "requiredGranularScopes: [hubdb]"

**Cause**: Project App installation missing HubDB scopes

**Fix**:
1. Update `src/app/app-hsmeta.json` with required scopes (if needed)
2. Deploy the Project App and accept the updated installation scopes
3. Regenerate the Project App access token
4. Update `.env` or CI secrets

### Issue: Module Not Appearing on List Page

**Cause**: Sync succeeded but module is hidden or archived

**Fix**:
- Verify `archived: true` is NOT in front matter
- Check that `slug` matches folder name exactly
- Run `npm run sync:content` again
- Clear browser cache and reload

### Issue: Commands in Module Don't Work

**Cause**: Commands were not tested in a real environment

**Fix**:
- Provision a test environment
- Run each command step-by-step
- Update module with correct commands
- Add troubleshooting section for common errors

### Issue: Images Not Loading

**Cause**: Image path is incorrect or image not committed

**Fix**:
- Verify image exists in `content/modules/<slug>/images/`
- Use relative path: `./images/diagram.png`
- Commit image files:
  ```bash
  git add content/modules/<slug>/images/
  git commit -m "docs: add images for <slug> module"
  ```

### Issue: WAF Blocks Sync

**Cause**: HubSpot Cloudflare WAF blocks suspicious content

**Fix**:
- Avoid raw HTTP headers in code examples
- Use `curl --resolve` instead of `Host:` header examples
- Prefer `curl` over `wget`
- Split large modules into smaller ones

See [Content Sync Runbook](content-sync.md) § Troubleshooting for more details.

## Getting Help

### Documentation

- [Content Standard](content-standard.md) — Normative content requirements
- [Course Authoring Guide](course-authoring.md) — Full reference for courses and pathways
- [Content Sync Runbook](content-sync.md) — Technical sync details
- [Project Management Guide](project-management.md) — GitHub workflow

### Asking Questions

- **Slack/Teams**: Ping the content lead or platform team
- **GitHub Issues**: Open an issue with label `type/docs` or `help-wanted`
- **GitHub Discussions**: Start a discussion for open-ended questions

### Reporting Issues

If you encounter a bug or sync issue:

1. Open a GitHub issue with label `type/bug`
2. Include:
   - Module slug
   - Sync output (if applicable)
   - Error messages
   - Steps to reproduce
3. Tag the content lead or platform team

## Best Practices

### Content Quality

- **Test everything**: Run all commands in a real environment
- **Be specific**: Use concrete examples and realistic scenarios
- **Stay current**: Validate content against latest product versions
- **Link to official docs**: Provide authoritative references
- **Be inclusive**: Use inclusive language and diverse examples

### Workflow Efficiency

- **Small PRs**: One module per PR for easier review
- **Commit often**: Small, logical commits with clear messages
- **Sync early**: Test sync locally before opening PR
- **Review your own work**: Self-review before requesting review

### Collaboration

- **Respond to feedback**: Address review comments promptly
- **Ask questions**: Clarify requirements before starting
- **Share knowledge**: Document edge cases and gotchas
- **Help others**: Review PRs and answer questions

## Appendix: Checklist Summary

Use this checklist when authoring a module:

### Planning
- [ ] Identified target learner (beginner/intermediate/advanced)
- [ ] Defined 4–7 specific learning objectives
- [ ] Created realistic scenario with clear persona
- [ ] Estimated completion time

### Authoring
- [ ] Copied template to `content/modules/<slug>/README.md`
- [ ] Filled in all required front matter fields
- [ ] Wrote introduction and learning objectives
- [ ] Listed prerequisites with links
- [ ] Created realistic scenario context
- [ ] Wrote sequential lab steps with validation checks
- [ ] Added concepts and explanations
- [ ] Included troubleshooting section
- [ ] Listed resources with authoritative links

### Testing
- [ ] Tested all commands in real environment
- [ ] Verified validation checks work
- [ ] Checked all links (internal and external)
- [ ] Reviewed formatting and structure
- [ ] Ran dry-run sync locally

### Review
- [ ] Self-reviewed against content standard
- [ ] Completed QA checklist
- [ ] Committed and pushed to feature branch
- [ ] Opened PR with descriptive title and summary
- [ ] Requested review from appropriate reviewer

### Publishing
- [ ] PR approved and merged
- [ ] CI sync completed successfully (or ran manually)
- [ ] Verified module appears on list page
- [ ] Verified detail page renders correctly
- [ ] Checked debug mode for metadata accuracy

## Changelog

- **2025-10-14**: Initial version published as part of issue #107

## Feedback

This guide is a living document. To propose improvements:
- Open a GitHub issue with label `type/docs`
- Submit a PR updating this file
- Discuss with the content lead

All feedback is welcome!
