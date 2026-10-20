# my smoove studio

A [smoove](https://smoove.dev) studio: browse compositions, scrub the
timeline, tweak props, and render MP4s on the built-in server queue.

## Run it

    npm install
    npm run dev

Open the printed URL. Pick "Hello smoove" in the sidebar to see the stage,
timeline, and inspector.

## Add a composition

    npx smoove new

It asks for a title, a format and a length, then writes a folder under
`compositions/` with a title card to start from. The studio shows it as soon
as the folder appears.

Every composition is a folder in `compositions/` with an `index.ts` that
default-exports its entry: the id, the title, the sidebar group, and a lazy
import of the composition. There's no registry to edit.

## Test it

    npm test

A composition is a pure function of the frame, so tests drive it to a frame
and check what is on screen, headless in Node. Each composition has a
`composition.test.ts` next to it; `hello-smoove` ships one to start from:

```ts
import { probe } from "@smoove/core/testing";

comp.setFrame(beats.slogan.end.resolve() - 1);
expect(probe(comp, ".wordmark")[0]?.visible).toBe(true);
```

Give the nodes you test a `name`.

## Make it yours

`smoove.config.ts` holds the studio's settings. It starts empty, and your
editor lists the options as you type:

```ts
import { defineConfig } from "@smoove/studio";

export default defineConfig({
  name: "Acme Videos",
  logo: "./logo.svg",
  primaryColor: "#15cda8",
  render: true,
});
```

`render: false` turns rendering off, render buttons and queue included.

The studio app itself ships inside `@smoove/studio`, so updating the package
updates the studio. To change the app (its pages, layout or routes), copy it
into the project:

    npx smoove studio detach

That's one-way: the project owns the app from then on, and `npm run dev`
keeps working.

## Render to video

Open a composition, choose "Render…" from the menu, and watch it in the
Render Queue. Jobs run on the Node server through `@smoove/renderer`, so
what you preview is what you get.

To host the studio on a server, build it, then have your process manager
run the start script (with PM2, for example):

    npm run build
    pm2 start "npm start"

## Make videos with your coding agent

`npm create smoove` installed the smoove-video skill, so Claude Code, Cursor,
Codex and friends know how to write smoove code. Ask your agent for a video.
It starts the studio itself and gives you the URL to watch:

    npx smoove agent start

While it works, it looks at frames and contact sheets instead of rendering:

    npx smoove agent sheet --comp hello-smoove
    npx smoove agent snap --comp hello-smoove --at lockup

It only renders a video when you ask for one. `AGENTS.md` has the rules it
follows. If the skill is missing, install it with:

    npx skills add smoove-dev/smoove -s smoove-video

Docs: https://smoove.dev
