#!/usr/bin/env node
/*
 Fast public verification for detail pages to catch regressions:
 - First course detail contains at least one /learn/modules/ link
 - First pathway detail contains at least one /learn/courses/ link
 - First module detail contains non-trivial body (not title-only)
 Exits non-zero on failure so CI can fail fast.
*/

async function fetchText(url, opts={}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

function firstHref(html, pattern) {
  const re = new RegExp(`href="(${pattern}[^"]+)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

async function main() {
  const BASE = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
  const SMOKE_MODULE = process.env.SMOKE_MODULE_URL || `${BASE}/learn/modules/accessing-the-hedgehog-virtual-lab-with-google-cloud?hsLang=en-us`;
  const SMOKE_COURSE = process.env.SMOKE_COURSE_URL || `${BASE}/learn/courses/course-authoring-101?hsLang=en-us`;
  const SMOKE_PATHWAY = process.env.SMOKE_PATHWAY_URL || `${BASE}/learn/pathways/course-authoring-expert?hsLang=en-us`;
  const errors = [];

  try {
    // 1) Course detail should list modules (use smoke URL)
    const courseHtml = await fetchText(SMOKE_COURSE);
    const hasModuleCard = /href="\/learn\/modules\//i.test(courseHtml);
    if (!hasModuleCard) errors.push(`Course detail missing module links: ${SMOKE_COURSE}`);

    // 2) Pathway detail should show course cards (use smoke URL)
    const pathwayHtml = await fetchText(SMOKE_PATHWAY);
    const hasCourseCard = /href="\/learn\/courses\//i.test(pathwayHtml);
    if (!hasCourseCard) errors.push(`Pathway detail missing course links: ${SMOKE_PATHWAY}`);

    // 3) Module detail should render body content (use smoke URL)
    const moduleHtml = await fetchText(SMOKE_MODULE);
    const m = moduleHtml.match(/<div class="module-content">([\s\S]*?)<\/div>/i);
    const body = m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
    if (body.length < 20) errors.push(`Module detail has too little content (${body.length} chars): ${SMOKE_MODULE}`);
  } catch (e) {
    errors.push(e.message || String(e));
  }

  if (errors.length) {
    console.error('❌ Detail verification failed:');
    for (const err of errors) console.error(' -', err);
    process.exit(1);
  } else {
    console.log('✅ Detail verification passed');
  }
}

main();
