import Phaser from 'phaser';
import { RACER_RADIUS } from '../constants.js';
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
