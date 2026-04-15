/**
 * GET /shadow/certificates
 *
 * Shadow-only authenticated endpoint: returns all certificates earned by the
 * authenticated learner, ordered by issuedAt descending.
 *
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 * Shadow guard: returns 403 when APP_STAGE !== 'shadow'.
 *
 * DynamoDB read: Query certificates-shadow by PK = USER#<sub>, SK begins_with CERT#
 *
 * Response shape:
 *   { certificates: [ { certId, entityType, entitySlug, entityTitle, issuedAt } ] }
 *
 * @see Issue #429
 * @see infrastructure/dynamodb/certificates-shadow-table.json
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { verifyCookieAuth } from './cognito-auth.js';

// ---------------------------------------------------------------------------
// DynamoDB client (lazy init for testability)
// ---------------------------------------------------------------------------

let _dynamoClient: DynamoDBDocumentClient | undefined;
export function getDynamo(): DynamoDBDocumentClient {
  if (!_dynamoClient) {
    const region =
      process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-west-2';
    _dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return _dynamoClient;
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://hedgehog.cloud',
  'https://www.hedgehog.cloud',
];
const HUBSPOT_CDN_PATTERN =
  /^https:\/\/.*\.hubspotusercontent(?:-na1|00|20|30|40)\.net$/;

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return 'https://hedgehog.cloud';
  if (ALLOWED_ORIGINS.includes(origin) || HUBSPOT_CDN_PATTERN.test(origin)) {
    return origin;
  }
  return 'https://hedgehog.cloud';
}

function jsonResp(
  status: number,
  body: unknown,
  origin?: string
): { statusCode: number; headers: Record<string, string>; body: string } {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getAllowedOrigin(origin),
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(body),
  };
}

// ---------------------------------------------------------------------------
// Response types (exported for unit tests)
// ---------------------------------------------------------------------------

export type CertificateListEntry = {
  certId: string;
  entityType: 'module' | 'course';
  entitySlug: string;
  /** Stored at issuance time; falls back to entitySlug if absent */
  entityTitle: string;
  issuedAt: string;
};

export type CertificateListResponse = {
  certificates: CertificateListEntry[];
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleCertificatesList(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin;

  // --- Shadow guard ---
  if (process.env.APP_STAGE !== 'shadow') {
    return jsonResp(403, { error: 'Not available in this environment' }, origin);
  }

  // --- Auth ---
  let userId: string;
  try {
    const auth = await verifyCookieAuth(event);
    userId = auth.userId;
  } catch {
    return jsonResp(401, { error: 'Unauthorized' }, origin);
  }

  const CERTS_TABLE = process.env.CERTIFICATES_TABLE;
  if (!CERTS_TABLE) {
    console.error('[CertsList] CERTIFICATES_TABLE not set');
    return jsonResp(500, { error: 'Server configuration error' }, origin);
  }

  try {
    const result = await getDynamo().send(
      new QueryCommand({
        TableName: CERTS_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':skPrefix': 'CERT#',
        },
      })
    );

    const items = result.Items || [];

    // Sort by issuedAt descending (most recent first)
    items.sort((a, b) => {
      const aTime = a.issuedAt ? new Date(a.issuedAt as string).getTime() : 0;
      const bTime = b.issuedAt ? new Date(b.issuedAt as string).getTime() : 0;
      return bTime - aTime;
    });

    const certificates: CertificateListEntry[] = items.map((item) => ({
      certId: item.certId as string,
      entityType: item.entityType as 'module' | 'course',
      entitySlug: item.entitySlug as string,
      entityTitle: (item.entityTitle as string | undefined) || (item.entitySlug as string),
      issuedAt: item.issuedAt as string,
    }));

    const response: CertificateListResponse = { certificates };
    return jsonResp(200, response, origin);
  } catch (err: any) {
    console.error('[CertsList] DynamoDB query failed:', err?.message || err);
    return jsonResp(500, { error: 'Failed to retrieve certificates' }, origin);
  }
}
