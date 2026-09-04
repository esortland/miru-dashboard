import OBR from "@owlbear-rodeo/sdk";
import "./map.css";
import { loadState, saveState, MiruState } from "./state";

const app = document.querySelector<HTMLDivElement>("#map-app")!;
const ROWS = ["A","B","C","D","E","F","G"] as const;
const TERRAIN = ["Unknown","Forest","Mountain","Grassland","Desert","Swamp"] as const;
const ICONS = ["None","Village","Quest","Treasure","Enemy","Radio Tower","Power Supply","Camp"] as const;

type HexInfo = { explored?: boolean; terrain?: string; icon?: string; note?: string };
type MapState = MiruState & { mapHexes?: Record<string, HexInfo> };
let state: MapState;
let selected = "G-10";

function validCols(rowIndex:number){
  const oddRow = rowIndex % 2 === 1;
  return Array.from({length: oddRow ? 9 : 8}, (_,i)=> oddRow ? 1+i*2 : 2+i*2);
}
function id(row:string,col:number){return `${row}-${String(col).padStart(2,"0")}`}
function parse(hex:string){const m=/^([A-G])-(\d{2})$/.exec(hex); return m?{r:ROWS.indexOf(m[1] as any),c:Number(m[2])}:null}
function adjacent(a:string,b:string){
  const x=parse(a), y=parse(b); if(!x||!y) return false;
  if(x.r===y.r) return Math.abs(x.c-y.c)===2;
  return Math.abs(x.r-y.r)===1 && Math.abs(x.c-y.c)===1;
}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!))}
function info(hex:string){return state.mapHexes?.[hex] ?? {}}
async function persist(){await saveState(state)}

function render(){
  const hexes:string[]=[]; ROWS.forEach((r,ri)=>validCols(ri).forEach(c=>hexes.push(id(r,c))));
  const selectedInfo=info(selected); const canMove=selected!==state.currentHex && adjacent(state.currentHex,selected);
  const cells=hexes.map(h=>{
    const p=parse(h)!; const hi=info(h); const current=h===state.currentHex; const sel=h===selected;
    const x=78 + ((p.c-1)/2)*118 + (p.r%2===0?59:0); const y=76+p.r*102;
    const terrain=(hi.terrain && hi.terrain!=="Unknown")?hi.terrain:""; const icon=hi.icon&&hi.icon!=="None"?hi.icon:"";
    const pts="0,-56 49,-28 49,28 0,56 -49,28 -49,-28";
    return `<g class="hex ${hi.explored?"explored":""} ${current?"current":""} ${sel?"selected":""}" data-hex="${h}" transform="translate(${x} ${y})">
      <polygon points="${pts}"></polygon><text class="hex-id" y="5">${h}</text>${terrain?`<text class="terrain" y="26">${esc(terrain)}</text>`:""}${icon?`<text class="icon" y="-25">${esc(icon)}</text>`:""}
    </g>`;
  }).join("");
  app.innerHTML=`<div class="map-shell"><header><div><div class="eyebrow">MIRU // INTERACTIVE MAP</div><h1>EXPLORE</h1></div><div class="position">CURRENT <b>${state.currentHex}</b></div><button id="close-map">Close map</button></header>
  <main><section class="map-board"><svg viewBox="0 0 1150 790" role="img" aria-label="Interactive MIRU hex map"><text class="north" x="1090" y="735">N ↑</text>${cells}</svg></section>
  <aside><div class="hex-title"><span>SELECTED HEX</span><b>${selected}</b></div>
    <label class="toggle"><input id="explored" type="checkbox" ${selectedInfo.explored?"checked":""}> Explored</label>
    <label>Terrain<select id="terrain">${TERRAIN.map(t=>`<option ${selectedInfo.terrain===t?"selected":""}>${t}</option>`).join("")}</select></label>
    <label>Map icon<select id="icon">${ICONS.map(t=>`<option ${selectedInfo.icon===t?"selected":""}>${t}</option>`).join("")}</select></label>
    <label>Hex note<textarea id="hex-note" rows="5" placeholder="Enemy left behind, quest clue, landmark…">${esc(selectedInfo.note??"")}</textarea></label>
    <button id="move" class="move" ${canMove?"":"disabled"}>Move here</button>
    <p class="hint">Movement is limited to adjacent hexes. MIRU begins at G-10; explored terrain and notes persist with the Owlbear scene.</p>
  </aside></main></div>`;
  wire();
}

function wire(){
  document.querySelectorAll<SVGGElement>("[data-hex]").forEach(el=>el.addEventListener("click",()=>{selected=el.dataset.hex!;render()}));
  document.querySelector("#close-map")?.addEventListener("click",()=>void OBR.modal.close("com.esortland.miru-companion/map"));
  const update=async()=>{state.mapHexes??={}; state.mapHexes[selected]={...info(selected),explored:(document.querySelector<HTMLInputElement>("#explored")!).checked,terrain:(document.querySelector<HTMLSelectElement>("#terrain")!).value,icon:(document.querySelector<HTMLSelectElement>("#icon")!).value,note:(document.querySelector<HTMLTextAreaElement>("#hex-note")!).value}; await persist(); render()};
  document.querySelector("#explored")?.addEventListener("change",()=>void update());
  document.querySelector("#terrain")?.addEventListener("change",()=>void update());
  document.querySelector("#icon")?.addEventListener("change",()=>void update());
  document.querySelector("#hex-note")?.addEventListener("change",()=>void update());
  document.querySelector("#move")?.addEventListener("click",()=>void (async()=>{if(!adjacent(state.currentHex,selected))return; state.currentHex=selected; state.mapHexes??={}; state.mapHexes[selected]={...info(selected),explored:true}; await persist(); render()})());
}

OBR.onReady(async()=>{state=await loadState() as MapState; state.mapHexes??={"G-10":{explored:true}}; selected=state.currentHex; render(); OBR.scene.onMetadataChange(async()=>{const fresh=await loadState() as MapState; state=fresh; state.mapHexes??={}; render()})});
