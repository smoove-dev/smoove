import { parser } from "@lezer/python";
import { Code, interpolateCode, LezerHighlighter } from "@smoove/code";
import { Composition, Easing, Sequence } from "@smoove/core";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";
import { codeCard, codeThemes } from "../code-card.js";

const A = `def greet(name):
    return "Hello " + name`;
const B = `def greet(name):
    greeting = "Hello"
    return f"{greeting} {name}"`;

const fps = 60;
const theme = "dark";

const comp = new Composition({
  id: "code-language",
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
  // Swap the parser to highlight a different language, here Python.
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
