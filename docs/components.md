# HubSpot CMS Components Documentation

This document describes the reusable components used in the Hedgehog Learn portal.

---

## Pathway Card Component

**Location:** `/src/cms/modules/learn/pathway-card/`

The Pathway Card component displays a learning pathway with metadata and a call-to-action button.

### Usage

```html
{% module "pathway-card" pathway=pathway_data %}
```

### Props/Data Structure

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | The pathway title |
| `slug` | string | URL-friendly identifier used in the pathway URL |
| `description` | string | Brief description of the pathway content |
| `estimated_minutes` | number | Total estimated time to complete all modules |
| `module_count` | number | Number of modules in the pathway |
| `icon_url` | string (optional) | URL to pathway icon image |

### Example Data

```json
{
  "title": "Kubernetes Fundamentals",
  "slug": "kubernetes-fundamentals",
  "description": "Master the basics of Kubernetes orchestration, from pods to deployments",
  "estimated_minutes": 120,
  "module_count": 5,
  "icon_url": ""
}
```

### Visual Features

- Card with hover effect (lifts and shows shadow)
- Optional icon display
- Metadata showing estimated time and module count
- Primary CTA button to start the pathway
- Responsive design

---

## Module Card Component

**Location:** `/src/cms/modules/learn/module-card/`

The Module Card component displays an individual learning module with difficulty level, tags, and metadata.

### Usage

```html
{% module "module-card" module=module_data %}
```

### Props/Data Structure

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | The module title |
| `slug` | string | URL-friendly identifier used in the module URL |
| `description` | string | Brief description of the module content |
| `difficulty` | string | Module difficulty: "beginner", "intermediate", or "advanced" |
| `estimated_minutes` | number | Estimated time to complete the module |
| `tags` | array[string] | List of topic tags for the module |

### Example Data

```json
{
  "title": "Intro to Kubernetes",
  "slug": "intro-to-kubernetes",
  "description": "Learn Kubernetes basics: pods, services, and deployments",
  "difficulty": "beginner",
  "estimated_minutes": 30,
  "tags": ["kubernetes", "containers"]
}
```

### Visual Features

- Card with hover effect
- Color-coded difficulty badge:
  - **Beginner**: Green (#2e7d32)
  - **Intermediate**: Orange (#e65100)
  - **Advanced**: Pink (#c2185b)
- Time estimate display
- Tag pills for topics
- Outline CTA button

### Difficulty Badge Colors

The difficulty badge is styled automatically based on the difficulty value:

```css
.badge-beginner {
  background: #e8f5e9;
  color: #2e7d32;
}

.badge-intermediate {
  background: #fff3e0;
  color: #e65100;
}

.badge-advanced {
  background: #fce4ec;
  color: #c2185b;
}
```

---

## Landing Page Template

**Location:** `/src/cms/templates/learn/landing.html`

The landing page template is the main entry point for the learning portal, displaying featured pathways and all available modules.

### Template Structure

1. **Hero Section**: Title, subtitle, and primary CTA
2. **Pathways Section**: Grid of featured learning pathways
3. **Modules Section**: Filterable grid of all modules

### Content Data Structure

The landing page expects a content object with the following structure:

```json
{
  "hero_title": "Learn Hedgehog Cloud",
  "hero_subtitle": "Hands-on labs and courses for cloud infrastructure",
  "featured_pathways": [
    {
      "title": "Pathway Title",
      "slug": "pathway-slug",
      "description": "Pathway description",
      "estimated_minutes": 120,
      "module_count": 5,
      "icon_url": ""
    }
  ],
  "modules": [
    {
      "title": "Module Title",
      "slug": "module-slug",
      "description": "Module description",
      "difficulty": "beginner",
      "estimated_minutes": 30,
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

### Search and Filter

The landing page includes a search bar and difficulty filter:

- Search input: Filters modules by title (client-side JavaScript required for functionality)
- Difficulty dropdown: Filters by beginner/intermediate/advanced levels

---

## Base Layout Template

**Location:** `/src/cms/templates/learn/layouts/base.html`

The base layout template provides the common structure for all learning portal pages.

### Features

- HTML5 structure with proper meta tags
- Site header with navigation
- Content block for page-specific content
- Site footer with copyright
- Links to theme CSS
- Optional stylesheet and script blocks for page-specific assets

### Blocks

Templates extending `base.html` can override these blocks:

- `{% block title %}`: Page title (default: "Hedgehog Learn")
- `{% block stylesheets %}`: Additional CSS includes
- `{% block body %}`: Main page content
- `{% block scripts %}`: Additional JavaScript includes

### Example Usage

```html
{% extends "./layouts/base.html" %}

{% block title %}My Page Title{% endblock %}

{% block stylesheets %}
  <link rel="stylesheet" href="{{ get_asset_url('/css/custom.css') }}">
{% endblock %}

{% block body %}
  <div class="my-content">
    <!-- Page content here -->
  </div>
{% endblock %}
```

---

## CSS Styling

### Theme CSS

**Location:** `/src/cms/css/theme.css`

Contains:
- CSS custom properties for colors, spacing, and typography
- Base typography styles
- Grid and layout utilities
- Responsive breakpoints

### Landing Page CSS

**Location:** `/src/cms/css/landing.css`

Contains:
- Hero section gradient and styles
- Pathway and module grid layouts
- Card hover effects and transitions
- Search/filter bar styles
- Button variants (primary, secondary, tertiary)
- Responsive breakpoints for mobile/tablet

### Responsive Breakpoints

- Mobile: `max-width: 768px` (single column)
- Tablet: `769px - 1024px` (2 columns)
- Desktop: `min-width: 1025px` (3-4 columns)

---

## Button Styles

Three button variants are available:

### Primary Button
```css
.btn-primary {
  background: white;
  color: var(--color-primary);
  /* Used in hero CTA */
}
```

### Secondary Button
```css
.btn-secondary {
  background: var(--color-primary);
  color: white;
  /* Used in pathway cards */
}
```

### Tertiary Button
```css
.btn-tertiary {
  background: transparent;
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  /* Used in module cards */
}
```

---

## Sample Data

Sample data for testing the landing page is available at:

**Location:** `/content/landing-sample-data.json`

This file includes:
- 3 featured pathways
- 8 sample modules covering various topics
- Multiple difficulty levels
- Various tag combinations

---

## Future Components

Planned components for upcoming work packets:

1. **Tab Navigation Module** - For module detail pages
2. **Breadcrumb Component** - For navigation context
3. **Resource List Component** - For external links
4. **Progress Tracker** - For pathway completion status

---

## Development Notes

### Adding New Components

1. Create module directory: `/src/cms/modules/learn/{component-name}/`
2. Add `module.html` with component markup
3. Add `meta.json` with component metadata
4. Add component-specific CSS to `/src/cms/css/`
5. Upload to HubSpot: `npm run cms:upload`
6. Document in this file

### HubL Templates

All templates use HubL (HubSpot Markup Language), which is based on Jinja2:

- Variables: `{{ variable }}`
- Loops: `{% for item in items %}`
- Conditionals: `{% if condition %}`
- Modules: `{% module "module-name" prop=value %}`

### Testing Components

After uploading to HubSpot:
1. Navigate to HubSpot Design Manager
2. Locate the module or template
3. Create a test page using the template
4. Verify rendering and responsiveness

---

## Support

For questions or issues with these components, refer to:
- HubSpot CMS Documentation: https://developers.hubspot.com/docs/cms
- Project README: `/README.md`
- CMS Development Guide: `/docs/cms-development.md`
