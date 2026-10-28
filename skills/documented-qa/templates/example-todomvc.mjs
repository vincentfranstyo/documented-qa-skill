// Example run on a public demo app, two test cases in one run (each gets its own film slide).
// node example-todomvc.mjs   → raw/T1-todomvc.json + video, shots/T1-todomvc/
import { session } from './lib.mjs';

const { page, step, expect, section, close } = await session('T1-todomvc');
const input = page.getByPlaceholder('What needs to be done?');

section('Case 1 · Add todos');
await step('Open TodoMVC', null, () => page.goto('https://demo.playwright.dev/todomvc/'));
for (const t of ['Buy milk', 'Write test sheet', 'Record evidence']) {
  await step(`Type "${t}" and press Enter`, input, async (l) => { await l.fill(t); await l.press('Enter'); });
}
await expect('Counter shows "3 items left"', page.getByTestId('todo-count').filter({ hasText: '3 items left' }));

section('Case 2 · Complete and filter');
const milk = page.getByTestId('todo-item').filter({ hasText: 'Buy milk' });
await step('Tick "Buy milk"', milk.getByRole('checkbox'), (l) => l.check());
await expect('Counter shows "2 items left"', page.getByTestId('todo-count').filter({ hasText: '2 items left' }));
await step('Filter: Completed', page.getByRole('link', { name: 'Completed' }), (l) => l.click());
await expect('Only "Buy milk" listed', page.getByTestId('todo-item').filter({ hasText: 'Buy milk' }));
await step('Filter: Active', page.getByRole('link', { name: 'Active' }), (l) => l.click());
await expect('Active lists "Write test sheet"', page.getByTestId('todo-title').filter({ hasText: 'Write test sheet' }));

const r = await close();
console.log(JSON.stringify(r.log.filter((x) => x.result).map((x) => x.caption)));
