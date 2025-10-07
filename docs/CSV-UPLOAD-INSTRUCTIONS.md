# CSV Upload Instructions

## File Ready

**CSV file**: `hubdb-modules.csv`
**Location**: `/home/ubuntu/afewell-hh/hedgehog-learn/hubdb-modules.csv`
**Modules**: 3 (intro-to-kubernetes, kubernetes-storage, kubernetes-networking)
**Size**: 795 lines

## Upload to HubSpot (2 minutes)

### Step 1: Go to HubDB Table

1. **Navigate to**: Content > HubDB
2. **Find table**: `learning_modules` (Table ID: 135163996)
3. **Click** the table name to open it

### Step 2: Import CSV

1. Look for **Actions** or **Import** button (usually top right)
2. Click **Import** or **Import from CSV**
3. Click **Choose File** or **Upload**
4. Select file: `hubdb-modules.csv` (download from server first if needed)
5. Click **Import** or **Next**

### Step 3: Map Columns

HubSpot will show a column mapping screen:

**Map CSV columns to HubDB columns**:
- `name` → `Name` (path/ID field)
- `title` → `Title`
- `slug` → `Slug`
- `description` → `Description`
- `difficulty` → `Difficulty` (should map to SELECT field)
- `estimated_minutes` → `Estimated Minutes`
- `tags` → `Tags`
- `full_content` → `Full Content`
- `display_order` → `Display Order`

**Important**: Make sure `difficulty` maps to the SELECT field, not TEXT

Click **Import** or **Continue**

### Step 4: Review and Publish

1. HubSpot will import the 3 rows
2. Review the imported data
3. Click **Publish** to make changes live

**Done!** ✅

## Verify Import

After publishing:

1. Stay in HubDB table view
2. Should see 3 rows:
   - Introduction to Kubernetes
   - Kubernetes Storage
   - Kubernetes Networking
3. Click a row to verify:
   - Title is set
   - Difficulty shows as "Beginner", "Intermediate", or "Advanced"
   - Full Content has HTML
   - Display Order is set

## Download CSV (If Needed)

If you need to download the CSV from the server:

### Option A: Via SCP

```bash
# On your local machine
scp ubuntu@vlab-art:~/afewell-hh/hedgehog-learn/hubdb-modules.csv ~/Downloads/
```

### Option B: Via Cat and Copy

```bash
# On server, display base64 encoded
cat hubdb-modules.csv | base64

# Copy output, paste in local terminal, decode:
echo "PASTE_BASE64_HERE" | base64 -d > hubdb-modules.csv
```

### Option C: View in Server and Create Locally

The CSV is also checked into git, so after next commit you can:

```bash
git pull
# CSV will be at: hubdb-modules.csv
```

## Troubleshooting

### Difficulty Field Shows as Number

**Problem**: Difficulty shows as "1", "2", "3" instead of labels

**Fix**:
- The CSV uses option IDs (correct format)
- HubSpot should display labels ("Beginner", "Intermediate", "Advanced")
- If showing numbers, the column mapping may be wrong
- Re-import and ensure `difficulty` maps to the SELECT column

### Import Fails

**Problem**: "Invalid data" or similar error

**Possible causes**:
1. CSV encoding issue - ensure UTF-8
2. Column mapping incorrect
3. HTML content too long (unlikely with our modules)

**Fix**: Check error message, adjust mapping

### Missing Content

**Problem**: Some fields are empty after import

**Fix**: Check CSV file locally to verify data is present

## Next Steps

After successful upload:

1. ✅ Verify 3 modules in HubDB
2. ✅ Create pages in HubSpot:
   - Landing page using `landing-simple.html` template
   - Module detail page using `module-simple.html` template
3. ✅ Test pages
4. ✅ Publish!

See `docs/USER-GUI-TASKS.md` for page creation steps.

## Future Updates

Once Cloudflare block clears (~30-60 min), you can use:

```bash
npm run sync:content
```

The sync script is now fixed and will work for future updates!
