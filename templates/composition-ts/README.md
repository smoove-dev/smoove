# my smoove composition

A [smoove](https://smoove.dev) composition with live preview. Vite serves it
and reloads on every save.

## Run it

    npm install
    npm run dev

Open the printed URL. The player previews `src/composition.ts`; edit it and
the preview reloads.

## Test it

    npm test

A composition is a pure function of the frame, so tests drive it to a frame
and check what is on screen, headless in Node. `src/composition.test.ts`
is a starting point:

```ts
import { probe } from "@smoove/core/testing";

comp.setFrame(3.5 * comp.fps);
expect(probe(comp, ".wordmark")[0]?.visible).toBe(true);
```

Give the nodes you test a `name`. `src/test/setup.ts` loads the same Node
canvas and font loaders a server render uses.

## Where things live

- `src/composition.ts` is the composition: a `Composition` owns the frame
  clock, `Sequence`s are range-gated layers, and animation happens by
  mutating nodes inside `sequence.register((frame) => ...)`.
- `src/composition.test.ts` tests it headless (`npm test`).
- `src/main.ts` mounts the `<smoove-player>` element and hands it the
  composition.

## Let your coding agent write compositions

Install the smoove-video skill so Claude Code, Cursor, Codex, and friends
know how to author smoove code:

    npx skills add smoove-dev/smoove -s smoove-video

## Next steps

- Docs: https://smoove.dev
- Want the full studio (timeline UI, props panel, server rendering)? Run
  `npm create smoove studio`.
