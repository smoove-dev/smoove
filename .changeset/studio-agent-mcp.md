---
"@smoove/agent": patch
---

`smoove mcp`: the `smoove` commands as MCP tools, over standard input and output, for agents that prefer tools over a shell. Each tool carries its command's name and options and returns the command's own output; `snap` and `sheet` hand back the image itself. The command line and the server now run every command from one shared definition, so they can't drift apart. The studio template registers the server in `.mcp.json` and pre-approves the read-only tools; `seek` and `render` still ask.
