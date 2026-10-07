// Procedural textures for ultimate cinematics: star bursts, horizontal light streaks, ground cracks, long fissures, cloud puffs, light beams. All drawn with canvas and cached by seed.

import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

function rng(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Four-point star (a long and a short set of rays), used for eye glints and camera flares */
export function starTex(): THREE.Texture {
  return canvasTex('star', 256, 256, (g, s) => {
    const c = s / 2;
    const r = g.createRadialGradient(c, c, 0, c, c, c * 0.5);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.2, 'rgba(255,255,255,0.6)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
    const spike = (len: number, wid: number, rot: number) => {
      g.save();
      g.translate(c, c);
      g.rotate(rot);
      const lg = g.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(255,255,255,1)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(-len, 0);
      g.quadraticCurveTo(0, -wid, len, 0);
      g.quadraticCurveTo(0, wid, -len, 0);
      g.fill();
      g.restore();
    };
    spike(c, 7, 0);
    spike(c, 7, Math.PI / 2);
    spike(c * 0.55, 4, Math.PI / 4);
    spike(c * 0.55, 4, -Math.PI / 4);
  });
}

/** Horizontal anamorphic lens streak */
export function streakTex(): THREE.Texture {
  return canvasTex('streak', 256, 32, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    for (let y = 0; y < h; y++) {
      const k = 1 - Math.abs(y / (h - 1) - 0.5) * 2;
      g.globalAlpha = k * k * k;
      g.fillStyle = lg;
      g.fillRect(0, y, w, 1);
    }
  });
}

/** Ground cracks radiating outward from the center (additive blending, laid on the ground) */
export function crackTex(seed = 0): THREE.Texture {
  return canvasTex(`crack${seed % 4}`, 512, 512, (g, s) => {
    const r = rng(seed + 11);
    const c = s / 2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.shadowColor = 'rgba(255,255,255,1)';
    g.shadowBlur = 10;
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      let px = x;
      let py = y;
      const steps = 6 + Math.floor(r() * 5);
      for (let i = 0; i < steps; i++) {
        a += (r() - 0.5) * 0.9;
        const l = len / steps;
        px += Math.cos(a) * l;
        py += Math.sin(a) * l;
        g.lineTo(px, py);
        if (depth < 2 && r() < 0.28) {
          g.stroke();
          branch(px, py, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * 0.45, w * 0.6, depth + 1);
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(px, py);
        }
      }
      g.stroke();
    };
    const n = 9 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) branch(c, c, (i / n) * Math.PI * 2 + r() * 0.4, s * (0.32 + r() * 0.16), 5 + r() * 3, 0);
    const glow = g.createRadialGradient(c, c, 0, c, c, s * 0.2);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.shadowBlur = 0;
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
  });
}

/** Long fissure: u runs along the length, v across the width */
export function fissureTex(): THREE.Texture {
  return canvasTex('fissure', 1024, 128, (g, w, h) => {
    const r = rng(7);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.shadowColor = 'rgba(255,255,255,1)';
    g.shadowBlur = 14;
    g.lineWidth = 9;
    g.beginPath();
    let y = h / 2;
    g.moveTo(0, y);
    const pts: [number, number][] = [];
    for (let x = 0; x <= w; x += 18) {
      y = h / 2 + (r() - 0.5) * h * 0.35;
      g.lineTo(x, y);
      pts.push([x, y]);
    }
    g.stroke();
    g.lineWidth = 3;
    for (const [x, py] of pts) {
      if (r() < 0.45) {
        g.beginPath();
        g.moveTo(x, py);
        let bx = x;
        let by = py;
        const dir = r() < 0.5 ? -1 : 1;
        for (let i = 0; i < 4; i++) {
          bx += (r() - 0.3) * 22;
          by += dir * (6 + r() * 10);
          g.lineTo(bx, by);
        }
        g.stroke();
      }
    }
  });
}

/** Fluffy cloud puff */
export function cloudTex(): THREE.Texture {
  return canvasTex('cloud', 256, 256, (g, s) => {
    const r = rng(3);
    for (let i = 0; i < 14; i++) {
      const x = s * (0.25 + r() * 0.5);
      const y = s * (0.3 + r() * 0.42);
      const rad = s * (0.12 + r() * 0.16);
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,0.55)');
      grd.addColorStop(0.6, 'rgba(255,255,255,0.25)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    }
  });
}

/** Vertical light beam (bright at the center, fading out at the sides and ends) */
export function rayTex(): THREE.Texture {
  return canvasTex('ray', 64, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      const end = Math.min(1, v * 6) * Math.min(1, (1 - v) * 1.6);
      const lg = g.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, `rgba(255,255,255,${end})`);
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, y, w, 1);
    }
  });
}
