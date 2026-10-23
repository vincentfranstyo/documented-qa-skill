// Example run: sign in, open a page, check two expected results.
// QA_APP_URL=https://staging.example.com QA_USER=qa@example.com QA_PW='…' node example-login.mjs
import { session, APP } from './lib.mjs';

if (!process.env.QA_PW) throw new Error('QA_PW not set');
const { page, step, expect, close } = await session('C1-login');

await step('Sign in (password hidden)', null, async () => {
  await page.goto(`${APP}/login`);
  await page.fill('input[type="email"]', process.env.QA_USER);
  await page.fill('input[type="password"]', process.env.QA_PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
});
const nav = page.getByRole('link', { name: 'Dashboard' });
await step('Step 2: open Dashboard', nav, (l) => l.click());
await expect('Dashboard heading shows', page.getByRole('heading', { name: /Dashboard/ }));
await expect('Signed-in user shown', page.getByText(process.env.QA_USER));

const r = await close();
console.log(JSON.stringify(r.log.filter((x) => x.result).map((x) => x.caption)));
