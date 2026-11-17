// Step-by-step PDF guide from the same recording as the film: per step what to press (log `todo`),
// why (log `explain`) and the screenshot. Each section() starts a new page.
// node guide.mjs "<title>" <run> [<run> ...]  → guides/<first run>.pdf
// Starts straight at the steps; put accounts or prerequisites in an optional HEAD=<html file>.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const [title, ...runs] = process.argv.slice(2);
if (!runs.length) throw new Error('usage: node guide.mjs "<title>" <run> [<run> ...]');
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

let body = process.env.HEAD ? fs.readFileSync(process.env.HEAD, 'utf8') : '';
let sec;
for (const run of runs) {
  const { log } = JSON.parse(fs.readFileSync(path.join(ROOT, 'raw', `${run}.json`), 'utf8'));
  for (const s of log) {
    if (s.section !== sec) {
      sec = s.section;
      body += `<section class="chapter"><h2>${esc(sec)}</h2></section>`;
    }
    const shot = s.shot ? `<img src="file://${path.join(ROOT, s.shot)}">` : '';
    body += `<article class="step"><h3><span class="n">${s.n}</span> ${esc(s.caption)}</h3>
      ${s.todo ? `<p class="do">${s.todo}</p>` : ''}${s.explain ? `<p class="why">${esc(s.explain)}</p>` : ''}${shot}</article>`;
  }
}

const html = `<!doctype html><html><meta charset="utf-8"><style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  body { font: 10.5pt/1.45 system-ui, sans-serif; color: #1a2330; }
  h2 { font-size: 15pt; margin: 0 0 2mm; color: #0f4c5c; }
  .chapter { break-before: page; border-bottom: 2px solid #0f4c5c; margin-bottom: 4mm; }
  .chapter:first-of-type { break-before: auto; }
  .step { break-inside: avoid; margin: 0 0 3mm; padding: 2.5mm 4mm; border: 1px solid #d5dbe3; border-radius: 6px; }
  h3 { font-size: 11pt; margin: 0 0 1.5mm; } .n { display: inline-block; min-width: 7mm; color: #0f4c5c; }
  .do { margin: 0 0 1mm; } .why { margin: 0 0 2mm; color: #5b6676; font-size: 9.5pt; }
  img { display: block; max-width: 78%; max-height: 110mm; margin: 0 auto; border: 1px solid #d5dbe3; border-radius: 4px; }
  table { border-collapse: collapse; margin: 2mm 0 4mm; } td, th { border: 1px solid #d5dbe3; padding: 1.5mm 3mm; text-align: left; }
</style><body>${body}</body></html>`;

fs.mkdirSync(path.join(ROOT, 'guides'), { recursive: true });
const htmlPath = path.join(ROOT, 'guides', `${runs[0]}.html`);
fs.writeFileSync(htmlPath, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`);
const pdf = path.join(ROOT, 'guides', `${runs[0]}.pdf`);
await page.pdf({
  path: pdf, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: `<div style="font-size:8pt;width:100%;text-align:center;color:#5b6676">${esc(title)} · <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
});
await browser.close();
console.log(`guide: ${pdf}`);
