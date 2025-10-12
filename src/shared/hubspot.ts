import HubSpot from '@hubspot/api-client';

export function getHubSpotClient() {
  // Prefer Project App (OAuth) token, then API token (static), then Private App token
  const token =
    process.env.HUBSPOT_PROJECT_ACCESS_TOKEN ||
    process.env.HUBSPOT_API_TOKEN ||
    process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    throw new Error(
      'No HubSpot access token available. Set HUBSPOT_PROJECT_ACCESS_TOKEN or HUBSPOT_API_TOKEN or HUBSPOT_PRIVATE_APP_TOKEN.'
    );
  }

  return new HubSpot.Client({ accessToken: token });
}
