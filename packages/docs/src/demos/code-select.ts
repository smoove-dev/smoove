import { parser } from "@lezer/javascript";
import { Code, interpolateSelection, LezerHighlighter } from "@smoove/code";
import { Composition, Easing, Sequence } from "@smoove/core";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";
import { codeCard, codeThemes } from "../code-card.js";

const src = `const total = price + tax;
const label = "Total: " + total;
render(label);`;

const fps = 60;
const theme = "dark";

const comp = new Composition({
  id: "code-select",
  fps,
  durationInFrames: fps * 2,
  width: 800,
  height: 450,
});
const main = new Sequence();

const font = new JetBrainsMono({ weights: ["400"] });
main.add(font);

const code = new Code({
  content: src,
  highlighter: new LezerHighlighter(parser),
  font,
  fontSize: 22,
  fill: codeThemes[theme].fill,
});

const card = codeCard(comp, main, theme);
card.add(code);
comp.add(main);

// Dim everything except the `total` uses, then bring it all back.
const totals = code.findRanges("total");
main.register((f) => {
  code.setSelection(
    interpolateSelection(f, [12, 32, 78, 98], [[], totals, totals, []], {
      easing: Easing.inOut(Easing.cubic),
    }),
  );
});

export default comp;
