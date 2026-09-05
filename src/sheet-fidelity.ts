import OBR from "@owlbear-rodeo/sdk";
import { clamp, loadState, MiruState, saveState } from "./state";
import { itemDefinition, SUPPLY_ITEMS, SupplyName } from "./item-catalog";
import "./sheet-fidelity.css";

let state: MiruState | null = null;
let refreshQueued = false;

const esc = (s:string) => s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const supplyIcon: Record<SupplyName,string> = { Fruit:"✦", "Meal Bar":"▣", Bits:"$", Arrows:"➶" };

function shape(name:string){
  const def=itemDefinition(name);
  return `<span class="sheet-shape shape-${def.shape}" aria-hidden="true"></span>`;
}

function bagCount(name:string,count:number){
  return Math.max(0,count-(state?.activeBody.includes(name)?1:0));
}

function inventoryEntries(){
  if(!state)return [] as [string,number][];
  return Object.entries(state.inventory)
    .map(([name,count])=>[name,bagCount(name,count)] as [string,number])
    .filter(([,count])=>count>0)
    .sort(([a],[b])=>a.localeCompare(b));
}

function supplyWell(name:SupplyName){
  if(!state)return "";
  const value=state.supplies[name]??0;
  const label=name==="Bits"?"BITLITHS / BITS":name.toUpperCase();
  return `<section class="supply-well supply-${name.toLowerCase().replace(/\s/g,"-")}">
    <div class="supply-display"><b>${value}</b></div>
    <div class="supply-medallion"><span>${supplyIcon[name]}</span></div>
    <div class="supply-label">${label}</div>
    <div class="supply-stepper"><button data-supply="${name}" data-delta="-1">−</button><button data-supply="${name}" data-delta="1">+</button></div>
  </section>`;
}

function itemLine(name:string,count:number,active=false){
  const def=itemDefinition(name);
  return `<article class="sheet-item ${active?"is-active":""}" data-shape="${def.shape}">
    <div class="sheet-item-shape">${shape(name)}</div>
    <div class="sheet-item-copy"><b>${esc(name)}</b>${def.effect?`<span>${esc(def.effect)}</span>`:""}</div>
    ${count>1?`<strong class="sheet-item-count">×${count}</strong>`:""}
    <div class="sheet-item-actions">${active
      ? `<button data-unequip="${esc(name)}">TO BAG</button>`
      : `<button data-item="${esc(name)}" data-delta="-1">−</button><button data-item="${esc(name)}" data-delta="1">+</button><button data-equip="${esc(name)}">READY</button>`}</div>
  </article>`;
}

function inventoryHtml(){
  const rows=inventoryEntries();
  return rows.length?rows.map(([n,c])=>itemLine(n,c)).join(""):`<div class="sheet-empty-paper">No bag items.</div>`;
}

function activeHtml(){
  if(!state)return "";
  return state.activeBody.length?state.activeBody.map(n=>itemLine(n,1,true)).join(""):`<div class="sheet-empty-paper">Ready items during Step D.</div>`;
}

function conditionTrack(label:string,key:"starvation"|"sleepDeprivation",value:number,max:number,icon:string){
  return `<div class="vertical-track"><span class="track-icon">${icon}</span><div class="track-boxes">${Array.from({length:max},(_,i)=>`<button data-track="${key}" data-value="${i+1}" class="${i<value?"filled":""}" aria-label="${label} ${i+1}"></button>`).join("")}</div><small>${label}</small></div>`;
}

function minorInjuries(){
  if(!state)return "";
  return `<div class="injury-stack">${[1,2,3].map(i=>`<button data-injury="${i}" class="${i<=state!.minorInjuries?"filled":""}">${i}</button>`).join("")}</div>`;
}

function techRows(){
  if(!state)return "";
  const trained=[
    ["TS-1","DODGE & STRIKE"],["TS-2","ROLL & WIRE SLICE"],["TS-3","JUMP & ATTACK"],["TS-4","EMP GRENADE"]
  ] as const;
  const noTraining=[["TS-5","SPRINT TECH"],["TS-6","ELECTRIC BOLTS"],["TS-7","FLAMING ARROWS"]] as const;
  return `<div class="available-dice"><span>AVAILABLE DICE</span><div><i>•</i><i>••</i><i>•••</i></div></div>
    <div class="trained-skills">${trained.map(([key,name])=>{const level=state!.techSkills[key]??0;return `<div class="sheet-skill"><header><span>${key}</span><b>${name}</b></header><div class="skill-levels">${[1,2,3,4,5,6].map(n=>`<button data-skill-set="${key}" data-level="${n}" class="${n===level?"active":""}">${n}</button>`).join("")}</div></div>`}).join("")}</div>
    <div class="no-training"><b>NO TRAINING REQUIRED</b>${noTraining.map(([key,name])=>`<button data-toggle-skill="${key}" class="${state!.techSkills[key]?"active":""}"><i></i><span>${key} ${name}</span></button>`).join("")}</div>`;
}

function calendar(){
  if(!state)return "";
  const cutsceneDays=new Set([3,15,25,40,50]);
  return `<div class="sheet-calendar">${Array.from({length:66},(_,i)=>i+1).map(d=>`<button data-calendar-day="${d}" class="${d===state!.day?"today":""}">${String(d).padStart(2,"0")}${cutsceneDays.has(d)?`<i></i>`:""}</button>`).join("")}<span class="calendar-end">END</span></div>`;
}

function renderSheet(){
  if(!state)return;
  const host=document.querySelector<HTMLDivElement>("#character-app");
  if(host){
    const inv=inventoryEntries();
    host.innerHTML=`<div class="sheet-fidelity">
      <div class="sheet-topline">
        <div class="supply-bank">${SUPPLY_ITEMS.map(supplyWell).join("")}</div>
        <section class="base-stats"><span>BASE STATS</span><div><b>1<small>ATK</small></b><b>1<small>DEF</small></b><i class="survivor-mark">?</i></div></section>
        <section class="paper-vital"><div class="vital-window"><small>MAX 20</small><b>${state.hp}</b></div><strong>HP</strong><div class="paper-stepper"><button data-vital="hp" data-delta="-1">−</button><button data-vital="hp" data-delta="1">+</button></div></section>
        <section class="paper-vital"><div class="vital-window"><small>MAX 20</small><b>${state.ep}</b></div><strong>EP</strong><div class="paper-stepper"><button data-vital="ep" data-delta="-1">−</button><button data-vital="ep" data-delta="1">+</button></div></section>
      </div>

      <div class="sheet-main-grid">
        <aside class="condition-gutter">${conditionTrack("STARVATION","starvation",state.starvation,8,"🍴")}${conditionTrack("SLEEP DEP.","sleepDeprivation",state.sleepDeprivation,5,"zzz")}</aside>
        <section class="paper-panel inventory-paper"><header><b>INVENTORY</b><span>MAX 10 ITEMS · ${inv.length}/10</span></header><div class="paper-items inventory-lines">${inventoryHtml()}</div><form id="sheet-add-item" class="paper-add"><input id="sheet-new-item" placeholder="Found item…" maxlength="48" required><input id="sheet-new-count" type="number" min="1" max="99" value="1"><button>ADD</button></form></section>
        <section class="paper-panel body-paper"><header><b>ACTIVE BODY</b><span>MAX 5 ITEMS · ${state.activeBody.length}/5</span></header><div class="paper-items active-lines">${activeHtml()}</div></section>
        <section class="paper-side-stack">
          <div class="paper-panel mini-panel mask-paper"><header><b>MASK</b></header>${state.mask?`<div class="mini-item">${shape(state.mask)}<b>${esc(state.mask)}</b><button id="remove-mask">×</button></div>`:`<div class="mini-empty">—</div>`}</div>
          <div class="paper-panel mini-panel tools-paper"><header><b>TOOLS</b></header>${state.tools.length?state.tools.map(t=>`<div class="mini-item">${shape(t)}<b>${esc(t)}</b><button data-remove-tool="${esc(t)}">×</button></div>`).join(""):`<div class="mini-empty">—</div>`}</div>
          <div class="paper-panel injury-paper"><header><b>MINOR<br>INJURIES</b></header>${minorInjuries()}</div>
        </section>
        <section class="paper-panel tech-paper"><header><b>TECH SKILLS</b></header>${techRows()}</section>
        <section class="calendar-paper">${calendar()}</section>
      </div>
    </div>`;
    wireSheet();
  }
  patchGuide();
}

function patchGuide(){
  if(!state)return;
  const guide=document.querySelector<HTMLElement>("#guide-drawer");
  const title=guide?.querySelector("h3")?.textContent??"";
  if(title.startsWith("STEP L")){
    const check=guide?.querySelector<HTMLElement>(".guide-check");
    if(check)check.textContent=`Meal Bars: ${state.supplies["Meal Bar"]} · Fruit: ${state.supplies.Fruit}`;
  }
}

async function commit(next:MiruState){
  state=next;
  renderSheet();
  await saveState(next);
}

function setSupply(name:SupplyName,delta:number){
  if(!state)return;
  const supplies={...state.supplies,[name]:clamp((state.supplies[name]??0)+delta,0,999)};
  void commit({...state,supplies});
}

function setInventoryCount(name:string,delta:number){
  if(!state)return;
  const inventory={...state.inventory};
  const next=Math.max(0,(inventory[name]??0)+delta);
  if(next)inventory[name]=next;else delete inventory[name];
  const activeBody=next?state.activeBody:state.activeBody.filter(x=>x!==name);
  void commit({...state,inventory,activeBody});
}

function addFoundItem(name:string,count:number){
  if(!state)return;
  const def=itemDefinition(name);
  if(def.zone==="supply"){
    const key=def.name as SupplyName;
    const supplies={...state.supplies,[key]:clamp((state.supplies[key]??0)+count,0,999)};
    void commit({...state,supplies});
    return;
  }
  if(def.zone==="mask"){
    void commit({...state,mask:def.name});
    return;
  }
  if(def.zone==="tool"){
    const tools=state.tools.includes(def.name)?state.tools:[...state.tools,def.name];
    void commit({...state,tools});
    return;
  }
  const currentBag=inventoryEntries();
  const isNew=!state.inventory[name];
  if(isNew&&currentBag.length>=10){void OBR.notification.show("Inventory is full: 10 unique bag items.","WARNING");return;}
  setInventoryCount(name,count);
}

function equip(name:string){
  if(!state||state.activeBody.includes(name))return;
  if(state.activeBody.length>=5){void OBR.notification.show("Active Body is full: max 5 items.","WARNING");return;}
  const shapeType=itemDefinition(name).shape;
  if(shapeType!=="rectangle"&&state.activeBody.some(x=>itemDefinition(x).shape===shapeType)){
    void OBR.notification.show(`Only one ${shapeType} item fits on the Active Body.`,"WARNING");return;
  }
  void commit({...state,activeBody:[...state.activeBody,name]});
}

function wireSheet(){
  if(!state)return;
  document.querySelectorAll<HTMLButtonElement>("[data-supply]").forEach(b=>b.onclick=()=>setSupply(b.dataset.supply as SupplyName,Number(b.dataset.delta)));
  document.querySelectorAll<HTMLButtonElement>("[data-vital]").forEach(b=>b.onclick=()=>{if(!state)return;const key=b.dataset.vital as "hp"|"ep";void commit({...state,[key]:clamp(state[key]+Number(b.dataset.delta),0,20)});});
  document.querySelectorAll<HTMLButtonElement>("[data-track]").forEach(b=>b.onclick=()=>{if(!state)return;const key=b.dataset.track as "starvation"|"sleepDeprivation";const value=Number(b.dataset.value);void commit({...state,[key]:state[key]===value?value-1:value});});
  document.querySelectorAll<HTMLButtonElement>("[data-injury]").forEach(b=>b.onclick=()=>{if(!state)return;const value=Number(b.dataset.injury);void commit({...state,minorInjuries:state.minorInjuries===value?value-1:value});});
  document.querySelectorAll<HTMLButtonElement>("[data-item]").forEach(b=>b.onclick=()=>setInventoryCount(b.dataset.item!,Number(b.dataset.delta)));
  document.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach(b=>b.onclick=()=>equip(b.dataset.equip!));
  document.querySelectorAll<HTMLButtonElement>("[data-unequip]").forEach(b=>b.onclick=()=>{if(!state)return;void commit({...state,activeBody:state.activeBody.filter(x=>x!==b.dataset.unequip)});});
  document.querySelector("#remove-mask")?.addEventListener("click",()=>{if(state)void commit({...state,mask:null});});
  document.querySelectorAll<HTMLButtonElement>("[data-remove-tool]").forEach(b=>b.onclick=()=>{if(state)void commit({...state,tools:state.tools.filter(x=>x!==b.dataset.removeTool)});});
  document.querySelectorAll<HTMLButtonElement>("[data-skill-set]").forEach(b=>b.onclick=()=>{if(!state)return;const key=b.dataset.skillSet!,level=Number(b.dataset.level),techSkills={...state.techSkills};techSkills[key]=(techSkills[key]??0)===level?0:level;if(!techSkills[key])delete techSkills[key];void commit({...state,techSkills});});
  document.querySelectorAll<HTMLButtonElement>("[data-toggle-skill]").forEach(b=>b.onclick=()=>{if(!state)return;const key=b.dataset.toggleSkill!,techSkills={...state.techSkills};techSkills[key]=techSkills[key]?0:1;if(!techSkills[key])delete techSkills[key];void commit({...state,techSkills});});
  document.querySelectorAll<HTMLButtonElement>("[data-calendar-day]").forEach(b=>b.onclick=()=>{if(state)void commit({...state,day:Number(b.dataset.calendarDay)});});
  document.querySelector("#sheet-add-item")?.addEventListener("submit",e=>{e.preventDefault();const name=(document.querySelector<HTMLInputElement>("#sheet-new-item")?.value??"").trim();const count=Math.max(1,Number(document.querySelector<HTMLInputElement>("#sheet-new-count")?.value??1));if(name)addFoundItem(name,count);});
}

async function refresh(){
  if(refreshQueued)return;
  refreshQueued=true;
  queueMicrotask(async()=>{
    refreshQueued=false;
    state=await loadState();
    renderSheet();
  });
}

window.addEventListener("miru:playdesk-render",()=>void refresh());
OBR.onReady(async()=>{
  state=await loadState();
  renderSheet();
  OBR.room.onMetadataChange(meta=>{if(meta["com.esortland.miru-companion/state"])void refresh();});
});
