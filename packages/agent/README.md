# @smoove/agent

Lets a coding agent see the [smoove](https://smoove.dev) studio. While the
studio dev server runs, an agent can ask the open studio tab what it shows,
move it to a frame, and get a frame back as a PNG file, drawn by the real tab
with the real fonts.

You don't install or call this package yourself yet. `@smoove/vite` mounts
the bridge on the dev server, and `@smoove/studio` connects each studio tab
to it. A `smoove` command line tool that wraps the endpoints is coming.

## How an agent talks to it

When the dev server starts, the bridge writes `.smoove/agent.json` in the
project. It holds the server's URL and a token that changes on every start.
Every request sends that token as a bearer token.

```sh
TOKEN=$(jq -r .token .smoove/agent.json)

# What's open, and which frame it's on
curl -s http://localhost:5190/__smoove/agent/status \
  -H "Authorization: Bearer $TOKEN"

# Open a composition and move the playhead
curl -s -X POST http://localhost:5190/__smoove/agent/seek \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"composition": "hello-smoove", "frame": 90}'

# Draw frame 120 to a PNG (640 pixels wide by default)
curl -s -X POST http://localhost:5190/__smoove/agent/snapshot \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"frame": 120}'
```

A snapshot never moves what the user sees. The tab draws the frame, captures
it, and puts the playhead back. The answer carries the absolute path of the
file under `.smoove/snaps/`, never the image itself.

Every answer has the same shape: `ok` set to true with a `data` object, or
`ok` set to false with an `error` that has a `code` and a `message`. Answers
a tab produced also say which tab drew them, in `drawnBy`.

## Safety

The bridge only exists while the dev server runs, and only answers requests
from the same machine. Agent requests need the token. Requests from the
studio tab must come from the dev server's own origin, so another website
open in your browser can't drive the studio.

Add `.smoove/` to your `.gitignore`. To turn the bridge off, pass
`smoove({ agent: false })` to the Vite plugin.

## License

MIT
