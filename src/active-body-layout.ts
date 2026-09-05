import OBR from "@owlbear-rodeo/sdk";
import { loadState, MiruState } from "./state";
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

const specialSlot: Partial<Record<ItemShape,number>> = {
  pentagon: 2,
  chevron: 3,
  bowtie: 4
};

function shapeGlyph(shape:ItemShape){
  return `<span class="body-shape-glyph body-shape-${shape}" aria-hidden="true"></span>`;
}

function activeSlots(){
  if(!state)return [] as Array<string|null>;
  const slots:Array<string|null>=[null,null,null,null,null];
  const rectangles:string[]=[];

  for(const name of state.activeBody){
    const shape=itemDefinition(name).shape;
    const fixed=specialSlot[shape];
    if(fixed!==undefined && slots[fixed]===null) slots[fixed]=name;
    else rectangles.push(name);
  }

  for(const name of rectangles){
    const open=slots.findIndex(x=>x===null);
    if(open>=0) slots[open]=name;
  }
  return slots;
}

function allowedFor(index:number){
  if(index===2)return ["rectangle","pentagon"] as ItemShape[];
  if(index===3)return ["rectangle","chevron"] as ItemShape[];
  if(index===4)return ["rectangle","bowtie"] as ItemShape[];
  return ["rectangle"] as ItemShape[];
}

function slotHtml(index:number,name:string|null){
  const allowed=allowedFor(index);
  if(name){
    const def=itemDefinition(name);
    return `<div class="body-slot occupied" data-slot="${index+1}" data-shape="${def.shape}">
      <div class="slot-rail"><span>${String(index+1).padStart(2,"0")}</span><div class="allowed-shapes">${allowed.map(shapeGlyph).join("")}</div></div>
      <div class="slot-item-shape">${shapeGlyph(def.shape)}</div>
      <div class="slot-item-copy"><b>${esc(name)}</b>${def.effect?`<span>${esc(def.effect)}</span>`:""}<small>${shapeLabel[def.shape]}</small></div>
      <button data-body-remove="${esc(name)}">TO BAG</button>
    </div>`;
  }
  return `<div class="body-slot empty" data-slot="${index+1}">
    <div class="slot-rail"><span>${String(index+1).padStart(2,"0")}</span><div class="allowed-shapes">${allowed.map(shapeGlyph).join("")}</div></div>
    <div class="empty-slot-copy"><b>${allowed.map(s=>shapeLabel[s]).join(" / ")}</b><span>OPEN ACTIVE BODY SLOT</span></div>
  </div>`;
}

function patchActiveBody(){
  if(!state)return;
  const panel=document.querySelector<HTMLElement>(".body-paper");
  if(!panel)return;
  const slots=activeSlots();
  panel.innerHTML=`<header><b>ACTIVE BODY</b><span>MAX 5 ITEMS · ${state.activeBody.length}/5</span></header>
    <div class="body-shape-rule"><b>FIT THE SHAPES</b><span>Rectangles can use any open slot. Pentagon, Chevron, and Bowtie items each have one matching slot.</span></div>
    <div class="body-slot-board">${slots.map((name,i)=>slotHtml(i,name)).join("")}</div>`;

  panel.querySelectorAll<HTMLButtonElement>("[data-body-remove]").forEach(button=>{
    button.onclick=()=>{
      const name=button.dataset.bodyRemove!;
      document.querySelector<HTMLButtonElement>(`[data-unequip="${CSS.escape(name)}"]`)?.click();
    };
  });
}

function patchInventory(){
  const panel=document.querySelector<HTMLElement>(".inventory-paper");
  if(!panel)return;

  let legend=panel.querySelector<HTMLElement>(".inventory-shape-legend");
  if(!legend){
    legend=document.createElement("div");
    legend.className="inventory-shape-legend";
    legend.innerHTML=`<b>ITEM SHAPES</b><span>${shapeGlyph("rectangle")} Rectangle</span><span>${shapeGlyph("pentagon")} Pentagon</span><span>${shapeGlyph("chevron")} Chevron</span><span>${shapeGlyph("bowtie")} Bowtie</span>`;
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
