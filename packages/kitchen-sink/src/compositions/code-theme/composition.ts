import { parser } from "@lezer/javascript";
import { Code, interpolateCode, LezerHighlighter, nordLight } from "@smoove/code";
import { Composition, Easing, Sequence } from "@smoove/core";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";
import { codeCard, codeThemes } from "../../lib/code-card.js";

const A = `const items = [1, 2, 3];`;
const B = `const items = [1, 2, 3].map((n) => n * 2);`;

const fps = 60;
// A light preset: switch the scene to light and theme the highlighter to match.
const theme = "light";

const comp = new Composition({
  id: "code-theme",
  fps,
  durationInFrames: fps * 2,
  width: 800,
  height: 450,
});
const main = new Sequence();

const font = new JetBrainsMono({ weights: ["400"] });
main.add(font);

const code = new Code({
  content: A,
  highlighter: new LezerHighlighter(parser, nordLight),
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
