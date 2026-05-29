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

  // ---- Audio mixer: master volume + master mute. ----
  const audioRow = document.createElement("div");
  audioRow.className = "row";

  const muteLabel = document.createElement("label");
  muteLabel.className = "loop";
  const muteCheckbox = document.createElement("input");
  muteCheckbox.type = "checkbox";
  muteCheckbox.checked = comp.mixer.muted.get();
  muteLabel.append(muteCheckbox, document.createTextNode(" mute"));

  const volIcon = document.createElement("span");
  volIcon.textContent = "🔊";

  const volSlider = document.createElement("input");
  volSlider.type = "range";
  volSlider.min = "0";
  volSlider.max = "100";
  volSlider.step = "1";
  volSlider.value = String(Math.round(comp.mixer.volume.get() * 100));

  const volLabel = document.createElement("span");
  volLabel.className = "frame-label";

  audioRow.append(muteLabel, volIcon, volSlider, volLabel);

  host.append(topRow, sliderRow, audioRow);

  const setLabel = (f: number) => {
    frameLabel.textContent = `frame ${f} / ${total - 1}`;
  };
  setLabel(0);

  const setVolLabel = (v: number) => {
    volLabel.textContent = `${Math.round(v * 100)}%`;
  };
  setVolLabel(comp.mixer.volume.get());

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

  volSlider.addEventListener("input", () => {
    comp.mixer.setVolume(Number(volSlider.value) / 100);
  });
  muteCheckbox.onchange = () => comp.mixer.setMuted(muteCheckbox.checked);

  const unsubFrame = comp.frame.subscribe((f) => {
    setLabel(f);
    if (!scrubbing) slider.value = String(f);
  });
  const unsubLoop = comp.loop.subscribe((v) => {
    loopCheckbox.checked = v;
  });
  const unsubVolume = comp.mixer.volume.subscribe((v) => {
    setVolLabel(v);
    volSlider.value = String(Math.round(v * 100));
  });
  const unsubMuted = comp.mixer.muted.subscribe((m) => {
    muteCheckbox.checked = m;
  });

  return () => {
    unsubFrame();
    unsubLoop();
    unsubVolume();
    unsubMuted();
    host.innerHTML = "";
  };
}
