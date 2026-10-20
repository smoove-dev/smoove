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

Start the studio yourself, in the background, and give the user the URL it
prints so they can watch as you work:

    npx smoove agent start

Stop it with `npx smoove agent stop` when you're done. (`npx smoove start`
runs the same studio in the foreground; that one is for people.)

The project also registers the agent commands as MCP tools (`.mcp.json`).
When the smoove tools are available, use them: they're the same commands as
`npx smoove agent`, and `snap` and `sheet` hand you the image directly. The
command works when they aren't.

To add a composition, run `npx smoove new` with its answers as flags:

    npx smoove new --title "Product launch" --format portrait --seconds 8

It writes `compositions/product-launch/` with a title card to start from.
`--id`, `--group` and `--description` are optional too.

Then loop:

1. Write or change the composition.
2. Run `npm run typecheck` and `npm test`, and fix what they report.
3. Run `npx smoove agent check --comp <id>`. Fix every error before you
   look. Fix each warning too, or, when it's on purpose, add an allow entry
   with a reason to the composition's checks file.
4. Run `npx smoove agent sheet --comp <id>`. It writes one contact sheet
   with a tile per beat, and prints the image's path. Read the image.
5. Fix what looks wrong, and go back to step 2.

For a closer look at one moment, use
`npx smoove agent snap --comp <id> --at <beat>` (or `--frame <n>`). Use
`npx smoove agent timeline --comp <id>` to see the beats and sequences in
frames. Name the beats with `plan()` and pass the plan to the `Composition`,
so the sheet and `--at` can use the names.

When the user says "this", "here" or "that one", run
`npx smoove agent context` first. It lists the nodes they marked on the
frame, with the file and line of each.

Two rules:

- Never render a video to check your work. Run `npx smoove render` only when
  the user asks for a video.
- Don't move the user's playhead with `npx smoove agent seek` unless they ask
  to be shown something. Snapshots and sheets never change what the user
  sees.

## Layout

- `compositions/<id>/`: one folder per composition. Put anything the
  composition needs next to it.
- `compositions/<id>/index.ts`: the composition's entry: id, title, group,
  description, props schema, and how to load it. Every folder needs one; the
  studio lists whatever it finds, with no registry to edit.
- `compositions/<id>/composition.ts`: the composition itself, where the
  animation code lives.
- `compositions/<id>/composition.check.ts`: what the composition promises
  (the title appears by a beat, nothing sits still too long), the allow
  list, and its palette and fonts. `npx smoove agent check` and the tests
  both read it.
- `compositions/<id>/composition.test.ts`: headless tests (vitest and
  `@smoove/core/testing`). `npm test` runs them all. When the brief carries
  numbers ("the title lands by 0.5 seconds"), assert them here.
- `smoove.config.ts`: the studio's name, logo, accent color, and whether it
  renders.
- `.smoove/`: the studio app smoove runs, and the bridge's files, snapshots
  and sheets. `build/`: the production studio. `out/`: videos from
  `npx smoove render`. All ignored by git.

The studio app itself ships inside `@smoove/studio`. Don't run
`npx smoove studio detach` unless the user asks for it: it copies the app
into the project for good.

Docs: https://smoove.dev
