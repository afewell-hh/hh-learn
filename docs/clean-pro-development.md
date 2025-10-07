# Extending Clean.Pro for Hedgehog Learn

**Purpose**: Guide for adding custom learning platform features to Clean.Pro theme
**Approach**: Extend Clean.Pro with custom modules and templates rather than creating separate theme

---

## Why Extend Clean.Pro (Not Create Custom Theme)

### ✅ Advantages
- **Consistency**: Automatically matches hedgehog.cloud branding
- **Maintenance**: One theme to maintain, inherits all Clean.Pro updates
- **Efficiency**: Leverage existing components, only build what's unique
- **Proven approach**: Already used for glossary pages (`/glossary`)

### ❌ Custom Theme Drawbacks (What We're Avoiding)
- Two themes to maintain
- Duplicate navigation, footers, global styles
- Risk of brand inconsistency
- More work upfront

---

## Clean.Pro File Structure

Clean.Pro theme in HubSpot Design Manager:
```
Clean.Pro/
├── templates/              # Page templates
│   ├── home.html
│   ├── about.html
│   ├── (20+ specialty templates)
│   └── learn/             # ✅ ADD: Our custom templates
│       ├── landing.html
│       └── module-detail.html
├── modules/               # Reusable components
│   ├── (existing Clean.Pro modules)
│   └── learn/             # ✅ ADD: Our custom modules
│       ├── tab-navigation/
│       ├── code-block/
│       ├── pathway-card/
│       └── module-card/
├── css/
│   ├── (Clean.Pro styles)
│   └── learn.css          # ✅ ADD: Our custom CSS
└── js/
    ├── (Clean.Pro scripts)
    └── learn.js           # ✅ ADD: Our custom JS
```

---

## Development Workflow

### 1. Access Clean.Pro Theme

**Via HubSpot CLI**:
```bash
# Fetch Clean.Pro theme to local
hs fetch @marketplace/clean-pro clean-pro

# Or clone if already in Design Manager
hs fetch clean-pro clean-pro
```

**Via HubSpot Design Manager**:
- Navigate to: Content > Design Manager
- Find: Clean.Pro theme folder
- Create folders/files directly in UI

### 2. Add Custom Module

**Steps**:
1. Create module folder: `Clean.Pro/modules/learn/[module-name]/`
2. Add required files:
   - `module.html` - HubL template
   - `module.css` - Module-specific styles
   - `module.js` - Module-specific JavaScript (if needed)
   - `meta.json` - Module metadata

**Example: Tab Navigation Module**

`modules/learn/tab-navigation/meta.json`:
```json
{
  "label": "Learn Tab Navigation",
  "css_assets": [],
  "external_js": [],
  "js_assets": [],
  "smart_type": "NOT_SMART",
  "tags": ["learn"],
  "is_available_for_new_content": true,
  "host_template_types": ["PAGE"]
}
```

`modules/learn/tab-navigation/module.html`:
```html
<div class="learn-tabs">
  <div class="tab-buttons">
    <button class="tab-btn active" data-tab="lab">Lab</button>
    <button class="tab-btn" data-tab="concepts">Concepts</button>
    <button class="tab-btn" data-tab="resources">Resources</button>
  </div>

  <div class="tab-content active" id="lab-content">
    {{ module.lab_content }}
  </div>

  <div class="tab-content" id="concepts-content">
    {{ module.concepts_content }}
  </div>

  <div class="tab-content" id="resources-content">
    {{ module.resources_content }}
  </div>
</div>
```

`modules/learn/tab-navigation/module.css`:
```css
.learn-tabs {
  margin: 2rem 0;
}

.tab-buttons {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #E5E7EB;
  margin-bottom: 2rem;
}

.tab-btn {
  padding: 12px 24px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-weight: 600;
  color: #6B7280;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #111827;
}

.tab-btn.active {
  color: #0066CC;
  border-bottom-color: #0066CC;
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}
```

`modules/learn/tab-navigation/module.js`:
```javascript
document.addEventListener('DOMContentLoaded', function() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.dataset.tab;

      // Remove active classes
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active classes
      this.classList.add('active');
      document.getElementById(tabId + '-content').classList.add('active');
    });
  });
});
```

### 3. Add Custom Template

**Create**: `Clean.Pro/templates/learn/module-detail.html`

```html
{% extends "./layouts/base.html" %}

{% block body %}
<div class="module-detail">
  <div class="container">
    <!-- Breadcrumbs (using Clean.Pro styles) -->
    <nav class="breadcrumbs">
      <a href="/learn">Learn</a> ›
      <span>{{ content.module_title }}</span>
    </nav>

    <!-- Module header -->
    <header class="module-header">
      <h1>{{ content.module_title }}</h1>
      <div class="module-meta">
        <span class="difficulty">{{ content.difficulty }}</span>
        <span class="time">{{ content.estimated_minutes }} min</span>
      </div>
    </header>

    <!-- Tab navigation module -->
    {% module "learn_tabs"
      path="@marketplace/clean-pro/modules/learn/tab-navigation"
      lab_content=content.lab_content
      concepts_content=content.concepts_content
      resources_content=content.resources_content
    %}

    <!-- Module navigation -->
    <div class="module-nav">
      {% if content.prev_module %}
        <a href="/learn/module/{{ content.prev_module.slug }}" class="btn-secondary">
          ← {{ content.prev_module.title }}
        </a>
      {% endif %}
      {% if content.next_module %}
        <a href="/learn/module/{{ content.next_module.slug }}" class="btn-primary">
          {{ content.next_module.title }} →
        </a>
      {% endif %}
    </div>
  </div>
</div>
{% endblock %}
```

### 4. Upload Changes

**Via CLI**:
```bash
# Upload entire theme
hs upload clean-pro clean-pro

# Watch for changes during development
hs watch clean-pro clean-pro
```

**Via Design Manager**:
- Edit files directly in browser
- Changes save automatically
- Preview before publishing

---

## Custom Modules Needed for Learn

### 1. Tab Navigation
**Purpose**: Switch between Lab, Concepts, Resources
**Files**: `modules/learn/tab-navigation/`
**Features**:
- Click to switch tabs
- Active state styling
- Keyboard navigation

### 2. Code Block
**Purpose**: Display code with syntax highlighting
**Files**: `modules/learn/code-block/`
**Features**:
- Syntax highlighting (Prism.js)
- Copy button
- Language label
- Line numbers (optional)

### 3. Pathway Card
**Purpose**: Display pathway on landing page
**Files**: `modules/learn/pathway-card/`
**Features**:
- Icon/image
- Title, description
- Module count, time estimate
- CTA button

### 4. Module Card
**Purpose**: Display module on landing page
**Files**: `modules/learn/module-card/`
**Features**:
- Difficulty badge
- Title, description
- Time estimate
- Tags
- CTA button

---

## HubDB Integration

### Create Tables

**Via HubSpot UI**: Content > HubDB

**learning_modules table**:
- `title` (Text)
- `slug` (Text)
- `description` (Rich Text)
- `difficulty` (Select: beginner, intermediate, advanced)
- `estimated_minutes` (Number)
- `tags` (Text)
- `lab_content` (Rich Text)
- `concepts_content` (Rich Text)
- `resources_content` (Rich Text)

**learning_pathways table**:
- `title` (Text)
- `slug` (Text)
- `description` (Rich Text)
- `icon_url` (URL)
- `module_count` (Number)
- `estimated_hours` (Number)

### Query HubDB in Templates

```html
<!-- Fetch all modules -->
{% set modules = hubdb_table_rows(MODULE_TABLE_ID) %}

<!-- Loop through modules -->
{% for module in modules %}
  <div class="module-card">
    <h3>{{ module.title }}</h3>
    <p>{{ module.description }}</p>
  </div>
{% endfor %}

<!-- Filter by difficulty -->
{% set beginner_modules = hubdb_table_rows(MODULE_TABLE_ID, "difficulty=beginner") %}
```

---

## Page Creation Workflow

### Create Landing Page

1. **HubSpot UI**: Content > Website Pages > Create
2. **Select template**: `learn/landing.html` (from Clean.Pro)
3. **Configure**:
   - Page name: "Learning Portal"
   - URL: `/learn` or `/learn-preview` (for testing)
   - Status: Draft (for preview) or Published
4. **Add content**: HubDB queries pull data automatically
5. **Preview**: Test before publishing
6. **Publish**: Change status to Published

### Create Module Detail Pages

**Option A: Manual** (for testing):
1. Create individual pages for each module
2. Use `learn/module-detail.html` template
3. Map HubDB row to page content

**Option B: Dynamic** (recommended):
1. Create single template
2. Use HubDB dynamic pages
3. URL pattern: `/learn/module/{slug}`
4. Template fetches HubDB row by slug

---

## Styling Guidelines

### Use Clean.Pro Variables

```css
/* Clean.Pro provides CSS variables */
:root {
  --color-primary: #0066CC;     /* Hedgehog blue */
  --color-secondary: #00C896;   /* Hedgehog green */
  --font-family: ...;
  --spacing-unit: 8px;
}

/* Use them in custom CSS */
.module-card {
  color: var(--color-primary);
  padding: calc(var(--spacing-unit) * 3);
}
```

### Override Only When Needed

```css
/* Add learn-specific styles in learn.css */
.learn-landing {
  /* Custom grid for modules */
}

.module-detail {
  /* Custom layout for module pages */
}

/* Don't redefine global styles - inherit from Clean.Pro */
```

---

## Testing & Preview

### Local Development

```bash
# Watch for changes
hs watch clean-pro clean-pro

# Make edits to local files
# Changes auto-upload to HubSpot
```

### Preview in HubSpot

1. Create draft pages
2. Use preview URLs (include `?hs_preview=true`)
3. Test on:
   - Desktop
   - Tablet
   - Mobile
4. Check:
   - Tabs work
   - Code blocks render
   - Cards display correctly
   - Navigation works

### Browser Testing

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

---

## Best Practices

### ✅ DO
- Reuse Clean.Pro components where possible
- Follow Clean.Pro naming conventions
- Test on mobile first
- Use HubDB for dynamic content
- Keep modules focused (single responsibility)
- Document custom HubL variables

### ❌ DON'T
- Override global Clean.Pro styles unnecessarily
- Create duplicate components that Clean.Pro already has
- Hardcode content (use HubDB)
- Ignore mobile responsiveness
- Create overly complex modules

---

## Deployment Checklist

Before publishing pages:

- [ ] All custom modules created and uploaded
- [ ] Templates tested with sample content
- [ ] HubDB tables created and populated
- [ ] Preview pages work correctly
- [ ] Mobile responsive verified
- [ ] All links functional
- [ ] SEO metadata added
- [ ] Analytics tracking configured
- [ ] Breadcrumbs working
- [ ] Navigation matches site structure

---

## Maintenance

### Updating Clean.Pro

When Clean.Pro updates:
1. Review changelog
2. Test custom modules still work
3. Update any deprecated features
4. Re-test all learn pages

### Adding New Modules

1. Plan module requirements
2. Create in `modules/learn/[name]/`
3. Upload to Clean.Pro theme
4. Test in isolation
5. Integrate into templates
6. Document usage

---

## Resources

- **Clean.Pro Website**: https://www.clean.pro/
- **HubSpot CMS Docs**: https://developers.hubspot.com/docs/cms
- **HubL Reference**: https://developers.hubspot.com/docs/cms/hubl
- **HubDB Guide**: https://developers.hubspot.com/docs/cms/data/hubdb
- **Module Development**: https://developers.hubspot.com/docs/cms/building-blocks/modules

---

## Getting Help

- **Clean.Pro Support**: Unlimited support included
- **HubSpot Community**: https://community.hubspot.com/
- **Project Documentation**: See `docs/` folder
- **Glossary Example**: Review existing implementation at `/glossary`

---

## Summary

**What we're doing**: Extending Clean.Pro with custom learning platform features
**What we're NOT doing**: Creating a separate custom theme
**Why**: Efficiency, consistency, maintainability
**Approach**: Add custom modules and templates to Clean.Pro theme folder
**Result**: Integrated learning platform that matches hedgehog.cloud branding
