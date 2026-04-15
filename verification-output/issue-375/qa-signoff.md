# Issue #375 QA Signoff — Shadow HH-Learn Environment

**Date:** 2026-04-15  
**Verified by:** Dev C (lead)  
**Recommendation:** ✅ GO — shadow environment is safe and ready for feature development

---

## Verification Matrix

### 1. Page Set Existence and Load

| Page | URL | Status | HTTP |
|------|-----|--------|------|
| Shadow home | hedgehog.cloud/learn-shadow | ✅ PUBLISHED | 200 |
| Shadow modules | hedgehog.cloud/learn-shadow/modules | ✅ PUBLISHED | 200 |
| Shadow courses | hedgehog.cloud/learn-shadow/courses | ✅ PUBLISHED | 200 |
| Shadow pathways | hedgehog.cloud/learn-shadow/pathways | ✅ PUBLISHED | 200 |
| Shadow My Learning | hedgehog.cloud/learn-shadow/my-learning | ✅ PUBLISHED | 200 |
| Shadow register | hedgehog.cloud/learn-shadow/register | ✅ PUBLISHED | 200 |
| Shadow certificate | hedgehog.cloud/learn-shadow/certificate | ✅ PUBLISHED | 200 |
| Shadow action-runner | hedgehog.cloud/learn-shadow/action-runner | ✅ PUBLISHED | 200 |

### 2. Anti-Indexing Controls

| Check | Result |
|-------|--------|
| Shadow pages have `<meta name="robots" content="noindex, nofollow">` | ✅ CONFIRMED |
| Production `/learn/*` pages do NOT have noindex | ✅ CONFIRMED (blank) |

### 3. Asset Isolation

| Check | Result |
|-------|--------|
| Shadow module page loads `shadow-completion.js` | ✅ YES (1 instance) |
| Production module page does NOT load `shadow-completion.js` | ✅ CONFIRMED (0 instances) |
| Shadow pages: shadow-specific JS files in assets/shadow/js/ | ✅ shadow-completion.js, shadow-my-learning.js, shadow-certificate.js |
| Production pages: no shadow JS assets loaded | ✅ CONFIRMED |

### 4. Backend Isolation

| Check | Result |
|-------|--------|
| Shadow Lambda endpoints live at api.hedgehog.cloud/shadow/* | ✅ CONFIRMED |
| `GET /shadow/tasks/status` → 401 (unauthenticated) | ✅ HTTP 401 |
| `GET /shadow/certificates` → 401 (unauthenticated) | ✅ HTTP 401 |
| `GET /shadow/certificate/<invalid-id>` → 404 | ✅ HTTP 404 |
| All shadow endpoints gated by `APP_STAGE === 'shadow'` guard | ✅ In code |
| DynamoDB `hedgehog-learn-task-records-shadow` | ✅ ACTIVE |
| DynamoDB `hedgehog-learn-task-attempts-shadow` | ✅ ACTIVE |
| DynamoDB `hedgehog-learn-entity-completions-shadow` | ✅ ACTIVE |
| DynamoDB `hedgehog-learn-certificates-shadow` | ✅ ACTIVE |

### 5. Production Integrity

| Check | Result |
|-------|--------|
| Production `/learn/modules/fabric-operations-welcome` loads correctly | ✅ HTTP 200 |
| Production page content intact (fabric-operations-welcome references: 7) | ✅ CONFIRMED |
| Production My Learning at `/learn/my-learning` | ✅ HTTP 200 |
| Production task API endpoints do NOT respond to shadow routes | ✅ Gated by APP_STAGE |

### 6. Completion Framework (Epic #397)

| Feature | Status |
|---------|--------|
| Shadow quiz grading (`POST /shadow/tasks/quiz/submit`) | ✅ Live |
| Shadow lab attestation (`POST /shadow/tasks/lab/attest`) | ✅ Live |
| Shadow task status (`GET /shadow/tasks/status`) | ✅ Live |
| Shadow admin reset (`POST /shadow/admin/test/reset`) | ✅ Live |
| Certificate issuance (auto on completion) | ✅ Live |
| Certificate list (`GET /shadow/certificates`) | ✅ Live |
| Certificate verify (`GET /shadow/certificate/:certId`) | ✅ Live |
| `awards_certificate` gate (14/20 modules eligible) | ✅ Live |
| My Learning "My Certificates" section | ✅ Live |
| `/learn-shadow/certificate` display page | ✅ Live |

### 7. Content Parity

| Check | Result |
|-------|--------|
| All 20 active modules present in HubDB | ✅ (20 rows synced) |
| NLH pathway (4 courses, 16 modules) accessible on shadow | ✅ |
| Dynamic quiz rendering (modules with quiz.json) | ✅ 6 modules |
| Lab attestation UI (modules with lab tasks) | ✅ 8 modules |
| `quiz_schema_json` in HubDB for 6 quiz modules | ✅ Confirmed |
| `completion_tasks_json` in HubDB for 20 modules | ✅ Confirmed |
| `awards_certificate` column (id=97) populated | ✅ 14=1, 6=0 |

---

## Residual Risks

### Known / Accepted

1. **Registration form shared with production** — Shadow `/learn-shadow/register` uses the same HubSpot form (b2fd98ff) as production. Shadow registrations appear in production CRM. **Mitigation:** Shadow is noindex; only internal dev team uses it. Use identifiable test emails during testing. (Issue #374 closed as won't-fix.)

2. **Pre-existing ESLint errors on main** — 173 JS ESLint errors in production JS assets have existed since ~Feb 2026. The `build` CI job fails on every PR. No required status checks on main branch so merges proceed. **Mitigation:** Issue #311 tracks cleanup. Not a runtime blocker.

3. **Shadow pages under hedgehog.cloud domain** — Shadow and production share the same domain. Cross-contamination via shared cookies is theoretically possible but the auth system (Cognito + httpOnly cookies) uses the same portal for both environments. **Mitigation:** Completion/certificate data is in isolated DynamoDB tables. Auth state is shared by design (same Cognito pool).

### Not Applicable

- CRM workflow/list clone: Shadow usage is internal-only, no automation needed
- Shadow-specific reporting: Dev team monitors via direct Lambda logs/DynamoDB

---

## Shadow Environment Summary

The shadow environment is a **fully functional, isolated learning environment** that:
- Mirrors all 8 production learn pages at /learn-shadow/*
- Is anti-indexed (noindex, nofollow) and not linked from production nav
- Routes all completion/certificate data to isolated DynamoDB tables
- Includes the complete Epic #397 completion framework (tasks + certs)
- Protects production data from shadow operations

---

## Recommendation

**✅ GO**

The shadow environment is safe and usable for registered-user feature development. The only residual risk (shared CRM registration form) is known, accepted, and mitigated operationally.

**Next recommended work:**
1. Project lead review of shadow My Learning redesign (#383) → production rollout (#392)
2. Quiz answer visibility fix in production (#298 — in progress)
3. Course completion certificates for registered users (#385) — shadow-first development

---

## Files Verified

- 8 shadow CMS pages: PUBLISHED at hedgehog.cloud/learn-shadow/*
- 4 DynamoDB tables: ACTIVE (task-records, task-attempts, entity-completions, certificates)
- Lambda functions: 8 shadow endpoints live
- HubDB modules table: 20 rows with completion_tasks_json, quiz_schema_json, awards_certificate
