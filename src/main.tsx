import './ui/style.css';
import './ui/screens.css';
import './ui/field.css';
import './ui/skin.css';

const el = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

if (params.has('arena')) {
  import('./dev/arenaview.ts').then((m) => {
    el.querySelector('.boot-loading')?.remove();
    m.runArenaView(el);
  });
} else if (params.has('fieldview')) {
  import('./dev/fieldview.ts').then((m) => {
    el.querySelector('.boot-loading')?.remove();
    m.runFieldView(el);
  });
} else if (params.has('ultview')) {
  import('./dev/ultview.ts').then((m) => {
    el.querySelector('.boot-loading')?.remove();
    void m.runUltView(el);
  });
} else if (params.has('summonview')) {
  import('./dev/summonview.ts').then((m) => {
    el.querySelector('.boot-loading')?.remove();
    void m.runSummonView(el);
  });
} else if (params.has('prologue')) {
  import('./dev/prologueview.ts').then((m) => {
    el.querySelector('.boot-loading')?.remove();
    m.runPrologueView(el);
  });
} else if (params.has('music')) {
  import('./dev/musicview.ts').then((m) => {
    el.querySelector('.boot-loading')?.remove();
    m.runMusicView(el);
  });
} else if (params.has('lab')) {
  import('./dev/lab.ts').then((m) => {
    el.querySelector('.boot-loading')?.remove();
    m.runLab(el);
  });
} else if (params.has('viewer')) {
  import('./dev/viewer.ts').then((m) => {
    el.querySelector('.boot-loading')?.remove();
    m.runViewer(el);
  });
} else {
  // Opened in a phone browser: mount only the install prompt and do not load the game itself (see ui/install.tsx)
  import('./ui/install.tsx').then((ins) => {
    if (ins.NEEDS_INSTALL) ins.mountInstallGate(el);
    else import('./ui/boot.tsx').then((m) => m.boot(el));
  });
}
