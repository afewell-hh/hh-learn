# AGENTS.md

THIS APP USES HUBSPOT PROJECTS! IT DOES NOT USE LEGACY HUBSPOT PRIVATE APPS! 
THERE HAVE BEEN RECENT CHANGES TO HUBSPOT PROJECTS, YOUR EXISTING KNOWLEDGE IS OUTDATED, DO WEB RESEARCH AS NEEDED TO ENSURE YOU ARE USING CURRENT METHODS THAT ARE NOT OUTDATED!
DO NOT USE HUBSPOT SERVERLESS FUNCTIONS, THIS PROJECT DOES NOT HAVE ACCESS TO USE THEM! INSTEAD, USE AWS LAMBDA!

## How to use this file (best practice)
- Treat this file as the source of truth for guardrails and workflow. If it conflicts with your memory, follow this file.
- Keep changes small and explicit; document every attempt in a GitHub issue to prevent repeating failed approaches.
- When uncertain, pause, research current HubSpot project docs, and write assumptions in the issue before changing code.

## Process requirements (mandatory for every change)
1. Research: verify current platform behavior and HubSpot project best practices (do not rely on legacy private-app knowledge).
2. Architecture analysis: map impact, dependencies, and side effects.
3. Tech spec: detailed plan with alternatives, risks, and rollback strategy.
4. Test plan: define UX-level tests that prove the intended behavior.
5. Review cycle: get approval on research + architecture + spec + tests.
6. TDD implementation: write/adjust tests first, then implement, then re-run tests.
7. Update the issue ticket frequently with all attempts and outcomes.

## Project-specific orientation (avoid legacy assumptions)
- This repo is a HubSpot Projects framework app with CMS templates. Use `hsproject.json` for platform rules.
- Avoid legacy HubSpot private-app or serverless-function patterns unless explicitly approved in a spec.
- CMS templates are vanilla HTML/JS and use `fetch` (not React UI extensions).
- Prefer repo scripts (e.g., `publish:template`, `publish:constants`) over ad-hoc file uploads.
- Keep auth and API routing decisions documented; changes can impact cookies, CORS, and UX state.

## AWS operations (required)
- AWS CLI is available and typically pre-authenticated; confirm `AWS_REGION` and stage before any change.
- Use `.env` credentials only as needed and never echo secrets in logs or issue comments.
- Prefer repo scripts (e.g., `npm run deploy:aws`) over ad-hoc CLI unless the spec explicitly allows it.
- Default to `dev` stage; do not touch prod without explicit approval in the spec/review.
- Log every AWS change in the issue: service, region, resource name/ID, and command used.
- No destructive actions (delete/remove) without a reviewed rollback plan and approval.

## HubSpot Project Information
- The project configuration is in the `hsproject.json` file
- A directory is considered a part of the project it or a directory above it contains a `hsproject.json` file
- The project src directory is defined in the `srcDir` field in the `hsproject.json`
- The project's platform version is defined in `platformVersion` in the `hs project.json`
- The `platformVersion` determines what features the project has access to as well as the shape of the configuration files

## npm packages
### `@hubspot/ui-extensions`
- In the `@hubspot/ui-extensions` npm package, only the component properties defined by the component are valid.  `style` properties are not valid

## Component Information
### General
- Component configuration files must end with `-hsmeta.json`
- The `uid` field in the `-hsmeta.json` files must be unique with the project
- The `type` field in the `-hsmeta.json` files defines the type of the component
- Components can not be in nested subdirectories, only the specified directories in their corresponding component rules.
- Example components can be found in https://github.com/HubSpot/hubspot-project-components.  The directories are split up by platform version and follow this format `${platformVersion}/components`
- All component subdirectories must be in the project source directory

### app component
- There can only be one `app` component
- `app` component must be in the `app` directory
- If the `config.distribution` field is set to `marketplace`, the only valid `config.auth.type` value is `oauth`

### card
- `card` components must be in the `app/cards` directory
- The global `window` object is not available in the `card` component
- Cannot use `window.fetch`, and instead must use the `hubspot.fetch` function provided by the `@hubspot/ui-extensions` npm package.  Any urls called with the `hubspot.fetch` function must be added to the `config.permittedUrls.fetch` array in the `app` component's hsmeta.json file
- Only components exported from the `@hubspot/ui-extensions` npm package can be used in `card` components

### app-event
- `app-event` components must be in the `app/app-events` directory
-
### app-object
- `app-object` components must be in the `app/app-object` directory

### app-function
- `app-function` components must be in the `app/functions` directory
- `app-function` components are not available when `config.distribution` is set to `marketplace` in the `app` component `-hsmeta.son` file

# settings
- There can only be one `settings` component
- `settings` components must be in the `app/settings` directory
- The global `window` object is not available in the `settings` component
- Cannot use `window.fetch`, and instead must use the `hubspot.fetch` function provided by the `@hubspot/ui-extensions` npm package.  Any urls called with the `hubspot.fetch` function must be added to the `config.permittedUrls.fetch` array in the `app` component's hsmeta.json file
- Only components exported from the `@hubspot/ui-extensions` npm package can be used in `settings` components
- React Components from `@hubspot/ui-extensions/crm` cannot be used in `settings` components

# scim
- There can only be one `scim` component
- `scim` components must be in the `app/scim` directory

# webhooks
- There can only be one `webhooks` component.
- `webhooks` components must be in the `app/webhooks` directory
- `webhooks` components can only be in projects where `config.distribution` is private and `config.auth.type` is `static`

### workflow-actions
- `workflow-action` components must be in the `app/workflow-actions` directory

## HubSpot CLI commands
- All the commands and subcommands have a `--help` argument that provides details on the command and it's arguments
- The help output is standard yargs output
- The commands for working with projects in HubSpot are subcommands of `hs project`
- Debugging flag that can be added to `hs` commands and subcommands: `--debug`
- Debugging problems with CLI installation: `hs doctor`
- `hs project open` will open the current project page in the browser
- `hs init` is required to set up the hubspot configuration file
- `hs auth` will authenticate a new account.  This will require a user to open a browser and paste a token in a CLI prompt.
- All the commands for managing HubSpot accounts in the CLI are subcommands of `hs account`

## General
- Follow existing patterns in the codebase
- Use proper component structure based on component `type` in the `-hsmeta.json` file
- Ensure configuration files follow HubSpot naming conventions
- Always validate that components are placed in correct directories
