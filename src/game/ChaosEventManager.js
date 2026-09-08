import { EventBus } from '../utils/eventBus.js';
import { createRNG } from '../utils/seededRandom.js';

const EVENTS = [
  { id: 'GRAVITY_FLIP', label: '🌀 GRAVITY FLIP!',   duration: 4000 },
  { id: 'TURBO',        label: '🚀 TURBO BOOST!',     duration: 3000 },
  { id: 'EARTHQUAKE',   label: '🌋 EARTHQUAKE!',       duration: 3500 },
  { id: 'DARKNESS',     label: '🌑 LIGHTS OUT!',       duration: 3000 }
];

export class ChaosEventManager {
  constructor(scene, seed) {
    this.scene    = scene;
    this.rng      = createRNG(seed + 777);
    this._timer   = null;
    this._active  = false;
  }

  start() {
    this._active = true;
    this._scheduleNext();
  }

  stop() {
    this._active = false;
    this._timer?.remove();
    this._timer = null;
    this._earthquakeTimer?.remove();
    this._earthquakeTimer = null;
    // Ensure gravity is always restored on stop
    this.scene.matter?.world?.setGravity(0, 2.5);
  }

  _scheduleNext() {
    if (!this._active) return;
    const delay = this.rng.between(45000, 90000);
    this._timer = this.scene.time.delayedCall(delay, () => {
      if (!this._active) return;
      if (this.scene.raceManager?.isPhysicsActive()) this._trigger();
      this._scheduleNext();
    });
  }

  _trigger() {
    const ev = this.rng.pick(EVENTS);
    EventBus.emit('CHAOS_EVENT', { id: ev.id, label: ev.label, duration: ev.duration });
    this._applyEffect(ev);
    this.scene.time.delayedCall(ev.duration, () => {
      if (this._active) this._removeEffect(ev);
    });
  }

  _applyEffect({ id }) {
    const m = this.scene.matter;
    switch (id) {
      case 'GRAVITY_FLIP':
        m.world.setGravity(0, -2.5);
        break;
      case 'TURBO':
        this.scene.racers?.filter(r => r.alive).forEach(r => {
          m.body.setVelocity(r.body, { x: r.body.velocity.x * 2, y: r.body.velocity.y * 2 });
        });
        break;
      case 'EARTHQUAKE':
        this._earthquakeTimer = this.scene.time.addEvent({ repeat: 8, delay: 200, callback: () => {
          this.scene.racers?.filter(r => r.alive).forEach(r => {
            m.body.applyForce(r.body, r.body.position, {
              x: (Math.random() - 0.5) * 0.05,
              y: (Math.random() - 0.5) * 0.03
            });
          });
        }});
        break;
      case 'DARKNESS':
        EventBus.emit('DARKNESS_ON', {});
        break;
    }
  }

  _removeEffect({ id }) {
    switch (id) {
      case 'GRAVITY_FLIP':
        this.scene.matter.world.setGravity(0, 2.5);
        break;
      case 'DARKNESS':
        EventBus.emit('DARKNESS_OFF', {});
        break;
    }
  }
}
