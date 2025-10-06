# Sprint 1 - Work Packets for Coding Agent

All tasks are CLI-based and can be executed by the coding agent autonomously.

---

## Work Packet #1: HubSpot CMS Development Environment Setup
**Issue:** #3
**Branch:** `feature/cms-dev-setup`
**Priority:** P0 - BLOCKING (must be done first)
**Estimated:** 1-2 days

### Context
We need to set up local HubSpot CMS development using the HubSpot CLI. The project uses platformVersion 2025.2 with Clean.Pro theme as a base.

### Prerequisites
- ✅ HubSpot CLI v7.7.0+ installed
- ✅ HubSpot account authenticated (`hs account auth` - already done)
- ✅ `hsproject.json` already exists with platformVersion 2025.2

### Tasks (CLI-based)

#### 1. Create CMS directory structure
```bash
mkdir -p src/cms/{templates,modules,css,js}
mkdir -p src/cms/templates/learn
mkdir -p src/cms/modules/learn/{landing-hero,module-card,pathway-card,tab-navigation}
mkdir -p content/modules
```

#### 2. Create theme configuration
Create `src/cms/theme.json`:
```json
{
  "name": "Hedgehog Learn Theme",
  "path": "src/cms",
  "version": "1.0.0",
  "author": "Hedgehog Cloud",
  "preview_path": "",
  "screenshot_path": "",
  "enable_domain_stylesheets": false
}
```

#### 3. Create base CSS structure
Create `src/cms/css/theme.css` with:
- CSS variables for colors matching hedgehog.cloud
- Base typography styles
- Grid/layout utilities
- Responsive breakpoints

#### 4. Update package.json scripts
Add CMS development scripts:
```json
{
  "scripts": {
    "cms:watch": "hs project dev",
    "cms:upload": "hs project upload",
    "cms:fetch": "hs project fetch"
  }
}
```

#### 5. Create `.hsignore` file
Ignore unnecessary files from HubSpot uploads:
```
node_modules/
.git/
.env
*.log
dist/
tests/
docs/
infra/
content/
```

#### 6. Test upload
```bash
npm run cms:upload
```

#### 7. Document setup process
Create `docs/cms-development.md` with:
- Local development workflow
- How to create new templates/modules
- How to upload/deploy
- Troubleshooting tips

### Acceptance Criteria
- [ ] CMS directory structure created
- [ ] Base CSS/theme files created
- [ ] npm scripts work (`npm run cms:watch`, `npm run cms:upload`)
- [ ] Successfully uploaded to HubSpot (no errors)
- [ ] Documentation complete in `docs/cms-development.md`
- [ ] All changes committed to feature branch
- [ ] PR created with screenshots of successful upload

### Commands to Execute
```bash
# 1. Create branch
git checkout -b feature/cms-dev-setup

# 2. Create directory structure
mkdir -p src/cms/{templates,modules,css,js}
mkdir -p src/cms/templates/learn
mkdir -p src/cms/modules/learn/{landing-hero,module-card,pathway-card,tab-navigation}
mkdir -p content/modules

# 3. Create configuration files
# (create theme.json, .hsignore, update package.json)

# 4. Create base CSS
# (create theme.css with variables and utilities)

# 5. Test upload
npm run cms:upload

# 6. Create documentation
# (write docs/cms-development.md)

# 7. Commit and push
git add .
git commit -m "[Sprint 1] Set up HubSpot CMS development environment"
git push origin feature/cms-dev-setup

# 8. Create PR
gh pr create --title "[Sprint 1] Set up HubSpot CMS development environment" \
  --body "Closes #3" \
  --base main
```

### Testing Instructions (for human reviewer)
1. Pull branch
2. Run `npm run cms:upload`
3. Verify files appear in HubSpot Design Manager
4. Check documentation is clear

---

## Work Packet #2: Landing Page Template
**Issue:** #1
**Branch:** `feature/landing-page`
**Priority:** P0
**Depends on:** Work Packet #1
**Estimated:** 2-3 days

### Context
Create the main learning portal landing page at `/learn` showing featured pathways and modules.

### Tasks (CLI-based)

#### 1. Create landing page template
Create `src/cms/templates/learn/landing.html`:
```html
{% extends "./layouts/base.html" %}

{% block body %}
<div class="learn-landing">
  <!-- Hero section -->
  <section class="hero">
    <h1>{{ content.hero_title }}</h1>
    <p>{{ content.hero_subtitle }}</p>
    <a href="#modules" class="btn-primary">Browse Modules</a>
  </section>

  <!-- Featured pathways -->
  <section class="pathways">
    <h2>Learning Pathways</h2>
    <div class="pathway-grid">
      {% for pathway in content.featured_pathways %}
        {% module "pathway-card" pathway=pathway %}
      {% endfor %}
    </div>
  </section>

  <!-- Module list -->
  <section class="modules">
    <h2>All Modules</h2>
    <!-- Search/filter placeholder -->
    <div class="search-bar">
      <input type="text" placeholder="Search modules...">
      <select>
        <option>All Levels</option>
        <option>Beginner</option>
        <option>Intermediate</option>
        <option>Advanced</option>
      </select>
    </div>
    <div class="module-grid">
      {% for module in content.modules %}
        {% module "module-card" module=module %}
      {% endfor %}
    </div>
  </section>
</div>
{% endblock %}
```

#### 2. Create pathway-card module
Create `src/cms/modules/learn/pathway-card/module.html`:
```html
<div class="pathway-card">
  <div class="pathway-icon">
    {% if module.icon_url %}
      <img src="{{ module.icon_url }}" alt="{{ module.title }}">
    {% endif %}
  </div>
  <h3>{{ module.title }}</h3>
  <p>{{ module.description }}</p>
  <div class="pathway-meta">
    <span class="time">{{ module.estimated_minutes }} min</span>
    <span class="modules">{{ module.module_count }} modules</span>
  </div>
  <a href="/learn/pathway/{{ module.slug }}" class="btn-secondary">Start Pathway</a>
</div>
```

Create `src/cms/modules/learn/pathway-card/meta.json`:
```json
{
  "label": "Pathway Card",
  "css_assets": [],
  "external_js": [],
  "js_assets": [],
  "other_assets": [],
  "smart_type": "NOT_SMART",
  "tags": ["learn"],
  "is_available_for_new_content": true
}
```

#### 3. Create module-card module
Create `src/cms/modules/learn/module-card/module.html`:
```html
<div class="module-card">
  <div class="module-header">
    <span class="badge badge-{{ module.difficulty }}">{{ module.difficulty }}</span>
    <span class="time">{{ module.estimated_minutes }} min</span>
  </div>
  <h3>{{ module.title }}</h3>
  <p>{{ module.description }}</p>
  <div class="module-tags">
    {% for tag in module.tags %}
      <span class="tag">{{ tag }}</span>
    {% endfor %}
  </div>
  <a href="/learn/module/{{ module.slug }}" class="btn-tertiary">View Module</a>
</div>
```

Create `src/cms/modules/learn/module-card/meta.json` (similar structure)

#### 4. Create landing page CSS
Create `src/cms/css/landing.css` with styles for:
- Hero section (gradient background, centered content)
- Pathway grid (3 columns desktop, responsive)
- Module grid (4 columns desktop, responsive)
- Cards (hover effects, shadows)
- Search/filter bar
- Buttons and CTAs

#### 5. Create sample data file
Create `content/landing-sample-data.json`:
```json
{
  "hero_title": "Learn Hedgehog Cloud",
  "hero_subtitle": "Hands-on labs and courses for cloud infrastructure",
  "featured_pathways": [
    {
      "title": "Kubernetes Fundamentals",
      "slug": "kubernetes-fundamentals",
      "description": "Master the basics of Kubernetes",
      "estimated_minutes": 120,
      "module_count": 5
    }
  ],
  "modules": [
    {
      "title": "Intro to Kubernetes",
      "slug": "intro-to-kubernetes",
      "description": "Learn Kubernetes basics",
      "difficulty": "beginner",
      "estimated_minutes": 30,
      "tags": ["kubernetes", "containers"]
    }
  ]
}
```

#### 6. Upload and test
```bash
npm run cms:upload
# Visit HubSpot Design Manager to create page using template
```

#### 7. Document component usage
Update `docs/components.md` with:
- Pathway card props
- Module card props
- Usage examples

### Acceptance Criteria
- [ ] Landing template created with all sections
- [ ] Pathway card module created and reusable
- [ ] Module card module created and reusable
- [ ] CSS styling complete and responsive
- [ ] Sample data provided for testing
- [ ] Successfully uploaded to HubSpot
- [ ] Documentation updated
- [ ] PR created with screenshots

### Commands
```bash
git checkout -b feature/landing-page
# Create files...
npm run cms:upload
git add .
git commit -m "[Sprint 1] Create /learn landing page template"
git push origin feature/landing-page
gh pr create --title "[Sprint 1] Create /learn landing page" --body "Closes #1" --base main
```

---

## Work Packet #3: Module Detail Template
**Issue:** #2
**Branch:** `feature/module-template`
**Priority:** P0
**Depends on:** Work Packet #1
**Estimated:** 3-4 days

### Context
Create the module detail page at `/learn/module/{slug}` with tabbed content layout.

### Tasks (CLI-based)

#### 1. Create module template
Create `src/cms/templates/learn/module-detail.html`:
```html
{% extends "./layouts/base.html" %}

{% block body %}
<div class="module-detail">
  <!-- Breadcrumb -->
  <nav class="breadcrumb">
    <a href="/learn">Learn</a> /
    <a href="/learn/pathway/{{ module.pathway_slug }}">{{ module.pathway_name }}</a> /
    <span>{{ module.title }}</span>
  </nav>

  <div class="module-layout">
    <!-- Main content area -->
    <div class="module-content">
      <header>
        <h1>{{ module.title }}</h1>
        <div class="module-meta-inline">
          <span class="badge badge-{{ module.difficulty }}">{{ module.difficulty }}</span>
          <span class="time">{{ module.estimated_minutes }} min</span>
        </div>
      </header>

      <!-- Tab navigation -->
      <div class="tabs">
        <button class="tab-btn active" data-tab="lab">Lab</button>
        <button class="tab-btn" data-tab="concepts">Concepts</button>
        <button class="tab-btn" data-tab="resources">Resources</button>
      </div>

      <!-- Tab content -->
      <div class="tab-content active" id="lab-content">
        <div class="lab-steps">
          {{ module.lab_markdown|markdown }}
        </div>
      </div>

      <div class="tab-content" id="concepts-content">
        <div class="concepts">
          {{ module.concepts_markdown|markdown }}
        </div>
      </div>

      <div class="tab-content" id="resources-content">
        <div class="resources">
          <ul>
            {% for resource in module.resources %}
              <li><a href="{{ resource.url }}" target="_blank">{{ resource.title }}</a></li>
            {% endfor %}
          </ul>
        </div>
      </div>

      <!-- Navigation -->
      <div class="module-nav">
        {% if module.prev_module %}
          <a href="/learn/module/{{ module.prev_module.slug }}" class="btn-secondary">← Previous</a>
        {% endif %}
        {% if module.next_module %}
          <a href="/learn/module/{{ module.next_module.slug }}" class="btn-primary">Next →</a>
        {% endif %}
      </div>
    </div>

    <!-- Sidebar -->
    <aside class="module-sidebar">
      <div class="sidebar-section">
        <h4>Module Info</h4>
        <dl>
          <dt>Difficulty</dt>
          <dd>{{ module.difficulty }}</dd>
          <dt>Estimated Time</dt>
          <dd>{{ module.estimated_minutes }} minutes</dd>
          <dt>Version</dt>
          <dd>{{ module.version }}</dd>
          <dt>Validated</dt>
          <dd>{{ module.validated_on|datetimeformat('%B %Y') }}</dd>
        </dl>
      </div>

      <div class="sidebar-section">
        <h4>Tags</h4>
        <div class="tags">
          {% for tag in module.tags %}
            <span class="tag">{{ tag }}</span>
          {% endfor %}
        </div>
      </div>
    </aside>
  </div>
</div>
{% endblock %}
```

#### 2. Create tab navigation JavaScript
Create `src/cms/js/tabs.js`:
```javascript
document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Remove active classes
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active classes
      btn.classList.add('active');
      document.getElementById(`${tabId}-content`).classList.add('active');
    });
  });

  // Add copy buttons to code blocks
  document.querySelectorAll('pre code').forEach(block => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.onclick = () => {
      navigator.clipboard.writeText(block.textContent);
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    };
    block.parentElement.appendChild(btn);
  });
});
```

#### 3. Create module detail CSS
Create `src/cms/css/module-detail.css` with styles for:
- Two-column layout (content + sidebar)
- Tab navigation (active states, animations)
- Markdown content styling
- Code blocks with copy button
- Sidebar sections
- Responsive mobile layout (sidebar below content)

#### 4. Create sample module data
Create `content/modules/intro-to-kubernetes.json`:
```json
{
  "title": "Introduction to Kubernetes",
  "slug": "intro-to-kubernetes",
  "difficulty": "beginner",
  "estimated_minutes": 30,
  "version": "v1.30",
  "validated_on": "2025-10-01",
  "pathway_slug": "kubernetes-fundamentals",
  "pathway_name": "Kubernetes Fundamentals",
  "tags": ["kubernetes", "containers", "orchestration"],
  "lab_markdown": "# Lab: Deploy Your First Pod\n\n## Step 1: Check cluster\n```bash\nkubectl cluster-info\n```\n\n## Step 2: Create pod\n```bash\nkubectl run nginx --image=nginx\n```",
  "concepts_markdown": "# Kubernetes Concepts\n\nKubernetes is...",
  "resources": [
    {"title": "Official Kubernetes Docs", "url": "https://kubernetes.io/docs"}
  ]
}
```

#### 5. Upload and test
```bash
npm run cms:upload
```

#### 6. Document template usage
Update `docs/cms-development.md` with:
- How to create module pages
- Data structure requirements
- Custom HubL filters used

### Acceptance Criteria
- [ ] Module template with working tabs
- [ ] JavaScript for tab switching works
- [ ] Code blocks have copy buttons
- [ ] Sidebar shows metadata
- [ ] Mobile responsive
- [ ] Sample module data provided
- [ ] Successfully uploaded
- [ ] Documentation complete
- [ ] PR with screenshots

### Commands
```bash
git checkout -b feature/module-template
# Create files...
npm run cms:upload
git add .
git commit -m "[Sprint 1] Create module detail template with tabs"
git push origin feature/module-template
gh pr create --title "[Sprint 1] Create module content template" --body "Closes #2" --base main
```

---

## Work Packet #4: Sample Content Creation
**Issue:** #4
**Branch:** `feature/sample-content`
**Priority:** P0
**Estimated:** 2-3 days

### Context
Write 3 complete modules with lab steps, concepts, and resources to populate the site.

### Tasks (CLI-based)

#### Create 3 module markdown files

**Module 1:** `content/modules/intro-to-kubernetes/README.md`
**Module 2:** `content/modules/kubernetes-storage/README.md`
**Module 3:** `content/modules/kubernetes-networking/README.md`

Each with:
- Front matter (yaml)
- Lab steps (detailed, 5-10 steps)
- Concept content (500-1000 words)
- Resources list (3-5 links)

### File Structure
```
content/
  modules/
    intro-to-kubernetes/
      README.md
      meta.json
    kubernetes-storage/
      README.md
      meta.json
    kubernetes-networking/
      README.md
      meta.json
```

### Acceptance Criteria
- [ ] 3 modules written with complete content
- [ ] Markdown properly formatted
- [ ] Code blocks with proper syntax
- [ ] All links verified
- [ ] Committed to repo

### Commands
```bash
git checkout -b feature/sample-content
# Write content...
git add content/
git commit -m "[Sprint 1] Add 3 sample learning modules"
git push origin feature/sample-content
gh pr create --title "[Sprint 1] Create sample module content (3 modules)" --body "Closes #4" --base main
```

---

## Work Packet #5: Component Library
**Issue:** #5
**Branch:** `feature/components`
**Priority:** P1
**Estimated:** 2-3 days

### Context
Create reusable CSS components and style guide for consistent design.

### Tasks (CLI-based)

#### 1. Create component CSS
Create `src/cms/css/components.css` with:
- Card styles
- Badge/tag styles
- Button variants
- Form elements
- Grid utilities

#### 2. Document components
Create `docs/components.md` with:
- Component examples (HTML + CSS)
- Usage guidelines
- Color palette
- Typography scale

### Acceptance Criteria
- [ ] Component CSS created
- [ ] All components documented
- [ ] Used in templates

### Commands
```bash
git checkout -b feature/components
# Create files...
npm run cms:upload
git add .
git commit -m "[Sprint 1] Add shared component library"
git push origin feature/components
gh pr create --title "[Sprint 1] Design and implement shared component library" --body "Closes #5" --base main
```

---

## Execution Order

1. **Work Packet #1** (FIRST - blocks others)
2. **Work Packets #2, #3, #4, #5** (can be done in parallel after #1)

## Notes for Coding Agent

- All work is CLI-based (no GUI required)
- Follow AGENTS.md rules strictly
- Create feature branches for each work packet
- Write tests where applicable
- Update documentation as you go
- Create PRs with descriptive commit messages
- Ask for clarification if anything is unclear
