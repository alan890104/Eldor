// Full-screen regression screenshots: node tools/regress.mjs <baseUrl> <outDir> [width] [height]
// Captures, in order: title, hub town, map, region, pre-battle, battle, party, summon, Codex, Arena, quests and settings, and outputs one overview image (needs python3 + PIL).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base = 'http://localhost:5173/', out = 'regress', w = '1280', h = '720'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const go = (screen) => ({ eval: `window.__store.go(${JSON.stringify(screen)})` });
const names = [];
const shot = (n) => (names.push(n), { shot: `${out}/${n}.png` });
const steps = [
  { wait: 3500 }, shot('01_title'),
  { clickText: '繼續冒險' }, { wait: 2500 }, shot('02_hub'),
  { clickText: '冒險' }, { wait: 3500 }, shot('03_map'),
  { clickText: '翠語森林', force: true }, { wait: 3000 }, shot('04_region'),
  // Pre-battle and battle: since regions became a 3D field there is no stage list, so enter from the first tier of the Arena instead
  go({ name: 'arena' }), { wait: 2500 }, { click: '.arena-row:nth-child(1)' }, { wait: 2500 }, shot('05_party'),
  { clickText: '出發！' }, { wait: 7000 }, shot('06_battle'),
  { eval: 'window.__store.go({ name: "hub" })' }, { wait: 2000 },
  go({ name: 'team' }), { wait: 3000 }, shot('07_team'),
  go({ name: 'team', tab: 'items' }), { wait: 2000 }, shot('07b_items'),
  go({ name: 'summon' }), { wait: 3000 }, shot('08_summon'),
  go({ name: 'dex' }), { wait: 3000 }, shot('09_dex'),
  go({ name: 'arena' }), { wait: 2500 }, shot('10_arena'),
  go({ name: 'quests' }), { wait: 2500 }, shot('11_quests'),
  go({ name: 'settings' }), { wait: 2000 }, shot('12_settings'),
];
writeFileSync(`${out}/steps.json`, JSON.stringify(steps));
const url = `${base}${base.includes('?') ? '&' : '?'}lowfx&nomusic&testclock&devsave`;
execFileSync('node', ['tools/play.mjs', url, `${out}/steps.json`, w, h], { stdio: 'inherit' });
execFileSync('python3', ['-c', `
from PIL import Image
import os
names=${JSON.stringify(names)}
ims=[Image.open('${out}/'+n+'.png') for n in names if os.path.exists('${out}/'+n+'.png')]
tw=480; th=int(tw*ims[0].height/ims[0].width)
cols=4; rows=(len(ims)+cols-1)//cols
o=Image.new('RGB',(tw*cols,th*rows))
for k,i in enumerate(ims): o.paste(i.resize((tw,th)),((k%cols)*tw,(k//cols)*th))
o.save('${out}/sheet.png')
`]);
console.log(`${out}/sheet.png`);
