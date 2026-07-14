import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { ProjectFs } from "../src/server/project/project-fs.js";

/**
 * Temp projects live INSIDE this package, NOT in the OS tmpdir.
 *
 * `typecheck` runs a real `tsc`, and tsc resolves `@smoove/core` by walking up
 * from the composition file into `node_modules`. An OS tmpdir (`/var/folders/…`)
 * is outside the workspace, so every composition there fails with TS2307
 * "Cannot find module '@smoove/core'" — which does not just break the
 * clean-typecheck test, it silently MASKS the type errors these tests exist to
 * assert (a TS2307 satisfies "some diagnostic was reported" just as well as the
 * TS2322 we actually want).
 *
 * A root under `packages/editor/` resolves against `packages/editor/node_modules`,
 * and mirrors reality: a project always lives inside its host app.
 */
const TMP_ROOT = path.join(import.meta.dirname, ".tmp");

export async function makeTempProject(): Promise<ProjectFs> {
  await mkdir(TMP_ROOT, { recursive: true });
  const project = new ProjectFs(await mkdtemp(path.join(TMP_ROOT, "project-")));
  await project.init();
  return project;
}

export async function cleanupProject(project: ProjectFs): Promise<void> {
  await rm(project.root, { recursive: true, force: true });
}
