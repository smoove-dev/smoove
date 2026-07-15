/** The result of highlighting a single position in the code. */
export interface HighlightResult {
  /** The color at the given index, or `null` for the default fill. */
  color: string | null;
  /**
   * How many characters share this result. The renderer draws them as one
   * continuous run, keeping ligatures and emoji intact. This is a count, not an
   * end index.
   */
  skipAhead: number;
}

/**
 * A syntax highlighter for the {@link Code} node.
 *
 * @typeParam T - The type of the per-code cache produced by {@link prepare}.
 */
export interface CodeHighlighter<T = unknown> {
  /**
   * Returns `true` once the highlighter is ready to use. Synchronous
   * highlighters can simply return `true`; the result should be cached.
   */
  initialize(): boolean;
  /**
   * Parses `code` once and returns a cache passed back to {@link highlight}.
   * Called whenever the code changes.
   */
  prepare(code: string): T;
  /** Returns the color and run length for the token at `index`. */
  highlight(index: number, cache: T): HighlightResult;
  /** Splits `code` into the atomic units the diff aligns on. */
  tokenize(code: string): string[];
}
