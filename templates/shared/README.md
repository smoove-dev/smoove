# templates/shared

Source material copied into the templates — not a template itself, and never
fetched by create-smoove.

`composition.ts` is the canonical sample composition. Edit it here (keep it
free of TypeScript-only syntax; the same bytes ship as `.ts` and `.js`), then
run `pnpm sync:templates` to copy it into all three templates.
`scripts/smoke-create.sh` fails if a copy drifts.
