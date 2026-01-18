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

import * as crypto from 'crypto';
import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';

// Cognito configuration from environment
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const COGNITO_REDIRECT_URI = process.env.COGNITO_REDIRECT_URI!;
const COGNITO_ISSUER = process.env.COGNITO_ISSUER!;
const COGNITO_REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-west-2';

// DynamoDB configuration
const DYNAMODB_USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;

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
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: COGNITO_REGION }));

/**
 * JWKS cache (Lambda global scope for reuse across warm invocations)
 */
interface JWK {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

interface JWKS {
  keys: JWK[];
}

let jwksCache: JWKS | null = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Fetch Cognito JWKS for JWT signature verification
 */
async function fetchJWKS(): Promise<JWKS> {
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

  return jwksCache!;
}

/**
 * Convert JWK to PEM format for JWT verification
 */
function jwkToPem(jwk: JWK): string {
  // JWK n and e are base64url encoded (not standard base64)
  const modulus = Buffer.from(jwk.n, 'base64url');
  const exponent = Buffer.from(jwk.e, 'base64url');

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
 * @param token JWT token to verify
 * @param options Validation options
 * @param options.audience Expected audience (for ID tokens)
 * @param options.clientId Expected client_id (for access tokens)
 * @param options.tokenUse Expected token_use ('id' or 'access')
 */
async function verifyJWT(
  token: string,
  options?: {
    audience?: string;
    clientId?: string;
    tokenUse?: 'id' | 'access';
  }
): Promise<any> {
  // Decode header to get kid
  const decodedHeader = jwt.decode(token, { complete: true });

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
  const decoded = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: COGNITO_ISSUER,
    ...(options?.audience && { audience: options.audience }),
  }) as any;

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

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return 'https://hedgehog.cloud';

  // Check exact matches only
  if (ALLOWED_ORIGINS.includes(origin)) return origin;

  // Default fallback
  return 'https://hedgehog.cloud';
}

/**
 * PKCE helpers
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * State parameter helpers (encodes redirect_url and code_verifier)
 */
function encodeState(redirectUrl: string, codeVerifier: string): string {
  const payload = {
    redirect_url: redirectUrl,
    code_verifier: codeVerifier,
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };

  // Sign the state to prevent tampering
  return jwt.sign(payload, STATE_SECRET, { expiresIn: '10m' });
}

function decodeState(state: string): { redirect_url: string; code_verifier: string } | null {
  try {
    const decoded = jwt.verify(state, STATE_SECRET) as any;
    return {
      redirect_url: decoded.redirect_url,
      code_verifier: decoded.code_verifier,
    };
  } catch (err) {
    console.error('[State] Invalid state parameter:', err);
    return null;
  }
}

/**
 * Sanitize redirect_url to prevent open redirect attacks
 */
function sanitizeRedirectUrl(redirectUrl: string | undefined): string {
  const defaultRedirect = '/learn';

  if (!redirectUrl || redirectUrl.length > 500) {
    return defaultRedirect;
  }

  // Block absolute URLs and dangerous protocols
  if (
    redirectUrl.includes('://') ||
    redirectUrl.startsWith('//') ||
    redirectUrl.startsWith('javascript:') ||
    redirectUrl.startsWith('data:')
  ) {
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
function createCookieString(name: string, value: string, maxAge: number, path: string = '/'): string {
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

function clearCookieString(name: string, path: string = '/'): string {
  return `${name}=; Max-Age=0; Path=${path}; HttpOnly; Secure; SameSite=Strict`;
}

/**
 * Exchange authorization code for tokens with Cognito
 */
async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<{
  access_token: string;
  refresh_token: string;
  id_token: string;
}> {
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
async function verifyIdToken(idToken: string): Promise<any> {
  // Verify signature, issuer, audience, and token_use for ID tokens
  return await verifyJWT(idToken, {
    audience: COGNITO_CLIENT_ID,
    tokenUse: 'id',
  });
}

/**
 * GET /auth/login
 * Redirects to Cognito Hosted UI with PKCE parameters
 */
export async function handleLogin(event: any): Promise<APIGatewayProxyResultV2> {
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
  } catch (err: any) {
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
export async function handleCallback(event: any): Promise<APIGatewayProxyResultV2> {
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
  } catch (err: any) {
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
export async function handleLogout(event: any): Promise<APIGatewayProxyResultV2> {
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
  } catch (err: any) {
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
export async function handleMe(event: any): Promise<APIGatewayProxyResultV2> {
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

    // Verify JWT signature, issuer, expiration, client_id, and token_use
    let decoded: any;
    try {
      decoded = await verifyJWT(accessToken, {
        clientId: COGNITO_CLIENT_ID,
        tokenUse: 'access',
      });
    } catch (verifyErr: any) {
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
  } catch (err: any) {
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
async function createOrUpdateUser(userId: string, email: string, idTokenPayload: any): Promise<void> {
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
  await dynamoClient.send(
    new PutCommand({
      TableName: DYNAMODB_USERS_TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  ).catch(async (err) => {
    if (err.name === 'ConditionalCheckFailedException') {
      // User exists, update without overwriting createdAt
      await dynamoClient.send(
        new UpdateCommand({
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
        })
      );
      console.log('[DynamoDB] User updated:', userId);
    } else {
      throw err;
    }
  });

  console.log('[DynamoDB] User created/updated:', userId);
}

/**
 * Get user by ID from DynamoDB
 */
async function getUserById(userId: string): Promise<any | null> {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: DYNAMODB_USERS_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    })
  );

  return result.Item || null;
}
