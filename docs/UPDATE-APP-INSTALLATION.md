# Update App Installation to Grant New Scopes

## The Issue

You deployed the app with updated scopes (Build #13 ✅) and rotated the token (✅), but the **app installation** in your HubSpot account still has the OLD scopes granted. You need to update the installation to accept the new `hubdb` scope.

## Solution (3 minutes in HubSpot GUI)

### Option A: Update Installation (Recommended)

1. **Go to Developer Projects**:
   ```
   Development > Projects > hedgehog-learn-dev
   ```
   Or: https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev

2. **Look for Installation Status**:
   - Check for a banner/message like:
     - "New scopes required"
     - "Update installation"
     - "Scope changes detected"

3. **Click "Update Installation"** or **"Re-authorize"**
   - This will show you the new scopes being requested
   - Should include `hubdb` in the list

4. **Accept/Authorize** the new scopes

5. **Done!** The existing installation is now updated with new permissions

### Option B: Reinstall the App

If you don't see an "Update" option:

1. **Go to Settings**:
   ```
   Settings (gear icon) > Integrations > Connected Apps
   ```

2. **Find your app**:
   - Look for: `hedgehog-learn-dev-Application`

3. **Uninstall**:
   - Click the app
   - Click **Uninstall** or **Remove**
   - Confirm

4. **Go back to Developer Projects**:
   ```
   Development > Projects > hedgehog-learn-dev
   ```

5. **Install to account**:
   - Look for **"Install to account"** or **"Install app"** button
   - Click it

6. **Accept scopes**:
   - Review the scopes (should include `hubdb` now)
   - Click **Install** or **Authorize**

7. **Token remains the same**:
   - Your existing token in `.env` should still work
   - If it doesn't, rotate it again as before

### Option C: Via Activity Tab

1. **Go to Activity tab**:
   ```
   Development > Projects > hedgehog-learn-dev > Activity
   ```

2. **Find Build #13**:
   - Should show: `[deployed]`

3. **Look for action buttons**:
   - May have "Install" or "Update installation" option
   - Click it

---

## Verify It Worked

After updating the installation, test immediately:

```bash
npm run sync:content
```

**Expected output**:
```
🔄 Starting module sync to HubDB...

Found 3 modules to sync:

  ✓ Created: Introduction to Kubernetes
  ✓ Created: Kubernetes Storage
  ✓ Created: Kubernetes Networking

📤 Publishing HubDB table...
✅ Sync complete! Table published.
```

**If still getting scope errors**:
- Double-check you updated the installation (not just rotated token)
- Verify Build #13 is deployed: https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev/activity
- Check Settings > Connected Apps shows `hedgehog-learn-dev-Application` with `hubdb` scope

---

## Why This Happened

**The flow**:
1. ✅ You updated `app-hsmeta.json` with new scopes
2. ✅ You deployed the app (Build #13)
3. ✅ You rotated the access token
4. ❌ **But** the app installation wasn't updated to grant new scopes

**The fix**: Update the installation to accept the new scopes

**In HubSpot App Framework**:
- Deploying app = updates app definition
- Installing/updating installation = grants scopes to your account
- Token rotation = new token value, but same scopes as installation
- **All three must align!**

---

## Quick Diagnostic

**Check if scopes are granted**:

```bash
# Test if token has hubdb access
TOKEN=$(grep HUBSPOT_PRIVATE_APP_TOKEN .env | cut -d'=' -f2)

# Try to list HubDB tables
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.hubapi.com/cms/v3/hubdb/tables | head -20
```

**If you see JSON with table data** = Scopes granted ✅
**If you see HTML error or "MISSING_SCOPES"** = Installation not updated yet ❌

---

## After It Works

Once you see:
```
✅ Sync complete! Table published.
```

You're done with all CLI setup! 🎉

**Remaining steps** (from `docs/USER-GUI-TASKS.md`):
- ✅ Create HubDB table
- ✅ Upload templates
- ✅ Run sync script
- ⏳ Create pages in HubSpot (5 minutes)

Almost there!
