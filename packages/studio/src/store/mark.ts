import type { MarkRect } from "@smoove/agent";
import { Signal } from "signal-polyfill";

/** The user's mark as the stage shows it. */
export type StudioMark = { id: string; composition: string; frame: number; rect: MarkRect };

/** How a mark reaches the dev server. Set by the agent bridge while it's connected. */
export type MarkSink = {
  /** Build and send a mark on the current frame. Null when the composition isn't ready. */
  send(rect: MarkRect): Promise<StudioMark | null>;
  clear(id: string): Promise<void>;
};

/** The user's one mark, and whether marking is possible (a bridge is connected). */
export function createMarkState() {
  const mark = new Signal.State<StudioMark | null>(null);
  /** True while a bridge is connected and this isn't a headless tab. */
  const markLive = new Signal.State<boolean>(false);
  let sink: MarkSink | null = null;

  const setMarkSink = (next: MarkSink | null): void => {
    sink = next;
    markLive.set(next != null);
    if (!next) mark.set(null);
  };

  const drawMark = async (rect: MarkRect): Promise<void> => {
    if (!sink) return;
    const sent = await sink.send(rect);
    if (sent) mark.set(sent);
  };

  const clearMark = async (): Promise<void> => {
    const current = mark.get();
    if (!current) return;
    mark.set(null);
    await sink?.clear(current.id);
  };

  /** Show a mark this tab drew before a page reload (the bridge resends it). */
  const restoreMark = (m: StudioMark): void => mark.set(m);

  /** The server's current mark id changed: drop ours unless it's still the one. */
  const onServerMark = (id: string | null): void => {
    const current = mark.get();
    if (current && current.id !== id) mark.set(null);
  };

  return { mark, markLive, setMarkSink, drawMark, clearMark, restoreMark, onServerMark };
}
