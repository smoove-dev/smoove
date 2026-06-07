export type Emitter<Events extends Record<string, unknown>> = {
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void;
  off<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
};

export function createEmitter<Events extends Record<string, unknown>>(): Emitter<Events> {
  const listeners = new Map<keyof Events, Set<(payload: unknown) => void>>();

  const getBucket = <K extends keyof Events>(event: K) => {
    let bucket = listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      listeners.set(event, bucket);
    }
    return bucket;
  };

  return {
    on(event, listener) {
      const bucket = getBucket(event);
      bucket.add(listener as (payload: unknown) => void);
      return () => bucket.delete(listener as (payload: unknown) => void);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener as (payload: unknown) => void);
    },
    emit(event, payload) {
      const bucket = listeners.get(event);
      if (!bucket) return;
      for (const fn of bucket) fn(payload);
    },
  };
}
