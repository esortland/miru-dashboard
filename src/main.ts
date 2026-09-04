import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { clamp, DEFAULT_STATE, loadState, MiruState, saveState, Step } from "./state";
import { ICONS, placeStamp, TERRAIN } from "./scene";

const app = document.querySelector<HTMLDivElement>("#app")!;
const steps: Step[] = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
const stepNames: Record<Step, string> = {
  A:"Fight enemy", B:"Mark calendar", C:"Reset solar", D:"Manage inventory", E:"Cutscene",
  F:"Move", G:"Determine terrain", H:"Check weather", I:"Determine new-tile event", J:"Experience icon event",
  K:"Determine old-tile event", L:"Eat food", M:"First aid", N:"Sleep", O:"Condition check", P:"Move enemies"
};

let state: MiruState = structuredClone(DEFAULT_STATE);
let ready = false;
let saveTimer: number | undefined;

function phase(step: Step) {
  const i = steps.indexOf(step);
  if (i <= 4) return "DAWN";
  if (i <= 10) return "DAY";
  if (i <= 12) return "DUSK";
  return "DARK";
}

function roll(n: number, sides: number) {
  const dice = Array.from({length:n}, () => Math.floor(Math.random()*sides)+1);
  return { dice, total: dice.reduce((a,b)=>a+b,0) };
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveState(state), 120);
}

function setState(patch: Partial<MiruState>) {
  state = { ...state, ...patch };
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

function render() {
  app.innerHTML = `
    <header class="hero"><div><div class="eyebrow">MIRU // FIELD CONTROL</div><h1>DAY ${String(state.day).padStart(2,"0")} <span>${phase(state.step)}</span></h1></div><div class="hex">${state.currentHex}</div></header>
    ${!ready ? `<div class="notice">Open a scene in Owlbear Rodeo to persist state and place map stamps.</div>` : ""}

    <section class="vitals">
      ${meter("HP","hp",state.hp)}
      ${meter("EP","ep",state.ep)}
    </section>

    <section>
      <div class="section-title"><span>TURN TRACKER</span><small>${state.step}: ${stepNames[state.step]}</small></div>
      <div class="steps">${steps.map(s => `<button class="step ${s===state.step?"active":""}" data-step="${s}" title="${stepNames[s]}">${s}</button>`).join("")}</div>
      <div class="turn-actions"><button id="prev-step">← Previous</button><button id="next-step" class="primary">Next step →</button><button id="next-day">Next day +</button></div>
    </section>

    <section>
      <div class="section-title"><span>QUICK ROLLS</span><small id="roll-result">Ready</small></div>
      <div class="roll-grid">
        <button data-roll="terrain">Terrain <b>1d6</b></button>
        <button data-roll="weather">Weather <b>1d6</b></button>
        <button data-roll="event">Event <b>3d6</b></button>
        <button data-roll="encounter">Encounter <b>1d6</b></button>
        <button data-roll="escape">Escape <b>1d6</b></button>
        <button data-roll="enemy">Enemy ATK <b>1d6</b></button>
      </div>
    </section>

    <section>
      <div class="section-title"><span>CONDITIONS</span><small>tap ± to track</small></div>
      <div class="condition-grid">
        ${condition("Starvation","starvation",state.starvation,8)}
        ${condition("Poison","poison",state.poison,8)}
        ${condition("Sleep dep.","sleepDeprivation",state.sleepDeprivation,5)}
        ${condition("Minor injuries","minorInjuries",state.minorInjuries,3)}
      </div>
    </section>

    <section>
      <div class="section-title"><span>MAP STAMPS</span><small>placed at viewport center</small></div>
      <div class="stamp-group"><div class="stamp-label">Terrain</div><div class="chips">${TERRAIN.map(x=>`<button class="chip" data-stamp="${x}">${x}</button>`).join("")}</div></div>
      <div class="stamp-group"><div class="stamp-label">Icons</div><div class="chips">${ICONS.map(x=>`<button class="chip" data-stamp="${x}">${x}</button>`).join("")}</div></div>
    </section>

    <section>
      <div class="section-title"><span>FIELD NOTES</span><small>saved with scene</small></div>
      <label class="field-label">Current hex <input id="hex-input" value="${escapeHtml(state.currentHex)}" maxlength="12"></label>
      <textarea id="notes" rows="4" placeholder="Objective, unresolved quest, session notes…">${escapeHtml(state.notes)}</textarea>
    </section>

    <details>
      <summary>Campaign controls</summary>
      <div class="campaign-controls"><button id="reset">Reset MIRU state</button><span>Resets to Day 1, Step G, G-10, HP/EP 10, 3 Meal Bars.</span></div>
    </details>
  `;
  wire();
}

function condition(label: string, key: string, value: number, max: number) {
  return `<div class="condition"><span>${label}</span><b>${value}/${max}</b><div><button data-adjust="${key}" data-delta="-1">−</button><button data-adjust="${key}" data-delta="1">+</button></div></div>`;
}

function escapeHtml(s: string) { return s.replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]!)); }

function wire() {
  app.querySelectorAll<HTMLButtonElement>("[data-adjust]").forEach(btn=>btn.addEventListener("click",()=>adjust(btn.dataset.adjust as any, Number(btn.dataset.delta))));
  app.querySelectorAll<HTMLButtonElement>("[data-step]").forEach(btn=>btn.addEventListener("click",()=>setState({step: btn.dataset.step as Step})));
  document.querySelector<HTMLButtonElement>("#prev-step")?.addEventListener("click",()=>{
    const i=steps.indexOf(state.step); setState({step:steps[Math.max(0,i-1)]});
  });
  document.querySelector<HTMLButtonElement>("#next-step")?.addEventListener("click",()=>{
    const i=steps.indexOf(state.step); if(i===steps.length-1) setState({step:"A",day:clamp(state.day+1,1,66)}); else setState({step:steps[i+1]});
  });
  document.querySelector<HTMLButtonElement>("#next-day")?.addEventListener("click",()=>setState({day:clamp(state.day+1,1,66),step:"A"}));

  app.querySelectorAll<HTMLButtonElement>("[data-roll]").forEach(btn=>btn.addEventListener("click",()=>{
    const kind=btn.dataset.roll!; const spec=kind==="event"?[3,6]:[1,6]; const r=roll(spec[0],spec[1]);
    let extra="";
    if(kind==="terrain") extra = r.total===1?"Minor Injury":(["","Forest","Mountain","Grassland","Desert","Swamp"] as string[])[r.total] ?? "";
    const el=document.querySelector<HTMLElement>("#roll-result"); if(el) el.textContent=`${r.dice.join(" + ")} = ${r.total}${extra?` • ${extra}`:""}`;
  }));

  app.querySelectorAll<HTMLButtonElement>("[data-stamp]").forEach(btn=>btn.addEventListener("click", async()=>{
    try { await placeStamp(btn.dataset.stamp!); } catch(e) { await OBR.notification.show(e instanceof Error?e.message:"Could not place stamp","ERROR"); }
  }));

  const hex=document.querySelector<HTMLInputElement>("#hex-input");
  hex?.addEventListener("change",()=>setState({currentHex:hex.value.trim().toUpperCase() || "G-10"}));
  const notes=document.querySelector<HTMLTextAreaElement>("#notes");
  notes?.addEventListener("input",()=>{state={...state,notes:notes.value};scheduleSave();});
  document.querySelector<HTMLButtonElement>("#reset")?.addEventListener("click",async()=>{
    if(confirm("Reset all MIRU Companion campaign state for this scene?")){ state=structuredClone(DEFAULT_STATE); await saveState(state); render(); }
  });
}

async function boot() {
  await OBR.onReady(async()=>{
    ready=await OBR.scene.isReady();
    if(ready) state=await loadState();
    render();
    OBR.scene.onReadyChange(async (r: boolean)=>{ready=r;if(r)state=await loadState();render();});
    OBR.scene.onMetadataChange((meta: Record<string, unknown>)=>{const raw=meta["com.esortland.miru-companion/state"]; if(raw){void loadState().then(s=>{state=s;render();});}});
  });
}

void boot();
