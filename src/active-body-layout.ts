import OBR from "@owlbear-rodeo/sdk";
import { loadState, MiruState, saveState } from "./state";
import { itemDefinition, ItemShape } from "./item-catalog";
import "./active-body-layout.css";

let state: MiruState | null = null;
let patchQueued = false;

const esc = (s:string) => s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const shapeLabel: Record<ItemShape,string> = {
  circle: "CIRCLE",
  rectangle: "RECTANGLE",
  pentagon: "PENTAGON",
  chevron: "CHEVRON",
  bowtie: "BOWTIE"
};

function shapeGlyph(shape:ItemShape){
  return `<span class="body-shape-glyph body-shape-${shape}" aria-hidden="true"></span>`;
}

function activeSlots(){
  if(!state)return [] as Array<string|null>;
  const slots:Array<string|null>=[null,null,null,null,null];
  state.activeBody.slice(0,5).forEach((name,index)=>{slots[index]=name;});
  return slots;
}

function shapeCounts(){
  const counts:Record<"pentagon"|"chevron"|"bowtie",number>={pentagon:0,chevron:0,bowtie:0};
  if(!state)return counts;
  for(const name of state.activeBody){
    const shape=itemDefinition(name).shape;
    if(shape==="pentagon"||shape==="chevron"||shape==="bowtie")counts[shape]++;
  }
  return counts;
}

function slotHtml(index:number,name:string|null){
  if(name){
    const def=itemDefinition(name);
    return `<div class="body-slot occupied" data-slot="${index+1}" data-shape="${def.shape}">
      <div class="slot-rail"><span>${String(index+1).padStart(2,"0")}</span><div class="allowed-shapes">${shapeGlyph(def.shape)}</div></div>
      <div class="slot-item-shape">${shapeGlyph(def.shape)}</div>
      <div class="slot-item-copy"><b>${esc(name)}</b>${def.effect?`<span>${esc(def.effect)}</span>`:""}<small>${shapeLabel[def.shape]}</small></div>
      <button data-body-remove="${esc(name)}">TO BAG</button>
    </div>`;
  }
  return `<div class="body-slot empty" data-slot="${index+1}">
    <div class="slot-rail"><span>${String(index+1).padStart(2,"0")}</span><div class="allowed-shapes">${shapeGlyph("rectangle")}${shapeGlyph("pentagon")}${shapeGlyph("chevron")}${shapeGlyph("bowtie")}</div></div>
    <div class="empty-slot-copy"><b>OPEN ACTIVE BODY SPACE</b><span>Any non-circle item may use this space if its shape limit allows.</span></div>
  </div>`;
}

async function removeFromBody(name:string){
  if(!state)return;
  state={...state,activeBody:state.activeBody.filter(x=>x!==name)};
  patch();
  await saveState(state);
}

function patchActiveBody(){
  if(!state)return;
  const panel=document.querySelector<HTMLElement>(".body-paper");
  if(!panel)return;
  const slots=activeSlots();
  const counts=shapeCounts();
  panel.innerHTML=`<header><b>ACTIVE BODY</b><span>MAX 5 ITEMS · ${state.activeBody.length}/5</span></header>
    <div class="body-shape-rule"><b>ACTIVE BODY SHAPE LIMITS</b><span>Five total items. Rectangles may fill all five spaces. Pentagon, Chevron, and Bowtie are limited to one of each shape.</span></div>
    <div class="body-shape-totals">
      <span>${shapeGlyph("rectangle")} RECTANGLES ${state.activeBody.filter(n=>itemDefinition(n).shape==="rectangle").length}/5</span>
      <span class="${counts.pentagon?"used":""}">${shapeGlyph("pentagon")} PENTAGON ${counts.pentagon}/1</span>
      <span class="${counts.chevron?"used":""}">${shapeGlyph("chevron")} CHEVRON ${counts.chevron}/1</span>
      <span class="${counts.bowtie?"used":""}">${shapeGlyph("bowtie")} BOWTIE ${counts.bowtie}/1</span>
    </div>
    <div class="body-slot-board">${slots.map((name,i)=>slotHtml(i,name)).join("")}</div>`;

  panel.querySelectorAll<HTMLButtonElement>("[data-body-remove]").forEach(button=>{
    button.onclick=()=>void removeFromBody(button.dataset.bodyRemove!);
  });
}

function patchInventory(){
  const panel=document.querySelector<HTMLElement>(".inventory-paper");
  if(!panel)return;

  let legend=panel.querySelector<HTMLElement>(".inventory-shape-legend");
  if(!legend){
    legend=document.createElement("div");
    legend.className="inventory-shape-legend";
    legend.innerHTML=`<b>ITEM SHAPES</b><span>${shapeGlyph("rectangle")} Rectangle: up to 5</span><span>${shapeGlyph("pentagon")} Pentagon: max 1</span><span>${shapeGlyph("chevron")} Chevron: max 1</span><span>${shapeGlyph("bowtie")} Bowtie: max 1</span>`;
    panel.querySelector("header")?.insertAdjacentElement("afterend",legend);
  }

  panel.querySelectorAll<HTMLElement>(".sheet-item[data-shape]").forEach(item=>{
    const shape=(item.dataset.shape??"rectangle") as ItemShape;
    item.classList.add("shape-aware-item");
    const copy=item.querySelector<HTMLElement>(".sheet-item-copy");
    if(copy && !copy.querySelector(".inventory-shape-name")){
      const tag=document.createElement("small");
      tag.className="inventory-shape-name";
      tag.textContent=shapeLabel[shape];
      copy.appendChild(tag);
    }
    const ready=item.querySelector<HTMLButtonElement>("[data-equip]");
    if(ready)ready.textContent=`READY · ${shapeLabel[shape]}`;
  });
}

function patch(){
  patchActiveBody();
  patchInventory();
}

async function refresh(){
  if(patchQueued)return;
  patchQueued=true;
  requestAnimationFrame(async()=>{
    patchQueued=false;
    state=await loadState();
    patch();
  });
}

window.addEventListener("miru:playdesk-render",()=>void refresh());
OBR.onReady(async()=>{
  state=await loadState();
  requestAnimationFrame(patch);
  OBR.room.onMetadataChange(meta=>{
    if(meta["com.esortland.miru-companion/state"])void refresh();
  });
});
