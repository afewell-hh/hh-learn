# MVP Plan - Fastest Path to Content Publishing

**Goal**: Get learning modules published ASAP with basic functionality
**Strategy**: MVP first, progressive enhancement after
**Timeline**: 2-3 days to first published module

---

## Phase 0: Immediate Setup (4-6 hours)

### What You Get
- Basic module pages published
- Content editable in Git (markdown)
- Auto-sync to HubSpot

### Work Packet 0A: HubDB Tables + Sync Script (2-3 hours)

**Priority**: BLOCKING - Do this first!

**Tasks:**

1. **Create HubDB Tables** (30 min - in HubSpot UI)

   Navigate to: Content > HubDB > Create table

   **Table: `learning_modules`**
   ```
   Columns:
   - title (Text)
   - slug (Text)
   - description (Rich Text)
   - difficulty (Select: beginner, intermediate, advanced)
   - estimated_minutes (Number)
   - tags (Text)
   - full_content (Rich Text) ← Entire module content as HTML
   - display_order (Number)
   ```

   **Publish table** and note the Table ID

2. **Create Sync Script** (1.5-2 hours)

   **File**: `src/sync/markdown-to-hubdb.ts`

   ```typescript
   // Convert markdown files to HubDB rows
   import { readdir, readFile } from 'fs/promises';
   import { join } from 'path';
   import { marked } from 'marked'; // markdown parser
   import matter from 'gray-matter'; // frontmatter parser
   import { Client } from '@hubspot/api-client';

   const hubspot = new Client({ accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN });
   const TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID;

   async function syncModules() {
     const modulesDir = join(__dirname, '../../content/modules');
     const modules = await readdir(modulesDir);

     for (const moduleSlug of modules) {
       const readmePath = join(modulesDir, moduleSlug, 'README.md');
       const content = await readFile(readmePath, 'utf-8');

       // Parse frontmatter + content
       const { data: frontmatter, content: markdown } = matter(content);

       // Convert markdown to HTML
       const html = marked(markdown);

       // Upsert to HubDB
       const row = {
         path: moduleSlug,
         values: {
           title: frontmatter.title,
           slug: frontmatter.slug,
           description: frontmatter.description,
           difficulty: frontmatter.difficulty,
           estimated_minutes: frontmatter.estimated_minutes,
           tags: frontmatter.tags.join(','),
           full_content: html,
           display_order: frontmatter.order || 999
         }
       };

       // Try update first, create if doesn't exist
       try {
         await hubspot.cms.hubdb.rowsApi.updateDraftTableRow(TABLE_ID, moduleSlug, row);
       } catch (err) {
         await hubspot.cms.hubdb.rowsApi.createTableRow(TABLE_ID, row);
       }

       console.log(`✓ Synced: ${frontmatter.title}`);
     }

     // Publish table
     await hubspot.cms.hubdb.tablesApi.publishDraftTable(TABLE_ID);
     console.log('✓ Published HubDB table');
   }

   syncModules().catch(console.error);
   ```

3. **Add Dependencies** (5 min)

   ```bash
   npm install marked gray-matter @types/marked
   ```

4. **Add npm Script** (2 min)

   Update `package.json`:
   ```json
   {
     "scripts": {
       "sync:content": "ts-node src/sync/markdown-to-hubdb.ts"
     }
   }
   ```

5. **Add .env Variables** (2 min)

   ```bash
   HUBDB_MODULES_TABLE_ID=your_table_id_here
   ```

6. **Test Sync** (10 min)

   ```bash
   npm run sync:content
   ```

   Verify in HubSpot: Content > HubDB > learning_modules
   Should see 3 modules with HTML content

**Acceptance Criteria:**
- [ ] HubDB table created
- [ ] Sync script works
- [ ] 3 modules in HubDB
- [ ] Content is HTML (rendered from markdown)

---

### Work Packet 0B: Simple Module Template (2-3 hours)

**Priority**: BLOCKING - Need this to display content

**Tasks:**

1. **Access Clean.Pro Theme** (10 min)

   In HubSpot Design Manager:
   - Navigate to Clean.Pro theme folder
   - Create folder: `templates/learn/`

2. **Create Basic Module Template** (1 hour)

   **File**: `Clean.Pro/templates/learn/module-simple.html`

   ```html
   {% extends "../layouts/base.html" %}

   {% block body %}
   <div class="container">
     <!-- Breadcrumbs -->
     <nav class="breadcrumbs" style="padding: 1rem 0; color: #666;">
       <a href="/learn" style="color: #0066CC;">Learn</a> ›
       <span>{{ content.module_title }}</span>
     </nav>

     <!-- Module Header -->
     <header style="margin: 2rem 0;">
       <h1>{{ content.module_title }}</h1>
       <div style="display: flex; gap: 1rem; color: #666; margin-top: 0.5rem;">
         <span>{{ content.module_difficulty }}</span>
         <span>•</span>
         <span>{{ content.module_time }} min</span>
       </div>
     </header>

     <!-- Module Content (from HubDB) -->
     <div class="module-content" style="max-width: 800px; line-height: 1.8;">
       {{ content.module_content|safe }}
     </div>
   </div>
   {% endblock %}
   ```

3. **Create Basic Landing Template** (1 hour)

   **File**: `Clean.Pro/templates/learn/landing-simple.html`

   ```html
   {% extends "../layouts/base.html" %}

   {% block body %}
   <div class="container">
     <header style="text-align: center; padding: 3rem 0;">
       <h1>Learn Hedgehog Cloud</h1>
       <p style="font-size: 1.2rem; color: #666;">Hands-on labs and tutorials</p>
     </header>

     <!-- Module Grid -->
     <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem; margin: 3rem 0;">
       {% set modules = hubdb_table_rows(YOUR_TABLE_ID, "orderBy=display_order") %}
       {% for module in modules %}
         <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 1.5rem;">
           <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
             <span style="background: #EFF6FF; color: #0066CC; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.875rem;">
               {{ module.difficulty }}
             </span>
             <span style="color: #666;">{{ module.estimated_minutes }} min</span>
           </div>
           <h3 style="margin-bottom: 0.5rem;">{{ module.title }}</h3>
           <p style="color: #666; margin-bottom: 1rem;">{{ module.description }}</p>
           <a href="/learn/module/{{ module.slug }}" style="color: #0066CC; text-decoration: none; font-weight: 600;">
             View Module →
           </a>
         </div>
       {% endfor %}
     </div>
   </div>
   {% endblock %}
   ```

4. **Upload Templates** (5 min)

   Save both files in Design Manager or upload via CLI:
   ```bash
   hs upload Clean.Pro/templates/learn/ clean-pro/templates/learn/
   ```

**Acceptance Criteria:**
- [ ] Module template created
- [ ] Landing template created
- [ ] Both uploaded to Clean.Pro
- [ ] Templates visible in Design Manager

---

### Work Packet 0C: Create Pages (30 min - Manual in HubSpot UI)

**Priority**: BLOCKING - Final step to publish

**Tasks:**

1. **Create Landing Page** (10 min)

   - Content > Website Pages > Create
   - Select template: `learn/landing-simple.html`
   - Page name: "Learning Portal"
   - URL: `/learn-preview` (for testing)
   - Status: **Draft**
   - In template settings, add HubDB table ID
   - Preview

2. **Create Module Page** (10 min)

   - Content > Website Pages > Create
   - Select template: `learn/module-simple.html`
   - Page name: "Intro to Kubernetes - Preview"
   - URL: `/learn/module/intro-to-kubernetes-preview`
   - Status: **Draft**
   - In content fields:
     - module_title: Pull from HubDB
     - module_difficulty: Pull from HubDB
     - module_time: Pull from HubDB
     - module_content: Pull from HubDB `full_content` field
   - Preview

3. **Test Everything** (10 min)

   - Visit `/learn-preview`
   - Should see 3 modules
   - Click a module
   - Should see full content rendered
   - Verify markdown converted correctly

**Acceptance Criteria:**
- [ ] Landing page works
- [ ] Module page works
- [ ] Content displays correctly
- [ ] Navigation works

---

## ✅ After Phase 0: You Have

- **Working landing page** showing all modules
- **Working module pages** with full content
- **GitOps workflow**: Edit markdown → commit → sync → publish
- **3 published modules** ready to share

**Time to working pages**: 4-6 hours total

---

## Phase 1: Progressive Enhancement (Add Features)

### After you have basic publishing, add features incrementally:

### 1A: Add Tabs (4-6 hours)

Use Clean.Pro's **Tab Module**:
- Separate Lab, Concepts, Resources sections
- Update sync script to parse sections
- Update module template to use Tab Module

### 1B: Add Code Highlighting (6-8 hours)

Build custom **Code Block Module**:
- Prism.js for syntax highlighting
- Copy button
- Integrate into module template

### 1C: Better Cards (4-6 hours)

Adapt Clean.Pro's **Versa Cards**:
- Replace simple divs with Versa Card module
- Add hover effects
- Add filtering

### 1D: Pathway Support (8-12 hours)

Add pathway pages:
- Create `learning_pathways` HubDB table
- Create pathway template
- Update sync script
- Link modules to pathways

---

## Phase 2: Advanced Features (Later)

- Search functionality
- User progress tracking
- Quizzes/assessments
- Certificates
- Comments/discussions

---

## CI/CD Setup (Optional - Add After MVP Works)

**GitHub Actions** (`.github/workflows/sync-content.yml`):

```yaml
name: Sync Content to HubSpot

on:
  push:
    branches: [main]
    paths:
      - 'content/modules/**'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Sync to HubDB
        env:
          HUBSPOT_PRIVATE_APP_TOKEN: ${{ secrets.HUBSPOT_PRIVATE_APP_TOKEN }}
          HUBDB_MODULES_TABLE_ID: ${{ secrets.HUBDB_MODULES_TABLE_ID }}
        run: npm run sync:content
```

**Result**: Every commit to `content/modules/` auto-syncs to HubSpot!

---

## Comparison: MVP vs Full Build

| Feature | MVP (Phase 0) | Enhanced (Phase 1) |
|---------|---------------|-------------------|
| Time | 4-6 hours | +20-30 hours |
| Publish modules | ✅ | ✅ |
| GitOps workflow | ✅ | ✅ |
| Markdown editing | ✅ | ✅ |
| Tabs (Lab/Concepts) | ❌ | ✅ |
| Code highlighting | ❌ | ✅ |
| Fancy cards | ❌ | ✅ |
| Pathways | ❌ | ✅ |
| Search/filter | ❌ | ✅ |

---

## Your Immediate Next Steps

**If you want content published ASAP:**

1. **Today**: Execute Work Packet 0A (HubDB + sync script) - 2-3 hours
2. **Today**: Execute Work Packet 0B (basic templates) - 2-3 hours
3. **Today**: Execute Work Packet 0C (create pages) - 30 min
4. **Tonight**: Share `/learn-preview` with stakeholders! 🎉

**Then progressively add features** as time allows.

---

## Key Advantages of This Approach

✅ **Fast**: Working in 4-6 hours vs days/weeks
✅ **GitOps**: Content in Git, not trapped in HubSpot GUI
✅ **Scalable**: Add modules by adding markdown files
✅ **Progressive**: Add features without breaking what works
✅ **Clean.Pro**: Inherit all theme benefits
✅ **Proven**: Sync script pattern is well-established

---

## Questions?

- Sync script unclear? I can walk through it
- Need help with HubDB setup? I can create detailed steps
- Want to start immediately? I can create GitHub issues for each work packet
