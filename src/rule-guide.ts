import OBR from "@owlbear-rodeo/sdk";
import { loadState, MiruState, Step } from "./state";
import "./rules.css";

type HexInfo = { explored?: boolean; terrain?: string; icon?: string; note?: string; visits?: number };
type GuideState = MiruState & { mapHexes?: Record<string, HexInfo> };

type RuleCard = {
  title: string;
  prompt: string;
  check?: string;
  roll?: { label: string; count: number; sides: number };
  pages: string[];
  detail?: string;
};

const STEP_PAGES: Record<Step, string[]> = {
  A: ["p.6 Steps in a Turn", "p.14 Combat"],
  B: ["p.6 Steps in a Turn"],
  C: ["p.6 Steps in a Turn"],
  D: ["p.6 Steps in a Turn", "p.10–11 Bag & Stats"],
  E: ["p.6 Steps in a Turn", "p.50–53 Cutscenes"],
  F: ["p.7 Steps in a Turn", "p.12 Exploring the Map"],
  G: ["p.7 Steps in a Turn"],
  H: ["p.7 Steps in a Turn", "p.5 Optional Weather"],
  I: ["p.7 Steps in a Turn"],
  J: ["p.8 Steps in a Turn"],
  K: ["p.8 Steps in a Turn", "p.56 Enemies"],
  L: ["p.8 Steps in a Turn"],
  M: ["p.8 Steps in a Turn"],
  N: ["p.9 Steps in a Turn"],
  O: ["p.9 Steps in a Turn"],
  P: ["p.9 Steps in a Turn"]
};

const TERRAIN_PAGES: Record<string, string> = {
  Forest: "p.18 Forest",
  Mountain: "p.22 Mountain",
  Grassland: "p.26 Grassland",
  Desert: "p.30 Desert",
  Swamp: "p.34 Swamp"
};

const ICON_PAGES: Record<string, string> = {
  Village: "p.38 Villages",
  Quest: "p.40 Quests",
  "Radio Tower": "p.52 Radio Tower",
  "Power Supply": "p.53 Power Supply",
  Enemy: "p.56 Enemies",
  Treasure: "p.57 Treasure Maps"
};

let state: GuideState;
let observer: MutationObserver | undefined;

function currentHexInfo() {
  return state.mapHexes?.[state.currentHex] ?? {};
}

function terrainPage() {
  const terrain = currentHexInfo().terrain;
  return terrain ? TERRAIN_PAGES[terrain] : undefined;
}

function cardForStep(step: Step): RuleCard {
  const hex = currentHexInfo();
  const pages = [...STEP_PAGES[step]];
  const tPage = terrainPage();
  if (tPage && ["H", "I"].includes(step)) pages.push(tPage);

  switch (step) {
    case "A":
      return { title: "FIGHT ENEMY IN YOUR SPACE", prompt: "Check whether an Enemy shares your current hex. If so, combat begins and the enemy acts first.", check: hex.icon === "Enemy" ? "Enemy marker found on this hex." : "No Enemy marker is recorded here; verify the map before continuing.", pages };
    case "B":
      return { title: "MARK CALENDAR", prompt: "Mark the current calendar day, then check whether the day has a Cutscene dot.", check: `Current tracked day: ${String(state.day).padStart(2, "0")}.`, pages };
    case "C":
      return { title: "RESET SOLAR ITEMS", prompt: "Make used Solar Items in your possession operable again. Confirm the reset yourself before moving on.", pages };
    case "D":
      return { title: "MANAGE INVENTORY", prompt: "This is your opportunity to rearrange Inventory and Active Body items. Combat access depends on what is on your Active Body.", check: `${state.activeBody.length}/5 Active Body slots currently used.`, pages };
    case "E":
      return { title: "EXPERIENCE CUTSCENE", prompt: "If the current calendar date has a dot, resolve that Cutscene. Otherwise skip this step.", pages };
    case "F":
      return { title: "MOVE", prompt: "Choose where to move. A tile you have never visited is a New Tile; a discovered tile or one with an icon is an Old Tile.", check: "Use the interactive map to choose the destination; the guide will change once your current hex changes.", pages };
    case "G":
      return { title: "DETERMINE TERRAIN", prompt: "For a New Tile, roll 1d6 and use the result to determine its terrain, then mark the map.", roll: { label: "Terrain", count: 1, sides: 6 }, detail: "1 = Minor Injury (p.17), 2 = Forest (p.18), 3 = Mountain (p.22), 4 = Grassland (p.26), 5 = Desert (p.30), 6 = Swamp (p.34).", pages };
    case "H":
      return { title: "CHECK WEATHER", prompt: "Weather is an optional challenge rule. If you are using it, roll 1d6 and reference this terrain's page.", check: hex.terrain && hex.terrain !== "Unknown" ? `Current terrain: ${hex.terrain}.` : "Terrain has not been recorded yet.", roll: { label: "Weather", count: 1, sides: 6 }, pages };
    case "I":
      return { title: "DETERMINE NEW-TILE EVENT", prompt: "For a New Tile, roll 3d6 and reference the current terrain's page to determine the event. Follow the event's instructions afterward.", check: hex.terrain && hex.terrain !== "Unknown" ? `Reference ${hex.terrain}.` : "Record the terrain before resolving this step.", roll: { label: "Event", count: 3, sides: 6 }, pages };
    case "J": {
      const iconPage = hex.icon ? ICON_PAGES[hex.icon] : undefined;
      if (iconPage) pages.push(iconPage);
      return { title: "EXPERIENCE ICON EVENT", prompt: "On an Old Tile with an icon, go to that icon's event page and experience the event.", check: hex.icon && hex.icon !== "None" ? `Recorded icon: ${hex.icon}.` : "No icon is recorded on this hex; Step K may apply instead.", pages };
    }
    case "K":
      return { title: "DETERMINE OLD-TILE EVENT", prompt: "If this Old Tile has no icon, roll 1d6 and reference the enemy/event results on p.56.", roll: { label: "Old-tile event", count: 1, sides: 6 }, pages };
    case "L":
      return { title: "EAT FOOD", prompt: "If you possess Food, you must eat at least one and may eat up to three. This is the only step where Food is consumed.", check: `${state.inventory["Meal Bar"] ?? 0} Meal Bars currently tracked.`, pages };
    case "M":
      return { title: "APPLY FIRST AID", prompt: "If you have a First Aid Kit, you may use it here. Otherwise continue to Step N.", check: state.inventory["First Aid Kit"] ? "First Aid Kit found in inventory." : "No First Aid Kit is currently tracked.", pages };
    case "N":
      return { title: "ATTEMPT TO SLEEP", prompt: "If you can Sleep, you must. Some events or weather can prevent sleep; if you cannot sleep, continue to Step O.", check: "Sleep normally restores +3 HP and +2 EP.", pages };
    case "O":
      return { title: "CONDITION CHECK", prompt: "Check Starvation, Poison, and Sleep Deprivation in order. Apply effects that are relevant and reset counts that do not apply.", check: `Starvation ${state.starvation} • Poison ${state.poison} • Sleep deprivation ${state.sleepDeprivation}.`, pages };
    case "P":
      return { title: "MOVE ENEMIES", prompt: "If a mapped Enemy has movement rules, move it now according to its relevant rule or event page.", check: "Do not move enemies automatically; consult the specific enemy's instructions.", pages };
  }
}

function rollDice(count: number, sides: number) {
  const dice = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  return { dice, total: dice.reduce((a, b) => a + b, 0) };
}

function renderGuide() {
  const rail = document.querySelector<HTMLElement>("#app");
  if (!rail || !state) return;
  document.querySelector("#miru-rule-guide")?.remove();

  const card = cardForStep(state.step);
  const section = document.createElement("section");
  section.id = "miru-rule-guide";
  section.className = "rule-guide";
  section.innerHTML = `
    <div class="rule-kicker"><span>WHAT DO I DO NOW?</span><b>STEP ${state.step}</b></div>
    <h2>${card.title}</h2>
    <p class="rule-prompt">${card.prompt}</p>
    ${card.check ? `<div class="rule-check">${card.check}</div>` : ""}
    ${card.roll ? `<div class="rule-roll"><div><span>ROLL / CHECK</span><b>${card.roll.count}d${card.roll.sides} ${card.roll.label}</b></div><button data-guide-roll="${card.roll.count}" data-guide-sides="${card.roll.sides}">ROLL ${card.roll.count}D${card.roll.sides}</button><output id="guide-roll-result">Ready</output></div>` : ""}
    ${card.detail ? `<details class="rule-detail"><summary>Result reference</summary><p>${card.detail}</p></details>` : ""}
    <details class="rule-pages"><summary>Rulebook references</summary><div>${card.pages.map(page => `<span>${page}</span>`).join("")}</div><small>Page numbers refer to the printed page numbers in your MIRU rulebook PDF.</small></details>
  `;

  const turnSection = [...rail.querySelectorAll<HTMLElement>(":scope > section")].find(s => s.querySelector(".section-title span")?.textContent?.includes("TURN TRACKER"));
  if (turnSection) turnSection.insertAdjacentElement("afterend", section);
  else rail.prepend(section);

  section.querySelector<HTMLButtonElement>("[data-guide-roll]")?.addEventListener("click", event => {
    const button = event.currentTarget as HTMLButtonElement;
    const count = Number(button.dataset.guideRoll);
    const sides = Number(button.dataset.guideSides);
    const result = rollDice(count, sides);
    const out = section.querySelector<HTMLOutputElement>("#guide-roll-result");
    if (out) out.textContent = count === 1 ? `${result.total}` : `${result.dice.join(" + ")} = ${result.total}`;
  });
}

async function refresh() {
  state = await loadState() as GuideState;
  renderGuide();
}

OBR.onReady(async () => {
  await refresh();
  OBR.scene.onMetadataChange(() => void refresh());
  observer = new MutationObserver(() => renderGuide());
  const app = document.querySelector("#app");
  if (app) observer.observe(app, { childList: true });
});
