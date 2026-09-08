import { EventBus } from '../utils/eventBus.js';
import { COMMENTARY } from '../data/commentary.js';

const PRIORITY = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const COOLDOWNS = { HIGH: 3000, MEDIUM: 6000, LOW: 12000 };

const EVENT_PRIORITY = {
  WINNER:     'HIGH',
  ELIMINATED: 'HIGH',
  FINAL_5:    'HIGH',
  FINAL_3:    'HIGH',
  FINAL_2:    'HIGH',
  DANGER:     'HIGH',
  RACE_START: 'HIGH',
  BOUNCED:    'MEDIUM',
  COLLISION:  'LOW'
};

export class CommentaryManager {
  constructor(uiScene) {
    this.ui           = uiScene;
    this._lastTimes   = {};
    this._onComment   = null; // override in tests
    this._subs        = [];
  }

  start() {
    this._subs = [
      EventBus.on('RACE_STARTED',       () => this._tryEmit('RACE_START', {}, Date.now())),
      EventBus.on('COUNTRY_ELIMINATED', d  => this._tryEmit('ELIMINATED', d, Date.now())),
      EventBus.on('COUNTRY_NEAR_HOLE',  d  => this._tryEmit('DANGER', d, Date.now())),
      EventBus.on('COUNTRY_BOUNCED',    d  => this._tryEmit('BOUNCED', d, Date.now())),
      EventBus.on('COUNTRY_COLLISION',  d  => this._tryEmit('COLLISION', d, Date.now())),
      EventBus.on('FINAL_N',            d  => this._tryEmit(`FINAL_${d.n}`, d, Date.now())),
      EventBus.on('WINNER_CELEBRATED',  d  => this._tryEmit('WINNER', d, Date.now()))
    ];
  }

  stop() {
    this._subs.forEach(u => u());
    this._subs = [];
  }

  _tryEmit(eventKey, data, now) {
    const priority = EVENT_PRIORITY[eventKey] ?? 'LOW';
    const cooldown = COOLDOWNS[priority];
    const lastTime = this._lastTimes[priority] ?? -Infinity;
    if (now - lastTime < cooldown) return;

    const templates = COMMENTARY[eventKey];
    if (!templates?.length) return;

    const template = templates[Math.floor(Math.random() * templates.length)];
    const text     = this._format(template, data.country ?? data);
    this._lastTimes[priority] = now;

    if (this._onComment) { this._onComment(text); return; }
    EventBus.emit('COMMENTARY_LINE', { text });
    this.ui?.setCommentary(text);
  }

  _format(template, country) {
    return template.replace(/\{country\}/g, country?.name ?? '');
  }
}
