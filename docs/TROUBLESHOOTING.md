# Troubleshooting Guide

## Sync Script Errors

### Error: "This app hasn't been granted all required scopes"

**Full error:**
```
This app hasn't been granted all required scopes to make this call.
requiredGranularScopes: ["hubdb"]
```

**Cause**: Your HubSpot Private App doesn't have HubDB permissions enabled.

**Fix (2 minutes in HubSpot GUI)**:

1. Go to: **Settings** (gear icon) > **Integrations** > **Private Apps**
2. Find your private app (the one that generated `HUBSPOT_PRIVATE_APP_TOKEN`)
3. Click **Edit** or the app name
4. Click **Scopes** tab
5. Search for "HubDB" or scroll to find it
6. Enable these scopes:
   - ☑️ **Read from HubDB** (`hubdb`)
   - ☑️ **Write to HubDB** (`hubdb`)
7. Click **Save** at the bottom
8. If prompted, confirm scope changes

**Note**: The token value doesn't change - no need to update `.env`

**Test**: Run `npm run sync:content` again

---

### Error: "Cannot parse content. No Content-Type defined"

**Full error:**
```
Error: Cannot parse content. No Content-Type defined.
at ObjectSerializer.parse
```

**Cause**: HubSpot API returned an unexpected response (often HTML error page instead of JSON)

**Common reasons**:
1. **Rate limiting**: Too many requests too quickly
2. **Cloudflare blocking**: IP temporarily blocked (403 error)
3. **API endpoint issue**: Temporary HubSpot service issue

**Fixes**:

**If you see Cloudflare 403 errors**:
- Wait 5-10 minutes for Cloudflare rate limit to reset
- Your IP: `72.52.75.74` may be temporarily blocked
- Try again after waiting

**If persistent**:
- Check HubSpot Status: https://status.hubspot.com/
- Verify table ID is correct: `echo $HUBDB_MODULES_TABLE_ID`
- Check Private App has correct scopes (see above)

**Workaround**:
- Add retry logic with delays (we can implement this)
- Use different network/IP if available

---

### Error: "Authentication credentials not found" (401)

**Full error:**
```
HTTP-Code: 401
Authentication credentials not found.
```

**Cause**: Token not being passed to API or invalid token

**Fixes**:

1. **Verify .env file has token**:
   ```bash
   grep HUBSPOT_PRIVATE_APP_TOKEN .env
   ```
   Should show: `HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-...`

2. **Verify .env is being loaded**:
   - Check `src/sync/markdown-to-hubdb.ts` has `import 'dotenv/config'` at top
   - Verified ✅ (already fixed)

3. **Regenerate token if needed**:
   - Go to: Settings > Integrations > Private Apps
   - Click your app > **Show token**
   - Copy to `.env` file

---

### Error: "HUBDB_MODULES_TABLE_ID environment variable not set"

**Cause**: Missing table ID in `.env` file

**Fix**:

1. Create HubDB table in HubSpot (if not done):
   - Content > HubDB > Create table
   - See `docs/USER-GUI-TASKS.md` for schema

2. Get table ID from URL:
   - After creating table, URL will be: `https://app.hubspot.com/.../hubdb/XXXXX`
   - Copy the number (e.g., `12345678`)

3. Add to `.env`:
   ```bash
   echo "HUBDB_MODULES_TABLE_ID=12345678" >> .env
   ```

---

## Quick Diagnostic Commands

**Check .env variables are set**:
```bash
grep -E '^(HUBSPOT_PRIVATE_APP_TOKEN|HUBDB_MODULES_TABLE_ID)=' .env
```

**Test API connection** (quick check):
```bash
curl -H "Authorization: Bearer $(grep HUBSPOT_PRIVATE_APP_TOKEN .env | cut -d'=' -f2)" \
  https://api.hubapi.com/cms/v3/hubdb/tables
```

Should return JSON list of tables (not HTML error page)

**Check table exists**:
```bash
TABLE_ID=$(grep HUBDB_MODULES_TABLE_ID .env | cut -d'=' -f2)
curl -H "Authorization: Bearer $(grep HUBSPOT_PRIVATE_APP_TOKEN .env | cut -d'=' -f2)" \
  https://api.hubapi.com/cms/v3/hubdb/tables/$TABLE_ID
```

Should return table info

---

## Rate Limiting / Cloudflare Issues

**Symptoms**:
- 403 Cloudflare block page
- "Sorry, you have been blocked"
- Multiple rapid failures

**Why it happens**:
- HubSpot API behind Cloudflare protection
- Too many requests from same IP
- Triggered by rapid sync attempts

**Solutions**:

1. **Wait it out** (recommended):
   - Cloudflare blocks typically last 5-30 minutes
   - Make coffee, come back

2. **Reduce request frequency**:
   - Add delays between operations (we can implement)
   - Don't run sync multiple times rapidly

3. **Use different network**:
   - Different IP address
   - VPN to different location
   - Home network vs office network

---

## Common Workflow Issues

### Sync runs but content not appearing on pages

**Check**:
1. HubDB table is **Published** (not just draft)
   - Content > HubDB > your table > **Publish** button
2. Table ID in templates matches `.env`
   - In `landing-simple.html`: `hubdb_table_rows(YOUR_TABLE_ID)`
3. Page template is correct template
4. Page is published (not draft)

### Module content looks wrong/unformatted

**Check**:
1. Markdown frontmatter is valid YAML
2. Check sync script output for errors
3. Verify HTML in HubDB `full_content` column
4. Check browser console for CSS issues

### Sync succeeds but creates duplicate rows

**Cause**: Using wrong identifier for row updates

**Fix**: Verify `path` field uses `slug` (not random ID)
- Already fixed in script ✅

---

## Need More Help?

1. Check HubSpot developer docs: https://developers.hubspot.com/docs/api/cms/hubdb
2. Check Private App scopes: https://developers.hubspot.com/scopes
3. HubSpot Status: https://status.hubspot.com/
4. Check this project's docs: `docs/MVP-COMPLETE.md`
