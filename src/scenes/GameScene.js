import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ZONE_GAME_Y, ZONE_GAME_H, RACER_RADIUS } from '../constants.js';
import { EventBus } from '../utils/eventBus.js';
import { COUNTRIES } from '../data/countries.js';
import { CountryRacer } from '../entities/CountryRacer.js';
import { createRNG } from '../utils/seededRandom.js';
import { Hole } from '../entities/Hole.js';

const WALL_T = 20;

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.scene.launch('UIScene');
    this._buildArena();
    this._drawArenaBackground();
    this.seed  = Math.floor(Math.random() * 0xFFFFFF);
    this._spawnRacers();
    this._setupCollisions();
  }

  _buildArena() {
    const w = CANVAS_W, y0 = ZONE_GAME_Y, h = ZONE_GAME_H;

    // World bounds — only game zone
    this.matter.world.setBounds(0, y0, w, h, WALL_T);

    // Death zone sensor at bottom (off-screen)
    this.matter.add.rectangle(
      w / 2, y0 + h + 30, w, 60,
      { isStatic: true, isSensor: true, label: 'death_zone' }
    );

    // Static floor platforms
    this._addPlatform(CANVAS_W * 0.1,  y0 + h * 0.3, CANVAS_W * 0.35, 18);
    this._addPlatform(CANVAS_W * 0.55, y0 + h * 0.3, CANVAS_W * 0.35, 18);
    this._addPlatform(CANVAS_W * 0.05, y0 + h * 0.6, CANVAS_W * 0.4,  18);
    this._addPlatform(CANVAS_W * 0.55, y0 + h * 0.6, CANVAS_W * 0.4,  18);

    // Holes
    this.holes = [];
    this._addHoles();
  }

  _addHoles() {
    this.holes.push(new Hole(this, CANVAS_W * 0.3, ZONE_GAME_Y + ZONE_GAME_H * 0.5, 140));
    this.holes.push(new Hole(this, CANVAS_W * 0.7, ZONE_GAME_Y + ZONE_GAME_H * 0.5, 140));
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

    const racer = this.racers?.find(r => r.body === maybeRacer && r.alive);
    if (!racer) return;

    racer.eliminate();

    const remaining = this.racers.filter(r => r.alive).length;
    EventBus.emit('COUNTRY_ELIMINATED', {
      country: racer.country,
      remaining,
      total: this.racers.length
    });

    if (remaining === 1) {
      const winner = this.racers.find(r => r.alive);
      EventBus.emit('WINNER_DECLARED', { country: winner.country });
    }

    if (remaining === 0) {
      // Edge case: simultaneous last two eliminated
      EventBus.emit('RACE_NO_WINNER', {});
    }
  }

  _addPlatform(x, y, width, height) {
    this.matter.add.rectangle(x + width / 2, y, width, height, {
      isStatic: true, label: 'platform'
    });
    const g = this.add.graphics();
    g.fillStyle(0x2244aa, 1);
    g.fillRect(x, y - height / 2, width, height);
    g.fillStyle(0x4488ff, 0.4);
    g.fillRect(x, y - height / 2, width, 3);
  }

  _spawnRacers(spawnY) {
    const rng    = createRNG(this.seed);
    const y      = spawnY ?? ZONE_GAME_Y + 80;
    this.racers  = [];

    COUNTRIES.forEach((country, i) => {
      const col   = i % 6;
      const row   = Math.floor(i / 6);
      const x     = 120 + col * 140 + rng.between(-20, 20);
      const spawnAt = y + row * 100 + rng.between(-10, 10);
      const vary  = rng.between(0.95, 1.05);
      this.racers.push(new CountryRacer(this, country, x, spawnAt, vary));
    });
  }

  _drawArenaBackground() {
    const g = this.add.graphics();
    const y0 = ZONE_GAME_Y, h = ZONE_GAME_H, w = CANVAS_W;

    // Dark gradient background
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

  update(time, delta) {
    this.racers?.forEach(r => r.update());
  }
}
