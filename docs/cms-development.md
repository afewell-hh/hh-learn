# HubSpot CMS Development Guide

This document provides guidance for developing HubSpot CMS templates and modules for the Hedgehog Learn project.

## Overview

The Hedgehog Learn project uses HubSpot platformVersion 2025.2 with a custom theme based on the Clean.Pro design system. All CMS assets are located in the `src/cms/` directory.

## Directory Structure

```
src/cms/
├── theme.json              # Theme configuration
├── css/
│   └── theme.css          # Base CSS with design tokens
├── js/                    # JavaScript files
├── templates/             # Page templates
│   └── learn/            # Learn section templates
└── modules/              # Custom modules
    └── learn/           # Learn section modules
        ├── landing-hero/
        ├── module-card/
        ├── pathway-card/
        └── tab-navigation/
```

## Local Development Workflow

### 1. Starting Development

To start local development with file watching:

```bash
npm run cms:watch
```

This runs `hs project dev` which watches for file changes and automatically uploads them to HubSpot.

### 2. Manual Upload

To manually upload all CMS files to HubSpot:

```bash
npm run cms:upload
```

### 3. Fetching from HubSpot

To fetch the latest files from HubSpot to your local environment:

```bash
npm run cms:fetch
```

## Creating New Templates

1. Create a new `.html` file in `src/cms/templates/learn/`
2. Add HubL template syntax and module areas
3. Upload to HubSpot using `npm run cms:upload`
4. View and edit in HubSpot Design Manager

Example template structure:

```html
<!DOCTYPE html>
<html>
  <head>
    {{ require_css(get_asset_url("../../css/theme.css")) }}
  </head>
  <body>
    {% dnd_area "main" %}
      {# Add modules here #}
    {% end_dnd_area %}
  </body>
</html>
```

## Creating New Modules

1. Create a new directory in `src/cms/modules/learn/[module-name]/`
2. Add the following files:
   - `module.html` - Module markup (HubL)
   - `module.css` - Module-specific styles
   - `module.js` - Module-specific JavaScript (if needed)
   - `meta.json` - Module metadata and fields

3. Upload to HubSpot using `npm run cms:upload`

### Module meta.json Structure

```json
{
  "label": "Module Name",
  "css_assets": [],
  "external_js": [],
  "global": false,
  "help_text": "",
  "host_template_types": ["PAGE"],
  "icon": "...",
  "is_available_for_new_content": true,
  "module_id": null,
  "smart_type": "NOT_SMART",
  "tags": []
}
```

## CSS Development

### Design Tokens

The `src/cms/css/theme.css` file contains CSS custom properties (variables) for:

- **Colors**: Primary, secondary, neutrals, and semantic colors
- **Typography**: Font families, sizes, weights, and line heights
- **Spacing**: Consistent spacing scale
- **Border Radius**: Rounded corner utilities
- **Shadows**: Box shadow utilities
- **Transitions**: Animation timing utilities

### Using Design Tokens

```css
.custom-element {
  color: var(--color-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-lg);
}
```

### Utility Classes

The theme includes utility classes for:

- Layout (flexbox, grid)
- Spacing (margin, padding)
- Typography (text alignment, colors)
- Responsive breakpoints
- Cards and buttons

## Uploading and Deployment

### What Gets Uploaded

- All files in `src/cms/` directory
- Excludes files/directories listed in `.hsignore`

### Files Ignored by .hsignore

- `node_modules/`
- `.git/`
- `.env`
- `*.log`
- `dist/`
- `tests/`
- `docs/`
- `infra/`
- `content/`

### Deployment Process

1. Make changes to CMS files locally
2. Test locally if possible
3. Upload to HubSpot: `npm run cms:upload`
4. Verify in HubSpot Design Manager
5. Use HubSpot's built-in preview/publish tools

## Responsive Design

Use the predefined breakpoints in your CSS:

```css
/* Small devices (640px and up) */
@media (min-width: 640px) { }

/* Medium devices (768px and up) */
@media (min-width: 768px) { }

/* Large devices (1024px and up) */
@media (min-width: 1024px) { }

/* Extra large devices (1280px and up) */
@media (min-width: 1280px) { }
```

Responsive utility classes are also available:

```html
<div class="md:grid-cols-2 lg:grid-cols-3">
  <!-- Grid will be 1 column on mobile, 2 on tablet, 3 on desktop -->
</div>
```

## Troubleshooting

### Upload Fails

1. Check that you're authenticated: `hs account list`
2. Ensure `hsproject.json` exists in project root
3. Check `.hsignore` isn't excluding required files
4. Run with debug flag: `hs project upload --debug`

### Files Not Updating in HubSpot

1. Try manual upload: `npm run cms:upload`
2. Check file is not in `.hsignore`
3. Clear browser cache
4. Check HubSpot Design Manager for errors

### CSS Not Loading

1. Verify CSS file path in template: `get_asset_url("../../css/theme.css")`
2. Check file uploaded successfully in Design Manager
3. Inspect browser console for 404 errors

### Module Not Appearing

1. Check `meta.json` has correct `host_template_types`
2. Verify module uploaded to correct directory
3. Check `is_available_for_new_content: true`
4. Refresh module picker in page editor

## Best Practices

1. **Use design tokens**: Always use CSS variables from `theme.css`
2. **Follow naming conventions**: Use kebab-case for files and directories
3. **Keep modules atomic**: Each module should serve a single purpose
4. **Test responsively**: Check all breakpoints before deploying
5. **Version control**: Commit CMS files to git for tracking
6. **Document custom modules**: Add comments to complex HubL logic
7. **Optimize assets**: Minimize CSS/JS before production

## Creating Module Pages

Module pages use the module detail template (`src/cms/templates/learn/module-detail.html`) to display learning content with tabs for Lab, Concepts, and Resources.

### Module Data Structure

Module content is stored in JSON files in the `content/modules/` directory. Each module requires the following structure:

```json
{
  "title": "Module Title",
  "slug": "module-slug",
  "difficulty": "beginner|intermediate|advanced",
  "estimated_minutes": 30,
  "version": "v1.30",
  "validated_on": "2025-10-01",
  "pathway_slug": "pathway-slug",
  "pathway_name": "Pathway Display Name",
  "tags": ["tag1", "tag2", "tag3"],
  "lab_markdown": "# Lab content in markdown...",
  "concepts_markdown": "# Concept content in markdown...",
  "resources": [
    {
      "title": "Resource Title",
      "url": "https://example.com"
    }
  ],
  "prev_module": {
    "slug": "previous-module-slug"
  },
  "next_module": {
    "slug": "next-module-slug"
  }
}
```

### Required Fields

- **title**: The display name of the module
- **slug**: URL-friendly identifier (used in `/learn/module/{slug}`)
- **difficulty**: One of: `beginner`, `intermediate`, or `advanced`
- **estimated_minutes**: Time to complete the module (number)
- **version**: Software/platform version covered
- **validated_on**: Date the module was last validated (YYYY-MM-DD format)
- **pathway_slug**: URL slug of the parent pathway
- **pathway_name**: Display name of the parent pathway
- **tags**: Array of relevant tags for categorization
- **lab_markdown**: Lab instructions in Markdown format
- **concepts_markdown**: Conceptual explanation in Markdown format
- **resources**: Array of related resources with `title` and `url`

### Optional Fields

- **prev_module**: Object with `slug` of the previous module in the pathway
- **next_module**: Object with `slug` of the next module in the pathway

### Template Features

The module detail template includes:

1. **Breadcrumb Navigation**: Shows the pathway and module hierarchy
2. **Module Header**: Displays title, difficulty badge, and estimated time
3. **Tabbed Content**: Three tabs for Lab, Concepts, and Resources
4. **Sidebar**: Shows module metadata (difficulty, time, version, validation date) and tags
5. **Module Navigation**: Previous/Next links if defined in module data
6. **Code Block Copy Buttons**: Automatic copy buttons for all code blocks
7. **Responsive Design**: Mobile-friendly layout with sidebar below content on small screens

### Markdown Content Guidelines

When writing content for `lab_markdown` and `concepts_markdown`:

1. **Use proper heading hierarchy**: Start with `#` for main sections, `##` for subsections
2. **Code blocks**: Use triple backticks with language identifier:
   ```bash
   kubectl get pods
   ```
3. **Inline code**: Use single backticks for commands or code references: `kubectl`
4. **Lists**: Use `-` or `*` for unordered lists, numbers for ordered lists
5. **Line breaks**: Use `\n` for newlines in the JSON string

### Creating a New Module Page

1. Create a JSON file in `content/modules/[module-slug].json` with all required fields
2. Write lab content with step-by-step instructions
3. Write conceptual content explaining the theory and background
4. Add 3-5 relevant resources with titles and URLs
5. Link to previous/next modules if part of a pathway
6. Test locally by uploading: `npm run cms:upload`
7. Create a page in HubSpot using the module-detail template
8. Pass the module data to the template

### Example: Intro to Kubernetes

See `content/modules/intro-to-kubernetes.json` for a complete example that includes:

- Comprehensive lab steps with kubectl commands
- Detailed concept explanations of Kubernetes fundamentals
- Links to official documentation and resources
- Proper markdown formatting with code blocks

## Useful Resources

- [HubSpot CMS Hub Documentation](https://developers.hubspot.com/docs/cms)
- [HubL Documentation](https://developers.hubspot.com/docs/cms/hubl)
- [HubSpot CLI Documentation](https://developers.hubspot.com/docs/cms/developer-reference/local-development-cli)
- [Design Manager Guide](https://knowledge.hubspot.com/design-manager/design-manager-overview)

## Getting Help

- Check HubSpot Developer Community
- Review build logs in HubSpot: `https://app.hubspot.com/developer-projects/{portalId}/project/hedgehog-learn-dev/activity`
- Use `hs project upload --debug` for detailed error messages
