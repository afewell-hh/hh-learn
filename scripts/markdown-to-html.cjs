#!/usr/bin/env node

/**
 * Convert module markdown to HTML for manual HubDB entry
 * Usage: node scripts/markdown-to-html.cjs <module-name>
 * Example: node scripts/markdown-to-html.cjs intro-to-kubernetes
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: false,
});

const moduleName = process.argv[2];

if (!moduleName) {
  console.error('Usage: node scripts/markdown-to-html.cjs <module-name>');
  console.error('Example: node scripts/markdown-to-html.cjs intro-to-kubernetes');
  process.exit(1);
}

const modulePath = path.join(__dirname, '../content/modules', moduleName, 'README.md');

if (!fs.existsSync(modulePath)) {
  console.error(`Module not found: ${modulePath}`);
  process.exit(1);
}

const fileContent = fs.readFileSync(modulePath, 'utf-8');
const { data: frontmatter, content: markdown } = matter(fileContent);

const html = marked.parse(markdown);

console.log('\n=== FRONTMATTER ===');
console.log(JSON.stringify(frontmatter, null, 2));

console.log('\n=== HTML (copy this to full_content field) ===\n');
console.log(html);

console.log('\n=== INSTRUCTIONS ===');
console.log('1. Copy the HTML above (between the === markers)');
console.log('2. Go to: Content > HubDB > learning_modules');
console.log('3. Edit the row for:', moduleName);
console.log('4. Paste into the "full_content" field');
console.log('5. Save and publish the table');
console.log('6. Refresh your page - markdown should now render as HTML!\n');
