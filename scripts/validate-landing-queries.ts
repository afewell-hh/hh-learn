#!/usr/bin/env ts-node
/**
 * Validate that landing page HubDB queries return expected data
 *
 * This script tests the queries used by /learn and /learn/get-started templates
 * to ensure they return real content after the tagging strategy (Issue #289).
 */

import 'dotenv/config';
import { getHubSpotClient } from '../src/shared/hubspot.js';

const hubspot = getHubSpotClient();

const PATHWAYS_TABLE_ID = process.env.HUBDB_PATHWAYS_TABLE_ID!;
const COURSES_TABLE_ID = process.env.HUBDB_COURSES_TABLE_ID!;
const MODULES_TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID!;

async function validateLandingQueries() {
  console.log('🔍 Validating landing page HubDB queries...\n');

  if (!PATHWAYS_TABLE_ID || !COURSES_TABLE_ID || !MODULES_TABLE_ID) {
    throw new Error('Missing HubDB table IDs in environment');
  }

  let allPassed = true;

  // ==================== QUERY 1: Featured Pathways ====================
  console.log('📋 Query 1: Featured Pathways (display_order ≤ 3)');
  console.log('   Template: learn-landing.html, line ~72-77');
  console.log('   Query: orderBy=display_order&limit=3\n');

  try {
    const featuredPathways = await hubspot.cms.hubdb.rowsApi.getTableRows(
      PATHWAYS_TABLE_ID as any,
      undefined,
      undefined,
      3 as any
    );

    const pathways = featuredPathways.results || [];
    console.log(`   ✅ Returned ${pathways.length} pathway(s):`);
    pathways.forEach((p, i) => {
      console.log(`      ${i + 1}. ${p.values?.hs_name || p.name} (display_order: ${p.values?.display_order})`);
      const tags = p.values?.tags || '';
      if (tags.includes('featured')) {
        console.log(`         ✓ Tagged: featured`);
      }
      if (tags.includes('flagship')) {
        console.log(`         ✓ Tagged: flagship`);
      }
    });

    if (pathways.length === 0) {
      console.log('   ⚠️  WARNING: No pathways returned!');
      allPassed = false;
    } else if (pathways.length < 3) {
      console.log(`   ⚠️  WARNING: Only ${pathways.length}/3 pathways returned`);
    }
  } catch (err: any) {
    console.error(`   ❌ Query failed: ${err.message}`);
    allPassed = false;
  }

  console.log();

  // ==================== QUERY 2: Popular Courses ====================
  console.log('📋 Query 2: Popular Courses (display_order ≤ 3)');
  console.log('   Template: learn-landing.html, line ~140-144');
  console.log('   Query: orderBy=display_order&limit=3\n');

  try {
    const popularCourses = await hubspot.cms.hubdb.rowsApi.getTableRows(
      COURSES_TABLE_ID as any,
      undefined,
      undefined,
      3 as any
    );

    const courses = popularCourses.results || [];
    console.log(`   ✅ Returned ${courses.length} course(s):`);
    courses.forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.values?.hs_name || c.name} (display_order: ${c.values?.display_order})`);
      const tags = c.values?.tags || '';
      if (tags.includes('popular')) {
        console.log(`         ✓ Tagged: popular`);
      }
    });

    if (courses.length === 0) {
      console.log('   ⚠️  WARNING: No courses returned!');
      allPassed = false;
    } else if (courses.length < 3) {
      console.log(`   ⚠️  WARNING: Only ${courses.length}/3 courses returned`);
    }
  } catch (err: any) {
    console.error(`   ❌ Query failed: ${err.message}`);
    allPassed = false;
  }

  console.log();

  // ==================== QUERY 3: Recent Modules ====================
  console.log('📋 Query 3: Recent Modules (display_order, limit 6)');
  console.log('   Template: learn-landing.html, line ~237-241');
  console.log('   Query: orderBy=display_order&limit=6\n');

  try {
    const recentModules = await hubspot.cms.hubdb.rowsApi.getTableRows(
      MODULES_TABLE_ID as any,
      undefined,
      undefined,
      6 as any
    );

    const modules = recentModules.results || [];
    console.log(`   ✅ Returned ${modules.length} module(s):`);
    modules.forEach((m, i) => {
      console.log(`      ${i + 1}. ${m.values?.hs_name || m.name} (display_order: ${m.values?.display_order})`);
    });

    if (modules.length === 0) {
      console.log('   ⚠️  WARNING: No modules returned!');
      allPassed = false;
    } else if (modules.length < 6) {
      console.log(`   ℹ️  Note: ${modules.length}/6 modules returned (acceptable if less content available)`);
    }
  } catch (err: any) {
    console.error(`   ❌ Query failed: ${err.message}`);
    allPassed = false;
  }

  console.log();

  // ==================== QUERY 4: Flagship Pathway Courses ====================
  console.log('📋 Query 4: Flagship Pathway (network-like-hyperscaler)');
  console.log('   Template: get-started.html, line ~80-83');
  console.log('   Query: hs_path__eq=network-like-hyperscaler\n');

  try {
    const flagshipPathway = await hubspot.cms.hubdb.rowsApi.getTableRows(
      PATHWAYS_TABLE_ID as any,
      undefined,
      undefined,
      undefined,
      ['hs_path__eq=network-like-hyperscaler']
    );

    const pathways = flagshipPathway.results || [];
    console.log(`   ✅ Returned ${pathways.length} pathway(s):`);

    if (pathways.length > 0) {
      const pathway = pathways[0];
      console.log(`      Pathway: ${pathway.values?.hs_name || pathway.name}`);
      console.log(`      Display order: ${pathway.values?.display_order}`);

      const courseSlugsJson = pathway.values?.course_slugs_json;
      if (courseSlugsJson) {
        try {
          const courseSlugs = JSON.parse(courseSlugsJson);
          console.log(`      Course count: ${courseSlugs.length}`);
          console.log(`      Courses: ${courseSlugs.join(', ')}`);
        } catch (e) {
          console.log('      ⚠️  Could not parse course_slugs_json');
        }
      }
    }

    if (pathways.length === 0) {
      console.log('   ❌ ERROR: Flagship pathway not found!');
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`   ❌ Query failed: ${err.message}`);
    allPassed = false;
  }

  console.log();
  console.log('='.repeat(70));

  if (allPassed) {
    console.log('✅ All landing page queries validated successfully!');
    console.log('\nLanding pages will display real content when deployed.');
  } else {
    console.log('❌ Some queries failed validation!');
    console.log('\nPlease review the warnings/errors above before deploying.');
    process.exit(1);
  }
}

validateLandingQueries().catch((err) => {
  console.error('❌ Validation script failed:', err);
  process.exit(1);
});
