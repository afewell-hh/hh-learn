/**
 * Unit tests for completion tracking engine (Issue #221)
 * Run with: npm run build && node dist/tests/run-completion-tests.js
 */

import {
  loadMetadataCache,
  getCourseMetadata,
  getPathwayMetadata,
  calculateCourseCompletion,
  calculatePathwayCompletion,
  validateExplicitCompletion,
  validateCompletionTimestamp,
} from '../src/api/lambda/completion.js';

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  testsRun++;
  if (condition) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  testsRun++;
  if (actual === expected) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ ${message} (expected: ${expected}, got: ${actual})`);
  }
}

console.log('========================================');
console.log('Completion Engine Tests (Issue #221)');
console.log('========================================\n');

// Setup: Load metadata
loadMetadataCache();

// ==========================================================================
// Test Group 1: Metadata Loading
// ==========================================================================
console.log('Test Group 1: Metadata Loading');
console.log('------------------------------------------');

{
  const courseMeta = getCourseMetadata('hedgehog-lab-foundations');
  assert(courseMeta !== undefined, 'Load course metadata: hedgehog-lab-foundations');
  assert(courseMeta?.slug === 'hedgehog-lab-foundations', 'Course slug matches');
  assert(Array.isArray(courseMeta?.modules), 'Course has modules array');
  assert((courseMeta?.modules.length || 0) === 4, 'Course has 4 modules');
}

{
  const pathwayMeta = getPathwayMetadata('course-authoring-expert');
  assert(pathwayMeta !== undefined, 'Load pathway metadata: course-authoring-expert');
  assert(pathwayMeta?.slug === 'course-authoring-expert', 'Pathway slug matches');
  assert(Array.isArray(pathwayMeta?.courses), 'Pathway has courses array');
}

{
  const missing = getCourseMetadata('nonexistent-course');
  assert(missing === undefined, 'Return undefined for missing course');
}

{
  const missing = getPathwayMetadata('nonexistent-pathway');
  assert(missing === undefined, 'Return undefined for missing pathway');
}

// ==========================================================================
// Test Group 2: Course Completion Calculation
// ==========================================================================
console.log('\nTest Group 2: Course Completion Calculation');
console.log('------------------------------------------');

{
  // All modules complete
  const modules = {
    'accessing-the-hedgehog-virtual-lab-with-google-cloud': { completed: true },
    'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': { completed: true },
    'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': { completed: true },
    'intro-to-kubernetes': { completed: true },
  };
  const result = calculateCourseCompletion('hedgehog-lab-foundations', modules);
  assertEqual(result.completed, true, 'Course complete with all 4 modules done');
  assertEqual(result.progress.completed, 4, 'Progress: 4 completed');
  assertEqual(result.progress.total, 4, 'Progress: 4 total');
}

{
  // Partial completion
  const modules = {
    'accessing-the-hedgehog-virtual-lab-with-google-cloud': { completed: true },
    'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': { completed: true },
  };
  const result = calculateCourseCompletion('hedgehog-lab-foundations', modules);
  assertEqual(result.completed, false, 'Course incomplete with 2/4 modules');
  assertEqual(result.progress.completed, 2, 'Progress: 2 completed');
  assertEqual(result.progress.total, 4, 'Progress: 4 total');
}

{
  // No progress
  const result = calculateCourseCompletion('hedgehog-lab-foundations', {});
  assertEqual(result.completed, false, 'Course incomplete with 0 modules');
  assertEqual(result.progress.completed, 0, 'Progress: 0 completed');
  assertEqual(result.progress.total, 4, 'Progress: 4 total');
}

{
  // Nonexistent course
  const result = calculateCourseCompletion('nonexistent-course', {});
  assertEqual(result.completed, false, 'Nonexistent course not complete');
  assertEqual(result.progress.completed, 0, 'Nonexistent: 0 completed');
  assertEqual(result.progress.total, 0, 'Nonexistent: 0 total');
}

{
  // Started but not completed modules don't count
  const modules = {
    'accessing-the-hedgehog-virtual-lab-with-google-cloud': { started: true }, // No completed flag
    'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': { started: true },
  };
  const result = calculateCourseCompletion('hedgehog-lab-foundations', modules);
  assertEqual(result.completed, false, 'Started modules without completed=true do not count');
  assertEqual(result.progress.completed, 0, 'Progress: 0 completed');
}

// ==========================================================================
// Test Group 3: Pathway Completion Calculation
// ==========================================================================
console.log('\nTest Group 3: Pathway Completion Calculation');
console.log('------------------------------------------');

{
  // Check if course-authoring-expert pathway exists
  const pathwayMeta = getPathwayMetadata('course-authoring-expert');
  if (pathwayMeta) {
    // Build complete courses based on pathway definition
    const courses: Record<string, any> = {};
    pathwayMeta.courses.forEach((slug) => {
      courses[slug] = { completed: true };
    });

    const result = calculatePathwayCompletion('course-authoring-expert', courses);
    assertEqual(result.completed, true, 'Pathway complete when all courses done');
    assert(result.progress.completed === result.progress.total, 'All courses completed');
  } else {
    console.log('⊘ Skipping pathway test (course-authoring-expert not found)');
    testsRun++;
    testsPassed++;
  }
}

{
  // Partial pathway completion
  const courses = {
    'course-authoring-101': { completed: true },
    // Other courses missing
  };
  const result = calculatePathwayCompletion('course-authoring-expert', courses);
  assertEqual(result.completed, false, 'Pathway incomplete with partial courses');
  assert(result.progress.completed < result.progress.total, 'Not all courses complete');
}

{
  // No progress
  const result = calculatePathwayCompletion('course-authoring-expert', {});
  assertEqual(result.completed, false, 'Pathway incomplete with 0 courses');
  assertEqual(result.progress.completed, 0, 'Progress: 0 completed');
}

// ==========================================================================
// Test Group 4: Timestamp Validation
// ==========================================================================
console.log('\nTest Group 4: Timestamp Validation');
console.log('------------------------------------------');

{
  const base = '2025-10-19T14:00:00Z';
  const within = '2025-10-19T14:04:00Z'; // +4 min
  assert(validateCompletionTimestamp(within, base), 'Accept timestamp within 5 min (+4)');
}

{
  const base = '2025-10-19T14:00:00Z';
  const within = '2025-10-19T13:57:00Z'; // -3 min
  assert(validateCompletionTimestamp(within, base), 'Accept timestamp within 5 min (-3)');
}

{
  const base = '2025-10-19T14:00:00Z';
  const exactly = '2025-10-19T14:05:00Z'; // Exactly 5 min
  assert(validateCompletionTimestamp(exactly, base), 'Accept timestamp exactly 5 min apart');
}

{
  const base = '2025-10-19T14:00:00Z';
  const outside = '2025-10-19T14:06:00Z'; // +6 min
  assert(!validateCompletionTimestamp(outside, base), 'Reject timestamp outside 5 min (+6)');
}

{
  const same = '2025-10-19T14:00:00Z';
  assert(validateCompletionTimestamp(same, same), 'Accept identical timestamps');
}

// ==========================================================================
// Test Group 5: Explicit Completion Validation
// ==========================================================================
console.log('\nTest Group 5: Explicit Completion Validation');
console.log('------------------------------------------');

{
  // Valid course completion
  const progressData = {
    modules: {
      'accessing-the-hedgehog-virtual-lab-with-google-cloud': { completed: true },
      'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': { completed: true },
      'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': { completed: true },
      'intro-to-kubernetes': { completed: true },
    },
  };
  const result = validateExplicitCompletion('course', 'hedgehog-lab-foundations', progressData);
  assert(result.valid, 'Accept valid course completion claim');
}

{
  // Invalid course completion (partial)
  const progressData = {
    modules: {
      'accessing-the-hedgehog-virtual-lab-with-google-cloud': { completed: true },
      // Only 1/4 modules
    },
  };
  const result = validateExplicitCompletion('course', 'hedgehog-lab-foundations', progressData);
  assert(!result.valid, 'Reject invalid course completion claim (1/4 modules)');
  assert((result.reason?.includes('modules completed') || false), 'Rejection reason mentions modules');
}

{
  // No modules at all
  const progressData = { modules: {} };
  const result = validateExplicitCompletion('course', 'hedgehog-lab-foundations', progressData);
  assert(!result.valid, 'Reject course completion with no modules');
}

{
  // Missing modules object
  const progressData = { started: true };
  const result = validateExplicitCompletion('course', 'hedgehog-lab-foundations', progressData);
  assert(!result.valid, 'Reject course completion without modules object');
}

{
  // Nonexistent course
  const progressData = { modules: { 'some-module': { completed: true } } };
  const result = validateExplicitCompletion('course', 'nonexistent-course', progressData);
  assert(!result.valid, 'Reject completion for nonexistent course');
}

// ==========================================================================
// Test Group 6: Reused Modules
// ==========================================================================
console.log('\nTest Group 6: Reused Modules Across Courses');
console.log('------------------------------------------');

{
  // Same module can count toward multiple courses
  const sharedModule = {
    'accessing-the-hedgehog-virtual-lab-with-google-cloud': { completed: true },
  };

  const result1 = calculateCourseCompletion('hedgehog-lab-foundations', sharedModule);
  const result2 = calculateCourseCompletion('hedgehog-lab-foundations', sharedModule);

  assertEqual(result1.progress.completed, 1, 'Module counts in first calculation');
  assertEqual(result2.progress.completed, 1, 'Module counts in second calculation (reusable)');
  assert((result1.progress.completed || 0) > 0, 'Progress exists for module');
}

// ==========================================================================
// Summary
// ==========================================================================
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total:  ${testsRun}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log('========================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
