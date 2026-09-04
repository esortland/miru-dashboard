import OBR from "@owlbear-rodeo/sdk";

export const META_KEY = "com.esortland.miru-companion/state";

export type Step = "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I"|"J"|"K"|"L"|"M"|"N"|"O"|"P";

export type MiruState = {
  version: 2;
  day: number;
  step: Step;
  hp: number;
  ep: number;
  starvation: number;
  poison: number;
  sleepDeprivation: number;
  minorInjuries: number;
  currentHex: string;
  inventory: Record<string, number>;
  activeBody: string[];
  techSkills: Record<string, number>;
  notes: string;
};

export const DEFAULT_STATE: MiruState = {
  version: 2,
  day: 1,
  step: "G",
  hp: 10,
  ep: 10,
  starvation: 0,
  poison: 0,
  sleepDeprivation: 0,
  minorInjuries: 0,
  currentHex: "G-10",
  inventory: { "Meal Bar": 3 },
  activeBody: [],
  techSkills: {},
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

function normalize(raw: unknown): MiruState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MiruState>;
  const validSteps: Step[] = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
  const step = validSteps.includes(r.step as Step) ? (r.step as Step) : DEFAULT_STATE.step;
  const inventory = normalizeRecord(r.inventory);
  if (Object.keys(inventory).length === 0 && !r.inventory) inventory["Meal Bar"] = 3;

  return {
    ...DEFAULT_STATE,
    ...r,
    version: 2,
    step,
    hp: clamp(Number(r.hp ?? DEFAULT_STATE.hp), 0, 20),
    ep: clamp(Number(r.ep ?? DEFAULT_STATE.ep), 0, 20),
    day: clamp(Math.floor(Number(r.day ?? 1)), 1, 66),
    starvation: clamp(Math.floor(Number(r.starvation ?? 0)), 0, 8),
    poison: clamp(Math.floor(Number(r.poison ?? 0)), 0, 8),
    sleepDeprivation: clamp(Math.floor(Number(r.sleepDeprivation ?? 0)), 0, 5),
    minorInjuries: clamp(Math.floor(Number(r.minorInjuries ?? 0)), 0, 3),
    inventory,
    activeBody: Array.isArray(r.activeBody)
      ? [...new Set(r.activeBody.filter((x): x is string => typeof x === "string" && x.trim().length > 0))].slice(0, 5)
      : [],
    techSkills: normalizeRecord(r.techSkills),
    notes: typeof r.notes === "string" ? r.notes : "",
    currentHex: typeof r.currentHex === "string" && r.currentHex.trim() ? r.currentHex.trim().toUpperCase() : "G-10"
  };
}

export async function loadState(): Promise<MiruState> {
  if (!(await OBR.scene.isReady())) return structuredClone(DEFAULT_STATE);
  const metadata = await OBR.scene.getMetadata();
  return normalize(metadata[META_KEY]);
}

export async function saveState(state: MiruState): Promise<void> {
  if (!(await OBR.scene.isReady())) return;
  await OBR.scene.setMetadata({ [META_KEY]: state });
}
