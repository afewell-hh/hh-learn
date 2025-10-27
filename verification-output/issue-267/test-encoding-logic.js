/**
 * Test script to verify Issue #267 redirect encoding/decoding logic
 * Run in browser console or Node.js to verify the fix
 */

// Simulate enrollment.js buildLoginRedirect function
function buildLoginRedirect(currentPath, loginUrl) {
  const base = loginUrl || '/_hcms/mem/login';
  const separator = base.indexOf('?') >= 0 ? '&' : '?';

  // First encoding: current page path
  const handshakeUrl = '/learn/auth-handshake?redirect_url=' + encodeURIComponent(currentPath);

  // Second encoding: entire handshake URL
  return base + separator + 'redirect_url=' + encodeURIComponent(handshakeUrl);
}

// Simulate auth-handshake.html redirect decoding (BEFORE FIX)
function extractRedirectUrlBefore(loginRedirectUrl) {
  const url = new URL(loginRedirectUrl, 'https://example.com');
  const handshakeUrl = url.searchParams.get('redirect_url'); // First decode

  if (!handshakeUrl) return '/learn';

  const handshakeUrlObj = new URL(handshakeUrl, 'https://example.com');
  const redirectUrl = handshakeUrlObj.searchParams.get('redirect_url'); // Second decode (automatic)

  // BEFORE FIX: No additional decode
  return redirectUrl || '/learn';
}

// Simulate auth-handshake.html redirect decoding (AFTER FIX)
function extractRedirectUrlAfter(loginRedirectUrl) {
  const url = new URL(loginRedirectUrl, 'https://example.com');
  const handshakeUrl = url.searchParams.get('redirect_url'); // First decode

  if (!handshakeUrl) return '/learn';

  const handshakeUrlObj = new URL(handshakeUrl, 'https://example.com');
  let redirectUrl = handshakeUrlObj.searchParams.get('redirect_url'); // Second decode (automatic)

  // AFTER FIX: Manual decode to handle double encoding
  try {
    redirectUrl = decodeURIComponent(redirectUrl);
  } catch (e) {
    console.warn('Failed to decode:', e);
  }

  return redirectUrl || '/learn';
}

// Test cases
const testCases = [
  {
    name: 'Course page without query params',
    path: '/learn/courses/kubernetes-basics',
    expected: '/learn/courses/kubernetes-basics'
  },
  {
    name: 'Pathway page with query params',
    path: '/learn/pathways/cloud-fundamentals?tab=overview',
    expected: '/learn/pathways/cloud-fundamentals?tab=overview'
  },
  {
    name: 'Course page with special characters',
    path: '/learn/courses/intro-to-k8s?source=email&campaign=2024-q1',
    expected: '/learn/courses/intro-to-k8s?source=email&campaign=2024-q1'
  },
  {
    name: 'Catalog page',
    path: '/learn',
    expected: '/learn'
  },
  {
    name: 'Course with fragment',
    path: '/learn/courses/docker-basics#module-2',
    expected: '/learn/courses/docker-basics#module-2'
  }
];

console.log('=== Issue #267 Encoding/Decoding Test ===\n');

let passedBefore = 0;
let passedAfter = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`  Original path: ${testCase.path}`);

  const loginUrl = buildLoginRedirect(testCase.path);
  console.log(`  Login URL: ${loginUrl.substring(0, 100)}...`);

  const resultBefore = extractRedirectUrlBefore(loginUrl);
  const resultAfter = extractRedirectUrlAfter(loginUrl);

  const passBefore = resultBefore === testCase.expected;
  const passAfter = resultAfter === testCase.expected;

  console.log(`  BEFORE FIX: ${resultBefore} ${passBefore ? '✓' : '✗'}`);
  console.log(`  AFTER FIX:  ${resultAfter} ${passAfter ? '✓' : '✗'}`);
  console.log('');

  if (passBefore) passedBefore++;
  if (passAfter) passedAfter++;
});

console.log('=== Results ===');
console.log(`BEFORE FIX: ${passedBefore}/${testCases.length} tests passed`);
console.log(`AFTER FIX:  ${passedAfter}/${testCases.length} tests passed`);

if (passedAfter === testCases.length) {
  console.log('✓ All tests PASSED! Fix is working correctly.');
} else {
  console.log('✗ Some tests FAILED. Review the implementation.');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildLoginRedirect, extractRedirectUrlBefore, extractRedirectUrlAfter };
}
