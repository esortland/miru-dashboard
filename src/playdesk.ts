import OBR from "@owlbear-rodeo/sdk";
import { clamp, DEFAULT_COMBAT, DEFAULT_STATE, loadState, MiruState, normalizeState, saveState, Step } from "./state";
import { attemptEscape, basicAttack, enemyTurn, resetCombatLog, startCombat, techAttack, TRAINED_TECH, TrainedTechKey } from "./combat";
import "./playdesk.css";

const root = document.querySelector<HTMLDivElement>("#playdesk-app")!;
const steps: Step[] = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
const stepNames: Record<Step,string> = {A:"Fight enemy",B:"Mark calendar",C:"Reset solar",D:"Manage inventory",E:"Cutscene",F:"Move",G:"Determine terrain",H:"Check weather",I:"Determine new-tile event",J:"Experience icon event",K:"Determine old-tile event",L:"Eat food",M:"First aid",N:"Sleep",O:"Condition check",P:"Move enemies"};
const stepPages: Record<Step,string> = {A:"p.6",B:"p.6",C:"p.6",D:"p.6",E:"p.6",F:"p.7",G:"p.7",H:"p.7",I:"p.7",J:"p.8",K:"p.8",L:"p.8",M:"p.8",N:"p.9",O:"p.9",P:"p.9"};
const terrainByRoll: Record<number,string> = {2:"Forest",3:"Mountain",4:"Grassland",5:"Desert",6:"Swamp"};
const terrainPages: Record<string,string> = {Forest:"p.18",Mountain:"p.22",Grassland:"p.26",Desert:"p.30",Swamp:"p.34"};
const techSkills = [
  {key:"TS-1",name:"Dodge & Strike",leveled:true},{key:"TS-2",name:"Roll & Wire Slice",leveled:true},{key:"TS-3",name:"Jump & Attack",leveled:true},{key:"TS-4",name:"EMP Grenade",leveled:true},{key:"TS-5",name:"Sprint Tech",leveled:false},{key:"TS-6",name:"Electric Bolts",leveled:false},{key:"TS-7",name:"Flaming Arrows",leveled:false}
] as const;

type Tab = "map"|"character"|"combat"|"journal";
let state: MiruState = structuredClone(DEFAULT_STATE);
let activeTab: Tab = "map";
let guideOpen = false;
let previewStep: Step | null = null;
let localTerrainRoll: number | null = null;
let saveTimer: number | undefined;
let saveText = "Saved to this room";

const esc = (s:string) => s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const currentHexInfo = () => state.mapHexes?.[state.currentHex] ?? {};
const currentArrival = () => state.arrival?.day===state.day && state.arrival.hex===state.currentHex ? state.arrival : null;
const phase = (step:Step) => steps.indexOf(step)<=4?"DAWN":steps.indexOf(step)<=10?"DAY":steps.indexOf(step)<=12?"DUSK":"DARK";

function scheduleSave(){
  clearTimeout(saveTimer);
  saveText="Saving…"; paintChrome();
  saveTimer=window.setTimeout(()=>void saveState(state).then(()=>{saveText="Saved to this room";paintChrome();}),120);
}
function setState(patch:Partial<MiruState>){ state={...state,...patch}; render(); scheduleSave(); }
function replaceState(next:MiruState){ state=next; render(); scheduleSave(); }
function adjust(key:"hp"|"ep"|"day"|"starvation"|"poison"|"sleepDeprivation"|"minorInjuries",delta:number){
  const max=key==="day"?66:key==="sleepDeprivation"?5:key==="minorInjuries"?3:key==="hp"||key==="ep"?20:8;
  setState({[key]:clamp(Number(state[key])+delta,key==="day"?1:0,max)} as Partial<MiruState>);
}

function itemTile(name:string,count:number,active=false){
  return `<article class="item-token ${active?"active-token":""}">
    <div class="item-mark">${active?"◆":"▰"}</div><div class="item-copy"><b>${esc(name)}</b><span>${count>1?`×${count}`:active?"ACTIVE BODY":"INVENTORY"}</span></div>
    <div class="item-token-actions">${active?`<button data-unequip="${esc(name)}">TO BAG</button>`:`<button data-inv="${esc(name)}" data-delta="-1">−</button><button data-inv="${esc(name)}" data-delta="1">+</button><button data-equip="${esc(name)}">READY</button>`}</div>
  </article>`;
}
function inventoryHtml(){
  const rows=Object.entries(state.inventory).filter(([,c])=>c>0).sort(([a],[b])=>a.localeCompare(b));
  return rows.length?rows.map(([n,c])=>itemTile(n,c)).join(""):`<div class="sheet-empty">No items in inventory.</div>`;
}
function activeBodyHtml(){ return state.activeBody.length?state.activeBody.map(n=>itemTile(n,1,true)).join(""):`<div class="sheet-empty">Ready items live here during DAY and combat.</div>`; }

function techHtml(){
  return techSkills.map(s=>{const v=state.techSkills[s.key]??0;return `<div class="tech-line"><div><b>${s.key}</b><span>${s.name}</span></div>${s.leveled?`<div class="stepper"><button data-skill="${s.key}" data-delta="-1">−</button><strong>${v?`LV ${v}`:"—"}</strong><button data-skill="${s.key}" data-delta="1">+</button></div>`:`<button data-toggle-skill="${s.key}" class="skill-toggle ${v?"learned":""}">${v?"LEARNED":"UNLEARNED"}</button>`}</div>`}).join("");
}

function characterHtml(){
  const unique=Object.values(state.inventory).filter(c=>c>0).length;
  return `<div class="sheet-page">
    <div class="sheet-header">
      <div><span class="micro">MIRU // CHARACTER SHEET</span><h2>FIELD SHEET</h2></div>
      <div class="sheet-vitals">
        <div class="dial hp"><span>HP</span><b>${state.hp}</b><small>/20</small><div><button data-adjust="hp" data-delta="-1">−</button><button data-adjust="hp" data-delta="1">+</button></div></div>
        <div class="dial ep"><span>EP</span><b>${state.ep}</b><small>/20</small><div><button data-adjust="ep" data-delta="-1">−</button><button data-adjust="ep" data-delta="1">+</button></div></div>
      </div>
    </div>
    <div class="character-grid">
      <section class="sheet-panel inventory-panel"><header><b>INVENTORY</b><span>${unique}/10 UNIQUE</span></header><div class="token-field">${inventoryHtml()}</div><form id="add-item" class="item-add"><input id="new-item" maxlength="48" placeholder="Found item…" required><input id="new-count" type="number" min="1" max="99" value="1"><button>ADD</button></form></section>
      <section class="sheet-panel body-panel"><header><b>ACTIVE BODY</b><span>${state.activeBody.length}/5</span></header><p class="panel-note">Items readied here are the ones available when it matters.</p><div class="token-field active-field">${activeBodyHtml()}</div></section>
      <section class="sheet-panel conditions-panel"><header><b>CONDITION TRACKS</b><span>DARK CHECK</span></header>
        ${conditionRow("STARVATION","starvation",state.starvation,8)}${conditionRow("POISON","poison",state.poison,8)}${conditionRow("SLEEP DEP.","sleepDeprivation",state.sleepDeprivation,5)}${conditionRow("MINOR INJURY","minorInjuries",state.minorInjuries,3)}
      </section>
      <section class="sheet-panel equipment-panel"><header><b>MASK / TOOLS / BITS</b><span>FIELD KIT</span></header><div class="placeholder-slots"><div><span>MASK</span><b>Track named masks as items</b></div><div><span>TOOLS</span><b>Track tools in inventory / body</b></div><div><span>BITS</span><b>Use notes until dedicated currency is added</b></div></div></section>
      <section class="sheet-panel tech-panel"><header><b>TECH SKILLS</b><span>TRAINING</span></header><div class="tech-list">${techHtml()}</div></section>
      <section class="sheet-panel calendar-panel"><header><b>CALENDAR</b><span>DAY ${String(state.day).padStart(2,"0")}</span></header><div class="calendar-strip">${Array.from({length:66},(_,i)=>i+1).map(d=>`<button class="calendar-day ${d===state.day?"today":""}" data-day="${d}">${String(d).padStart(2,"0")}</button>`).join("")}</div></section>
    </div>
  </div>`;
}
function conditionRow(label:string,key:string,value:number,max:number){ return `<div class="condition-row"><span>${label}</span><div class="pips">${Array.from({length:max},(_,i)=>`<i class="${i<value?"filled":""}"></i>`).join("")}</div><b>${value}/${max}</b><div class="stepper"><button data-adjust="${key}" data-delta="-1">−</button><button data-adjust="${key}" data-delta="1">+</button></div></div>`; }

function combatHtml(){
  const c=state.combat;
  const tech=(Object.keys(TRAINED_TECH) as TrainedTechKey[]).filter(k=>(state.techSkills[k]??0)>0).map(k=>{const s=TRAINED_TECH[k];return `<button class="combat-option" data-tech-attack="${k}"><b>${k}</b><span>LV ${state.techSkills[k]} · -${s.cost} EP${s.atk?` · +${s.atk} ATK`:" · +3 STUN"}</span></button>`}).join("")||`<div class="sheet-empty">No trained TS-1–TS-4 attacks available.</div>`;
  const log=c.log.length?c.log.slice().reverse().map(x=>`<div>${esc(x)}</div>`).join(""):`<div class="sheet-empty">Combat log is empty.</div>`;
  return `<div class="combat-workspace">
    <section class="enemy-card"><div class="combat-eyebrow">CONTACT // ${c.active?"LIVE":"READY"}</div><div class="enemy-title"><input data-combat="enemyName" value="${esc(c.enemyName)}"><strong>${c.enemyHp}/${c.enemyMaxHp} HP</strong></div><div class="enemy-bars"><span style="--pct:${Math.max(0,Math.min(100,c.enemyHp/c.enemyMaxHp*100))}%"></span></div><div class="enemy-stats">${numField("MAX HP","enemyMaxHp",c.enemyMaxHp)}${numField("DEF","enemyDef",c.enemyDef)}${numField("ESC","enemyEsc",c.enemyEsc)}${numField("ATK 1–2","enemyAtkLow",c.enemyAtkLow)}${numField("ATK 3–4","enemyAtkMid",c.enemyAtkMid)}${numField("ATK 5–6","enemyAtkHigh",c.enemyAtkHigh)}<label class="robot-check"><input type="checkbox" data-combat-check="robot" ${c.robot?"checked":""}> ROBOT</label></div></section>
    <section class="fighter-card"><header><div><span class="micro">YOU // ACTIVE LOADOUT</span><h2>${state.hp} HP · ${state.ep} EP</h2></div><button data-tab="character">OPEN SHEET</button></header><div class="combat-loadout">${activeBodyHtml()}</div><div class="fighter-fields">${numField("WEAPON ATK","weaponAtk",c.weaponAtk)}${numField("GEAR DEF","equipmentDef",c.equipmentDef)}</div><div class="status-boxes"><div>BURN <button data-combat-adjust="burn" data-delta="-1">−</button><b>${c.burn}</b><button data-combat-adjust="burn" data-delta="1">+</button></div><div>STUN <button data-combat-adjust="stun" data-delta="-1">−</button><b>${c.stun}</b><button data-combat-adjust="stun" data-delta="1">+</button></div></div></section>
    <section class="combat-command"><header><b>COMBAT ACTIONS</b><span>ENEMY ACTS FIRST</span></header><div class="primary-combat-actions"><button id="start-combat" class="danger">${c.active?"RESTART COMBAT":"START COMBAT"}</button><button id="enemy-turn">ENEMY TURN</button><button id="basic-attack">BASIC ATTACK</button><button id="escape-combat">ESCAPE · -2 EP</button></div><div class="tech-options">${tech}</div></section>
    <section class="combat-log-panel"><header><b>FIELD LOG</b><button id="clear-combat-log">CLEAR</button></header><div class="combat-log">${log}</div></section>
  </div>`;
}
function numField(label:string,key:string,value:number){return `<label class="combat-field"><span>${label}</span><input type="number" data-combat="${key}" value="${value}" min="0" max="999"></label>`;}

function journalHtml(){
  const arrival=currentArrival(); const hi=currentHexInfo();
  return `<div class="journal-page"><section class="journal-hero"><span class="micro">MIRU // EXPEDITION LOG</span><h2>DAY ${String(state.day).padStart(2,"0")} · ${esc(state.currentHex)}</h2><p>${arrival?`Arrived from ${arrival.from} on a ${arrival.kind} tile.`:"No movement context recorded for this day."}${hi.terrain?` Terrain: ${esc(hi.terrain)}.`:""}${hi.icon&&hi.icon!=="None"?` Marker: ${esc(hi.icon)}.`:""}</p></section><section class="journal-notes"><header><b>CAMPAIGN NOTES</b><span>AUTOSAVED</span></header><textarea id="notes" maxlength="4000" placeholder="Objective, unresolved quest, landmarks, enemies left behind…">${esc(state.notes)}</textarea></section>${campaignSaveHtml()}</div>`;
}
function campaignSaveHtml(){return `<section class="save-panel"><header><b>CAMPAIGN SAVE</b><span id="campaign-save-status">${saveText}</span></header><p>This campaign stays with the current Owlbear room.</p><div class="save-actions"><button id="export-campaign">EXPORT SAVE</button><button id="import-campaign">IMPORT SAVE</button><input id="import-campaign-file" type="file" accept="application/json,.json" hidden></div><details><summary>Start a new campaign</summary><p>Clears the room's MIRU campaign while keeping this room.</p><button id="new-campaign" class="danger">START NEW CAMPAIGN</button></details><button id="reset-combat" class="subtle">Reset combat card only</button></section>`;}

function guideHtml(step:Step){
  const h=currentHexInfo(); const arrival=currentArrival(); const terrain=h.terrain && h.terrain!=="Unknown"?h.terrain:"";
  let title=stepNames[step].toUpperCase(), body="", check="", roll="", action="";
  if(step==="F"){body="Choose an adjacent destination on the map. The companion remembers whether it was new or old and routes the next branch.";check=arrival?`${arrival.from} → ${arrival.hex} · ${arrival.kind.toUpperCase()} TILE`:"Move on the map when ready.";}
  else if(step==="G"){
    if(arrival?.kind==="old"){title="TERRAIN DOES NOT APPLY";body="You arrived on an Old Tile; do not determine terrain again.";check=h.icon&&h.icon!=="None"?"Use Step J for this icon.":"Use Step K for an old tile without an icon.";}
    else {body="For a New Tile, roll 1d6. 2–6 determine terrain; 1 is Minor Injury and discovers no terrain."; roll=`<div class="guide-roll"><button id="guide-roll">ROLL 1D6</button><output>${localTerrainRoll??"READY"}</output><div id="terrain-action">${localTerrainRoll?terrainAction(localTerrainRoll):""}</div></div>`;}
  } else if(step==="H"){title="CHECK WEATHER";body="Weather is optional. If you use it, roll 1d6 and reference the current terrain page.";check=terrain?`Current terrain: ${terrain} · ${terrainPages[terrain]??"terrain page"}`:"Resolve Step G first.";roll=`<div class="guide-roll"><button id="guide-weather-roll">ROLL 1D6</button><output id="weather-result">READY</output></div>`;action=`<button class="guide-primary" data-guide-step="I">SKIP WEATHER / CONTINUE → I</button>`;}
  else if(step==="I"){title="DETERMINE NEW-TILE EVENT";body="On a New Tile, roll 2d6 and use the sum on the terrain page.";check=terrain?`Reference ${terrain} · ${terrainPages[terrain]??"terrain page"}`:"Terrain is not resolved.";roll=`<div class="guide-roll"><button id="guide-event-roll">ROLL 2D6</button><output id="event-result">READY</output></div>`;}
  else if(step==="J"){body="On an Old Tile with an icon, resolve the recorded icon event.";check=h.icon&&h.icon!=="None"?`Recorded icon: ${h.icon}`:"No icon recorded; Step K may apply.";}
  else if(step==="K"){body="On an Old Tile without an icon, roll 1d6 and reference the old-tile event rule.";roll=`<div class="guide-roll"><button id="guide-old-roll">ROLL 1D6</button><output id="old-result">READY</output></div>`;}
  else if(step==="L"){body="If you have Food, you must eat at least one and may eat up to three during this step.";check=`Meal Bars: ${state.inventory["Meal Bar"]??0}${state.inventory["Fruit"]?` · Fruit: ${state.inventory["Fruit"]}`:""}`;}
  else if(step==="N"){body="If you can sleep, you must. Sleep normally restores +3 HP and +2 EP.";}
  else if(step==="O"){body="Check Starvation, Poison, and Sleep Deprivation in order and apply the rulebook effects.";check=`Starvation ${state.starvation} · Poison ${state.poison} · Sleep ${state.sleepDeprivation}`;}
  else if(step==="A"){body="If an Enemy shares your space, combat begins and the enemy acts first.";check=h.icon==="Enemy"?"Enemy marker recorded here.":"No Enemy marker recorded on this hex.";}
  else {body=`Follow Step ${step}: ${stepNames[step]}. Keep the rulebook decision in your hands; use the sheet and map to record the result.`;}
  return `<div class="guide-drawer-inner"><header><div><span class="micro">WHAT DO I DO NOW?</span><h3>STEP ${step} · ${title}</h3></div><button id="close-guide">×</button></header><p>${body}</p>${check?`<div class="guide-check">${check}</div>`:""}${roll}${action}<footer><span>RULEBOOK</span><b>${stepPages[step]}</b></footer></div>`;
}
function terrainAction(r:number){if(r===1)return `<div class="roll-resolution injury"><b>MINOR INJURY</b><span>-2 HP · +1 Minor Injury · no terrain</span><button id="apply-terrain">APPLY → STEP L</button></div>`;const t=terrainByRoll[r];return `<div class="roll-resolution"><b>${t.toUpperCase()}</b><span>Mark ${t} on ${state.currentHex}</span><button id="apply-terrain">MARK ${t.toUpperCase()} → H</button></div>`;}

function chromeHtml(){return `<header class="desk-chrome"><div class="brand-lockup"><span class="brand-mark">M</span><div><span>MIRU // PLAY DESK</span><b>DAY ${String(state.day).padStart(2,"0")} · ${phase(state.step)}</b></div></div><nav class="desk-tabs">${(["map","character","combat","journal"] as Tab[]).map(t=>`<button data-tab="${t}" class="${activeTab===t?"active":""}">${t.toUpperCase()}</button>`).join("")}</nav><div class="status-cluster"><button class="status-chip hp" data-tab="character"><span>HP</span><b>${state.hp}</b></button><button class="status-chip ep" data-tab="character"><span>EP</span><b>${state.ep}</b></button><button class="status-chip hex" data-tab="map"><span>HEX</span><b>${esc(state.currentHex)}</b></button><button class="step-chip" id="open-guide"><span>STEP ${state.step} · ${stepPages[state.step]}</span><b>${stepNames[state.step]}</b></button></div></header>`;}
function stepStripHtml(){return `<div class="step-dock"><button class="dock-nav" id="prev-step">←</button><div class="dock-steps">${steps.map(s=>`<button data-step="${s}" class="${s===state.step?"active":""}"><b>${s}</b><span>${stepPages[s]}</span></button>`).join("")}</div><button class="dock-nav" id="next-step">→</button><button class="next-day" id="next-day">DAY +</button></div>`;}

function render(){
  root.innerHTML=`${chromeHtml()}<main class="desk-stage"><section id="tab-map" class="desk-pane ${activeTab==="map"?"active":""}"><div id="map-app"></div></section><section id="tab-character" class="desk-pane ${activeTab==="character"?"active":""}"><div id="character-app">${characterHtml()}</div></section><section id="tab-combat" class="desk-pane ${activeTab==="combat"?"active":""}"><div id="combat-app">${combatHtml()}</div></section><section id="tab-journal" class="desk-pane ${activeTab==="journal"?"active":""}"><div id="journal-app">${journalHtml()}</div></section></main>${stepStripHtml()}<aside id="guide-drawer" class="guide-drawer ${guideOpen?"open":""}">${guideOpen?guideHtml(previewStep??state.step):""}</aside>`;
  wire();
  window.dispatchEvent(new CustomEvent("miru:playdesk-render"));
}
function paintChrome(){const status=document.querySelector<HTMLElement>("#campaign-save-status");if(status)status.textContent=saveText;}

async function applyTerrainRoll(){
  if(!localTerrainRoll)return; const r=localTerrainRoll; localTerrainRoll=null;
  if(r===1){const injuries=clamp(state.minorInjuries+1,0,3);state={...state,hp:clamp(state.hp-2,0,20),minorInjuries:injuries,terrainRoll:{day:state.day,hex:state.currentHex,result:1,applied:true},step:injuries>=3?"G":"L"};}
  else {const terrain=terrainByRoll[r];state={...state,mapHexes:{...state.mapHexes,[state.currentHex]:{...state.mapHexes[state.currentHex],explored:true,terrain}},terrainRoll:{day:state.day,hex:state.currentHex,result:r,applied:true},step:"H"};}
  previewStep=null; guideOpen=true; await saveState(state); render();
}

function exportCampaign(){const payload={format:"miru-companion-campaign",schemaVersion:2,exportedAt:new Date().toISOString(),state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`miru-campaign-day-${String(state.day).padStart(2,"0")}-${state.currentHex.toLowerCase()}.json`;a.click();URL.revokeObjectURL(url);}
async function importCampaign(file:File){try{const raw=JSON.parse(await file.text()) as {state?:unknown};const next=normalizeState(raw?.state??raw);if(!confirm("Replace the current room campaign with this backup?"))return;replaceState(next);await OBR.notification.show("Campaign imported.","SUCCESS");}catch{await OBR.notification.show("Could not import that MIRU save.","ERROR");}}

function wire(){
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab as Tab;guideOpen=false;render();});
  document.querySelector("#open-guide")?.addEventListener("click",()=>{previewStep=null;guideOpen=true;render();});
  document.querySelector("#close-guide")?.addEventListener("click",()=>{guideOpen=false;render();});
  document.querySelectorAll<HTMLButtonElement>("[data-step]").forEach(b=>b.onclick=()=>{previewStep=b.dataset.step as Step;guideOpen=true;render();});
  document.querySelectorAll<HTMLButtonElement>("[data-guide-step]").forEach(b=>b.onclick=()=>{state={...state,step:b.dataset.guideStep as Step};previewStep=null;guideOpen=true;scheduleSave();render();});
  document.querySelector("#prev-step")?.addEventListener("click",()=>{const i=steps.indexOf(state.step);setState({step:steps[(i-1+steps.length)%steps.length]});});
  document.querySelector("#next-step")?.addEventListener("click",()=>{const i=steps.indexOf(state.step);setState({step:steps[(i+1)%steps.length]});});
  document.querySelector("#next-day")?.addEventListener("click",()=>setState({day:clamp(state.day+1,1,66),step:"A",arrival:null,terrainRoll:null}));
  document.querySelectorAll<HTMLButtonElement>("[data-adjust]").forEach(b=>b.onclick=()=>adjust(b.dataset.adjust as any,Number(b.dataset.delta)));
  document.querySelectorAll<HTMLButtonElement>("[data-day]").forEach(b=>b.onclick=()=>setState({day:Number(b.dataset.day)}));
  document.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach(b=>b.onclick=()=>{const name=b.dataset.inv!,delta=Number(b.dataset.delta),inventory={...state.inventory};inventory[name]=Math.max(0,(inventory[name]??0)+delta);if(!inventory[name])delete inventory[name];setState({inventory});});
  document.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach(b=>b.onclick=()=>{const name=b.dataset.equip!;if(state.activeBody.length>=5||state.activeBody.includes(name))return;setState({activeBody:[...state.activeBody,name]});});
  document.querySelectorAll<HTMLButtonElement>("[data-unequip]").forEach(b=>b.onclick=()=>setState({activeBody:state.activeBody.filter(x=>x!==b.dataset.unequip)}));
  document.querySelector("#add-item")?.addEventListener("submit",e=>{e.preventDefault();const n=(document.querySelector<HTMLInputElement>("#new-item")?.value??"").trim(),c=Number(document.querySelector<HTMLInputElement>("#new-count")?.value??1);if(!n)return;setState({inventory:{...state.inventory,[n]:(state.inventory[n]??0)+Math.max(1,c)}});});
  document.querySelectorAll<HTMLButtonElement>("[data-skill]").forEach(b=>b.onclick=()=>{const key=b.dataset.skill!,techSkills={...state.techSkills};techSkills[key]=clamp((techSkills[key]??0)+Number(b.dataset.delta),0,6);if(!techSkills[key])delete techSkills[key];setState({techSkills});});
  document.querySelectorAll<HTMLButtonElement>("[data-toggle-skill]").forEach(b=>b.onclick=()=>{const key=b.dataset.toggleSkill!,techSkills={...state.techSkills};techSkills[key]=techSkills[key]?0:1;setState({techSkills});});
  document.querySelector<HTMLTextAreaElement>("#notes")?.addEventListener("change",e=>setState({notes:(e.target as HTMLTextAreaElement).value}));

  document.querySelectorAll<HTMLInputElement>("[data-combat]").forEach(input=>input.addEventListener("change",()=>{const key=input.dataset.combat as keyof typeof state.combat;const combat={...state.combat} as any;combat[key]=input.type==="number"?Number(input.value):input.value;setState({combat});}));
  document.querySelector<HTMLInputElement>("[data-combat-check='robot']")?.addEventListener("change",e=>setState({combat:{...state.combat,robot:(e.target as HTMLInputElement).checked}}));
  document.querySelectorAll<HTMLButtonElement>("[data-combat-adjust]").forEach(b=>b.onclick=()=>{const key=b.dataset.combatAdjust as "burn"|"stun";setState({combat:{...state.combat,[key]:clamp(state.combat[key]+Number(b.dataset.delta),0,3)}});});
  document.querySelector("#start-combat")?.addEventListener("click",()=>replaceState(startCombat(state)));
  document.querySelector("#enemy-turn")?.addEventListener("click",()=>replaceState(enemyTurn(state)));
  document.querySelector("#basic-attack")?.addEventListener("click",()=>replaceState(basicAttack(state)));
  document.querySelector("#escape-combat")?.addEventListener("click",()=>replaceState(attemptEscape(state)));
  document.querySelectorAll<HTMLButtonElement>("[data-tech-attack]").forEach(b=>b.onclick=()=>replaceState(techAttack(state,b.dataset.techAttack as TrainedTechKey)));
  document.querySelector("#clear-combat-log")?.addEventListener("click",()=>replaceState(resetCombatLog(state)));
  document.querySelector("#reset-combat")?.addEventListener("click",()=>setState({combat:structuredClone(DEFAULT_COMBAT)}));

  document.querySelector("#guide-roll")?.addEventListener("click",()=>{localTerrainRoll=Math.floor(Math.random()*6)+1;render();});
  document.querySelector("#apply-terrain")?.addEventListener("click",()=>void applyTerrainRoll());
  document.querySelector("#guide-weather-roll")?.addEventListener("click",()=>{const o=document.querySelector<HTMLOutputElement>("#weather-result");if(o)o.textContent=String(Math.floor(Math.random()*6)+1);});
  document.querySelector("#guide-event-roll")?.addEventListener("click",()=>{const a=Math.floor(Math.random()*6)+1,b=Math.floor(Math.random()*6)+1,o=document.querySelector<HTMLOutputElement>("#event-result");if(o)o.textContent=`${a} + ${b} = ${a+b}`;});
  document.querySelector("#guide-old-roll")?.addEventListener("click",()=>{const o=document.querySelector<HTMLOutputElement>("#old-result");if(o)o.textContent=String(Math.floor(Math.random()*6)+1);});

  document.querySelector("#export-campaign")?.addEventListener("click",exportCampaign);
  document.querySelector("#import-campaign")?.addEventListener("click",()=>document.querySelector<HTMLInputElement>("#import-campaign-file")?.click());
  document.querySelector<HTMLInputElement>("#import-campaign-file")?.addEventListener("change",e=>{const f=(e.target as HTMLInputElement).files?.[0];if(f)void importCampaign(f);});
  document.querySelector("#new-campaign")?.addEventListener("click",()=>{if(confirm("Start a new MIRU campaign in this room?"))replaceState(structuredClone(DEFAULT_STATE));});
}

OBR.onReady(async()=>{
  state=await loadState(); render();
  OBR.room.onMetadataChange(meta=>{if(meta["com.esortland.miru-companion/state"]){void loadState().then(fresh=>{state=fresh;render();});}});
});
