// Maps a `:::demo <id> | …` slot id to the URL of its composition module.
//
// `?url` hands us the *served URL* of the module instead of bundling its code
// here, so `<km-player src=…>` can dynamically `import()` it at runtime — the
// same path a genuinely remote composition would take. Each entry is therefore
// emitted as a standalone ESM chunk, not inlined into the docs bundle.
import orbitUrl from "./orbit.ts?url";

export const DEMO_URLS: Record<string, string> = {
  orbit: orbitUrl,
};
