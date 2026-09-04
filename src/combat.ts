import { clamp, CombatState, MiruState } from "./state";

export const TRAINED_TECH = {
  "TS-1": { name: "Dodge & Strike", cost: 2, atk: 2, robotOnly: false },
  "TS-2": { name: "Roll & Wire Slice", cost: 3, atk: 4, robotOnly: true },
  "TS-3": { name: "Jump & Attack", cost: 4, atk: 6, robotOnly: false },
  "TS-4": { name: "EMP Grenade", cost: 2, atk: 0, robotOnly: true }
} as const;

export type TrainedTechKey = keyof typeof TRAINED_TECH;

function d6() { return Math.floor(Math.random() * 6) + 1; }
function damage(atk: number, def: number) { return Math.max(0, atk - def); }
function addLog(combat: CombatState, message: string): CombatState {
  return { ...combat, log: [...combat.log, message].slice(-30) };
}

export function startCombat(state: MiruState): MiruState {
  const c = state.combat;
  return { ...state, combat: addLog({ ...c, active: true, enemyHp: c.enemyMaxHp }, `Combat started with ${c.enemyName}. Enemy acts first.`) };
}

export function resetCombatLog(state: MiruState): MiruState {
  return { ...state, combat: { ...state.combat, log: [] } };
}

export function enemyTurn(state: MiruState): MiruState {
  let c = { ...state.combat };
  if (!c.active) return state;

  if (c.burn > 0) {
    c.enemyHp = clamp(c.enemyHp - c.burn, 0, c.enemyMaxHp);
    c = addLog(c, `Burn deals ${c.burn} damage (${c.enemyHp}/${c.enemyMaxHp} HP).`);
    if (c.enemyHp <= 0) return { ...state, combat: addLog({ ...c, active: false }, `${c.enemyName} is defeated.`) };
  }

  if (c.stun > 0) {
    const rolls = Array.from({ length: c.stun }, d6);
    if (rolls.includes(4)) {
      c = addLog(c, `STUN ${rolls.join(", ")} — enemy attack skipped.`);
      c.enemyAtkBonusNext = 0;
      return { ...state, combat: c };
    }
    c = addLog(c, `STUN ${rolls.join(", ")} — no 4; enemy attacks.`);
  }

  const roll = d6();
  const baseAtk = roll <= 2 ? c.enemyAtkLow : roll <= 4 ? c.enemyAtkMid : c.enemyAtkHigh;
  const atk = baseAtk + c.enemyAtkBonusNext;
  const playerDef = 1 + c.equipmentDef;
  const dealt = damage(atk, playerDef);
  const hp = clamp(state.hp - dealt, 0, 20);
  c.enemyAtkBonusNext = 0;
  c = addLog(c, `Enemy rolls ${roll}: ${atk} ATK vs ${playerDef} DEF → ${dealt} damage.`);
  if (hp <= 0) c = addLog(c, "HP reached 0 — MIRU's death rules apply.");
  return { ...state, hp, combat: c };
}

export function basicAttack(state: MiruState): MiruState {
  let c = { ...state.combat };
  if (!c.active) return state;
  const atk = 1 + c.weaponAtk;
  const dealt = damage(atk, c.enemyDef);
  c.enemyHp = clamp(c.enemyHp - dealt, 0, c.enemyMaxHp);
  c = addLog(c, `Basic attack: ${atk} ATK vs ${c.enemyDef} DEF → ${dealt} damage.`);
  if (c.enemyHp <= 0) c = addLog({ ...c, active: false }, `${c.enemyName} is defeated.`);
  return { ...state, combat: c };
}

export function techAttack(state: MiruState, key: TrainedTechKey): MiruState {
  const skill = TRAINED_TECH[key];
  const level = state.techSkills[key] ?? 0;
  let c = { ...state.combat };
  if (!c.active || level < 1) return state;
  if (state.ep < skill.cost) return { ...state, combat: addLog(c, `${key} failed: needs ${skill.cost} EP.`) };
  if (skill.robotOnly && !c.robot) return { ...state, combat: addLog(c, `${key} only works against Robots.`) };
  if (key === "TS-4" && state.techUsedDay[key] === state.day) return { ...state, combat: addLog(c, "TS-4 has already succeeded today.") };
  if (key === "TS-4" && !state.activeBody.some(x => x.toLowerCase() === "solar taser")) {
    return { ...state, combat: addLog(c, "TS-4 requires Solar Taser on the Active Body.") };
  }

  const learned = Object.values(state.techSkills).filter(v => v > 0).length;
  const diceCount = Math.max(1, Math.min(3, learned));
  const rolls = level >= 6 ? [] : Array.from({ length: diceCount }, d6);
  const success = level >= 6 || rolls.some(r => r <= level);
  const ep = clamp(state.ep - skill.cost, 0, 20);
  if (!success) {
    c = addLog(c, `${key} Lv${level}: ${rolls.join(", ")} — miss. -${skill.cost} EP.`);
    return { ...state, ep, combat: c };
  }

  const skills = { ...state.techSkills, [key]: Math.min(6, level + 1) };
  const techUsedDay = { ...state.techUsedDay };
  if (key === "TS-4") {
    c.stun = 3;
    techUsedDay[key] = state.day;
    c = addLog(c, `TS-4 succeeds — enemy STUN set to 3. Skill → Lv${skills[key]}. -${skill.cost} EP.`);
  } else {
    const atk = 1 + c.weaponAtk + skill.atk;
    const dealt = damage(atk, c.enemyDef);
    c.enemyHp = clamp(c.enemyHp - dealt, 0, c.enemyMaxHp);
    c = addLog(c, `${key} succeeds: ${atk} ATK → ${dealt} damage. Skill → Lv${skills[key]}. -${skill.cost} EP.`);
    if (c.enemyHp <= 0) c = addLog({ ...c, active: false }, `${c.enemyName} is defeated.`);
  }
  return { ...state, ep, techSkills: skills, techUsedDay, combat: c };
}

export function attemptEscape(state: MiruState): MiruState {
  let c = { ...state.combat };
  if (!c.active) return state;
  if (c.escapeLocked) {
    c = addLog({ ...c, escapeLocked: false }, "Escape unavailable this turn because of the previous odd failed roll.");
    return { ...state, combat: c };
  }
  if (state.ep < 2) return { ...state, combat: addLog(c, "Escape requires 2 EP.") };

  const roll = d6();
  const ep = clamp(state.ep - 2, 0, 20);
  if (roll > c.enemyEsc) {
    c = addLog({ ...c, active: false }, `Escape ${roll} > ESC ${c.enemyEsc}: success. ${roll % 2 === 0 ? "Even → move and skip to Step O." : "Odd → move and skip to Step N."}`);
    return { ...state, ep, combat: c, step: roll % 2 === 0 ? "O" : "N" };
  }
  if (roll % 2 === 0) {
    c = addLog({ ...c, enemyAtkBonusNext: c.enemyAtkBonusNext + 1 }, `Escape ${roll} ≤ ESC ${c.enemyEsc}: fail. Even → enemy gets +1 ATK next turn.`);
  } else {
    c = addLog({ ...c, escapeLocked: true }, `Escape ${roll} ≤ ESC ${c.enemyEsc}: fail. Odd → cannot escape on your next turn.`);
  }
  return { ...state, ep, combat: c };
}
