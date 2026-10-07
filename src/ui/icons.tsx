// UI icons: skill types, status conditions, stats, effects. All are 24×24 inline SVG, colored from currentColor.

import type { CSSProperties } from 'react';

type IconDef = { fill?: string; stroke?: string; evenodd?: boolean };

export const ICONS: Record<string, IconDef> = {
  // Skill types
  physical: { fill: 'M20.6 2.4 21.6 3.4 21 7.2 11.6 16.6 7.4 12.4 16.8 3Z M5.2 11.3 12.7 18.8 11.3 20.2 3.8 12.7Z M8.3 16.6 9.4 17.7 5 22.1 3.9 21Z' },
  magic: { fill: 'M11 2c.8 5.2 4.3 8.7 9.5 9.5-5.2.8-8.7 4.3-9.5 9.5-.8-5.2-4.3-8.7-9.5-9.5C6.7 10.7 10.2 7.2 11 2Z M19 1.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z' },
  status: { fill: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.3a7.7 7.7 0 1 1 0 15.4 7.7 7.7 0 0 1 0-15.4Z M12 6.8 17.2 12 12 17.2 6.8 12Z', evenodd: true },
  trap: { fill: 'M6.5 2h11A2.5 2.5 0 0 1 20 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Zm5.5 5-3.8 5 3.8 5 3.8-5Z', evenodd: true },
  ultimate: { fill: 'M2.5 7.5 7.5 11 12 3.5 16.5 11l5-3.5-2 11.5h-15Z M4.8 20h14.4v2H4.8Z' },

  // Status conditions
  burn: { fill: 'M12 2c.7 3.3 3.3 4.7 4.7 7.4 1.9 3.6.4 9.1-4.7 10.1-5.1-1-6.6-5.6-4.9-9.1.5 1.4 1.5 2.2 2.5 2.4C8.7 9.1 10.1 5.2 12 2Z' },
  poison: { fill: 'M12 2.5s-6.5 7-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 9.5 12 2.5 12 2.5Zm-2.2 10a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Zm4.2-2.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z', evenodd: true },
  bleed: { fill: 'M5.5 3.5h2.4l5.6 17h-2.4Z M10.5 2.5h2.4l5.6 17h-2.4Z M16 5h2.3l3.5 10.5h-2.3Z' },
  freeze: { stroke: 'M12 2v20 M3.3 7l17.4 10 M3.3 17 20.7 7 M9.5 3.5 12 6l2.5-2.5 M9.5 20.5 12 18l2.5 2.5 M3.6 11 7 12l-1 3.4 M20.4 13 17 12l1-3.4 M3.6 13l3.4-1-1-3.4 M20.4 11 17 12l1 3.4' },
  sleep: { fill: 'M3 9h8v2l-5.2 6.2H11V19H3v-2l5.2-6.2H3Z M13 3h7v1.8l-4.4 5H20V11.6h-7V9.8l4.4-5H13Z' },
  fear: { fill: 'M12 2.5a7.5 7.5 0 0 0-7.5 7.5v11.5l2.5-2 2.5 2 2.5-2 2.5 2 2.5-2 2.5 2V10A7.5 7.5 0 0 0 12 2.5ZM9.3 8.5a1.5 1.9 0 1 1 0 3.8 1.5 1.9 0 0 1 0-3.8Zm5.4 0a1.5 1.9 0 1 1 0 3.8 1.5 1.9 0 0 1 0-3.8Z', evenodd: true },
  paralyze: { fill: 'M13.5 1.5 4 13.5h7l-1.5 9L19 10.5h-7Z' },
  root: { stroke: 'M10 14.5 7.3 17.2a3.4 3.4 0 0 1-4.8-4.8l3.6-3.6a3.4 3.4 0 0 1 4.8 0 M14 9.5l2.7-2.7a3.4 3.4 0 0 1 4.8 4.8l-3.6 3.6a3.4 3.4 0 0 1-4.8 0 M9 15l6-6' },
  silence: { stroke: 'M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h-1A1.5 1.5 0 0 1 3 14.5v-8A1.5 1.5 0 0 1 4.5 5Z M3 3l18 18' },
  taunt: { stroke: 'M9.5 3v3.6A2.9 2.9 0 0 1 6.6 9.5H3 M14.5 3v3.6a2.9 2.9 0 0 0 2.9 2.9H21 M9.5 21v-3.6a2.9 2.9 0 0 0-2.9-2.9H3 M14.5 21v-3.6a2.9 2.9 0 0 1 2.9-2.9H21' },
  curse: { fill: 'M12 20.8 10.7 19.6C5.8 15.2 2.5 12.3 2.5 8.7A4.9 4.9 0 0 1 7.4 3.8c1.4 0 2.8.6 3.8 1.6L9.6 9.6l2.8 2.2-1.9 3.9 4.4-4.6-2.7-2.2 1.6-3.4c.9-.9 2.1-1.4 3.4-1.4a4.9 4.9 0 0 1 4.9 4.9c0 3.6-3.3 6.5-8.2 10.9Z' },

  // Stats
  atk: { fill: 'M20.6 2.4 21.6 3.4 21 7.2 11.6 16.6 7.4 12.4 16.8 3Z M5.2 11.3 12.7 18.8 11.3 20.2 3.8 12.7Z M8.3 16.6 9.4 17.7 5 22.1 3.9 21Z' },
  mag: { fill: 'M11 2c.8 5.2 4.3 8.7 9.5 9.5-5.2.8-8.7 4.3-9.5 9.5-.8-5.2-4.3-8.7-9.5-9.5C6.7 10.7 10.2 7.2 11 2Z M19 1.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z' },
  def: { fill: 'M12 2 20 5v6.2c0 5-3.4 9.1-8 10.8-4.6-1.7-8-5.8-8-10.8V5Z' },
  res: { fill: 'M12 2 20 5v6.2c0 5-3.4 9.1-8 10.8-4.6-1.7-8-5.8-8-10.8V5Zm0 4.5c-.5 2.6-2 4.1-4.5 4.5 2.5.4 4 1.9 4.5 4.5.5-2.6 2-4.1 4.5-4.5-2.5-.4-4-1.9-4.5-4.5Z', evenodd: true },
  spd: { fill: 'M3 5.5h3.8l6.5 6.5-6.5 6.5H3L9.5 12Z M10.5 5.5h3.8l6.5 6.5-6.5 6.5h-3.8L17 12Z' },

  // Other states and effects
  shield: { fill: 'M12 2 20 5v6.2c0 5-3.4 9.1-8 10.8-4.6-1.7-8-5.8-8-10.8V5Z' },
  charge: { fill: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1.2 3.2L7.3 13.2h3.9l-1 5.6 6.5-8.3h-3.9Z', evenodd: true },
  charging: { fill: 'M6 2h12v2.5c0 3.2-2.3 5.2-4.2 7.5 1.9 2.3 4.2 4.3 4.2 7.5V22H6v-2.5c0-3.2 2.3-5.2 4.2-7.5C8.3 9.7 6 7.7 6 4.5Zm2.3 17.5h7.4c-.3-1.8-1.9-3.3-3.7-5-1.8 1.7-3.4 3.2-3.7 5Z', evenodd: true },
  seed: { stroke: 'M12 21v-8.5 M12 12.5C12 8 8.7 5.5 4 5.5c0 4.3 3.2 7 8 7Z M12 11c0-4 3-6.7 8-6.7 0 4-3.4 6.7-8 6.7Z' },
  tailwind: { stroke: 'M3 8.5h11a3 3 0 1 0-3-3 M3 12.5h15.5a3 3 0 1 1-3 3 M3 16.5h7' },
  heal: { fill: 'M12 21S3.5 15.6 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 6-8.5 11.4-8.5 11.4Zm-1-10.5v2.2H8.8v2H11v2.2h2v-2.2h2.2v-2H13v-2.2Z', evenodd: true },
  aether: { fill: 'M12 2 19 12 12 22 5 12Z' },
  field: { stroke: 'M12 3.5 19.5 8v8L12 20.5 4.5 16V8Z M12 3.5V12 M19.5 8 12 12 4.5 8' },
  cleanse: { fill: 'M9 3c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z M17.5 12c.4 2.2 1.3 3.1 3.5 3.5-2.2.4-3.1 1.3-3.5 3.5-.4-2.2-1.3-3.1-3.5-3.5 2.2-.4 3.1-1.3 3.5-3.5Z' },
  dispel: { fill: 'M12 2 20 5v6.2c0 5-3.4 9.1-8 10.8-4.6-1.7-8-5.8-8-10.8V5Zm1.2 3.5-3.4 6.2 3 .8-2 6 4.9-7.6-3-.9 1.4-4.5Z', evenodd: true },
  breakTrap: { fill: 'M6.5 2h11A2.5 2.5 0 0 1 20 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Zm2.3 5.4L7.4 8.8 10.6 12l-3.2 3.2 1.4 1.4 3.2-3.2 3.2 3.2 1.4-1.4-3.2-3.2 3.2-3.2-1.4-1.4-3.2 3.2Z', evenodd: true },
  eye: { fill: 'M12 5C6.5 5 3 9.7 2 12c1 2.3 4.5 7 10 7s9-4.7 10-7c-1-2.3-4.5-7-10-7Zm0 3.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z', evenodd: true },
  auto: { stroke: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3 M19.8 3.8v4h-4', fill: 'M10 8.6v6.8l5.4-3.4Z' },
  log: { stroke: 'M6 3.5h9.5L19 7v13.5H6Z M9 9.5h7 M9 13h7 M9 16.5h4.5' },
  swap: { stroke: 'M4 8h13 M13.5 4.5 17 8l-3.5 3.5 M20 16H7 M10.5 12.5 7 16l3.5 3.5' },
  stone: { fill: 'M8 2.5h8l4.5 6.5L12 21.5 3.5 9Z M8.8 4.5 6.5 8.5h11l-2.3-4Z', evenodd: true },
  up: { fill: 'M12 5 20 17H4Z' },
  down: { fill: 'M12 19 4 7h16Z' },
  skull: { fill: 'M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.7 1.3 4.6 3.3 5.8V20c0 .8.7 1.5 1.5 1.5h7.4c.8 0 1.5-.7 1.5-1.5v-3.7c2-1.2 3.3-3.1 3.3-5.8 0-4.6-3.5-8-8.5-8Zm-3.3 7.3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6.6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z', evenodd: true },
  art: { fill: 'M12 2.5 14.6 9 21.5 9.3 16.1 13.6 18 20.3 12 16.5 6 20.3 7.9 13.6 2.5 9.3 9.4 9Z' },
  // Progress states (replace the emoji lock and check mark, so every platform draws the same thing)
  lock: { fill: 'M12 2a5 5 0 0 0-5 5v3H6a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 6 22h12a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 18 10h-1V7a5 5 0 0 0-5-5Zm-2.8 8V7a2.8 2.8 0 0 1 5.6 0v3Zm2.8 3.2a1.8 1.8 0 0 1 1 3.3V19h-2v-2.5a1.8 1.8 0 0 1 1-3.3Z', evenodd: true },
  check: { stroke: 'M4.5 12.5 9.5 17.5 19.5 6.5' },
};

export function Icon({ name, size = 18, style, className }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  const def = ICONS[name];
  if (!def) return null;
  return (
    <svg className={`ico ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {def.fill && <path d={def.fill} fill="currentColor" fillRule={def.evenodd ? 'evenodd' : undefined} />}
      {def.stroke && <path d={def.stroke} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** Status conditions: name, color, one-line description */
export const STATUS_INFO: Record<string, { name: string; color: string; text: string }> = {
  burn: { name: '灼燒', color: '#ff6a2a', text: '回合結束時失去 6% 最大生命，造成的武技傷害 −20%。' },
  poison: { name: '中毒', color: '#b060ff', text: '回合結束時每層失去 3% 最大生命，最多 5 層；離場時層數減半。' },
  bleed: { name: '裂傷', color: '#ff3a5a', text: '每次使用技能後失去 5% 最大生命。' },
  freeze: { name: '冰凍', color: '#7fe6ff', text: '無法使用下一次技能；受到火屬性攻擊時立即解除。' },
  sleep: { name: '睡眠', color: '#8a9aff', text: '最多無法使用 2 次技能；受到攻擊傷害時醒來。' },
  fear: { name: '恐懼', color: '#8a50d0', text: '下一次行動無法使用攻擊技能與奧義（可使用秘術或替換）。' },
  paralyze: { name: '麻痺', color: '#ffd23a', text: '速度 −50%，技能的先制視為 0。' },
  root: { name: '束縛', color: '#c8955a', text: '無法替換（包括攻擊後替換）。' },
  silence: { name: '沉默', color: '#f0e090', text: '無法使用魔法與秘術。' },
  taunt: { name: '挑釁', color: '#ff5a3a', text: '只能使用攻擊技能與奧義，且無法設置伏技。' },
  curse: { name: '詛咒', color: '#b03aa8', text: '無法回復生命、提升能力或獲得護盾。' },
};

export const STAT_INFO: Record<string, { name: string; text: string }> = {
  atk: { name: '力量', text: '武技傷害' },
  mag: { name: '魔力', text: '魔法傷害' },
  def: { name: '護甲', text: '承受武技的傷害' },
  res: { name: '抗魔', text: '承受魔法的傷害' },
  spd: { name: '速度', text: '出手順序' },
};

/** Effects of status skills and traps (icon + name, at most 3) */
export function effectIcons(tags: Record<string, number>): { icon: string; color: string; label: string; up?: boolean; down?: boolean }[] {
  const out: { icon: string; color: string; label: string; up?: boolean; down?: boolean }[] = [];
  const push = (icon: string, color: string, label: string, extra: { up?: boolean; down?: boolean } = {}) => {
    if (out.length < 3 && !out.some((o) => o.label === label)) out.push({ icon, color, label, ...extra });
  };
  for (const k of Object.keys(tags)) {
    if (k.startsWith('status.')) {
      const st = k.slice(7);
      push(st, STATUS_INFO[st]?.color ?? '#fff', STATUS_INFO[st]?.name ?? st);
    }
  }
  for (const [k, v] of Object.entries(tags)) {
    if (k.startsWith('self.')) push(k.slice(5), '#ffd978', `${STAT_INFO[k.slice(5)]?.name ?? ''} ${v > 0 ? '+' : ''}${v}`, { up: v > 0 });
    else if (k.startsWith('foe.')) push(k.slice(4), '#9ab0ff', `敵${STAT_INFO[k.slice(4)]?.name ?? ''} ${v}`, { down: v < 0 });
    else if (k === 'heal') push('heal', '#7dffa0', `回復 ${v}%`);
    else if (k === 'teamHeal') push('heal', '#7dffa0', '全隊回復');
    else if (k === 'lifeSave') push('heal', '#7dffa0', '免死');
    else if (k === 'shield') push('shield', '#8fe0ff', `護盾 ${v}%`);
    else if (k === 'block') push('shield', '#8fe0ff', '格擋');
    else if (k === 'reduce') push('shield', '#8fe0ff', `減傷 ${Math.round(v * 100)}%`);
    else if (k === 'reflect') push('shield', '#8fe0ff', '反彈');
    else if (k === 'aeGain') push('aether', '#8fe0ff', `靈能 +${Math.max(1, Math.floor(v))}`);
    else if (k === 'field') push('field', '#ffe7a0', '場地');
    else if (k === 'cleanse' || k === 'teamCleanse') push('cleanse', '#fff6c8', '淨化異常');
    else if (k === 'dispel') push('dispel', '#ffb0b0', '驅散');
    else if (k === 'destroyTrap') push('breakTrap', '#d8b8ff', '破壞伏技');
    else if (k === 'negateTrap') push('breakTrap', '#d8b8ff', '反制伏技');
    else if (k === 'negateSkill') push('breakTrap', '#d8b8ff', '反制技能');
    else if (k === 'revealTrap') push('eye', '#d8b8ff', '看穿伏技');
    else if (k === 'charges') push('charge', '#fff09a', `電荷 +${v}`);
    else if (k === 'side') push('tailwind', '#b8fff0', '順風');
    else if (k === 'trueDamage') push('skull', '#ffb0b0', `傷害 ${v}%`);
    else if (k === 'pivot') push('swap', '#fff', '替換');
  }
  return out;
}

/** Key badges on the front of a skill card (at most 2): priority, inflicted condition and chance, recoil, charging, crit, drain, etc. */
export function cardTags(sk: { priority: number; accuracy: number; tags: Record<string, number>; category: string }): { icon: string; color: string; label?: string; title: string }[] {
  const out: { icon: string; color: string; label?: string; title: string }[] = [];
  const t = sk.tags;
  if (sk.priority > 0) out.push({ icon: 'spd', color: '#b8fff0', label: `+${sk.priority}`, title: `先制 +${sk.priority}` });
  if (sk.priority < 0) out.push({ icon: 'spd', color: '#a8a8c0', label: `${sk.priority}`, title: `先制 ${sk.priority}` });
  for (const [k, v] of Object.entries(t)) {
    if (!k.startsWith('status.')) continue;
    const st = k.slice(7);
    const info = STATUS_INFO[st];
    if (info) out.push({ icon: st, color: info.color, label: v < 1 ? `${Math.round(v * 100)}%` : undefined, title: `${v < 1 ? `${Math.round(v * 100)}% ` : ''}${info.name}` });
  }
  if (t.recoil) out.push({ icon: 'skull', color: '#ff8a8a', title: '反衝' });
  if (t.charge) out.push({ icon: 'charging', color: '#e8e0ff', title: '蓄力' });
  if (t.critRate) out.push({ icon: 'art', color: '#ffb040', label: `${Math.round(t.critRate * 100)}%`, title: `暴擊率 +${Math.round(t.critRate * 100)}%` });
  if (t.drain) out.push({ icon: 'heal', color: '#7dffa0', title: '吸血' });
  if (t.hits) out.push({ icon: 'physical', color: '#ffd0a0', label: `×${t.hits}`, title: `連擊 ${t.hits} 次` });
  if (t.ignoreGuard || t.armorPen) out.push({ icon: 'dispel', color: '#ffb0b0', title: t.ignoreGuard ? '無視格擋' : '無視部分防禦' });
  if (t.dispel) out.push({ icon: 'dispel', color: '#ffb0b0', title: '驅散' });
  if (t.charges && t.charges > 0) out.push({ icon: 'charge', color: '#ffe45a', label: `+${t.charges}`, title: `電荷 +${t.charges}` });
  if (t.pivot) out.push({ icon: 'swap', color: '#ffffff', title: '攻擊後替換' });
  if (sk.accuracy < 100 && out.length < 2) out.push({ icon: 'eye', color: '#e0e0ff', label: `${sk.accuracy}%`, title: `命中 ${sk.accuracy}%` });
  return out.slice(0, 3);
}
