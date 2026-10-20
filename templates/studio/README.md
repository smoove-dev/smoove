# my smoove studio

A full [smoove](https://smoove.dev) studio: browse compositions, scrub the
timeline, tweak props, and render MP4s on the built-in server queue.

## Run it

    npm install
    npm run dev

Open the printed URL. Pick "Hello smoove" in the sidebar to see the stage,
timeline, and inspector.

## Add a composition

1. Create `src/compositions/<name>/composition.ts` (default-export a
   `Composition`).
2. Create `src/compositions/<name>/index.ts` (a `RegistryEntry` that lazy
   imports it).
3. List the entry in `src/registry.ts`.

## Test it

    npm test

A composition is a pure function of the frame, so tests drive it to a frame
and check what is on screen, headless in Node. Put a `composition.test.ts`
next to each composition; `hello-smoove` ships one to start from:

```ts
import { probe } from "@smoove/core/testing";

comp.setFrame(beats.slogan.end.resolve() - 1);
expect(probe(comp, ".wordmark")[0]?.visible).toBe(true);
```

Give the nodes you test a `name`. `src/test/setup.ts` loads the same Node
canvas and font loaders the render queue uses.

## Render to video

Open a composition, choose "Render…" from the menu, and watch it in the
Render Queue. Jobs run on the Node server through `@smoove/renderer`, so
what you preview is what you get.

## Make videos with your coding agent

`npm create smoove` installed the smoove-video skill, so Claude Code, Cursor,
Codex and friends know how to write smoove code. Ask your agent for a video.
It starts the studio itself and gives you the URL to watch:

    npx smoove start

While it works, it looks at frames and contact sheets instead of rendering:

    npx smoove sheet --comp hello-smoove
    npx smoove snap --comp hello-smoove --at lockup

It only renders a video when you ask for one. `AGENTS.md` has the rules it
follows. If the skill is missing, install it with:

    npx skills add smoove-dev/smoove -s smoove-video

Docs: https://smoove.dev
