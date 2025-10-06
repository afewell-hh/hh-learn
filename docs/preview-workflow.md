# Preview & Publishing Workflow

## Overview

To ensure existing site content is never affected by new development, follow this workflow for previewing and publishing new pages.

---

## Important Concepts

### Templates vs Pages in HubSpot

**Templates** (uploaded via CLI):
- Code files in Design Manager
- **NOT visible on live site**
- Can be updated without affecting published pages
- Safe to upload anytime

**Pages** (created in HubSpot UI):
- Actual content instances using templates
- Can be **Draft** or **Published**
- Draft pages are not visible to public
- Only published pages affect live site

---

## Safe Preview Workflow

### 1. Upload Templates (Already Done by Coding Agent)

Templates have been uploaded to HubSpot via `npm run cms:upload`:
- Landing page template
- Module detail template
- Pathway/Module card modules

**✅ Safe:** Templates don't affect live site until used in pages

### 2. Create Draft Pages in HubSpot

**For Landing Page:**
1. Go to **Marketing → Website → Website Pages**
2. Click **Create → Website page**
3. Select template: `landing.html` (from learn folder)
4. Configure:
   - **Page name:** "Learn Portal - PREVIEW"
   - **Page URL:** `/learn-preview` (not `/learn`)
   - **Page status:** **Draft** ⚠️ (critical!)
5. Add sample data (pathways, modules)
6. Click **"Save"** (not Publish)

**For Module Pages:**
1. Create → Website page
2. Select template: `module-detail.html`
3. Configure:
   - **Page name:** "Module: Intro to K8s - PREVIEW"
   - **Page URL:** `/learn-preview/module/intro-to-kubernetes`
   - **Page status:** **Draft**
4. Add module data (from `content/modules/intro-to-kubernetes.json`)
5. Save as draft

### 3. Preview Draft Pages

**Option A: Preview Button in HubSpot**
- Open draft page in editor
- Click **"Preview"** button (top right)
- HubSpot generates preview URL with auth token
- Test all functionality

**Option B: Share Preview Link**
- Click **"Actions"** → **"Share page"**
- Copy preview link
- Share with stakeholders for review
- Preview link works even for draft pages

### 4. Test Checklist

Before publishing, verify:
- [ ] All tabs work (Lab, Concepts, Resources)
- [ ] Code copy buttons functional
- [ ] Mobile responsive layout
- [ ] Navigation works (breadcrumbs, prev/next)
- [ ] Images/assets load correctly
- [ ] Links work properly
- [ ] No console errors in browser
- [ ] Sidebar metadata displays correctly
- [ ] Search/filter UI renders (even if not functional yet)

### 5. Approve & Publish

**Once satisfied with preview:**

1. **Merge PR to main:**
   ```bash
   gh pr merge <PR_NUMBER> --squash
   ```

2. **Publish pages in HubSpot:**
   - Open draft page
   - Change **Page status: Draft → Published**
   - Update URL to production path:
     - `/learn-preview` → `/learn`
     - `/learn-preview/module/...` → `/learn/module/...`
   - Click **"Publish"**

3. **Verify live:**
   - Visit `hedgehog.cloud/learn`
   - Test as end user
   - Check analytics/tracking

---

## Alternative: Staging Domain Setup

For a more robust workflow, configure a staging subdomain:

### Option 1: Subdomain Staging

**Setup:**
1. HubSpot → Settings → Website → Domains & URLs
2. Add subdomain: `staging.hedgehog.cloud`
3. Connect DNS records
4. Configure SSL

**Workflow:**
- Deploy all new pages to `staging.hedgehog.cloud/learn`
- Test thoroughly on staging
- Once approved, clone pages to production domain
- Publish on `hedgehog.cloud/learn`

**Pros:**
- ✅ Complete isolation from production
- ✅ Can share staging URLs easily
- ✅ No risk of accidental publishing

**Cons:**
- ⚠️ Requires DNS configuration
- ⚠️ Need to maintain two sets of pages

### Option 2: URL Path Staging

**Workflow:**
- Use URL paths to separate staging/production:
  - Staging: `hedgehog.cloud/preview/learn`
  - Production: `hedgehog.cloud/learn`
- Keep staging pages as draft (extra safety)

**Pros:**
- ✅ No DNS changes needed
- ✅ Simple to set up

**Cons:**
- ⚠️ URLs less clean
- ⚠️ Risk of confusion between paths

---

## Current Sprint 1 Pages to Create

Based on completed PRs #7, #8, #9:

### Draft Pages to Create for Preview:

1. **Landing Page:**
   - Template: `learn/landing.html`
   - URL: `/learn-preview`
   - Data: `content/landing-sample-data.json`

2. **Module: Intro to Kubernetes**
   - Template: `learn/module-detail.html`
   - URL: `/learn-preview/module/intro-to-kubernetes`
   - Data: `content/modules/intro-to-kubernetes.json`

3. **Module: Kubernetes Storage**
   - URL: `/learn-preview/module/kubernetes-storage`
   - Data: `content/modules/kubernetes-storage.json`

4. **Module: Kubernetes Networking**
   - URL: `/learn-preview/module/kubernetes-networking`
   - Data: `content/modules/kubernetes-networking.json`

---

## Emergency: Unpublish a Page

If a page was accidentally published:

1. Go to **Marketing → Website → Website Pages**
2. Find the page
3. Click **"Actions"** → **"Unpublish"**
4. Page immediately removed from live site
5. Still accessible as draft for editing

---

## Best Practices

### For Development:
- ✅ Always upload templates to draft pages first
- ✅ Use preview links for stakeholder review
- ✅ Test on mobile/tablet/desktop before publishing
- ✅ Keep PRs merged to main before publishing pages

### For Publishing:
- ⚠️ Never publish without preview testing
- ⚠️ Double-check URLs before publishing
- ⚠️ Coordinate with team on publish timing
- ⚠️ Have rollback plan (can unpublish anytime)

### For Team Coordination:
- 📝 Document which pages are in preview vs published
- 📝 Use HubSpot page tags: "preview", "production", "sprint-1"
- 📝 Comment in PR when pages are published live

---

## Next Steps (For You to Do in HubSpot)

1. **Review PRs #7, #8, #9** in GitHub
2. **Create draft pages** using uploaded templates
3. **Preview** the pages and test functionality
4. **If satisfied:** Merge PRs and publish pages
5. **If changes needed:** Request updates via GitHub issues

Templates are already in HubSpot and safe - your existing site is not affected!
