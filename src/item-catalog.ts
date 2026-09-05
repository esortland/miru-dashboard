export type ItemShape = "circle" | "rectangle" | "pentagon" | "chevron" | "bowtie";
export type ItemZone = "supply" | "inventory" | "mask" | "tool";

export type ItemDefinition = {
  name: string;
  shape: ItemShape;
  zone: ItemZone;
  effect?: string;
};

export const SUPPLY_ITEMS = ["Fruit", "Meal Bar", "Bits", "Arrows"] as const;
export type SupplyName = (typeof SUPPLY_ITEMS)[number];

export const ITEM_CATALOG: Record<string, ItemDefinition> = {
  Fruit: { name: "Fruit", shape: "circle", zone: "supply", effect: "+1 HP / +2 EP" },
  "Meal Bar": { name: "Meal Bar", shape: "circle", zone: "supply", effect: "+2 HP / +1 EP" },
  Bits: { name: "Bits", shape: "circle", zone: "supply", effect: "Bitlith currency" },
  Arrows: { name: "Arrows", shape: "circle", zone: "supply", effect: "Required by bows" },
  "Old Wine Bottles": { name: "Old Wine Bottles", shape: "rectangle", zone: "inventory", effect: "+4 HP / +4 EP" },
  "Solar Light": { name: "Solar Light", shape: "pentagon", zone: "tool", effect: "+1 ATK in Dark / Rain" },
  "Solar Taser": { name: "Solar Taser", shape: "rectangle", zone: "tool", effect: "+9 ATK / +1 Stun" },
  "God Finger": { name: "God Finger", shape: "pentagon", zone: "inventory", effect: "+7 ATK" },
  "Hunting Knife": { name: "Hunting Knife", shape: "rectangle", zone: "inventory", effect: "+4 ATK" },
  "Laser Sword": { name: "Laser Sword", shape: "pentagon", zone: "inventory", effect: "+8 ATK" },
  "Small Bow": { name: "Small Bow", shape: "rectangle", zone: "inventory", effect: "+3 ATK" },
  "Strong Bow": { name: "Strong Bow", shape: "pentagon", zone: "inventory", effect: "+6 ATK" },
  "Treasure Map 1": { name: "Treasure Map 1", shape: "pentagon", zone: "inventory" },
  "Treasure Map 2": { name: "Treasure Map 2", shape: "pentagon", zone: "inventory" },
  "Treasure Map 3": { name: "Treasure Map 3", shape: "pentagon", zone: "inventory" },
  "Treasure Map 4": { name: "Treasure Map 4", shape: "pentagon", zone: "inventory" },
  "Treasure Map 5": { name: "Treasure Map 5", shape: "pentagon", zone: "inventory" },
  "Treasure Map 6": { name: "Treasure Map 6", shape: "pentagon", zone: "inventory" },
  "Laser Arm": { name: "Laser Arm", shape: "bowtie", zone: "inventory" },
  "Spare Parts": { name: "Spare Parts", shape: "bowtie", zone: "inventory" },
  "Climbing Gloves": { name: "Climbing Gloves", shape: "rectangle", zone: "inventory", effect: "+1 DEF" },
  "Cyclops Mask": { name: "Cyclops Mask", shape: "chevron", zone: "mask", effect: "+1 DEF vs Robots" },
  "Hacked Minor Shield": { name: "Hacked Minor Shield", shape: "chevron", zone: "inventory", effect: "+3 DEF" },
  "Military Helmet": { name: "Military Helmet", shape: "pentagon", zone: "inventory", effect: "+2 DEF" },
  "Light Shoes": { name: "Light Shoes", shape: "rectangle", zone: "inventory", effect: "+1 DEF" },
  "Sleeper's Leather Jacket": { name: "Sleeper's Leather Jacket", shape: "pentagon", zone: "inventory", effect: "+1 DEF" },
  "Alora Cards": { name: "Alora Cards", shape: "rectangle", zone: "inventory", effect: "+1 ATK vs Robots" },
  "Engineered Plant": { name: "Engineered Plant", shape: "rectangle", zone: "inventory", effect: "+1 Fruit every 5 days" },
  "Golden Cross": { name: "Golden Cross", shape: "pentagon", zone: "inventory" },
  "Improved Camping Gear": { name: "Improved Camping Gear", shape: "rectangle", zone: "inventory", effect: "+4 HP / +4 EP sleeping" },
  "Jewelry Box": { name: "Jewelry Box", shape: "pentagon", zone: "inventory" },
  "Journal I": { name: "Journal I", shape: "rectangle", zone: "inventory", effect: "Unlocks TS-6" },
  "Journal II": { name: "Journal II", shape: "rectangle", zone: "inventory", effect: "Unlocks TS-7" },
  "Survival Book": { name: "Survival Book", shape: "rectangle", zone: "inventory", effect: "Unlocks TS-4" }
};

export function itemDefinition(name: string): ItemDefinition {
  return ITEM_CATALOG[name] ?? { name, shape: "rectangle", zone: "inventory" };
}
