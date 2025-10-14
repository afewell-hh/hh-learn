# Content Git Workflow (Source of Truth)

Audience: content authors and project leads creating Modules, Courses, and Pathways.

Principles
- Main is the source of truth for learning content. HubDB reflects Git via sync.
- No manual authoring directly in HubDB for canonical items.
- Short‑lived branches; fast PRs; frequent merges to `main` (daily when active).

Branching
- Name: `feature/content-<type>-<slug>` (e.g., `feature/content-module-kubernetes-storage`).
- Labels: `type/content`, `area/content`, and a priority.
- One unit per PR: a module OR a course OR a pathway.

Where content lives
- Modules: `content/modules/<slug>/{README.md, meta.json}`
- Courses: `content/courses/<slug>.json`
- Pathways: `content/pathways/<slug>.json`

Authoring flow
1) `git checkout -b feature/content-<type>-<slug>`
2) Add files using templates in `docs/templates/`.
3) Validate locally: `npm ci && npm run build`.
4) Dry‑run sync (safe):
   - Modules: `npm run sync:content -- --dry-run`
   - Courses: `npm run sync:courses -- --dry-run`
   - Pathways: `npm run sync:pathways -- --dry-run`
5) Open PR; get review; merge.
6) Publish: run the same sync without `--dry-run`, then `npm run publish:pages`.

Environment
- Required `.env` vars (see `.env.example`):
  - `HUBSPOT_PRIVATE_APP_TOKEN`, `HUBSPOT_ACCOUNT_ID`
  - `HUBDB_MODULES_TABLE_ID`, `HUBDB_COURSES_TABLE_ID`, `HUBDB_PATHWAYS_TABLE_ID`

Finding content
- Always look in `main` under `content/…`. If a course/pathway is not there, it is not canonical.
- If something exists only in HubDB, create an issue to backfill it into Git and then sync.

Releases
- Content merges to `main` are deployable immediately via sync scripts.
- Tag releases as needed for milestones, but content is continuous delivery.

Branch hygiene
- Delete feature branches after merge.
- Stale branches (>30 days, no open PR) are pruned monthly.

