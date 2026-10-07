// Glossary: any proper noun that appears in skills, traits and hints can show a one-line explanation in place.

import { useEffect, useState, type ReactNode } from 'react';
import { findSkill, SPIRITS } from '../data.ts';
import { Icon, STATUS_INFO } from './icons.tsx';

export type TermGroup = '戰鬥基礎' | '招式種類' | '能力' | '攻防效果' | '異常狀態' | '場地' | '養成' | '專屬機制';

export interface Term {
  key: string;
  group: TermGroup;
  icon?: string;
  color?: string;
  text: string;
  /** Words that are too common (e.g. "power") are listed only in the manual, not marked in body text */
  quiet?: boolean;
}

const T = (key: string, group: TermGroup, text: string, icon?: string, color?: string, quiet?: boolean): Term => ({ key, group, text, icon, color, quiet });

export const TERMS: Term[] = [
  T('靈能', '戰鬥基礎', '使用技能所需的資源，技能卡右上角的數字就是消耗量。戰鬥開始時為 3 點，每回合結束時 +2（上限 10）；部分技能（例如秘術「冥想」+2）與戰技「靈能湧泉」（+3）可以額外獲得靈能。格擋消耗 1 點，奧義需要 5 點。', 'aether', '#6fd8ff'),
  T('預支', '戰鬥基礎', '立即獲得靈能，之後每回合結束時的靈能回復減少（每筆借款 −1，可疊加，最多扣到 0）。適合在奧義差幾點靈能時提前施放。', 'aether', '#6fd8ff'),
  T('威力', '戰鬥基礎', '技能的基礎強度。數值越高，造成的傷害越大。', 'physical', '#ffd978', true),
  T('先制', '戰鬥基礎', '決定行動順序的等級。先制較高者先行動；先制相同時，速度較快者先行動。', 'spd', '#b8fff0'),
  T('命中', '戰鬥基礎', '技能命中的機率。未標示者為必中。', 'eye', '#e0e0ff'),
  T('暴擊', '戰鬥基礎', '攻擊有機率造成 1.5 倍傷害。基礎暴擊率為 5%。', 'burn', '#ffb040'),
  T('剋制', '戰鬥基礎', '屬性相剋關係。剋制時傷害 ×1.5，被抵抗時傷害 ×0.75。', 'up', '#7dffa0'),
  T('同屬性加成', '戰鬥基礎', '技能屬性與使用者屬性相同時，威力 ×1.2。', 'up', '#ffd978'),
  T('替換', '戰鬥基礎', '系統行動：將場上精靈換成後備精靈。替換會最先執行，但會佔用本回合的行動。', 'swap', '#ffffff'),
  T('系統行動', '戰鬥基礎', '替換與格擋。每隻精靈隨時都能選，不佔技能欄，但會佔用本回合的行動。', 'swap', '#ffffff'),
  T('專屬機制', '戰鬥基礎', '每隻精靈獨有、有名字的招牌系統（例如層數、形態、場地），技能之間圍繞它連段。戰鬥中顯示在名牌下方，點一下可看說明；機制的層數與倒數以標記顯示。', 'art', '#ffd978'),
  T('行動順序反轉', '戰鬥基礎', '數回合內，先制相同時速度較慢的精靈先行動（入場與回合結束的順序也反轉）；畫面上方會顯示剩餘回合。再次使用同類技能會恢復正常。', 'swap', '#d8a0ff'),
  T('入場', '戰鬥基礎', '精靈登場的時機，包括戰鬥開始、替換與倒下後補位。', 'swap', '#ffffff'),
  T('離場', '戰鬥基礎', '精靈被換下或倒下。離場時能力階級會重置。', 'swap', '#ffffff'),
  T('最大生命', '戰鬥基礎', '生命值的上限。例如「回復 30% 最大生命」即回復上限的 30%。', 'heal', '#7dffa0', true),
  T('回復', '戰鬥基礎', '恢復生命值，不會超過最大生命。', 'heal', '#7dffa0', true),

  T('武技', '招式種類', '以「力量」計算傷害的攻擊，傷害會被對手的「護甲」降低。', 'physical', '#ffb070'),
  T('魔法', '招式種類', '以「魔力」計算傷害的攻擊，傷害會被對手的「抗魔」降低。', 'magic', '#b0a0ff'),
  T('攻擊技能', '招式種類', '武技、魔法與奧義的統稱。', 'physical', '#ffb070'),
  T('秘術', '招式種類', '不直接造成傷害的輔助技能，例如能力提升、回復、施加異常。', 'status', '#9ae0ff'),
  T('伏技', '招式種類', '預先設置於場上的技能。敵方符合發動條件時自動發動；可與本回合的技能同時使用。', 'trap', '#c8a8ff'),
  T('奧義', '招式種類', '精靈的必殺技。第二次突破（Lv 40）後解鎖。消耗 5 靈能，每場戰鬥限用一次。戰鬥中靈能條右邊的「奧義 3/5」顯示還差幾點。', 'ultimate', '#ffc94a'),
  T('戰技', '招式種類', '締約者的專屬技能。每場戰鬥限用一次，可與技能同時使用。', 'art', '#ffd978'),
  T('專屬技能', '招式種類', '只有這隻精靈會的技能，圍繞牠的專屬機制設計，彼此可以連段。每隻精靈的技能大多是專屬技能。', 'art', '#ffd978'),
  T('招牌技', '招式種類', '精靈最具代表性的專屬技能，每隻 1～3 個，技能卡上標有金色的「招牌」。通常是專屬機制的關鍵。', 'art', '#ffd978'),
  T('基礎技能', '招式種類', '樸素的屬性技能，同屬性或無屬性的精靈會在 Lv 25 前學到幾個；稀有度越高的精靈越少。', 'physical', '#ffb070'),

  T('力量', '能力', '影響武技造成的傷害。', 'atk', '#ffb070'),
  T('魔力', '能力', '影響魔法造成的傷害。', 'mag', '#b0a0ff'),
  T('護甲', '能力', '降低受到的武技傷害。', 'def', '#ffd978'),
  T('抗魔', '能力', '降低受到的魔法傷害。', 'res', '#9ae0ff'),
  T('速度', '能力', '先制相同時，速度較快者先行動。', 'spd', '#b8fff0'),
  T('能力階級', '能力', '能力的增減等級，範圍 −4 至 +4。+1 階為 ×1.25、+2 階為 ×1.5；−1 階為 ×0.8。離場時重置。', 'up', '#ffc94a'),
  T('階', '能力', '能力階級的單位。+1 階為該能力 ×1.25，−1 階為 ×0.8，離場時重置。', 'up', '#ffc94a'),
  T('強化', '能力', '能力階級提升、護盾等增益效果。', 'up', '#ffc94a'),

  T('格擋', '攻防效果', '系統行動，和替換一樣隨時可選、不佔技能欄：消耗 1 靈能、先制 +3，本回合免疫攻擊技能的傷害與附加效果（伏技與持續傷害除外）。不能連續兩回合使用，蓄力中也不能格擋。', 'shield', '#8fe0ff'),
  T('護盾', '攻防效果', '優先承受傷害，耗盡後才扣除生命。未註明時持續 3 回合。', 'shield', '#8fe0ff'),
  T('回合類效果', '攻防效果', '持續數回合的效果（例如減傷、免疫），以標記顯示在精靈資訊下方，右下角是剩餘回合；歸零時消失。和能力階級是兩種增益，各有專門的消除方式。', 'charging', '#e8e0ff'),
  T('無視', '攻防效果', '穿透對手的防禦效果，例如無視格擋、無視護盾或無視部分護甲。', 'breakTrap', '#ffb0b0'),
  T('驅散', '攻防效果', '移除對手所有的能力提升與護盾。', 'dispel', '#ffb0b0'),
  T('反衝', '攻防效果', '使用者承受其造成傷害的一定比例。', 'skull', '#ffb0b0'),
  T('反彈', '攻防效果', '將受到傷害的一定比例反彈給攻擊者。', 'shield', '#8fe0ff'),
  T('蓄力', '攻防效果', '本回合進行準備，下回合自動釋放。蓄力期間無法替換，可被「斷咒」打斷。', 'charging', '#e8e0ff'),
  T('電荷', '攻防效果', '雷屬性精靈累積的能量，最多 3 層。部分技能會消耗電荷以提升威力。', 'charge', '#ffe45a'),
  T('連擊', '攻防效果', '單次行動攻擊多次，每次傷害分別計算。', 'physical', '#ffb070'),
  T('異常', '攻防效果', '灼燒、中毒、冰凍等負面狀態，以圖示顯示於精靈資訊下方。精靈不會陷入與自身屬性對應的異常（例：火屬性不會灼燒）。', 'curse', '#ff9ab0'),

  ...Object.entries(STATUS_INFO).map(([id, s]) => T(s.name, '異常狀態', s.text, id, s.color)),

  T('場地', '場地', '持續數回合的戰場環境。同屬性技能傷害 +30%，並附帶特殊效果；新場地會取代舊場地。', 'field', '#ffe7a0'),
  T('暴雨', '場地', '水屬性傷害 +30%、火屬性 −30%；回合結束時，水屬性精靈回復 5% 最大生命。', 'field', '#3db7ff'),
  T('烈陽', '場地', '火屬性傷害 +30%、水屬性 −30%；所有精靈不會陷入冰凍。', 'field', '#ff6a2b'),
  T('森域', '場地', '木屬性傷害 +30%；回合結束時，所有精靈回復 5% 最大生命。', 'field', '#5fcb5a'),
  T('疾風', '場地', '風屬性傷害 +30%；風屬性技能先制 +1。', 'field', '#9fe8e0'),
  T('沙暴', '場地', '地屬性傷害 +30%；回合結束時，非地屬性精靈受到 5% 最大生命的傷害。', 'field', '#c49a5a'),
  T('雷雲', '場地', '雷屬性傷害 +30%；雷屬性技能施加麻痺的機率加倍。', 'field', '#c8a0ff'),
  T('聖域', '場地', '光屬性傷害 +30%；所有精靈不會陷入新的異常狀態。', 'field', '#ffe680'),
  T('永夜', '場地', '暗屬性傷害 +30%；伏技於設置當回合即可發動。', 'field', '#9a5aff'),

  T('野生', '養成', '野生精靈戰。可使用契約石捕捉，勝利可獲得經驗與素材。', 'stone', '#5ab8ff', true),
  T('對戰', '養成', '與其他締約者的隊伍對戰。', 'swap', '#ffffff', true),
  T('勁敵', '養成', '與勁敵凱爾的對戰，對手隊伍較強。', 'art', '#ff9a6a', true),
  T('教團', '養成', '與虛冕教團的對戰，對手多為蝕化精靈。', 'curse', '#b03aa8', true),
  T('源晶試煉', '養成', '伏魔塔的頂層、地區頭目戰。首次突破可獲得源晶、大量星輝石與大師契約石，並解鎖下一個地區。', 'ultimate', '#ffc94a', true),
  T('探索', '養成', '在地區的野外自由走動，碰到野生精靈就會開戰，可以捕捉；可反覆進行以提升等級。野外也藏著寶箱與稀有精靈。', 'eye', '#9ae0ff', true),
  T('伏魔塔', '養成', '每個地區盡頭的塔，塔裡的樓層就是主線關卡。由下往上依序突破，頂層是源晶試煉；已突破的樓層可以重複挑戰。', 'up', '#ffd978', true),
  T('共鳴', '養成', '重複取得同種精靈時提升共鳴等級（最高 R5），全能力隨之提升。', 'up', '#ffd978'),
  T('突破', '養成', '達到等級上限（Lv 20、Lv 40）後，消耗金幣與突破石突破，能力提升並可習得更多技能。外形與名字不變，只會長大一些。', 'up', '#ffd978', true),
  T('技能表', '養成', '每隻精靈自己的技能清單：從 Lv 1 起依等級學會 10～15 個技能，最後一個不晚於 Lv 55；奧義在第三階段解鎖。可在背包的「技能配置」與圖鑑查看。', 'status', '#9ae0ff'),
  T('習得等級', '養成', '技能表上每個技能標示的等級。升到該等級時學會；技能欄有空位就自動放入，已滿時可在背包的「技能配置」更換。', 'up', '#9ae0ff'),
  T('蝕化', '養成', '受虛蝕侵蝕的精靈，比較兇、會主動衝向締約者。擊倒後即可淨化，打贏可以獲得突破石；伏魔塔裡的「蝕化」樓層是一群蝕化精靈。', 'curse', '#b03aa8'),
];

const BY_KEY = new Map(TERMS.map((t) => [t.key, t]));
// Longer terms are matched first ("stat stage" takes priority over "stage", "attack skill" over "attack")
const KEYS = [...BY_KEY.keys()].sort((a, b) => b.length - a.length);

export function getTerm(key: string): Term | undefined {
  return BY_KEY.get(key);
}

type Piece = string | { term: Term; raw: string };

// ───────────────────────── Signature mechanic terms (marked only in that spirit's skill text) ─────────────────────────

let kitIndex: Map<string, Term[]> | null = null;

/** Skill id → mechanic terms of the spirit that owns the skill: the mechanic name, plus the keywords that the mechanic text marks with corner brackets or tortoise-shell brackets and that the skill text also uses (e.g. "Flame Devour" in corner brackets, "Kiss" in tortoise-shell brackets) */
function buildKitIndex(): Map<string, Term[]> {
  const idx = new Map<string, Term[]>();
  for (const sp of SPIRITS) {
    const m = sp.mechanic;
    if (!m) continue;
    const ids = [...sp.learnset.map((e) => e.id), sp.ultimate].filter((id) => !findSkill(id)?.basic);
    const texts = ids.map((id) => { const sk = findSkill(id); return `${sk?.text ?? ''} ${sk?.trigger ?? ''}`; }).join(' ');
    const main: Term = { key: m.name, group: '專屬機制', text: m.text, icon: 'art', color: '#ffc94a' };
    const terms: Term[] = [main];
    const seen = new Set([m.name]);
    for (const hit of m.text.matchAll(/[「〔]([^」〕]{1,5})[」〕]/g)) {
      // A single-character keyword (in tortoise-shell brackets, e.g. "Kiss", "Slash") is matched together with its brackets, so the same character inside an ordinary word is not marked
      const key = hit[1].length === 1 ? hit[0] : hit[1];
      if (seen.has(key) || BY_KEY.has(hit[1]) || !texts.includes(key)) continue;
      seen.add(key);
      terms.push({ key, group: '專屬機制', text: `專屬機制【${m.name}】：${m.text}`, icon: 'art', color: '#ffc94a' });
    }
    for (const id of ids) idx.set(id, [...(idx.get(id) ?? []), ...terms]);
  }
  return idx;
}

/** Signature mechanic terms of the spirit this skill belongs to (basic skills have none) */
export function kitTerms(skillId: string): Term[] {
  kitIndex ??= buildKitIndex();
  return kitIndex.get(skillId) ?? [];
}

function split(text: string, extra: Term[] = []): Piece[] {
  const out: Piece[] = [];
  let buf = '';
  let i = 0;
  const byKey = extra.length ? new Map([...BY_KEY, ...extra.map((t) => [t.key, t] as const)]) : BY_KEY;
  const keys = extra.length ? [...byKey.keys()].sort((a, b) => b.length - a.length) : KEYS;
  while (i < text.length) {
    const key = keys.find((k) => text.startsWith(k, i) && !(k === '階' && /[段級]/.test(text[i + 1] ?? '')));
    const term = key ? byKey.get(key) : undefined;
    if (key && term && !term.quiet) {
      if (buf) out.push(buf);
      buf = '';
      out.push({ term, raw: key });
      i += key.length;
    } else {
      buf += text[i];
      i++;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/** Terms that appear in the text (no duplicates, in order of appearance) */
export function findTerms(...texts: (string | undefined | null)[]): Term[] {
  return findTermsWith([], ...texts);
}

/** Same as findTerms, but also matches extra (e.g. the signature mechanic terms of the spirit the skill belongs to) */
export function findTermsWith(extra: Term[], ...texts: (string | undefined | null)[]): Term[] {
  const seen = new Set<string>();
  const out: Term[] = [];
  for (const t of texts) {
    if (!t) continue;
    for (const p of split(t, extra)) {
      if (typeof p !== 'string' && !seen.has(p.term.key)) {
        seen.add(p.term.key);
        out.push(p.term);
      }
    }
  }
  // The short "stage" and "stat stage" mean the same thing
  return out.filter((t) => !(t.key === '階' && seen.has('能力階級')));
}

// ───────────────────────── Help popover (shared by terms and items) ─────────────────────────

export interface PopContent {
  title: string;
  color?: string;
  icon?: ReactNode;
  lines: string[];
  /** Custom body (e.g. a skill description card), replacing the title and the text line */
  body?: ReactNode;
  width?: number;
}

type PopState = { c: PopContent; x: number; y: number; above: boolean } | null;
let popListener: ((p: PopState) => void) | null = null;

/** Show the help popover; closes when content is null. above: show it above (x, y) */
export function showPop(c: PopContent | null, x = 0, y = 0, above = true): void {
  popListener?.(c ? { c, x, y, above } : null);
}

export function showTerm(term: Term, x: number, y: number): void {
  showPop({ title: term.key, color: term.color, icon: term.icon ? <Icon name={term.icon} size={13} /> : undefined, lines: [term.text] }, x, y, y > 160);
}

/** Body text: terms become clickable highlighted words */
export function RichText({ text, className, extra }: { text: string; className?: string; extra?: Term[] }) {
  return (
    <span className={className}>
      {split(text, extra).map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <span
            key={i}
            className="term"
            style={{ ['--tc' as string]: p.term.color ?? '#ffd978' }}
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              showTerm(p.term, r.left + r.width / 2, r.top);
            }}
          >
            {p.raw}
          </span>
        ),
      )}
    </span>
  );
}

/** One-line explanations for a list of terms (placed below the skill description) */
export function TermList({ terms, max = 5 }: { terms: Term[]; max?: number }) {
  if (terms.length === 0) return null;
  return (
    <div className="term-list">
      {terms.slice(0, max).map((t) => (
        <div key={t.key} className="tl-row" style={{ ['--tc' as string]: t.color ?? '#ffd978' }}>
          <span className="tl-ico">{t.icon && <Icon name={t.icon} size={12} />}</span>
          <b>{t.key}</b>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/** The help popover mounted at the top level */
export function TermPop() {
  const [pop, setPop] = useState<PopState>(null);
  useEffect(() => {
    popListener = setPop;
    const close = () => setPop(null);
    window.addEventListener('pointerdown', close);
    return () => {
      popListener = null;
      window.removeEventListener('pointerdown', close);
    };
  }, []);
  if (!pop) return null;
  const w = Math.min(pop.c.width ?? 290, window.innerWidth - 24);
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, pop.x - w / 2));
  const style = { left, width: w, ...(pop.above ? { bottom: window.innerHeight - pop.y + 8 } : { top: pop.y + 8 }), ['--tc' as string]: pop.c.color ?? '#ffd978' } as React.CSSProperties;
  return (
    <div className={`term-pop ${pop.c.body ? 'rich' : ''}`} style={style}>
      {pop.c.body ?? (
        <>
          <div className="tp-head">
            {pop.c.icon && <span className="tp-ico">{pop.c.icon}</span>}
            <b>{pop.c.title}</b>
          </div>
          {pop.c.lines.map((l, i) => (
            <div key={i} className={`tp-text ${i > 0 ? 'sub' : ''}`}>{l}</div>
          ))}
        </>
      )}
    </div>
  );
}

export function termGroups(): { group: TermGroup; terms: Term[] }[] {
  const groups: TermGroup[] = ['戰鬥基礎', '招式種類', '能力', '攻防效果', '異常狀態', '場地', '養成'];
  return groups.map((group) => ({ group, terms: TERMS.filter((t) => t.group === group && t.key !== '階') }));
}

export type { ReactNode };
