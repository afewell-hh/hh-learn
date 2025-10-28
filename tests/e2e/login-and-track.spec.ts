import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { loginViaMembership } from '../helpers/auth';

const MODULE_URL = process.env.MODULE_URL || 'https://hedgehog.cloud/learn/accessing-the-hedgehog-virtual-lab-with-google-cloud';

test('login and send track events', async ({ page, context }) => {
  const username = process.env.HUBSPOT_TEST_USERNAME as string;
  const password = process.env.HUBSPOT_TEST_PASSWORD as string;
  const hubspotToken = process.env.HUBSPOT_API_TOKEN as string | undefined;
  test.skip(!username || !password, 'Test creds not provided');

  // Start at login with redirect back to the module
  await loginViaMembership(page, {
    loginUrl: `${process.env.E2E_BASE_URL || 'https://hedgehog.cloud'}/_hcms/mem/login?redirect_url=${encodeURIComponent(MODULE_URL)}`,
    email: username,
    password,
    expectRedirectContains: MODULE_URL.replace(/^https?:\/\//, '')
  });

  // Ensure we land on the module URL explicitly (handle intermediate landing page)
  if (page.url() !== MODULE_URL) {
    await page.goto(MODULE_URL, { waitUntil: 'domcontentloaded' });
  }

  // Enable lightweight debug in localStorage
  await page.evaluate(() => localStorage.setItem('HHL_DEBUG', 'true'));

  // Surface console logs for debugging
  page.on('console', (msg) => {
    if (msg.text().includes('[hhl]')) {
      // eslint-disable-next-line no-console
      console.log(msg.text());
    }
  });

  // Intercept /events/track
  const events: any[] = [];
  page.on('request', req => {
    if (req.url().includes('/events/track') && req.method() === 'POST') {
      events.push({ url: req.url(), postData: req.postData() });
      (page as any).evaluate((n) => { (window as any).__eventsSeen = n; }, events.length).catch(() => {});
    }
  });

  // Click Mark as started and assert one response
  const startedBtn = page.locator('#hhl-mark-started');
  await startedBtn.waitFor({ state: 'visible', timeout: 45000 });
  // Capture baseline before click if verifying via HubSpot
  let baselineUpdatedAt: string | undefined;
  if (hubspotToken) {
    baselineUpdatedAt = await getContactUpdatedAt(hubspotToken, username);
  }
  await startedBtn.click();
  await page.waitForFunction(() => (window as any).__eventsSeen > 0, null, { timeout: 15000 }).catch(() => {});

  // Click Mark complete
  const completeBtn = page.locator('#hhl-mark-complete');
  if (await completeBtn.isVisible()) {
    const before = events.length;
    await completeBtn.click();
    await page.waitForFunction((b: number) => ((window as any).__eventsSeen || 0) > b, events.length, { timeout: 15000 }).catch(() => {});
  }

  // At least one POST should have been made
  expect(events.length).toBeGreaterThan(0);

  // Ensure at least one beacon was sent
  expect(events.length).toBeGreaterThan(0);

  // Optional: verify contact properties updated in HubSpot (if HUBSPOT_API_TOKEN provided)
  if (hubspotToken) {
    const ok = await waitForProgressUpdate(hubspotToken, username, baselineUpdatedAt, 60000);
    expect(ok).toBeTruthy();
  }
});

// --- HubSpot verification helpers ---
async function getContactId(token: string, email: string): Promise<string | null> {
  const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }], limit: 1 })
  });
  if (!resp.ok) return null;
  const json: any = await resp.json();
  return json.results?.[0]?.id || null;
}

async function getContactUpdatedAt(token: string, email: string): Promise<string | undefined> {
  const id = await getContactId(token, email);
  if (!id) return undefined;
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/${id}?properties=hhl_progress_updated_at,hhl_progress_state`;
  const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!resp.ok) return undefined;
  const json: any = await resp.json();
  return json.properties?.hhl_progress_updated_at as string | undefined;
}

async function waitForProgressUpdate(token: string, email: string, baseline?: string, timeoutMs = 60000): Promise<boolean> {
  const start = Date.now();
  let last: string | undefined;
  while (Date.now() - start < timeoutMs) {
    last = await getContactUpdatedAt(token, email);
    if (!baseline && last) return true; // any value is an update when no baseline
    if (baseline && last && new Date(last).getTime() > new Date(baseline).getTime()) return true;
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}
