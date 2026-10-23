// Build the documentation film from the recorder's step logs (raw/<run>.json + its .webm).
// One scene per run: a step rail on the left (the current step lit), the recording on the right,
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
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const secs = (at) => { const [m, s] = at.split(':').map(Number); return m * 60 + s; };
const fmt = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

fs.mkdirSync(path.join(HERE, 'assets'), { recursive: true });
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
  let t = TITLE;
  const clips = [];
  const lit = [];
  for (const [k, sg] of segs.entries()) {
    const len = sg.to - sg.from;
    clips.push(`    <video id="${id}-v${k}" class="clip rec" src="assets/${run}.mp4" muted playsinline data-start="${t.toFixed(2)}" data-duration="${len.toFixed(2)}" data-media-start="${sg.from.toFixed(2)}" data-track-index="1"></video>`);
    lit.push({ step: sg.step, start: t, len });
    if (sg.skipped) clips.push(`    <div id="${id}-skip${k}" class="clip skip" data-start="${(t + len - 1.6).toFixed(2)}" data-duration="1.6" data-track-index="2"><span>⏩ ${fmt(sg.skipped)} skipped</span></div>`);
    t += len;
  }
  const total = t + 1.5;

  const rail = steps.map((st, i) => {
    const res = st.result ? `<b class="res ${st.result}" data-layout-ignore>${esc(st.result.toUpperCase())}</b>` : '';
    const cap = esc(st.caption.replace(/^(PASS|FAIL|FOUND) - /, ''));
    return `      <li id="${id}-s${i}"><span class="n">${i + 1}</span><span class="cap">${cap}</span>${res}</li>`;
  }).join('\n');
  const passes = steps.filter((s) => s.result === 'pass').length;
  const fails = steps.filter((s) => s.result === 'fail').length;

  const tl = lit.map((l) => `    tl.set("#${id}-s${l.step}", { className: "on" }, ${l.start.toFixed(2)});\n    tl.set("#${id}-s${l.step}", { className: "done" }, ${(l.start + l.len - 0.02).toFixed(2)});`).join('\n');

  fs.writeFileSync(path.join(HERE, 'compositions', `${id}.html`), `<template>
  <style>
    #root { position: absolute; inset: 0; background: #ffffff; font-family: Inter, sans-serif; color: #1A2130; }
    #root .card { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 160px; background: #ffffff; z-index: 5; }
    #root .card .kicker { font-size: 30px; font-weight: 600; color: #2F45FF; }
    #root .card h1 { font-size: 84px; font-weight: 700; letter-spacing: -0.02em; margin-top: 18px; max-width: 1500px; }
    #root .card .tally { font-size: 32px; margin-top: 28px; color: #475569; }
    #root .rail { position: absolute; left: 0; top: 0; bottom: 0; width: 600px; padding: 48px 28px 40px 36px; border-right: 2px solid #E2E8F0; }
    #root .rail h2 { font-size: 30px; font-weight: 700; line-height: 1.2; }
    #root .rail ol { list-style: none; margin-top: 26px; }
    #root .rail ol[style*="18px"] li { font-size: 18px; padding: 5px 10px; }
    #root .rail li { display: grid; grid-template-columns: 40px 1fr auto; gap: 10px; align-items: start; padding: 8px 12px; margin-bottom: 2px; border-radius: 10px; font-size: 24px; line-height: 1.25; color: #64748B; }
    #root .rail li .n { font-weight: 700; }
    #root .rail li.done { color: #1A2130; }
    #root .rail li.on { color: #ffffff; background: #2F45FF; }
    #root .rail .res { font-size: 18px; padding: 3px 8px; border-radius: 6px; color: #fff; }
    #root .rail .res.pass { background: #15803D; } #root .rail .res.fail { background: #DC2626; } #root .rail .res.found { background: #B45309; }
    #root .rec { position: absolute; left: 624px; top: 60px; width: 1272px; height: 795px; object-fit: contain; border-radius: 12px; box-shadow: 0 6px 24px rgba(15,23,42,.18); }
    #root .skip { position: absolute; left: 624px; top: 900px; width: 1272px; display: flex; justify-content: center; z-index: 4; }
    #root .skip span { font-size: 28px; font-weight: 600; color: #1A2130; background: #F1F5F9; padding: 10px 22px; border-radius: 10px; }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
    <div id="${id}-card" class="clip card" data-start="0" data-duration="${TITLE}" data-track-index="0">
      <div id="${id}-kicker" class="kicker">${esc(title)}</div>
      <h1 id="${id}-h1">${esc(heading[run])}</h1>
      <div id="${id}-tally" class="tally">${steps.length} steps · ${passes} pass · ${fails} fail</div>
    </div>
    <div id="${id}-rail" class="clip rail" data-start="${TITLE}" data-duration="${(total - TITLE).toFixed(2)}" data-track-index="0">
      <h2>${esc(heading[run])}</h2>
      <ol style="${steps.length > 12 ? 'font-size: 18px' : ''}">
${rail}
      </ol>
    </div>
${clips.join('\n')}
  </div>
  <script>
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
