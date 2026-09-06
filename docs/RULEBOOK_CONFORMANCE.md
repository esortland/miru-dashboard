# MIRU Companion rulebook conformance

Source basis: MIRU Adventure 2025, printed page references.

## Turn loop

- A-E: p.6
- F-K: p.7
- L-M: p.8
- N-P: p.9
- New tile: G -> optional H -> I.
- Old tile with icon: J. Old tile without icon: K.
- Terrain roll: 1d6; 1 is Minor Injury, 2-6 are terrain.
- Minor Injury: -2 HP; third injury goes to the p.21 sequence; otherwise Step L.
- Step I uses 2d6 in the companion. The p.7 step text says 3d6, but every terrain event table says 2d6 and uses sums 2-12. The companion follows the terrain tables.

## Character sheet

- Inventory: max 10 unique non-circle items; duplicates stack.
- Active Body: max 5 total.
- Rectangles may occupy all 5.
- Pentagon, Chevron, and Bowtie are each max 1 on Active Body.
- Active Body rearrangement is only at Step D.
- Mask and Tools do not consume Inventory/Active Body capacity.
- Fruit, Meal Bars, Bits, and Arrows are tracked as circle-item supplies.

## Dusk / Dark

- Step L: if Food is held, at least 1 and at most 3 Food items must be eaten; Meal Bar +2 HP/+1 EP, Fruit +1 HP/+2 EP.
- Step N: if sleep is possible, sleep is mandatory; base sleep +3 HP/+2 EP.
- Improved Camping Gear replaces base sleep recovery with +4 HP/+4 EP.
- Heavy Rain prevents EP recovery from sleep.
- Harsh Snow prevents HP recovery from sleep.
- Extreme Winds prevents sleep.
- Step O applies Starvation then Poison (MIRU 2) then Sleep Deprivation. MIRU Companion only auto-resolves MIRU 1 effects supported by this book.

## Combat

- Enemy attacks first.
- Damage = ATK - DEF, minimum 0.
- Player DEF is base +1 plus applicable Active Body equipment; Cyclops Mask applies +1 DEF against Robots.
- Player attack is base +1 plus chosen Active Body weapon and applicable modifiers.
- Range Weapons consume 1 Arrow per attack.
- Dense Fog prevents Escape; weather ATK/DEF penalties are applied.
- TS-1/TS-2 require a Melee Weapon; TS-3 requires a Weapon; TS-4 requires Solar Taser and can only successfully apply once per day.
- Successful trained Tech Skill attacks level that skill; level 6 no longer rolls.
- Successful Escape leaves the enemy on the map and routes by parity to N or O.
- Defeated enemies roll reward dice equal to their filled skill squares (p.16); the companion provides the dice, while reward choice remains with the player.

## Map / events

- Impassable edges are persisted and block movement.
- Experienced event IDs are persisted so repeats can be recognized; repeat handling follows p.17.
- Escaped enemies are persisted on their hex.

## Design rule

The companion may automate arithmetic and state bookkeeping, but player-facing choices, event reading, and interpretation remain explicit. When a source rule is ambiguous or contradictory, the decision is documented here rather than silently invented.
