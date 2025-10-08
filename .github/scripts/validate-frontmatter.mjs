#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const modulesDir = 'content/modules';
const difficulties = new Set(['beginner', 'intermediate', 'advanced']);
let failed = false;

function err(msg) {
  console.error(`✗ ${msg}`);
  failed = true;
}

function validateModule(dir) {
  const readme = join(modulesDir, dir, 'README.md');
  const raw = readFileSync(readme, 'utf8');
  const { data } = matter(raw);
  const folderSlug = dir;

  const required = ['title', 'slug', 'difficulty', 'estimated_minutes', 'tags', 'description'];
  for (const k of required) {
    if (!(k in data)) err(`${dir}: missing front matter field '${k}'`);
  }

  if (data.slug && data.slug !== folderSlug) {
    err(`${dir}: slug '${data.slug}' should match folder name '${folderSlug}'`);
  }

  if (data.difficulty && !difficulties.has(String(data.difficulty))) {
    err(`${dir}: difficulty '${data.difficulty}' must be one of ${[...difficulties].join(', ')}`);
  }

  const est = Number(data.estimated_minutes);
  if (!Number.isFinite(est) || est <= 0) err(`${dir}: estimated_minutes must be a positive number`);

  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    err(`${dir}: tags must be a non-empty array`);
  }

  const desc = String(data.description || '');
  if (desc.length < 40 || desc.length > 200) {
    console.warn(`! ${dir}: description length ${desc.length} (recommended 80–160 chars)`);
  }
}

const dirs = readdirSync(modulesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
for (const dir of dirs) validateModule(dir);

if (failed) {
  console.error('\nFront matter validation failed. See errors above.');
  process.exit(1);
} else {
  console.log('✓ Front matter validation passed');
}

