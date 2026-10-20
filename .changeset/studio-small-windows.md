---
"@smoove/studio": patch
"@smoove/agent": patch
"create-smoove": patch
---

The studio fits a narrow window, such as a third of a laptop screen beside a coding agent's terminal. It picks a layout from its own width: below 640 pixels the library and the inspector open as drawers over the stage from header buttons, and from 640 to 1099 pixels the library can be collapsed and the inspector is a drawer. The timeline header wraps instead of spilling, the ruler spaces its labels to fit, the layered timeline takes a share of the height you can drag, and its tracks take their names from the composition's plan. Wide screens look as before.

The agent bridge resends a request when the studio tab reloads while answering it (Vite reloads the page as it optimizes dependencies on a project's first run), instead of failing.

`npm create smoove` installs the smoove-video skill for the studio template without asking, and works without a terminal. The studio template ships the `smoove` command, an AGENTS.md built around it, a CLAUDE.md pointer, pre-approved read-only `smoove` commands for Claude Code, and a sample composition that registers its plan.
