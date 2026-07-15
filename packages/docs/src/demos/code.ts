import { parser } from "@lezer/javascript";
import { Code, interpolateCode, LezerHighlighter } from "@smoove/code";
import { Composition, Easing, Sequence } from "@smoove/core";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";
import { codeCard, codeThemes } from "../code-card.js";

const A = `function Counter() {
  const [count, setCount] = useState(0);

  return <span>{count}</span>;
}`;

const B = `function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}`;

const fps = 60;
const theme = "dark";

const comp = new Composition({
  id: "code",
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
  // A React snippet, so enable JSX in the parser.
  highlighter: new LezerHighlighter(parser.configure({ dialect: "jsx" })),
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
