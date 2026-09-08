import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ZONE_HEADER_H, ZONE_BOARD_H, ZONE_GAME_Y, ZONE_GAME_H, ZONE_COMMENT_Y } from '../constants.js';
import { EventBus } from '../utils/eventBus.js';

export class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene', active: false }); }

  create() {
    this._drawHeader();
    this._drawLeaderboardZone();
    this._drawCommentaryZone();
    this._setupEventListeners();
  }

  _drawHeader() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0d0820, 0x0d0820, 0x1a0f3a, 0x1a0f3a, 1);
    g.fillRect(0, 0, CANVAS_W, ZONE_HEADER_H);
    g.lineStyle(2, 0x4422aa, 0.8);
    g.strokeRect(0, 0, CANVAS_W, ZONE_HEADER_H);

    this.add.text(CANVAS_W / 2, ZONE_HEADER_H * 0.4, 'WORLD CHAOS RACING', {
      fontSize: '64px', fontFamily: 'Arial Black, Impact, sans-serif',
      color: '#ffffff', stroke: '#4422aa', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#8844ff', blur: 20, fill: true }
    }).setOrigin(0.5);

    this.add.text(80, ZONE_HEADER_H * 0.78, '🔴  LIVE', {
      fontSize: '32px', fontFamily: 'Arial, sans-serif', color: '#ff4444',
      backgroundColor: '#330000', padding: { x: 12, y: 4 }
    }).setOrigin(0, 0.5);

    this.raceNumText = this.add.text(CANVAS_W - 80, ZONE_HEADER_H * 0.78, 'RACE #001', {
      fontSize: '32px', fontFamily: 'Arial Black, sans-serif', color: '#aaaaff'
    }).setOrigin(1, 0.5);
  }

  _drawLeaderboardZone() {
    const y = ZONE_HEADER_H;
    const h = ZONE_BOARD_H;
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a1520, 0x0a1520, 0x0f1f10, 0x0f1f10, 1);
    g.fillRect(0, y, CANVAS_W, h);
    g.lineStyle(1, 0x2a4a2a, 0.6);
    g.strokeRect(0, y, CANVAS_W, h);

    this.add.text(CANVAS_W / 2, y + 20, "🏆 TODAY'S CHAMPIONS", {
      fontSize: '28px', fontFamily: 'Arial Black, sans-serif', color: '#88cc44'
    }).setOrigin(0.5, 0);

    this.leaderboardRows = [];
    const medals = ['🥇','🥈','🥉'];
    for (let i = 0; i < 3; i++) {
      const rowY = y + 56 + i * 60;
      const t = this.add.text(60, rowY, `${medals[i]}  —`, {
        fontSize: '36px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa'
      }).setOrigin(0, 0.5);
      this.leaderboardRows.push(t);
    }
  }

  _drawCommentaryZone() {
    const y = ZONE_COMMENT_Y;
    const g = this.add.graphics();
    g.fillGradientStyle(0x08080f, 0x08080f, 0x0f0f1a, 0x0f0f1a, 1);
    g.fillRect(0, y, CANVAS_W, CANVAS_H - y);
    g.lineStyle(1, 0x223344, 0.8);
    g.strokeRect(0, y, CANVAS_W, CANVAS_H - y);

    this.add.text(40, y + 18, '🎙  LIVE COMMENTARY', {
      fontSize: '26px', fontFamily: 'Arial Black, sans-serif', color: '#5566aa'
    });

    this.commentaryText = this.add.text(CANVAS_W / 2, y + 80, '', {
      fontSize: '38px', fontFamily: 'Arial, sans-serif', color: '#ddeeff',
      wordWrap: { width: CANVAS_W - 80 }, align: 'center'
    }).setOrigin(0.5, 0);

    this.remainText = this.add.text(CANVAS_W / 2, CANVAS_H - 40, 'REMAINING: 12 / 12', {
      fontSize: '32px', fontFamily: 'Arial Black, sans-serif', color: '#cc88ff'
    }).setOrigin(0.5, 1);
  }

  _setupEventListeners() {
    // Listeners wired in later tasks — stub for now
  }

  setRaceNumber(n) {
    if (this.raceNumText) this.raceNumText.setText(`RACE #${String(n).padStart(3, '0')}`);
  }

  setCommentary(text) {
    if (this.commentaryText) this.commentaryText.setText(`"${text}"`);
  }

  setRemaining(current, total) {
    if (this.remainText) this.remainText.setText(`REMAINING: ${current} / ${total}`);
  }
}
