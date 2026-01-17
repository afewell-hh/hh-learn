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
exports.handleCallback = handleCallback;
exports.handleLogout = handleLogout;
exports.handleMe = handleMe;
const crypto = __importStar(require("crypto"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Cognito configuration from environment
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const COGNITO_REDIRECT_URI = process.env.COGNITO_REDIRECT_URI;
const COGNITO_ISSUER = process.env.COGNITO_ISSUER;
const COGNITO_REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-west-2';
// DynamoDB configuration
const DYNAMODB_USERS_TABLE = process.env.DYNAMODB_USERS_TABLE;
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
    const modulus = Buffer.from(jwk.n, 'base64');
    const exponent = Buffer.from(jwk.e, 'base64');
    // Construct DER-encoded RSA public key
    const modulusLength = modulus.length;
    const exponentLength = exponent.length;
    // ASN.1 DER encoding for RSA public key
    const derPrefix = Buffer.from([
        0x30, 0x82, // SEQUENCE
        ((modulusLength + exponentLength + 32) >> 8) & 0xff,
        (modulusLength + exponentLength + 32) & 0xff,
        0x30, 0x0d, // SEQUENCE
        0x06, 0x09, // OID
        0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // RSA encryption
        0x05, 0x00, // NULL
        0x03, 0x82, // BIT STRING
        ((modulusLength + exponentLength + 9) >> 8) & 0xff,
        (modulusLength + exponentLength + 9) & 0xff,
        0x00, // no padding bits
        0x30, 0x82, // SEQUENCE
        ((modulusLength + exponentLength + 4) >> 8) & 0xff,
        (modulusLength + exponentLength + 4) & 0xff,
        0x02, 0x82, // INTEGER (modulus)
        (modulusLength >> 8) & 0xff,
        modulusLength & 0xff,
    ]);
    const exponentPrefix = Buffer.from([
        0x02, // INTEGER (exponent)
        exponentLength,
    ]);
    const der = Buffer.concat([derPrefix, modulus, exponentPrefix, exponent]);
    const pem = `-----BEGIN PUBLIC KEY-----\n${der.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----\n`;
    return pem;
}
/**
 * Verify JWT token using Cognito JWKS
 */
async function verifyJWT(token, expectedAudience) {
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
        ...(expectedAudience && { audience: expectedAudience }),
    });
    return decoded;
}
/**
 * CORS helper - get allowed origin from request
 */
const ALLOWED_ORIGINS = [
    'https://hedgehog.cloud',
    'https://www.hedgehog.cloud',
];
function getAllowedOrigin(origin) {
    if (!origin)
        return 'https://hedgehog.cloud';
    // Check exact matches
    if (ALLOWED_ORIGINS.includes(origin))
        return origin;
    // Check HubSpot CDN patterns
    const hubspotPatterns = [
        /^https:\/\/.*\.hubspotusercontent-na1\.net$/,
        /^https:\/\/.*\.hubspotusercontent00\.net$/,
        /^https:\/\/.*\.hubspotusercontent20\.net$/,
        /^https:\/\/.*\.hubspotusercontent30\.net$/,
        /^https:\/\/.*\.hubspotusercontent40\.net$/,
    ];
    if (hubspotPatterns.some(pattern => pattern.test(origin))) {
        return origin;
    }
    // Default fallback
    return 'https://hedgehog.cloud';
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
    // Verify signature, issuer, and expiration using JWKS
    return await verifyJWT(idToken, COGNITO_CLIENT_ID);
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
        // Generate PKCE parameters
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        // Encode state (includes redirect_url and code_verifier)
        const state = encodeState(redirectUrl, codeVerifier);
        // Build Cognito authorization URL
        const authUrl = new URL(`https://${COGNITO_DOMAIN}/oauth2/authorize`);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', COGNITO_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', COGNITO_REDIRECT_URI);
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('state', state);
        console.log('[Login] Redirecting to Cognito:', authUrl.toString());
        return {
            statusCode: 302,
            headers: {
                Location: authUrl.toString(),
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
                    Location: `/learn?auth_error=${encodeURIComponent(error)}`,
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
                    Location: stateData.redirect_url || '/learn',
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
        // Set httpOnly cookies
        const cookies = [
            createCookieString('hhl_access_token', tokens.access_token, ACCESS_TOKEN_MAX_AGE),
            createCookieString('hhl_refresh_token', tokens.refresh_token, REFRESH_TOKEN_MAX_AGE, '/auth'),
        ];
        console.log('[Callback] Authentication successful for user:', userId);
        // Redirect to original page
        return {
            statusCode: 302,
            headers: {
                Location: stateData.redirect_url || '/learn',
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
                Location: '/learn',
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
        const cookies = event.headers?.cookie || event.headers?.Cookie || '';
        const accessTokenMatch = cookies.match(/hhl_access_token=([^;]+)/);
        if (!accessTokenMatch) {
            return {
                statusCode: 401,
                headers: {
                    'WWW-Authenticate': 'Bearer realm="Hedgehog Learn"',
                    'Access-Control-Allow-Origin': allowedOrigin,
                    'Access-Control-Allow-Credentials': 'true',
                },
                body: JSON.stringify({ error: 'Unauthorized: Missing access token' }),
            };
        }
        const accessToken = accessTokenMatch[1];
        // Verify JWT signature, issuer, and expiration using JWKS
        let decoded;
        try {
            decoded = await verifyJWT(accessToken);
        }
        catch (verifyErr) {
            console.error('[Me] JWT verification failed:', verifyErr.message);
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
