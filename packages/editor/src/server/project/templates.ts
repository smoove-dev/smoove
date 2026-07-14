import type { ScaffoldSpec } from "./types.js";

/**
 * The project's own tsconfig, written by `ProjectFs.init()`.
 *
 * `moduleResolution: "bundler"` matches how the compositions are actually
 * consumed (Vite). `types: []` keeps ambient @types/* out of the program — a
 * composition needs `@smoove/core` and nothing else. No `paths` mapping is
 * needed: node resolution walks up from `<root>/<id>/composition.ts` into the
 * host app's `node_modules`, where `@smoove/core` is symlinked.
 */
export const PROJECT_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["**/*.ts"]
}
`;

/**
 * A minimal-but-VALID composition: right dimensions, right clock, one empty
 * `main` sequence over a black background. It typechecks and renders on day
 * one — the agent then edits the animation into it.
 *
 * Scaffold is deterministic plumbing on purpose. The creative work is the
 * model's job, guided by the system prompt; a scaffold that guessed at content
 * would just be something the model has to undo.
 */
export function compositionStub(spec: ScaffoldSpec): string {
  return `import { Composition, Rect, Sequence } from "@smoove/core";

const width = ${spec.width};
const height = ${spec.height};
const fps = ${spec.fps};
const durationInFrames = ${spec.durationInFrames};

const comp = new Composition({
  id: ${JSON.stringify(spec.id)},
  fps,
  durationInFrames,
  width,
  height,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#000000" }));
comp.add(main);

export default comp;
`;
}
