import HubSpot from '@hubspot/api-client';

export function getHubSpotClient() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) throw new Error('HUBSPOT_PRIVATE_APP_TOKEN is missing');
  return new HubSpot.Client({ accessToken: token });
}
