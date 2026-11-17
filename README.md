# documented-qa-skill

An agent skill that turns test-sheet cases into **recorded evidence**: Playwright runs with a red box on each element acted on, numbered captions, PASS/FAIL checks, a screenshot per step and a video per run, then one film (made with [HyperFrames](https://hyperframes.heygen.com)) that shows the step list beside each recording. It also covers the delivery: run logs in a PR, a results comment, the video upload and a handoff note.

A second mode, **tutorial**, uses the same recorder for a client or user walkthrough: plain captions, an explanation box under the recording, no PASS/FAIL, and a step-by-step PDF guide built from the same run.

```bash
npx skills add vincentfranstyo/documented-qa-skill
```

Then ask your agent:

> do documented testing for cases E5 and E6 in this test sheet: <link>

## Example

`templates/example-todomvc.mjs` tests the public [TodoMVC demo](https://demo.playwright.dev/todomvc/) as two cases in one run: add todos, then complete and filter. No accounts or secrets needed. Shortened here; the template adds three todos and checks more.

```js
import { session } from './lib.mjs';

const { page, step, expect, section, close } = await session('T1-todomvc');
const input = page.getByPlaceholder('What needs to be done?');

section('Case 1 · Add todos');
await step('Open TodoMVC', null, () => page.goto('https://demo.playwright.dev/todomvc/'));
await step('Type "Buy milk" and press Enter', input, async (l) => { await l.fill('Buy milk'); await l.press('Enter'); });
await expect('Counter shows "1 item left"', page.getByTestId('todo-count').filter({ hasText: '1 item left' }));

section('Case 2 · Complete and filter');   // new slide in the film
await step('Tick "Buy milk"', page.getByRole('checkbox').last(), (l) => l.check());
await step('Filter: Completed', page.getByRole('link', { name: 'Completed' }), (l) => l.click());
await expect('"Buy milk" listed', page.getByTestId('todo-item').filter({ hasText: 'Buy milk' }));

await close();   // writes raw/T1-todomvc.json + video
```

Run it, then build the film:

```bash
T=skills/documented-qa/templates
mkdir -p qa/scripts && cp $T/lib.mjs $T/package.json $T/example-todomvc.mjs qa/scripts/ && cp -r $T/film qa/film
cd qa/scripts && npm i && npx playwright install chromium
node example-todomvc.mjs                     # → qa/raw/, qa/shots/
cd ../film && node build.mjs "Example · TodoMVC" "T1-todomvc=TodoMVC · add, complete, filter"
npx --yes hyperframes@0.8.186 render -o ../videos/example.mp4
```

The film: step list on the left with the current step lit and PASS chips, recording on the right with a red box on each element acted on. Each `section()` gets its own card and a fresh list; long lists scroll to keep the current step in view.

![Example film frames: Case 1 step list, Case 2 section card, Case 2 step list](docs/example-film.jpg)

## Tutorial mode

```bash
cp $T/example-tutorial.mjs $T/guide.mjs qa/scripts/
cd qa/scripts && MODE=tutorial node example-tutorial.mjs
cd ../film && MODE=tutorial node build.mjs "Example · tutorial" "G1-todomvc=Using the task list"
npx --yes hyperframes@0.8.186 render -o ../videos/tutorial.mp4
cd ../scripts && node guide.mjs "Using the task list" G1-todomvc   # → qa/guides/G1-todomvc.pdf
```

Each `step()` takes `{ explain, todo }`: `explain` is shown under the recording, `todo` is the reader instruction in the PDF. When the explanation needs longer to read than the clip, the film holds the clip's last frame. Rules and workflow: `skills/documented-qa/references/tutorial.md`.

## Prerequisites

| tool | used for | check |
|---|---|---|
| [Node.js](https://nodejs.org) 18+ | scripts, `npx` | `node -v` |
| Playwright Chromium | recording | `npx playwright install chromium` |
| [ffmpeg](https://ffmpeg.org) (with `ffprobe`) | film cuts | `ffmpeg -version` |
| `jq` | stripping paths from run logs | `jq --version` |
| An agent that supports skills | Claude Code, Codex, Cursor, … | |

## What's inside

- `skills/documented-qa/SKILL.md`: rules and workflow
- `skills/documented-qa/templates/lib.mjs`: the recorder
- `skills/documented-qa/templates/example-login.mjs`: a minimal sign-in run
- `skills/documented-qa/templates/example-todomvc.mjs`: the runnable example above
- `skills/documented-qa/templates/example-tutorial.mjs`: tutorial-mode example
- `skills/documented-qa/templates/guide.mjs`: PDF guide from a run
- `skills/documented-qa/references/tutorial.md`: tutorial-mode rules and workflow
- `skills/documented-qa/templates/film/`: the film builder

## Safety defaults

It runs against staging only. It asks before creating data, makes one login attempt and then stops, keeps passwords in env vars and masks them in every frame, and keeps videos and screenshots out of git.

## License

MIT
