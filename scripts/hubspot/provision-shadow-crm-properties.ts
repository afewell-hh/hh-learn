#!/usr/bin/env ts-node
/**
 * Provision shadow environment CRM contact properties (Issue #374)
 *
 * Creates or verifies the CRM properties needed to distinguish shadow
 * contacts/activity from production contacts in the same HubSpot portal.
 *
 * Properties created:
 *   hhl_environment  — "production" | "shadow" | "test"
 *                      Set by form hidden field or workflow on registration.
 *                      Enables filtering shadow contacts out of production reports.
 *
 * Usage: npm run provision:shadow-crm-properties [-- --dry-run]
 */

import 'dotenv/config';
import { Client } from '@hubspot/api-client';
import { getHubSpotToken } from './get-hubspot-token.js';

const hubspot = new Client({ accessToken: getHubSpotToken() });

const PROPERTY_GROUP = 'learning_milestones';

const SHADOW_PROPERTIES = [
  {
    name: 'hhl_environment',
    label: 'HHL Environment',
    type: 'enumeration',
    fieldType: 'select',
    groupName: PROPERTY_GROUP,
    description: 'Identifies whether the contact originated from the production or shadow HH-Learn environment. Set via form hidden field or workflow. Use to filter shadow contacts from production reports.',
    options: [
      { label: 'Production', value: 'production', displayOrder: 0, hidden: false },
      { label: 'Shadow', value: 'shadow', displayOrder: 1, hidden: false },
      { label: 'Test', value: 'test', displayOrder: 2, hidden: false },
    ],
    formField: false,
  },
];

async function upsertProperty(prop: any, dryRun: boolean): Promise<void> {
  console.log(`\n📋 Property: ${prop.label} (${prop.name})`);

  if (dryRun) {
    console.log(`   [DRY RUN] Would create/update property in group "${prop.groupName}"`);
    console.log(`   Type: ${prop.type} / ${prop.fieldType}`);
    if (prop.options) {
      console.log(`   Options: ${prop.options.map((o: any) => o.value).join(', ')}`);
    }
    return;
  }

  // Check if property already exists
  try {
    const existing = await hubspot.crm.properties.coreApi.getByName('contacts', prop.name);
    console.log(`   ✓ Already exists (type: ${existing.type})`);
    return;
  } catch (err: any) {
    if (err.code !== 404 && err.statusCode !== 404) {
      // Non-404 error — property may exist but something else is wrong
      console.warn(`   ⚠️  Existence check returned unexpected error: ${err.message}`);
    }
    // 404 = doesn't exist yet, proceed to create
  }

  try {
    const created = await hubspot.crm.properties.coreApi.create('contacts', {
      name: prop.name,
      label: prop.label,
      type: prop.type,
      fieldType: prop.fieldType,
      groupName: prop.groupName,
      description: prop.description,
      options: prop.options,
      formField: prop.formField,
    } as any);
    console.log(`   ✓ Created (type: ${created.type})`);
  } catch (err: any) {
    if (err.statusCode === 409 || (err.body && err.body.message && err.body.message.includes('already exists'))) {
      console.log(`   ✓ Already exists (conflict response)`);
    } else {
      console.error(`   ✗ Failed: ${err.message}`);
      if (err.body) console.error('   Details:', JSON.stringify(err.body, null, 2));
      throw err;
    }
  }
}

async function provisionShadowCrmProperties(dryRun: boolean): Promise<void> {
  console.log('🔧 Provisioning shadow CRM properties (Issue #374)...\n');
  if (dryRun) console.log('📝 DRY RUN — no changes will be made\n');

  for (const prop of SHADOW_PROPERTIES) {
    await upsertProperty(prop, dryRun);
  }

  console.log('\n✅ Shadow CRM property provisioning complete!\n');

  if (!dryRun) {
    console.log('Next steps:');
    console.log('  1. In HubSpot portal, clone the production registration form:');
    console.log('     Marketing → Forms → find "HH-Learn Registration" → Clone');
    console.log('     Name the clone: "HH-Learn Registration — Shadow"');
    console.log('  2. Add a hidden field to the shadow form: hhl_environment = shadow');
    console.log('  3. Update clean-x-hedgehog-templates/learn-shadow/register.html');
    console.log('     with the new shadow form ID (run: npm run provision:shadow-crm-properties -- --dry-run)');
    console.log('     Then edit the formId in the register.html embed block.');
    console.log('  See docs/shadow-operational-assets.md for full instructions.\n');
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

provisionShadowCrmProperties(dryRun).catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
