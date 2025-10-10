/**
 * Get HubSpot access token - prefers Project Access Token, falls back to Private App Token
 *
 * This utility provides a single source of truth for HubSpot authentication in provisioning scripts.
 * It implements the migration path from Private App tokens to Project App OAuth tokens.
 */

export function getHubSpotToken(): string {
  // Prefer project access token (OAuth from HubSpot Projects)
  const projectToken = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN;
  if (projectToken) {
    console.log('   Using HUBSPOT_PROJECT_ACCESS_TOKEN (OAuth)');
    return projectToken;
  }

  // Fall back to private app token (legacy)
  const privateToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (privateToken) {
    console.log('   Using HUBSPOT_PRIVATE_APP_TOKEN (legacy - consider migrating to Project App)');
    return privateToken;
  }

  // No token available
  throw new Error(
    'No HubSpot access token available. ' +
    'Set HUBSPOT_PROJECT_ACCESS_TOKEN (preferred) or HUBSPOT_PRIVATE_APP_TOKEN (legacy).'
  );
}

/**
 * Check if a HubSpot token is available (without throwing)
 */
export function hasHubSpotToken(): boolean {
  return !!(process.env.HUBSPOT_PROJECT_ACCESS_TOKEN || process.env.HUBSPOT_PRIVATE_APP_TOKEN);
}
