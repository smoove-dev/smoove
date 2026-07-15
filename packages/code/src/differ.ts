import { patienceDiff } from "./diff.js";
import { type CodeScope, type CodeTag, resolveScope } from "./scope.js";
import type { CodeTokenizer } from "./tokenizer.js";

/**
 * Compares two code scopes and returns a list of {@link CodeTag}s describing a
 * transition between them: unchanged runs stay plain strings, changed runs
 * become `{before, after}` fragments.
 */
export function defaultDiffer(from: CodeScope, to: CodeScope, tokenize: CodeTokenizer): CodeTag[] {
  const beforeCode = resolveScope(from, false);
  const afterCode = resolveScope(to, true);

  const diff = patienceDiff(tokenize(beforeCode), tokenize(afterCode));

  const fragments: CodeTag[] = [];
  let before = "";
  let after = "";
  let lastAdded = false;
  const flush = () => {
    if (before !== "" || after !== "") {
      fragments.push({ before, after });
      before = "";
      after = "";
    }
  };

  for (const line of diff.lines) {
    if (line.aIndex === -1) {
      if (after !== "" && !lastAdded) {
        flush();
      }
      lastAdded = true;
      after += line.line;
    } else if (line.bIndex === -1) {
      if (before !== "" && lastAdded) {
        flush();
      }
      lastAdded = false;
      before += line.line;
    } else {
      flush();
      fragments.push(line.line);
    }
  }
  flush();

  return fragments;
}
