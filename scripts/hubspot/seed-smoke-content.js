#!/usr/bin/env node
/*
 Seed minimal HubDB values for three smoke pages so CI has stable anchors:
 - Module: accessing-the-hedgehog-virtual-lab-with-google-cloud -> full_content
 - Course: course-authoring-101 -> module_slugs_json
 - Pathway: course-authoring-expert -> course_slugs_json
 Safe: updates specific rows by hs_path/path; publishes only affected tables.
*/

require('dotenv/config');
const { Client } = require('@hubspot/api-client');

const TOKEN = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN || process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!TOKEN) {
  console.error('❌ No HubSpot token. Set HUBSPOT_PROJECT_ACCESS_TOKEN (preferred) or HUBSPOT_PRIVATE_APP_TOKEN.');
  process.exit(1);
}

const MODULES_TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID;
const COURSES_TABLE_ID = process.env.HUBDB_COURSES_TABLE_ID;
const PATHWAYS_TABLE_ID = process.env.HUBDB_PATHWAYS_TABLE_ID;

if (!MODULES_TABLE_ID || !COURSES_TABLE_ID || !PATHWAYS_TABLE_ID) {
  console.error('❌ HUBDB_*_TABLE_ID env vars are required.');
  process.exit(1);
}

const client = new Client({ accessToken: TOKEN });

const smoke = {
  moduleSlug: 'accessing-the-hedgehog-virtual-lab-with-google-cloud',
  courseSlug: 'course-authoring-101',
  pathwaySlug: 'course-authoring-expert',
};

function norm(v) {
  return String(v || '').replace(/^\/+|\/+$/g, '').trim();
}

async function findRowBySlug(tableId, slug) {
  const resp = await client.cms.hubdb.rowsApi.getTableRows(String(tableId), undefined, undefined, 250);
  const rows = resp.results || [];
  const target = rows.find(r => {
    const vals = r.values || {};
    const p = norm(vals.hs_path || vals.path || r.path || '');
    return p.split('?')[0] === slug;
  });
  return target || null;
}

async function updateRow(tableId, rowId, values) {
  await client.cms.hubdb.rowsApi.updateDraftTableRow(String(tableId), String(rowId), { values });
}

async function run() {
  console.log('🔐 Using HubSpot token');

  // 1) Module content
  const moduleRow = await findRowBySlug(MODULES_TABLE_ID, smoke.moduleSlug);
  if (moduleRow) {
    const values = Object.assign({}, moduleRow.values);
    if (!values.full_content) {
      values.full_content = `<h2>Welcome to the Hedgehog Virtual Lab</h2>\n<p>This module walks you through accessing the Hedgehog Virtual Lab on Google Cloud and completing your first login. You will provision credentials and validate connectivity before proceeding to hands-on labs.</p>`;
      console.log(`✏️  Updating module full_content for ${smoke.moduleSlug} (row ${moduleRow.id})`);
      await updateRow(MODULES_TABLE_ID, moduleRow.id, values);
    } else {
      console.log(`ℹ️  Module already has full_content: ${smoke.moduleSlug}`);
    }
  } else {
    console.log(`⚠️  Module row not found for slug: ${smoke.moduleSlug}`);
  }

  // 2) Course modules association
  const courseRow = await findRowBySlug(COURSES_TABLE_ID, smoke.courseSlug);
  if (courseRow) {
    const values = Object.assign({}, courseRow.values);
    const current = (() => { try { return JSON.parse(values.module_slugs_json || '[]'); } catch { return []; } })();
    if (!current.includes(smoke.moduleSlug)) {
      const updated = Array.from(new Set([...current, smoke.moduleSlug]));
      values.module_slugs_json = JSON.stringify(updated);
      console.log(`✏️  Updating course module_slugs_json for ${smoke.courseSlug} -> ${JSON.stringify(updated)}`);
      await updateRow(COURSES_TABLE_ID, courseRow.id, values);
    } else {
      console.log(`ℹ️  Course already lists module: ${smoke.courseSlug}`);
    }
  } else {
    console.log(`⚠️  Course row not found for slug: ${smoke.courseSlug}`);
  }

  // 3) Pathway courses association
  const pathwayRow = await findRowBySlug(PATHWAYS_TABLE_ID, smoke.pathwaySlug);
  if (pathwayRow) {
    const values = Object.assign({}, pathwayRow.values);
    const current = (() => { try { return JSON.parse(values.course_slugs_json || '[]'); } catch { return []; } })();
    if (!current.includes(smoke.courseSlug)) {
      const updated = Array.from(new Set([...current, smoke.courseSlug]));
      values.course_slugs_json = JSON.stringify(updated);
      console.log(`✏️  Updating pathway course_slugs_json for ${smoke.pathwaySlug} -> ${JSON.stringify(updated)}`);
      await updateRow(PATHWAYS_TABLE_ID, pathwayRow.id, values);
    } else {
      console.log(`ℹ️  Pathway already lists course: ${smoke.pathwaySlug}`);
    }
  } else {
    console.log(`⚠️  Pathway row not found for slug: ${smoke.pathwaySlug}`);
  }

  // Publish tables that changed
  for (const tid of [MODULES_TABLE_ID, COURSES_TABLE_ID, PATHWAYS_TABLE_ID]) {
    try {
      await client.cms.hubdb.tablesApi.publishDraftTable(String(tid));
      console.log(`✅ Published HubDB table ${tid}`);
    } catch (e) {
      console.log(`ℹ️  Publish table ${tid} returned: ${e.message}`);
    }
  }

  console.log('🎉 HubDB smoke content seeding complete');
}

run().catch(err => { console.error('❌ Failed:', err.message || err); process.exit(1); });

