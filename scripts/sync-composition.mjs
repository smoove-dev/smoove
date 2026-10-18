#!/usr/bin/env node
// The create-smoove sample composition and its test are written ONCE, in
// templates/shared/, and copied verbatim into every template. Both files
// deliberately contain no TypeScript-only syntax, so the same bytes are a
// valid .ts and .js module.
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
// Each template's directory for the sample, and the extension it ships as.
const DESTS = [
  ["templates/composition-ts/src", ".ts"],
  ["templates/composition-js/src", ".js"],
  ["templates/studio/src/compositions/hello-smoove", ".ts"],
];
const FILES = ["composition", "composition.test"];

const check = process.argv.includes("--check");

let drifted = false;
for (const file of FILES) {
  const sourceRel = `templates/shared/${file}.ts`;
  const source = readFileSync(join(root, sourceRel));
  for (const [dir, ext] of DESTS) {
    const target = join(root, dir, `${file}${ext}`);
    const rel = relative(root, target);
    if (check) {
      if (!source.equals(readFileSync(target))) {
        console.error(`DRIFT: ${rel} differs from ${sourceRel}`);
        drifted = true;
      }
    } else {
      copyFileSync(join(root, sourceRel), target);
      console.log(`synced ${rel}`);
    }
  }
  // The .js copy must parse as plain JavaScript — catches TS-only syntax
  // (type annotations, `as const`, generics) sneaking into the source.
  execFileSync(process.execPath, [
    "--check",
    join(root, "templates/composition-js/src", `${file}.js`),
  ]);
}

if (drifted) process.exit(1);
console.log(check ? "sync-composition: all copies in sync ✔" : "sync-composition: done ✔");
