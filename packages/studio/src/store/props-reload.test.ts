import { describe, expect, it } from "vitest";
import { defineRegistry } from "../registry/define-registry.js";
import { keepEdits, kf } from "../schema/kf.js";
import type { RegistryEntry } from "../types.js";
import { createStore } from "./store.js";

describe("keepEdits", () => {
  it("keeps an edit to a key that's still there with the same kind of value", () => {
    expect(keepEdits({ title: "", size: 1 }, { title: "Edited", size: "big" })).toEqual({
      title: "Edited",
      size: 1,
    });
  });

  it("drops keys the schema lost and gives new keys their default", () => {
    expect(keepEdits({ tagline: "Ship it" }, { title: "Edited" })).toEqual({
      tagline: "Ship it",
    });
  });

  it("fits nested objects key by key and keeps arrays", () => {
    expect(
      keepEdits(
        { card: { color: "#fff", radius: 4 }, tags: [] },
        { card: { color: "#000", shadow: true }, tags: ["a"] },
      ),
    ).toEqual({ card: { color: "#000", radius: 4 }, tags: ["a"] });
  });
});

describe("props after a hot reload", () => {
  // A comp that never loads: the store only needs the entry's props here.
  const entry = (): RegistryEntry => ({
    id: "promo",
    title: "Promo",
    composition: () => new Promise(() => {}),
    propsSchema: kf.object({ fields: { title: kf.text({ default: "Launch" }) } }),
  });

  it("follows a renamed schema key instead of keeping the old props", () => {
    const registry = defineRegistry([entry()]);
    const store = createStore({ registry, initialId: "other" });
    const props = store.getPropsSignal("promo");
    props.set({ title: "Edited" });

    registry.update("promo", () => new Promise(() => {}), undefined, {
      propsSchema: kf.object({ fields: { tagline: kf.text({ default: "Ship it" }) } }),
    });

    expect(props.get()).toEqual({ tagline: "Ship it" });
  });

  it("keeps an edit when the key survives the reload", () => {
    const registry = defineRegistry([entry()]);
    const store = createStore({ registry, initialId: "other" });
    const props = store.getPropsSignal("promo");
    props.set({ title: "Edited" });

    registry.update("promo", () => new Promise(() => {}), undefined, {
      propsSchema: kf.object({
        fields: { title: kf.text({ default: "Launch" }), color: kf.color({ default: "#000" }) },
      }),
    });

    expect(props.get()).toEqual({ title: "Edited", color: "#000" });
  });
});
