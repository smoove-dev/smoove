---
title: Installation
group: Getting Started
order: 2
eyebrow: Getting Started
description: Add the package, create a Konva Stage, and play your first tween.
icon: cube
---

konva-motion ships as an ES module with `konva` as a peer dependency. Install both, build a scene, and drive it from a timeline.

## Install

```bash
npm install konva konva-motion
# or
pnpm add konva konva-motion
```

:::note Konva is a peer dependency
Pin the `konva` version yourself — konva-motion extends Konva's classes, so the two must resolve to a single copy.
:::

## Your first tween

```js
import Konva from "konva";
import { Timeline, easeOut } from "konva-motion";

// a regular Konva stage + layer
const stage = new Konva.Stage({ container: "scene", width: 1280, height: 720 });
const layer = new Konva.Layer();
stage.add(layer);

const title = new Konva.Text({ text: "Motion in minutes", fontSize: 96, y: 80, opacity: 0 });
layer.add(title);

// describe the motion on a timeline, then play it
const tl = new Timeline({ loop: true });
tl.to(title, { y: 0, opacity: 1, duration: 0.9, easing: easeOut });
tl.play();
```

:::warning Heads up
Add a node to a Konva `Layer` before you tween it — animating a detached node updates its attributes but nothing repaints.
:::

## Step by step

:::steps
1. **Create a Stage & Layer**

   Set up a Konva `Stage` bound to a container element, add a `Layer`, and place your shapes on it.

2. **Build a Timeline**

   Create a `Timeline` — it sequences your tweens and repaints the layer for you on every frame.

3. **Tween a node**

   Call `tl.to(node, { …attrs, duration })` to animate any Konva attribute, then `tl.play()`.
:::

You're ready — explore the full content toolkit in [Components & Typography](/docs/components).
