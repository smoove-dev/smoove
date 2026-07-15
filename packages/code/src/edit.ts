import { extractRange } from "./extract-range.js";
import type { CodePoint, CodeRange } from "./range.js";
import { type CodeTag, type PossibleCodeScope, parseCodeScope } from "./scope.js";

/** A single explicit edit: replace the text in `range` with `code`. */
export interface Edit {
  range: CodeRange;
  code: string;
}

/** Insert `code` at `point`. */
export function insert(point: CodePoint, code: string): Edit {
  return { range: [point, point], code };
}

/** Remove the text in `range`. */
export function remove(range: CodeRange): Edit {
  return { range, code: "" };
}

/** Replace the text in `range` with `code`. */
export function replace(range: CodeRange, code: string): Edit {
  return { range, code };
}

/**
 * Applies a set of edits to a base scope, returning a fragment list in which
 * each edited span is a `{before, after}` change fragment and everything else
 * stays a plain string.
 */
export function applyEdits(base: PossibleCodeScope, edits: Edit[]): CodeTag[] {
  let fragments = parseCodeScope(base).fragments;

  // Apply from the last position to the first so that earlier edits do not
  // shift the coordinates of later ones (all ranges stay in base-text space).
  const ordered = [...edits].sort(
    (a, b) => b.range[0][0] - a.range[0][0] || b.range[0][1] - a.range[0][1],
  );

  for (const edit of ordered) {
    const [newFragments, index] = extractRange(edit.range, fragments);
    const extracted = newFragments[index] as string;
    newFragments[index] = { before: extracted, after: edit.code };
    fragments = newFragments;
  }

  return fragments;
}
