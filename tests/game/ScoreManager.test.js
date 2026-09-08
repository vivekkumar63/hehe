import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const store = {};
vi.stubGlobal('localStorage', {
  getItem:    (k) => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
});

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]); });

import { ScoreManager } from '../../src/game/ScoreManager.js';

describe('ScoreManager', () => {
  it('race number starts at 1 on fresh install', () => {
    const sm = new ScoreManager();
    expect(sm.getRaceNumber()).toBe(1);
  });

  it('race number increments and persists', () => {
    const sm = new ScoreManager();
    sm.nextRace();
    sm.nextRace();
    expect(sm.getRaceNumber()).toBe(3);
    // Reload
    const sm2 = new ScoreManager();
    expect(sm2.getRaceNumber()).toBe(3);
  });

  it('recordWin increments today and alltime', () => {
    const sm = new ScoreManager();
    sm.recordWin('india');
    sm.recordWin('india');
    sm.recordWin('japan');
    expect(sm.getTodayWins('india')).toBe(2);
    expect(sm.getTodayWins('japan')).toBe(1);
    expect(sm.getAllTimeWins('india')).toBe(2);
  });

  it('getTopToday returns top 3 sorted', () => {
    const sm = new ScoreManager();
    sm.recordWin('india'); sm.recordWin('india'); sm.recordWin('india');
    sm.recordWin('japan'); sm.recordWin('japan');
    sm.recordWin('brazil');
    const top = sm.getTopToday(3);
    expect(top[0].id).toBe('india');
    expect(top[1].id).toBe('japan');
    expect(top[2].id).toBe('brazil');
  });
});
