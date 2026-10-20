import { AgentError } from "@smoove/agent";
import { Signal } from "signal-polyfill";

/**
 * Resolve with the first non-null value of `read`, re-checked whenever a signal
 * it reads changes. Rejects when `abort` fires. Wakes on signal notifications
 * through microtasks only (no timers, no animation frames), so it makes
 * progress in a background tab.
 */
export function until<T>(read: () => T | null | undefined, abort: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (abort.aborted) return reject(reason(abort));
    const computed = new Signal.Computed(read);
    let settled = false;
    const finish = (): void => {
      settled = true;
      watcher.unwatch(computed);
      abort.removeEventListener("abort", onAbort);
    };
    const check = (): void => {
      if (settled) return;
      let value: T | null | undefined;
      try {
        value = computed.get();
      } catch (err) {
        finish();
        reject(err);
        return;
      }
      if (value != null) {
        finish();
        resolve(value);
      } else {
        watcher.watch(); // re-arm: a watcher stops after each notification
      }
    };
    const watcher = new Signal.subtle.Watcher(() => queueMicrotask(check));
    const onAbort = (): void => {
      if (settled) return;
      finish();
      reject(reason(abort));
    };
    watcher.watch(computed);
    abort.addEventListener("abort", onAbort, { once: true });
    check();
  });
}

/** Race a plain promise against `abort`. */
export function abortable<T>(promise: Promise<T>, abort: AbortSignal): Promise<T> {
  if (abort.aborted) return Promise.reject(reason(abort));
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(reason(abort));
    abort.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => {
        abort.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        abort.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

function reason(abort: AbortSignal): unknown {
  return abort.reason ?? new AgentError("tab-timeout", "The request was canceled.");
}

/**
 * Call `onChange` with `read()` now and whenever a signal it reads changes,
 * until the returned stop function runs. Microtasks only, like {@link until}.
 */
export function watch<T>(read: () => T, onChange: (value: T) => void): () => void {
  const computed = new Signal.Computed(read);
  let stopped = false;
  const check = (): void => {
    if (stopped) return;
    onChange(computed.get());
    if (!stopped) watcher.watch();
  };
  const watcher = new Signal.subtle.Watcher(() => queueMicrotask(check));
  watcher.watch(computed);
  check();
  return () => {
    stopped = true;
    watcher.unwatch(computed);
  };
}
