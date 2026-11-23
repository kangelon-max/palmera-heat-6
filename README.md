# PALMERA HEAT IV

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kangelon-max/palmera-heat-6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kangelon-max/palmera-heat-6/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world action game set in Palmera Bay, a sun-baked coastal city
of piers, palm rows and neon — built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). One self-contained
HTML page and a hand-rolled WebGL engine: no libraries, no build step, no
network. Every texture, model, sound and street is generated procedurally at
load, so the whole city is deterministic from a seed.

## Play it

- In the browser: https://kangelon-max.github.io/palmera-heat-6/game/
- Offline: open `game/index.html` from this repository in any desktop browser.

## What's in the city

- A full open world: downtown blocks, a working pier with a ferris wheel,
  beaches and swimmable bay water, a hillside observatory, the PALMERA letters,
  and one very confident police headquarters wearing a giant neon stiletto.
- Five-slot arsenal — Fists, Pistol, Coco SMG, Breaker-12 shotgun, Palmera
  AR-7 rifle — with a Tab weapon wheel, drawn weapon profiles and stat bars,
  and 3D weapons modelled in the hero's hands.
- Jobs and heat: story errands for Marla Voss and Dre, a wanted system with
  roadblocks and a helicopter air unit, and the make.fun ghost's daily money
  drop that draws a crowd on the beachfront.
- A living day cycle — moving sun and a cratered moon, drifting clouds,
  golden-hour light over the water — plus traffic, pedestrians who react,
  detailed cars, and a giant who answers when summoned at the shore.
- San Andreas-style presentation: health and armour bars, a circular radar
  minimap, weapon cards and dialogue banners.

## Controls

- **WASD** move, **mouse** look, **right mouse** aim, **left mouse** fire
- **Tab** weapon wheel (or **1–5** to quick-select a slot)
- **Shift** sprint, **Space** jump (handbrake in a car), **E** interact
- **F** enter / exit car, **G** Dre's decoy

## Hand-in

`main.ts` is the make.fun entrypoint: it validates the game tree and
screenshots against the competition caps, copies them to the output
directory and writes the dossier.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
