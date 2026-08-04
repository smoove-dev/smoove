---
"@smoove/effects": patch
---

Add `chromaKey` to `@smoove/effects`: green-screen keying, so one colour becomes transparency and the scene behind the clip shows through. `clip.effects([chromaKey({ color: "#249530" })])`, sampling that hex off a frame of your own footage rather than guessing at `#00ff00`. What survives is despilled at unchanged brightness, and `choke` trims the half-green rim compression leaves around a subject.

The matte ignores brightness, so a shadow across the screen keys like the lit part of it, and its distance is measured against the key colour's own distance from grey, so a `similarity` that worked on a bright screen still works on a dull one and a white shirt in front of it survives either way. `strength` crossfades the whole key, so animating it from 0 dissolves the background away. The key reads pixels and no clock, so it scrubs and renders the same in the browser and on the server.
