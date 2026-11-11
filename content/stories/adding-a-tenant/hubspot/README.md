# HubSpot-ready build

`eight-nodes-six-switches.html` is the story as a complete, self-contained HTML document,
for import into HubSpot as an **unpublished draft page**.

Differences from `../index.html` (the artifact build):

- Carries its own `<!doctype>`, `<head>` and `<body>`. The artifact host supplies those; HubSpot does not.
- `<meta name="robots" content="noindex, nofollow">` is set in the source as well as on the page record.
- Links to the private Claude artifact are removed. A peer opening a HubSpot draft cannot open a
  private artifact, so those point at a companion page that is still in preparation rather than at
  something that would fail for the reader.

Everything else — copy, evidence, sources, layout — is identical to the artifact build.

**Publication state:** draft only. This page must not be published. See the repo's standing rule:
never modify a page you did not create, and any HubSpot preview is a page you created, kept
unpublished or unlisted.

## What exists in HubSpot (account 21430285)

| Thing | Where | State |
|---|---|---|
| Template | Design Manager, `hh-prototypes/eight-nodes-six-switches.html` | `isAvailableForNewContent: false`, so it stays out of everyone's template picker |
| Page | Landing page id **227110064490**, slug `prototype-eight-nodes-six-switches` | **DRAFT — not published** |

Edit/preview: `https://app.hubspot.com/pages/21430285/editor/227110064490`

`hh-prototypes/` is a new top-level Design Manager folder created for this. Nothing existing was
touched: site pages stayed at 91 and the only new landing page is the one above.

**To remove it entirely:** delete landing page 227110064490 and the `hh-prototypes/` folder.

To update the page after changing `eight-nodes-six-switches.html`, re-upload the template:

```
cd /tmp/hsup && hs cms upload hh-prototypes hh-prototypes \
  --config=/home/ubuntu/afewell-hh/hh-learn/hubspot.config.yml --account 21430285
```

The template IS the design, so a re-upload changes the draft page with no publish step. That also
means it would change a *published* page instantly — which is a reason to keep prototypes on their
own template rather than sharing one.
