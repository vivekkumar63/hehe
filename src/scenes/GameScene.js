import Phaser from 'phaser';
export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create() { this.scene.launch('UIScene'); }
}
