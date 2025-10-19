# Migration Guide: Hierarchical Progress Model (Issue #215)

**Created:** 2025-10-19
**Status:** Ready for Staging Migration
**Related:** Issue #215, `docs/issue-215-hierarchical-progress-model.md`

## Overview

This guide provides step-by-step instructions for migrating existing learner progress data from the flat pathway→module model to the new hierarchical pathway→course→module model.

## Prerequisites

- ✅ All code changes deployed to staging environment
- ✅ Migration scripts compiled (`npm run build`)
- ✅ HubSpot Project Access Token configured in environment
- ✅ Backup of production database (if applicable)
- ✅ Coordinator identified for schema change communication

## Migration Steps

### Phase 1: Pre-Migration Validation (Staging)

**Duration:** ~10 minutes

1. **Verify environment configuration:**
   ```bash
   # Ensure HubSpot token is set
   echo $HUBSPOT_PROJECT_ACCESS_TOKEN | cut -c1-10
   # Should output: pat-na1-XX

   # Verify build is current
   npm run build
   ```

2. **Test migration with a single contact:**
   ```bash
   # Option 1: Test with specific contact ID
   node dist/scripts/migrate-progress-to-hierarchical.js --dry-run --contact-id=YOUR_TEST_CONTACT_ID

   # Option 2: Test with test user email
   # First, get contact ID from HubSpot CRM or via API
   ```

3. **Review dry-run output:**
   ```bash
   # Check snapshots directory
   ls -la verification-output/issue-215/snapshots/

   # Verify validation passed
   cat verification-output/issue-215/validation-report.json | jq '.[] | select(.success == false)'
   # Should return empty if all validations passed
   ```

### Phase 2: Staging Environment Migration

**Duration:** ~5-15 minutes (depends on contact count)

1. **Run migration in dry-run mode (all contacts):**
   ```bash
   node dist/scripts/migrate-progress-to-hierarchical.js --dry-run --batch-size=50
   ```

2. **Review migration summary:**
   ```bash
   cat verification-output/issue-215/migration-summary.json
   ```

   **Expected metrics:**
   - `validation_errors: 0`
   - `failed: 0`
   - `migrated + skipped = total_contacts`

3. **Spot-check snapshots:**
   ```bash
   # Compare before/after for a few contacts
   diff \
     <(cat verification-output/issue-215/snapshots/contact-123-before.json | jq .) \
     <(cat verification-output/issue-215/snapshots/contact-123-after.json | jq .)
   ```

4. **Run live migration (staging only):**
   ```bash
   node dist/scripts/migrate-progress-to-hierarchical.js --batch-size=50
   ```

5. **Verify API responses:**
   ```bash
   # Test /progress/read endpoint
   curl "https://YOUR_LAMBDA_URL/progress/read?email=test@example.com" | jq .

   # Test /progress/aggregate endpoint (hierarchical pathway)
   curl "https://YOUR_LAMBDA_URL/progress/aggregate?email=test@example.com&type=pathway&slug=authoring-foundations" | jq .

   # Test /enrollments/list endpoint
   curl "https://YOUR_LAMBDA_URL/enrollments/list?email=test@example.com" | jq .
   ```

6. **Test frontend integration:**
   - Navigate to a hierarchical pathway page (e.g., `/learn/authoring-foundations`)
   - Verify progress bars display correctly
   - Check course-level progress indicators
   - Confirm module completion tracking works

### Phase 3: Production Migration (After Staging Validation)

**Duration:** ~10-30 minutes (depends on production contact count)

**⚠️ IMPORTANT: Only proceed after successful staging validation and stakeholder approval.**

1. **Create production backup (if applicable):**
   ```bash
   # Save current state of all contacts with progress
   node dist/scripts/backup-production-progress.js  # (If implemented)
   ```

2. **Communicate migration window:**
   - Notify content ops team
   - Post maintenance notice if needed (migration runs in background)
   - Migration does NOT require downtime

3. **Run migration with monitoring:**
   ```bash
   # Run migration with logging
   node dist/scripts/migrate-progress-to-hierarchical.js --batch-size=50 2>&1 | tee migration-$(date +%Y%m%d-%H%M%S).log
   ```

4. **Monitor progress:**
   - Watch console output for validation errors
   - Check CloudWatch logs for Lambda errors (if applicable)
   - Monitor HubSpot API rate limits

5. **Post-migration verification:**
   ```bash
   # Verify migration summary
   cat verification-output/issue-215/migration-summary.json | jq .

   # Check for validation errors
   cat verification-output/issue-215/validation-report.json | jq '[.[] | select(.success == false)] | length'
   # Should output: 0
   ```

6. **Spot-check production data:**
   - Select 5-10 random contacts
   - Compare before/after snapshots
   - Verify CRM progress state matches expectations

### Phase 4: Post-Migration Validation

**Duration:** ~15 minutes

1. **Functional testing:**
   - [ ] Enroll in a hierarchical pathway
   - [ ] Start a module within a course
   - [ ] Complete a module
   - [ ] Verify progress summary updates correctly
   - [ ] Check "My Learning" dashboard shows correct enrollments
   - [ ] Test resume/continue functionality

2. **API testing:**
   ```bash
   # Test all progress endpoints
   ./scripts/test-progress-api.sh  # (Create this script with test cases)
   ```

3. **Performance testing:**
   - Measure API response times before/after
   - Verify Lambda cold starts are acceptable
   - Check JSON payload sizes are within limits

4. **Analytics check:**
   - Review HubSpot contact properties
   - Verify `hhl_progress_summary` reflects hierarchy
   - Check `hhl_progress_updated_at` timestamps

## Rollback Plan

If critical issues are discovered post-migration:

### Option 1: Automated Rollback (Recommended)

```bash
# Restore all contacts from snapshots
node dist/scripts/rollback-progress-migration.js

# Verify rollback summary
cat verification-output/issue-215/rollback-summary.json
```

### Option 2: Manual Rollback (Single Contact)

```bash
# Restore specific contact
node dist/scripts/rollback-progress-migration.js --contact-id=123

# Verify in HubSpot CRM
# Navigate to contact and check hhl_progress_state property
```

### Option 3: Full Revert (Last Resort)

1. Deploy previous Lambda code version
2. Rollback database changes (if applicable)
3. Restore all contacts from snapshots
4. Communicate revert to stakeholders

**Rollback criteria:**
- ❌ Validation errors > 0
- ❌ API error rate > 5%
- ❌ User-reported data loss
- ❌ Critical frontend bugs blocking learning
- ❌ Performance degradation > 50%

## Monitoring & Success Metrics

### During Migration

- **Console output:** Real-time progress and validation results
- **Batch completion rate:** Should be 100%
- **API error logs:** Monitor for unexpected failures
- **Validation pass rate:** Must be 100%

### Post-Migration (First 24 Hours)

- **API response times:** Should be similar to pre-migration baseline
- **Lambda invocation errors:** Should be < 0.1%
- **User-reported issues:** Track via support tickets
- **Progress tracking accuracy:** Spot-check 10+ users

### Success Criteria

✅ **Migration successful if:**
- Zero data loss (all module progress preserved)
- Zero validation errors
- Zero timestamp drift
- API response times within 10% of baseline
- No critical user-reported issues within 24 hours
- Frontend displays progress correctly for both flat and hierarchical models

## Troubleshooting

### Issue: Validation Errors During Migration

**Symptoms:** `validation_errors > 0` in migration summary

**Solution:**
1. Review `validation-report.json` for specific errors
2. Check affected contact snapshots
3. Identify pattern (e.g., specific pathway, malformed data)
4. Fix root cause or exclude affected contacts
5. Re-run migration for failed contacts only

### Issue: HubSpot API Rate Limit Errors

**Symptoms:** `429 Too Many Requests` errors

**Solution:**
1. Reduce `--batch-size` (try 25 or 10)
2. Add delay between batches (modify script)
3. Resume migration from `after` cursor

### Issue: Lambda Timeouts

**Symptoms:** `/events/track` endpoint returns 504 Gateway Timeout

**Solution:**
1. Check Lambda function timeout settings (increase to 30s)
2. Review CloudWatch logs for cold start duration
3. Optimize aggregation functions if needed

### Issue: Frontend Progress Not Displaying

**Symptoms:** Progress bars show 0% despite completed modules

**Solution:**
1. Verify template code is updated to handle hierarchical model
2. Check browser console for JavaScript errors
3. Clear localStorage and cookies
4. Verify API response includes expected structure

### Issue: Snapshot File Not Found During Rollback

**Symptoms:** Rollback script reports "No snapshot found"

**Solution:**
1. Verify migration script was run with snapshots enabled
2. Check `verification-output/issue-215/snapshots/` directory
3. If snapshots missing, rollback not possible (investigate alternative recovery)

## Communication Plan

### Pre-Migration

**Audience:** Content ops, engineering team
**Message:**
> "We're upgrading the progress tracking system to support pathway→course→module hierarchies. Migration scheduled for [DATE] at [TIME]. No downtime expected. Snapshots will be created for rollback safety."

### During Migration

**Audience:** Engineering team (Slack channel)
**Updates:**
- Migration started
- Batch X of Y complete
- Any errors encountered
- Migration complete

### Post-Migration

**Audience:** All stakeholders
**Message:**
> "Migration complete. X contacts migrated successfully. Zero data loss. New hierarchical progress model is live. Report any issues to #engineering."

## Evidence & Artifacts

All migration artifacts are stored in `verification-output/issue-215/`:

```
verification-output/issue-215/
├── migration-summary.json          # Overall stats
├── validation-report.json          # Per-contact validation results
├── rollback-summary.json           # Rollback results (if executed)
└── snapshots/
    ├── contact-123-before.json     # Original state
    ├── contact-123-after.json      # Migrated state
    ├── contact-456-before.json
    └── contact-456-after.json
```

**Retention policy:** Keep snapshots for 30 days post-migration for rollback safety.

## Related Documentation

- **Design Doc:** `docs/issue-215-hierarchical-progress-model.md`
- **Type Definitions:** `src/shared/types.ts`
- **Lambda Code:** `src/api/lambda/index.ts`
- **Migration Script:** `src/scripts/migrate-progress-to-hierarchical.ts`
- **Rollback Script:** `src/scripts/rollback-progress-migration.ts`
- **HubSpot Guide:** `docs/hubspot-project-apps-agent-guide.md` (Issue #191)

## FAQs

**Q: Will this migration cause downtime?**
A: No. The migration runs in the background and updates contact properties. The Lambda API continues to function during migration.

**Q: What happens to users actively learning during migration?**
A: Their progress continues to be tracked. The migration script handles concurrent updates gracefully by reading current state before transforming.

**Q: Can we migrate specific pathways only?**
A: Yes. The migration script automatically detects which pathways use the hierarchical model (based on `content/pathways/*.json` files) and only transforms those.

**Q: What if a pathway has no enrollments?**
A: The migration script skips contacts with no progress data. Empty pathways are not migrated.

**Q: How long does migration take per contact?**
A: ~0.5-1 second per contact (includes CRM API read, transform, validate, write). Batch processing reduces total duration.

**Q: Is this migration reversible?**
A: Yes, via the rollback script. Snapshots are created before any changes are persisted to CRM.

**Q: What if new pathways are added after migration?**
A: New pathways will automatically use the correct model (hierarchical or flat) based on their `content/*.json` definition. No re-migration needed.

---

## Approval Checklist

Before running production migration:

- [ ] All Phase 1 validations passed (staging dry-run)
- [ ] All Phase 2 validations passed (staging live migration)
- [ ] Frontend testing complete (hierarchical pathways display correctly)
- [ ] API testing complete (all endpoints return expected data)
- [ ] Stakeholder approval received
- [ ] Communication plan executed
- [ ] Rollback script tested and verified
- [ ] Monitoring dashboards configured
- [ ] On-call engineer identified for migration window

**Approved by:** _________________  **Date:** _______

**Migration executed by:** _________________  **Date:** _______

**Post-migration verified by:** _________________  **Date:** _______
