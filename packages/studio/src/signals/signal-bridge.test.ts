import { createSignal } from "@smoove/core";
import { describe, expect, it, vi } from "vitest";
import { holdPlayerSignals, playerSignalStore } from "./signal-bridge.js";

describe("playerSignalStore", () => {
  it("passes changes straight through when nothing holds it", () => {
    const sig = createSignal(0);
    const store = playerSignalStore(sig);
    const onChange = vi.fn();
    store.subscribe(onChange);
    sig.set(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(1);
  });

  it("keeps the last value and notifies once on release", () => {
    const sig = createSignal(0);
    const store = playerSignalStore(sig);
    const onChange = vi.fn();
    store.subscribe(onChange);
    expect(store.getSnapshot()).toBe(0);

    const release = holdPlayerSignals();
    for (let f = 1; f <= 200; f++) sig.set(f);
    expect(onChange).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(0);

    release();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(200);
  });

  it("waits for the outermost hold, and a second release does nothing", () => {
    const sig = createSignal(0);
    const store = playerSignalStore(sig);
    const onChange = vi.fn();
    store.subscribe(onChange);
    store.getSnapshot();

    const outer = holdPlayerSignals();
    const inner = holdPlayerSignals();
    sig.set(5);
    inner();
    inner();
    expect(onChange).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(0);
    outer();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(5);
  });

  it("forgets a listener that unsubscribed during a hold", () => {
    const sig = createSignal(0);
    const store = playerSignalStore(sig);
    const onChange = vi.fn();
    const unsubscribe = store.subscribe(onChange);
    const release = holdPlayerSignals();
    sig.set(1);
    unsubscribe();
    release();
    expect(onChange).not.toHaveBeenCalled();
  });
});
