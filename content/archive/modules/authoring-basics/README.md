---
title: "Authoring Basics: Modules, Front Matter, and Sync"
slug: "authoring-basics"
difficulty: "beginner"
estimated_minutes: 30
version: "v0.2"
validated_on: "2025-10-14"
tags:
  - content-authoring
  - modules
  - documentation
  - getting-started
description: "Learn the fundamentals of creating learning modules for the Hedgehog Learn platform, including front matter configuration, Markdown authoring, and syncing content to HubDB."
order: 100
---

# Authoring Basics: Modules, Front Matter, and Sync

Welcome to module authoring! This guide will teach you how to create high-quality learning modules for the Hedgehog Learn platform. You'll learn the repository structure, front matter requirements, Markdown authoring best practices, and how to sync your content to HubDB.

## Learning Objectives

- Understand the Hedgehog Learn content repository structure
- Create a well-structured module with proper front matter
- Author effective learning content using Markdown
- Sync your module to HubDB and verify it renders correctly
- Troubleshoot common authoring and sync issues

## Prerequisites

- Basic familiarity with Markdown syntax
- Git and GitHub basics (cloning, branches, commits, pull requests)
- Node 18+ installed (Node 22 LTS recommended)
- Text editor or IDE (VS Code, Vim, etc.)
- Access to the hh-learn repository
- HubSpot private app token configured in `.env` file (for syncing)

## Scenario: Creating Your First Module

You're a subject-matter expert joining the Hedgehog Learn content team. You'll create your first module from scratch, learning the platform's authoring conventions, and publish it to the learning portal.

### Step 1: Understand the Repository Structure

The content repository follows a clear structure:

```bash
# Navigate to the repository
cd hh-learn

# Explore the content structure
tree content/ -L 2
```

You'll see:

```
content/
├── modules/          # Individual learning modules
│   ├── intro-to-kubernetes/
│   │   └── README.md
│   ├── kubernetes-networking/
│   │   └── README.md
│   └── ...
├── courses/          # Course JSON files
│   └── kubernetes-essentials.json
└── pathways/         # Pathway JSON files
    └── getting-started.json
```

**Key structure points:**
- Each module lives in its own directory under `content/modules/`
- The directory name should match your module slug (lowercase, hyphen-separated)
- Module content goes in `README.md` (required)
- Optional `meta.json` can provide structured metadata

### Step 2: Review the Module Template

Before creating your module, review the template to understand the expected structure:

```bash
# View the module template
cat docs/templates/module-README-template.md
```

The template includes:
- Front matter (YAML between `---` markers)
- Main title (H1)
- Learning objectives
- Prerequisites
- Step-by-step scenario with commands and validation
- Concepts section
- Troubleshooting
- Resources

**Important:** The template is your guide - copy and adapt it for your module.

### Step 3: Create Your Module Directory

Create a new module directory. We'll create a sample module about Git basics:

```bash
# Create module directory (use your actual module slug)
mkdir -p content/modules/git-basics

# Navigate into it
cd content/modules/git-basics
```

**Naming conventions:**
- Use lowercase letters
- Separate words with hyphens
- Keep it concise but descriptive (e.g., `intro-to-docker`, `kubernetes-storage`)
- Match the slug you'll use in front matter

### Step 4: Create Front Matter

Front matter is YAML metadata at the top of your README.md file. It defines how your module appears in listings and provides essential metadata.

Create your README.md with front matter:

```bash
cat > README.md << 'EOF'
---
title: "Git Basics: Version Control Fundamentals"
slug: "git-basics"
difficulty: "beginner"
estimated_minutes: 20
version: "v2.43"
validated_on: "2025-10-14"
tags:
  - git
  - version-control
  - getting-started
  - devops
description: "Learn the fundamentals of Git version control including repositories, commits, branches, and collaboration workflows."
order: 50
---

# Git Basics: Version Control Fundamentals

(Your content will go here)
EOF
```

**Required front matter fields:**
- `title` (string): Display title for the module
- `slug` (string): URL slug - must match directory name
- `difficulty` (enum): `beginner`, `intermediate`, or `advanced`
- `estimated_minutes` (number): Time to complete (be realistic)
- `tags` (array): Topical tags for filtering
- `description` (string): 120-160 chars for cards and SEO

**Recommended fields:**
- `version` (string): Product/tool version the content targets
- `validated_on` (YYYY-MM-DD): Last validation date
- `order` (integer): Sorting weight in lists (lower = earlier)

Verify your front matter:

```bash
# Check front matter is valid YAML
head -20 README.md
```

### Step 5: Write Learning Objectives

Learning objectives tell learners what they'll achieve. Write clear, action-oriented objectives:

```bash
cat >> README.md << 'EOF'

## Learning Objectives

- Initialize a new Git repository and understand the `.git` directory
- Create commits and write effective commit messages
- Work with branches for parallel development
- Merge branches and resolve conflicts
- Collaborate using remote repositories
EOF
```

**Best practices:**
- Start with action verbs (Create, Deploy, Configure, Understand)
- Be specific and measurable
- List 3-5 objectives
- Focus on outcomes, not activities

### Step 6: Define Prerequisites

Prerequisites help learners assess readiness. Be explicit about what's needed:

```bash
cat >> README.md << 'EOF'

## Prerequisites

- Command-line familiarity (navigating directories, running commands)
- Git installed on your local machine (verify with `git --version`)
- Text editor of your choice
- GitHub account (for collaboration exercises)

If you don't have Git installed, visit [git-scm.com](https://git-scm.com/downloads) to download it.
EOF
```

**Types of prerequisites:**
- Tool/software requirements
- Prior knowledge or modules
- Access requirements (accounts, credentials)
- Environment setup

For internal module references, you can use just the slug (e.g., `intro-to-kubernetes`) and the system will auto-link it.

### Step 7: Author Scenario-Based Content

The core of your module should be a realistic, hands-on scenario with executable commands:

```bash
cat >> README.md << 'EOF'

## Scenario: Your First Git Repository

You're starting a new project and want to track changes with Git. You'll initialize a repository, make commits, create branches, and collaborate with a team.

### Step 1: Initialize a Repository

Create a new directory and initialize Git:

\`\`\`bash
mkdir my-project
cd my-project
git init
\`\`\`

This creates a hidden `.git` directory containing all version control data.

Verify initialization:

\`\`\`bash
ls -la
git status
\`\`\`

You should see:
- `.git/` directory
- Output: "On branch main. No commits yet."

### Step 2: Create Your First Commit

Create a file and commit it:

\`\`\`bash
echo "# My Project" > README.md
git add README.md
git commit -m "Initial commit: Add README"
\`\`\`

View your commit history:

\`\`\`bash
git log --oneline
\`\`\`

You'll see your commit with its hash and message.
EOF
```

**Authoring best practices:**
- **Be concrete:** Every step should have commands
- **Add validation:** Show how to verify each step succeeded
- **Use code blocks:** Always specify language (```bash, ```yaml, etc.)
- **Explain first, command second:** Brief explanation, then executable code
- **Realistic scenarios:** "Day in the life" situations, not abstract exercises

### Step 8: Add Concepts Section

After the hands-on scenario, provide deeper conceptual explanations:

```bash
cat >> README.md << 'EOF'

## Concepts & Deep Dive

### What is Git?

Git is a distributed version control system that tracks changes in files. Unlike centralized systems, every developer has a complete copy of the repository history.

### The Git Workflow

Git follows a three-stage workflow:

1. **Working Directory:** Your local files where you make changes
2. **Staging Area (Index):** Where you prepare commits with `git add`
3. **Repository (.git):** Where committed history is permanently stored

### Branches Explained

Branches allow parallel development without affecting the main codebase. The default branch is typically `main` or `master`.

Common branching strategies:
- **Feature branches:** Develop new features in isolation
- **Release branches:** Prepare releases
- **Hotfix branches:** Quick fixes for production issues
EOF
```

**Concepts section tips:**
- Separate from executable steps
- Explain the "why" behind the commands
- Use diagrams if helpful (Markdown images)
- Link to authoritative external docs

### Step 9: Add Troubleshooting Guidance

Help learners overcome common issues:

```bash
cat >> README.md << 'EOF'

## Troubleshooting

### Issue: "fatal: not a git repository"

**Symptom:** Git commands fail with this error

**Cause:** You're not in a directory with a `.git` folder

**Fix:** Navigate to your repository or initialize Git:

\`\`\`bash
cd /path/to/your/project
git status  # Verify you're in the right place
\`\`\`

### Issue: Merge Conflicts

**Symptom:** Git reports conflicts during merge

**Cause:** Same lines modified in both branches

**Fix:** Open conflicted files, resolve markers, then:

\`\`\`bash
git add <resolved-file>
git commit -m "Resolve merge conflict"
\`\`\`

Look for conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`
EOF
```

**Troubleshooting format:**
- **Symptom** → **Cause** → **Fix**
- Include commands for resolution
- Address common learner pain points

### Step 10: Add Resources

Provide links to official documentation and learning resources:

```bash
cat >> README.md << 'EOF'

## Resources

- [Official Git Documentation](https://git-scm.com/doc)
- [Pro Git Book](https://git-scm.com/book/en/v2) - Free comprehensive guide
- [GitHub Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [Git Branching Interactive Tutorial](https://learngitbranching.js.org/)
- [Atlassian Git Tutorials](https://www.atlassian.com/git/tutorials)
EOF
```

**Resource guidelines:**
- Prefer official documentation
- Include interactive learning tools
- Add cheat sheets and quick references
- Verify all links work

### Step 11: Validate Your Module Locally

Before syncing, validate your module content:

```bash
# Check front matter is valid YAML
head -20 content/modules/git-basics/README.md

# Verify all code blocks have language hints
grep -n '```$' content/modules/git-basics/README.md
# Should return empty - all should be ```bash, ```yaml, etc.

# Check description length (aim for 120-160 chars)
grep "^description:" content/modules/git-basics/README.md | wc -c

# Verify slug matches directory name
basename $(pwd)  # Should match slug in front matter
```

**Validation checklist:**
- ✅ Front matter present with all required fields
- ✅ Slug matches directory name
- ✅ All code blocks specify language
- ✅ Description is 120-160 characters
- ✅ At least 3 learning objectives
- ✅ Realistic scenario with commands and validation
- ✅ Troubleshooting section included
- ✅ Resources linked

### Step 12: Sync to HubDB

Once your module is ready, sync it to HubDB to publish:

```bash
# Ensure you're in the repository root
cd /path/to/hh-learn

# Run the sync script
npm run sync:content
```

The sync script:
1. Scans `content/modules/` for README.md files
2. Parses front matter and converts Markdown to HTML
3. Creates/updates HubDB rows by `hs_path` (slug)
4. Publishes the table

Expected output:
```
✓ Updated: Git Basics: Version Control Fundamentals
✅ Sync complete! Table published.
Summary: 1 succeeded, 0 failed
```

If sync fails, check:
- `.env` file has `HUBSPOT_PRIVATE_APP_TOKEN`
- `HUBDB_MODULES_TABLE_ID` is set
- No YAML syntax errors in front matter
- No suspicious content triggering WAF (see troubleshooting)

### Step 13: Verify Your Published Module

Visit your module page to confirm it renders correctly:

```bash
echo "Live URL: https://hedgehog.cloud/learn/git-basics"
echo "Debug URL: https://hedgehog.cloud/learn/git-basics?debug=1"
```

**Debug view checklist:**
- `has full_content? true` appears in debug banner
- Module slug matches your slug
- Estimated minutes displays correctly
- All sections render (objectives, scenario, troubleshooting, resources)
- Code blocks have syntax highlighting
- Links are clickable and work

If something looks wrong, edit your README.md and re-sync.

### Step 14: Create a Pull Request

Once verified, commit your module and open a PR:

```bash
# Create a feature branch
git checkout -b add-git-basics-module

# Stage and commit your module
git add content/modules/git-basics/
git commit -m "Add Git Basics module

- Add learning objectives and prerequisites
- Include hands-on scenario with validation steps
- Add concepts, troubleshooting, and resources
- Tested and verified on staging

Closes #XXX"

# Push to GitHub
git push origin add-git-basics-module

# Open PR via GitHub CLI
gh pr create --title "Add Git Basics module" \
  --body "Adds a new beginner-level module covering Git fundamentals.

## Summary
- Covers repository initialization, commits, branches, and collaboration
- Includes 14-step hands-on scenario
- Estimated duration: 20 minutes

## Verification
- [x] Module synced to HubDB successfully
- [x] Page renders correctly with full_content
- [x] All links validated
- [x] Code blocks tested

Preview: https://hedgehog.cloud/learn/git-basics?debug=1"
```

**PR best practices:**
- Reference the issue number (`Closes #XXX`)
- Include verification checklist
- Link to debug URL
- Request review from content lead

## Concepts & Deep Dive

### The Module Lifecycle

Modules progress through several stages:

1. **Authoring:** Create README.md with front matter and content
2. **Local Validation:** Check YAML, links, and structure
3. **Sync:** Push to HubDB via `npm run sync:content`
4. **Verification:** Test rendering with `?debug=1`
5. **Review:** Open PR for team review
6. **Publish:** Merge to main, CI syncs automatically

### Front Matter Deep Dive

Front matter is YAML metadata parsed by the sync script. The sync script:

1. Extracts front matter between `---` markers
2. Validates required fields
3. Maps fields to HubDB columns:
   - `title` → `hs_name` (system field)
   - `slug` → `hs_path` (system field)
   - `description` → `meta_description`
   - `difficulty` → `difficulty` (Select column with IDs 1/2/3)
   - `estimated_minutes` → `estimated_minutes`
   - `tags` → `tags` (comma-separated string)

The content below front matter is converted from Markdown to HTML and stored in `full_content` (Rich Text column).

### Markdown to HTML Conversion

The sync script uses a Markdown processor with:

- GitHub Flavored Markdown support
- Code block syntax highlighting (requires language hints)
- Auto-linking for URLs
- Table support
- Task list support

**Important:** The `full_content` field is HTML, not Markdown. Templates render it directly without further processing.

### The HubDB Modules Table

Modules are stored in HubDB with this schema:

| Column | Type | Purpose |
|--------|------|---------|
| `hs_name` | System | Module title (from `title`) |
| `hs_path` | System | URL slug (from `slug`) |
| `title` | Text | Module title (duplicate for HubL filtering) |
| `slug` | Text | URL slug (duplicate for cross-table refs) |
| `meta_description` | Text | SEO description (from `description`) |
| `difficulty` | Select | Beginner/Intermediate/Advanced |
| `estimated_minutes` | Number | Completion time |
| `tags` | Text | Comma-separated topics |
| `full_content` | Rich Text | HTML body |
| `display_order` | Number | Sorting weight |

The `hs_path` field drives dynamic page routing: `/learn/<hs_path>` maps to the corresponding row.

### Archiving and Deletion

You can archive or delete modules:

**Soft archive (recommended):**
```bash
# Move to archive directory
mv content/modules/old-module content/archive/old-module

# Or add to front matter
archived: true
```

After syncing, archived modules:
- Stay in HubDB but marked as archived
- Hidden from list views
- Show "archived" banner on detail pages

**Hard delete:**
```bash
# Remove from repository
rm -rf content/modules/old-module

# Sync will delete the HubDB row
npm run sync:content
```

Set `SYNC_DELETE_MISSING=false` in `.env` to prevent deletions.

### CI/CD Integration

The repository includes GitHub Actions that automatically sync content on pushes to `main`:

```yaml
# .github/workflows/sync-content.yml triggers on:
- Push to main
- Changes to content/modules/**
```

This means:
1. Author locally
2. Open PR
3. Merge to main
4. CI syncs automatically

Manual syncing is only needed for local testing or staging environments.

## Troubleshooting

### Front Matter Validation Errors

**Symptom:** Sync fails with "Invalid front matter" or "Missing required field"

**Cause:** YAML syntax error or missing required field

**Fix:** Validate YAML syntax:

```bash
# Check for common issues
head -20 content/modules/your-module/README.md

# Common problems:
# - Missing closing `---`
# - Unquoted strings with colons or special chars
# - Incorrect indentation in tags array
```

Fix example:
```yaml
# ❌ Wrong
tags: git, version-control  # Should be array

# ✅ Right
tags:
  - git
  - version-control
```

### Cloudflare WAF Blocks

**Symptom:** Sync fails with "Cannot parse content" or Cloudflare block detected

**Cause:** HubSpot WAF rejects content with suspicious patterns (raw HTTP headers, IP addresses, `wget` commands)

**Fix:** Simplify problematic content:

```bash
# ❌ Avoid
wget http://example.com
Host: example.com

# ✅ Prefer
curl --resolve example.com:80:127.0.0.1 http://example.com
curl -o file.tar.gz https://example.com/file.tar.gz
```

If unavoidable, upload directly via HubSpot UI as a workaround (document in PR).

### Code Blocks Without Language

**Symptom:** Code blocks render without syntax highlighting

**Cause:** Missing language hint in code fence

**Fix:** Always specify language:

```bash
# ❌ Wrong
```
git commit -m "message"
```  # (no language)

# ✅ Right
```bash
git commit -m "message"
```  # (bash specified)
```

Search for generic code blocks:
```bash
grep -n '^```$' content/modules/your-module/README.md
```

### Module Not Appearing in List

**Symptom:** Sync succeeds but module doesn't show on `/learn`

**Cause:** Table not published or module marked as archived

**Fix:** Check sync output:

```bash
npm run sync:content 2>&1 | grep -i "publish"
# Should show: "✅ Sync complete! Table published."
```

If table didn't publish, check HubSpot permissions or publish manually via Design Manager → HubDB.

Also check front matter for `archived: true`.

### Description Too Long or Short

**Symptom:** Description doesn't fit on cards or truncates awkwardly

**Cause:** Description outside 120-160 character range

**Fix:** Count characters and edit:

```bash
# Check current length
grep "^description:" content/modules/your-module/README.md | wc -c

# Aim for 120-160 characters (including "description: " prefix)
```

**Good description example:**
```yaml
description: "Learn Git fundamentals including repositories, commits, branches, and collaboration workflows for effective version control."  # 140 chars
```

### Slug Mismatch

**Symptom:** Module renders but URL doesn't match expectations

**Cause:** Slug in front matter doesn't match directory name

**Fix:** Ensure they match exactly:

```bash
# Check directory name
basename $(pwd)
# Returns: git-basics

# Check slug in front matter
grep "^slug:" README.md
# Should show: slug: "git-basics"
```

The slug should be:
- Lowercase
- Hyphen-separated (not underscores)
- Match the directory name exactly

## Resources

- [Course Authoring Guide](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/course-authoring.md) - Comprehensive authoring reference
- [Module README Template](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/templates/module-README-template.md) - Copy this to start
- [Module Meta Template](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/templates/module-meta-template.json) - Optional structured metadata
- [Content Sync Runbook](https://github.com/hedgehog-cloud/hh-learn/blob/main/docs/content-sync.md) - Technical sync details
- [Markdown Guide](https://www.markdownguide.org/) - Markdown syntax reference
- [YAML Syntax](https://yaml.org/spec/1.2.2/) - YAML specification
- [GitHub Flavored Markdown](https://github.github.com/gfm/) - Markdown variant we use
- [Existing Modules](https://github.com/hedgehog-cloud/hh-learn/tree/main/content/modules) - Learn by example
