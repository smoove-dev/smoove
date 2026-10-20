# @smoove/cli

The `smoove` command for [smoove](https://smoove.dev) projects. It lets a
coding agent see the studio from its shell, and gets back PNG files and plain
text: a frame, a contact sheet of every beat, the timeline in frames. The
images are drawn by a real browser with the real fonts, and looking never
changes what the user sees.

```sh
npm i -D @smoove/cli
```

`@smoove/vite` mounts the bridge (from `@smoove/agent`) on the studio's dev
server, and `@smoove/studio` connects each studio tab to it. There's nothing
to wire.

## The smoove command

Run it from inside the project, or any folder under it.

```sh
smoove start                         # run the studio (Ctrl+C stops it)
smoove start --prod                  # serve the studio smoove build made
smoove build                         # build the studio for production
smoove new                           # create a composition (asks for the rest)
smoove render --comp promo           # render a video through the studio's queue
smoove test                          # run the compositions' tests
smoove studio detach                 # copy the studio app into the project, for good
```

`smoove new` asks for a title, an id, a sidebar group, a description, a
format and a length, and writes `compositions/<id>/` with a title card to
start from. Pass the answers as `--title`, `--id`, `--group`,
`--description`, `--format` (landscape, portrait or square) and `--seconds`
to skip the questions; without a terminal, `--title` is required.

In a project whose studio ships inside `@smoove/studio`, `start`, `build`
and `test` run that studio. After `smoove studio detach` they run the
project's own `dev`, `build`, `start` and `test` scripts, so the commands
stay the same.

To host the studio on a server, run `smoove build`, then have your process
manager run `smoove start --prod` and restart it if it stops. With PM2, for
example: `pm2 start "smoove start --prod"`.

## For coding agents

The commands an agent uses live under `smoove agent`. Every one takes
`--json` for the raw answer, and exits with 1 when something went wrong.

```sh
smoove agent start                         # run the studio in the background, print the URL
smoove agent status                        # what the user's tab shows
smoove agent snap --comp promo --at hook   # one frame as a PNG
smoove agent sheet --comp promo            # one tile per beat, on one PNG
smoove agent timeline --comp promo         # beats and sequences, in frames
smoove agent context                       # what the user marked on the frame
smoove agent check --comp promo            # purity, layout, motion and style problems
smoove agent seek 90                       # move the user's playhead
smoove agent stop
```

`smoove agent start` runs the project's `dev` script in the background,
waits for the studio, and prints its URL. Give that URL to the user so they
can watch. Its output goes to `.smoove/dev.log`.

The user points by dragging a rectangle over the frame in the studio.
`smoove agent context` prints that mark: the frame and its beat, an image of the
frame with the rectangle drawn on it, and every node more than 60 percent
inside, smallest first, each with the file and line that created it. Reading
the mark clears it.

Images land under `.smoove/snaps/` and `.smoove/sheets/`, and the command
prints their paths. Snapshots are 640 pixels wide by default and sheet tiles
320, because every image an agent reads costs it context. `--width` changes
both.

### Checks

`smoove agent check` asks the questions an agent would otherwise answer by
watching. It scans the project's files for code that breaks scrubbing, like
`Math.random()` or the clock, then sweeps the composition in the headless
tab: it jumps to frames and compares them with playback, and looks for text
cut by an ellipsis, content off the canvas, low contrast, colors outside the
palette, stretches where nothing moves, and the intents in the
composition's checks file. Each finding names the node, the frames, the
beat, and the file and line.

Only four kinds of finding are errors, and they make the command exit with
1: a frame that changes when you jump to it, an updater moving a node its
Flex or Block positions, a failed intent, and text cut or overflowing
through a beat's settled stretch. Everything else is a warning. `--only
layout,style` runs some groups, `--all` checks every composition, and
`--images` writes an image of each error and held warning under
`.smoove/checks/`.

### As MCP tools

`smoove agent mcp` serves the same commands as MCP tools over standard input and
output, for agents that prefer tools over a shell. Register it in the
project's `.mcp.json`; the studio template already does:

```json
{
  "mcpServers": {
    "smoove": { "command": "npx", "args": ["smoove", "mcp"] }
  }
}
```

Each tool carries its command's name and takes its options by their full
names (`composition`, `frame`, `at` and so on). `snap` and `sheet` return the
image itself as well as its path. `context` attaches the marked frame only
with `image: true`, and `check` lists image paths without attaching them.
The text a tool returns is the command's output, word for word. Through
MCP, a render that runs past 50 seconds hands back its job id, since some
clients cut tool calls off after a minute; `render_status` follows it (also
`smoove agent render_status <job>` in the shell).

### Beats

A sheet shows one tile per beat, and `--at` names a point in a beat. Beats
come from the composition's plan, so register it:

```ts
const beats = plan({ hook: { durationInFrames: 75 }, land: { durationInFrames: 60 } });
const comp = new Composition({ id: "promo", fps, width, height, durationInFrames: beats.land.end, plan: beats });
```

A composition without a plan uses its top-level sequences instead. `--at
hook` is the frame the sheet shows for that beat: its last frame before the
next beat comes in. `hook.start`, `hook.settled`, `hook.last` and `hook.end`
name the other points.

### Which tab draws

A request about the composition the user has open is drawn by the user's
tab, which puts its playhead back afterwards. Anything else goes to a
headless Chrome the dev server starts on its own and keeps until it stops.
The command says which one drew each image. The headless browser is an
installed Chrome, Chromium or Edge; point `SMOOVE_BROWSER` at a binary to
pick one.

`smoove agent seek` is the one command that changes the user's view, and it only
ever talks to the user's tab.

## License

MIT
