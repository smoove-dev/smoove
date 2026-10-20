# Working in the studio

A studio project (made with `npm create smoove`, studio template) ships the
`smoove` command. It lets you look at your work without rendering: frames
and contact sheets come back as PNG files, drawn by a real browser with the
real fonts. Run it from inside the project as `npx smoove`. Every command
takes `--json` for the raw answer, and exits with 1 when something went wrong.

## Start and stop

```sh
npx smoove start   # runs the dev server in the background, prints the URL
npx smoove stop
```

Give the URL to the user so they can watch. `start` is safe to repeat: when
the studio is already running it prints the same URL. The server's output
goes to `.smoove/dev.log`, which is the first place to look when it won't
start.

## Look

```sh
npx smoove sheet --comp promo                # one tile per beat, on one PNG
npx smoove sheet --comp promo --frames 8     # eight evenly spaced frames instead
npx smoove snap --comp promo --at hook       # one frame, 640 pixels wide
npx smoove snap --comp promo --frame 120 --width 1080
npx smoove timeline --comp promo             # beats and sequences, in frames
npx smoove status                            # what the user's tab shows
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
are the beats, named by their `name`. `npx smoove timeline` lists them.

## Read a contact sheet

Each tile is labeled with its frame number and its beat. Check every tile
for text cut off or ellipsized, content outside the frame, overlapping
elements, and anything that should have arrived by then but hasn't. A sheet
shows settled moments, so check motion itself (an entrance's timing, a
transition) with `snap --at <beat>.start` and a few frames after it, or with
a test.

## Who draws the image

A request about the composition the user has open is drawn by the user's
tab, which puts its playhead back afterwards, so the user sees nothing move.
Anything else goes to a headless Chrome the dev server starts on its own.
The output says which one drew each image. A warning after the path is
worth reading: for example, a headless browser without H.264 support leaves
video areas empty, and says so.

## Move the user's view, and render

```sh
npx smoove seek 90 --comp promo   # moves the user's playhead
npx smoove render --comp promo    # writes out/promo.mp4 through the studio's queue
```

Both affect the user. Seek only when they ask to be shown something. Render
only when they ask for a video; never to check your own work.

## When something fails

- `no-server`: run `npx smoove start`.
- `composition-error`: the composition threw while building. The message
  has the error; fix the code.
- `unknown-beat`: the message lists the beat names that exist.
- `frame-out-of-range`: the message gives the valid range, counting from 0.
- `no-browser`: no headless browser could start. Ask the user to open the
  studio URL, and try again.
- `tab-timeout`: the tab took over 15 seconds, usually a composition still
  loading media. Try again.
