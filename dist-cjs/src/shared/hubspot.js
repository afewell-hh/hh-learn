"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHubSpotClient = getHubSpotClient;
const api_client_1 = require("@hubspot/api-client");
function getHubSpotClient() {
    // Prefer HubSpot Projects token (static bearer), then API token (static), then Private App token
    const token = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN ||
        process.env.HUBSPOT_API_TOKEN ||
        process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    if (!token) {
        throw new Error('No HubSpot access token available. Set HUBSPOT_PROJECT_ACCESS_TOKEN or HUBSPOT_API_TOKEN or HUBSPOT_PRIVATE_APP_TOKEN.');
    }
    return new api_client_1.Client({ accessToken: token });
}
