import { EventBus } from '../utils/eventBus.js';

export class AudioManager {
  constructor(scene) {
    this.scene  = scene;
    this._subs  = [];
    this._ctx   = null;
    this._out   = null; // master gain → ctx.destination (+ optional stream dest)
  }

  start() {
    try {
      this._ctx = new AudioContext();
      window.__gameAudioCtx = this._ctx;
    } catch { return; }

    // Master gain routed to speakers + streaming tap
    this._out = this._ctx.createGain();
    this._out.gain.value = 1;
    this._out.connect(this._ctx.destination);

    // Expose a MediaStream so streaming.js can capture audio
    try {
      const streamDest = this._ctx.createMediaStreamDestination();
      this._out.connect(streamDest);
      window.__gameAudioStream = streamDest.stream;
    } catch {}

    this._subs = [
      EventBus.on('COUNTDOWN',          d => this._beep(d.value === 'GO!' ? 880 : 440, 0.12)),
      EventBus.on('COUNTRY_BOUNCED',    () => this._beep(660, 0.08)),
      EventBus.on('COUNTRY_ELIMINATED', () => this._beep(220, 0.25, 'sawtooth')),
      EventBus.on('WINNER_CELEBRATED',  () => this._fanfare()),
    ];
  }

  stop() {
    this._subs.forEach(u => u());
    this._subs = [];
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
    }
    this._out = null;
    window.__gameAudioCtx    = null;
    window.__gameAudioStream = null;
  }

  _beep(freq, dur, type = 'sine') {
    if (!this._ctx || !this._out) return;
    try {
      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain);
      gain.connect(this._out);
      osc.type      = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, this._ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + dur);
      osc.start();
      osc.stop(this._ctx.currentTime + dur + 0.05);
    } catch {}
  }

  _noise(dur) {
    if (!this._ctx || !this._out) return;
    try {
      const buf  = this._ctx.createBuffer(1, this._ctx.sampleRate * dur, this._ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src  = this._ctx.createBufferSource();
      const gain = this._ctx.createGain();
      src.buffer = buf;
      src.connect(gain);
      gain.connect(this._out);
      gain.gain.value = 0.015;
      src.start();
      src.stop(this._ctx.currentTime + dur + 0.05);
    } catch {}
  }

  _fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._beep(f, 0.3), i * 120);
    });
  }
}
