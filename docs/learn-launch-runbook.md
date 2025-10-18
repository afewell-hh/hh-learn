# Learn Platform MVP Launch Runbook

> Last reviewed: 2025-10-17 (verified 2025-10-17T17:17Z)

**Date:** October 17, 2025
**Version:** 1.0
**Stage:** MVP Go-Live

## Overview

This runbook outlines the steps to launch the Hedgehog Learn platform MVP, including content pipeline operations, verification procedures, and beacon tracking validation.

**Evidence folder:** `verification-output/issue-188/` (artifact snapshots captured 2025-10-17 for checklist references).

---

## Pre-Launch Checklist

### Infrastructure
- [x] CloudWatch alarms deployed (lambda-errors, httpapi-5xx, httpapi-latency, lambda-throttles, composite) _(AWS CLI export `verification-output/issue-188/aws-cloudwatch-alarms.json` captured 2025-10-17 confirms composite alarm `hedgehog-learn-dev-api-red`.)_
- [x] API Gateway endpoints verified (`/events/track`, `/quiz/grade`, `/progress/read`) _(curl checks captured 2025-10-17 in `verification-output/issue-188/events-track-anon-response.json`, `quiz-grade-response.json`, `progress-read-response.json`, and `progress-read-email-response.json`.)_
- [x] CloudWatch log retention set to 30 days _(Verified via `verification-output/issue-188/aws-log-groups.json`, log group `/aws/lambda/hedgehog-learn-dev-api` reports 30-day retention.)_
- [x] constants.json published to HubSpot with correct `TRACK_EVENTS_URL` _(Live asset snapshot stored at `verification-output/issue-188/constants-json-live.json`, fetched 2025-10-17.)_

### Configuration
- [x] `ENABLE_CRM_PROGRESS` feature flag configured _(True in live constants and Lambda env; see `verification-output/issue-188/aws-lambda-config-sanitized.json` and authenticated progress read response.)_
- [x] `PROGRESS_BACKEND` set to appropriate mode (properties/hubdb) _(Lambda env snapshot `verification-output/issue-188/aws-lambda-config-sanitized.json`.)_
- [x] CORS configured for hedgehog.cloud domain _(OPTIONS preflight 2025-10-17 returned `access-control-allow-origin: https://hedgehog.cloud`; see `verification-output/issue-188/events-track-options-headers.txt`.)_

---

## MVP Content Scope

### Modules (15)
Current HubDB-backed modules published to `/learn/modules` (JSON-LD snapshot 2025-10-17 stored in `verification-output/issue-188/modules.html`):
1. Accessing the Hedgehog Virtual Lab with Google Cloud
2. Accessing the Hedgehog Virtual Lab with Amazon Web Services
3. Accessing the Hedgehog Virtual Lab with Microsoft Azure
4. Authoring Basics: Modules, Front Matter, and Sync
5. Welcome to Fabric Operations
6. How Hedgehog Works: The Control Model
7. Mastering the Three Interfaces
8. Course 1 Recap & Forward Map
9. Media & Metadata: Images, Social Previews, and Tags
10. Assembling Courses from Modules
11. QA & Troubleshooting: Sync, Beacons, and Verification
12. Pathways & Content Blocks
13. Kubernetes Storage: Persistent Volumes and Claims
14. Introduction to Kubernetes
15. Kubernetes Networking: Services, Ingress, and Network Policies

### Courses (6)
Live courses observed on `/learn/courses` (JSON-LD snapshot in `verification-output/issue-188/courses.html`):
1. Course 1: Foundations & Interfaces
2. Getting Started: Virtual Lab
3. Accessing the Hedgehog Virtual Lab
4. Course Authoring 101
5. Hedgehog Lab Foundations
6. Pathway Assembly & Layouts

### Pathways (7)
Live pathways observed on `/learn/pathways` (JSON-LD snapshot in `verification-output/issue-188/pathways.html`):
1. Network Like a Hyperscaler with Hedgehog
2. Getting Started
3. Getting Started with Hedgehog Lab
4. Hedgehog Learn: Course Authoring Pathway
5. Authoring Foundations
6. Lab Onboarding
7. Getting Started (Courses Demo)

---

## Content Pipeline Steps

### 1. Editorial Review
**Owner:** Content Team
**Checklist:**
- [ ] All 15 modules reviewed for accuracy _(Awaiting Content team confirmation; no fresh sign-off logged 2025-10-17.)_
- [ ] Quiz questions validated _(Blocked pending Content QA review.)_
- [ ] Learning objectives defined _(Need updated documentation entry for expanded module set.)_
- [ ] Prerequisites documented _(Pending Content updates.)_
- [ ] Estimated completion times set _(Data absent from current HubDB rows—requires author input.)_
- [ ] Images/diagrams optimized _(Needs visual QA pass.)_
- [ ] Links verified _(Full editorial link check outstanding.)_

### 2. Content Sync to HubDB

#### Modules Sync
```bash
# Sync individual module (example)
npm run sync:module -- intro-to-hedgehog

# Or sync all modules
npm run sync:modules
```

**Verification:**
- [x] Check HubDB table `HUBDB_MODULES_TABLE_ID` (135621904) _(Verified indirectly via `/learn/modules` response headers showing `DB-135621904`; curl evidence stored in `modules-headers.txt`.)_
- [ ] Verify all fields populated correctly _(Requires HubSpot HubDB view/export; only front-end spot-check completed.)_
- [ ] Confirm `hs_id` and `hs_path` set _(Needs HubSpot portal access.)_
- [ ] Check module status is "published" _(Pending HubSpot portal confirmation.)_

#### Courses Sync
```bash
npm run sync:courses
```

**Verification:**
- [x] Check HubDB table `HUBDB_COURSES_TABLE_ID` (135381433) _(Course listing response headers include `DB-135381433`; curl stored in `courses-headers.txt`.)_
- [ ] Verify course modules linked correctly _(Need HubSpot HubDB inspection beyond front-end JSON-LD.)_
- [ ] Confirm course metadata complete _(Requires table review; spot-check pending.)_

#### Pathways Sync
```bash
npm run sync:pathways
```

**Verification:**
- [x] Check HubDB table `HUBDB_PATHWAYS_TABLE_ID` (135381504) _(Pathways list headers show `DB-135381504`; see `pathways-headers.txt`.)_
- [ ] Verify pathway courses linked correctly _(Requires HubSpot table view; only live page spot-check performed.)_
- [ ] Confirm pathway ordering _(Need HubDB admin confirmation; current front-end order matches JSON-LD but not independently verified.)_

### 3. Publish HubSpot Pages

**Pages to Publish:**
- [x] Learn landing page (`/learn`) _(200 OK via curl; see `verification-output/issue-188/learn-landing-headers.txt`.)_
- [x] Modules list page (`/learn/modules`) _(200 OK; JSON-LD lists 15 modules; evidence in `modules-headers.txt`.)_
- [x] Courses list page (`/learn/courses`) _(200 OK; JSON-LD lists 6 courses; evidence in `courses-headers.txt`.)_
- [x] Pathways list page (`/learn/pathways`) _(200 OK with 7 pathways; evidence in `pathways-headers.txt`.)_
- [x] Module detail pages (15 live slugs) _(HTTP 200 for all slugs per `module-status-codes.txt`; full UX/content QA still recommended.)_
- [x] Course detail pages (6 live slugs) _(HTTP 200 per `course-status-codes.txt`; enrollment CTA behavior requires manual validation.)_
- [x] Pathway detail pages (7 live slugs) _(HTTP 200 per `pathway-status-codes.txt`; confirm course linkage via UI review.)_
- [x] My Learning dashboard (`/learn/my-learning`) _(200 OK for anonymous users; membership redirect flow not yet retested—needs credentialed pass.)_

**Publishing Steps:**
1. Navigate to CMS Hub → Website Pages
2. Filter by "learn" folder/domain
3. Review each page in preview mode
4. Publish pages one by one
5. Verify published URLs

---

## Verification Procedures

### Page Rendering Tests

#### List Pages
**Test Case:** Modules list page
**URL:** `https://hedgehog.cloud/learn/modules`
**Expected:**
- [x] All 15 modules displayed in grid/list _(JSON-LD enumerates 15 items; manual visual QA outstanding.)_
- [ ] Module cards show: title, description, duration _(Requires browser inspection for styling/content completeness.)_
- [ ] CTA buttons render correctly _(Pending UI validation.)_
- [ ] Filtering/sorting works (if implemented) _(No automated coverage; needs interactive QA.)_

**Test Case:** Courses list page
**URL:** `https://hedgehog.cloud/learn/courses`
**Expected:**
- [x] 6 courses displayed _(Confirmed via JSON-LD; screenshot QA pending.)_
- [ ] Course cards show module count _(Needs browser verification.)_
- [ ] Progress indicators (if user logged in) _(Requires authenticated test account.)_

**Test Case:** Pathways list page
**URL:** `https://hedgehog.cloud/learn/pathways`
**Expected:**
- [x] 7 pathways displayed _(JSON-LD enumerates 7; UI review pending.)_
- [ ] Pathway card shows course count _(Requires UI validation.)_
- [ ] Visual hierarchy clear _(Needs human review.)_

#### Detail Pages
**Test Case:** Module detail page
**URL:** `https://hedgehog.cloud/learn/modules/intro-to-hedgehog`
**Expected:**
- [x] Module content renders with proper formatting _(HTML loads without errors; see `module-fabric-operations-welcome-headers.txt`.)_
- [ ] Quiz section displays (if included) _(Needs browser validation.)_
- [ ] Navigation (prev/next module) works _(Requires manual interaction.)_
- [ ] Progress tracking visible (logged in users) _(Requires authenticated session.)_

**Test Case:** Course detail page
**URL:** `https://hedgehog.cloud/learn/courses/hedgehog-fundamentals`
**Expected:**
- [x] Course overview renders _(HTTP 200 for `network-like-hyperscaler-foundations`; see headers snapshot.)_
- [ ] Module list displays correctly _(Requires UI review.)_
- [ ] Enrollment CTA present _(Needs browser validation.)_
- [ ] Progress summary (logged in users) _(Requires authenticated test account.)_

---

## Beacon Tracking Verification

### Anonymous User Tests

**Test Scenario:** Track module start (logged out)
**Steps:**
1. Open browser in incognito mode
2. Navigate to any module detail page
3. Open DevTools → Network tab
4. Filter for XHR/Fetch requests
5. Observe POST to `TRACK_EVENTS_URL`

**Expected Beacon:**
```json
POST https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track
{
  "eventName": "learning_module_started",
  "payload": {
    "module_slug": "intro-to-hedgehog"
  }
}
```

**Expected Response:**
```json
{
  "status": "logged",
  "mode": "anonymous"
}
```

**Verification:**
- [ ] Beacon fires on page load _(Needs browser network capture; manual API call performed only.)_
- [x] Response returns 200 OK _(Curl evidence: `events-track-anon-headers.txt`.)_
- [x] `mode: "anonymous"` confirmed _(Curl response stored in `events-track-anon-response.json`.)_

### Authenticated User Tests

**Test Scenario:** Track module completion (logged in)
**Steps:**
1. Log in to hedgehog.cloud
2. Navigate to module detail page
3. Complete module interaction
4. Check Network tab for beacon

**Expected Response:**
```json
{
  "status": "persisted",
  "mode": "authenticated",
  "contactId": "<hubspot_contact_id>"
}
```

**Verification:**
- [x] Beacon includes user identifier _(API call with contact ID returned persisted status; evidence in `verification-output/issue-188/events-track-auth-response.json`.)_
- [x] Response shows `mode: "authenticated"` _(Same artifact as above.)_
- [x] `status: "persisted"` confirmed _(Same artifact as above, plus HubSpot contact diff in `hubspot-contact-progress-after.json`.)_

---

## Enable Auth Progress

**Purpose:** Enable authenticated progress tracking so Contact Properties update for logged-in users.

**Workflow:** Deploy AWS (manual) via GitHub Actions

**Steps:**
1. Navigate to **Actions** → **Deploy AWS (manual)**
2. Click **Run workflow**
3. Set inputs:
   - `stage`: `dev` (or target stage)
   - `region`: `us-west-2`
   - `enable_crm_progress`: ✓ **checked** (true)
4. Click **Run workflow** and monitor deployment

**Post-Deployment Verification:**
- [x] Deployment completes successfully _(Manual workflow_dispatch run 18618585385 completed successfully on 2025-10-18T17:13Z; see `verification-output/issue-188/github-deploy-dispatch-success-2025-10-18T171311Z.log` and `issue-197-resolution-summary.md`.)_
- [x] POST `/events/track` returns `mode: "authenticated"` (when user logged in) _(See `verification-output/issue-188/events-track-auth-response.json`.)_
- [x] Contact Properties update in HubSpot CRM within 2-3 minutes _(HubSpot contact snapshot `verification-output/issue-188/hubspot-contact-progress-after.json` updated with new module slug at 2025-10-17T17:49Z.)_
- [x] No CloudWatch alarms triggered _(All relevant alarms report `OK` in `verification-output/issue-188/aws-cloudwatch-alarms.json`.)_

**Rollback:**
If issues arise, redeploy with `enable_crm_progress` **unchecked** (false).

---

## Contact Properties Verification

### Spot-Check Process

**Contact to Check:** Test user with known email
**Steps:**
1. Log in as test user
2. Complete 1-2 module interactions
3. Navigate to HubSpot CRM → Contacts
4. Search for test user email
5. Open contact record
6. Check custom properties

**Properties to Verify:**
- [x] `learn_modules_started` (array/number) _(Verified via HubSpot contact snapshot `verification-output/issue-188/hubspot-contact-progress-after.json`.)_
- [x] `learn_modules_completed` (array/number) _(Same artifact.)_
- [x] `learn_last_activity_date` (date) _(Property `hhl_progress_updated_at` updated to 2025-10-17.)_
- [ ] `learn_total_time_spent` (number, if tracked) _(Property not currently populated; confirm whether metric is expected for MVP.)_

**Validation:**
- [x] Properties update within 2-3 minutes of beacon _(Webhook response and HubSpot snapshot show update at 2025-10-17T17:49Z.)_
- [x] Values match expected interactions _(Progress JSON includes newly ingested module slug.)_
- [x] No duplicates or data corruption _(Progress state shows unique module entries.)_

---

## Rollback Procedures

### If Critical Issues Found

#### Immediate Actions
1. **Disable tracking**: Set `TRACK_EVENTS_ENABLED: false` in constants.json
2. **Unpublish problematic pages**: In CMS, set status to "draft"
3. **Notify stakeholders**: Post incident report

#### Investigation Steps
1. Check CloudWatch alarms for errors
2. Review Lambda logs: `/aws/lambda/hedgehog-learn-dev-api`
3. Verify API Gateway metrics
4. Check HubDB data integrity

#### Recovery Options
- **Minor issues**: Fix and redeploy
- **Major issues**: Revert to previous CloudFormation stack
- **Data issues**: Restore HubDB from backup (if available)

---

## Post-Launch Monitoring

### First 24 Hours
_(Owner: Ops—monitoring rota not yet assigned as of 2025-10-17.)_
- [ ] Monitor CloudWatch alarms every 2 hours
- [ ] Check beacon success rate (target: >95%)
- [ ] Review Lambda error logs
- [ ] Verify Contact Property updates
- [ ] Collect user feedback

### First Week
_(Owner: Ops/Product—create schedule post-launch.)_
- [ ] Daily alarm review
- [ ] Weekly content update sync
- [ ] User engagement metrics review
- [ ] Performance optimization analysis

---

## Success Criteria

### Technical
- [ ] All API endpoints responding with <500ms latency _(Sample curl on 2025-10-17: `/events/track` ≈0.66s; need CloudWatch metrics to confirm SLA.)_
- [ ] Zero Lambda errors for 24 hours _(Pending CloudWatch review.)_
- [ ] Beacon tracking >95% success rate _(Requires analytics export.)_
- [x] Contact Properties updating reliably _(Authenticated event write + HubSpot snapshot in `verification-output/issue-188/hubspot-contact-progress-after.json`.)_

### Content
- [x] All 15 modules accessible _(HTTP 200 for all slugs; see `module-status-codes.txt`.)_
- [x] All 6 courses functional _(HTTP 200 for live slugs; see `course-status-codes.txt`.)_
- [x] 7 pathways navigable _(HTTP 200 for live slugs; see `pathway-status-codes.txt`.)_
- [ ] Zero broken links/images _(Requires manual crawl/Screaming Frog run.)_

### User Experience
- [ ] Pages load <3 seconds _(Need WebPageTest/Lighthouse run.)_
- [ ] Mobile responsive rendering _(Pending responsive QA.)_
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari) _(Regression suite not executed.)_
- [ ] Accessibility standards met (WCAG AA) _(Needs axe or manual audit.)_

---

## Contacts & Escalation

**Technical Issues:**
- Primary: Dev team
- Escalation: Engineering lead

**Content Issues:**
- Primary: Content team
- Escalation: Product manager

**Monitoring:**
- CloudWatch Dashboard: [Link to AWS Console]
- API Gateway: https://hvoog2lnha.execute-api.us-west-2.amazonaws.com

---

## Notes

- This is an MVP launch; expect iterative improvements
- User feedback will drive prioritization of enhancements
- Content pipeline can scale to 50+ modules in future phases
- Beacon tracking designed for extensibility (quizzes, assessments, etc.)

---

**Last Updated:** October 17, 2025
**Next Review:** Post-MVP (1 week after launch)
