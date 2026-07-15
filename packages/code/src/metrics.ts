/** The minimal slice of a canvas context the cursor needs for measurement. */
export interface MeasureContext {
  measureText(text: string): { width: number };
}

/** A measured string, in mono-glyph units. */
export interface CodeMetrics {
  content: string;
  newRows: number;
  endColumn: number;
  firstWidth: number;
  maxWidth: number;
  lastWidth: number;
}

/** Measures `value` against a monospace context, widths in mono-glyph cells. */
export function measureString(
  context: MeasureContext,
  monoWidth: number,
  value: string,
): CodeMetrics {
  const lines = value.split("\n");
  const lastLine = lines[lines.length - 1] as string;
  const firstWidth = Math.round(context.measureText(lines[0] as string).width / monoWidth);
  let maxWidth = firstWidth;

  for (let i = 1; i < lines.length; i++) {
    const width = Math.round(context.measureText(lines[i] as string).width / monoWidth);
    if (width > maxWidth) {
      maxWidth = width;
    }
  }

  const lastWidth = Math.round(context.measureText(lastLine).width / monoWidth);

  return {
    content: value,
    newRows: lines.length - 1,
    endColumn: lastLine.length,
    firstWidth,
    maxWidth,
    lastWidth,
  };
}
