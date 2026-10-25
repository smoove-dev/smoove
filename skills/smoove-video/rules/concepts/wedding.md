# Wedding invitations and save the dates

Use this kit for a save the date, a wedding invitation, or anything close:
an engagement announcement, a reply reminder, a change of date. The
reference composition is
[assets/wedding-invite.composition.ts](../assets/wedding-invite.composition.ts),
with its checks in
[assets/wedding-invite.check.ts](../assets/wedding-invite.check.ts).

A guest watches this once, on a phone, often in a chat, and wants three
things from it: who, when and where. It has to feel like the couple's
printed invitation came to life, not like a slide deck. Every rule below
serves one of those two.

## Ask first, in one message

Ask everything below together, the moment the request arrives, and say
which answers you can't start without. Those are three: the couple's names,
the date, and which kind of video it is. Everything else has a default or
can be left out.

1. Which kind: a save the date (about 30 seconds: names, date, city, a
   photo), or the full invitation (40 to 50 seconds: adds the schedule, the
   venues, how to reply, the dress code).
2. The names, spelled and ordered exactly as they should appear, and the
   initials for a monogram.
3. The date. For the invitation, the time as well. Work out the weekday
   yourself, and ask if it doesn't match one they wrote.
4. Where. For a save the date, the city. For the invitation, every event:
   its time, what it is (ceremony, dinner, party), the venue's name and its
   address.
5. How to reply: by when, and how (a phone number, an email, a link).
6. Any extras: a hosts line ("Together with their families"), a dress code,
   a line of their own, a website, a hashtag.
7. Photos: one to three, and which one they love most. That one gets the
   big moment.
8. The language of the text. For a right-to-left language such as Hebrew
   or Arabic, build one line first and look at it in the studio before
   building the rest.
9. The style: one of the themes below, their wedding colors, or a few words
   ("rustic", "beach", "black tie").
10. Where they'll send it: WhatsApp or Instagram Stories (vertical, 1080 by
    1920, the default), or email and YouTube (landscape, 1920 by 1080).
11. Music: smoove plays a track they give you. It doesn't supply one.

A short version of the message reads well:

> Lovely, congratulations! To make it, I need your names as they should
> appear, the date, and whether it's a save the date or the full invitation.
> If you have them, also send: the time and venues with addresses, how
> guests should reply and by when, a dress code, one to three photos (and
> your favorite), the language, and a style or your wedding colors. I'll
> make it vertical for WhatsApp unless you'd like it for email.

## Never invent

Leave a line out rather than make it up. An invitation with a made-up
address, time or phone number is worse than one without. Never let the
reference's sample couple, Ana and Leo, or their Lisbon venues reach a real
video. Copy names exactly as given, accents included, and read the date
back in words in the brief ("Saturday, 12 September 2026") so a wrong
number shows.

## Photos

Run `npx smoove agent media_info` on every photo before planning, and
write each one's size and shape into the brief (see "Keep a photo's shape"
in [media.md](../media.md)). Put the favorite's real width and height into
`invite.photo`; the reference lays the hero out from them:

- A portrait or square photo fills the top of the frame at full width, and
  only a very tall one is cropped, from the bottom, so faces stay in.
- A clearly landscape photo becomes a band across the upper part of the frame,
  whole, with curved top and bottom edges.
- The closing scene sets the photo into an arch with `objectFit: "cover"`,
  which keeps its shape inside any frame.

Never put a photo in a small framed rectangle, and never stretch one to
fill a box. Both read as homemade at once.

## The shape of the video

A save the date has five scenes:

1. `open`: a gold monogram ring draws itself, the initials write themselves
   inside, the date underneath. 3.5 seconds.
2. `names`: the hosts line, then each name written on in script, an
   ornament, then the invitation line.
3. `photo`: the hero photo with "Save the date" and the date below it.
4. `date`: the month, the day in large numerals between the weekday and the
   time, the year, the city in script.
5. `close`: the photo in an arch, their closing line, the names, and
   "Invitation to follow".

The invitation adds two scenes before the close: `day` (every event with
its time, place and address) and `reply` (reply by when and how, and the
dress code).

## Time to read

Each scene holds long enough to read every word on it calmly. The reference
computes it with `sceneFrames()`: 1.6 seconds of reveal, then 2 seconds to
find the text, plus 1 second for every 4 words, plus the transition. A
scene of 10 words lasts about 6.5 seconds; one of 30 words about 11.5. Keep
that function. To fit more, split a scene (one event per scene) instead of
shortening the hold.

That puts a save the date at about 30 seconds and an invitation at 40 to
50. If the user asked for a length the words can't be read in, say so
and give the length they need. Don't squeeze the holds to hit the number.

## The look

These come from professional invitation videos. Each one is something a
slide deck doesn't do.

- Never a flat background. The backdrop is paper with large, soft washes of
  color drifting slowly across it, and a gentle vignette.
- Something always drifts in front, slowly: petals in daylight themes,
  warm bokeh at night. Nothing on screen is ever fully still.
- Two faces. A script for the names and short headings only, four words at
  most per line, because script is slow to read. A serif for everything
  else, with labels in small capitals spaced well apart. The size contrast
  is large: names around 230 times `u`, labels around 30.
- Thin gold lines that draw themselves: the monogram ring, the rules beside
  an ornament, the line along the photo's edge, the arch outline.
- Script writes itself on from left to right like a pen (`writeOn`);
  everything else rises in gently (`rise`), in reading order.
- Scenes change behind a warm bloom of light, never a hard cut.
- Centered and symmetric, like a printed card. For WhatsApp and Stories the
  checks file allows `layout/safe-zone`, with that reason. For Reels or
  TikTok, remove the allow entry and keep text out of the right and bottom
  edges, where their buttons sit.

## Themes

The reference has five. To switch, change the line that starts
`const theme = themes.garden`.

- `garden`: ivory paper, sage and blush washes, falling petals, Pinyon
  Script. Outdoors, spring and summer.
- `evening`: deep green, an amber glow, gold, warm bokeh, Great Vibes.
  Black tie, winter, night.
- `coastal`: sand-colored paper, sea teal washes, navy ink, Great Vibes.
  Beach and seaside.
- `blush`: rose paper, a rose-brown accent, Parisienne. Romantic and soft.
- `paper`: ink on paper with no color of its own, nothing drifting, Allura.
  The photo brings all the color. Minimal and modern.

All five use Cormorant Garamond for reading, and every palette passes the
contrast check with the washes behind it.

When the couple has wedding colors, keep a theme's structure and put their
colors into `washA`, `washB` and, if it's dark enough, `accent`. Keep `ink`
and `muted` dark on light paper (or light on a dark theme). When they give no
colors, look at the hero photo and take the washes from its softest tones,
so the paper and the photo belong together. After any color change, run
`npx smoove agent check`: it names a palette color that passes when one
doesn't.

## Building it

1. `npx smoove new --title "<names> wedding" --format portrait` (or
   `landscape`).
2. Copy the reference over its `composition.ts`, and its checks file over
   `composition.check.ts`. Keep the composition `id` that `smoove new`
   wrote, so the studio's entry still finds it. Put the photos in a
   `photos/` folder beside them and point the photo import at the favorite.
3. Fill `invite` from the answers (its `kind` included), set `invite.photo`
   from `media_info`, pick the theme, and update the brief comment at the
   top.
4. Run `npx smoove agent check --comp <id>` until it's clean, then one
   `npx smoove agent sheet --comp <id>`. Look at every tile: are the faces
   the right shape, is every word on screen, is nothing cut?
5. Give the user the studio's address so they can watch it at full speed.
   If a scene ends before they finish reading, split it or cut words; don't
   speed it up.

A landscape version needs its own layout pass: the reference positions are
tuned for 1080 by 1920.
