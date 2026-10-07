// UI scaling for large screens: the layout is designed for 1366×768, and the panels and text of menu-style screens (.screen.uiz) scale up in proportion to the window,
// so they do not shrink into a corner of a 1080p or 2K screen. The factor is set in :root as --uz, and CSS applies it with zoom.
// zoom scales px, vw, vh and transform offsets together; code that derives panel positions from px constants (3D framing, the drag proxy) must multiply by uiZoom().
// Screens that are not .uiz (title, story, map, field, results, summon cutscene) scale only their fixed-position parts (the list is at the top of screens.css);
// name tags that follow a 3D projection must divide their coordinates by uiZoom(). zoom compounds layer on layer, so do not apply it again to an element already inside a scaled container.

const BASE_W = 1366;
const BASE_H = 768;
const MAX = 1.8;

export function uiZoom(): number {
  const z = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
  return Math.max(1, Math.min(MAX, Math.floor(z * 20) / 20));
}

const apply = () => document.documentElement.style.setProperty('--uz', String(uiZoom()));
apply();
window.addEventListener('resize', apply);
