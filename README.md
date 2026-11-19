# Solmar Bay — an open-world crime story

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/biuosa09-create/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/biuosa09-create/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is a complete open-world crime game that runs in a desktop browser
from static files — no network, no build step, no install. It was built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) ("Make GTA 6").

Play it: serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) or open `game/index.html` directly — it also runs from
`file://`.

New to make.fun? Sign up through my link: https://make.fun/r/shw861zs

## The game

You are **Milo Kade**, new in Solmar Bay with no car and no cash. **Vera Solano**,
a fixer with a garage downtown, gives you work — five missions that take you
from stealing your first car to hitting the Solmar Bank:

1. **First Wheels** — steal a car and bring it to Vera's Garage.
2. **The Pickup** — collect a package at the Old Port, deliver it to the Marina,
   and deal with the Dockside crew.
3. **Night Run** — collect three cash drops across the city after dark.
4. **Hot Pursuit** — lose a three-star wanted level, then reach the safehouse.
5. **The Big Score** — hold the bank vault, then escape four stars of heat.

After the story, the city is yours to free-roam.

## What's in the city

- **A city to explore on foot and by car** — Downtown towers, Palm Heights,
  the Old Port warehouses, the Marina, Southside and Coral Beach, on a
  3200×3200 street grid with parks, parking lots and street lights.
- **Traffic and pedestrians** — cars cruise the streets (and turn at
  intersections), people stroll the sidewalks and flee from danger.
- **Cars to steal** — press `E` next to any car. An occupied car means its
  driver gets yanked out and the cops take notice; a parked car is free.
- **A wanted level with police who respond** — 0–5 stars. Interceptors spawn,
  chase and ram you; on foot they can bust you. Lay low and the heat fades.
- **Combat** — punch (`F`) and shoot (mouse click) with hitscan tracers;
  rival gang members shoot back during missions.
- **A HUD with a live minimap** — health, money, wanted stars, the mission
  objective, a district readout, speed, and a minimap with the player, traffic,
  police and the pink mission marker.
- **Start screen, pause and save** — continue from a save (`Q` saves anywhere),
  with progress kept in `localStorage`.
- **Sound** — engine hum, sirens, gunshots, crashes and a bass-driven street
  theme, all synthesised live with WebAudio. No audio files.
- **Day and night** — the Night Run mission plays after dark, with headlights
  and glowing street lights.

## Controls

| Keys | Action |
| --- | --- |
| WASD / Arrows | Move on foot / drive |
| Shift | Run |
| E | Steal / enter a car, get out |
| F | Punch |
| Mouse click | Shoot toward the cursor |
| Space | Handbrake |
| P / Esc | Pause |
| Q | Save game |
| M | Mute |

## How it's built

Plain 2D canvas, no libraries, no WebGL — every file is a classic script under
`game/src/` so the game loads identically from `file://` and from a server:

| File | Job |
| --- | --- |
| `game/index.html` | Page shell and script order |
| `game/src/util.js` | Math and seeded-random helpers |
| `game/src/city.js` | The city: streets, blocks, buildings, landmarks |
| `game/src/audio.js` | Synthesised sound effects and music (WebAudio) |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/entities.js` | Player, traffic, pedestrians, police, wanted, combat |
| `game/src/missions.js` | The five-mission story arc |
| `game/src/render.js` | Canvas drawing: city, cars, people, night |
| `game/src/hud.js` | HUD, minimap, title / pause / wasted screens |
| `game/src/save.js` | Save and load via localStorage |
| `game/src/main.js` | Boot, fixed-timestep loop, screenshot staging |
| `main.ts` | Entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json` |
| `serve.ts` | Tiny static server for local play |

Everything — the city, characters, vehicles, story, art and music — is original.
Nothing is taken from any commercial game.

Screenshots in `screenshots/` are real renders of this game's own code, taken
with Playwright (`?shot=cover|mission|chase|night&seed=1` stages each scene;
see `shots.json`).

## License

MIT — see [LICENSE](LICENSE).
