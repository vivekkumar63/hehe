import { EventBus } from '../utils/eventBus.js';
import { ScoreManager } from './ScoreManager.js';

const STATES = { PREP: 'PREP', COUNTDOWN: 'COUNTDOWN', RACING: 'RACING', WINNER: 'WINNER', INTERMISSION: 'INTERMISSION' };
const RACE_DURATION_S = 10 * 60; // 10 minutes

export class RaceManager {
  constructor(scene) {
    this.scene  = scene;
    this.scores = new ScoreManager();
    this.state  = STATES.PREP;
    this._unsubs = [];
  }

  start() {
    this._unsubs.push(
      EventBus.on('COUNTRY_ELIMINATED', d => this._onEliminated(d)),
      EventBus.on('WINNER_DECLARED',    d => this._onWinner(d)),
      EventBus.on('RACE_NO_WINNER', () => {
        if (this.state !== STATES.RACING) return;
        this._raceTimer?.remove();
        this._raceTimer = null;
        this._stopTick();
        this._beginIntermission();
      })
    );
    this._beginPrep();
  }

  _beginPrep() {
    this.state = STATES.PREP;
    this.raceNumber = this.scores.getRaceNumber();
    EventBus.emit('RACE_PREP', { raceNumber: this.raceNumber });
    this.scene.time.delayedCall(800, () => this._beginCountdown());
  }

  _beginCountdown() {
    this.state = STATES.COUNTDOWN;
    const steps = [3, 2, 1, 'GO!'];
    let i = 0;
    const tick = () => {
      EventBus.emit('COUNTDOWN', { value: steps[i] });
      i++;
      if (i < steps.length) {
        this.scene.time.delayedCall(900, tick);
      } else {
        this.scene.time.delayedCall(400, () => this._beginRacing());
      }
    };
    tick();
  }

  _beginRacing() {
    this.state = STATES.RACING;
    EventBus.emit('RACE_STARTED', { raceNumber: this.raceNumber });

    // Countdown ticker — emits every second so UIScene can display remaining time
    this._timerRemaining = RACE_DURATION_S;
    EventBus.emit('RACE_TIMER', { remaining: this._timerRemaining });
    this._tickEvent = this.scene.time.addEvent({
      delay: 1000,
      repeat: RACE_DURATION_S - 1,
      callback: () => {
        this._timerRemaining = Math.max(0, this._timerRemaining - 1);
        EventBus.emit('RACE_TIMER', { remaining: this._timerRemaining });
      }
    });

    // Safety fallback: furthest ball wins if nobody finishes in time
    this._raceTimer = this.scene.time.delayedCall(RACE_DURATION_S * 1000, () => this._onTimeUp());
  }

  _stopTick() {
    this._tickEvent?.remove();
    this._tickEvent = null;
  }

  _onTimeUp() {
    if (this.state !== STATES.RACING) return;
    this._stopTick();
    const alive = this.scene.racers?.filter(r => r.alive) ?? [];
    if (alive.length === 0) { this._beginIntermission(); return; }
    const winner = alive.reduce((best, r) =>
      r.body.position.y > best.body.position.y ? r : best
    );
    EventBus.emit('WINNER_DECLARED', { country: winner.country });
  }

  _onEliminated({ remaining }) {
    if (this.state !== STATES.RACING) return;
    if ([5, 3, 2].includes(remaining)) {
      EventBus.emit('FINAL_N', { n: remaining });
    }
  }

  _onWinner({ country }) {
    if (this.state !== STATES.RACING) return;
    this._raceTimer?.remove();
    this._raceTimer = null;
    this._stopTick();
    this.state = STATES.WINNER;
    this.scores.recordWin(country.id);
    EventBus.emit('WINNER_CELEBRATED', {
      country,
      raceNumber: this.raceNumber,
      todayWins: this.scores.getTodayWins(country.id)
    });
    this.scene.time.delayedCall(5000, () => this._beginIntermission());
  }

  _beginIntermission() {
    this._raceTimer?.remove();
    this._raceTimer = null;
    this._stopTick();
    this.state = STATES.INTERMISSION;
    this.scores.nextRace(); // always increment — covers winner, no-winner, and time-up paths
    EventBus.emit('RACE_TIMER', { remaining: null }); // signal UI to clear timer
    EventBus.emit('INTERMISSION_START', {});
    this.scene.time.delayedCall(4000, () => {
      this._unsubs.forEach(u => u());
      this._unsubs = [];
      EventBus.emit('INTERMISSION_END', {});
      EventBus.emit('RACE_RESTART', {});
    });
  }

  isPhysicsActive() { return this.state === STATES.RACING; }
}
