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
      restitution: 0.5 * physicsVariation,  // elastic bounce
      friction:    0,                        // zero friction — nothing to grip onto
      frictionAir: 0.139,                   // air drag → terminal velocity ~18 px/frame (~60 m/s)
      density:     0.002 * physicsVariation,
      label:       `racer_${country.id}`,
      collisionFilter: { category: 0x0001, mask: 0xFFFF }
    });

    // Visuals — layered Phaser objects
    const d = RACER_RADIUS * 2;

    // Stripe image (rotates with body angle each frame)
    this.stripeImg = scene.add.image(x, y, `stripe_${country.id}`)
      .setDisplaySize(d, d)
      .setDepth(10);

    // Shading overlay (fixed rotation — creates sphere illusion)
    this.shadingImg = scene.add.image(x, y, 'sphere_shading')
      .setDisplaySize(d, d)
      .setDepth(11);

    // Country name label below the ball
    this.label = scene.add.text(x, y + RACER_RADIUS + 14, country.name, {
      fontSize: '20px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(12);

    // Outer glow ring
    this.glow = scene.add.graphics().setDepth(9);
    this._drawGlow(x, y);
  }

  _drawGlow(x, y) {
    this.glow.clear();
    this.glow.lineStyle(3, parseInt(this.country.accent.replace('#', ''), 16), 0.7);
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
    this.scene.tweens.add({
      targets: [this.stripeImg, this.shadingImg, this.label, this.glow],
      alpha: 0, duration: 600, ease: 'Power2',
      onComplete: () => this.destroy()
    });
  }

  destroy() {
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }
    [this.stripeImg, this.shadingImg, this.label, this.glow].forEach(o => o?.destroy());
  }
}
