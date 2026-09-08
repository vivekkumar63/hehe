# World Chaos Racing — Design Spec
_2026-09-08_

## Overview

A browser-based vertical physics elimination race game designed for YouTube Shorts / live vertical streaming (1080×1920, 9:16). 12 country racers (circles with 3D sphere visuals) compete on a procedurally generated obstacle course. Physics determines all outcomes — no predetermined winners. Runs autonomously in a loop for hours.

---

## Decisions Locked

| Decision | Choice | Rationale |
|---|---|---|
| Screen layout | Option A — compact header + top-3 leaderboard, ~57% gameplay | Maximum arena visibility on phone |
| Racer tokens | 3D sphere — flag stripes rotate with Matter.js `angle`, fixed specular highlight + limb shadow | Viewers can see rolling motion |
| Physics engine | Phaser 3 + built-in Matter.js plugin | Real rigid-body physics produces genuinely unpredictable outcomes |
| Build strategy | 9 incremental steps; first deliverable per section 36 of original spec | Test each layer before adding the next |

---

## Architecture

### Tech Stack
- **Vite** — dev server and bundler
- **Phaser 3** (latest) — game engine, renderer, Matter.js integration
- **Matter.js** — via Phaser's built-in plugin (no standalone wiring)
- No React, no external UI frameworks

### Canvas Resolution
Fixed at **1080×1920** (9:16). Phaser `ScaleManager` set to `FIT` with `CENTER_BOTH`. The game always runs at canonical resolution; browser window scales it. UI zones are proportional to canvas height, not fixed pixels.

### Dual Scene Architecture
Two Phaser scenes run simultaneously:

- **GameScene** — Matter.js world, physics bodies, racers, obstacles, camera. Contains no DOM elements.
- **UIScene** — Phaser `Graphics` + `Text` objects drawn on a transparent overlay canvas. Header, leaderboard, commentary, event banners, elimination cards, winner screen. Listens to EventBus.

Decoupling physics from UI means we can pause/swap either independently and avoid z-index fights.

### Module Structure
```
src/
  scenes/
    BootScene.js         asset preload, localStorage init
    GameScene.js         Matter world, racers, obstacles, camera
    UIScene.js           all overlay UI
  game/
    RaceManager.js       race lifecycle (prep → countdown → race → winner → intermission)
    TrackGenerator.js    seeded procedural track builder
    EventManager.js      central EventBus (mitt or custom)
    ScoreManager.js      today/all-time wins, race number, localStorage
    CommentaryManager.js event → commentary text with cooldowns/priority
    CameraManager.js     spectator camera state machine
    AudioManager.js      sound pool, background music
    ChaosEventManager.js random chaos events framework
  entities/
    CountryRacer.js      Matter circle body + sphere renderer + state
    Obstacle.js          base obstacle class
    Hole.js              sensor death zone
    TrackModule.js       reusable section template
  ui/
    Header.js            title, LIVE pill, race number
    Leaderboard.js       top-3 today, animated rank changes
    CommentaryPanel.js   scrolling commentary strip
    EventBanner.js       FINAL FIVE / chaos event announcements
    EliminationCard.js   eliminated country card
    WinnerScreen.js      winner celebration overlay
  data/
    countries.js         12 countries: name, flag emoji, stripe colors, accent color
    commentary.js        template strings per event type, 5+ per event
    obstacles.js         obstacle type definitions and parameter ranges
  utils/
    seededRandom.js      mulberry32 seeded PRNG
    eventBus.js          typed event emitter
```

---

## Screen Layout (Option A)

```
┌─────────────────────────────┐  ← 1080px wide
│   WORLD CHAOS RACING  🔴    │  11% — Header (dark gradient)
│   LIVE    RACE #042         │
├─────────────────────────────┤
│  🥇 🇮🇳 INDIA    18 WINS    │  14% — Leaderboard (top 3)
│  🥈 🇯🇵 JAPAN    15 WINS    │
│  🥉 🇧🇷 BRAZIL   12 WINS    │
├─────────────────────────────┤
│                             │
│                             │
│      ⚡ GAMEPLAY ⚡          │  ~57% — GameScene canvas
│                             │
│                             │
├─────────────────────────────┤
│  🚨 FINAL THREE!            │   7% — Event banner (dynamic)
├─────────────────────────────┤
│  🎙 "JAPAN IS IN TROUBLE!"  │   9% — Commentary strip
├─────────────────────────────┤
│  REMAINING: 3 / 12          │   6% — Count pill
└─────────────────────────────┘
```

Total static zones: ~97%. The Event Banner (7%) is dynamic — hidden during normal play, slides in on FINAL_N events and chaos events. At rest the commentary strip expands to fill its space.

---

## Country Racers

### Visual: 3D Sphere
Each racer is a Phaser `RenderTexture` baked once per country and reused:

1. **Stripe layer** — drawn using `Graphics.fillStyle` + `fillRect` clipped to circle, using flag colors
2. **Limb darkening** — `Graphics.fillStyle` radial gradient around edge, black at ~50% alpha
3. **Shadow** — bottom hemisphere darker overlay
4. **Specular highlight** — white radial at ~35%,28% (upper left), 55% alpha fading to 0
5. **Emoji** — rendered as `Text` object on top, does not rotate

**Rolling:** Each racer is a Phaser `Container` with layered children:
- **Child 0 — stripe graphics** (`Graphics`): rotates every frame to `body.angle`
- **Child 1 — limb shadow** (`Graphics`): fixed, always darkens the edge ring
- **Child 2 — bottom shadow** (`Graphics`): fixed at the bottom hemisphere, does not rotate
- **Child 3 — specular highlight** (`Graphics`): fixed at upper-left, does not rotate
- **Child 4 — emoji** (`Text`): fixed world-space rotation = 0

Only the stripe child rotates. The shading layers stay in place, creating the "glass ball rolling" effect.

### Countries (12)
| Flag | Country | Stripe Colors |
|---|---|---|
| 🇮🇳 | India | #FF9933 / #FFFFFF / #138808 |
| 🇺🇸 | USA | #B22234 / #FFFFFF / #3C3B6E |
| 🇯🇵 | Japan | #FFFFFF / #BC002D (dot) |
| 🇧🇷 | Brazil | #009C3B / #FEDF00 / #002776 |
| 🇩🇪 | Germany | #000000 / #DD0000 / #FFCE00 |
| 🇫🇷 | France | #0055A4 / #FFFFFF / #EF4135 |
| 🇬🇧 | UK | #012169 / #FFFFFF / #C8102E |
| 🇦🇺 | Australia | #00008B / #FFFFFF / #FF0000 |
| 🇨🇦 | Canada | #FF0000 / #FFFFFF / #FF0000 |
| 🇮🇹 | Italy | #009246 / #FFFFFF / #CE2B37 |
| 🇪🇸 | Spain | #AA151B / #F1BF00 / #AA151B |
| 🇦🇷 | Argentina | #74ACDF / #FFFFFF / #74ACDF |

### Physics Properties (Matter.js)
- Shape: circle, radius 36px (at 1080px canvas)
- Restitution: 0.4 (bouncy but not insane)
- Friction: 0.05
- FrictionAir: 0.01
- Density: 0.002
- Per-country variation: ±5% on density and restitution (seeded, not fixed per country)

---

## Physics World

- Gravity: `{ x: 0, y: 1.5 }` — downward, slightly stronger than default for satisfying falls
- World bounds: solid left/right/top walls. Bottom = death zone (off-screen)
- Collision categories: `RACER`, `WALL`, `PLATFORM`, `OBSTACLE`, `HOLE_SENSOR`, `DEATH_ZONE`
- Holes use Matter.js sensors — `isSensor: true`, detect overlap in `collisionStart`

---

## Track / Arena

### Procedural Generation (TrackGenerator)
Uses seeded PRNG. Combines 4–6 modules from this set:

| Module | Contents |
|---|---|
| Start | Wide platform, racers placed with random spread |
| Straight | Open fall zone, random scatter obstacles |
| HoleSection | 1–3 holes + guard platforms |
| SpinnerSection | 1–2 rotating bars |
| MovingWallSection | 1–2 horizontal/vertical moving walls |
| RampSection | Angled platform funnel |
| BounceSection | Bounce pads array |
| NarrowPassage | Two close walls forcing single file |
| FinalArena | Small platform, 1 large hole, everyone fights |

Module order is randomized but gated: Start always first, FinalArena always last, no two identical adjacent modules.

**Validation:** After generation, run a quick path-check: place a ghost point at start, simulate gravity, ensure it can reach the bottom without immediately dying. If not, regenerate (max 3 retries).

### Obstacle Types
| Type | Parameters randomized |
|---|---|
| Hole | x, width (40–140px), y position |
| RotatingBar | length, speed (±0.5–2 rad/s), direction, pivot position |
| MovingWall | axis (H/V), range, speed, start phase |
| BouncePad | x, strength (800–1400), width |
| Spinner | radius, speed, direction |
| Platform | x, y, width, angle (0° or ±15°) |

---

## Race Lifecycle (RaceManager)

```
PREPARATION → COUNTDOWN → RACING → ENDGAME → WINNER → INTERMISSION → loop
```

- **PREPARATION:** Generate seed, build track, place racers, set up physics
- **COUNTDOWN:** 3-2-1-GO animated overlay, physics paused
- **RACING:** Physics running, events firing, camera active
- **ENDGAME:** Triggered at 5/3/2 remaining — banner + camera tighten
- **WINNER:** Last racer standing. Slow-mo (timeScale 0.3 for 2s), confetti, winner card
- **INTERMISSION:** 4s scoreboard display, then auto-loop

---

## Event System (EventBus)

All game systems communicate through a typed EventBus (no direct coupling).

Key events:
```js
RACE_STARTED        { raceNumber, seed }
COUNTDOWN           { value }           // 3, 2, 1, 'GO'
COUNTRY_COLLISION   { a, b, force }
COUNTRY_NEAR_HOLE   { country, distance }
COUNTRY_BOUNCED     { country, strength }
COUNTRY_ELIMINATED  { country, obstacle, position, raceNumber, timestamp }
FINAL_N             { n }               // 10, 5, 3, 2
WINNER_DECLARED     { country, raceNumber }
CHAOS_EVENT         { type, duration }
RACE_ENDED          { winner, raceNumber }
```

---

## Camera System (CameraManager)

State machine with smooth `lerp` transitions (never snap).

| State | Trigger | Behavior |
|---|---|---|
| OVERVIEW | Default | Show full arena, all racers |
| ACTION | 2+ racers close together | Zoom to group centroid |
| DANGER | Racer within 80px of hole | Lead camera toward hole |
| ELIMINATION | COUNTRY_ELIMINATED fired | Follow falling racer for 1.2s |
| FINAL_THREE | 3 remain | Tighter frame around survivors |
| FINAL_TWO | 2 remain | Cinematic close frame |
| WINNER | WINNER_DECLARED | Center on winner, slow zoom in |

Camera never changes state more than once every 1.5s (debounced). Designed for 9:16 — pan is vertical-primary.

---

## Commentary System (CommentaryManager)

- Listens to EventBus
- Per-event template pool, 5+ templates each, random selection
- Cooldown: HIGH events min 3s apart, MEDIUM 6s, LOW 12s
- Priority queue: only highest-priority pending comment plays
- Outputs plain text string (ready for future TTS pipe)

Priority:
- HIGH: elimination, final two, winner, major danger
- MEDIUM: overtake, large collision, bounce
- LOW: minor collision, near-hole miss

### TTS Architecture (future-ready)
```js
interface ITextToSpeechProvider {
  speak(text: string, priority: number): void;
  cancel(): void;
  isReady(): boolean;
}
```
`CommentaryManager` calls `ttsProvider.speak()` if provider is set. No provider = text only. Queue ensures no overlap.

---

## Score & Persistence (ScoreManager)

localStorage keys:
- `wcr_race_number` — auto-incrementing integer
- `wcr_today_date` — ISO date string, resets today-wins when date changes
- `wcr_today_wins` — `{ countryId: count }` map
- `wcr_alltime_wins` — `{ countryId: count }` map

Leaderboard shows top 3 by today_wins. Animated on change (number count-up, row reorder).

---

## Chaos Events (ChaosEventManager)

Framework only in first build; events added per spec:
- Triggered randomly every 45–90s during a race (seeded timing)
- Show announcement banner → apply effect → restore after duration
- Effects modify Matter.js world params temporarily (gravity flip, speed boost, etc.)

---

## Audio (AudioManager)

Web Audio API via Phaser's SoundManager. Placeholder sounds for:
countdown beep, collision hit, bounce, elimination whoosh, winner fanfare, ambient hum.

No copyrighted music. Background: generated ambient tone or silence until user provides tracks.

---

## Debug Mode

Toggle with `D` key or URL param `?debug=1`.

Shows: FPS, race number, seed, active racer count, event queue, camera state, physics debug overlay.

Controls: Start Race, Pause, Skip Race, New Seed, Regenerate Track.

All debug UI hidden in Stream Mode.

---

## Stream Mode

Toggle with `S` key or URL param `?stream=1`.

Canvas output is designed to be captured by OBS Browser Source at 1080×1920. Only game, broadcast UI, leaderboard, commentary visible. All developer overlays hidden.

---

## Performance

- RenderTextures for racer tokens: baked once, reused every frame
- Object pooling for particles (pre-allocate 200 particles)
- Obstacle bodies destroyed on race end, not accumulated
- Matter.js body count kept under 50 per race
- No DOM manipulation during gameplay (UIScene uses Phaser objects only)
- Memory audit after every 10 races (development only)

---

## First Deliverable (Steps 1–2)

Per section 36 of original spec, the first shipped build includes:
- Vite + Phaser 3 project scaffolded
- 1080×1920 canvas with FIT scaling
- Polished broadcast UI shell (header, leaderboard zone, commentary zone, remaining count)
- 12 country racers with 3D sphere visuals
- Matter.js physics active
- Basic arena (walls, 2–3 platforms, 1–2 holes)
- Elimination via death zone
- Winner detection
- Basic camera (overview + winner zoom)
- Basic winner animation (glow + text)
- Race number persisted in localStorage
- Dark atmospheric visual style, no plain gray boxes

Remaining 7 steps added incrementally after first deliverable is tested.
