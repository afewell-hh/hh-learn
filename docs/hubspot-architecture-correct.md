# HubSpot Architecture - Correct Understanding (2025)

**Based on comprehensive research of HubSpot documentation as of October 2025**

---

## Critical Understanding: Two Separate Systems

HubSpot has **TWO SEPARATE development workflows** that should NOT be confused:

### 1. Developer Projects (Apps) - platformVersion 2025.2
### 2. CMS Themes (Website Content)

They are **completely different**, use **different commands**, and serve **different purposes**.

---

## System 1: Developer Projects (Apps)

**Purpose:** Build HubSpot apps with API integrations, workflow actions, webhooks, agent tools

**What it's for:**
- API authentication (apps that call HubSpot APIs)
- Custom workflow actions
- Webhooks (receiving events from HubSpot)
- Agent tools for Breeze AI
- App cards and UI extensions
- Custom integrations

**CLI Commands:**
- `hs project create` - Create new app project
- `hs project upload` - Upload app to HubSpot
- `hs project dev` - Watch and auto-upload app changes

**Where it goes:**
- Developer Projects section in HubSpot
- View at: https://app.hubspot.com/developer-projects/ACCOUNT_ID

**Configuration:**
- `hsproject.json` - Project metadata
- `src/app/app-hsmeta.json` - App configuration
- `platformVersion: "2025.2"` - Platform version

**What you CAN'T do:**
- ❌ Create website pages
- ❌ Build page templates
- ❌ Create content for Content > Website Pages
- ❌ Upload themes

**Our use case:**
- ✅ We need this for API authentication
- ✅ AWS Lambda will use the app's access token to call HubSpot APIs
- ✅ Already created correctly: `app-hedgehog-learn-dev`

---

## System 2: CMS Themes (Website Content)

**Purpose:** Build website themes with templates for content creators to make pages

**What it's for:**
- Website page templates
- Landing page templates
- Blog templates
- Email templates
- Custom modules
- Theme CSS/JS
- Content for Content > Website Pages

**CLI Commands:**
- `hs create website-theme my-theme` - Create theme boilerplate
- `hs upload my-theme my-theme` - Upload to Design Manager
- `hs watch my-theme my-theme` - Auto-upload changes
- `hs fetch` - Download from Design Manager

**Where it goes:**
- Design Manager (the developer file system)
- View at: Content > Design Manager

**Configuration:**
- `theme.json` - Theme metadata
- `fields.json` - Theme configuration fields
- Template files (HTML + HubL)
- Modules, CSS, JS

**Workflow for content creators:**
1. Developer uploads theme to Design Manager
2. Theme becomes available in Content > Website Pages
3. Content creator clicks "Create" → "Website page"
4. Selects template from theme
5. Edits content in WYSIWYG editor
6. Publishes page

**Our use case:**
- ✅ We need this for `/learn` landing page
- ✅ We need this for `/learn/module/{slug}` detail pages
- ❌ We did NOT set this up correctly
- ❌ We tried to use Developer Projects for CMS templates (wrong!)

---

## Correct Architecture for Hedgehog Learn

### Component 1: Developer Project (App) ✅ DONE

**Purpose:** API authentication for AWS Lambda

**What:**
- App with static auth
- Access token for HubSpot APIs
- Scopes: oauth, contacts, CRM, HubDB, behavioral events, content

**Already created:**
- Project: `hedgehog-learn-dev`
- Location: https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev
- Access token: Configured in `.env`

**Used by:**
- AWS Lambda functions
- Calling HubSpot APIs (HubDB, CRM, events)

**Status:** ✅ Correct and complete

---

### Component 2: CMS Theme ❌ TO DO

**Purpose:** Templates for website pages

**What we need:**
- Landing page template (`/learn`)
- Module detail template (`/learn/module/{slug}`)
- Pathway template (`/learn/pathway/{slug}`)
- Reusable modules (cards, navigation, etc.)
- Theme CSS and JavaScript

**Correct workflow:**

#### Step 1: Create Theme Boilerplate
```bash
hs create website-theme hedgehog-learn-theme
```

This creates:
```
hedgehog-learn-theme/
├── theme.json
├── fields.json
├── templates/
│   ├── home.html
│   ├── page.html
│   └── ...
├── modules/
├── css/
│   └── main.css
└── js/
    └── main.js
```

#### Step 2: Customize Templates

Create our templates in `hedgehog-learn-theme/templates/`:
- `learn-landing.html` - Landing page
- `module-detail.html` - Module page
- `pathway-detail.html` - Pathway page

Create modules in `hedgehog-learn-theme/modules/`:
- `pathway-card/` - Pathway card module
- `module-card/` - Module card module
- `tab-navigation/` - Tab navigation

Add CSS in `hedgehog-learn-theme/css/`:
- `theme.css` - Base styles
- `components.css` - Component styles

#### Step 3: Upload to HubSpot

```bash
# Upload theme to Design Manager
hs upload hedgehog-learn-theme hedgehog-learn-theme

# Or watch for changes
hs watch hedgehog-learn-theme hedgehog-learn-theme
```

#### Step 4: Activate Theme (in HubSpot UI)

1. Go to **Settings → Website → Themes**
2. Find `hedgehog-learn-theme`
3. Click **"Make active"**

#### Step 5: Create Pages (in HubSpot UI)

1. Go to **Content → Website Pages**
2. Click **"Create"** → **"Website page"**
3. Select template: `learn-landing.html`
4. Set URL: `/learn` (or `/learn-preview` for testing)
5. Set status: **Draft** (for preview)
6. Add content
7. Click **"Publish"** when ready

**Status:** ❌ Not done - need to create and upload theme

---

## What We Did Wrong

### Mistake 1: Mixed up Developer Projects and CMS Themes

We thought `hs project upload` would upload CMS templates.

**Reality:**
- `hs project upload` → Uploads apps to Developer Projects
- `hs upload` → Uploads themes/templates to Design Manager

### Mistake 2: Created CMS files in wrong location

We created `src/cms/` inside the Developer Project.

**Reality:**
- Developer Projects don't contain CMS themes
- CMS themes are separate directory structures
- Use `hs create website-theme` to generate proper structure

### Mistake 3: Wrong documentation in work packets

Work packets told coding agent to use `npm run cms:upload` which ran `hs project upload`.

**Reality:**
- Should be: `hs upload hedgehog-learn-theme hedgehog-learn-theme`
- Not: `hs project upload`

---

## Work Done So Far: Audit

### ✅ Usable Work (Keep):

1. **Developer Project/App**
   - `src/app/app-hsmeta.json` - App configuration ✅
   - `hsproject.json` - Project config ✅
   - Access token obtained ✅
   - Scopes configured ✅

2. **Documentation**
   - `docs/ROADMAP.md` - Project roadmap ✅
   - `docs/adr-*.md` - Architecture decisions ✅
   - `AGENTS.md` - Agent rules ✅

3. **Infrastructure**
   - `serverless.yml` - AWS Lambda config ✅
   - `src/api/lambda/` - Lambda skeleton ✅
   - `hubdb-schemas/` - HubDB table definitions ✅

4. **Content**
   - `content/modules/` - 3 complete Kubernetes modules ✅
   - Markdown with labs, concepts, resources ✅
   - High quality technical writing ✅

### ❌ Unusable Work (Redo):

1. **CMS Directory Structure**
   - `src/cms/` - Wrong location ❌
   - Should be separate theme directory ❌

2. **Templates**
   - `src/cms/templates/` - Wrong approach ❌
   - Need proper theme boilerplate ❌

3. **CSS**
   - `src/cms/css/theme.css` - Can be reused but in wrong location ❌

4. **Modules**
   - `src/cms/modules/` - Wrong structure ❌
   - Need proper module format ❌

5. **npm Scripts**
   - `cms:upload` runs `hs project upload` - Wrong command ❌
   - Should run `hs upload theme theme` ❌

6. **Documentation**
   - `docs/cms-development.md` - Incorrect workflow ❌
   - `docs/sprint1-work-packets.md` - Wrong instructions ❌

### 🔄 Salvageable (Move/Adapt):

1. **CSS** - Can copy to new theme
2. **Template HTML** - Can adapt to theme structure
3. **Module concepts** - Can recreate in proper format
4. **Sample data** - Can use with new templates

---

## Corrected Workflow for Sprint 1

### Phase 1: Set Up CMS Theme (NEW - Top Priority)

**Work Packet 1A: Create Theme Boilerplate**
```bash
# Create theme from boilerplate
hs create website-theme hedgehog-learn-theme

# Review generated structure
cd hedgehog-learn-theme
tree
```

**Work Packet 1B: Customize Theme**
- Copy/adapt CSS from `src/cms/css/theme.css`
- Create `templates/learn-landing.html`
- Create `templates/module-detail.html`
- Create modules in proper format

**Work Packet 1C: Upload Theme**
```bash
# Upload to Design Manager
hs upload hedgehog-learn-theme hedgehog-learn-theme

# Verify in HubSpot: Content > Design Manager
```

**Work Packet 1D: Activate Theme**
- Settings → Website → Themes
- Make hedgehog-learn-theme active

### Phase 2: Create Pages (Human - in HubSpot UI)

- Content → Website Pages → Create
- Select templates from hedgehog-learn-theme
- Add content
- Publish when ready

---

## Correct Repository Structure

```
hedgehog-learn/
├── hsproject.json              # Developer Project config
├── src/
│   ├── app/                    # Developer Project (App)
│   │   └── app-hsmeta.json    # App metadata & scopes
│   ├── api/
│   │   └── lambda/            # AWS Lambda functions
│   └── shared/                # Shared code
├── hedgehog-learn-theme/       # CMS Theme (SEPARATE)
│   ├── theme.json             # Theme metadata
│   ├── fields.json            # Theme fields
│   ├── templates/             # Page templates
│   ├── modules/               # Custom modules
│   ├── css/                   # Theme CSS
│   └── js/                    # Theme JS
├── content/
│   └── modules/               # Learning content (markdown)
├── hubdb-schemas/             # HubDB table schemas
└── docs/                      # Documentation
```

---

## CLI Commands Reference

### Developer Projects (Apps)
```bash
# Create app
hs project create

# Upload app
hs project upload

# Watch app
hs project dev

# Open in browser
hs project open
```

### CMS Themes
```bash
# Create theme
hs create website-theme my-theme

# Upload theme to Design Manager
hs upload my-theme my-theme

# Watch theme for changes
hs watch my-theme my-theme

# Fetch theme from Design Manager
hs fetch my-theme my-theme
```

### Account Management
```bash
# Authenticate
hs account auth

# List accounts
hs account list

# Switch account
hs account use
```

---

## Key Takeaways

1. **Developer Projects ≠ CMS Themes** - Completely different systems
2. **`hs project` ≠ `hs upload`** - Different commands for different purposes
3. **Apps provide auth tokens** - Not website content
4. **Themes provide templates** - For content creators to make pages
5. **We need BOTH** - App for API auth, Theme for website pages
6. **Templates go to Design Manager** - Not Developer Projects
7. **Pages created in Content > Website Pages** - Using templates from themes

---

## Next Steps

1. Create CMS theme using correct workflow
2. Update work packets with accurate instructions
3. Audit PRs #7, #8, #9 - extract salvageable content
4. Create new Sprint 1 issues with correct approach
5. Document for future agents to avoid same mistakes
