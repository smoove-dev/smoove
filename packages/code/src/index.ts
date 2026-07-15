export { Code, type CodeConfig } from "./code.js";
export {
  type CodeContent,
  interpolateCode,
  interpolateEdit,
  interpolateSelection,
  normalizeSelection,
  resolveContent,
  type SelectionContent,
} from "./content.js";
// The default theme, also available under a named alias.
export {
  DefaultHighlightStyle,
  DefaultHighlightStyle as nordDark,
} from "./default-highlight-style.js";
export { patienceDiff } from "./diff.js";
export { defaultDiffer } from "./differ.js";
export { type Edit, insert, remove, replace } from "./edit.js";
export type { CodeHighlighter, HighlightResult } from "./highlighter.js";
export { LezerHighlighter } from "./lezer-highlighter.js";
export {
  type CodePoint,
  type CodeRange,
  type CodeSelection,
  findAllCodeRanges,
  fullSelection,
  isCodeRange,
  isPointInCodeRange,
  isPointInCodeSelection,
  lines,
  type PossibleCodeSelection,
  pointToPoint,
  word,
} from "./range.js";
export {
  type CodeFragment,
  type CodeScope,
  type CodeTag,
  type PossibleCodeScope,
  parseCodeScope,
  resolveScope,
} from "./scope.js";
export {
  type CodePalette,
  codeThemes,
  dracula,
  githubLight,
  makeHighlightStyle,
  nordLight,
} from "./themes.js";
export { type CodeTokenizer, defaultTokenize } from "./tokenizer.js";
