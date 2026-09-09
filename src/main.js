import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, GRAVITY_Y } from './constants.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene }   from './scenes/UIScene.js';

new Phaser.Game({
  type: Phaser.CANVAS,
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: '#08090f',
  parent: 'game-container',
  physics: {
    default: 'matter',
    matter: { gravity: { x: 0, y: GRAVITY_Y }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene, UIScene]
});
