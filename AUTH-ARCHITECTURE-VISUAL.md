# HH-Learn Authentication Architecture - Visual Reference

> **Deprecated 2025-10-28:** Superseded by the native membership baseline (Issues #270/#272/#274). Retain for historical context only; see docs/auth-and-progress.md for the current architecture.


## System Overview

```
                    ┌─────────────────────────────────────────────┐
                    │     HH-Learn Application                    │
                    │  (Public & Private Pages)                   │
                    └─────────────────────────────────────────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
        ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
        │  Public Pages   │  │ Private Pages   │  │  Action Runner   │
        │  (CMS pages)    │  │ (HubSpot auth   │  │  (/learn/...)    │
        │                 │  │  available)     │  │                  │
        └─────────────────┘  └─────────────────┘  └──────────────────┘
                 │                     │                     │
                 │         ┌───────────┴───────────┐         │
                 │         │                       │         │
          ┌──────▼──────┐  │  ┌───────────┐       │         │
          │JWT Login    │  │  │Membership │       │         │
          │(email only) │  │  │(email+pwd)│       │         │
          └──────┬──────┘  │  └─────┬─────┘       │         │
                 │         │        │             │         │
                 │         └────────┼─────────────┘         │
                 │                  │                       │
                 ├─ POST /auth/login ─► Lambda /auth/login  │
                 │   ├─ Validates email in HubSpot CRM      │
                 │   └─ Returns JWT token                   │
                 │                  │                       │
                 │         ┌─ REDIRECT TO ─────────────────┤
                 │         │ /learn/auth-handshake          │
                 │         │  + redirect_url param          │
                 │         │                                │
                 │         ├─ auth-handshake.html           │
                 │         │ (Private page)                 │
                 │         ├─ Reads request_contact         │
                 │         │ (Session verified)             │
                 │         ├─ Stores in sessionStorage      │
                 │         └─ Redirects back                │
                 │                  │                       │
                 └──────────┬───────┴───────────────────────┘
                            │
                    ┌───────▼──────────┐
                    │  Page Loads      │
                    │  auth-context.js │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │   PRIORITY       │ RESOLUTION       │
          ├──────────────────┼──────────────────┤
          │ 0: JWT Token     │ localStorage     │
          │    24h expiry    │ hhl_auth_token   │
          ├──────────────────┼──────────────────┤
          │ 1: Handshake     │ sessionStorage   │
          │    6h TTL        │ hhl_identity     │
          ├──────────────────┼──────────────────┤
          │ 2: Server Data   │ data attributes  │
          │    Page load     │ hhl-auth-context │
          ├──────────────────┼──────────────────┤
          │ 3: Membership API│ Network fetch    │
          │    Session       │ /_hcms/api/...   │
          └──────────────────┴──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ window.hhIdentity│
                    │ Ready + Identity │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐      ┌──────▼──────┐      ┌─────▼───────┐
   │enrollment│      │ pathways.js │      │ courses.js  │
   │ buttons  │      │ progress    │      │ progress    │
   └────┬─────┘      └──────┬──────┘      └─────┬───────┘
        │                   │                    │
        ├─ buildAuthHeaders() ─► Add JWT Bearer Token
        │                   │      (if available)
        │                   │
        └─── buildRunnerUrl() ───► Redirect to action-runner
                           │      with params
                           │
               ┌───────────▼──────────┐
               │  CRM Sync Pattern    │
               │ (DUPLICATED 4x)      │
               │                      │
               │ 1. Check auth        │
               │ 2. Build URL         │
               │ 3. Fetch data        │
               │ 4. Parse response    │
               └──────────────────────┘
```

---

## Data Storage Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER CLIENT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ localStorage (PERSISTENT - survives browser close)       │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ hhl_auth_token                  (JWT token string)       │  │
│  │ hhl_auth_token_expires          (24h from login)        │  │
│  │ hhl_identity_from_jwt           ({email, contactId...}) │  │
│  │ hh-enrollment-{type}-{slug}     (enrollment state)      │  │
│  │ hh-{type}-progress-{slug}       (progress state)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ sessionStorage (TAB-SCOPED - cleared on tab close)       │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ hhl_identity                    ({email, contactId...}) │  │
│  │ hhl_last_action                 (action-runner result)  │  │
│  │ hhl-module-state-{slug}         (progress flags)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cookies (CROSS-SITE - HubSpot managed)                   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ __hstc                          (HubSpot tracking)       │  │
│  │ hubspotutk                      (HubSpot user token)     │  │
│  │ (request_contact.* implied)     (server-side session)    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Data Attributes (SINGLE PAGE - resets on navigation)     │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ <div id="hhl-auth-context"                              │  │
│  │       data-email="{...}"                                │  │
│  │       data-contact-id="{...}"                           │  │
│  │       data-enable-crm="true"                            │  │
│  │       data-constants-url="{...}"                        │  │
│  │       data-login-url="{...}"                            │  │
│  │ />                                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                    ┌───────▼──────────┐
                    │    BACKEND       │
                    ├──────────────────┤
                    │ JWT_SECRET       │
                    │ HUBSPOT_TOKEN    │
                    │ CRM Database     │
                    └──────────────────┘
```

---

## Authentication Flows - Detailed Timeline

### FLOW A: JWT Authentication (Public Page)

```
Time    Client                          Network                 Server
────────────────────────────────────────────────────────────────────────────
T0      User on /learn/courses/slug
        Click "Sign in to enroll"
        │
T1      ├─ enrollment.js
        │  handleJWTLogin()
        │  prompt("Email address?")
        │
T2      User types: user@example.com
        │
T3      ├─ POST /auth/login
        │  { "email": "user@example.com" }
        │                                 ──────────────────────────►
        │                                 Lambda /auth/login
        │                                 ├─ Parse email
        │                                 ├─ Search CRM
        │                                 ├─ Contact found? YES
        │                                 ├─ signToken()
        │                                 │  ├─ Payload:
        │                                 │  │  {contactId, email}
        │                                 │  ├─ Sign with JWT_SECRET
        │                                 │  ├─ Expiry: 24h
        │                                 │  └─ Return token
        │                                 ◄──────────────────────────
T4      ◄─ 200 OK
        │  { token, contactId, email,
        │    firstname, lastname }
        │
T5      ├─ localStorage.setItem(
        │    'hhl_auth_token',
        │    token)
        │  localStorage.setItem(
        │    'hhl_auth_token_expires',
        │    Date.now() + 24h)
        │  localStorage.setItem(
        │    'hhl_identity_from_jwt',
        │    {email, contactId...})
        │
T6      ├─ auth-context.js
        │  checkStoredToken()
        │  ├─ Found in localStorage
        │  ├─ Expiry valid (24h)
        │  ├─ Parse hhl_identity_from_jwt
        │  └─ Resolve window.hhIdentity.ready
        │
T7      ├─ enrollment.js
        │  window.hhIdentity.ready
        │  ├─ Identity resolved
        │  ├─ Re-init enrollment UI
        │  ├─ Check enrollment from CRM
        │  │
T8      │  ├─ GET /enrollments/list?email=user@...
        │  │  headers: {Authorization: Bearer token}
        │  │                                ──────────────────────────►
        │  │                                Lambda /enrollments/list
        │  │                                ├─ Extract JWT
        │  │                                ├─ Verify signature
        │  │                                ├─ Get contactId
        │  │                                ├─ Query CRM
        │  │                                ├─ Return enrollments
        │  │                                ◄──────────────────────────
T9      │  ◄─ 200 OK {enrollments: [...]}
        │  ├─ Check if slug in list
        │  └─ Show "Enroll" or "Already Enrolled"
        │
T10     ├─ User sees updated UI
        │  ├─ "Enroll in Course" button visible
        │  └─ Page shows authenticated state
```

---

### FLOW B: Membership Authentication (Private Page)

```
Time    Client                          Network                 Server
────────────────────────────────────────────────────────────────────────────
T0      User on /learn/courses
        (private HubSpot page)
        Click "Sign In" (left-nav)
        │
T1      ├─ left-nav.html link
        │  href="/_hcms/mem/login?redirect_url=..."
        │                                 ──────────────────────────►
        │                                 HubSpot Login Page
        │                                 ├─ Email + Password form
        │                                 ├─ Wait for credentials
        │                                 └─ (in HubSpot portal)
        │
T2      User enters email + password
        │
        │  ◄──────────────────────────────
T3      ├─ Redirect to
        │  /learn/auth-handshake
        │  ?redirect_url=/learn/...
        │
T4      ├─ auth-handshake.html loads
        │  (Private page - can read
        │   request_contact.is_logged_in)
        │
        │  Detect: is_logged_in = true
        │  ├─ Read request_contact.email
        │  ├─ Read request_contact.hs_object_id
        │  ├─ Create identity object
        │  └─ sessionStorage.setItem(
        │      'hhl_identity',
        │      {email, contactId, timestamp})
        │
T5      ├─ setTimeout 500ms
        │
T6      ├─ window.location.href =
        │  /learn/... (original page)
        │
T7      ├─ Original page reloads
        │  auth-context.js runs
        │
T8      ├─ checkStoredToken()
        │  ├─ No JWT in localStorage
        │  └─ Continue to Priority 1
        │
        ├─ Check sessionStorage
        │  ├─ Found 'hhl_identity'
        │  ├─ Timestamp valid (6h TTL)
        │  ├─ Parse identity
        │  └─ Resolve window.hhIdentity.ready
        │
T9      ├─ Components initialize with
        │  authenticated identity
        │
T10     ├─ User sees updated UI
        │  ├─ Progress data loaded from CRM
        │  ├─ Enrollment buttons active
        │  └─ "Sign Out" visible in nav
```

---

## Component Dependency Graph

```
                    ┌─────────────────┐
                    │  auth-context.js│
                    │  (598 lines)     │
                    │ ORCHESTRATOR     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
       ┌────▼────┐   ┌──────▼──────┐   ┌────▼─────┐
       │Depends  │   │  Depends    │   │ Depends  │
       │on:      │   │  on:        │   │ on:      │
       ├─────────┤   ├─────────────┤   ├──────────┤
       │jwt lib  │   │HubSpot API  │   │ Server   │
       │node     │   │Member API   │   │ variables│
       └─────────┘   └─────────────┘   └──────────┘
            │
            └────────────────┬─────────────────┐
                             │                 │
        ┌────────────────────▼─────┐  ┌────────▼─────────┐
        │   Uses window.hhIdentity  │  │ Uses window.     │
        │   Public API:             │  │ hhServerIdentity │
        ├───────────────────────────┤  ├──────────────────┤
        │ - .ready (Promise)        │  │ (Direct read)    │
        │ - .get()                  │  │                  │
        │ - .login(email)           │  │                  │
        │ - .logout()               │  │                  │
        │ - .isAuthenticated()      │  │                  │
        │ - .isReady()              │  │                  │
        └───────────────┬───────────┘  └──────────────────┘
                        │
        ┌───────────────┼───────────────────────────────┐
        │               │                               │
   ┌────▼────────┐ ┌───▼──────┐ ┌──────────┐ ┌────────▼───┐
   │enrollment.js│ │pathways. │ │courses.js│ │progress.js │
   │             │ │js        │ │          │ │            │
   ├─────────────┤ ├──────────┤ ├──────────┤ ├────────────┤
   │- getAuth()  │ │getAuth() │ │getAuth() │ │getAuthCtx()│
   │- buildAuth  │ │buildAuth │ │buildAuth │ │buildAuth   │
   │  Headers()  │ │Headers() │ │Headers() │ │Headers()   │
   │- CRM sync   │ │CRM sync  │ │CRM sync  │ │CRM sync    │
   │- JWT login  │ │pattern   │ │pattern   │ │pattern     │
   │- Render UI  │ │(4x copy) │ │(4x copy) │ │(4x copy)   │
   └─────────────┘ └──────────┘ └──────────┘ └────────────┘
        │                │             │            │
        └────────────────┼─────────────┴────────────┘
                         │
         ┌───────────────▼─────────────┐
         │    Shared API Calls:        │
         ├─────────────────────────────┤
         │ buildAuthHeaders()          │
         │ buildRunnerUrl()            │
         │ getConstants()              │
         │ fetchJSON()                 │
         │ CRM sync patterns (4x)      │
         └─────────────────────────────┘
                    │
        ┌───────────┼──────────┐
        │           │          │
   ┌────▼──┐  ┌─────▼───┐  ┌──▼────────┐
   │Lambda │  │HubSpot  │  │ Browser   │
   │API    │  │ CMS API │  │ Storage   │
   ├───────┤  ├─────────┤  ├───────────┤
   │/auth/ │  │Membership  │localStorage│
   │login  │  │API      │  │sessionStor│
   │       │  │         │  │Cookies    │
   │/events│  │Contacts │  │Data attrs │
   │/track │  │Search   │  │           │
   │       │  │         │  │           │
   │/progress│             │           │
   │/aggregate             │           │
   │       │               │           │
   │/enrollments           │           │
   │/list  │               │           │
   └───────┘  └─────────────┘ └──────────┘
```

---

## Code Quality Issues - Visual Map

```
HIGH PRIORITY (Issue #270 Direct Cause)
═══════════════════════════════════════════════════════════════════════

1. DOUBLE REDIRECT ENCODING ISSUE
   ┌─────────────────────────────────────────────────────────┐
   │ enrollment.js:73                                        │
   │ var handshakeUrl = encodeURIComponent(pathname)        │
   │                    ↓                                    │
   │ /learn/auth-handshake?redirect_url=/learn/courses/...  │
   │                    ↓                                    │
   │ action-runner.js:37-41                                 │
   │ var target = handshakeUrl + encodeURIComponent(...)    │
   │                    ↓                                    │
   │ /learn/%2Flearn/...  ← 404 ERROR!                      │
   └─────────────────────────────────────────────────────────┘


MEDIUM PRIORITY (Incomplete JWT Integration)
═══════════════════════════════════════════════════════════════════════

2. action-runner.js MISSING JWT SUPPORT
   ┌─────────────────────────────────────────────────────────┐
   │ User logs in via JWT (localStorage token set)           │
   │            ↓                                            │
   │ Clicks "Enroll" button                                  │
   │            ↓                                            │
   │ action-runner.html checks: data-email, data-contact-id │
   │            ↓                                            │
   │ Empty! (not on data attributes, only in localStorage)  │
   │            ↓                                            │
   │ Triggers login prompt AGAIN ← USER FRUSTRATION!        │
   │            ↓                                            │
   │ Should check: Authorization: Bearer header             │
   └─────────────────────────────────────────────────────────┘


3. left-nav.html MISSING JWT STATE
   ┌─────────────────────────────────────────────────────────┐
   │ User logs in via JWT on public page                    │
   │ (localStorage token set, window.hhIdentity resolves)   │
   │            ↓                                            │
   │ Checks: request_contact.is_logged_in (server-side)     │
   │            ↓                                            │
   │ Always FALSE on public pages (can't read request_contact)
   │            ↓                                            │
   │ Shows "Sign In" button ← INCONSISTENT!                 │
   │            ↓                                            │
   │ Should also check: window.hhIdentity.isAuthenticated()  │
   └─────────────────────────────────────────────────────────┘


LOW PRIORITY (Code Complexity)
═══════════════════════════════════════════════════════════════════════

4. IDENTITY RESOLUTION 4-LEVEL PRIORITY
   ┌──────────────────────────────────────────────────────────┐
   │ auth-context.js:336-469 (134 lines)                     │
   │                                                          │
   │  if (JWT in localStorage) {                             │
   │      if (token valid & not expired) {                   │
   │          Resolve with JWT identity                      │
   │      }                                                  │
   │  } else if (sessionStorage has identity) {              │
   │      if (not older than 6h) {                           │
   │          Resolve with handshake identity                │
   │      }                                                  │
   │  } else if (server data attributes exist) {             │
   │      if (window.hhServerIdentity) {                     │
   │          Resolve with server identity                   │
   │      }                                                  │
   │  } else {                                               │
   │      fetch /_hcms/api/membership/v1/profile             │
   │      if (response.ok) {                                 │
   │          Resolve with API identity                      │
   │      }                                                  │
   │  }                                                      │
   │                                                          │
   │ Problem: Different rules for each path                  │
   │          Each expires differently                       │
   │          Each validates differently                     │
   │          Bugs hidden until one path fails               │
   └──────────────────────────────────────────────────────────┘


5. CRM SYNC LOGIC DUPLICATED 4 TIMES
   ┌──────────────────────────────────────────────────────────┐
   │ Pattern repeated in:                                    │
   │                                                          │
   │ enrollment.js:247-278          (32 lines)               │
   │   function fetchEnrollmentFromCRM()                     │
   │                                                          │
   │ pathways.js:75-110             (35 lines)               │
   │   function fetchCRMProgress()                           │
   │                                                          │
   │ courses.js:77-112              (35 lines)               │
   │   function fetchCRMProgress()                           │
   │                                                          │
   │ progress.js:199-276            (77 lines)               │
   │   (mixed into track function)                           │
   │                                                          │
   │ Each implements:                                        │
   │   1. Check if auth exists                               │
   │   2. Build URL with params                              │
   │   3. fetch() with buildAuthHeaders()                    │
   │   4. Parse response                                     │
   │   5. Handle errors                                      │
   │                                                          │
   │ Problem: 4x harder to fix bugs                          │
   │          Inconsistent error handling                    │
   │          Makes refactoring risky                        │
   └──────────────────────────────────────────────────────────┘


6. DEFENSIVE CHECKS REPEATED
   ┌──────────────────────────────────────────────────────────┐
   │ enrollment.js:17                                        │
   │ var identity = window.hhIdentity ? hhIdentity.get() ... │
   │                                                          │
   │ pathways.js:48                                          │
   │ var identity = (window.hhIdentity &&                   │
   │   typeof window.hhIdentity.get === 'function') ? ...    │
   │                                                          │
   │ courses.js:49 (same as pathways)                        │
   │                                                          │
   │ progress.js:66 (different pattern)                      │
   │ var identity = window.hhIdentity ?                     │
   │   window.hhIdentity.get() : null                        │
   │                                                          │
   │ Problem: Inconsistent defensive coding                  │
   │          No central auth service                        │
   │          Hard to refactor consistently                  │
   └──────────────────────────────────────────────────────────┘
```

---

## Effort Estimation Matrix

```
Task                             Complexity  Files  Effort   Impact
──────────────────────────────────────────────────────────────────────

QUICK WINS (Phase 1)
─────────────────────────────────────────────────────────────────────
1. Add JWT to action-runner       LOW        1      30m      HIGH
2. Add JWT to left-nav            LOW        1      30m      HIGH
3. Fix URL encoding               LOW        2      1h       HIGH
                          SUBTOTAL: 2 hours ──────────► Issue #270 RESOLVED

CONSOLIDATION (Phase 2)
─────────────────────────────────────────────────────────────────────
4. Extract CRM sync module        MEDIUM     4      2-3h     MEDIUM
5. Unify auth state API           MEDIUM     5      1-2h     MEDIUM
                          SUBTOTAL: 4 hours ────────► 4 files cleaner

MIGRATION (Phase 3)
─────────────────────────────────────────────────────────────────────
6. JWT-primary rollout            HIGH       10     2-3w     HIGH
   - Deprecate Membership flow    
   - Remove handshake             
   - Remove API fallback          
                          SUBTOTAL: 2-3 sprints ──────► Single auth method

TOTAL EFFORT: 6-7 hours (phases 1-2) + 2-3 sprints (phase 3)
```

---

## Recommended Reading Order

1. **Start here**: `AUTH-ANALYSIS-SUMMARY.txt` (19 KB, overview)
2. **Deep dive**: `AUTH-ANALYSIS-DETAILED.md` (17 KB, technical details)
3. **Visual reference**: This file (architecture diagrams)
4. **Implementation**: Review files in this order:
   - `auth-context.js` (identity resolution)
   - `enrollment.js` (JWT login + CRM sync)
   - `action-runner.js` (action execution - missing JWT)
   - `left-nav.html` (UI state - missing JWT awareness)
