// Check screenshots for the model lab: in one run, take the colored shot and the silhouette from the front, three-quarter, side and back, plus a shrunken preview, and tile them into a contact sheet.
// Usage: node tools/labshot.mjs <spirit id> <output folder> [URL root, default http://localhost:5173]
// A spirit that has not been redone is shot as the game's current version (the baseline image); for a redone spirit, set LABSHOT_OLD=1 to shoot the game's current version for comparison.
// Evolution stage: LABSHOT_STAGE=1 or 2 shoots that stage (file names get _s1, _s2 added); LABSHOT_STAGE=all shoots the front, three-quarter and back of all three stages side by side,
// tiled into one <id>_stages.png stacked vertically (the side-by-side shots take no silhouette or shrunken preview).
// Needs Playwright. If it is not found, set PLAYWRIGHT_DIR to a folder containing node_modules/playwright.
// macOS: use the local Google Chrome with Metal (no browser download needed; swiftshader blocks the main thread on heavy frames).
// Other systems (cloud Linux): use Playwright's Chromium with swiftshader in the new headless mode (channel: 'chromium', screenshots are more than twice as fast as headless shell).
// When the cloud container already has a browser installed, do not run playwright install; install the matching version of playwright instead (see spirit-model-polish reference.md, "Screenshot environment").
// Software rendering is slow, so the waits are lengthened; you can also adjust with LABSHOT_WAIT=milliseconds. Tiling needs ffmpeg; without it only the single images are kept.
// At the end it prints the triangle count and the per-rarity triangle budget (SSR 60,000, SR 45,000, R 35,000, N 25,000); if exceeded, reduce the segment counts.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

function loadPlaywright() {
  const tries = [];
  if (process.env.PLAYWRIGHT_DIR) tries.push(path.join(process.env.PLAYWRIGHT_DIR, 'node_modules', 'playwright'));
  tries.push('playwright');
  try {
    tries.push(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch {
    // having no global npm is fine
  }
  const require = createRequire(import.meta.url);
  for (const t of tries) {
    try {
      return require(t);
    } catch {
      // try the next one
    }
  }
  throw new Error('playwright not found: npm i --prefix <temp folder> playwright, then set PLAYWRIGHT_DIR=<temp folder>');
}

const [id = 'astragate', out = 'labshots', base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { chromium } = loadPlaywright();
const mac = process.platform === 'darwin';
const wait = Number(process.env.LABSHOT_WAIT ?? (mac ? 2500 : 6000));
const old = process.env.LABSHOT_OLD ? '&old' : '';
const stage = process.env.LABSHOT_STAGE ?? '';
const q = `${old}${stage ? `&stage=${stage}` : ''}`;
const browser = mac
  ? await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  : await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));

const VIEWS = [['front', 0], ['q34', -0.72], ['side', -Math.PI / 2], ['back', Math.PI]];
if (stage === 'all') {
  const views = VIEWS.filter(([n]) => n !== 'side');
  for (const [name, yaw] of views) {
    await page.goto(`${base}/?lab=${id}${q}&yaw=${yaw}&t=1`);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(out, `${id}_stages_${name}.png`), clip: { x: 0, y: 60, width: 1280, height: 660 } });
  }
  await browser.close();
  try {
    const ins = views.map(([n]) => `-i ${path.join(out, `${id}_stages_${n}.png`)}`).join(' ');
    execSync(`ffmpeg -loglevel error -y ${ins} -filter_complex "vstack=${views.length}" -frames:v 1 ${path.join(out, `${id}_stages.png`)}`);
  } catch {
    console.log('ffmpeg not found, skipping the contact sheet');
  }
  console.log(errors.length ? `page errors:\n${errors.join('\n')}` : `done: ${out}`);
  process.exit(0);
}
const tag = stage ? `${id}_s${stage}` : id;
for (const [name, yaw] of VIEWS) {
  for (const sil of [false, true]) {
    const file = path.join(out, `${tag}_${name}${sil ? '_sil' : ''}.png`);
    await page.goto(`${base}/?lab=${id}${q}&yaw=${yaw}&t=1${sil ? '&sil' : ''}`);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: file });
  }
}
await page.goto(`${base}/?lab=${id}${q}&yaw=-0.72&t=1&mini`);
await page.waitForTimeout(wait);
await page.screenshot({ path: path.join(out, `${tag}_mini.png`), clip: { x: 1080, y: 560, width: 200, height: 220 } });
const stats = await page.evaluate(() => window.__lab?.stats?.());
await browser.close();

try {
  const crop = '640:720:320:40';
  for (const suffix of ['', '_sil']) {
    const ins = VIEWS.map(([n]) => `-i ${path.join(out, `${tag}_${n}${suffix}.png`)}`).join(' ');
    const f = VIEWS.map((_, i) => `[${i}]crop=${crop}[v${i}]`).join(';') + ';' + VIEWS.map((_, i) => `[v${i}]`).join('') + 'hstack=4,scale=1920:-1';
    execSync(`ffmpeg -loglevel error -y ${ins} -filter_complex "${f}" ${path.join(out, `${tag}_sheet${suffix}.png`)}`);
  }
} catch {
  console.log('ffmpeg not found, skipping the contact sheet');
}
if (stats) {
  const over = stats.tris > stats.budget;
  const overM = stats.meshBudget && stats.meshes > stats.meshBudget;
  console.log(`triangles ${stats.tris} (budget ${stats.budget}${over ? ', over budget: lower the segment counts of lofts, lathes and spheres' : ''}), meshes ${stats.meshes} (budget ${stats.meshBudget ?? '?'}${overM ? ', over budget: merge parts under the same joint and with the same material using mergeGeometries, and put parts that touch each other into different batches' : ''})`);
}
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : `done: ${out}`);
