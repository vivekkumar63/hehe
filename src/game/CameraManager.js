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
        if (Math.sqrt(dx*dx + dy*dy) < 80) return r;
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
    this.mode = MODES.OVERVIEW;
    this.cam.pan(CANVAS_W / 2, CANVAS_H / 2, 600, 'Sine.easeInOut');
    this.cam.zoomTo(1, 600, 'Sine.easeInOut');
  }

  _setDanger(racer, time) {
    this._switchMode(MODES.DANGER, time);
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

  focusWinner(racer, time, lockMs = 5000) {
    this.mode = MODES.WINNER;
    this._lockUntil = time + lockMs;
    const { x, y } = racer.body.position;
    this.cam.pan(x, y, 800, 'Sine.easeInOut');
    this.cam.zoomTo(2.0, 1200, 'Sine.easeInOut');
  }

  followEliminated(racer, time) {
    this.mode = MODES.ELIMINATION;
    this._lastSwitch = time;
    this._lockUntil = time + 1200;
    const { x, y } = racer.body.position;
    this.cam.pan(x, y, 300, 'Sine.easeInOut');
    this.cam.zoomTo(1.3, 300, 'Sine.easeInOut');
  }

  reset() {
    this._lockUntil = 0;
    this._setOverview();
  }
}
