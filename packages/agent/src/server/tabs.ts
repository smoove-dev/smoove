import type { ServerResponse } from "node:http";
import type { DrawnBy, TabSummary } from "../index.js";

/** One connected studio tab, holding its open event stream. */
export interface Tab {
  id: string;
  path: string;
  visible: boolean;
  focused: boolean;
  headless: boolean;
  /** Epoch ms of the last focus gain, or null if it never had focus. */
  lastFocusAt: number | null;
  connectedAt: number;
  /** Tie-breaker for tabs that connect within the same millisecond. */
  seq: number;
  stream: ServerResponse;
}

/** The connected tabs, and the rule for which one answers a request. */
export class TabList {
  private readonly tabs = new Map<string, Tab>();
  private seq = 0;

  constructor(private readonly now: () => number = Date.now) {}

  add(tab: Omit<Tab, "connectedAt" | "seq" | "lastFocusAt">): Tab {
    const at = this.now();
    const full: Tab = {
      ...tab,
      connectedAt: at,
      seq: this.seq++,
      lastFocusAt: tab.focused ? at : null,
    };
    this.tabs.set(full.id, full);
    return full;
  }

  get(id: string): Tab | undefined {
    return this.tabs.get(id);
  }

  remove(id: string): boolean {
    return this.tabs.delete(id);
  }

  all(): Tab[] {
    return [...this.tabs.values()];
  }

  get size(): number {
    return this.tabs.size;
  }

  /** Apply a focus or visibility report. A focus gain stamps `lastFocusAt`. */
  presence(id: string, p: { visible: boolean; focused: boolean; path?: string }): boolean {
    const tab = this.tabs.get(id);
    if (!tab) return false;
    if (p.focused && !tab.focused) tab.lastFocusAt = this.now();
    tab.focused = p.focused;
    tab.visible = p.visible;
    if (p.path) tab.path = p.path;
    return true;
  }

  /**
   * The tab that gained focus most recently. If no tab has ever had focus (a
   * headless browser never does), the one that connected most recently.
   */
  pick(): Tab | undefined {
    let best: Tab | undefined;
    for (const tab of this.tabs.values()) {
      if (!best) best = tab;
      else {
        const a = tab.lastFocusAt ?? Number.NEGATIVE_INFINITY;
        const b = best.lastFocusAt ?? Number.NEGATIVE_INFINITY;
        if (a > b || (a === b && tab.seq > best.seq)) best = tab;
      }
    }
    return best;
  }
}

export function summarize(tab: Tab): TabSummary {
  return {
    tabId: tab.id,
    path: tab.path,
    visible: tab.visible,
    focused: tab.focused,
    headless: tab.headless,
    lastFocusAt: tab.lastFocusAt == null ? null : new Date(tab.lastFocusAt).toISOString(),
    connectedAt: new Date(tab.connectedAt).toISOString(),
  };
}

export function drawnBy(tab: Tab): DrawnBy {
  return { tabId: tab.id, path: tab.path, visible: tab.visible, headless: tab.headless };
}
