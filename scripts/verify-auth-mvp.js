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

  const courses = await get('https://hedgehog.cloud/learn/courses');
  const coursesOK = /<a\s+href=\"\/learn\/courses[^\"]*\"[^>]*aria-current=\"page\"/.test(courses);
  log(`Courses active aria-current present: ${coursesOK}`);

  const pathways = await get('https://hedgehog.cloud/learn/pathways');
  const pathwaysOK = /<a\s+href=\"\/learn\/pathways[^\"]*\"[^>]*aria-current=\"page\"/.test(pathways);
  log(`Pathways active aria-current present: ${pathwaysOK}`);

  const catalog = await get('https://hedgehog.cloud/learn');
  const loginCatalogOK = /\/\\?_hcms\/mem\/login\?redirect_url=/.test(catalog);
  log(`Catalog Sign In uses membership URL: ${loginCatalogOK}`);

  // 4) My Learning: either meta refresh present OR 302 to membership login with redirect_url
  const myHtml = await get('https://hedgehog.cloud/learn/my-learning');
  const myMetaOK = /http-equiv=\"refresh\"[^>]*\/\\?_hcms\/mem\/login\?redirect_url=/.test(myHtml);
  let myRedirectOK = false;
  try {
    const myRes = await getNoFollow('https://hedgehog.cloud/learn/my-learning');
    const loc = myRes.headers.get('location') || '';
    myRedirectOK = myRes.status >= 300 && myRes.status < 400 && (/\/_hcms\/mem\/login\?redirect_url=/.test(loc) || /\/\\?_hcms\/mem\/login\?redirect_url=/.test(loc));
  } catch {}
  log(`My Learning anonymous redirect present: ${myMetaOK || myRedirectOK}`);

  const file = 'verification-output/issue-auth-mvp.txt';
  writeFileSync(file, out.join('\n') + '\n');
  console.log(`\nWrote verification to ${file}`);
})();
