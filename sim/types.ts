// Shared types. The structure of the data files (data/*.json) is defined here.

export type Element =
  | 'water'
  | 'fire'
  | 'nature'
  | 'wind'
  | 'earth'
  | 'thunder'
  | 'light'
  | 'dark'
  | 'neutral';

export type StatKey = 'hp' | 'atk' | 'mag' | 'def' | 'res' | 'spd';
export type Stats = Record<StatKey, number>;

export type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export type Stage = 1 | 2 | 3;

/** physical=physical skill, magic=magic, status=status skill, trap=trap, ultimate=ultimate */
export type SkillCategory = 'physical' | 'magic' | 'status' | 'trap' | 'ultimate';

/** Trap speed: normal=ordinary trap, quick=quick trap, counter=counter trap */
export type TrapSpeed = 'normal' | 'quick' | 'counter';

/** Damage type of an ultimate; auto = whichever of attack and magic power is higher */
export type DamageType = 'physical' | 'magic' | 'auto';

export type StatusId =
  | 'burn'
  | 'poison'
  | 'bleed'
  | 'freeze'
  | 'sleep'
  | 'fear'
  | 'paralyze'
  | 'root'
  | 'silence'
  | 'taunt'
  | 'curse';

export interface SkillDef {
  id: string;
  name: string;
  en: string;
  element: Element;
  category: SkillCategory;
  damageType?: DamageType;
  cost: number;
  power: number;
  accuracy: number;
  priority: number;
  trapSpeed?: TrapSpeed;
  /** Trigger condition of a trap */
  trigger?: string;
  /** Flagship skill: only the named spirit can learn it */
  exclusive?: string;
  /** Basic skill (data/kits/_basic.json): spirits of the same element, or elementless spirits, can put it in a learnset; has no exclusive */
  basic?: boolean;
  text: string;
  /** Skill budget tags, see sim/budget.ts */
  tags: Record<string, number>;
  note?: string;
}

/** One learnset entry: the skill id learned at level lv */
export interface LearnEntry {
  lv: number;
  id: string;
}

/** Name + description (trait, signature mechanic) */
export interface NamedText {
  name: string;
  text: string;
}

/** A spirit's kit (spirits.<id> in data/kits/<group>.json) */
export interface KitEntry {
  /** Sorted by level; learned from Lv 1 */
  learnset: LearnEntry[];
  /** Signature ultimate (unlocked at stage III) */
  ultimate: string;
  /** Priority order for auto-loadout (optional): the default loadout and AI opponents bring these skills first */
  core?: string[];
  /** Signature mechanic: this spirit's flagship system keyword (shown in the UI and descriptions) */
  mechanic?: NamedText;
  /** Gameplay summary (within 80 characters): shown in the loadout and the Codex */
  concept?: string;
  /** Overridden trait: replaces the trait in spirits.json, and the old trait implementation is disabled (the new trait is written in the KIT hooks) */
  trait?: NamedText;
}

/** Format of data/kits/*.json */
export interface KitFile {
  spirits: Record<string, KitEntry>;
  skills: SkillDef[];
}

/** One entry of data/spirits.json: identity, stats, trait, intro (skills are in kits) */
export interface SpiritIdentity {
  id: string;
  /** The spirit's unique name: each has a single form and a single name; advancing a stage does not rename it */
  name: string;
  en: string;
  elements: Element[];
  rarity: Rarity;
  role: string;
  base: Stats;
  trait: NamedText;
  obtain: string;
  lore: string;
}

/** Merged spirit definition = identity from spirits.json + kit from kits (when a kit overrides the trait, trait is the new trait) */
export interface SpiritDef extends SpiritIdentity {
  learnset: LearnEntry[];
  ultimate: string;
  core?: string[];
  mechanic?: NamedText;
  /** Gameplay summary (within 80 characters) */
  concept?: string;
  /** The kit overrode the trait: the old trait implementation (spirit checks in traits.ts and battle.ts) is disabled */
  traitOverride?: boolean;
}
