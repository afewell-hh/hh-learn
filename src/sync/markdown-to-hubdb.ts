#!/usr/bin/env ts-node
/**
 * Sync learning modules from Git (markdown) to HubDB
 *
 * This script:
 * 1. Reads all modules from content/modules/
 * 2. Parses markdown + frontmatter
 * 3. Converts to HTML
 * 4. Upserts to HubDB table
 * 5. Publishes table
 *
 * Usage: npm run sync:content
 */

import 'dotenv/config'; // Load .env file
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import matter from 'gray-matter';
import { Client } from '@hubspot/api-client';

// ES module compatibility: get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure marked for better code block handling
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: false,
});

const hubspot = new Client({
  accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN
});

const TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID;

interface ModuleFrontmatter {
  title: string;
  slug: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_minutes: number;
  version?: string;
  validated_on?: string;
  tags: string[];
  description: string;
  order?: number;
}

async function syncModules() {
  console.log('🔄 Starting module sync to HubDB...\n');

  if (!TABLE_ID) {
    throw new Error('HUBDB_MODULES_TABLE_ID environment variable not set');
  }

  const modulesDir = join(__dirname, '../../content/modules');
  const moduleDirs = await readdir(modulesDir, { withFileTypes: true });
  const modules = moduleDirs.filter(d => d.isDirectory()).map(d => d.name);

  console.log(`Found ${modules.length} modules to sync:\n`);

  for (const moduleSlug of modules) {
    try {
      // Read README.md
      const readmePath = join(modulesDir, moduleSlug, 'README.md');
      const fileContent = await readFile(readmePath, 'utf-8');

      // Parse frontmatter + markdown content
      const { data: frontmatter, content: markdown } = matter(fileContent);
      const fm = frontmatter as ModuleFrontmatter;

      // Convert markdown to HTML
      const html = await marked(markdown);

      // Prepare HubDB row
      const row = {
        path: fm.slug || moduleSlug, // Use slug as row ID for easy updates
        values: {
          title: fm.title,
          slug: fm.slug || moduleSlug,
          description: fm.description || '',
          difficulty: fm.difficulty || 'beginner',
          estimated_minutes: fm.estimated_minutes || 30,
          tags: Array.isArray(fm.tags) ? fm.tags.join(',') : '',
          full_content: html,
          display_order: fm.order || 999
        }
      };

      // Try to update existing row, create if doesn't exist
      try {
        await hubspot.cms.hubdb.rowsApi.updateDraftTableRow(
          TABLE_ID,
          row.path,
          row as any
        );
        console.log(`  ✓ Updated: ${fm.title}`);
      } catch (updateErr: any) {
        if (updateErr.code === 404) {
          // Row doesn't exist, create it
          await hubspot.cms.hubdb.rowsApi.createTableRow(
            TABLE_ID,
            row as any
          );
          console.log(`  ✓ Created: ${fm.title}`);
        } else {
          throw updateErr;
        }
      }

    } catch (err) {
      console.error(`  ✗ Failed to sync ${moduleSlug}:`, err);
    }
  }

  // Publish table
  console.log('\n📤 Publishing HubDB table...');
  await hubspot.cms.hubdb.tablesApi.publishDraftTable(TABLE_ID);
  console.log('✅ Sync complete! Table published.\n');
}

// Run sync
syncModules().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
