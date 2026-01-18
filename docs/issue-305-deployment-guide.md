# Issue #305 Deployment Guide
## Phase 5: HubSpot CRM Sync (Registration + Milestones)

This guide covers deploying the Phase 5 CRM sync enhancements to production.

## Overview

Phase 5 adds:
1. **Automatic contact creation** - Creates contacts in HubSpot if they don't exist
2. **Milestone properties** - Simpler properties for enrollment/completion tracking
3. **Enhanced error handling** - Graceful fallbacks when CRM operations fail

## Prerequisites

- [ ] HubSpot Private App token with scopes:
  - `crm.objects.contacts.read`
  - `crm.objects.contacts.write`
  - `crm.schemas.contacts.write` (for property creation)
- [ ] AWS credentials configured
- [ ] Serverless Framework installed
- [ ] Node.js 20.x

## Deployment Steps

### Step 1: Create HubSpot Contact Properties

Run the property creation script:

```bash
cd /home/ubuntu/afewell-hh/hh-learn
node scripts/create-crm-properties.js
```

**Expected Output:**
```
=== HubSpot CRM Properties Setup (Issue #305) ===

Creating property group: Learning Milestones...
✓ Property group created successfully

--- Creating Properties ---

Creating property: HHL Enrolled Courses (hhl_enrolled_courses)...
✓ Property hhl_enrolled_courses created successfully
Creating property: HHL Completed Courses (hhl_completed_courses)...
✓ Property hhl_completed_courses created successfully
Creating property: HHL Total Progress (hhl_total_progress)...
✓ Property hhl_total_progress created successfully
Creating property: HHL Last Activity (hhl_last_activity)...
✓ Property hhl_last_activity created successfully

✓ All properties created successfully!
```

**Verify in HubSpot UI:**
1. Log into HubSpot account
2. Navigate to **Settings** → **Properties** → **Contact Properties**
3. Search for "Learning Milestones" group
4. Confirm all 4 properties exist:
   - HHL Enrolled Courses
   - HHL Completed Courses
   - HHL Total Progress
   - HHL Last Activity

### Step 2: Build Lambda Code

```bash
npm run build
```

**Verify Build Success:**
- No TypeScript compilation errors
- `dist-lambda/` directory populated

### Step 3: Deploy to AWS

#### Development Environment

```bash
npm run deploy:aws
```

**Expected Output:**
```
✔ Service deployed to stack hedgehog-learn-dev
endpoints:
  GET - https://XXXXXX.execute-api.us-east-1.amazonaws.com/auth/login
  ...
  POST - https://XXXXXX.execute-api.us-east-1.amazonaws.com/events/track
functions:
  api: hedgehog-learn-dev-api
```

**Verify Deployment:**
```bash
# Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name hedgehog-learn-dev-api \
  --query 'Environment.Variables' \
  --output json
```

Confirm these variables are set:
- `ENABLE_CRM_PROGRESS=true`
- `PROGRESS_BACKEND=properties`
- `HUBSPOT_PRIVATE_APP_TOKEN=(set)`

#### Production Environment

```bash
# Set production stage
export APP_STAGE=prod

# Deploy
npm run deploy:aws
```

### Step 4: Verify Deployment

#### Health Check

```bash
curl https://YOUR_API_URL/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-18T17:30:00.000Z"
}
```

#### CloudWatch Logs

```bash
# Tail Lambda logs
npx serverless logs -f api --stage dev --tail
```

Look for initialization logs:
```
[CRM] Created new learning contact: user@example.com contactId: 12345
Track event (persisted via properties) learning_module_started { email: 'user@example.com' }
```

## Testing

### Test 1: New Contact Auto-Creation

**Scenario:** Send progress event for a new email not in HubSpot CRM

**Steps:**
1. Find an email address that does NOT exist in HubSpot
2. Send a tracking event:

```bash
curl -X POST https://YOUR_API_URL/events/track \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "contactIdentifier": {
      "email": "newuser@example.com"
    },
    "payload": {
      "module_slug": "intro-to-hedgehog",
      "course_slug": "getting-started-101",
      "pathway_slug": "hedgehog-fundamentals",
      "ts": "2026-01-18T17:30:00.000Z"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "persisted",
  "mode": "authenticated",
  "backend": "properties",
  "contactId": "12345"
}
```

**Verify in HubSpot:**
1. Search for contact by email: `newuser@example.com`
2. Contact should exist with properties:
   - Email: `newuser@example.com`
   - Lifecycle Stage: `lead`
   - HHL Enrolled Courses: `getting-started-101`
   - HHL Completed Courses: `` (empty)
   - HHL Total Progress: `0`
   - HHL Last Activity: `2026-01-18`
   - HHL Progress State: (JSON with module started)

**CloudWatch Logs Should Show:**
```
[CRM] Contact not found, creating new contact: newuser@example.com
[CRM] Created new learning contact: newuser@example.com contactId: 12345
Track event (persisted via properties) learning_module_started { email: 'newuser@example.com' }
```

### Test 2: Existing Contact Enrollment

**Scenario:** Enroll an existing contact in a course

**Steps:**
1. Use an existing contact email from HubSpot
2. Send course enrollment event:

```bash
curl -X POST https://YOUR_API_URL/events/track \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_course_enrolled",
    "contactIdentifier": {
      "email": "existing@example.com"
    },
    "course_slug": "advanced-networking",
    "pathway_slug": "network-automation",
    "enrollment_source": "catalog_cta",
    "payload": {
      "ts": "2026-01-18T17:35:00.000Z"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "persisted",
  "mode": "authenticated",
  "backend": "properties"
}
```

**Verify in HubSpot:**
1. Open contact record
2. Check properties:
   - HHL Enrolled Courses: (contains `advanced-networking`)
   - HHL Last Activity: `2026-01-18`

### Test 3: Module Completion & Progress Increment

**Scenario:** Complete a module and verify total progress increments

**Steps:**
1. Send module completion event:

```bash
curl -X POST https://YOUR_API_URL/events/track \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_completed",
    "contactIdentifier": {
      "email": "existing@example.com"
    },
    "payload": {
      "module_slug": "intro-to-networking",
      "course_slug": "advanced-networking",
      "pathway_slug": "network-automation",
      "ts": "2026-01-18T17:40:00.000Z"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "persisted",
  "mode": "authenticated",
  "backend": "properties"
}
```

**Verify in HubSpot:**
1. Check HHL Total Progress: (incremented by 1)
2. Check HHL Last Activity: `2026-01-18`
3. If all modules in course completed:
   - HHL Completed Courses: (contains `advanced-networking`)

### Test 4: Course Completion

**Scenario:** Complete all modules in a course and verify course completion tracking

**Pre-condition:** Send completion events for all remaining modules in the course

**Verify in HubSpot:**
- HHL Completed Courses: `advanced-networking;getting-started-101` (semicolon-delimited)
- HHL Total Progress: (total count of all completed modules)

### Test 5: Error Handling - HubSpot API Failure

**Scenario:** Verify graceful fallback when HubSpot API is unavailable

**Steps:**
1. Temporarily invalidate the HubSpot token:

```bash
# Set invalid token in Lambda environment (NOT RECOMMENDED FOR PROD)
# OR simulate API failure by rate-limiting
```

2. Send tracking event
3. **Expected Response:**
```json
{
  "status": "logged",
  "mode": "fallback",
  "error": "Contact not found for email: user@example.com"
}
```

**Verify:**
- User experience NOT blocked (200 OK response)
- Error logged in CloudWatch
- Frontend continues with localStorage-based progress

### Test 6: Read Progress API

**Scenario:** Verify milestone properties returned in progress read endpoint

```bash
curl https://YOUR_API_URL/progress/read?email=existing@example.com
```

**Expected Response:**
```json
{
  "mode": "authenticated",
  "progress": {
    "network-automation": {
      "enrolled": true,
      "enrolled_at": "2026-01-18T17:35:00.000Z",
      "courses": {
        "advanced-networking": {
          "enrolled": true,
          "completed": true,
          "modules": { ... }
        }
      }
    }
  },
  "updated_at": "2026-01-18",
  "summary": "network-automation: 1/1 courses"
}
```

## Rollback Plan

If issues arise in production:

### Option 1: Disable CRM Sync

```bash
# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name hedgehog-learn-prod-api \
  --environment "Variables={ENABLE_CRM_PROGRESS=false,...}"
```

**Effect:**
- Progress tracking falls back to anonymous/localStorage mode
- No CRM writes
- Users continue uninterrupted

### Option 2: Revert Lambda Code

```bash
# Revert to previous commit
git revert HEAD

# Rebuild
npm run build

# Redeploy
npm run deploy:aws
```

### Option 3: Delete New Properties (NOT RECOMMENDED)

Only do this if properties cause schema conflicts:

1. Navigate to HubSpot Settings → Properties
2. Delete the 4 new properties
3. **Note:** This will lose milestone data (progress_state JSON is unaffected)

## Monitoring

### CloudWatch Metrics

Monitor these metrics post-deployment:

1. **Lambda Errors**
   - Alarm threshold: >5 errors in 1 minute
   - Dashboard: AWS CloudWatch → Alarms

2. **API Latency**
   - Threshold: >1 second average over 5 minutes
   - Check: `/events/track` endpoint latency

3. **Contact Creation Rate**
   - Log filter: `[CRM] Created new learning contact`
   - Expected: Low volume (new users only)

### HubSpot Property Validation

Weekly spot-checks:
1. Sample 10 random contacts with HHL properties
2. Verify:
   - `hhl_enrolled_courses` matches `hhl_progress_state` JSON
   - `hhl_completed_courses` ⊆ `hhl_enrolled_courses`
   - `hhl_total_progress` matches count of completed modules in JSON

### Error Logs

Search CloudWatch for:
```
[CRM] Failed to create contact
Failed to persist event to CRM
Validation failure
```

Investigate any patterns or spikes.

## Troubleshooting

### Issue: "Contact creation failed"

**Symptoms:**
- CloudWatch logs show `[CRM] Failed to create contact`
- Response: `{ "status": "logged", "mode": "fallback" }`

**Possible Causes:**
1. Invalid HubSpot Private App token
2. Missing `crm.objects.contacts.write` scope
3. Email format validation failure
4. HubSpot API rate limit

**Resolution:**
1. Verify token scopes in HubSpot Settings → Integrations → Private Apps
2. Check HubSpot API status page
3. Review CloudWatch logs for specific error message

### Issue: Milestone properties not updating

**Symptoms:**
- `hhl_total_progress` stays at 0
- `hhl_enrolled_courses` empty despite enrollments

**Possible Causes:**
1. Properties not created in HubSpot
2. Typo in property name
3. Lambda code not deployed

**Resolution:**
1. Run `node scripts/create-crm-properties.js` again
2. Verify Lambda deployment: `aws lambda get-function --function-name hedgehog-learn-dev-api`
3. Check Lambda logs for property update errors

### Issue: Duplicate courses in enrolled/completed lists

**Symptoms:**
- `hhl_enrolled_courses: "course-1;course-1;course-2"`

**Cause:**
- Bug in `calculateMilestoneUpdates` Set logic

**Resolution:**
- Already handled by `Set` deduplication in code
- If still occurring, file a bug report

## Success Criteria

Phase 5 deployment is successful when:

- [x] All 4 new properties created in HubSpot
- [ ] New contacts auto-created on first event
- [ ] `hhl_enrolled_courses` populates correctly
- [ ] `hhl_completed_courses` updates when courses complete
- [ ] `hhl_total_progress` increments with module completions
- [ ] `hhl_last_activity` updates on every event
- [ ] CRM failures return fallback mode (no user-facing errors)
- [ ] CloudWatch logs show successful contact creations
- [ ] No increase in Lambda error rate
- [ ] API latency remains <500ms p95

## Next Steps

After successful Phase 5 deployment:

1. **Analytics Dashboard** (Future)
   - Create HubSpot custom reports using milestone properties
   - Track enrollment trends, completion rates

2. **Property Backfill** (Future)
   - Script to populate milestone properties for existing contacts
   - Based on `hhl_progress_state` JSON

3. **Lifecycle Automation** (Future)
   - Workflows triggered by completion milestones
   - Email campaigns based on enrollment/completion

4. **Phase 6** (If needed)
   - Additional milestone properties (badges, certificates)
   - Course-level timestamps and metadata

## References

- Issue #305: https://github.com/afewell-hh/hh-learn/issues/305
- Implementation Plan: `docs/implementation-plan-issue-305.md`
- HubSpot CRM API: https://developers.hubspot.com/docs/api/crm/contacts
- Lambda Source: `src/api/lambda/index.ts` (lines 726-1180)
