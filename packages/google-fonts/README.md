# @smoove/google-fonts

Typed, tree-shakeable [Google Fonts](https://fonts.google.com) for
[smoove](https://github.com/…). Each family is its own module exporting a
`Font` subclass, loaded from the Google Fonts CDN — so a project only pulls the
families it imports.

## Usage

```ts
import { Composition, Sequence, Text } from "@smoove/core";
import NotoSans from "@smoove/google-fonts/noto-sans";

// Register a subset of faces…
const font = new NotoSans({ weights: ["400", "600"], styles: ["normal", "italic"] });
// …or omit weights/styles to register every face the family ships:
// const font = new NotoSans();

// Pick a character subset (default "latin"); typed to the family's subsets:
// const cyrillic = new NotoSans({ subset: "cyrillic" });

const seq = new Sequence({ from: 0, durationInFrames: 90 });
seq.add(font); // discovered + loaded + buffered before play (see @smoove/core)
seq.add(new Text({ font, text: "Hello" }));               // preferred face (400/normal)
seq.add(new Text({ font: font.face("600"), text: "Hi" })); // a specific face
```

`weights`, `styles`, and `subset` are typed **per family** — the editor only
offers the values that family actually provides. A bare `new NotoSans()`
registers all faces in the `latin` subset.

**Subsets.** Each face is loaded from a single character subset (default
`"latin"`). Exactly one subset is used so the browser and headless (skia)
rendering load the same file — pick the `subset` matching your text (e.g.
`"cyrillic"`, `"greek"`, `"latin-ext"`). An unknown subset warns and falls back
to `latin`.

It extends core's `Font`, so everything from there works: `.face(selector)`,
the composition buffer (nothing renders until the font loads), and headless
server rendering (the renderer downloads + disk-caches the CDN font files).

## How it works

- **No build.** The package is consumed as TypeScript source — `exports` point at
  `src/*.ts`, and your bundler (Vite, etc.) transpiles. There is no `dist`.
- **CDN delivery.** Each face's `src` is a `fonts.gstatic.com` woff2 URL. The
  browser fetches it; the server downloads + caches it.
- **No barrel.** There is no index that re-exports every family, so importing one
  font never includes the others.

## Regenerating the catalog

The per-font modules and `src/manifest.ts` are generated from the Google Webfonts
Developer API and committed. The key is a free Google Cloud API key with the
**Web Fonts Developer API** enabled — needed only to regenerate, never at runtime.

Put it in a `.env` file (git-ignored; `cp .env.example .env`):

```bash
# packages/google-fonts/.env
GOOGLE_FONTS_API_KEY=your-key
```

then:

```bash
pnpm --filter @smoove/google-fonts generate
```

The script auto-loads `packages/google-fonts/.env` (via Node's `--env-file`). You
can also pass the key inline instead: `GOOGLE_FONTS_API_KEY=<key> pnpm … generate`.

The metadata catalog (no font modules pulled) is importable for tooling:

```ts
import { fonts } from "@smoove/google-fonts/manifest";
```
