type Listener = () => void;

const listenersByKey = new Map<string, Set<Listener>>();

function notify(key: string) {
  const set = listenersByKey.get(key);
  if (!set) return;
  for (const fn of set) fn();
}

export function demoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function demoRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function demoWrite<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
  notify(key);
}

export function demoUpdate<T>(key: string, fallback: T, updater: (prev: T) => T) {
  const next = updater(demoRead(key, fallback));
  demoWrite(key, next);
}

export function demoSubscribe<T>(key: string, fallback: T, onData: (value: T) => void) {
  const emit = () => onData(demoRead(key, fallback));
  emit();

  const set = listenersByKey.get(key) ?? new Set<Listener>();
  set.add(emit);
  listenersByKey.set(key, set);

  return () => {
    const s = listenersByKey.get(key);
    if (!s) return;
    s.delete(emit);
    if (s.size === 0) listenersByKey.delete(key);
  };
}

