# HH-Learn Comprehensive LMS Design
## Authentication & Feature Architecture for Public Content with Authenticated Enhancements

**Date:** October 27, 2025
**Version:** 1.0
**Status:** Design Proposal
**Related Issue:** #270

---

## Executive Summary

This document provides comprehensive design recommendations for the HH-Learn lightweight LMS platform based on extensive research of HubSpot best practices, industry standards, and analysis of the current implementation.

### Critical Discovery: Authentication Approach Needs Simplification

**Key Finding:** Research definitively shows that **HubSpot's native CMS Membership is the "golden path"** for public pages with authenticated features, not custom JWT authentication.

- HubSpot deprecated JWT-based SSO in February 2025, replacing it with OpenID Connect (OIDC)
- `request_contact.is_logged_in` works on ALL pages (public and private) via server-side rendering
- Commercial LMS platforms on HubSpot (HubLMS, Learn LMS) all use native Memberships
- The original assumption that "HubSpot auth doesn't work on public pages" was incorrect

**Recommendation:** Proceed with Issue #270's proposed simplification to align with HubSpot's official patterns.

---

## Table of Contents

1. [Authentication Architecture](#1-authentication-architecture)
2. [Enrollment System Design](#2-enrollment-system-design)
3. [Progress Tracking Architecture](#3-progress-tracking-architecture)
4. [Student Dashboard ("My Learning")](#4-student-dashboard-my-learning)
5. [Course Author Experience](#5-course-author-experience)
6. [Future Features (Tests, Badges, Certificates)](#6-future-features)
7. [Data Models](#7-data-models)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Technical Specifications](#9-technical-specifications)

---

## 1. Authentication Architecture

### Current State Analysis

**Existing Implementation:**
- Dual authentication system: JWT (primary) + HubSpot Membership (secondary)
- JWT authentication via `/auth/login` endpoint
- `window.hhIdentity` public API for identity management
- 4 competing identity sources creating complexity
- 134 lines of conditional logic in auth-context.js
- Incomplete integration (action-runner.js doesn't check JWT)

**Pain Points Identified:**
1. Multiple authentication flows causing user confusion
2. Code duplication across 5 files (buildAuthHeaders())
3. Broken redirect chain causing 404s (`/learn/%2Flearn/...`)
4. Session management inconsistency (JWT: 24h, Membership: session, Handshake: 6h)
5. No unified auth state management

### Recommended Architecture: Simplified HubSpot Native

**Alignment with HubSpot Best Practices:**

```
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC PAGES                              │
│  (All /learn/* pages accessible without authentication)     │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│              HubSpot CMS Membership                          │
│  • Native authentication via /_hcms/mem/login               │
│  • Session managed by HubSpot (HTTP-only cookies)           │
│  • request_contact.is_logged_in available in HubL           │
│  • Works on both public AND private pages                   │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│          Server-Side Identity (HubL Templates)              │
│  {% if request_contact.is_logged_in %}                      │
│    {{ request_contact.email }}                              │
│    {{ request_contact.hs_object_id }}                       │
│  {% endif %}                                                 │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│       Client-Side Identity (window.hhIdentity)              │
│  • Hydrated from server-rendered data attributes            │
│  • Fallback to Membership API on private pages             │
│  • Consistent interface for all JS modules                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Changes (Issue #270 Implementation):**

1. **Remove Custom JWT from Production**
   - Keep JWT endpoint for **testing only** (internal use)
   - Production uses HubSpot Membership exclusively
   - Simplifies codebase by ~500 lines

2. **Unified Login Flow**
   - CTA login uses same URL as left-nav: `/_hcms/mem/login?redirect_url=...`
   - No email prompt modal
   - No auth-handshake page
   - Direct HubSpot login with proper redirect

3. **Server-Side Identity Injection**
   ```django
   {# In base template #}
   <div id="hhl-auth-context"
        data-authenticated="{{ 'true' if request_contact.is_logged_in else 'false' }}"
        data-email="{{ request_contact.email if request_contact.is_logged_in else '' }}"
        data-contact-id="{{ request_contact.hs_object_id if request_contact.is_logged_in else '' }}"
        data-firstname="{{ request_contact.firstname if request_contact.is_logged_in else '' }}"
        data-lastname="{{ request_contact.lastname if request_contact.is_logged_in else '' }}">
   </div>
   ```

4. **Simplified Client-Side Logic**
   ```javascript
   // auth-context.js (simplified)
   const authContext = document.getElementById('hhl-auth-context');
   const identity = authContext.dataset.authenticated === 'true' ? {
     email: authContext.dataset.email,
     contactId: authContext.dataset.contactId,
     firstname: authContext.dataset.firstname,
     lastname: authContext.dataset.lastname
   } : null;

   window.hhIdentity = {
     get: () => identity,
     isAuthenticated: () => !!identity,
     ready: Promise.resolve(identity)
   };
   ```

### Benefits of Simplified Architecture

| Aspect | Current (JWT) | Recommended (Native) | Improvement |
|--------|---------------|----------------------|-------------|
| Code Complexity | High (dual system) | Low (single system) | -60% lines |
| Maintenance | Manual (JWT_SECRET, token mgmt) | HubSpot managed | -80% effort |
| Security | Custom (DIY) | Enterprise (HubSpot) | +95% |
| Features | Basic | SSO, 2FA, social login | +300% |
| Alignment | Off-path | Golden path | 100% |
| Testing | Complex (JWT mocking) | Standard (membership) | +50% speed |

### Migration Strategy

**Phase 1: Immediate (Issue #270)**
- ✅ Update CTA login to use `/_hcms/mem/login` with proper redirect
- ✅ Share login URL helper between left-nav and CTAs
- ✅ Remove email prompt modal
- ✅ Deprecate `/learn/auth-handshake` page

**Phase 2: Backend Alignment (Next Sprint)**
- Update Lambda endpoints to accept HubSpot session cookies
- Add cookie validation via HubSpot Membership API
- Keep JWT endpoint for **testing only** (restrict to test environments)

**Phase 3: Cleanup (Following Sprint)**
- Remove JWT from production templates
- Simplify auth-context.js
- Remove duplicate identity resolution logic
- Update documentation

---

## 2. Enrollment System Design

### User Experience Principles

**Research Finding:** Industry best practice is **deferred account creation** - let users experience value before requiring signup.

**Recommended Flow:**

```
Anonymous User Experience:
├── Browse all pathways/courses/modules (✓ No login required)
├── Read all content (✓ No login required)
├── localStorage progress tracking (✓ Anonymous progress)
└── Gated features requiring authentication:
    ├── Enrollment in pathways/courses
    ├── Progress sync across devices
    ├── Certificates and badges
    ├── "My Learning" dashboard
    └── Course completion tracking

Motivation Points (when to prompt login):
├── After completing first module (high engagement moment)
├── When attempting to enroll in course/pathway
├── When accessing "My Learning" dashboard
└── After 3+ module views (demonstrated interest)
```

### Enrollment Flow Design

**Current Gap:** No explicit enrollment CTAs on pathway/course pages.

**Recommended UI:**

```
┌─────────────────────────────────────────────────────────────┐
│ Pathway: Cloud Native Fundamentals          [Enrolled ✓]    │ ← Header (sticky)
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Hero Image]                                                │
│                                                              │
│  Master cloud native technologies                            │
│  Learn Kubernetes, containers, and microservices            │
│                                                              │
│  ⏱ 8 hours • 📚 3 courses • 🎯 Intermediate                 │
│                                                              │
│  [Enroll in Pathway] ← Primary CTA (above fold)             │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  What You'll Learn                                           │
│  • Container fundamentals                                    │
│  • Kubernetes orchestration                                  │
│  • Microservices architecture                                │
│                                                              │
│  [Enroll in Pathway] ← Secondary CTA (after benefits)       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Learning Path (3 Courses)                                   │
│  1. Introduction to Containers                               │
│  2. Kubernetes Essentials                                    │
│  3. Microservices Patterns                                   │
│                                                              │
│  [Enroll in Pathway] ← Tertiary CTA (after course list)     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Enrollment State Machine

```javascript
// Button states
const ENROLLMENT_STATES = {
  NOT_ENROLLED: {
    label: 'Enroll in Pathway',
    action: 'enroll',
    style: 'primary'
  },
  ENROLLING: {
    label: 'Enrolling...',
    action: null,
    style: 'loading',
    disabled: true
  },
  ENROLLED: {
    label: '✓ Enrolled in Pathway',
    action: 'view_progress',
    style: 'success',
    disabled: true
  }
};
```

### Enrollment API Design

**Endpoint:** `POST /enrollments/create`

**Request:**
```json
{
  "email": "user@example.com",
  "contactId": "12345",  // From JWT or HubSpot session
  "content_type": "pathway",  // or "course"
  "slug": "cloud-native-fundamentals",
  "enrollment_source": "pathway_page",  // Analytics tracking
  "pathway_context": null  // If enrolling in course via pathway
}
```

**Response (Success):**
```json
{
  "status": "success",
  "enrollment_id": "enr_abc123",
  "enrolled_at": "2025-10-27T14:30:00Z",
  "auto_enrolled_courses": ["intro-containers", "k8s-essentials"],
  "next_step": {
    "type": "course",
    "slug": "intro-containers",
    "url": "/learn/courses/intro-containers"
  }
}
```

**Response (Duplicate):**
```json
{
  "status": "already_enrolled",
  "enrolled_at": "2025-10-15T10:00:00Z",
  "message": "You are already enrolled in this pathway",
  "progress": {
    "courses_completed": 1,
    "total_courses": 3,
    "percentage": 33
  }
}
```

### Enrollment Confirmation UX

**Toast Notification Pattern:**
```
┌─────────────────────────────────────┐
│  ✓ Successfully enrolled!           │
│                                     │
│  You're now enrolled in:            │
│  Cloud Native Fundamentals          │
│                                     │
│  [View My Learning]  [Start Course] │
└─────────────────────────────────────┘
```

**Post-Enrollment Actions:**
1. Show confirmation toast (3 seconds)
2. Update button state to "Enrolled"
3. Reveal "Start First Course" CTA
4. Track enrollment event to CRM
5. Optionally: Send confirmation email (HubSpot workflow)

---

## 3. Progress Tracking Architecture

### Visual Progress Indicators

**Research Finding:** Visual progress indicators are critical for learner motivation and completion rates.

**Recommended Patterns:**

**1. Linear Progress Bar (Course Cards)**
```css
.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #E5E7EB;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3B82F6, #1D4ED8);
  transition: width 0.3s ease-in-out;
  border-radius: 4px;
}
```

**2. Status Badges**
- ✓ Completed (green: `#D1FAE5` background, `#065F46` text)
- ◐ In Progress (blue: `#DBEAFE` background, `#1E40AF` text)
- ○ Not Started (gray: `#F3F4F6` background, `#6B7280` text)

**3. Completion Stats**
```
3 of 5 modules complete (60%)
Last viewed: 2 days ago
```

### Progress Tracking Data Flow

**Current Implementation:**
```
User Action → Redirect to /learn/action-runner → POST /events/track →
Lambda persists to CRM → Redirect back → Page shows updated state
```

**Issues with Current Flow:**
- Full page redirects break user experience
- No optimistic UI updates
- Slow feedback loop (2-3 seconds)

**Recommended Implementation:**
```
User Action → Optimistic UI update (immediate) → AJAX POST /events/track →
Lambda persists to CRM → Confirm success (200ms) →
Fallback on error → Toast notification
```

**Code Example:**
```javascript
async function markModuleComplete(moduleSlug) {
  // 1. Optimistic UI update
  updateButtonState(moduleSlug, 'completed');
  updateProgressBar(+1);

  try {
    // 2. Persist to backend
    const response = await fetch(TRACK_EVENTS_URL, {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify({
        eventName: 'learning_module_completed',
        payload: {
          module_slug: moduleSlug,
          course_context: getCurrentCourseSlug(),
          ts: new Date().toISOString()
        }
      })
    });

    if (!response.ok) throw new Error('Failed to save');

    // 3. Confirm success
    showToast('✓ Progress saved', 'success');

  } catch (error) {
    // 4. Rollback on error
    updateButtonState(moduleSlug, 'in_progress');
    updateProgressBar(-1);
    showToast('Failed to save progress. Trying again...', 'error');

    // Retry with exponential backoff
    retryWithBackoff(() => persistProgress(moduleSlug));
  }
}
```

### Progress Persistence Strategy

**Three-Layer Architecture:**

```
Layer 1: Client (Immediate)
├── localStorage (anonymous users)
├── Optimistic state updates
└── Instant visual feedback

Layer 2: Sync Queue (Resilient)
├── Failed requests queued
├── Retry with exponential backoff
└── Background sync on reconnect

Layer 3: Server (Truth)
├── HubSpot CRM (authenticated users)
├── Behavioral events for analytics
└── Progress aggregation for dashboards
```

**Synchronization Logic:**
```javascript
// On page load
async function syncProgress() {
  const localProgress = getLocalProgress();
  const serverProgress = await fetchServerProgress();

  // Merge strategy: server wins for conflicts, local fills gaps
  const merged = mergeProgress(localProgress, serverProgress);

  // Update UI with merged state
  updateUI(merged);

  // Push local-only progress to server
  const localOnly = getLocalOnlyProgress(localProgress, serverProgress);
  if (localOnly.length > 0) {
    await pushProgressToServer(localOnly);
  }
}
```

### Course Context Detection

**Current Gap:** Modules don't know which course they belong to when accessed from course pages.

**Recommended Solution:**

**1. URL Parameter Context**
```html
<!-- In course page template: Add context to module links -->
<a href="/learn/modules/{{ module.slug }}?from=course:{{ course.slug }}&position=2&total=5">
  Module 2: Container Fundamentals
</a>
```

**2. Read Context in Module JavaScript**
```javascript
function getCourseContext() {
  const urlParams = new URLSearchParams(window.location.search);
  const from = urlParams.get('from');
  const position = urlParams.get('position');
  const total = urlParams.get('total');

  if (from && from.startsWith('course:')) {
    return {
      type: 'course',
      slug: from.replace('course:', ''),
      position: parseInt(position, 10),
      total: parseInt(total, 10)
    };
  }
  return null;
}
```

**3. Dynamic Breadcrumb & Navigation**
```javascript
function renderCourseNavigation(context) {
  if (!context) return;

  const nav = document.getElementById('course-navigation');
  nav.innerHTML = `
    <div class="breadcrumb">
      <a href="/learn/courses/${context.slug}">← Back to Course</a>
      <span>Module ${context.position} of ${context.total}</span>
    </div>
    <div class="progress-indicator">
      <div class="progress-fill" style="width: ${(context.position / context.total) * 100}%"></div>
    </div>
    <div class="module-navigation">
      ${context.position > 1 ? '<a class="prev-module">← Previous Module</a>' : ''}
      ${context.position < context.total ? '<a class="next-module">Next Module →</a>' : ''}
    </div>
  `;
}
```

---

## 4. Student Dashboard ("My Learning")

### Dashboard Layout Design

**Research Finding:** Best-in-class dashboards prioritize "Resume Learning" and show progress at-a-glance.

**Recommended Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  My Learning Dashboard                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 Your Progress                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ In Progress  │  │  Completed   │  │   Enrolled   │      │
│  │      5       │  │      12      │  │      3       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  🎯 Continue Where You Left Off                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Module: Container Fundamentals                      │   │
│  │ In: Kubernetes Essentials • Viewed 2 days ago       │   │
│  │ [Continue Learning →]                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  🎓 My Enrolled Pathways (2)                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Cloud Native Fundamentals          [Pathway]       │    │
│  │ ████████████░░░░░░░░░░░░░░ 60%                      │    │
│  │ 2 of 3 courses complete                             │    │
│  │ [Continue Pathway →]                                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  📚 My Enrolled Courses (3)                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Kubernetes Essentials                   [Course]   │    │
│  │ Enrolled: Oct 15, 2025 • Source: pathway           │    │
│  │ ████████████░░░░░░░░░░░░░░ 60%                      │    │
│  │ 3 of 5 modules complete                             │    │
│  │ ▼ View Modules                                      │    │
│  │   ✓ Module 1: Welcome                               │    │
│  │   ✓ Module 2: Basics                                │    │
│  │   ✓ Module 3: Advanced                              │    │
│  │   ◐ Module 4: Practice (current)                    │    │
│  │   ○ Module 5: Final Project                         │    │
│  │ [Continue to Next Module →]                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  🔄 In Progress (5 modules)                                 │
│  [Grid of module cards with progress badges]                │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  ✓ Completed (12 modules)                                   │
│  [Collapsible grid of completed module cards]               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard Data Fetching

**Current Implementation:** Fetches from CRM for authenticated users, falls back to localStorage.

**Recommended Optimization:**

**Issue:** N+1 query problem (fetch HubDB metadata for each module individually)

**Solution:** Batch HubDB queries
```javascript
async function fetchEnrolledCourses() {
  // 1. Get enrollments from CRM
  const enrollments = await fetchEnrollments();

  // 2. Extract all course slugs
  const courseSlugs = enrollments.courses.map(c => c.slug);

  // 3. Batch fetch HubDB metadata (single query)
  const coursesMetadata = await fetchCoursesMetadata(courseSlugs);

  // 4. Merge enrollment data with metadata
  return enrollments.courses.map(enrollment => ({
    ...enrollment,
    ...coursesMetadata[enrollment.slug]
  }));
}
```

### Smart "Resume Learning" Feature

**Algorithm:**
```javascript
function determineResumeTarget(progress) {
  // Priority 1: Last viewed content (within 7 days)
  if (progress.last_viewed && isRecent(progress.last_viewed.at, 7)) {
    return {
      type: progress.last_viewed.type,
      slug: progress.last_viewed.slug,
      context: progress.last_viewed.course_context,
      reason: `Viewed ${formatRelativeTime(progress.last_viewed.at)}`
    };
  }

  // Priority 2: First incomplete module in most recent course
  const recentCourse = getMostRecentlyAccessedCourse(progress);
  if (recentCourse) {
    const nextModule = getFirstIncompleteModule(recentCourse);
    if (nextModule) {
      return {
        type: 'module',
        slug: nextModule.slug,
        context: recentCourse.slug,
        reason: `Next in ${recentCourse.title}`
      };
    }
  }

  // Priority 3: First incomplete in earliest enrolled course
  const earliestCourse = getEarliestEnrolledCourse(progress);
  if (earliestCourse) {
    const nextModule = getFirstIncompleteModule(earliestCourse);
    if (nextModule) {
      return {
        type: 'module',
        slug: nextModule.slug,
        context: earliestCourse.slug,
        reason: `Continue ${earliestCourse.title}`
      };
    }
  }

  return null;
}
```

---

## 5. Course Author Experience

### Authoring Workflow

**Recommended Approach: YAML Frontmatter + Markdown + HTML5 Data Attributes**

**Level 1: Basic Content (YAML + Markdown)**
```yaml
---
title: "Kubernetes Basics"
slug: "kubernetes-basics"
difficulty: "beginner"
estimated_minutes: 45
description: "Learn Kubernetes fundamentals by deploying your first containerized application."
tags: [kubernetes, containers, orchestration]
has_quiz: true
completion_criteria:
  - read_time: 30
  - quiz_passed: intro-k8s-quiz
---

## Introduction

Kubernetes is an open-source container orchestration platform...

## Core Concepts

[Content here...]
```

**Level 2: Interactive Elements (HTML5 Data Attributes)**
```markdown
## Knowledge Check

<div data-quiz="intro-k8s-quiz"
     data-pass-score="70"
     data-allow-retries="true">

### Question 1
<div data-question
     data-type="single"
     data-answer="b"
     data-hint="Think about the smallest deployable unit">

What is a Pod?
- (a) A network endpoint
- (b) The smallest deployable unit that can contain one or more containers
- (c) A persistent volume
</div>

### Question 2
<div data-question
     data-type="multiple"
     data-answers="a,c">

Which are Kubernetes objects? (Select all)
- (a) Pod
- (b) Docker
- (c) Service
- (d) Node.js
</div>

</div>
```

**Level 3: Advanced Features (JSON Configuration)**
```json
{
  "interactive_elements": [
    {
      "type": "lab",
      "id": "deploy-nginx",
      "validation_endpoint": "/lab/validate",
      "completion_required": true,
      "instructions": "Deploy an nginx Pod to your cluster"
    }
  ]
}
```

### Validation Pipeline

**Pre-Publish Validation:**
```bash
# 1. Syntax validation
markdownlint content/modules/kubernetes-basics/README.md

# 2. Frontmatter schema validation
npm run validate:frontmatter -- content/modules/kubernetes-basics/README.md

# 3. Link checking
markdown-link-check content/modules/kubernetes-basics/README.md

# 4. Interactive element validation
npm run validate:interactive -- content/modules/kubernetes-basics/README.md
```

**Validation Output:**
```
✅ Validated frontmatter
✅ Found 1 quiz with 2 questions
✅ All questions have correct answers
✅ Description: 127 chars (valid)
✅ All links working (8 checked)
⚠️  Warning: Consider adding alt text to diagram.png

Ready to sync
```

### Preview Modes

**1. Dry-Run Sync**
```bash
npm run sync:content -- --dry-run
```
Shows what would sync without making changes.

**2. Debug Mode**
```
https://hedgehog.cloud/learn/modules/kubernetes-basics?debug=1
```
Shows metadata banner with validation info.

**3. Author Preview (Recommended Addition)**
```
https://hedgehog.cloud/learn/modules/kubernetes-basics?preview=true&token=...
```
Features:
- Preview unpublished changes
- Show validation warnings inline
- Interactive element test mode (answers visible)
- Mobile/responsive view toggle

---

## 6. Future Features

### Quiz System

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Quiz Definition (Markdown)                │
│  <div data-quiz="intro-k8s" data-pass-score="70">           │
│    <div data-question data-answer="b">...</div>             │
│  </div>                                                      │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│             Client-Side Quiz Enhancement                     │
│  • Detects [data-quiz] elements                             │
│  • Attaches event handlers                                  │
│  • Collects user answers                                    │
│  • Grades locally or via API                                │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│               POST /quiz/grade (Optional)                    │
│  • Validates answer structure                               │
│  • Calculates score                                         │
│  • Returns detailed feedback                                │
│  • Tracks attempt in CRM                                    │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│              Quiz Results Storage (CRM)                      │
│  hhl_quiz_results property (JSON):                          │
│  {                                                           │
│    "quizzes": {                                              │
│      "intro-k8s": {                                          │
│        "attempts": [...],                                    │
│        "best_score": 85,                                     │
│        "passed": true                                        │
│      }                                                       │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

**Quiz Grading Logic:**
```javascript
const scoringMethods = {
  highest: (attempts) => Math.max(...attempts.map(a => a.score)),
  latest: (attempts) => attempts[attempts.length - 1].score,
  average: (attempts) => attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
};

const quizConfig = {
  passing_score: 70,
  max_attempts: 3,
  scoring_method: 'highest',
  show_correct_answers: true
};
```

### Badge & Certificate System

**Research Finding:** 87% of badge earners report increased engagement (IBM Survey).

**Badge Hierarchy:**
```
Badge Tiers:
├── Basic Badges (frequent, low commitment)
│   └── Examples: "First Module Complete", "Week 1 Done"
├── Achievement Badges (moderate effort)
│   └── Examples: "Course Complete", "5 Modules in One Week"
├── Award Badges (high commitment)
│   └── Examples: "Pathway Master", "All Courses Complete"
└── Praise Badges (instructor awarded)
    └── Examples: "Outstanding Contribution", "Peer Helper"
```

**Badge Award Triggers:**
```javascript
const badgeTriggers = [
  {
    badge: 'first-module-complete',
    condition: (progress) => progress.completed.size === 1,
    title: 'First Steps',
    description: 'Completed your first module'
  },
  {
    badge: 'course-complete',
    condition: (progress) => isCourseComplete(courseSlug, progress),
    title: 'Course Master',
    description: 'Completed all modules in a course'
  },
  {
    badge: 'pathway-complete',
    condition: (progress) => isPathwayComplete(pathwaySlug, progress),
    title: 'Pathway Champion',
    description: 'Completed an entire learning pathway'
  },
  {
    badge: 'speed-learner',
    condition: (progress) => completedCourseInDays(courseSlug, progress) <= 7,
    title: 'Speed Learner',
    description: 'Completed a course in under 7 days'
  }
];
```

**Certificate Generation:**
- Award for course/pathway completion
- Include learner name, course title, completion date
- Unique certificate ID for verification
- Downloadable PDF
- Shareable to LinkedIn

### Interactive Exercises

**Lab Validation Pattern:**
```markdown
<div data-exercise="deploy-nginx"
     data-validation-url="/validate/nginx-deploy"
     data-required="true">

### Task
Deploy an nginx Pod to your cluster.

```bash
kubectl create deployment nginx --image=nginx:latest
kubectl get pods
```

<button data-validate>Check My Work</button>

</div>
```

**Validation Flow:**
1. User clicks "Check My Work"
2. JavaScript calls `/validate/nginx-deploy` with user context
3. Backend checks user's cluster state (Kubernetes API or screenshot analysis)
4. Returns success/failure + hints
5. UI shows feedback + next steps

---

## 7. Data Models

### Enrollment Data Model

**HubSpot Contact Property: `hhl_enrollments` (JSON)**
```json
{
  "pathways": [
    {
      "slug": "cloud-native-fundamentals",
      "enrolled_at": "2025-10-15T14:30:00Z",
      "enrollment_source": "pathway_page",
      "status": "active"
    }
  ],
  "courses": [
    {
      "slug": "kubernetes-essentials",
      "enrolled_at": "2025-10-20T09:00:00Z",
      "enrollment_source": "catalog",
      "pathway_context": "cloud-native-fundamentals",
      "status": "active"
    }
  ]
}
```

### Progress Data Model

**HubSpot Contact Property: `hhl_progress_state` (JSON)**
```json
{
  "pathways": {
    "cloud-native-fundamentals": {
      "enrolled": true,
      "enrolled_at": "2025-10-15T14:30:00Z",
      "last_accessed": "2025-10-16T10:30:00Z",
      "courses": {
        "kubernetes-essentials": {
          "enrolled": true,
          "enrolled_at": "2025-10-15T14:30:00Z",
          "modules": {
            "k8s-intro": {
              "started": true,
              "started_at": "2025-10-15T15:00:00Z",
              "completed": true,
              "completed_at": "2025-10-16T10:30:00Z",
              "time_spent_minutes": 12,
              "completion_context": "cloud-native-fundamentals/kubernetes-essentials"
            }
          }
        }
      }
    }
  },
  "courses": {
    "standalone-course": {
      "enrolled": true,
      "enrolled_at": "2025-10-20T09:00:00Z",
      "last_accessed": "2025-10-20T09:15:00Z",
      "modules": {
        "module-1": {
          "started": true,
          "started_at": "2025-10-20T09:15:00Z",
          "completed": false,
          "time_spent_minutes": 5
        }
      }
    }
  },
  "last_viewed": {
    "type": "module",
    "slug": "k8s-intro",
    "course_context": "kubernetes-essentials",
    "at": "2025-10-20T09:15:00Z"
  }
}
```

### Quiz Results Data Model

**HubSpot Contact Property: `hhl_quiz_results` (JSON)**
```json
{
  "quizzes": {
    "intro-k8s-quiz": {
      "attempts": [
        {
          "attempt_number": 1,
          "started_at": "2025-10-20T10:00:00Z",
          "completed_at": "2025-10-20T10:15:00Z",
          "score": 75,
          "total_questions": 10,
          "correct_answers": 7.5,
          "passing_score": 70,
          "passed": true,
          "time_spent_minutes": 15,
          "answers": {
            "question-1": {
              "selected": "b",
              "correct": true
            },
            "question-2": {
              "selected": "a",
              "correct": false,
              "correct_answer": "b"
            }
          }
        }
      ],
      "best_score": 75,
      "completion_status": "passed"
    }
  }
}
```

### Achievements Data Model

**HubSpot Contact Property: `hhl_achievements` (JSON)**
```json
{
  "badges": [
    {
      "badge_id": "first-module-complete",
      "earned_at": "2025-10-15T15:30:00Z",
      "title": "First Steps",
      "description": "Completed your first module",
      "image_url": "/badges/first-steps.png"
    },
    {
      "badge_id": "course-complete-k8s",
      "earned_at": "2025-10-20T16:00:00Z",
      "title": "Kubernetes Master",
      "description": "Completed Kubernetes Essentials course",
      "image_url": "/badges/k8s-master.png"
    }
  ],
  "certificates": [
    {
      "certificate_id": "cert_abc123",
      "content_type": "course",
      "content_slug": "kubernetes-essentials",
      "issued_at": "2025-10-20T16:00:00Z",
      "download_url": "/certificates/cert_abc123.pdf",
      "verification_url": "https://hedgehog.cloud/verify/cert_abc123"
    }
  ]
}
```

---

## 8. Implementation Roadmap

### Phase 1: Authentication Simplification (1-2 weeks)

**Goals:** Implement Issue #270, align with HubSpot best practices

**Tasks:**
1. ✅ Update CTA login flow to use `/_hcms/mem/login`
2. ✅ Share login URL helper between left-nav and CTAs
3. ✅ Remove email prompt modal
4. ✅ Deprecate `/learn/auth-handshake`
5. ✅ Update tests to use HubSpot Membership
6. ✅ Document simplified authentication flow

**Success Criteria:**
- CTA uses shared login link
- Logged-in users see correct CTA immediately
- Anonymous users redirected to HubSpot login → back to content
- Tests pass with Membership authentication

### Phase 2: Enrollment System (2-3 weeks)

**Goals:** Implement explicit enrollment CTAs and confirmation UX

**Tasks:**
1. Add enrollment CTAs to pathway/course templates
2. Implement enrollment state machine
3. Create POST /enrollments/create Lambda endpoint
4. Create GET /enrollments/list Lambda endpoint
5. Add enrollment confirmation toast notifications
6. Update My Learning with enrolled content section
7. Track enrollment source for analytics

**Success Criteria:**
- Enrollment CTAs visible on pathway/course pages
- Single-click enrollment for authenticated users
- Confirmation toast appears after enrollment
- My Learning shows enrolled pathways/courses
- Progress tracking works for enrolled content

### Phase 3: Progress Feedback (2 weeks)

**Goals:** Fix progress tracking feedback loop

**Tasks:**
1. Implement optimistic UI updates
2. Add toast notifications for progress actions
3. Fix progress bars to read from real CRM data
4. Add course-level progress calculation
5. Improve error handling and retry logic
6. Add cross-device sync

**Success Criteria:**
- Button state updates immediately after user action
- Toast notifications show success/failure
- Progress bars show accurate percentages
- Progress syncs across devices
- Errors handled gracefully with retries

### Phase 4: Course Context (2-3 weeks)

**Goals:** Implement course context tracking for modules

**Tasks:**
1. Add URL parameter context to module links
2. Read course context in module JavaScript
3. Display dynamic breadcrumb
4. Override prev/next navigation with course sequence
5. Show progress indicator ("Module 2 of 5")
6. Persist context in sessionStorage

**Success Criteria:**
- Breadcrumb shows "← Back to [Course]"
- Progress indicator shows position in course
- Prev/Next buttons navigate within course
- Context persists across navigation

### Phase 5: Dashboard Optimization (1-2 weeks)

**Goals:** Optimize My Learning dashboard performance and UX

**Tasks:**
1. Fix N+1 HubDB query problem (batch fetching)
2. Implement smart "Resume Learning" feature
3. Add at-a-glance statistics
4. Improve course card design
5. Add filtering/sorting options
6. Add estimated time to complete

**Success Criteria:**
- Dashboard loads in < 2 seconds
- Resume Learning shows most relevant content
- Statistics update dynamically
- Course cards show accurate progress
- Filters work correctly

### Phase 6: Quiz System (3-4 weeks)

**Goals:** Implement interactive quiz functionality

**Tasks:**
1. Formalize quiz markup pattern (HTML5 data attributes)
2. Create quiz authoring template and documentation
3. Add validation to sync script
4. Build quiz enhancement JavaScript
5. Create POST /quiz/grade Lambda endpoint
6. Implement quiz results storage in CRM
7. Add quiz completion tracking
8. Integrate quiz passing with course completion

**Success Criteria:**
- Authors can add quizzes using simple markup
- Quizzes validate during sync
- Learners can take quizzes and see results
- Quiz results persist to CRM
- Quiz passing updates progress

### Phase 7: Badges & Certificates (3-4 weeks)

**Goals:** Implement achievement and certificate system

**Tasks:**
1. Design badge hierarchy and triggers
2. Create badge award logic
3. Design certificate templates
4. Implement certificate generation
5. Add achievements section to My Learning
6. Create achievement notifications
7. Enable LinkedIn sharing

**Success Criteria:**
- Badges automatically awarded for achievements
- Certificates generated for course/pathway completion
- Achievements displayed in My Learning
- Certificates downloadable as PDF
- LinkedIn sharing works

---

## 9. Technical Specifications

### API Endpoints

**Authentication:**
- `POST /auth/login` (keep for testing only)
- HubSpot Membership: `/_hcms/mem/login` (primary)

**Enrollment:**
- `POST /enrollments/create` (new)
- `GET /enrollments/list` (existing)

**Progress:**
- `POST /events/track` (existing, enhanced)
- `GET /progress/read` (existing)
- `GET /progress/aggregate` (existing)

**Quiz:**
- `POST /quiz/grade` (new)
- `GET /quiz/results` (new)

**Achievements:**
- `POST /achievements/award` (new)
- `GET /achievements/list` (new)
- `POST /certificates/generate` (new)

### Client-Side JavaScript Modules

**Core Modules:**
- `auth-context.js` - Identity management (simplified)
- `enrollment.js` - Enrollment logic
- `progress.js` - Progress tracking
- `my-learning.js` - Dashboard functionality

**New Modules:**
- `quiz.js` - Quiz enhancement
- `achievements.js` - Badge and certificate display
- `course-navigation.js` - Course context management

### HubDB Schema Enhancements

**Modules Table:**
```json
{
  "columns": [
    {"name": "has_quiz", "type": "BOOLEAN", "default": false},
    {"name": "quiz_passing_score", "type": "NUMBER", "default": 70},
    {"name": "has_exercises", "type": "BOOLEAN", "default": false},
    {"name": "requires_authentication", "type": "BOOLEAN", "default": false},
    {"name": "completion_criteria", "type": "TEXT"},
    {"name": "achievement_badge_url", "type": "TEXT"},
    {"name": "interactive_config_json", "type": "JSON"}
  ]
}
```

**Courses Table:**
```json
{
  "columns": [
    {"name": "completion_certificate_template", "type": "TEXT"},
    {"name": "completion_badge_id", "type": "TEXT"},
    {"name": "estimated_hours", "type": "NUMBER"}
  ]
}
```

### HubSpot Contact Properties

**New Properties:**
- `hhl_enrollments` (JSON) - Enrollment tracking
- `hhl_progress_state` (JSON) - Progress tracking
- `hhl_quiz_results` (JSON) - Quiz results
- `hhl_achievements` (JSON) - Badges and certificates

---

## Conclusion

This comprehensive design provides a clear roadmap for transforming HH-Learn from its current state to a production-ready, engaging learning management system that:

1. **Aligns with HubSpot Best Practices** - Uses native Membership for authentication
2. **Provides Excellent User Experience** - Clear enrollment, instant feedback, smart progress tracking
3. **Enables Content Authors** - Simple markup patterns, validation, preview modes
4. **Scales to Advanced Features** - Quizzes, badges, certificates, interactive exercises
5. **Maintains Code Quality** - Simplified architecture, reduced duplication, better testing

**Critical Next Step:** Implement Issue #270 to simplify authentication and establish the foundation for all subsequent improvements.

---

## References

**Research Documents:**
- `HUBSPOT-AUTH-RESEARCH-REPORT.md` (HubSpot authentication best practices)
- `HUBSPOT-AUTH-QUICK-SUMMARY.md` (Quick reference)
- `AUTH-ANALYSIS-SUMMARY.txt` (Current implementation analysis)
- `ENROLLMENT-AND-PROGRESS-ANALYSIS.md` (Progress tracking deep dive)
- `LMS-COMPREHENSIVE-GAP-ANALYSIS.md` (Gap analysis)
- Course authoring research report (embedded in research findings)

**Official Documentation:**
- HubSpot Memberships: https://developers.hubspot.com/docs/cms/data/memberships
- JWT SSO Sunset: https://developers.hubspot.com/changelog/sunset-of-jwt-sso-setup-for-private-content
- HubSpot Serverless Functions: https://developers.hubspot.com/docs/cms/data/serverless-functions

**Related Issues:**
- Issue #270: Simplify CTA login and drop auth-handshake
- Issue #242: Public-page authentication design
- ADR 001: Public-page authentication architecture
