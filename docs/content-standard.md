---
title: Hedgehog Learn Module Content Standard
owner: hh-learn content lead
status: normative
last-reviewed: 2025-10-14
---

# Hedgehog Learn Module Content Standard

This document defines the normative standard for module content on Hedgehog Learn. All modules must conform to these requirements to ensure consistency, quality, and maintainability.

For step-by-step instructions on authoring and publishing modules, see the [Contributor Guide](contributor-guide.md).

## Table of Contents

- [Purpose](#purpose)
- [Module Structure](#module-structure)
- [Front Matter Requirements](#front-matter-requirements)
- [Content Guidelines](#content-guidelines)
- [Formatting Standards](#formatting-standards)
- [Metadata Standards](#metadata-standards)
- [Quality Assurance Checklist](#quality-assurance-checklist)
- [Sync and Publication](#sync-and-publication)
- [Maintenance and Updates](#maintenance-and-updates)
- [Examples and Templates](#examples-and-templates)
- [Review and Approval](#review-and-approval)
- [Feedback and Iteration](#feedback-and-iteration)
- [Related Documentation](#related-documentation)

## Purpose

This standard ensures:
- Consistent structure and quality across all learning modules
- Predictable experience for learners
- Maintainability and searchability of content
- Proper metadata for discovery, filtering, and analytics
- Accessibility and SEO compliance

## Module Structure

### Required Sections

Every module MUST include these sections in the following order:

1. **Front Matter** (YAML)
2. **Title** (H1)
3. **Introduction** (paragraph)
4. **Learning Objectives** (H2 + bulleted list)
5. **Prerequisites** (H2 + bulleted list or references)
6. **Scenario** (H2 + narrative context)
7. **Lab Steps** (H2 + sequential H3 subsections)
8. **Concepts & Deep Dive** (H2 + explanatory content)
9. **Troubleshooting** (H2 + problem/solution pairs)
10. **Resources** (H2 + bulleted list of links)

### Optional Sections

Modules MAY include these sections when appropriate:
- **Next Steps** (H2 + recommendations for further learning)
- **Assessment** (H2 + quiz or challenge exercises) — roadmap feature
- **Video** (embedded or linked) — roadmap feature

## Front Matter Requirements

### Required Fields

All modules MUST define these fields in the YAML front matter:

```yaml
title: "Concise, scannable module title"
slug: "lowercase-hyphen-slug"
difficulty: "beginner"  # MUST be: beginner|intermediate|advanced
estimated_minutes: 30   # Integer; realistic time estimate
description: "120–160 character description. What learners will achieve and why it matters."
tags: [tag1, tag2, tag3]
```

#### Field Constraints

- **title**:
  - Maximum 80 characters
  - Use title case
  - Be specific and action-oriented (e.g., "Deploy Your First Kubernetes Application")
  - Avoid redundant phrases like "Learn to" or "How to"

- **slug**:
  - Must match the folder name under `content/modules/`
  - Lowercase letters, numbers, and hyphens only
  - No underscores or special characters
  - Maximum 60 characters

- **difficulty**:
  - MUST be one of: `beginner`, `intermediate`, or `advanced`
  - **beginner**: No prior experience with the technology required
  - **intermediate**: Basic familiarity assumed; practical experience helpful
  - **advanced**: Deep knowledge expected; production-level scenarios

- **estimated_minutes**:
  - Integer value representing realistic completion time
  - Include time for reading, executing commands, and validation
  - Guidelines:
    - Beginner modules: 30–60 minutes
    - Intermediate modules: 45–90 minutes
    - Advanced modules: 60–120 minutes

- **description**:
  - MUST be 120–160 characters (enforced for SEO meta description)
  - Use active voice and action verbs
  - Focus on learner outcomes, not features
  - Good: "Deploy a Kubernetes cluster, configure networking, and expose services to production traffic."
  - Bad: "This module covers Kubernetes clusters."

- **tags**:
  - Array of 3–7 topic keywords
  - Use lowercase, hyphen-separated tags
  - Prefer established tags over creating new ones
  - Examples: `kubernetes`, `docker`, `networking`, `cloud-native`, `troubleshooting`

### Recommended Fields

Modules SHOULD include these fields:

```yaml
version: "v1.30"              # Product/tool version
validated_on: "2025-10-14"    # Last validation date (YYYY-MM-DD)
pathway_slug: "kubernetes-fundamentals"
pathway_name: "Kubernetes Fundamentals"
order: 10                     # Sorting weight for lists
```

### Optional Fields

Modules MAY include these fields for advanced use cases:

```yaml
# Agent-ready maintenance metadata
products:
  - name: hedgehog-platform
    repo: hedgehog-cloud/platform
    min_version: 1.6.0

scenarios:
  - id: core-task
    title: "Deploy and validate production workload"
    persona: "Platform Engineer"
    environment: "k8s >=1.29, ingress-nginx, cluster-admin"
    steps:
      - id: step-1
        goal: "Create isolated namespace"
        commands:
          - kubectl create namespace learn-k8s
        validate:
          - kubectl get ns learn-k8s -o json | jq -e '.status.phase=="Active"'

ai_hints:
  environment: "kind"
  retries: 1
```

See [AI Content Maintenance Guide](ai-content-maintenance.md) for details on agent-ready metadata.

## Content Guidelines

### Voice and Tone

- **Active voice**: "Deploy the application" (not "The application is deployed")
- **Second person**: Address the learner as "you"
- **Present tense**: "You create a namespace" (not "You will create...")
- **Conversational but professional**: Avoid overly casual language
- **Inclusive**: Use "they/their" for generic references; avoid "guys" or gendered terms

### Writing Style

#### Learning Objectives

- Use action verbs (deploy, configure, analyze, troubleshoot)
- Be specific about outcomes
- Limit to 4–7 objectives per module
- Order from basic to advanced

Example:
```markdown
## Learning Objectives

- Deploy a Kubernetes cluster using kind or minikube
- Create and configure Pods, Deployments, and Services
- Use kubectl to inspect and debug cluster resources
- Implement health checks and resource limits
- Troubleshoot common Pod and container failures
```

#### Prerequisites

- List required knowledge, tools, and access
- Link to prerequisite modules using slugs (resolved automatically)
- Link to external resources with full URLs
- Be explicit about cluster/environment requirements

Example:
```markdown
## Prerequisites

- Access to a Kubernetes cluster (kind, minikube, or cloud provider)
- kubectl CLI installed and configured (verify with `kubectl version`)
- Basic familiarity with containers and Docker
- Command-line proficiency
- Understanding of basic networking concepts (ports, DNS)
```

With smart linking (via meta.json):
```json
{
  "prerequisites": [
    "intro-to-docker",
    {
      "title": "AWS CLI v2",
      "url": "https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    },
    "Basic familiarity with YAML syntax"
  ]
}
```

#### Scenario Context

- Provide realistic, day-in-the-life context
- Identify the persona (developer, operator, architect)
- Explain the business or technical problem
- Keep scenarios concise (2–4 sentences)

Example:
```markdown
## Scenario: Deploying Your First Application to Kubernetes

You're a developer joining a team that uses Kubernetes for application deployment. Your first task is to deploy a simple web application to the cluster, learn how to interact with it, scale it, and understand the fundamental building blocks of Kubernetes.
```

#### Lab Steps

- Use H3 headings for each step (`### Step 1: Create a Namespace`)
- Number steps sequentially
- Start each step with a brief explanation (1–3 sentences)
- Show commands in fenced code blocks with language hints
- Always include validation commands
- Use deterministic validation checks (e.g., `jq` filters, grep patterns)

Example:
```markdown
### Step 1: Create a Namespace

Namespaces provide logical isolation for your resources. Create a namespace for this lab:

\```bash
kubectl create namespace learn-k8s
\```

**Validation:**
\```bash
# Verify the namespace exists
kubectl get namespaces | grep learn-k8s

# Or get detailed info
kubectl describe namespace learn-k8s
\```

Expected output: Namespace "learn-k8s" with STATUS "Active".
```

#### Concepts & Deep Dive

- Explain the "why" behind the commands
- Use diagrams, analogies, or visual aids when helpful
- Link to authoritative external docs
- Keep this section separate from executable steps
- Use H3 subheadings for sub-concepts

Example:
```markdown
## Concepts & Deep Dive

### What is Kubernetes?

Kubernetes (often abbreviated as K8s) is an open-source container orchestration platform that automates the deployment, scaling, and management of containerized applications...

### Why Kubernetes?

As applications grow in complexity and scale, managing containers manually becomes impractical. Kubernetes solves this by providing:

- **Automated rollouts and rollbacks**: Deploy new versions safely with automatic rollback on failure
- **Service discovery and load balancing**: Automatic DNS and load balancing for your services
- **Self-healing**: Restarts failed containers and replaces unresponsive containers
```

#### Troubleshooting

- Use this structure: **Symptom → Cause → Fix**
- Use H3 for each issue (`### Issue: kubectl: command not found`)
- Provide concrete commands for diagnosis and resolution
- Include common errors and edge cases

Example:
```markdown
## Troubleshooting

### Issue: Pod stuck in "Pending" state

**Symptom:** Pod shows STATUS "Pending" and never becomes "Running"

**Cause:** Insufficient cluster resources, image pull issues, or scheduling constraints

**Fix:**

\```bash
# Describe the pod to see events
kubectl describe pod <pod-name> --namespace=learn-k8s

# Check node resources
kubectl top nodes

# Look for events indicating issues
kubectl get events --namespace=learn-k8s --sort-by='.lastTimestamp'
\```
```

#### Resources

- Link to official documentation first
- Include relevant blog posts, videos, or tools
- Use descriptive link text (not "click here")
- Verify links are current before publishing

Example:
```markdown
## Resources

- [Official Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes API Reference](https://kubernetes.io/docs/reference/kubernetes-api/)
- [CNCF Kubernetes Certification](https://www.cncf.io/certification/cka/)
```

## Formatting Standards

### Headings

- Use H1 (`#`) for the module title only (one per module)
- Use H2 (`##`) for major sections
- Use H3 (`###`) for subsections (e.g., lab steps, troubleshooting issues)
- Do NOT skip heading levels (e.g., H1 → H3)
- Use sentence case for H2 and H3 headings

### Code Blocks

- Always specify the language: ` ```bash `, ` ```yaml `, ` ```json `
- Use comments to explain non-obvious commands
- Break long commands with backslash (`\`)
- Avoid inline commands in paragraphs; prefer fenced blocks

Good:
```markdown
\```bash
# Create a deployment with 3 replicas
kubectl create deployment web --image=nginx:latest --replicas=3 --namespace=learn-k8s
\```
```

Bad:
```markdown
Run `kubectl create deployment web --image=nginx:latest --replicas=3 --namespace=learn-k8s` to create a deployment.
```

### Lists

- Use `-` for unordered lists
- Use `1.` for ordered lists
- Indent nested lists with 2 spaces
- Keep list items parallel in structure

### Links

- Use descriptive text: `[Kubernetes Documentation](https://kubernetes.io/docs/)`
- NOT: `[Click here](https://kubernetes.io/docs/)`
- Use relative links for internal docs: `[Contributor Guide](contributor-guide.md)`

### Images and Media

- Use meaningful alt text: `![Kubernetes architecture diagram](./images/k8s-arch.png)`
- Store images in `content/modules/<slug>/images/` directory
- Use web-optimized formats (PNG, JPG, WebP)
- Compress images before committing
- Maximum image width: 1200px

### Callouts and Emphasis

- Use **bold** for UI elements, important terms, or warnings
- Use *italics* sparingly for emphasis
- Use `inline code` for commands, filenames, and variable names
- Use blockquotes (`>`) for notes or tips

Example:
```markdown
> **Note:** Always verify your cluster context before running destructive commands.
```

## Metadata Standards

### Tags Taxonomy

Use established tags when possible. Common tags include:

**Technologies:**
- `kubernetes`, `docker`, `terraform`, `ansible`, `helm`

**Cloud Providers:**
- `aws`, `azure`, `gcp`, `cloud-native`

**Concepts:**
- `networking`, `storage`, `security`, `monitoring`, `troubleshooting`

**Skill Level:**
- `getting-started`, `best-practices`, `architecture`, `operations`

### Difficulty Bands and Time Estimates

| Difficulty | Typical Time | Scope |
|------------|--------------|-------|
| Beginner | 30–60 min | Introduction to a tool/concept; simple, guided steps |
| Intermediate | 45–90 min | Realistic scenarios; some decision-making required |
| Advanced | 60–120 min | Production-level complexity; troubleshooting and optimization |

### Description Guidelines

The `description` field is used for:
- SEO meta description
- Module list cards
- Social media previews

Requirements:
- 120–160 characters (strict)
- Active voice
- Outcome-focused
- No jargon without context

Example:
```
Good: "Deploy a Kubernetes cluster, configure networking, and expose services to production traffic using kubectl and Helm."
Bad: "Learn about Kubernetes."
```

## Quality Assurance Checklist

Before submitting a module for review, verify:

### Content Completeness
- [ ] All required sections present and in correct order
- [ ] Front matter includes all required fields
- [ ] Description is 120–160 characters
- [ ] At least one realistic scenario with hands-on steps
- [ ] All code blocks have language hints
- [ ] All commands are tested and validated
- [ ] Troubleshooting section covers common errors
- [ ] Resources section includes official docs

### Structure and Formatting
- [ ] Only one H1 heading (module title)
- [ ] Headings follow logical hierarchy (no skipped levels)
- [ ] Code blocks use proper syntax highlighting
- [ ] Lists are formatted consistently
- [ ] Links use descriptive text
- [ ] Images include alt text and are optimized

### Metadata and SEO
- [ ] Slug matches folder name
- [ ] Tags are lowercase and hyphen-separated
- [ ] Estimated time is realistic
- [ ] Difficulty level is appropriate
- [ ] Version and validation date are current (if applicable)

### Validation and Testing
- [ ] All commands execute successfully
- [ ] Validation checks produce expected output
- [ ] Links are not broken
- [ ] Images load correctly
- [ ] Content renders properly in HubDB preview (`?debug=1`)

### Accessibility and Inclusivity
- [ ] Alt text provided for all images
- [ ] Language is inclusive and professional
- [ ] No gendered or exclusionary terms
- [ ] Code examples use diverse names/examples

## Sync and Publication

Once your module passes QA:

1. **Local validation**: Run `npm run sync:content -- --dry-run` to preview
2. **Live sync**: Run `npm run sync:content` to publish to HubDB
3. **Verify on live site**:
   - Check `/learn` list page for your module card
   - Visit `/learn/<slug>` to verify detail page rendering
   - Test debug view: `/learn/<slug>?debug=1` (should show "has full_content? true")

### Common Sync Issues

See [Content Sync Runbook](content-sync.md) § Troubleshooting for detailed solutions.

**WAF/Cloudflare blocks:**
- Avoid raw HTTP `Host:` headers; use `curl --resolve` instead
- Prefer `curl` over `wget` in examples
- Keep single modules under ~10–12 KB of rendered HTML

**Missing content:**
- Verify front matter is valid YAML
- Ensure `slug` matches folder name exactly
- Check for unclosed code blocks or invalid markdown

## Maintenance and Updates

### When to Update a Module

Update modules when:
- Product versions change significantly
- Commands or APIs are deprecated
- Links become outdated or broken
- User feedback identifies issues
- Content no longer aligns with current best practices

### Version Control

- Update `version` field in front matter when content changes significantly
- Update `validated_on` field after re-testing commands
- Document breaking changes in commit messages
- Reference issue numbers for traceability

### Archiving Modules

When a module is no longer relevant:

1. **Soft archive** (recommended):
   - Move folder to `content/archive/<slug>/` OR
   - Add `archived: true` to front matter
   - Resync to HubDB (module will be hidden from lists)

2. **Hard delete**:
   - Remove folder from `content/modules/`
   - Resync to HubDB (row will be deleted)
   - Use `SYNC_DELETE_MISSING=false` to prevent automatic deletions

## Examples and Templates

- **Template**: [`docs/templates/module-README-template.md`](templates/module-README-template.md)
- **Example beginner module**: [`content/modules/intro-to-kubernetes/README.md`](../content/modules/intro-to-kubernetes/README.md)
- **Example intermediate module**: [`content/modules/kubernetes-networking/README.md`](../content/modules/kubernetes-networking/README.md)
- **Example advanced module**: [`content/modules/kubernetes-storage/README.md`](../content/modules/kubernetes-storage/README.md)

## Review and Approval

### Peer Review Checklist

Reviewers should verify:
- [ ] Content is accurate and current
- [ ] Steps are clear and reproducible
- [ ] Commands execute successfully
- [ ] Validation checks are deterministic
- [ ] Troubleshooting covers realistic scenarios
- [ ] Metadata is complete and correct
- [ ] Formatting follows this standard
- [ ] Links are valid and authoritative

### Approval Process

1. Author opens PR with new/updated module
2. Reviewer checks against this standard and QA checklist
3. Author addresses feedback and updates PR
4. Reviewer approves PR
5. PR is merged to `main`
6. CI automatically syncs content to HubDB (or run manually)
7. Author verifies live page rendering

## Feedback and Iteration

This standard is a living document. Propose changes via:
- GitHub Issues (label: `type/docs`)
- Pull Requests updating this file
- Discussions with the content lead

All changes to this standard MUST be reviewed and approved before merging.

## Related Documentation

- [Contributor Guide](contributor-guide.md) — Step-by-step authoring workflow
- [Course Authoring Guide](course-authoring.md) — Full reference including pathways and courses
- [Content Sync Runbook](content-sync.md) — Technical sync details and troubleshooting
- [Project Management Guide](project-management.md) — GitHub workflow and issue templates
