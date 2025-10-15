#!/usr/bin/env ts-node
// Simple external verification that public pages reflect expected Auth MVP behavior.

import { writeFileSync } from 'fs';

async function get(url: string){
  const res = await fetch(url);
  const text = await res.text();
  return text;
}

function find(text: string, rx: RegExp){
  const m = text.match(rx);
  return !!m;
}

async function main(){
  const out: string[] = [];
  function log(line: string){ out.push(line); console.log(line); }

  log('Auth MVP Live Verification');
  log(`Timestamp: ${new Date().toISOString()}`);

  // 1) Courses active tab evidence
  const courses = await get('https://hedgehog.cloud/learn/courses');
  const coursesOK = find(courses, /aria-current="page"[^\n]*Courses/);
  log(`Courses active aria-current present: ${coursesOK}`);

  // 2) Pathways active tab evidence
  const pathways = await get('https://hedgehog.cloud/learn/pathways');
  const pathwaysOK = find(pathways, /aria-current="page"[^\n]*Pathways/);
  log(`Pathways active aria-current present: ${pathwaysOK}`);

  // 3) Login fallback on catalog
  const catalog = await get('https://hedgehog.cloud/learn');
  const loginCatalogOK = /\/_hcms\/mem\/login\?redirect_url=/.test(catalog);
  log(`Catalog Sign In uses membership URL: ${loginCatalogOK}`);

  // 4) My Learning meta refresh to membership login
  const myLearning = await get('https://hedgehog.cloud/learn/my-learning');
  const myLearningRedirectOK = /http-equiv="refresh"[^>]*\/_hcms\/mem\/login\?redirect_url=/.test(myLearning);
  log(`My Learning anonymous redirect present: ${myLearningRedirectOK}`);

  const file = 'verification-output/issue-auth-mvp.txt';
  writeFileSync(file, out.join('\n') + '\n');
  console.log(`\nWrote verification to ${file}`);
}

main().catch(err => { console.error(err); process.exit(1); });

