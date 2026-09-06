import type { Step } from "./state";

// Concise mechanical facts from MIRU Adventure 2025. Printed page refs.
export const STEP_PAGE: Record<Step,string> = {A:"p.6",B:"p.6",C:"p.6",D:"p.6",E:"p.6",F:"p.7",G:"p.7",H:"p.7",I:"p.7",J:"p.7",K:"p.7",L:"p.8",M:"p.8",N:"p.9",O:"p.9",P:"p.9"};
export const TERRAIN_PAGE: Record<string,string> = {Forest:"p.18",Mountain:"p.22",Grassland:"p.26",Desert:"p.30",Swamp:"p.34"};
export const TERRAIN_BY_D6: Record<number,string> = {2:"Forest",3:"Mountain",4:"Grassland",5:"Desert",6:"Swamp"};

export type Weather = "Heavy Rain"|"Harsh Snow"|"Extreme Winds"|"Dense Fog"|"No Weather";
export const WEATHER_BY_TERRAIN: Record<string,(roll:number)=>Weather> = {
  Forest:r=>r<=3?"Heavy Rain":"Dense Fog",
  Mountain:r=>r<=3?"Heavy Rain":"Harsh Snow",
  Grassland:r=>r<=3?"Heavy Rain":"Extreme Winds",
  Desert:r=>r<=3?"No Weather":"Extreme Winds",
  Swamp:r=>r<=3?"Heavy Rain":"Dense Fog"
};

export const STARVATION_HP = [0,2,4,6,8,10,12,16] as const;
export const SLEEP_DEP_EP = [0,2,4,8,16] as const;

export type WeaponKind = "melee"|"range"|"weapon";
export type CombatItem = { atk?:number; def?:number; weapon?:WeaponKind; robotAtk?:number };
export const COMBAT_ITEMS: Record<string,CombatItem> = {
  "Solar Taser": {atk:9,weapon:"weapon"},
  "God Finger": {atk:7,weapon:"weapon"},
  "Hunting Knife": {atk:4,weapon:"melee"},
  "Laser Sword": {atk:8,weapon:"melee"},
  "Small Bow": {atk:3,weapon:"range"},
  "Strong Bow": {atk:6,weapon:"range"},
  "Climbing Gloves": {def:1},
  "Hacked Minor Shield": {def:3},
  "Military Helmet": {def:2},
  "Light Shoes": {def:1},
  "Sleeper's Leather Jacket": {def:1},
  "Alora Cards": {robotAtk:1}
};

export function activeDefense(items:string[], robot=false){
  return 1 + items.reduce((n,name)=>n+(COMBAT_ITEMS[name]?.def??0)+(robot?(COMBAT_ITEMS[name]?.robotAtk?0:0):0),0);
}
export function weaponInfo(name:string|null|undefined){return name?COMBAT_ITEMS[name]:undefined;}
export function isWeapon(name:string){return Boolean(COMBAT_ITEMS[name]?.weapon);}
export function hasMelee(items:string[]){return items.some(x=>COMBAT_ITEMS[x]?.weapon==="melee");}
export function hasWeapon(items:string[]){return items.some(isWeapon);}

// Rulebook inconsistency note: Step I text says 3d6 (p.7), but every terrain event table says 2d6
// and uses sums 2-12. The companion intentionally follows the terrain tables: 2d6.
export const NEW_TILE_EVENT_DICE = 2;
