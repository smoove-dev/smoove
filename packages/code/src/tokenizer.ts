/** Splits code into the atomic units the diff aligns on. */
export type CodeTokenizer = (input: string) => string[];

/**
 * Fallback tokenizer used when no highlighter is supplied. Splits on runs of
 * whitespace and treats each bracket character as its own token, so the diff
 * aligns on sensible boundaries without any language knowledge.
 */
export function defaultTokenize(input: string): string[] {
  const tokens: string[] = [];
  let currentToken = "";
  let whitespace = false;

  for (const char of input) {
    switch (char) {
      case " ":
      case "\t":
      case "\n":
        if (!whitespace && currentToken !== "") {
          tokens.push(currentToken);
          currentToken = "";
        }
        whitespace = true;
        currentToken += char;
        break;
      case "(":
      case ")":
      case "{":
      case "}":
      case "[":
      case "]":
        if (currentToken !== "") {
          tokens.push(currentToken);
          currentToken = "";
        }
        whitespace = false;
        tokens.push(char);
        break;
      default:
        if (whitespace && currentToken !== "") {
          tokens.push(currentToken);
          currentToken = "";
        }
        whitespace = false;
        currentToken += char;
        break;
    }
  }

  if (currentToken !== "") {
    tokens.push(currentToken);
  }

  return tokens;
}
