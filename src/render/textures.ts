// Procedural textures: glow, star burst, halo, magic circle, ground and so on, all drawn with canvas, no external image files needed.

import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function glowTex(): THREE.Texture {
  return canvasTex('glow', 128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}

/** Particle atlas (2×2): 0 mote, 1 star burst, 2 shard, 3 leaf */
export function particleAtlas(): THREE.Texture {
  return canvasTex('atlas', 256, (g, s) => {
    const h = s / 2;
    // Mote
    let r = g.createRadialGradient(h / 2, h / 2, 0, h / 2, h / 2, h / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, h, h);
    // Star burst
    g.save();
    g.translate(h * 1.5, h / 2);
    r = g.createRadialGradient(0, 0, 0, 0, 0, h / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 4);
      g.beginPath();
      g.ellipse(0, 0, h / 2, h / 14, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, h / 8, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Shard
    g.save();
    g.translate(h / 2, h * 1.5);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.moveTo(0, -h * 0.42);
    g.lineTo(h * 0.2, 0);
    g.lineTo(0, h * 0.42);
    g.lineTo(-h * 0.2, 0);
    g.closePath();
    g.fill();
    g.restore();
    // Leaf
    g.save();
    g.translate(h * 1.5, h * 1.5);
    g.rotate(0.6);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.ellipse(0, 0, h * 0.2, h * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

export function ringTex(): THREE.Texture {
  return canvasTex('ring', 256, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,0)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.15)');
    r.addColorStop(0.82, 'rgba(255,255,255,1)');
    r.addColorStop(0.9, 'rgba(255,255,255,0.6)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}

/** Magic circle */
export function runeCircleTex(seed = 0): THREE.Texture {
  return canvasTex(`rune${seed}`, 512, (g, s) => {
    const c = s / 2;
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.fillStyle = 'rgba(255,255,255,1)';
    g.shadowColor = 'white';
    g.shadowBlur = 8;
    const circle = (r: number, w: number) => {
      g.lineWidth = w;
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.stroke();
    };
    circle(s * 0.47, 6);
    circle(s * 0.43, 2);
    circle(s * 0.3, 3);
    circle(s * 0.12, 2);
    const n = 6 + (seed % 3);
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i * 2 * Math.PI * 2) / n;
      const x = c + Math.cos(a) * s * 0.3;
      const y = c + Math.sin(a) * s * 0.3;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.font = `${Math.floor(s * 0.045)}px serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.save();
      g.translate(c + Math.cos(a) * s * 0.45, c + Math.sin(a) * s * 0.45);
      g.rotate(a + Math.PI / 2);
      g.fillText(glyphs[(i + seed) % glyphs.length], 0, 0);
      g.restore();
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath();
      g.arc(c + Math.cos(a) * s * 0.3, c + Math.sin(a) * s * 0.3, s * 0.035, 0, Math.PI * 2);
      g.stroke();
    }
  });
}

/** Slash arc */
export function slashTex(): THREE.Texture {
  return canvasTex('slash', 256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, s, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.7)');
    grd.addColorStop(0.95, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    for (let y = 0; y < s; y++) {
      const t = y / s;
      const a = Math.sin(t * Math.PI);
      g.globalAlpha = a * a;
      g.fillRect(0, y, s, 1);
    }
  });
}

/** Ground: a mottled surface drawn from the palette, with the duel circle in the middle */
export function groundTex(base: string, spot: string, line: string, seed: number): THREE.Texture {
  return canvasTex(`ground${base}${spot}${seed}`, 1024, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    let x = seed * 9301 + 49297;
    const rnd = () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280;
    };
    for (let i = 0; i < 380; i++) {
      g.fillStyle = spot;
      g.globalAlpha = 0.08 + rnd() * 0.18;
      g.beginPath();
      g.ellipse(rnd() * s, rnd() * s, 8 + rnd() * 40, 6 + rnd() * 26, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // Central path
    const c = s / 2;
    g.strokeStyle = line;
    g.globalAlpha = 0.5;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(c, c, s * 0.33, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 0.25;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(c, c, s * 0.36, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  });
}

export function skyTex(top: string, mid: string, bottom: string): THREE.Texture {
  return canvasTex(`sky${top}${mid}${bottom}`, 512, (g, s) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, top);
    grd.addColorStop(0.55, mid);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

export function blobShadowTex(): THREE.Texture {
  return canvasTex('blob', 128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(0,0,0,0.55)');
    r.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}
