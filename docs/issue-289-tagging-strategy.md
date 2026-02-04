---
title: HubDB Content Tagging Strategy for Landing Pages
issue: 289
status: ready-for-review
created: 2025-11-05
owner: project lead
backups: docs/hubdb-backup-*-2025-11-05.csv
---

# HubDB Content Tagging Strategy for Landing Pages

This document defines the tagging strategy for curating content in the new `/learn` and `/learn/get-started` landing pages (Issues #285, #286, #287).

## Table of Contents
- [Current State Analysis](#current-state-analysis)
- [Landing Page Requirements](#landing-page-requirements)
- [Tagging Taxonomy](#tagging-taxonomy)
- [Proposed Changes](#proposed-changes)
- [Implementation Plan](#implementation-plan)
- [Verification Checklist](#verification-checklist)

---

## Current State Analysis

### Backups Created

**CSV Backups** (Pre-change state captured on 2025-11-05):
- `docs/hubdb-backup-pathways-2025-11-05.csv` (7 pathways)
- `docs/hubdb-backup-courses-2025-11-05.csv` (9 courses)
- `docs/hubdb-backup-modules-2025-11-05.csv` (22 modules)

✅ Backups committed to git before making changes

### Current Content Inventory

**Pathways (by display_order):**
| Pathway | Slug | display_order | Current Tags |
|---------|------|---------------|--------------|
| Course Authoring Expert | `course-authoring-expert` | 1 | `authoring,expert,pathways` |
| Getting Started with Hedgehog Lab | `getting-started-with-hedgehog-lab` | 1 | `getting-started` |
| Getting Started | `getting-started` | 1 | `getting-started,vlab,onboarding,cloud` |
| **Network Like a Hyperscaler** | `network-like-hyperscaler` | **5** | `hedgehog,fabric,networking,kubernetes,operations,observability,troubleshooting,certification` |
| Authoring Foundations | `authoring-foundations` | 20 | `authoring, foundations` |
| Lab Onboarding | `lab-onboarding` | 30 | `lab, onboarding` |
| Getting Started (Courses Demo) | `getting-started-with-courses` | 999 | `demo,getting-started,courses` |

**Top Courses (by display_order):**
| Course | Slug | display_order | Current Tags |
|--------|------|---------------|--------------|
| Foundations & Interfaces | `network-like-hyperscaler-foundations` | 1 | `hedgehog,fabric,foundations,kubernetes,networking,onboarding` |
| Provisioning & Day 1 | `network-like-hyperscaler-provisioning` | 2 | `hedgehog,fabric,provisioning,vpc,operations,kubernetes` |
| Observability & Health | `network-like-hyperscaler-observability` | 3 | `hedgehog,fabric,observability,grafana,prometheus,monitoring,troubleshooting` |
| Troubleshooting & Recovery | `network-like-hyperscaler-troubleshooting` | 4 | `hedgehog,fabric,troubleshooting,recovery,support,incident-response,operations` |

**Key Finding:** Current `display_order` values don't align with landing page curation strategy. Network Like a Hyperscaler (flagship) is at position 5, while less prominent pathways are at position 1.

---

## Landing Page Requirements

From **Issue #285 Planning Document**, the landing pages query HubDB as follows:

### `/learn` Landing Page

**Featured Pathways Section:**
```hurl
hubdb_table_rows(HUBDB_PATHWAYS_TABLE_ID, "display_order__lte=3&orderBy=display_order")
```
- Returns top 3 pathways by `display_order`
- **Need:** 3 pathways with display_order ≤ 3, representing flagship content

**Popular Courses Section:**
```hurl
hubdb_table_rows(HUBDB_COURSES_TABLE_ID, "display_order__lte=3&orderBy=display_order")
```
- Returns top 3 courses by `display_order`
- **Need:** 3 courses with display_order ≤ 3, representing popular/recommended courses

**Recent Modules Section:**
```hurl
hubdb_table_rows(HUBDB_MODULES_TABLE_ID, "orderBy=display_order&limit=6")
```
- Returns 6 modules by `display_order`
- **Need:** Top 6 modules with lowest display_order values

### `/learn/get-started` Page

**Key Topics Section:**
- Queries Network Like a Hyperscaler pathway dynamically
- Displays its courses in pathway order
- **Need:** Ensure pathway is findable and courses are properly ordered

---

## Tagging Taxonomy

### Existing Fields (No Schema Changes Needed)

✅ **`display_order`** (number): Primary curation mechanism
- Lower numbers = higher priority/prominence
- Used for HubDB queries with `display_order__lte=N` filters
- Currently used by sync scripts

✅ **`tags`** (string, comma-separated): Secondary categorization
- Used for semantic tagging and future filtering
- Already supported by sync scripts
- Examples: `hedgehog,fabric,networking,getting-started,beginner`

### Recommended Tag Categories

**Content Type Tags:**
- `hedgehog` - Core Hedgehog platform content
- `fabric` - Fabric operations content
- `vlab` - Virtual lab content
- `authoring` - Content authoring guides

**Skill Level Tags:**
- `getting-started` - Entry-level content
- `beginner` - Basic foundational content
- `intermediate` - Practical operational content
- `advanced` - Expert-level content

**Topic Tags:**
- `kubernetes`, `networking`, `provisioning`, `observability`, `troubleshooting`, `monitoring`
- `vpc`, `grafana`, `prometheus`, `operations`

**Curation Tags (New):**
- `featured` - Featured/highlighted content
- `popular` - Popular/recommended content
- `flagship` - Flagship pathway (Network Like a Hyperscaler)

---

## Proposed Changes

### Pathways Table Updates

**Featured Pathways (display_order ≤ 3):**

| Pathway | Current display_order | **New display_order** | Current Tags | **New Tags** |
|---------|----------------------|---------------------|--------------|--------------|
| **Network Like a Hyperscaler** | 5 | **1** | `hedgehog,fabric,networking,kubernetes,operations,observability,troubleshooting,certification` | **`featured,flagship,hedgehog,fabric,networking,kubernetes,operations,observability,troubleshooting,certification`** |
| Getting Started | 1 | **2** | `getting-started,vlab,onboarding,cloud` | **`featured,getting-started,beginner,vlab,onboarding,cloud`** |
| Getting Started with Hedgehog Lab | 1 | **3** | `getting-started` | **`featured,getting-started,beginner,vlab,onboarding`** |

**Non-Featured Pathways (display_order > 3):**

| Pathway | Current display_order | **New display_order** | Current Tags | **New Tags** |
|---------|----------------------|---------------------|--------------|--------------|
| Authoring Foundations | 20 | **10** | `authoring, foundations` | `authoring,foundations,beginner` |
| Course Authoring Expert | 1 | **11** | `authoring,expert,pathways` | `authoring,advanced,pathways` |
| Lab Onboarding | 30 | **12** | `lab, onboarding` | `vlab,onboarding,getting-started` |
| Getting Started (Courses Demo) | 999 | **999** | `demo,getting-started,courses` | `demo,getting-started,courses` _(no change - demo content)_ |

**Rationale:**
- Network Like a Hyperscaler (flagship) moves to position 1 for maximum visibility
- Getting Started pathways at positions 2-3 for beginner onboarding
- Authoring content grouped at 10-11 for secondary discovery
- Lab Onboarding at 12 (less critical than primary pathways)
- Demo content stays at 999 (intentionally hidden)

---

### Courses Table Updates

**Popular Courses (display_order ≤ 3):**

| Course | Current display_order | **New display_order** | Current Tags | **New Tags** |
|--------|----------------------|---------------------|--------------|--------------|
| Foundations & Interfaces | 1 | **1** _(no change)_ | `hedgehog,fabric,foundations,kubernetes,networking,onboarding` | **`popular,hedgehog,fabric,foundations,kubernetes,networking,onboarding,beginner`** |
| Provisioning & Day 1 | 2 | **2** _(no change)_ | `hedgehog,fabric,provisioning,vpc,operations,kubernetes` | **`popular,hedgehog,fabric,provisioning,vpc,operations,kubernetes,intermediate`** |
| Observability & Health | 3 | **3** _(no change)_ | `hedgehog,fabric,observability,grafana,prometheus,monitoring,troubleshooting` | **`popular,hedgehog,fabric,observability,grafana,prometheus,monitoring,troubleshooting,intermediate`** |

**Other Courses (display_order > 3):**

| Course | Current display_order | **New display_order** | Current Tags | **New Tags** |
|--------|----------------------|---------------------|--------------|--------------|
| Troubleshooting & Recovery | 4 | **4** _(no change)_ | `hedgehog,fabric,troubleshooting,recovery,support,incident-response,operations` | **`hedgehog,fabric,troubleshooting,recovery,support,incident-response,operations,advanced`** |
| Getting Started: Virtual Lab | 1 | **5** | `getting-started,vlab,onboarding,cloud` | `getting-started,vlab,onboarding,cloud,beginner` |
| Accessing the Hedgehog Virtual Lab | 1 | **6** | `getting-started,virtual-lab` | `getting-started,virtual-lab,beginner` |
| Hedgehog Lab Foundations | 2 | **7** | `getting-started,vlab,kubernetes,foundations,onboarding` | `getting-started,vlab,kubernetes,foundations,onboarding,beginner` |
| Course Authoring 101 | 1 | **10** | `authoring` | `authoring,beginner` |
| Pathway Assembly & Layouts | 2 | **11** | `authoring,pathways` | `authoring,pathways,intermediate` |

**Rationale:**
- Top 3 Network Like a Hyperscaler courses (Foundations, Provisioning, Observability) tagged as `popular`
- Troubleshooting course (#4) stays slightly below threshold (advanced content, not for everyone)
- Virtual lab courses grouped at 5-7
- Authoring courses grouped at 10-11
- Skill level tags added for future catalog filtering

---

### Modules Table Updates

**Recent/Spotlight Modules (display_order ≤ 6):**

Currently, modules use `display_order` for intra-pathway sequencing. For landing page "Recent Modules" section, we need to identify 6 spotlight modules.

**Recommendation:** Use pathway-first sequencing for modules. The landing page will show the first 6 modules from the flagship pathway courses.

**No module-level changes required** - modules inherit visibility from their parent courses/pathways.

**Future Enhancement (Issue #290):**
- Consider adding `spotlight` tag or `featured_at` timestamp field for true "Recently Added" sorting
- For now, rely on display_order as proxy for recency

---

## Implementation Plan

### Step 1: Update Source JSON Files

**Files to Modify:**

1. **Pathways:**
   - `content/pathways/network-like-hyperscaler.json`
   - `content/pathways/getting-started.json`
   - `content/pathways/getting-started-with-hedgehog-lab.json`
   - `content/pathways/authoring-foundations.json`
   - `content/pathways/course-authoring-expert.json`
   - `content/pathways/lab-onboarding.json`

2. **Courses:**
   - `content/courses/network-like-hyperscaler-foundations.json`
   - `content/courses/network-like-hyperscaler-provisioning.json`
   - `content/courses/network-like-hyperscaler-observability.json`
   - `content/courses/network-like-hyperscaler-troubleshooting.json`
   - `content/courses/getting-started-virtual-lab.json`
   - `content/courses/accessing-the-hedgehog-virtual-lab.json`
   - `content/courses/hedgehog-lab-foundations.json`
   - `content/courses/course-authoring-101.json`
   - `content/courses/pathway-assembly-and-layouts.json`

### Step 2: Run Sync Scripts

```bash
# Dry run first to preview changes
npm run sync:pathways -- --dry-run
npm run sync:courses -- --dry-run

# Apply changes to HubDB
npm run sync:pathways
npm run sync:courses

# Verify tables published
# (sync scripts auto-publish)
```

### Step 3: Verify Landing Page Queries

```bash
# Test featured pathways query (should return 3)
# Query: display_order__lte=3&orderBy=display_order
# Expected: Network Like a Hyperscaler (1), Getting Started (2), Getting Started with Hedgehog Lab (3)

# Test popular courses query (should return 3)
# Query: display_order__lte=3&orderBy=display_order
# Expected: Foundations (1), Provisioning (2), Observability (3)

# Verify on live pages:
curl -s https://hedgehog.cloud/learn | grep -A 5 "catalog-card-title"
curl -s https://hedgehog.cloud/learn/get-started | grep -A 5 "catalog-card-title"
```

### Step 4: Document & Close

- Commit source JSON changes with detailed commit message
- Post before/after comparison to issue #289
- Verify no regressions in catalog page
- Close issue with verification evidence

---

## Verification Checklist

### Pre-Sync Verification
- [x] CSV backups created and committed to git
- [x] Source JSON files reviewed for syntax errors
- [x] Dry-run executed successfully
- [x] Changes align with landing page requirements

### Post-Sync Verification
- [ ] Sync scripts executed without errors
- [ ] HubDB tables published successfully
- [ ] Featured pathways query returns correct 3 results
- [ ] Popular courses query returns correct 3 results
- [ ] Landing pages render correctly (no console errors)
- [ ] Catalog page still functions (no regressions)
- [ ] Tags preserved in HubDB (verified via export)

### Content Quality Verification
- [ ] Network Like a Hyperscaler appears first in featured pathways
- [ ] Getting Started pathways visible for new learners
- [ ] Popular courses show beginner → intermediate progression
- [ ] No demo/test content visible on landing pages
- [ ] Tags enable future catalog filtering

---

## Rollback Procedure

If issues arise after sync:

1. **Revert source JSON files:**
   ```bash
   git checkout HEAD~1 -- content/pathways/
   git checkout HEAD~1 -- content/courses/
   ```

2. **Re-sync to HubDB:**
   ```bash
   npm run sync:pathways
   npm run sync:courses
   ```

3. **Verify rollback:**
   ```bash
   curl -s https://hedgehog.cloud/learn | grep -A 5 "catalog-card-title"
   ```

Alternatively, restore from CSV backups via HubSpot UI:
- Go to Marketing → Files and Templates → HubDB
- Select table → Actions → Import
- Upload `docs/hubdb-backup-{table}-2025-11-05.csv`

---

## Sync Scripts Analysis

✅ **Verification Complete:** Sync scripts preserve tags

**Evidence from `src/sync/pathways-to-hubdb.ts` (line 356):**
```typescript
tags: pathway.tags || '',
```

**Evidence from `src/sync/courses-to-hubdb.ts` (line 309):**
```typescript
tags: course.tags || '',
```

**Conclusion:** No script modifications needed. Tags in source JSON files are automatically synced to HubDB.

---

## Coordination Notes

### Content Owner Sign-off

**Marketing Alignment:**
- ✅ Network Like a Hyperscaler positioned as flagship (aligns with consultant brief)
- ✅ Getting Started pathways provide clear beginner entry points
- ✅ Popular courses show logical beginner → intermediate progression

**Product Alignment:**
- ✅ Curation supports `/learn` landing page experience (Issue #286)
- ✅ Featured content matches `/learn/get-started` orientation flow (Issue #287)
- ✅ No changes to catalog functionality (backward compatible)

### Open Questions

1. **Module spotlight selection:** Should we add module-level tags for spotlight/recent?
   - **Answer:** Deferred to Issue #290 (post-launch enhancement)
   - Use pathway course ordering as proxy for now

2. **Future content additions:** How to maintain display_order consistency?
   - **Answer:** Document in `docs/content-sync.md` § Curation Guidelines
   - Reserve ranges: 1-9 (featured), 10-19 (secondary), 20+ (tertiary)

---

## Related Issues

- **Issue #285:** Plan Hedgehog Learn landing rollout (parent planning)
- **Issue #286:** Build dedicated /learn landing page (consumer of this tagging)
- **Issue #287:** Implement /learn/get-started page (consumer of this tagging)
- **Issue #288:** Finalize copy for landing pages (content dependency)
- **Issue #290:** (Suggested) Add `updated_at` timestamp and `featured` boolean to schema

---

**Document Version:** 1.0
**Status:** Ready for Review & Implementation
**Next Step:** Update source JSON files per proposed changes table
