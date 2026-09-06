import { clamp, CombatState, MiruState } from "./state";
import { COMBAT_ITEMS, weaponInfo } from "./rules";

export const TRAINED_TECH={
  "TS-1":{name:"Dodge & Strike",cost:2,atk:2,robotOnly:false},
  "TS-2":{name:"Roll & Wire Slice",cost:3,atk:4,robotOnly:true},
  "TS-3":{name:"Jump & Attack",cost:4,atk:6,robotOnly:false},
  "TS-4":{name:"EMP Grenade",cost:2,atk:0,robotOnly:true},
  "TS-5":{name:"Sprint Tech",cost:2,atk:0,robotOnly:false},
  "TS-6":{name:"Electric Bolts",cost:2,atk:2,robotOnly:true},
  "TS-7":{name:"Flaming Arrows",cost:2,atk:3,robotOnly:false}
} as const;
export type TrainedTechKey=keyof typeof TRAINED_TECH;
const d6=()=>Math.floor(Math.random()*6)+1;
const damage=(atk:number,def:number)=>Math.max(0,atk-def);
const addLog=(c:CombatState,m:string):CombatState=>({...c,log:[...c.log,m].slice(-40)});
const weatherAtkPenalty=(s:MiruState)=>s.dayState.weather==="Extreme Winds"?1:s.dayState.weather==="Dense Fog"?2:0;
const weatherDefPenalty=(s:MiruState)=>s.dayState.weather==="Heavy Rain"?1:s.dayState.weather==="Harsh Snow"?2:0;
export function playerDefense(s:MiruState){let n=1+s.activeBody.reduce((x,name)=>x+(COMBAT_ITEMS[name]?.def??0),0);if(s.combat.robot&&s.mask==="Cyclops Mask")n+=1;return Math.max(0,n-weatherDefPenalty(s));}
function robotAtkBonus(s:MiruState){return s.combat.robot&&s.activeBody.includes("Alora Cards")?1:0;}
function selectedWeapon(s:MiruState){const name=s.combat.selectedWeapon;return name&&s.activeBody.includes(name)&&weaponInfo(name)?.weapon?name:null;}
function consumeArrow(s:MiruState,name:string|null){if(!name||weaponInfo(name)?.weapon!=="range")return s;if(s.supplies.Arrows<1)return null;return{...s,supplies:{...s.supplies,Arrows:s.supplies.Arrows-1}};}
function attackValue(s:MiruState,name:string|null,bonus=0){return Math.max(0,1+(name?weaponInfo(name)?.atk??0:0)+robotAtkBonus(s)+bonus-weatherAtkPenalty(s));}
export function startCombat(s:MiruState){const c=s.combat;return{...s,combat:addLog({...c,active:true,enemyHp:c.enemyMaxHp,rewardRolls:[]},`Combat started with ${c.enemyName}. Enemy acts first.`)};}
export function resetCombatLog(s:MiruState){return{...s,combat:{...s.combat,log:[]}};}
export function enemyTurn(s:MiruState){let c={...s.combat};if(!c.active)return s;if(c.burn>0){c.enemyHp=clamp(c.enemyHp-c.burn,0,c.enemyMaxHp);c=addLog(c,`Burn deals ${c.burn} damage (${c.enemyHp}/${c.enemyMaxHp} HP).`);if(c.enemyHp<=0)return{...s,combat:addLog({...c,active:false},`${c.enemyName} is defeated.`)}}if(c.stun>0){const rolls=Array.from({length:c.stun},d6);if(rolls.includes(4)){c=addLog(c,`STUN ${rolls.join(", ")} - enemy attack skipped.`);c.enemyAtkBonusNext=0;return{...s,combat:c}}c=addLog(c,`STUN ${rolls.join(", ")} - no 4; enemy attacks.`)}const roll=d6(),base=roll<=2?c.enemyAtkLow:roll<=4?c.enemyAtkMid:c.enemyAtkHigh,atk=base+c.enemyAtkBonusNext,def=playerDefense(s),dealt=damage(atk,def),hp=clamp(s.hp-dealt,0,20);c.enemyAtkBonusNext=0;c=addLog(c,`Enemy rolls ${roll}: ${atk} ATK vs ${def} DEF -> ${dealt} damage.`);if(hp<=0)c=addLog(c,"HP reached 0 - death rules p.17 apply.");return{...s,hp,combat:c};}
export function basicAttack(s:MiruState){let c={...s.combat};if(!c.active)return s;const weapon=selectedWeapon(s);const withArrow=consumeArrow(s,weapon);if(withArrow===null)return{...s,combat:addLog(c,"Basic attack needs 1 Arrow for the selected Range Weapon.")};const atk=attackValue(withArrow,weapon),dealt=damage(atk,c.enemyDef);c.enemyHp=clamp(c.enemyHp-dealt,0,c.enemyMaxHp);c=addLog(c,`${weapon??"Fists"}: ${atk} ATK vs ${c.enemyDef} DEF -> ${dealt} damage${weaponInfo(weapon??"")?.weapon==="range"?"; -1 Arrow":""}.`);if(c.enemyHp<=0)c=addLog({...c,active:false},`${c.enemyName} is defeated. Roll ${c.enemySkill} reward D6 (p.16).`);return{...withArrow,combat:c};}
export function techAttack(s:MiruState,key:TrainedTechKey){const skill=TRAINED_TECH[key],level=s.techSkills[key]??0;let c={...s.combat};if(!c.active||level<1)return s;if(s.ep<skill.cost)return{...s,combat:addLog(c,`${key} needs ${skill.cost} EP.`)};if(skill.robotOnly&&!c.robot)return{...s,combat:addLog(c,`${key} only works against Robots.`)};const weapon=selectedWeapon(s),kind=weapon?weaponInfo(weapon)?.weapon:undefined;
 if((key==="TS-1"||key==="TS-2")&&kind!=="melee")return{...s,combat:addLog(c,`${key} requires the selected weapon to be Melee.`)};
 if(key==="TS-3"&&!weapon)return{...s,combat:addLog(c,"TS-3 requires a selected Weapon on the Active Body.")};
 if(key==="TS-4"&&!s.tools.includes("Solar Taser"))return{...s,combat:addLog(c,"TS-4 requires the Solar Taser Tool.")};
 if(key==="TS-4"&&s.techUsedDay[key]===s.day)return{...s,combat:addLog(c,"TS-4 has already succeeded today.")};
 if(key==="TS-6"&&(!s.tools.includes("Solar Taser")||kind!=="range"))return{...s,combat:addLog(c,"TS-6 requires Solar Taser and a selected Range Weapon.")};
 if(key==="TS-7"&&kind!=="range")return{...s,combat:addLog(c,"TS-7 requires a selected Range Weapon.")};
 let working=s;
 const needsArrow=key==="TS-6"||key==="TS-7"||((key==="TS-1"||key==="TS-2"||key==="TS-3")&&kind==="range");
 if(needsArrow){const next=consumeArrow(working,weapon);if(next===null)return{...s,combat:addLog(c,`${key} needs 1 Arrow.`)};working=next;}
 const ep=clamp(working.ep-skill.cost,0,20);
 if(key==="TS-5"){c.enemyEsc=Math.max(0,c.enemyEsc-2);c=addLog(c,"TS-5 Sprint Tech: enemy ESC -2 for this combat. -2 EP.");return{...working,ep,combat:c};}
 if(key==="TS-6"){const atk=attackValue(working,weapon,2),dealt=damage(atk,c.enemyDef);c.enemyHp=clamp(c.enemyHp-dealt,0,c.enemyMaxHp);c.stun=Math.min(3,c.stun+1);c=addLog(c,`TS-6 Electric Bolts: ${atk} ATK -> ${dealt} damage; +1 STUN. -2 EP.`);if(c.enemyHp<=0)c=addLog({...c,active:false},`${c.enemyName} is defeated. Roll ${c.enemySkill} reward D6 (p.16).`);return{...working,ep,combat:c};}
 if(key==="TS-7"){const atk=attackValue(working,weapon,3),dealt=damage(atk,c.enemyDef);c.enemyHp=clamp(c.enemyHp-dealt,0,c.enemyMaxHp);c.burn=Math.min(3,c.burn+1);c=addLog(c,`TS-7 Flaming Arrows: ${atk} ATK -> ${dealt} damage; +1 BURN. -2 EP.`);if(c.enemyHp<=0)c=addLog({...c,active:false},`${c.enemyName} is defeated. Roll ${c.enemySkill} reward D6 (p.16).`);return{...working,ep,combat:c};}
 const learned=Object.values(s.techSkills).filter(v=>v>0).length,dice=Math.max(1,Math.min(3,learned)),rolls=level>=6?[]:Array.from({length:dice},d6),success=level>=6||rolls.some(r=>r<=level);if(!success){c=addLog(c,`${key} Lv${level}: ${rolls.join(", ")} - miss. -${skill.cost} EP.`);return{...working,ep,combat:c}}const skills={...working.techSkills,[key]:Math.min(6,level+1)},used={...working.techUsedDay};if(key==="TS-4"){c.stun=3;used[key]=working.day;c=addLog(c,`TS-4 succeeds - STUN 3. Skill -> Lv${skills[key]}. -${skill.cost} EP.`)}else{const atk=attackValue(working,weapon,skill.atk),dealt=damage(atk,c.enemyDef);c.enemyHp=clamp(c.enemyHp-dealt,0,c.enemyMaxHp);c=addLog(c,`${key} succeeds: ${atk} ATK -> ${dealt} damage. Skill -> Lv${skills[key]}. -${skill.cost} EP.`);if(c.enemyHp<=0)c=addLog({...c,active:false},`${c.enemyName} is defeated. Roll ${c.enemySkill} reward D6 (p.16).`)}return{...working,ep,techSkills:skills,techUsedDay:used,combat:c};}
export function attemptEscape(s:MiruState){let c={...s.combat};if(!c.active)return s;if(s.dayState.weather==="Dense Fog")return{...s,combat:addLog(c,"Dense Fog prevents Escape (p.5).")};if(c.escapeLocked){c=addLog({...c,escapeLocked:false},"Escape unavailable this turn because of the previous odd failed roll.");return{...s,combat:c}}if(s.ep<2)return{...s,combat:addLog(c,"Escape requires 2 EP.")};const roll=d6(),ep=clamp(s.ep-2,0,20);if(roll>c.enemyEsc){const mapHexes={...s.mapHexes,[s.currentHex]:{...s.mapHexes[s.currentHex],icon:"Enemy",enemy:{name:c.enemyName,level:c.enemySkill}}};const nextStep:"N"|"O"=roll%2===0?"O":"N";c=addLog({...c,active:false},`Escape ${roll} > ESC ${c.enemyEsc}: success. Move to an adjacent tile; enemy remains here. ${roll%2===0?"Even -> Step O":"Odd -> Step N"}.`);return{...s,ep,mapHexes,combat:c,dayState:{...s.dayState,escapeMove:{from:s.currentHex,nextStep}}}}if(roll%2===0)c=addLog({...c,enemyAtkBonusNext:c.enemyAtkBonusNext+1},`Escape ${roll} <= ESC ${c.enemyEsc}: fail. Even -> enemy +1 ATK next turn.`);else c=addLog({...c,escapeLocked:true},`Escape ${roll} <= ESC ${c.enemyEsc}: fail. Odd -> cannot escape next turn.`);return{...s,ep,combat:c};}
