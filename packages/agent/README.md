# @smoove/agent

Lets a coding agent see the [smoove](https://smoove.dev) studio. The agent
runs the `smoove` command from its shell, and gets back PNG files and plain
text: a frame, a contact sheet of every beat, the timeline in frames. The
images are drawn by a real browser with the real fonts, and looking never
changes what the user sees.

```sh
npm i -D @smoove/agent
```

`@smoove/vite` mounts the bridge on the studio's dev server, and
`@smoove/studio` connects each studio tab to it. There's nothing to wire.

## The smoove command

Run it from inside the project. Every command takes `--json` for the raw
answer, and exits with 1 when something went wrong.

```sh
smoove start                         # run the dev server, print the URL for the user
smoove status                        # what the user's tab shows
smoove snap --comp promo --at hook   # one frame as a PNG
smoove sheet --comp promo            # one tile per beat, on one PNG
smoove timeline --comp promo         # beats and sequences, in frames
smoove context                       # what the user marked on the frame
smoove check --comp promo            # purity, layout, motion and style problems
smoove seek 90                       # move the user's playhead
smoove render --comp promo           # render a video, only when the user asks
smoove stop
```

`smoove start` runs the project's `dev` script in the background, waits for
the studio, and prints its URL. Give that URL to the user so they can watch.
Its output goes to `.smoove/dev.log`.

The user points by dragging a rectangle over the frame in the studio.
`smoove context` prints that mark: the frame and its beat, an image of the
frame with the rectangle drawn on it, and every node more than 60 percent
inside, smallest first, each with the file and line that created it. Reading
the mark clears it.

Images land under `.smoove/snaps/` and `.smoove/sheets/`, and the command
prints their paths. Snapshots are 640 pixels wide by default and sheet tiles
320, because every image an agent reads costs it context. `--width` changes
both.

### Checks

`smoove check` asks the questions an agent would otherwise answer by
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

`smoove seek` is the one command that changes the user's view, and it only
ever talks to the user's tab.

## The endpoints underneath

The command wraps HTTP endpoints under `/__smoove/agent/` on the dev server.
When the server starts, the bridge writes `.smoove/agent.json` with its URL
and a token that changes on every start. Every request sends that token as a
bearer token.

```sh
curl -s -X POST http://localhost:5190/__smoove/agent/snapshot \
  -H "Authorization: Bearer $(jq -r .token .smoove/agent.json)" \
  -H "Content-Type: application/json" \
  -d '{"composition": "promo", "at": "hook"}'
```

The endpoints are `GET status`, and `POST seek`, `snapshot`, `sheet`,
`timeline`, `render` and `context`, plus `GET render/<job id>` to follow a
render.
Every answer has the same shape: `ok` set to true with a `data` object, or
`ok` set to false with an `error` that has a `code` and a `message`. Answers
a tab produced also say which tab drew them, in `drawnBy`, and may carry
`warnings`.

## Safety

The bridge only exists while the dev server runs, and only answers requests
from the same machine. Agent requests need the token. Requests from the
studio tab must come from the dev server's own origin, so another website
open in your browser can't drive the studio.

Add `.smoove/` to your `.gitignore`. To turn the bridge off, pass
`smoove({ agent: false })` to the Vite plugin.

## License

MIT
