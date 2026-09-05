import OBR from "@owlbear-rodeo/sdk";
import "./map.css";
import { loadState, saveState, MiruState } from "./state";

const ROWS=["A","B","C","D","E","F","G"] as const;
const TERRAIN=["Forest","Mountain","Grassland","Desert","Swamp"] as const;
const ICONS=["None","Village","Quest","Treasure","Enemy","Radio Tower","Power Supply","Camp"] as const;
const SHEET_W=820,SHEET_H=576,HEX_RADIUS=40,HEX_HALF_WIDTH=Math.sqrt(3)*HEX_RADIUS/2,COLUMN_PITCH=HEX_HALF_WIDTH,ROW_PITCH=HEX_RADIUS*1.5,ODD_ROW_FIRST_CENTER_X=101,FIRST_ROW_CENTER_Y=105;
type HexInfo={explored?:boolean;terrain?:string;icon?:string;note?:string;visits?:number};
let state:MiruState;
let selected="G-10";
let previousScrollLeft=0,previousScrollTop=0;
const getApp=()=>document.querySelector<HTMLDivElement>("#map-app");
function validCols(rowIndex:number){const odd=rowIndex%2===1;return Array.from({length:odd?9:8},(_,i)=>odd?1+i*2:2+i*2)}
function id(row:string,col:number){return `${row}-${String(col).padStart(2,"0")}`}
function parse(hex:string){const m=/^([A-G])-(\d{2})$/.exec(hex);return m?{r:ROWS.indexOf(m[1] as typeof ROWS[number]),c:Number(m[2])}:null}
function adjacent(a:string,b:string){const x=parse(a),y=parse(b);if(!x||!y)return false;if(x.r===y.r)return Math.abs(x.c-y.c)===2;return Math.abs(x.r-y.r)===1&&Math.abs(x.c-y.c)===1}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!))}
function info(hex:string):HexInfo{return state.mapHexes?.[hex]??{}}
function ensureMap(){state.mapHexes??={};state.mapHexes["G-10"]??={explored:true,visits:1}}
async function persist(){await saveState(state)}
function symbol(name:string,cls="map-symbol"){
 const wrap=(body:string)=>`<svg class="${cls}" viewBox="-16 -16 32 32" aria-hidden="true">${body}</svg>`;
 switch(name){
  case"Forest":return wrap(`<path d="M-10 10L-4-2L2 10M-2 10L5-6L12 10M-4 10V14M5 10V14"/>`);
  case"Mountain":return wrap(`<path d="M-14 11L-5-5L1 5L6-3L14 11M-8 1L-5-5L-1 2M3 2L6-3L9 2"/>`);
  case"Grassland":return wrap(`<path d="M-12 12Q-10 3-7-2M-5 12Q-4 1 0-6M2 12Q4 4 8-1M8 12Q10 6 13 4"/>`);
  case"Desert":return wrap(`<circle cx="8" cy="-7" r="3"/><path d="M-14 8Q-7 2 0 8T14 8M-12 13Q-5 8 2 13T14 13"/>`);
  case"Swamp":return wrap(`<path d="M-14 3Q-10-1-6 3T2 3T10 3T18 3M-14 9Q-10 5-6 9T2 9T10 9T18 9M-7 1V-8M7 1V-6M-10-5L-7-8L-4-5M4-3L7-6L10-3"/>`);
  case"Village":return wrap(`<path d="M-13 12V1L-7-5L-1 1V12M1 12V-2L7-8L13-2V12M-10 12V6H-5V12M5 12V5H10V12"/>`);
  case"Quest":return wrap(`<path d="M-9 12V-10M-9-9H8L3-3L8 3H-9"/><circle cx="-9" cy="12" r="1.5"/>`);
  case"Treasure":return wrap(`<path d="M-11-7L11 9M11-7L-11 9"/><circle cx="0" cy="1" r="12"/>`);
  case"Enemy":return wrap(`<path d="M-10 7V-1Q-10-11 0-11Q10-11 10-1V7L5 12L0 8L-5 12Z"/><circle cx="-4" cy="-2" r="2"/><circle cx="4" cy="-2" r="2"/><path d="M-4 5H4"/>`);
  case"Radio Tower":return wrap(`<path d="M0-12L-7 13M0-12L7 13M-5 7H5M-3 1H3M-7-9Q-13-4-7 1M7-9Q13-4 7 1"/>`);
  case"Power Supply":return wrap(`<rect x="-11" y="-10" width="22" height="20" rx="2"/><path d="M2-8L-5 2H0L-3 9L7-3H2Z"/>`);
  case"Camp":return wrap(`<path d="M-13 11L0-10L13 11ZM0-10V11M-5 11L0 2L5 11"/>`);
  default:return"";
 }
}
function symbolBody(name:string){return symbol(name).replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"")}
function terrainButtons(value:string|undefined){return `<button class="choice terrain-choice ${!value||value==="Unknown"?"active":""}" data-clear-terrain="true"><span>Unrecorded</span></button>`+TERRAIN.map(t=>`<button class="choice terrain-choice ${value===t?"active":""}" data-terrain-choice="${t}">${symbol(t,"choice-symbol")}<span>${t}</span></button>`).join("")}
function iconButtons(value:string|undefined){return ICONS.map(t=>`<button class="choice icon-choice ${value===t?"active":""}" data-icon-choice="${t}">${t!=="None"?symbol(t,"choice-symbol"):""}<span>${t}</span></button>`).join("")}
function hexCenter(col:number,rowIndex:number){return{x:ODD_ROW_FIRST_CENTER_X+(col-1)*COLUMN_PITCH,y:FIRST_ROW_CENTER_Y+rowIndex*ROW_PITCH}}

function render(){
 const app=getApp();if(!app||!state)return;
 const old=app.querySelector<HTMLElement>(".map-board");if(old){previousScrollLeft=old.scrollLeft;previousScrollTop=old.scrollTop}
 ensureMap();
 const hexes:string[]=[];ROWS.forEach((r,ri)=>validCols(ri).forEach(c=>hexes.push(id(r,c))));
 const selectedInfo=info(selected),canMove=selected!==state.currentHex&&adjacent(state.currentHex,selected);
 const cells=hexes.map(h=>{const p=parse(h)!;const hi=info(h),current=h===state.currentHex,sel=h===selected,visited=(hi.visits??0)>0||hi.explored,{x,y}=hexCenter(p.c,p.r);const terrain=hi.terrain&&hi.terrain!=="Unknown"?hi.terrain:"",icon=hi.icon&&hi.icon!=="None"?hi.icon:"";const hw=HEX_HALF_WIDTH.toFixed(3),q=(HEX_RADIUS/2).toFixed(3),r=HEX_RADIUS.toFixed(3),pts=`0,-${r} ${hw},-${q} ${hw},${q} 0,${r} -${hw},${q} -${hw},-${q}`;return `<g class="map-hex ${visited?"visited":""} ${hi.explored?"explored":""} ${current?"current":""} ${sel?"selected":""}" data-hex="${h}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)})"><polygon points="${pts}"></polygon>${terrain?`<g class="terrain-glyph" transform="translate(0 3) scale(.82)">${symbolBody(terrain)}</g>`:""}${icon?`<g class="icon-glyph" transform="translate(0 -13) scale(.58)">${symbolBody(icon)}</g>`:""}${visited?`<circle class="visit-mark" cx="0" cy="-${HEX_RADIUS-9}" r="2.5"></circle>`:""}</g>`}).join("");
 const columnAxis=Array.from({length:17},(_,i)=>i+1).map(c=>`<text class="axis axis-col ${c%2===0?"even":"odd"}" x="${hexCenter(c,0).x.toFixed(3)}" y="${c%2===0?45:64}">${String(c).padStart(2,"0")}</text>`).join("");
 const rowAxis=ROWS.map((r,i)=>`<text class="axis axis-row" x="45" y="${(FIRST_ROW_CENTER_Y+i*ROW_PITCH+5).toFixed(3)}">${r}</text>`).join("");
 app.innerHTML=`<div class="map-shell playdesk-map"><div class="map-worktop"><div><span>MIRU // MAP SHEET</span><b>EXPLORE</b></div><div class="map-current">CURRENT <strong>${state.currentHex}</strong></div></div><main><section class="map-board"><svg viewBox="0 0 ${SHEET_W} ${SHEET_H}" role="img" aria-label="MIRU interactive hex map"><g class="map-axis">${columnAxis}${rowAxis}</g><g class="hex-grid">${cells}</g><g class="north-mark" transform="translate(716 466)"><path class="north-arrow" d="M0-28L11-5L0 3L-11-5Z"/><path class="north-wing" d="M-14 6L-4 1L0 6L-4 12ZM14 6L4 1L0 6L4 12Z"/><path class="north-tail" d="M0 11L8 18L0 32L-8 18Z"/><text x="0" y="-8">N</text></g></svg></section><aside><div class="hex-title"><span>SELECTED HEX</span><b>${selected}</b></div><div class="state-strip"><button id="mark-unseen" class="state-button ${!selectedInfo.explored?"active":""}">UNSEEN</button><button id="mark-explored" class="state-button ${selectedInfo.explored?"active":""}">EXPLORED</button>${selected===state.currentHex?`<span class="current-badge">CURRENT</span>`:""}</div><div class="control-block"><div class="control-label">TERRAIN</div><div class="choice-grid terrain-grid">${terrainButtons(selectedInfo.terrain)}</div></div><div class="control-block"><div class="control-label">MAP ICON</div><div class="choice-grid icon-grid">${iconButtons(selectedInfo.icon)}</div></div><div class="control-block"><div class="control-label">FIELD NOTE</div><textarea id="hex-note" rows="4" placeholder="Enemy left behind, quest clue, landmark…">${esc(selectedInfo.note??"")}</textarea></div><button id="move" class="move" ${canMove?"":"disabled"}>${canMove?`MOVE TO ${selected}`:selected===state.currentHex?"YOU ARE HERE":"SELECT AN ADJACENT HEX"}</button><p class="hint">Movement is limited to adjacent spaces. Campaign state saves with this Owlbear room.</p></aside></main></div>`;
 const next=app.querySelector<HTMLElement>(".map-board");if(next){next.scrollLeft=previousScrollLeft;next.scrollTop=previousScrollTop;requestAnimationFrame(()=>{next.scrollLeft=previousScrollLeft;next.scrollTop=previousScrollTop})}
 wire(app);
}
function wire(app:HTMLElement){
 app.querySelectorAll<SVGGElement>("[data-hex]").forEach(el=>el.onclick=()=>{selected=el.dataset.hex!;render()});
 app.querySelector("#mark-explored")?.addEventListener("click",()=>void(async()=>{ensureMap();state.mapHexes[selected]={...info(selected),explored:true};await persist();render()})());
 app.querySelector("#mark-unseen")?.addEventListener("click",()=>void(async()=>{ensureMap();state.mapHexes[selected]={...info(selected),explored:false};await persist();render()})());
 app.querySelectorAll<HTMLButtonElement>("[data-terrain-choice]").forEach(b=>b.onclick=()=>void(async()=>{ensureMap();state.mapHexes[selected]={...info(selected),terrain:b.dataset.terrainChoice};await persist();render()})());
 app.querySelector<HTMLButtonElement>("[data-clear-terrain]")?.addEventListener("click",()=>void(async()=>{ensureMap();const next={...info(selected)};delete next.terrain;state.mapHexes[selected]=next;await persist();render()})());
 app.querySelectorAll<HTMLButtonElement>("[data-icon-choice]").forEach(b=>b.onclick=()=>void(async()=>{ensureMap();state.mapHexes[selected]={...info(selected),icon:b.dataset.iconChoice};await persist();render()})());
 app.querySelector<HTMLTextAreaElement>("#hex-note")?.addEventListener("change",e=>void(async()=>{ensureMap();state.mapHexes[selected]={...info(selected),note:(e.target as HTMLTextAreaElement).value};await persist()})());
 app.querySelector("#move")?.addEventListener("click",()=>void(async()=>{if(!adjacent(state.currentHex,selected))return;ensureMap();const prior=state.currentHex,destinationBefore={...info(selected)},hasIcon=Boolean(destinationBefore.icon&&destinationBefore.icon!=="None"),wasKnown=Boolean(destinationBefore.explored)||(destinationBefore.visits??0)>0||hasIcon,kind:"new"|"old"=wasKnown?"old":"new",nextStep=kind==="new"?"G":hasIcon?"J":"K",mapHexes={...state.mapHexes};mapHexes[prior]={...info(prior),explored:true,visits:Math.max(1,info(prior).visits??1)};mapHexes[selected]={...destinationBefore,explored:true,visits:(destinationBefore.visits??0)+1};state={...state,currentHex:selected,mapHexes,terrainRoll:null,arrival:{day:state.day,from:prior,hex:selected,kind},step:nextStep};await persist();render()})());
}

window.addEventListener("miru:playdesk-render",()=>{if(state)render()});
OBR.onReady(async()=>{state=await loadState();selected=state.currentHex;render();OBR.room.onMetadataChange(meta=>{if(meta["com.esortland.miru-companion/state"]){void loadState().then(fresh=>{state=fresh;if(!selected)selected=state.currentHex;render()})}})});
