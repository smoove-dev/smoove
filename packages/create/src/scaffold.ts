import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadTemplate } from "giget";

const REPO = "gh:smoove-dev/smoove";
/** Never copy local build/install artifacts into a scaffolded project. */
const EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".react-router",
  "package-lock.json",
]);

/**
 * Materialize a template into targetDir. SMOOVE_CREATE_TEMPLATE_DIR (a local
 * checkout's templates/ dir) short-circuits the GitHub fetch for development
 * and CI smoke tests.
 */
export async function fetchTemplate(templateName: string, targetDir: string): Promise<void> {
  const localRoot = process.env.SMOOVE_CREATE_TEMPLATE_DIR;
  if (localRoot) {
    await cp(path.join(localRoot, templateName), targetDir, {
      recursive: true,
      filter: (src) => !src.split(path.sep).some((seg) => EXCLUDED_SEGMENTS.has(seg)),
    });
    return;
  }
  try {
    await downloadTemplate(`${REPO}/templates/${templateName}#main`, {
      dir: targetDir,
      force: true,
    });
  } catch (cause) {
    throw new Error(
      "Could not download the template from GitHub. Check your network and try again,\n" +
        `or scaffold manually: npx giget@latest ${REPO}/templates/${templateName} <dir>`,
      { cause },
    );
  }
}

/** Set the scaffolded package.json name from the target directory's basename. */
export async function patchPackageName(targetDir: string): Promise<string> {
  const file = path.join(targetDir, "package.json");
  const pkg = JSON.parse(await readFile(file, "utf8")) as { name?: string };
  const name =
    path
      .basename(path.resolve(targetDir))
      .toLowerCase()
      .replace(/[^a-z0-9-_.]+/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "") || "smoove-app";
  pkg.name = name;
  await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
  return name;
}
