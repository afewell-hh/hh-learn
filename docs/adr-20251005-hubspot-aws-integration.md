# ADR: HubSpot CMS + AWS Lambda Integration Architecture

**Date:** 2025-10-05
**Status:** Proposed
**Decision Makers:** Project Lead, Customer

## Context

The original design called for:
- **Frontend:** HubSpot CMS pages (public `/learn/*` pages)
- **Backend:** AWS Lambda + API Gateway (quiz grading, progress tracking, certificates)
- **Data:** HubDB + HubSpot CRM custom objects

**Expected flow:**
```
User on HubSpot CMS page → JavaScript fetch → AWS Lambda → HubSpot APIs
```

## Problem Discovered

**HubSpot CMS pages CANNOT directly call external APIs from JavaScript due to CORS restrictions.**

Research findings:
1. HubSpot APIs don't support CORS/AJAX requests from browsers
2. Official HubSpot solution: **HubSpot Serverless Functions** (requires Content Hub Enterprise)
3. External APIs face same CORS blocking when called from HubSpot-hosted pages
4. See: https://developers.hubspot.com/docs/cms/data/serverless-functions

## Decision Options

### Option 1: HubSpot Forms + Workflows + Webhooks ⚠️ COMPROMISE
**Flow:**
```
User fills form → HubSpot Form → HubSpot Workflow → Webhook → AWS Lambda → HubSpot APIs
```

**Pros:**
- ✅ No CORS issues
- ✅ Uses existing HubSpot infrastructure
- ✅ No additional costs

**Cons:**
- ❌ Not real-time (workflow delays)
- ❌ Limited to form submissions
- ❌ Can't build interactive quiz UI
- ❌ Complex workflow logic required

**Verdict:** Not suitable for interactive learning platform

---

### Option 2: Hybrid Architecture (Recommended) ✅
**Flow:**
```
HubSpot CMS (marketing pages)
    +
Separate frontend (Vercel/Netlify) → AWS Lambda → HubSpot APIs
```

**Implementation:**
- HubSpot CMS: Landing pages, course catalog, marketing content (`/learn`, `/learn/pathway/*`)
- External frontend: Interactive labs, quizzes, progress dashboard (`/app/lab/*`, `/app/quiz/*`)
- AWS Lambda: Backend logic (grading, progress, certificates)
- HubSpot app token: Authenticate Lambda → HubSpot API calls

**Pros:**
- ✅ Real-time interactive features
- ✅ No CORS limitations
- ✅ Full control over UX
- ✅ Can use modern frameworks (React, Vue, etc.)
- ✅ Still leverage HubSpot for CRM/marketing

**Cons:**
- ⚠️ Two separate deployments
- ⚠️ Need to handle authentication/sessions for external frontend
- ⚠️ Split user experience (but can brand consistently)

---

### Option 3: Upgrade to Content Hub Enterprise 💰
**Flow:**
```
HubSpot CMS page → HubSpot Serverless Function → AWS Lambda → HubSpot APIs
```

**Pros:**
- ✅ Fully integrated
- ✅ No CORS issues
- ✅ Single deployment

**Cons:**
- ❌ Significant cost increase
- ❌ Still limited by HubSpot serverless constraints
- ❌ Vendor lock-in

---

### Option 4: Pure AWS (No HubSpot CMS) 🤔
**Flow:**
```
AWS S3 + CloudFront → AWS Lambda → HubSpot APIs (via app token)
```

**Pros:**
- ✅ Full control
- ✅ No CORS issues
- ✅ Cost effective

**Cons:**
- ❌ Loses HubSpot CMS benefits (templates, content management)
- ❌ Need to build everything from scratch
- ❌ Can't leverage Clean.Pro theme

## Recommendation

**Adopt Option 2: Hybrid Architecture**

### Phase 1 (MVP):
1. **HubSpot CMS** for:
   - Marketing pages (`/learn` portal, pathway overviews)
   - Static content (concepts, documentation)
   - SEO-optimized landing pages

2. **External Frontend** (Vercel/Next.js or similar) for:
   - Interactive labs (step-by-step validation)
   - Quiz interface (real-time grading)
   - User dashboard (progress tracking)
   - Certificate generation

3. **AWS Lambda** for:
   - Quiz grading logic
   - Progress tracking
   - Behavioral event emission to HubSpot
   - Certificate generation

4. **HubSpot (via app token)** for:
   - HubDB (course content storage)
   - CRM custom objects (enrollment, progress)
   - Behavioral events (analytics, workflows)

### Integration Points:
- HubSpot pages link to external app with deep linking
- Shared branding/styling between both
- HubSpot contact tracking via cookies/identity resolution
- Lambda uses HubSpot app token for API calls

### Future Enhancement:
- If upgrade to Content Hub Enterprise, migrate external frontend logic to HubSpot serverless
- Keep Lambda for heavy compute (PDF generation, etc.)

## Consequences

### What we gain:
- Real-time, interactive learning experiences
- Full control over quiz/lab UX
- No vendor limitations on frontend tech
- Can still use HubSpot for CRM, marketing, content

### What we lose:
- Single unified deployment
- Slightly more complex architecture
- Need to manage two frontend deployments

### Migration path:
- Easy to migrate external frontend → HubSpot serverless later if budget allows
- Lambda backend can remain external regardless

## Action Items

1. ✅ HubSpot app created (provides token for Lambda → HubSpot API)
2. ⬜ Update repository structure for hybrid architecture
3. ⬜ Choose external frontend framework (Next.js recommended)
4. ⬜ Design authentication/session strategy
5. ⬜ Update Sprint 1 plan to reflect hybrid approach
6. ⬜ Create deployment workflows for both frontends

## References
- [HubSpot CORS Limitations](https://legacydocs.hubspot.com/docs/faq/do-hubspot-apis-support-ajax-request)
- [HubSpot Serverless Functions](https://developers.hubspot.com/docs/cms/data/serverless-functions)
- [HubSpot + AWS Lambda Integration](https://www.tecracer.com/blog/2024/12/integrating-hubspot-with-aws-lambda.html)
