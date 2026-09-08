import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/seededRandom.js';

describe('seededRandom', () => {
  it('same seed gives same sequence', () => {
    const a = createRNG(12345), b = createRNG(12345);
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
  });

  it('different seeds give different values', () => {
    expect(createRNG(1).next()).not.toBe(createRNG(2).next());
  });

  it('between stays in range', () => {
    const rng = createRNG(99);
    for (let i = 0; i < 200; i++) {
      const v = rng.between(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('pick returns element from array', () => {
    const rng = createRNG(7), arr = ['x','y','z'];
    for (let i = 0; i < 30; i++) expect(arr).toContain(rng.pick(arr));
  });

  it('shuffle contains same elements', () => {
    const rng = createRNG(3), arr = [1,2,3,4,5];
    expect(rng.shuffle(arr).sort()).toEqual([...arr].sort());
  });
});
