# Issue #327 Audit Results

## Templates with Invalid request_json Usage

- action-runner.html: 1 (comment only - already fixed)
- catalog.html: 2 instances
- courses-page.html: 11 instances
- module-page.html: 6 instances
- my-learning.html: 2 instances
- pathways-page.html: 9 instances
- register.html: 2 instances

**Total**: 32 real instances to fix across 6 templates

## Fix Strategy

Apply same inline constants approach as action-runner.html:
1. Replace `{% set constants = get_asset_url(...)|request_json %}` with inline dictionary
2. Keep defensive fallbacks for safety
3. Validate with `npm run validate:inline-constants`

## Order of Implementation

1. register.html (2 instances) - Smallest
2. catalog.html (2 instances) - Small
3. my-learning.html (2 instances) - Small
4. module-page.html (6 instances) - Medium
5. pathways-page.html (9 instances) - Large
6. courses-page.html (11 instances) - Largest
