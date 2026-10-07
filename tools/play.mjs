// Scripted playthrough screenshots: node tools/play.mjs <url> <script.json> [width] [height]
// script: [{"wait":ms}|{"click":"css"}|{"clickText":"text","force"?:true}|{"shot":"path"}|{"eval":"js"}|{"waitFor":"css","ms":n}|{"autobattle":ms}]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// playwright: PLAYWRIGHT_DIR (npm i --prefix <folder> playwright) → the one in the project → the global one, same as ultrec.mjs and labshot.mjs
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
const { chromium } = loadPlaywright();
const [url, scriptPath, w = '1280', h = '720'] = process.argv.slice(2);
const steps = JSON.parse(readFileSync(scriptPath, 'utf8'));
// On macOS use Chrome's Metal GPU (software rendering is slow, and its outlines and bloom differ from a real device); other platforms fall back to SwiftShader
const auto = '--autoplay-policy=no-user-gesture-required';
const browser = process.platform === 'darwin'
  ? await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', auto] })
  : await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', auto] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
// The console's "Failed to load resource" has no URL, so separately record the URLs of 4xx/5xx responses
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(url, { waitUntil: 'load' });
for (const s of steps) {
  try {
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.click) await page.click(s.click, { timeout: 5000 });
    if (s.clickText) await page.getByText(s.clickText, { exact: false }).first().click({ timeout: 5000, force: !!s.force });
    if (s.waitFor) {
      const t0 = Date.now();
      await page.waitForSelector(s.waitFor, { timeout: s.ms ?? 60000 });
      console.log('waitFor', s.waitFor, Date.now() - t0, 'ms');
    }
    if (s.eval) console.log('eval:', JSON.stringify(await page.evaluate(s.eval)));
    if (s.autobattle) {
      const t0 = Date.now();
      let n = 0;
      while (Date.now() - t0 < s.autobattle) {
        const r = await page.evaluate(() => {
          if (document.querySelector('.result-screen')) return 'done';
          const picks = [...document.querySelectorAll('.bp .sw-card:not(.down):not([disabled])')];
          if (picks.length && document.querySelector('.bp-title')?.textContent?.includes('下一隻')) { picks[0].click(); return 'pick'; }
          const cards = [...document.querySelectorAll('.skill:not(.off):not(.trap)')];
          if (cards.length) {
            const ult = cards.find((c) => c.classList.contains('ultimate'));
            const pow = (c) => Number(c.querySelector('.sk-pow')?.textContent?.split('×')[0] ?? 0);
            const best = ult ?? cards.sort((a, b) => pow(b) - pow(a))[0];
            best.click();
            return 'skill';
          }
          return 'wait';
        });
        if (r === 'done') break;
        if (r === 'skill') n++;
        if (s.shotEvery && r === 'skill' && n % s.shotEvery === 0) await page.screenshot({ path: s.shotPrefix + n + '.png' });
        await page.waitForTimeout(700);
      }
      console.log('autobattle turns', n, 'ms', Date.now() - t0);
    }
    if (s.shot) await page.screenshot({ path: s.shot });
  } catch (e) {
    logs.push(`[step error] ${JSON.stringify(s)} ${e.message.split('\n')[0]}`);
  }
}
console.log(logs.filter((l) => !l.includes('ERR_CERT')).slice(-25).join('\n'));
await browser.close();
