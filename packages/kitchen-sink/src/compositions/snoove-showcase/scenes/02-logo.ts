/**
 * Scene 2 — the logo.
 *
 * The mark builds itself, the wordmark opens, and the slogan types under it.
 * Nothing else is on screen: this is the one beat that has to read as brand.
 */
import type { Sequence } from "@smoove/core";
import { HEIGHT, SLOGAN, WIDTH } from "../constants.js";
import { backdrop } from "../components/backdrop.js";
import { logoLockup } from "../components/logo.js";

/**
 * Scene-local frame the voice-over starts, placed so "smoove" lands with the
 * wordmark reveal rather than ahead of it. The mix in `composition.ts` anchors
 * the VO to this offset off the scene's marker.
 */
export const VO_AT = 58;

export function logo(seq: Sequence) {
  seq.add(backdrop());
  seq.add(
    logoLockup({
      x: WIDTH / 2,
      y: HEIGHT / 2,
      scale: 1.4,
      slogan: SLOGAN,
    }),
  );
}
