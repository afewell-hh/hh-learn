# Issue #305: Phase 5 - HubSpot CRM Sync Implementation Plan

## Objective
Enhance CRM sync to automatically create contacts and track enrollment/completion milestones in dedicated HubSpot contact properties.

## Current State (from codebase analysis)

### Existing Contact Properties
- `hhl_progress_state` - JSON blob with full progress data
- `hhl_progress_updated_at` - Last update timestamp
- `hhl_progress_summary` - Human-readable progress summary
- `hhl_last_viewed_type`, `hhl_last_viewed_slug`, `hhl_last_viewed_at` - Last viewed content

### Current Behavior
- Contact lookup by email or contactId
- **Throws error** if contact not found (line 751 in index.ts)
- Updates progress via JSON blob in `hhl_progress_state`
- Returns fallback mode on CRM errors (doesn't block UX)

## Phase 5 Requirements

### 1. New Contact Properties

Create four new contact properties in HubSpot:

| Property Name | Type | Description |
|--------------|------|-------------|
| `hhl_enrolled_courses` | Multi-line text | Semicolon-delimited list of enrolled course slugs |
| `hhl_completed_courses` | Multi-line text | Semicolon-delimited list of completed course slugs |
| `hhl_total_progress` | Number | Total count of completed modules across all courses |
| `hhl_last_activity` | Date | Last progress activity timestamp |

**Decision**: Use semicolon-delimited text fields instead of multi-select because:
- Easier to update programmatically
- No need to pre-define enumeration values
- Can be split/parsed easily in workflows and reports

### 2. Contact Auto-Creation

Modify `persistViaContactProperties` function to:
1. Attempt contact lookup by email
2. **If not found**: Create new contact with minimal required properties:
   ```typescript
   {
     email: string,
     hs_lead_status: 'LEARNER', // Custom lifecycle stage
     lifecyclestage: 'lead',
     hhl_enrolled_courses: '',
     hhl_completed_courses: '',
     hhl_total_progress: 0,
     hhl_last_activity: new Date().toISOString()
   }
   ```
3. Continue with normal progress update flow

### 3. Milestone Property Updates

Update these properties on each progress event:

**On Enrollment Event** (`learning_course_enrolled`):
- Add course slug to `hhl_enrolled_courses` (if not already present)
- Update `hhl_last_activity`

**On Module Completion** (`learning_module_completed`):
- Increment `hhl_total_progress`
- Update `hhl_last_activity`

**On Course Completion** (calculated):
- Add course slug to `hhl_completed_courses` (if not already present)
- Update `hhl_last_activity`

**On Any Event**:
- Update `hhl_last_activity` to current timestamp

### 4. Error Handling Requirements

Ensure CRM failures **never block user experience**:

✅ **Already Implemented**:
- Track function catches all errors and returns fallback mode (line 620-636)
- User continues with localStorage-based progress

**New Requirements**:
- Log contact creation attempts (success and failure)
- Gracefully handle partial failures (e.g., property updates fail but state updates succeed)
- Return structured error context for debugging

## Implementation Steps

### Step 1: Create HubSpot Contact Properties

Use HubSpot UI to create the four properties:
- Navigate to Settings → Properties → Contact Properties
- Create property group "Learning Milestones" (or use existing "Learning Program Properties")
- Create each property with correct field type

**Alternative**: Create via API (requires script)

### Step 2: Update Lambda Code

Modify `/home/ubuntu/afewell-hh/hh-learn/src/api/lambda/index.ts`:

#### 2a. Add Contact Creation Function

```typescript
/**
 * Create a new contact in HubSpot with minimal learning profile
 * Returns contactId on success, null on failure
 */
async function createLearningContact(
  hubspot: any,
  email: string
): Promise<string | null> {
  try {
    const dateOnly = new Date().toISOString().split('T')[0];

    const response = await hubspot.crm.contacts.basicApi.create({
      properties: {
        email,
        hs_lead_status: 'LEARNER',
        lifecyclestage: 'lead',
        hhl_enrolled_courses: '',
        hhl_completed_courses: '',
        hhl_total_progress: '0',
        hhl_last_activity: dateOnly,
        hhl_progress_state: '{}',
        hhl_progress_summary: 'No progress yet',
      },
    });

    console.log('[CRM] Created new learning contact:', email, 'contactId:', response.id);
    return response.id;
  } catch (err: any) {
    console.error('[CRM] Failed to create contact:', email, err.message || err);
    return null;
  }
}
```

#### 2b. Modify Contact Lookup Logic

Replace lines 730-758 in `persistViaContactProperties`:

```typescript
// Find contact by email or ID
let contactId: string | null = null;

if (input.contactIdentifier?.contactId) {
  contactId = input.contactIdentifier.contactId;
} else if (input.contactIdentifier?.email) {
  const email = input.contactIdentifier.email;

  // Look up contact by email
  const searchResponse = await hubspot.crm.contacts.searchApi.doSearch({
    filterGroups: [{
      filters: [{
        propertyName: 'email',
        operator: 'EQ',
        value: email,
      }],
    }],
    properties: ['hhl_progress_state', 'hhl_enrolled_courses', 'hhl_completed_courses', 'hhl_total_progress'],
    limit: 1,
  });

  if (searchResponse.results && searchResponse.results.length > 0) {
    contactId = searchResponse.results[0].id;
  } else {
    // Contact not found - create new contact (Phase 5)
    console.log('[CRM] Contact not found, creating new contact:', email);
    contactId = await createLearningContact(hubspot, email);

    if (!contactId) {
      // Contact creation failed - don't block user, just log
      throw new Error(`Failed to create contact for email: ${email}`);
    }
  }
} else {
  throw new Error('No contact identifier provided');
}

if (!contactId) {
  throw new Error('Unable to resolve contact');
}
```

#### 2c. Add Milestone Property Update Function

```typescript
/**
 * Calculate and return milestone property updates
 * Returns delta updates for enrolled/completed courses and total progress
 */
function calculateMilestoneUpdates(
  progressState: any,
  existingEnrolled: string,
  existingCompleted: string,
  existingTotalProgress: number
): {
  hhl_enrolled_courses: string;
  hhl_completed_courses: string;
  hhl_total_progress: string;
} {
  const enrolledCourses = new Set<string>(
    existingEnrolled ? existingEnrolled.split(';').filter(Boolean) : []
  );
  const completedCourses = new Set<string>(
    existingCompleted ? existingCompleted.split(';').filter(Boolean) : []
  );
  let totalModulesCompleted = 0;

  // Parse progress state and extract enrolled/completed courses
  for (const [key, value] of Object.entries(progressState)) {
    if (key === 'courses') {
      // Standalone courses
      const courses = value as any;
      for (const [courseSlug, courseData] of Object.entries(courses)) {
        const course = courseData as any;
        if (course.enrolled) enrolledCourses.add(courseSlug);
        if (course.completed) completedCourses.add(courseSlug);

        // Count completed modules
        const modules = Object.values(course.modules || {}) as any[];
        totalModulesCompleted += modules.filter(m => m.completed).length;
      }
    } else {
      // Pathway
      const pathway = value as any;
      if (pathway.courses) {
        // Hierarchical model
        for (const [courseSlug, courseData] of Object.entries(pathway.courses)) {
          const course = courseData as any;
          if (course.enrolled) enrolledCourses.add(courseSlug);
          if (course.completed) completedCourses.add(courseSlug);

          const modules = Object.values(course.modules || {}) as any[];
          totalModulesCompleted += modules.filter(m => m.completed).length;
        }
      } else if (pathway.modules) {
        // Flat model - count modules
        const modules = Object.values(pathway.modules || {}) as any[];
        totalModulesCompleted += modules.filter(m => m.completed).length;
      }
    }
  }

  return {
    hhl_enrolled_courses: Array.from(enrolledCourses).sort().join(';'),
    hhl_completed_courses: Array.from(completedCourses).sort().join(';'),
    hhl_total_progress: totalModulesCompleted.toString(),
  };
}
```

#### 2d. Update Property Write Logic

Modify the property update section (around line 1028-1048):

```typescript
// Read current milestone properties
const contact = await hubspot.crm.contacts.basicApi.getById(contactId, [
  'hhl_progress_state',
  'hhl_enrolled_courses',
  'hhl_completed_courses',
  'hhl_total_progress',
]);

const existingEnrolled = contact.properties.hhl_enrolled_courses || '';
const existingCompleted = contact.properties.hhl_completed_courses || '';
const existingTotalProgress = parseInt(contact.properties.hhl_total_progress || '0', 10);

// ... existing progress state merge logic ...

// Calculate milestone updates
const milestoneUpdates = calculateMilestoneUpdates(
  progressState,
  existingEnrolled,
  existingCompleted,
  existingTotalProgress
);

// Base properties to update
const props: Record<string, any> = {
  hhl_progress_state: JSON.stringify(progressState),
  hhl_progress_updated_at: dateOnly,
  hhl_progress_summary: generateProgressSummary(progressState),
  ...milestoneUpdates,
  hhl_last_activity: dateOnly, // Always update last activity
};

// ... rest of property update logic ...
```

### Step 3: Update Environment Variables

No new environment variables needed. Uses existing:
- `ENABLE_CRM_PROGRESS=true`
- `PROGRESS_BACKEND=properties`
- `HUBSPOT_PROJECT_ACCESS_TOKEN`

### Step 4: Deploy and Test

```bash
# Build Lambda
npm run build:lambda

# Deploy to AWS
npx serverless deploy --stage dev

# Test with authenticated user
# 1. Enroll in a course
# 2. Complete a module
# 3. Check contact properties in HubSpot
```

### Step 5: Verification

Check HubSpot contact record:
- `hhl_enrolled_courses` contains course slugs
- `hhl_completed_courses` updates when course completes
- `hhl_total_progress` increments with each module completion
- `hhl_last_activity` updates on every event
- Contact auto-created on first event if not exists

## Error Handling Strategy

### Scenario 1: Contact Lookup Fails
**Action**: Attempt to create contact
**Fallback**: If creation fails, throw error → Lambda returns fallback mode
**Result**: User continues with localStorage, CRM not updated

### Scenario 2: Property Update Fails
**Action**: Log error, return fallback mode
**Result**: User continues, CRM not updated

### Scenario 3: Partial Update Success
**Action**: Log warning, return success if `hhl_progress_state` updated
**Result**: User sees success, milestone properties may be stale

### Scenario 4: HubSpot API Rate Limit
**Action**: Lambda catches error, returns fallback mode
**Result**: User continues, can retry later

**All scenarios preserve user experience** - no blocking errors shown to user.

## Testing Plan

### Unit Tests (Future)
- Test contact creation logic
- Test milestone calculation
- Test error handling paths

### Manual Testing
1. **New User Registration**:
   - Send event with email not in CRM
   - Verify contact created with correct properties

2. **Existing User Enrollment**:
   - Enroll in course
   - Verify `hhl_enrolled_courses` updated

3. **Module Completion**:
   - Complete module
   - Verify `hhl_total_progress` incremented
   - Verify `hhl_last_activity` updated

4. **Course Completion**:
   - Complete all modules in course
   - Verify course added to `hhl_completed_courses`

5. **Error Scenario**:
   - Temporarily disable HubSpot API token
   - Verify fallback mode returned (user not blocked)

## Acceptance Criteria

- [x] Four new contact properties created in HubSpot
- [ ] Contact auto-creation implemented and tested
- [ ] Milestone properties update correctly on enrollment/completion
- [ ] `hhl_total_progress` increments with each module completion
- [ ] `hhl_last_activity` updates on every event
- [ ] CRM failures return fallback mode (don't block user)
- [ ] All changes logged for debugging
- [ ] Deployed to dev environment
- [ ] Manually tested with real HubSpot account
- [ ] Documentation updated

## Rollout Plan

### Phase 5.1: Create Properties (Manual)
- Create properties in HubSpot UI
- Verify properties visible in contact records

### Phase 5.2: Deploy Lambda Changes
- Merge PR
- Deploy to dev
- Monitor CloudWatch logs

### Phase 5.3: Validation
- Test new user registration
- Test existing user progress updates
- Verify CRM data accuracy

### Phase 5.4: Production Deploy
- Deploy to prod
- Monitor error rates
- Validate with real users

## Open Questions

1. **Q**: Should we backfill existing contacts with milestone properties?
   **A**: Deferred - users will naturally populate as they interact

2. **Q**: What if a course is removed from curriculum?
   **A**: Leave in enrolled/completed lists - historical record

3. **Q**: Rate limiting strategy for contact creation?
   **A**: HubSpot default rate limits apply - Lambda retries handled by SDK

## References
- Issue #305: https://github.com/afewell-hh/hh-learn/issues/305
- Current implementation: `src/api/lambda/index.ts` (lines 730-1049)
- Phase 2 docs: `docs/phase2-contact-properties.md`
