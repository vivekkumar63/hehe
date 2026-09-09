import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H, ZONE_HEADER_H, ZONE_BOARD_H, ZONE_GAME_Y, ZONE_GAME_H, ZONE_COMMENT_Y, TRACK_H, PX_PER_METER } from '../constants.js';
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
    this._initTTS(); // async — loads meSpeak in background, ready before first commentary fires
    this.scores = new ScoreManager();
    this._countriesMap = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
    this.updateLeaderboard();

    this._buildDistanceHUD();
    this._buildTimerHUD();

    this._debugMode  = new URLSearchParams(location.search).has('debug');
    this._streamMode = new URLSearchParams(location.search).has('stream');

    if (this._debugMode) this._buildDebugOverlay();
    this.input.keyboard.on('keydown-D', () => {
      this._debugMode = !this._debugMode;
      if (this._debugMode && !this.debugFps) {
        this._buildDebugOverlay();
      } else {
        [this._debugBg, this.debugFps, this.debugSeed, this.debugRace]
          .forEach(t => t?.setVisible(this._debugMode));
      }
    });
    this.input.keyboard.on('keydown-S', () => {
      this._streamMode = !this._streamMode;
    });
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

    // Background
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a1520, 0x0a1520, 0x0f1f10, 0x0f1f10, 1);
    g.fillRect(0, y, CANVAS_W, h);

    // Outer border rectangle
    g.lineStyle(3, 0x44cc44, 0.9);
    g.strokeRect(6, y + 6, CANVAS_W - 12, h - 12);
    // Inner accent
    g.lineStyle(1, 0x88ff44, 0.35);
    g.strokeRect(12, y + 12, CANVAS_W - 24, h - 24);

    // Title bar
    g.fillStyle(0x112211, 1);
    g.fillRect(6, y + 6, CANVAS_W - 12, 44);

    this.add.text(CANVAS_W / 2, y + 28, "🏆  TODAY'S CHAMPIONS  🏆", {
      fontSize: '26px', fontFamily: 'Arial Black, sans-serif', color: '#88ff44',
      stroke: '#003300', strokeThickness: 3,
    }).setOrigin(0.5, 0.5);

    // Three visible row slots inside the box
    this.leaderboardRows = [];
    for (let i = 0; i < 3; i++) {
      const rowY = y + 68 + i * 62;
      const t = this.add.text(CANVAS_W / 2, rowY, '', {
        fontSize: '34px', fontFamily: 'Arial, sans-serif', color: '#aaaaaa',
      }).setOrigin(0.5, 0.5);
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

  _buildDistanceHUD() {
    // Distance-remaining pill — top-right corner of the game zone
    const x = CANVAS_W - 24;
    const y = ZONE_GAME_Y + 24;

    const bg = this.add.graphics().setDepth(48);
    bg.fillStyle(0x000000, 0.55);
    bg.fillRoundedRect(x - 210, y, 210, 80, 12);

    this.distanceLabelText = this.add.text(x - 14, y + 10, 'TO FINISH', {
      fontSize: '20px', fontFamily: 'Arial Black, sans-serif', color: '#aaaacc',
    }).setOrigin(1, 0).setDepth(50);

    this.distanceText = this.add.text(x - 14, y + 34, '1500 m', {
      fontSize: '38px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffdd00', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(1, 0).setDepth(50);
  }

  _buildTimerHUD() {
    const x = 24;
    const y = ZONE_GAME_Y + 24;
    const bg = this.add.graphics().setDepth(48);
    bg.fillStyle(0x000000, 0.55);
    bg.fillRoundedRect(x, y, 210, 80, 12);
    this.add.text(x + 14, y + 10, 'TIME LEFT', {
      fontSize: '20px', fontFamily: 'Arial Black, sans-serif', color: '#aaaacc',
    }).setOrigin(0, 0).setDepth(50);
    this.timerText = this.add.text(x + 14, y + 34, '5:00', {
      fontSize: '38px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff8800', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0, 0).setDepth(50);
  }

  _setupEventListeners() {
    return [
      EventBus.on('COUNTDOWN',          ({ value })   => this._showCountdown(value)),
      EventBus.on('RACE_PREP',          ({ raceNumber }) => { this.setRaceNumber(raceNumber); this.updateLeaderboard(); this._showYTCallToAction(); }),
      EventBus.on('RACE_TIMER', ({ remaining }) => {
        if (!this.timerText) return;
        if (remaining === null) { this.timerText.setText('--:--'); return; }
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        this.timerText.setText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        this.timerText.setColor(remaining <= 60 ? '#ff2200' : '#ff8800');
      }),
      EventBus.on('COUNTRY_ELIMINATED', ({ country, remaining, total }) => {
        this.setRemaining(remaining, total);
        this.showEliminationCard(country);
      }),
      EventBus.on('WINNER_CELEBRATED',  ({ country }) => { this._showWinner(country); this.updateLeaderboard(); }),
      EventBus.on('FINAL_N',            ({ n })       => this._showFinalN(n)),
      EventBus.on('RACE_PROGRESS', ({ metersLeft }) => {
        if (this.distanceText) this.distanceText.setText(`${metersLeft} m`);
      }),
      EventBus.on('CHAOS_EVENT',  ({ label }) => this._showChaosEvent(label)),
      EventBus.on('DARKNESS_ON',  () => this._setDarkness(true)),
      EventBus.on('DARKNESS_OFF', () => this._setDarkness(false)),
      EventBus.on('RACE_STARTED', () => this._startMidRaceCta()),
      EventBus.on('INTERMISSION_START', () => this._stopMidRaceCta()),
    ];
  }

  shutdown() {
    this._unsubs?.forEach(u => u());
    this._unsubs = [];
    this._lbTimer?.remove();
    this._lbTimer = null;
    this._stopMidRaceCta();
    this._ttsCancel();
    if (this._ttsCtx) { this._ttsCtx.close(); this._ttsCtx = null; }
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
    this._speak(text);
  }

  async _initTTS() {
    this._ttsVoice  = null;
    this._ttsNode   = null;
    this._ttsEngine = 'webspeech'; // fallback default

    // Dedicated AudioContext for TTS — same mechanism as beep sounds (works in OBS)
    try { this._ttsCtx = new AudioContext(); } catch { this._ttsCtx = null; }

    // Primary: meSpeak — bundled eSpeak, no network, plays via Web Audio API
    try {
      const [{ default: meSpeak }, configMod, voiceMod] = await Promise.all([
        import('mespeak'),
        import('mespeak/src/mespeak_config.json'),
        import('mespeak/voices/en/en-us.json'),
      ]);
      meSpeak.loadConfig(configMod.default ?? configMod);
      meSpeak.loadVoice(voiceMod.default ?? voiceMod);
      this._meSpeak   = meSpeak;
      this._ttsEngine = 'mespeak';
    } catch {
      // Fallback: Web Speech API (works in regular Chrome/Edge, not OBS)
      if (window.speechSynthesis) {
        const pick = () => {
          const voices = window.speechSynthesis.getVoices();
          if (!voices.length) return;
          this._ttsVoice =
            voices.find(v => /en[-_]US/i.test(v.lang) && /david|mark|guy|male/i.test(v.name)) ||
            voices.find(v => /en/i.test(v.lang)) || null;
        };
        window.speechSynthesis.addEventListener('voiceschanged', pick);
        pick();
      }
    }
  }

  _ttsCancel() {
    try { this._ttsNode?.stop(); } catch {}
    this._ttsNode = null;
    window.speechSynthesis?.cancel?.();
  }

  _speak(text) {
    if (this._ttsPriority) return;
    this._ttsCancel();
    this._ttsPlay(text);
  }

  _speakPriority(text) {
    this._ttsCancel();
    this._ttsPriority = true;
    this._ttsPlay(text, () => { this._ttsPriority = false; });
  }

  _ttsPlay(text, onEnd) {
    // meSpeak: local eSpeak synthesis → AudioBuffer → Web Audio API → OBS captures it
    if (this._ttsEngine === 'mespeak' && this._meSpeak && this._ttsCtx) {
      try {
        const wavBuf = this._meSpeak.speak(text, {
          rawdata: 'buffer', speed: 165, pitch: 52, wordgap: 1,
        });
        if (wavBuf) {
          this._ttsCtx.decodeAudioData(wavBuf.slice(0)).then(decoded => {
            const src = this._ttsCtx.createBufferSource();
            src.buffer  = decoded;
            src.connect(this._ttsCtx.destination);
            this._ttsNode = src;
            if (onEnd) src.onended = onEnd;
            src.start();
          }).catch(() => onEnd?.());
          return;
        }
      } catch { onEnd?.(); return; }
    }

    // Web Speech API (regular browsers only)
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15; u.pitch = 1.1; u.volume = 1.0;
      if (this._ttsVoice) u.voice = this._ttsVoice;
      if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
      window.speechSynthesis.speak(u);
    }
  }

  setRemaining(current, total) {
    if (this.remainText) this.remainText.setText(`REMAINING: ${current} / ${total}`);
  }

  updateLeaderboard() {
    // Stop any running cycle
    this._lbTimer?.remove();
    this._lbTimer = null;

    const all    = this.scores.getTopToday(50);
    const medals = ['🥇', '🥈', '🥉'];
    const PAGE   = 3;

    const renderPage = (page) => {
      const offset = page * PAGE;
      this.leaderboardRows?.forEach((row, i) => {
        const entry = all[offset + i];
        if (entry) {
          const c    = this._countriesMap[entry.id];
          const rank = offset + i;
          const badge = rank < 3 ? medals[rank] : `#${rank + 1}`;
          const wins  = entry.wins === 1 ? '1 WIN' : `${entry.wins} WINS`;
          row.setText(`${badge}  ${c?.emoji ?? ''} ${c?.name ?? entry.id}   ${wins}`);
          row.setColor(rank === 0 ? '#ffd700' : rank === 1 ? '#cccccc' : rank === 2 ? '#cd7f32' : '#aaddff');
        } else {
          row.setText('');
        }
      });
    };

    renderPage(0);

    const numPages = Math.ceil(all.length / PAGE);
    if (numPages < 2) return;

    let page = 0;
    this._lbTimer = this.time.addEvent({
      delay: 2500,
      repeat: -1,
      callback: () => {
        // Fade out current rows
        this.tweens.add({
          targets: this.leaderboardRows, alpha: 0, duration: 220,
          onComplete: () => {
            page = (page + 1) % numPages;
            renderPage(page);
            this.tweens.add({ targets: this.leaderboardRows, alpha: 1, duration: 220 });
          },
        });
      },
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

  _showChaosEvent(label) {
    const cx = CANVAS_W / 2;
    const cy = ZONE_GAME_Y + ZONE_GAME_H * 0.1;
    const txt = this.add.text(cx, cy, label, {
      fontSize: '88px', fontFamily: 'Arial Black, sans-serif',
      color: '#ff8800', stroke: '#330000', strokeThickness: 10,
      shadow: { color: '#ff4400', blur: 40, fill: true }
    }).setOrigin(0.5).setDepth(92).setAlpha(0);

    this.tweens.chain({ tweens: [
      { targets: txt, alpha: 1, scaleX: 1.3, scaleY: 1.3, duration: 300, ease: 'Back.out' },
      { targets: txt, alpha: 1, duration: 1200 },
      { targets: txt, alpha: 0, duration: 500, onComplete: () => txt.destroy() }
    ]});
  }

  _setDarkness(on) {
    if (on) {
      this._darknessOverlay = this.add.graphics().setDepth(85);
      this._darknessOverlay.fillStyle(0x000000, 0.92);
      this._darknessOverlay.fillRect(0, ZONE_GAME_Y, CANVAS_W, ZONE_GAME_H);
    } else {
      this._darknessOverlay?.destroy();
      this._darknessOverlay = null;
    }
  }

  _showYTCallToAction() {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    const D  = 160;

    // ── Background panel ─────────────────────────────────────────────────────
    const panelW = 980, panelH = 580;
    const px = cx - panelW / 2, py = cy - panelH / 2;

    const bg = this.add.graphics().setDepth(D).setAlpha(0);
    bg.fillStyle(0x0a0a0a, 0.96);
    bg.fillRoundedRect(px, py, panelW, panelH, 28);
    bg.fillStyle(0xff0000, 1);
    bg.fillRoundedRect(px, py, panelW, 10, 4);          // top red stripe
    bg.fillRoundedRect(px, py + panelH - 10, panelW, 10, 4); // bottom red stripe
    bg.lineStyle(5, 0xff0000, 0.9);
    bg.strokeRoundedRect(px, py, panelW, panelH, 28);

    // ── Header ────────────────────────────────────────────────────────────────
    const header = this.add.text(cx, cy - 225, '❤️  SHOW SOME LOVE!  ❤️', {
      fontSize: '56px', fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff', stroke: '#cc0000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(D + 1).setAlpha(0);

    // ── Four CTA rows — each its own line ────────────────────────────────────
    const defs = [
      { text: '👍  LIKE',       color: '#ffd700' },
      { text: '💬  COMMENT',    color: '#44ddff' },
      { text: '↗️  SHARE',      color: '#88ff88' },
      { text: '🔔  SUBSCRIBE',  color: '#ff4444' },
    ];
    const rowObjs = defs.map((d, i) =>
      this.add.text(cx, cy - 100 + i * 100, d.text, {
        fontSize: '76px', fontFamily: 'Arial Black, sans-serif',
        color: d.color, stroke: '#000000', strokeThickness: 8,
      }).setOrigin(0.5).setDepth(D + 1).setAlpha(0)
    );

    // ── Entrances ────────────────────────────────────────────────────────────
    this.tweens.add({ targets: bg, alpha: 1, duration: 280 });

    this.time.delayedCall(180, () =>
      this.tweens.add({ targets: header, alpha: 1, duration: 280 })
    );

    rowObjs.forEach((obj, i) => {
      this.time.delayedCall(350 + i * 200, () => {
        obj.setScale(1.3);
        this.tweens.add({
          targets: obj, alpha: 1, scaleX: 1, scaleY: 1,
          duration: 380, ease: 'Back.out(2.2)',
        });
      });
    });

    // ── Pulse once after all rows are in ─────────────────────────────────────
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: rowObjs, scaleX: 1.08, scaleY: 1.08,
        duration: 130, yoyo: true, ease: 'Sine.inOut',
      });
    });

    // ── Exit at 4.8s (countdown begins at 5.2s) ──────────────────────────────
    const all = [bg, header, ...rowObjs];
    this.time.delayedCall(4800, () => {
      this.tweens.add({
        targets: all, alpha: 0, duration: 350, ease: 'Power2.in',
        onComplete: () => all.forEach(o => o.destroy()),
      });
    });
  }

  _startMidRaceCta() {
    this._stopMidRaceCta();
    this._midRaceTimer = this.time.addEvent({
      delay: 60000, repeat: -1,
      callback: () => this._flashMidRaceCta(),
    });
  }

  _stopMidRaceCta() {
    this._midRaceTimer?.remove();
    this._midRaceTimer = null;
  }

  _flashMidRaceCta() {
    if (this._midRaceCtaActive) return;
    this._midRaceCtaActive = true;

    const cx   = CANVAS_W / 2;
    const banH = 330;
    const banY = ZONE_GAME_Y + ZONE_GAME_H - banH;
    const D    = 155;

    // Semi-transparent background — game remains visible through it
    const bg = this.add.graphics().setDepth(D).setAlpha(0);
    bg.fillStyle(0x000000, 0.62);
    bg.fillRect(0, banY, CANVAS_W, banH);
    bg.fillStyle(0xff0000, 1);
    bg.fillRect(0, banY, CANVAS_W, 6);
    bg.fillRect(0, banY + banH - 6, CANVAS_W, 6);

    // Three items stacked on separate lines
    const defs = [
      { text: '👍  LIKE',      color: '#ffd700' },
      { text: '↗️  SHARE',     color: '#88ff88' },
      { text: '🔔  SUBSCRIBE', color: '#ff5555' },
    ];
    const txtObjs = defs.map((d, i) =>
      this.add.text(cx, banY + 75 + i * 95, d.text, {
        fontSize: '72px', fontFamily: 'Arial Black, sans-serif',
        color: d.color, stroke: '#000000', strokeThickness: 7,
      }).setOrigin(0.5, 0.5).setDepth(D + 1).setAlpha(0)
    );

    const all = [bg, ...txtObjs];

    // Fade in
    this.tweens.add({ targets: all, alpha: 1, duration: 280 });

    // Stagger scale-punch on text items
    txtObjs.forEach((obj, i) => {
      obj.setScale(1.25);
      this.time.delayedCall(i * 130, () =>
        this.tweens.add({ targets: obj, scaleX: 1, scaleY: 1, duration: 320, ease: 'Back.out(2)' })
      );
    });

    // Speak a polite reminder
    const phrases = [
      "If you are enjoying the show, please like, share, and subscribe!",
      "Hey, your support means everything — please like, share, and subscribe!",
      "Enjoying World Chaos Racing? Please hit that like button and subscribe for more!",
      "Don't forget to like, share, and subscribe if you are having fun!",
      "We would love your support — please like, share, and subscribe!",
      "A quick reminder to like, share, and subscribe — it really helps us out!",
      "If you are loving the chaos, please like, share, and subscribe!",
    ];
    this._speakPriority(phrases[Math.floor(Math.random() * phrases.length)]);

    // Fade out after 3 s
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: all, alpha: 0, duration: 300, ease: 'Power2.in',
        onComplete: () => { all.forEach(o => o.destroy()); this._midRaceCtaActive = false; },
      });
    });
  }

  _buildDebugOverlay() {
    this._debugBg = this.add.graphics().setDepth(200);
    this._debugBg.fillStyle(0x000000, 0.75);
    this._debugBg.fillRect(10, ZONE_GAME_Y + ZONE_GAME_H + 10, 320, 140);

    this.debugFps  = this.add.text(20, ZONE_GAME_Y + ZONE_GAME_H + 20, 'FPS: --', {
      fontSize: '24px', fontFamily: 'monospace', color: '#88ff88'
    }).setDepth(201);
    this.debugSeed = this.add.text(20, ZONE_GAME_Y + ZONE_GAME_H + 50, 'SEED: --', {
      fontSize: '24px', fontFamily: 'monospace', color: '#88ff88'
    }).setDepth(201);
    this.debugRace = this.add.text(20, ZONE_GAME_Y + ZONE_GAME_H + 80, 'RACERS: --', {
      fontSize: '24px', fontFamily: 'monospace', color: '#88ff88'
    }).setDepth(201);

  }

  update() {
    if (this._debugMode && this.debugFps) {
      this.debugFps.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
      const gs = this.scene.get('GameScene');
      if (gs) {
        this.debugSeed?.setText(`SEED: ${gs.seed ?? '—'}`);
        const alive = gs.racers?.filter(r => r.alive).length ?? '—';
        this.debugRace?.setText(`RACERS: ${alive}`);
      }
    }
  }
}
