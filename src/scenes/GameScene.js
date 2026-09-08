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

    // Expose holes array for future tasks
    this.holes = [];
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
}
