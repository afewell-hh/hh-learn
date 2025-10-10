import HubSpot from '@hubspot/api-client';

export function getHubSpotClient() {
  // Prefer project access token (OAuth), fall back to private app token
  const token = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN ||
                process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    throw new Error('No HubSpot access token available. Set HUBSPOT_PROJECT_ACCESS_TOKEN or HUBSPOT_PRIVATE_APP_TOKEN.');
  }

  return new HubSpot.Client({ accessToken: token });
}
