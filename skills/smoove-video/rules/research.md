# Research for explainers

"Make a short video explaining how a heat pump works" starts with research,
not with code. Get the facts and the pictures first, plan the beats from what
you found (see [planning.md](planning.md)), and keep a record of where every
picture came from.

## Your own tools come first

If you can search the web and fetch pages, use that for the research. For
pictures, your own image search or generation comes first too. Whatever you
bring in, add it with `asset_add` so it's credited. Use the smoove tools when
you have nothing better:

```sh
npx smoove agent asset_search "heat pump diagram"          # Creative Commons images, on Openverse
npx smoove agent asset_search "rain on a window" --type audio
npx smoove agent asset_add --openverse image:<id>          # credit filled in from the result
npx smoove agent asset_add https://example.org/diagram.png --license "CC BY 4.0" --author "Dana" --page https://example.org/post
npx smoove agent page_shot https://example.org/docs        # a screenshot of a page, 1280 by 800
npx smoove agent assets                                    # what's in assets/, with credits
```

`asset_search` lists only licences that allow commercial use unless you pass
`--any-license`. `asset_add` copies the file into `assets/`, checks that it
opens, and records its source, page, licence and author in
`assets/credits.json`. It prints the import line for a composition. Never
point a composition at a picture's web address: a page can change or vanish,
and a render may not reach it.

## Plan from the sources

1. Collect the facts you'll show, each with the page it came from.
2. Write the beat list from them. Every beat says what it explains.
3. Then pick or make the pictures each beat needs, and add them.

When a beat makes a claim a viewer might doubt (a number, a date, a quote),
show its source on screen while it's up: a short line in a corner, small
but readable.

## Licences

Prefer CC0 and CC BY. CC BY needs the author and the licence in the credits.
BY-SA asks that a remix carry the same licence; tell the user. NC means no
commercial use, so leave it out of anything promotional. When a licence is
unknown, ask the user before using the picture.

## End on the credits

Build a credits card from `assets` (or from `assets/credits.json` in the
composition): one line per picture with its title, author and licence. A
screenshot's line names the page it shows.
