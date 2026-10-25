# Planning a video

The cheapest place to fix a video is before it exists. Moving a beat in a
plan costs a sentence. Moving it after the scenes are built costs a rebuild,
and the user only notices the problem once they watch. So for new work, agree
on what the video is for, and how it moves through time, before writing any
composition code.

## When to plan

- A request a concept kit covers (a wedding invitation, a save the date):
  read the kit in [concepts.md](concepts.md) first. Its questions replace
  the ones in "The brief" below, and its scene list is the beat list. Still
  write the brief, and show the scenes with their lengths before building.
- A new video, or a new scene with more than one beat: plan first.
- An edit to an existing composition ("make the title bigger", "swap the
  second clip"): skip all of this and make the edit.
- A single-beat motion graphic (a logo sting, one stat): write the brief as a
  comment and go.

## The brief

Six lines, written before anything else:

1. Who watches it.
2. The takeaway: one sentence the viewer should leave believing.
3. Length.
4. Where it plays, which decides the aspect ratio. A vertical clip watched
   small in a feed needs bigger type than a landscape video watched full
   screen.
5. Must-haves: the logo, a line of copy, a clip, a color, anything fixed.
   For every photo or clip the user gives you, run `npx smoove agent
   media_info` and write its shape here ("couple.jpg, 3024 by 4032,
   portrait"), so the beats are designed around the real pictures.
6. The feel, in two or three words ("precise, quick", "warm, homemade").
   It picks the starting look in [looks.md](looks.md). If the user doesn't
   say, choose one that suits the subject and put it in the assumptions line.

Ask for whatever the request leaves open, all in one message. If the request
already covers everything, or the user said not to ask, write one line of
assumptions and carry on. Keep the brief at the top of `composition.ts` as a
comment, so later edits can check against it.

## Name the rhythm

Before listing beats, describe the shape of the whole piece in a few words:
"tease, reveal, prove, prove, land", or "quiet open, build, build, payoff,
rest". The shape comes from the subject and the brand, not from the running
time. Two 20-second spots, one for a law firm and one for a skate shop,
share a length and almost nothing else.

## The beat list

Show the user the plan in chat as a numbered list. Start with a pitch line in
this form:

> For indie devs who only test in CI: your test suite can run in the browser.

Then one item per beat, each with:

- a short name (it becomes a marker key later),
- what kind of beat it is and how many seconds it gets,
- what is on screen,
- what it does for the takeaway.

That last part is the filter. A beat that can't say what it does for the
takeaway comes out of the plan. Wait for the user to approve the list,
unless they asked you to work without check-ins.

## Lead with the payoff

For videos that explain or persuade (a product spot, an explainer, a feature
announcement), order matters more than polish:

- The opening beat is about the viewer's world: the problem they have, or the
  thing they'll get. Not your internals. No function names, no feature
  checklist, no table of contents.
- The takeaway is on screen by the second beat. Everything after it is
  support: the demo, the numbers, the how.
- Run the cover-up check on the finished list. Hide the support beats: the
  takeaway should still come through. Hide the takeaway beats: the video
  should feel pointless. If it still works, it was a tour, not a story.

Skip this section for music-led pieces, a single-beat graphic, or an edit of
footage whose story is already set.

## Props from the subject

When the video is about something specific (a product, a library, an
article), take the visuals from it before inventing any: its real screens,
its real numbers, its own words, the names it uses. Test each prop by
imagining it in a rival's video. If it would fit there unchanged, it's
filler; find something only this subject has.

## From beat list to plan()

The approved list maps straight onto `plan()`: each beat name is a marker
key, and each length in seconds becomes frames. Keep the brief and the rhythm
as comments right above the call, so the plan the user approved is the
timeline that plays.

```ts
import { Composition, Sequence, plan } from "@smoove/core";

const width = 1080;
const height = 1920;
const fps = 30;
const secs = (s: number) => Math.round(s * fps); // plan steps need whole frames

// For: indie devs who only test in CI.
// Takeaway: your test suite can run in the browser.
// Rhythm: tease, reveal, prove, prove, land.
const beats = plan({
  tease: { durationInFrames: secs(2.5) }, // the pain, in their words
  reveal: { durationInFrames: secs(3) }, // the takeaway, said plainly
  proofA: { durationInFrames: secs(4) },
  proofB: { durationInFrames: secs(4) },
  land: { durationInFrames: secs(2.5) }, // what to do next
});
const { tease, reveal, proofA, proofB, land } = beats;

const comp = new Composition({
  id: "browser-tests",
  fps,
  width,
  height,
  durationInFrames: land.end,
  plan: beats, // names the beats for the studio and the smoove command
});
comp.add(new Sequence({ span: tease }).add(teaseScene));
```

Retiming a beat now means changing one number in the plan, and every marker
after it moves. Passing `plan: beats` to the composition gives the beats
their names outside the code: the studio's timeline labels its tracks with
them, `npx smoove agent sheet` shows one tile per beat, and `--at reveal` jumps to
one (see [studio.md](studio.md)). Overlaps, gaps and `span` are covered in
[sequencing.md](sequencing.md).

## When there is a voiceover

The voice sets the length, not the other way round. Size each beat from the
real recording (see "Know a clip's length up front" in [media.md](media.md))
or from its word timings (see "Cues from data" in
[sequencing.md](sequencing.md)). Never squeeze a line to fit a slot you
already picked. If the voiceover is recorded again, treat it as a retime of
every beat that follows.
