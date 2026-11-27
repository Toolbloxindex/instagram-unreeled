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
page.on('console', m => { if (m.text().includes('Instagram Unreeled')) results.push('LOG   ' + m.text()); });

const grid = () => page.evaluate(() => [...document.querySelectorAll('[data-ig-focus-story-tile]')].map(card => ({
  name: card.textContent, state: card.getAttribute('data-ig-focus-story-state')
})));
const gridHidden = () => page.evaluate(() => document.querySelector('[data-ig-focus-story-grid]')?.hidden);
const shot = name => page.screenshot({ path: path.join(dir, 'shots', `${label}-${name}.png`) });
fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });

await page.goto('https://www.instagram.com/?ig-focus=stories');
await page.waitForTimeout(4000); // let "Load more" page through the strip
let cards = await grid();
check('grid shows stories from the whole strip', cards.length === 30, cards.length + ' cards');
const u1 = cards.find(c => c.name === 'user1');
const u3 = cards.find(c => c.name === 'user3');
check('unseen story marked unseen', u1?.state === 'unseen', u1?.state);
check('seen story marked seen', u3?.state === 'seen', u3?.state);
const order = cards.map(c => c.name);
const firstSeenIndex = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll('[data-ig-focus-story-tile]')];
  const pos = t => t.getBoundingClientRect();
  const unseenBottom = Math.max(...tiles.filter(t => t.getAttribute('data-ig-focus-story-state') === 'unseen').map(t => pos(t).top));
  const seenTop = Math.min(...tiles.filter(t => t.getAttribute('data-ig-focus-story-state') === 'seen').map(t => pos(t).top));
  return seenTop >= unseenBottom;
});
check('seen stories are listed after unseen ones', firstSeenIndex);
await shot('1-grid');

// Open a story that is currently mounted, then close it.
await page.locator('[data-ig-focus-story-tile]', { hasText: /^user1$/ }).tap();
await page.waitForTimeout(800);
check('tapping user1 opens its story', page.url().includes('/stories/user1/'), page.url());
await shot('2-viewer');
if (!page.url().includes('/stories/')) { check('grid fell back to the strip instead', await gridHidden() === true); await shot('2-fallback'); console.log(`\n== ${label} ==\n` + results.join('\n')); await browser.close(); process.exit(1); }
await page.locator('button[aria-label=Close]').tap();
await page.waitForTimeout(1500);
check('closing returns to the Stories grid', page.url().endsWith('/?ig-focus=stories'), page.url());
check('grid still in grid mode after closing', (await gridHidden()) === false);
const gridTop = await page.evaluate(() => Math.round(document.querySelector('[data-ig-focus-story-grid]').getBoundingClientRect().top));
check('grid starts at the top after closing (no empty block above it)', gridTop < 120, 'grid top ' + gridTop + 'px');
cards = await grid();
check('user1 now marked seen', cards.find(c => c.name === 'user1')?.state === 'seen', cards.find(c => c.name === 'user1')?.state);
await shot('3-after-close');

// The strip was rebuilt at the start, so user25's native item no longer exists.
const mounted = await page.evaluate(() => [...document.querySelectorAll('.strip [role=button]')].map(b => b.textContent));
check('precondition: user25 not mounted in the native strip', !mounted.includes('user25'), mounted.join(','));
await page.locator('[data-ig-focus-story-tile]', { hasText: /^user25$/ }).scrollIntoViewIfNeeded();
await page.locator('[data-ig-focus-story-tile]', { hasText: /^user25$/ }).tap();
await page.waitForTimeout(3000);
check('tapping an off-screen story (user25) opens it', page.url().includes('/stories/user25/'), page.url());
check('it did not fall back to the strip layout', (await gridHidden()) !== true);
await shot('4-offscreen-open');

// Visible dark boxes over the grid after closing: anything other than the
// script's own UI that paints within the viewport.
await page.goBack();
await page.waitForTimeout(1500);
const intruders = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[data-ig-focus-chrome]')) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width * r.height < 2000 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    let hiddenByAncestor = false;
    for (let p = el; p; p = p.parentElement) if (Number(getComputedStyle(p).opacity) === 0) hiddenByAncestor = true;
    if (!hiddenByAncestor && r.bottom > 0 && r.top < innerHeight) out.push(el.tagName + '.' + el.className + ' ' + Math.round(r.top) + '-' + Math.round(r.bottom));
  }
  return out;
});
check('no Instagram element paints over the grid', intruders.length === 0, intruders.slice(0, 5).join(' | '));
await shot('5-final');

// The original strip layout must still show Instagram's own strip.
await page.getByRole('button', { name: 'Use original Stories strip' }).tap();
await page.waitForTimeout(800);
const strip = await page.evaluate(() => {
  const tray = document.querySelector('.tray').getBoundingClientRect();
  let visible = true;
  for (let p = document.querySelector('.tray'); p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0 || cs.display === 'none') visible = false;
  }
  return { visible, top: Math.round(tray.top), height: Math.round(tray.height) };
});
check('original strip layout shows the native strip', strip.visible && strip.height > 50 && strip.top >= 0 && strip.top < 900, JSON.stringify(strip));
await shot('6-strip');
await page.getByRole('button', { name: 'Show Stories grid' }).tap();
await page.waitForTimeout(800);
check('switching back shows the grid at the top', await page.evaluate(() => document.querySelector('[data-ig-focus-story-grid]').getBoundingClientRect().top) < 120);

// A real panel with content, opened well after leaving the viewer, must stay.
await page.waitForTimeout(6500);
await page.evaluate(() => {
  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'legit';
  panel.style.cssText = 'position:fixed;top:120px;left:0;right:0;height:300px;background:#222;color:#fff';
  panel.innerHTML = '<p>Notifications</p><button>Follow</button>';
  document.body.append(panel);
});
await page.waitForTimeout(1500);
const legit = await page.evaluate(() => {
  const el = document.querySelector('.legit');
  const cs = getComputedStyle(el);
  return { display: cs.display, opacity: cs.opacity, marked: el.hasAttribute('data-ig-focus-cover') };
});
check('a real panel with content is not hidden', legit.display !== 'none' && legit.opacity !== '0' && !legit.marked, JSON.stringify(legit));
const logs = await page.evaluate(() => window.__coverLogs || []);

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(`\n== ${label} ==\n` + results.join('\n'));
await browser.close();
if (results.some(line => line.startsWith('FAIL'))) process.exitCode = 1;
