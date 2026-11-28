// Runs the userscript against a local mock of Instagram's mobile home page
// (served as https://www.instagram.com/ inside the test browser; nothing is
// sent to Instagram) in iPhone-emulated WebKit. Screenshots go to test/shots/.
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const scriptPath = process.argv[2] || path.join(dir, '..', 'instagram-unreeled.user.js');
const label = process.argv[3] || 'current';
const mock = fs.readFileSync(path.join(dir, 'mock-instagram.html'), 'utf8');
const results = [];
const check = (name, pass, detail = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);

const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 15 Pro Max'], colorScheme: 'dark' });
await context.addInitScript({ content: fs.readFileSync(scriptPath, 'utf8') });
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname !== 'www.instagram.com') return route.abort();
  if (url.pathname.startsWith('/api/v1/accounts/current_user')) {
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: { username: 'mockme' } }) });
  }
  if (route.request().resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: mock });
  return route.abort();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const shot = name => page.screenshot({ path: path.join(dir, 'shots', `${label}-${name}.png`) });
fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });

// Where the native strip is and whether it can be seen.
const strip = () => page.evaluate(() => {
  const tray = document.querySelector('.tray');
  if (!tray) return { exists: false };
  let visible = true;
  for (let p = tray; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0 || cs.display === 'none') visible = false;
  }
  const r = tray.getBoundingClientRect();
  return { exists: true, visible, top: Math.round(r.top), height: Math.round(r.height) };
});
const postsVisible = () => page.evaluate(() => [...document.querySelectorAll('article')]
  .filter(a => a.getClientRects().length && getComputedStyle(a).visibility !== 'hidden').length);

await page.goto('https://www.instagram.com/?ig-focus=stories');
await page.waitForTimeout(1500);
let s = await strip();
check('Stories tab shows Instagram\'s own strip', s.visible && s.height > 50, JSON.stringify(s));
check('the strip is near the top', s.top < 200, 'top ' + s.top + 'px');
check('feed posts are hidden', await postsVisible() === 0);
check('no leftover grid', await page.evaluate(() => !document.querySelector('[data-ig-focus-story-grid], [data-ig-focus-chrome="story-panel"]')));
await shot('1-strip');

await page.locator('.strip [role=button]', { hasText: /^user1$/ }).tap();
await page.waitForTimeout(800);
check('tapping a story opens it', page.url().includes('/stories/user1/'), page.url());
await page.locator('button[aria-label=Close]').tap();
await page.waitForTimeout(1500);
check('closing returns to Stories', page.url().endsWith('/?ig-focus=stories'), page.url());
s = await strip();
// The mock re-renders home as a full-screen loading column after a story.
check('strip still visible and at the top after closing', s.visible && s.top < 200, JSON.stringify(s));
check('feed posts still hidden after closing', await postsVisible() === 0);
await shot('2-after-close');

// Scrolling the strip loads more stories (it is virtualised).
await page.evaluate(() => { document.querySelector('.tray').scrollLeft = 1800; });
await page.waitForTimeout(500);
const later = await page.evaluate(() => [...document.querySelectorAll('.strip [role=button]')].map(b => b.textContent));
check('scrolling the strip shows later stories', later.includes('user25'), later.join(','));

// DM thread: the conversation must stay visible.
await page.goto('https://www.instagram.com/direct/t/123/');
await page.waitForTimeout(1500);
const chat = await page.evaluate(() => {
  const thread = document.querySelector('.thread');
  if (!thread) return { exists: false };
  let visible = true;
  for (let p = thread; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.visibility === 'hidden' || cs.display === 'none') visible = false;
  }
  return { exists: true, visible, box: document.querySelector('.thread textarea')?.getClientRects().length > 0 };
});
check('a DM conversation is shown with its message box', chat.visible && chat.box, JSON.stringify(chat));
await shot('3-chat');

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n== ${label} ==\n` + results.join('\n'));
await browser.close();
if (results.some(line => line.startsWith('FAIL'))) process.exitCode = 1;
