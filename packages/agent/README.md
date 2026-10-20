# @smoove/agent

The bridge between a coding agent and the [smoove](https://smoove.dev)
studio. `@smoove/vite` mounts its server half on the studio's dev server,
and `@smoove/studio` connects each studio tab with its client half. The
`smoove` command in [`@smoove/cli`](https://github.com/smoove-dev/smoove/tree/main/packages/cli)
talks to it; most projects never import this package themselves.

## The endpoints underneath

The command wraps HTTP endpoints under `/__smoove/agent/` on the dev server.
When the server starts, the bridge writes `.smoove/agent.json` with its URL
and a token that changes on every start. Every request sends that token as a
bearer token.

```sh
curl -s -X POST http://localhost:5190/__smoove/agent/snapshot \
  -H "Authorization: Bearer $(jq -r .token .smoove/agent.json)" \
  -H "Content-Type: application/json" \
  -d '{"composition": "promo", "at": "hook"}'
```

The endpoints are `GET status`, and `POST seek`, `snapshot`, `sheet`,
`timeline`, `render` and `context`, plus `GET render/<job id>` to follow a
render.
Every answer has the same shape: `ok` set to true with a `data` object, or
`ok` set to false with an `error` that has a `code` and a `message`. Answers
a tab produced also say which tab drew them, in `drawnBy`, and may carry
`warnings`.

## Safety

The bridge only exists while the dev server runs, and only answers requests
from the same machine. Agent requests need the token. Requests from the
studio tab must come from the dev server's own origin, so another website
open in your browser can't drive the studio.

Add `.smoove/` to your `.gitignore`. To turn the bridge off, pass
`smoove({ agent: false })` to the Vite plugin.

## License

MIT
