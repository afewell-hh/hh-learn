#!/usr/bin/env node

/**
 * Membership Profile Debug Script (Issue #237)
 *
 * This script provides a convenient way to test the membership profile API
 * and debug membership session behavior outside of the browser.
 *
 * Usage:
 *   node scripts/membership/debug-profile.js
 *
 * Environment Variables:
 *   HUBSPOT_TEST_USERNAME - CMS membership account email
 *   HUBSPOT_TEST_PASSWORD - CMS membership account password
 *   COURSE_URL - Course URL to test (default: https://hedgehog.cloud/learn/courses/course-authoring-101)
 */

require('dotenv').config();

const COURSE_URL = process.env.COURSE_URL || 'https://hedgehog.cloud/learn/courses/course-authoring-101?hs_no_cache=1';
const LOGIN_URL = 'https://hedgehog.cloud/_hcms/mem/login';
const PROFILE_API_URL = 'https://hedgehog.cloud/_hcms/api/membership/v1/profile';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Membership Profile Debug Tool (Issue #237)                    ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('This tool helps debug HubSpot CMS membership session behavior.');
console.log('');
console.log('Manual Testing Steps:');
console.log('');
console.log('1. Open a browser to: ' + COURSE_URL);
console.log('');
console.log('2. Open browser console and enable debug mode:');
console.log('   > localStorage.setItem("HHL_DEBUG", "true")');
console.log('   > location.reload()');
console.log('');
console.log('3. You should see debug output in the console:');
console.log('   [hhl:debug] Debug mode ENABLED');
console.log('   [hhl:bootstrap] Auth Context Loaded');
console.log('   [hhl:cookies] Cookie Information');
console.log('   [hhl:membership] Profile API Response');
console.log('');
console.log('4. Sign in to HubSpot CMS membership using:');
console.log('   Username: ' + (process.env.HUBSPOT_TEST_USERNAME || '(not set - check .env)'));
console.log('   Password: ' + (process.env.HUBSPOT_TEST_PASSWORD ? '(set)' : '(not set - check .env)'));
console.log('');
console.log('5. After login, the debug output should show:');
console.log('   - Populated email and contactId in auth context');
console.log('   - Membership profile API returning 200 status');
console.log('   - HubSpot session cookies present');
console.log('');
console.log('6. Check the following:');
console.log('   a. #hhl-auth-context element has data-email and data-contact-id');
console.log('   b. Membership profile API returns 200 (not 404)');
console.log('   c. Cookies persist across page reloads');
console.log('   d. CTA button shows "Start Course" instead of "Sign in to start course"');
console.log('');
console.log('───────────────────────────────────────────────────────────────');
console.log('');
console.log('Expected Behavior (Anonymous):');
console.log('  - Profile API: 404 (no session)');
console.log('  - Auth Context: email and contactId empty');
console.log('  - CTA: "Sign in to start course"');
console.log('');
console.log('Expected Behavior (Authenticated):');
console.log('  - Profile API: 200 with user data');
console.log('  - Auth Context: email and contactId populated');
console.log('  - CTA: "Start Course" or "✓ Enrolled"');
console.log('  - Cookies: Multiple hs* cookies present');
console.log('');
console.log('───────────────────────────────────────────────────────────────');
console.log('');
console.log('Automated Testing:');
console.log('');
console.log('Run Playwright tests to capture detailed session behavior:');
console.log('');
console.log('  npm run test:e2e tests/e2e/membership-instrumentation.spec.ts');
console.log('');
console.log('Results will be saved to: verification-output/issue-237/');
console.log('');
console.log('Files created:');
console.log('  - anonymous-session-capture.json');
console.log('  - authenticated-session-capture.json');
console.log('  - debug-module-output.json');
console.log('  - post-login-page.png');
console.log('');
console.log('───────────────────────────────────────────────────────────────');
console.log('');
console.log('Troubleshooting:');
console.log('');
console.log('If membership profile API returns 404:');
console.log('  1. Check that CMS Membership is enabled in HubSpot');
console.log('  2. Verify user is assigned to an access group');
console.log('  3. Check that cookies are being set during login');
console.log('  4. Inspect Network tab for redirect chain during login');
console.log('');
console.log('If auth context is empty after login:');
console.log('  1. Check that request_contact.is_logged_in is true in template');
console.log('  2. Verify HubL variables are rendering correctly');
console.log('  3. Check for JavaScript errors in console');
console.log('  4. Ensure templates are published and not cached');
console.log('');
console.log('If cookies are not persisting:');
console.log('  1. Check cookie domain and path settings');
console.log('  2. Verify SameSite and Secure flags');
console.log('  3. Check for redirects that might clear cookies');
console.log('  4. Test in incognito mode to rule out extension interference');
console.log('');
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Ready to debug! Follow the steps above.                       ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
