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
