# Learn Platform MVP Launch Runbook

**Date:** October 13, 2025
**Version:** 1.0
**Stage:** MVP Go-Live

## Overview

This runbook outlines the steps to launch the Hedgehog Learn platform MVP, including content pipeline operations, verification procedures, and beacon tracking validation.

---

## Pre-Launch Checklist

### Infrastructure
- [x] CloudWatch alarms deployed (lambda-errors, httpapi-5xx, httpapi-latency, lambda-throttles, composite)
- [x] API Gateway endpoints verified (`/events/track`, `/quiz/grade`, `/progress/read`)
- [x] CloudWatch log retention set to 30 days
- [x] constants.json published to HubSpot with correct `TRACK_EVENTS_URL`

### Configuration
- [x] `ENABLE_CRM_PROGRESS` feature flag configured
- [x] `PROGRESS_BACKEND` set to appropriate mode (properties/hubdb)
- [x] CORS configured for hedgehog.cloud domain

---

## MVP Content Scope

### Modules (10)
Target initial modules for MVP content sync to HubDB:
1. Introduction to Hedgehog
2. Getting Started with Hedgehog Cloud
3. Core Concepts
4. User Management
5. Data Models
6. API Fundamentals
7. Authentication & Security
8. Deployment Basics
9. Monitoring & Observability
10. Best Practices

### Courses (2)
1. **Hedgehog Fundamentals** (modules 1-5)
2. **Advanced Hedgehog** (modules 6-10)

### Pathways (1)
1. **Hedgehog Learning Path** (both courses)

---

## Content Pipeline Steps

### 1. Editorial Review
**Owner:** Content Team
**Checklist:**
- [ ] All 10 modules reviewed for accuracy
- [ ] Quiz questions validated
- [ ] Learning objectives defined
- [ ] Prerequisites documented
- [ ] Estimated completion times set
- [ ] Images/diagrams optimized
- [ ] Links verified

### 2. Content Sync to HubDB

#### Modules Sync
```bash
# Sync individual module (example)
npm run sync:module -- intro-to-hedgehog

# Or sync all modules
npm run sync:modules
```

**Verification:**
- [ ] Check HubDB table `HUBDB_MODULES_TABLE_ID` (135621904)
- [ ] Verify all fields populated correctly
- [ ] Confirm `hs_id` and `hs_path` set
- [ ] Check module status is "published"

#### Courses Sync
```bash
npm run sync:courses
```

**Verification:**
- [ ] Check HubDB table `HUBDB_COURSES_TABLE_ID` (135381433)
- [ ] Verify course modules linked correctly
- [ ] Confirm course metadata complete

#### Pathways Sync
```bash
npm run sync:pathways
```

**Verification:**
- [ ] Check HubDB table `HUBDB_PATHWAYS_TABLE_ID` (135381504)
- [ ] Verify pathway courses linked correctly
- [ ] Confirm pathway ordering

### 3. Publish HubSpot Pages

**Pages to Publish:**
- [ ] Learn landing page (`/learn`)
- [ ] Modules list page (`/learn/modules`)
- [ ] Courses list page (`/learn/courses`)
- [ ] Pathways list page (`/learn/pathways`)
- [ ] Module detail pages (10 pages)
- [ ] Course detail pages (2 pages)
- [ ] Pathway detail page (1 page)
- [ ] My Learning dashboard (`/learn/my-learning`)

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
- [ ] All 10 modules displayed in grid/list
- [ ] Module cards show: title, description, duration
- [ ] CTA buttons render correctly
- [ ] Filtering/sorting works (if implemented)

**Test Case:** Courses list page
**URL:** `https://hedgehog.cloud/learn/courses`
**Expected:**
- [ ] 2 courses displayed
- [ ] Course cards show module count
- [ ] Progress indicators (if user logged in)

**Test Case:** Pathways list page
**URL:** `https://hedgehog.cloud/learn/pathways`
**Expected:**
- [ ] 1 pathway displayed
- [ ] Pathway card shows course count
- [ ] Visual hierarchy clear

#### Detail Pages
**Test Case:** Module detail page
**URL:** `https://hedgehog.cloud/learn/modules/intro-to-hedgehog`
**Expected:**
- [ ] Module content renders with proper formatting
- [ ] Quiz section displays (if included)
- [ ] Navigation (prev/next module) works
- [ ] Progress tracking visible (logged in users)

**Test Case:** Course detail page
**URL:** `https://hedgehog.cloud/learn/courses/hedgehog-fundamentals`
**Expected:**
- [ ] Course overview renders
- [ ] Module list displays correctly
- [ ] Enrollment CTA present
- [ ] Progress summary (logged in users)

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
- [ ] Beacon fires on page load
- [ ] Response returns 200 OK
- [ ] `mode: "anonymous"` confirmed

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
- [ ] Beacon includes user identifier
- [ ] Response shows `mode: "authenticated"`
- [ ] `status: "persisted"` confirmed

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
- [ ] Deployment completes successfully
- [ ] POST `/events/track` returns `mode: "authenticated"` (when user logged in)
- [ ] Contact Properties update in HubSpot CRM within 2-3 minutes
- [ ] No CloudWatch alarms triggered

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
- [ ] `learn_modules_started` (array/number)
- [ ] `learn_modules_completed` (array/number)
- [ ] `learn_last_activity_date` (date)
- [ ] `learn_total_time_spent` (number, if tracked)

**Validation:**
- [ ] Properties update within 2-3 minutes of beacon
- [ ] Values match expected interactions
- [ ] No duplicates or data corruption

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
- [ ] Monitor CloudWatch alarms every 2 hours
- [ ] Check beacon success rate (target: >95%)
- [ ] Review Lambda error logs
- [ ] Verify Contact Property updates
- [ ] Collect user feedback

### First Week
- [ ] Daily alarm review
- [ ] Weekly content update sync
- [ ] User engagement metrics review
- [ ] Performance optimization analysis

---

## Success Criteria

### Technical
- [x] All API endpoints responding with <500ms latency
- [ ] Zero Lambda errors for 24 hours
- [ ] Beacon tracking >95% success rate
- [ ] Contact Properties updating reliably

### Content
- [ ] All 10 modules accessible
- [ ] All 2 courses functional
- [ ] 1 pathway navigable
- [ ] Zero broken links/images

### User Experience
- [ ] Pages load <3 seconds
- [ ] Mobile responsive rendering
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari)
- [ ] Accessibility standards met (WCAG AA)

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

**Last Updated:** October 13, 2025
**Next Review:** Post-MVP (1 week after launch)
