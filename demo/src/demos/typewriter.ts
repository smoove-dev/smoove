import { Composition, Sequence } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

type Message = { role: "user" | "ai"; text: string };

const CONVERSATION: Message[] = [
  { role: "user", text: "What is konva-motion?" },
  {
    role: "ai",
    text: "konva-motion brings Remotion-style timeline-driven animation to Konva. A Composition owns a frame clock; a Sequence is a range-gated layer that runs updaters and paints only while the playhead is in range.",
  },
  { role: "user", text: "Nice. Can you show me a typewriter effect?" },
  {
    role: "ai",
    text: "Sure — this whole demo is one. Each character is revealed by slicing the target string against a per-message frame budget. The blinking caret is just a Konva.Rect with opacity driven by frame % N.",
  },
];

const CHARS_PER_SEC = 60;
const PAUSE_AFTER = 30; // frames to pause after each message finishes

export const typewriterDemo: DemoDef = {
  id: "typewriter",
  name: "Typewriter — AI chat",
  build(container, width, height) {
    const fps = 30;
    const charsPerFrame = CHARS_PER_SEC / fps;

    // Frame budgets per message: typing frames + pause.
    const budgets = CONVERSATION.map((m) => Math.ceil(m.text.length / charsPerFrame) + PAUSE_AFTER);
    const starts: number[] = [];
    let acc = 0;
    for (const b of budgets) {
      starts.push(acc);
      acc += b;
    }
    const total = acc;

    const comp = new Composition({
      id: "typewriter",
      fps,
      durationInFrames: total,
      container,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: total });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

    const padding = 24;
    const maxBubbleWidth = Math.min(640, width - padding * 2);
    const fontSize = 16;
    const lineHeight = 1.4;

    type Bubble = {
      msg: Message;
      group: Konva.Group;
      bg: Konva.Rect;
      text: Konva.Text;
      caret: Konva.Rect;
    };

    const bubbles: Bubble[] = CONVERSATION.map((msg) => {
      const isUser = msg.role === "user";
      const group = new Konva.Group({ visible: false });

      // Pre-measure the message at full text so the bubble doesn't reflow.
      const measurer = new Konva.Text({
        text: msg.text,
        fontSize,
        fontFamily: "ui-sans-serif, -apple-system, system-ui, sans-serif",
        lineHeight,
        width: maxBubbleWidth - 28,
      });
      const bubbleWidth = Math.min(maxBubbleWidth, measurer.width() + 28);
      const bubbleHeight = measurer.height() + 24;
      measurer.destroy();

      const bg = new Konva.Rect({
        x: 0,
        y: 0,
        width: bubbleWidth,
        height: bubbleHeight,
        cornerRadius: 14,
        fill: isUser ? "#4ea1ff" : "#1f2933",
      });
      const text = new Konva.Text({
        x: 14,
        y: 12,
        text: "",
        fontSize,
        fontFamily: "ui-sans-serif, -apple-system, system-ui, sans-serif",
        lineHeight,
        fill: "#fff",
        width: bubbleWidth - 28,
      });
      const caret = new Konva.Rect({
        x: 14,
        y: 12,
        width: 2,
        height: fontSize * lineHeight,
        fill: "#fff",
        opacity: 0,
      });

      group.add(bg);
      group.add(text);
      group.add(caret);
      main.add(group);

      return { msg, group, bg, text, caret };
    });

    main.register((frame) => {
      // Stack visible bubbles top-down with current heights.
      let y = padding;

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        const start = starts[i];
        if (!b || start === undefined) continue;

        if (frame < start) {
          b.group.visible(false);
          continue;
        }

        const local = frame - start;
        const charsTotal = b.msg.text.length;
        const revealed = Math.min(charsTotal, Math.floor(local * charsPerFrame));
        const isTyping = revealed < charsTotal;

        b.group.visible(true);
        b.text.text(b.msg.text.slice(0, revealed));

        const isUser = b.msg.role === "user";
        const bubbleWidth = b.bg.width();
        b.group.x(isUser ? width - padding - bubbleWidth : padding);
        b.group.y(y);
        y += b.bg.height() + 10;

        // Caret: position at end of revealed text, blink every 15 frames while typing.
        // Hide once the message is fully done and the next message has started.
        if (isTyping) {
          // Use Konva's text measurement: simplest reliable placement is to
          // measure the last line. Konva.Text doesn't expose per-line widths
          // cheaply, so anchor at end of full text width when complete and at
          // a sliding x while typing.
          const partial = new Konva.Text({
            text: b.msg.text.slice(0, revealed),
            fontSize,
            fontFamily: b.text.fontFamily(),
            lineHeight,
            width: bubbleWidth - 28,
          });
          const lines = partial.textArr;
          const last = lines[lines.length - 1];
          const lineY = (lines.length - 1) * fontSize * lineHeight;
          const lineW = last ? last.width : 0;
          partial.destroy();

          b.caret.position({ x: 14 + lineW + 2, y: 12 + lineY });
          b.caret.opacity(Math.floor(frame / 15) % 2 === 0 ? 1 : 0);
        } else if (
          i === bubbles.length - 1 ||
          frame < (starts[i + 1] ?? Number.POSITIVE_INFINITY)
        ) {
          // Last typed message: keep a steady caret blink at the end.
          b.caret.opacity(Math.floor(frame / 15) % 2 === 0 ? 0.6 : 0);
        } else {
          b.caret.opacity(0);
        }
      }
    });

    comp.add(main);
    return comp;
  },
};
