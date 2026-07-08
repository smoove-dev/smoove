import type { EffectFrameContext, EffectPass, SmooveEffect } from "@smoove/core";
import { getEnvironment } from "@smoove/core";
import type Konva from "konva";

/**
 * Shared preset plumbing: enabled flag, owner bookkeeping, and `touch()` —
 * called by every param setter so owning layers repaint in preview. During
 * offline rendering the frame loop force-draws every layer, so touch() stays
 * quiet there (a stray batchDraw would re-run effect chains between frames).
 */
export abstract class EffectBase implements SmooveEffect {
  readonly _fxEffect = true as const;
  private _enabled = true;
  protected readonly owners = new Set<Konva.Node>();

  enabled(): boolean {
    return this._enabled;
  }

  setEnabled(v: boolean): this {
    this._enabled = v;
    this.touch();
    return this;
  }

  attach(node: Konva.Node): void {
    this.owners.add(node);
  }

  detach(node: Konva.Node): void {
    this.owners.delete(node);
  }

  protected touch(): void {
    for (const node of this.owners) {
      const stage = node.getStage();
      if (!stage || getEnvironment(stage).isRendering) continue;
      node.getLayer()?.batchDraw();
    }
  }

  abstract passes(fc: EffectFrameContext): EffectPass[];
}
