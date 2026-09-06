import OBR from "@owlbear-rodeo/sdk";
import { clamp, loadState, META_KEY, MiruState, saveState } from "./state";

type Food = "Meal Bar" | "Fruit";
let state: MiruState | null = null;
let queued = false;

function injectStyles(){
  if(document.querySelector("#ipad-play-ux-style")) return;
  const style=document.createElement("style");
  style.id="ipad-play-ux-style";
  style.textContent=`
    .guide-drawer-inner{overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-bottom:calc(18px + env(safe-area-inset-bottom))!important}
    #play-ready-guide{position:relative!important;inset:auto!important;max-width:none!important}
    .step-l-direct-eat{font-size:7px!important;font-weight:1000!important;letter-spacing:.08em!important}
    @media (max-width:1180px){
      .guide-drawer{left:12px!important;right:12px!important;top:auto!important;bottom:64px!important;width:auto!important;height:min(48vh,460px)!important;transform:translateY(calc(100% + 80px))!important}
      .guide-drawer.open{transform:translateY(0)!important}
      .guide-drawer-inner{height:100%!important;border-left:1px solid #58544c!important;border-top:4px solid #e05a4f!important;border-radius:8px 8px 0 0!important;box-shadow:0 -16px 44px #0009!important}
      .desk-chrome{z-index:70!important}
      .desk-tabs{position:relative;z-index:71!important}
    }
  `;
  document.head.appendChild(style);
}

function moveRuleActionsIntoScroller(){
  const drawer=document.querySelector<HTMLElement>("#guide-drawer")??document.querySelector<HTMLElement>(".guide-drawer");
  const inner=drawer?.querySelector<HTMLElement>(".guide-drawer-inner");
  const helper=drawer?.querySelector<HTMLElement>("#play-ready-guide");
  if(inner&&helper&&helper.parentElement!==inner) inner.appendChild(helper);
}

function decorateStepLFoodControls(){
  if(!state) return;
  for(const food of ["Meal Bar","Fruit"] as Food[]){
    const selector=`[data-supply="${food}"][data-delta="-1"]`;
    document.querySelectorAll<HTMLButtonElement>(selector).forEach(button=>{
      const canEat=state?.step==="L" && state.dayState.foodEaten<3 && (state.supplies[food]??0)>0;
      button.textContent=canEat?"EAT":"−";
      button.classList.toggle("step-l-direct-eat",Boolean(canEat));
      if(canEat) button.title=`Eat 1 ${food} for Step L`;
    });
  }
}

async function eatFromSheet(food:Food){
  const fresh=await loadState();
  if(fresh.step!=="L" || fresh.dayState.foodEaten>=3 || fresh.supplies[food]<1) return;
  const supplies={...fresh.supplies,[food]:fresh.supplies[food]-1};
  const hp=clamp(fresh.hp+(food==="Meal Bar"?2:1),0,20);
  const ep=clamp(fresh.ep+(food==="Meal Bar"?1:2),0,20);
  const next:MiruState={...fresh,hp,ep,supplies,dayState:{...fresh.dayState,ate:true,foodEaten:fresh.dayState.foodEaten+1}};
  state=next;
  await saveState(next);
}

function interceptDirectEat(){
  document.addEventListener("click",event=>{
    const target=(event.target as HTMLElement).closest<HTMLButtonElement>("[data-supply][data-delta='-1']");
    if(!target||!state||state.step!=="L") return;
    const food=target.dataset.supply as Food;
    if(food!=="Meal Bar"&&food!=="Fruit") return;
    if(state.dayState.foodEaten>=3||state.supplies[food]<1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void eatFromSheet(food);
  },true);
}

function patch(){
  injectStyles();
  moveRuleActionsIntoScroller();
  decorateStepLFoodControls();
}

function queuePatch(){
  if(queued) return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;patch();});
}

async function refresh(){
  state=await loadState();
  queuePatch();
}

OBR.onReady(async()=>{
  injectStyles();
  interceptDirectEat();
  await refresh();
  OBR.room.onMetadataChange(meta=>{if(meta[META_KEY]) void refresh();});
  new MutationObserver(()=>queuePatch()).observe(document.body,{subtree:true,childList:true});
  window.addEventListener("miru:playdesk-render",()=>queuePatch());
});
