import { LitElement } from "lit";
import { getPlayerApi } from "./context.js";
import type { PlayerApi } from "./player-api.js";
import type { ReadonlySignal } from "./signal.js";

/**
 * Base class for **leaf** controls (play button, time, volume, …). Renders its
 * own markup into light DOM (it has no user children, so rendering into `this`
 * is safe and lets users style with plain selectors). Resolves the ancestor
 * `<km-player>` on connect and offers {@link watch} to re-render when a player
 * signal changes.
 */
export abstract class SmooveControl extends LitElement {
  /** The resolved player, or `null` if used outside a `<km-player>`. */
  protected api: PlayerApi | null = null;
  private _unsubs: Array<() => void> = [];

  // Light DOM — no shadow root, so all styling is overridable with plain CSS.
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.api = getPlayerApi(this);
    if (this.api) this.bind(this.api);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const u of this._unsubs) u();
    this._unsubs = [];
    this.api = null;
  }

  /** Subscribe to a player signal and re-render this control on every change. */
  protected watch<T>(sig: ReadonlySignal<T>): void {
    this._unsubs.push(sig.subscribe(() => this.requestUpdate()));
  }

  /**
   * Declare reactive subscriptions here using {@link watch}. Called once on
   * connect with the resolved {@link PlayerApi}.
   */
  protected bind(_api: PlayerApi): void {}
}

/**
 * Base class for **layout containers** (overlay, controls, rows, spacer). These
 * wrap user-authored children, so they must never let a framework re-render
 * wipe that content — they are bare custom elements that only exist for
 * semantics + CSS targeting. All styling lives in the opt-in stylesheet.
 */
export class SmooveContainer extends HTMLElement {}
