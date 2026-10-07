// Help book: element matchup chart, battle flow and the full glossary. Pressing "?" on any screen opens it, and it does not interrupt a battle.

import { useState } from 'react';
import type { Element } from '../../sim/types.ts';
import { ELEMENT_COLOR } from '../battle/scene.ts';
import { ELEMENT_LABEL } from '../../sim/formulas.ts';
import { hex } from './common.tsx';
import { termGroups } from './glossary.tsx';
import { Icon } from './icons.tsx';
import { store, useStore } from './store.ts';
import { sfx } from '../audio/sfx.ts';

const RING: Element[] = ['water', 'fire', 'nature', 'wind', 'earth', 'thunder'];

function ElementWheel() {
  const R = 78;
  const cx = 110;
  const cy = 100;
  const pts = RING.map((_, i) => {
    const a = -Math.PI / 2 + (i / RING.length) * Math.PI * 2;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  });
  return (
    <svg className="el-wheel" viewBox="0 0 220 210" role="img" aria-label="六元環：水剋火、火剋木、木剋風、風剋地、地剋雷、雷剋水">
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10Z" fill="#ffd978" />
        </marker>
      </defs>
      {pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        return <line key={i} x1={p.x + ux * 22} y1={p.y + uy * 22} x2={q.x - ux * 24} y2={q.y - uy * 24} stroke="#ffd978" strokeWidth="2.5" markerEnd="url(#arrowhead)" />;
      })}
      {pts.map((p, i) => (
        <g key={RING[i]}>
          <circle cx={p.x} cy={p.y} r="19" fill={hex(ELEMENT_COLOR[RING[i]])} stroke="#fff" strokeWidth="2" />
          <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="17" fontWeight="900" fill="#fff" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.45)', strokeWidth: 3 }}>
            {ELEMENT_LABEL[RING[i]]}
          </text>
        </g>
      ))}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#e8e0ff">箭頭＝剋制</text>
    </svg>
  );
}

function RulesTab() {
  return (
    <div className="help-rules">
      <section>
        <h4>世界：虛蝕與伏魔塔</h4>
        <ul>
          <li><b>虛蝕</b>：一千年前的碎心之夜，有人剖開了世界之心，傷口裡湧出黑紫色的東西。心碎成八塊源晶堵住了傷口，但虛蝕仍從大地的裂縫裡滲出，碰到的精靈都會發狂。</li>
          <li><b>蝕化精靈</b>：沾到虛蝕的精靈會長出紫黑色的虛晶、身上爬滿發光的裂紋、眼睛變紅、失去理智，見到誰都會撲上去。牠們力氣變大、怕光，虛蝕也會一點一點吃掉牠們的生命。蝕化中無法締約；擊倒牠，虛晶就會碎裂、精靈恢復原樣。碎掉的虛晶會結成突破石，淨化後的精靈有時還會願意跟你走。</li>
          <li><b>伏魔塔</b>：第一代締約者在每道裂縫上蓋了一座塔，用源晶當塔心把虛蝕壓住。塔的每一層都是一道封印；封印鬆動，虛蝕就會漏出來，侵蝕塔周圍的土地、把附近的精靈變成蝕化精靈。一層一層突破、重新點亮封印，侵蝕就會退去；通過塔頂守護者的試煉，源晶就會認可你。</li>
          <li><b>虛冕教團</b>：崇拜虛蝕的教團，想撬開各地的伏魔塔、收集源晶再次打開裂隙。塔裡的教團成員多半帶著蝕化精靈。</li>
        </ul>
      </section>
      <section>
        <h4>屬性相剋</h4>
        <div className="hr-row">
          <ElementWheel />
          <ul>
            <li>箭頭指向的屬性被剋制：傷害 <b>×1.5</b>。</li>
            <li>反方向為被抵抗：傷害 <b>×0.75</b>。</li>
            <li><span className="el-dot" style={{ ['--c' as string]: hex(ELEMENT_COLOR.light) }}>光</span> 與 <span className="el-dot" style={{ ['--c' as string]: hex(ELEMENT_COLOR.dark) }}>暗</span> 互相剋制（×1.5）。</li>
            <li><span className="el-dot" style={{ ['--c' as string]: hex(ELEMENT_COLOR.neutral) }}>無</span> 屬性不剋制也不被剋制。</li>
            <li>技能屬性與精靈屬性相同時，威力 <b>×1.2</b>（同屬性加成）。</li>
          </ul>
        </div>
      </section>
      <section>
        <h4>如何變強</h4>
        <ul>
          <li><b>經驗值</b>：戰鬥勝利時，出戰隊伍的 3 隻精靈都會獲得經驗值（戰敗時也會依擊倒數量獲得少量經驗）。</li>
          <li><b>野外</b>：在世界地圖選一個已解鎖的地區，就能用 WASD（手機用左半邊搖桿）在野外自由走動。碰到野生精靈就會開戰，可以用契約石捕捉；是提升等級的主要方式。寶箱、城鎮居民與稀有精靈都藏在野外各處。</li>
          <li><b>伏魔塔</b>：每個地區盡頭的塔就是主線關卡，由下往上一層一層突破；頂層是源晶試煉，突破後才能前往下一個地區。已突破的樓層可以重複挑戰。</li>
          <li><b>經驗藥水</b>：在背包的「道具」中對精靈使用，立即獲得大量經驗值。</li>
          <li><b>突破</b>：第一階段上限 Lv 20、第二階段上限 Lv 40。<b>到達上限後不再獲得經驗</b>，需在背包消耗金幣與突破石突破，才能繼續升級；第二次突破後可使用奧義。突破不會改變精靈的外形與名字，只會讓牠長大一些。</li>
          <li><b>技能配置</b>：每隻精靈有自己的技能表，升級時依等級習得新技能（各屬性的基礎技能＋大量專屬技能）；最多攜帶 4 個，可在背包的「技能配置」更換。「格擋」是系統行動，不佔技能欄。</li>
          <li><b>屬性相剋</b>：派出剋制對手屬性的精靈，傷害 ×1.5。</li>
          <li><b>新夥伴</b>：透過星門召喚或捕捉野生精靈取得；重複取得同種精靈會提升共鳴，全能力上升。</li>
        </ul>
        <p className="help-tip">主城左上角的「下一步建議」會依目前狀況提示最有效的做法；戰敗時結算畫面也會列出建議。</p>
      </section>
      <section>
        <h4>回合流程</h4>
        <ol>
          <li>雙方同時選擇行動：技能、替換或捕捉；可另外設置一張伏技、使用戰技。</li>
          <li>替換最先執行；其餘依<b>先制</b>高低，相同時比<b>速度</b>。</li>
          <li>回合結束時結算持續傷害與場地效果，雙方靈能 <b>+2</b>（上限 10）。</li>
        </ol>
      </section>
      <section>
        <h4>靈能與奧義</h4>
        <ul>
          <li><b>靈能</b>是使用技能的資源，畫面下方的藍色菱形就是目前的靈能；技能卡右上角的數字是消耗量，0 費技能隨時可用。</li>
          <li>戰鬥開始時有 3 點，<b>每回合結束 +2</b>（上限 10）。秘術「冥想」+2，戰技「靈能湧泉」+3。</li>
          <li><b>奧義</b>是精靈的必殺技，位於技能列最右側的金色卡片。精靈<b>第二次突破</b>（Lv 40）後解鎖。</li>
          <li>發動奧義需要 <b>5 點靈能</b>，每場戰鬥限用一次。<b>怎麼看還差多少</b>：靈能條第 5 格標有「奧義」刻度；靈能條右邊的「奧義 3/5」顯示目前進度，集滿時變成金色的「可發動！」；奧義卡上緣的五格也會跟著亮起。想用奧義時，先用 0 費技能或「冥想」把靈能存下來。</li>
        </ul>
      </section>
      <section>
        <h4>技能卡</h4>
        <div className="help-card-legend">
          <span><span className="sk-cat demo"><Icon name="physical" size={12} /></span> 左上：技能種類</span>
          <span><span className="sk-gem"><b>2</b></span> 右上：靈能消耗（紅色＝不足）</span>
          <span><b className="demo-pow">威力 95</b> 下方：威力</span>
          <span><span className="sk-ko">KO</span> 此技能可擊倒對手</span>
          <span><Icon name="up" size={11} className="eff-up" /> 屬性剋制　<Icon name="down" size={11} className="eff-down" /> 屬性抵抗</span>
          <span><Icon name="burn" size={12} style={{ color: '#ff6a2a' }} /> 30%：附加效果與機率</span>
        </div>
      </section>
    </div>
  );
}

function TermsTab() {
  return (
    <div className="help-terms">
      {termGroups().map((g) => (
        <section key={g.group}>
          <h4>{g.group}</h4>
          <div className="ht-grid">
            {g.terms.map((t) => (
              <div key={t.key} className="ht-item" style={{ ['--tc' as string]: t.color ?? '#ffd978' }}>
                <span className="tl-ico">{t.icon && <Icon name={t.icon} size={13} />}</span>
                <div>
                  <b>{t.key}</b>
                  <p>{t.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HelpButton() {
  return (
    <button className="help-btn" title="說明書" onClick={(e) => { e.stopPropagation(); sfx.click(); store.setHelp(true); }}>
      ?
    </button>
  );
}

export function HelpOverlay() {
  const { help } = useStore();
  const [tab, setTab] = useState<'rules' | 'terms'>('rules');
  if (!help) return null;
  return (
    <div className="help-overlay" onClick={() => store.setHelp(false)}>
      <div className="help-body panel" onClick={(e) => e.stopPropagation()}>
        <div className="help-head">
          <b>說明書</b>
          <div className="tabs">
            <button className={tab === 'rules' ? 'on' : ''} onClick={() => setTab('rules')}>規則</button>
            <button className={tab === 'terms' ? 'on' : ''} onClick={() => setTab('terms')}>術語</button>
          </div>
          <button className="help-close" onClick={() => store.setHelp(false)}>×</button>
        </div>
        <div className="help-scroll">{tab === 'rules' ? <RulesTab /> : <TermsTab />}</div>
      </div>
    </div>
  );
}
