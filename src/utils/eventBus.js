const _map = {};

export const EventBus = {
  on(event, fn) {
    (_map[event] ??= []).push(fn);
    return () => this.off(event, fn);
  },
  off(event, fn) {
    _map[event] = (_map[event] ?? []).filter(f => f !== fn);
  },
  emit(event, data) {
    [...(_map[event] ?? [])].forEach(fn => fn(data));
  },
  clear() {
    Object.keys(_map).forEach(k => delete _map[k]);
  }
};
