# Sync Script Features

## Overview

The `npm run sync:content` script syncs learning modules from Git (markdown) to HubSpot HubDB with automatic retry and rate limit handling.

## Resilience Features

### Exponential Backoff Retry

**Problem**: HubSpot API can hit rate limits or Cloudflare protection blocks

**Solution**: Automatic retry with exponential backoff

**How it works**:
- Attempt 1: Immediate
- Attempt 2: Wait 2 seconds, retry
- Attempt 3: Wait 4 seconds, retry
- Attempt 4: Wait 8 seconds, retry
- Max retries: 3 (4 total attempts)
- Max wait per operation: 14 seconds

**Triggers**:
- HTTP 429 (rate limit)
- HTTP 403 with Cloudflare block page
- Errors containing "rate limit" message

### Inter-Module Delays

**Problem**: Rapid API calls trigger Cloudflare rate limiting

**Solution**: 1.5 second delay between processing each module

**Benefit**: Prevents rate limits during normal operation

### Smart Error Handling

**Cloudflare blocks**:
```
✗ Failed to sync module-name: Cloudflare block (will retry on next run)
```
- Graceful degradation
- Doesn't crash the script
- Other modules still processed
- Table still published

**API errors**:
```
✗ Failed to sync module-name: <specific error message>
```
- Shows actual error message
- Helps with debugging

### Progress Indicators

**Retry messages**:
```
⏳ Cloudflare block detected, waiting 4s before retry 2/3...
```

**Success messages**:
```
✓ Updated: Introduction to Kubernetes
✓ Created: Kubernetes Networking
```

**Summary**:
```
Summary: 3 succeeded, 0 failed
```

## Usage

### Basic Sync

```bash
npm run sync:content
```

Expected output:
```
🔄 Starting module sync to HubDB...

Found 3 modules to sync:

  ✓ Updated: Introduction to Kubernetes
  ✓ Updated: Kubernetes Storage
  ✓ Updated: Kubernetes Networking

📤 Publishing HubDB table...
✅ Sync complete! Table published.

Summary: 3 succeeded, 0 failed
```

### With Cloudflare Blocks

```bash
npm run sync:content
```

Output with automatic retry:
```
🔄 Starting module sync to HubDB...

Found 3 modules to sync:

  ⏳ Cloudflare block detected, waiting 2s before retry 1/3...
  ⏳ Cloudflare block detected, waiting 4s before retry 2/3...
  ✓ Updated: Introduction to Kubernetes

  ✓ Updated: Kubernetes Storage
  ✓ Updated: Kubernetes Networking

📤 Publishing HubDB table...
✅ Sync complete! Table published.

Summary: 3 succeeded, 0 failed
```

### Partial Failures

```bash
npm run sync:content
```

Output with some failures:
```
🔄 Starting module sync to HubDB...

Found 3 modules to sync:

  ✓ Updated: Introduction to Kubernetes
  ✗ Failed to sync kubernetes-storage: Cloudflare block (will retry on next run)
  ✓ Updated: Kubernetes Networking

📤 Publishing HubDB table...
✅ Sync complete! Table published.

Summary: 2 succeeded, 1 failed
```

**Note**: Table is still published with successful modules. Failed modules can be re-run.

## CI/CD Usage

### GitHub Actions

The script is CI/CD ready with `.github/workflows/sync-content.yml`:

```yaml
- name: Sync modules to HubDB
  env:
    HUBSPOT_PRIVATE_APP_TOKEN: ${{ secrets.HUBSPOT_PRIVATE_APP_TOKEN }}
    HUBDB_MODULES_TABLE_ID: ${{ secrets.HUBDB_MODULES_TABLE_ID }}
  run: npm run sync:content
```

**Benefits**:
- Automatic sync on every push to `content/modules/`
- Retries handle transient network issues
- Partial failures don't block entire workflow
- Clear logs for debugging

### Manual Trigger

Can also trigger manually via GitHub Actions UI:
1. Go to Actions tab
2. Select "Sync Content to HubSpot" workflow
3. Click "Run workflow"

## Performance Characteristics

### Timing (3 modules)

**Best case** (no retries):
- 3 modules × ~1 second = 3 seconds
- 2 delays × 1.5 seconds = 3 seconds
- Table publish = 1 second
- **Total: ~7 seconds**

**With retries** (all modules blocked once):
- Per module: 1s (fail) + 2s (wait) + 1s (success) = 4s
- 3 modules × 4 seconds = 12 seconds
- 2 delays × 1.5 seconds = 3 seconds
- Table publish = 1 second
- **Total: ~16 seconds**

**Worst case** (max retries):
- Per module: 1s + 2s + 1s + 4s + 1s + 8s + 1s = 18s
- 3 modules × 18 seconds = 54 seconds
- 2 delays × 1.5 seconds = 3 seconds
- Table publish with retry = 15s
- **Total: ~72 seconds (1.2 minutes)**

### Scalability

**10 modules**:
- Best: ~20 seconds
- Typical: ~35 seconds
- Worst: ~4 minutes

**100 modules**:
- Best: ~3 minutes
- Typical: ~6 minutes
- Worst: ~30 minutes

## Configuration

### Retry Settings

Can be adjusted in `src/sync/markdown-to-hubdb.ts`:

```typescript
await retryWithBackoff(
  fn,
  maxRetries: 3,        // ← Change max retries
  initialDelayMs: 2000  // ← Change initial delay
);
```

### Inter-Module Delay

```typescript
await sleep(1500); // ← Change delay in ms
```

**Recommendations**:
- Don't go below 1000ms (1 second) between modules
- Don't increase beyond 3000ms (3 seconds) unless necessary
- Exponential backoff should start at 2000ms minimum

## Error Recovery

### Cloudflare Block Recovery

**If Cloudflare blocks your IP**:

1. **Wait 10-30 minutes** for automatic unblock
2. **Run sync again** - should succeed
3. **If persists**, try from different network/IP

**Script will**:
- Detect the block
- Retry with increasing delays
- Eventually give up gracefully
- Publish table with successful modules

### HubDB Issues

**If HubDB table doesn't exist**:
```
Error: HUBDB_MODULES_TABLE_ID environment variable not set
```
→ Check `.env` file has correct table ID

**If scopes missing**:
```
Error: This app hasn't been granted all required scopes
```
→ Reinstall app to grant `hubdb` scope

**If network issues**:
- Script retries automatically
- Check internet connection
- Check HubSpot status: https://status.hubspot.com/

## Best Practices

### Local Development

✅ **DO**:
- Run sync once to test
- Wait 30 seconds between manual runs
- Use `git commit && git push` to trigger CI/CD instead

❌ **DON'T**:
- Run sync repeatedly in quick succession
- Bypass the delays (will trigger Cloudflare)
- Remove retry logic (needed for reliability)

### Production/CI

✅ **DO**:
- Let GitHub Actions handle syncing
- Monitor workflow logs
- Alert on repeated failures

❌ **DON'T**:
- Trigger multiple builds simultaneously
- Reduce backoff delays too much
- Ignore partial failures

## Monitoring

### Success Indicators

✅ Exit code 0
✅ "Sync complete! Table published"
✅ `Summary: X succeeded, 0 failed`

### Failure Indicators

❌ Exit code 1
❌ Stack trace in output
❌ `Summary: X succeeded, Y failed` where Y > 0

### Partial Success

⚠️ Exit code 0 (still succeeds)
⚠️ `Summary: X succeeded, Y failed` where Y > 0 and X > 0
⚠️ Table published but some modules missing

**Action**: Re-run to retry failed modules

## Troubleshooting

### All Modules Fail with Cloudflare

**Symptom**:
```
✗ Failed to sync module1: Cloudflare block
✗ Failed to sync module2: Cloudflare block
✗ Failed to sync module3: Cloudflare block
Summary: 0 succeeded, 3 failed
```

**Fix**: Wait 15-30 minutes, retry

### Intermittent Failures

**Symptom**: Sometimes succeeds, sometimes fails

**Fix**: Script already handles this - just re-run

### All Modules Fail with Same Error

**Symptom**:
```
✗ Failed to sync module1: MISSING_SCOPES
✗ Failed to sync module2: MISSING_SCOPES
```

**Fix**: App scopes issue - reinstall app

## Summary

The sync script is **production-ready** with:
- ✅ Automatic retry with exponential backoff
- ✅ Cloudflare rate limit handling
- ✅ Graceful partial failure handling
- ✅ CI/CD integration
- ✅ Clear progress indicators
- ✅ Smart error messages

**Typical sync time**: 7-16 seconds for 3 modules
**Max sync time**: ~72 seconds with full retry
**Rate limit prevention**: 1.5s delays between modules
**Retry strategy**: Exponential backoff up to 14s
