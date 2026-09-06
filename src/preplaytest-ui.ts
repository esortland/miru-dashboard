import OBR from "@owlbear-rodeo/sdk";
import { loadState, META_KEY, MiruState, saveState } from "./state";
import { techAttack } from "./combat";

let state:MiruState|null=null;
const edge=(a:string,b:string)=>[a,b].sort().join("|");
async function apply(next:MiruState){state=next;await saveState(next);window.dispatchEvent(new Event("miru:playdesk-render"));}
function patchTech(){if(!state)return;const host=document.querySelector<HTMLElement>(".tech-options");if(!host||host.querySelector("#no-training-tech"))return;const wrap=document.createElement("div");wrap.id="no-training-tech";wrap.style.cssText="display:grid;gap:6px;margin-top:8px";const specs=[
 {key:"TS-5" as const,label:"TS-5 · SPRINT TECH",show:state.activeBody.includes("Light Shoes"),hint:"Light Shoes · -2 EP · enemy ESC -2 · no stack"},
 {key:"TS-6" as const,label:"TS-6 · ELECTRIC BOLTS",show:Boolean(state.techSkills["TS-6"]),hint:"Solar Taser · -2 EP · electrify Arrows for this combat"},
 {key:"TS-7" as const,label:"TS-7 · FLAMING ARROWS",show:Boolean(state.techSkills["TS-7"]),hint:"-2 EP · ignite Arrows for this combat"}
];for(const s of specs.filter(x=>x.show)){const b=document.createElement("button");b.className="combat-option";b.innerHTML=`<b>${s.label}</b><span>${s.hint}</span>`;b.onclick=()=>{if(state)void apply(techAttack(state,s.key));};wrap.appendChild(b);}if(wrap.children.length)host.appendChild(wrap);}
function patchImpassableReturn(){if(!state)return;const aside=document.querySelector<HTMLElement>("#map-app aside");if(!aside||aside.querySelector("#impassable-return"))return;const a=state.arrival;if(!a||a.day!==state.day||a.hex!==state.currentHex)return;const b=document.createElement("button");b.id="impassable-return";b.style.cssText="margin-top:7px;width:100%;padding:8px;font-weight:900";b.textContent=`MARK ${a.from} ↔ ${a.hex} IMPASSABLE + RETURN → F`;b.onclick=()=>{if(!state)return;const k=edge(a.from,a.hex),impassableEdges=state.impassableEdges.includes(k)?state.impassableEdges:[...state.impassableEdges,k];const mapHexes={...state.mapHexes,[a.from]:{...(state.mapHexes[a.from]??{}),explored:true,visits:Math.max(1,state.mapHexes[a.from]?.visits??1)}};void apply({...state,currentHex:a.from,mapHexes,impassableEdges,arrival:null,terrainRoll:null,step:"F"});};aside.appendChild(b);}
function patch(){patchTech();patchImpassableReturn();}
async function refresh(){state=await loadState();requestAnimationFrame(patch);}
window.addEventListener("miru:playdesk-render",()=>void refresh());
OBR.onReady(async()=>{await refresh();OBR.room.onMetadataChange(meta=>{if(meta[META_KEY])void refresh();});new MutationObserver(()=>requestAnimationFrame(patch)).observe(document.body,{childList:true,subtree:true});});
