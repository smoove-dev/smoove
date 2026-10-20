# AGENTS.md

This is a smoove studio project. smoove is a timeline-driven animation
engine built on top of Konva: a `Composition` owns the frame clock, each
`Sequence` is a range-gated layer, and every animated value is a pure
function of the frame.

The smoove-video skill is installed in this project (`.agents/skills/` and
`.claude/skills/`). Follow it for any composition code: planning a video,
layout, animation, text and media. If it's missing, install it:

    npx skills add smoove-dev/smoove -s smoove-video

## Work in the studio

Start the studio yourself, and give the user the URL it prints so they can
watch as you work:

    npx smoove start

Stop it with `npx smoove stop` when you're done.

Then loop:

1. Write or change the composition.
2. Run `npm run typecheck` and `npm test`, and fix what they report.
3. Run `npx smoove sheet --comp <id>`. It writes one contact sheet with a
   tile per beat, and prints the image's path. Read the image.
4. Fix what looks wrong, and go back to step 2.

For a closer look at one moment, use
`npx smoove snap --comp <id> --at <beat>` (or `--frame <n>`). Use
`npx smoove timeline --comp <id>` to see the beats and sequences in frames.
Name the beats with `plan()` and pass the plan to the `Composition`, so the
sheet and `--at` can use the names.

When the user says "this", "here" or "that one", run `npx smoove context`
first. It lists the nodes they marked on the frame, with the file and line
of each.

Two rules:

- Never render a video to check your work. Run `npx smoove render` only when
  the user asks for a video.
- Don't move the user's playhead with `npx smoove seek` unless they ask to be
  shown something. Snapshots and sheets never change what the user sees.

## Layout

- `src/compositions/<name>/composition.ts`: a composition (this is where
  animation code lives). Its sibling `index.ts` is the registry entry.
- `src/registry.ts`: the catalog the studio and the server renderer share.
  New compositions must be listed here.
- `src/compositions/<name>/composition.test.ts`: headless tests for a
  composition (vitest and `@smoove/core/testing`). `npm test` runs them all.
  When the brief carries numbers ("the title lands by 0.5 seconds"), assert
  them here.
- `src/layouts/studio-layout.tsx`, `src/routes/`: the studio shell (React
  Router). Rarely needs changes.
- `src/server/`, `src/routes/api.render.*`: the server render queue.
- `.smoove/`: the studio bridge's files, snapshots and sheets. `out/`: videos
  from `npx smoove render`. Both are ignored by git.

Docs: https://smoove.dev
