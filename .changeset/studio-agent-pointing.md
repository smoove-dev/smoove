---
"@smoove/agent": patch
"@smoove/studio": patch
"@smoove/vite": patch
---

Point at things in the studio. Drag a rectangle over the frame, and `smoove context` tells the agent what you marked: the frame and its beat, an image of the frame with your rectangle on it, and every node more than 60 percent inside, smallest first, with its name, type, text, box and the file and line that created it. Reading the mark clears it from the stage.

In development, the Vite plugin tags each node created in a project file with where it was created, so even an unnamed node leads straight to its line. Production builds are untouched.
