/**
 * GET /shadow/certificate/:certId
 *
 * Shadow-only public verification endpoint: looks up a certificate by its UUID
 * via the certId-index GSI on the certificates-shadow DynamoDB table.
 *
 * No auth required — certificates are public proofs of completion.
 * Only non-PII fields are returned: certId, entityType, entitySlug, issuedAt.
 *
 * Shadow guard: returns 403 when APP_STAGE !== 'shadow'.
 * Returns 404 when certId is not found.
 *
 * @see Issue #427
 * @see infrastructure/dynamodb/certificates-shadow-table.json
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

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
// Response type (exported for unit tests)
// ---------------------------------------------------------------------------

export type CertificateVerifyResponse = {
  certId: string;
  entityType: 'module' | 'course';
  entitySlug: string;
  issuedAt: string;
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleCertificateVerify(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin;

  // --- Shadow guard ---
  if (process.env.APP_STAGE !== 'shadow') {
    return jsonResp(403, { error: 'Not available in this environment' }, origin);
  }

  // --- Extract certId from path parameters ---
  // API Gateway v2 path param: /shadow/certificate/{certId}
  // After the /shadow base-path mapping strips /shadow, the Lambda sees
  // /certificate/{certId}.  API GW puts the raw param in event.pathParameters.
  const certId = (
    event.pathParameters?.certId ||
    // Fallback: parse from rawPath for local testing
    (event.rawPath || '').split('/').pop()
  )?.trim();

  if (!certId) {
    return jsonResp(400, { error: 'certId is required' }, origin);
  }

  // Basic UUID v4 format validation (prevents injection / oversized input)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(certId)) {
    return jsonResp(400, { error: 'Invalid certId format' }, origin);
  }

  const CERTS_TABLE = process.env.CERTIFICATES_TABLE;
  if (!CERTS_TABLE) {
    console.error('[CertVerify] CERTIFICATES_TABLE not set');
    return jsonResp(500, { error: 'Server configuration error' }, origin);
  }

  try {
    const result = await getDynamo().send(
      new QueryCommand({
        TableName: CERTS_TABLE,
        IndexName: 'certId-index',
        KeyConditionExpression: 'certId = :certId',
        ExpressionAttributeValues: { ':certId': certId },
        Limit: 1,
      })
    );

    const item = result.Items?.[0];
    if (!item) {
      return jsonResp(404, { error: 'Certificate not found' }, origin);
    }

    const response: CertificateVerifyResponse = {
      certId: item.certId as string,
      entityType: item.entityType as 'module' | 'course',
      entitySlug: item.entitySlug as string,
      issuedAt: item.issuedAt as string,
    };

    return jsonResp(200, response, origin);
  } catch (err: any) {
    console.error('[CertVerify] DynamoDB query failed:', err?.message || err);
    return jsonResp(500, { error: 'Failed to verify certificate' }, origin);
  }
}
