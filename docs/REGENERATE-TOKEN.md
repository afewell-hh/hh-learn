# Regenerate App Access Token After Scope Changes

## Why You Need To Do This

After updating the `requiredScopes` in `app-hsmeta.json` and deploying the app, **your existing access token still has the OLD scopes**. You need to regenerate it to get a token with the new `hubdb` permission.

## Steps (2 minutes in HubSpot GUI)

### 1. Go to Your Developer Project

**Navigate to**: Development > Projects > hedgehog-learn-dev

Or direct link:
```
https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev
```

### 2. Go to Auth Tab

Look for navigation tabs:
- Overview
- Code
- **Auth** ← Click this
- Activity
- etc.

### 3. Generate New Access Token

On the Auth page, you should see:
- Current scopes (should now include `hubdb` ✅)
- Access token section

Look for one of these:
- **"Generate new token"** button
- **"Show token"** / **"Reveal token"** button
- **"Regenerate"** or **"Rotate"** option

Click it to generate a new token with updated scopes.

### 4. Copy New Token

Copy the entire token value (starts with something like `pat-na1-...` or similar)

### 5. Update .env File

Replace the old token in your `.env` file:

```bash
# Open .env
nano .env

# Find this line:
HUBSPOT_PRIVATE_APP_TOKEN=OLD_TOKEN_HERE

# Replace with new token:
HUBSPOT_PRIVATE_APP_TOKEN=NEW_TOKEN_HERE

# Save and exit (Ctrl+X, Y, Enter)
```

Or use sed:
```bash
# Replace in one command (put your new token after the =)
sed -i 's/^HUBSPOT_PRIVATE_APP_TOKEN=.*/HUBSPOT_PRIVATE_APP_TOKEN=YOUR_NEW_TOKEN_HERE/' .env
```

### 6. Test Sync

```bash
npm run sync:content
```

Should now work! ✅

---

## What If I Don't See Auth Tab?

Try these alternatives:

### Option A: Re-install the App

1. Go to: Settings > Integrations > Connected Apps
2. Find: `hedgehog-learn-dev-Application`
3. Click **Uninstall** (don't worry, this is safe)
4. Go back to: Development > Projects > hedgehog-learn-dev
5. Click **Install to account** or similar button
6. Accept new scopes (including `hubdb`)
7. Copy the new token

### Option B: Check Activity Tab

1. Development > Projects > hedgehog-learn-dev > **Activity**
2. Look for Build #13 (our recent deploy)
3. May have option to "Install" or "Update installation"

### Option C: Use hs CLI

```bash
# List auth info
hs auth info

# May show how to regenerate token
```

---

## Verify New Token Has Correct Scopes

Test the token:

```bash
# Quick API test
TOKEN=$(grep HUBSPOT_PRIVATE_APP_TOKEN .env | cut -d'=' -f2)

# List HubDB tables (should work now)
curl -H "Authorization: Bearer $TOKEN" \
  https://api.hubapi.com/cms/v3/hubdb/tables

# Should return JSON (not error page)
```

If you get JSON response with table list = Success! ✅
If you get HTML error page = Token still has wrong scopes

---

## Still Getting Scope Errors?

**Double-check app-hsmeta.json was deployed**:

```bash
# Check local file
grep -A 8 "requiredScopes" src/app/app-hsmeta.json
```

Should show:
```json
"requiredScopes": [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "hubdb",
  "content"
],
```

✅ Already confirmed - deployed in Build #13

**Check in HubSpot GUI**:
1. Development > Projects > hedgehog-learn-dev > **Auth** tab
2. Verify **Required scopes** section lists `hubdb`

If `hubdb` is NOT listed there, the deploy may not have taken effect. Try:
```bash
hs project upload --force
```

---

## After Token Works

Once `npm run sync:content` succeeds, you're done with the CLI setup!

The remaining steps from `docs/USER-GUI-TASKS.md`:
- ✅ Create HubDB table (done)
- ✅ Upload templates (done)
- ✅ Run sync script (about to work)
- ⏳ Create pages in HubSpot

Almost there! 🎉
