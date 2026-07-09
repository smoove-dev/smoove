import { kf } from "@smoove/studio";
import { type Direction, directionField } from "../_shared.js";

export type SlideProps = { direction: Direction };

export const schema = kf.object({ fields: { direction: directionField("from-right") } });

export const defaults: SlideProps = { direction: "from-right" };
