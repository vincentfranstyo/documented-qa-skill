---
name: documented-qa
description: Record QA test cases from a QC/test sheet as evidence — Playwright runs with red-box highlights, numbered captions, PASS/FAIL checks, per-step screenshots and video, then a HyperFrames film (step list beside the recording), a PR with run logs, a results comment, a video upload and a handoff note. Use when the user asks for "documented testing", "documented QA", evidence videos of test cases, recording test-sheet cases on staging, re-running a documented case, or rebuilding the QA film.
---

# Documented QA

Turn test-sheet cases into recorded, reviewable evidence: one Playwright script per run, a JSON step log,
screenshots and a video per run, and one film that shows the step list with PASS/FAIL beside each recording.

Templates (copy into the project, e.g. `internal/documented-testing/`):
- `templates/lib.mjs` — recorder (`session`, `step`, `expect`, `close`).
- `templates/example-login.mjs` — smallest example run.
- `templates/film/` — HyperFrames film builder (`build.mjs`).

## Hard rules

0. **Ask if not given:** the test sheet link (and which cases/round), the target environment, and where videos go (Drive folder or similar). Never assume.
1. **Staging only.** No production. Flag any credential that reaches production; don't copy it.
2. **Ask before writing to shared staging**: creating customers/orders, paying, building or publishing apps, changing shared settings, resetting shared accounts. List exactly what will be created. Read-only probes need no ask.
3. **Passwords:** env vars only (or parsed at runtime from a local, never-committed sheet export). Never in files, logs, commits, PR text, notes, memory or video frames. Suggest `! export QA_PW='…'` so the value bypasses the model. The overlay masks password inputs in every frame; sign-in captions say "(password hidden)".
4. **One login attempt, then stop and ask.** No guessing variants (lockout risk). First check you used the exact password the user gave.
5. **Probes never click submit/accept/publish.** Some actions have no confirm dialog.
6. **PR updates go in a new comment.** Don't edit the PR description or older comments. One comment once a batch is fully done, not drip updates. Don't mention the AI tool in PR comments unless the user wants it.
7. **Repo hygiene:** commit scripts, `runs/*.json` (absolute paths stripped: `jq '{name, log}'`), README, film builder. Gitignore `videos/ shots/ raw/ scripts/node_modules/ scripts/testdata.json film/assets/ film/.hyperframes/ film/renders/` — they show staging data. Keep test-sheet status maps, usernames and private hostnames out of public repos. Grep the staged diff for secrets and absolute paths before every push.
8. **Videos go to the agreed storage, not git.** Don't delete existing uploads.
9. **Don't edit the test sheet** unless told to; propose the row changes. When approved, leave tester/owner columns alone; for cells that hold secrets use the sheet's Find & replace scoped to one tab so the secret never passes through you; verify by re-export.
10. Delete local credential exports and saved storageState when done (ask first).

## Workflow

1. **Get the sheet.** Open it in a browser profile already signed in to the account it's shared with; export xlsx/CSV from inside the page into a mode-600 dir. Never print credential tabs. Changed-cell markers (borders/colours): list the actual colours first, guesses miss.
2. **Plan and ask.** List runs (preconditions `p1`, case segments), the staging data each creates, and what you need (passwords, go-ahead).
3. **Probe read-only.** Headless pass for real selectors and leftover data. Check each precondition; make a `p1-preconditions` run for them.
4. **One script per irreversible segment.** Name `<case><letter>-<verb>.mjs` in run order (`e5a-order`, `e5b-pay`, `e5c-accept`, `e5d-evidence`, …). A rerun gets a new run name (`E5f-publish-a/-b/-c`) so the film can show fail → fix → pass. Pass state by env (`ORDER_ID`, `PROJECT_URL`, `RESUME=1`). Use your own labelled test customer in gitignored `scripts/testdata.json`, separate from the sheet's official accounts.
5. **Record.** `cd scripts && npm i && npx playwright install chromium`, then `node <script>.mjs` (`HEADED=1` to watch). Long runs in background with a watcher on the newest `shots/` file plus exit. Output: `raw/<run>.json` + `raw/<run>/*.webm`, `shots/<run>/NN.png`.
6. **Blocked?** Record a read-only evidence run of the failure, stop dependent cases, diagnose, report. Confirm **where the system under test actually runs** (DNS, host) before any infra theory.
7. **Evidence → repo.** `jq '{name, log}' raw/X.json > runs/X.json`; README with a results table (case/step | result | evidence file), "what broke and how it was fixed", UI notes. Commit, push, keep the PR title on current status.
8. **Film** (below). Check duration/frames before upload.
9. **Deliver.** Upload the video where agreed. New results comment on the tracking PR: table, PR link, video link, follow-ups. Close superseded drafts with a pointer; keep branches.
10. **Handoff note** (vault/wiki/issue): where it stands, what broke and why, open items as checkboxes, deliverables, how to rerun, staging data created, expiry dates. No secrets.

## Recorder API (`templates/lib.mjs`)

Env: `QA_APP_URL` (exported as `APP`), optional `QA_GATE_USER`/`QA_GATE_PW` for an HTTP basic-auth gate, `HEADED=1`.

- `session(name, {video=true, storage})` → `{page, ctx, step, expect, close}`. Chromium 1440×900, video to `raw/<name>/`, overlay via `addInitScript` (survives navigation).
- `section(name)` — call when the run moves to a different test case or step (e.g. `section('Case 3 · Checkout')`). Following steps log `section: name`; the film gives each section its own card and a fresh step list.
- `step(caption, locator?, action?, {hold=1400, shot=true})` — red box + caption bar "N. caption", screenshot, log `{n, at:'mm:ss', caption, shot}`, then the action.
- `expect(caption, locator, {timeout=20000, label})` — visible → `PASS - …`, else `FAIL - …` (or `label`, e.g. FOUND); sets `result`; returns bool.
- `close()` — saves the video, writes `raw/<name>.json` `{name, raw, log}`. A run killed before `close()` has no log: rebuild it from screenshot mtimes.

Add app-specific helpers (admin login, re-auth prompts) next to `session` in your copy.

## Film (`templates/film/`)

```sh
cd film
node build.mjs "<title>" "<run>=<heading>" ["<run>=<heading>" ...]   # reads ../raw/<run>.json + its webm
npx --yes hyperframes@0.8.186 check
npx --yes hyperframes@0.8.186 render -o ../videos/<name>.mp4         # minutes; run in background
```
One scene per run: 4 s title card (heading, "N steps · X pass · Y fail"), left 600 px step rail (one slide per `section()`, with a 2.5 s section card between; current step lit and scrolled into the upper third when the list overflows, PASS/FAIL/FOUND chips, smaller font above 12 steps), recording on the right. Each step plays ≤9 s; longer waits get a "⏩ N skipped" chip. Needs `ffmpeg`/`ffprobe`. Raw webms are machine-local: render where you recorded, or copy `raw/` and fix the `raw` path in each JSON.

Report the real state per test step. A fault in the recording script is not a product FAIL: give the log step `result: "script"` and a `note` (shown under the step in the film). Mark a step `partial` when only part of its expected result was checked. `SUMMARY=<json> node build.mjs …` appends a closing table, one row per sheet step `{case, step, expected, actual, result}`.

## General traps

- A button that opens a new tab escapes the recording: `page.evaluate(() => { window.open = (u) => { location.href = u; return window; }; })` (route interception doesn't help).
- Deep links can bounce after sign-in; navigate the way a user would (recent items list).
- "Steps listed" checks only prove labels appear; the success message is the real proof.
- Status buttons can render a default label before the real status loads; wait and match text anywhere (icons break starts-with).
- Inputs detach on re-render; re-locate by placeholder after the page settles.
- Deleted admin records can leave linked login users behind; re-creating with the same email then fails.
- Form state resets on navigation; check for leftovers before filling.
- A green "Connected" check may test only one direction of a dependency; note coverage gaps.
- `pkill -f` can match your own shell command; stop stale watchers.
