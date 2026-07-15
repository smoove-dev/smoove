const INF = Number.POSITIVE_INFINITY;

/** A `[line, column]` position, both 0-based. */
export type CodePoint = [number, number];

/** A `[from, to]` span between two points. */
export type CodeRange = [CodePoint, CodePoint];

/** A set of ranges. */
export type CodeSelection = CodeRange[];
export type PossibleCodeSelection = CodeRange | CodeSelection;

function isCodePoint(value: unknown): value is CodePoint {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

export function isCodeRange(value: unknown): value is CodeRange {
  return (
    Array.isArray(value) && value.length === 2 && isCodePoint(value[0]) && isCodePoint(value[1])
  );
}

/** Escapes a string for literal use inside a RegExp. */
function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A range spanning whole lines `from` through `to` (inclusive). With `to`
 * omitted, covers a single line.
 */
export function lines(from: number, to?: number): CodeRange {
  return [
    [from, 0],
    [to ?? from, INF],
  ];
}

/**
 * A range covering a word on `line` starting at `from`. With `length` omitted,
 * covers the rest of the line.
 */
export function word(line: number, from: number, length?: number): CodeRange {
  return [
    [line, from],
    [line, from + (length ?? INF)],
  ];
}

/** A custom range from one point to another. */
export function pointToPoint(
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): CodeRange {
  return [
    [startLine, startColumn],
    [endLine, endColumn],
  ];
}

export function isPointInCodeRange(point: CodePoint, range: CodeRange): boolean {
  const [y, x] = point;
  const [[startLine, startColumn], [endLine, endColumn]] = range;
  return (
    ((y === startLine && x >= startColumn) || y > startLine) &&
    ((y === endLine && x < endColumn) || y < endLine)
  );
}

export function isPointInCodeSelection(point: CodePoint, selection: CodeSelection): boolean {
  for (const range of selection) {
    if (isPointInCodeRange(point, range)) {
      return true;
    }
  }
  return false;
}

/** Everything: the default selection, so all tokens render at full alpha. */
export function fullSelection(): CodeSelection {
  return [
    [
      [0, 0],
      [INF, INF],
    ],
  ];
}

/** Finds every range whose text matches `pattern` (exact string or RegExp). */
export function findAllCodeRanges(
  code: string,
  pattern: string | RegExp,
  limit = INF,
): CodeRange[] {
  const regExp =
    typeof pattern === "string" ? new RegExp(escapeRegExp(pattern), "g") : new RegExp(pattern, "g");

  const matches = code.matchAll(regExp);
  const ranges: CodeRange[] = [];
  let index = 0;
  let line = 0;
  let column = 0;

  for (const match of matches) {
    if (match.index === undefined || ranges.length >= limit) {
      continue;
    }

    let from: CodePoint = [line, column];
    while (index <= code.length) {
      if (index === match.index) {
        from = [line, column];
      }

      if (index === match.index + match[0].length) {
        ranges.push([from, [line, column]]);
        break;
      }

      if (code[index] === "\n") {
        line++;
        column = 0;
      } else {
        column++;
      }
      index++;
    }
  }

  return ranges;
}

export { escapeRegExp, INF };
