import { blockPaintCases } from "./cases/block-paint.js";
import { crossAxisCases } from "./cases/cross-axis.js";
import { leafCases } from "./cases/leaves.js";
import { mainAxisCases } from "./cases/main-axis.js";
import { nestingCases } from "./cases/nesting.js";
import { reflowCases } from "./cases/reflow.js";
import { sizingCases } from "./cases/sizing.js";
import { spacingCases } from "./cases/spacing.js";
import { textCases } from "./cases/text.js";
import type { LayoutCase } from "./types.js";

export const corpus: LayoutCase[] = [
  ...mainAxisCases,
  ...crossAxisCases,
  ...sizingCases,
  ...spacingCases,
  ...blockPaintCases,
  ...nestingCases,
  ...textCases,
  ...leafCases,
  ...reflowCases,
];
