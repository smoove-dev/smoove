---
title: Introduction
group: Getting Started
order: 1
eyebrow: Getting Started
description: What konva-motion is, how the timeline drives tweens, and when to reach for it.
icon: book
---

konva-motion adds a timeline and a tweening engine to [Konva](https://konvajs.org). Describe motion declaratively — animate any node, sequence and loop it, then play it back smoothly or render it to video.

## Why konva-motion

Konva gives you a fast 2D canvas scene graph. konva-motion gives that scene graph a
clock: a frame-accurate timeline that drives your nodes' attributes over time. Instead
of wiring up `requestAnimationFrame` loops by hand, you describe **what** should change
and **when** — the engine handles the rest.

- Declarative, timeline-driven animation for Konva — no framework required.
- Composable timelines with nested sequences.
- Works with any Konva node — shapes, text, groups, and images.
- The same timeline that plays in the browser renders to video on the server.

## How it fits together

A `Composition` owns a frame clock (fps + duration). A `Sequence` is a range-gated
layer — visible only while the playhead is inside its window. On each tick the
composition walks its sequences, runs their updaters, and repaints the active ones.

> Animation is not the art of drawings that move, but the art of movements that are drawn.
>
> — Norman McLaren

## Next steps

Head to [Installation](/docs/installation) to add the package and play your first
tween, or jump to [Components & Typography](/docs/components) for the full content
reference.
