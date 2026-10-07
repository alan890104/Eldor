// Bag, Items tab: item slots, descriptions, use (EXP Potion, stardust exchange) and links to related screens.

import { useState } from 'react';
import { getSpirit } from '../../data.ts';
import { sfx } from '../../audio/sfx.ts';
import { giveExp, levelCap, potionExp } from '../../game/progression.ts';
import { store, useStore } from '../store.ts';
import { ExpBar, Thumb } from '../widgets.tsx';
import { ITEM_ORDER, ITEMS, itemCount, ItemIcon, type ItemDef, type ItemId } from '../items.tsx';

const STARDUST_PER_TICKET = 30;
const GROUPS: ItemDef['kind'][] = ['召喚', '貨幣', '培養', '捕捉'];

/** onPotion: called after an EXP Potion is used; learned is the skills picked up on level-up */
export function ItemsPanel({ onPotion }: { onPotion: (uid: string, learned: string[]) => void }) {
  const { save } = useStore();
  const [sel, setSel] = useState<ItemId>('tickets');
  const [picking, setPicking] = useState(false);
  const def = ITEMS[sel];
  const count = itemCount(save, sel);

  const usePotionOn = (uid: string) => {
    const t = save.spirits.find((x) => x.uid === uid);
    if (!t || save.inv.potions <= 0) return;
    if (t.level >= levelCap(t)) {
      sfx.error();
      store.showToast('此精靈已達目前階段的等級上限，請先突破');
      return;
    }
    let before = 0;
    let after = 0;
    let exp = 0;
    const learned: string[] = [];
    store.mutate((d) => {
      const x = d.spirits.find((y) => y.uid === uid)!;
      d.inv.potions--;
      exp = potionExp(x);
      const g = giveExp(x, exp);
      before = g.before;
      after = g.after;
      learned.push(...g.newSkills);
    });
    sfx.levelUp();
    onPotion(uid, learned);
    const name = getSpirit(t.speciesId).name;
    store.showToast(after > before ? `${name} 獲得 ${exp} 經驗值，等級 ${before} → ${after}` : `${name} 獲得 ${exp} 經驗值`);
    if (save.inv.potions - 1 <= 0) setPicking(false);
  };

  const exchange = () => {
    if (save.inv.stardust < STARDUST_PER_TICKET) {
      sfx.error();
      return;
    }
    sfx.confirm();
    store.mutate((d) => {
      d.inv.stardust -= STARDUST_PER_TICKET;
      d.inv.tickets += 1;
    });
    store.showToast(`已兌換契約券 ×1（星塵 −${STARDUST_PER_TICKET}）`);
  };

  const action = () => {
    switch (sel) {
      case 'tickets':
      case 'crystals':
        return <button className="btn gold small" onClick={() => { sfx.click(); store.go({ name: 'summon' }); }}>前往星門召喚</button>;
      case 'stardust':
        return (
          <button className="btn gold small" disabled={save.inv.stardust < STARDUST_PER_TICKET} onClick={exchange}>
            兌換契約券（{STARDUST_PER_TICKET} 個 → 1 張）
          </button>
        );
      case 'potions':
        return (
          <button className="btn gold small" disabled={save.inv.potions <= 0} onClick={() => { sfx.click(); setPicking(!picking); }}>
            {picking ? '取消' : '選擇精靈使用'}
          </button>
        );
      case 'gold':
      case 'breakStones':
      case 'shards':
        return <button className="btn small" onClick={() => { sfx.click(); store.go({ name: 'team', tab: 'spirits' }); }}>前往精靈突破</button>;
      default:
        return <div className="note">在野生精靈戰鬥中點選「捕捉」使用。</div>;
    }
  };

  const spirits = [...save.spirits].sort((a, b) => b.level - a.level);
  return (
    <div className="bag-items panel">
      <div className="bi-grid">
        {GROUPS.map((g) => (
          <div key={g} className="bi-group">
            <div className="bi-gtitle">{g}</div>
            <div className="bi-tiles">
              {ITEM_ORDER.filter((id) => ITEMS[id].kind === g).map((id) => {
                const n = itemCount(save, id);
                return (
                  <button key={id} className={`bi-tile ${sel === id ? 'sel' : ''} ${n === 0 ? 'zero' : ''}`} style={{ ['--ic' as string]: ITEMS[id].color }} onClick={() => { sfx.click(); setSel(id); setPicking(false); }}>
                    <ItemIcon id={id} size={48} />
                    <span className="bi-name">{ITEMS[id].name}</span>
                    <b className="bi-n">{n.toLocaleString()}</b>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="bi-detail" style={{ ['--ic' as string]: def.color }}>
        <div className="bd-head">
          <span className="bd-icon"><ItemIcon id={sel} size={64} /></span>
          <div>
            <div className="bd-name">{def.name}</div>
            <div className="bd-count">持有 <b>{count.toLocaleString()}</b></div>
          </div>
        </div>
        <p className="bd-desc">{def.desc}</p>
        <dl className="bd-info">
          <dt>用途</dt>
          <dd>{def.use}</dd>
          <dt>取得</dt>
          <dd>{def.source}</dd>
        </dl>
        <div className="bd-action">{action()}</div>
        {sel === 'potions' && picking && (
          <div className="bd-pick">
            <div className="bi-gtitle">選擇要使用的精靈</div>
            {spirits.map((x) => {
              const xs = getSpirit(x.speciesId);
              const capped = x.level >= levelCap(x);
              return (
                <button key={x.uid} className={`bp-row ${capped ? 'capped' : ''}`} onClick={() => usePotionOn(x.uid)}>
                  <Thumb speciesId={x.speciesId} stage={x.stage} size={48} />
                  <span className="bp-info">
                    <b>{xs.name}</b>
                    <span>Lv {x.level}/{levelCap(x)}{capped ? '・需先突破' : `・+${potionExp(x)} 經驗`}</span>
                    <ExpBar s={x} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
