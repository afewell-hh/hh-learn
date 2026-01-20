#!/usr/bin/env node
/**
 * Script to create Phase 5 CRM contact properties in HubSpot
 * Issue #305: HubSpot CRM Sync (Registration + Milestones)
 *
 * Usage:
 *   node scripts/create-crm-properties.js
 *
 * Prerequisites:
 *   - HUBSPOT_PROJECT_ACCESS_TOKEN (preferred) or HUBSPOT_PRIVATE_APP_TOKEN (legacy fallback)
 *   - Token must include crm.schemas.contacts.write scope
 */

const hubspot = require('@hubspot/api-client');
require('dotenv').config();

const PROPERTY_GROUP = 'learning_milestones';
const PROPERTY_GROUP_LABEL = 'Learning Milestones';

const PROPERTIES = [
  {
    name: 'hhl_enrolled_courses',
    label: 'HHL Enrolled Courses',
    type: 'string',
    fieldType: 'textarea',
    groupName: PROPERTY_GROUP,
    description: 'Semicolon-delimited list of enrolled course slugs (managed by API)',
    formField: false,
  },
  {
    name: 'hhl_completed_courses',
    label: 'HHL Completed Courses',
    type: 'string',
    fieldType: 'textarea',
    groupName: PROPERTY_GROUP,
    description: 'Semicolon-delimited list of completed course slugs (managed by API)',
    formField: false,
  },
  {
    name: 'hhl_total_progress',
    label: 'HHL Total Progress',
    type: 'number',
    fieldType: 'number',
    groupName: PROPERTY_GROUP,
    description: 'Total count of completed modules across all courses (managed by API)',
    formField: false,
  },
  {
    name: 'hhl_last_activity',
    label: 'HHL Last Activity',
    type: 'date',
    fieldType: 'date',
    groupName: PROPERTY_GROUP,
    description: 'Last learning activity timestamp (managed by API)',
    formField: false,
  },
];

async function createPropertyGroup(client) {
  try {
    console.log(`Creating property group: ${PROPERTY_GROUP_LABEL}...`);
    await client.crm.properties.groupsApi.create('contacts', {
      name: PROPERTY_GROUP,
      label: PROPERTY_GROUP_LABEL,
      displayOrder: -1,
    });
    console.log('✓ Property group created successfully');
  } catch (error) {
    if (error.statusCode === 409) {
      console.log('✓ Property group already exists');
    } else {
      console.error('✗ Failed to create property group:', error.message);
      throw error;
    }
  }
}

async function createProperty(client, propertyDef) {
  try {
    console.log(`Creating property: ${propertyDef.label} (${propertyDef.name})...`);
    await client.crm.properties.coreApi.create('contacts', propertyDef);
    console.log(`✓ Property ${propertyDef.name} created successfully`);
  } catch (error) {
    if (error.statusCode === 409) {
      console.log(`✓ Property ${propertyDef.name} already exists`);
    } else {
      console.error(`✗ Failed to create property ${propertyDef.name}:`, error.message);
      throw error;
    }
  }
}

async function main() {
  const token = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN || process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    console.error('ERROR: No HubSpot access token set in environment');
    console.error('Set HUBSPOT_PROJECT_ACCESS_TOKEN (preferred) or HUBSPOT_PRIVATE_APP_TOKEN (legacy).');
    process.exit(1);
  }

  console.log('\n=== HubSpot CRM Properties Setup (Issue #305) ===\n');

  const client = new hubspot.Client({ accessToken: token });

  try {
    // Step 1: Create property group
    await createPropertyGroup(client);

    console.log('\n--- Creating Properties ---\n');

    // Step 2: Create each property
    for (const propertyDef of PROPERTIES) {
      await createProperty(client, propertyDef);
    }

    console.log('\n✓ All properties created successfully!');
    console.log('\nYou can now view these properties in HubSpot:');
    console.log('  Settings → Properties → Contact Properties → Learning Milestones');
    console.log('\nNext steps:');
    console.log('  1. Deploy Lambda with updated code (npm run deploy:aws)');
    console.log('  2. Test with authenticated enrollment flow');
    console.log('  3. Verify properties populate in contact records\n');
  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
