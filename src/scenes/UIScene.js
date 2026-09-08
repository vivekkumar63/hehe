import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ZONE_HEADER_H, ZONE_BOARD_H, ZONE_GAME_Y, ZONE_GAME_H, ZONE_COMMENT_Y } from '../constants.js';
import { EventBus } from '../utils/eventBus.js';
import { ScoreManager } from '../game/ScoreManager.js';
import { COUNTRIES } from '../data/countries.js';

export class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene', active: false }); }

  create() {
    this._drawHeader();
    this._drawLeaderboardZone();
    this._drawCommentaryZone();
    this._unsubs = this._setupEventListeners();
    this.scores = new ScoreManager();
    this._countriesMap = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
    this.updateLeaderboard();
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
    return [
      EventBus.on('COUNTDOWN',          ({ value })   => this._showCountdown(value)),
      EventBus.on('RACE_PREP',          ({ raceNumber }) => { this.setRaceNumber(raceNumber); this.updateLeaderboard(); }),
      EventBus.on('COUNTRY_ELIMINATED', ({ country, remaining, total }) => {
        this.setRemaining(remaining, total);
        this.showEliminationCard(country);
      }),
      EventBus.on('WINNER_CELEBRATED',  ({ country }) => { this._showWinner(country); this.updateLeaderboard(); }),
      EventBus.on('FINAL_N',            ({ n })       => this._showFinalN(n)),
    ];
  }

  shutdown() {
    this._unsubs?.forEach(u => u());
    this._unsubs = [];
  }

  _showCountdown(value) {
    const cx = CANVAS_W / 2;
    const cy = ZONE_GAME_Y + ZONE_GAME_H / 2;
    const isGo = value === 'GO!';

    const txt = this.add.text(cx, cy, String(value), {
      fontSize: isGo ? '180px' : '220px',
      fontFamily: 'Arial Black, Impact, sans-serif',
      color: isGo ? '#44ff88' : '#ffffff',
      stroke: isGo ? '#006622' : '#330066',
      strokeThickness: 12,
      shadow: { offsetX: 0, offsetY: 0, color: isGo ? '#00ff44' : '#8844ff', blur: 40, fill: true }
    }).setOrigin(0.5).setDepth(100).setAlpha(0);

    this.tweens.add({
      targets: txt, alpha: 1, scaleX: 1.3, scaleY: 1.3,
      duration: 200, ease: 'Back.out',
      onComplete: () => {
        this.tweens.add({
          targets: txt, alpha: 0, scaleX: 0.8, scaleY: 0.8,
          duration: 500, delay: isGo ? 300 : 500,
          onComplete: () => txt.destroy()
        });
      }
    });
  }

  _showFinalN(n) {
    const labels = { 5: 'FINAL FIVE!', 3: 'FINAL THREE!', 2: 'FINAL TWO!' };
    const colors = { 5: '#ffaa00', 3: '#ff6600', 2: '#ff2200' };
    const txt = this.add.text(CANVAS_W / 2, ZONE_GAME_Y + ZONE_GAME_H * 0.15,
      labels[n] ?? `FINAL ${n}!`, {
        fontSize: '96px', fontFamily: 'Arial Black, sans-serif',
        color: colors[n] ?? '#ff4400',
        stroke: '#000000', strokeThickness: 8,
        shadow: { color: colors[n] ?? '#ff4400', blur: 30, fill: true }
      }).setOrigin(0.5).setDepth(90).setAlpha(0);

    this.tweens.chain({ tweens: [
      { targets: txt, alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 300, ease: 'Back.out' },
      { targets: txt, alpha: 1, duration: 1500 },
      { targets: txt, alpha: 0, duration: 400, onComplete: () => txt.destroy() }
    ]});
  }

  _showWinner(country) {
    const cx = CANVAS_W / 2;
    const cy = ZONE_GAME_Y + ZONE_GAME_H * 0.4;

    const overlay = this.add.graphics().setDepth(98);
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, ZONE_GAME_Y, CANVAS_W, ZONE_GAME_H);

    this.add.text(cx, cy - 80, '🏆  WINNER', {
      fontSize: '90px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffdd00', stroke: '#885500', strokeThickness: 8,
      shadow: { color: '#ffaa00', blur: 40, fill: true }
    }).setOrigin(0.5).setDepth(99);

    this.add.text(cx, cy + 40, country.emoji + '  ' + country.name, {
      fontSize: '110px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5).setDepth(99);
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

  updateLeaderboard() {
    const top    = this.scores.getTopToday(3);
    const medals = ['🥇','🥈','🥉'];
    this.leaderboardRows?.forEach((row, i) => {
      const entry = top[i];
      if (entry) {
        const c = this._countriesMap[entry.id];
        row.setText(`${medals[i]}  ${c?.emoji ?? ''} ${c?.name ?? entry.id}   ${entry.wins} WINS`);
        row.setColor('#ffffff');
      } else {
        row.setText(`${medals[i]}  —`);
        row.setColor('#555577');
      }
    });
  }

  showEliminationCard(country) {
    this._elimCardTween?.stop();
    this._elimCardTargets?.forEach(t => { try { t.destroy(); } catch {} });
    this._elimCardTargets = null;
    this._elimCardTween   = null;

    const cx = CANVAS_W / 2;
    const cy = ZONE_GAME_Y + ZONE_GAME_H * 0.2;

    const bg = this.add.graphics().setDepth(95);
    bg.fillStyle(0x1a0000, 0.92);
    bg.fillRoundedRect(cx - 260, cy - 50, 520, 120, 16);
    bg.lineStyle(2, 0xff2200, 0.8);
    bg.strokeRoundedRect(cx - 260, cy - 50, 520, 120, 16);

    const label = this.add.text(cx, cy - 20, 'ELIMINATED', {
      fontSize: '32px', fontFamily: 'Arial Black, sans-serif', color: '#ff4400'
    }).setOrigin(0.5).setDepth(96);

    const name = this.add.text(cx, cy + 30, `${country.emoji}  ${country.name}`, {
      fontSize: '52px', fontFamily: 'Arial Black, sans-serif', color: '#ffffff'
    }).setOrigin(0.5).setDepth(96);

    const targets = [bg, label, name];
    targets.forEach(t => t.setAlpha(0));

    this._elimCardTargets = targets;
    this._elimCardTween   = this.tweens.chain({ tweens: [
      { targets, alpha: 1, duration: 200 },
      { targets, alpha: 1, duration: 1800 },
      { targets, alpha: 0, duration: 300, onComplete: () => {
        targets.forEach(t => t.destroy());
        this._elimCardTargets = null;
        this._elimCardTween   = null;
      }}
    ]});
  }
}
