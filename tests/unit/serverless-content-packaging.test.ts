/**
 * Packaging guard for the restored learner-progress routes (Issue #476).
 *
 * /course/status and /pathway/status resolve course/pathway metadata via
 * completion.ts loadMetadataCache(), which reads content/courses + content/pathways
 * from process.cwd()/content at runtime. The Lambda package excludes content/** by
 * default; #475 proved that exclusion makes both routes return handler 400
 * "not found" in production.
 *
 * This guard asserts serverless.yml re-includes ONLY those two metadata dirs
 * (after the broad content exclusion, so the re-include wins), and that the files
 * the handlers look up actually exist in the repo.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVERLESS_YML = path.join(REPO_ROOT, 'serverless.yml');

describe('Lambda packaging — learner-progress metadata (Issue #476)', () => {
  const yml = fs.readFileSync(SERVERLESS_YML, 'utf-8');

  const idxExclude = yml.indexOf("'!content/**'");
  const idxCourses = yml.indexOf("'content/courses/**'");
  const idxPathways = yml.indexOf("'content/pathways/**'");

  it('re-includes content/courses/** and content/pathways/** in the package patterns', () => {
    expect(idxCourses).toBeGreaterThan(-1);
    expect(idxPathways).toBeGreaterThan(-1);
  });

  it('re-includes them AFTER the broad !content/** exclusion (so the include wins)', () => {
    expect(idxExclude).toBeGreaterThan(-1);
    expect(idxCourses).toBeGreaterThan(idxExclude);
    expect(idxPathways).toBeGreaterThan(idxExclude);
  });

  it('does NOT broadly re-include all of content/** (keeps the fix minimal)', () => {
    // A bare content/** re-include after the exclusion would defeat minimization.
    expect(yml).not.toMatch(/^\s*-\s*'content\/\*\*'\s*$/m);
    // content/modules is intentionally not bundled (module titles come from HubDB).
    expect(yml).not.toMatch(/'content\/modules\/\*\*'/);
  });

  it('the course/pathway metadata files the handlers read exist in the repo', () => {
    const courses = fs.readdirSync(path.join(REPO_ROOT, 'content', 'courses')).filter(f => f.endsWith('.json'));
    const pathways = fs.readdirSync(path.join(REPO_ROOT, 'content', 'pathways')).filter(f => f.endsWith('.json'));
    expect(courses.length).toBeGreaterThan(0);
    expect(pathways.length).toBeGreaterThan(0);
    // The slugs exercised by the #475 authenticated harness must be present.
    expect(courses).toContain('network-like-hyperscaler-foundations.json');
    expect(pathways).toContain('network-like-hyperscaler.json');
  });
});
