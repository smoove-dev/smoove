# create-smoove

Scaffold a [smoove](https://smoove.dev) video project.

    npm create smoove
    # or
    pnpm create smoove studio my-studio
    npm create smoove composition my-comp -- --ts

Two templates:

- **studio** — the full studio: browse compositions, scrub the timeline,
  tweak props, render MP4s on a built-in server queue.
- **composition** — a minimal Vite app: one composition, `<smoove-player>`
  preview, autoreload. TypeScript or JavaScript.

Both come with the smoove-video agent skill one command away
(`npx skills add smoove-dev/smoove -s smoove-video`), so your coding agent knows how to
write smoove compositions.

Options: `--ts` / `--js`, `--no-install`, `--no-git`, `--no-skill`.

Templates live in [`templates/`](https://github.com/smoove-dev/smoove/tree/main/templates)
and are fetched from `main` at run time, so fixes land without a new CLI
release.
