---
title: Hedgehog Learn Landing Pages - Technical Implementation Plan
issue: 285
status: planning-complete
created: 2025-11-05
owner: project lead
dependencies: [286, 287, 288]
---

# Hedgehog Learn Landing Pages - Technical Implementation Plan

This document provides the technical implementation plan for the new `/learn` and `/learn/get-started` landing pages, translating the consultant brief into actionable Hedgehog-standard architecture.

## Table of Contents
- [Executive Summary](#executive-summary)
- [Current State Analysis](#current-state-analysis)
- [HubDB Schema Review](#hubdb-schema-review)
- [Page Architecture](#page-architecture)
- [Component Mapping](#component-mapping)
- [Content Strategy](#content-strategy)
- [Deployment Process](#deployment-process)
- [Risks and Dependencies](#risks-and-dependencies)
- [Follow-up Issues](#follow-up-issues)

---

## Executive Summary

**Goal:** Deliver new landing pages at `/learn` and `/learn/get-started` that align with consultant positioning brief while respecting HubSpot CMS constraints and existing Hedgehog Learn architecture.

**Key Decisions:**
- ✅ Reuse existing HubDB tables (pathways, courses, modules) - no schema changes required
- ✅ Build new templates extending `layouts/base.html` with Clean x Hedgehog styling
- ✅ Use existing CSS/JS bundles (`catalog.css`, `pageview.js`, `auth-context.js`)
- ✅ Implement graceful fallbacks for empty HubDB data states
- ✅ Follow Source Code v3 publishing workflow per CONTRIBUTING.md

**Status:**
- Templates: `learn-landing.html` and `get-started.html` exist with placeholder copy
- Copy: Finalized copy delivered in issue #288
- Implementation: In progress via issue #286 (landing) and #287 (get-started)

---

## Current State Analysis

### Existing Templates Audit

**Location:** `clean-x-hedgehog-templates/learn/`

**Current Templates:**
1. `catalog.html` - Full catalog with filtering (currently used at `/learn`)
2. `courses-page.html` - Course detail page
3. `pathways-page.html` - Pathway detail page
4. `module-page.html` - Module detail page
5. `my-learning.html` - Personalized learning dashboard
6. **`learn-landing.html`** - NEW: Main landing page ✨
7. **`get-started.html`** - NEW: Orientation/getting started page ✨

**Reusable Components:**

| Component | Location | Used By | Notes |
|-----------|----------|---------|-------|
| Base Layout | `layouts/base.html` | All templates | Clean x Hedgehog header/footer, meta tags |
| Catalog CSS | `assets/css/catalog.css` | Catalog, landing pages | Card styles, grid system, badges |
| Landing CSS | `assets/css/learn-landing.css` | NEW landing pages | Hero, CTA sections, level cards |
| Auth Context | `assets/js/auth-context.js` | All learning pages | User authentication state |
| Pageview Tracking | `assets/js/pageview.js` | All learning pages | Analytics beacon |
| Constants | `config/constants.json` | All templates | HubDB table IDs, config values |

**Macros Available:**
- `learn/macros/` - Likely contains shared HubL components (needs audit if extending)

---

## HubDB Schema Review

### Current Tables

**Source:** `config/constants.json` loaded via `request_json` in templates

| Table | Constant | Fields Used | Schema Status |
|-------|----------|-------------|---------------|
| Pathways | `HUBDB_PATHWAYS_TABLE_ID` | `hs_name`, `hs_path`, `summary_markdown`, `difficulty`, `module_count`, `estimated_minutes`, `course_slugs_json`, `display_order` | ✅ Sufficient |
| Courses | `HUBDB_COURSES_TABLE_ID` | `hs_name`, `hs_path`, `summary_markdown`, `difficulty`, `module_count`, `estimated_minutes`, `display_order` | ✅ Sufficient |
| Modules | `HUBDB_MODULES_TABLE_ID` | `hs_name`, `hs_path`, `meta_description`, `difficulty`, `estimated_minutes`, `display_order` | ✅ Sufficient |
| Catalog | `HUBDB_CATALOG_TABLE_ID` | (Aggregated view) | ✅ Not used in landing pages |

### Query Strategy

**Featured Pathways** (`/learn` landing):
```hurl
hubdb_table_rows(HUBDB_PATHWAYS_TABLE_ID, "display_order__lte=3&orderBy=display_order")
```
- Returns top 3 pathways by display_order
- Fallback: Empty state with CTA to catalog

**Popular Courses** (`/learn` landing):
```hurl
hubdb_table_rows(HUBDB_COURSES_TABLE_ID, "display_order__lte=3&orderBy=display_order")
```
- Returns top 3 courses by display_order
- Fallback: Empty state with CTA to catalog

**Recent Modules** (`/learn` landing):
```hurl
hubdb_table_rows(HUBDB_MODULES_TABLE_ID, "orderBy=display_order&limit=6")
```
- Returns 6 modules by display_order (proxy for recent)
- Fallback: Empty state with CTA to catalog

**Flagship Pathway Topics** (`/learn/get-started`):
```hurl
# Step 1: Get pathway by slug
hubdb_table_rows(HUBDB_PATHWAYS_TABLE_ID, "hs_path__eq=network-like-hyperscaler")

# Step 2: Parse course_slugs_json
pathway.course_slugs_json | fromjson

# Step 3: Fetch all courses and build lookup
all_courses = hubdb_table_rows(HUBDB_COURSES_TABLE_ID)
courses_by_slug = {course.hs_path: course for course in all_courses}

# Step 4: Render courses in pathway order
for slug in course_slugs: render courses_by_slug[slug]
```
- Dynamic based on pathway configuration
- Fallback: Empty state with CTA to pathway detail

### Schema Changes Required

**✅ NONE** - Current HubDB schema fully supports all landing page sections.

**Future Enhancements (Issue #289 - Create if needed):**
- Consider adding `featured` boolean flag for explicit curation vs. display_order
- Consider adding `card_image_url` for visual cards (currently not used)
- Consider adding `updated_at` timestamp for true "Recently Added" sorting

---

## Page Architecture

### /learn Landing Page

**Template:** `clean-x-hedgehog-templates/learn/learn-landing.html`

**Sections:**

1. **Hero Section** (`learn-header-section`)
   - H1 headline
   - Subtitle paragraph
   - Dual CTAs (primary: Get Started, secondary: Browse Catalog)
   - Static content (no HubDB dependency)

2. **Featured Pathways** (`landing-section`)
   - Dynamic: HubDB query for top 3 pathways
   - Card layout: `catalog-grid` → `catalog-card`
   - Fallback: Empty state with catalog CTA

3. **Popular Courses** (`landing-section`)
   - Dynamic: HubDB query for top 3 courses
   - Card layout: `catalog-grid` → `catalog-card`
   - Fallback: Empty state with catalog CTA

4. **Learning by Level** (`landing-section`)
   - Static: 3 level cards (beginner, intermediate, advanced)
   - Each links to `/learn/catalog?level={level}`
   - No HubDB dependency

5. **Recent Modules** (`landing-section`)
   - Dynamic: HubDB query for 6 recent modules
   - Card layout: `catalog-grid` → `catalog-card`
   - Fallback: Empty state with catalog CTA

6. **Final CTA** (`landing-cta-section`)
   - Static: Hero-style CTA
   - Primary button to Get Started page

**CSS Dependencies:**
- `assets/css/catalog.css` (cards, grid, badges)
- `assets/css/learn-landing.css` (hero, CTA sections, level cards)

**JS Dependencies:**
- `assets/js/pageview.js` (analytics)
- `assets/js/auth-context.js` (auth state)

---

### /learn/get-started Page

**Template:** `clean-x-hedgehog-templates/learn/get-started.html`

**Sections:**

1. **Hero Section** (`learn-header-section`)
   - H1 headline: "Welcome to Hedgehog Learn"
   - Subtitle focusing on flagship pathway
   - Dual CTAs (primary: Start Network Like a Hyperscaler, secondary: Browse Catalog)
   - Static content (no HubDB dependency)

2. **Key Topics** (`landing-section`)
   - Dynamic: Query Network Like a Hyperscaler pathway, display its courses
   - Card layout: `catalog-grid` → `catalog-card`
   - Fallback: Empty state with pathway link

3. **Next Steps** (`landing-section`)
   - Static: 3 navigation cards
     - Browse Full Catalog
     - View All Pathways
     - Start with Basics (beginner filter)
   - No HubDB dependency

4. **Final CTA** (`landing-cta-section`)
   - Static: Hero-style CTA
   - Primary button to Network Like a Hyperscaler pathway

**CSS/JS Dependencies:** Same as landing page

---

## Component Mapping

### Consultant Brief → Hedgehog Components

| Consultant Section | Hedgehog Component | Data Source | Template Class |
|--------------------|-------------------|-------------|----------------|
| Hero with dual CTAs | Hero section | Static copy | `learn-header-section` |
| Featured pathways showcase | Catalog cards grid | HubDB Pathways | `catalog-grid` + `catalog-card` |
| Course highlights | Catalog cards grid | HubDB Courses | `catalog-grid` + `catalog-card` |
| Difficulty level navigation | Level cards | Static copy | `level-cards` + `level-card` |
| Recent content | Catalog cards grid | HubDB Modules | `catalog-grid` + `catalog-card` |
| CTA band | CTA section | Static copy | `landing-cta-section` |

### Card Component Anatomy

**Reused from catalog.html:**
```html
<article class="catalog-card">
  <div class="catalog-card-header">
    <span class="catalog-type-badge catalog-type-{type}">{Type}</span>
    <span class="catalog-level-badge">{difficulty}</span>
  </div>
  <h3 class="catalog-card-title">
    <a href="/learn/{type}s/{slug}">{title}</a>
  </h3>
  <p class="catalog-card-summary">{summary}</p>
  <div class="catalog-card-meta">
    <span class="catalog-meta-item">📚 {count} modules</span>
    <span class="catalog-meta-item">⏱️ {hours} hours</span>
  </div>
  <a href="/learn/{type}s/{slug}" class="catalog-card-cta">
    Start {Type} →
  </a>
</article>
```

**Benefits:**
- Consistent visual language across catalog and landing pages
- No new CSS required for cards
- Proven responsive behavior
- Accessible markup already validated

---

## Content Strategy

### Copy Ownership

**Status:** Finalized copy delivered in [Issue #288](https://github.com/afewell-hh/hh-learn/issues/288)

**Document:** `docs/issue-288-finalized-copy.md`

**Sections Covered:**
- ✅ SEO metadata (titles, descriptions, OG tags)
- ✅ Hero headlines and subtitles
- ✅ Section intros and CTAs
- ✅ Empty state messaging
- ✅ Level card descriptions
- ✅ Final CTA copy

**Brand Voice:**
- Active voice, second person, present tense
- Conversational but professional
- Outcome-focused with action verbs
- Bridges cloud-native and traditional networking audiences

**Character Limits:**
- SEO descriptions: 120-160 characters ✅
- CTA labels: ≤20 characters for primary, ≤50 for feature CTAs ✅
- Hero headlines: ≤80 characters ✅

### Imagery and Assets

**Current State:**
- Social image: `DEFAULT_SOCIAL_IMAGE_URL` from constants.json
- No custom hero images planned (Clean x Hedgehog styling is text-focused)
- Emoji icons used for level cards (🌱, 📈, 🎓)

**Future Enhancements:**
- Consider custom social preview images for landing pages
- Consider pathway/course thumbnail images for cards (requires HubDB schema extension)

---

## Deployment Process

### Pre-Deployment Checklist

Per `CONTRIBUTING.md`, the following steps are **mandatory** in order:

#### 1. Update Build Markers

Both templates must include updated build markers near the bottom:

```html
<div class="hhl-build" data-build="2025-11-05T20:00Z"></div>
```

Update timestamp to current UTC time before each deploy.

#### 2. Upload Project Bundle

```bash
hs project upload --account=hh
```

This ensures HubSpot is aware of new source files. Required even though we're using Source Code v3 API.

#### 3. Publish Templates via Source Code v3

```bash
# Publish landing page template
npm run publish:template -- \
  --path "CLEAN x HEDGEHOG/templates/learn/learn-landing.html" \
  --local "clean-x-hedgehog-templates/learn/learn-landing.html"

# Publish get-started template
npm run publish:template -- \
  --path "CLEAN x HEDGEHOG/templates/learn/get-started.html" \
  --local "clean-x-hedgehog-templates/learn/get-started.html"

# If new CSS/JS assets added:
npm run publish:template -- \
  --path "CLEAN x HEDGEHOG/templates/assets/css/learn-landing.css" \
  --local "clean-x-hedgehog-templates/assets/css/learn-landing.css"
```

**Critical:** Run once for *each* modified file. File Manager will NOT work - must use Source Code v3.

#### 4. Publish Pages

```bash
npm run publish:pages
```

This flushes page-level cache and ensures new templates go live immediately.

#### 5. Verify from Edge

```bash
# Verify landing page
curl -s https://hedgehog.cloud/learn | grep data-build

# Verify get-started page
curl -s https://hedgehog.cloud/learn/get-started | grep data-build
```

**Expected output:** Timestamp must match step 1. If not, repeat step 3 for that template.

#### 6. Browser Validation

- Hard-refresh in browser (`Ctrl/Cmd+Shift+R`)
- Confirm UI renders correctly
- Check browser console for errors
- Test CTAs and navigation
- Validate responsive behavior (mobile, tablet, desktop)

### Common Deployment Mistakes (from CONTRIBUTING.md)

| Mistake | Why It Fails | Fix |
|---------|-------------|------|
| Using `hs filemanager upload` | File Manager ≠ Design Manager | Always use `npm run publish:template` |
| Skipping page publish | Template updated but page cache stale | Always run `npm run publish:pages` |
| Debugging before timestamp check | Deploy failed silently | Only start QA after timestamp succeeds |

---

## Risks and Dependencies

### Technical Risks

| Risk | Severity | Mitigation | Owner |
|------|----------|-----------|--------|
| HubDB data missing (empty tables) | Low | Graceful fallbacks implemented in templates | ✅ Resolved |
| Source Code v3 publish failures | Medium | Retry logic in scripts; manual fallback documented | Scripts team |
| Page cache not flushing | Medium | `publish:pages` step mandatory; documented in checklist | Deployment lead |
| Responsive layout issues | Low | Reusing proven `catalog.css` patterns | Design QA |
| SEO metadata not rendering | Low | Using same patterns as existing detail pages | SEO team |

### Content Dependencies

| Dependency | Status | Owner | Blocker? |
|-----------|--------|-------|----------|
| Finalized copy for all sections | ✅ Complete (#288) | Marketing + Product | No |
| "Network Like a Hyperscaler" pathway published | ✅ Live | Content team | No |
| HubDB tables populated with content | ✅ Synced | Content sync job | No |
| Marketing approval of positioning | ⏳ Pending | Marketing lead | **Yes** |
| Product sign-off on UX | ⏳ Pending | Product lead | **Yes** |

### External Dependencies

| Dependency | Status | Impact | Notes |
|-----------|--------|--------|-------|
| HubSpot CMS availability | ✅ Stable | High | No known issues |
| Clean x Hedgehog theme stability | ✅ Stable | High | No changes planned |
| HubDB table IDs | ✅ Configured | High | In `constants.json` |
| Edge/CDN performance | ✅ Verified | Medium | Timestamp checks pass |

---

## Follow-up Issues

### Immediate (Blocking Launch)

- **Issue #286**: Build dedicated /learn landing page
  - Status: OPEN
  - Blocker: Copy approval from #288
  - Owner: Development team

- **Issue #287**: Implement /learn/get-started orientation page
  - Status: CLOSED ✅
  - No blockers

- **Issue #288**: Finalize copy for /learn and /learn/get-started
  - Status: OPEN
  - Blocker: Stakeholder approval (product + marketing)
  - Owner: Marketing + Product leads

### Recommended Enhancements (Post-Launch)

**Issue #289: Enhance HubDB schema for featured content** (create if needed)
- Add `featured` boolean flag to pathways/courses tables
- Add `card_image_url` for visual cards
- Add `updated_at` timestamp for true "Recently Added" sorting
- Priority: P2 (nice-to-have, not blocking)

**Issue #290: Landing page analytics instrumentation** (create if needed)
- Track CTA click rates
- Track section scroll depth
- Track empty state view frequency
- A/B test hero copy variants
- Priority: P2 (post-launch optimization)

**Issue #291: Custom social preview images** (create if needed)
- Design custom OG images for landing pages
- Upload to HubSpot File Manager
- Update templates with custom image URLs
- Priority: P3 (polish)

---

## Validation Checklist

### Technical Validation

- [x] HubDB schema reviewed - no changes required
- [x] Templates extend correct base layout
- [x] CSS/JS dependencies identified and available
- [x] HubDB queries tested in existing templates
- [x] Empty state fallbacks implemented
- [x] Graceful degradation for missing data
- [x] Build markers present in templates
- [x] Deployment checklist documented

### Content Validation

- [x] Copy delivered in structured format (#288)
- [x] SEO metadata within character limits
- [x] Brand voice guidelines applied
- [x] CTA targets validated
- [x] Link destinations confirmed
- [ ] Marketing approval received (PENDING)
- [ ] Product approval received (PENDING)

### Operational Validation

- [x] Deployment process documented
- [x] Verification commands provided
- [x] Common mistakes documented
- [x] Rollback procedure clear (republish previous version)
- [x] Monitoring strategy defined (timestamp checks)

---

## Acceptance Criteria (Issue #285)

✅ **Planning artifact delivered:** This document (`docs/issue-285-landing-pages-plan.md`)

✅ **Component mapping complete:** Consultant sections mapped to Hedgehog components with reuse strategy documented

✅ **HubDB strategy documented:** Query patterns defined; schema confirmed sufficient

✅ **References included:** HubSpot CMS patterns validated; Contributing checklist referenced

✅ **Risks documented:** Technical, content, and external dependencies listed with mitigation

✅ **Follow-up issues identified:** Immediate blockers (#286, #287, #288) and post-launch enhancements defined

---

## Appendix: HubSpot CMS Capabilities Reference

### Dynamic Content in Static Pages

**Capability:** HubSpot CMS Static pages support HubL templating, including dynamic HubDB queries.

**Pattern Used:**
```jinja
{% set constants = get_asset_url("/CLEAN x HEDGEHOG/templates/config/constants.json")|request_json %}
{% set pathways = hubdb_table_rows(constants.HUBDB_PATHWAYS_TABLE_ID, "display_order__lte=3") %}
{% for pathway in pathways %}
  {# Render pathway card #}
{% endfor %}
```

**Documentation:**
- [HubDB Table Rows](https://developers.hubspot.com/docs/cms/hubl/functions#hubdb-table-rows)
- [HubL Variables](https://developers.hubspot.com/docs/cms/hubl/variables)
- [Request JSON Filter](https://developers.hubspot.com/docs/cms/hubl/filters#request-json)

### Forms on Custom Templates

**Capability:** HubSpot forms can be embedded in custom templates via `form` HubL tag or embed code.

**Pattern (if needed):**
```jinja
{% form "form-guid" %}
```

**Note:** Not currently used in landing pages; newsletter signup may be added in future.

**Documentation:**
- [Forms Module](https://developers.hubspot.com/docs/cms/building-blocks/modules/forms)

### Source Code v3 Publishing

**Capability:** Programmatic template publishing via Source Code v3 API.

**Pattern:** See `scripts/hubspot/publish-pages.ts` and `publish-template.ts`

**Documentation:**
- [Source Code API v3](https://developers.hubspot.com/docs/api/cms/source-code)

---

**Document Version:** 1.0
**Status:** Planning Complete ✅
**Next Steps:** Await stakeholder approval on #288, then proceed with implementation in #286
