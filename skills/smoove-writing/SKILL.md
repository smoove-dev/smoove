---
name: smoove-writing
description: Use when writing or editing any smoove prose - READMEs, docs pages, package descriptions, website copy, changelogs, announcements, or error messages for smoove / @smoove packages.
metadata:
  tags: smoove, writing, docs, readme, voice, brand, copy, coauthoring
---

# Writing smoove prose

## Overview

Self-contained guide for every piece of smoove prose: what smoove is, how it
talks, a co-authoring workflow for longer documents, and hard rules that keep
the writing human. Everything you need is in this file; no outside reading
required.

## Pick a mode

- Short piece (README section, package description, changelog entry, error
  message): write directly using the brand and style rules below, then run
  the self-check.
- Structured document (docs page, guide, proposal, announcement, spec): run
  the co-authoring workflow at the bottom. The brand and style rules govern
  everything drafted inside it.

## The brand

**Essence: smooth moves, in code.** smoove is a timeline-driven animation
engine for the canvas. Motion that is buttery in preview and light on the
server, built on concepts humans and LLMs already understand. The name says
it: every animation should feel smoove.

**One-liner:** a timeline-driven animation engine for Konva. Keyframe motion
that runs anywhere, renders fast, and is built on familiar concepts an LLM
can reason about to author videos.

**Audience:** technical creators, developers first. The core circle is JS/TS
developers adding real animation to canvas apps without adopting a heavy
video framework. The outer circle is anyone technical, because the real
unlock is handing skills to an LLM and letting it generate the videos. The
API is built on concepts a model already knows (keyframes, timelines, flexbox
layout, familiar shape primitives), so clarity for the LLM is clarity for the
human. Write docs both can follow literally.

**Personality:** effortless, playful, sharp. Confident but never stiff. The
wink is in the name, the substance is in the engine. The hard machinery
(layout, timing, SSR) stays hidden so the result just glides.

**Positioning:** smoove stands on its own and is judged on its own merits.
Lead with what makes it good:

- Smoother preview: high-performance playback in the browser.
- Smaller footprint: lighter server-side requirements, fewer dependencies.
- Faster renders: lean SSR and offline rendering.
- No React, no WASM: platform-agnostic. Browser, Node, and headless.
- LLM-authorable: familiar concepts plus documented skills, so a model can
  reason from the API and generate videos.

**Messaging pillars:**

| Pillar | The promise | Proof |
|---|---|---|
| Smooth | Animation that feels good to watch and to write | High-perf preview, frame-accurate timeline |
| Light | Less to install, less to run | Small footprint, no React/WASM |
| Anywhere | One engine, every runtime | Browser, Node, headless SSR |
| Authorable | Familiar to humans and models alike | API built on known concepts plus documented skills |

**Taglines to reuse or riff on:** "Smooth moves, in code." "Motion that
glides." "Timelines for the canvas." "Describe the motion, smoove renders
it."

## Voice

- Plain and a little playful. Short sentences. Active verbs. The joke is the
  name, not the API docs; never get cute at the cost of clarity.
- Let the motion vocabulary carry: glide, flow, smooth, move, frame, timeline.
- Show, don't boast. A tight code sample beats an adjective. If a section has
  three adjectives and no code, cut adjectives and add code.
- Write docs an LLM can follow literally: unambiguous, example-led, one clear
  way to do each thing.

**Hard rules:**

- Never mention, name, or compare against other frameworks or libraries.
  Not Remotion, not "Remotion-style", not "unlike X". smoove stands on its
  own. Konva is the one exception: smoove is the animation layer that rides
  on top of Konva, so name Konva freely, and never criticize it or claim to
  replace it.
- No unmeasured numbers or absolute claims. Say "lighter" or "fast preview",
  not "3x faster" or "jitter-free" or "renders identically", until benchmarked.

## Human style (hard rules)

The output must not read as LLM-generated.

- **No em dashes (—) or en dashes (–), ever.** Use a comma, a period, a colon,
  or parentheses instead. Hyphens in compound words (frame-accurate) are fine.
- No bold-term bullet scaffolding ("**Seek anywhere** followed by a dash and
  an explanation"). If a bullet needs a lead-in, use a colon, or just write a
  sentence.
- No contrast-opener templates: "Instead of X, you Y", "It's not just X, it's
  Y", "Gone are the days of X".
- Avoid rule-of-three adjective runs ("deterministic, seekable, scrubbable").
  Pick the one that matters.
- Ban the filler set: seamlessly, effortlessly, powerful, blazing, robust,
  "comes for free", "The result is", "simply", "straightforward", delve,
  leverage, "under the hood" (once per doc max).
- Vary sentence length. Not every paragraph needs a summary sentence. It is
  fine to end a section on a code block.

## Before / after

Bad:

> **smoove** brings Remotion-style, timeline-driven animation to Konva.
> Instead of hand-wiring tweens and timers, you describe *what the canvas
> looks like at a given frame* — smoove owns the clock.
> - **Frame-driven, not time-driven** — animations are pure functions of the
>   frame number, so playback is deterministic and jitter-free.

Good:

> smoove is a timeline-driven animation engine for Konva. You describe what
> the canvas looks like at a given frame, and smoove owns the clock.
>
> ```ts
> const comp = new Composition({ width: 1080, height: 1080, fps: 30 });
> ```
>
> - Animations are pure functions of the frame number, so you can seek or
>   scrub to any frame.

## Co-authoring workflow (structured docs)

Three stages. Do not draft a long document in one shot.

### Stage 1: gather context

Close the gap between what the author knows and what you know before writing
a word.

1. Ask for the meta first: what type of document, who reads it, what should
   change after they read it, any template or format to follow.
2. Invite an unorganized info dump: background, constraints, decisions
   already made, related docs or code to read. Read what they point at
   (package source, existing docs pages, design docs in `doc/`).
3. Ask 5-10 numbered clarifying questions based on the gaps. Let the author
   answer in shorthand.

Exit when you can ask about edge cases and trade-offs without needing basics
explained.

### Stage 2: build section by section

1. Agree on a section list. Start with the section that has the most
   unknowns (for a guide, usually the core workflow; leave summaries and
   intros for last).
2. Create the file with all section headers and placeholder text, so there is
   a scaffold to fill in.
3. For each section: ask what it must cover, brainstorm 5-15 candidate
   points, let the author keep/cut/combine, check what is missing, then
   draft. Draft in the smoove voice from this file.
4. Refine with surgical edits, never full reprints. Ask the author to
   request changes rather than edit directly, and carry their preferences
   into later sections.
5. When a section stops changing, ask the trim question: what can be removed
   without losing information?

When 80% of sections are done, re-read the whole document for flow,
contradictions, redundancy, and generic filler. Every sentence should carry
weight.

### Stage 3: reader testing

Test the document on a reader with zero context before calling it done.

1. Predict 5-10 questions a real reader would bring to this document.
2. For each, dispatch a fresh subagent with only the document text and the
   question. No conversation context.
3. Also ask a subagent: what is ambiguous, what prior knowledge does this
   assume, where does it contradict itself?
4. Fix what readers got wrong, then re-test those spots. The document is
   ready when fresh readers answer correctly and stop surfacing new gaps.

## Self-check before delivering

1. Search the text for em and en dashes. Zero occurrences allowed.
2. Search for other framework names. Zero allowed (Konva excepted).
3. Search for hard numbers in claims. Each one must be measured or removed.
4. Read one paragraph aloud in your head. If it sounds like a launch blog
   post template, rewrite it plainer.
5. Does the piece show at least one code sample where it makes a claim about
   the API? If it only has adjectives, add code.
6. For structured docs: did a zero-context reader test pass?

## Common mistakes

| Mistake | Fix |
|---|---|
| "Remotion-style timeline" | "timeline-driven", full stop |
| Bold term, dash, explanation bullets | Plain sentence bullets |
| "deterministic, seekable, scrubbable" | "deterministic" (pick one) |
| "3x faster renders" | "fast renders" until benchmarked |
| Paragraph of adjectives | One sentence plus a code sample |
| Drafting a full guide in one shot | Gather context, then build section by section |
| Shipping without reader testing | Test with a zero-context subagent first |
