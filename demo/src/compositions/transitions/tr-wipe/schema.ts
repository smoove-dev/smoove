import { kf } from "@konva-motion/studio";
import { type Direction, directionField } from "../_shared.js";

export type WipeProps = { direction: Direction };

export const schema = kf.object({ fields: { direction: directionField("from-left") } });

export const defaults: WipeProps = { direction: "from-left" };
