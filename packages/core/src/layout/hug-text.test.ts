import { expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Flex } from "./flex/flex.js";
import { Text } from "./text/text.js";

// Guards the exact flexily pin in package.json. From 0.8.3, flexily rounds a
// measured leaf to whole pixels, so a label that needs 59.36px gets 59 and
// breaks onto a second line. Raising the pin means handling that first.

it("keeps a hugging label on one line when its width isn't a whole pixel", () => {
  const comp = new Composition({
    id: "hug-text",
    fps: 30,
    durationInFrames: 10,
    width: 800,
    height: 600,
  });
  const seq = new Sequence();
  comp.add(seq);
  for (const fontSize of [11, 12, 13, 14, 15, 16, 17, 18]) {
    const column = new Flex({ flexDirection: "column" });
    const label = new Text({ text: "Hello world", fontSize, lineHeight: 1 });
    column.add(label);
    seq.add(column);
    comp.setFrame(0);
    expect(label.height(), `${fontSize}px label`).toBe(fontSize);
  }
});
