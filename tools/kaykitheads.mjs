// Heads for the map characters (face, features, hair, beard): use the head meshes of KayKit Character Pack: Adventurers directly, written to src/render/field/kaykitHeads.ts.
// Source: KayKit Character Pack: Adventurers 1.0 by Kay Lousberg (www.kaylousberg.com), licensed CC0 1.0 (public domain, commercial use allowed, no attribution required).
// The original files (GLB, textures) are not in the repo; only this tool and the slimmed-down converted data are kept. After downloading, point at the Characters/gltf folder:
//   node tools/kaykitheads.mjs <…/kaykit_character_pack_adventures/Characters/gltf> [output file, default src/render/field/kaykitHeads.ts] [--dump]
//
// How it works:
// 1. Read the head meshes of the four characters (Knight: short hair; Rogue: long hair; Mage: a tuft tied at the back of the head; Barbarian: bald with a beard), normalized by HEAD_BOX in headData.ts,
//    so they share the coordinates of the game's HeadShape (half-width, half-height and half-depth all 1, +z forward).
// 2. KayKit's colors are one palette texture (8 × 8 cells, each with a vertical gradient); which cell a triangle's UV falls in decides whether it is skin, hair, eyes or an accessory;
//    brows share the hair color, so they are separated out by the position of their connected component (a small piece above the eyes, in front of the face); the nose is likewise separated from the skin by position.
// 3. Each vertex stores a shade value (the brightness of the texture at that point ÷ the brightest point in that cell); the game multiplies it by the character's own skin and hair colors, keeping the original gradient.
// 4. Vertices use Int16 (× 1e4), shade uses Uint8, indices use Uint16, all converted to base64.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const dump = args.includes('--dump');
const [dir, out = 'src/render/field/kaykitHeads.ts'] = args.filter((a) => !a.startsWith('--'));
if (!dir) throw new Error('Usage: node tools/kaykitheads.mjs <KayKit Characters/gltf folder> [output file] [--dump]');

// Normalization from headData.ts (the same skull)
const hd = readFileSync('src/render/field/headData.ts', 'utf8');
const box = JSON.parse(hd.match(/HEAD_BOX = (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":'));

function readGlb(file) {
  const b = readFileSync(file);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const o = 20 + jl;
  const bl = b.readUInt32LE(o);
  return { json, bin: b.subarray(o + 8, o + 8 + bl) };
}
const COMP = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function accessor({ json, bin }, i) {
  const a = json.accessors[i];
  const bv = json.bufferViews[a.bufferView];
  const size = COMP[a.componentType];
  const n = NUM[a.type];
  const stride = bv.byteStride || size * n;
  const base = bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const dv = new DataView(bin.buffer);
  const r = new Array(a.count * n);
  for (let k = 0; k < a.count; k++)
    for (let c = 0; c < n; c++) {
      const at = base + k * stride + c * size;
      r[k * n + c] = a.componentType === 5126 ? dv.getFloat32(at, true) : a.componentType === 5123 ? dv.getUint16(at, true) : a.componentType === 5125 ? dv.getUint32(at, true) : dv.getUint8(at);
    }
  return r;
}

/** Palette texture: converted to raw RGB with magick */
function texture(file) {
  const raw = execFileSync('magick', [file, '-depth', '8', 'rgb:-'], { maxBuffer: 1 << 26 });
  return (u, v) => {
    const x = Math.min(1023, Math.max(0, Math.floor(u * 1024)));
    const y = Math.min(1023, Math.max(0, Math.floor(v * 1024)));
    const i = (y * 1024 + x) * 3;
    return [raw[i], raw[i + 1], raw[i + 2]];
  };
}
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * The four heads: cells maps a palette cell → role (skin: skin, hair: hair, eye: eyes, beard: beard, trim: accessories).
 * A small connected component among the hair cells, in front of the face and above the eyes, is a brow (brow).
 */
const HEADS = {
  knight: { file: 'Knight.glb', node: 'Knight_Head', tex: 'knight_texture.png', cells: { '0,0': 'skin', '0,1': 'skin', '1,0': 'hair', '1,1': 'hair', '2,0': 'eye', '2,1': 'eye' } },
  rogue: { file: 'Rogue.glb', node: 'Rogue_Head', tex: 'rogue_texture.png', cells: { '0,0': 'skin', '0,1': 'skin', '1,0': 'hair', '1,1': 'hair', '2,0': 'eye', '3,0': 'trim' } },
  mage: { file: 'Mage.glb', node: 'Mage_Head', tex: 'mage_texture.png', tail: true, cells: { '0,0': 'skin', '0,1': 'skin', '1,0': 'hair', '1,1': 'hair', '2,0': 'eye', '1,2': 'trim', '1,3': 'trim' } },
  barbarian: { file: 'Barbarian.glb', node: 'Barbarian_Head', tex: 'barbarian_texture.png', cells: { '0,0': 'skin', '0,1': 'skin', '1,0': 'beard', '1,1': 'beard', '2,0': 'eye', '2,1': 'eye' } },
};

const norm = (p) => [(p[0] - box.c[0]) / box.h[0], (p[1] - box.c[1]) / box.h[1], (p[2] - box.c[2]) / box.h[2]];

function extract(name, spec) {
  const g = readGlb(path.join(dir, spec.file));
  const tex = texture(path.join(dir, spec.tex));
  const node = g.json.nodes.find((n) => n.name === spec.node);
  const prim = g.json.meshes[node.mesh].primitives[0];
  const pos = accessor(g, prim.attributes.POSITION);
  const uv = accessor(g, prim.attributes.TEXCOORD_0);
  const idx = accessor(g, prim.indices);
  const P = [];
  for (let i = 0; i < pos.length; i += 3) P.push(norm([pos[i], pos[i + 1], pos[i + 2]]));
  const UV = [];
  for (let i = 0; i < uv.length; i += 2) UV.push([uv[i], uv[i + 1]]);
  const T = [];
  for (let i = 0; i < idx.length; i += 3) T.push([idx[i], idx[i + 1], idx[i + 2]]);
  // Palette cell and role of each triangle
  const cellOf = (t) => {
    const u = (UV[t[0]][0] + UV[t[1]][0] + UV[t[2]][0]) / 3;
    const v = (UV[t[0]][1] + UV[t[1]][1] + UV[t[2]][1]) / 3;
    return `${Math.floor(u * 8) & 7},${Math.floor(v * 8) & 7}`;
  };
  const role = T.map((t) => spec.cells[cellOf(t)] ?? 'skin');
  // Connected components (welded by position): separate out the brows, and tell the eyes apart left and right
  const key = new Map();
  const wid = P.map((p) => {
    const k = p.map((x) => Math.round(x * 1e4)).join(',');
    if (!key.has(k)) key.set(k, key.size);
    return key.get(k);
  });
  const parent = Array.from({ length: key.size }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  T.forEach(([a, b, c], i) => {
    for (const [u, v] of [[a, b], [b, c]]) {
      if (role[i] === 'eye') continue;
      const ru = find(wid[u]);
      const rv = find(wid[v]);
      if (ru !== rv) parent[ru] = rv;
    }
  });
  const comps = new Map();
  T.forEach((t, i) => {
    const r = role[i] === 'eye' ? `eye${i}` : find(wid[t[0]]);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(i);
  });
  const bbox = (tris) => {
    const lo = [9, 9, 9];
    const hi = [-9, -9, -9];
    for (const ti of tris) for (const vi of T[ti]) for (let c = 0; c < 3; c++) (lo[c] = Math.min(lo[c], P[vi][c])), (hi[c] = Math.max(hi[c], P[vi][c]));
    return { lo, hi, mid: lo.map((l, c) => (l + hi[c]) / 2) };
  };
  for (const tris of comps.values()) {
    // Nose: a small piece of skin in the middle of the front of the face, below the eyes (stored separately; removed under a mask, shrunk for children)
    if (role[tris[0]] === 'skin' && tris.length < 100) {
      const b = bbox(tris);
      if (b.mid[2] > 0.6 && Math.abs(b.mid[0]) < 0.1 && b.mid[1] < 0) for (const ti of tris) role[ti] = 'nose';
      continue;
    }
    if ((role[tris[0]] !== 'hair' && role[tris[0]] !== 'beard') || tris.length > 100) continue;
    const b = bbox(tris);
    // Brow: a small piece in front of the face (z > 0.6), above the eyes (y −0.1 to 0.3), off to one side
    if (b.mid[2] > 0.6 && b.mid[1] > -0.1 && b.mid[1] < 0.3 && Math.abs(b.mid[0]) > 0.15 && Math.abs(b.mid[0]) < 0.75) for (const ti of tris) role[ti] = 'brow';
  }
  if (dump) {
    console.log(`== ${name}`);
    for (const [k, tris] of comps) {
      if (String(k).startsWith('eye')) continue;
      const b = bbox(tris);
      const cells = [...new Set(tris.map((ti) => cellOf(T[ti])))];
      console.log(`  ${String(tris.length).padStart(4)} tris ${[...new Set(tris.map((ti) => role[ti]))].join('/')} cells ${cells.join(' ')} mid ${b.mid.map((x) => x.toFixed(2))} size ${b.hi.map((h, c) => (h - b.lo[c]).toFixed(2))}`);
    }
    const eyes = T.filter((_, i) => role[i] === 'eye').flat();
    const e = bbox(T.map((_, i) => i).filter((i) => role[i] === 'eye' && P[T[i][0]][0] > 0));
    console.log(`  eyes ${eyes.length / 3} tris, +x eye mid ${e.mid.map((x) => x.toFixed(3))} size ${e.hi.map((h, c) => (h - e.lo[c]).toFixed(3))}`);
  }
  // The tuft hanging from the back of the Mage's head (below the hair tie, at the back of the head) is split out separately: removed for anyone whose hair is not tied
  if (spec.tail) T.forEach((t, i) => {
    if (role[i] !== 'hair') return;
    const y = (P[t[0]][1] + P[t[1]][1] + P[t[2]][1]) / 3;
    const z = (P[t[0]][2] + P[t[1]][2] + P[t[2]][2]) / 3;
    if (y < -0.62 && z < -0.95) role[i] = 'tail';
  });
  // Shade of each vertex: texture brightness ÷ the brightest point of the same part (hair has two cells; the darker cell stays darker)
  const vrole = new Array(P.length);
  T.forEach((t, i) => {
    for (const vi of t) vrole[vi] = role[i];
  });
  const vl = UV.map(([u, v]) => lum(tex(u, v)));
  const roleMax = new Map();
  vrole.forEach((r, vi) => roleMax.set(r, Math.max(roleMax.get(r) ?? 0, vl[vi])));
  const shade = vl.map((l, vi) => Math.round(Math.min(255, (l / Math.max(1, roleMax.get(vrole[vi]))) * 255)));
  // Triangles of each role
  const groups = {};
  T.forEach((t, i) => (groups[role[i]] ??= []).push(...t));
  return { P, shade, groups };
}

const b64 = (T, arr) => Buffer.from(new T(arr).buffer).toString('base64');
let ts = `// Auto-generated: node tools/kaykitheads.mjs (do not edit by hand; to change it, change the tool and rerun).
// Source: KayKit Character Pack: Adventurers 1.0, Kay Lousberg (www.kaylousberg.com), licensed CC0 1.0 (public domain,
// commercial use allowed, no attribution required).
// Four head meshes (Knight, Rogue, Mage, Barbarian), with coordinates normalized by HEAD_BOX in headData.ts (half-width,
// half-height and half-depth are all 1, +z faces front, +y faces up).
// pos: Int16 (÷ 1e4); shade: Uint8 (÷ 255, the gradient of the original palette); groups: each part's triangle indices (Uint16). All are base64.
// Normals are not stored: the original is low-poly with hard edges, so in the game the smooth normals are recomputed after
// welding by position (kaykitHead.ts).

export type KayKitRole = 'skin' | 'nose' | 'hair' | 'tail' | 'brow' | 'eye' | 'beard' | 'trim';
export interface KayKitHeadData {
  pos: string;
  shade: string;
  groups: Partial<Record<KayKitRole, string>>;
}

export const KAYKIT_HEADS = {
`;
for (const [name, spec] of Object.entries(HEADS)) {
  const { P, shade, groups } = extract(name, spec);
  const gs = Object.entries(groups)
    .map(([r, idx]) => `${r}: '${b64(Uint16Array, idx)}'`)
    .join(', ');
  ts += `  ${name}: { pos: '${b64(Int16Array, P.flat().map((x) => Math.round(x * 1e4)))}', shade: '${b64(Uint8Array, shade)}', groups: { ${gs} } },\n`;
  console.log(`${name}: ${P.length} vertices, ${Object.entries(groups).map(([r, i]) => `${r} ${i.length / 3}`).join(', ')} faces`);
}
ts += `} satisfies Record<string, KayKitHeadData>;

export type KayKitHead = keyof typeof KAYKIT_HEADS;
`;
if (!dump) {
  writeFileSync(out, ts);
  console.log(`wrote ${out} (${(ts.length / 1024).toFixed(1)} KB)`);
}
