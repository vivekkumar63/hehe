import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/utils/eventBus.js';

beforeEach(() => EventBus.clear());

import { CommentaryManager } from '../../src/game/CommentaryManager.js';

describe('CommentaryManager', () => {
  it('picks a template and replaces {country}', () => {
    const cm = new CommentaryManager(null);
    const result = cm._format('{country} IS OUT!', { name: 'INDIA' });
    expect(result).toBe('INDIA IS OUT!');
  });

  it('respects cooldown — does not emit twice within cooldown', () => {
    const cm = new CommentaryManager(null);
    const emitted = [];
    cm._onComment = (txt) => emitted.push(txt);
    cm._tryEmit('ELIMINATED', { country: { name: 'JAPAN' } }, 0);
    cm._tryEmit('ELIMINATED', { country: { name: 'USA'  } }, 100); // within cooldown
    expect(emitted.length).toBe(1);
  });

  it('allows emit after cooldown expires', () => {
    const cm = new CommentaryManager(null);
    const emitted = [];
    cm._onComment = (txt) => emitted.push(txt);
    cm._tryEmit('ELIMINATED', { country: { name: 'JAPAN' } }, 0);
    cm._tryEmit('ELIMINATED', { country: { name: 'USA'  } }, 4000); // after HIGH cooldown (3000ms)
    expect(emitted.length).toBe(2);
  });
});
