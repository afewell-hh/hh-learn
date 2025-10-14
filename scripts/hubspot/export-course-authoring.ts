import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getHubSpotClient } from '../../src/shared/hubspot.js';

type HubDbRow = any;

function mask(str: string | number | undefined) {
  if (!str) return '';
  const s = String(str);
  return s.length <= 6 ? '****' : `${s.slice(0, 3)}****${s.slice(-3)}`;
}

async function fetchAllRows(hubspot: any, tableId: string) {
  const rows: HubDbRow[] = [];
  let after: string | undefined = undefined;
  do {
    const resp: any = await hubspot.cms.hubdb.rowsApi.getTableRows(
      tableId,
      undefined,
      undefined,
      after
    );
    rows.push(...resp.results);
    after = resp.paging?.next?.after;
  } while (after);
  return rows;
}

function safeParseJson<T = any>(val: any): T | undefined {
  if (!val) return undefined;
  try {
    if (typeof val === 'string') return JSON.parse(val);
    return val;
  } catch {
    return undefined;
  }
}

function toCourseJson(row: HubDbRow) {
  const v = row.values || {};
  const slug = v.slug || row.path || v.hs_path || '';
  const title = row.name || v.hs_name || v.title || 'Untitled Course';
  const summary = v.summary_markdown || '';
  const modules = safeParseJson<string[]>(v.module_slugs_json) || [];
  const contentBlocks = safeParseJson<any[]>(v.content_blocks_json) || [];
  const displayOrder = v.display_order ?? undefined;
  const tags = v.tags || '';
  const estimated = v.estimated_minutes ?? undefined;
  const badge = v.badge_image_url || '';
  const out: any = {
    slug,
    title,
    summary_markdown: summary,
    ...(modules.length ? { modules } : {}),
    ...(contentBlocks.length ? { content_blocks: contentBlocks } : {}),
    ...(badge ? { badge_image_url: badge } : {}),
    ...(displayOrder !== undefined ? { display_order: displayOrder } : {}),
    ...(tags ? { tags } : {}),
    ...(estimated !== undefined ? { estimated_minutes: estimated } : {}),
  };
  return out;
}

function toPathwayJson(row: HubDbRow) {
  const v = row.values || {};
  const slug = v.slug || row.path || v.hs_path || '';
  const title = row.name || v.hs_name || v.title || 'Untitled Pathway';
  const summary = v.summary_markdown || '';
  const moduleSlugs = safeParseJson<string[]>(v.module_slugs_json) || [];
  const courseSlugs = safeParseJson<string[]>(v.course_slugs_json) || [];
  const displayOrder = v.display_order ?? undefined;
  const tags = v.tags || '';
  const estimated = v.estimated_minutes ?? v.total_estimated_minutes ?? undefined;
  const badge = v.badge_image_url || '';
  const out: any = {
    slug,
    title,
    summary_markdown: summary,
    ...(courseSlugs.length ? { courses: courseSlugs } : {}),
    ...(moduleSlugs.length && !courseSlugs.length ? { modules: moduleSlugs } : {}),
    ...(badge ? { badge_image_url: badge } : {}),
    ...(displayOrder !== undefined ? { display_order: displayOrder } : {}),
    ...(tags ? { tags } : {}),
    ...(estimated !== undefined ? { estimated_minutes: estimated } : {}),
  };
  return out;
}

async function main() {
  const hubspot = getHubSpotClient();
  const COURSES_TABLE_ID = process.env.HUBDB_COURSES_TABLE_ID as string;
  const PATHWAYS_TABLE_ID = process.env.HUBDB_PATHWAYS_TABLE_ID as string;

  if (!COURSES_TABLE_ID || !PATHWAYS_TABLE_ID) {
    throw new Error('HUBDB_COURSES_TABLE_ID and HUBDB_PATHWAYS_TABLE_ID must be set in .env');
  }

  console.log(`Exporting from HubDB (courses: ${mask(COURSES_TABLE_ID)}, pathways: ${mask(PATHWAYS_TABLE_ID)})`);

  // 1) Course: Course Authoring 101
  const courseRows = await fetchAllRows(hubspot, COURSES_TABLE_ID);
  const course = courseRows.find((r: any) => {
    const v = r.values || {};
    const slug = v.slug || r.path || '';
    const name = (r.name || '').toLowerCase();
    return slug === 'course-authoring-101' || name.includes('course authoring 101');
  });
  if (!course) {
    console.error('Could not find Course Authoring 101 in courses table.');
  } else {
    const courseJson = toCourseJson(course);
    mkdirSync(join('content', 'courses'), { recursive: true });
    const target = join('content', 'courses', 'course-authoring-101.json');
    writeFileSync(target, JSON.stringify(courseJson, null, 2));
    console.log(`Wrote ${target}`);
  }

  // 2) Pathway: any pathway containing authoring in name/path/tags
  const pathwayRows = await fetchAllRows(hubspot, PATHWAYS_TABLE_ID);
  const candidate = pathwayRows.find((r: any) => {
    const v = r.values || {};
    const slug = (v.slug || r.path || '').toLowerCase();
    const name = (r.name || '').toLowerCase();
    const tags = (v.tags || '').toLowerCase();
    return slug.includes('authoring') || name.includes('authoring') || tags.includes('authoring');
  });
  if (!candidate) {
    console.error('Could not find an Authoring pathway in pathways table.');
  } else {
    const pwJson = toPathwayJson(candidate);
    const pwSlug = pwJson.slug || 'course-authoring-pathway';
    mkdirSync(join('content', 'pathways'), { recursive: true });
    const target = join('content', 'pathways', `${pwSlug}.json`);
    writeFileSync(target, JSON.stringify(pwJson, null, 2));
    console.log(`Wrote ${target}`);

    // Export any missing courses referenced by the pathway
    const referencedCourses: string[] = (pwJson.courses || []) as string[];
    if (referencedCourses.length) {
      for (const slug of referencedCourses) {
        const path = join('content', 'courses', `${slug}.json`);
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('fs').accessSync(path);
          continue; // already exists
        } catch {}
        const row = courseRows.find((r: any) => {
          const v = r.values || {};
          return (v.slug || r.path) === slug;
        });
        if (row) {
          const json = toCourseJson(row);
          writeFileSync(path, JSON.stringify(json, null, 2));
          console.log(`Also wrote referenced course: ${path}`);
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
