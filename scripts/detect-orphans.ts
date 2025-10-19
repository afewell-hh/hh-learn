#!/usr/bin/env ts-node
/**
 * Orphan Detection Script for HubDB
 *
 * This script detects orphaned references in HubDB tables:
 * - Courses referencing non-existent modules
 * - Pathways referencing non-existent courses or modules
 * - Content blocks with invalid references
 *
 * Can be run manually or scheduled as a weekly job.
 * Outputs a report that can be committed to the repo or stored in S3.
 *
 * Usage:
 *   npm run detect-orphans
 *   npm run detect-orphans -- --output=verification-output/orphan-report.json
 */

import 'dotenv/config';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { getHubSpotClient } from '../src/shared/hubspot.js';
import {
  getAvailableModuleSlugs,
  getAvailableCourseSlugs,
  validateCourseReferences,
  validatePathwayReferences,
  type ValidationError
} from '../src/sync/validation.js';

const hubspot = getHubSpotClient();

const MODULES_TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID;
const COURSES_TABLE_ID = process.env.HUBDB_COURSES_TABLE_ID;
const PATHWAYS_TABLE_ID = process.env.HUBDB_PATHWAYS_TABLE_ID;

interface OrphanReport {
  timestamp: string;
  summary: {
    totalOrphans: number;
    orphanedCourses: number;
    orphanedPathways: number;
  };
  errors: ValidationError[];
  recommendations: string[];
}

async function detectOrphans(): Promise<OrphanReport> {
  console.log('🔍 HubDB Orphan Detection Report\n');
  console.log('=' .repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const errors: ValidationError[] = [];
  const orphanedCourses = new Set<string>();
  const orphanedPathways = new Set<string>();

  // Build catalogs of available content
  console.log('📚 Building content catalogs...\n');
  const availableModules = await getAvailableModuleSlugs();
  const availableCourses = await getAvailableCourseSlugs();
  console.log(`  ✓ Found ${availableModules.size} module(s) in filesystem`);
  console.log(`  ✓ Found ${availableCourses.size} course(s) in filesystem\n`);

  // Check courses in HubDB
  if (COURSES_TABLE_ID) {
    console.log('🔍 Checking courses in HubDB...\n');
    try {
      const coursesResponse = await hubspot.cms.hubdb.rowsApi.getTableRows(
        COURSES_TABLE_ID,
        undefined,
        undefined,
        undefined
      );

      const courseRows = coursesResponse.results || [];
      console.log(`  Found ${courseRows.length} course(s) in HubDB`);

      for (const row of courseRows) {
        const courseSlug = row.path || row.values?.slug || 'unknown';
        const modulesSlugsJson = row.values?.module_slugs_json;
        const contentBlocksJson = row.values?.content_blocks_json;

        let modules: string[] = [];
        let contentBlocks: any[] = [];

        // Parse module_slugs_json
        if (modulesSlugsJson) {
          try {
            modules = JSON.parse(modulesSlugsJson);
          } catch (err) {
            console.warn(`  ⚠️  Failed to parse module_slugs_json for course ${courseSlug}`);
          }
        }

        // Parse content_blocks_json
        if (contentBlocksJson) {
          try {
            contentBlocks = JSON.parse(contentBlocksJson);
          } catch (err) {
            console.warn(`  ⚠️  Failed to parse content_blocks_json for course ${courseSlug}`);
          }
        }

        // Validate references
        const courseErrors = validateCourseReferences(
          courseSlug,
          modules,
          contentBlocks,
          availableModules
        );

        if (courseErrors.length > 0) {
          errors.push(...courseErrors);
          orphanedCourses.add(courseSlug);
        }
      }

      if (orphanedCourses.size > 0) {
        console.log(`  ⚠️  Found ${orphanedCourses.size} course(s) with orphaned references`);
      } else {
        console.log(`  ✓ All courses have valid references`);
      }
      console.log('');
    } catch (err: any) {
      console.error(`  ✗ Failed to check courses: ${err.message}\n`);
    }
  }

  // Check pathways in HubDB
  if (PATHWAYS_TABLE_ID) {
    console.log('🔍 Checking pathways in HubDB...\n');
    try {
      const pathwaysResponse = await hubspot.cms.hubdb.rowsApi.getTableRows(
        PATHWAYS_TABLE_ID,
        undefined,
        undefined,
        undefined
      );

      const pathwayRows = pathwaysResponse.results || [];
      console.log(`  Found ${pathwayRows.length} pathway(s) in HubDB`);

      for (const row of pathwayRows) {
        const pathwaySlug = row.path || row.values?.slug || 'unknown';
        const modulesSlugsJson = row.values?.module_slugs_json;
        const coursesSlugsJson = row.values?.course_slugs_json;
        const contentBlocksJson = row.values?.content_blocks_json;

        let modules: string[] | undefined;
        let courses: string[] | undefined;
        let contentBlocks: any[] | undefined;

        // Parse module_slugs_json
        if (modulesSlugsJson) {
          try {
            modules = JSON.parse(modulesSlugsJson);
          } catch (err) {
            console.warn(`  ⚠️  Failed to parse module_slugs_json for pathway ${pathwaySlug}`);
          }
        }

        // Parse course_slugs_json
        if (coursesSlugsJson) {
          try {
            courses = JSON.parse(coursesSlugsJson);
          } catch (err) {
            console.warn(`  ⚠️  Failed to parse course_slugs_json for pathway ${pathwaySlug}`);
          }
        }

        // Parse content_blocks_json
        if (contentBlocksJson) {
          try {
            contentBlocks = JSON.parse(contentBlocksJson);
          } catch (err) {
            console.warn(`  ⚠️  Failed to parse content_blocks_json for pathway ${pathwaySlug}`);
          }
        }

        // Validate references
        const pathwayErrors = validatePathwayReferences(
          pathwaySlug,
          modules,
          courses,
          contentBlocks,
          availableModules,
          availableCourses
        );

        if (pathwayErrors.length > 0) {
          errors.push(...pathwayErrors);
          orphanedPathways.add(pathwaySlug);
        }
      }

      if (orphanedPathways.size > 0) {
        console.log(`  ⚠️  Found ${orphanedPathways.size} pathway(s) with orphaned references`);
      } else {
        console.log(`  ✓ All pathways have valid references`);
      }
      console.log('');
    } catch (err: any) {
      console.error(`  ✗ Failed to check pathways: ${err.message}\n`);
    }
  }

  // Generate report
  console.log('=' .repeat(60));
  console.log('\n📊 SUMMARY\n');
  console.log(`Total orphaned references: ${errors.length}`);
  console.log(`Courses with orphans: ${orphanedCourses.size}`);
  console.log(`Pathways with orphans: ${orphanedPathways.size}\n`);

  if (errors.length > 0) {
    console.log('🔴 ORPHANED REFERENCES DETECTED:\n');

    // Group by parent
    const byParent = new Map<string, ValidationError[]>();
    for (const error of errors) {
      const key = `${error.parentType}:${error.parentSlug}`;
      if (!byParent.has(key)) {
        byParent.set(key, []);
      }
      byParent.get(key)!.push(error);
    }

    for (const [key, parentErrors] of byParent) {
      const [parentType, parentSlug] = key.split(':');
      console.log(`  ${parentType.toUpperCase()}: ${parentSlug}`);
      for (const error of parentErrors) {
        const refType = error.type === 'missing_module' ? 'module' :
                        error.type === 'missing_course' ? 'course' : 'reference';
        console.log(`    ✗ Missing ${refType} "${error.referencedSlug}" in ${error.location}`);
      }
      console.log('');
    }
  } else {
    console.log('✅ No orphaned references detected!\n');
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (errors.length > 0) {
    recommendations.push('Review the orphaned references listed above');
    recommendations.push('Either create the missing content or update the JSON files to remove invalid references');
    recommendations.push('Run sync scripts with --dry-run to validate before publishing');
    recommendations.push('Consider adding pre-commit hooks to prevent orphaned references');
  } else {
    recommendations.push('Continue monitoring weekly for orphaned references');
    recommendations.push('Ensure sync validation remains enabled');
  }

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalOrphans: errors.length,
      orphanedCourses: orphanedCourses.size,
      orphanedPathways: orphanedPathways.size
    },
    errors,
    recommendations
  };
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const outputPath = outputArg ? outputArg.split('=')[1] : null;

  const report = await detectOrphans();

  // Write report to file if output path specified
  if (outputPath) {
    const fullPath = join(process.cwd(), outputPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`📝 Report saved to: ${outputPath}\n`);
  }

  // Exit with error code if orphans detected
  if (report.summary.totalOrphans > 0) {
    console.log('❌ Orphan detection found issues. Please review and fix.\n');
    process.exit(1);
  } else {
    console.log('✅ Orphan detection complete. No issues found.\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Orphan detection failed:', err);
  process.exit(1);
});
