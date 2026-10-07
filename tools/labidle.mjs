// Frame-by-frame idle check: freeze time with __lab.freeze(t), take one three-quarter-view frame every 0.5 s, and tile them into a 5x4 <id>_idle.png.
// Cloud Linux uses this instead of recording video: software rendering runs at only 1-5 fps and the lab's dt is capped at 0.05 s, so motion in a recording is more than ten times slower and the rhythm cannot be seen.
// While frozen dt is 0, so blinks timed by dt do not show up in the image; find the time point of a blink separately with &t=.
// Usage: node tools/labidle.mjs <spirit id> <output folder> [URL root, default http://localhost:5173] [start second, default 0]
// LABSHOT_STAGE=1 or 2 shoots that stage. How Playwright is found and the browser settings are the same as in labshot.mjs.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

function loadPlaywright() {
  const tries = [];
  if (process.env.PLAYWRIGHT_DIR) tries.push(path.join(process.env.PLAYWRIGHT_DIR, 'node_modules', 'playwright'));
  tries.push('playwright');
  const require = createRequire(import.meta.url);
  for (const t of tries) {
    try {
      return require(t);
    } catch {
      // try the next one
    }
  }
  throw new Error('playwright not found: see the notes in labshot.mjs');
}

const [id = 'astragate', out = 'labshots', base = 'http://localhost:5173', t0 = '0'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { chromium } = loadPlaywright();
const mac = process.platform === 'darwin';
const stage = process.env.LABSHOT_STAGE ? `&stage=${process.env.LABSHOT_STAGE}` : '';
const tag = process.env.LABSHOT_STAGE ? `${id}_s${process.env.LABSHOT_STAGE}` : id;
const browser = mac
  ? await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  : await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.goto(`${base}/?lab=${id}${stage}&yaw=-0.72&t=${t0}`);
await page.waitForTimeout(mac ? 1500 : 3000);
for (let i = 0; i < 20; i++) {
  await page.evaluate((t) => window.__lab.freeze(t), Number(t0) + i * 0.5);
  await page.waitForTimeout(mac ? 150 : 700);
  await page.screenshot({ path: path.join(out, `${tag}_idle_${String(i).padStart(2, '0')}.png`), clip: { x: 240, y: 60, width: 620, height: 580 } });
}
await browser.close();
try {
  execSync(`ffmpeg -loglevel error -y -framerate 1 -i ${path.join(out, `${tag}_idle_%02d.png`)} -vf "scale=256:-1,tile=5x4" -frames:v 1 ${path.join(out, `${tag}_idle.png`)}`);
  console.log(`done: ${path.join(out, `${tag}_idle.png`)}`);
} catch {
  console.log('ffmpeg not found, skipping the contact sheet');
}
