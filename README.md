# MIRU Companion for Owlbear Rodeo

A lightweight Owlbear Rodeo extension for running **MIRU** as an interactive solo tabletop campaign.

## v0.1 features

- Persistent per-scene MIRU state using Owlbear scene metadata
- Day 1–66 tracking
- A–P turn-step tracker with MIRU's Dawn / Day / Dusk / Dark phases
- HP and EP controls (0–20)
- Starvation, poison, sleep deprivation, and minor injury counters
- Quick dice: terrain, weather, 3d6 event, encounter, escape, enemy attack
- MIRU terrain result helper for the 1d6 terrain roll
- One-click map stamps placed at the center of the current Owlbear viewport
- Current hex and free-form field notes
- Reset flow using MIRU's starting state: Day 1, Step G, G-10, HP 10, EP 10, 3 Meal Bars

## Run locally

```bash
npm install
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`.

To load it in Owlbear Rodeo, expose that local dev server over HTTPS (for example with a tunnel) and add this manifest URL to your Owlbear extensions:

```text
https://YOUR-HTTPS-HOST/manifest.json
```

Owlbear's extension manifest is served from `public/manifest.json` and its action opens `index.html` as the dashboard popover.

## Production build

```bash
npm run build
```

Deploy the contents of `dist/` to any static HTTPS host (GitHub Pages, Cloudflare Pages, Netlify, Vercel static hosting, etc.). Then install:

```text
https://YOUR-DOMAIN/manifest.json
```

## Implementation notes

Campaign state is stored under the namespaced scene metadata key:

```text
com.esortland.miru-companion/state
```

This makes state persist with the Owlbear scene and avoids collisions with other extensions.

Map stamps are currently native Owlbear shape/text items. This is deliberate for v0.1: they remain crisp, movable, selectable, and editable at any zoom. The generated MIRU visual asset sheets can be integrated into a later image-stamp implementation.

## Next milestones

- True click-on-hex stamp placement tool mode
- Inventory editor and Active Body slots
- Tech Skill level tracking and skill rolls
- Player-position token binding / current-hex sync
- Enemy cards with HP / DEF / ESC / ATK state
- Combat mode that walks enemy turn → player action → damage
- Map icons using cropped visual assets rather than native shape proxies
