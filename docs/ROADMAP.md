# Hedgehog Learn - Phased Roadmap

**Strategy:** Content-first approach - Get learning content online quickly, add interactive LMS features incrementally

---

## Phase 1: Public Content Launch 🚀 (PRIORITY)
**Goal:** Get ungated learning content online ASAP to relieve launch pressure
**Timeline:** Sprint 1-2 (2-4 weeks)

### Sprint 1: Landing Page & Module Templates
**Deliverables:**
- ✅ `/learn` - Learning portal landing page
  - Hero section with value prop
  - Featured pathways grid
  - Search/filter placeholder (static)
  - CTA to browse modules
- ✅ `/learn/module/{slug}` - Module content template
  - Tabbed layout: Lab | Concepts | Resources
  - Lab steps (static markdown display)
  - Concept content (static markdown)
  - Resource links
  - Metadata sidebar (time, difficulty, version)
- ✅ Clean.Pro theme integration
- ✅ Mobile responsive
- ✅ Basic SEO optimization

**Tech Stack:**
- HubSpot CMS pages (public, ungated)
- Clean.Pro templates
- Static content (markdown → HTML)
- No authentication required

**Success Criteria:**
- Landing page is live and shareable
- At least 3 modules viewable
- Professional UI matching hedgehog.cloud branding

---

### Sprint 2: HubDB Content Management
**Deliverables:**
- ✅ Create HubDB tables (labs, modules, pathways)
- ✅ Populate with initial content (5-10 modules)
- ✅ Build sync script (Git → HubDB)
- ✅ Dynamic module listing on `/learn`
- ✅ Pathway overview pages `/learn/pathway/{slug}`
- ✅ Search/filter functionality

**Tech Stack:**
- HubDB for content storage
- Node.js sync script (runs in CI)
- HubSpot API for CRUD operations

**Success Criteria:**
- Content editable via Git (markdown files)
- CI syncs to HubDB automatically
- All pages pull from HubDB (no hardcoded content)
- Search works across modules/pathways

---

## Phase 2: Interactive LMS Features 🎯
**Goal:** Add interactivity, tracking, and user features
**Timeline:** Sprint 3-5 (4-6 weeks)

### Sprint 3: External App Foundation + Basic Quiz
**Deliverables:**
- ✅ Set up external frontend (Next.js on Vercel)
  - Domain: `app.hedgehog.cloud`
  - Basic routing
  - Shared component library
- ✅ Implement cookie-based identity (hutk passing)
- ✅ Build simple quiz interface
- ✅ AWS Lambda: Quiz grading endpoint
- ✅ Write quiz results to HubSpot (behavioral events)

**Tech Stack:**
- Next.js (external frontend)
- AWS Lambda + API Gateway
- HubSpot app token for API calls
- Cookie-based tracking (hutk)

**Success Criteria:**
- Quiz UI works in external app
- Grading logic in Lambda
- Quiz completion tracked in HubSpot

---

### Sprint 4: Progress Tracking & CRM Integration
**Deliverables:**
- ✅ Create HubSpot custom objects:
  - Enrollment (pathway progress)
  - Module Progress (per-module tracking)
- ✅ Build progress dashboard (`/app/me`)
- ✅ Track module/lab completion
- ✅ "Resume where you left off" functionality
- ✅ Email capture form (progressive disclosure)

**Tech Stack:**
- HubSpot CRM custom objects
- Custom behavioral events
- Lambda: Progress update endpoints

**Success Criteria:**
- Users see their progress
- Completion rates tracked
- Email → Contact mapping works

---

### Sprint 5: Lab Validation & Certificates
**Deliverables:**
- ✅ Interactive lab validation
- ✅ Certificate generation (PDF)
- ✅ Certificate storage (S3)
- ✅ Certificate delivery (email + download)
- ✅ Shareable badges/certificates

**Tech Stack:**
- Lambda: Lab validation logic
- HTML → PDF generation
- S3 for certificate storage
- Email via HubSpot workflows

**Success Criteria:**
- Labs guide users through steps
- Certificates auto-generate on pathway completion
- Shareable certificate URLs

---

## Phase 3: Polish & Scale 🌟
**Goal:** Enhance UX, add advanced features
**Timeline:** Sprint 6+ (ongoing)

### Future Features:
- [ ] Advanced search (Algolia or similar)
- [ ] Video integration (module videos)
- [ ] Pathway prerequisites/dependencies
- [ ] Leaderboards/gamification
- [ ] Community features (comments/Q&A)
- [ ] Admin dashboard for content management
- [ ] Analytics/reporting
- [ ] Mobile app (optional)
- [ ] Offline mode (PWA)
- [ ] Real SSO/authentication (if needed)
- [ ] Private/paid pathways

---

## Technical Architecture Evolution

### Phase 1 (Current):
```
HubSpot CMS (all pages) → Static content
```

### Phase 2:
```
HubSpot CMS (content pages) → HubDB (data)
```

### Phase 3:
```
HubSpot CMS (marketing) + External App (interactive) → AWS Lambda → HubSpot APIs
```

### Phase 4 (Future):
```
HubSpot CMS + External App + Real SSO → AWS Lambda → HubSpot APIs + External Services
```

---

## Sprint Schedule (Recommended)

| Sprint | Focus | Duration | Deliverable |
|--------|-------|----------|-------------|
| Sprint 1 | Landing + Module Templates | 1-2 weeks | Shareable content pages |
| Sprint 2 | HubDB + Content Sync | 1-2 weeks | Dynamic content, search |
| Sprint 3 | External App + Quiz | 2 weeks | Basic interactivity |
| Sprint 4 | Progress Tracking | 2 weeks | User dashboards |
| Sprint 5 | Labs + Certificates | 2 weeks | Full LMS features |
| Sprint 6+ | Polish + Features | Ongoing | Enhancements |

---

## Success Metrics

### Phase 1 (Content Launch):
- Landing page live date
- Number of modules published
- Page views / unique visitors
- Time on page
- Social shares

### Phase 2 (Interactive):
- Quiz completion rate
- Module completion rate
- User engagement time
- Email capture rate
- Certificate issuance

### Phase 3 (Scale):
- DAU/MAU
- Pathway completion rate
- NPS/satisfaction scores
- Conversion to paid (if applicable)

---

## Next Steps (Immediate)

1. ✅ Finalize Phase 1 requirements
2. ⬜ Create GitHub Projects board
3. ⬜ Create Sprint 1 issues (landing page + module template)
4. ⬜ Set up HubSpot CMS development environment
5. ⬜ Design wireframes for landing page
6. ⬜ Assign first issues to coding agent
7. ⬜ Define content authoring process (markdown files)
8. ⬜ Set up CI for content deployment

---

## Risk Mitigation

**Risk:** Content creation bottleneck
**Mitigation:** Start with 3-5 modules, add more incrementally

**Risk:** HubSpot CMS limitations
**Mitigation:** Build for migration to external app in Phase 3

**Risk:** Scope creep in Phase 1
**Mitigation:** Strict feature freeze - content delivery only

**Risk:** Brand inconsistency
**Mitigation:** Design system + shared components early
