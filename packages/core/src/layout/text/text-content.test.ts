import { describe, expect, it } from "vitest";
import { Composition } from "../../engine/composition.js";
import { Sequence } from "../../engine/sequence.js";
import { Text } from "./text.js";

let n = 0;
function makeComp(): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `text-content-t${n}`,
    fps: 30,
    durationInFrames: 60,
    width: 400,
    height: 200,
  });
  const seq = new Sequence();
  comp.add(seq);
  return { comp, seq };
}

describe("Text content", () => {
  it("reads back the text it was built with", () => {
    expect(new Text({ text: "46,000", fontSize: 40 }).getText()).toBe("46,000");
  });

  it("reads back what setText wrote, as an updater sets it", () => {
    const { comp, seq } = makeComp();
    const counter = new Text({ text: "46,000", fontSize: 40 });
    seq.add(counter);
    seq.register((frame) => {
      counter.setText(frame < 10 ? "46,000" : "45,999");
    });

    comp.setFrame(5);
    expect(counter.getText()).toBe("46,000");
    comp.setFrame(12);
    expect(counter.getText()).toBe("45,999");
  });

  it("is the full content, not the truncated or half-typed display", () => {
    const { comp, seq } = makeComp();
    const clipped = new Text({ text: "TEACHING ONLINE", width: 60, wrap: "none", fontSize: 40 });
    const typed = new Text({
      text: "types itself out",
      fontSize: 20,
      typewriter: { mode: "letter", durationInFrames: 40 },
    });
    seq.add(clipped, typed);

    comp.setFrame(10);
    expect(clipped.getText()).toBe("TEACHING ONLINE");
    expect(typed.getText()).toBe("types itself out");
  });
});
