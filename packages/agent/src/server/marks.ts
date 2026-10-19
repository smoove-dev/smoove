import type { DrawnBy, Mark, MarkInput } from "../index.js";

/**
 * The one mark a dev server holds: the latest a studio tab drew, until the
 * agent reads it or the user clears it. Memory only; a tab that still shows
 * its mark sends it again when it reconnects after a restart.
 */
export class MarkStore {
  private mark: Mark | null = null;
  /** Image paths by mark id. The tab posts the image before the mark. */
  private images = new Map<string, string>();
  /** Ids that were read or cleared, so a stale resend can't bring one back. */
  private done = new Set<string>();

  current(): Mark | null {
    return this.mark;
  }

  /** Remember an image for a mark id; attached if that id is or becomes current. */
  putImage(id: string, path: string): void {
    if (this.done.has(id)) return;
    this.images.set(id, path);
    if (this.mark?.id === id) this.mark.image = path;
  }

  /** False when `id` was already read or cleared: a stale resend. */
  set(input: MarkInput, drawnBy: DrawnBy, drawnAt: string): boolean {
    if (this.done.has(input.id)) return false;
    if (this.mark && this.mark.id !== input.id) this.forget(this.mark.id);
    this.mark = { ...input, drawnAt, drawnBy, image: this.images.get(input.id) ?? null };
    return true;
  }

  /** Clears only when `id` is the current mark. */
  clear(id: string): boolean {
    if (this.mark?.id !== id) return false;
    this.forget(id);
    this.mark = null;
    return true;
  }

  /** Return the current mark and clear it. */
  take(): Mark | null {
    const mark = this.mark;
    if (mark) this.forget(mark.id);
    this.mark = null;
    return mark;
  }

  private forget(id: string): void {
    this.done.add(id);
    this.images.delete(id);
  }
}
