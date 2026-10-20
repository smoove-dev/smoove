# Working in the studio

A studio project (made with `npm create smoove`, studio template) ships the
`smoove` command. It lets you look at your work without rendering: frames
and contact sheets come back as PNG files, drawn by a real browser with the
real fonts. The commands for you live under `npx smoove agent`; run them
from inside the project. Every one takes `--json` for the raw answer, and
exits with 1 when something went wrong. (`npx smoove start` runs the same
studio in the foreground, for a person at a terminal.)

## Add a composition

```sh
npx smoove new --title "Product launch" --format portrait --seconds 8
```

It writes `compositions/product-launch/`: an `index.ts` entry, the
composition (a title card to build from), its props schema, checks and
tests. `--id`, `--group` and `--description` are optional. Every
composition lives in its own folder under `compositions/`, and its
`index.ts` is required: the studio lists every folder that has one, with no
registry file to edit.

## Start and stop

```sh
npx smoove agent start   # runs the dev server in the background, prints the URL
npx smoove agent stop
```

Give the URL to the user so they can watch. `start` is safe to repeat: when
the studio is already running it prints the same URL. The server's output
goes to `.smoove/dev.log`, which is the first place to look when it won't
start.

## Look

```sh
npx smoove agent sheet --comp promo                # one tile per beat, on one PNG
npx smoove agent sheet --comp promo --frames 8     # eight evenly spaced frames instead
npx smoove agent snap --comp promo --at hook       # one frame, 640 pixels wide
npx smoove agent snap --comp promo --frame 120 --width 1080
npx smoove agent timeline --comp promo             # beats and sequences, in frames
npx smoove agent status                            # what the user's tab shows
```

Each image command prints the file's path (under `.smoove/snaps/` or
`.smoove/sheets/`). Read the image to see it. Keep images small: every image
you read costs context, so the defaults (640 pixels for a snap, 320 per
sheet tile) are usually right.

Without `--comp`, a command uses the composition the user has open.

## Points in time

`--at` names a point by beat: `hook` is the frame the contact sheet shows for
that beat, its last frame before the next beat comes in, so entrances have
finished and exits haven't started. `hook.start`, `hook.settled` (fully
revealed, after an incoming transition), `hook.last` and `hook.end` (the
first frame after it) name the others.

Beats come from the composition's plan (`new Composition({ plan: beats })`,
or `comp.setPlan(...)` for a `TransitionSeries`, see
[transitions.md](transitions.md)). Without a plan, the top-level sequences
are the beats, named by their `name`. `npx smoove agent timeline` lists them.

## Read a contact sheet

Each tile is labeled with its frame number and its beat. Check every tile
for text cut off or ellipsized, content outside the frame, overlapping
elements, and anything that should have arrived by then but hasn't. A sheet
shows settled moments, so check motion itself (an entrance's timing, a
transition) with `snap --at <beat>.start` and a few frames after it, or with
a test.

## Check before you look

`npx smoove agent check` asks the questions you would otherwise answer by
watching, and prints every finding with its node, frames, beat, and the file
and line that made the node:

```sh
npx smoove agent check --comp promo
npx smoove agent check --all                 # every composition
npx smoove agent check --only layout,style   # some of purity, layout, intent, motion, style
npx smoove agent check --images              # an image of each error and held warning
```

It reads the project's files for code that breaks scrubbing (`Math.random()`,
the clock, a `random(seed)` generator advanced inside an updater), then
sweeps the composition in the headless tab, never the user's.

Four kinds of finding are errors, and the command exits with 1 while any is
left:

- `purity/seek-mismatch`: a node comes out different when you jump to a
  frame than when you play up to it. Some value isn't a function of the
  frame.
- `purity/layout-child-position`: an updater sets x or y on a node a `Flex`
  or `Block` positions. Layout overwrites it; animate scale or opacity, or
  move the parent.
- `intent/...`: an intent in the checks file failed, or its selector
  matches nothing.
- `layout/text-ellipsis` and `layout/text-overflow`, when held: text cut or
  trimmed through a beat's settled stretch.

Everything else is a warning: text off the canvas (`layout/off-canvas`) or,
on a vertical canvas, outside the safe zone (`layout/safe-zone`), contrast
below the floor (`layout/contrast`, with a palette color that passes), a
stretch of more than two seconds where nothing moves (`motion/frozen`),
colors outside the palette (`style/color`), fonts that weren't declared
(`style/font`), and text drawn in a fallback face (`style/fallback-font`).

A finding is held when it's still there on a beat's settled stretch (from
the moment the beat is fully revealed to the frame the sheet shows), or
lasts half a second. Shorter ones, like a title sliding in from off the
canvas, say "passing" and come last. Fix every error. Fix each warning too,
or, when it's on purpose, add an allow entry with a reason to the checks
file ([testing.md](testing.md)). Decoration needs none: shapes and glows
may bleed off the edge, and text under 30 percent opacity skips contrast.

## Who draws the image

A request about the composition the user has open is drawn by the user's
tab, which puts its playhead back afterwards, so the user sees nothing move.
Anything else goes to a headless Chrome the dev server starts on its own.
The output says which one drew each image. A warning after the path is
worth reading: for example, a headless browser without H.264 support leaves
video areas empty, and says so.

## What the user marked

The user points by dragging a rectangle over the frame in the studio. Read
it with:

```sh
npx smoove agent context
```

It prints the composition, the frame and its beat, the path of an image of
that frame with the rectangle drawn on it, and the nodes the rectangle
covers. A node counts when more than 60 percent of its own box is inside;
for text, the box is where the words sit, not the text's full width. The
smallest come first, so the first one is usually what the user meant. When
nothing passes, it lists the three nodes the rectangle covers most and says
so: check those against the image.
Each node line gives its name (or "unnamed"), its type, its text for a Text,
how much of it is inside, and its box in composition pixels. Under it come
the file, line and column of the `new` that made it, and its named
ancestors, innermost first.

A location marked "(inherited)" belongs to the nearest ancestor that has
one: the node was built inside a package, such as the parts of a `Code`
node. Nodes made in a loop share a line; tell them apart by text, box or
order. A node made in a helper function points at the helper's `new`.

Reading the mark clears it, and the rectangle leaves the user's screen. The user can also clear it themselves, with the × on its corner, a click on the frame, or Escape. The
user writes what they want in their message to you, not in the studio.
Open the image only when the names and boxes aren't enough. With no mark,
the command says so; ask the user to drag a rectangle over the thing they
mean.

## As MCP tools

A studio project also registers these commands as MCP tools, in its
`.mcp.json`. When you have them (they show up as `mcp__smoove__snap` and so
on), use them instead of the shell: they're the same commands, with the same
results, and two of them save you a step. The tools carry the commands'
names, and their inputs are the options' full names, such as `composition`
for `--comp`.

- `snap` and `sheet` return the image itself, along with the path.
- `context` returns the node list and the image's path. Pass `image: true`
  to get the marked frame as well, when the names and boxes aren't enough.
- `check` returns the report as text. With `images`, it lists their paths
  and never attaches them.
- `seek` and `render` ask the user's permission each time, as the commands
  do. A tool call can't wait forever, so a render that runs past about 50
  seconds comes back with its job id instead of the file; follow it with
  `render_status`.

With no dev server running, the tools say to call the `start` tool. Give the
user the URL it returns.

## Move the user's view, and render

```sh
npx smoove agent seek 90 --comp promo   # moves the user's playhead
npx smoove render --comp promo          # writes out/promo.mp4 through the studio's queue
```

Both affect the user. Seek only when they ask to be shown something. Render
only when they ask for a video; never to check your own work.

## When something fails

- `no-server`: run `npx smoove agent start`.
- `composition-error`: the composition threw while building. The message
  has the error; fix the code.
- `unknown-beat`: the message lists the beat names that exist.
- `frame-out-of-range`: the message gives the valid range, counting from 0.
- `no-browser`: no headless browser could start. Ask the user to open the
  studio URL, and try again.
- `render-off`: the project's `smoove.config.ts` has `render: false`. Tell
  the user; don't change the setting yourself.
- `tab-timeout`: the tab took over 15 seconds, usually a composition still
  loading media. Try again.
