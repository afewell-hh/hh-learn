# Sprint 1 Work Packets - CORRECTED (2025-10-06)

**Status**: 🔄 Active - Corrected after research
**Sprint Goal**: Create HubSpot CMS templates for public learning content
**Related Issues**: #1 (Landing Page), #2 (Module Detail), #5 (Component Library)

---

## ⚠️ CRITICAL: Read This First

**Previous work packets were INCORRECT** due to confusion between:
- ❌ **Developer Projects** (`hs project` commands) - For apps, NOT templates
- ✅ **CMS Themes** (`hs upload` commands) - For website templates

**Before starting ANY work packet**:
1. Read `docs/hubspot-architecture-correct.md` completely
2. Understand the difference between Developer Projects and CMS Themes
3. Never use `hs project upload` for templates - it goes to the wrong place

---

## Work Packet 1: Create HubSpot CMS Theme Structure

**Objective**: Set up proper HubSpot CMS theme using correct workflow

**Prerequisites**:
- ✅ HubSpot CLI installed and authenticated (`hs account list` should show active account)
- ✅ `.env` file with `HUBSPOT_ACCOUNT_ID=21430285`
- ✅ Read `docs/hubspot-architecture-correct.md`

**Instructions**:

### Step 1: Create Theme Boilerplate

```bash
# Navigate to project root
cd /home/ubuntu/afewell-hh/hedgehog-learn

# Create CMS theme using HubSpot boilerplate
hs create website-theme hedgehog-learn-theme

# Review generated structure
cd hedgehog-learn-theme
ls -la
```

**Expected output**: Theme directory created with:
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

### Step 2: Customize Theme Metadata

Edit `hedgehog-learn-theme/theme.json`:

```json
{
  "label": "Hedgehog Learn Theme",
  "author": {
    "name": "Hedgehog Learn Team",
    "email": "dev@hedgehog.cloud",
    "url": "https://hedgehog.cloud"
  },
  "preview_path": "/learn-preview",
  "screenshot_path": "./images/theme-preview.png",
  "enable_domain_stylesheets": false,
  "responsive_breakpoints": [
    {
      "name": "mobile",
      "minWidth": 0,
      "maxWidth": 767
    },
    {
      "name": "tablet",
      "minWidth": 768,
      "maxWidth": 1023
    },
    {
      "name": "desktop",
      "minWidth": 1024
    }
  ]
}
```

### Step 3: Set Up Base CSS

Copy and adapt existing CSS from `src/cms/css/theme.css` to `hedgehog-learn-theme/css/main.css`:

```css
/* Base theme styles - adapted from previous work */
:root {
  --primary-color: #0066CC;
  --secondary-color: #00C896;
  --text-color: #2D3748;
  --bg-color: #FFFFFF;
  --border-color: #E2E8F0;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  --radius: 8px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "SF Mono", Monaco, "Cascadia Code", monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  color: var(--text-color);
  line-height: 1.6;
  background-color: var(--bg-color);
}

/* Container and layout utilities */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Button styles */
.btn-primary {
  background-color: var(--primary-color);
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius);
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #0052A3;
}

/* Card styles */
.card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

### Step 4: Create Base Layout Template

Create `hedgehog-learn-theme/templates/layouts/base.html`:

```html
<!DOCTYPE html>
<html lang="{{ html_lang }}" dir="{{ html_dir }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block page_title %}{{ page_meta.html_title }}{% endblock %}</title>

  {{ standard_header_includes }}

  <!-- Theme CSS -->
  {{ require_css(get_asset_url("../css/main.css")) }}

  {% block extra_css %}{% endblock %}
</head>
<body>
  <!-- HubSpot Header -->
  {% global_partial path='../sections/header.html' %}

  <!-- Main Content -->
  <main>
    {% block body %}{% endblock %}
  </main>

  <!-- HubSpot Footer -->
  {% global_partial path='../sections/footer.html' %}

  {{ standard_footer_includes }}

  {% block extra_js %}{% endblock %}
</body>
</html>
```

### Step 5: Verify Structure

```bash
# From hedgehog-learn-theme/ directory
tree -L 2

# Verify files exist
ls -la theme.json
ls -la templates/layouts/base.html
ls -la css/main.css
```

### Step 6: Initial Upload to HubSpot

```bash
# From project root
cd /home/ubuntu/afewell-hh/hedgehog-learn

# Upload theme to Design Manager
hs upload hedgehog-learn-theme hedgehog-learn-theme

# Expected output: "Upload complete"
```

### Step 7: Verify in HubSpot UI

**Manual verification** (Project Lead should do this):
1. Go to HubSpot: **Content > Design Manager**
2. Look for folder: `hedgehog-learn-theme`
3. Verify files uploaded correctly

**Acceptance Criteria**:
- ✅ Theme created with proper structure
- ✅ `theme.json` customized with Hedgehog Learn branding
- ✅ Base CSS includes variables and utilities
- ✅ Base layout template created
- ✅ Successfully uploaded to HubSpot Design Manager
- ✅ Visible in Content > Design Manager

**Git Workflow**:
```bash
# Create feature branch
git checkout -b feature/cms-theme-setup

# Stage changes
git add hedgehog-learn-theme/

# Commit
git commit -m "feat: Create HubSpot CMS theme with base structure

- Generate theme boilerplate using hs create website-theme
- Customize theme.json with Hedgehog Learn branding
- Add base CSS with design system variables
- Create base layout template
- Upload to HubSpot Design Manager

Relates to #1, #2, #5"

# Push
git push -u origin feature/cms-theme-setup
```

**Create PR** with title: "feat: HubSpot CMS theme setup (CORRECTED)"

---

## Work Packet 2: Landing Page Template

**Objective**: Create `/learn` landing page template with HubDB integration

**Prerequisites**:
- ✅ Work Packet 1 completed and merged
- ✅ Theme uploaded to HubSpot Design Manager
- ✅ Read sections on HubDB in `docs/hubspot-architecture-correct.md`

**Instructions**:

### Step 1: Create Landing Page Template

Create `hedgehog-learn-theme/templates/learn-landing.html`:

```html
{% extends "./layouts/base.html" %}

{% block page_title %}Learn - Hedgehog Cloud{% endblock %}

{% block extra_css %}
{{ require_css(get_asset_url("../css/landing.css")) }}
{% endblock %}

{% block body %}
<div class="learn-landing">

  <!-- Hero Section -->
  <section class="hero">
    <div class="container">
      <h1>{{ module.hero_title|default("Master Cloud Native Technologies") }}</h1>
      <p class="subtitle">{{ module.hero_subtitle|default("Hands-on learning paths for Kubernetes, containers, and cloud infrastructure") }}</p>
      <a href="#pathways" class="btn-primary">Start Learning</a>
    </div>
  </section>

  <!-- Pathways Section -->
  <section class="pathways" id="pathways">
    <div class="container">
      <h2>Learning Pathways</h2>
      <p class="section-intro">Structured learning paths to take you from beginner to expert</p>

      <div class="pathway-grid">
        {% set pathways_table = hubdb_table_rows(1234567, "&orderBy=display_order") %}
        {% for pathway in pathways_table %}
          <div class="pathway-card">
            <div class="pathway-icon">
              {% if pathway.icon_url %}
                <img src="{{ pathway.icon_url }}" alt="{{ pathway.title }} icon">
              {% else %}
                <span class="icon-placeholder">📚</span>
              {% endif %}
            </div>
            <h3>{{ pathway.title }}</h3>
            <p>{{ pathway.description }}</p>
            <div class="pathway-meta">
              <span class="module-count">{{ pathway.module_count }} modules</span>
              <span class="time-estimate">~{{ pathway.estimated_hours }}h</span>
            </div>
            <a href="/learn/pathway/{{ pathway.slug }}" class="btn-secondary">View Pathway</a>
          </div>
        {% endfor %}
      </div>
    </div>
  </section>

  <!-- All Modules Section -->
  <section class="modules" id="modules">
    <div class="container">
      <h2>All Learning Modules</h2>

      <!-- Filters (Static for Phase 1) -->
      <div class="filters">
        <input type="text" id="module-search" placeholder="Search modules..." class="search-input">
        <select id="difficulty-filter" class="filter-select">
          <option value="">All Levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <select id="tag-filter" class="filter-select">
          <option value="">All Topics</option>
          <option value="kubernetes">Kubernetes</option>
          <option value="containers">Containers</option>
          <option value="networking">Networking</option>
          <option value="storage">Storage</option>
        </select>
      </div>

      <!-- Module Cards -->
      <div class="module-grid">
        {% set modules_table = hubdb_table_rows(1234568, "&orderBy=display_order") %}
        {% for module in modules_table %}
          <div class="module-card" data-difficulty="{{ module.difficulty }}" data-tags="{{ module.tags }}">
            <div class="module-header">
              <span class="difficulty-badge difficulty-{{ module.difficulty }}">{{ module.difficulty|title }}</span>
              <span class="time-badge">{{ module.estimated_minutes }} min</span>
            </div>
            <h3>{{ module.title }}</h3>
            <p>{{ module.description }}</p>
            <div class="module-tags">
              {% set tag_list = module.tags|split(",") %}
              {% for tag in tag_list %}
                <span class="tag">{{ tag|trim }}</span>
              {% endfor %}
            </div>
            <a href="/learn/module/{{ module.slug }}" class="btn-outline">Start Module</a>
          </div>
        {% endfor %}
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta">
    <div class="container">
      <h2>Ready to Level Up Your Skills?</h2>
      <p>Join thousands of engineers learning cloud native technologies</p>
      <a href="#pathways" class="btn-primary btn-large">Browse Learning Paths</a>
    </div>
  </section>

</div>
{% endblock %}

{% block extra_js %}
<script>
// Basic client-side filtering (Phase 1 - static only)
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('module-search');
  const difficultyFilter = document.getElementById('difficulty-filter');
  const tagFilter = document.getElementById('tag-filter');
  const moduleCards = document.querySelectorAll('.module-card');

  function filterModules() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedDifficulty = difficultyFilter.value;
    const selectedTag = tagFilter.value;

    moduleCards.forEach(card => {
      const title = card.querySelector('h3').textContent.toLowerCase();
      const description = card.querySelector('p').textContent.toLowerCase();
      const difficulty = card.dataset.difficulty;
      const tags = card.dataset.tags;

      const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
      const matchesDifficulty = !selectedDifficulty || difficulty === selectedDifficulty;
      const matchesTag = !selectedTag || tags.includes(selectedTag);

      card.style.display = (matchesSearch && matchesDifficulty && matchesTag) ? 'block' : 'none';
    });
  }

  searchInput.addEventListener('input', filterModules);
  difficultyFilter.addEventListener('change', filterModules);
  tagFilter.addEventListener('change', filterModules);
});
</script>
{% endblock %}
```

### Step 2: Create Landing Page CSS

Create `hedgehog-learn-theme/css/landing.css`:

```css
/* Landing Page Styles */

/* Hero Section */
.hero {
  background: linear-gradient(135deg, var(--primary-color) 0%, #0052A3 100%);
  color: white;
  padding: 80px 0;
  text-align: center;
}

.hero h1 {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 20px;
  line-height: 1.2;
}

.hero .subtitle {
  font-size: 1.25rem;
  margin-bottom: 32px;
  opacity: 0.95;
}

.hero .btn-primary {
  background-color: var(--secondary-color);
  font-size: 1.1rem;
  padding: 16px 32px;
}

.hero .btn-primary:hover {
  background-color: #00A678;
}

/* Section Layout */
section {
  padding: 60px 0;
}

section h2 {
  font-size: 2.25rem;
  text-align: center;
  margin-bottom: 16px;
}

.section-intro {
  text-align: center;
  font-size: 1.1rem;
  color: #64748B;
  margin-bottom: 48px;
}

/* Pathway Grid */
.pathway-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 32px;
  margin-top: 48px;
}

.pathway-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 32px;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.pathway-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.pathway-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F1F5F9;
  border-radius: 50%;
}

.pathway-icon img {
  max-width: 50px;
  max-height: 50px;
}

.icon-placeholder {
  font-size: 2.5rem;
}

.pathway-card h3 {
  font-size: 1.5rem;
  margin-bottom: 16px;
}

.pathway-meta {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin: 20px 0;
  font-size: 0.9rem;
  color: #64748B;
}

.btn-secondary {
  background-color: white;
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
  padding: 10px 24px;
  border-radius: var(--radius);
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background-color: var(--primary-color);
  color: white;
}

/* Filters */
.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.search-input,
.filter-select {
  flex: 1;
  min-width: 200px;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 1rem;
}

.search-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--primary-color);
}

/* Module Grid */
.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.module-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 24px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.module-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.module-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.difficulty-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.difficulty-beginner {
  background: #DCFCE7;
  color: #166534;
}

.difficulty-intermediate {
  background: #FEF3C7;
  color: #854D0E;
}

.difficulty-advanced {
  background: #FEE2E2;
  color: #991B1B;
}

.time-badge {
  color: #64748B;
  font-size: 0.9rem;
}

.module-card h3 {
  font-size: 1.25rem;
  margin-bottom: 12px;
}

.module-card p {
  color: #64748B;
  margin-bottom: 16px;
  line-height: 1.6;
}

.module-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.tag {
  background: #F1F5F9;
  color: #475569;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.btn-outline {
  display: inline-block;
  padding: 10px 20px;
  border: 2px solid var(--primary-color);
  color: var(--primary-color);
  text-decoration: none;
  border-radius: var(--radius);
  font-weight: 600;
  transition: all 0.2s;
}

.btn-outline:hover {
  background-color: var(--primary-color);
  color: white;
}

/* CTA Section */
.cta {
  background: #F8FAFC;
  text-align: center;
  padding: 80px 0;
}

.cta h2 {
  margin-bottom: 16px;
}

.cta p {
  font-size: 1.1rem;
  color: #64748B;
  margin-bottom: 32px;
}

.btn-large {
  font-size: 1.1rem;
  padding: 16px 40px;
}

/* Responsive */
@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }

  .filters {
    flex-direction: column;
  }

  .module-grid,
  .pathway-grid {
    grid-template-columns: 1fr;
  }
}
```

### Step 3: Upload Template

```bash
# From project root
hs upload hedgehog-learn-theme hedgehog-learn-theme

# Watch for changes during development
hs watch hedgehog-learn-theme hedgehog-learn-theme
```

### Step 4: Create HubDB Tables

**NOTE**: HubDB table creation must be done in HubSpot UI (no CLI command available)

**Manual steps** (Project Lead):

1. Go to **Content > HubDB**
2. Create table: `learning_pathways`
   - Columns:
     - `title` (Text)
     - `slug` (Text)
     - `description` (Rich Text)
     - `icon_url` (URL)
     - `module_count` (Number)
     - `estimated_hours` (Number)
     - `display_order` (Number)
3. Create table: `learning_modules`
   - Columns:
     - `title` (Text)
     - `slug` (Text)
     - `description` (Rich Text)
     - `difficulty` (Select: beginner, intermediate, advanced)
     - `estimated_minutes` (Number)
     - `tags` (Text - comma separated)
     - `display_order` (Number)
4. Note the table IDs and update template

### Step 5: Update Template with Real Table IDs

After creating HubDB tables, update `learn-landing.html`:

```html
<!-- Replace placeholder IDs -->
{% set pathways_table = hubdb_table_rows(REAL_PATHWAY_TABLE_ID, "&orderBy=display_order") %}
{% set modules_table = hubdb_table_rows(REAL_MODULE_TABLE_ID, "&orderBy=display_order") %}
```

### Step 6: Test in HubSpot UI

**Manual verification**:
1. Go to **Content > Website Pages**
2. Click **Create > Website page**
3. Select template: `learn-landing.html`
4. Set URL: `/learn-preview` (for testing)
5. Set to **Draft** status
6. Add sample content
7. Click **Preview** to see the page

**Acceptance Criteria**:
- ✅ Template appears in page creation UI
- ✅ Hero section renders correctly
- ✅ HubDB integration works (or shows empty state gracefully)
- ✅ Filters work client-side
- ✅ Responsive design works on mobile
- ✅ Preview URL works: `/learn-preview`

**Git Workflow**:
```bash
git checkout -b feature/landing-page-template
git add hedgehog-learn-theme/templates/learn-landing.html
git add hedgehog-learn-theme/css/landing.css
git commit -m "feat: Create landing page template with HubDB integration

- Add learn-landing.html template with pathway and module sections
- Implement client-side filtering for modules
- Add responsive CSS for landing page
- Integrate with HubDB for dynamic content
- Include hero, pathways, modules, and CTA sections

Closes #1"
git push -u origin feature/landing-page-template
```

---

## Work Packet 3: Module Detail Template

**Objective**: Create `/learn/module/{slug}` template for individual module pages

**Prerequisites**:
- ✅ Work Packets 1 and 2 completed
- ✅ HubDB tables created
- ✅ Sample content available in `content/modules/`

**Instructions**:

### Step 1: Create Module Detail Template

Create `hedgehog-learn-theme/templates/module-detail.html`:

```html
{% extends "./layouts/base.html" %}

{% block page_title %}{{ module.title }} - Learn - Hedgehog Cloud{% endblock %}

{% block extra_css %}
{{ require_css(get_asset_url("../css/module-detail.css")) }}
{{ require_css("https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css") }}
{% endblock %}

{% block body %}
<div class="module-detail">

  <!-- Breadcrumbs -->
  <div class="container">
    <nav class="breadcrumbs">
      <a href="/learn">Learn</a>
      <span class="separator">›</span>
      {% if module.pathway_slug %}
        <a href="/learn/pathway/{{ module.pathway_slug }}">{{ module.pathway_title }}</a>
        <span class="separator">›</span>
      {% endif %}
      <span class="current">{{ module.title }}</span>
    </nav>
  </div>

  <!-- Module Header -->
  <header class="module-header">
    <div class="container">
      <div class="header-content">
        <div class="header-meta">
          <span class="difficulty-badge difficulty-{{ module.difficulty }}">{{ module.difficulty|title }}</span>
          <span class="time-badge">⏱ {{ module.estimated_minutes }} minutes</span>
        </div>
        <h1>{{ module.title }}</h1>
        <p class="module-description">{{ module.description }}</p>
        <div class="module-tags">
          {% set tag_list = module.tags|split(",") %}
          {% for tag in tag_list %}
            <span class="tag">{{ tag|trim }}</span>
          {% endfor %}
        </div>
      </div>
    </div>
  </header>

  <!-- Module Content -->
  <div class="container">
    <div class="module-layout">

      <!-- Sidebar Navigation -->
      <aside class="module-sidebar">
        <div class="sidebar-sticky">
          <h3>Contents</h3>
          <nav class="module-nav">
            <a href="#overview" class="nav-item">Overview</a>
            <a href="#objectives" class="nav-item">Learning Objectives</a>
            <a href="#lab" class="nav-item">Hands-On Lab</a>
            <a href="#concepts" class="nav-item">Key Concepts</a>
            <a href="#resources" class="nav-item">Additional Resources</a>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="module-content">

        <!-- Overview -->
        <section id="overview" class="content-section">
          <h2>Overview</h2>
          {{ content.overview|safe }}
        </section>

        <!-- Learning Objectives -->
        <section id="objectives" class="content-section">
          <h2>Learning Objectives</h2>
          <ul class="objectives-list">
            {% for objective in content.objectives %}
              <li>{{ objective }}</li>
            {% endfor %}
          </ul>
        </section>

        <!-- Lab Instructions -->
        <section id="lab" class="content-section">
          <h2>Hands-On Lab</h2>

          <div class="lab-info">
            <div class="info-box">
              <h4>Prerequisites</h4>
              <ul>
                {% for prereq in content.prerequisites %}
                  <li>{{ prereq }}</li>
                {% endfor %}
              </ul>
            </div>
            <div class="info-box">
              <h4>Lab Environment</h4>
              <p>{{ content.lab_environment }}</p>
            </div>
          </div>

          {{ content.lab_instructions|safe }}
        </section>

        <!-- Concepts -->
        <section id="concepts" class="content-section">
          <h2>Key Concepts</h2>
          {{ content.concepts|safe }}
        </section>

        <!-- Resources -->
        <section id="resources" class="content-section">
          <h2>Additional Resources</h2>
          <ul class="resources-list">
            {% for resource in content.resources %}
              <li>
                <a href="{{ resource.url }}" target="_blank" rel="noopener">
                  {{ resource.title }}
                </a>
                {% if resource.description %}
                  <span class="resource-desc">- {{ resource.description }}</span>
                {% endif %}
              </li>
            {% endfor %}
          </ul>
        </section>

        <!-- Navigation Footer -->
        <footer class="module-footer">
          <div class="footer-nav">
            {% if module.previous_module %}
              <a href="/learn/module/{{ module.previous_module.slug }}" class="btn-outline">
                ← Previous: {{ module.previous_module.title }}
              </a>
            {% endif %}
            {% if module.next_module %}
              <a href="/learn/module/{{ module.next_module.slug }}" class="btn-primary">
                Next: {{ module.next_module.title }} →
              </a>
            {% endif %}
          </div>
        </footer>

      </main>
    </div>
  </div>

</div>
{% endblock %}

{% block extra_js %}
<!-- Syntax Highlighting -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>

<!-- Smooth Scrolling for Nav -->
<script>
document.addEventListener('DOMContentLoaded', function() {
  // Highlight active section in sidebar
  const navItems = document.querySelectorAll('.module-nav .nav-item');
  const sections = document.querySelectorAll('.content-section');

  function highlightNav() {
    let currentSection = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (window.scrollY >= sectionTop - 100) {
        currentSection = section.getAttribute('id');
      }
    });

    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === `#${currentSection}`) {
        item.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', highlightNav);
  highlightNav();

  // Smooth scroll
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});
</script>
{% endblock %}
```

### Step 2: Create Module Detail CSS

Create `hedgehog-learn-theme/css/module-detail.css`:

```css
/* Module Detail Styles */

/* Breadcrumbs */
.breadcrumbs {
  padding: 20px 0;
  font-size: 0.9rem;
  color: #64748B;
}

.breadcrumbs a {
  color: var(--primary-color);
  text-decoration: none;
}

.breadcrumbs a:hover {
  text-decoration: underline;
}

.breadcrumbs .separator {
  margin: 0 8px;
}

.breadcrumbs .current {
  color: var(--text-color);
}

/* Module Header */
.module-header {
  background: linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%);
  padding: 48px 0;
  border-bottom: 1px solid var(--border-color);
}

.header-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.module-header h1 {
  font-size: 2.5rem;
  margin-bottom: 16px;
  color: var(--text-color);
}

.module-description {
  font-size: 1.25rem;
  color: #475569;
  margin-bottom: 24px;
  line-height: 1.6;
}

/* Module Layout */
.module-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 48px;
  margin: 48px 0;
}

/* Sidebar */
.module-sidebar {
  position: relative;
}

.sidebar-sticky {
  position: sticky;
  top: 24px;
}

.module-sidebar h3 {
  font-size: 1.1rem;
  margin-bottom: 16px;
  color: var(--text-color);
}

.module-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.module-nav .nav-item {
  padding: 8px 12px;
  color: #64748B;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.2s;
}

.module-nav .nav-item:hover {
  background-color: #F1F5F9;
  color: var(--primary-color);
}

.module-nav .nav-item.active {
  background-color: #EFF6FF;
  color: var(--primary-color);
  font-weight: 600;
}

/* Main Content */
.module-content {
  max-width: 800px;
}

.content-section {
  margin-bottom: 64px;
}

.content-section h2 {
  font-size: 2rem;
  margin-bottom: 24px;
  color: var(--text-color);
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 12px;
}

.content-section h3 {
  font-size: 1.5rem;
  margin: 32px 0 16px;
  color: var(--text-color);
}

.content-section h4 {
  font-size: 1.25rem;
  margin: 24px 0 12px;
  color: var(--text-color);
}

.content-section p {
  margin-bottom: 16px;
  line-height: 1.8;
  color: #475569;
}

.content-section ul,
.content-section ol {
  margin-bottom: 16px;
  padding-left: 24px;
}

.content-section li {
  margin-bottom: 8px;
  line-height: 1.8;
}

/* Code Blocks */
.content-section pre {
  background: #2D3748;
  color: #E2E8F0;
  padding: 20px;
  border-radius: var(--radius);
  overflow-x: auto;
  margin-bottom: 24px;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  line-height: 1.6;
}

.content-section code {
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.content-section :not(pre) > code {
  background: #F1F5F9;
  color: #E11D48;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Lab Info Boxes */
.lab-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin: 32px 0;
}

.info-box {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--primary-color);
  padding: 20px;
  border-radius: var(--radius);
}

.info-box h4 {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  color: var(--primary-color);
}

.info-box ul {
  margin: 0;
  padding-left: 20px;
}

.info-box p {
  margin: 0;
}

/* Objectives List */
.objectives-list {
  list-style: none;
  padding: 0;
}

.objectives-list li {
  padding-left: 32px;
  position: relative;
  margin-bottom: 16px;
}

.objectives-list li:before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--secondary-color);
  font-weight: bold;
  font-size: 1.2rem;
}

/* Resources List */
.resources-list {
  list-style: none;
  padding: 0;
}

.resources-list li {
  margin-bottom: 16px;
  padding-left: 24px;
  position: relative;
}

.resources-list li:before {
  content: "→";
  position: absolute;
  left: 0;
  color: var(--primary-color);
}

.resources-list a {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
}

.resources-list a:hover {
  text-decoration: underline;
}

.resource-desc {
  color: #64748B;
  font-size: 0.9rem;
}

/* Module Footer */
.module-footer {
  margin-top: 64px;
  padding-top: 32px;
  border-top: 2px solid var(--border-color);
}

.footer-nav {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

/* Responsive */
@media (max-width: 1024px) {
  .module-layout {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .sidebar-sticky {
    position: static;
  }

  .module-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .module-header h1 {
    font-size: 1.75rem;
  }

  .footer-nav {
    flex-direction: column;
  }

  .lab-info {
    grid-template-columns: 1fr;
  }
}
```

### Step 3: Upload Template

```bash
hs upload hedgehog-learn-theme hedgehog-learn-theme
```

### Step 4: Populate HubDB with Sample Content

**Manual steps** (Project Lead):

Use data from `content/modules/intro-to-kubernetes/meta.json`:

1. Go to **Content > HubDB > learning_modules**
2. Add row:
   - title: "Introduction to Kubernetes"
   - slug: "intro-to-kubernetes"
   - description: "Learn Kubernetes fundamentals..."
   - difficulty: "beginner"
   - estimated_minutes: 45
   - tags: "kubernetes,containers,pods,fundamentals"
   - display_order: 1
3. Publish table

### Step 5: Test Module Page

**Manual verification**:
1. **Content > Website Pages > Create > Website page**
2. Select template: `module-detail.html`
3. Set URL: `/learn/module/intro-to-kubernetes-preview`
4. Set status: **Draft**
5. Map content fields to markdown content from `content/modules/intro-to-kubernetes/README.md`
6. Preview the page

**Acceptance Criteria**:
- ✅ Template appears in page creation UI
- ✅ Sidebar navigation works
- ✅ Code syntax highlighting works
- ✅ Responsive layout works
- ✅ Breadcrumbs render correctly
- ✅ Preview URL works

**Git Workflow**:
```bash
git checkout -b feature/module-detail-template
git add hedgehog-learn-theme/templates/module-detail.html
git add hedgehog-learn-theme/css/module-detail.css
git commit -m "feat: Create module detail template

- Add module-detail.html with sidebar navigation
- Implement syntax highlighting for code blocks
- Add responsive layout for lab instructions
- Include breadcrumbs and module metadata
- Add previous/next module navigation

Closes #2"
git push -u origin feature/module-detail-template
```

---

## Work Packet 4: Activate Theme and Create Preview Pages

**Objective**: Activate theme in HubSpot and create preview pages for testing

**Prerequisites**:
- ✅ All templates uploaded
- ✅ HubDB tables populated
- ✅ CSS and JavaScript assets uploaded

**Instructions**:

### Step 1: Verify All Assets in Design Manager

**Manual verification** (Project Lead):
1. Go to **Content > Design Manager**
2. Navigate to `hedgehog-learn-theme/`
3. Verify all files present:
   - `theme.json`
   - `templates/layouts/base.html`
   - `templates/learn-landing.html`
   - `templates/module-detail.html`
   - `css/main.css`
   - `css/landing.css`
   - `css/module-detail.css`

### Step 2: Activate Theme

**Manual steps**:
1. Go to **Settings > Website > Themes**
2. Find `hedgehog-learn-theme`
3. Click **"Make active"** (or **"Activate"**)
4. Confirm activation

### Step 3: Create Landing Page Preview

1. **Content > Website Pages > Create > Website page**
2. Template: `learn-landing.html`
3. Page settings:
   - Page title: "Learn - Preview"
   - Page URL: `/learn-preview`
   - Status: **Draft** (not published)
4. Content:
   - hero_title: "Master Cloud Native Technologies"
   - hero_subtitle: "Hands-on learning paths for Kubernetes, containers, and cloud infrastructure"
5. Save draft
6. Click **Preview** button
7. Copy preview URL for testing

### Step 4: Create Module Page Preview

1. **Content > Website Pages > Create > Website page**
2. Template: `module-detail.html`
3. Page settings:
   - Page title: "Introduction to Kubernetes - Preview"
   - Page URL: `/learn/module/intro-to-kubernetes-preview`
   - Status: **Draft**
4. Map content from `content/modules/intro-to-kubernetes/README.md`:
   - Copy markdown sections into appropriate content fields
   - Set difficulty, estimated_minutes, tags from meta.json
5. Save draft
6. Preview

### Step 5: Document Preview URLs

Create `docs/preview-urls.md`:

```markdown
# Preview URLs for Testing

**Theme**: hedgehog-learn-theme
**Status**: Active (Draft pages only)

## Draft Pages

### Landing Page
- URL: https://21430285.hs-sites.com/learn-preview?hs_preview=PREVIEW_KEY
- Template: `learn-landing.html`
- Status: Draft (not published)

### Module: Introduction to Kubernetes
- URL: https://21430285.hs-sites.com/learn/module/intro-to-kubernetes-preview?hs_preview=PREVIEW_KEY
- Template: `module-detail.html`
- Status: Draft

## Publishing Checklist

Before publishing to production URLs:
- [ ] Preview all pages thoroughly
- [ ] Test responsive design on mobile
- [ ] Verify all HubDB connections
- [ ] Test all interactive elements (filters, navigation)
- [ ] Check browser console for errors
- [ ] Verify syntax highlighting works
- [ ] Test on multiple browsers

## Production URLs (Not Yet Published)

Will replace preview URLs when ready:
- `/learn` - Landing page
- `/learn/module/intro-to-kubernetes` - Module page
```

**Acceptance Criteria**:
- ✅ Theme activated in HubSpot
- ✅ Landing page preview works
- ✅ Module page preview works
- ✅ Preview URLs documented
- ✅ No console errors
- ✅ Responsive design verified

**Git Workflow**:
```bash
git checkout -b docs/preview-urls
git add docs/preview-urls.md
git commit -m "docs: Add preview URLs for CMS pages"
git push -u origin docs/preview-urls
```

---

## Sprint 1 Completion Checklist

### Core Deliverables
- [ ] HubSpot CMS theme created using correct workflow (`hs create website-theme`)
- [ ] Base layout template created
- [ ] Landing page template with HubDB integration
- [ ] Module detail template with syntax highlighting
- [ ] Theme CSS with design system
- [ ] Theme uploaded to Design Manager (`hs upload`)
- [ ] Theme activated in HubSpot Settings
- [ ] HubDB tables created (pathways, modules)
- [ ] Sample content populated in HubDB
- [ ] Preview pages created (draft status)

### Testing & Validation
- [ ] Templates appear in Content > Website Pages
- [ ] Preview URLs work
- [ ] Responsive design tested
- [ ] Syntax highlighting works
- [ ] HubDB integration works
- [ ] Client-side filtering works
- [ ] Navigation works correctly
- [ ] No console errors

### Documentation
- [ ] `docs/hubspot-architecture-correct.md` reviewed by team
- [ ] Preview URLs documented
- [ ] HubDB schema documented
- [ ] Theme activation steps documented

### Git & CI
- [ ] All work on feature branches
- [ ] PRs created with descriptive titles
- [ ] CI passes on all PRs
- [ ] Code reviewed by project lead
- [ ] PRs merged to main

---

## Important Reminders

### ✅ DO
- Use `hs upload hedgehog-learn-theme hedgehog-learn-theme` for theme uploads
- Create pages in **Draft** status for testing
- Test preview URLs before publishing
- Keep templates in `hedgehog-learn-theme/` directory
- Use HubDB for dynamic content
- Follow git branch naming conventions

### ❌ DON'T
- Don't use `hs project upload` for templates (that's for apps!)
- Don't publish pages to production URLs without approval
- Don't create pages in Content > Design Manager (create in Content > Website Pages)
- Don't modify the existing site's pages
- Don't skip preview testing

### 🚨 If You Get Stuck
1. Read `docs/hubspot-architecture-correct.md` again
2. Verify you're using the correct `hs` command
3. Check files are in `hedgehog-learn-theme/` directory (NOT `src/cms/`)
4. Verify theme is uploaded to Design Manager
5. Ensure theme is activated in Settings
6. Ask project lead for help

---

## Success Metrics

Sprint 1 is complete when:
1. ✅ Theme visible in HubSpot Design Manager
2. ✅ Templates available when creating new pages
3. ✅ Preview pages render correctly
4. ✅ Project lead can create new pages using templates
5. ✅ All acceptance criteria met
6. ✅ No blockers for Sprint 2

**Expected Outcome**: Content creators can now create learning module pages using templates, paving the way for content migration in Sprint 2.
