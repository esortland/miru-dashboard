import OBR from "@owlbear-rodeo/sdk";
import { clamp, loadState, MiruState, saveState, Step } from "./state";
import "./rules.css";

type Card={title:string;prompt:string;check?:string;roll?:[number,number,string];pages:string[];detail?:string};

const stepPages:Record<Step,string[]>={
  A:["p.6 Steps in a Turn","p.14 Combat"],B:["p.6 Steps in a Turn"],C:["p.6 Steps in a Turn"],D:["p.6 Steps in a Turn","p.10–11 Bag & Stats"],E:["p.6 Steps in a Turn","p.50–53 Cutscenes"],F:["p.7 Steps in a Turn","p.12 Exploring the Map"],G:["p.7 Steps in a Turn","p.17 Minor Injury"],H:["p.7 Steps in a Turn","p.5 Optional Weather"],I:["p.7 Steps in a Turn"],J:["p.8 Steps in a Turn"],K:["p.8 Steps in a Turn","p.56 Enemies"],L:["p.8 Steps in a Turn"],M:["p.8 Steps in a Turn"],N:["p.9 Steps in a Turn"],O:["p.9 Steps in a Turn"],P:["p.9 Steps in a Turn"]};
const stepPrimaryPage:Record<Step,string>={A:"p.6",B:"p.6",C:"p.6",D:"p.6",E:"p.6",F:"p.7",G:"p.7",H:"p.7",I:"p.7",J:"p.8",K:"p.8",L:"p.8",M:"p.8",N:"p.9",O:"p.9",P:"p.9"};
const terrainPages:Record<string,string>={Forest:"p.18 Forest",Mountain:"p.22 Mountain",Grassland:"p.26 Grassland",Desert:"p.30 Desert",Swamp:"p.34 Swamp"};
const terrainByRoll:Record<number,string>={2:"Forest",3:"Mountain",4:"Grassland",5:"Desert",6:"Swamp"};
const iconPages:Record<string,string>={Village:"p.38 Villages",Quest:"p.40 Quests","Radio Tower":"p.52 Radio Tower","Power Supply":"p.53 Power Supply",Enemy:"p.56 Enemies",Treasure:"p.57 Treasure Maps"};

let state:MiruState;
let previewStep:Step|null=null;
const hex=()=>state.mapHexes?.[state.currentHex]??{};
const currentTerrainRoll=()=>state.terrainRoll?.day===state.day&&state.terrainRoll.hex===state.currentHex?state.terrainRoll:null;

function card(step:Step):Card{
  const h=hex();
  const pages=[...stepPages[step]];
  const terrainPage=h.terrain?terrainPages[h.terrain]:undefined;
  if(terrainPage&&["H","I"].includes(step))pages.push(terrainPage);
  const tr=currentTerrainRoll();

  switch(step){
    case"A":return{title:"FIGHT ENEMY IN YOUR SPACE",prompt:"Check whether an Enemy shares your current hex. If so, combat begins and the enemy acts first.",check:h.icon==="Enemy"?"Enemy marker found on this hex.":"No Enemy marker is recorded here; verify the map before continuing.",pages};
    case"B":return{title:"MARK CALENDAR",prompt:"Mark the current calendar day, then check whether that date has a Cutscene dot.",check:`Current tracked day: ${String(state.day).padStart(2,"0")}.`,pages};
    case"C":return{title:"RESET SOLAR ITEMS",prompt:"Make used Solar Items in your possession operable again. Confirm the reset yourself before continuing.",pages};
    case"D":return{title:"MANAGE INVENTORY",prompt:"Rearrange Inventory and Active Body items as needed. In combat, only items on your Active Body may be used.",check:`${state.activeBody.length}/5 Active Body slots currently used.`,pages};
    case"E":return{title:"EXPERIENCE CUTSCENE",prompt:"If the current calendar date has a dot, resolve that Cutscene. Otherwise skip this step.",pages};
    case"F":return{title:"MOVE",prompt:"Choose where to move. A tile never visited before is a New Tile; a discovered tile or a tile with an icon is an Old Tile.",check:"Choose the destination on the map; you remain in control of the move.",pages};
    case"G":return{title:"DETERMINE TERRAIN",prompt:"For a New Tile, roll 1d6. Results 2–6 determine terrain. A roll of 1 is a Minor Injury instead: no terrain is discovered that day.",roll:[1,6,"Terrain"],detail:"1 = Minor Injury (p.17) • 2 = Forest (p.18) • 3 = Mountain (p.22) • 4 = Grassland (p.26) • 5 = Desert (p.30) • 6 = Swamp (p.34).",pages};
    case"H":return tr?.result===1?{title:"WEATHER DOES NOT APPLY",prompt:"Your Step G result was Minor Injury. You do not discover terrain, so there is no terrain weather to check. Continue to Step L after resolving the injury.",check:"Do not choose Unknown as terrain; leave the terrain unrecorded.",pages:[...pages,"p.17 Minor Injury"]}:{title:"CHECK WEATHER",prompt:"Weather is optional. If you are using it, roll 1d6 and reference the current terrain page.",check:h.terrain&&h.terrain!=="Unknown"?`Current terrain: ${h.terrain}.`:"Terrain has not been recorded yet. Return to Step G and apply its result first.",roll:[1,6,"Weather"],pages};
    case"I":return tr?.result===1?{title:"NEW-TILE EVENT DOES NOT APPLY",prompt:"Your Step G result was Minor Injury. The rules skip the rest of exploration for this day; continue to Step L after resolving the injury.",check:"No terrain or event is recorded for this tile today.",pages:[...pages,"p.17 Minor Injury"]}:{title:"DETERMINE NEW-TILE EVENT",prompt:"For a New Tile, roll 3d6 and use the current terrain page to determine the event. Then follow the event's instructions.",check:h.terrain&&h.terrain!=="Unknown"?`Reference ${h.terrain}.`:"Terrain is not resolved. Return to Step G and apply the terrain result before rolling an event.",roll:[3,6,"Event"],pages};
    case"J":{const iconPage=h.icon?iconPages[h.icon]:undefined;if(iconPage)pages.push(iconPage);return{title:"EXPERIENCE ICON EVENT",prompt:"On an Old Tile with an icon, go to that icon's event page and experience the event.",check:h.icon&&h.icon!=="None"?`Recorded icon: ${h.icon}.`:"No icon is recorded here; Step K may apply instead.",pages};}
    case"K":return{title:"DETERMINE OLD-TILE EVENT",prompt:"If this Old Tile has no icon, roll 1d6 and reference p.56 for the result.",roll:[1,6,"Old-tile event"],pages};
    case"L":return{title:"EAT FOOD",prompt:"If you have Food, you must eat at least one item and may eat up to three. Food is consumed only during this step.",check:`${state.inventory["Meal Bar"]??0} Meal Bars currently tracked.`,pages};
    case"M":return{title:"APPLY FIRST AID",prompt:"If you have a First Aid Kit, you may use it here. Otherwise continue to Step N.",check:state.inventory["First Aid Kit"]?"First Aid Kit found in inventory.":"No First Aid Kit is currently tracked.",pages};
    case"N":return{title:"ATTEMPT TO SLEEP",prompt:"If you can Sleep, you must. Events or weather may prevent it; if you cannot sleep, continue to Step O.",check:"Sleep normally restores +3 HP and +2 EP.",pages};
    case"O":return{title:"CONDITION CHECK",prompt:"Check Starvation, Poison, and Sleep Deprivation in order. Apply relevant effects and reset counts that do not apply.",check:`Starvation ${state.starvation} • Poison ${state.poison} • Sleep deprivation ${state.sleepDeprivation}.`,pages};
    case"P":return{title:"MOVE ENEMIES",prompt:"If a mapped Enemy moves, resolve its movement now using that enemy's specific rules.",check:"The companion does not move enemies for you.",pages};
  }
}

function dice(n:number,s:number){const d=Array.from({length:n},()=>Math.floor(Math.random()*s)+1);return{d,total:d.reduce((a,b)=>a+b,0)}}

function decorateSteps(){
  const root=document.querySelector<HTMLElement>("#app");if(!root)return;
  root.querySelectorAll<HTMLButtonElement>("[data-step]").forEach(button=>{
    const step=button.dataset.step as Step;if(!stepPrimaryPage[step])return;
    button.classList.add("guide-step");
    button.title=`Step ${step}: What do I do now? — ${stepPages[step].join(", ")}`;
    button.setAttribute("aria-label",`Step ${step}, ${stepPrimaryPage[step]}, what do I do now?`);
    button.innerHTML=`<b>${step}</b><span>${stepPrimaryPage[step]}</span>`;
  });
}

async function applyTerrainResult(result:number){
  const roll={day:state.day,hex:state.currentHex,result,applied:true};
  if(result===1){
    const nextInjuries=clamp(state.minorInjuries+1,0,3);
    state={...state,hp:clamp(state.hp-2,0,20),minorInjuries:nextInjuries,terrainRoll:roll,step:nextInjuries>=3?"G":"L"};
  }else{
    const terrain=terrainByRoll[result];
    state={...state,mapHexes:{...state.mapHexes,[state.currentHex]:{...state.mapHexes[state.currentHex],explored:true,terrain}},terrainRoll:roll,step:"H"};
  }
  previewStep=null;
  await saveState(state);
  render();
}

function render(){
  const root=document.querySelector<HTMLElement>("#app");if(!root||!state)return;
  decorateSteps();
  document.querySelector("#miru-rule-guide")?.remove();
  const shownStep=previewStep??state.step,c=card(shownStep),sec=document.createElement("section");
  sec.id="miru-rule-guide";sec.className="rule-guide";
  sec.innerHTML=`<div class="rule-kicker"><span>WHAT DO I DO NOW?</span><b>STEP ${shownStep}</b></div><h2>${c.title}</h2><p class="rule-prompt">${c.prompt}</p>${c.check?`<div class="rule-check">${c.check}</div>`:""}${c.roll?`<div class="rule-roll"><div><span>ROLL / CHECK</span><b>${c.roll[0]}d${c.roll[1]} ${c.roll[2]}</b></div><button id="guide-roll">ROLL ${c.roll[0]}D${c.roll[1]}</button><output id="guide-roll-result">Ready</output><div id="guide-roll-action"></div></div>`:""}${c.detail?`<details class="rule-detail"><summary>Result reference</summary><p>${c.detail}</p></details>`:""}<div class="rule-page-callout"><span>RULEBOOK</span><b>${stepPrimaryPage[shownStep]}</b></div><details class="rule-pages"><summary>All references</summary><div>${c.pages.map(p=>`<span>${p}</span>`).join("")}</div><small>Printed page numbers in your MIRU rulebook PDF.</small></details>`;
  const turn=[...root.querySelectorAll<HTMLElement>(":scope > section")].find(s=>s.querySelector(".section-title span")?.textContent?.includes("TURN TRACKER"));
  if(turn)turn.insertAdjacentElement("afterend",sec);else root.prepend(sec);

  sec.querySelector("#guide-roll")?.addEventListener("click",()=>{
    if(!c.roll)return;
    const r=dice(c.roll[0],c.roll[1]),out=sec.querySelector<HTMLOutputElement>("#guide-roll-result");
    if(out)out.textContent=c.roll[0]===1?String(r.total):`${r.d.join(" + ")} = ${r.total}`;
    if(shownStep==="G"){
      state={...state,terrainRoll:{day:state.day,hex:state.currentHex,result:r.total,applied:false}};
      void saveState(state);
      const action=sec.querySelector<HTMLElement>("#guide-roll-action");
      if(action){
        if(r.total===1){
          action.innerHTML=`<div class="terrain-result injury-result"><b>MINOR INJURY</b><span>-2 HP • +1 Minor Injury • no terrain discovered</span><small>${state.minorInjuries>=2?"This would be your third injury: resolve p.21 after applying.":"After applying, skip to Step L."}</small><button id="apply-terrain-result">APPLY MINOR INJURY</button></div>`;
        }else{
          const terrain=terrainByRoll[r.total];
          action.innerHTML=`<div class="terrain-result"><b>${terrain.toUpperCase()}</b><span>Mark ${terrain} on ${state.currentHex}</span><button id="apply-terrain-result">MARK ${terrain.toUpperCase()} → STEP H</button></div>`;
        }
        action.querySelector("#apply-terrain-result")?.addEventListener("click",()=>void applyTerrainResult(r.total));
      }
    }
  });
}

async function refresh(){state=await loadState();previewStep=null;render()}
OBR.onReady(async()=>{
  await refresh();
  OBR.room.onMetadataChange(meta=>{if(meta["com.esortland.miru-companion/state"])void refresh();});
  document.addEventListener("click",event=>{
    const button=(event.target as Element|null)?.closest<HTMLButtonElement>("[data-step]");if(!button)return;
    const step=button.dataset.step as Step;if(!stepPrimaryPage[step])return;
    previewStep=step;render();
  });
});
