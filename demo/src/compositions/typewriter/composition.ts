import { Block, Composition, Flex, Sequence, Text } from "@smoove/core";
import Konva from "konva";

type Message = { role: "user" | "ai"; text: string };

const CONVERSATION: Message[] = [
  { role: "user", text: "What is smoove?" },
  {
    role: "ai",
    text: "smoove brings Remotion-style timeline-driven animation to Konva. A Composition owns a frame clock; a Sequence is a range-gated layer that paints only while the playhead is in range.",
  },
  { role: "user", text: "Nice. How is this chat built?" },
  {
    role: "ai",
    text: "Entirely from Flex, Block, and Text. Each bubble is a Block that hugs its text; the typing is the Text component's built-in typewriter, and the messages are staggered with per-message startFrame — all driven by one Sequence.",
  },
];

const FONT = "ui-sans-serif, -apple-system, system-ui, sans-serif";
const CHARS_PER_SEC = 50;
const PAUSE_AFTER = 22; // frames to wait after a message finishes before the next

const width = 1280;
const height = 720;
const fps = 30;
const charsPerFrame = CHARS_PER_SEC / fps;

// Per-message typing budgets + cumulative start frames (the stagger).
const typeFrames = CONVERSATION.map((m) => Math.ceil(m.text.length / charsPerFrame));
const starts: number[] = [];
let acc = 0;
for (let i = 0; i < CONVERSATION.length; i++) {
  starts.push(acc);
  acc += (typeFrames[i] ?? 0) + PAUSE_AFTER;
}
const total = acc + 40;

const comp = new Composition({
  id: "typewriter",
  fps,
  durationInFrames: total,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: total });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const pad = 24;
const chatW = Math.min(560, width - pad * 2);
const bubbleMax = Math.round(chatW * 0.82);

// One Flex column holds the whole conversation; bubbles flow top-down.
const list = new Flex({
  x: (width - chatW) / 2,
  y: pad,
  width: chatW,
  flexDirection: "column",
  gap: 10,
});

const bubbles: { block: Block; start: number }[] = [];
CONVERSATION.forEach((msg, i) => {
  const isUser = msg.role === "user";
  const block = new Block({
    alignSelf: isUser ? "flex-end" : "flex-start",
    flexDirection: "column",
    padding: [10, 14],
    background: isUser ? "#2f81f7" : "#21262d",
    cornerRadius: isUser ? [16, 16, 4, 16] : [16, 16, 16, 4],
  });
  block.add(
    new Text({
      maxWidth: bubbleMax,
      text: msg.text,
      fontSize: 16,
      lineHeight: 1.4,
      fontFamily: FONT,
      fill: isUser ? "#fff" : "#e6edf3",
      typewriter: {
        mode: "letter",
        startFrame: starts[i],
        durationInFrames: typeFrames[i],
        // Bubble keeps its final width and grows in height as it types.
        reserveHeight: false,
        cursor: { color: isUser ? "#cfe3ff" : "#7d8590", hideWhenDone: true },
      },
    }),
  );
  // Hidden until its turn — flex skips invisible children, so no gap is held.
  block.visible(false);
  list.add(block);
  bubbles.push({ block, start: starts[i] ?? 0 });
});
main.add(list);

main.register((local) => {
  for (const b of bubbles) b.block.visible(local >= b.start);
});

comp.add(main);
export default comp;
