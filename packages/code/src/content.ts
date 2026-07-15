import { type InterpolateOptions, interpolate } from "@smoove/core";
import { defaultDiffer } from "./differ.js";
import { applyEdits, type Edit } from "./edit.js";
import {
  type CodeRange,
  type CodeSelection,
  isCodeRange,
  type PossibleCodeSelection,
} from "./range.js";
import { type CodeScope, type PossibleCodeScope, parseCodeScope } from "./scope.js";
import type { CodeTokenizer } from "./tokenizer.js";

/**
 * A description of what a {@link Code} node should show. Produced by the
 * `interpolate*` helpers (or a plain string), and resolved by the node using
 * its own tokenizer. Resolution is deferred so the node can memoize the diff.
 */
export type CodeContent =
  | { kind: "static"; value: PossibleCodeScope }
  | {
      kind: "diff";
      from: PossibleCodeScope;
      to: PossibleCodeScope;
      progress: number;
    }
  | { kind: "edit"; base: PossibleCodeScope; edits: Edit[]; progress: number };

/** A description of which ranges are selected, possibly mid-transition. */
export type SelectionContent =
  | { kind: "static"; selection: CodeSelection }
  | {
      kind: "transition";
      from: CodeSelection;
      to: CodeSelection;
      progress: number;
    };

export function normalizeSelection(value: PossibleCodeSelection): CodeSelection {
  return isCodeRange(value) ? [value as CodeRange] : (value as CodeSelection);
}

/**
 * Morphs between whole-code snapshots as `frame` moves through `inputRange`.
 * Mirrors core's `interpolate(input, inputRange, outputRange)`.
 */
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function segment(frame: number, inputRange: readonly number[]): number {
  const last = inputRange.length - 1;
  let i = 0;
  while (i < last - 1 && frame >= (inputRange[i + 1] as number)) {
    i++;
  }
  return i;
}

export function interpolateCode(
  frame: number,
  inputRange: readonly number[],
  snapshots: readonly PossibleCodeScope[],
  options?: InterpolateOptions,
): CodeContent {
  const last = inputRange.length - 1;
  if (frame <= (inputRange[0] as number)) {
    return { kind: "static", value: snapshots[0] as PossibleCodeScope };
  }
  if (frame >= (inputRange[last] as number)) {
    return { kind: "static", value: snapshots[last] as PossibleCodeScope };
  }
  const i = segment(frame, inputRange);
  const progress = interpolate(
    frame,
    [inputRange[i] as number, inputRange[i + 1] as number],
    [0, 1],
    { ...options, ...CLAMP },
  );
  return {
    kind: "diff",
    from: snapshots[i] as PossibleCodeScope,
    to: snapshots[i + 1] as PossibleCodeScope,
    progress,
  };
}

/** Animates a set of explicit edits applied to `base` over `inputRange`. */
export function interpolateEdit(
  frame: number,
  inputRange: readonly number[],
  base: PossibleCodeScope,
  edits: Edit[],
  options?: InterpolateOptions,
): CodeContent {
  const lo = inputRange[0] as number;
  const hi = inputRange[inputRange.length - 1] as number;
  const progress = interpolate(frame, [lo, hi], [0, 1], { ...options, ...CLAMP });
  return { kind: "edit", base, edits, progress };
}

/** Animates between selection sets over `inputRange`. */
export function interpolateSelection(
  frame: number,
  inputRange: readonly number[],
  selections: readonly PossibleCodeSelection[],
  options?: InterpolateOptions,
): SelectionContent {
  const last = inputRange.length - 1;
  if (frame <= (inputRange[0] as number)) {
    return {
      kind: "static",
      selection: normalizeSelection(selections[0] as PossibleCodeSelection),
    };
  }
  if (frame >= (inputRange[last] as number)) {
    return {
      kind: "static",
      selection: normalizeSelection(selections[last] as PossibleCodeSelection),
    };
  }
  const i = segment(frame, inputRange);
  const progress = interpolate(
    frame,
    [inputRange[i] as number, inputRange[i + 1] as number],
    [0, 1],
    { ...options, ...CLAMP },
  );
  return {
    kind: "transition",
    from: normalizeSelection(selections[i] as PossibleCodeSelection),
    to: normalizeSelection(selections[i + 1] as PossibleCodeSelection),
    progress,
  };
}

/** Resolves a {@link CodeContent} descriptor into a concrete scope. */
export function resolveContent(content: string | CodeContent, tokenize: CodeTokenizer): CodeScope {
  if (typeof content === "string") {
    return { progress: 0, fragments: parseCodeScope(content).fragments };
  }
  switch (content.kind) {
    case "static":
      return { progress: 0, fragments: parseCodeScope(content.value).fragments };
    case "diff":
      return {
        progress: content.progress,
        fragments: defaultDiffer(
          parseCodeScope(content.from),
          parseCodeScope(content.to),
          tokenize,
        ),
      };
    case "edit":
      return {
        progress: content.progress,
        fragments: applyEdits(content.base, content.edits),
      };
  }
}
