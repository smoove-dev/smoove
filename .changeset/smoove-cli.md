---
"@smoove/cli": minor
"@smoove/agent": minor
---

The `smoove` command moves to its own package, `@smoove/cli`, and gets commands for people as well as agents: `smoove start` runs the studio (`--prod` serves the build), `smoove build` builds it, `smoove new` creates a composition folder with a title card (it asks for the title, id, group, description, format and length, or takes them as flags), `smoove test` runs the compositions' tests, and `smoove render` renders.

The agent commands move under `smoove agent`: `smoove agent start` (the background start), `stop`, `status`, `seek`, `snap`, `sheet`, `timeline`, `context`, `check`, `render_status` and `mcp`. The old spellings, like `smoove snap`, now point at the new ones. The MCP tool names don't change, and `new` joins them.

`@smoove/agent` keeps the bridge between the studio and the command, and no longer ships a `smoove` binary. Existing projects add `@smoove/cli` as a dev dependency and change `npx smoove snap` to `npx smoove agent snap`, and `.mcp.json` to `["smoove", "agent", "mcp"]`.
