/**
 * Shadow-specific aggregation helper for the learner progress center
 * (Issue #451, Phase 5A). Architecture-mandated single source of truth
 * for denominator semantics on the shadow read and shadow write-cert paths.
 *
 * This module operates natively on shadow DynamoDB entity-completion records
 * and encodes the task-bearing-denominator policy:
 *   - A module is "task-bearing" iff its completion_tasks_json contains at
 *     least one required quiz or lab_attestation task.
 *   - Modules with no required task-bearing tasks are displayed with
 *     module_status='no_tasks' and are excluded from course denominators.
 *
 * It MUST NOT call calculateCourseCompletion or calculatePathwayCompletion
 * from ./completion — those are CRM-progress aggregators reading the
 * hhl_progress_state contact property with different input shape and
 * different denominator policy. The only allowed reuse from ./completion
 * is the pure metadata cache loaders (loadMetadataCache, getCourseMetadata,
 * getPathwayMetadata) which read content/*.json definitions.
 *
 * @see Issue #446, #448 (architecture), #449 (spec), #450 (test plan)
 */

import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

import { getHubSpotClient } from '../../shared/hubspot.js';
import {
  getCourseMetadata,
  getPathwayMetadata,
  loadMetadataCache,
} from './completion.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShadowModuleStatus = 'not_started' | 'in_progress' | 'complete' | 'no_tasks';
export type ShadowCourseStatus = 'not_started' | 'in_progress' | 'complete';
export type ShadowPathwayStatus = 'not_started' | 'in_progress' | 'complete';

export interface ShadowModuleEntry {
  module_slug: string;
  module_title: string;
  module_status: ShadowModuleStatus;
  has_required_tasks: boolean;
  tasks: Record<string, { status: string; score?: number; attempts?: number }>;
}

export interface ShadowCourseStatusResult {
  course_slug: string;
  course_title: string;
  course_status: ShadowCourseStatus;
  modules_completed: number;
  modules_total: number;
  modules: ShadowModuleEntry[];
  course_cert_id: string | null;
}

export interface ShadowPathwayCourseEntry {
  course_slug: string;
  course_title: string;
  course_status: ShadowCourseStatus;
  modules_completed: number;
  modules_total: number;
  course_cert_id: string | null;
}

export interface ShadowPathwayStatusResult {
  pathway_slug: string;
  pathway_title: string;
  pathway_status: ShadowPathwayStatus;
  courses_completed: number;
  courses_total: number;
  courses: ShadowPathwayCourseEntry[];
  pathway_cert_id: string | null;
}

export interface CompletionTaskDeclaration {
  task_slug: string;
  task_type: string;
  required?: boolean;
}

interface ModuleRecord {
  status?: string;
  task_statuses?: Record<string, { status: string; score?: number; attempts?: number }>;
}

// ---------------------------------------------------------------------------
// Title resolution — reuses the metadata cache extension in completion.ts
// (additive title field on CourseMetadata / PathwayMetadata for Issue #451).
// No duplicate filesystem loader.
// ---------------------------------------------------------------------------

export function getCourseTitle(courseSlug: string): string {
  return getCourseMetadata(courseSlug)?.title ?? courseSlug;
}

export function getPathwayTitle(pathwaySlug: string): string {
  return getPathwayMetadata(pathwaySlug)?.title ?? pathwaySlug;
}

// Ensure metadata cache is primed at module load (mirrors completion.ts pattern).
loadMetadataCache();

// ---------------------------------------------------------------------------
// classifyModule — pure. Single source of truth for denominator semantics.
// ---------------------------------------------------------------------------

export function classifyModule(
  moduleRecord: ModuleRecord | undefined,
  completionTasks: CompletionTaskDeclaration[]
): { module_status: ShadowModuleStatus; has_required_tasks: boolean } {
  const hasRequiredTaskBearing = completionTasks.some(
    (t) =>
      (t.task_type === 'quiz' || t.task_type === 'lab_attestation') && t.required !== false
  );

  if (!hasRequiredTaskBearing) {
    return { module_status: 'no_tasks', has_required_tasks: false };
  }

  if (!moduleRecord) {
    return { module_status: 'not_started', has_required_tasks: true };
  }

  const raw = moduleRecord.status;
  if (raw === 'in_progress' || raw === 'complete' || raw === 'not_started') {
    return { module_status: raw, has_required_tasks: true };
  }
  return { module_status: 'not_started', has_required_tasks: true };
}

// ---------------------------------------------------------------------------
// HubDB helper — fetch all module rows once; caller cross-references by path.
// ---------------------------------------------------------------------------

async function loadAllModuleRows(): Promise<any[]> {
  const tableId = process.env.HUBDB_MODULES_TABLE_ID;
  if (!tableId) {
    throw new Error('Server configuration error');
  }
  const hubspot = getHubSpotClient();
  const response = await (hubspot as any).cms.hubdb.rowsApi.getTableRows(
    tableId,
    undefined,
    undefined,
    undefined
  );
  return response?.results || [];
}

function parseCompletionTasks(row: any): CompletionTaskDeclaration[] {
  const json = row?.values?.completion_tasks_json;
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function moduleTitleFromRow(row: any, slug: string): string {
  return (row?.name || row?.values?.hs_name || row?.values?.name || slug) as string;
}

function findModuleRow(rows: any[], slug: string): any | undefined {
  const target = slug.toLowerCase();
  return rows.find((r) => (r?.path || '').toLowerCase() === target);
}

// ---------------------------------------------------------------------------
// BatchGet helpers — chunk at 100 items per AWS API limit.
// ---------------------------------------------------------------------------

const BATCH_GET_CHUNK = 100;

async function batchGetModuleCompletions(
  dynamo: DynamoDBDocumentClient,
  tableName: string,
  userId: string,
  moduleSlugs: string[]
): Promise<Map<string, ModuleRecord>> {
  const out = new Map<string, ModuleRecord>();
  if (moduleSlugs.length === 0) return out;

  for (let i = 0; i < moduleSlugs.length; i += BATCH_GET_CHUNK) {
    const chunk = moduleSlugs.slice(i, i + BATCH_GET_CHUNK);
    const keys = chunk.map((s) => ({
      PK: `USER#${userId}`,
      SK: `COMPLETION#MODULE#${s}`,
    }));
    const res = await dynamo.send(
      new BatchGetCommand({
        RequestItems: { [tableName]: { Keys: keys } },
      })
    );
    const items = res.Responses?.[tableName] || [];
    for (const item of items) {
      const sk = (item.SK as string) || '';
      const slug = sk.replace('COMPLETION#MODULE#', '');
      if (slug) out.set(slug, item as ModuleRecord);
    }
  }
  return out;
}

async function batchGetCerts(
  dynamo: DynamoDBDocumentClient,
  tableName: string,
  userId: string,
  keys: Array<{ entityType: 'module' | 'course' | 'pathway'; entitySlug: string }>
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (keys.length === 0) return out;

  for (let i = 0; i < keys.length; i += BATCH_GET_CHUNK) {
    const chunk = keys.slice(i, i + BATCH_GET_CHUNK);
    const ddbKeys = chunk.map((k) => ({
      PK: `USER#${userId}`,
      SK: `CERT#${k.entityType}#${k.entitySlug}`,
    }));
    try {
      const res = await dynamo.send(
        new BatchGetCommand({
          RequestItems: { [tableName]: { Keys: ddbKeys } },
        })
      );
      const items = res.Responses?.[tableName] || [];
      for (const item of items) {
        const sk = (item.SK as string) || '';
        const parts = sk.split('#'); // CERT#<type>#<slug>
        if (parts.length >= 3 && item.certId) {
          out.set(`${parts[1]}#${parts.slice(2).join('#')}`, item.certId as string);
        }
      }
    } catch (err: any) {
      // Best-effort cert lookup: never fail the caller.
      console.warn('[ShadowAggregation] cert BatchGet failed:', err?.message || err);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// computeShadowCourseStatus
// ---------------------------------------------------------------------------

export async function computeShadowCourseStatus(params: {
  dynamo: DynamoDBDocumentClient;
  userId: string;
  courseSlug: string;
}): Promise<ShadowCourseStatusResult | null> {
  const { dynamo, userId, courseSlug } = params;

  const courseMeta = getCourseMetadata(courseSlug);
  if (!courseMeta) return null;

  const ENTITY_COMPLETIONS_TABLE = process.env.ENTITY_COMPLETIONS_TABLE;
  if (!ENTITY_COMPLETIONS_TABLE) {
    throw new Error('Server configuration error');
  }

  const moduleSlugs = courseMeta.modules;
  const moduleRows = await loadAllModuleRows();
  const completions = await batchGetModuleCompletions(
    dynamo,
    ENTITY_COMPLETIONS_TABLE,
    userId,
    moduleSlugs
  );

  // Certificate lookups: course-level + per-module
  const CERTS_TABLE = process.env.CERTIFICATES_TABLE;
  let certs = new Map<string, string>();
  if (CERTS_TABLE) {
    const certKeys: Array<{ entityType: 'module' | 'course'; entitySlug: string }> = [
      { entityType: 'course', entitySlug: courseSlug },
    ];
    certs = await batchGetCerts(dynamo, CERTS_TABLE, userId, certKeys);
  }

  const entries: ShadowModuleEntry[] = moduleSlugs.map((slug) => {
    const row = findModuleRow(moduleRows, slug);
    const completionTasks = row ? parseCompletionTasks(row) : [];
    const record = completions.get(slug);
    const { module_status, has_required_tasks } = classifyModule(record, completionTasks);

    const tasks: Record<string, { status: string; score?: number; attempts?: number }> = {};
    if (record?.task_statuses) {
      for (const [k, v] of Object.entries(record.task_statuses)) {
        tasks[k] = { status: v.status };
        if (v.score !== undefined) tasks[k].score = Number(v.score);
        if (v.attempts !== undefined) tasks[k].attempts = Number(v.attempts);
      }
    }

    return {
      module_slug: slug,
      module_title: row ? moduleTitleFromRow(row, slug) : slug,
      module_status,
      has_required_tasks,
      tasks,
    };
  });

  const taskBearing = entries.filter((e) => e.has_required_tasks);
  const modules_total = taskBearing.length;
  const modules_completed = taskBearing.filter((e) => e.module_status === 'complete').length;

  let course_status: ShadowCourseStatus;
  if (modules_total > 0 && modules_completed === modules_total) {
    course_status = 'complete';
  } else {
    const anyRecord = taskBearing.some((e) => e.module_status !== 'not_started');
    course_status = anyRecord ? 'in_progress' : 'not_started';
  }

  return {
    course_slug: courseSlug,
    course_title: getCourseTitle(courseSlug),
    course_status,
    modules_completed,
    modules_total,
    modules: entries,
    course_cert_id: certs.get(`course#${courseSlug}`) ?? null,
  };
}

// ---------------------------------------------------------------------------
// computeShadowPathwayStatus
// ---------------------------------------------------------------------------

export async function computeShadowPathwayStatus(params: {
  dynamo: DynamoDBDocumentClient;
  userId: string;
  pathwaySlug: string;
}): Promise<ShadowPathwayStatusResult | null> {
  const { dynamo, userId, pathwaySlug } = params;

  const pathwayMeta = getPathwayMetadata(pathwaySlug);
  if (!pathwayMeta) return null;

  const ENTITY_COMPLETIONS_TABLE = process.env.ENTITY_COMPLETIONS_TABLE;
  if (!ENTITY_COMPLETIONS_TABLE) {
    throw new Error('Server configuration error');
  }

  const courseSlugs = pathwayMeta.courses;

  // Collect all module slugs across all courses — one BatchGet covers them.
  const allModuleSlugs: string[] = [];
  const courseToModules = new Map<string, string[]>();
  for (const cs of courseSlugs) {
    const cm = getCourseMetadata(cs);
    const modules = cm ? cm.modules : [];
    courseToModules.set(cs, modules);
    for (const m of modules) if (!allModuleSlugs.includes(m)) allModuleSlugs.push(m);
  }

  const moduleRows = await loadAllModuleRows();
  const completions = await batchGetModuleCompletions(
    dynamo,
    ENTITY_COMPLETIONS_TABLE,
    userId,
    allModuleSlugs
  );

  const CERTS_TABLE = process.env.CERTIFICATES_TABLE;
  let certs = new Map<string, string>();
  if (CERTS_TABLE) {
    const certKeys: Array<{ entityType: 'course' | 'pathway'; entitySlug: string }> = [
      { entityType: 'pathway', entitySlug: pathwaySlug },
      ...courseSlugs.map((s) => ({ entityType: 'course' as const, entitySlug: s })),
    ];
    certs = await batchGetCerts(dynamo, CERTS_TABLE, userId, certKeys);
  }

  const courseEntries: ShadowPathwayCourseEntry[] = courseSlugs.map((cs) => {
    const modules = courseToModules.get(cs) || [];

    const taskBearingCount = modules.reduce((acc, slug) => {
      const row = findModuleRow(moduleRows, slug);
      const tasks = row ? parseCompletionTasks(row) : [];
      const c = classifyModule(completions.get(slug), tasks);
      return c.has_required_tasks ? acc + 1 : acc;
    }, 0);

    const completedCount = modules.reduce((acc, slug) => {
      const row = findModuleRow(moduleRows, slug);
      const tasks = row ? parseCompletionTasks(row) : [];
      const c = classifyModule(completions.get(slug), tasks);
      return c.has_required_tasks && c.module_status === 'complete' ? acc + 1 : acc;
    }, 0);

    let course_status: ShadowCourseStatus;
    if (taskBearingCount > 0 && completedCount === taskBearingCount) {
      course_status = 'complete';
    } else {
      const anyRecord = modules.some((slug) => {
        const row = findModuleRow(moduleRows, slug);
        const tasks = row ? parseCompletionTasks(row) : [];
        const c = classifyModule(completions.get(slug), tasks);
        return c.has_required_tasks && c.module_status !== 'not_started';
      });
      course_status = anyRecord ? 'in_progress' : 'not_started';
    }

    return {
      course_slug: cs,
      course_title: getCourseTitle(cs),
      course_status,
      modules_completed: completedCount,
      modules_total: taskBearingCount,
      course_cert_id: certs.get(`course#${cs}`) ?? null,
    };
  });

  const courses_total = courseEntries.length;
  const courses_completed = courseEntries.filter((c) => c.course_status === 'complete').length;

  let pathway_status: ShadowPathwayStatus;
  if (courses_total > 0 && courses_completed === courses_total) {
    pathway_status = 'complete';
  } else {
    const anyProgress = courseEntries.some((c) => c.course_status !== 'not_started');
    pathway_status = anyProgress ? 'in_progress' : 'not_started';
  }

  return {
    pathway_slug: pathwaySlug,
    pathway_title: getPathwayTitle(pathwaySlug),
    pathway_status,
    courses_completed,
    courses_total,
    courses: courseEntries,
    pathway_cert_id: certs.get(`pathway#${pathwaySlug}`) ?? null,
  };
}
