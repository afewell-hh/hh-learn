/**
 * Test to reproduce the ACTUAL bug reported in Issue #267
 * The bug manifests when URLSearchParams.get() is called on the encoded URL
 */

console.log('=== Issue #267 Actual Bug Reproduction ===\n');

// Simulate user on course page
const originalPath = '/learn/courses/kubernetes-basics';
console.log(`1. User on page: ${originalPath}\n`);

// Step 1: Build login redirect (from enrollment.js)
const handshakeUrl = '/learn/auth-handshake?redirect_url=' + encodeURIComponent(originalPath);
console.log(`2. Handshake URL: ${handshakeUrl}`);
console.log(`   (after first encoding)\n`);

const loginUrl = '/_hcms/mem/login?redirect_url=' + encodeURIComponent(handshakeUrl);
console.log(`3. Full login URL: ${loginUrl}`);
console.log(`   (after second encoding)\n`);

// Step 2: User logs in, HubSpot membership redirects to handshake page
// The handshake page receives the URL with the encoded redirect_url parameter

const handshakePageUrl = new URL(loginUrl.split('redirect_url=')[1], 'https://example.com');
console.log(`4. After login, user lands on: ${decodeURIComponent(loginUrl.split('redirect_url=')[1])}\n`);

// Step 3: auth-handshake.html extracts redirect_url
const params = new URLSearchParams(handshakePageUrl.search);
const redirectUrlFromParams = params.get('redirect_url');

console.log(`5. URLSearchParams.get('redirect_url') returns:`);
console.log(`   "${redirectUrlFromParams}"\n`);

// BEFORE FIX: Directly use the value
console.log('BEFORE FIX (no additional decode):');
console.log(`  Redirect to: ${redirectUrlFromParams}`);
console.log(`  Browser navigates to: ${redirectUrlFromParams}`);
console.log(`  Result: ${redirectUrlFromParams.includes('%2F') ? '✗ BROKEN (has %2F)' : '✓ OK'}\n`);

// AFTER FIX: Decode one more time
let redirectUrlDecoded = redirectUrlFromParams;
try {
  redirectUrlDecoded = decodeURIComponent(redirectUrlFromParams);
} catch (e) {
  console.error('Decode failed:', e);
}

console.log('AFTER FIX (with manual decode):');
console.log(`  Redirect to: ${redirectUrlDecoded}`);
console.log(`  Browser navigates to: ${redirectUrlDecoded}`);
console.log(`  Result: ${redirectUrlDecoded.includes('%2F') ? '✗ BROKEN (has %2F)' : '✓ FIXED'}\n`);

// The actual issue demonstration
console.log('=== THE ACTUAL BUG ===');
console.log('When enrollment.js double-encodes the path, the handshake page receives:');
console.log(`  redirect_url=${encodeURIComponent(originalPath)}`);
console.log('\nURLSearchParams.get() decodes it ONCE:');
console.log(`  Result: "${decodeURIComponent(encodeURIComponent(originalPath))}"`);
console.log(`  Still encoded? ${originalPath === decodeURIComponent(encodeURIComponent(originalPath)) ? 'NO' : 'YES'}`);
console.log('\nBut wait... let me trace the ACTUAL double encoding:\n');

// The REAL bug trace
console.log('STEP-BY-STEP ENCODING TRACE:');
console.log(`1. Original: ${originalPath}`);

const firstEncode = encodeURIComponent(originalPath);
console.log(`2. First encode: ${firstEncode}`);

const withFirstParam = `/learn/auth-handshake?redirect_url=${firstEncode}`;
console.log(`3. Build handshake URL: ${withFirstParam}`);

const secondEncode = encodeURIComponent(withFirstParam);
console.log(`4. Second encode (entire handshake URL): ${secondEncode}`);

const fullLogin = `/_hcms/mem/login?redirect_url=${secondEncode}`;
console.log(`5. Full login URL: ${fullLogin}\n`);

// Simulate HubSpot redirecting to handshake
console.log('AFTER HubSpot login redirects:');
const afterRedirect = decodeURIComponent(secondEncode);
console.log(`6. Browser receives: ${afterRedirect}`);

// Now parse the redirect_url param from the handshake URL
const handshakeParams = new URLSearchParams(afterRedirect.split('?')[1]);
const finalRedirectUrl = handshakeParams.get('redirect_url');
console.log(`7. URLSearchParams.get('redirect_url'): ${finalRedirectUrl}`);
console.log(`8. Is still encoded? ${finalRedirectUrl !== originalPath ? 'YES ✗' : 'NO ✓'}\n`);

if (finalRedirectUrl !== originalPath) {
  console.log('BUG CONFIRMED: redirect_url is still URL-encoded after URLSearchParams.get()');
  console.log(`Expected: ${originalPath}`);
  console.log(`Got:      ${finalRedirectUrl}`);
  console.log(`\nFIX: Call decodeURIComponent() on the result:`);
  console.log(`  decodeURIComponent("${finalRedirectUrl}") = "${decodeURIComponent(finalRedirectUrl)}"`);
  console.log(`  Matches original? ${decodeURIComponent(finalRedirectUrl) === originalPath ? '✓ YES' : '✗ NO'}`);
} else {
  console.log('No bug found in this test - URLSearchParams handled it correctly');
}
