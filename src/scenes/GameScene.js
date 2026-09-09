import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ZONE_GAME_Y, ZONE_GAME_H, RACER_RADIUS, TRACK_H, PX_PER_METER } from '../constants.js';
import { EventBus } from '../utils/eventBus.js';
import { COUNTRIES } from '../data/countries.js';
import { CountryRacer } from '../entities/CountryRacer.js';
import { createRNG } from '../utils/seededRandom.js';
import { RaceManager } from '../game/RaceManager.js';
import { CommentaryManager } from '../game/CommentaryManager.js';
import { AudioManager } from '../game/AudioManager.js';
import { ChaosEventManager } from '../game/ChaosEventManager.js';

const WALL_T          = 20;
const BAR_H           = 16;   // horizontal bar height (px)
const BAR_SLIDE_SPEED = 3;    // px per frame (~180 px/s at 60 fps)

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.scene.launch('UIScene');
    if (new URLSearchParams(location.search).has('debug')) {
      this.matter.world.drawDebug = true;
    }
    this.time.delayedCall(200, () => {
      const uiScene = this.scene.get('UIScene');
      this.commentary = new CommentaryManager(uiScene);
      this.commentary.start();
      this.audio = new AudioManager(this);
      this.audio.start();
    });
    this.seed = Math.floor(Math.random() * 0xFFFFFF);
    this._raceFinished = false;
    this._buildArena();
    this._spawnRacers(this._currentSpawnY ?? ZONE_GAME_Y + 80);
    this._setupCollisions();
    this._initParticles();

    this.matter.world.enabled = false;

    this.raceManager = new RaceManager(this);

    this._raceUnsubs = [
      EventBus.on('RACE_STARTED', () => {
        this.matter.world.enabled = true;
        this.chaos.start();
      }),
      EventBus.on('WINNER_CELEBRATED', ({ country }) => {
        this.matter.world.timeScale = 0.3;
        const winner = this.racers?.find(r => r.country.id === country.id);
        if (winner?.body) {
          const { x: wx, y: wy } = winner.body.position;
          for (let i = 0; i < 6; i++) {
            this.time.delayedCall(i * 300, () => {
              this.confetti?.emitParticleAt(wx + (Math.random() - 0.5) * 160, wy, 35);
            });
          }
        }
      }),
      EventBus.on('RACE_RESTART', () => {
        this._cleanup();
        this.scene.restart();
      })
    ];

    this.raceManager.start();
    this.chaos = new ChaosEventManager(this, this.seed);
  }

  _cleanup() {
    this._raceFinished  = false;
    this._progressAccum = 0;
    this.racers?.forEach(r => { r._prevY = undefined; });
    this.bombs = [];
    this.bars  = [];
    this.racers?.forEach(r => r.destroy());
    this.racers = [];
    this._raceUnsubs?.forEach(u => u?.());
    this._raceUnsubs = [];
    this.commentary?.stop();
    this.audio?.stop();
    this.chaos?.stop();
    this.matter.world.timeScale = 1;
    this.cameras.main.setScroll(0, ZONE_GAME_Y);
  }

  _buildArena() {
    const w   = CANVAS_W;
    const y0  = ZONE_GAME_Y;
    const end = y0 + TRACK_H;
    const wt  = WALL_T;

    // Camera: render only inside the game-zone strip; start at top of track
    this.cameras.main.setViewport(0, y0, w, ZONE_GAME_H);
    this.cameras.main.setScroll(0, y0);

    // Zero-friction walls spanning the full 1000 m track
    const wallOpts = { isStatic: true, friction: 0, frictionStatic: 0, restitution: 0.3, label: 'wall' };
    this.matter.add.rectangle(-wt / 2,    y0 + TRACK_H / 2,  wt,          TRACK_H + wt * 2, wallOpts); // left
    this.matter.add.rectangle(w + wt / 2, y0 + TRACK_H / 2,  wt,          TRACK_H + wt * 2, wallOpts); // right
    this.matter.add.rectangle(w / 2,      y0 - wt / 2,        w + wt * 2,  wt,                wallOpts); // top
    this.matter.add.rectangle(w / 2,      end + wt / 2,        w + wt * 2,  wt,                wallOpts); // bottom

    // Finish-line sensor — first ball to cross it wins
    this.matter.add.rectangle(w / 2, end - RACER_RADIUS, w, RACER_RADIUS * 4,
      { isStatic: true, isSensor: true, label: 'finish_line' });

    this._currentSpawnY = y0 + 60;
    this._drawTrackBackground();
    this._spawnObstacles();
  }

  _spawnDef(def) {
    switch (def.type) {
      case 'platform':   return this._addPlatform(def.x, def.y, def.w, def.h, def.angle ?? 0);
      case 'bomb':       return this._addBomb(def.x, def.y);
      case 'spinner':    return this._addSpinner(def);
      case 'movingwall': return this._addMovingWall(def);
      case 'bouncepad':  return this._addBouncePad(def);
    }
  }

  _spawnObstacles() {
    this.bombs = [];
    this.bars  = [];
    const rng        = createRNG(this.seed + 999);
    const w          = CANVAS_W;
    const y0         = ZONE_GAME_Y;
    const safeTop    = y0 + 1100;  // clear 10-row spawn (≈900px) plus buffer
    const safeBottom = y0 + TRACK_H - 350;
    const zone       = safeBottom - safeTop;
    const MIN_BAR_GAP = 10 * PX_PER_METER; // 10 m = 180 px

    // 100 bombs
    for (let i = 0; i < 100; i++) {
      const bx = rng.between(WALL_T + 35, w - WALL_T - 35);
      const by = safeTop + rng.between(0, zone);
      this._addBomb(bx, by);
    }

    // 100 bars: 14 left-wall-anchored + 14 right-wall-anchored = 28 wall-anchored (28%), 72 free
    // Shuffled so types are distributed randomly across the track
    const barTypes = rng.shuffle([
      ...Array(14).fill('left'),
      ...Array(14).fill('right'),
      ...Array(72).fill('free'),
    ]);

    const barYs  = [];
    let placed   = 0;
    let attempts = 0;

    while (placed < 100 && attempts < 5000) {
      attempts++;
      const by = safeTop + rng.between(0, zone);

      // Enforce minimum 5 m vertical gap between any two bars
      if (barYs.some(py => Math.abs(py - by) < MIN_BAR_GAP)) continue;

      const barW = rng.between(200, 500);
      const type = barTypes[placed];
      let cx;

      if (type === 'left') {
        cx = WALL_T + barW / 2;              // left edge flush with left wall
      } else if (type === 'right') {
        cx = w - WALL_T - barW / 2;          // right edge flush with right wall
      } else {
        const minX = WALL_T + barW / 2 + 10;
        const maxX = w - WALL_T - barW / 2 - 10;
        if (minX >= maxX) continue;
        cx = rng.between(minX, maxX);
      }

      barYs.push(by);
      this._addHorizontalBar(cx, by, barW);
      placed++;
    }
  }

  _addHorizontalBar(cx, y, width) {
    const body = this.matter.add.rectangle(cx, y, width, BAR_H, {
      isStatic: true, label: 'horizontal_bar',
      friction: 0, frictionStatic: 0, restitution: 0
    });
    const g = this.add.graphics().setDepth(6);
    // Main bar body
    g.fillStyle(0xffcc00, 1);
    g.fillRect(cx - width / 2, y - BAR_H / 2, width, BAR_H);
    // Top highlight strip
    g.fillStyle(0xffee88, 0.8);
    g.fillRect(cx - width / 2, y - BAR_H / 2, width, 4);
    // Border
    g.lineStyle(2, 0xff8800, 1);
    g.strokeRect(cx - width / 2, y - BAR_H / 2, width, BAR_H);
    // End caps (visual)
    for (const ex of [cx - width / 2, cx + width / 2 - 10]) {
      g.fillStyle(0xff8800, 1);
      g.fillRect(ex, y - BAR_H / 2, 10, BAR_H);
    }
    if (!this.bars) this.bars = [];
    this.bars.push({ body, g, cx, width, barY: y });
  }

  _initParticles() {
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
      emitting: false,
      maxParticles: 200
    });

    const gc = this.make.graphics({ add: false });
    gc.fillStyle(0xffffff);
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
      tint: [0xff4444, 0x44ff88, 0x4488ff, 0xffdd00, 0xff88ff],
      maxParticles: 300
    });
  }

  _onBarLand(racerBody, barBody) {
    if (!racerBody.label?.startsWith('racer_')) return;
    if (barBody.label !== 'horizontal_bar') return;
    const racer = this.racers?.find(r => r.body === racerBody && r.alive);
    if (!racer || racer._onBar) return;
    // Only trigger for top-surface landings: ball must be above bar center and falling
    if (racerBody.velocity.y < 2) return;
    if (racerBody.position.y > barBody.position.y - 20) return;
    const barInfo = this.bars?.find(b => b.body === barBody);
    if (!barInfo) return;
    const initDir = Math.random() < 0.5 ? -1 : 1;
    racer._onBar = { barBody, barInfo, dir: initDir, savedVy: Math.max(Math.abs(racerBody.velocity.y), 8) };
  }

  _onBarCollision(racerBody, otherBody) {
    if (!racerBody.label?.startsWith('racer_')) return;
    const racer = this.racers?.find(r => r.body === racerBody && r.alive && r._onBar);
    if (!racer) return;
    // Reverse sliding direction on hitting another ball (walls handled by position check in update)
    if (otherBody.label?.startsWith('racer_')) {
      racer._onBar.dir *= -1;
    }
  }

  _setupCollisions() {
    this.matter.world.on('collisionstart', (event) => {
      event.pairs.forEach(({ bodyA, bodyB }) => {
        this._checkTouchdown(bodyA, bodyB);
        this._checkTouchdown(bodyB, bodyA);
        this._checkElimination(bodyA, bodyB);
        this._checkElimination(bodyB, bodyA);
        this._onBarLand(bodyA, bodyB);
        this._onBarLand(bodyB, bodyA);
        this._onBarCollision(bodyA, bodyB);
        this._onBarCollision(bodyB, bodyA);
        const isRacerA = bodyA.label?.startsWith('racer_');
        const isRacerB = bodyB.label?.startsWith('racer_');
        if (isRacerA && isRacerB) {
          const mx = (bodyA.position.x + bodyB.position.x) / 2;
          const my = (bodyA.position.y + bodyB.position.y) / 2;
          this.sparks?.emitParticleAt(mx, my, 12);
          EventBus.emit('COUNTRY_COLLISION', { a: bodyA.label, b: bodyB.label });

          // Push the two balls apart horizontally so they never stick together
          const dir = bodyA.position.x <= bodyB.position.x ? -1 : 1;
          const PUSH = 6;
          this.matter.body.setVelocity(bodyA, { x: bodyA.velocity.x + dir * PUSH, y: bodyA.velocity.y });
          this.matter.body.setVelocity(bodyB, { x: bodyB.velocity.x - dir * PUSH, y: bodyB.velocity.y });
        }
        this._checkBounce(bodyA, bodyB);
        this._checkBounce(bodyB, bodyA);
      });
    });
  }

  // First ball to touch the finish_line sensor wins immediately.
  _checkTouchdown(maybeRacer, maybeTrigger) {
    if (!maybeRacer.label?.startsWith('racer_')) return;
    if (maybeTrigger.label !== 'finish_line') return;
    if (this._raceFinished) return;
    const racer = this.racers?.find(r => r.body === maybeRacer && r.alive);
    if (!racer) return;
    this._raceFinished = true;
    EventBus.emit('WINNER_DECLARED', { country: racer.country });
  }

  // Ball touches bomb → one-time blast: removes bomb, eliminates everything in radius
  _checkElimination(maybeRacer, maybeTrigger) {
    if (!maybeRacer.label?.startsWith('racer_')) return;
    if (maybeTrigger.label !== 'bomb') return;

    const bomb = this.bombs?.find(b => b.body === maybeTrigger);
    if (!bomb || bomb.exploded) return;   // already blasted this frame
    bomb.exploded = true;

    const trigger = this.racers?.find(r => r.body === maybeRacer && r.alive);
    if (!trigger) return;

    this._explodeBomb(bomb, trigger);
  }

  _explodeBomb(bomb, trigger) {
    const BLAST_R = 140;
    const { x, y } = bomb.body.position;

    // Collect every alive ball inside the blast radius (including the direct hit)
    const victims = new Set([trigger]);
    this.racers?.filter(r => r.alive && r !== trigger).forEach(r => {
      const dx = r.body.position.x - x;
      const dy = r.body.position.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < BLAST_R) victims.add(r);
    });

    // Explosion visuals — ring of sparks + flash circle
    this.sparks?.emitParticleAt(x, y, 60);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.sparks?.emitParticleAt(x + Math.cos(a) * BLAST_R * 0.55, y + Math.sin(a) * BLAST_R * 0.55, 12);
    }
    const flash = this.add.graphics().setDepth(15);
    flash.fillStyle(0xff4400, 0.6);
    flash.fillCircle(x, y, BLAST_R);
    this.tweens.add({ targets: flash, alpha: 0, duration: 350, onComplete: () => flash.destroy() });

    // Remove bomb from world
    this.matter.world.remove(bomb.body);
    bomb.g.destroy();
    bomb.emoji.destroy();

    // Eliminate victims and emit events
    victims.forEach(r => r.eliminate());

    const remaining = this.racers.filter(r => r.alive).length;
    victims.forEach(r => {
      EventBus.emit('COUNTRY_ELIMINATED', { country: r.country, remaining, total: this.racers.length });
    });

    if (remaining === 1) {
      EventBus.emit('WINNER_DECLARED', { country: this.racers.find(r => r.alive).country });
    } else if (remaining === 0) {
      EventBus.emit('RACE_NO_WINNER', {});
    }
  }

  _checkBounce(maybeRacer, maybePad) {
    if (!maybeRacer.label?.startsWith('racer_')) return;
    if (maybePad.label !== 'bouncepad') return;
    const strength = maybePad._strength ?? 1000;
    this.matter.body.setVelocity(maybeRacer, {
      x: maybeRacer.velocity.x,
      y: -(strength / 60)
    });
    EventBus.emit('COUNTRY_BOUNCED', { country: this.racers?.find(r => r.body === maybeRacer)?.country });
  }

  _addPlatform(x, y, width, height, angle = 0) {
    const cx   = x + width / 2;
    const body = this.matter.add.rectangle(cx, y, width, height, {
      isStatic: true, label: 'platform',
      friction: 0,          // zero friction — balls always slide on any slope
      frictionStatic: 0,
    });
    if (angle !== 0) this.matter.body.setAngle(body, angle);
    const rect = this.add.rectangle(cx, y, width, height, 0x2244aa);
    rect.setAngle(Phaser.Math.RadToDeg(angle));
    const stripe = this.add.rectangle(cx, y - height / 2 + 1.5, width, 3, 0x4488ff, 0.4);
    stripe.setAngle(Phaser.Math.RadToDeg(angle));
  }

  _addBomb(x, y) {
    const r    = 20;
    const body = this.matter.add.circle(x, y, r, { isStatic: true, isSensor: true, label: 'bomb' });
    const g    = this.add.graphics().setDepth(6);
    g.fillStyle(0x220000, 1);
    g.fillCircle(x, y, r);
    g.lineStyle(3, 0xff2200, 1);
    g.strokeCircle(x, y, r);
    g.lineStyle(2, 0xff6600, 0.5);
    g.strokeCircle(x, y, r + 5);
    const emoji = this.add.text(x, y, '💣', { fontSize: '26px' }).setOrigin(0.5).setDepth(7);
    if (!this.bombs) this.bombs = [];
    this.bombs.push({ body, g, emoji, exploded: false });
  }

  _addSpinner({ x, y, len, speed }) {
    const bar = this.matter.add.rectangle(x, y, len, 16, { isStatic: true, label: 'obstacle', friction: 0, frictionStatic: 0, angle: 0 });
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
    const wall = this.matter.add.rectangle(x, y, w, h, { isStatic: true, label: 'obstacle', friction: 0, frictionStatic: 0 });
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

  _spawnRacers(spawnY) {
    const rng  = createRNG(this.seed);
    const y0   = spawnY ?? ZONE_GAME_Y + 80;
    this.racers = [];

    // All 50 countries shuffled each race
    const selected = rng.shuffle(COUNTRIES);

    // 10 columns × 5 rows = 50 slots; column width = (1080 - 2×WALL_T) / 10 = 104 px
    const COLS  = 10;
    const COL_W = (CANVAS_W - WALL_T * 2) / COLS;
    const ROW_H = 90;

    selected.forEach((country, i) => {
      const col     = i % COLS;
      const row     = Math.floor(i / COLS);
      const x       = WALL_T + COL_W * (col + 0.5) + rng.between(-5, 5);
      const spawnAt = y0 + row * ROW_H + rng.between(-8, 8);
      const vary    = rng.between(0.92, 1.08);
      this.racers.push(new CountryRacer(this, country, x, spawnAt, vary));
    });
  }



  _drawTrackBackground() {
    const g  = this.add.graphics().setDepth(0);
    const w  = CANVAS_W;
    const y0 = ZONE_GAME_Y;

    // ── Base bands (200 px each) — high-contrast alternation ──────────────────
    for (let i = 0; i * 200 < TRACK_H + 200; i++) {
      g.fillStyle(i % 2 === 0 ? 0x06091e : 0x0e0626, 1);
      g.fillRect(0, y0 + i * 200, w, 200);
    }

    // ── Bright electric grid lines every 100 px (very visible, clearly scroll) ─
    g.lineStyle(1, 0x0055ff, 0.55);
    for (let dy = 0; dy <= TRACK_H; dy += 100) {
      g.strokeLineShape(new Phaser.Geom.Line(WALL_T, y0 + dy, w - WALL_T, y0 + dy));
    }

    // ── Dense diagonal speed streaks — neon colours ────────────────────────────
    const streakPalette = [0x00ccff, 0xaa00ff, 0x0088ff, 0xff00aa, 0x00ffcc];
    let sx = 200;
    for (let dy = 0; dy < TRACK_H; dy += 38) {
      sx = (sx * 137 + 47) % (w - WALL_T * 3) + WALL_T;
      const col = streakPalette[Math.floor(dy / 38) % streakPalette.length];
      g.lineStyle(1, col, 0.45);
      g.strokeLineShape(new Phaser.Geom.Line(sx, y0 + dy, sx + 18, y0 + dy + 36));
    }

    // ── Glowing double side rails ──────────────────────────────────────────────
    // outer bright line + inner faint glow
    for (const rx of [WALL_T, w - WALL_T]) {
      g.lineStyle(4, 0x00ccff, 0.9);
      g.strokeLineShape(new Phaser.Geom.Line(rx, y0, rx, y0 + TRACK_H));
      g.lineStyle(8, 0x0055ff, 0.25);
      g.strokeLineShape(new Phaser.Geom.Line(rx, y0, rx, y0 + TRACK_H));
    }

    // ── Meter markers — colour-coded neon bands flash past as you race ─────────
    // colours shift blue → green → yellow → orange → red as finish approaches
    const markerColors = [
      0xffee00,  // 1000 m  ← halfway
      0xff1111,  // 500 m
    ];
    const trackMeters = TRACK_H / PX_PER_METER;
    [1000, 500].forEach((ml, idx) => {
      const worldY = y0 + (trackMeters - ml) * PX_PER_METER;
      const c      = markerColors[idx];
      const hex    = '#' + c.toString(16).padStart(6, '0');

      // glow fill behind the line
      g.fillStyle(c, 0.12);
      g.fillRect(WALL_T, worldY - 4, w - WALL_T * 2, 8);
      // bright line
      g.lineStyle(3, c, 0.9);
      g.strokeLineShape(new Phaser.Geom.Line(WALL_T, worldY, w - WALL_T, worldY));

      // label on both sides
      const style = { fontSize: '34px', fontFamily: 'Arial Black, sans-serif',
        color: hex, stroke: '#000000', strokeThickness: 3 };
      this.add.text(WALL_T + 14, worldY - 6, `${ml} m`, style).setOrigin(0, 1).setDepth(3);
      this.add.text(w - WALL_T - 14, worldY - 6, `${ml} m`, style).setOrigin(1, 1).setDepth(3);
    });

    // ── Finish line ────────────────────────────────────────────────────────────
    const finishY = y0 + TRACK_H;
    const sq      = 20;
    const cols    = Math.floor((w - WALL_T * 2) / sq);
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < 2; row++) {
        g.fillStyle((col + row) % 2 === 0 ? 0xffffff : 0x111111, 1);
        g.fillRect(WALL_T + col * sq, finishY - sq * 2 + row * sq, sq, sq);
      }
    }
    g.lineStyle(6, 0xffdd00, 1);
    g.strokeLineShape(new Phaser.Geom.Line(WALL_T, finishY - sq * 2, w - WALL_T, finishY - sq * 2));
    g.strokeLineShape(new Phaser.Geom.Line(WALL_T, finishY, w - WALL_T, finishY));
    this.add.text(w / 2, finishY - sq * 2 - 14, '🏁  FINISH LINE  🏁', {
      fontSize: '60px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffdd00', stroke: '#000000', strokeThickness: 7,
    }).setOrigin(0.5, 1).setDepth(5);

    // ── Start marker ───────────────────────────────────────────────────────────
    g.lineStyle(5, 0x44ff88, 1);
    g.strokeLineShape(new Phaser.Geom.Line(WALL_T, y0, w - WALL_T, y0));
    this.add.text(w / 2, y0 + 8, `🚦  ${TRACK_H / PX_PER_METER} m TO GO — RACE START  🚦`, {
      fontSize: '36px', fontFamily: 'Arial Black, sans-serif',
      color: '#44ff88', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(5);

    // ── Animated parallax speed layer (TileSprite, scrolls 2× faster) ─────────
    this._buildSpeedLayer();
  }

  _buildSpeedLayer() {
    // Generate a 1080×64 tile with diagonal neon dashes
    const tg = this.make.graphics({ add: false });
    tg.fillStyle(0x000000, 0);
    tg.fillRect(0, 0, CANVAS_W, 64);
    const lineData = [
      { step: 90, color: 0x0044ff, alpha: 0.35 },
      { step: 130, color: 0x6600cc, alpha: 0.25 },
      { step: 60,  color: 0x00aaff, alpha: 0.2  },
    ];
    lineData.forEach(({ step, color, alpha }) => {
      tg.lineStyle(1, color, alpha);
      for (let bx = -64; bx < CANVAS_W + 64; bx += step) {
        tg.strokeLineShape(new Phaser.Geom.Line(bx, 0, bx + 64, 64));
      }
    });
    tg.generateTexture('speed_tile', CANVAS_W, 64);
    tg.destroy();

    // TileSprite sits at a fixed screen position (scrollFactor 0)
    // World position (0, 0) with viewport at y=ZONE_GAME_Y → renders at top of game zone
    this._speedLayer = this.add.tileSprite(0, 0, CANVAS_W, ZONE_GAME_H, 'speed_tile')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1)
      .setAlpha(0.55);
  }

  update(time, delta) {
    this._lastTime = time;
    this.racers?.forEach(r => r.update());

    if (!this.raceManager?.isPhysicsActive()) return;

    const alive = this.racers?.filter(r => r.alive && r.body) ?? [];

    // ── Camera follow ──────────────────────────────────────────────────────────
    if (alive.length > 0) {
      const leader = alive.reduce((best, r) =>
        r.body.position.y > best.body.position.y ? r : best
      );

      // Position-based finish check (backup for sensor miss at high speed)
      if (!this._raceFinished && leader.body.position.y >= ZONE_GAME_Y + TRACK_H - RACER_RADIUS) {
        this._raceFinished = true;
        EventBus.emit('WINNER_DECLARED', { country: leader.country });
      }

      // Smooth lerp: keep leader ~48% from top so empty space is visible above
      const targetScrollY = Phaser.Math.Clamp(
        leader.body.position.y - ZONE_GAME_H * 0.48,
        ZONE_GAME_Y,
        ZONE_GAME_Y + TRACK_H - ZONE_GAME_H
      );
      const cam = this.cameras.main;
      cam.setScroll(0, Phaser.Math.Linear(cam.scrollY, targetScrollY, 0.08));

      // Speed layer scrolls at 2× camera rate → parallax depth illusion
      if (this._speedLayer) {
        this._speedLayer.tilePositionY = (cam.scrollY - ZONE_GAME_Y) * 2;
      }

      // Emit distance remaining for the HUD overlay (UIScene listens)
      const metersLeft = Math.max(0, Math.round(
        (ZONE_GAME_Y + TRACK_H - leader.body.position.y) / PX_PER_METER
      ));
      EventBus.emit('RACE_PROGRESS', { metersLeft });
    }

    // ── Bar sliding ────────────────────────────────────────────────────────────
    alive.forEach(r => {
      if (!r._onBar) return;
      const { barBody, barInfo, savedVy } = r._onBar;
      const dir   = r._onBar.dir;
      const halfW = barInfo.width / 2;
      const barCx = barInfo.cx;

      // Slide the ball along the bar top; override frictionAir each frame
      this.matter.body.setVelocity(r.body, { x: dir * BAR_SLIDE_SPEED, y: 0 });

      // Hit left wall → switch to rightward slide
      if (dir === -1 && r.body.position.x <= WALL_T + RACER_RADIUS + 6) {
        r._onBar.dir = 1;
      }
      // Hit right wall → switch to leftward slide
      if (dir === 1 && r.body.position.x >= CANVAS_W - WALL_T - RACER_RADIUS - 6) {
        r._onBar.dir = -1;
      }

      // Ball past bar edge → release and resume falling
      const pastLeft  = r.body.position.x < barCx - halfW - RACER_RADIUS * 0.5;
      const pastRight = r.body.position.x > barCx + halfW + RACER_RADIUS * 0.5;
      if ((dir === -1 && pastLeft) || (dir === 1 && pastRight)) {
        delete r._onBar;
        this.matter.body.setVelocity(r.body, { x: 0, y: savedVy });
      }
    });

    // ── Anti-stuck: minimum vy (skip bar-sliding balls) ───────────────────────
    alive.forEach(r => {
      if (r._onBar) return;
      if (r.body.velocity.y < 3) {
        this.matter.body.setVelocity(r.body, { x: r.body.velocity.x, y: 3 });
      }
    });

    // ── Anti-stuck: teleport check every 800 ms (skip bar-sliding balls) ──────
    this._progressAccum = (this._progressAccum ?? 0) + delta;
    if (this._progressAccum >= 800) {
      this._progressAccum = 0;
      alive.forEach(r => {
        if (r._onBar) { r._prevY = r.body.position.y; return; }
        const prevY = r._prevY ?? r.body.position.y;
        if (r.body.position.y - prevY < 20) {
          this.matter.body.setPosition(r.body, { x: r.body.position.x, y: r.body.position.y + 30 });
          this.matter.body.setVelocity(r.body, { x: (Math.random() - 0.5) * 3, y: 10 });
        }
        r._prevY = r.body.position.y;
      });
    }
  }
}
