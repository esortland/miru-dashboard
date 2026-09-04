# MIRU Companion for Owlbear Rodeo

A lightweight Owlbear Rodeo extension for running **MIRU** as an interactive solo tabletop campaign.

## v0.2 features

- Persistent per-scene MIRU state using Owlbear scene metadata
- Day 1–66 tracking and A–P Dawn / Day / Dusk / Dark turn flow
- HP / EP plus starvation, poison, sleep deprivation, and minor injury counters
- Quick dice for terrain, weather, events, encounters, escape, and enemy attacks
- **True click-to-place map stamping** through a persistent MIRU Stamp toolbar tool
- Terrain rolls automatically arm the rolled terrain stamp
- Terrain and map-icon stamps for Forest, Mountain, Grassland, Desert, Swamp, Village, Quest, Treasure, Enemy, Radio Tower, Power Supply, Impassable Edge, Camp, Current Position, and Explored
- **Inventory editor** with a 10-unique-item bag limit and stacked quantities
- **Active Body** with a 5-item limit and equip / unequip flow
- **Tech Skill tracking** for TS-1 through TS-7; TS-1–4 level from 1–6 while TS-5–7 are learned toggles
- Current hex, persistent field notes, and campaign reset
- MIRU starting state: Day 1, Step G, G-10, HP 10, EP 10, 3 Meal Bars

## Using the stamp tool

1. Open the MIRU Companion popover.
2. Choose a terrain or map icon under **Map Stamps**. This arms that stamp.
3. Select **MIRU Stamp** in the Owlbear toolbar.
4. Click the target hex / location in the scene.
5. Keep clicking to place the same stamp, or choose another stamp in the dashboard.

The stamp tool is registered from the extension background page, so it remains available while the dashboard popover is closed.

## Inventory model

Items found are added to the bag. Duplicate items stack. The bag allows up to 10 unique item names. Equipping an item moves one copy from the bag to Active Body; unequipping moves it back. Active Body allows up to five unique items.

This version tracks the core limits but does not yet automate MIRU's item-shape restrictions.

## Run locally

```bash
npm install
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`.

Expose the dev server over HTTPS and install this manifest in Owlbear Rodeo:

```text
https://YOUR-HTTPS-HOST/manifest.json
```

## Production build

```bash
npm run build
```

The Vite build includes both `index.html` (dashboard) and `background.html` (persistent toolbar logic). Deploy the contents of `dist/` to a static HTTPS host and install:

```text
https://YOUR-DOMAIN/manifest.json
```

## State

Campaign state is stored in Owlbear scene metadata under:

```text
com.esortland.miru-companion/state
```

## Development

Pull requests run `npm ci` and `npm run build` through GitHub Actions.

## Next milestones

- Bind Current Position to a player token and derive the current hex automatically
- Item-shape / Active Body slot validation
- Tech Skill attack rolls and automatic successful-skill leveling
- Enemy cards with HP / DEF / ESC / ATK state
- Combat mode: enemy turn → player action → damage → rewards
- Replace native shape stamps with the cropped MIRU-inspired visual asset pack where it improves readability
