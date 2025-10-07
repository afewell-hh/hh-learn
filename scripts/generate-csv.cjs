#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const modulesDir = path.join(__dirname, '../content/modules');
const modules = fs.readdirSync(modulesDir).filter(f =>
  fs.statSync(path.join(modulesDir, f)).isDirectory()
);

// CSV header
const rows = ['name,title,slug,description,difficulty,estimated_minutes,tags,full_content,display_order'];

const difficultyMap = {
  'beginner': '1',
  'intermediate': '2',
  'advanced': '3'
};

modules.forEach((moduleSlug, index) => {
  const readmePath = path.join(modulesDir, moduleSlug, 'README.md');
  const content = fs.readFileSync(readmePath, 'utf-8');
  const { data, content: markdown } = matter(content);

  const html = marked.parse(markdown);

  // Escape CSV fields (quote and escape double quotes)
  const escape = (val) => {
    if (!val) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const row = [
    escape(data.slug || moduleSlug),           // name (path)
    escape(data.title),                        // title
    escape(data.slug || moduleSlug),           // slug
    escape(data.description || ''),            // description
    difficultyMap[data.difficulty] || '1',     // difficulty (option ID)
    data.estimated_minutes || 30,              // estimated_minutes
    escape(Array.isArray(data.tags) ? data.tags.join(',') : ''),  // tags
    escape(html),                              // full_content
    data.order || (index + 1)                  // display_order
  ];

  rows.push(row.join(','));
});

console.log(rows.join('\n'));
