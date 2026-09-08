import Phaser from 'phaser';
import { RACER_RADIUS } from '../constants.js';
import { COUNTRIES } from '../data/countries.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this._queueSphereShading();
    COUNTRIES.forEach(c => this._queueStripeTexture(c));
  }

  create() {
    this.scene.start('GameScene');
  }

  _queueStripeTexture(country) {
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
    this.load.image(`stripe_${country.id}`, cv.toDataURL('image/png'));
  }

  _queueSphereShading() {
    const d = RACER_RADIUS * 2;
    const r = RACER_RADIUS;
    const cv = document.createElement('canvas');
    cv.width = cv.height = d;
    const ctx = cv.getContext('2d');

    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.clip();

    const limb = ctx.createRadialGradient(r, r, r * 0.55, r, r, r);
    limb.addColorStop(0, 'rgba(0,0,0,0)');
    limb.addColorStop(0.85, 'rgba(0,0,0,0)');
    limb.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = limb;
    ctx.fillRect(0, 0, d, d);

    const shadow = ctx.createRadialGradient(r, r * 1.55, 0, r, r * 1.55, r * 0.95);
    shadow.addColorStop(0, 'rgba(0,0,0,0.5)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, d, d);

    const spec = ctx.createRadialGradient(r * 0.62, r * 0.38, 0, r * 0.62, r * 0.38, r * 0.65);
    spec.addColorStop(0, 'rgba(255,255,255,0.58)');
    spec.addColorStop(0.45, 'rgba(255,255,255,0.10)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fillRect(0, 0, d, d);

    ctx.restore();
    this.load.image('sphere_shading', cv.toDataURL('image/png'));
  }
}
