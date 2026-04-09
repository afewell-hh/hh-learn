---
title: Shadow Environment — Operational Asset Conventions
issue: "#374"
status: Phase 0D complete
---

# Shadow HH-Learn — Operational Asset Conventions

This document covers the non-template HubSpot operational assets (forms, workflows, lists, reports) and CRM isolation conventions required to safely operate the shadow environment alongside the production `/learn` experience in the same HubSpot portal.

See `docs/shadow-environment.md` for template/asset/backend isolation.

---

## Constraint: Same-Portal CRM

The production and shadow environments share the same HubSpot portal (portal ID `21430285`). CRM contacts, form submissions, workflows, and lists cannot be physically separated. All isolation is therefore **operational** — naming conventions, environment markers, and filtering.

---

## Operational Asset Inventory

### Forms

| Asset | Production | Shadow | Clone Status |
|---|---|---|---|
| Registration form | `b2fd98ff-2055-41b2-85a0-0f497e798087` | `SHADOW_FORM_ID_PLACEHOLDER` | **Operator step required** (see below) |

**All other forms:** None identified. The only form in use across HH-Learn templates is the registration form on the `/learn/register` and `/learn-shadow/register` pages.

### Workflows

| Asset | Production | Shadow | Status |
|---|---|---|---|
| Post-registration sequence (if any) | Existing | Operator step: clone and filter to shadow contacts | **Document and isolate** |

No production workflows were found defined in this repo. Workflows are managed in HubSpot UI. Before activating any workflow that triggers on form submission or contact property changes, ensure it filters by `hhl_environment = production` or is cloned and re-targeted to `hhl_environment = shadow`.

### Lists / Segments

| Asset | Production | Shadow | Status |
|---|---|---|---|
| Any active-contact lists | Filter: `hhl_environment = production` | Filter: `hhl_environment = shadow` | **Apply after property is provisioned** |

### Reports / Dashboards

No shadow-specific reports are needed until active shadow testing begins. When created, apply `hhl_environment = shadow` as a filter to exclude shadow contacts from production metrics.

---

## CRM Environment Marker Convention

### Property: `hhl_environment`

**Purpose:** Distinguishes contacts and activity originating from the shadow environment vs. production. Enables filtering in workflows, lists, and reports.

**Definition:**

| Field | Value |
|---|---|
| Property name | `hhl_environment` |
| Label | HHL Environment |
| Type | `enumeration` (select) |
| Group | `learning_milestones` |
| Options | `production`, `shadow`, `test` |

**Provisioning:**

The property is defined in `scripts/hubspot/provision-shadow-crm-properties.ts` and can be provisioned via:
```bash
npm run provision:shadow-crm-properties
```

**API scope required:** `crm.schemas.contacts.write` — this scope must be granted to the private app (`HUBSPOT_PRIVATE_APP_TOKEN`) before the script can run. If the scope is not available, create the property manually in HubSpot:
- HubSpot portal → **Settings** → **Properties** → **Contact Properties**
- Create property with the definition above
- Add options: Production, Shadow, Test

**How it gets set on contacts:**

1. **Shadow form hidden field (primary):** After cloning the shadow form (see below), add a hidden field `hhl_environment` with the default value `shadow`. Every contact created via the shadow form will automatically have this property set.

2. **Workflow fallback:** Optionally create a workflow: `Enrolled in "HH-Learn Registration — Shadow"` → set `hhl_environment = shadow`. This catches cases where the form hidden field doesn't fire.

3. **Test contacts:** Manually set `hhl_environment = test` for contacts used in automated testing.

### Test Contact Email Convention

Use the following email pattern for shadow/test contacts:
```
shadow-test+YYYYMMDD@hedgehog.cloud
shadow-test+<purpose>@hedgehog.cloud
```

Examples:
- `shadow-test+20260409@hedgehog.cloud`
- `shadow-test+auth-flow@hedgehog.cloud`

All test contacts should have `hhl_environment = shadow` or `hhl_environment = test`.

**Filtering in HubSpot:**

To exclude shadow/test contacts from production views, create a saved filter:
- `hhl_environment` is `production` (or `is unknown`, for contacts before this property was added)

---

## Form Clone — Operator Steps

The shadow registration form must be cloned manually (HubSpot Forms API requires `forms-access` scope, which is not granted to the current private app token).

**Steps:**

1. In HubSpot portal: **Marketing → Forms**
2. Find the production form: `b2fd98ff-2055-41b2-85a0-0f497e798087`
   - Name: "HH-Learn Registration" (or similar)
3. Click **Actions → Clone**
4. Name the clone: `HH-Learn Registration — Shadow`
5. Open the cloned form and add a **Hidden field**:
   - Property: `hhl_environment`
   - Default value: `shadow`
6. Save and copy the new form GUID (visible in the form's URL or embed code)
7. In `clean-x-hedgehog-templates/learn-shadow/register.html`, replace `SHADOW_FORM_ID_PLACEHOLDER` with the new GUID
8. Upload and publish the updated template:
   ```bash
   npm run build && node dist/scripts/hubspot/upload-templates.js
   npm run build:scripts-cjs && node dist-cjs/scripts/hubspot/publish-template.js \
     --path "CLEAN x HEDGEHOG/templates/learn-shadow/register.html" \
     --local "clean-x-hedgehog-templates/learn-shadow/register.html"
   ```
9. Commit the updated `register.html` to git.

---

## Workflow Clone — Operator Steps (When Applicable)

If production has a post-registration workflow (e.g., welcome email sequence) triggered by form submission to the production form:

1. Clone the workflow in HubSpot: **Automation → Workflows**
2. Name the clone: `[Shadow] <original name>`
3. Change the enrollment trigger from production form → shadow form
4. Add a contact filter: `hhl_environment = shadow`
5. Pause the workflow until shadow testing is active

**Important:** Never add the shadow form as a trigger to an existing production workflow. Always use a separate cloned workflow.

---

## Production Safety Guarantees

The following are in place regardless of whether the form clone operator step has been completed:

| Risk | Mitigation |
|---|---|
| Shadow events tracked to DynamoDB/CRM | `TRACK_EVENTS_ENABLED: false`, `TRACK_EVENTS_URL: ''` in all shadow templates (Phase 0B) |
| Shadow pages indexed by search engines | `<meta name="robots" content="noindex, nofollow">` in all shadow templates (Phase 0A) |
| Shadow pages in sitemap | Confirmed absent from sitemap.xml |
| Shadow form submissions mixed with production | Shadow form not yet cloned — `SHADOW_FORM_ID_PLACEHOLDER` will cause form embed to fail gracefully (no submission possible) until operator completes clone step |

The `SHADOW_FORM_ID_PLACEHOLDER` in `register.html` intentionally prevents shadow form submissions until the clone is complete. This is safer than the previous state where shadow used the production form ID.

---

## Summary: Automated vs Manual

| Step | Status | Command |
|---|---|---|
| `hhl_environment` CRM property definition | Scripted (scope blocked) | `npm run provision:shadow-crm-properties` (after granting scope) |
| Shadow registration form clone | **Manual operator step** | HubSpot UI (see above) |
| Shadow `register.html` form ID update | Manual (after clone) | Edit + upload template |
| Workflow clone | **Manual operator step** | HubSpot UI (when workflows exist) |
| List/segment filter | Manual operator step | HubSpot UI (after property is provisioned) |
| `hhl_environment = shadow` hidden field | Manual (part of form clone) | HubSpot UI |
