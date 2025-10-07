# Theme Information

## Your Theme

**GUI Name**: `CLEAN x HEDGEHOG`
**CLI/API Name**: `CLEAN x HEDGEHOG` (same as GUI)
**Base Theme**: Clean.Pro (customized)

## Template Locations

### In HubSpot Design Manager
```
CLEAN x HEDGEHOG/
├── templates/
│   ├── layouts/
│   │   ├── base.html
│   │   └── base-lp.html
│   └── learn/              ← Your learning platform templates
│       ├── landing-simple.html
│       └── module-simple.html
```

### Local Development
```
clean-x-hedgehog-templates/
└── learn/
    ├── landing-simple.html
    └── module-simple.html
```

## HubDB Configuration

**Table Name**: `learning_modules`
**Table ID**: `135163996`

Already configured in templates ✅

## Uploading Templates

### Via HubSpot CLI

```bash
# Upload single file
hs upload clean-x-hedgehog-templates/learn/landing-simple.html "CLEAN x HEDGEHOG/templates/learn/landing-simple.html"

# Upload entire learn folder
hs upload clean-x-hedgehog-templates/learn/ "CLEAN x HEDGEHOG/templates/learn/"

# Watch for changes (development)
hs watch clean-x-hedgehog-templates/learn/ "CLEAN x HEDGEHOG/templates/learn/"
```

### Via Design Manager GUI

1. Go to: **Content > Design Manager**
2. Navigate to: `CLEAN x HEDGEHOG > templates > learn`
3. Upload or edit files directly

## Template Paths

### Extending Base Layout

Your templates use relative paths:
```html
{% extends "../layouts/base.html" %}
```

This resolves to: `CLEAN x HEDGEHOG/templates/layouts/base.html` ✅

### Accessing Modules

Other theme modules can be referenced:
```html
{% module "module_name"
  path="@hubspot/CLEAN x HEDGEHOG/modules/module-name"
%}
```

## Notes

- Template metadata is automatically added by HubSpot when uploaded via GUI
- CLI uploads preserve metadata from local files
- Theme name in CLI matches GUI (no conversion needed)
- Spaces in theme name are preserved in both CLI and API calls
