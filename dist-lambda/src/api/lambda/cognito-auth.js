"use strict";
/**
 * Cognito OAuth 2.0 + PKCE Authentication Handlers (Issue #303)
 *
 * Implements external SSO with AWS Cognito:
 * - GET /auth/login - Redirect to Cognito with PKCE
 * - GET /auth/callback - Token exchange and cookie setting
 * - POST /auth/logout - Cookie clearing and Cognito logout
 * - GET /auth/me - User profile from DynamoDB
 *
 * @see tests/PHASE-3-AUTH-TESTS.md
 * @see tests/e2e/cognito-auth-flow.spec.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLogin = handleLogin;
exports.handleSignup = handleSignup;
exports.handleCallback = handleCallback;
exports.handleLogout = handleLogout;
exports.handleMe = handleMe;
exports.handleCheckEmail = handleCheckEmail;
exports.handleClaim = handleClaim;
const crypto = __importStar(require("crypto"));
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const hubspot_js_1 = require("../../shared/hubspot.js");
// Cognito configuration from environment
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const COGNITO_REDIRECT_URI = process.env.COGNITO_REDIRECT_URI;
const COGNITO_ISSUER = process.env.COGNITO_ISSUER;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-west-2';
// DynamoDB configuration
const DYNAMODB_USERS_TABLE = process.env.DYNAMODB_USERS_TABLE;
// Site base URL – the callback runs on api.hedgehog.cloud so all redirects back
// to the CMS must be absolute; relative paths would resolve to api.hedgehog.cloud
// and return {"message":"Not Found"} from API Gateway.
const SITE_BASE_URL = (process.env.SITE_BASE_URL || 'https://hedgehog.cloud').replace(/\/$/, '');
function toAbsoluteUrl(path) {
    if (path.startsWith('/')) {
        return `${SITE_BASE_URL}${path}`;
    }
    // Already absolute (sanitizeRedirectUrl normally prevents this, but be safe)
    return path;
}
// Session configuration
const ACCESS_TOKEN_MAX_AGE = 3600; // 1 hour
const REFRESH_TOKEN_MAX_AGE = 2592000; // 30 days
// STATE_SECRET is required for signing state parameters
// Using a random value would break state verification across Lambda invocations
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required for state parameter signing');
}
const STATE_SECRET = process.env.JWT_SECRET;
// Test bypass for mock auth codes
const ENABLE_TEST_BYPASS = process.env.ENABLE_TEST_BYPASS === 'true';
// DynamoDB client
const dynamoClient = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({ region: COGNITO_REGION }));
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region: COGNITO_REGION });
let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour in milliseconds
/**
 * Fetch Cognito JWKS for JWT signature verification
 */
async function fetchJWKS() {
    const now = Date.now();
    // Return cached JWKS if still valid
    if (jwksCache && now < jwksCacheExpiry) {
        return jwksCache;
    }
    const jwksUrl = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
    console.log('[JWKS] Fetching from:', jwksUrl);
    const response = await fetch(jwksUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }
    jwksCache = await response.json();
    jwksCacheExpiry = now + JWKS_CACHE_TTL;
    console.log('[JWKS] Cached successfully, expires in 1 hour');
    return jwksCache;
}
/**
 * Convert JWK to PEM format for JWT verification
 */
function jwkToPem(jwk) {
    const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return keyObject.export({ format: 'pem', type: 'spki' }).toString();
}
/**
 * Verify JWT token using Cognito JWKS
 * @param token JWT token to verify
 * @param options Validation options
 * @param options.audience Expected audience (for ID tokens)
 * @param options.clientId Expected client_id (for access tokens)
 * @param options.tokenUse Expected token_use ('id' or 'access')
 */
async function verifyJWT(token, options) {
    // Decode header to get kid
    const decodedHeader = jsonwebtoken_1.default.decode(token, { complete: true });
    if (!decodedHeader || typeof decodedHeader === 'string') {
        throw new Error('Invalid token format');
    }
    const kid = decodedHeader.header.kid;
    if (!kid) {
        throw new Error('Token missing kid in header');
    }
    // Fetch JWKS and find matching key
    const jwks = await fetchJWKS();
    const jwk = jwks.keys.find(key => key.kid === kid);
    if (!jwk) {
        throw new Error(`No matching JWK found for kid: ${kid}`);
    }
    // Convert JWK to PEM
    const pem = jwkToPem(jwk);
    // Verify signature and claims
    const decoded = jsonwebtoken_1.default.verify(token, pem, {
        algorithms: ['RS256'],
        issuer: COGNITO_ISSUER,
        ...(options?.audience && { audience: options.audience }),
    });
    // Additional claim validation
    if (options?.tokenUse && decoded.token_use !== options.tokenUse) {
        throw new Error(`Invalid token_use: expected ${options.tokenUse}, got ${decoded.token_use}`);
    }
    if (options?.clientId && decoded.client_id !== options.clientId) {
        throw new Error(`Invalid client_id: expected ${options.clientId}, got ${decoded.client_id}`);
    }
    return decoded;
}
/**
 * CORS helper - get allowed origin from request
 * Only allows hedgehog.cloud and www.hedgehog.cloud for auth endpoints
 * (aligns with serverless.yml CORS configuration)
 */
const ALLOWED_ORIGINS = [
    'https://hedgehog.cloud',
    'https://www.hedgehog.cloud',
];
function getAllowedOrigin(origin) {
    if (!origin)
        return 'https://hedgehog.cloud';
    // Check exact matches only
    if (ALLOWED_ORIGINS.includes(origin))
        return origin;
    // Default fallback
    return 'https://hedgehog.cloud';
}
function withCorsHeaders(origin, extra = {}) {
    return {
        'Access-Control-Allow-Origin': getAllowedOrigin(origin),
        'Access-Control-Allow-Credentials': 'true',
        ...extra,
    };
}
function jsonResponse(statusCode, body, origin) {
    return {
        statusCode,
        headers: withCorsHeaders(origin, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
    };
}
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
/**
 * PKCE helpers
 */
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(verifier) {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
}
/**
 * State parameter helpers (encodes redirect_url and code_verifier)
 */
function encodeState(redirectUrl, codeVerifier) {
    const payload = {
        redirect_url: redirectUrl,
        code_verifier: codeVerifier,
        nonce: crypto.randomBytes(16).toString('hex'),
        timestamp: Date.now(),
    };
    // Sign the state to prevent tampering
    return jsonwebtoken_1.default.sign(payload, STATE_SECRET, { expiresIn: '10m' });
}
function decodeState(state) {
    try {
        const decoded = jsonwebtoken_1.default.verify(state, STATE_SECRET);
        return {
            redirect_url: decoded.redirect_url,
            code_verifier: decoded.code_verifier,
        };
    }
    catch (err) {
        console.error('[State] Invalid state parameter:', err);
        return null;
    }
}
/**
 * Sanitize redirect_url to prevent open redirect attacks
 */
function sanitizeRedirectUrl(redirectUrl) {
    const defaultRedirect = '/learn';
    if (!redirectUrl || redirectUrl.length > 500) {
        return defaultRedirect;
    }
    // Block absolute URLs and dangerous protocols
    if (redirectUrl.includes('://') ||
        redirectUrl.startsWith('//') ||
        redirectUrl.startsWith('javascript:') ||
        redirectUrl.startsWith('data:')) {
        console.warn('[Security] Blocked potentially dangerous redirect_url:', redirectUrl);
        return defaultRedirect;
    }
    // Ensure it starts with /
    if (!redirectUrl.startsWith('/')) {
        return `/${redirectUrl}`;
    }
    return redirectUrl;
}
/**
 * Cookie helpers
 */
function createCookieString(name, value, maxAge, path = '/') {
    const attributes = [
        `${name}=${value}`,
        `Max-Age=${maxAge}`,
        `Path=${path}`,
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
    ];
    return attributes.join('; ');
}
function clearCookieString(name, path = '/') {
    return `${name}=; Max-Age=0; Path=${path}; HttpOnly; Secure; SameSite=Strict`;
}
function getCookieValue(rawCookies, name) {
    if (!rawCookies)
        return null;
    const cookieString = Array.isArray(rawCookies) ? rawCookies.join('; ') : rawCookies;
    const match = cookieString.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
}
async function refreshAccessToken(refreshToken) {
    const tokenUrl = `https://${COGNITO_DOMAIN}/oauth2/token`;
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: COGNITO_CLIENT_ID,
        refresh_token: refreshToken,
    });
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Refresh token failed: ${response.status} ${text}`);
    }
    return response.json();
}
/**
 * Exchange authorization code for tokens with Cognito
 */
async function exchangeCodeForTokens(code, codeVerifier) {
    const tokenEndpoint = `https://${COGNITO_DOMAIN}/oauth2/token`;
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: COGNITO_CLIENT_ID,
        code: code,
        redirect_uri: COGNITO_REDIRECT_URI,
        code_verifier: codeVerifier,
    });
    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    });
    if (!response.ok) {
        const error = await response.text();
        console.error('[Cognito] Token exchange failed:', error);
        throw new Error(`Token exchange failed: ${response.status}`);
    }
    return await response.json();
}
/**
 * Verify Cognito ID token JWT
 */
async function verifyIdToken(idToken) {
    // Verify signature, issuer, audience, and token_use for ID tokens
    return await verifyJWT(idToken, {
        audience: COGNITO_CLIENT_ID,
        tokenUse: 'id',
    });
}
function buildHostedUiUrl(path, redirectUrl) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = encodeState(redirectUrl, codeVerifier);
    const authUrl = new URL(`https://${COGNITO_DOMAIN}${path}`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', COGNITO_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', COGNITO_REDIRECT_URI);
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    return authUrl.toString();
}
/**
 * GET /auth/login
 * Redirects to Cognito Hosted UI with PKCE parameters
 */
async function handleLogin(event) {
    try {
        // Extract and sanitize redirect_url
        const rawRedirectUrl = event.queryStringParameters?.redirect_url;
        const redirectUrl = sanitizeRedirectUrl(rawRedirectUrl);
        const authUrl = buildHostedUiUrl('/oauth2/authorize', redirectUrl);
        console.log('[Login] Redirecting to Cognito:', authUrl);
        return {
            statusCode: 302,
            headers: {
                Location: authUrl,
            },
        };
    }
    catch (err) {
        console.error('[Login] Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Login failed' }),
        };
    }
}
/**
 * GET /auth/signup
 * Redirects to Cognito Hosted UI sign-up flow with PKCE/state.
 */
async function handleSignup(event) {
    try {
        const rawRedirectUrl = event.queryStringParameters?.redirect_url;
        const redirectUrl = sanitizeRedirectUrl(rawRedirectUrl);
        const signupUrl = buildHostedUiUrl('/signup', redirectUrl);
        console.log('[Signup] Redirecting to Cognito signup:', signupUrl);
        return {
            statusCode: 302,
            headers: {
                Location: signupUrl,
            },
        };
    }
    catch (err) {
        console.error('[Signup] Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Signup redirect failed' }),
        };
    }
}
/**
 * GET /auth/callback
 * Handles OAuth callback from Cognito
 */
async function handleCallback(event) {
    try {
        const code = event.queryStringParameters?.code;
        const state = event.queryStringParameters?.state;
        const error = event.queryStringParameters?.error;
        // Handle Cognito errors
        if (error) {
            console.error('[Callback] Cognito error:', error, event.queryStringParameters?.error_description);
            return {
                statusCode: 302,
                headers: {
                    Location: toAbsoluteUrl(`/learn?auth_error=${encodeURIComponent(error)}`),
                },
            };
        }
        // Validate required parameters
        if (!code) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required parameter: code' }),
            };
        }
        if (!state) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required parameter: state' }),
            };
        }
        // Test bypass for mock codes
        if (ENABLE_TEST_BYPASS && code.startsWith('MOCK_')) {
            console.warn('[TEST] Using mock auth bypass for code:', code);
            const stateData = decodeState(state);
            if (!stateData) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid state parameter' }),
                };
            }
            // Set mock cookies for testing
            return {
                statusCode: 302,
                headers: {
                    Location: toAbsoluteUrl(stateData.redirect_url || '/learn'),
                },
                cookies: [
                    createCookieString('hhl_access_token', 'mock_access_token_for_testing', ACCESS_TOKEN_MAX_AGE),
                    createCookieString('hhl_refresh_token', 'mock_refresh_token_for_testing', REFRESH_TOKEN_MAX_AGE, '/auth'),
                ],
            };
        }
        // Decode and validate state
        const stateData = decodeState(state);
        if (!stateData) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid or expired state parameter' }),
            };
        }
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, stateData.code_verifier);
        // Verify ID token and extract user info
        const idTokenPayload = await verifyIdToken(tokens.id_token);
        const userId = idTokenPayload.sub;
        const email = idTokenPayload.email;
        // Create or update user in DynamoDB
        await createOrUpdateUser(userId, email, idTokenPayload);
        // Sync HubSpot contact and persist contact ID (non-fatal to auth flow)
        try {
            const hubspotContactId = await syncHubSpotContact(email);
            if (hubspotContactId) {
                await updateUserHubspotContactId(userId, hubspotContactId);
            }
        }
        catch (syncError) {
            console.error('[Callback] HubSpot contact sync failed (non-fatal):', syncError?.message || syncError);
        }
        // Set httpOnly cookies
        const cookies = [
            createCookieString('hhl_access_token', tokens.access_token, ACCESS_TOKEN_MAX_AGE),
            createCookieString('hhl_refresh_token', tokens.refresh_token, REFRESH_TOKEN_MAX_AGE, '/auth'),
        ];
        console.log('[Callback] Authentication successful for user:', userId);
        // Redirect to original page – must be absolute because this callback runs on
        // api.hedgehog.cloud; a relative path would resolve there and return 404.
        return {
            statusCode: 302,
            headers: {
                Location: toAbsoluteUrl(stateData.redirect_url || '/learn'),
            },
            cookies,
        };
    }
    catch (err) {
        console.error('[Callback] Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Authentication failed' }),
        };
    }
}
/**
 * POST /auth/logout
 * Clears auth cookies and redirects to Cognito logout
 */
async function handleLogout(event) {
    try {
        // Build Cognito logout URL
        const logoutUrl = new URL(`https://${COGNITO_DOMAIN}/logout`);
        logoutUrl.searchParams.set('client_id', COGNITO_CLIENT_ID);
        logoutUrl.searchParams.set('logout_uri', 'https://hedgehog.cloud/learn');
        // Clear cookies
        const cookies = [
            clearCookieString('hhl_access_token'),
            clearCookieString('hhl_refresh_token', '/auth'),
        ];
        console.log('[Logout] Clearing cookies and redirecting to Cognito logout');
        return {
            statusCode: 302,
            headers: {
                Location: logoutUrl.toString(),
            },
            cookies,
        };
    }
    catch (err) {
        console.error('[Logout] Error:', err);
        // Still clear cookies even if Cognito redirect fails
        return {
            statusCode: 302,
            headers: {
                Location: toAbsoluteUrl('/learn'),
            },
            cookies: [
                clearCookieString('hhl_access_token'),
                clearCookieString('hhl_refresh_token', '/auth'),
            ],
        };
    }
}
/**
 * GET /auth/me
 * Returns user profile from DynamoDB
 */
async function handleMe(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigin = getAllowedOrigin(origin);
    try {
        // Extract access token from cookie
        const cookies = event.cookies && event.cookies.length ? event.cookies : (event.headers?.cookie || event.headers?.Cookie || '');
        const refreshToken = getCookieValue(cookies, 'hhl_refresh_token');
        let accessToken = getCookieValue(cookies, 'hhl_access_token');
        const refreshedCookies = [];
        // Verify JWT signature, issuer, expiration, client_id, and token_use
        let decoded;
        try {
            if (!accessToken) {
                throw new Error('Missing access token');
            }
            decoded = await verifyJWT(accessToken, {
                clientId: COGNITO_CLIENT_ID,
                tokenUse: 'access',
            });
        }
        catch (verifyErr) {
            if (!refreshToken) {
                console.error('[Me] JWT verification failed and no refresh token present:', verifyErr.message);
                return {
                    statusCode: 401,
                    headers: {
                        'WWW-Authenticate': 'Bearer realm="Hedgehog Learn"',
                        'Access-Control-Allow-Origin': allowedOrigin,
                        'Access-Control-Allow-Credentials': 'true',
                    },
                    body: JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }),
                };
            }
            try {
                const refreshed = await refreshAccessToken(refreshToken);
                accessToken = refreshed.access_token;
                if (!accessToken) {
                    throw new Error('Missing access_token in refresh response');
                }
                refreshedCookies.push(createCookieString('hhl_access_token', accessToken, ACCESS_TOKEN_MAX_AGE));
                if (refreshed.refresh_token) {
                    refreshedCookies.push(createCookieString('hhl_refresh_token', refreshed.refresh_token, REFRESH_TOKEN_MAX_AGE, '/auth'));
                }
                decoded = await verifyJWT(accessToken, {
                    clientId: COGNITO_CLIENT_ID,
                    tokenUse: 'access',
                });
            }
            catch (refreshErr) {
                console.error('[Me] Refresh token failed:', refreshErr.message);
                return {
                    statusCode: 401,
                    headers: {
                        'WWW-Authenticate': 'Bearer realm="Hedgehog Learn"',
                        'Access-Control-Allow-Origin': allowedOrigin,
                        'Access-Control-Allow-Credentials': 'true',
                    },
                    body: JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }),
                };
            }
        }
        const userId = decoded.sub || decoded.username;
        if (!userId) {
            return {
                statusCode: 401,
                headers: {
                    'WWW-Authenticate': 'Bearer realm="Hedgehog Learn"',
                    'Access-Control-Allow-Origin': allowedOrigin,
                    'Access-Control-Allow-Credentials': 'true',
                },
                body: JSON.stringify({ error: 'Unauthorized: Invalid token payload' }),
            };
        }
        // Fetch user from DynamoDB
        const user = await getUserById(userId);
        if (!user) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': allowedOrigin,
                    'Access-Control-Allow-Credentials': 'true',
                },
                body: JSON.stringify({ error: 'User not found' }),
            };
        }
        console.log('[Me] Returned profile for user:', userId);
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                'Access-Control-Allow-Credentials': 'true',
                'Cache-Control': 'no-store, private',
            },
            cookies: refreshedCookies.length ? refreshedCookies : undefined,
            body: JSON.stringify({
                userId: user.userId,
                email: user.email,
                displayName: user.displayName,
                givenName: user.givenName,
                familyName: user.familyName,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                hubspotContactId: user.hubspotContactId,
            }),
        };
    }
    catch (err) {
        console.error('[Me] Error:', err);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                'Access-Control-Allow-Credentials': 'true',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
}
async function checkCognitoUserExists(email) {
    try {
        await cognitoClient.send(new client_cognito_identity_provider_1.AdminGetUserCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: email,
        }));
        return true;
    }
    catch (err) {
        if (err?.name === 'UserNotFoundException')
            return false;
        throw err;
    }
}
async function checkHubSpotContactExists(email) {
    const hubspot = (0, hubspot_js_1.getHubSpotClient)();
    const searchResponse = await hubspot.crm.contacts.searchApi.doSearch({
        filterGroups: [{
                filters: [{
                        propertyName: 'email',
                        operator: 'EQ',
                        value: email,
                    }],
            }],
        properties: ['email'],
        limit: 1,
    });
    return !!(searchResponse.results && searchResponse.results.length > 0);
}
/**
 * GET /auth/check-email?email=<email>
 * Pre-auth helper to determine whether user exists in Cognito and HubSpot.
 */
async function handleCheckEmail(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    const email = (event.queryStringParameters?.email || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
        return jsonResponse(400, { error: 'invalid_email' }, origin);
    }
    try {
        const [existsInCognito, existsInHubSpot] = await Promise.all([
            checkCognitoUserExists(email),
            checkHubSpotContactExists(email),
        ]);
        return jsonResponse(200, {
            exists_in_cognito: existsInCognito,
            exists_in_hubspot: existsInHubSpot,
        }, origin);
    }
    catch (err) {
        console.error('[CheckEmail] Error:', err?.message || err);
        return jsonResponse(500, { error: 'lookup_failed' }, origin);
    }
}
function generateTemporaryPassword() {
    // Meets common Cognito policy defaults: upper/lower/number/symbol.
    return `Hh!${crypto.randomBytes(12).toString('base64url')}9a`;
}
/**
 * POST /auth/claim
 * Creates a Cognito invited user for HubSpot CRM contacts without Cognito credentials.
 */
async function handleClaim(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    let email = '';
    try {
        const body = JSON.parse(event.body || '{}');
        email = String(body.email || '').trim().toLowerCase();
    }
    catch {
        return jsonResponse(400, { error: 'invalid_body' }, origin);
    }
    if (!email || !isValidEmail(email)) {
        return jsonResponse(400, { error: 'invalid_email' }, origin);
    }
    try {
        const hasHubSpotContact = await checkHubSpotContactExists(email);
        if (!hasHubSpotContact) {
            return jsonResponse(404, { error: 'no_crm_contact' }, origin);
        }
        const existsInCognito = await checkCognitoUserExists(email);
        if (existsInCognito) {
            return jsonResponse(200, { status: 'already_exists' }, origin);
        }
        await cognitoClient.send(new client_cognito_identity_provider_1.AdminCreateUserCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: email,
            TemporaryPassword: generateTemporaryPassword(),
            DesiredDeliveryMediums: ['EMAIL'],
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'email_verified', Value: 'true' },
            ],
        }));
        return jsonResponse(200, { status: 'invite_sent' }, origin);
    }
    catch (err) {
        if (err?.name === 'UsernameExistsException') {
            return jsonResponse(200, { status: 'already_exists' }, origin);
        }
        console.error('[Claim] Error:', err?.message || err);
        return jsonResponse(500, { error: 'claim_failed' }, origin);
    }
}
/**
 * Create or update user in DynamoDB users table
 */
async function createOrUpdateUser(userId, email, idTokenPayload) {
    const now = new Date().toISOString();
    const item = {
        PK: `USER#${userId}`,
        SK: `PROFILE`,
        GSI1PK: `EMAIL#${email}`,
        GSI1SK: `USER#${userId}`,
        userId,
        email,
        displayName: idTokenPayload.name || email.split('@')[0],
        givenName: idTokenPayload.given_name || '',
        familyName: idTokenPayload.family_name || '',
        createdAt: now,
        updatedAt: now,
        cognitoUsername: idTokenPayload['cognito:username'] || userId,
    };
    // Try to create new user (will fail if already exists)
    await dynamoClient.send(new lib_dynamodb_1.PutCommand({
        TableName: DYNAMODB_USERS_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
    })).catch(async (err) => {
        if (err.name === 'ConditionalCheckFailedException') {
            // User exists, update without overwriting createdAt
            await dynamoClient.send(new lib_dynamodb_1.UpdateCommand({
                TableName: DYNAMODB_USERS_TABLE,
                Key: {
                    PK: `USER#${userId}`,
                    SK: 'PROFILE',
                },
                UpdateExpression: 'SET email = :email, displayName = :displayName, givenName = :givenName, familyName = :familyName, updatedAt = :updatedAt, cognitoUsername = :cognitoUsername, GSI1PK = :gsi1pk, GSI1SK = :gsi1sk',
                ExpressionAttributeValues: {
                    ':email': email,
                    ':displayName': idTokenPayload.name || email.split('@')[0],
                    ':givenName': idTokenPayload.given_name || '',
                    ':familyName': idTokenPayload.family_name || '',
                    ':updatedAt': now,
                    ':cognitoUsername': idTokenPayload['cognito:username'] || userId,
                    ':gsi1pk': `EMAIL#${email}`,
                    ':gsi1sk': `USER#${userId}`,
                },
            }));
            console.log('[DynamoDB] User updated:', userId);
        }
        else {
            throw err;
        }
    });
    console.log('[DynamoDB] User created/updated:', userId);
}
/**
 * Find or create HubSpot contact by email.
 * Returns HubSpot contact ID on success, or null on any HubSpot error.
 */
async function syncHubSpotContact(email) {
    if (!email) {
        console.warn('[HubSpot] Missing email, skipping contact sync');
        return null;
    }
    try {
        const hubspot = (0, hubspot_js_1.getHubSpotClient)();
        const searchResponse = await hubspot.crm.contacts.searchApi.doSearch({
            filterGroups: [{
                    filters: [{
                            propertyName: 'email',
                            operator: 'EQ',
                            value: email,
                        }],
                }],
            properties: ['email'],
            limit: 1,
        });
        if (searchResponse.results && searchResponse.results.length > 0) {
            const existingId = searchResponse.results[0].id;
            console.log('[HubSpot] Found existing contact for', email, 'contactId:', existingId);
            return existingId;
        }
        const created = await hubspot.crm.contacts.basicApi.create({
            properties: {
                email,
                lifecyclestage: 'lead',
            },
        });
        console.log('[HubSpot] Created contact for', email, 'contactId:', created.id);
        return created.id;
    }
    catch (err) {
        console.error('[HubSpot] Contact sync failed for', email, err?.message || err);
        return null;
    }
}
/**
 * Persist resolved HubSpot contact ID to the user's profile record.
 */
async function updateUserHubspotContactId(userId, hubspotContactId) {
    const now = new Date().toISOString();
    await dynamoClient.send(new lib_dynamodb_1.UpdateCommand({
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
        },
        UpdateExpression: 'SET hubspotContactId = :hubspotContactId, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
            ':hubspotContactId': hubspotContactId,
            ':updatedAt': now,
        },
        ConditionExpression: 'attribute_exists(PK)',
    }));
    console.log('[DynamoDB] Updated hubspotContactId for user:', userId);
}
/**
 * Get user by ID from DynamoDB
 */
async function getUserById(userId) {
    const result = await dynamoClient.send(new lib_dynamodb_1.GetCommand({
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
        },
    }));
    return result.Item || null;
}
