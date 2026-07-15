import { parser } from "@lezer/javascript";
import { Code, interpolateCode, LezerHighlighter } from "@smoove/code";
import { Composition, Easing, Sequence } from "@smoove/core";
import DMMono from "@smoove/google-fonts/dm-mono";
import { codeCard, codeThemes } from "../code-card.js";

const A = `const add = (a, b) => a + b;`;
const B = `const add = (a, b) => a + b;
const total = [1, 2, 3].reduce(add, 0);`;

const fps = 60;
const theme = "dark";

const comp = new Composition({
  id: "code-font",
  fps,
  durationInFrames: fps * 2,
  width: 800,
  height: 450,
});
const main = new Sequence();

// Pass any monospace Google font as `font`.
const font = new DMMono({ weights: ["400", "500"] });
main.add(font);

const code = new Code({
  content: A,
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
    interpolateCode(f, [10, 30, 80, 100], [A, B, B, A], {
      easing: Easing.inOut(Easing.cubic),
    }),
  );
});

export default comp;
