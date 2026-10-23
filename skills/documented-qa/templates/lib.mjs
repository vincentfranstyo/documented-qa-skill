// Shared recorder: highlight overlay, numbered captions, PASS/FAIL checks, screenshots, video, step log.
// Secrets come from env only (QA_GATE_USER/QA_GATE_PW for an HTTP basic-auth gate); never written or logged.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const APP = process.env.QA_APP_URL ?? 'https://staging.example.com';

const gate = process.env.QA_GATE_PW ? { username: process.env.QA_GATE_USER ?? '', password: process.env.QA_GATE_PW } : undefined;

// Overlay drawn in the page: red box on the element + caption bar. Survives navigation via initScript.
const OVERLAY = () => {
  // Never let a password reach a frame: some admin UIs show passwords in plain text inputs.
  const mask = () => {
    if (document.getElementById('__mask')) return;
    const s = document.createElement('style'); s.id = '__mask';
    s.textContent = 'input[type="password"],input[name*="password" i],input[name*="pass" i]{-webkit-text-security:disc!important;color:transparent!important;text-shadow:0 0 0 #555!important}';
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mask); else mask();
  window.__hl = (rect, caption) => {
    document.querySelectorAll('.__hl').forEach((e) => e.remove());
    const mk = (css) => { const d = document.createElement('div'); d.className = '__hl'; d.style.cssText = css; document.documentElement.appendChild(d); return d; };
    if (rect) mk(`position:fixed;z-index:2147483647;pointer-events:none;left:${rect.x - 6}px;top:${rect.y - 6}px;width:${rect.width + 12}px;height:${rect.height + 12}px;border:4px solid #ff2d55;border-radius:8px;box-shadow:0 0 0 6px rgba(255,45,85,.25);`);
    if (caption) { const c = mk('position:fixed;z-index:2147483647;pointer-events:none;left:0;right:0;bottom:0;padding:14px 22px;background:rgba(15,23,42,.92);color:#fff;font:600 20px/1.35 Inter,system-ui,sans-serif;'); c.textContent = caption; }
  };
  window.__hlClear = () => document.querySelectorAll('.__hl').forEach((e) => e.remove());
};

export async function session(name, { video = true, storage } = {}) {
  const browser = await chromium.launch({ headless: !process.env.HEADED });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    httpCredentials: gate,
    storageState: storage,
    recordVideo: video ? { dir: path.join(ROOT, 'raw', name), size: { width: 1440, height: 900 } } : undefined,
  });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const log = [];
  let n = 0;
  const t0 = Date.now();
  const stamp = () => new Date(Date.now() - t0).toISOString().slice(14, 19);

  // Highlight a locator (optional), caption it, screenshot, then run the action.
  async function step(caption, locator, action, { hold = 1400, shot = true } = {}) {
    n += 1;
    let rect = null;
    if (locator) {
      await locator.first().scrollIntoViewIfNeeded();
      rect = await locator.first().boundingBox();
    }
    await page.evaluate(([r, c]) => window.__hl?.(r, c), [rect, `${n}. ${caption}`]).catch(() => {});
    await page.waitForTimeout(hold);
    const file = shot ? path.join('shots', name, `${String(n).padStart(2, '0')}.png`) : null;
    if (file) { fs.mkdirSync(path.join(ROOT, 'shots', name), { recursive: true }); await page.screenshot({ path: path.join(ROOT, file) }); }
    log.push({ n, at: stamp(), caption, shot: file });
    if (action) await action(locator?.first());
    await page.evaluate(() => window.__hlClear?.()).catch(() => {});
  }
  // A check: caption the expected result, highlight where it shows, record pass/fail.
  async function expect(caption, locator, { timeout = 20000, label } = {}) {
    let ok = true;
    try { await locator.first().waitFor({ state: 'visible', timeout }); } catch { ok = false; }
    await step(`${label && ok ? label : ok ? 'PASS' : 'FAIL'} - ${caption}`, ok ? locator : null, null, { hold: 2000 });
    log[log.length - 1].result = label && ok ? label.toLowerCase() : ok ? 'pass' : 'fail';
    return ok;
  }
  async function close() {
    const vid = page.video();
    await ctx.close(); await browser.close();
    const raw = vid ? await vid.path() : null;
    fs.mkdirSync(path.join(ROOT, 'raw'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'raw', `${name}.json`), JSON.stringify({ name, raw, log }, null, 2));
    return { raw, log };
  }
  return { page, ctx, step, expect, close };
}
