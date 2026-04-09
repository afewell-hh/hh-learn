# Phase 0D: Operational Asset Inventory — Issue #374

## Constraint

Production and shadow share HubSpot portal `21430285`. CRM isolation is operational (naming conventions + `hhl_environment` property), not physical.

---

## Forms

### Production form
- Form ID: `b2fd98ff-2055-41b2-85a0-0f497e798087`
- Embed: `clean-x-hedgehog-templates/learn/register.html` line ~121
- Status: Unchanged ✓

### Shadow form
- Previous state: shadow `register.html` embedded the **same production form ID** — shadow registrations were indistinguishable from production registrations.
- Current state: shadow `register.html` now has `SHADOW_FORM_ID_PLACEHOLDER` instead of the production form ID. This intentionally breaks the embed until the operator completes the manual clone step. No shadow form submissions can occur in the meantime.
- Clone required: **Operator step** — HubSpot Forms API requires `forms-access` scope (not granted to available tokens). Full instructions in `docs/shadow-operational-assets.md`.

---

## CRM Environment Marker

### Property: `hhl_environment`
- Type: `enumeration` (select)
- Group: `learning_milestones`
- Options: `production`, `shadow`, `test`
- `formField: true` — required for the property to appear in HubSpot form field selectors ("Show in forms and chat tools"). This enables adding it as a hidden field on the cloned shadow registration form.
- Provisioning: `npm run provision:shadow-crm-properties` (requires `crm.schemas.contacts.write` scope on private app — currently not granted; operator must grant scope or create property manually)
- The script is a true upsert: if the property already exists, it PATCHes it to reconcile `formField` and `options` rather than returning early. This ensures a previously created property with `formField: false` is corrected automatically.
- Once provisioned: add as hidden field on shadow form (value: `shadow`), add as filter on any production workflows/lists

### API Scope Constraint
The private app token (`HUBSPOT_PRIVATE_APP_TOKEN`) does not have `crm.schemas.contacts.write` scope. Neither does `HUBSPOT_PROJECT_ACCESS_TOKEN`. The property cannot be created programmatically with current tokens. This is documented as a required operator action.

---

## Workflows

No production workflows were found defined in this repository. Workflows are managed entirely in the HubSpot portal UI. Conventions for shadow workflow naming and isolation are documented in `docs/shadow-operational-assets.md`.

---

## Lists / Segments / Reports

No active lists or reports were found defined in this repository. Operator instructions for applying `hhl_environment` filter after property is provisioned are in `docs/shadow-operational-assets.md`.

---

## Test Contact Convention

Email pattern: `shadow-test+<purpose>@hedgehog.cloud`
CRM property: `hhl_environment = shadow` or `hhl_environment = test`

---

## What Was Automated vs Manual

| Item | Automated | Manual |
|---|---|---|
| Shadow register.html form ID → placeholder | ✓ (this PR) | |
| `hhl_environment` property definition + script | ✓ (script written, scope blocked) | Grant scope or create manually |
| Registration form clone | | ✓ Operator (HubSpot UI) |
| `hhl_environment = shadow` hidden field on form | | ✓ Operator (after clone) |
| Shadow register.html form ID update | | ✓ Operator (after clone) |
| Workflow clone | | ✓ Operator (when applicable) |
| List/segment filter | | ✓ Operator (after property provisioned) |

---

## Production Safety: Current State

| Risk | Status |
|---|---|
| Shadow events tracked to DynamoDB/CRM | Blocked — `TRACK_EVENTS_ENABLED: false` (Phase 0B) |
| Shadow pages indexed | Blocked — `noindex,nofollow` in all shadow templates (Phase 0A) |
| Shadow form submissions mixed with production | **Blocked** — `SHADOW_FORM_ID_PLACEHOLDER` prevents form render until operator clone is complete |
| Production templates changed | Not changed ✓ |
