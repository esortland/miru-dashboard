import OBR from "@owlbear-rodeo/sdk";
import { loadState, META_KEY, MiruState, saveState } from "./state";

const ROWS=["A","B","C","D","E","F","G"] as const;
let state:MiruState|null=null;
function parse(hex:string){const m=/^([A-G])-(\d{2})$/.exec(hex);return m?{r:ROWS.indexOf(m[1] as typeof ROWS[number]),c:Number(m[2])}:null;}
function adjacent(a:string,b:string){const x=parse(a),y=parse(b);if(!x||!y)return false;if(x.r===y.r)return Math.abs(x.c-y.c)===2;return Math.abs(x.r-y.r)===1&&Math.abs(x.c-y.c)===1;}
function edge(a:string,b:string){return[a,b].sort().join("|");}
function selectedHex(){return document.querySelector<HTMLElement>("#map-app aside .hex-title b")?.textContent?.trim()??"";}
function patch(){if(!state?.dayState.escapeMove)return;const move=document.querySelector<HTMLButtonElement>("#map-app #move");if(!move)return;const target=selectedHex(),from=state.currentHex,valid=target!==from&&adjacent(from,target)&&!state.impassableEdges.includes(edge(from,target));move.disabled=!valid;move.textContent=valid?`ESCAPE TO ${target}`:"SELECT AN ADJACENT ESCAPE HEX";const aside=document.querySelector<HTMLElement>("#map-app aside");if(aside&&!aside.querySelector("#escape-move-note")){const note=document.createElement("div");note.id="escape-move-note";note.style.cssText="padding:9px;margin:8px 0;border:1px solid #b65049;background:#ffe2dc;font-size:9px;font-weight:900";note.textContent=`ESCAPE MOVE REQUIRED · leave ${state.dayState.escapeMove.from}, then continue to Step ${state.dayState.escapeMove.nextStep}.`;aside.insertBefore(note,move);}}
async function handleMove(e:Event){const button=(e.target as Element)?.closest?.("#move") as HTMLButtonElement|null;if(!button||!state?.dayState.escapeMove)return;const target=selectedHex(),from=state.currentHex;if(button.disabled||!adjacent(from,target)||state.impassableEdges.includes(edge(from,target)))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const destination={...(state.mapHexes[target]??{})},mapHexes={...state.mapHexes};mapHexes[from]={...(mapHexes[from]??{}),explored:true,visits:Math.max(1,mapHexes[from]?.visits??1)};mapHexes[target]={...destination,explored:true,visits:(destination.visits??0)+1};const nextStep=state.dayState.escapeMove.nextStep;state={...state,currentHex:target,mapHexes,arrival:null,terrainRoll:null,step:nextStep,dayState:{...state.dayState,escapeMove:null}};await saveState(state);window.dispatchEvent(new Event("miru:playdesk-render"));}
async function refresh(){state=await loadState();requestAnimationFrame(patch);}
document.addEventListener("click",e=>void handleMove(e),true);
window.addEventListener("miru:playdesk-render",()=>void refresh());
OBR.onReady(async()=>{await refresh();OBR.room.onMetadataChange(meta=>{if(meta[META_KEY])void refresh();});new MutationObserver(()=>requestAnimationFrame(patch)).observe(document.body,{childList:true,subtree:true});});
