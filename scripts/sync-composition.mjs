#!/usr/bin/env node
// The create-smoove sample composition is written ONCE, in templates/shared/,
// and copied verbatim into every template. The file deliberately contains no
// TypeScript-only syntax, so the same bytes are a valid .ts and .js module.
//
//   node scripts/sync-composition.mjs           copy source -> targets
//   node scripts/sync-composition.mjs --check   fail if any copy drifted
//
// Real copies (not symlinks) on purpose: create-smoove fetches each template
// directory raw from GitHub, so every template must be self-contained.
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(root, "templates/shared/composition.ts");
const TARGETS = [
  join(root, "templates/composition-ts/src/composition.ts"),
  join(root, "templates/composition-js/src/composition.js"),
  join(root, "templates/studio/src/compositions/hello-smoove/composition.ts"),
];

const check = process.argv.includes("--check");
const source = readFileSync(SOURCE);

let drifted = false;
for (const target of TARGETS) {
  const rel = relative(root, target);
  if (check) {
    if (!source.equals(readFileSync(target))) {
      console.error(`DRIFT: ${rel} differs from templates/shared/composition.ts`);
      drifted = true;
    }
  } else {
    copyFileSync(SOURCE, target);
    console.log(`synced ${rel}`);
  }
}

// The .js copy must parse as plain JavaScript — catches TS-only syntax
// (type annotations, `as const`, generics) sneaking into the source.
execFileSync(process.execPath, ["--check", TARGETS.find((t) => t.endsWith(".js"))]);

if (drifted) process.exit(1);
console.log(check ? "sync-composition: all copies in sync ✔" : "sync-composition: done ✔");
