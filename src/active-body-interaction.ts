import OBR from "@owlbear-rodeo/sdk";
import { loadState, MiruState, saveState } from "./state";
import { itemDefinition, ItemShape } from "./item-catalog";
import "./active-body-interaction.css";

let state: MiruState | null = null;
let selectedItem: string | null = null;
let patchQueued = false;

const shapeLabel: Record<ItemShape,string> = {
  circle: "CIRCLE",
  rectangle: "RECTANGLE",
  pentagon: "PENTAGON",
  chevron: "CHEVRON",
  bowtie: "BOWTIE"
};

function slots(){
  if(!state)return [] as Array<string|null>;
  const out:Array<string|null>=[null,null,null,null,null];
  state.activeBody.slice(0,5).forEach((name,index)=>{out[index]=name;});
  return out;
}

function specialShapeAlreadyUsed(shape:ItemShape){
  if(!state||shape==="rectangle"||shape==="circle")return false;
  return state.activeBody.some(name=>itemDefinition(name).shape===shape);
}

function itemCanBeReadied(name:string){
  if(!state)return false;
  if(state.activeBody.includes(name))return false;
  const shape=itemDefinition(name).shape;
  if(shape==="circle")return false;
  if(state.activeBody.length>=5)return false;
  if(specialShapeAlreadyUsed(shape))return false;
  return true;
}

async function placeSelected(index:number){
  if(!state||!selectedItem)return;
  const current=slots();
  if(current[index] || !itemCanBeReadied(selectedItem))return;
  const next=[...state.activeBody];
  next.splice(Math.min(index,next.length),0,selectedItem);
  state={...state,activeBody:next.slice(0,5)};
  selectedItem=null;
  await saveState(state);
  patch();
}

async function removeActive(name:string){
  if(!state)return;
  state={...state,activeBody:state.activeBody.filter(x=>x!==name)};
  await saveState(state);
  patch();
}

function patchInventory(){
  const panel=document.querySelector<HTMLElement>(".inventory-paper");
  if(!panel||!state)return;
  panel.querySelectorAll<HTMLElement>(".sheet-item[data-shape]").forEach(item=>{
    const name=item.querySelector<HTMLElement>(".sheet-item-copy b")?.textContent?.trim();
    if(!name)return;
    const def=itemDefinition(name);
    const button=item.querySelector<HTMLButtonElement>("[data-equip]");
    if(!button)return;
    button.onclick=e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      selectedItem = selectedItem===name ? null : name;
      patch();
    };
    const blockedByShape=specialShapeAlreadyUsed(def.shape);
    button.textContent=selectedItem===name
      ? "CANCEL PLACEMENT"
      : blockedByShape
        ? `${shapeLabel[def.shape]} LIMIT REACHED`
        : `PLACE · ${shapeLabel[def.shape]}`;
    button.disabled=!itemCanBeReadied(name) && selectedItem!==name;
    item.classList.toggle("placement-selected",selectedItem===name);
  });
}

function patchBody(){
  const panel=document.querySelector<HTMLElement>(".body-paper");
  if(!panel||!state)return;
  const current=slots();
  const selectedShape=selectedItem?itemDefinition(selectedItem).shape:null;
  const canPlace=Boolean(selectedItem&&itemCanBeReadied(selectedItem));
  panel.classList.toggle("placing-item",Boolean(selectedItem));
  panel.querySelectorAll<HTMLElement>(".body-slot").forEach((slot,index)=>{
    const occupied=current[index];
    const valid=Boolean(canPlace&&!occupied);
    slot.classList.toggle("placement-target",valid);
    slot.classList.toggle("placement-blocked",Boolean(selectedItem&&!valid));
    slot.onclick=null;
    slot.onkeydown=null;
    slot.removeAttribute("role");
    slot.removeAttribute("tabindex");
    if(valid){
      slot.setAttribute("role","button");
      slot.setAttribute("tabindex","0");
      slot.onclick=()=>void placeSelected(index);
      slot.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();void placeSelected(index);}};
      const copy=slot.querySelector<HTMLElement>(".empty-slot-copy");
      if(copy&&selectedItem)copy.innerHTML=`<b>PLACE ${selectedItem.toUpperCase()}</b><span>USES 1 OF 5 ACTIVE BODY SPACES</span>`;
    }
    const remove=slot.querySelector<HTMLButtonElement>("[data-body-remove]");
    if(remove&&occupied){
      remove.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();void removeActive(occupied);};
    }
  });

  let prompt=panel.querySelector<HTMLElement>(".body-placement-prompt");
  if(!prompt){
    prompt=document.createElement("div");
    prompt.className="body-placement-prompt";
    panel.querySelector("header")?.insertAdjacentElement("afterend",prompt);
  }
  const shapeRule=selectedShape==="rectangle"
    ? "Rectangles can fill any of the five Active Body spaces."
    : selectedShape
      ? `Only one ${shapeLabel[selectedShape].toLowerCase()} may be in the Active Body at a time.`
      : "Five total items; Pentagon, Chevron, and Bowtie are limited to one each.";
  prompt.innerHTML=selectedItem
    ? `<b>${selectedItem}</b><span>${shapeRule} Choose any highlighted open space.</span><button id="cancel-body-placement">CANCEL</button>`
    : `<b>STEP D LOADOUT</b><span>Choose PLACE on an inventory item. Shape limits are global, not tied to particular rows.</span>`;
  prompt.querySelector("#cancel-body-placement")?.addEventListener("click",()=>{selectedItem=null;patch();});
}

function patch(){
  patchInventory();
  patchBody();
}

async function refresh(){
  if(patchQueued)return;
  patchQueued=true;
  requestAnimationFrame(async()=>{
    patchQueued=false;
    state=await loadState();
    if(selectedItem && state.activeBody.includes(selectedItem)) selectedItem=null;
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
