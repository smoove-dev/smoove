import type { Composition } from "@konva-motion/core";

export function mountScrubber(host: HTMLElement, comp: Composition): () => void {
  host.innerHTML = "";

  const total = comp.durationInFrames.get();

  const topRow = document.createElement("div");
  topRow.className = "row";

  const playBtn = document.createElement("button");
  playBtn.textContent = "▶ Play";
  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = "❚❚ Pause";
  const stopBtn = document.createElement("button");
  stopBtn.textContent = "■ Stop";

  const frameLabel = document.createElement("span");
  frameLabel.className = "frame-label";

  const loopLabel = document.createElement("label");
  loopLabel.className = "loop";
  const loopCheckbox = document.createElement("input");
  loopCheckbox.type = "checkbox";
  loopCheckbox.checked = comp.loop.get();
  loopLabel.append(loopCheckbox, document.createTextNode(" loop"));

  topRow.append(playBtn, pauseBtn, stopBtn, frameLabel, loopLabel);

  const sliderRow = document.createElement("div");
  sliderRow.className = "row";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = String(total - 1);
  slider.step = "1";
  slider.value = "0";
  sliderRow.append(slider);

  host.append(topRow, sliderRow);

  const setLabel = (f: number) => {
    frameLabel.textContent = `frame ${f} / ${total - 1}`;
  };
  setLabel(0);

  let scrubbing = false;

  playBtn.onclick = () => comp.play();
  pauseBtn.onclick = () => comp.pause();
  stopBtn.onclick = () => comp.stop();
  loopCheckbox.onchange = () => comp.setLoop(loopCheckbox.checked);

  slider.addEventListener("pointerdown", () => {
    scrubbing = true;
    comp.pause();
  });
  const endScrub = () => {
    scrubbing = false;
  };
  slider.addEventListener("pointerup", endScrub);
  slider.addEventListener("pointercancel", endScrub);
  slider.addEventListener("input", () => {
    comp.setFrame(Number(slider.value));
  });

  const unsubFrame = comp.frame.subscribe((f) => {
    setLabel(f);
    if (!scrubbing) slider.value = String(f);
  });
  const unsubLoop = comp.loop.subscribe((v) => {
    loopCheckbox.checked = v;
  });

  return () => {
    unsubFrame();
    unsubLoop();
    host.innerHTML = "";
  };
}
