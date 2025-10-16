"use strict";
/**
 * Get HubSpot access token - prefers Project Access Token, falls back to Private App Token
 *
 * This utility provides a single source of truth for HubSpot authentication in provisioning scripts.
 * It implements the migration path from Private App tokens to HubSpot Projects Access Tokens (static bearer tokens).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHubSpotToken = getHubSpotToken;
exports.maskToken = maskToken;
exports.allowlistOverrideEnabled = allowlistOverrideEnabled;
exports.hasHubSpotToken = hasHubSpotToken;
function getHubSpotToken() {
    // Prefer project access token (static bearer token from HubSpot Projects)
    const projectToken = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN;
    if (projectToken) {
        console.log('   Using HUBSPOT_PROJECT_ACCESS_TOKEN (HubSpot Projects static token)');
        return projectToken;
    }
    // Fall back to private app token (legacy)
    const privateToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    if (privateToken) {
        console.log('   Using HUBSPOT_PRIVATE_APP_TOKEN (legacy - consider migrating to HubSpot Projects)');
        return privateToken;
    }
    // No token available
    throw new Error('No HubSpot access token available. ' +
        'Set HUBSPOT_PROJECT_ACCESS_TOKEN (preferred) or HUBSPOT_PRIVATE_APP_TOKEN (legacy).');
}
/**
 * Guard: ensure a value is not accidentally logged.
 * Returns a masked version for safe logs.
 */
function maskToken(token) {
    if (!token)
        return '<empty>';
    if (token.length <= 8)
        return '<masked>';
    return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
/**
 * Guard: evaluate whether the override flag is set.
 * Set via CLI flag `--unsafe-allow-outside-allowlist` or env `ALLOWLIST_OVERRIDE=true`.
 */
function allowlistOverrideEnabled(argv = process.argv) {
    return argv.includes('--unsafe-allow-outside-allowlist') || process.env.ALLOWLIST_OVERRIDE === 'true';
}
/**
 * Check if a HubSpot token is available (without throwing)
 */
function hasHubSpotToken() {
    return !!(process.env.HUBSPOT_PROJECT_ACCESS_TOKEN || process.env.HUBSPOT_PRIVATE_APP_TOKEN);
}
