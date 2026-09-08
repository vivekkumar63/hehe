import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/utils/eventBus.js';

beforeEach(() => EventBus.clear());

describe('EventBus', () => {
  it('calls listener on emit', () => {
    const fn = vi.fn();
    EventBus.on('foo', fn);
    EventBus.emit('foo', { x: 1 });
    expect(fn).toHaveBeenCalledWith({ x: 1 });
  });

  it('does not call after off', () => {
    const fn = vi.fn();
    EventBus.on('foo', fn);
    EventBus.off('foo', fn);
    EventBus.emit('foo', {});
    expect(fn).not.toHaveBeenCalled();
  });

  it('on returns unsubscribe', () => {
    const fn = vi.fn();
    const unsub = EventBus.on('foo', fn);
    unsub();
    EventBus.emit('foo', {});
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not throw for unknown event', () => {
    expect(() => EventBus.emit('unknown', {})).not.toThrow();
  });
});
