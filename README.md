# Hedgehog Learn

Learning platform for hedgehog.cloud built on HubSpot CMS with supporting AWS Lambda functions.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env configuration and provide secrets:
   ```bash
   cp .env.example .env
   # Fill HUBSPOT_PRIVATE_APP_TOKEN and HUBDB_MODULES_TABLE_ID
   ```
3. Build TypeScript (optional for local development of Lambda handlers):
   ```bash
   npm run build
   ```
4. Sync content to HubSpot HubDB:
   ```bash
   npm run sync:content
   ```

See [`docs/content-sync.md`](docs/content-sync.md) for the full operational runbook, including HubDB schema, token rotation, CI automation, and troubleshooting steps.

## Documentation
Only evergreen documentation lives in this repository. Historical decisions and sprint notes belong in GitHub issues or discussions.

- [`docs/architecture.md`](docs/architecture.md) – System boundaries and upcoming integrations.
- [`docs/content-sync.md`](docs/content-sync.md) – Day-to-day operational guide for the sync script.
- [`docs/theme-development.md`](docs/theme-development.md) – Guardrails for customizing the Clean.Pro theme.
- [`docs/README.md`](docs/README.md) – Index of canonical documents.

## Project Management
- Track work in GitHub Projects/Issues; avoid adding point-in-time plans to the repo.
- Reference issue numbers in commits/PRs to keep the development history searchable.
- Use pull requests for all changes (including documentation updates) so reviewers can ensure docs stay current.

## Deploying AWS Functions
Serverless functions that back interactive features are defined under `src/` with configuration in `serverless.yml`.

```
npm run deploy:aws
```

This command deploys to the default stage configured in the Serverless Framework. Update [`docs/architecture.md`](docs/architecture.md) if new services or stages are added.
