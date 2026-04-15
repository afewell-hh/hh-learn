/**
 * Certificate issuance helpers for shadow completion framework (Issue #427)
 *
 * Shared by tasks-quiz-submit.ts and tasks-lab-attest.ts.
 *
 * issueCertificateIfComplete:
 *   - Called after every entity-completion write
 *   - Checks if moduleStatus === 'complete'
 *   - Idempotent: skips issuance if a certificate already exists for user×entity
 *   - Writes to hedgehog-learn-certificates-shadow
 *   - Then checks if any course that contains this module is now fully complete
 *     and issues a course-level certificate if so
 *
 * All failures are caught and logged; they do NOT propagate to the caller
 * (certificate issuance is best-effort — the task write has already succeeded).
 *
 * @see Issue #427
 * @see infrastructure/dynamodb/certificates-shadow-table.json
 */

import { randomUUID } from 'crypto';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getHubSpotClient } from '../../shared/hubspot.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CertificateIssuanceResult {
  /** Whether a new module certificate was issued (false = already existed or not complete) */
  moduleCertIssued: boolean;
  /** The certId of the module certificate (new or existing) — undefined if module not complete */
  moduleCertId?: string;
  /** Whether a new course certificate was issued */
  courseCertIssued: boolean;
  /** The certId of the course certificate if issued */
  courseCertId?: string;
}

// ---------------------------------------------------------------------------
// Internal: issue a single certificate (idempotent)
// ---------------------------------------------------------------------------

/**
 * Write a certificate record if one does not already exist for this user+entity.
 * Returns { issued: boolean, certId: string }.
 *
 * Uses a conditional PutItem (attribute_not_exists(PK)) so that concurrent
 * completions cannot create duplicate certificates.
 */
async function issueOneCert(
  dynamo: DynamoDBDocumentClient,
  certsTable: string,
  userId: string,
  entityType: 'module' | 'course',
  entitySlug: string,
  evidenceSummary: Record<string, string>,
  now: string
): Promise<{ issued: boolean; certId: string }> {
  const pk = `USER#${userId}`;
  const sk = `CERT#${entityType}#${entitySlug}`;

  // Check if certificate already exists (idempotency check)
  const existing = await dynamo.send(
    new GetCommand({
      TableName: certsTable,
      Key: { PK: pk, SK: sk },
      ProjectionExpression: 'certId',
    })
  );

  if (existing.Item?.certId) {
    // Already issued — return existing certId without writing
    return { issued: false, certId: existing.Item.certId as string };
  }

  const certId = randomUUID();

  try {
    await dynamo.send(
      new PutCommand({
        TableName: certsTable,
        Item: {
          PK: pk,
          SK: sk,
          certId,
          learnerId: userId,
          entityType,
          entitySlug,
          issuedAt: now,
          evidenceSummary,
        },
        // Guard against races: only write if no cert exists yet
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      })
    );
    return { issued: true, certId };
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      // Lost the race — another concurrent write beat us; fetch the winner's certId
      const winner = await dynamo.send(
        new GetCommand({
          TableName: certsTable,
          Key: { PK: pk, SK: sk },
          ProjectionExpression: 'certId',
        })
      );
      return { issued: false, certId: (winner.Item?.certId as string) || certId };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal: check course completion and issue course cert
// ---------------------------------------------------------------------------

/**
 * For each course that contains moduleSlug, check if all modules in that course
 * have a 'complete' entity-completion record for this learner.
 * If yes, issue a course-level certificate (idempotent).
 *
 * Returns the first course certId issued (or undefined if none).
 */
async function checkAndIssueCourseCompletion(
  dynamo: DynamoDBDocumentClient,
  entityCompletionsTable: string,
  certsTable: string,
  userId: string,
  moduleSlug: string,
  taskStatusesMap: Record<string, string>,
  now: string
): Promise<{ issued: boolean; certId?: string }> {
  const coursesTableId = process.env.HUBDB_COURSES_TABLE_ID;
  if (!coursesTableId) {
    console.warn('[CertIssuance] HUBDB_COURSES_TABLE_ID not set — skipping course cert check');
    return { issued: false };
  }

  let coursesWithModule: Array<{ slug: string; moduleSlugs: string[] }> = [];

  try {
    const hubspot = getHubSpotClient();
    const rowsResponse = await (hubspot as any).cms.hubdb.rowsApi.getTableRows(
      coursesTableId,
      undefined,
      undefined,
      undefined
    );
    const rows: any[] = rowsResponse.results || [];

    for (const row of rows) {
      const courseSlug: string = (row.path || row.values?.hs_path || '').toLowerCase();
      if (!courseSlug) continue;

      const slugsJson: string = row.values?.module_slugs_json || '[]';
      let slugs: string[] = [];
      try { slugs = JSON.parse(slugsJson); } catch { continue; }

      if (slugs.some((s: string) => s.toLowerCase() === moduleSlug.toLowerCase())) {
        coursesWithModule.push({ slug: courseSlug, moduleSlugs: slugs });
      }
    }
  } catch (err: any) {
    console.warn('[CertIssuance] HubDB courses fetch failed — skipping course cert:', err?.message || err);
    return { issued: false };
  }

  if (coursesWithModule.length === 0) return { issued: false };

  // For each candidate course, check if every module has a complete entity-completion
  for (const course of coursesWithModule) {
    if (course.moduleSlugs.length === 0) continue;

    let allComplete = true;
    for (const slug of course.moduleSlugs) {
      try {
        const result = await dynamo.send(
          new GetCommand({
            TableName: entityCompletionsTable,
            Key: {
              PK: `USER#${userId}`,
              SK: `COMPLETION#MODULE#${slug}`,
            },
            ProjectionExpression: '#s',
            ExpressionAttributeNames: { '#s': 'status' },
          })
        );
        if (!result.Item || result.Item['status'] !== 'complete') {
          allComplete = false;
          break;
        }
      } catch (err: any) {
        console.warn(`[CertIssuance] EntityCompletion check failed for ${slug}:`, err?.message || err);
        allComplete = false;
        break;
      }
    }

    if (allComplete) {
      try {
        const courseCertResult = await issueOneCert(
          dynamo,
          certsTable,
          userId,
          'course',
          course.slug,
          taskStatusesMap, // snapshot of triggering module's task statuses
          now
        );
        if (courseCertResult.issued) {
          console.info(`[CertIssuance] Course cert issued: user=${userId} course=${course.slug} certId=${courseCertResult.certId}`);
          return { issued: true, certId: courseCertResult.certId };
        }
      } catch (err: any) {
        console.error(`[CertIssuance] Failed to issue course cert for ${course.slug}:`, err?.message || err);
      }
    }
  }

  return { issued: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Main entry point called by task write endpoints after every entity-completion upsert.
 *
 * - If moduleStatus !== 'complete', returns immediately with no-op result
 * - Issues module cert (idempotent)
 * - Checks and issues course cert if all modules in any course are now complete
 *
 * Never throws — all errors are caught and logged.
 */
export async function issueCertificateIfComplete(params: {
  dynamo: DynamoDBDocumentClient;
  userId: string;
  moduleSlug: string;
  moduleStatus: string;
  taskStatusesMap: Record<string, string>;
  now: string;
}): Promise<CertificateIssuanceResult> {
  const { dynamo, userId, moduleSlug, moduleStatus, taskStatusesMap, now } = params;

  const CERTS_TABLE = process.env.CERTIFICATES_TABLE;
  const ENTITY_COMPLETIONS_TABLE = process.env.ENTITY_COMPLETIONS_TABLE;

  if (moduleStatus !== 'complete') {
    return { moduleCertIssued: false, courseCertIssued: false };
  }

  if (!CERTS_TABLE) {
    console.warn('[CertIssuance] CERTIFICATES_TABLE not set — skipping cert issuance');
    return { moduleCertIssued: false, courseCertIssued: false };
  }

  let moduleCertId: string | undefined;
  let moduleCertIssued = false;

  // Issue module certificate
  try {
    const result = await issueOneCert(
      dynamo,
      CERTS_TABLE,
      userId,
      'module',
      moduleSlug,
      taskStatusesMap,
      now
    );
    moduleCertId = result.certId;
    moduleCertIssued = result.issued;

    if (moduleCertIssued) {
      console.info(`[CertIssuance] Module cert issued: user=${userId} module=${moduleSlug} certId=${moduleCertId}`);
    }
  } catch (err: any) {
    console.error('[CertIssuance] Failed to issue module cert:', err?.message || err);
    // Return partial result — do not fail the overall response
    return { moduleCertIssued: false, courseCertIssued: false };
  }

  // Check for course completion (best-effort)
  let courseCertIssued = false;
  let courseCertId: string | undefined;

  if (ENTITY_COMPLETIONS_TABLE) {
    try {
      const courseResult = await checkAndIssueCourseCompletion(
        dynamo,
        ENTITY_COMPLETIONS_TABLE,
        CERTS_TABLE,
        userId,
        moduleSlug,
        taskStatusesMap,
        now
      );
      courseCertIssued = courseResult.issued;
      courseCertId = courseResult.certId;
    } catch (err: any) {
      console.error('[CertIssuance] Course cert check failed:', err?.message || err);
      // Non-fatal — module cert was already issued
    }
  }

  return {
    moduleCertIssued,
    moduleCertId,
    courseCertIssued,
    courseCertId,
  };
}
