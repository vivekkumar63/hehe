import { createRNG } from '../utils/seededRandom.js';
import { CANVAS_W, ZONE_GAME_Y, ZONE_GAME_H, RACER_RADIUS } from '../constants.js';

const WALL_T = 20;
const ARENA_W = CANVAS_W - WALL_T * 2;

export class TrackGenerator {
  constructor(seed) {
    this.rng = createRNG(seed);
  }

  generate() {
    const bodies      = [];
    const spawnY      = ZONE_GAME_Y + 50;
    const courseStart = ZONE_GAME_Y + 190;
    const courseEnd   = ZONE_GAME_Y + ZONE_GAME_H - 100;
    const numRows     = 11;
    const rowH        = (courseEnd - courseStart) / numRows;

    // Zigzag gap positions force lateral movement between rows
    const gapPattern = ['center','left','right','center','left','center','right','left','center','right','center'];

    let bombBudget = this.rng.intBetween(3, 5); // total bombs for the whole course

    for (let i = 0; i < numRows; i++) {
      const rowY    = courseStart + (i + 0.5) * rowH;
      const gapSide = gapPattern[i];

      if (i % 3 === 1) {
        bodies.push(...this._obstacleRow(rowY));
      } else {
        bodies.push(...this._gappedPlatform(rowY, gapSide));
      }

      // Scatter bombs sparingly — only if budget remains and random allows
      if (bombBudget > 0 && this.rng.next() > 0.65) {
        bodies.push(this._singleBomb(rowY - rowH * 0.25));
        bombBudget--;
      }
    }

    return { bodies, spawnY };
  }

  // Sloped platform with a gap — steep enough that balls always slide toward the gap
  _gappedPlatform(y, gapSide) {
    const gap    = RACER_RADIUS * 4.5;   // ~198px — generous, prevents sticking at edges
    const tilt   = this.rng.between(0.18, 0.28);  // 10-16° — steep enough to overcome any friction
    const jitter = this.rng.between(-40, 40);

    if (gapSide === 'center') {
      const cx = CANVAS_W / 2 + jitter;
      const lw = cx - gap / 2 - WALL_T;
      const rw = CANVAS_W - WALL_T - (cx + gap / 2);
      if (lw < 60 || rw < 60) return this._gappedPlatform(y, 'left');
      return [
        this._plat(WALL_T,       y, lw, 16,  tilt),
        this._plat(cx + gap / 2, y, rw, 16, -tilt),
      ];
    }

    if (gapSide === 'left') {
      const gapCx  = WALL_T + gap / 2 + this.rng.between(40, 120);
      const rStart = gapCx + gap / 2;
      const rw     = CANVAS_W - WALL_T - rStart;
      if (rw < 80) return this._gappedPlatform(y, 'center');
      return [this._plat(rStart, y, rw, 16, -tilt)];
    }

    // right gap
    const gapCx = CANVAS_W - WALL_T - gap / 2 - this.rng.between(40, 120);
    const lw    = gapCx - gap / 2 - WALL_T;
    if (lw < 80) return this._gappedPlatform(y, 'center');
    return [this._plat(WALL_T, y, lw, 16, tilt)];
  }

  _obstacleRow(y) {
    if (this.rng.next() > 0.5) {
      const cx    = CANVAS_W / 2 + this.rng.between(-120, 120);
      const len   = this.rng.between(140, 300);
      const speed = this.rng.between(1.0, 2.5) * (this.rng.next() > 0.5 ? 1 : -1);
      return [{ type: 'spinner', x: cx, y, len, speed }];
    }
    return [{
      type:  'movingwall',
      x:     CANVAS_W / 2 + this.rng.between(-80, 80),
      y,
      axis:  this.rng.next() > 0.5 ? 'h' : 'v',
      speed: this.rng.between(1.5, 3.5),
      range: this.rng.between(120, 240),
      w:     26,
      h:     70,
    }];
  }

  _singleBomb(y) {
    const x = WALL_T + RACER_RADIUS * 2 + this.rng.between(0, ARENA_W - RACER_RADIUS * 4);
    return { type: 'bomb', x, y };
  }

  _plat(x, y, w, h, angle = 0) {
    return { type: 'platform', x, y, w, h, angle };
  }
}
