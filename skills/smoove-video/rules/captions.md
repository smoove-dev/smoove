# Captions from a transcript

Short-form video plays muted more often than not, so captions carry the
words. They come from a transcript with a time on every word (see
"The transcript" in [footage.md](footage.md)), and every caption on screen is
a function of the frame, like everything else.

## In a recut

The recut template captions on its own when `transcripts/<name>.json` existed
when you made it: the captions code is already in its `composition.ts`. When
the transcript came later, follow "Recipe: word-by-word captions" in
[text.md](text.md), and time the words to the cut the way the template does:
a word whose source frame `at` falls in a kept range starting at source frame
`a` and output frame `from` shows at output frame `from + at - a`. Words in
dropped ranges never show. The template's `sourceTimeAt(frame)` goes the
other way, from an output frame to the source second it plays.

The template's `captions` prop turns them off in the studio's props panel.

## How they look

1. Two to five words at a time, breaking at punctuation and before a line
   gets too long to read in one glance. Hold a line until the next starts
   when the gap is under half a second, or they flicker.
2. Box the spoken word, and sweep the box on over two frames.
3. Outline the line with eight dark offset copies behind it. Never
   `shadowBlur` (see [performance.md](performance.md)).
4. A heavy face in capitals, at 64 times `u` or more, where `u` is the
   canvas's short side over 1080.

## Where they sit

On a 9:16 canvas the feed draws its own buttons along the right edge and its
own text along the bottom. Keep the caption's bottom edge above three
quarters of the height, and leave about a twentieth of the width clear on
each side. The template centres the line at seven tenths of the height.

## Check them

The template's checks file holds both:

```ts
staysInFrame(".caption"),
appearsBy(".caption", firstCaption + 1), // the first line is up once its word is spoken
```

Then look at one contact sheet: every tile should show a line that reads
over the footage behind it.
