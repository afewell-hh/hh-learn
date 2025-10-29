/**
 * Create action-runner page in HubSpot
 * Usage: node scripts/create-action-runner-page.js
 */

const fs = require('fs');
const path = require('path');
const hubspot = require('@hubspot/api-client');

const client = new hubspot.Client({ accessToken: process.env.HUBSPOT_PROJECT_ACCESS_TOKEN });

async function createPage() {
  try {
    // Read the HTML template
    const templatePath = path.join(__dirname, '..', 'clean-x-hedgehog-templates', 'learn', 'action-runner.html');
    const template = fs.readFileSync(templatePath, 'utf8');

    // Page configuration
    const pageData = {
      name: 'Action Runner',
      htmlTitle: 'Processing...',
      slug: 'learn/action-runner',
      contentTypeCategory: 'SITE_PAGE',
      state: 'PUBLISHED',
      publicAccessRules: [],
      publicAccessRulesEnabled: false,
      widgets: {},
      widgetContainers: {},
      layoutSections: {},
      htmlBody: template
    };

    console.log('Creating action-runner page...');
    const result = await client.cms.pages.sitePagesApi.create(pageData);

    console.log('✓ Page created successfully!');
    console.log('  URL:', result.url);
    console.log('  Page ID:', result.id);
    console.log('  Path:', result.slug);

    return result;
  } catch (error) {
    console.error('✗ Error creating page:', error.message);
    if (error.body) {
      console.error('Error details:', JSON.stringify(error.body, null, 2));
    }
    throw error;
  }
}

createPage()
  .then(() => {
    console.log('\n✓ Action runner page is ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Failed to create action runner page');
    process.exit(1);
  });
