import { kf } from "@smoove/studio";
import { type Direction, directionField } from "../_shared.js";

export type FlipProps = { direction: Direction };

export const schema = kf.object({ fields: { direction: directionField("from-left") } });

export const defaults: FlipProps = { direction: "from-left" };
