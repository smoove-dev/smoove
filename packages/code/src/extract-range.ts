import type { CodeRange } from "./range.js";
import { type CodeTag, resolveCodeTag } from "./scope.js";

/**
 * Transforms `fragments` so that everything inside `range` becomes a single
 * isolated fragment, preserving untouched fragments verbatim. Returns the new
 * fragment list and the index of the isolated fragment within it.
 *
 * Ported from motion-canvas (packages/2d/src/lib/code/extractRange.ts).
 */
export function extractRange(range: CodeRange, fragments: CodeTag[]): [CodeTag[], number] {
  const [from, to] = range;
  let [fromRow, fromColumn] = from;
  let [toRow, toColumn] = to;
  if (fromRow > toRow || (fromRow === toRow && fromColumn > toColumn)) {
    [fromRow, fromColumn] = to;
    [toRow, toColumn] = from;
  }

  let currentRow = 0;
  let currentColumn = 0;
  const newFragments: CodeTag[] = [];
  let index = -1;
  let found = false;
  let extracted = "";

  for (const fragment of fragments) {
    if (found) {
      newFragments.push(fragment);
      continue;
    }

    const resolved = resolveCodeTag(fragment, false);
    const linesArr = resolved.split("\n");
    const newRows = linesArr.length - 1;
    const lastColumn = (linesArr[newRows] as string).length;
    const nextColumn = newRows > 0 ? lastColumn : currentColumn + lastColumn;

    if (
      fromRow > currentRow + newRows ||
      (fromRow === currentRow + newRows && fromColumn > nextColumn)
    ) {
      currentRow += newRows;
      currentColumn = nextColumn;
      newFragments.push(fragment);
      continue;
    }

    for (let i = 0; i < resolved.length; i++) {
      const char = resolved.charAt(i);
      if (fromRow === currentRow && fromColumn >= currentColumn) {
        if (fromColumn === currentColumn) {
          index = newFragments.length + 1;
          newFragments.push(resolved.slice(0, i), "");
        } else if (char === "\n") {
          index = newFragments.length + 1;
          newFragments.push(resolved.slice(0, i) + " ".repeat(fromColumn - currentColumn), "");
        }
      }

      if (index !== -1 && toRow === currentRow && toColumn >= currentColumn) {
        if (toColumn === currentColumn) {
          newFragments.push(resolved.slice(i));
          found = true;
          break;
        }

        if (char === "\n") {
          if (currentColumn < toColumn) {
            extracted += "\n";
            if (i + 1 < resolved.length) {
              newFragments.push(resolved.slice(i + 1));
            }
          } else {
            newFragments.push(resolved.slice(i));
          }
          found = true;
          break;
        }
      }

      if (index !== -1) {
        extracted += char;
      }

      if (char === "\n") {
        currentRow++;
        currentColumn = 0;
      } else {
        currentColumn++;
      }
    }

    if (index === -1) {
      newFragments.push(fragment);
    }
  }

  if (index === -1) {
    index = newFragments.length + 1;
    const missingRows = fromRow - currentRow;
    const missingColumns = missingRows > 0 ? fromColumn : fromColumn - currentColumn;
    newFragments.push("\n".repeat(missingRows) + " ".repeat(missingColumns), "");
  }

  newFragments[index] = extracted;

  return [newFragments, index];
}
