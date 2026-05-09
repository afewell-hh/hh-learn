"use strict";
/**
 * Completion Tracking Engine - Issue #221
 *
 * Provides metadata-driven completion calculation for courses and pathways.
 * Addresses the false-positive issues from PR #219 by comparing against
 * full course/pathway definitions instead of partial progress snapshots.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMetadataCache = loadMetadataCache;
exports.getCourseMetadata = getCourseMetadata;
exports.getPathwayMetadata = getPathwayMetadata;
exports.listAllCourseSlugs = listAllCourseSlugs;
exports.listAllPathwaySlugs = listAllPathwaySlugs;
exports.calculateCourseCompletion = calculateCourseCompletion;
exports.calculatePathwayCompletion = calculatePathwayCompletion;
exports.validateExplicitCompletion = validateExplicitCompletion;
exports.validateCompletionTimestamp = validateCompletionTimestamp;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const FALLBACK_COURSE_METADATA = [
    {
        slug: 'hedgehog-lab-foundations',
        title: 'Hedgehog Lab Foundations',
        modules: [
            'accessing-the-hedgehog-virtual-lab-with-google-cloud',
            'accessing-the-hedgehog-virtual-lab-with-amazon-web-services',
            'accessing-the-hedgehog-virtual-lab-with-microsoft-azure',
        ],
    },
    {
        slug: 'network-like-hyperscaler-foundations',
        title: 'Course 1: Foundations & Interfaces',
        modules: [
            'fabric-operations-welcome',
            'fabric-operations-how-it-works',
            'fabric-operations-mastering-interfaces',
            'fabric-operations-foundations-recap',
        ],
    },
    {
        slug: 'network-like-hyperscaler-observability',
        title: 'Course 3: Observability & Fabric Health',
        modules: [
            'fabric-operations-telemetry-overview',
            'fabric-operations-dashboard-interpretation',
            'fabric-operations-events-status',
            'fabric-operations-pre-support-diagnostics',
        ],
    },
    {
        slug: 'network-like-hyperscaler-provisioning',
        title: 'Course 2: Provisioning & Day 1 Operations',
        modules: [
            'fabric-operations-vpc-provisioning',
            'fabric-operations-vpc-attachments',
            'fabric-operations-connectivity-validation',
            'fabric-operations-decommission-cleanup',
        ],
    },
    {
        slug: 'network-like-hyperscaler-troubleshooting',
        title: 'Course 4: Troubleshooting, Recovery & Escalation',
        modules: [
            'fabric-operations-troubleshooting-framework',
            'fabric-operations-diagnosis-lab',
            'fabric-operations-rollback-recovery',
            'fabric-operations-post-incident-review',
        ],
    },
];
const FALLBACK_PATHWAY_METADATA = [
    {
        slug: 'network-like-hyperscaler',
        title: 'Network Like a Hyperscaler',
        courses: [
            'network-like-hyperscaler-foundations',
            'network-like-hyperscaler-provisioning',
            'network-like-hyperscaler-observability',
            'network-like-hyperscaler-troubleshooting',
        ],
    },
];
// ============================================================================
// Metadata Cache
// ============================================================================
/**
 * Global metadata cache - loaded once at Lambda cold start,
 * persists across warm invocations for optimal performance.
 */
const METADATA_CACHE = {
    courses: new Map(),
    pathways: new Map(),
    loaded: false
};
/**
 * Load course and pathway metadata from content definitions.
 * Called once at module initialization (Lambda cold start).
 *
 * Performance: <10ms for ~50-100 courses/pathways
 */
function loadMetadataCache() {
    if (METADATA_CACHE.loaded) {
        return;
    }
    // Use process.cwd() instead of __dirname to work in both Lambda and test environments
    const contentDir = path_1.default.join(process.cwd(), 'content');
    try {
        // Load all course definitions
        const coursesDir = path_1.default.join(contentDir, 'courses');
        if (fs_1.default.existsSync(coursesDir)) {
            const courseFiles = fs_1.default.readdirSync(coursesDir).filter(f => f.endsWith('.json'));
            for (const file of courseFiles) {
                try {
                    const filePath = path_1.default.join(coursesDir, file);
                    const course = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
                    if (course.slug && Array.isArray(course.modules)) {
                        METADATA_CACHE.courses.set(course.slug, {
                            slug: course.slug,
                            modules: course.modules,
                            ...(typeof course.title === 'string' ? { title: course.title } : {}),
                        });
                    }
                }
                catch (err) {
                    console.warn(`Failed to load course metadata from ${file}:`, err);
                }
            }
        }
        // Load all pathway definitions
        const pathwaysDir = path_1.default.join(contentDir, 'pathways');
        if (fs_1.default.existsSync(pathwaysDir)) {
            const pathwayFiles = fs_1.default.readdirSync(pathwaysDir).filter(f => f.endsWith('.json'));
            for (const file of pathwayFiles) {
                try {
                    const filePath = path_1.default.join(pathwaysDir, file);
                    const pathway = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
                    if (pathway.slug && Array.isArray(pathway.courses)) {
                        METADATA_CACHE.pathways.set(pathway.slug, {
                            slug: pathway.slug,
                            courses: pathway.courses,
                            ...(typeof pathway.title === 'string' ? { title: pathway.title } : {}),
                        });
                    }
                }
                catch (err) {
                    console.warn(`Failed to load pathway metadata from ${file}:`, err);
                }
            }
        }
        if (METADATA_CACHE.courses.size === 0 && METADATA_CACHE.pathways.size === 0) {
            console.warn('[Completion] Filesystem metadata missing at runtime; using compiled fallback metadata');
            for (const course of FALLBACK_COURSE_METADATA) {
                METADATA_CACHE.courses.set(course.slug, {
                    slug: course.slug,
                    modules: course.modules,
                    title: course.title,
                });
            }
            for (const pathway of FALLBACK_PATHWAY_METADATA) {
                METADATA_CACHE.pathways.set(pathway.slug, {
                    slug: pathway.slug,
                    courses: pathway.courses,
                    title: pathway.title,
                });
            }
        }
        METADATA_CACHE.loaded = true;
        console.log(`[Completion] Metadata loaded: ${METADATA_CACHE.courses.size} courses, ${METADATA_CACHE.pathways.size} pathways`);
    }
    catch (err) {
        console.error('[Completion] Failed to load metadata cache:', err);
        // Mark as loaded even on failure to avoid retry loops
        METADATA_CACHE.loaded = true;
    }
}
/**
 * Get course metadata from cache.
 * Returns undefined if course not found.
 */
function getCourseMetadata(courseSlug) {
    return METADATA_CACHE.courses.get(courseSlug);
}
/**
 * Get pathway metadata from cache.
 * Returns undefined if pathway not found.
 */
function getPathwayMetadata(pathwaySlug) {
    return METADATA_CACHE.pathways.get(pathwaySlug);
}
/**
 * Iterate all cached courses. Additive accessor for Issue #451;
 * used by the shadow module-progress handler for breadcrumb resolution.
 * Callers receive an alphabetically-sorted slug list for deterministic first-match.
 */
function listAllCourseSlugs() {
    return Array.from(METADATA_CACHE.courses.keys()).sort();
}
/**
 * Iterate all cached pathways. Additive accessor for Issue #451.
 */
function listAllPathwaySlugs() {
    return Array.from(METADATA_CACHE.pathways.keys()).sort();
}
// ============================================================================
// Completion Calculation
// ============================================================================
/**
 * Calculate course completion based on metadata.
 *
 * Decision: All modules in definition are required (no optional modules yet)
 *
 * @param courseSlug - Course identifier
 * @param modules - Module progress state (may be partial)
 * @returns Completion status and progress counts
 */
function calculateCourseCompletion(courseSlug, modules) {
    const courseMeta = METADATA_CACHE.courses.get(courseSlug);
    if (!courseMeta) {
        console.warn(`[Completion] Course metadata not found: ${courseSlug}`);
        return {
            completed: false,
            progress: { completed: 0, total: 0 }
        };
    }
    // All modules in definition are required
    const requiredModules = courseMeta.modules;
    if (requiredModules.length === 0) {
        // Empty course - never complete
        return {
            completed: false,
            progress: { completed: 0, total: 0 }
        };
    }
    // Count completed modules
    const completedModules = requiredModules.filter(slug => modules[slug]?.completed === true);
    const completed = completedModules.length === requiredModules.length;
    return {
        completed,
        progress: {
            completed: completedModules.length,
            total: requiredModules.length
        }
    };
}
/**
 * Calculate pathway completion based on metadata.
 *
 * Decision: All courses in definition are required (no optional courses yet)
 *
 * @param pathwaySlug - Pathway identifier
 * @param courses - Course progress state (may be partial)
 * @returns Completion status and progress counts
 */
function calculatePathwayCompletion(pathwaySlug, courses) {
    const pathwayMeta = METADATA_CACHE.pathways.get(pathwaySlug);
    if (!pathwayMeta) {
        console.warn(`[Completion] Pathway metadata not found: ${pathwaySlug}`);
        return {
            completed: false,
            progress: { completed: 0, total: 0 }
        };
    }
    // All courses in definition are required
    const requiredCourses = pathwayMeta.courses;
    if (requiredCourses.length === 0) {
        // Empty pathway - never complete
        return {
            completed: false,
            progress: { completed: 0, total: 0 }
        };
    }
    // Count completed courses
    const completedCourses = requiredCourses.filter(slug => courses[slug]?.completed === true);
    const completed = completedCourses.length === requiredCourses.length;
    return {
        completed,
        progress: {
            completed: completedCourses.length,
            total: requiredCourses.length
        }
    };
}
// ============================================================================
// Explicit Completion Validation
// ============================================================================
/**
 * Validate explicit completion event against actual progress.
 *
 * Decision: Strict validation - reject events that don't match reality
 *
 * @param type - Type of completion (course or pathway)
 * @param slug - Course or pathway identifier
 * @param progressData - Current progress state
 * @returns Validation result with reason if invalid
 */
function validateExplicitCompletion(type, slug, progressData) {
    if (type === 'course') {
        const result = calculateCourseCompletion(slug, progressData.modules || {});
        if (!result.completed) {
            return {
                valid: false,
                reason: `Course not actually complete: ${result.progress.completed}/${result.progress.total} modules completed`
            };
        }
    }
    else {
        const result = calculatePathwayCompletion(slug, progressData.courses || {});
        if (!result.completed) {
            return {
                valid: false,
                reason: `Pathway not actually complete: ${result.progress.completed}/${result.progress.total} courses completed`
            };
        }
    }
    return { valid: true };
}
/**
 * Validate explicit completion timestamp against inferred completion time.
 *
 * Decision: Accept if within ±5 minutes of last child completion
 *
 * @param explicitTimestamp - Timestamp from explicit completion event
 * @param inferredTimestamp - Latest child completion timestamp
 * @returns True if timestamps are close enough
 */
function validateCompletionTimestamp(explicitTimestamp, inferredTimestamp) {
    const explicitTime = new Date(explicitTimestamp).getTime();
    const inferredTime = new Date(inferredTimestamp).getTime();
    const differenceMs = Math.abs(explicitTime - inferredTime);
    const fiveMinutesMs = 5 * 60 * 1000;
    return differenceMs <= fiveMinutesMs;
}
// ============================================================================
// Initialization
// ============================================================================
// Load metadata at module initialization (Lambda cold start)
loadMetadataCache();
