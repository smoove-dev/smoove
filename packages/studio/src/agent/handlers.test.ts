import { describe, expect, it } from "vitest";
import { defineRegistry } from "../registry/define-registry.js";
import { createStore } from "../store/store.js";
import type { RegistryEntry } from "../types.js";
import { createAgentHandlers } from "./handlers.js";

const entry: RegistryEntry = { id: "promo", title: "Promo", composition: () => null as never };

describe("render through the agent bridge", () => {
  it("refuses when rendering is off", async () => {
    const store = createStore({ registry: defineRegistry([entry]) });
    expect(store.canRender).toBe(false);
    const handlers = createAgentHandlers(store);
    await expect(
      handlers.render({ composition: "promo" } as never, {} as never, () => {}),
    ).rejects.toMatchObject({ code: "render-off" });
  });

  it("knows it can render when a backend is given", () => {
    const store = createStore({
      registry: defineRegistry([entry]),
      render: { start: () => {} },
    });
    expect(store.canRender).toBe(true);
  });
});
