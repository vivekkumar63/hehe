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

    const holes = [];
    let cursor = WALL_T;
    for (let i = 0; i < count; i++) {
      const hw   = this.rng.between(60, 140);
      const minX = cursor + 60 + hw / 2;
      const maxX = CANVAS_W - WALL_T - hw / 2 - 60;
      if (minX > maxX) break;
      const hx = this.rng.between(minX, maxX);
      holes.push({ hx, hw });
      cursor = hx + hw / 2;
    }

    cursor = WALL_T;
    holes.forEach(({ hx, hw }) => {
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
    const gap = RACER_RADIUS * 4;
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
