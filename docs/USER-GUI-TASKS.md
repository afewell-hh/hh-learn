# Quick GUI Tasks (~15 minutes total)

**Goal**: Get learning modules published in HubSpot using Clean.Pro theme

**What's already automated**:
- ✅ Sync script created (`npm run sync:content`)
- ✅ Templates created (`clean-pro-templates/learn/`)
- ✅ Content ready (`content/modules/`)

**What you need to do manually in HubSpot GUI**:

---

## Task 1: Create HubDB Table (5 min)

**Location**: Content > HubDB > Create table

**Table Name**: `learning_modules`

**Columns to create**:

| Column Name | Type | Notes |
|------------|------|-------|
| `title` | Text | Module title |
| `slug` | Text | URL-friendly identifier |
| `description` | Rich Text | Short description |
| `difficulty` | Select | Options: beginner, intermediate, advanced |
| `estimated_minutes` | Number | Time to complete |
| `tags` | Text | Comma-separated tags |
| `full_content` | Rich Text | Complete module HTML |
| `display_order` | Number | Sort order |

**After creating**:
1. Click **Publish** (top right)
2. Note the **Table ID** from the URL (e.g., `12345678`)
3. Add to `.env` file:
   ```bash
   HUBDB_MODULES_TABLE_ID=12345678
   ```

---

## Task 2: Upload Templates to Clean.Pro (5 min)

**Option A: Via Design Manager (recommended for quick testing)**

1. Go to: Content > Design Manager
2. Navigate to: `Clean.Pro/templates/`
3. Create folder: `learn`
4. Upload both files from `clean-pro-templates/learn/`:
   - `landing-simple.html`
   - `module-simple.html`

**Option B: Via CLI (if you have HubSpot CLI configured)**

```bash
hs upload clean-pro-templates/learn/ clean-pro/templates/learn/
```

**Important**: In both templates, replace `TABLE_ID` placeholder with your actual table ID:
- In `landing-simple.html` line 16: `{% set modules = hubdb_table_rows(12345678, "orderBy=display_order") %}`

---

## Task 3: Sync Content to HubDB (2 min)

**Run sync script**:

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

**Verify**: Go to Content > HubDB > `learning_modules` - should see 3 rows

---

## Task 4: Create Pages in HubSpot (3 min)

### Create Landing Page

1. Content > Website Pages > Create
2. Select template: `Clean.Pro/templates/learn/landing-simple.html`
3. Page name: "Learning Portal"
4. URL: `/learn-preview` (for testing) or `/learn` (for production)
5. Status: **Draft** (test first)
6. Click **Preview** to verify modules display
7. If looks good, change status to **Published**

### Create Module Detail Page

1. Content > Website Pages > Create
2. Select template: `Clean.Pro/templates/learn/module-simple.html`
3. Page name: "Intro to Kubernetes"
4. URL: `/learn/module/intro-to-kubernetes-preview`
5. Status: **Draft**
6. In page editor, set content fields:
   - `module_title`: Pull from HubDB or enter "Introduction to Kubernetes"
   - `module_difficulty`: "beginner"
   - `module_time`: "45"
   - `module_tags`: "kubernetes,cloud-native,containers"
   - `module_content`: Pull from HubDB `full_content` field
7. Click **Preview**
8. If looks good, change status to **Published**

**Repeat for other modules** (or wait for dynamic routing in Phase 1)

---

## ✅ Done!

You now have:
- ✅ HubDB table with 3 learning modules
- ✅ Landing page at `/learn` (or `/learn-preview`)
- ✅ Module page at `/learn/module/intro-to-kubernetes-preview`
- ✅ GitOps workflow: edit markdown → commit → sync → HubSpot updates

---

## Next Steps (Optional - Progressive Enhancement)

**After MVP is working**, add these features:

1. **CI/CD Auto-Sync** (30 min)
   - Set up GitHub Actions to auto-run sync on commit
   - See `.github/workflows/sync-content.yml`

2. **Dynamic Module Pages** (1-2 hours)
   - Use HubDB dynamic pages instead of creating individual pages
   - URL pattern: `/learn/module/{slug}` auto-routes to template

3. **Enhanced Features** (Phase 1 - see MVP-PLAN.md)
   - Tab navigation (Lab/Concepts/Resources)
   - Code syntax highlighting
   - Better card designs
   - Search/filter functionality

---

## Troubleshooting

**Sync fails with "TABLE_ID not set"**
- Check `.env` has `HUBDB_MODULES_TABLE_ID=your_id`

**Templates not showing in page editor**
- Verify templates uploaded to `Clean.Pro/templates/learn/`
- Refresh Design Manager

**Modules not displaying on landing page**
- Check HubDB table is **Published** (not just draft)
- Verify `TABLE_ID` in template matches your table
- Check table has rows with data

**Module content looks wrong**
- Verify markdown frontmatter in `content/modules/*/README.md`
- Check sync script output for errors
- Re-run sync: `npm run sync:content`

---

## Need Help?

- Check `docs/MVP-PLAN.md` for detailed implementation guide
- Review `docs/clean-pro-development.md` for Clean.Pro customization
- HubSpot docs: https://developers.hubspot.com/docs/cms
