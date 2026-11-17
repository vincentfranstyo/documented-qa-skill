// Tutorial example on a public demo app: plain captions, an explanation per step, reader instructions for the PDF.
// MODE=tutorial node example-tutorial.mjs   → raw/G1-todomvc.json + video, shots/G1-todomvc/
import { session } from './lib.mjs';

const { page, step, expect, section, close } = await session('G1-todomvc');
const input = page.getByPlaceholder('What needs to be done?');

section('1. Add your first task');
await step('Open the task list', null, () => page.goto('https://demo.playwright.dev/todomvc/'), {
  explain: 'Everything starts on one page: the box at the top adds a task.',
  todo: 'Open the app address you were given.',
});
await step('Type a task and press Enter', input, async (l) => { await l.fill('Buy milk'); await l.press('Enter'); }, {
  explain: 'The task appears in the list right away and the counter goes up.',
  todo: 'Click the box, type <b>Buy milk</b>, press <b>Enter</b>.',
});
await expect('The counter shows 1 item left', page.getByTestId('todo-count').filter({ hasText: '1 item left' }), {
  explain: 'The counter tells you how many tasks are still open.',
});

section('2. Finish a task');
await step('Tick the task when it is done', page.getByTestId('todo-item').getByRole('checkbox'), (l) => l.check(), {
  explain: 'A ticked task is crossed out and no longer counted as open.',
  todo: 'Tick the round box in front of <b>Buy milk</b>.',
});
await expect('The counter shows 0 items left', page.getByTestId('todo-count').filter({ hasText: '0 items left' }), {
  explain: 'Nothing left to do.',
});

await close();
