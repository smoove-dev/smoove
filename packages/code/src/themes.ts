import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * A compact color palette. {@link makeHighlightStyle} expands it into a full
 * CodeMirror `HighlightStyle` covering the common syntax tags, so a preset is
 * one small object instead of a long tag table.
 */
export interface CodePalette {
  keyword: string;
  name: string;
  variable: string;
  func: string;
  string: string;
  number: string;
  comment: string;
  type: string;
  operator: string;
  punctuation: string;
  constant: string;
  regexp: string;
}

/** Build a `HighlightStyle` from a {@link CodePalette}. */
export function makeHighlightStyle(palette: CodePalette): HighlightStyle {
  return HighlightStyle.define([
    { tag: t.keyword, color: palette.keyword },
    { tag: [t.name, t.propertyName, t.macroName, t.labelName], color: palette.name },
    { tag: [t.variableName], color: palette.variable },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: palette.func,
    },
    { tag: [t.string, t.special(t.string), t.quote], color: palette.string },
    { tag: [t.number, t.bool, t.atom], color: palette.number },
    { tag: [t.comment], color: palette.comment, fontStyle: "italic" },
    { tag: [t.typeName, t.className], color: palette.type },
    { tag: [t.operator, t.operatorKeyword], color: palette.operator },
    {
      tag: [t.brace, t.squareBracket, t.angleBracket, t.punctuation, t.separator, t.derefOperator],
      color: palette.punctuation,
    },
    {
      tag: [t.constant(t.name), t.standard(t.name), t.self, t.null],
      color: palette.constant,
    },
    { tag: [t.regexp], color: palette.regexp },
  ]);
}

/** A soft light theme (Nord "snow storm"). */
export const nordLight: HighlightStyle = makeHighlightStyle({
  keyword: "#5e81ac",
  name: "#4c566a",
  variable: "#2e3440",
  func: "#8fbcbb",
  string: "#a3be8c",
  number: "#b48ead",
  comment: "#7b88a1",
  type: "#2e3440",
  operator: "#81a1c1",
  punctuation: "#4c566a",
  constant: "#5e81ac",
  regexp: "#bf616a",
});

/** A vivid dark theme. */
export const dracula: HighlightStyle = makeHighlightStyle({
  keyword: "#ff79c6",
  name: "#f8f8f2",
  variable: "#f8f8f2",
  func: "#50fa7b",
  string: "#f1fa8c",
  number: "#bd93f9",
  comment: "#6272a4",
  type: "#8be9fd",
  operator: "#ff79c6",
  punctuation: "#f8f8f2",
  constant: "#bd93f9",
  regexp: "#ff5555",
});

/** A clean light theme. */
export const githubLight: HighlightStyle = makeHighlightStyle({
  keyword: "#cf222e",
  name: "#0550ae",
  variable: "#24292f",
  func: "#8250df",
  string: "#0a3069",
  number: "#0550ae",
  comment: "#6e7781",
  type: "#953800",
  operator: "#cf222e",
  punctuation: "#24292f",
  constant: "#0550ae",
  regexp: "#0a3069",
});

/** All named presets, keyed by name. */
export const codeThemes = {
  nordLight,
  dracula,
  githubLight,
} as const;
