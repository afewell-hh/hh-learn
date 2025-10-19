# Issue #210 Verification Plan
## CRM-backed pathway & course progress surfaces

### Issue Summary
Replace placeholder progress bars with real CRM-derived metrics on pathway and course pages.

### Implementation Overview

#### 1. Backend Changes (`src/api/lambda/index.ts`)
- **New endpoint**: `GET /progress/aggregate`
- **Parameters**:
  - `type`: 'pathway' or 'course' (required)
  - `slug`: pathway/course slug (required)
  - `email`: user email (optional, for auth)
  - `contactId`: HubSpot contact ID (optional, for auth)
- **Returns**:
  - `mode`: 'authenticated', 'anonymous', or 'fallback'
  - `started`: number of modules started
  - `completed`: number of modules completed
  - `enrolled`: boolean enrollment status
  - `enrolled_at`: enrollment timestamp (if enrolled)

#### 2. Frontend Changes

**Updated `pathways.js`**:
- Added `fetchCRMProgress()` function to call new API endpoint
- Modified `renderProgress()` to handle CRM data vs localStorage fallback
- Maintains backward compatibility with localStorage for anonymous users

**Created `courses.js`**:
- Similar functionality to pathways.js but for course pages
- Fetches progress from `/progress/aggregate?type=course&slug=...`
- Falls back to localStorage for anonymous users

**Updated `courses-page.html`**:
- Added progress tracker UI matching pathways page design
- Added data attributes for course slug and total modules
- Added script tag to load courses.js

#### 3. Data Flow

**Authenticated Users**:
1. Page loads with user context (email/contactId from HubSpot CMS)
2. JavaScript fetches progress from `/progress/aggregate`
3. CRM returns aggregated counts from `hhl_progress_state` contact property
4. Progress bar displays real data from CRM

**Anonymous Users**:
1. Page loads without user context
2. JavaScript attempts API call (returns `mode: anonymous`)
3. Falls back to localStorage
4. Shows prompt to sign in for cross-device sync

### Verification Test Cases

#### Test 1: Authenticated User - Pathway Progress
- **Given**: User is logged in with email `emailmaria@hubspot.com`
- **And**: User has progress on "getting-started" pathway
- **When**: User visits pathway detail page
- **Then**: Progress bar shows real CRM data (started/completed counts)
- **And**: No "sign in to sync" prompt displayed

#### Test 2: Authenticated User - Course Progress
- **Given**: User is logged in
- **And**: User has completed modules in a course
- **When**: User visits course detail page
- **Then**: Progress bar shows CRM-backed counts
- **And**: Percentage calculation is accurate

#### Test 3: Anonymous User - Pathway Progress
- **Given**: User is not logged in
- **And**: User has localStorage progress for a pathway
- **When**: User visits pathway page
- **Then**: Progress bar shows localStorage data
- **And**: "Sign in to sync" prompt is displayed

#### Test 4: Anonymous User - Course Progress
- **Given**: User is not logged in
- **And**: No localStorage progress exists
- **When**: User visits course page
- **Then**: Progress shows 0/0 (zero state)
- **And**: Progress bar is at 0%

#### Test 5: Zero Progress State
- **Given**: Authenticated user with no progress
- **When**: User visits pathway/course page
- **Then**: Progress shows 0 started, 0 completed
- **And**: Progress bar is at 0%

#### Test 6: Partial Progress
- **Given**: User has started 3 modules and completed 1 out of 5 total
- **When**: User visits page
- **Then**: Shows "Started: 3, Completed: 1"
- **And**: Progress bar is at 20% (1/5)

#### Test 7: Complete Progress
- **Given**: User has completed all modules in pathway/course
- **When**: User visits page
- **Then**: Shows completed count equals total
- **And**: Progress bar is at 100%

#### Test 8: API Performance
- **Given**: Production Lambda endpoint
- **When**: Making `/progress/aggregate` request
- **Then**: Response time < 500ms (p95 requirement)
- **And**: Response contains all expected fields

#### Test 9: Error Handling
- **Given**: Invalid parameters (missing slug)
- **When**: Making API request
- **Then**: Returns 400 Bad Request
- **And**: Contains error message

#### Test 10: Fallback Behavior
- **Given**: CRM API call fails
- **When**: JavaScript attempts to fetch progress
- **Then**: Gracefully falls back to localStorage
- **And**: User experience is not broken

### Evidence to Capture

For each test case:
1. **API Response**: Raw JSON from `/progress/aggregate` endpoint
2. **Screenshot**: Visual of progress bar on page
3. **Browser Console**: Any JavaScript logs/errors
4. **Timing Data**: Response times for performance validation
5. **HTML Inspection**: Verify data attributes and DOM structure

### Success Criteria (from Issue #210)
- [x] API layer exposes aggregated progress for pathway/course views
- [x] Includes started/completed counts and percentages
- [x] Front-end renders accurate progress bars for authenticated users
- [x] Anonymous users fall back to local storage without errors
- [ ] Automated/manual regression coverage (this verification plan)
- [ ] Evidence stored under `verification-output/issue-210/`
- [ ] Performance within SLA (no endpoint >500ms p95)

### Test Execution Commands

```bash
# Run automated API tests
./tests/test-progress-aggregate.sh

# Deploy Lambda (if needed)
npm run build
npm run deploy:aws

# Manual browser testing checklist
# 1. Test authenticated pathway: https://hedgehog.cloud/learn/pathways/getting-started
# 2. Test authenticated course: https://hedgehog.cloud/learn/courses/[course-slug]
# 3. Test anonymous (incognito): Same URLs without login
# 4. Check browser console for errors
# 5. Verify progress bar percentage calculation
```

### Notes
- Existing `/progress/read` endpoint remains unchanged (used by my-learning page)
- New `/progress/aggregate` endpoint is optimized for single pathway/course view
- Maintains backward compatibility with localStorage for anonymous users
- No breaking changes to existing functionality
