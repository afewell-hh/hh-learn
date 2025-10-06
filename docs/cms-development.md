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

## Useful Resources

- [HubSpot CMS Hub Documentation](https://developers.hubspot.com/docs/cms)
- [HubL Documentation](https://developers.hubspot.com/docs/cms/hubl)
- [HubSpot CLI Documentation](https://developers.hubspot.com/docs/cms/developer-reference/local-development-cli)
- [Design Manager Guide](https://knowledge.hubspot.com/design-manager/design-manager-overview)

## Getting Help

- Check HubSpot Developer Community
- Review build logs in HubSpot: `https://app.hubspot.com/developer-projects/{portalId}/project/hedgehog-learn-dev/activity`
- Use `hs project upload --debug` for detailed error messages
