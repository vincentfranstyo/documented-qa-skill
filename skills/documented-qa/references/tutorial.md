# Tutorial mode

Show a client or end user how to use the app: one recorded run of the real UI, turned into a film (step list
on the left, recording on the right, an explanation box underneath) and a PDF guide built from the same run.
Nothing is PASS/FAIL; any check that fails stops the run, because a tutorial must never show a broken flow.

## Ask first
- Who watches it and in which language. Get the wording rules: words to avoid (technical terms, internal
  names, people's names), which role names to use, and things the app does that must not be said.
- The story: one realistic case from start to finish, and which chapters it has.
- The target: preferably **an environment you own and reset every run** (its own empty database, seeded only
  with role accounts and master data). Shared staging only with the evidence-mode rules (ask before writing).
- Where it goes: a Drive folder, an in-app help video, or similar. Don't delete existing uploads.

## Rules
- **Own data.** Reset the database before every recording so numbers and IDs match the story. Generate fresh
  passwords per run into a mode-600, gitignored file; never show them (the overlay masks password inputs).
- **Plain words.** Captions say what the user does ("Tick the task when it is done"); `explain` says why or
  what to notice. One idea per step. No test marks, no "end-to-end", no tool or AI names.
- **Real role accounts.** Sign each role in with its own account; a sign-in step shows the account, not the
  password.
- **Numbers must add up** on screen. Assert the totals in the script (a failed `expect` stops the run).
- **Desktop size** (1440×900) unless asked for a phone view.
- **Desktop-only story changes need the user.** Ask before changing what the story shows.

## Workflow
1. Write the script: one `section()` per chapter, `step(caption, locator, action, { explain, todo })` per
   action. Show a repeated action once with its own step and do the rest without steps.
2. Dry run headless until it passes, then record: `MODE=tutorial node <script>.mjs`.
3. Film: `cd film && MODE=tutorial node build.mjs "<title>" "<run>=<heading>"`, then `hyperframes check` and
   render. The film holds the clip's last frame while the explanation is read (`explain` length sets the time).
4. Guide: `node guide.mjs "<title>" <run>` → `guides/<run>.pdf`. It starts at the first step; pass
   `HEAD=<html file>` for an accounts table or prerequisites only when asked.
5. **Look at frames**, not just ffprobe: pull a frame from each chapter and from every step whose red box or
   hold could be wrong. Check the PDF's first pages.
6. Deliver to the agreed place; write the handoff note (where the files are, how to rerun, open items).

## Traps
- The step screenshot is taken **before** the action. Never hold it after the action ran (the screen jumps
  back to the empty form); the film builder holds the clip's own last frame instead.
- A red box can land on the wrong element when the notification or page it expects isn't there yet. Go to
  the page, wait for `networkidle`, then box.
- Confirm dialogs: wait for the clicked button to be hidden before looking for the next dialog, or the loop
  clicks a dialog that is already closing.
- One Next.js dev server per app folder: stop the developer's own dev server before recording.
