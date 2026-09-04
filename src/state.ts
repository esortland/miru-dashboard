import OBR from "@owlbear-rodeo/sdk";

export const META_KEY = "com.esortland.miru-companion/state";

export type Step = "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I"|"J"|"K"|"L"|"M"|"N"|"O"|"P";

export type MiruState = {
  version: 1;
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
  version: 1,
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

function normalize(raw: unknown): MiruState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MiruState>;
  return {
    ...DEFAULT_STATE,
    ...r,
    hp: clamp(Number(r.hp ?? DEFAULT_STATE.hp), 0, 20),
    ep: clamp(Number(r.ep ?? DEFAULT_STATE.ep), 0, 20),
    day: clamp(Math.floor(Number(r.day ?? 1)), 1, 66),
    starvation: clamp(Math.floor(Number(r.starvation ?? 0)), 0, 8),
    poison: clamp(Math.floor(Number(r.poison ?? 0)), 0, 8),
    sleepDeprivation: clamp(Math.floor(Number(r.sleepDeprivation ?? 0)), 0, 5),
    minorInjuries: clamp(Math.floor(Number(r.minorInjuries ?? 0)), 0, 3),
    inventory: { ...DEFAULT_STATE.inventory, ...(r.inventory ?? {}) },
    activeBody: Array.isArray(r.activeBody) ? r.activeBody.slice(0, 5) : [],
    techSkills: r.techSkills && typeof r.techSkills === "object" ? r.techSkills : {},
    notes: typeof r.notes === "string" ? r.notes : "",
    currentHex: typeof r.currentHex === "string" ? r.currentHex : "G-10"
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
