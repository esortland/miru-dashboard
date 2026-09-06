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
  const rectangles:string[]=[];
  const special:Partial<Record<ItemShape,number>>={pentagon:2,chevron:3,bowtie:4};
  for(const name of state.activeBody){
    const shape=itemDefinition(name).shape;
    const fixed=special[shape];
    if(fixed!==undefined && out[fixed]===null) out[fixed]=name;
    else rectangles.push(name);
  }
  for(const name of rectangles){
    const i=out.findIndex(x=>x===null);
    if(i>=0)out[i]=name;
  }
  return out;
}

function slotAllows(index:number,shape:ItemShape){
  if(shape==="circle")return false;
  if(shape==="rectangle")return true;
  if(shape==="pentagon")return index===2;
  if(shape==="chevron")return index===3;
  if(shape==="bowtie")return index===4;
  return false;
}

function itemCanBeReadied(name:string){
  if(!state)return false;
  if(state.activeBody.includes(name))return false;
  const shape=itemDefinition(name).shape;
  const open=slots();
  return open.some((occupant,index)=>!occupant && slotAllows(index,shape));
}

async function placeSelected(index:number){
  if(!state||!selectedItem)return;
  const name=selectedItem;
  const shape=itemDefinition(name).shape;
  const current=slots();
  if(current[index] || !slotAllows(index,shape))return;
  if(!itemCanBeReadied(name))return;
  state={...state,activeBody:[...state.activeBody,name]};
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
    button.textContent=selectedItem===name ? "CANCEL PLACEMENT" : `PLACE · ${shapeLabel[def.shape]}`;
    button.disabled=!itemCanBeReadied(name) && selectedItem!==name;
    item.classList.toggle("placement-selected",selectedItem===name);
  });
}

function patchBody(){
  const panel=document.querySelector<HTMLElement>(".body-paper");
  if(!panel||!state)return;
  const current=slots();
  const selectedShape=selectedItem?itemDefinition(selectedItem).shape:null;
  panel.classList.toggle("placing-item",Boolean(selectedItem));
  panel.querySelectorAll<HTMLElement>(".body-slot").forEach((slot,index)=>{
    const occupied=current[index];
    const valid=Boolean(selectedItem && !occupied && selectedShape && slotAllows(index,selectedShape));
    slot.classList.toggle("placement-target",valid);
    slot.classList.toggle("placement-blocked",Boolean(selectedItem&&!valid));
    if(valid){
      slot.setAttribute("role","button");
      slot.setAttribute("tabindex","0");
      slot.onclick=()=>void placeSelected(index);
      slot.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();void placeSelected(index);}};
      const copy=slot.querySelector<HTMLElement>(".empty-slot-copy");
      if(copy&&selectedItem)copy.innerHTML=`<b>PLACE ${selectedItem.toUpperCase()}</b><span>${shapeLabel[selectedShape!]} FITS HERE</span>`;
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
  prompt.innerHTML=selectedItem
    ? `<b>${selectedItem}</b><span>Select a highlighted ${shapeLabel[selectedShape!].toLowerCase()}-compatible slot.</span><button id="cancel-body-placement">CANCEL</button>`
    : `<b>STEP D LOADOUT</b><span>Choose PLACE on an inventory item, then choose exactly where it fits.</span>`;
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
