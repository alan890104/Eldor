// Kit overview: each group's spirit kits, budget ratios, and what problems remain.
// Usage: npm run kits              overview of all groups
//       npm run kits -- fire      details of a single group (learnset, budget ratios, problems)
//       npm run kits -- basic     list the basic skill pool

import { BASIC_FILE, GROUP_OF_SPIRIT, KIT_GROUPS, SKILL_BY_ID, SPIRITS, type KitGroup } from './catalog.ts';
import { checkBudget, checkGroupFile, checkKit, TIERS } from './kitrules.ts';
import { ELEMENT_LABEL } from './formulas.ts';

const arg = process.argv[2];
const CAT: Record<string, string> = { physical: 'P', magic: 'M', status: 'S', trap: 'T', ultimate: 'U' };

if (arg === 'basic') {
  console.log('Basic skill pool (data/kits/_basic.json): spirits of the same element or Neutral can take these in their learnset, learned before Lv 25\n');
  for (const s of BASIC_FILE.skills) {
    const b = checkBudget(s);
    console.log(`  ${ELEMENT_LABEL[s.element].padEnd(2)} ${CAT[s.category]} cost ${s.cost} ${String(s.power || 'none').padStart(3)}  ${s.id.padEnd(15)} ${s.name}: ${s.text} (${b.result.ratio.toFixed(2)})`);
  }
  process.exit(0);
}

const groups: KitGroup[] = arg ? [arg as KitGroup] : [...KIT_GROUPS];
if (arg && !(KIT_GROUPS as readonly string[]).includes(arg)) {
  console.error(`No such group ${arg}: ${KIT_GROUPS.join(', ')}, basic`);
  process.exit(1);
}

let total = 0;
let ok = 0;
for (const g of groups) {
  const members = SPIRITS.filter((sp) => GROUP_OF_SPIRIT.get(sp.id) === g);
  total += members.length;
  const groupProblems = checkGroupFile(g);
  console.log(`\n■ ${g} (${members.length} spirits)`);
  for (const sp of members) {
    const r = checkKit(sp);
    const tier = TIERS[sp.rarity];
    const tag = r.problems.length ? '✗' : '✓';
    if (!r.problems.length) ok++;
    console.log(`  ${tag} ${sp.id.padEnd(17)} ${sp.rarity.padEnd(3)} ${String(sp.learnset.length).padStart(2)} skills (${tier.size.join('-')})${sp.mechanic ? `  mechanic [${sp.mechanic.name}]` : ''}${r.problems.length ? `  ${r.problems.length} problems` : ''}`);
    if (!arg) continue;
    for (const e of sp.learnset) {
      const s = SKILL_BY_ID.get(e.id);
      if (!s) {
        console.log(`      Lv ${String(e.lv).padStart(2)}  ${e.id} (not found)`);
        continue;
      }
      const b = checkBudget(s);
      const kind = s.basic ? 'basic' : s.tags.sig ? 'flagship' : '';
      console.log(`      Lv ${String(e.lv).padStart(2)}  ${CAT[s.category]} cost ${s.cost} ${s.name} (${s.id})${kind ? ` [${kind}]` : ''} ${b.result.ratio.toFixed(2)}${b.ok ? '' : ` ✗ range ${b.lo}-${b.hi}`}`);
    }
    const u = SKILL_BY_ID.get(sp.ultimate);
    if (u) console.log(`      Ultimate  ${u.name} (${u.id}) ${checkBudget(u).result.ratio.toFixed(2)}`);
    for (const p of r.problems) console.log(`      ✗ ${p}`);
  }
  for (const p of groupProblems) console.log(`  ✗ ${p}`);
}
console.log(`\n${ok}/${total} spirits have kits with no problems. Details: npm run kits -- <group>; verify: KIT=<group> node --test sim/kits.test.ts`);
