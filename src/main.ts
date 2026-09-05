import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { clamp, DEFAULT_COMBAT, DEFAULT_STATE, loadState, MiruState, normalizeState, saveState, Step } from "./state";
import { attemptEscape, basicAttack, enemyTurn, resetCombatLog, startCombat, techAttack, TRAINED_TECH, TrainedTechKey } from "./combat";

const app = document.querySelector<HTMLDivElement>("#app")!;
const steps: Step[] = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
const stepNames: Record<Step, string> = {
  A:"Fight enemy", B:"Mark calendar", C:"Reset solar", D:"Manage inventory", E:"Cutscene",
  F:"Move", G:"Determine terrain", H:"Check weather", I:"Determine new-tile event", J:"Experience icon event",
  K:"Determine old-tile event", L:"Eat food", M:"First aid", N:"Sleep", O:"Condition check", P:"Move enemies"
};
const techSkills = [
  { key:"TS-1", name:"Dodge & Strike", leveled:true },
  { key:"TS-2", name:"Roll & Wire Slice", leveled:true },
  { key:"TS-3", name:"Jump & Attack", leveled:true },
  { key:"TS-4", name:"EMP Grenade", leveled:true },
  { key:"TS-5", name:"Sprint Tech", leveled:false },
  { key:"TS-6", name:"Electric Bolts", leveled:false },
  { key:"TS-7", name:"Flaming Arrows", leveled:false }
] as const;

let state: MiruState = structuredClone(DEFAULT_STATE);
let saveTimer: number | undefined;
let saveLabel = "Saved in this Owlbear room";

function phase(step: Step) {
  const i = steps.indexOf(step);
  if (i <= 4) return "DAWN";
  if (i <= 10) return "DAY";
  if (i <= 12) return "DUSK";
  return "DARK";
}

function updateSaveIndicator(label: string) {
  saveLabel = label;
  const el = document.querySelector<HTMLElement>("#campaign-save-status");
  if (el) el.textContent = `${label} • Day ${String(state.day).padStart(2,"0")} • ${state.currentHex}`;
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  updateSaveIndicator("Saving to this room…");
  saveTimer = window.setTimeout(() => void saveState(state).then(()=>updateSaveIndicator("Saved in this Owlbear room")), 120);
}

function setState(patch: Partial<MiruState>) {
  state = { ...state, ...patch };
  render();
  scheduleSave();
}

function replaceState(next: MiruState) {
  state = next;
  render();
  scheduleSave();
}

function adjust(key: "hp"|"ep"|"day"|"starvation"|"poison"|"sleepDeprivation"|"minorInjuries", delta: number) {
  const max = key === "day" ? 66 : key === "sleepDeprivation" ? 5 : key === "minorInjuries" ? 3 : key === "hp" || key === "ep" ? 20 : 8;
  const min = key === "day" ? 1 : 0;
  setState({ [key]: clamp((state[key] as number)+delta,min,max) } as Partial<MiruState>);
}

function meter(label: string, key: "hp"|"ep", value: number) {
  const pct = value/20*100;
  return `<div class="meter-row"><div class="meter-top"><b>${label}</b><span>${value}/20</span></div><div class="meter"><i style="width:${pct}%"></i></div><div class="compact-controls"><button data-adjust="${key}" data-delta="-1">−</button><button data-adjust="${key}" data-delta="1">+</button></div></div>`;
}

function condition(label: string, key: string, value: number, max: number) {
  return `<div class="condition"><span>${label}</span><b>${value}/${max}</b><div><button data-adjust="${key}" data-delta="-1">−</button><button data-adjust="${key}" data-delta="1">+</button></div></div>`;
}

function inventoryHtml() {
  const rows = Object.entries(state.inventory).filter(([,count])=>count>0).sort(([a],[b])=>a.localeCompare(b));
  if (!rows.length) return `<div class="empty">Bag is empty.</div>`;
  return rows.map(([name,count]) => `<div class="item-row">
    <div class="item-name"><b>${escapeHtml(name)}</b><small>×${count}</small></div>
    <div class="item-actions"><button data-inv="${escapeHtml(name)}" data-delta="-1">−</button><button data-inv="${escapeHtml(name)}" data-delta="1">+</button><button class="equip" data-equip="${escapeHtml(name)}">Equip</button></div>
  </div>`).join("");
}

function activeBodyHtml() {
  if (!state.activeBody.length) return `<div class="empty">No active items. Equip items from your bag.</div>`;
  return state.activeBody.map(name => `<div class="item-row active-item"><div class="item-name"><b>${escapeHtml(name)}</b></div><button data-unequip="${escapeHtml(name)}">To bag</button></div>`).join("");
}

function techSkillsHtml() {
  return techSkills.map(skill => {
    const value = state.techSkills[skill.key] ?? 0;
    if (skill.leveled) {
      return `<div class="skill-row"><div><b>${skill.key}</b><span>${skill.name}</span></div><div class="skill-level"><button data-skill="${skill.key}" data-delta="-1">−</button><strong>${value ? `Lv ${value}` : "—"}</strong><button data-skill="${skill.key}" data-delta="1">+</button></div></div>`;
    }
    return `<div class="skill-row"><div><b>${skill.key}</b><span>${skill.name}</span></div><button class="learn ${value ? "learned" : ""}" data-toggle-skill="${skill.key}">${value ? "Learned" : "Not learned"}</button></div>`;
  }).join("");
}

function combatHtml() {
  const c = state.combat;
  const techButtons = (Object.keys(TRAINED_TECH) as TrainedTechKey[])
    .filter(key => (state.techSkills[key] ?? 0) > 0)
    .map(key => {
      const s = TRAINED_TECH[key];
      return `<button data-tech-attack="${key}">${key} <b>Lv ${state.techSkills[key]}</b><small>-${s.cost} EP${s.atk ? ` • +${s.atk} ATK` : " • +3 STUN"}</small></button>`;
    }).join("") || `<div class="empty">Learn TS-1–TS-4 to enable trained attacks.</div>`;
  const log = c.log.length ? c.log.slice().reverse().map(x=>`<div>${escapeHtml(x)}</div>`).join("") : `<div class="empty">Combat log is empty.</div>`;
  return `
    <div class="combat-head"><div><b>${escapeHtml(c.enemyName)}</b><span>${c.enemyHp}/${c.enemyMaxHp} HP</span></div><span class="combat-state ${c.active?"live":""}">${c.active?"COMBAT":"READY"}</span></div>
    <div class="combat-grid">
      <label>Enemy <input data-combat="enemyName" value="${escapeHtml(c.enemyName)}" maxlength="48"></label>
      <label>Max HP <input type="number" data-combat="enemyMaxHp" value="${c.enemyMaxHp}" min="1" max="999"></label>
      <label>HP <input type="number" data-combat="enemyHp" value="${c.enemyHp}" min="0" max="999"></label>
      <label>DEF <input type="number" data-combat="enemyDef" value="${c.enemyDef}" min="0" max="99"></label>
      <label>ESC <input type="number" data-combat="enemyEsc" value="${c.enemyEsc}" min="0" max="99"></label>
      <label class="check"><input type="checkbox" data-combat-check="robot" ${c.robot?"checked":""}> Robot</label>
      <label>ATK 1–2 <input type="number" data-combat="enemyAtkLow" value="${c.enemyAtkLow}" min="0" max="99"></label>
      <label>ATK 3–4 <input type="number" data-combat="enemyAtkMid" value="${c.enemyAtkMid}" min="0" max="99"></label>
      <label>ATK 5–6 <input type="number" data-combat="enemyAtkHigh" value="${c.enemyAtkHigh}" min="0" max="99"></label>
      <label>Weapon ATK <input type="number" data-combat="weaponAtk" value="${c.weaponAtk}" min="0" max="99"></label>
      <label>Gear DEF <input type="number" data-combat="equipmentDef" value="${c.equipmentDef}" min="0" max="99"></label>
    </div>
    <div class="status-strip"><span>BURN <button data-combat-adjust="burn" data-delta="-1">−</button><b>${c.burn}</b><button data-combat-adjust="burn" data-delta="1">+</button></span><span>STUN <button data-combat-adjust="stun" data-delta="-1">−</button><b>${c.stun}</b><button data-combat-adjust="stun" data-delta="1">+</button></span></div>
    <div class="combat-actions"><button id="start-combat" class="primary">${c.active?"Restart combat":"Start combat"}</button><button id="enemy-turn">Enemy turn</button><button id="basic-attack">Basic attack</button><button id="escape-combat">Escape -2 EP</button></div>
    <div class="tech-attacks">${techButtons}</div>
    <div class="combat-log"><div class="log-title"><span>COMBAT LOG</span><button id="clear-combat-log">Clear</button></div>${log}</div>
  `;
}

function campaignSaveHtml() {
  return `<section class="campaign-save-section">
    <div class="section-title"><span>CAMPAIGN SAVE</span><small>room-persistent</small></div>
    <div class="campaign-save-card">
      <div class="save-status"><i></i><span id="campaign-save-status">${saveLabel} • Day ${String(state.day).padStart(2,"0")} • ${escapeHtml(state.currentHex)}</span></div>
      <p>Your MIRU campaign stays with this Owlbear room when you close the extension or return later.</p>
      <div class="save-actions"><button id="export-campaign">Export Save</button><button id="import-campaign">Import Save</button></div>
      <input id="import-campaign-file" type="file" accept="application/json,.json" hidden>
      <details class="new-campaign-zone"><summary>Start a new campaign</summary><div class="new-campaign-copy">Clears map exploration, current position, vitals, inventory, notes, combat, and turn progress in this room.</div><button id="new-campaign">Start New Campaign</button></details>
      <button id="reset-combat" class="reset-combat-only">Reset combat card only</button>
    </div>
  </section>`;
}

function render() {
  app.innerHTML = `
    <header class="hero"><div><div class="eyebrow">MIRU // FIELD CONTROL</div><h1>DAY ${String(state.day).padStart(2,"0")} <span>${phase(state.step)}</span></h1></div><div class="hex">${escapeHtml(state.currentHex)}</div></header>

    <section class="vitals">${meter("HP","hp",state.hp)}${meter("EP","ep",state.ep)}</section>

    <section>
      <div class="section-title"><span>TURN TRACKER</span><small>${state.step}: ${stepNames[state.step]}</small></div>
      <div class="steps">${steps.map(s => `<button class="step ${s===state.step?"active":""}" data-step="${s}" title="${stepNames[s]}">${s}</button>`).join("")}</div>
      <div class="turn-actions"><button id="prev-step">← Previous</button><button id="next-step" class="primary">Next step →</button><button id="next-day">Next day +</button></div>
    </section>

    <section>
      <div class="section-title"><span>CONDITIONS</span><small>tap ± to track</small></div>
      <div class="condition-grid">${condition("Starvation","starvation",state.starvation,8)}${condition("Poison","poison",state.poison,8)}${condition("Sleep dep.","sleepDeprivation",state.sleepDeprivation,5)}${condition("Minor injuries","minorInjuries",state.minorInjuries,3)}</div>
    </section>

    <section>
      <div class="section-title"><span>ACTIVE BODY</span><small>${state.activeBody.length}/5 items</small></div>
      <div class="stack">${activeBodyHtml()}</div>
    </section>

    <section>
      <div class="section-title"><span>INVENTORY</span><small>${Object.keys(state.inventory).length}/10 unique</small></div>
      <div class="stack">${inventoryHtml()}</div>
      <form id="add-item" class="add-item"><input id="new-item" maxlength="48" placeholder="Add item…" required><input id="new-count" type="number" min="1" max="99" value="1" aria-label="Quantity"><button>Add</button></form>
    </section>

    <section>
      <div class="section-title"><span>TECH SKILLS</span><small>successful trained attacks level up</small></div>
      <div class="skill-list">${techSkillsHtml()}</div>
    </section>

    <section class="combat-section">
      <div class="section-title"><span>COMBAT CONTROL</span><small>ATK − DEF = damage</small></div>
      ${combatHtml()}
    </section>

    <section>
      <div class="section-title"><span>CAMPAIGN NOTES</span><small>saved with room</small></div>
      <textarea id="notes" rows="4" maxlength="2000" placeholder="Objective, unresolved quest, session notes…">${escapeHtml(state.notes)}</textarea>
    </section>

    ${campaignSaveHtml()}
  `;
  wire();
}

function escapeHtml(s: string) { return s.replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]!)); }
async function showError(message: string) { await OBR.notification.show(message, "ERROR"); }

function exportCampaign() {
  const backup = {
    format: "miru-companion-campaign",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    state
  };
  const blob = new Blob([JSON.stringify(backup,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `miru-campaign-day-${String(state.day).padStart(2,"0")}-${state.currentHex.toLowerCase()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  void OBR.notification.show("MIRU campaign backup exported.", "SUCCESS");
}

async function importCampaignFile(file: File) {
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    if (!parsed || typeof parsed !== "object") throw new Error("Backup is not a JSON object.");
    const wrapper = parsed as { format?: unknown; state?: unknown };
    const rawState = wrapper.format === "miru-companion-campaign" ? wrapper.state : parsed;
    if (!rawState || typeof rawState !== "object" || !("day" in rawState) || !("currentHex" in rawState)) throw new Error("This does not look like a MIRU campaign backup.");
    const imported = normalizeState(rawState);
    if (!confirm(`Import this MIRU campaign into the current room?\n\nDay ${String(imported.day).padStart(2,"0")} • ${imported.currentHex}\n\nThis replaces the campaign currently saved in this room.`)) return;
    window.clearTimeout(saveTimer);
    state = imported;
    await saveState(state);
    saveLabel = "Saved in this Owlbear room";
    render();
    void OBR.notification.show("MIRU campaign imported into this room.", "SUCCESS");
  } catch (error) {
    void showError(error instanceof Error ? error.message : "Could not import this campaign backup.");
  }
}

async function startNewCampaign() {
  if (!confirm("Start a new MIRU campaign in this Owlbear room?\n\nThis permanently replaces the room's current MIRU campaign state. Export a backup first if you may want to return to it.")) return;
  window.clearTimeout(saveTimer);
  state = structuredClone(DEFAULT_STATE);
  await saveState(state);
  saveLabel = "Saved in this Owlbear room";
  render();
  void OBR.notification.show("New MIRU campaign started.", "SUCCESS");
}

function updateInventory(name: string, delta: number) {
  const inventory = { ...state.inventory };
  const current = inventory[name] ?? 0;
  if (delta > 0 && current === 0 && Object.keys(inventory).length >= 10) { void showError("Inventory already has 10 unique items."); return; }
  const next = Math.max(0, current + delta);
  if (next === 0) delete inventory[name]; else inventory[name] = next;
  setState({ inventory });
}

function equip(name: string) {
  if (state.activeBody.includes(name)) return;
  if (state.activeBody.length >= 5) { void showError("Active Body is full (5 items)."); return; }
  const count = state.inventory[name] ?? 0;
  if (count < 1) return;
  const inventory = { ...state.inventory };
  if (count === 1) delete inventory[name]; else inventory[name] = count - 1;
  setState({ inventory, activeBody:[...state.activeBody,name] });
}

function unequip(name: string) {
  const inventory = { ...state.inventory };
  if (!(name in inventory) && Object.keys(inventory).length >= 10) { void showError("Make room in your bag before unequipping this item."); return; }
  inventory[name] = (inventory[name] ?? 0) + 1;
  setState({ inventory, activeBody:state.activeBody.filter(x=>x!==name) });
}

function adjustSkill(key: string, delta: number) {
  const skills = { ...state.techSkills };
  const next = clamp((skills[key] ?? 0) + delta, 0, 6);
  if (next === 0) delete skills[key]; else skills[key] = next;
  setState({ techSkills:skills });
}

function setCombatField(key: keyof MiruState["combat"], value: string | number | boolean) {
  const combat = { ...state.combat, [key]: value };
  if (key === "enemyMaxHp") {
    combat.enemyMaxHp = clamp(Number(value), 1, 999);
    combat.enemyHp = Math.min(combat.enemyHp, combat.enemyMaxHp);
  }
  setState({ combat });
}

function wire() {
  app.querySelectorAll<HTMLButtonElement>("[data-adjust]").forEach(btn=>btn.addEventListener("click",()=>adjust(btn.dataset.adjust as "hp"|"ep"|"day"|"starvation"|"poison"|"sleepDeprivation"|"minorInjuries", Number(btn.dataset.delta))));
  app.querySelectorAll<HTMLButtonElement>("[data-step]").forEach(btn=>btn.addEventListener("click",()=>setState({step: btn.dataset.step as Step})));
  document.querySelector<HTMLButtonElement>("#prev-step")?.addEventListener("click",()=>{const i=steps.indexOf(state.step);setState({step:steps[Math.max(0,i-1)]});});
  document.querySelector<HTMLButtonElement>("#next-step")?.addEventListener("click",()=>{const i=steps.indexOf(state.step);if(i===steps.length-1)setState({step:"A",day:clamp(state.day+1,1,66)});else setState({step:steps[i+1]});});
  document.querySelector<HTMLButtonElement>("#next-day")?.addEventListener("click",()=>setState({day:clamp(state.day+1,1,66),step:"A"}));

  app.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach(btn=>btn.addEventListener("click",()=>updateInventory(btn.dataset.inv!,Number(btn.dataset.delta))));
  app.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach(btn=>btn.addEventListener("click",()=>equip(btn.dataset.equip!)));
  app.querySelectorAll<HTMLButtonElement>("[data-unequip]").forEach(btn=>btn.addEventListener("click",()=>unequip(btn.dataset.unequip!)));
  document.querySelector<HTMLFormElement>("#add-item")?.addEventListener("submit",event=>{
    event.preventDefault();
    const name=(document.querySelector<HTMLInputElement>("#new-item")?.value??"").trim().replace(/\s+/g," ");
    const count=clamp(Math.floor(Number(document.querySelector<HTMLInputElement>("#new-count")?.value??1)),1,99);
    if(name) updateInventory(name,count);
  });

  app.querySelectorAll<HTMLButtonElement>("[data-skill]").forEach(btn=>btn.addEventListener("click",()=>adjustSkill(btn.dataset.skill!,Number(btn.dataset.delta))));
  app.querySelectorAll<HTMLButtonElement>("[data-toggle-skill]").forEach(btn=>btn.addEventListener("click",()=>{const key=btn.dataset.toggleSkill!;const skills={...state.techSkills};if(skills[key])delete skills[key];else skills[key]=1;setState({techSkills:skills});}));

  app.querySelectorAll<HTMLInputElement>("[data-combat]").forEach(input=>input.addEventListener("change",()=>{
    const key=input.dataset.combat as keyof MiruState["combat"];
    setCombatField(key, input.type === "number" ? clamp(Math.floor(Number(input.value)||0),0,999) : input.value.trim());
  }));
  app.querySelectorAll<HTMLInputElement>("[data-combat-check]").forEach(input=>input.addEventListener("change",()=>setCombatField(input.dataset.combatCheck as keyof MiruState["combat"],input.checked)));
  app.querySelectorAll<HTMLButtonElement>("[data-combat-adjust]").forEach(btn=>btn.addEventListener("click",()=>{
    const key=btn.dataset.combatAdjust as "burn"|"stun";setCombatField(key,clamp(state.combat[key]+Number(btn.dataset.delta),0,3));
  }));
  document.querySelector<HTMLButtonElement>("#start-combat")?.addEventListener("click",()=>replaceState(startCombat(state)));
  document.querySelector<HTMLButtonElement>("#enemy-turn")?.addEventListener("click",()=>replaceState(enemyTurn(state)));
  document.querySelector<HTMLButtonElement>("#basic-attack")?.addEventListener("click",()=>replaceState(basicAttack(state)));
  document.querySelector<HTMLButtonElement>("#escape-combat")?.addEventListener("click",()=>replaceState(attemptEscape(state)));
  app.querySelectorAll<HTMLButtonElement>("[data-tech-attack]").forEach(btn=>btn.addEventListener("click",()=>replaceState(techAttack(state,btn.dataset.techAttack as TrainedTechKey))));
  document.querySelector<HTMLButtonElement>("#clear-combat-log")?.addEventListener("click",()=>replaceState(resetCombatLog(state)));

  const notes=document.querySelector<HTMLTextAreaElement>("#notes");
  notes?.addEventListener("input",()=>{state={...state,notes:notes.value.slice(0,2000)};scheduleSave();});
  document.querySelector<HTMLButtonElement>("#reset-combat")?.addEventListener("click",()=>setState({combat:structuredClone(DEFAULT_COMBAT)}));
  document.querySelector<HTMLButtonElement>("#export-campaign")?.addEventListener("click",exportCampaign);
  document.querySelector<HTMLButtonElement>("#import-campaign")?.addEventListener("click",()=>document.querySelector<HTMLInputElement>("#import-campaign-file")?.click());
  document.querySelector<HTMLInputElement>("#import-campaign-file")?.addEventListener("change",event=>{const file=(event.target as HTMLInputElement).files?.[0];if(file)void importCampaignFile(file);});
  document.querySelector<HTMLButtonElement>("#new-campaign")?.addEventListener("click",()=>void startNewCampaign());
}

async function boot() {
  await OBR.onReady(async()=>{
    state=await loadState();
    saveLabel = "Saved in this Owlbear room";
    render();
    OBR.room.onMetadataChange(meta=>{
      if(meta["com.esortland.miru-companion/state"]){
        void loadState().then(s=>{state=s;saveLabel="Saved in this Owlbear room";render();});
      }
    });
  });
}

void boot();
