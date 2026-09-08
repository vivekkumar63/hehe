import Phaser from 'phaser';

export class Hole {
  constructor(scene, x, y, width) {
    this.scene = scene;
    this.width = width;

    // Sensor body — overlaps without physical collision
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

    // Red danger glow border
    g.lineStyle(3, 0xff2200, 0.9);
    g.strokeRect(x - width / 2, y - 24, width, 48);

    // Warning stripes (alternating)
    const stripeW = 16;
    for (let sx = x - width / 2; sx < x + width / 2; sx += stripeW * 2) {
      g.fillStyle(0xff2200, 0.35);
      g.fillRect(sx, y - 24, stripeW, 48);
    }

    // Skull icon
    scene.add.text(x, y, '☠', {
      fontSize: '28px', color: '#ff4400'
    }).setOrigin(0.5).setDepth(6);
  }
}
