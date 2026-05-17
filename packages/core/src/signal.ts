export type ReadonlySignal<T> = {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
};

export type Signal<T> = ReadonlySignal<T> & {
  set(value: T): void;
};

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      for (const fn of listeners) fn(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function derived<T>(
  sources: ReadonlySignal<unknown>[],
  compute: () => T,
): ReadonlySignal<T> {
  return {
    get: compute,
    subscribe(listener) {
      let last = compute();
      const fire = () => {
        const next = compute();
        if (Object.is(next, last)) return;
        last = next;
        listener(next);
      };
      const unsubs = sources.map((s) => s.subscribe(fire));
      return () => {
        for (const u of unsubs) u();
      };
    },
  };
}
