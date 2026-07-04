import {
  Composition,
  Flex,
  interpolate,
  interpolateColors,
  Rect,
  Sequence,
  Text,
} from "@smoove/core";
import Font from "@smoove/google-fonts/special-elite";

/**
 * The dynamic-props demo. One composition, parametrized by `props`: the
 * headline, the accent color, and the number of filled rating bars all come out
 * of the props object; nothing in the scene is hard-coded. Swap props (in code,
 * from a player with `setProps`, or per-record at render time) and the whole
 * frame changes. Here we give it one default set so the embedded player has
 * something to loop; the updaters read `comp.props.get()` every tick, so a live
 * `setProps` would take effect on the very next frame.
 *
 * The scene is a centered flex column (rule, headline, rating row), so a long
 * headline wraps, grows taller, pushes the rating row down, and the whole group
 * stays centered. Layout reflows every tick, so it follows the props live.
 */
type CardProps = {
  headline: string;
  accent: string;
  rating: number; // 0..5
};

const width = 1280;
const height = 720;
const fps = 60;
const duration = fps * 3;

const comp = new Composition<CardProps>({
  id: "dynamic-props",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
  props: { headline: "Parametrized video", accent: "#38bdf8", rating: 4 },
});

const scene = new Sequence();
scene.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

// A column filling the stage. justifyContent center keeps the group in the
// middle of the screen as its height changes; alignItems flex-start lines the
// children up on the left. Horizontal padding gives long text a margin to wrap
// inside.
const column = new Flex({
  x: 0,
  y: 0,
  width,
  height,
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: 32,
  padding: [0, 140],
});
scene.add(column);

// Accent rule. A shape's width is its layout size, so growing it reflows the row.
const rule = new Rect({ width: 0, height: 8, cornerRadius: 4 });
column.add(rule);

// Headline. A fixed wrap width plus word wrap means long text grows downward and
// pushes the rating row, instead of overflowing sideways.

const font = new Font({ styles: ["normal"], weights: ["400"] });
scene.add(font);

const headline = new Text({
  width: 900,
  align: "left",
  text: "",
  fontSize: 60,
  font,
  lineHeight: 1.15,
  fill: "#f9fafb",
  wrap: "word",
  typewriter: {
    durationInFrames: duration / 6,
    reserveHeight: false,
  },
});
column.add(headline);

// Rating row: five pips laid out in a nested flex row.
const ratingRow = new Flex({ flexDirection: "row", gap: 14 });
const pips: Rect[] = [];
for (let i = 0; i < 5; i++) {
  const pip = new Rect({ width: 44, height: 44, cornerRadius: 8, fill: "#1f2937" });
  pips.push(pip);
  ratingRow.add(pip);
}
column.add(ratingRow);

scene.register((frame) => {
  const { headline: text, accent, rating } = comp.props.get();

  // Everything below is f(frame, props): the text and accent are props, the
  // reveal is the frame. Layout reflows after this runs, so a longer headline
  // pushes the rating row down on the same tick.
  headline.setText(text);

  // A flex child's layout size is `flexWidth`/`flexHeight`, not the Konva box,
  // so animate the size the layout reads (calling `rule.width(...)` would only
  // move the bounding box and the layout would keep drawing it at 0).
  // TODO: this should be fixed..
  const grow = interpolate(frame, [0, 24], [0, 480], { extrapolateRight: "clamp" });
  rule.setAttrs({ flexWidth: grow });
  rule.fill(accent);

  pips.forEach((pip, i) => {
    const on = i < rating;

    pip.fill(
      on ? interpolateColors(frame, [30 + i * 8, 42 + i * 8], ["#11161d", accent]) : "#11161d",
    );
  });
});

comp.add(scene);
export default comp;
