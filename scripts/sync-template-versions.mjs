#!/usr/bin/env node
// Re-pin every templates/* package.json @smoove/* dep to the current
// release line (^<version of @smoove/core>).
//
// Templates aren't workspace packages — they pin literal ranges so a raw
// GitHub fetch installs from npm. `changeset version` doesn't know about
// them, so the root `release:version` script runs this right after it.
// (templates/shared is source material, not a template — no package.json.)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const version = JSON.parse(
  readFileSync(join(root, "packages", "core", "package.json"), "utf8"),
).version;

const templatesDir = join(root, "templates");
for (const dir of readdirSync(templatesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)) {
  const path = join(templatesDir, dir, "package.json");
  if (!existsSync(path)) continue;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  let touched = false;
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      if (name.startsWith("@smoove/")) {
        pkg[field][name] = `^${version}`;
        touched = true;
      }
    }
  }
  if (touched) {
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`templates/${dir}  @smoove/* -> ^${version}`);
  }
}
