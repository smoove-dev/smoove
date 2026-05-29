import type { Composition } from "@konva-motion/core";
import { basicDemo } from "./demos/basic.js";
import { bouncingDemo } from "./demos/bouncing.js";
import { cohabitDemo } from "./demos/cohabit.js";
import { colorsDemo } from "./demos/colors.js";
import { easingsDemo } from "./demos/easings.js";
import { flexLayoutDemo } from "./demos/flex-layout.js";
import { flexRowGrowDemo } from "./demos/flex-row-grow.js";
import { flexShowcaseDemo } from "./demos/flex-showcase.js";
import { flexTypewriterDemo } from "./demos/flex-typewriter.js";
import { igStoryDemo } from "./demos/ig-story.js";
import { imageClipDemo } from "./demos/image-clip.js";
import { imageFadeDemo } from "./demos/image-fade.js";
import { imageSliderDemo } from "./demos/image-slider.js";
import { journeyDemo } from "./demos/journey.js";
import { keyframesDemo } from "./demos/keyframes.js";
import { staggeredDemo } from "./demos/staggered.js";
import { transformsDemo } from "./demos/transforms.js";
import type { DemoDef } from "./demos/types.js";
import { typewriterDemo } from "./demos/typewriter.js";
import { videoSyncDemo } from "./demos/video-sync.js";
import { mountScrubber } from "./scrubber.js";

const DEMOS: DemoDef[] = [
  cohabitDemo,
  videoSyncDemo,
  igStoryDemo,
  journeyDemo,
  basicDemo,
  bouncingDemo,
  staggeredDemo,
  transformsDemo,
  easingsDemo,
  colorsDemo,
  keyframesDemo,
  imageSliderDemo,
  imageFadeDemo,
  imageClipDemo,
  typewriterDemo,
  flexLayoutDemo,
  flexTypewriterDemo,
  flexRowGrowDemo,
  flexShowcaseDemo,
];

const stageHost = document.getElementById("stage");
const scrubberHost = document.getElementById("scrubber");
const list = document.getElementById("demo-list");
if (!stageHost || !scrubberHost || !list) throw new Error("missing demo scaffolding");

let current: {
  comp: Composition;
  disposeScrubber: () => void;
  buttonEl: HTMLButtonElement;
} | null = null;

const teardownCurrent = () => {
  if (!current) return;
  current.disposeScrubber();
  current.comp.destroy();
  current.buttonEl.classList.remove("active");
  stageHost.innerHTML = "";
  current = null;
};

const mountDemo = (demo: DemoDef, buttonEl: HTMLButtonElement) => {
  teardownCurrent();
  stageHost.id = "stage";
  const slot = document.createElement("div");
  slot.id = `stage-${demo.id}`;
  stageHost.appendChild(slot);
  const cs = getComputedStyle(stageHost);
  const padX = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
  const padY = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
  const width = stageHost.clientWidth - padX;
  const height = stageHost.clientHeight - padY;
  const comp = demo.build(slot.id, Math.max(320, width | 0), Math.max(200, height | 0));
  const disposeScrubber = mountScrubber(scrubberHost, comp);
  buttonEl.classList.add("active");
  current = { comp, disposeScrubber, buttonEl };
};

for (const demo of DEMOS) {
  const btn = document.createElement("button");
  btn.className = "demo-btn";
  btn.textContent = demo.name;
  btn.onclick = () => mountDemo(demo, btn);
  list.appendChild(btn);
}

const firstButton = list.querySelector<HTMLButtonElement>(".demo-btn");
if (firstButton && DEMOS[0]) mountDemo(DEMOS[0], firstButton);
