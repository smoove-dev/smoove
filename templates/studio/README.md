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

## Render to video

Open a composition, choose "Render…" from the menu, and watch it in the
Render Queue. Jobs run on the Node server through `@smoove/renderer`, so
what you preview is what you get.

## Let your coding agent write compositions

Install the smoove-video skill so Claude Code, Cursor, Codex, and friends
know how to author smoove code:

    npx skills add smoove-dev/smoove

Docs: https://smoove.dev
