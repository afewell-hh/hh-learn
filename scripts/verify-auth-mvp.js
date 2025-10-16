#!/usr/bin/env node
const { writeFileSync } = require('fs');

async function get(url){
  const res = await fetch(url);
  return await res.text();
}

async function getNoFollow(url){
  const res = await fetch(url, { redirect: 'manual' });
  return res;
}

(async () => {
  const out = [];
  const log = s => { console.log(s); out.push(s); };
  log('Auth MVP Live Verification');
  log(`Timestamp: ${new Date().toISOString()}`);

  // Helper to validate left-nav auth links for a given URL
  async function checkLeftNavAuth(url) {
    const html = await get(url);
    // Expect Register link in left-nav auth section
    const hasRegister = /<a[^>]+href=\"\/learn\/register(?:\?[^\"]*)?\"[^>]*class=\"[^\"]*learn-auth-link/.test(html);
    // Expect Sign In with membership login + redirect_url back to the same path (including query)
    const u = new URL(url);
    const pathAndQuery = u.pathname + (u.search || '');
    const encoded = encodeURIComponent(pathAndQuery);
    const encSafe = encoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const signInRegex = new RegExp(
      String.raw`<a[^>]+href=\"\/_hcms\/mem\/login\?redirect_url=${encSafe}(?:(?:&|&amp;)[^\"]*)?\"[^>]*class=\"[^\"]*learn-auth-link`,
      'i'
    );
    const hasSignIn = signInRegex.test(html);
    return { hasRegister, hasSignIn };
  }

  // 1) Active state checks for Courses and Pathways
  const coursesHtml = await get('https://hedgehog.cloud/learn/courses');
  const coursesOK = /<a\s+href=\"\/learn\/courses[^\"]*\"[^>]*aria-current=\"page\"/.test(coursesHtml);
  log(`Courses active aria-current present: ${coursesOK}`);

  const pathwaysHtml = await get('https://hedgehog.cloud/learn/pathways');
  const pathwaysOK = /<a\s+href=\"\/learn\/pathways[^\"]*\"[^>]*aria-current=\"page\"/.test(pathwaysHtml);
  log(`Pathways active aria-current present: ${pathwaysOK}`);

  // 2) Left-nav auth links render for anonymous users and preserve return URL (including query)
  const { hasRegister: regCourses, hasSignIn: signInCourses } = await checkLeftNavAuth('https://hedgehog.cloud/learn/courses?debug=1');
  log(`Courses left-nav Register link present: ${regCourses}`);
  log(`Courses left-nav Sign In preserves redirect_url: ${signInCourses}`);

  const { hasRegister: regPathways, hasSignIn: signInPathways } = await checkLeftNavAuth('https://hedgehog.cloud/learn/pathways?debug=1');
  log(`Pathways left-nav Register link present: ${regPathways}`);
  log(`Pathways left-nav Sign In preserves redirect_url: ${signInPathways}`);

  // 3) Catalog page should include a membership Sign In link somewhere (left-nav or header)
  const catalog = await get('https://hedgehog.cloud/learn');
  const loginCatalogOK = /\/_hcms\/mem\/login\?redirect_url=/.test(catalog);
  log(`Catalog Sign In uses membership URL: ${loginCatalogOK}`);

  // 4) My Learning: either meta refresh present OR 302 to membership login with redirect_url
  const myHtml = await get('https://hedgehog.cloud/learn/my-learning');
  const myMetaOK = /http-equiv=\"refresh\"[^>]*\/_hcms\/mem\/login\?redirect_url=/.test(myHtml);
  let myRedirectOK = false;
  try {
    const myRes = await getNoFollow('https://hedgehog.cloud/learn/my-learning');
    const loc = myRes.headers.get('location') || '';
    myRedirectOK = myRes.status >= 300 && myRes.status < 400 && (/\/_hcms\/mem\/login\?redirect_url=/.test(loc));
  } catch {}
  log(`My Learning anonymous redirect present: ${myMetaOK || myRedirectOK}`);

  const file = 'verification-output/issue-auth-mvp.txt';
  writeFileSync(file, out.join('\n') + '\n');
  console.log(`\nWrote verification to ${file}`);
})();
