# GitHub Secrets Setup for CI/CD

**Purpose**: Enable automatic content syncing when you push changes to `content/modules/`

**Time**: ~2 minutes

---

## Required Secrets

You need to add 2 secrets to your GitHub repository:

### 1. `HUBSPOT_PRIVATE_APP_TOKEN`

**What it is**: Your HubSpot Private App access token (already in local `.env`)

**How to add**:
1. Go to: `https://github.com/[your-org]/hedgehog-learn/settings/secrets/actions`
2. Click **New repository secret**
3. Name: `HUBSPOT_PRIVATE_APP_TOKEN`
4. Value: Copy from your `.env` file (the token value)
5. Click **Add secret**

### 2. `HUBDB_MODULES_TABLE_ID`

**What it is**: Your HubDB `learning_modules` table ID

**How to add**:
1. Same location: Repository Settings > Secrets and variables > Actions
2. Click **New repository secret**
3. Name: `HUBDB_MODULES_TABLE_ID`
4. Value: The table ID from HubSpot (e.g., `12345678`)
5. Click **Add secret**

---

## Verify Setup

**Check secrets are added**:
1. Go to: Repository Settings > Secrets and variables > Actions
2. Should see:
   - ✅ `HUBSPOT_PRIVATE_APP_TOKEN`
   - ✅ `HUBDB_MODULES_TABLE_ID`

---

## Test CI/CD

**Trigger automatic sync**:

```bash
# Make a change to any module
echo "Test update" >> content/modules/intro-to-kubernetes/README.md

# Commit and push
git add content/modules/intro-to-kubernetes/README.md
git commit -m "test: Verify CI/CD sync workflow"
git push origin main
```

**Watch workflow**:
1. Go to: `https://github.com/[your-org]/hedgehog-learn/actions`
2. Should see "Sync Content to HubSpot" workflow running
3. Wait ~1-2 minutes
4. Should see ✅ green checkmark
5. Verify in HubSpot: Content > HubDB > `learning_modules` - module updated

---

## Manual Trigger

You can also manually trigger the sync without pushing code:

1. Go to: Actions tab
2. Select "Sync Content to HubSpot" workflow
3. Click **Run workflow** button
4. Select branch: `main`
5. Click **Run workflow**

---

## Workflow Details

**What happens automatically**:
- Monitors: `content/modules/**` (any changes in module directories)
- Triggers: On push to `main` branch
- Runs: `npm run sync:content`
- Result: HubDB table updated and published

**Workflow file**: `.github/workflows/sync-content.yml`

---

## Troubleshooting

**Workflow fails with "HUBSPOT_PRIVATE_APP_TOKEN not set"**
- Secret name must be exactly `HUBSPOT_PRIVATE_APP_TOKEN`
- Check for typos
- Verify secret value is correct token from HubSpot

**Workflow fails with "HUBDB_MODULES_TABLE_ID not set"**
- Secret name must be exactly `HUBDB_MODULES_TABLE_ID`
- Value should be just the number (e.g., `12345678`)
- No quotes or extra spaces

**Workflow succeeds but content not updating**
- Check HubDB table ID is correct
- Verify token has HubDB write permissions
- Check sync script logs in workflow output

**Workflow not triggering on push**
- Verify you pushed to `main` branch
- Verify changes are in `content/modules/` directory
- Check Actions tab is not disabled in repository settings

---

## Security Notes

✅ **DO**:
- Keep tokens in GitHub Secrets (encrypted)
- Use Private App tokens (not API keys)
- Limit token scopes to CMS/HubDB only

❌ **DON'T**:
- Commit tokens to `.env` (`.gitignore` protects you)
- Share tokens in issues or PRs
- Use personal access tokens (use Private Apps)

---

## Next Steps

After CI/CD is working:

1. **Edit markdown locally**: `content/modules/intro-to-kubernetes/README.md`
2. **Commit and push**: Git workflow as usual
3. **Wait ~2 min**: GitHub Actions runs sync
4. **Check HubSpot**: Content auto-updated!
5. **Publish**: Changes live on `/learn` page

**Result**: True GitOps workflow - edit markdown, commit, auto-publish! ✨
