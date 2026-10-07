// Ultimate recording: open a ?ultview URL, record until the cutscene ends (window.__ult.phase === 'done') plus a bit more, and also tile a contact sheet.
// Usage: node tools/ultrec.mjs '<URL>' <output.webm> [width, default 960] [height, default 540]
//   Example: node tools/ultrec.mjs 'http://localhost:5173/?ultview=astragate&port=astragate&pre=a,b&foeatk=1' out/ast.webm
// Output:
//   <output.webm>, <output>_sheet.png (from the start of the ultimate to 1 second after it ends, 30 frames sampled evenly and tiled 6×5 into one image; needs ffmpeg)
//   one line of JSON: ultAt (the second in the video where the ultimate starts), doneAt (the second where the cutscene ends), marks (segment times), errors (console errors)
// Segment times: temporarily add console.log('ULT_T', '<name>', Date.now()) to the script; here it is converted to seconds in the video, used to match the shots in the contact sheet. Remove it once verified.
// Environment variables: TAIL=milliseconds (how much longer to record after the end, default 4000; lengthen it to see the battle messages and the camera returning), PLAYWRIGHT_DIR (same as labshot.mjs).
// On macOS use the local Chrome with Metal; other systems use swiftshader, which is much slower.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
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

const [url, out, w = '960', h = '540'] = process.argv.slice(2);
if (!url || !out) {
  console.error("Usage: node tools/ultrec.mjs '<URL>' <output.webm> [width] [height]");
  process.exit(1);
}
const { chromium } = loadPlaywright();
const mac = process.platform === 'darwin';
const tmp = `${out}.dir`;
mkdirSync(tmp, { recursive: true });
const browser = mac
  ? await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  : await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const size = { width: +w, height: +h };
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: tmp, size } });
const page = await ctx.newPage();
const t0 = Date.now();
const errors = [];
const marks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  const tx = m.text();
  if (tx.startsWith('ULT_T')) {
    const [, name, ms] = tx.split(' ');
    marks.push(`${name}@${((+ms - t0) / 1000).toFixed(2)}`);
    return;
  }
  if ((m.type() === 'error' || tx.includes('奧義演出出錯')) && !tx.includes('404')) errors.push(tx);
});
await page.goto(url);
let ultAt = null;
for (let i = 0; i < (mac ? 600 : 2400); i++) {
  const ph = await page.evaluate(() => window.__ult?.phase ?? null);
  if (ph === 'ult' && ultAt === null) ultAt = (Date.now() - t0) / 1000;
  if (ph === 'done') break;
  await page.waitForTimeout(50);
}
const doneAt = (Date.now() - t0) / 1000;
await page.waitForTimeout(Number(process.env.TAIL ?? 4000));
await ctx.close();
await browser.close();
const f = readdirSync(tmp).find((x) => x.endsWith('.webm'));
renameSync(path.join(tmp, f), out);
rmSync(tmp, { recursive: true });
try {
  const sheet = out.replace(/\.webm$/, '') + '_sheet.png';
  const from = ultAt ?? 0;
  const fps = (30 / Math.max(1, doneAt + 1 - from)).toFixed(3);
  execSync(`ffmpeg -y -loglevel error -ss ${from} -i "${out}" -vf "fps=${fps},scale=320:-1,tile=6x5" -frames:v 1 "${sheet}"`);
} catch {
  // without ffmpeg only the video is kept
}
console.log(JSON.stringify({ ultAt, doneAt, marks, errors: errors.slice(0, 8) }));
