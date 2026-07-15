import { parser } from "@lezer/javascript";
import { Code, insert, interpolateEdit, LezerHighlighter, lines, replace } from "@smoove/code";
import { Composition, Easing, Sequence } from "@smoove/core";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";
import { codeCard, codeThemes } from "../../lib/code-card.js";

const base = `function sum(list) {
  let total = 0;
  for (const n of list) {
    total += n;
  }
  return total;
}`;

// Target ranges directly instead of diffing whole strings: drop in a comment
// and collapse the loop body into a reduce.
const edits = [
  insert([0, 0], "// sum a list of numbers\n"),
  replace(lines(1, 5), "  return list.reduce((a, b) => a + b, 0);"),
];

const fps = 60;
const theme = "dark";

const comp = new Composition({
  id: "code-edit",
  fps,
  durationInFrames: fps * 1.5,
  width: 800,
  height: 450,
});
const main = new Sequence();

const font = new JetBrainsMono({ weights: ["400"] });
main.add(font);

const code = new Code({
  content: base,
  highlighter: new LezerHighlighter(parser),
  font,
  fontSize: 22,
  fill: codeThemes[theme].fill,
});

const card = codeCard(comp, main, theme);
card.add(code);
comp.add(main);

main.register((f) => {
  code.setContent(
    interpolateEdit(f, [12, 40], base, edits, { easing: Easing.inOut(Easing.cubic) }),
  );
});

export default comp;
