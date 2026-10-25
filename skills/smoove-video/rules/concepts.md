# Concept videos

Some videos come up again and again with the same parts: a wedding
invitation always has names, a date, a place and a way to reply. For those,
a concept kit replaces guessing with what works. It holds:

- the questions to ask before building, all in one message,
- the shape of the video, scene by scene, with how long each scene holds,
- the look, taken from professional videos of that kind,
- a reference composition that already passes `npx smoove agent check`,
  to copy and adapt instead of starting from an empty file.

When a request matches a kit, read the kit before anything else. Its
questions replace the generic brief in [planning.md](planning.md), and its
reference replaces the empty template from `smoove new`. Everything else in
this skill still applies.

## Kits

- Weddings: save the dates and invitations, vertical for WhatsApp and
  Stories, or landscape for email. [concepts/wedding.md](concepts/wedding.md)

## Adding a kit

A new kit is a file in `concepts/` and a reference composition in
`assets/`, built the same way as the wedding one:

1. Watch several professional videos of the kind, and write down what they
   share: length, how long text holds, the backdrop, how photos are
   treated, the type, the transitions.
2. List what every video of the kind needs from the user. That list is the
   kit's questions.
3. Build the reference so its timing comes from its words (see "Time to
   read" in [text.md](text.md)), its photos are laid out at their measured
   shape, and its content and look sit in two objects at the top of the
   file.
4. Run `npx smoove agent check` and a contact sheet on it, with every theme
   and with portrait, square and landscape photos, until each one is clean.
