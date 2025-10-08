#!/usr/bin/env node
import { execSync } from 'node:child_process';

const base = process.env.GITHUB_BASE_REF || process.env.GITHUB_REF_NAME || 'origin/main';
const head = process.env.GITHUB_SHA || 'HEAD';

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

// Ensure we have base
try { sh(`git fetch --no-tags --depth=1 origin +${base}:${base}`); } catch {}

const diff = sh(`git diff --name-only ${base}...${head}`).split('\n').filter(Boolean);
const impactGlobs = [
  /^content\/modules\//,
  /^clean-x-hedgehog-templates\//,
  /^src\/sync\//
];
const docsFiles = [
  'docs/course-authoring.md',
  'docs/project-management.md',
];

const impacted = diff.some(f => impactGlobs.some(rx => rx.test(f)));
const docsTouched = diff.some(f => docsFiles.includes(f));

const prTitle = (process.env.PR_TITLE || '').toLowerCase();
const prBody = (process.env.PR_BODY || '').toLowerCase();
const skip = prTitle.includes('[skip-docs-check]') || prBody.includes('[skip-docs-check]');

if (impacted && !docsTouched && !skip) {
  console.error('✗ Docs check failed: content-affecting changes detected but docs were not updated.');
  console.error('  Touch one of:', docsFiles.join(', '));
  console.error('  Or add [skip-docs-check] in PR title/body, or apply the docs-exempt label.');
  process.exit(1);
} else {
  console.log('✓ Docs check passed');
}

