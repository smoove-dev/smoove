# Long footage: from a recording to a short

A user hands you a long recording, a lecture or a podcast or a stream, and
asks for a short: a TikTok, a highlight reel, the quiet parts gone. You can't
watch twenty minutes, so the `smoove agent` media tools map it for you, and
you edit from the map.

The one rule: never cut the footage. A recut composition plays ranges of the
original file, listed in its `cuts.json`. The whole recording and the whole
audio stay in the project, so when the user wants ten more seconds back, you
change a number. No media file is written except by `extract_audio`.

Every tool here is also an MCP tool with the same name. Results land in
`.smoove/media/` and the text answer stays short; read the files it names
when you need the detail. A long job can hand back a job id; read it with
`media_status`.

## 1. Bring it in

```sh
npx smoove agent footage_add ~/Downloads/lecture.mp4
```

It copies the whole file into `footage/`, which it adds to `.gitignore`, and
prints the path every other tool takes (`footage/lecture.mp4`). The original
is never moved or changed. A file already inside the project stays where it
is.

## 2. Map it before you edit

Run these in order. Each answers from a cache the second time.

```sh
npx smoove agent media_info footage/lecture.mp4    # length, size, frame rate, tracks
npx smoove agent media_audio footage/lecture.mp4   # quiet, speech, loudest moments
npx smoove agent media_sheet footage/lecture.mp4   # twelve tiles across the whole file
npx smoove agent transcribe footage/lecture.mp4    # every word with its time
```

`media_audio` lists the quiet stretches, the stretches of speech, and the
loudest moments (laughter, applause, a raised voice), each with its time. The
loud moments are candidates, not answers.

`media_sheet` is how you see the footage. One sheet across the whole file
first, then closer ones where the transcript or the audio map point:
`--from 180 --to 240` spaces tiles across a range, `--at 192.4,205,231` puts
them at exact times. Tiles land on the keyframe at or before each time,
which keeps sheets fast; `--exact` turns that off.

`media_video` scans the picture for solid black or white, a frozen picture
(a paused screen share), and the moments the shot cuts. It decodes every
frame of the range, so on long footage scan the stretches you care about
with `--from` and `--to`.

### The transcript

If your own tools can transcribe, use them, save the result as SRT, VTT or
JSON, and pass that file to `transcribe` to import it. Otherwise
`transcribe` runs locally with NVIDIA's Parakeet, which needs a one-time
install: about 670 MB for the model, plus the sherpa-onnx runtime from npm.
Ask the user before installing, tell them the size, then run
`npx smoove agent models install parakeet`. A long install hands back; run
`models` again to see how it's going. Parakeet covers English
and 24 more European languages. For any other language, use your own tools
or an API the user sets up with `SMOOVE_TRANSCRIBE_URL` and
`SMOOVE_TRANSCRIBE_KEY`. When nothing can run, `transcribe` says which of
these is missing.

It writes three files to `transcripts/`, named after the footage:

1. `lecture.txt`, one phrase per line with its time, like
   `[03:12.4] So the thing nobody tells you about compound interest`. Read
   this one.
2. `lecture.json`, every word with its start and end. Captions and
   `cut_plan` read it.
3. `lecture.srt`, subtitles for the user.

Read the text, then fix misheard words (names, technical terms, the product)
in the JSON, keeping each word's `start` and `end`. Run `transcribe` on
`transcripts/lecture.json` to rewrite the text and subtitles from your
corrections. Running `transcribe` on the footage again keeps the corrected
JSON unless you pass `--fresh`.

## 3. Pick the highlights with the user

Shortlist before building. For each candidate give its start and end, its
length, and one line on why it works: the line that hooks, the joke that
lands, the moment the room reacts. Put the evidence next to it, a transcript
line or a loud moment from the audio map. Then show the user the list and
wait for their pick.

For a short of about a minute, look for one idea that stands on its own: a
question and its answer, a claim and its proof. Open on the strongest line,
not on the speaker clearing their throat.

## 4. Build the cut

One composition per short. Three TikToks from one lecture are three
compositions reading the same footage and the same transcript.

```sh
npx smoove new --title "Lecture short" --template recut --source footage/lecture.mp4
npx smoove agent cut_plan --comp lecture-short --keep 192.4-211,264.2-290.6 --fillers um,uh --max-pause 0.6 --target 60
```

The recut template is portrait, 1080 by 1920, plays the whole file until you
write a plan, and captions from the transcript when one existed when it was
made (see [captions.md](captions.md)). `cut_plan` writes its `cuts.json`:

1. `--keep` or `--remove` take ranges in source seconds. Through MCP, `keep`
   takes objects with a `label` too.
2. `--fillers` drops those words, using the transcript.
3. `--max-pause` shortens every pause longer than that, using the audio map.
4. `--target` warns when the total misses that length.

Every cut snaps to the frame grid, and a cut that would split a word moves to
the word's edge, with a warning saying so. Keep a recut to 48 ranges or fewer:
past that the studio preview can run out of video decoders, and `cut_plan`
warns. Split a longer edit into more than one composition.

To adjust, run `cut_plan` again or edit `cuts.json`. Never re-encode the
footage. For the crop, change `FOCUS` in the composition, or follow the
speaker as in "Reframing 16:9 to 9:16" in [media.md](media.md).

## 5. Check it

```sh
npx smoove agent check --comp lecture-short
npx smoove agent sheet --comp lecture-short   # one tile per kept range
```

Render only when the user asks for the video.

## Without footage on hand

`footage/` is kept out of git, so a fresh clone of the project has none. The
recut's tests skip and name the missing file. Bring the footage back with
`footage_add` and its `cuts.json` plays again exactly as before.
