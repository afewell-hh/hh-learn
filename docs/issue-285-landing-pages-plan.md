---
title: Hedgehog Learn Landing Pages Implementation Plan
issue: "#285"
owner: hh-learn project lead
status: planning
created: 2025-11-05
last-updated: 2025-11-05
---

# Hedgehog Learn Landing & Get-Started Pages Implementation Plan

**Issue:** [#285 - Plan Hedgehog Learn landing & get-started page rollout](https://github.com/afewell-hh/hh-learn/issues/285)

## Executive Summary

This document provides an actionable implementation plan for redesigning `/learn` (landing page) and creating `/learn/get-started` (get-started page) based on consultant creative direction. The plan maps high-level positioning requirements onto Hedgehog Learn's existing CMS architecture, HubDB data infrastructure, and deployment workflows.

**Key Finding:** Our existing component library (hero blocks, cards, CTAs, filtering) can support most landing page requirements with minimal new development. The primary work is content authoring, template composition, and HubDB query optimization.

---

## Table of Contents

1. [Background & Context](#background--context)
2. [Current State Analysis](#current-state-analysis)
3. [Proposed Architecture](#proposed-architecture)
4. [Page-by-Page Implementation Plans](#page-by-page-implementation-plans)
5. [Component Inventory & Reuse Strategy](#component-inventory--reuse-strategy)
6. [HubDB Data Strategy](#hubdb-data-strategy)
7. [Template & Module Structure](#template--module-structure)
8. [Content Outline & Copy Requirements](#content-outline--copy-requirements)
9. [Deployment Checklist](#deployment-checklist)
10. [Risks, Gaps & Dependencies](#risks-gaps--dependencies)
11. [Timeline & Resource Estimates](#timeline--resource-estimates)
12. [Open Questions & Follow-Up Actions](#open-questions--follow-up-actions)

---

## Background & Context

### Problem Statement

The current `/learn` page renders the catalog template, which is optimized for filtering and browsing but does not align with the new positioning brief for Hedgehog Learn. A consultant has delivered creative direction outlining new experiences for `/learn` and `/learn/get-started`, but the brief ignores HubSpot-specific implementation constraints.

### Goals

1. Translate the consultant outline into a Hedgehog-standard content architecture
2. Map creative requirements to existing CMS components and HubDB data sources
3. Surface technical and data gaps before implementation begins
4. Provide clear ownership of copy, data sources, and HubSpot components
5. Enable immediate build work with no rework needed

### Scope

- **In Scope:**
  - `/learn` landing page redesign
  - `/learn/get-started` new page creation
  - Template/component architecture
  - HubDB query strategy
  - Content outline and copy requirements
  - Deployment workflow documentation

- **Out of Scope:**
  - Actual copywriting (content team responsibility)
  - Asset creation (imagery, video) - marketing team
  - Authentication/enrollment features (covered by Issue #276, Issue #283)
  - New HubDB schema changes (current schemas sufficient)

---

## Current State Analysis

### Existing `/learn` Implementation

**Current URL:** `https://hedgehog.cloud/learn`

**Template:** `clean-x-hedgehog-templates/learn/catalog.html`

**Behavior:**
- Unified catalog of modules, courses, and pathways
- Left navigation with filters (type, level, duration, search)
- Card-based grid layout
- Data from `HUBDB_CATALOG_TABLE_ID` (136199186)
- Client-side filtering via `catalog-filters.js`

**Limitations:**
- Generic catalog experience lacks positioning/value proposition
- No hero storytelling or journey guidance
- No featured content or curated recommendations
- No get-started pathway or onboarding flow

### Available Infrastructure

**Templates:**
- 8 existing Learn templates (catalog, courses, pathways, modules, my-learning, register, auth-handshake, action-runner)
- All templates follow consistent patterns

**Components:**
- Hero section pattern (full-width, cloud background, gradient options)
- Left navigation macro with filtering
- 4 card component styles (catalog, course, pathway, module)
- Enrollment CTA blocks
- Progress trackers
- Toast notification system

**HubDB Tables:**
- Modules (`135621904`) - 15+ fields including difficulty, duration, tags, content
- Courses (`135381433`) - 14+ fields including module references, duration, content blocks
- Pathways (`135381504`) - 14+ fields including course/module references, duration
- Catalog (`136199186`) - Unified view with type, level, duration, tags

**JavaScript Modules:**
- `enrollment.js` - Enrollment management
- `progress.js` - Progress tracking
- `catalog-filters.js` - Client-side filtering
- `auth-context.js` - Authentication state
- `left-nav.js` - Mobile navigation
- `toast.js` - Notifications
- `pageview.js` - Analytics beacons

**CSS:**
- `catalog.css` - Card grids and badges
- `left-nav.css` - Sticky navigation
- `registration.css` - Multi-column layouts
- `module-media.css` - Media galleries

---

## Proposed Architecture

### Design Principles

1. **Reuse Over Rebuild:** Maximize use of existing components, templates, and patterns
2. **Content-Driven:** Leverage HubDB for all dynamic content; minimize hardcoding
3. **Progressive Enhancement:** Build on catalog.html patterns; don't reinvent
4. **Deployment Safety:** Follow CONTRIBUTING.md checklist for all changes
5. **Accessibility First:** WCAG 2.1 AA compliance from day one

### Technical Approach

Both pages will use **custom coded templates** (not drag-and-drop) to maintain consistency with existing Learn templates and enable HubL-based HubDB queries.

**Template Type:** Coded Template (HubL + HTML)
**Data Source:** HubDB tables (no CRM objects needed)
**Forms:** HubSpot native forms (embedded via form module)
**Dynamic Content:** Server-rendered via HubL (no client-side CMS API calls)

---

## Page-by-Page Implementation Plans

### Page 1: `/learn` (Landing Page)

#### Purpose
Primary landing experience that communicates value proposition, showcases featured content, and guides users to their learning journey.

#### Template Strategy
**Option A (Recommended):** Create new `learn-landing.html` template
- Preserves existing `catalog.html` for `/learn/catalog` fallback
- Cleaner separation of concerns
- Easier A/B testing and rollback

**Option B:** Modify existing `catalog.html` with conditional sections
- Reuses existing template
- Requires feature flags or URL parameter detection
- Higher risk of breaking existing functionality

**Recommendation:** Option A - new template for clean separation.

#### Section Breakdown

**1. Hero Section**
- **Component:** Reuse existing hero pattern from catalog.html
- **Content:**
  - H1: "Transform Your Skills with Hedgehog Learn" (TBD by content team)
  - Subtitle: Value proposition (2-3 sentences)
  - Primary CTA: "Get Started" → `/learn/get-started`
  - Secondary CTA: "Browse Catalog" → `/learn/catalog`
- **Visual:** Cloud background (existing `hh-clouds.webp`) or new hero image
- **Implementation:** Direct HTML + CSS (no HubDB query needed)

**2. Featured Pathways Section**
- **Component:** Card grid (reuse pathway card style)
- **Heading:** "Start Your Learning Journey"
- **Data Source:** HubDB Pathways table
- **Query:**
  ```jinja2
  {% set featured_pathways = hubdb_table_rows(
      constants.HUBDB_PATHWAYS_TABLE_ID,
      "display_order__lte=3&tags__not__icontains=archived"
  ) %}
  ```
- **Fallback:** If no pathways tagged as "featured", show top 3 by display_order
- **Card Content:** Title, summary (truncated), module/course count, duration, CTA
- **Layout:** 3-column grid (responsive to 1-column on mobile)

**3. Popular Courses Section**
- **Component:** Card grid (reuse course card style)
- **Heading:** "Popular Courses"
- **Data Source:** HubDB Courses table
- **Query:**
  ```jinja2
  {% set popular_courses = hubdb_table_rows(
      constants.HUBDB_COURSES_TABLE_ID,
      "display_order__lte=3&tags__not__icontains=archived"
  ) %}
  ```
- **Card Content:** Title, summary, module count, duration, CTA
- **Layout:** 3-column grid

**4. Learning by Level Section**
- **Component:** Horizontal card layout with level badges
- **Heading:** "Choose Your Level"
- **Content:** Static cards linking to filtered catalog views
  - **Beginner:** "New to the platform? Start here." → `/learn/catalog?level=beginner`
  - **Intermediate:** "Build on your knowledge." → `/learn/catalog?level=intermediate`
  - **Advanced:** "Master advanced concepts." → `/learn/catalog?level=advanced`
- **Visual:** Use existing difficulty badges (beginner/intermediate/advanced colors)
- **Implementation:** Static HTML (no HubDB query)

**5. Latest Modules Section**
- **Component:** Card grid (reuse module card style)
- **Heading:** "Recently Added"
- **Data Source:** HubDB Modules table
- **Query:**
  ```jinja2
  {% set recent_modules = hubdb_table_rows(
      constants.HUBDB_MODULES_TABLE_ID,
      "orderBy=-hs_created_at&tags__not__icontains=archived&limit=6"
  ) %}
  ```
- **Note:** `hs_created_at` is a HubDB system field (timestamp); if not available, use `display_order`
- **Card Content:** Title, difficulty badge, duration, description (truncated), CTA
- **Layout:** 3-column grid (2 rows)

**6. Call-to-Action Section**
- **Component:** Centered CTA block (reuse enrollment CTA styling)
- **Content:**
  - Heading: "Ready to Start Learning?"
  - Subtext: "Join thousands of learners mastering [platform/technology]."
  - CTA Button: "Browse All Content" → `/learn/catalog`
  - Optional: "Sign Up" → `/learn/register` (if auth UI enabled)
- **Visual:** Gradient background (reuse enrollment CTA gradient)
- **Implementation:** Static HTML with auth UI gating for Sign Up button

#### Layout Structure

```
┌─────────────────────────────────────┐
│         Global Header               │
├─────────────────────────────────────┤
│                                     │
│      Hero Section (Full Width)      │
│      - H1 + Subtitle                │
│      - Primary & Secondary CTAs     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Featured Pathways (3 cards)       │
│   ┌────┐  ┌────┐  ┌────┐           │
│   │ P1 │  │ P2 │  │ P3 │           │
│   └────┘  └────┘  └────┘           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Popular Courses (3 cards)         │
│   ┌────┐  ┌────┐  ┌────┐           │
│   │ C1 │  │ C2 │  │ C3 │           │
│   └────┘  └────┘  └────┘           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Learning by Level (3 cards)       │
│   ┌────┐  ┌────┐  ┌────┐           │
│   │ B  │  │ I  │  │ A  │           │
│   └────┘  └────┘  └────┘           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Recently Added (6 cards, 2 rows)  │
│   ┌────┐  ┌────┐  ┌────┐           │
│   │ M1 │  │ M2 │  │ M3 │           │
│   └────┘  └────┘  └────┘           │
│   ┌────┐  ┌────┐  ┌────┐           │
│   │ M4 │  │ M5 │  │ M6 │           │
│   └────┘  └────┘  └────┘           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Call-to-Action Section            │
│   - "Ready to Start Learning?"      │
│   - [Browse All Content] Button     │
│                                     │
├─────────────────────────────────────┤
│         Global Footer               │
└─────────────────────────────────────┘
```

#### File Locations

- **Template:** `clean-x-hedgehog-templates/learn/learn-landing.html`
- **CSS:** `clean-x-hedgehog-templates/assets/css/learn-landing.css` (new file)
- **JS:** Reuse existing modules (no new JS needed)
- **Page URL:** `/learn` (map via HubSpot page settings)

---

### Page 2: `/learn/get-started` (Get-Started Page)

#### Purpose
Onboarding experience that helps new learners understand the platform, choose their learning path, and take first steps.

#### Template Strategy
Create new `get-started.html` template with step-by-step guidance structure.

#### Section Breakdown

**1. Hero Section**
- **Component:** Reuse hero pattern
- **Content:**
  - H1: "Get Started with Hedgehog Learn"
  - Subtitle: "Your journey to mastery begins here."
- **Visual:** Cloud background or alternative hero image
- **Implementation:** Static HTML

**2. How It Works Section**
- **Component:** Step-by-step cards or numbered list
- **Heading:** "How Hedgehog Learn Works"
- **Content:** 3-4 steps explaining the learning flow
  1. **Choose Your Path:** Browse pathways, courses, or modules
  2. **Learn at Your Pace:** Follow structured content with hands-on labs
  3. **Track Progress:** Monitor completion and earn achievements (if enabled)
  4. **Level Up:** Advance from beginner to expert
- **Visual:** Icons or numbered badges for each step
- **Implementation:** Static HTML (content team provides copy)

**3. Recommended Starting Points**
- **Component:** Large card layout (hero cards)
- **Heading:** "Where Should You Start?"
- **Data Source:** HubDB Pathways table (filtered by tag or manual selection)
- **Query:**
  ```jinja2
  {% set starter_pathways = hubdb_table_rows(
      constants.HUBDB_PATHWAYS_TABLE_ID,
      "tags__icontains=beginner&tags__not__icontains=archived&orderBy=display_order&limit=2"
  ) %}
  ```
- **Fallback:** If no "beginner" tagged pathways, show pathways with lowest display_order
- **Card Content:** Large title, full description, module/course count, duration, prominent CTA
- **Layout:** 2-column grid (or vertical stack on mobile)

**4. Learning Paths by Goal**
- **Component:** Category cards with links
- **Heading:** "What Do You Want to Learn?"
- **Content:** Static category cards linking to filtered catalog
  - **Platform Basics:** → `/learn/catalog?tags=basics`
  - **DevOps & Automation:** → `/learn/catalog?tags=devops`
  - **Cloud Infrastructure:** → `/learn/catalog?tags=cloud`
  - **Advanced Topics:** → `/learn/catalog?tags=advanced`
- **Visual:** Icon + title + short description per category
- **Implementation:** Static HTML (categories based on current tag taxonomy)

**5. Beginner Modules Showcase**
- **Component:** Module card grid
- **Heading:** "Quick Wins for Beginners"
- **Data Source:** HubDB Modules table
- **Query:**
  ```jinja2
  {% set beginner_modules = hubdb_table_rows(
      constants.HUBDB_MODULES_TABLE_ID,
      "difficulty__eq=1&tags__not__icontains=archived&orderBy=display_order&limit=3"
  ) %}
  ```
- **Note:** `difficulty__eq=1` filters for "beginner" (SELECT option ID=1)
- **Card Content:** Title, difficulty badge, duration, description, CTA
- **Layout:** 3-column grid

**6. FAQ Section**
- **Component:** Accordion or simple Q&A list
- **Heading:** "Frequently Asked Questions"
- **Content:** Static FAQ items (content team provides)
  - "Do I need an account to access content?" (Answer depends on auth UI status)
  - "How long does it take to complete a pathway?"
  - "Are there prerequisites for courses?"
  - "Can I track my progress?"
- **Implementation:** Static HTML with optional accordion JS (can reuse existing patterns)

**7. Call-to-Action Section**
- **Component:** Centered CTA block
- **Content:**
  - Heading: "Ready to Begin?"
  - CTA Button: "Start Learning" → `/learn/catalog`
  - Optional: "View All Pathways" → `/learn/pathways`
- **Visual:** Gradient background
- **Implementation:** Static HTML

#### Layout Structure

```
┌─────────────────────────────────────┐
│         Global Header               │
├─────────────────────────────────────┤
│                                     │
│      Hero Section (Full Width)      │
│      - H1: "Get Started..."         │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   How It Works (4 step cards)       │
│   ┌────┐  ┌────┐  ┌────┐  ┌────┐   │
│   │ 1  │  │ 2  │  │ 3  │  │ 4  │   │
│   └────┘  └────┘  └────┘  └────┘   │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Recommended Starting Points       │
│   ┌──────────┐  ┌──────────┐       │
│   │ Pathway1 │  │ Pathway2 │       │
│   │  (hero)  │  │  (hero)  │       │
│   └──────────┘  └──────────┘       │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Learning Paths by Goal            │
│   ┌────┐  ┌────┐  ┌────┐  ┌────┐   │
│   │Cat1│  │Cat2│  │Cat3│  │Cat4│   │
│   └────┘  └────┘  └────┘  └────┘   │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Beginner Modules (3 cards)        │
│   ┌────┐  ┌────┐  ┌────┐           │
│   │ M1 │  │ M2 │  │ M3 │           │
│   └────┘  └────┘  └────┘           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   FAQ Section                       │
│   Q1: ...                           │
│   Q2: ...                           │
│   Q3: ...                           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│   Call-to-Action Section            │
│   - "Ready to Begin?"               │
│   - [Start Learning] Button         │
│                                     │
├─────────────────────────────────────┤
│         Global Footer               │
└─────────────────────────────────────┘
```

#### File Locations

- **Template:** `clean-x-hedgehog-templates/learn/get-started.html`
- **CSS:** `clean-x-hedgehog-templates/assets/css/get-started.css` (new file, minimal - reuse most from existing)
- **JS:** Reuse existing modules (no new JS needed, unless accordion for FAQ)
- **Page URL:** `/learn/get-started` (create new page in HubSpot)

---

## Component Inventory & Reuse Strategy

### Reusable Components (No Changes Needed)

| Component | Source | Use Cases |
|-----------|--------|-----------|
| Hero Section Pattern | `catalog.html` lines 12-20 | Both pages - hero sections |
| Pathway Card | `pathways-page.html` lines 85-110 | Landing page - featured pathways |
| Course Card | `courses-page.html` lines 85-105 | Landing page - popular courses |
| Module Card | `module-page.html` lines 90-120 | Both pages - module showcases |
| Catalog Card | `catalog.html` lines 95-130 | Alternative if unified card style preferred |
| CTA Block | `courses-page.html` lines 320-340 | Both pages - call-to-action sections |
| Left Navigation | `macros/left-nav.html` | Optional for get-started page |
| Badge Components | `catalog.css` lines 140-180 | Difficulty/level badges |
| Grid Layouts | `catalog.css` lines 200-250 | All card grids |

### New Components Needed

| Component | Purpose | Priority |
|-----------|---------|----------|
| Hero CTA Buttons | Primary/Secondary button pair in hero | High |
| Step Cards | Numbered steps for "How It Works" | Medium |
| Hero Cards | Larger card variant for recommended pathways | Medium |
| Category Cards | Icon + title + link for learning paths | Medium |
| FAQ Accordion | Collapsible FAQ (optional) | Low |

**Recommendation:** Build these as minimal CSS additions to existing patterns, not separate components.

---

## HubDB Data Strategy

### Current Schema Assessment

**Good News:** Existing HubDB schemas fully support landing page requirements. No schema changes needed.

#### Tables We'll Query

1. **Pathways Table** (`HUBDB_PATHWAYS_TABLE_ID: 135381504`)
   - **Fields Used:** `hs_name`, `hs_path`, `summary_markdown`, `module_count`, `estimated_minutes`, `tags`, `display_order`, `badge_image_url`
   - **Queries:** Featured pathways, beginner pathways
   - **Filter Strategy:** Use `tags` field for "featured" or "beginner" tagging

2. **Courses Table** (`HUBDB_COURSES_TABLE_ID: 135381433`)
   - **Fields Used:** `hs_name`, `hs_path`, `summary_markdown`, `module_slugs_json`, `estimated_minutes`, `tags`, `display_order`
   - **Queries:** Popular courses
   - **Filter Strategy:** Use `display_order` for curation (1-3 = featured)

3. **Modules Table** (`HUBDB_MODULES_TABLE_ID: 135621904`)
   - **Fields Used:** `hs_name`, `hs_path`, `full_content`, `difficulty`, `estimated_minutes`, `tags`, `display_order`, `meta_description`
   - **Queries:** Recent modules, beginner modules
   - **Filter Strategy:** `difficulty=1` for beginner, `display_order` for curation

4. **Catalog Table** (`HUBDB_CATALOG_TABLE_ID: 136199186`)
   - **Not actively used** on these pages (catalog.html continues to use it)
   - **Reason:** More efficient to query source tables directly for targeted queries

### Query Optimization Strategy

#### Avoiding HubSpot's 10-Call Limit

HubSpot templates have a maximum of 10 HubDB queries per page render. Our landing pages are well within this limit:

**Landing Page Query Count:**
1. Featured pathways (1 query)
2. Popular courses (1 query)
3. Recent modules (1 query)
**Total: 3 queries** ✅

**Get-Started Page Query Count:**
1. Starter pathways (1 query)
2. Beginner modules (1 query)
**Total: 2 queries** ✅

#### Caching & Performance

- HubDB queries are server-side (HubL) and cached by HubSpot
- No client-side API calls needed
- Page load performance will be excellent
- Consider adding build timestamp for cache-busting during deployments

### Tagging Strategy for Featured Content

**Recommendation:** Use the existing `tags` field to mark featured content.

#### Proposed Tag Values

- `featured` - Show on landing page featured sections
- `beginner` - Show on get-started page
- `popular` - Alternative to display_order for popular courses
- `archived` - Exclude from all queries (existing pattern)

**Example:**
```json
{
  "slug": "kubernetes-basics",
  "tags": "featured,beginner,kubernetes,containers"
}
```

#### Fallback Strategy

If no content is tagged as "featured", use `display_order` field:
- `display_order: 1-3` = Featured/Popular
- `display_order: 4-10` = Secondary
- `display_order: 999` = Default (not featured)

**HubL Example:**
```jinja2
{% set featured_pathways = hubdb_table_rows(
    constants.HUBDB_PATHWAYS_TABLE_ID,
    "tags__icontains=featured&tags__not__icontains=archived"
) %}

{# Fallback if no featured pathways #}
{% if not featured_pathways or featured_pathways|length == 0 %}
  {% set featured_pathways = hubdb_table_rows(
      constants.HUBDB_PATHWAYS_TABLE_ID,
      "display_order__lte=3&tags__not__icontains=archived"
  ) %}
{% endif %}
```

---

## Template & Module Structure

### File Structure

```
clean-x-hedgehog-templates/
├── learn/
│   ├── learn-landing.html         # NEW - Landing page template
│   ├── get-started.html            # NEW - Get-started page template
│   ├── catalog.html                # EXISTING - Preserve for /learn/catalog
│   ├── courses-page.html           # EXISTING - No changes
│   ├── pathways-page.html          # EXISTING - No changes
│   ├── module-page.html            # EXISTING - No changes
│   ├── my-learning.html            # EXISTING - No changes
│   ├── register.html               # EXISTING - No changes
│   └── macros/
│       └── left-nav.html           # EXISTING - Reuse
├── assets/
│   ├── css/
│   │   ├── learn-landing.css       # NEW - Landing page styles
│   │   ├── get-started.css         # NEW - Get-started styles (minimal)
│   │   ├── catalog.css             # EXISTING - Reuse card/badge styles
│   │   ├── left-nav.css            # EXISTING - Reuse
│   │   └── registration.css        # EXISTING - Reuse multi-column layouts
│   └── js/
│       ├── pageview.js             # EXISTING - Reuse for analytics
│       ├── toast.js                # EXISTING - Reuse if needed
│       └── auth-context.js         # EXISTING - Reuse for auth UI gating
└── layouts/
    └── base.html                   # EXISTING - Global layout (no changes)
```

### Template Inheritance

Both new templates will extend `base.html` for consistent global header/footer:

```jinja2
{% extends "../../layouts/base.html" %}

{% block title %}Hedgehog Learn - Start Your Journey{% endblock %}

{% block content %}
  {# Page-specific content here #}
{% endblock %}
```

### CSS Architecture

**Strategy:** Minimize new CSS by reusing existing patterns.

**learn-landing.css Contents:**
- Hero CTA button styles (primary/secondary pair)
- Section spacing/padding
- Any landing-specific card variants
- Responsive breakpoints (follow existing patterns)

**get-started.css Contents:**
- Step card styles (numbered badges)
- FAQ accordion styles (if implemented)
- Hero card styles (larger variants)
- Minimal overrides to existing patterns

**Reuse from existing:**
- All card styles (`catalog.css`)
- Badge styles (`catalog.css`)
- Grid layouts (`catalog.css`)
- CTA block styles (`enrollment.js` injected styles or inline)
- Typography (`base.html` global styles)

---

## Content Outline & Copy Requirements

### Copy Ownership

**Responsibility:** Content/Marketing Team

**Format:** Provide copy in Markdown or plain text; development team will integrate into templates.

### Landing Page (`/learn`) Copy Needs

| Section | Copy Item | Character Limit | Notes |
|---------|-----------|-----------------|-------|
| Hero | H1 Headline | 60 chars | Action-oriented, value-focused |
| Hero | Subtitle | 160 chars | Expand on value prop, mention key benefits |
| Hero | Primary CTA Text | 20 chars | E.g., "Get Started", "Begin Learning" |
| Hero | Secondary CTA Text | 20 chars | E.g., "Browse Catalog", "Explore Content" |
| Featured Pathways | Section Heading | 60 chars | E.g., "Start Your Learning Journey" |
| Featured Pathways | Optional Intro | 120 chars | Optional 1-sentence intro to pathways |
| Popular Courses | Section Heading | 60 chars | E.g., "Popular Courses", "Trending Now" |
| Learning by Level | Section Heading | 60 chars | E.g., "Choose Your Level" |
| Learning by Level | Beginner Card Copy | 80 chars | Short description of beginner content |
| Learning by Level | Intermediate Card Copy | 80 chars | Short description of intermediate content |
| Learning by Level | Advanced Card Copy | 80 chars | Short description of advanced content |
| Recent Modules | Section Heading | 60 chars | E.g., "Recently Added", "Latest Modules" |
| CTA Section | Heading | 60 chars | E.g., "Ready to Start Learning?" |
| CTA Section | Subtext | 120 chars | Motivational closer, mention community/scale |
| CTA Section | Button Text | 20 chars | E.g., "Browse All Content" |

**Note:** Pathway, course, and module descriptions come from HubDB (already authored in content JSON/markdown).

### Get-Started Page (`/learn/get-started`) Copy Needs

| Section | Copy Item | Character Limit | Notes |
|---------|-----------|-----------------|-------|
| Hero | H1 Headline | 60 chars | E.g., "Get Started with Hedgehog Learn" |
| Hero | Subtitle | 160 chars | Welcoming, set expectations |
| How It Works | Section Heading | 60 chars | E.g., "How Hedgehog Learn Works" |
| How It Works | Step 1 Title | 40 chars | E.g., "Choose Your Path" |
| How It Works | Step 1 Description | 120 chars | Explain browsing/selection |
| How It Works | Step 2 Title | 40 chars | E.g., "Learn at Your Pace" |
| How It Works | Step 2 Description | 120 chars | Explain content/labs |
| How It Works | Step 3 Title | 40 chars | E.g., "Track Progress" |
| How It Works | Step 3 Description | 120 chars | Explain progress tracking (or skip if auth disabled) |
| How It Works | Step 4 Title | 40 chars | E.g., "Level Up" |
| How It Works | Step 4 Description | 120 chars | Explain progression/advancement |
| Recommended Starting Points | Section Heading | 60 chars | E.g., "Where Should You Start?" |
| Learning Paths by Goal | Section Heading | 60 chars | E.g., "What Do You Want to Learn?" |
| Learning Paths by Goal | Category 1 Title | 40 chars | E.g., "Platform Basics" |
| Learning Paths by Goal | Category 1 Description | 80 chars | Short description |
| Learning Paths by Goal | Category 2 Title | 40 chars | E.g., "DevOps & Automation" |
| Learning Paths by Goal | Category 2 Description | 80 chars | Short description |
| Learning Paths by Goal | Category 3 Title | 40 chars | E.g., "Cloud Infrastructure" |
| Learning Paths by Goal | Category 3 Description | 80 chars | Short description |
| Learning Paths by Goal | Category 4 Title | 40 chars | E.g., "Advanced Topics" |
| Learning Paths by Goal | Category 4 Description | 80 chars | Short description |
| Beginner Modules | Section Heading | 60 chars | E.g., "Quick Wins for Beginners" |
| FAQ | Section Heading | 60 chars | E.g., "Frequently Asked Questions" |
| FAQ | Question 1 | 100 chars | E.g., "Do I need an account?" |
| FAQ | Answer 1 | 300 chars | Answer based on auth UI status |
| FAQ | Question 2 | 100 chars | E.g., "How long to complete a pathway?" |
| FAQ | Answer 2 | 300 chars | Answer |
| FAQ | Question 3 | 100 chars | E.g., "Are there prerequisites?" |
| FAQ | Answer 3 | 300 chars | Answer |
| FAQ | Question 4 | 100 chars | E.g., "Can I track my progress?" |
| FAQ | Answer 4 | 300 chars | Answer based on CRM progress status |
| CTA Section | Heading | 60 chars | E.g., "Ready to Begin?" |
| CTA Section | Button Text | 20 chars | E.g., "Start Learning" |

### Asset Needs

**Responsibility:** Marketing/Design Team

| Asset Type | Quantity | Specifications | Priority |
|------------|----------|----------------|----------|
| Hero Background | 1-2 | 1920x600px, WebP format, <200KB | Medium |
| Category Icons | 4 | SVG or PNG, 64x64px, consistent style | Low |
| Step Icons | 4 | SVG or PNG, 64x64px, numbered badges | Low |
| Social Share Image | 1 | 1200x630px, PNG/JPG, <500KB | Low |

**Note:** Can launch with existing `hh-clouds.webp` background and no icons. Assets are enhancements, not blockers.

### Data Preparation

**Responsibility:** Development Team (content sync)

**Tasks:**
1. Tag 3 pathways with "featured" tag (or ensure top 3 have display_order 1-3)
2. Tag 3 courses with "popular" tag (or ensure display_order 1-3)
3. Tag pathways with "beginner" tag for get-started page
4. Tag modules with "beginner" and appropriate category tags (basics, devops, cloud)
5. Verify all content has proper `meta_description` for SEO
6. Verify all content has proper `summary_markdown` for cards
7. Run `npm run sync:catalog` after tagging to update unified view

**Timeline:** 1-2 hours (tag updates in JSON source files, run sync)

---

## Deployment Checklist

**Source:** Follow [`CONTRIBUTING.md`](../CONTRIBUTING.md) mandatory publishing checklist.

### Pre-Deployment

- [ ] Copy finalized by content team
- [ ] Assets uploaded to HubSpot File Manager (if applicable)
- [ ] Build marker timestamp ready (format: `2025-11-XX  T04:30Z`)
- [ ] HubDB content tagged and synced
- [ ] Templates tested locally with test HTML pages

### Deployment Steps

**For Landing Page:**

1. **Edit locally:**
   - Create `clean-x-hedgehog-templates/learn/learn-landing.html`
   - Create `clean-x-hedgehog-templates/assets/css/learn-landing.css`
   - Add build marker: `<div class="hhl-build" data-build="2025-11-XXThh:mmZ"></div>`

2. **Upload project bundle:**
   ```bash
   hs project upload --account=hh
   ```

3. **Publish template files via Source Code v3 API:**
   ```bash
   npm run publish:template -- \
     --path "CLEAN x HEDGEHOG/templates/learn/learn-landing.html" \
     --local "clean-x-hedgehog-templates/learn/learn-landing.html"

   npm run publish:template -- \
     --path "CLEAN x HEDGEHOG/assets/css/learn-landing.css" \
     --local "clean-x-hedgehog-templates/assets/css/learn-landing.css"
   ```

4. **Create page in HubSpot:**
   - Go to Marketing → Website → Website Pages
   - Create new page
   - URL: `/learn`
   - Template: Select `learn-landing.html`
   - Settings: Set meta title, description, social image
   - Publish page

5. **Publish page (flush cache):**
   ```bash
   npm run publish:pages
   ```

6. **Verify from edge:**
   ```bash
   curl -s https://hedgehog.cloud/learn | grep data-build
   ```
   Expected: Shows new timestamp

7. **Hard-refresh browser:**
   - Open `https://hedgehog.cloud/learn`
   - Press `Ctrl/Cmd+Shift+R`
   - Verify all sections render correctly
   - Check browser console for errors
   - Test all CTA links

**For Get-Started Page:**

Repeat steps 1-7 above, substituting:
- `get-started.html` for template filename
- `get-started.css` for CSS filename
- `/learn/get-started` for URL

### Rollback Plan

If deployment fails or issues discovered:

1. **Revert to previous template:**
   - Re-publish previous version via `npm run publish:template`
   - Run `npm run publish:pages`
   - Verify timestamp rollback

2. **Temporarily redirect:**
   - Update page URL in HubSpot settings
   - Redirect `/learn` to `/learn/catalog` (existing working page)

3. **Monitor:**
   - Check CloudWatch logs for API errors (if using Lambda endpoints)
   - Check HubSpot analytics for bounce rate spikes
   - Monitor support channels for user complaints

---

## Risks, Gaps & Dependencies

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| HubDB query limit exceeded | Page won't render | Low | Query count is 3 max per page, well under 10 limit |
| Template cache doesn't bust | Users see old content | Medium | Use build markers, verify with curl before QA |
| Missing HubDB data | Empty sections | Low | Fallback queries use display_order |
| Form embedding issues | CTA buttons don't work | Low | Use simple links, not embedded forms |
| Mobile responsiveness issues | Poor mobile UX | Medium | Test on mobile devices, use existing responsive patterns |
| SEO meta tags missing | Poor search visibility | Low | Set in HubSpot page settings during creation |

### Data Gaps

| Gap | Impact | Resolution |
|-----|--------|------------|
| No "featured" tags in HubDB | Featured sections empty | Tag 3 pathways/courses or use display_order fallback |
| Incomplete meta_description fields | SEO issues, missing card text | Audit HubDB data, add descriptions during sync |
| No social_image_url set | Poor social shares | Use default social image from constants.json |
| Missing beginner content | Get-started page sparse | Tag existing content as beginner, or defer section |

**Action Required:** Audit HubDB content and add missing metadata before launch.

### Dependencies

| Dependency | Owner | Status | Notes |
|------------|-------|--------|-------|
| Copywriting | Content Team | **BLOCKED** | Waiting for copy in planned format |
| Asset creation (optional) | Marketing Team | **OPTIONAL** | Can launch with existing cloud background |
| HubDB data tagging | Dev Team | **READY** | Can complete in 1-2 hours |
| HubSpot page creation | Dev Team | **READY** | Part of deployment steps |
| Approval for `/learn` URL change | Product Lead | **NEEDED** | Confirm replacing catalog with landing page |

### Open Questions

1. **Should existing `/learn` redirect to `/learn/catalog` or be replaced entirely?**
   - **Recommendation:** Replace `/learn` with new landing page; make catalog available at `/learn/catalog`
   - **Rationale:** Landing page is primary entry point; power users can bookmark catalog

2. **What is the consultant brief document?**
   - **Status:** Not found in repository; likely in internal docs/email
   - **Action:** Request brief from stakeholder; confirm sections/copy align with this plan

3. **Authentication UI status: Enabled or disabled?**
   - **Status:** Per `constants.json`, `ENABLE_AUTH_UI: false`
   - **Impact:** Hide "Sign Up" CTAs, adjust FAQ answers, simplify progress tracking mentions
   - **Recommendation:** Design for auth UI disabled; easy to enable later via feature flag

4. **Should we implement analytics/event tracking for new pages?**
   - **Recommendation:** Yes - reuse existing `pageview.js` beacon system
   - **Events:** Page views, CTA clicks, section visibility
   - **Timeline:** Can defer to post-launch enhancement

5. **Do we need A/B testing for landing page variations?**
   - **Status:** Not mentioned in brief
   - **Recommendation:** Launch single version; gather analytics; iterate based on data
   - **Future:** HubSpot CMS supports A/B testing if needed later

### Missing Information

**From Consultant Brief (not available in repo):**
- Specific value proposition language
- Brand voice guidelines
- Target audience personas
- Success metrics/KPIs
- Competitive positioning points

**Action:** Request consultant brief document; validate this plan aligns with creative direction.

---

## Timeline & Resource Estimates

### Development Effort

| Task | Estimated Time | Owner | Notes |
|------|----------------|-------|-------|
| Template development (landing) | 8 hours | Developer | HTML/HubL structure, HubDB queries |
| Template development (get-started) | 6 hours | Developer | HTML/HubL structure |
| CSS styling (both pages) | 6 hours | Developer | New styles + reuse existing |
| Copy integration | 2 hours | Developer | Paste final copy into templates |
| HubDB data tagging | 2 hours | Developer | Add featured/beginner tags, sync |
| Local testing | 3 hours | Developer | Test HTML pages, query validation |
| Deployment & verification | 2 hours | Developer | Follow checklist, verify edge |
| QA & bug fixes | 4 hours | QA/Developer | Cross-browser, mobile, accessibility |
| **Total Development** | **33 hours** | | ~4-5 days for one developer |

### Content/Marketing Effort

| Task | Estimated Time | Owner | Notes |
|------|----------------|-------|-------|
| Copywriting (all sections) | 8 hours | Content Team | Both pages |
| Copy review & approval | 2 hours | Stakeholders | Marketing/product sign-off |
| Asset creation (optional) | 4 hours | Design Team | Hero images, icons |
| Asset upload to HubSpot | 1 hour | Marketing Team | File Manager upload |
| **Total Content/Marketing** | **15 hours** | | 2-3 days |

### Timeline Options

**Option 1: Sequential (Copy-First)**
- Week 1: Copy & assets finalized
- Week 2: Development & testing
- Week 3: Deployment & QA
- **Total: 3 weeks**

**Option 2: Parallel (Faster)**
- Week 1: Dev builds templates with placeholder copy; content team writes final copy
- Week 2: Copy integrated, QA, deployment
- **Total: 2 weeks**

**Option 3: MVP (Fastest)**
- Week 1: Dev builds landing page only with placeholder copy
- Week 2: Copy integrated, deploy landing page
- Week 3+: Get-started page deferred to sprint 2
- **Total: 2 weeks for landing page**

**Recommendation:** Option 2 (Parallel) for best balance of speed and quality.

---

## Open Questions & Follow-Up Actions

### Immediate Actions (Before Starting Build)

1. **Retrieve consultant brief**
   - **Owner:** Project lead
   - **Deadline:** ASAP
   - **Action:** Locate internal brief document; share with dev team

2. **Finalize URL strategy**
   - **Owner:** Product lead
   - **Deadline:** Before deployment
   - **Decision:** Confirm `/learn` replacement vs. new URL

3. **Approve timeline**
   - **Owner:** Project lead
   - **Deadline:** Before sprint planning
   - **Decision:** Choose Option 1, 2, or 3 above

4. **Assign copywriting**
   - **Owner:** Content team lead
   - **Deadline:** Week 1 of sprint
   - **Action:** Use copy outline from this doc as template

5. **Audit HubDB content**
   - **Owner:** Dev team
   - **Deadline:** Before deployment
   - **Action:** Tag pathways/courses, verify metadata completeness

### Follow-Up Issues to Create

Based on this plan, create these follow-up issues:

1. **Issue: Implement `/learn` Landing Page**
   - Milestone: v0.3 or Learn MVP Launch Readiness
   - Labels: `enhancement`, `templates`, `content`
   - Description: Reference this planning doc
   - Tasks: Template dev, CSS, HubDB queries, deployment

2. **Issue: Implement `/learn/get-started` Page**
   - Milestone: v0.3 or Learn MVP Launch Readiness
   - Labels: `enhancement`, `templates`, `content`
   - Description: Reference this planning doc
   - Tasks: Template dev, CSS, HubDB queries, FAQ, deployment

3. **Issue: Content Audit & HubDB Tagging**
   - Milestone: v0.3
   - Labels: `content`, `hubdb`
   - Description: Tag featured/popular/beginner content
   - Tasks: Review all pathways/courses, add tags, sync

4. **Issue: Landing Pages Copywriting**
   - Milestone: v0.3
   - Labels: `content`, `copy`
   - Owner: Content team
   - Description: Write copy per outline in planning doc
   - Deliverable: Markdown file or Google Doc with final copy

5. **Issue: Landing Pages Analytics Instrumentation**
   - Milestone: v0.4 (post-launch)
   - Labels: `enhancement`, `analytics`
   - Description: Add event tracking for CTAs, section visibility
   - Tasks: Beacon implementation, dashboard setup

6. **Issue: A/B Testing for Landing Page Variations** (Future)
   - Milestone: v0.5
   - Labels: `enhancement`, `analytics`, `experimentation`
   - Description: Test variations of hero copy, CTA placement
   - Blocked by: Analytics instrumentation

### Questions for Stakeholders

**For Product Lead:**
1. Do you have the consultant creative brief? Can you share it?
2. Is the current plan aligned with your vision for the landing page experience?
3. Should `/learn` replace the catalog or coexist as separate URLs?
4. What are the success metrics for these pages (traffic, conversion, time on page)?
5. Are there any hard deadlines or launch dates we should target?

**For Content Team:**
1. Can you commit to copywriting timeline (1-2 weeks)?
2. Do you need a template/style guide for copy, or is the outline in this doc sufficient?
3. Should we coordinate with marketing on brand voice/messaging?
4. Do you have existing copy from the consultant brief we can adapt?

**For Marketing Team:**
1. Do we have hero images available, or should we use existing cloud background?
2. Are category/step icons available, or should we launch without them?
3. What is the priority for asset creation (blocker vs. nice-to-have)?
4. Should we create social share images for these pages?

---

## HubSpot CMS Capabilities Reference

### Dynamic Pages

- **HubDB-backed pages:** Supported; used extensively in existing Learn templates
- **URL mapping:** Dynamic pages like `/learn/pathways/{slug}` work well
- **Query limits:** Max 10 HubDB queries per page; our pages use 2-3 max
- **Caching:** Server-side HubL rendering is cached; no client-side API needed

### Forms

- **Native forms:** Can embed HubSpot forms via form module
- **Form styling:** CSS customizable
- **Form submission:** Sends to HubSpot CRM automatically
- **Use case:** Can add email signup forms if needed (not in current plan)

### Templates

- **Coded templates:** Full HubL + HTML control (recommended for our use case)
- **Drag-and-drop:** Easier for marketers but less flexible
- **Inheritance:** `{% extends %}` supported for base layouts
- **Modules:** Can create reusable modules (not needed for this project)

### Static vs. Dynamic

- **Static pages:** No HubDB binding; hardcoded content
- **Dynamic pages:** Bound to HubDB table; generates multiple URLs
- **Our use case:** Landing and get-started are **static pages** with HubDB queries (not dynamic page bindings)

### SEO & Meta Tags

- **Page-level settings:** Title, description, OG tags configurable in HubSpot UI
- **Template defaults:** Can set in template as fallback
- **Structured data:** Can add JSON-LD schema if needed (not in current plan)

### Performance

- **CDN:** HubSpot serves all pages via CDN
- **Asset optimization:** WebP images, minified CSS/JS
- **Lazy loading:** Can implement for images (future enhancement)
- **Core Web Vitals:** Should meet targets with existing patterns

### Accessibility

- **Standards:** WCAG 2.1 AA compliance target
- **Keyboard navigation:** Ensure all CTAs are keyboard accessible
- **Focus indicators:** Use default or custom focus styles
- **Semantic HTML:** Use proper heading hierarchy (H1 → H2 → H3)
- **Alt text:** All images need descriptive alt attributes
- **Color contrast:** Verify all text meets 4.5:1 ratio

**Action:** Run accessibility audit (Lighthouse, axe DevTools) during QA.

---

## Acceptance Criteria

### Landing Page (`/learn`)

- [ ] Page renders at `https://hedgehog.cloud/learn` with new template
- [ ] Hero section displays H1, subtitle, 2 CTA buttons with correct links
- [ ] Featured Pathways section shows 3 pathways from HubDB (tagged or top 3 by display_order)
- [ ] Popular Courses section shows 3 courses from HubDB
- [ ] Learning by Level section shows 3 static category cards with correct filter links
- [ ] Recent Modules section shows 6 modules from HubDB (2 rows of 3)
- [ ] Final CTA section displays with correct button link
- [ ] All cards show title, description, metadata (duration, module count)
- [ ] All CTAs are clickable and navigate to correct URLs
- [ ] Build marker `data-build` attribute present with current timestamp
- [ ] curl verification shows new timestamp
- [ ] Browser hard-refresh shows updated content
- [ ] Mobile responsive (test on 375px, 768px, 1024px widths)
- [ ] No console errors
- [ ] Accessibility: keyboard navigation works, focus visible, heading hierarchy correct
- [ ] SEO: Meta title, description, OG tags set
- [ ] Page load time < 3 seconds (desktop), < 5 seconds (mobile)

### Get-Started Page (`/learn/get-started`)

- [ ] Page renders at `https://hedgehog.cloud/learn/get-started` with new template
- [ ] Hero section displays H1, subtitle
- [ ] How It Works section shows 4 step cards with icons/numbers
- [ ] Recommended Starting Points section shows 2 beginner pathways from HubDB
- [ ] Learning Paths by Goal section shows 4 category cards with correct links
- [ ] Beginner Modules section shows 3 modules from HubDB (difficulty=beginner)
- [ ] FAQ section displays 4 Q&A pairs
- [ ] Final CTA section displays with correct button link
- [ ] All cards show title, description, metadata
- [ ] All CTAs and links are clickable and navigate correctly
- [ ] Build marker present with current timestamp
- [ ] curl verification passes
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Accessibility checks pass
- [ ] SEO metadata set
- [ ] Page load time < 3 seconds (desktop), < 5 seconds (mobile)

### Data & Deployment

- [ ] HubDB pathways table has 3+ items tagged "featured" or display_order 1-3
- [ ] HubDB courses table has 3+ items tagged "popular" or display_order 1-3
- [ ] HubDB modules table has 3+ items with difficulty=beginner
- [ ] HubDB pathways table has 2+ items tagged "beginner"
- [ ] All HubDB content has meta_description populated
- [ ] All HubDB content has summary_markdown populated
- [ ] Catalog sync completed after tagging
- [ ] Templates published via Source Code v3 API (not File Manager)
- [ ] Pages published and cache flushed via `npm run publish:pages`
- [ ] Timestamp verification passed for both pages
- [ ] Rollback plan documented and tested

---

## Conclusion

This implementation plan provides a comprehensive, actionable roadmap for delivering the Hedgehog Learn landing and get-started pages. The plan:

✅ **Leverages existing infrastructure** - Minimal new development needed
✅ **Maps to HubDB data** - No schema changes required
✅ **Follows HubSpot best practices** - Coded templates, server-side HubL, CDN caching
✅ **Adheres to deployment workflow** - Follows CONTRIBUTING.md checklist
✅ **Identifies risks and dependencies** - Clear ownership and mitigation
✅ **Provides detailed acceptance criteria** - Testable, verifiable outcomes

### Next Steps

1. **Stakeholder Review:** Share this plan with product lead, content team, marketing team
2. **Retrieve Consultant Brief:** Validate this plan against original creative direction
3. **Finalize Copy:** Content team writes final copy using outlines in this doc
4. **Create Follow-Up Issues:** Break down implementation into GitHub issues
5. **Sprint Planning:** Assign issues to sprint, allocate developer time
6. **Begin Development:** Build templates once copy is in progress (parallel work)
7. **QA & Deploy:** Follow deployment checklist when ready

### Success Metrics (Post-Launch)

Track these metrics to measure landing page effectiveness:

- **Traffic:** Pageviews, unique visitors to `/learn` and `/learn/get-started`
- **Engagement:** Time on page, scroll depth, CTA click rate
- **Conversion:** Clicks to catalog, pathway enrollments (if auth enabled)
- **Bounce Rate:** Should decrease compared to old catalog page
- **SEO:** Organic search traffic, ranking for target keywords

**Recommendation:** Review metrics 2 weeks post-launch; iterate on underperforming sections.

---

**Document Status:** Planning complete; ready for stakeholder review and build approval.

**Questions?** Contact project lead or create GitHub issue with label `landing-pages`.
