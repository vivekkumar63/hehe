# World Chaos Racing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished 1080×1920 vertical browser physics elimination race game that loops autonomously, suitable for YouTube Shorts live streaming.

**Architecture:** Phaser 3 + built-in Matter.js. Two concurrent scenes: GameScene (physics, racers, obstacles) and UIScene (broadcast overlay). All cross-system communication via a central EventBus. No React.

**Tech Stack:** Vite 5, Phaser 3.80+, Vitest (pure logic tests only — Phaser scenes are verified visually)

---

## File Map

```
index.html
vite.config.js
vitest.config.js
src/
  main.js                        Phaser game config + boot
  constants.js                   RACER_RADIUS, CANVAS_W/H, zone heights
  scenes/
    BootScene.js                 asset preload, texture generation, localStorage init
    GameScene.js                 Matter world, racers, obstacles, camera
    UIScene.js                   overlay: header, leaderboard, commentary, banners
  game/
    RaceManager.js               state machine: PREP→COUNTDOWN→RACING→WINNER→INTERMISSION
    TrackGenerator.js            seeded procedural arena builder
    CameraManager.js             spectator camera state machine
    CommentaryManager.js         event→text with priority/cooldown
    ScoreManager.js              localStorage: race#, today wins, all-time wins
    AudioManager.js              sound pool placeholder
    ChaosEventManager.js         random chaos event framework
  entities/
    CountryRacer.js              Matter circle + sphere visual (rotating stripes)
    Obstacle.js                  base class for all obstacles
    Hole.js                      Matter sensor death zone
  ui/
    Header.js                    title + LIVE pill + race number
    Leaderboard.js               top-3 today with animated updates
    CommentaryPanel.js           scrolling commentary strip
    EventBanner.js               FINAL N / chaos event announcements
    EliminationCard.js           elimination overlay card
    WinnerScreen.js              winner celebration
  data/
    countries.js                 12 countries with stripe colors
    commentary.js                5+ templates per event type
  utils/
    seededRandom.js              mulberry32 PRNG
    eventBus.js                  typed event emitter
tests/
  utils/seededRandom.test.js
  utils/eventBus.test.js
  game/ScoreManager.test.js
  game/CommentaryManager.test.js
```

---

## Phase 1 — Foundation

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `index.html`, `vite.config.js`, `vitest.config.js`, `src/main.js`, `src/constants.js`

- [ ] **Create package.json**

```json
{
  "name": "world-chaos-racing",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "phaser": "^3.80.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>World Chaos Racing</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
    }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Create vite.config.js**

```js
import { defineConfig } from 'vite';
export default defineConfig({ server: { port: 3000 } });
```

- [ ] **Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

- [ ] **Create src/constants.js**

```js
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

// Layout zones (px from top of canvas)
export const ZONE_HEADER_H    = Math.round(CANVAS_H * 0.11);  // 211
export const ZONE_BOARD_H     = Math.round(CANVAS_H * 0.14);  // 269
export const ZONE_GAME_Y      = ZONE_HEADER_H + ZONE_BOARD_H; // 480
export const ZONE_GAME_H      = Math.round(CANVAS_H * 0.57);  // 1094
export const ZONE_COMMENT_H   = Math.round(CANVAS_H * 0.09);  // 173
export const ZONE_REMAIN_H    = Math.round(CANVAS_H * 0.06);  // 115

export const RACER_RADIUS = 44;
export const GRAVITY_Y    = 2.5;
```

- [ ] **Create src/main.js**

```js
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from './constants.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene }   from './scenes/UIScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: '#08090f',
  parent: 'game-container',
  physics: {
    default: 'matter',
    matter: { gravity: { x: 0, y: 2.5 }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene, UIScene]
});
```

- [ ] **Install and verify**

```bash
cd C:/DLP_Repos/Hehe && npm install
```
Expected: `node_modules/phaser` present, no errors.

- [ ] **Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold Vite + Phaser 3 project"
```

---

### Task 2: Pure Utilities

**Files:**
- Create: `src/utils/seededRandom.js`, `src/utils/eventBus.js`
- Create: `tests/utils/seededRandom.test.js`, `tests/utils/eventBus.test.js`

- [ ] **Create src/utils/seededRandom.js**

```js
// mulberry32 seeded PRNG — same seed always produces same sequence
export function createRNG(seed) {
  let s = (seed >>> 0) || 1;
  function next() {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    between: (min, max) => min + next() * (max - min),
    intBetween: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  };
}
```

- [ ] **Write failing test: seededRandom**

```js
// tests/utils/seededRandom.test.js
import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/seededRandom.js';

describe('seededRandom', () => {
  it('same seed gives same sequence', () => {
    const a = createRNG(12345), b = createRNG(12345);
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
  });

  it('different seeds give different values', () => {
    expect(createRNG(1).next()).not.toBe(createRNG(2).next());
  });

  it('between stays in range', () => {
    const rng = createRNG(99);
    for (let i = 0; i < 200; i++) {
      const v = rng.between(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('pick returns element from array', () => {
    const rng = createRNG(7), arr = ['x','y','z'];
    for (let i = 0; i < 30; i++) expect(arr).toContain(rng.pick(arr));
  });

  it('shuffle contains same elements', () => {
    const rng = createRNG(3), arr = [1,2,3,4,5];
    expect(rng.shuffle(arr).sort()).toEqual([...arr].sort());
  });
});
```

- [ ] **Run test — expect FAIL (file missing)**

```bash
npm test -- tests/utils/seededRandom.test.js
```

- [ ] **Rerun after creating seededRandom.js — expect PASS**

```bash
npm test -- tests/utils/seededRandom.test.js
```
Expected: 5 tests pass.

- [ ] **Create src/utils/eventBus.js**

```js
const _map = {};

export const EventBus = {
  on(event, fn) {
    (_map[event] ??= []).push(fn);
    return () => this.off(event, fn);
  },
  off(event, fn) {
    _map[event] = (_map[event] ?? []).filter(f => f !== fn);
  },
  emit(event, data) {
    [...(_map[event] ?? [])].forEach(fn => fn(data));
  },
  clear() {
    Object.keys(_map).forEach(k => delete _map[k]);
  }
};
```

- [ ] **Write and run eventBus tests**

```js
// tests/utils/eventBus.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/utils/eventBus.js';

beforeEach(() => EventBus.clear());

describe('EventBus', () => {
  it('calls listener on emit', () => {
    const fn = vi.fn();
    EventBus.on('foo', fn);
    EventBus.emit('foo', { x: 1 });
    expect(fn).toHaveBeenCalledWith({ x: 1 });
  });

  it('does not call after off', () => {
    const fn = vi.fn();
    EventBus.on('foo', fn);
    EventBus.off('foo', fn);
    EventBus.emit('foo', {});
    expect(fn).not.toHaveBeenCalled();
  });

  it('on returns unsubscribe', () => {
    const fn = vi.fn();
    const unsub = EventBus.on('foo', fn);
    unsub();
    EventBus.emit('foo', {});
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not throw for unknown event', () => {
    expect(() => EventBus.emit('unknown', {})).not.toThrow();
  });
});
```

```bash
npm test -- tests/utils/eventBus.test.js
```
Expected: 4 tests pass.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: add seededRandom and EventBus utilities"
```

---

### Task 3: Data Layer

**Files:**
- Create: `src/data/countries.js`, `src/data/commentary.js`

- [ ] **Create src/data/countries.js**

```js
export const COUNTRIES = [
  { id: 'india',     name: 'INDIA',     emoji: '🇮🇳', stripes: ['#FF9933','#FFFFFF','#138808'], accent: '#FF9933' },
  { id: 'usa',       name: 'USA',       emoji: '🇺🇸', stripes: ['#B22234','#FFFFFF','#3C3B6E'], accent: '#3C3B6E' },
  { id: 'japan',     name: 'JAPAN',     emoji: '🇯🇵', stripes: ['#FFFFFF','#FFFFFF','#BC002D'], accent: '#BC002D' },
  { id: 'brazil',    name: 'BRAZIL',    emoji: '🇧🇷', stripes: ['#009C3B','#FEDF00','#002776'], accent: '#009C3B' },
  { id: 'germany',   name: 'GERMANY',   emoji: '🇩🇪', stripes: ['#000000','#DD0000','#FFCE00'], accent: '#FFCE00' },
  { id: 'france',    name: 'FRANCE',    emoji: '🇫🇷', stripes: ['#0055A4','#FFFFFF','#EF4135'], accent: '#EF4135' },
  { id: 'uk',        name: 'UK',        emoji: '🇬🇧', stripes: ['#012169','#FFFFFF','#C8102E'], accent: '#C8102E' },
  { id: 'australia', name: 'AUSTRALIA', emoji: '🇦🇺', stripes: ['#00008B','#FFFFFF','#FF0000'], accent: '#FF0000' },
  { id: 'canada',    name: 'CANADA',    emoji: '🇨🇦', stripes: ['#FF0000','#FFFFFF','#FF0000'], accent: '#FF0000' },
  { id: 'italy',     name: 'ITALY',     emoji: '🇮🇹', stripes: ['#009246','#FFFFFF','#CE2B37'], accent: '#CE2B37' },
  { id: 'spain',     name: 'SPAIN',     emoji: '🇪🇸', stripes: ['#AA151B','#F1BF00','#AA151B'], accent: '#F1BF00' },
  { id: 'argentina', name: 'ARGENTINA', emoji: '🇦🇷', stripes: ['#74ACDF','#FFFFFF','#74ACDF'], accent: '#74ACDF' },
];
```

- [ ] **Create src/data/commentary.js**

```js
export const COMMENTARY = {
  RACE_START: [
    'AND WE ARE OFF!',
    'THE CHAOS HAS BEGUN!',
    'TWELVE NATIONS ENTER — ONE WILL SURVIVE!',
    'LET THE MADNESS BEGIN!',
    "IT'S ANYONE'S RACE!"
  ],
  DANGER: [
    '{country} IS HEADING STRAIGHT FOR THE HOLE!',
    '{country} IS IN SERIOUS TROUBLE!',
    'WATCH OUT {country}!',
    '{country} ON THE EDGE — THIS COULD BE IT!',
    'DANGER! {country} IS BARELY HOLDING ON!'
  ],
  COLLISION: [
    'BIG COLLISION!',
    'THEY CRASH INTO EACH OTHER!',
    'MASSIVE IMPACT!',
    'BODIES FLYING EVERYWHERE!',
    '{country} TAKES A HIT!'
  ],
  BOUNCED: [
    '{country} GETS LAUNCHED!',
    'WHAT A BOUNCE FOR {country}!',
    '{country} IS AIRBORNE!',
    'THE PAD SENDS {country} FLYING!'
  ],
  ELIMINATED: [
    'OH NO! {country} IS OUT!',
    '{country} COULDN\'T SURVIVE!',
    'DOWN GOES {country}!',
    '{country} HAS BEEN ELIMINATED!',
    'AND THAT IS THE END FOR {country}!'
  ],
  FINAL_5: [
    'FINAL FIVE! WHO WILL MAKE IT?',
    'ONLY FIVE REMAIN — IT\'S GETTING TENSE!',
    'THE FINAL FIVE ARE FIGHTING FOR SURVIVAL!'
  ],
  FINAL_3: [
    'WE ARE DOWN TO THE FINAL THREE!',
    'THREE NATIONS LEFT — THE END IS NEAR!',
    'FINAL THREE! ANYTHING CAN HAPPEN!'
  ],
  FINAL_2: [
    'THIS IS IT! ONLY TWO COUNTRIES REMAIN!',
    'HEAD TO HEAD — THE FINAL SHOWDOWN!',
    'TWO LEFT! WHO TAKES THE CROWN?'
  ],
  WINNER: [
    'AND {country} WINS WORLD CHAOS RACING!',
    '{country} IS THE LAST ONE STANDING!',
    'INCREDIBLE! {country} TAKES IT ALL!',
    '{country} WINS! WHAT A RACE!',
    'THE CHAMPION IS {country}!'
  ]
};
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: add countries data and commentary templates"
```

---

### Task 4: ScoreManager

**Files:**
- Create: `src/game/ScoreManager.js`, `tests/game/ScoreManager.test.js`

- [ ] **Write failing tests**

```js
// tests/game/ScoreManager.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const store = {};
vi.stubGlobal('localStorage', {
  getItem:    (k) => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
});

// Reset store before each test
beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

import { ScoreManager } from '../../src/game/ScoreManager.js';

describe('ScoreManager', () => {
  it('race number starts at 1 on fresh install', () => {
    const sm = new ScoreManager();
    expect(sm.getRaceNumber()).toBe(1);
  });

  it('race number increments and persists', () => {
    const sm = new ScoreManager();
    sm.nextRace();
    sm.nextRace();
    expect(sm.getRaceNumber()).toBe(3);
    // Reload
    const sm2 = new ScoreManager();
    expect(sm2.getRaceNumber()).toBe(3);
  });

  it('recordWin increments today and alltime', () => {
    const sm = new ScoreManager();
    sm.recordWin('india');
    sm.recordWin('india');
    sm.recordWin('japan');
    expect(sm.getTodayWins('india')).toBe(2);
    expect(sm.getTodayWins('japan')).toBe(1);
    expect(sm.getAllTimeWins('india')).toBe(2);
  });

  it('getTopToday returns top 3 sorted', () => {
    const sm = new ScoreManager();
    sm.recordWin('india'); sm.recordWin('india'); sm.recordWin('india');
    sm.recordWin('japan'); sm.recordWin('japan');
    sm.recordWin('brazil');
    const top = sm.getTopToday(3);
    expect(top[0].id).toBe('india');
    expect(top[1].id).toBe('japan');
    expect(top[2].id).toBe('brazil');
  });
});
```

```bash
npm test -- tests/game/ScoreManager.test.js
```
Expected: FAIL (file not created yet).

- [ ] **Create src/game/ScoreManager.js**

```js
const KEYS = {
  race:    'wcr_race_number',
  date:    'wcr_today_date',
  today:   'wcr_today_wins',
  alltime: 'wcr_alltime_wins'
};

export class ScoreManager {
  constructor() {
    this._checkDateReset();
  }

  _checkDateReset() {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(KEYS.date) !== today) {
      localStorage.setItem(KEYS.date, today);
      localStorage.setItem(KEYS.today, JSON.stringify({}));
    }
  }

  _load(key) {
    try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
  }

  _save(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }

  getRaceNumber() {
    return parseInt(localStorage.getItem(KEYS.race) ?? '1', 10);
  }

  nextRace() {
    localStorage.setItem(KEYS.race, String(this.getRaceNumber() + 1));
    return this.getRaceNumber();
  }

  recordWin(countryId) {
    const today   = this._load(KEYS.today);
    const alltime = this._load(KEYS.alltime);
    today[countryId]   = (today[countryId]   ?? 0) + 1;
    alltime[countryId] = (alltime[countryId] ?? 0) + 1;
    this._save(KEYS.today,   today);
    this._save(KEYS.alltime, alltime);
  }

  getTodayWins(id)   { return this._load(KEYS.today)[id]   ?? 0; }
  getAllTimeWins(id)  { return this._load(KEYS.alltime)[id] ?? 0; }

  getTopToday(n = 3) {
    const today = this._load(KEYS.today);
    return Object.entries(today)
      .map(([id, wins]) => ({ id, wins }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, n);
  }
}
```

- [ ] **Run tests — expect PASS**

```bash
npm test -- tests/game/ScoreManager.test.js
```
Expected: 4 tests pass.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: add ScoreManager with localStorage persistence"
```

---

## Phase 2 — Core Physics Game

### Task 5: Phaser Scenes Shell + Arena

**Files:**
- Create: `src/scenes/BootScene.js`, `src/scenes/GameScene.js`, `src/scenes/UIScene.js`

- [ ] **Create src/scenes/BootScene.js**

```js
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, RACER_RADIUS } from '../constants.js';
import { COUNTRIES } from '../data/countries.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    this._generateSphereShading();
    COUNTRIES.forEach(c => this._generateStripeTexture(c));
    this.scene.start('GameScene');
  }

  _generateStripeTexture(country) {
    const d = RACER_RADIUS * 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = d;
    const ctx = cv.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.arc(RACER_RADIUS, RACER_RADIUS, RACER_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    const h = d / country.stripes.length;
    country.stripes.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, i * h, d, h);
    });
    ctx.restore();
    this.textures.addCanvas(`stripe_${country.id}`, cv);
  }

  _generateSphereShading() {
    const d = RACER_RADIUS * 2;
    const r = RACER_RADIUS;
    const cv = document.createElement('canvas');
    cv.width = cv.height = d;
    const ctx = cv.getContext('2d');

    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.clip();

    // Limb darkening (edge ring)
    const limb = ctx.createRadialGradient(r, r, r * 0.55, r, r, r);
    limb.addColorStop(0, 'rgba(0,0,0,0)');
    limb.addColorStop(0.85, 'rgba(0,0,0,0)');
    limb.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = limb;
    ctx.fillRect(0, 0, d, d);

    // Bottom shadow
    const shadow = ctx.createRadialGradient(r, r * 1.55, 0, r, r * 1.55, r * 0.95);
    shadow.addColorStop(0, 'rgba(0,0,0,0.5)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, d, d);

    // Specular highlight
    const spec = ctx.createRadialGradient(r * 0.62, r * 0.38, 0, r * 0.62, r * 0.38, r * 0.65);
    spec.addColorStop(0, 'rgba(255,255,255,0.58)');
    spec.addColorStop(0.45, 'rgba(255,255,255,0.10)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fillRect(0, 0, d, d);

    ctx.restore();
    this.textures.addCanvas('sphere_shading', cv);
  }
}
```

- [ ] **Create src/scenes/GameScene.js** (shell — arena only, no racers yet)

```js
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ZONE_GAME_Y, ZONE_GAME_H } from '../constants.js';
import { EventBus } from '../utils/eventBus.js';

const WALL_T = 20;

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.scene.launch('UIScene');
    this._buildArena();
    this._drawArenaBackground();
  }

  _buildArena() {
    const w = CANVAS_W, y0 = ZONE_GAME_Y, h = ZONE_GAME_H;

    // World bounds — only game zone, not full canvas
    this.matter.world.setBounds(0, y0, w, h, WALL_T);

    // Death zone sensor at bottom
    this.deathZone = this.matter.add.rectangle(
      w / 2, y0 + h + 30, w, 60,
      { isStatic: true, isSensor: true, label: 'death_zone' }
    );

    // Static floor platforms (basic arena for first deliverable)
    this._addPlatform(w * 0.1, y0 + h * 0.3, w * 0.35, 18);
    this._addPlatform(w * 0.55, y0 + h * 0.3, w * 0.35, 18);
    this._addPlatform(w * 0.05, y0 + h * 0.6, w * 0.4, 18);
    this._addPlatform(w * 0.55, y0 + h * 0.6, w * 0.4, 18);
  }

  _addPlatform(x, y, width, height) {
    this.matter.add.rectangle(x + width / 2, y, width, height, {
      isStatic: true, label: 'platform',
      render: { fillColor: 0x334466 }
    });
    // Draw it visually
    const g = this.add.graphics();
    g.fillStyle(0x2244aa, 1);
    g.fillRect(x, y - height / 2, width, height);
    g.fillStyle(0x4488ff, 0.4);
    g.fillRect(x, y - height / 2, width, 3);
  }

  _drawArenaBackground() {
    const g = this.add.graphics();
    const y0 = ZONE_GAME_Y, h = ZONE_GAME_H, w = CANVAS_W;

    // Dark gradient arena background
    g.fillGradientStyle(0x0a0a1e, 0x0a0a1e, 0x0d1030, 0x0d1030, 1);
    g.fillRect(0, y0, w, h);

    // Subtle grid lines
    g.lineStyle(1, 0x1a2040, 0.3);
    for (let gy = y0; gy < y0 + h; gy += 80) {
      g.strokeLineShape(new Phaser.Geom.Line(0, gy, w, gy));
    }
    for (let gx = 0; gx < w; gx += 80) {
      g.strokeLineShape(new Phaser.Geom.Line(gx, y0, gx, y0 + h));
    }

    // Arena border glow
    g.lineStyle(3, 0x2244aa, 0.8);
    g.strokeRect(WALL_T, y0, w - WALL_T * 2, h);
  }
}
```

- [ ] **Create src/scenes/UIScene.js** (minimal shell)

```js
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ZONE_HEADER_H, ZONE_BOARD_H, ZONE_GAME_Y } from '../constants.js';

export class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene', active: false }); }

  create() {
    this._drawHeader();
    this._drawLeaderboardZone();
    this._drawCommentaryZone();
  }

  _drawHeader() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0d0820, 0x0d0820, 0x1a0f3a, 0x1a0f3a, 1);
    g.fillRect(0, 0, CANVAS_W, ZONE_HEADER_H);
    g.lineStyle(2, 0x4422aa, 0.8);
    g.strokeRect(0, 0, CANVAS_W, ZONE_HEADER_H);

    this.add.text(CANVAS_W / 2, ZONE_HEADER_H * 0.4, 'WORLD CHAOS RACING', {
      fontSize: '64px', fontFamily: 'Arial Black, Impact, sans-serif',
      color: '#ffffff', stroke: '#4422aa', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#8844ff', blur: 20, fill: true }
    }).setOrigin(0.5);

    // LIVE pill
    const liveText = this.add.text(80, ZONE_HEADER_H * 0.78, '🔴  LIVE', {
      fontSize: '32px', fontFamily: 'Arial, sans-serif', color: '#ff4444',
      backgroundColor: '#330000', padding: { x: 12, y: 4 }
    }).setOrigin(0, 0.5);

    this.raceNumText = this.add.text(CANVAS_W - 80, ZONE_HEADER_H * 0.78, 'RACE #001', {
      fontSize: '32px', fontFamily: 'Arial Black, sans-serif', color: '#aaaaff'
    }).setOrigin(1, 0.5);
  }

  _drawLeaderboardZone() {
    const y = ZONE_HEADER_H;
    const h = ZONE_BOARD_H;
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a1520, 0x0a1520, 0x0f1f10, 0x0f1f10, 1);
    g.fillRect(0, y, CANVAS_W, h);
    g.lineStyle(1, 0x2a4a2a, 0.6);
    g.strokeRect(0, y, CANVAS_W, h);

    this.add.text(CANVAS_W / 2, y + 20, "🏆 TODAY'S CHAMPIONS", {
      fontSize: '28px', fontFamily: 'Arial Black, sans-serif', color: '#88cc44'
    }).setOrigin(0.5, 0);

    // Placeholder rows — replaced once ScoreManager wired in Task 11
    this.leaderboardRows = [];
    const medals = ['🥇','🥈','🥉'];
    for (let i = 0; i < 3; i++) {
      const rowY = y + 56 + i * 60;
      const t = this.add.text(60, rowY, `${medals[i]}  —`, {
        fontSize: '36px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
      }).setOrigin(0, 0.5);
      this.leaderboardRows.push(t);
    }
  }

  _drawCommentaryZone() {
    const y = CANVAS_H - Math.round(CANVAS_H * 0.15);
    const g = this.add.graphics();
    g.fillGradientStyle(0x08080f, 0x08080f, 0x0f0f1a, 0x0f0f1a, 1);
    g.fillRect(0, y, CANVAS_W, CANVAS_H - y);
    g.lineStyle(1, 0x223, 0.8);
    g.strokeRect(0, y, CANVAS_W, CANVAS_H - y);

    this.add.text(40, y + 18, '🎙  LIVE COMMENTARY', {
      fontSize: '26px', fontFamily: 'Arial Black, sans-serif', color: '#5566aa'
    });

    this.commentaryText = this.add.text(CANVAS_W / 2, y + 80, '', {
      fontSize: '38px', fontFamily: 'Arial, sans-serif', color: '#ddeeff',
      wordWrap: { width: CANVAS_W - 80 }, align: 'center'
    }).setOrigin(0.5, 0);

    this.remainText = this.add.text(CANVAS_W / 2, CANVAS_H - 40, 'REMAINING: 12 / 12', {
      fontSize: '32px', fontFamily: 'Arial Black, sans-serif', color: '#cc88ff'
    }).setOrigin(0.5, 1);
  }

  setRaceNumber(n) {
    if (this.raceNumText) this.raceNumText.setText(`RACE #${String(n).padStart(3, '0')}`);
  }

  setCommentary(text) {
    if (this.commentaryText) this.commentaryText.setText(`"${text}"`);
  }

  setRemaining(current, total) {
    if (this.remainText) this.remainText.setText(`REMAINING: ${current} / ${total}`);
  }
}
```

- [ ] **Run dev server and verify visually**

```bash
npm run dev
```
Open http://localhost:3000. Expected: dark 9:16 canvas with header ("WORLD CHAOS RACING"), leaderboard zone, arena with grid + platforms, commentary zone at bottom. No physics yet.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: Phaser scenes shell with arena and broadcast UI zones"
```

---

### Task 6: Country Racer Entity

**Files:**
- Create: `src/entities/CountryRacer.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Create src/entities/CountryRacer.js**

```js
import Phaser from 'phaser';
import { RACER_RADIUS } from '../constants.js';

export class CountryRacer {
  constructor(scene, country, x, y, physicsVariation = 1.0) {
    this.scene    = scene;
    this.country  = country;
    this.alive    = true;
    this._radius  = RACER_RADIUS;

    // Matter.js physics body
    this.body = scene.matter.add.circle(x, y, RACER_RADIUS, {
      restitution: 0.4 * physicsVariation,
      friction:    0.05,
      frictionAir: 0.008,
      density:     0.002 * physicsVariation,
      label:       `racer_${country.id}`,
      collisionFilter: { category: 0x0001, mask: 0xFFFF }
    });

    // Visuals — layered on GameScene
    const d = RACER_RADIUS * 2;

    // Stripe image (rotates with body)
    this.stripeImg = scene.add.image(x, y, `stripe_${country.id}`)
      .setDisplaySize(d, d)
      .setDepth(10);

    // Shading overlay (fixed rotation)
    this.shadingImg = scene.add.image(x, y, 'sphere_shading')
      .setDisplaySize(d, d)
      .setDepth(11);

    // Country name label
    this.label = scene.add.text(x, y + RACER_RADIUS + 14, country.name, {
      fontSize: '22px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(12);

    // Outer glow ring
    this.glow = scene.add.graphics().setDepth(9);
    this._drawGlow(x, y);
  }

  _drawGlow(x, y) {
    this.glow.clear();
    this.glow.lineStyle(3, parseInt(this.country.accent.replace('#',''), 16), 0.7);
    this.glow.strokeCircle(x, y, this._radius + 4);
  }

  update() {
    if (!this.alive) return;
    const { x, y } = this.body.position;
    const angle     = this.body.angle;

    this.stripeImg.setPosition(x, y).setRotation(angle);
    this.shadingImg.setPosition(x, y);
    this.label.setPosition(x, y + this._radius + 14);
    this._drawGlow(x, y);
  }

  eliminate() {
    this.alive = false;
    // Fade out
    this.scene.tweens.add({
      targets: [this.stripeImg, this.shadingImg, this.label, this.glow],
      alpha: 0, duration: 600, ease: 'Power2',
      onComplete: () => this.destroy()
    });
  }

  destroy() {
    this.scene.matter.world.remove(this.body);
    [this.stripeImg, this.shadingImg, this.label, this.glow].forEach(o => o?.destroy());
  }
}
```

- [ ] **Add racer spawning to GameScene — add these methods and call in create()**

In `src/scenes/GameScene.js`, add after `_buildArena()` call in `create()`:

```js
// At top of file, add imports:
import { COUNTRIES } from '../data/countries.js';
import { CountryRacer } from '../entities/CountryRacer.js';
import { createRNG } from '../utils/seededRandom.js';
import { RACER_RADIUS } from '../constants.js';

// In create(), after _buildArena():
this._spawnRacers();

// New methods:
_spawnRacers() {
  const rng  = createRNG(Date.now());
  const y0   = ZONE_GAME_Y;
  const spawnY = y0 + 80;
  this.racers = [];

  COUNTRIES.forEach((country, i) => {
    const col   = i % 6;
    const row   = Math.floor(i / 6);
    const x     = 120 + col * 140 + rng.between(-20, 20);
    const y     = spawnY + row * 100 + rng.between(-10, 10);
    const vary  = rng.between(0.95, 1.05);
    const racer = new CountryRacer(this, country, x, y, vary);
    this.racers.push(racer);
  });
}

update() {
  this.racers?.forEach(r => r.update());
}
```

- [ ] **Verify visually**

```bash
npm run dev
```
Open http://localhost:3000. Expected: 12 flag-stripe spheres with glow rings visible in arena, sitting on platforms. Spheres have specular highlight making them look 3D.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: CountryRacer entity with 3D sphere visual and Matter body"
```

---

### Task 7: Holes + Elimination

**Files:**
- Create: `src/entities/Hole.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Create src/entities/Hole.js**

```js
import Phaser from 'phaser';

export class Hole {
  constructor(scene, x, y, width) {
    this.scene = scene;
    this.width = width;

    // Sensor body — detects overlap without physical collision
    this.body = scene.matter.add.rectangle(x, y, width, 20, {
      isStatic: true, isSensor: true, label: 'hole'
    });

    this._drawVisual(scene, x, y, width);
  }

  _drawVisual(scene, x, y, width) {
    const g = scene.add.graphics().setDepth(5);

    // Dark pit
    g.fillStyle(0x000000, 0.95);
    g.fillRect(x - width / 2, y - 24, width, 48);

    // Red danger glow around edge
    g.lineStyle(3, 0xff2200, 0.9);
    g.strokeRect(x - width / 2, y - 24, width, 48);

    // Animated warning stripes (static visual)
    const stripeW = 16;
    for (let sx = x - width / 2; sx < x + width / 2; sx += stripeW * 2) {
      g.fillStyle(0xff2200, 0.35);
      g.fillRect(sx, y - 24, stripeW, 48);
    }

    // "HOLE" label
    scene.add.text(x, y, '☠', {
      fontSize: '28px', color: '#ff4400'
    }).setOrigin(0.5).setDepth(6);
  }
}
```

- [ ] **Wire up elimination detection in GameScene — add to create() and add handler methods**

In `src/scenes/GameScene.js`, add to `create()` after `_spawnRacers()`:

```js
import { Hole } from '../entities/Hole.js';
import { EventBus } from '../utils/eventBus.js';

// In create():
this._addHoles();
this._setupCollisions();
this.eliminatedCount = 0;

// New methods:
_addHoles() {
  this.holes = [
    new Hole(this, CANVAS_W * 0.3, ZONE_GAME_Y + ZONE_GAME_H * 0.5, 140),
    new Hole(this, CANVAS_W * 0.7, ZONE_GAME_Y + ZONE_GAME_H * 0.5, 140),
  ];
}

_setupCollisions() {
  this.matter.world.on('collisionstart', (event) => {
    event.pairs.forEach(({ bodyA, bodyB }) => {
      this._checkElimination(bodyA, bodyB);
      this._checkElimination(bodyB, bodyA);
    });
  });
}

_checkElimination(maybeRacer, maybeTrigger) {
  if (!maybeRacer.label?.startsWith('racer_')) return;
  if (maybeTrigger.label !== 'hole' && maybeTrigger.label !== 'death_zone') return;

  const racer = this.racers.find(r => r.body === maybeRacer && r.alive);
  if (!racer) return;

  racer.eliminate();
  this.eliminatedCount++;

  const remaining = this.racers.filter(r => r.alive).length;
  EventBus.emit('COUNTRY_ELIMINATED', {
    country: racer.country,
    remaining,
    total: this.racers.length
  });

  // Check winner
  if (remaining === 1) {
    const winner = this.racers.find(r => r.alive);
    EventBus.emit('WINNER_DECLARED', { country: winner.country });
  }
}
```

- [ ] **Verify visually**

```bash
npm run dev
```
Expected: Holes visible with red glow. Balls that fall into holes disappear with fade. Browser console shows `COUNTRY_ELIMINATED` events.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: Hole sensor entities and elimination detection via EventBus"
```

---

### Task 8: RaceManager — Full Lifecycle

**Files:**
- Create: `src/game/RaceManager.js`
- Modify: `src/scenes/GameScene.js`, `src/scenes/UIScene.js`

- [ ] **Create src/game/RaceManager.js**

```js
import { EventBus } from '../utils/eventBus.js';
import { ScoreManager } from './ScoreManager.js';

const STATES = { PREP: 'PREP', COUNTDOWN: 'COUNTDOWN', RACING: 'RACING', WINNER: 'WINNER', INTERMISSION: 'INTERMISSION' };

export class RaceManager {
  constructor(scene) {
    this.scene  = scene;
    this.scores = new ScoreManager();
    this.state  = STATES.PREP;
    this._unsubs = [];
  }

  start() {
    this._unsubs.push(
      EventBus.on('COUNTRY_ELIMINATED', d => this._onEliminated(d)),
      EventBus.on('WINNER_DECLARED',    d => this._onWinner(d))
    );
    this._beginPrep();
  }

  _beginPrep() {
    this.state = STATES.PREP;
    this.raceNumber = this.scores.getRaceNumber();
    EventBus.emit('RACE_PREP', { raceNumber: this.raceNumber });
    // Short delay then countdown
    this.scene.time.delayedCall(800, () => this._beginCountdown());
  }

  _beginCountdown() {
    this.state = STATES.COUNTDOWN;
    const steps = [3, 2, 1, 'GO!'];
    let i = 0;
    const tick = () => {
      EventBus.emit('COUNTDOWN', { value: steps[i] });
      i++;
      if (i < steps.length) {
        this.scene.time.delayedCall(900, tick);
      } else {
        this.scene.time.delayedCall(400, () => this._beginRacing());
      }
    };
    tick();
  }

  _beginRacing() {
    this.state = STATES.RACING;
    EventBus.emit('RACE_STARTED', { raceNumber: this.raceNumber });
  }

  _onEliminated({ country, remaining }) {
    if (this.state !== STATES.RACING) return;
    if ([5, 3, 2].includes(remaining)) {
      EventBus.emit('FINAL_N', { n: remaining });
    }
  }

  _onWinner({ country }) {
    if (this.state !== STATES.RACING) return;
    this.state = STATES.WINNER;
    this.scores.recordWin(country.id);
    this.scores.nextRace();
    EventBus.emit('WINNER_CELEBRATED', {
      country,
      raceNumber: this.raceNumber,
      todayWins: this.scores.getTodayWins(country.id)
    });
    this.scene.time.delayedCall(5000, () => this._beginIntermission());
  }

  _beginIntermission() {
    this.state = STATES.INTERMISSION;
    EventBus.emit('INTERMISSION_START', {});
    this.scene.time.delayedCall(4000, () => {
      EventBus.emit('INTERMISSION_END', {});
      this._unsubs.forEach(u => u());
      this._unsubs = [];
      // Restart — scene handles actual restart
      EventBus.emit('RACE_RESTART', {});
    });
  }

  isPhysicsActive() { return this.state === STATES.RACING; }
}
```

- [ ] **Wire RaceManager into GameScene**

In `src/scenes/GameScene.js`, add to imports and `create()`:

```js
import { RaceManager } from '../game/RaceManager.js';

// In create(), replace hardcoded spawn with:
this.raceManager = new RaceManager(this);

// Pause physics until GO
this.matter.world.enabled = false;

// Listen for race events
this._unsubs = [
  EventBus.on('RACE_STARTED',  () => { this.matter.world.enabled = true; }),
  EventBus.on('WINNER_CELEBRATED', () => { this.matter.world.timeScale = 0.3; }),
  EventBus.on('RACE_RESTART',  () => this.scene.restart())
];

this.raceManager.start();
```

- [ ] **Add countdown overlay to UIScene**

In `src/scenes/UIScene.js`, in `create()`:

```js
import { EventBus } from '../utils/eventBus.js';
import { ZONE_GAME_Y, ZONE_GAME_H, CANVAS_W } from '../constants.js';

// In create():
this._setupEventListeners();

// New method:
_setupEventListeners() {
  EventBus.on('COUNTDOWN', ({ value }) => this._showCountdown(value));
  EventBus.on('RACE_PREP', ({ raceNumber }) => this.setRaceNumber(raceNumber));
  EventBus.on('COUNTRY_ELIMINATED', ({ country, remaining, total }) => {
    this.setRemaining(remaining, total);
  });
  EventBus.on('WINNER_CELEBRATED', ({ country }) => this._showWinner(country));
  EventBus.on('FINAL_N', ({ n }) => this._showFinalN(n));
}

_showCountdown(value) {
  const cx = CANVAS_W / 2;
  const cy = ZONE_GAME_Y + ZONE_GAME_H / 2;
  const isGo = value === 'GO!';

  const txt = this.add.text(cx, cy, String(value), {
    fontSize: isGo ? '180px' : '220px',
    fontFamily: 'Arial Black, Impact, sans-serif',
    color: isGo ? '#44ff88' : '#ffffff',
    stroke: isGo ? '#006622' : '#330066',
    strokeThickness: 12,
    shadow: { offsetX: 0, offsetY: 0, color: isGo ? '#00ff44' : '#8844ff', blur: 40, fill: true }
  }).setOrigin(0.5).setDepth(100).setAlpha(0);

  this.tweens.add({
    targets: txt, alpha: 1, scaleX: 1.3, scaleY: 1.3,
    duration: 200, ease: 'Back.out',
    onComplete: () => {
      this.tweens.add({
        targets: txt, alpha: 0, scaleX: 0.8, scaleY: 0.8,
        duration: 500, delay: isGo ? 300 : 500,
        onComplete: () => txt.destroy()
      });
    }
  });
}

_showFinalN(n) {
  const labels = { 5: 'FINAL FIVE!', 3: 'FINAL THREE!', 2: 'FINAL TWO!' };
  const colors = { 5: '#ffaa00', 3: '#ff6600', 2: '#ff2200' };
  const msg = labels[n] ?? `FINAL ${n}!`;
  const txt = this.add.text(CANVAS_W / 2, ZONE_GAME_Y + ZONE_GAME_H * 0.15, msg, {
    fontSize: '96px', fontFamily: 'Arial Black, sans-serif',
    color: colors[n] ?? '#ff4400',
    stroke: '#000', strokeThickness: 8,
    shadow: { color: colors[n] ?? '#ff4400', blur: 30, fill: true }
  }).setOrigin(0.5).setDepth(90).setAlpha(0);

  this.tweens.chain({ targets: txt, tweens: [
    { alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 300, ease: 'Back.out' },
    { alpha: 1, duration: 1500 },
    { alpha: 0, duration: 400, onComplete: () => txt.destroy() }
  ]});
}

_showWinner(country) {
  const cx = CANVAS_W / 2;
  const cy = ZONE_GAME_Y + ZONE_GAME_H * 0.4;

  // Dark overlay
  const overlay = this.add.graphics().setDepth(98);
  overlay.fillStyle(0x000000, 0.65);
  overlay.fillRect(0, ZONE_GAME_Y, CANVAS_W, ZONE_GAME_H);

  this.add.text(cx, cy - 80, '🏆  WINNER', {
    fontSize: '90px', fontFamily: 'Arial Black, sans-serif',
    color: '#ffdd00', stroke: '#885500', strokeThickness: 8,
    shadow: { color: '#ffaa00', blur: 40, fill: true }
  }).setOrigin(0.5).setDepth(99);

  this.add.text(cx, cy + 40, country.emoji + '  ' + country.name, {
    fontSize: '110px', fontFamily: 'Arial Black, sans-serif',
    color: '#ffffff', stroke: '#000000', strokeThickness: 6
  }).setOrigin(0.5).setDepth(99);
}
```

- [ ] **Verify full race loop visually**

```bash
npm run dev
```
Expected: Countdown (3-2-1-GO!), physics starts, balls fall, holes eliminate balls, winner screen appears, then scene restarts.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: RaceManager lifecycle — countdown, racing, winner, restart"
```

---

## Phase 3 — Camera & Visual Polish

### Task 9: CameraManager

**Files:**
- Create: `src/game/CameraManager.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Create src/game/CameraManager.js**

```js
import { CANVAS_W, CANVAS_H, ZONE_GAME_Y, ZONE_GAME_H } from '../constants.js';

const MODES = { OVERVIEW: 0, ACTION: 1, DANGER: 2, ELIMINATION: 3, FINAL_THREE: 4, FINAL_TWO: 5, WINNER: 6 };
const MODE_COOLDOWN = 1500; // ms

export class CameraManager {
  constructor(scene) {
    this.scene       = scene;
    this.cam         = scene.cameras.main;
    this.mode        = MODES.OVERVIEW;
    this._lastSwitch = 0;
    this._lockUntil  = 0;

    // Keep camera centered in game zone by default
    this.cam.setBounds(0, 0, CANVAS_W, CANVAS_H);
    this._setOverview();
  }

  update(racers, time) {
    if (time < this._lockUntil) return;
    if (time - this._lastSwitch < MODE_COOLDOWN) return;

    const alive = racers.filter(r => r.alive);
    if (alive.length === 0) return;

    if (alive.length <= 2)       { this._setMode(MODES.FINAL_TWO,   alive, time); return; }
    if (alive.length <= 3)       { this._setMode(MODES.FINAL_THREE, alive, time); return; }

    const nearHole = this._findNearHole(alive);
    if (nearHole)                { this._setDanger(nearHole, time); return; }

    const cluster = this._findCluster(alive);
    if (cluster)                 { this._setAction(cluster, time); return; }

    this._setOverview();
  }

  _findNearHole(alive) {
    const holes = this.scene.holes ?? [];
    for (const r of alive) {
      for (const h of holes) {
        const hx = h.body.position.x, hy = h.body.position.y;
        const dx = r.body.position.x - hx, dy = r.body.position.y - hy;
        if (Math.sqrt(dx*dx + dy*dy) < 120) return r;
      }
    }
    return null;
  }

  _findCluster(alive) {
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i].body.position, b = alive[j].body.position;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 160) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    }
    return null;
  }

  _setOverview() {
    this.cam.pan(CANVAS_W / 2, CANVAS_H / 2, 600, 'Sine.easeInOut');
    this.cam.zoomTo(1, 600, 'Sine.easeInOut');
  }

  _setDanger(racer, time) {
    this._setMode(MODES.DANGER, null, time);
    const { x, y } = racer.body.position;
    this.cam.pan(x, y, 400, 'Sine.easeInOut');
    this.cam.zoomTo(1.4, 400, 'Sine.easeInOut');
  }

  _setAction(cluster, time) {
    this._switchMode(MODES.ACTION, time);
    this.cam.pan(cluster.x, cluster.y, 500, 'Sine.easeInOut');
    this.cam.zoomTo(1.2, 500, 'Sine.easeInOut');
  }

  _setMode(mode, targets, time) {
    this._switchMode(mode, time);
    if (mode === MODES.FINAL_TWO || mode === MODES.FINAL_THREE) {
      const cx = targets.reduce((s, r) => s + r.body.position.x, 0) / targets.length;
      const cy = targets.reduce((s, r) => s + r.body.position.y, 0) / targets.length;
      const zoom = mode === MODES.FINAL_TWO ? 1.7 : 1.4;
      this.cam.pan(cx, cy, 700, 'Sine.easeInOut');
      this.cam.zoomTo(zoom, 700, 'Sine.easeInOut');
    }
  }

  _switchMode(mode, time) {
    if (this.mode === mode) return;
    this.mode = mode;
    this._lastSwitch = time;
  }

  focusWinner(racer, lockMs = 5000) {
    this.mode = MODES.WINNER;
    this._lockUntil = Date.now() + lockMs;
    const { x, y } = racer.body.position;
    this.cam.pan(x, y, 800, 'Sine.easeInOut');
    this.cam.zoomTo(2.0, 1200, 'Sine.easeInOut');
  }

  reset() {
    this._lockUntil = 0;
    this._setOverview();
  }
}
```

- [ ] **Wire CameraManager into GameScene**

In `src/scenes/GameScene.js`, add to `create()`:

```js
import { CameraManager } from '../game/CameraManager.js';

// In create():
this.camManager = new CameraManager(this);

// Add to EventBus subscriptions:
EventBus.on('WINNER_CELEBRATED', ({ country }) => {
  const winner = this.racers.find(r => r.country.id === country.id);
  if (winner) this.camManager.focusWinner(winner);
});
```

In `update()`:

```js
update(time) {
  this.racers?.forEach(r => r.update());
  if (this.raceManager?.isPhysicsActive()) {
    this.camManager?.update(this.racers, time);
  }
}
```

- [ ] **Verify visually**

```bash
npm run dev
```
Expected: Camera zooms to danger zones, clusters, winner. Smooth panning between states.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: CameraManager with spectator state machine and smooth transitions"
```

---

### Task 10: Particles + Collision Effects

**Files:**
- Modify: `src/scenes/GameScene.js`, `src/entities/CountryRacer.js`

- [ ] **Add particle emitters in GameScene.create()**

```js
// In GameScene create(), after _setupCollisions():
this._initParticles();

// New method:
_initParticles() {
  // Pre-generate small square texture for sparks
  const g = this.make.graphics({ add: false });
  g.fillStyle(0xffffff);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture('spark', 4, 4);
  g.destroy();

  this.sparks = this.add.particles(0, 0, 'spark', {
    speed: { min: 80, max: 240 },
    lifespan: { min: 180, max: 380 },
    scale: { start: 1, end: 0 },
    alpha: { start: 1, end: 0 },
    quantity: 0,
    emitting: false
  });

  // Confetti texture
  const gc = this.make.graphics({ add: false });
  gc.fillStyle(0xff0000);
  gc.fillRect(0, 0, 8, 8);
  gc.generateTexture('confetti', 8, 8);
  gc.destroy();

  this.confetti = this.add.particles(0, 0, 'confetti', {
    speed: { min: 100, max: 400 },
    lifespan: { min: 1000, max: 2500 },
    scale: { start: 1.2, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 360 },
    gravityY: 200,
    quantity: 0,
    emitting: false,
    tint: [0xff4444, 0x44ff88, 0x4488ff, 0xffdd00, 0xff88ff]
  });
}
```

- [ ] **Emit sparks on collision, confetti on winner**

In `_setupCollisions()`, after existing elimination checks:

```js
// In the pairs loop, also emit sparks on any racer collision:
const isRacerA = bodyA.label?.startsWith('racer_');
const isRacerB = bodyB.label?.startsWith('racer_');
if (isRacerA && isRacerB) {
  const mx = (bodyA.position.x + bodyB.position.x) / 2;
  const my = (bodyA.position.y + bodyB.position.y) / 2;
  this.sparks?.emitParticleAt(mx, my, 12);
}
```

In EventBus subscription for `WINNER_CELEBRATED`:

```js
EventBus.on('WINNER_CELEBRATED', ({ country }) => {
  const winner = this.racers.find(r => r.country.id === country.id);
  if (winner) {
    this.camManager.focusWinner(winner);
    const { x, y } = winner.body.position;
    for (let i = 0; i < 5; i++) {
      this.scene.time.delayedCall(i * 250, () => {
        this.confetti?.emitParticleAt(x, y, 30);
      });
    }
  }
});
```

- [ ] **Verify visually**

```bash
npm run dev
```
Expected: Spark bursts when balls collide. Confetti explosion when winner declared.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: collision sparks and winner confetti particles"
```

---

## Phase 4 — Procedural Tracks

### Task 11: TrackGenerator

**Files:**
- Create: `src/game/TrackGenerator.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Create src/game/TrackGenerator.js**

```js
import { createRNG } from '../utils/seededRandom.js';
import { CANVAS_W, ZONE_GAME_Y, ZONE_GAME_H, RACER_RADIUS } from '../constants.js';

const WALL_T = 20;
const ARENA_W = CANVAS_W - WALL_T * 2;

export class TrackGenerator {
  constructor(seed) {
    this.rng  = createRNG(seed);
    this.seed = seed;
  }

  generate() {
    const modules = this._pickModules();
    const layout  = this._layoutModules(modules);
    return layout;
  }

  _pickModules() {
    const optional = ['HoleSection', 'SpinnerSection', 'MovingWallSection', 'RampSection', 'BounceSection', 'NarrowPassage'];
    const shuffled = this.rng.shuffle(optional);
    const count    = this.rng.intBetween(3, 5);
    return ['Start', ...shuffled.slice(0, count), 'FinalArena'];
  }

  _layoutModules(moduleNames) {
    const bodies   = [];
    const y0       = ZONE_GAME_Y + 20;
    const totalH   = ZONE_GAME_H - 40;
    const sliceH   = totalH / moduleNames.length;
    let spawnPos   = null;

    moduleNames.forEach((name, i) => {
      const sectionY = y0 + i * sliceH;
      const section  = this['_module_' + name]?.(sectionY, sliceH);
      if (section) {
        bodies.push(...(section.bodies ?? []));
        if (section.spawnY) spawnPos = { y: section.spawnY };
      }
    });

    return { bodies, spawnY: spawnPos?.y ?? y0 + 60 };
  }

  _module_Start(y, h) {
    return {
      spawnY: y + 40,
      bodies: [
        this._platform(WALL_T, y + h * 0.6, ARENA_W, 20)
      ]
    };
  }

  _module_HoleSection(y, h) {
    const count   = this.rng.intBetween(1, 3);
    const bodies  = [];
    const floorY  = y + h * 0.7;

    // Main floor with holes
    const holePositions = [];
    for (let i = 0; i < count; i++) {
      holePositions.push(this.rng.between(WALL_T + 80, CANVAS_W - WALL_T - 80));
    }
    holePositions.sort((a, b) => a - b);

    let cursor = WALL_T;
    holePositions.forEach(hx => {
      const hw = this.rng.between(60, 140);
      if (hx - hw / 2 > cursor + 20) {
        bodies.push(this._platform(cursor, floorY, hx - hw / 2 - cursor, 18));
      }
      bodies.push({ type: 'hole', x: hx, y: floorY, w: hw });
      cursor = hx + hw / 2;
    });
    if (cursor < CANVAS_W - WALL_T - 20) {
      bodies.push(this._platform(cursor, floorY, CANVAS_W - WALL_T - cursor, 18));
    }

    return { bodies };
  }

  _module_SpinnerSection(y, h) {
    const cx    = CANVAS_W / 2 + this.rng.between(-100, 100);
    const cy    = y + h * 0.5;
    const len   = this.rng.between(180, 340);
    const speed = this.rng.between(0.6, 2.0) * (this.rng.next() > 0.5 ? 1 : -1);
    return {
      bodies: [
        { type: 'spinner', x: cx, y: cy, len, speed },
        this._platform(WALL_T, y + h * 0.85, ARENA_W * 0.4, 18),
        this._platform(CANVAS_W * 0.6, y + h * 0.85, ARENA_W * 0.4, 18)
      ]
    };
  }

  _module_MovingWallSection(y, h) {
    const axis  = this.rng.next() > 0.5 ? 'h' : 'v';
    const speed = this.rng.between(1.5, 4.0);
    const cx    = CANVAS_W / 2;
    const cy    = y + h * 0.45;
    return {
      bodies: [
        { type: 'movingwall', x: cx, y: cy, axis, speed,
          range: this.rng.between(120, 260), w: 30, h: 80 },
        this._platform(WALL_T, y + h * 0.8, ARENA_W * 0.35, 18),
        this._platform(CANVAS_W * 0.65, y + h * 0.8, ARENA_W * 0.35, 18)
      ]
    };
  }

  _module_RampSection(y, h) {
    const side = this.rng.next() > 0.5 ? 1 : -1;
    return {
      bodies: [
        { type: 'platform', x: side > 0 ? WALL_T : CANVAS_W - WALL_T - 280,
          y: y + h * 0.5, w: 280, h: 18, angle: 0.2 * side },
        { type: 'platform', x: side > 0 ? CANVAS_W - WALL_T - 240 : WALL_T,
          y: y + h * 0.75, w: 240, h: 18, angle: -0.15 * side }
      ]
    };
  }

  _module_BounceSection(y, h) {
    const count = this.rng.intBetween(2, 4);
    const bodies = [];
    for (let i = 0; i < count; i++) {
      bodies.push({
        type: 'bouncepad',
        x: WALL_T + this.rng.between(60, ARENA_W - 60),
        y: y + h * (0.4 + i * 0.15),
        w: this.rng.between(80, 150),
        strength: this.rng.between(800, 1400)
      });
    }
    return { bodies };
  }

  _module_NarrowPassage(y, h) {
    const cx  = CANVAS_W / 2;
    const gap = RACER_RADIUS * 2.6;
    return {
      bodies: [
        this._platform(WALL_T, y + h * 0.5, cx - gap / 2 - WALL_T, 18),
        this._platform(cx + gap / 2, y + h * 0.5, CANVAS_W - WALL_T - cx - gap / 2, 18)
      ]
    };
  }

  _module_FinalArena(y, h) {
    const hw = this.rng.between(120, 200);
    return {
      bodies: [
        this._platform(WALL_T, y + h * 0.6, (ARENA_W - hw) / 2, 18),
        { type: 'hole', x: CANVAS_W / 2, y: y + h * 0.6, w: hw },
        this._platform(CANVAS_W / 2 + hw / 2, y + h * 0.6, (ARENA_W - hw) / 2, 18)
      ]
    };
  }

  _platform(x, y, w, h, angle = 0) {
    return { type: 'platform', x, y, w, h, angle };
  }
}
```

- [ ] **Wire TrackGenerator into GameScene**

Replace hardcoded `_addHoles()` and `_addPlatform()` calls. Refactor `GameScene.js` `_buildArena()`:

```js
import { TrackGenerator } from '../game/TrackGenerator.js';
import { Hole } from '../entities/Hole.js';

// Replace _buildArena() with:
_buildArena(seed) {
  const w = CANVAS_W, y0 = ZONE_GAME_Y, h = ZONE_GAME_H;
  this.matter.world.setBounds(0, y0, w, h, 20);

  // Death zone
  this.matter.add.rectangle(w / 2, y0 + h + 30, w, 60,
    { isStatic: true, isSensor: true, label: 'death_zone' });

  this.holes = [];
  const gen    = new TrackGenerator(seed);
  const layout = gen.generate();
  this._currentSpawnY = layout.spawnY;

  layout.bodies.forEach(def => this._spawnDef(def));
  this._drawArenaBackground();
}

_spawnDef(def) {
  switch (def.type) {
    case 'platform':   return this._addPlatform(def.x, def.y, def.w, def.h, def.angle ?? 0);
    case 'hole':       return this.holes.push(new Hole(this, def.x, def.y, def.w));
    case 'spinner':    return this._addSpinner(def);
    case 'movingwall': return this._addMovingWall(def);
    case 'bouncepad':  return this._addBouncePad(def);
  }
}

_addSpinner({ x, y, len, speed }) {
  const bar = this.matter.add.rectangle(x, y, len, 16, { isStatic: true, label: 'obstacle', angle: 0 });
  const g   = this.add.graphics().setDepth(7);
  this.time.addEvent({ loop: true, delay: 16, callback: () => {
    bar.angle += speed * 0.016;
    this.matter.body.setAngle(bar, bar.angle);
    g.clear();
    g.fillStyle(0x4466aa, 1);
    const cos = Math.cos(bar.angle), sin = Math.sin(bar.angle);
    const hl = len / 2;
    g.fillPoints([
      { x: x + cos*hl - sin*8, y: y + sin*hl + cos*8 },
      { x: x + cos*hl + sin*8, y: y + sin*hl - cos*8 },
      { x: x - cos*hl + sin*8, y: y - sin*hl - cos*8 },
      { x: x - cos*hl - sin*8, y: y - sin*hl + cos*8 }
    ], true);
    g.lineStyle(2, 0x88aaff, 0.8);
    g.strokePoints([
      { x: x + cos*hl - sin*8, y: y + sin*hl + cos*8 },
      { x: x + cos*hl + sin*8, y: y + sin*hl - cos*8 },
      { x: x - cos*hl + sin*8, y: y - sin*hl - cos*8 },
      { x: x - cos*hl - sin*8, y: y - sin*hl + cos*8 }
    ], true);
  }});
}

_addMovingWall({ x, y, axis, speed, range, w, h }) {
  const wall = this.matter.add.rectangle(x, y, w, h, { isStatic: true, label: 'obstacle' });
  const startX = x, startY = y;
  let t = 0;
  const g = this.add.graphics().setDepth(7);
  this.time.addEvent({ loop: true, delay: 16, callback: () => {
    t += 0.016 * speed;
    const offset = Math.sin(t) * range / 2;
    const nx = axis === 'h' ? startX + offset : startX;
    const ny = axis === 'v' ? startY + offset : startY;
    this.matter.body.setPosition(wall, { x: nx, y: ny });
    g.clear();
    g.fillStyle(0x882244, 1);
    g.fillRect(nx - w/2, ny - h/2, w, h);
    g.lineStyle(2, 0xff4488, 0.8);
    g.strokeRect(nx - w/2, ny - h/2, w, h);
  }});
}

_addBouncePad({ x, y, w, strength }) {
  const pad = this.matter.add.rectangle(x, y, w, 12, { isStatic: true, isSensor: true, label: 'bouncepad' });
  pad._strength = strength;
  const g = this.add.graphics().setDepth(7);
  g.fillStyle(0x44ff88, 1);
  g.fillRect(x - w/2, y - 6, w, 12);
  g.lineStyle(2, 0x88ffcc, 0.9);
  g.strokeRect(x - w/2, y - 6, w, 12);
  g.fillStyle(0xffffff, 0.3);
  g.fillRect(x - w/2, y - 6, w, 3);
}
```

Also update `_setupCollisions()` to handle bounce pads:

```js
// In _checkElimination, also add bounce handling:
_checkBounce(maybeRacer, maybePad) {
  if (!maybeRacer.label?.startsWith('racer_')) return;
  if (maybePad.label !== 'bouncepad') return;
  const strength = maybePad._strength ?? 1000;
  this.matter.body.setVelocity(maybeRacer, {
    x: maybeRacer.velocity.x,
    y: -(strength / 60)
  });
}
```

Also in `collisionstart` handler, add: `this._checkBounce(bodyA, bodyB); this._checkBounce(bodyB, bodyA);`

Finally update `_buildArena()` call in `create()` to pass a seed. Store seed on scene:

```js
// In create():
this.seed = Math.floor(Math.random() * 0xFFFFFF);
this._buildArena(this.seed);
this._spawnRacers(this._currentSpawnY ?? ZONE_GAME_Y + 80);
```

Update `_spawnRacers` to accept a `spawnY` param.

- [ ] **Verify visually**

```bash
npm run dev
```
Expected: Different arena layout each refresh. Platforms, holes, spinners, moving walls, bounce pads appear randomly. Balls interact with all obstacles.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: TrackGenerator with seeded procedural arena modules"
```

---

## Phase 5 — Commentary System

### Task 12: CommentaryManager

**Files:**
- Create: `src/game/CommentaryManager.js`, `tests/game/CommentaryManager.test.js`

- [ ] **Write failing tests**

```js
// tests/game/CommentaryManager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/utils/eventBus.js';

beforeEach(() => EventBus.clear());

// Minimal mock to avoid Phaser dep
vi.mock('../../src/game/CommentaryManager.js', async (importOriginal) => {
  return importOriginal();
});

import { CommentaryManager } from '../../src/game/CommentaryManager.js';

describe('CommentaryManager', () => {
  it('picks a template and replaces {country}', () => {
    const cm = new CommentaryManager(null);
    const result = cm._format('{country} IS OUT!', { name: 'INDIA' });
    expect(result).toBe('INDIA IS OUT!');
  });

  it('respects cooldown — does not emit twice within cooldown', () => {
    const cm = new CommentaryManager(null);
    const emitted = [];
    cm._onComment = (txt) => emitted.push(txt);
    cm._tryEmit('ELIMINATED', { country: { name: 'JAPAN' } }, 0);
    cm._tryEmit('ELIMINATED', { country: { name: 'USA'  } }, 100); // within cooldown
    expect(emitted.length).toBe(1);
  });

  it('allows emit after cooldown expires', () => {
    const cm = new CommentaryManager(null);
    const emitted = [];
    cm._onComment = (txt) => emitted.push(txt);
    cm._tryEmit('ELIMINATED', { country: { name: 'JAPAN' } }, 0);
    cm._tryEmit('ELIMINATED', { country: { name: 'USA'  } }, 4000); // after HIGH cooldown
    expect(emitted.length).toBe(2);
  });
});
```

```bash
npm test -- tests/game/CommentaryManager.test.js
```
Expected: FAIL.

- [ ] **Create src/game/CommentaryManager.js**

```js
import { EventBus } from '../utils/eventBus.js';
import { COMMENTARY } from '../data/commentary.js';

const PRIORITY = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const COOLDOWNS = { HIGH: 3000, MEDIUM: 6000, LOW: 12000 };

const EVENT_PRIORITY = {
  WINNER_CELEBRATED: 'HIGH',
  COUNTRY_ELIMINATED: 'HIGH',
  FINAL_N: 'HIGH',
  COUNTRY_NEAR_HOLE: 'HIGH',
  COUNTRY_BOUNCED: 'MEDIUM',
  COUNTRY_COLLISION: 'LOW',
  RACE_STARTED: 'HIGH'
};

export class CommentaryManager {
  constructor(uiScene) {
    this.ui           = uiScene;
    this._lastTimes   = {};
    this._onComment   = null; // override in tests
    this._subs        = [];
  }

  start() {
    this._subs = [
      EventBus.on('RACE_STARTED',       () => this._tryEmit('RACE_START', {}, Date.now())),
      EventBus.on('COUNTRY_ELIMINATED', d  => this._tryEmit('ELIMINATED', d, Date.now())),
      EventBus.on('COUNTRY_NEAR_HOLE',  d  => this._tryEmit('DANGER', d, Date.now())),
      EventBus.on('COUNTRY_BOUNCED',    d  => this._tryEmit('BOUNCED', d, Date.now())),
      EventBus.on('COUNTRY_COLLISION',  d  => this._tryEmit('COLLISION', d, Date.now())),
      EventBus.on('FINAL_N',            d  => this._tryEmit(`FINAL_${d.n}`, d, Date.now())),
      EventBus.on('WINNER_CELEBRATED',  d  => this._tryEmit('WINNER', d, Date.now()))
    ];
  }

  stop() {
    this._subs.forEach(u => u());
    this._subs = [];
  }

  _tryEmit(eventKey, data, now) {
    const priority = EVENT_PRIORITY[eventKey] ?? 'LOW';
    const cooldown = COOLDOWNS[priority];
    const lastTime = this._lastTimes[priority] ?? 0;
    if (now - lastTime < cooldown) return;

    const templates = COMMENTARY[eventKey];
    if (!templates?.length) return;

    const template = templates[Math.floor(Math.random() * templates.length)];
    const text     = this._format(template, data.country ?? data);
    this._lastTimes[priority] = now;

    if (this._onComment) { this._onComment(text); return; }
    EventBus.emit('COMMENTARY_LINE', { text });
    this.ui?.setCommentary(text);
  }

  _format(template, country) {
    return template.replace(/\{country\}/g, country?.name ?? '');
  }
}
```

- [ ] **Run tests — expect PASS**

```bash
npm test -- tests/game/CommentaryManager.test.js
```

- [ ] **Wire CommentaryManager into GameScene and UIScene**

In `GameScene.create()`:

```js
import { CommentaryManager } from '../game/CommentaryManager.js';

// After UIScene is launched:
this.time.delayedCall(200, () => {
  const uiScene = this.scene.get('UIScene');
  this.commentary = new CommentaryManager(uiScene);
  this.commentary.start();
});
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: CommentaryManager with priority queue and EventBus integration"
```

---

### Task 13: Full Leaderboard + Elimination Card

**Files:**
- Modify: `src/scenes/UIScene.js`

- [ ] **Update UIScene leaderboard rows to use ScoreManager data**

Replace the `_drawLeaderboardZone()` stub and add a live update method:

```js
// Add import at top of UIScene.js:
import { ScoreManager } from '../game/ScoreManager.js';

// In create(), after existing setup:
this.scores = new ScoreManager();
this._liveLeaderboard = [];

// Add event listener:
EventBus.on('WINNER_CELEBRATED', () => this.updateLeaderboard());
EventBus.on('RACE_PREP', ({ raceNumber }) => {
  this.setRaceNumber(raceNumber);
  this.updateLeaderboard();
});

// New method:
updateLeaderboard() {
  const top = this.scores.getTopToday(3);
  const medals = ['🥇','🥈','🥉'];
  const COUNTRIES_MAP = {};
  import('../data/countries.js').then(({ COUNTRIES }) => {
    COUNTRIES.forEach(c => { COUNTRIES_MAP[c.id] = c; });
    this.leaderboardRows?.forEach((row, i) => {
      const entry = top[i];
      if (entry) {
        const c = COUNTRIES_MAP[entry.id];
        row.setText(`${medals[i]}  ${c?.emoji ?? ''} ${c?.name ?? entry.id}   ${entry.wins} WINS`);
        row.setColor('#ffffff');
      } else {
        row.setText(`${medals[i]}  —`);
        row.setColor('#555577');
      }
    });
  });
}
```

- [ ] **Add elimination card**

```js
// New method in UIScene:
showEliminationCard(country) {
  const cx = CANVAS_W / 2;
  const cy = ZONE_GAME_Y + ZONE_GAME_H * 0.2;

  const bg = this.add.graphics().setDepth(95);
  bg.fillStyle(0x1a0000, 0.92);
  bg.fillRoundedRect(cx - 260, cy - 50, 520, 120, 16);
  bg.lineStyle(2, 0xff2200, 0.8);
  bg.strokeRoundedRect(cx - 260, cy - 50, 520, 120, 16);

  const label = this.add.text(cx, cy - 20, 'ELIMINATED', {
    fontSize: '32px', fontFamily: 'Arial Black, sans-serif', color: '#ff4400'
  }).setOrigin(0.5).setDepth(96);

  const name = this.add.text(cx, cy + 30, `${country.emoji}  ${country.name}`, {
    fontSize: '52px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff'
  }).setOrigin(0.5).setDepth(96);

  const targets = [bg, label, name];
  targets.forEach(t => t.setAlpha(0));

  this.tweens.chain({ targets, tweens: [
    { alpha: 1, duration: 200 },
    { alpha: 1, duration: 1800 },
    { alpha: 0, duration: 300, onComplete: () => targets.forEach(t => t.destroy()) }
  ]});
}
```

Subscribe in `_setupEventListeners()`:

```js
EventBus.on('COUNTRY_ELIMINATED', ({ country }) => this.showEliminationCard(country));
```

- [ ] **Verify visually**

```bash
npm run dev
```
Expected: Elimination card appears on each elimination. Leaderboard updates after each winner.

- [ ] **Run all tests**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: live leaderboard updates and elimination card overlay"
```

---

## Phase 6 — Audio

### Task 14: AudioManager (Placeholder Sounds)

**Files:**
- Create: `src/game/AudioManager.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Create src/game/AudioManager.js**

```js
import { EventBus } from '../utils/eventBus.js';

export class AudioManager {
  constructor(scene) {
    this.scene  = scene;
    this._subs  = [];
    this._ctx   = null;
  }

  start() {
    try {
      this._ctx = new AudioContext();
    } catch { return; }

    this._subs = [
      EventBus.on('COUNTDOWN',          d => this._beep(d.value === 'GO!' ? 880 : 440, 0.12)),
      EventBus.on('COUNTRY_COLLISION',  () => this._noise(0.06)),
      EventBus.on('COUNTRY_BOUNCED',    () => this._beep(660, 0.08)),
      EventBus.on('COUNTRY_ELIMINATED', () => this._beep(220, 0.25, 'sawtooth')),
      EventBus.on('WINNER_CELEBRATED',  () => this._fanfare())
    ];
  }

  stop() {
    this._subs.forEach(u => u());
    this._subs = [];
  }

  _beep(freq, dur, type = 'sine') {
    if (!this._ctx) return;
    try {
      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain);
      gain.connect(this._ctx.destination);
      osc.type      = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, this._ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + dur);
      osc.start();
      osc.stop(this._ctx.currentTime + dur + 0.05);
    } catch {}
  }

  _noise(dur) {
    if (!this._ctx) return;
    try {
      const buf  = this._ctx.createBuffer(1, this._ctx.sampleRate * dur, this._ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src  = this._ctx.createBufferSource();
      const gain = this._ctx.createGain();
      src.buffer = buf;
      src.connect(gain);
      gain.connect(this._ctx.destination);
      gain.gain.value = 0.08;
      src.start();
    } catch {}
  }

  _fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._beep(f, 0.3), i * 120);
    });
  }
}
```

- [ ] **Wire AudioManager in GameScene.create()**

```js
import { AudioManager } from '../game/AudioManager.js';

// In create(), after commentary setup:
this.audio = new AudioManager(this);
this.audio.start();
EventBus.on('RACE_RESTART', () => this.audio.stop());
```

- [ ] **Verify**

```bash
npm run dev
```
Open browser, run race. Expected: beeps on countdown, noise on collisions, fanfare on winner. (Browser may require user gesture to unlock AudioContext — click the page first.)

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: AudioManager with Web Audio API placeholder sounds"
```

---

## Phase 7 — Chaos Events + Auto Loop

### Task 15: ChaosEventManager

**Files:**
- Create: `src/game/ChaosEventManager.js`
- Modify: `src/scenes/GameScene.js`, `src/scenes/UIScene.js`

- [ ] **Create src/game/ChaosEventManager.js**

```js
import { EventBus } from '../utils/eventBus.js';
import { createRNG } from '../utils/seededRandom.js';

const EVENTS = [
  { id: 'GRAVITY_FLIP', label: '🌀 GRAVITY FLIP!',   duration: 4000 },
  { id: 'TURBO',        label: '🚀 TURBO BOOST!',     duration: 3000 },
  { id: 'EARTHQUAKE',   label: '🌋 EARTHQUAKE!',       duration: 3500 },
  { id: 'DARKNESS',     label: '🌑 LIGHTS OUT!',       duration: 3000 }
];

export class ChaosEventManager {
  constructor(scene, seed) {
    this.scene    = scene;
    this.rng      = createRNG(seed + 777);
    this._timer   = null;
    this._active  = false;
  }

  start() {
    this._scheduleNext();
  }

  stop() {
    this._timer?.remove();
    this._timer = null;
  }

  _scheduleNext() {
    const delay = this.rng.between(45000, 90000);
    this._timer = this.scene.time.delayedCall(delay, () => {
      if (this.scene.raceManager?.isPhysicsActive()) this._trigger();
      this._scheduleNext();
    });
  }

  _trigger() {
    const ev = this.rng.pick(EVENTS);
    EventBus.emit('CHAOS_EVENT', { id: ev.id, label: ev.label, duration: ev.duration });
    this._applyEffect(ev);
    this.scene.time.delayedCall(ev.duration, () => this._removeEffect(ev));
  }

  _applyEffect({ id }) {
    const m = this.scene.matter;
    switch (id) {
      case 'GRAVITY_FLIP':
        m.world.setGravity(0, -2.5);
        break;
      case 'TURBO':
        this.scene.racers?.filter(r => r.alive).forEach(r => {
          m.body.setVelocity(r.body, { x: r.body.velocity.x * 2, y: r.body.velocity.y * 2 });
        });
        break;
      case 'EARTHQUAKE':
        this.scene.time.addEvent({ repeat: 8, delay: 200, callback: () => {
          this.scene.racers?.filter(r => r.alive).forEach(r => {
            m.body.applyForce(r.body, r.body.position, {
              x: (Math.random() - 0.5) * 0.05,
              y: (Math.random() - 0.5) * 0.03
            });
          });
        }});
        break;
      case 'DARKNESS':
        EventBus.emit('DARKNESS_ON', {});
        break;
    }
  }

  _removeEffect({ id }) {
    switch (id) {
      case 'GRAVITY_FLIP':
        this.scene.matter.world.setGravity(0, 2.5);
        break;
      case 'DARKNESS':
        EventBus.emit('DARKNESS_OFF', {});
        break;
    }
  }
}
```

- [ ] **Add chaos event banner to UIScene**

```js
// In _setupEventListeners():
EventBus.on('CHAOS_EVENT', ({ label }) => this._showChaosEvent(label));
EventBus.on('DARKNESS_ON',  () => this._setDarkness(true));
EventBus.on('DARKNESS_OFF', () => this._setDarkness(false));

// New methods:
_showChaosEvent(label) {
  const cx = CANVAS_W / 2;
  const cy = ZONE_GAME_Y + ZONE_GAME_H * 0.1;
  const txt = this.add.text(cx, cy, label, {
    fontSize: '88px', fontFamily: 'Arial Black, sans-serif',
    color: '#ff8800', stroke: '#330000', strokeThickness: 10,
    shadow: { color: '#ff4400', blur: 40, fill: true }
  }).setOrigin(0.5).setDepth(92).setAlpha(0);

  this.tweens.chain({ targets: txt, tweens: [
    { alpha: 1, scaleX: 1.3, scaleY: 1.3, duration: 300, ease: 'Back.out' },
    { alpha: 1, duration: 1200 },
    { alpha: 0, duration: 500, onComplete: () => txt.destroy() }
  ]});
}

_setDarkness(on) {
  if (on) {
    this._darknessOverlay = this.add.graphics().setDepth(85);
    this._darknessOverlay.fillStyle(0x000000, 0.92);
    this._darknessOverlay.fillRect(0, ZONE_GAME_Y, CANVAS_W, ZONE_GAME_H);
  } else {
    this._darknessOverlay?.destroy();
    this._darknessOverlay = null;
  }
}
```

- [ ] **Wire ChaosEventManager in GameScene**

```js
import { ChaosEventManager } from '../game/ChaosEventManager.js';

// In create(), after raceManager.start():
this.chaos = new ChaosEventManager(this, this.seed);
EventBus.on('RACE_STARTED', () => this.chaos.start());
EventBus.on('RACE_RESTART', () => this.chaos.stop());
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: ChaosEventManager with gravity flip, turbo, earthquake, darkness"
```

---

## Phase 8 — Debug + Stream Mode

### Task 16: Debug and Stream Modes

**Files:**
- Modify: `src/scenes/UIScene.js`, `src/scenes/GameScene.js`

- [ ] **Add debug overlay to UIScene**

```js
// In UIScene create():
this._debugMode  = new URLSearchParams(location.search).has('debug');
this._streamMode = new URLSearchParams(location.search).has('stream');

if (this._debugMode) this._buildDebugOverlay();
this.input.keyboard.on('keydown-D', () => {
  this._debugMode = !this._debugMode;
  this._debugGroup?.setVisible(this._debugMode);
});
this.input.keyboard.on('keydown-S', () => {
  this._streamMode = !this._streamMode;
  // hide/show dev elements
});

// New method:
_buildDebugOverlay() {
  const bg = this.add.graphics().setDepth(200);
  bg.fillStyle(0x000000, 0.75);
  bg.fillRect(10, ZONE_GAME_Y + ZONE_GAME_H + 10, 320, 140);

  this.debugFps   = this.add.text(20, ZONE_GAME_Y + ZONE_GAME_H + 20, 'FPS: --', {
    fontSize: '24px', fontFamily: 'monospace', color: '#88ff88'
  }).setDepth(201);
  this.debugSeed  = this.add.text(20, ZONE_GAME_Y + ZONE_GAME_H + 50, 'SEED: --', {
    fontSize: '24px', fontFamily: 'monospace', color: '#88ff88'
  }).setDepth(201);
  this.debugRace  = this.add.text(20, ZONE_GAME_Y + ZONE_GAME_H + 80, 'RACERS: --', {
    fontSize: '24px', fontFamily: 'monospace', color: '#88ff88'
  }).setDepth(201);

  this._debugGroup = this.add.group([bg, this.debugFps, this.debugSeed, this.debugRace]);
}

// In UIScene update():
update() {
  if (this._debugMode && this.debugFps) {
    this.debugFps.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    const gs = this.scene.get('GameScene');
    if (gs) {
      this.debugSeed?.setText(`SEED: ${gs.seed ?? '—'}`);
      const alive = gs.racers?.filter(r => r.alive).length ?? '—';
      this.debugRace?.setText(`RACERS: ${alive}`);
    }
  }
}
```

- [ ] **Enable Matter.js debug in GameScene when ?debug**

```js
// In GameScene create():
if (new URLSearchParams(location.search).has('debug')) {
  this.matter.world.drawDebug = true;
}
```

- [ ] **Verify**

```bash
npm run dev
```
Open `http://localhost:3000?debug=1`. Expected: FPS, seed, racer count shown. Physics body outlines visible. Press D to toggle.

- [ ] **Run all tests**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: debug overlay (FPS, seed, racers) and stream mode toggle"
```

---

## Phase 9 — Performance & Cleanup

### Task 17: Memory Cleanup + Object Pooling

**Files:**
- Modify: `src/scenes/GameScene.js`, `src/entities/CountryRacer.js`

- [ ] **Clean up all bodies and objects on scene restart**

In `GameScene.js`, add before the `RACE_RESTART` handler calls `this.scene.restart()`:

```js
// Called just before restart:
_cleanup() {
  // Destroy all racers
  this.racers?.forEach(r => r.destroy());
  this.racers = [];

  // Remove all event subscriptions
  this._unsubs?.forEach(u => u?.());
  this._unsubs = [];

  // Stop subsystems
  this.commentary?.stop();
  this.audio?.stop();
  this.chaos?.stop();

  // Matter world cleanup handled by scene restart
}
```

Wire into `RACE_RESTART` handler:

```js
EventBus.on('RACE_RESTART', () => {
  this._cleanup();
  this.scene.restart();
});
```

- [ ] **Confirm particle pool size is bounded**

Verify `src/scenes/GameScene.js` `_initParticles()` uses `maxParticles` option:

```js
this.sparks = this.add.particles(0, 0, 'spark', {
  // ... existing config ...
  maxParticles: 150,  // add this line
  emitting: false
});

this.confetti = this.add.particles(0, 0, 'confetti', {
  // ... existing config ...
  maxParticles: 200,  // add this line
  emitting: false
});
```

- [ ] **Run 5 races in a row and check memory in browser DevTools**

Open Chrome DevTools → Memory → take heap snapshot. Run 5 races. Take another snapshot. Confirm heap is not growing unboundedly (< 20MB growth across 5 races).

- [ ] **Run all tests**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Final commit**

```bash
git add -A && git commit -m "feat: cleanup on race restart, bounded particle pools"
```

---

## Execution Checklist (Post-Build)

After all tasks complete, verify:

- [ ] `npm run dev` starts without errors
- [ ] `npm test` passes all tests
- [ ] 12 sphere racers visible, stripes rotate as balls roll
- [ ] Physics-driven elimination — no predetermined outcomes
- [ ] Procedural track changes each race
- [ ] Countdown → race → winner → intermission loop runs automatically
- [ ] Leaderboard updates after each race
- [ ] Commentary text appears for eliminations, winner, FINAL_N
- [ ] Camera follows action, zooms on winner
- [ ] Collision sparks + winner confetti visible
- [ ] No console errors after 5+ consecutive races
- [ ] `?debug=1` shows FPS, seed, racer count
- [ ] Canvas is 1080×1920, fits browser window correctly
