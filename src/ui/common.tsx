// Small shared components and helpers.

import type { Element } from '../../sim/types.ts';
import { ELEMENT_LABEL } from '../../sim/formulas.ts';
import { ELEMENT_COLOR } from '../battle/scene.ts';

export function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

export function ElementChip({ el, big }: { el: Element; big?: boolean }) {
  return (
    <span className={`el-chip ${big ? 'big' : ''}`} style={{ ['--c' as string]: hex(ELEMENT_COLOR[el]) }}>
      {ELEMENT_LABEL[el]}
    </span>
  );
}

export function RarityTag({ r }: { r: string }) {
  return <span className={`rarity r-${r}`}>{r}</span>;
}
