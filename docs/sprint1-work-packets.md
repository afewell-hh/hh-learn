# Sprint 1 Work Packets - Extending Clean.Pro

**Strategy**: Add custom modules and templates to Clean.Pro theme (not creating separate theme)
**Sprint Goal**: Create learning platform pages using Clean.Pro + custom extensions

---

## Work Packet #1: Custom Modules for Learn Platform

**Priority**: P0 - BLOCKING
**Estimated**: 2-3 days
**Branch**: `feature/learn-modules`

### Context

Create reusable custom modules that extend Clean.Pro for learning platform functionality. These modules will be added to the Clean.Pro theme folder.

### Custom Modules Needed

#### 1. Tab Navigation Module
**Location**: `Clean.Pro/modules/learn/tab-navigation/`

**Files to create**:
- `meta.json` - Module metadata
- `module.html` - Tab UI template
- `module.css` - Tab styling
- `module.js` - Tab switching logic

**Features**:
- Three tabs: Lab, Concepts, Resources
- Click to switch content
- Active state styling
- Keyboard accessible

#### 2. Code Block Module
**Location**: `Clean.Pro/modules/learn/code-block/`

**Files to create**:
- `meta.json`
- `module.html` - Code display template
- `module.css` - Code styling
- `module.js` - Copy button, syntax highlighting

**Features**:
- Syntax highlighting (Prism.js)
- Copy to clipboard button
- Language label
- Line numbers (optional)
- Support for: bash, yaml, javascript, python

#### 3. Pathway Card Module
**Location**: `Clean.Pro/modules/learn/pathway-card/`

**Files to create**:
- `meta.json`
- `module.html`
- `module.css`

**Features**:
- Icon or image
- Title and description
- Module count
- Time estimate
- CTA button

#### 4. Module Card Module
**Location**: `Clean.Pro/modules/learn/module-card/`

**Files to create**:
- `meta.json`
- `module.html`
- `module.css`

**Features**:
- Difficulty badge (beginner/intermediate/advanced)
- Title and description
- Time estimate
- Tags
- CTA button

### Tasks (CLI-based)

#### 1. Access Clean.Pro Theme

```bash
# Fetch Clean.Pro theme to local
hs fetch clean-pro clean-pro

# Navigate to theme directory
cd clean-pro
```

#### 2. Create Module Directory Structure

```bash
# Create learn modules folder
mkdir -p modules/learn/{tab-navigation,code-block,pathway-card,module-card}

# Create required files for each module
for module in tab-navigation code-block pathway-card module-card; do
  touch modules/learn/$module/{meta.json,module.html,module.css}
done

# Add JS for interactive modules
touch modules/learn/tab-navigation/module.js
touch modules/learn/code-block/module.js
```

#### 3. Implement Tab Navigation Module

Create complete module files (see `docs/clean-pro-development.md` for examples)

**Test locally**: Add module to test page, verify tabs work

#### 4. Implement Code Block Module

Include Prism.js for syntax highlighting:
```html
<!-- In module.html -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
```

#### 5. Implement Pathway and Module Cards

Use Clean.Pro's existing card styles as base, extend with custom learn styling

#### 6. Upload to HubSpot

```bash
# From clean-pro directory
hs upload . clean-pro

# Or watch for changes
hs watch . clean-pro
```

#### 7. Verify in HubSpot

- Go to: Content > Design Manager
- Navigate to: clean-pro/modules/learn/
- Verify all 4 modules present
- Test each module in a test page

### Acceptance Criteria

- [ ] 4 custom modules created in `clean-pro/modules/learn/`
- [ ] All modules uploaded to HubSpot Design Manager
- [ ] Tab navigation works (switch between tabs)
- [ ] Code block displays with syntax highlighting
- [ ] Copy button works in code block
- [ ] Pathway and module cards styled consistently
- [ ] All modules mobile responsive
- [ ] Documentation added to each `meta.json`
- [ ] Committed to feature branch
- [ ] PR created with screenshots

### Git Workflow

```bash
git checkout -b feature/learn-modules

# Work on modules...

git add clean-pro/modules/learn/
git commit -m "feat: Add custom learn modules to Clean.Pro

- Tab navigation module (Lab/Concepts/Resources)
- Code block module with syntax highlighting
- Pathway card module
- Module card module

All modules added to Clean.Pro theme for learning platform.

Relates to #1, #2"

git push -u origin feature/learn-modules

# Create PR
gh pr create --title "feat: Custom Learn Modules for Clean.Pro" \
  --body "Adds 4 custom modules to Clean.Pro theme for learning platform.

Modules created:
- Tab navigation (interactive tabs)
- Code block (syntax highlighting + copy)
- Pathway card (pathway display)
- Module card (module display)

All modules tested and mobile responsive.

Relates to #1, #2" \
  --base main
```

---

## Work Packet #2: Landing Page Template

**Priority**: P0
**Estimated**: 1-2 days
**Branch**: `feature/learn-landing`
**Depends on**: Work Packet #1

### Context

Create landing page template at `/learn` using Clean.Pro base + custom modules.

### Tasks

#### 1. Create Template File

**Location**: `clean-pro/templates/learn/landing.html`

```bash
mkdir -p clean-pro/templates/learn
touch clean-pro/templates/learn/landing.html
```

#### 2. Implement Landing Page

**Template structure**:
- Extend Clean.Pro base layout
- Hero section (Clean.Pro existing components)
- Pathways section (custom pathway cards + HubDB)
- Modules section (custom module cards + HubDB)
- Search/filter placeholder (static for Phase 1)

**Use HubDB for content**:
```html
{% set pathways = hubdb_table_rows(PATHWAY_TABLE_ID) %}
{% set modules = hubdb_table_rows(MODULE_TABLE_ID) %}
```

#### 3. Add Custom CSS

**Location**: `clean-pro/css/learn.css`

```bash
touch clean-pro/css/learn.css
```

**Include in template**:
```html
{{ require_css(get_asset_url("../css/learn.css")) }}
```

#### 4. Upload and Test

```bash
hs upload clean-pro/templates/learn/landing.html clean-pro/templates/learn/landing.html
hs upload clean-pro/css/learn.css clean-pro/css/learn.css
```

#### 5. Create Page in HubSpot

**Via HubSpot UI**:
1. Content > Website Pages > Create
2. Select template: `learn/landing.html`
3. Set URL: `/learn-preview` (for testing)
4. Set status: Draft
5. Preview and test

### Acceptance Criteria

- [ ] Landing template created in Clean.Pro
- [ ] Uses Clean.Pro base layout
- [ ] Custom learn modules integrated
- [ ] HubDB queries for pathways and modules
- [ ] Responsive grid layouts
- [ ] Search/filter UI (static)
- [ ] Uploaded to HubSpot
- [ ] Preview page created and tested
- [ ] PR created

### Git Workflow

```bash
git checkout -b feature/learn-landing

# Work on template...

git add clean-pro/templates/learn/landing.html
git add clean-pro/css/learn.css
git commit -m "feat: Add /learn landing page template

- Create landing template in Clean.Pro
- HubDB integration for pathways and modules
- Responsive grid layouts
- Custom learn CSS

Template ready for content population.

Closes #1"

git push -u origin feature/learn-landing

gh pr create --title "feat: Learning Portal Landing Page" \
  --body "Creates /learn landing page template in Clean.Pro.

Features:
- Hero section
- Pathways grid (HubDB)
- Modules grid (HubDB)
- Search/filter UI (static)

Tested at /learn-preview

Closes #1" \
  --base main
```

---

## Work Packet #3: Module Detail Template

**Priority**: P0
**Estimated**: 2-3 days
**Branch**: `feature/module-detail`
**Depends on**: Work Packet #1

### Context

Create module detail template at `/learn/module/{slug}` using Clean.Pro + custom tab navigation and code blocks.

### Tasks

#### 1. Create Template File

**Location**: `clean-pro/templates/learn/module-detail.html`

```bash
touch clean-pro/templates/learn/module-detail.html
```

#### 2. Implement Module Detail Page

**Template structure**:
- Clean.Pro base layout
- Breadcrumbs
- Module header (title, metadata)
- **Tab navigation module** (Lab, Concepts, Resources)
- **Code block modules** within Lab tab
- Sidebar with module info
- Previous/Next navigation

**Use tab navigation module**:
```html
{% module "learn_tabs"
  path="@marketplace/clean-pro/modules/learn/tab-navigation"
  lab_content=content.lab_content
  concepts_content=content.concepts_content
  resources_content=content.resources_content
%}
```

**Use code block module** (within lab_content):
```html
{% module "code_block"
  path="@marketplace/clean-pro/modules/learn/code-block"
  language="bash"
  code=content.code_example
%}
```

#### 3. Add Module-Specific CSS

Update `clean-pro/css/learn.css` with module detail styles

#### 4. HubDB Integration

Fetch module data by slug:
```html
{% set module_table = hubdb_table_rows(MODULE_TABLE_ID, "slug=" ~ request.path_parts[-1]) %}
{% if module_table %}
  {% set module = module_table[0] %}
  <!-- Use module data -->
{% endif %}
```

#### 5. Upload and Test

```bash
hs upload clean-pro/templates/learn/module-detail.html clean-pro/templates/learn/module-detail.html
hs upload clean-pro/css/learn.css clean-pro/css/learn.css
```

#### 6. Create Test Page

**Via HubSpot UI**:
1. Create page with `learn/module-detail.html` template
2. URL: `/learn/module/intro-to-kubernetes-preview`
3. Status: Draft
4. Add sample content from `content/modules/intro-to-kubernetes/`
5. Preview and test tabs, code blocks

### Acceptance Criteria

- [ ] Module detail template created
- [ ] Tab navigation works (Lab, Concepts, Resources)
- [ ] Code blocks render with syntax highlighting
- [ ] Copy buttons work
- [ ] Breadcrumbs functional
- [ ] Sidebar shows metadata
- [ ] Previous/Next navigation
- [ ] Mobile responsive
- [ ] Preview page tested
- [ ] PR created

### Git Workflow

```bash
git checkout -b feature/module-detail

git add clean-pro/templates/learn/module-detail.html
git add clean-pro/css/learn.css
git commit -m "feat: Add module detail page template

- Create module detail template in Clean.Pro
- Integrate tab navigation module
- Code block modules for lab examples
- HubDB integration for module data
- Breadcrumbs and navigation

Template ready for module content.

Closes #2"

git push -u origin feature/module-detail

gh pr create --title "feat: Module Detail Page Template" \
  --body "Creates /learn/module/{slug} template in Clean.Pro.

Features:
- Tab navigation (Lab/Concepts/Resources)
- Code syntax highlighting
- Copy to clipboard
- Module metadata sidebar
- Previous/Next navigation
- Breadcrumbs

Tested at /learn/module/intro-to-kubernetes-preview

Closes #2" \
  --base main
```

---

## Work Packet #4: HubDB Setup and Content Population

**Priority**: P1
**Estimated**: 1-2 days
**Branch**: `feature/hubdb-content`

### Context

Create HubDB tables and populate with initial learning content from `content/modules/`.

### Tasks

#### 1. Create HubDB Tables (Manual in HubSpot UI)

**Via HubSpot**: Content > HubDB > Create table

**Table 1: learning_pathways**
- `title` (Text)
- `slug` (Text)
- `description` (Rich Text)
- `icon_url` (URL)
- `module_count` (Number)
- `estimated_hours` (Number)
- `display_order` (Number)

**Table 2: learning_modules**
- `title` (Text)
- `slug` (Text)
- `description` (Rich Text)
- `difficulty` (Select: beginner, intermediate, advanced)
- `estimated_minutes` (Number)
- `tags` (Text)
- `lab_content` (Rich Text)
- `concepts_content` (Rich Text)
- `resources_content` (Rich Text)
- `display_order` (Number)

#### 2. Note Table IDs

After creating tables, note the IDs (visible in URL):
- `learning_pathways`: Table ID ________
- `learning_modules`: Table ID ________

#### 3. Update Templates with Table IDs

Update `landing.html` and `module-detail.html` with real table IDs:
```html
{% set pathways = hubdb_table_rows(YOUR_PATHWAY_TABLE_ID) %}
{% set modules = hubdb_table_rows(YOUR_MODULE_TABLE_ID) %}
```

#### 4. Populate Module Data

Use content from `content/modules/*/meta.json` and `README.md`:

**For each module**:
1. Go to HubDB table
2. Add row
3. Fill data from meta.json:
   - Title, slug, description, difficulty, estimated_minutes, tags
4. Copy lab/concepts/resources content from README.md
5. Set display_order

**Modules to add**:
- intro-to-kubernetes (order: 1)
- kubernetes-storage (order: 2)
- kubernetes-networking (order: 3)

#### 5. Publish Tables

In HubDB, click **Publish** for both tables

#### 6. Test Dynamic Content

Verify:
- Landing page shows all 3 modules
- Module detail pages pull correct content
- Filtering/sorting works

### Acceptance Criteria

- [ ] HubDB tables created
- [ ] Tables published
- [ ] 3 modules populated
- [ ] Template IDs updated
- [ ] Landing page shows dynamic data
- [ ] Module pages show dynamic data
- [ ] Documentation updated with table IDs

### Git Workflow

```bash
git checkout -b feature/hubdb-content

# Update template files with table IDs
git add clean-pro/templates/learn/

# Document table IDs
echo "# HubDB Table IDs

learning_pathways: [YOUR_ID]
learning_modules: [YOUR_ID]" > docs/hubdb-table-ids.md

git add docs/hubdb-table-ids.md
git commit -m "feat: Populate HubDB with learning content

- Created learning_pathways and learning_modules tables
- Populated 3 Kubernetes modules
- Updated templates with real table IDs
- Documented table IDs

Content now dynamic from HubDB.

Relates to #4"

git push -u origin feature/hubdb-content

gh pr create --title "feat: HubDB Content Population" \
  --body "Sets up HubDB tables and populates with learning content.

Tables created:
- learning_pathways
- learning_modules (3 modules)

Templates updated with real table IDs.
Landing and detail pages now pull from HubDB.

Relates to #4" \
  --base main
```

---

## Execution Order

1. **Work Packet #1** - Custom modules (FIRST - blocks others)
2. **Work Packets #2 & #3** - Templates (can be parallel after #1)
3. **Work Packet #4** - HubDB content (after templates)

---

## Manual Steps (Project Lead - In Browser)

After Work Packets complete:

### 1. Create HubDB Tables (30 min)
- Content > HubDB
- Create tables as specified in Work Packet #4
- Note table IDs

### 2. Populate HubDB (30 min)
- Add 3 module rows
- Copy content from `content/modules/`
- Publish tables

### 3. Create Preview Pages (30 min)
- Content > Website Pages
- Create `/learn-preview` with landing template
- Create `/learn/module/intro-to-kubernetes-preview` with module template
- Set status: Draft
- Test

### 4. Verify and Publish (15 min)
- Test all functionality
- Change URLs to production (`/learn`, `/learn/module/{slug}`)
- Change status to Published

**Total manual time**: ~2 hours

---

## Notes for Coding Agent

- We're extending Clean.Pro, NOT creating a separate theme
- All work goes into `clean-pro/` folder structure
- Use `hs upload clean-pro clean-pro` to upload
- Test modules individually before integrating into templates
- Follow Clean.Pro conventions and styling
- Mobile responsive is required
- Document all custom HubL variables

---

## Success Criteria

Sprint 1 complete when:
- ✅ All custom modules created and working
- ✅ Landing page template functional
- ✅ Module detail template functional
- ✅ HubDB tables populated
- ✅ Preview pages tested
- ✅ All PRs merged
- ✅ Ready for production publish
