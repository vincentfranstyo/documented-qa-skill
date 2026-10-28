// Build the documentation film from the recorder's step logs (raw/<run>.json + its .webm).
// One scene per run: a step rail on the left (the current step lit), the recording on the right; a run
// with several log sections (recorder section()) gets a card and a fresh rail per section,
// long waits cut out with a "skipped" marker. Usage: node build.mjs <title> <run> [<run> ...]
// ponytail: timings come from the log's mm:ss stamps (1 s resolution); fine for doc cuts.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = import.meta.dirname;
const RAW = path.resolve(HERE, '../raw');
// Each arg is <run>=<heading>; the heading names the QA case and step in words.
const [title, ...args] = process.argv.slice(2);
if (!args.length) throw new Error('usage: node build.mjs <title> <run>=<heading> [...]');
const runs = args.map((a) => a.split('=')[0]);
const heading = Object.fromEntries(args.map((a) => [a.split('=')[0], a.split('=').slice(1).join('=') || a]));

const MAX_HOLD = 9;    // longest stretch shown after a step before cutting ahead
const LEAD = 0.6;      // show a little before each step's caption appears
const TITLE = 4;       // seconds for each run's title card
const CARD = 2.5;      // seconds for a section card (new test case / step inside one run)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const secs = (at) => { const [m, s] = at.split(':').map(Number); return m * 60 + s; };
const fmt = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

fs.mkdirSync(path.join(HERE, 'assets'), { recursive: true });
// Scenes are generated: drop the previous film's, or `hyperframes check` flags their missing assets.
fs.rmSync(path.join(HERE, 'compositions'), { recursive: true, force: true });
fs.mkdirSync(path.join(HERE, 'compositions'), { recursive: true });

const scenes = [];
let filmT = 0;
for (const run of runs) {
  const log = JSON.parse(fs.readFileSync(path.join(RAW, `${run}.json`), 'utf8'));
  const src = log.raw; // the run's own video; a folder can hold leftovers of failed runs
  const mp4 = path.join(HERE, 'assets', `${run}.mp4`);
  if (!fs.existsSync(mp4) || fs.statSync(mp4).mtimeMs < fs.statSync(src).mtimeMs) {
    // Keyframe every second so seeking never freezes (overlays.md pitfall).
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '30', '-r', '30', '-an', mp4]);
  }
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString());

  // Cut list: from each step, play until the next step or MAX_HOLD, whichever is first.
  const steps = log.log.map((x) => ({ ...x, t: secs(x.at) }));
  const segs = [];
  steps.forEach((st, i) => {
    const from = Math.max(0, st.t - LEAD);
    const next = i + 1 < steps.length ? steps[i + 1].t - LEAD : dur;
    const to = Math.min(next, from + MAX_HOLD, dur);
    if (to - from > 0.3) segs.push({ from, to, step: i, skipped: next - to > 1 ? next - to : 0 });
  });

  const id = run.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Pages: consecutive steps sharing a log `section` (recorder's section()). Each new one gets its
  // own card and a fresh step list, so a different case or QC step starts on a clean slide.
  const pages = [];
  const pageOf = steps.map((st, i) => {
    const sec = st.section ?? '';
    if (!pages.length || pages.at(-1).sec !== sec) pages.push({ sec, steps: [], start: TITLE });
    pages.at(-1).steps.push(i);
    return pages.length - 1;
  });
  let t = TITLE;
  let pg = 0;
  const clips = [];
  const lit = [];
  for (const [k, sg] of segs.entries()) {
    if (pageOf[sg.step] !== pg) {
      pages[pg].end = t;
      pg = pageOf[sg.step];
      pages[pg].card = t;
      t += CARD;
      pages[pg].start = t;
    }
    const len = sg.to - sg.from;
    clips.push(`    <video id="${id}-v${k}" class="clip rec" src="assets/${run}.mp4" muted playsinline data-start="${t.toFixed(2)}" data-duration="${len.toFixed(2)}" data-media-start="${sg.from.toFixed(2)}" data-track-index="1"></video>`);
    lit.push({ step: sg.step, start: t, len });
    if (sg.skipped) clips.push(`    <div id="${id}-skip${k}" class="clip skip" data-start="${(t + len - 1.6).toFixed(2)}" data-duration="1.6" data-track-index="2"><span>⏩ ${fmt(sg.skipped)} skipped</span></div>`);
    t += len;
  }
  const total = t + 1.5;
  pages[pg].end = total;

  const li = steps.map((st, i) => {
    const res = st.result ? `<b class="res ${st.result}" data-layout-ignore>${esc(st.result.toUpperCase())}</b>` : '';
    const cap = esc(st.caption.replace(/^(PASS|FAIL|FOUND) - /, ''));
    const note = st.note ? `<small class="note">${esc(st.note)}</small>` : '';
    return `      <li id="${id}-s${i}"><span class="n">${i + 1}</span><span class="cap">${cap}${note}</span>${res}</li>`;
  });
  const tally = (ss) => {
    const n = (r) => ss.filter((s) => s.result === r).length;
    return `${ss.length} steps · ${n('pass')} pass · ${n('fail')} fail${n('script') ? ` · ${n('script')} script error (not the product)` : ''}`;
  };
  const shown = pages.map((p, i) => ({ ...p, i })).filter((p) => p.end !== undefined); // a page whose steps were all cut never shows
  const rails = shown.map((p) => `    <div id="${id}-rail${p.i}" class="clip rail" data-start="${p.start.toFixed(2)}" data-duration="${(p.end - p.start).toFixed(2)}" data-track-index="0">
      <h2>${esc(heading[run])}</h2>${p.sec ? `<div class="sec">${esc(p.sec)}</div>` : ''}
      <div class="list"><ol id="${id}-ol${p.i}" style="${p.steps.length > 12 ? 'font-size: 18px' : ''}">
${p.steps.map((i) => li[i]).join('\n')}
      </ol></div>
    </div>`).join('\n');
  const cards = shown.filter((p) => p.card !== undefined).map((p) => `    <div id="${id}-card${p.i}" class="clip card" data-start="${p.card.toFixed(2)}" data-duration="${CARD}" data-track-index="0">
      <div class="kicker">${esc(heading[run])}</div>
      <h1>${esc(p.sec || 'continued')}</h1>
      <div class="tally">${tally(p.steps.map((i) => steps[i]))}</div>
    </div>`).join('\n');

  // Long lists scroll: each lit step slides into the upper third of the list's window.
  const tl = lit.map((l) => `    tl.set("#${id}-s${l.step}", { className: "on" }, ${l.start.toFixed(2)});
    tl.to("#${id}-ol${pageOf[l.step]}", { y: () => follow("${id}", ${l.step}), duration: 0.4, ease: "power2.out" }, ${l.start.toFixed(2)});
    tl.set("#${id}-s${l.step}", { className: "done" }, ${(l.start + l.len - 0.02).toFixed(2)});`).join('\n');

  fs.writeFileSync(path.join(HERE, 'compositions', `${id}.html`), `<template>
  <style>
    #root { position: absolute; inset: 0; background: #ffffff; font-family: Inter, sans-serif; color: #1A2130; }
    #root .card { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 160px; background: #ffffff; z-index: 5; }
    #root .card .kicker { font-size: 30px; font-weight: 600; color: #2F45FF; }
    #root .card h1 { font-size: 84px; font-weight: 700; letter-spacing: -0.02em; margin-top: 18px; max-width: 1500px; }
    #root .card .tally { font-size: 32px; margin-top: 28px; color: #475569; }
    #root .rail { position: absolute; left: 0; top: 0; bottom: 0; width: 600px; padding: 48px 28px 40px 36px; border-right: 2px solid #E2E8F0; display: flex; flex-direction: column; }
    #root .rail .list { flex: 1; min-height: 0; overflow: hidden; margin-top: 26px; }
    #root .rail h2 { font-size: 30px; font-weight: 700; line-height: 1.2; }
    #root .rail .sec { font-size: 24px; font-weight: 600; color: #2F45FF; margin-top: 8px; }
    #root .rail ol { list-style: none; }
    #root .rail ol[style*="18px"] li { font-size: 18px; padding: 5px 10px; }
    #root .rail li { display: grid; grid-template-columns: 40px 1fr auto; gap: 10px; align-items: start; padding: 8px 12px; margin-bottom: 2px; border-radius: 10px; font-size: 24px; line-height: 1.25; color: #64748B; }
    #root .rail li .n { font-weight: 700; }
    #root .rail li.done { color: #1A2130; }
    #root .rail li.on { color: #ffffff; background: #2F45FF; }
    #root .rail .res { font-size: 18px; padding: 3px 8px; border-radius: 6px; color: #fff; }
    #root .rail .res.pass { background: #15803D; } #root .rail .res.fail { background: #DC2626; } #root .rail .res.found { background: #B45309; } #root .rail .res.script { background: #6B7280; }
    #root .rail .note { display: block; font-size: 15px; line-height: 1.3; margin-top: 3px; color: #B45309; font-weight: 600; }
    #root .rail li.on .note { color: #FDE68A; }
    #root .rec { position: absolute; left: 624px; top: 60px; width: 1272px; height: 795px; object-fit: contain; border-radius: 12px; box-shadow: 0 6px 24px rgba(15,23,42,.18); }
    #root .skip { position: absolute; left: 624px; top: 900px; width: 1272px; display: flex; justify-content: center; z-index: 4; }
    #root .skip span { font-size: 28px; font-weight: 600; color: #1A2130; background: #F1F5F9; padding: 10px 22px; border-radius: 10px; }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
    <div id="${id}-card" class="clip card" data-start="0" data-duration="${TITLE}" data-track-index="0">
      <div id="${id}-kicker" class="kicker">${esc(title)}</div>
      <h1 id="${id}-h1">${esc(heading[run])}</h1>
      <div id="${id}-tally" class="tally">${tally(steps)}${shown.length > 1 ? ` · ${shown.length} parts` : ''}</div>
    </div>
${cards}
${rails}
${clips.join('\n')}
  </div>
  <script>
    function follow(id, i) {
      const li = document.getElementById(id + "-s" + i), ol = li.parentElement;
      const room = ol.parentElement.clientHeight, max = Math.max(0, ol.scrollHeight - room);
      return -Math.min(max, Math.max(0, li.offsetTop - ol.offsetTop - room / 3));
    }
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#${id}-h1", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power4.out" }, 0.2);
    tl.fromTo("#${id}-tally", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, 0.6);
${tl}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`);
  scenes.push({ id, start: filmT, dur: total });
  filmT += total;
}

// Optional closing scene: one row per QC-sheet step with its real result. SUMMARY=<json file>,
// [{case, step, expected, actual, result: pass|fail|not-run}].
if (process.env.SUMMARY) {
  const rows = JSON.parse(fs.readFileSync(process.env.SUMMARY, 'utf8'));
  const id = 'summary', dur = 14;
  const tr = rows.map((r) => `        <tr><td>${esc(r.case)} ${esc(r.step)}</td><td>${esc(r.expected)}</td><td>${esc(r.actual)}</td><td><b class="res ${esc(r.result)}">${esc(r.result.toUpperCase())}</b></td></tr>`).join('\n');
  fs.writeFileSync(path.join(HERE, 'compositions', `${id}.html`), `<template>
  <style>
    #sm { position: absolute; inset: 0; background: #fff; font-family: Inter, sans-serif; color: #1A2130; padding: 44px 60px; }
    #sm h1 { font-size: 40px; font-weight: 700; margin-bottom: 18px; }
    #sm table { width: 100%; border-collapse: collapse; font-size: 19px; line-height: 1.25; }
    #sm th { text-align: left; color: #475569; font-size: 17px; padding: 6px 10px; border-bottom: 2px solid #CBD5E1; }
    #sm td { padding: 6px 10px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
    #sm td:first-child { font-weight: 700; white-space: nowrap; }
    #sm .res { font-size: 16px; padding: 3px 8px; border-radius: 6px; color: #fff; white-space: nowrap; }
    #sm .res.pass { background: #15803D; } #sm .res.fail { background: #DC2626; } #sm .res.not-run { background: #6B7280; } #sm .res.partial { background: #B45309; }
  </style>
  <div id="sm" data-composition-id="${id}" data-width="1920" data-height="1080">
    <div id="sm-body" class="clip" data-start="0" data-duration="${dur}" data-track-index="0">
      <h1>${esc(title)} · result per QC-sheet step</h1>
      <table>
        <tr><th>Step</th><th>Expected (sheet)</th><th>Actual</th><th>Result</th></tr>
${tr}
      </table>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#sm-body", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0);
    window.__timelines["${id}"] = tl;
  </script>
</template>
`);
  scenes.push({ id, start: filmT, dur });
  filmT += dur;
}

const hosts = scenes.map((s, i) => `      <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start.toFixed(2)}" data-duration="${s.dur.toFixed(2)}" data-track-index="${i % 2}" data-track-kind="graphics" data-width="1920" data-height="1080"></div>`).join('\n');
fs.writeFileSync(path.join(HERE, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #ffffff; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${filmT.toFixed(2)}" data-width="1920" data-height="1080">
${hosts}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`);
console.log(`film ${fmt(filmT)}: ${scenes.map((s) => `${s.id} ${fmt(s.dur)}`).join(', ')}`);
