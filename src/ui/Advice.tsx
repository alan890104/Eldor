// Growth advice list: every item comes with a go-to button.

import { sfx } from '../audio/sfx.ts';
import type { Advice, AdviceAction } from '../game/advice.ts';
import { Icon } from './icons.tsx';
import { store } from './store.ts';

export function runAdvice(a: AdviceAction): void {
  sfx.click();
  switch (a.to) {
    case 'team':
      store.go({ name: 'team', uid: a.uid, tab: a.tab });
      break;
    case 'region':
      store.go({ name: 'region', idx: a.idx });
      break;
    case 'summon':
      store.go({ name: 'summon' });
      break;
    case 'quests':
      store.go({ name: 'quests' });
      break;
  }
}

export function AdviceList({ items, max = 4, title = '提升實力的方法', layout = 'list' }: { items: Advice[]; max?: number; title?: string; layout?: 'list' | 'grid' }) {
  if (items.length === 0) return null;
  return (
    <div className={`advice ${layout}`}>
      <div className="adv-title">{title}</div>
      {items.slice(0, max).map((a) => (
        <div key={a.id} className="adv-row">
          <span className="adv-ico"><Icon name={a.icon} size={15} /></span>
          <div className="adv-body">
            <b>{a.title}</b>
            <p>{a.text}</p>
          </div>
          <button className="btn small" onClick={() => runAdvice(a.action)}>{a.button}</button>
        </div>
      ))}
    </div>
  );
}
