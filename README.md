# documented-qa-skill

An agent skill that turns test-sheet cases into **recorded evidence**: Playwright runs with a red box on each element acted on, numbered captions, PASS/FAIL checks, a screenshot per step and a video per run, then one film (made with [HyperFrames](https://hyperframes.heygen.com)) that shows the step list beside each recording. It also covers the delivery: run logs in a PR, a results comment, the video upload and a handoff note.

```bash
npx skills add vincentfranstyo/documented-qa-skill
```

Then ask your agent:

> do documented testing for cases E5 and E6 in this test sheet: <link>

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
- `skills/documented-qa/templates/example-login.mjs`: a minimal run
- `skills/documented-qa/templates/film/`: the film builder

## Safety defaults

It runs against staging only. It asks before creating data, makes one login attempt and then stops, keeps passwords in env vars and masks them in every frame, and keeps videos and screenshots out of git.

## License

MIT
