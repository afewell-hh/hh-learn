# Clean.Pro Extension Guidelines

This document captures the standing guidance for extending the marketplace **Clean.Pro** theme so it powers the Hedgehog Learn experience. Keep it current whenever we change how the theme is customized.

## Goals
- Reuse Clean.Pro branding, navigation, and layout primitives.
- Keep custom assets grouped under the `learn` namespace so upstream updates remain safe to apply.
- Build everything locally in Git when possible so changes are reviewable and reproducible.

## Repository Layout
Local template assets live in [`clean-x-hedgehog-templates/learn/`](../clean-x-hedgehog-templates/learn/):

```
clean-x-hedgehog-templates/
└── learn/
    ├── landing-simple.html      # legacy static landing page (replace when dynamic page is ready)
    ├── module-page.html         # dynamic page template (list + detail views)
    └── module-simple.html       # static testing template
```

When uploading to HubSpot the template path should be `Clean.Pro/templates/learn/`. Keep filenames stable so Design Manager updates in place instead of duplicating templates.

### Modules
If we need bespoke HubL modules, follow the same namespace: `Clean.Pro/modules/learn/<module-name>/`. Store the module source in Git under `clean-x-hedgehog-templates/modules/` before uploading. Modules must include:
- `module.html`
- `module.css` (optional but preferred for scoped styles)
- `module.js` (optional)
- `meta.json`

## Working With the HubSpot CLI
1. Authenticate once with `hs auth` (see HubSpot developer docs).
2. Pull the latest marketplace theme if needed: `hs fetch @marketplace/clean-pro clean-pro`.
3. Upload our customized assets:
   ```bash
   hs upload clean-x-hedgehog-templates/learn/ clean-pro/templates/learn/
   ```
4. For modules, mirror the same command with the `modules` directory.

Always commit HubSpot asset changes alongside code updates so reviewers understand the intent.

## Dynamic Page Setup
`module-page.html` is the canonical template. It renders both the module listing and individual detail pages by checking `dynamic_page_hubdb_row`. Configure one website page at `/learn` that uses this template and enable HubDB dynamic pages (see [`docs/content-sync.md`](content-sync.md) for the HubDB table schema). HubSpot automatically maps rows using the `hs_path` column so URLs look like `/learn/<module-slug>`.

## Styling and Scripts
- Prefer Clean.Pro utility classes for spacing and typography.
- Add scoped styles to module-level CSS instead of editing global theme assets.
- Avoid inline `<style>` blocks in templates unless absolutely necessary.

## Review Checklist
- Templates compile locally (`hs lint` when available).
- Dynamic context renders correctly for both list and detail views.
- Any new module fields are documented in `meta.json` with sensible defaults.
- Screenshots are captured for major UI changes and attached to the pull request.
