---
title: Catalog Routing and Modules List
owner: project-lead
updated: 2025-10-15
---

# Catalog Routing and Modules List

Context: As part of unifying the learning experience, `/learn` now serves the Catalog (combined Modules/Courses/Pathways) and a dedicated Modules list is exposed at `/learn/modules`.

## Pages

- `/learn` → Catalog (HubDB: `HUBDB_CATALOG_TABLE_ID`; template: `clean-x-hedgehog-templates/learn/catalog.html`)
- `/learn/modules` → Modules list (HubDB: `HUBDB_MODULES_TABLE_ID`; template: `clean-x-hedgehog-templates/learn/module-page.html`)
- `/learn/courses` → Courses list (existing)
- `/learn/pathways` → Pathways list (existing)

## Provisioning (update‑only by default)

Scripts target existing pages and PATCH draft content safely. Creation requires `--allow-create`.

- `npm run provision:pages -- --dry-run` → shows UPDATE for the slugs above
- `npm run sync:catalog` → refreshes the unified Catalog HubDB table

## Navigation

Left‑nav updated: “Catalog” points to `/learn`, “Modules” points to `/learn/modules`.

## Acceptance

- Public pages render with single H1 and correct back links.
- Catalog and Modules list load data via bound HubDB tables or constants fallback.

