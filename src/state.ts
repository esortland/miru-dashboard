import OBR from "@owlbear-rodeo/sdk";

export const META_KEY = "com.esortland.miru-companion/state";

export type Step = "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I"|"J"|"K"|"L"|"M"|"N"|"O"|"P";

export type HexInfo = {
  explored?: boolean;
  terrain?: string;
  icon?: string;
  note?: string;
  visits?: number;
};

export type TerrainRollState = {
  day: number;
  hex: string;
  result: number;
  applied: boolean;
} | null;

export type ArrivalState = {
  day: number;
  from: string;
  hex: string;
  kind: "new" | "old";
} | null;

export type CombatState = {
  active: boolean;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyDef: number;
  enemyEsc: number;
  enemyAtkLow: number;
  enemyAtkMid: number;
  enemyAtkHigh: number;
  robot: boolean;
  burn: number;
  stun: number;
  weaponAtk: number;
  equipmentDef: number;
  enemyAtkBonusNext: number;
  escapeLocked: boolean;
  log: string[];
};

export type MiruState = {
  version: 6;
  day: number;
  step: Step;
  hp: number;
  ep: number;
  starvation: number;
  poison: number;
  sleepDeprivation: number;
  minorInjuries: number;
  currentHex: string;
  mapHexes: Record<string, HexInfo>;
  terrainRoll: TerrainRollState;
  arrival: ArrivalState;
  inventory: Record<string, number>;
  activeBody: string[];
  techSkills: Record<string, number>;
  techUsedDay: Record<string, number>;
  combat: CombatState;
  notes: string;
};

export const DEFAULT_COMBAT: CombatState = {
  active: false,
  enemyName: "Enemy",
  enemyHp: 10,
  enemyMaxHp: 10,
  enemyDef: 2,
  enemyEsc: 3,
  enemyAtkLow: 0,
  enemyAtkMid: 3,
  enemyAtkHigh: 5,
  robot: false,
  burn: 0,
  stun: 0,
  weaponAtk: 0,
  equipmentDef: 0,
  enemyAtkBonusNext: 0,
  escapeLocked: false,
  log: []
};

export const DEFAULT_STATE: MiruState = {
  version: 6,
  day: 1,
  step: "G",
  hp: 10,
  ep: 10,
  starvation: 0,
  poison: 0,
  sleepDeprivation: 0,
  minorInjuries: 0,
  currentHex: "G-10",
  mapHexes: { "G-10": { explored: true, visits: 1 } },
  terrainRoll: null,
  arrival: null,
  inventory: { "Meal Bar": 3 },
  activeBody: [],
  techSkills: {},
  techUsedDay: {},
  combat: structuredClone(DEFAULT_COMBAT),
  notes: ""
};

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeRecord(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const count = Math.max(0, Math.floor(Number(value)) || 0);
    if (count > 0) out[key] = count;
  }
  return out;
}

function normalizeMapHexes(raw: unknown): Record<string, HexInfo> {
  const out: Record<string, HexInfo> = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^[A-G]-\d{2}$/.test(key) || !value || typeof value !== "object") continue;
      const h = value as HexInfo;
      out[key] = {
        explored: Boolean(h.explored),
        terrain: typeof h.terrain === "string" ? h.terrain.slice(0, 32) : undefined,
        icon: typeof h.icon === "string" ? h.icon.slice(0, 32) : undefined,
        note: typeof h.note === "string" ? h.note.slice(0, 160) : undefined,
        visits: clamp(Math.floor(Number(h.visits ?? 0)), 0, 999)
      };
    }
  }
  out["G-10"] ??= { explored: true, visits: 1 };
  return out;
}

function normalizeTerrainRoll(raw: unknown): TerrainRollState {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { day?: unknown; hex?: unknown; result?: unknown; applied?: unknown };
  const result = Math.floor(Number(r.result));
  const day = Math.floor(Number(r.day));
  const hex = typeof r.hex === "string" ? r.hex.trim().toUpperCase() : "";
  if (result < 1 || result > 6 || day < 1 || !/^[A-G]-\d{2}$/.test(hex)) return null;
  return { day: clamp(day,1,66), hex, result, applied: Boolean(r.applied) };
}

function normalizeArrival(raw: unknown): ArrivalState {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { day?: unknown; from?: unknown; hex?: unknown; kind?: unknown };
  const day = Math.floor(Number(r.day));
  const from = typeof r.from === "string" ? r.from.trim().toUpperCase() : "";
  const hex = typeof r.hex === "string" ? r.hex.trim().toUpperCase() : "";
  const kind = r.kind === "new" || r.kind === "old" ? r.kind : null;
  if (day < 1 || !/^[A-G]-\d{2}$/.test(from) || !/^[A-G]-\d{2}$/.test(hex) || !kind) return null;
  return { day: clamp(day,1,66), from, hex, kind };
}

function normalizeCombat(raw: unknown): CombatState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CombatState>;
  const maxHp = clamp(Math.floor(Number(r.enemyMaxHp ?? 10)) || 10, 1, 999);
  return {
    ...DEFAULT_COMBAT,
    ...r,
    active: Boolean(r.active),
    enemyName: typeof r.enemyName === "string" && r.enemyName.trim() ? r.enemyName.trim().slice(0, 48) : "Enemy",
    enemyMaxHp: maxHp,
    enemyHp: clamp(Math.floor(Number(r.enemyHp ?? maxHp)), 0, maxHp),
    enemyDef: clamp(Math.floor(Number(r.enemyDef ?? 0)), 0, 99),
    enemyEsc: clamp(Math.floor(Number(r.enemyEsc ?? 0)), 0, 99),
    enemyAtkLow: clamp(Math.floor(Number(r.enemyAtkLow ?? 0)), 0, 99),
    enemyAtkMid: clamp(Math.floor(Number(r.enemyAtkMid ?? 0)), 0, 99),
    enemyAtkHigh: clamp(Math.floor(Number(r.enemyAtkHigh ?? 0)), 0, 99),
    robot: Boolean(r.robot),
    burn: clamp(Math.floor(Number(r.burn ?? 0)), 0, 3),
    stun: clamp(Math.floor(Number(r.stun ?? 0)), 0, 3),
    weaponAtk: clamp(Math.floor(Number(r.weaponAtk ?? 0)), 0, 99),
    equipmentDef: clamp(Math.floor(Number(r.equipmentDef ?? 0)), 0, 99),
    enemyAtkBonusNext: clamp(Math.floor(Number(r.enemyAtkBonusNext ?? 0)), 0, 10),
    escapeLocked: Boolean(r.escapeLocked),
    log: Array.isArray(r.log) ? r.log.filter((x): x is string => typeof x === "string").slice(-30) : []
  };
}

export function normalizeState(raw: unknown): MiruState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MiruState> & { playerTokenId?: unknown };
  const validSteps: Step[] = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
  const step = validSteps.includes(r.step as Step) ? (r.step as Step) : DEFAULT_STATE.step;
  const inventory = normalizeRecord(r.inventory);
  if (Object.keys(inventory).length === 0 && !r.inventory) inventory["Meal Bar"] = 3;

  return {
    ...DEFAULT_STATE,
    version: 6,
    step,
    hp: clamp(Number(r.hp ?? DEFAULT_STATE.hp), 0, 20),
    ep: clamp(Number(r.ep ?? DEFAULT_STATE.ep), 0, 20),
    day: clamp(Math.floor(Number(r.day ?? 1)), 1, 66),
    starvation: clamp(Math.floor(Number(r.starvation ?? 0)), 0, 8),
    poison: clamp(Math.floor(Number(r.poison ?? 0)), 0, 8),
    sleepDeprivation: clamp(Math.floor(Number(r.sleepDeprivation ?? 0)), 0, 5),
    minorInjuries: clamp(Math.floor(Number(r.minorInjuries ?? 0)), 0, 3),
    currentHex: typeof r.currentHex === "string" && r.currentHex.trim() ? r.currentHex.trim().toUpperCase() : "G-10",
    mapHexes: normalizeMapHexes(r.mapHexes),
    terrainRoll: normalizeTerrainRoll(r.terrainRoll),
    arrival: normalizeArrival(r.arrival),
    inventory,
    activeBody: Array.isArray(r.activeBody)
      ? [...new Set(r.activeBody.filter((x): x is string => typeof x === "string" && x.trim().length > 0))].slice(0, 5)
      : [],
    techSkills: normalizeRecord(r.techSkills),
    techUsedDay: normalizeRecord(r.techUsedDay),
    combat: normalizeCombat(r.combat),
    notes: typeof r.notes === "string" ? r.notes.slice(0, 2000) : ""
  };
}

export async function loadState(): Promise<MiruState> {
  const roomMetadata = await OBR.room.getMetadata();
  const roomState = roomMetadata[META_KEY];
  if (roomState) return normalizeState(roomState);

  if (await OBR.scene.isReady()) {
    const sceneMetadata = await OBR.scene.getMetadata();
    const legacyState = sceneMetadata[META_KEY];
    if (legacyState) {
      const migrated = normalizeState(legacyState);
      await OBR.room.setMetadata({ [META_KEY]: migrated });
      return migrated;
    }
  }

  return structuredClone(DEFAULT_STATE);
}

export async function saveState(state: MiruState): Promise<void> {
  await OBR.room.setMetadata({ [META_KEY]: normalizeState(state) });
}
