import OBR from "@owlbear-rodeo/sdk";
import "./map.css";
import { loadState, saveState, MiruState } from "./state";

const app = document.querySelector<HTMLDivElement>("#map-app")!;
const ROWS = ["A","B","C","D","E","F","G"] as const;
const TERRAIN = ["Unknown","Forest","Mountain","Grassland","Desert","Swamp"] as const;
const ICONS = ["None","Village","Quest","Treasure","Enemy","Radio Tower","Power Supply","Camp"] as const;

const SHEET_W = 820;
const SHEET_H = 576;
const HEX_RADIUS = 40;
const HEX_HALF_WIDTH = Math.sqrt(3) * HEX_RADIUS / 2;
const COLUMN_PITCH = HEX_HALF_WIDTH;
const ROW_PITCH = HEX_RADIUS * 1.5;
const ODD_ROW_FIRST_CENTER_X = 101;
const FIRST_ROW_CENTER_Y = 105;

type HexInfo = { explored?: boolean; terrain?: string; icon?: string; note?: string; visits?: number };
type MapState = MiruState & { mapHexes?: Record<string, HexInfo> };
let state: MapState;
let selected = "G-10";

function validCols(rowIndex:number){
  const oddRow = rowIndex % 2 === 1;
  return Array.from({length: oddRow ? 9 : 8}, (_,i)=> oddRow ? 1+i*2 : 2+i*2);
}
function id(row:string,col:number){return `${row}-${String(col).padStart(2,"0")}`}
function parse(hex:string){const m=/^([A-G])-(\d{2})$/.exec(hex); return m?{r:ROWS.indexOf(m[1] as (typeof ROWS)[number]),c:Number(m[2])}:null}
function adjacent(a:string,b:string){
  const x=parse(a), y=parse(b); if(!x||!y) return false;
  if(x.r===y.r) return Math.abs(x.c-y.c)===2;
  return Math.abs(x.r-y.r)===1 && Math.abs(x.c-y.c)===1;
}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!))}
function info(hex:string){return state.mapHexes?.[hex] ?? {}}
async function persist(){await saveState(state)}
function ensureMap(){state.mapHexes ??= {}; state.mapHexes["G-10"] ??= {explored:true,visits:1}}

function symbol(name:string, cls="map-symbol"){
  const wrap=(body:string)=>`<svg class="${cls}" viewBox="-16 -16 32 32" aria-hidden="true">${body}</svg>`;
  switch(name){
    case "Forest": return wrap(`<path d="M-10 10L-4-2L2 10M-2 10L5-6L12 10"/><path d="M-4 10V14M5 10V14"/>`);
    case "Mountain": return wrap(`<path d="M-14 11L-5-5L1 5L6-3L14 11"/><path d="M-8 1L-5-5L-1 2M3 2L6-3L9 2"/>`);
    case "Grassland": return wrap(`<path d="M-12 12Q-10 3-7-2M-5 12Q-4 1 0-6M2 12Q4 4 8-1M8 12Q10 6 13 4"/>`);
    case "Desert": return wrap(`<circle cx="8" cy="-7" r="3"/><path d="M-14 8Q-7 2 0 8T14 8M-12 13Q-5 8 2 13T14 13"/>`);
    case "Swamp": return wrap(`<path d="M-14 3Q-10-1-6 3T2 3T10 3T18 3M-14 9Q-10 5-6 9T2 9T10 9T18 9"/><path d="M-7 1V-8M7 1V-6M-10-5L-7-8L-4-5M4-3L7-6L10-3"/>`);
    case "Village": return wrap(`<path d="M-13 12V1L-7-5L-1 1V12M1 12V-2L7-8L13-2V12M-10 12V6H-5V12M5 12V5H10V12"/>`);
    case "Quest": return wrap(`<path d="M-9 12V-10M-9-9H8L3-3L8 3H-9"/><circle cx="-9" cy="12" r="1.5"/>`);
    case "Treasure": return wrap(`<path d="M-11-7L11 9M11-7L-11 9"/><circle cx="0" cy="1" r="12"/>`);
    case "Enemy": return wrap(`<path d="M-10 7V-1Q-10-11 0-11Q10-11 10-1V7L5 12L0 8L-5 12Z"/><circle cx="-4" cy="-2" r="2"/><circle cx="4" cy="-2" r="2"/><path d="M-4 5H4"/>`);
    case "Radio Tower": return wrap(`<path d="M0-12L-7 13M0-12L7 13M-5 7H5M-3 1H3"/><path d="M-7-9Q-13-4-7 1M7-9Q13-4 7 1"/>`);
    case "Power Supply": return wrap(`<rect x="-11" y="-10" width="22" height="20" rx="2"/><path d="M2-8L-5 2H0L-3 9L7-3H2Z"/>`);
    case "Camp": return wrap(`<path d="M-13 11L0-10L13 11ZM0-10V11M-5 11L0 2L5 11"/>`);
    default: return "";
  }
}

function terrainButtons(value:string|undefined){
  return TERRAIN.map(t=>`<button class="choice terrain-choice ${value===t?"active":""}" data-terrain-choice="${t}">${t!=="Unknown"?symbol(t,"choice-symbol"):""}<span>${t}</span></button>`).join("");
}
function iconButtons(value:string|undefined){
  return ICONS.map(t=>`<button class="choice icon-choice ${value===t?"active":""}" data-icon-choice="${t}">${t!=="None"?symbol(t,"choice-symbol"):""}<span>${t}</span></button>`).join("");
}

function hexCenter(col:number,rowIndex:number){
  return {
    x: ODD_ROW_FIRST_CENTER_X + (col-1)*COLUMN_PITCH,
    y: FIRST_ROW_CENTER_Y + rowIndex*ROW_PITCH
  };
}

function render(){
  const previousBoard = app.querySelector<HTMLElement>(".map-board");
  const previousScrollLeft = previousBoard?.scrollLeft ?? 0;
  const previousScrollTop = previousBoard?.scrollTop ?? 0;

  ensureMap();
  const hexes:string[]=[]; ROWS.forEach((r,ri)=>validCols(ri).forEach(c=>hexes.push(id(r,c))));
  const selectedInfo=info(selected); const canMove=selected!==state.currentHex && adjacent(state.currentHex,selected);
  const cells=hexes.map(h=>{
    const p=parse(h)!; const hi=info(h); const current=h===state.currentHex; const sel=h===selected; const visited=(hi.visits??0)>0 || hi.explored;
    const {x,y}=hexCenter(p.c,p.r);
    const terrain=(hi.terrain && hi.terrain!=="Unknown")?hi.terrain:""; const icon=hi.icon&&hi.icon!=="None"?hi.icon:"";
    const hw=HEX_HALF_WIDTH.toFixed(3), q=(HEX_RADIUS/2).toFixed(3), r=HEX_RADIUS.toFixed(3);
    const pts=`0,-${r} ${hw},-${q} ${hw},${q} 0,${r} -${hw},${q} -${hw},-${q}`;
    return `<g class="map-hex ${visited?"visited":""} ${hi.explored?"explored":""} ${current?"current":""} ${sel?"selected":""}" data-hex="${h}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)})" aria-label="${h}">
      <polygon points="${pts}"></polygon>
      ${terrain?`<g class="terrain-glyph" transform="translate(0 3) scale(.82)">${symbol(terrain,"cell-symbol")}</g>`:""}
      ${icon?`<g class="icon-glyph" transform="translate(0 -13) scale(.58)">${symbol(icon,"cell-symbol")}</g>`:""}
      ${visited?`<circle class="visit-mark" cx="0" cy="-${HEX_RADIUS-9}" r="2.5"></circle>`:""}
    </g>`;
  }).join("");

  const columnAxis=Array.from({length:17},(_,i)=>i+1).map(c=>{
    const x=hexCenter(c,0).x;
    const y=c%2===0?45:64;
    return `<text class="axis axis-col ${c%2===0?"even":"odd"}" x="${x.toFixed(3)}" y="${y}">${String(c).padStart(2,"0")}</text>`;
  }).join("");
  const rowAxis=ROWS.map((r,i)=>`<text class="axis axis-row" x="45" y="${(FIRST_ROW_CENTER_Y+i*ROW_PITCH+5).toFixed(3)}">${r}</text>`).join("");

  app.innerHTML=`<div class="map-shell">
  <header><div><div class="eyebrow">MIRU // INTERACTIVE MAP</div><h1>EXPLORE</h1></div><div class="position">CURRENT <b>${state.currentHex}</b></div><button id="close-map">Close map</button></header>
  <main>
    <section class="map-board"><svg viewBox="0 0 ${SHEET_W} ${SHEET_H}" role="img" aria-label="Interactive MIRU hex map modeled on the supplied character map sheet">
      <g class="map-axis">${columnAxis}${rowAxis}</g>
      <g class="hex-grid">${cells}</g>
      <g class="north-mark" transform="translate(716 466)">
        <path class="north-arrow" d="M0-28L11-5L0 3L-11-5Z"/>
        <path class="north-wing" d="M-14 6L-4 1L0 6L-4 12Z"/>
        <path class="north-wing" d="M14 6L4 1L0 6L4 12Z"/>
        <path class="north-tail" d="M0 11L8 18L0 32L-8 18Z"/>
        <text x="0" y="-8">N</text>
      </g>
    </svg></section>
    <aside>
      <div class="hex-title"><span>SELECTED HEX</span><b>${selected}</b></div>
      <div class="state-strip">
        <button id="mark-unseen" class="state-button ${!selectedInfo.explored?"active":""}">UNSEEN</button>
        <button id="mark-explored" class="state-button ${selectedInfo.explored?"active":""}">EXPLORED</button>
        ${selected===state.currentHex?`<span class="current-badge">CURRENT</span>`:""}
      </div>
      <div class="control-block"><div class="control-label">TERRAIN</div><div class="choice-grid terrain-grid">${terrainButtons(selectedInfo.terrain)}</div></div>
      <div class="control-block"><div class="control-label">MAP ICON</div><div class="choice-grid icon-grid">${iconButtons(selectedInfo.icon)}</div></div>
      <div class="control-block"><div class="control-label">FIELD NOTE</div><textarea id="hex-note" rows="4" placeholder="Enemy left behind, quest clue, landmark…">${esc(selectedInfo.note??"")}</textarea></div>
      <button id="move" class="move" ${canMove?"":"disabled"}>${canMove?`MOVE TO ${selected}`:selected===state.currentHex?"YOU ARE HERE":"SELECT AN ADJACENT HEX"}</button>
      <p class="hint">Visited hexes remain visibly marked. Movement is limited to adjacent spaces and saves with the Owlbear scene.</p>
    </aside>
  </main></div>`;

  const nextBoard = app.querySelector<HTMLElement>(".map-board");
  if(nextBoard){
    nextBoard.scrollLeft = previousScrollLeft;
    nextBoard.scrollTop = previousScrollTop;
    requestAnimationFrame(()=>{
      nextBoard.scrollLeft = previousScrollLeft;
      nextBoard.scrollTop = previousScrollTop;
    });
  }
  wire();
}

function wire(){
  document.querySelectorAll<SVGGElement>("[data-hex]").forEach(el=>el.addEventListener("click",()=>{selected=el.dataset.hex!;render()}));
  document.querySelector("#close-map")?.addEventListener("click",()=>void OBR.modal.close("com.esortland.miru-companion/map"));

  document.querySelector("#mark-explored")?.addEventListener("click",()=>void (async()=>{ensureMap(); state.mapHexes![selected]={...info(selected),explored:true}; await persist(); render()})());
  document.querySelector("#mark-unseen")?.addEventListener("click",()=>void (async()=>{ensureMap(); state.mapHexes![selected]={...info(selected),explored:false}; await persist(); render()})());
  document.querySelectorAll<HTMLButtonElement>("[data-terrain-choice]").forEach(button=>button.addEventListener("click",()=>void (async()=>{ensureMap(); state.mapHexes![selected]={...info(selected),terrain:button.dataset.terrainChoice}; await persist(); render()})()));
  document.querySelectorAll<HTMLButtonElement>("[data-icon-choice]").forEach(button=>button.addEventListener("click",()=>void (async()=>{ensureMap(); state.mapHexes![selected]={...info(selected),icon:button.dataset.iconChoice}; await persist(); render()})()));
  document.querySelector("#hex-note")?.addEventListener("change",event=>void (async()=>{ensureMap(); state.mapHexes![selected]={...info(selected),note:(event.target as HTMLTextAreaElement).value}; await persist()})());
  document.querySelector("#move")?.addEventListener("click",()=>void (async()=>{
    if(!adjacent(state.currentHex,selected))return;
    ensureMap();
    const prior=state.currentHex;
    state.mapHexes![prior]={...info(prior),explored:true,visits:Math.max(1,info(prior).visits??1)};
    state.currentHex=selected;
    state.mapHexes![selected]={...info(selected),explored:true,visits:(info(selected).visits??0)+1};
    await persist(); render();
  })());
}

OBR.onReady(async()=>{
  state=await loadState() as MapState; ensureMap(); selected=state.currentHex; render();
  OBR.scene.onMetadataChange(async()=>{const fresh=await loadState() as MapState; state=fresh; ensureMap(); render()});
});
