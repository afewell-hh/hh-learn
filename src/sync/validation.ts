/**
 * Validation utilities for HubDB sync scripts
 *
 * Provides reference validation to prevent orphaned slugs in courses and pathways.
 * This addresses the gap identified in the LMS Comprehensive Gap Analysis:
 * - Courses/pathways store references as JSON arrays of slugs (strings)
 * - No referential integrity checking before sync
 * - Risk of broken links if referenced modules/courses don't exist
 */

import { readdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';

export interface ValidationError {
  type: 'missing_module' | 'missing_course' | 'missing_content_block_ref';
  parentType: 'course' | 'pathway';
  parentSlug: string;
  referencedSlug: string;
  location: string; // e.g., "modules array" or "content_blocks[0]"
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Build a catalog of all available module slugs from the filesystem
 */
export async function getAvailableModuleSlugs(): Promise<Set<string>> {
  const moduleSlugs = new Set<string>();

  try {
    const modulesDir = join(process.cwd(), 'content/modules');
    const moduleDirs = await readdir(modulesDir, { withFileTypes: true });

    for (const dir of moduleDirs) {
      if (!dir.isDirectory()) continue;

      // Verify README.md exists and has valid front matter
      try {
        const readmePath = join(modulesDir, dir.name, 'README.md');
        const fileContent = await readFile(readmePath, 'utf-8');
        const { data: frontmatter } = matter(fileContent);

        // Use slug from front matter if available, otherwise directory name
        const slug = (frontmatter as any).slug || dir.name;
        moduleSlugs.add(slug.toLowerCase());
      } catch (err) {
        // Skip directories without valid README.md
        console.warn(`  ⚠️  Skipping module directory ${dir.name}: no valid README.md`);
      }
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    // content/modules doesn't exist
  }

  return moduleSlugs;
}

/**
 * Build a catalog of all available course slugs from the filesystem
 */
export async function getAvailableCourseSlugs(): Promise<Set<string>> {
  const courseSlugs = new Set<string>();

  try {
    const coursesDir = join(process.cwd(), 'content/courses');
    const files = await readdir(coursesDir, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;

      try {
        const coursePath = join(coursesDir, file.name);
        const fileContent = await readFile(coursePath, 'utf-8');
        const course = JSON.parse(fileContent);

        if (course.slug) {
          courseSlugs.add(course.slug.toLowerCase());
        }
      } catch (err) {
        console.warn(`  ⚠️  Skipping invalid course file ${file.name}`);
      }
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    // content/courses doesn't exist
  }

  return courseSlugs;
}

/**
 * Validate module references in a course
 */
export function validateCourseReferences(
  courseSlug: string,
  moduleReferences: string[],
  contentBlocks: any[] | undefined,
  availableModules: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate modules array
  for (const moduleSlug of moduleReferences) {
    if (!availableModules.has(moduleSlug.toLowerCase())) {
      errors.push({
        type: 'missing_module',
        parentType: 'course',
        parentSlug: courseSlug,
        referencedSlug: moduleSlug,
        location: 'modules array'
      });
    }
  }

  // Validate content_blocks module_ref references
  if (contentBlocks && Array.isArray(contentBlocks)) {
    contentBlocks.forEach((block, index) => {
      if (block.type === 'module_ref' && block.module_slug) {
        if (!availableModules.has(block.module_slug.toLowerCase())) {
          errors.push({
            type: 'missing_content_block_ref',
            parentType: 'course',
            parentSlug: courseSlug,
            referencedSlug: block.module_slug,
            location: `content_blocks[${index}]`
          });
        }
      }
    });
  }

  return errors;
}

/**
 * Validate module and course references in a pathway
 */
export function validatePathwayReferences(
  pathwaySlug: string,
  moduleReferences: string[] | undefined,
  courseReferences: string[] | undefined,
  contentBlocks: any[] | undefined,
  availableModules: Set<string>,
  availableCourses: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate modules array
  if (moduleReferences && Array.isArray(moduleReferences)) {
    for (const moduleSlug of moduleReferences) {
      if (!availableModules.has(moduleSlug.toLowerCase())) {
        errors.push({
          type: 'missing_module',
          parentType: 'pathway',
          parentSlug: pathwaySlug,
          referencedSlug: moduleSlug,
          location: 'modules array'
        });
      }
    }
  }

  // Validate courses array
  if (courseReferences && Array.isArray(courseReferences)) {
    for (const courseSlug of courseReferences) {
      if (!availableCourses.has(courseSlug.toLowerCase())) {
        errors.push({
          type: 'missing_course',
          parentType: 'pathway',
          parentSlug: pathwaySlug,
          referencedSlug: courseSlug,
          location: 'courses array'
        });
      }
    }
  }

  // Validate content_blocks references
  if (contentBlocks && Array.isArray(contentBlocks)) {
    contentBlocks.forEach((block, index) => {
      if (block.type === 'module_ref' && block.module_slug) {
        if (!availableModules.has(block.module_slug.toLowerCase())) {
          errors.push({
            type: 'missing_content_block_ref',
            parentType: 'pathway',
            parentSlug: pathwaySlug,
            referencedSlug: block.module_slug,
            location: `content_blocks[${index}]`
          });
        }
      } else if (block.type === 'course_ref' && block.course_slug) {
        if (!availableCourses.has(block.course_slug.toLowerCase())) {
          errors.push({
            type: 'missing_content_block_ref',
            parentType: 'pathway',
            parentSlug: pathwaySlug,
            referencedSlug: block.course_slug,
            location: `content_blocks[${index}]`
          });
        }
      }
    });
  }

  return errors;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';

  const lines: string[] = [];
  lines.push('\n❌ VALIDATION FAILED: Found orphaned references\n');

  // Group errors by parent
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
    lines.push(`\n  ${parentType.toUpperCase()}: ${parentSlug}`);

    for (const error of parentErrors) {
      const refType = error.type === 'missing_module' ? 'module' :
                      error.type === 'missing_course' ? 'course' : 'reference';
      lines.push(`    ✗ Missing ${refType} "${error.referencedSlug}" in ${error.location}`);
    }
  }

  lines.push('\n');
  lines.push('💡 Fix these issues before syncing:');
  lines.push('   1. Create the missing modules/courses, OR');
  lines.push('   2. Remove the invalid references from the JSON files');
  lines.push('');

  return lines.join('\n');
}
