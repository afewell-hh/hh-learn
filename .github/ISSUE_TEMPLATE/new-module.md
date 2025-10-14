---
name: New Module Content
about: Author high-quality content for a Learn module and publish to HubDB
title: "Write module content: <Module Title> [<slug>]"
labels: [area/content, type/docs, priority/P1]
assignees: ''
---

Context
- HubDB table: Modules (135621904)
- Row slug: <slug>
- Page URL: https://hedgehog.cloud/learn/<slug>
- Debug URL: https://hedgehog.cloud/learn/<slug>?debug=1

What to author
- Populate `full_content` (HTML preferred; Markdown acceptable if supported).
- Include: Objectives, Prereqs, Step-by-step with commands, Validation, Troubleshooting, Resources.
- Set `estimated_minutes`, `difficulty`, and relevant `tags`.

How to deliver
1. Draft content (doc or PR).
2. Copy finalized HTML/Markdown into HubDB `full_content` for the module row.
3. Publish the Modules table.
4. Verify the page renders and `?debug=1` shows “has full_content? true”.

Acceptance Criteria
- [ ] `full_content` populated and published
- [ ] Page renders correctly with content and debug banner shows content present
- [ ] `estimated_minutes`, `difficulty`, `tags` set
- [ ] Links validated; screenshots added if helpful

References
- docs/content-standard.md (normative content requirements)
- docs/contributor-guide.md (step-by-step authoring workflow)
- docs/course-authoring.md (full reference guide)
- docs/templates/module-README-template.md
- docs/content-sync.md
- Epic: #105
