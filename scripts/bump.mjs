#!/usr/bin/env node
// Bump every packages/* package.json to the same version, in lockstep.
//
//   pnpm bump 0.2.0      set an explicit version
//   pnpm bump patch      0.1.0 -> 0.1.1
//   pnpm bump minor      0.1.0 -> 0.2.0
//   pnpm bump major      0.1.0 -> 1.0.0
//
// Cross-package deps stay `workspace:^`/`workspace:*`, so only the
// `version` field changes; pnpm rewrites the ranges at publish time.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkgsDir = join(root, "packages");

const arg = process.argv[2];
if (!arg) {
  console.error("usage: pnpm bump <version|patch|minor|major>");
  process.exit(1);
}

const current = JSON.parse(readFileSync(join(pkgsDir, "core", "package.json"), "utf8")).version;

let next;
if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(arg)) {
  next = arg;
} else if (["patch", "minor", "major"].includes(arg)) {
  const [major, minor, patch] = current.split(".").map((n) => Number.parseInt(n, 10));
  next =
    arg === "major"
      ? `${major + 1}.0.0`
      : arg === "minor"
        ? `${major}.${minor + 1}.0`
        : `${major}.${minor}.${patch + 1}`;
} else {
  console.error(`invalid version or increment: ${arg}`);
  process.exit(1);
}

const dirs = readdirSync(pkgsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const dir of dirs) {
  const path = join(pkgsDir, dir, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const was = pkg.version;
  pkg.version = next;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`${pkg.name}  ${was} -> ${next}`);
}

// Templates aren't workspace packages — they pin literal @smoove/* ranges so a
// raw GitHub fetch installs from npm. Keep those ranges on the released line.
const templatesDir = join(root, "templates");
for (const dir of readdirSync(templatesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)) {
  const path = join(templatesDir, dir, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  let touched = false;
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      if (name.startsWith("@smoove/")) {
        pkg[field][name] = `^${next}`;
        touched = true;
      }
    }
  }
  if (touched) {
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`templates/${dir}  @smoove/* -> ^${next}`);
  }
}

console.log(`\nall packages at ${next}`);
