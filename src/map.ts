import OBR from "@owlbear-rodeo/sdk";
import "./map.css";
import { loadState, saveState, MiruState } from "./state";

const app = document.querySelector<HTMLDivElement>("#map-app")!;
const ROWS = ["A","B","C","D","E","F","G"] as const;
const TERRAIN = ["Unknown","Forest","Mountain","Grassland","Desert","Swamp"] as const;
const ICONS = ["None","Village","Quest","Treasure","Enemy","Radio Tower","Power Supply","Camp"] as const;

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

function terrainButtons(value:string|undefined){
  return TERRAIN.map(t=>`<button class="choice terrain-choice ${value===t?"active":""}" data-terrain-choice="${t}">${t}</button>`).join("");
}
function iconButtons(value:string|undefined){
  return ICONS.map(t=>`<button class="choice icon-choice ${value===t?"active":""}" data-icon-choice="${t}">${t}</button>`).join("");
}

function render(){
  // The map UI is rebuilt on selection/state changes. Preserve the scroll viewport
  // so tapping a hex on a horizontally scrolled iPad map doesn't jump back left.
  const previousBoard = app.querySelector<HTMLElement>(".map-board");
  const previousScrollLeft = previousBoard?.scrollLeft ?? 0;
  const previousScrollTop = previousBoard?.scrollTop ?? 0;

  ensureMap();
  const hexes:string[]=[]; ROWS.forEach((r,ri)=>validCols(ri).forEach(c=>hexes.push(id(r,c))));
  const selectedInfo=info(selected); const canMove=selected!==state.currentHex && adjacent(state.currentHex,selected);
  const cells=hexes.map(h=>{
    const p=parse(h)!; const hi=info(h); const current=h===state.currentHex; const sel=h===selected; const visited=(hi.visits??0)>0 || hi.explored;
    const x=68 + ((p.c-1)/2)*108 + (p.r%2===0?54:0); const y=62+p.r*94;
    const terrain=(hi.terrain && hi.terrain!=="Unknown")?hi.terrain:""; const icon=hi.icon&&hi.icon!=="None"?hi.icon:"";
    const pts="0,-43 38,-21.5 38,21.5 0,43 -38,21.5 -38,-21.5";
    return `<g class="map-hex ${visited?"visited":""} ${hi.explored?"explored":""} ${current?"current":""} ${sel?"selected":""}" data-hex="${h}" transform="translate(${x} ${y})">
      <polygon points="${pts}"></polygon>
      ${visited?`<circle class="visit-mark" cx="0" cy="-30" r="3"></circle>`:""}
      <text class="hex-id" y="4">${h}</text>
      ${terrain?`<text class="terrain" y="20">${esc(terrain)}</text>`:""}
      ${icon?`<text class="icon" y="-18">${esc(icon)}</text>`:""}
    </g>`;
  }).join("");

  app.innerHTML=`<div class="map-shell">
  <header><div><div class="eyebrow">MIRU // INTERACTIVE MAP</div><h1>EXPLORE</h1></div><div class="position">CURRENT <b>${state.currentHex}</b></div><button id="close-map">Close map</button></header>
  <main>
    <section class="map-board"><svg viewBox="0 0 1030 690" role="img" aria-label="Interactive MIRU hex map"><text class="north" x="955" y="650">N ↑</text>${cells}</svg></section>
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
