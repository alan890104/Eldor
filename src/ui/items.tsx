// Currency and items: coloured icon, name, use and how to get it. Shared by the resource bar, summon, results, quests and the Bag.

import { useId, type ReactNode } from 'react';
import type { SaveData } from '../game/save.ts';
import { showPop } from './glossary.tsx';

export type ItemId = 'gold' | 'crystals' | 'tickets' | 'breakStones' | 'shards' | 'potions' | 'stardust' | 'stoneBasic' | 'stoneAdvanced' | 'stoneMaster';

export interface ItemDef {
  id: ItemId;
  name: string;
  color: string;
  kind: '貨幣' | '召喚' | '培養' | '捕捉';
  desc: string;
  use: string;
  source: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  gold: { id: 'gold', name: '金幣', color: '#ffd24a', kind: '貨幣', desc: '艾爾多大陸的通用貨幣。', use: '精靈突破', source: '伏魔塔、野外戰鬥、寶箱、競技場、任務' },
  crystals: { id: 'crystals', name: '星輝石', color: '#7fc8ff', kind: '召喚', desc: '蘊含星光的寶石，可代替契約券進行星門召喚。', use: '星門召喚：每次消耗 150 個', source: '關卡首次通關、競技場、任務' },
  tickets: { id: 'tickets', name: '契約券', color: '#ff8ad8', kind: '召喚', desc: '星門召喚專用的券。召喚時先使用契約券，契約券不足的次數以星輝石補足（每次 150 個）。', use: '星門召喚：每次消耗 1 張', source: '劇情獎勵、源晶試煉、競技場、任務' },
  breakStones: { id: 'breakStones', name: '突破石', color: '#ff9a4a', kind: '培養', desc: '蝕化精靈身上碎掉的結晶凝成的石頭，精靈突破的必要素材。', use: '精靈突破', source: '蝕化精靈、伏魔塔、野外戰鬥、寶箱、任務' },
  shards: { id: 'shards', name: '源晶碎片', color: '#5ff0d0', kind: '培養', desc: '源晶剝落的碎片，第二次突破的稀有素材。', use: '第二次突破', source: '教團關卡、源晶試煉、任務' },
  potions: { id: 'potions', name: '經驗藥水', color: '#7dff8a', kind: '培養', desc: '使用後立即獲得大量經驗值，相當於擊倒 4 隻同等級野生精靈。', use: '在背包中對精靈使用', source: '伏魔塔、野外戰鬥、寶箱、任務' },
  stardust: { id: 'stardust', name: '星塵', color: '#fff2a8', kind: '召喚', desc: '精靈共鳴達到 R5 後再次取得時轉換而成。', use: '在背包中兌換契約券（30 個兌換 1 張）', source: '重複取得共鳴已滿的精靈' },
  stoneBasic: { id: 'stoneBasic', name: '契約石', color: '#5ab8ff', kind: '捕捉', desc: '捕捉野生精靈的道具，成功率 ×1。', use: '野生戰鬥中點選「捕捉」', source: '伏魔塔、野外寶箱、任務' },
  stoneAdvanced: { id: 'stoneAdvanced', name: '高級契約石', color: '#c070ff', kind: '捕捉', desc: '品質較高的契約石，成功率 ×1.5。', use: '野生戰鬥中點選「捕捉」', source: '蝕化樓層、野外戰鬥（機率掉落）、寶箱、任務' },
  stoneMaster: { id: 'stoneMaster', name: '大師契約石', color: '#ffc24a', kind: '捕捉', desc: '最高級的契約石，成功率 ×2.5。無法捕捉 SSR 精靈。', use: '野生戰鬥中點選「捕捉」', source: '源晶試煉首次通關、任務' },
};

export const ITEM_ORDER: ItemId[] = ['tickets', 'crystals', 'gold', 'stardust', 'breakStones', 'shards', 'potions', 'stoneBasic', 'stoneAdvanced', 'stoneMaster'];

export function itemCount(d: SaveData, id: ItemId): number {
  switch (id) {
    case 'stoneBasic':
      return d.inv.stones.basic;
    case 'stoneAdvanced':
      return d.inv.stones.advanced;
    case 'stoneMaster':
      return d.inv.stones.master;
    default:
      return d.inv[id];
  }
}

/** Coloured item icon (24×24) */
export function ItemIcon({ id, size = 20 }: { id: ItemId; size?: number }) {
  const g = `ig${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const svg = (children: ReactNode, defs: ReactNode) => (
    <svg className="item-ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>{defs}</defs>
      {children}
    </svg>
  );
  const lin = (a: string, b: string, x2 = '0', y2 = '1') => (
    <linearGradient id={g} x1="0" y1="0" x2={x2} y2={y2}>
      <stop offset="0" stopColor={a} />
      <stop offset="1" stopColor={b} />
    </linearGradient>
  );
  switch (id) {
    case 'gold':
      return svg(
        <>
          <circle cx="12" cy="12" r="10" fill={`url(#${g})`} stroke="#8a5a0a" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="7" fill="none" stroke="#fff3c0" strokeOpacity=".7" strokeWidth="1.2" />
          <path d="M12 7.2l1.4 3 3.2.3-2.4 2.1.7 3.2L12 14.2 9.1 15.8l.7-3.2-2.4-2.1 3.2-.3z" fill="#fff6d0" />
        </>,
        lin('#ffe88a', '#d08a18'),
      );
    case 'crystals':
      return svg(
        <>
          <path d="M12 2 20 8.5 12 22 4 8.5Z" fill={`url(#${g})`} stroke="#2a4aa8" strokeWidth="1" />
          <path d="M4 8.5h16M12 2 9 8.5 12 22 15 8.5Z" fill="none" stroke="#e8f8ff" strokeOpacity=".75" strokeWidth=".9" />
          <path d="M18.5 2.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="#fff" />
        </>,
        lin('#d8f6ff', '#4a74ff'),
      );
    case 'tickets':
      return svg(
        <>
          <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V9a3 3 0 0 0 0 6v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V15a3 3 0 0 0 0-6Z" fill={`url(#${g})`} stroke="#7a2a9a" strokeWidth="1" />
          <path d="M15.5 6v12" stroke="#fff" strokeOpacity=".6" strokeDasharray="1.5 1.5" />
          <path d="M9.5 8.2l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="#fff8ff" />
        </>,
        lin('#ffc0ec', '#a050f0', '1', '1'),
      );
    case 'breakStones':
      return svg(
        <>
          <path d="M12 2.5 19.5 9 17 20H7L4.5 9Z" fill={`url(#${g})`} stroke="#8a2a08" strokeWidth="1" />
          <path d="M12 7v9M8.8 10.2 12 7l3.2 3.2" fill="none" stroke="#fff4d8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>,
        lin('#ffd08a', '#e04818'),
      );
    case 'shards':
      return svg(
        <>
          <path d="M9 3l3.5 6-2 11-4-8.5Z" fill={`url(#${g})`} stroke="#1a7a68" strokeWidth=".9" />
          <path d="M15.5 6l3.5 5-3 8.5-3-6.5Z" fill={`url(#${g})`} stroke="#1a7a68" strokeWidth=".9" />
          <path d="M9 3l1.2 8.5M15.5 6l.4 7" stroke="#eafff8" strokeOpacity=".8" strokeWidth=".8" />
        </>,
        lin('#d0fff4', '#20b894'),
      );
    case 'potions':
      return svg(
        <>
          <path d="M9.5 2.5h5v2h-1v3.3a7 7 0 1 1-3 0V4.5h-1z" fill="#e8f4ff" fillOpacity=".25" stroke="#dff" strokeWidth="1" />
          <path d="M6.2 14a5.8 5.8 0 0 0 11.6 0Z" fill={`url(#${g})`} />
          <circle cx="10" cy="15.5" r="1.1" fill="#fff" fillOpacity=".8" />
          <circle cx="13.5" cy="17" r=".8" fill="#fff" fillOpacity=".7" />
        </>,
        lin('#b8ff9a', '#1ea84a'),
      );
    case 'stardust':
      return svg(
        <>
          <path d="M9 3c.5 3.4 2.4 5.3 5.8 5.8-3.4.5-5.3 2.4-5.8 5.8-.5-3.4-2.4-5.3-5.8-5.8C6.6 8.3 8.5 6.4 9 3Z" fill={`url(#${g})`} />
          <path d="M17 11c.4 2.2 1.5 3.3 3.7 3.7-2.2.4-3.3 1.5-3.7 3.7-.4-2.2-1.5-3.3-3.7-3.7 2.2-.4 3.3-1.5 3.7-3.7Z" fill={`url(#${g})`} />
          <circle cx="8" cy="18.5" r="1.3" fill="#fff6c8" />
        </>,
        lin('#ffffff', '#ffc94a'),
      );
    case 'stoneBasic':
    case 'stoneAdvanced':
    case 'stoneMaster': {
      const [a, b, s] = id === 'stoneBasic' ? ['#bfe8ff', '#2a82e0', '#10407a'] : id === 'stoneAdvanced' ? ['#ecc8ff', '#8a40e0', '#4a1a8a'] : ['#fff0b0', '#e09818', '#7a4a08'];
      return svg(
        <>
          <path d="M8 3h8l4.5 6L12 21.5 3.5 9Z" fill={`url(#${g})`} stroke={s} strokeWidth="1" />
          <path d="M3.5 9h17M8 3l1.8 6L12 21.5 14.2 9 16 3" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth=".8" />
          {id === 'stoneMaster' && <path d="M12 10.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="#fff" />}
        </>,
        lin(a, b),
      );
    }
  }
}

/** Shows an item's description next to an element (name, description, use, source) */
export function showItemInfo(id: ItemId, count: number | undefined, el: HTMLElement): void {
  const d = ITEMS[id];
  const r = el.getBoundingClientRect();
  showPop(
    {
      title: count !== undefined ? `${d.name}　×${count.toLocaleString()}` : d.name,
      color: d.color,
      icon: <ItemIcon id={id} size={18} />,
      lines: [d.desc, `用途：${d.use}`, `取得：${d.source}`],
    },
    r.left + r.width / 2,
    r.bottom > window.innerHeight / 2 ? r.top : r.bottom + 4,
    r.bottom > window.innerHeight / 2,
  );
}

/** A resource amount (top resource bar, rewards, etc.): hover or tap to show the description */
export function ItemAmount({ id, amount, plus, className }: { id: ItemId; amount: number; plus?: boolean; className?: string }) {
  return (
    <span
      className={`item-amt ${className ?? ''}`}
      style={{ ['--ic' as string]: ITEMS[id].color }}
      onMouseEnter={(e) => showItemInfo(id, plus ? undefined : amount, e.currentTarget)}
      onMouseLeave={() => showPop(null)}
      onClick={(e) => {
        e.stopPropagation();
        showItemInfo(id, plus ? undefined : amount, e.currentTarget);
      }}
    >
      <ItemIcon id={id} size={18} />
      <b>{plus ? '+' : ''}{amount.toLocaleString()}</b>
    </span>
  );
}

export function rewardItems(r: { gold?: number; crystals?: number; tickets?: number; breakStones?: number; shards?: number; potions?: number; stones?: number; advStones?: number; masterStones?: number }): { id: ItemId; n: number }[] {
  const out: { id: ItemId; n: number }[] = [];
  const add = (id: ItemId, n?: number) => n && n > 0 && out.push({ id, n });
  add('gold', r.gold);
  add('crystals', r.crystals);
  add('tickets', r.tickets);
  add('breakStones', r.breakStones);
  add('shards', r.shards);
  add('potions', r.potions);
  add('stoneBasic', r.stones);
  add('stoneAdvanced', r.advStones);
  add('stoneMaster', r.masterStones);
  return out;
}

/** An icon row for a set of rewards */
export function RewardRow({ reward }: { reward: Parameters<typeof rewardItems>[0] }) {
  return (
    <span className="reward-row">
      {rewardItems(reward).map((x) => (
        <ItemAmount key={x.id} id={x.id} amount={x.n} plus />
      ))}
    </span>
  );
}
