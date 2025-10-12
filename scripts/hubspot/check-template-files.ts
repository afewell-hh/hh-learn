#!/usr/bin/env ts-node
/**
 * Check for nested template files in HubSpot Design Manager
 */

import 'dotenv/config';

const nestedPaths = [
  'CLEAN x HEDGEHOG/templates/learn/courses/courses-page.html',
  'CLEAN x HEDGEHOG/templates/learn/pathways/pathways-page.html'
];

async function checkTemplate(path: string) {
  try {
    const response = await fetch(
      `https://api.hubapi.com/cms/v3/source-code/draft/metadata/${encodeURIComponent(path)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`
        }
      }
    );

    if (response.status === 200) {
      console.log(`✗ FOUND nested template: ${path}`);
      return true;
    } else if (response.status === 404) {
      console.log(`✓ Nested template NOT found: ${path}`);
      return false;
    } else {
      console.log(`? Unknown status ${response.status} for: ${path}`);
      return null;
    }
  } catch (err: any) {
    console.error(`Error checking ${path}:`, err.message);
    return null;
  }
}

async function checkAllPages() {
  const pages = [
    { id: '197177162603', name: 'Learn' },
    { id: '197280289288', name: 'Courses' },
    { id: '197280289546', name: 'Pathways' },
    { id: '197399202740', name: 'My Learning' }
  ];

  console.log('\nChecking page bindings:\n');

  for (const page of pages) {
    try {
      const response = await fetch(
        `https://api.hubapi.com/cms/v3/pages/site-pages/${page.id}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`
          }
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        console.log(`${page.name}:`);
        console.log(`  Template: ${data.templatePath}`);
        console.log(`  State: ${data.state}`);
        console.log(`  URL: ${data.url}`);
      }
    } catch (err: any) {
      console.error(`Error checking page ${page.name}:`, err.message);
    }
  }
}

async function main() {
  console.log('Checking for nested template files:\n');

  for (const path of nestedPaths) {
    await checkTemplate(path);
  }

  await checkAllPages();
}

main();
