const KEYS = {
  race:    'wcr_race_number',
  date:    'wcr_today_date',
  today:   'wcr_today_wins',
  alltime: 'wcr_alltime_wins'
};

export class ScoreManager {
  constructor() {
    this._checkDateReset();
  }

  _checkDateReset() {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(KEYS.date) !== today) {
      localStorage.setItem(KEYS.date, today);
      localStorage.setItem(KEYS.today, JSON.stringify({}));
    }
  }

  _load(key) {
    try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
  }

  _save(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }

  getRaceNumber() {
    return parseInt(localStorage.getItem(KEYS.race) ?? '1', 10);
  }

  nextRace() {
    localStorage.setItem(KEYS.race, String(this.getRaceNumber() + 1));
    return this.getRaceNumber();
  }

  recordWin(countryId) {
    const today   = this._load(KEYS.today);
    const alltime = this._load(KEYS.alltime);
    today[countryId]   = (today[countryId]   ?? 0) + 1;
    alltime[countryId] = (alltime[countryId] ?? 0) + 1;
    this._save(KEYS.today,   today);
    this._save(KEYS.alltime, alltime);
  }

  getTodayWins(id)   { return this._load(KEYS.today)[id]   ?? 0; }
  getAllTimeWins(id)  { return this._load(KEYS.alltime)[id] ?? 0; }

  getTopToday(n = 3) {
    const today = this._load(KEYS.today);
    return Object.entries(today)
      .map(([id, wins]) => ({ id, wins }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, n);
  }
}
