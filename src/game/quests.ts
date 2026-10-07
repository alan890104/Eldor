// Quests (achievements): long-term goals and rewards. Progress is all derived from the save; only a few actions need counting.

import { SPIRITS } from '../data.ts';
import { ARENA } from './arena.ts';
import { REGIONS, type Reward } from './campaign.ts';
import type { SaveData } from './save.ts';

export type QuestGroup = '冒險' | '收集' | '培養' | '競技';

export interface Quest {
  id: string;
  group: QuestGroup;
  name: string;
  desc: string;
  target: number;
  progress: (d: SaveData) => number;
  reward: Reward;
}

const owned = (d: SaveData) => Object.values(d.dex).filter((v) => v === 'owned').length;
const bossesCleared = (d: SaveData) => REGIONS.reduce((n, r) => n + r.stages.filter((s) => s.kind === 'boss' && d.cleared[s.id]).length, 0);
const maxLevel = (d: SaveData) => d.spirits.reduce((m, s) => Math.max(m, s.level), 0);
const countLevel = (d: SaveData, lv: number) => d.spirits.filter((s) => s.level >= lv).length;
const maxStage = (d: SaveData) => d.spirits.reduce((m, s) => Math.max(m, s.stage), 0);

export const QUESTS: Quest[] = [
  { id: 'boss1', group: '冒險', name: '第一枚源晶', desc: '通過 1 個源晶試煉', target: 1, progress: bossesCleared, reward: { gold: 1000, crystals: 200 } },
  { id: 'boss3', group: '冒險', name: '源晶收集者', desc: '通過 3 個源晶試煉', target: 3, progress: bossesCleared, reward: { gold: 2000, tickets: 2 } },
  { id: 'boss6', group: '冒險', name: '半途的誓約', desc: '通過 6 個源晶試煉', target: 6, progress: bossesCleared, reward: { gold: 4000, tickets: 3 } },
  { id: 'boss9', group: '冒險', name: '碎心之夜的終結', desc: '擊敗無冕者', target: 9, progress: bossesCleared, reward: { gold: 8000, crystals: 1000 } },
  { id: 'explore10', group: '冒險', name: '四處走走', desc: '在野外和野生精靈戰鬥 10 次', target: 10, progress: (d) => d.stats.explores, reward: { gold: 800, stones: 10 } },
  { id: 'explore40', group: '冒險', name: '大陸漫遊者', desc: '在野外和野生精靈戰鬥 40 次', target: 40, progress: (d) => d.stats.explores, reward: { gold: 3000, breakStones: 10 } },
  { id: 'wins50', group: '冒險', name: '百戰之始', desc: '贏得 50 場戰鬥', target: 50, progress: (d) => d.stats.wins, reward: { gold: 3000, tickets: 3 } },

  { id: 'capture1', group: '收集', name: '初次締約', desc: '用契約石捕捉 1 隻野生精靈', target: 1, progress: (d) => d.stats.captures, reward: { gold: 500, crystals: 150, advStones: 3 } },
  { id: 'capture5', group: '收集', name: '野外的朋友', desc: '捕捉 5 隻野生精靈', target: 5, progress: (d) => d.stats.captures, reward: { gold: 1500, tickets: 2, masterStones: 1 } },
  { id: 'species10', group: '收集', name: '小有收藏', desc: '擁有 10 種精靈', target: 10, progress: owned, reward: { gold: 1000, tickets: 2 } },
  { id: 'species18', group: '收集', name: '精靈學者', desc: '擁有 18 種精靈', target: 18, progress: owned, reward: { gold: 3000, tickets: 5 } },
  { id: 'species26', group: '收集', name: '艾爾多全圖鑑', desc: `擁有全部 ${SPIRITS.length} 種精靈`, target: SPIRITS.length, progress: owned, reward: { gold: 10000, crystals: 1500, tickets: 10 } },
  { id: 'pull10', group: '收集', name: '星門的回應', desc: '累計召喚 10 次', target: 10, progress: (d) => d.stats.pulls, reward: { gold: 500, crystals: 150 } },
  { id: 'pull80', group: '收集', name: '群星之約', desc: '累計召喚 80 次', target: 80, progress: (d) => d.stats.pulls, reward: { gold: 3000, tickets: 5 } },

  { id: 'breakthrough1', group: '培養', name: '初次突破', desc: '讓精靈突破 1 次', target: 1, progress: (d) => d.stats.breakthroughs, reward: { gold: 1000, breakStones: 5 } },
  { id: 'stage3', group: '培養', name: '二度突破', desc: '讓一隻精靈突破兩次（第三階段）', target: 3, progress: maxStage, reward: { gold: 2000, crystals: 300, shards: 2 } },
  { id: 'lv30', group: '培養', name: '成長的證明', desc: '一隻精靈達到 Lv 30', target: 30, progress: maxLevel, reward: { gold: 1500, potions: 3 } },
  { id: 'lv60', group: '培養', name: '登峰造極', desc: '一隻精靈達到 Lv 60', target: 60, progress: maxLevel, reward: { gold: 5000, crystals: 500 } },
  { id: 'team60', group: '培養', name: '傳說的隊伍', desc: '三隻精靈達到 Lv 60', target: 3, progress: (d) => countLevel(d, 60), reward: { gold: 8000, tickets: 5 } },

  { id: 'arena3', group: '競技', name: '競技場新星', desc: '打贏競技場第 3 階', target: 3, progress: (d) => d.arena.best, reward: { gold: 1500, crystals: 200 } },
  { id: 'arena6', group: '競技', name: '黃金締約者', desc: '打贏競技場第 6 階', target: 6, progress: (d) => d.arena.best, reward: { gold: 3000, crystals: 300 } },
  { id: 'arena10', group: '競技', name: '星門傳說', desc: `打贏競技場第 ${ARENA.length} 階`, target: ARENA.length, progress: (d) => d.arena.best, reward: { gold: 10000, tickets: 5 } },
];

export function questState(d: SaveData, q: Quest): { value: number; done: boolean; claimed: boolean } {
  const value = Math.min(q.target, q.progress(d));
  return { value, done: value >= q.target, claimed: d.claimed.includes(q.id) };
}

export function claimable(d: SaveData): Quest[] {
  return QUESTS.filter((q) => {
    const s = questState(d, q);
    return s.done && !s.claimed;
  });
}
