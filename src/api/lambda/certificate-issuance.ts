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
import { computeShadowPathwayStatus } from './shadow-aggregation.js';

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
  /** Whether a new pathway certificate was issued (Issue #451, Phase 5A) */
  pathwayCertIssued: boolean;
  /** The certId of the pathway certificate if issued */
  pathwayCertId?: string;
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
 *
 * entityTitle is stored at issuance time so the certificates list endpoint
 * can return a human-readable title without re-fetching HubDB.
 */
async function issueOneCert(
  dynamo: DynamoDBDocumentClient,
  certsTable: string,
  userId: string,
  entityType: 'module' | 'course' | 'pathway',
  entitySlug: string,
  entityTitle: string,
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
          entityTitle,
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
 * Respects the awards_certificate field: if the course row has awards_certificate = 0
 * or is absent, the course cert is skipped.
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

  let coursesWithModule: Array<{ slug: string; title: string; moduleSlugs: string[]; awardsCertificate: boolean }> = [];

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
        // awards_certificate: treat any truthy value as true; default false (safer)
        const awardsCertificate = row.values?.awards_certificate === true ||
          row.values?.awards_certificate === 1 ||
          row.values?.awards_certificate === '1' ||
          row.values?.awards_certificate === 'true';
        const courseTitle: string = (row.name || row.values?.hs_name || row.values?.name || courseSlug) as string;
        coursesWithModule.push({
          slug: courseSlug,
          title: courseTitle,
          moduleSlugs: slugs,
          awardsCertificate,
        });
      }
    }
  } catch (err: any) {
    console.warn('[CertIssuance] HubDB courses fetch failed — skipping course cert:', err?.message || err);
    return { issued: false };
  }

  if (coursesWithModule.length === 0) return { issued: false };

  // For each candidate course, check awards_certificate gate then check completion
  for (const course of coursesWithModule) {
    if (course.moduleSlugs.length === 0) continue;

    // awards_certificate gate: skip if course does not award a certificate
    if (!course.awardsCertificate) {
      console.info(`[CertIssuance] Course ${course.slug} has awards_certificate=false — skipping course cert`);
      continue;
    }

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
          course.title,
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
    return { moduleCertIssued: false, courseCertIssued: false, pathwayCertIssued: false };
  }

  if (!CERTS_TABLE) {
    console.warn('[CertIssuance] CERTIFICATES_TABLE not set — skipping cert issuance');
    return { moduleCertIssued: false, courseCertIssued: false, pathwayCertIssued: false };
  }

  // --- awards_certificate gate for module ---
  // Read the module row from HubDB to check the awards_certificate flag (column id=97).
  // Default to NOT issuing (safer: fail closed rather than open).
  let moduleTitleForCert = moduleSlug; // fallback title
  try {
    const modulesTableId = process.env.HUBDB_MODULES_TABLE_ID;
    if (!modulesTableId) {
      console.warn('[CertIssuance] HUBDB_MODULES_TABLE_ID not set — skipping module cert issuance');
      return { moduleCertIssued: false, courseCertIssued: false, pathwayCertIssued: false };
    }

    const hubspot = getHubSpotClient();
    const rowsResponse = await (hubspot as any).cms.hubdb.rowsApi.getTableRows(
      modulesTableId,
      undefined,
      undefined,
      undefined
    );
    const rows: any[] = rowsResponse.results || [];
    const moduleRow = rows.find(
      (r: any) => (r.path || '').toLowerCase() === moduleSlug.toLowerCase()
    );

    if (!moduleRow) {
      console.warn(`[CertIssuance] Module row not found in HubDB for slug=${moduleSlug} — skipping cert`);
      return { moduleCertIssued: false, courseCertIssued: false, pathwayCertIssued: false };
    }

    // awards_certificate is a BOOLEAN column (id=97); HubDB returns 1/0/true/false
    const awardsCertificate = moduleRow.values?.awards_certificate === true ||
      moduleRow.values?.awards_certificate === 1 ||
      moduleRow.values?.awards_certificate === '1' ||
      moduleRow.values?.awards_certificate === 'true';

    if (!awardsCertificate) {
      console.info(`[CertIssuance] Module ${moduleSlug} has awards_certificate=false — skipping cert issuance`);
      return { moduleCertIssued: false, courseCertIssued: false, pathwayCertIssued: false };
    }

    // Capture the module title for storage in the cert record
    // HubDB rows API returns the built-in Name column as row.name (not in values)
    moduleTitleForCert = (moduleRow.name || moduleRow.values?.hs_name || moduleRow.values?.name || moduleSlug) as string;
  } catch (err: any) {
    console.warn('[CertIssuance] HubDB module lookup failed — skipping cert:', err?.message || err);
    return { moduleCertIssued: false, courseCertIssued: false, pathwayCertIssued: false };
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
      moduleTitleForCert,
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
    return { moduleCertIssued: false, courseCertIssued: false, pathwayCertIssued: false };
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

  // Check for pathway completion (Issue #451, Phase 5A).
  // Uses the shadow aggregator (computeShadowPathwayStatus); MUST NOT use
  // the CRM-progress aggregator from completion.ts — that function reads
  // hhl_progress_state which is never populated on the shadow write path.
  let pathwayCertIssued = false;
  let pathwayCertId: string | undefined;

  if (ENTITY_COMPLETIONS_TABLE) {
    try {
      const pathwayResult = await checkAndIssuePathwayCompletion(
        dynamo,
        CERTS_TABLE,
        userId,
        moduleSlug,
        now
      );
      pathwayCertIssued = pathwayResult.issued;
      pathwayCertId = pathwayResult.certId;
    } catch (err: any) {
      console.error('[CertIssuance] Pathway cert check failed:', err?.message || err);
      // Non-fatal — upstream certs were already issued
    }
  }

  return {
    moduleCertIssued,
    moduleCertId,
    courseCertIssued,
    courseCertId,
    pathwayCertIssued,
    pathwayCertId,
  };
}

// ---------------------------------------------------------------------------
// checkAndIssuePathwayCompletion — Issue #451, Phase 5A
//
// For every pathway whose content/pathways/<slug>.json courses[] contains a
// course that contains the just-completed module, evaluate the pathway under
// shadow aggregation semantics. If complete and awards_certificate=true on
// the pathway HubDB row, issue a pathway-level certificate.
//
// Architectural guarantee: this helper calls computeShadowPathwayStatus from
// ./shadow-aggregation. It does NOT call calculatePathwayCompletion from
// ./completion.ts. The negative-control test in
// tests/unit/shadow-aggregation-negative-control.test.ts verifies this.
// ---------------------------------------------------------------------------

async function checkAndIssuePathwayCompletion(
  dynamo: DynamoDBDocumentClient,
  certsTable: string,
  userId: string,
  moduleSlug: string,
  now: string
): Promise<{ issued: boolean; certId?: string }> {
  const pathwaysTableId = process.env.HUBDB_PATHWAYS_TABLE_ID;
  const coursesTableId = process.env.HUBDB_COURSES_TABLE_ID;
  if (!pathwaysTableId || !coursesTableId) {
    console.warn('[CertIssuance] Pathway or courses table id not set — skipping pathway cert check');
    return { issued: false };
  }

  let candidatePathwaySlugs: string[] = [];
  const pathwayTitles: Map<string, string> = new Map();
  const pathwayAwardsCert: Map<string, boolean> = new Map();
  try {
    const hubspot = getHubSpotClient();

    const coursesResp = await (hubspot as any).cms.hubdb.rowsApi.getTableRows(
      coursesTableId,
      undefined,
      undefined,
      undefined
    );
    const courseRows: any[] = coursesResp?.results || [];
    const coursesContainingModule: string[] = [];
    for (const row of courseRows) {
      const courseSlug: string = (row.path || row.values?.hs_path || '').toLowerCase();
      if (!courseSlug) continue;
      try {
        const slugs: string[] = JSON.parse(row.values?.module_slugs_json || '[]');
        if (slugs.some((s: string) => s.toLowerCase() === moduleSlug.toLowerCase())) {
          coursesContainingModule.push(courseSlug);
        }
      } catch {
        /* ignore */
      }
    }
    if (coursesContainingModule.length === 0) return { issued: false };

    const pathwaysResp = await (hubspot as any).cms.hubdb.rowsApi.getTableRows(
      pathwaysTableId,
      undefined,
      undefined,
      undefined
    );
    const pathwayRows: any[] = pathwaysResp?.results || [];
    for (const row of pathwayRows) {
      const pathwaySlug: string = (row.path || row.values?.hs_path || '').toLowerCase();
      if (!pathwaySlug) continue;
      let childCourseSlugs: string[] = [];
      try {
        childCourseSlugs = JSON.parse(row.values?.course_slugs_json || '[]');
      } catch {
        childCourseSlugs = [];
      }
      const matches = childCourseSlugs.some((cs: string) =>
        coursesContainingModule.includes(cs.toLowerCase())
      );
      if (!matches) continue;

      candidatePathwaySlugs.push(pathwaySlug);
      pathwayTitles.set(
        pathwaySlug,
        (row.name || row.values?.hs_name || row.values?.name || pathwaySlug) as string
      );
      const awards = row.values?.awards_certificate === true ||
        row.values?.awards_certificate === 1 ||
        row.values?.awards_certificate === '1' ||
        row.values?.awards_certificate === 'true';
      pathwayAwardsCert.set(pathwaySlug, awards);
    }
  } catch (err: any) {
    console.warn('[CertIssuance] HubDB pathway discovery failed:', err?.message || err);
    return { issued: false };
  }

  for (const pathwaySlug of candidatePathwaySlugs) {
    const awards = pathwayAwardsCert.get(pathwaySlug) === true;
    if (!awards) {
      console.info(`[CertIssuance] Pathway ${pathwaySlug} has awards_certificate=false — skipping pathway cert`);
      continue;
    }

    let status;
    try {
      status = await computeShadowPathwayStatus({
        dynamo,
        userId,
        pathwaySlug,
      });
    } catch (err: any) {
      console.warn(`[CertIssuance] Shadow aggregator failed for pathway ${pathwaySlug}:`, err?.message || err);
      continue;
    }
    if (!status || status.pathway_status !== 'complete') continue;

    const evidenceSummary: Record<string, string> = {};
    for (const c of status.courses) {
      evidenceSummary[`course_${c.course_slug}`] = c.course_status;
    }

    try {
      const certResult = await issueOneCert(
        dynamo,
        certsTable,
        userId,
        'pathway' as any,
        pathwaySlug,
        pathwayTitles.get(pathwaySlug) ?? pathwaySlug,
        evidenceSummary,
        now
      );
      if (certResult.issued) {
        console.info(`[CertIssuance] Pathway cert issued: user=${userId} pathway=${pathwaySlug} certId=${certResult.certId}`);
        return { issued: true, certId: certResult.certId };
      }
    } catch (err: any) {
      console.error(`[CertIssuance] Failed to issue pathway cert for ${pathwaySlug}:`, err?.message || err);
    }
  }

  return { issued: false };
}
