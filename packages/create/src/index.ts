#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { type CliOptions, parseCliArgs } from "./args.js";
import { fetchTemplate, patchPackageName } from "./scaffold.js";
import {
  detectPackageManager,
  gitInit,
  installDeps,
  installSkill,
  isInsideGitRepo,
} from "./steps.js";

const HELP = `create-smoove — scaffold a smoove video project

Usage:
  npm create smoove [template] [dir] [options]

Templates:
  studio        Full studio: React Router app with timeline UI, props panel,
                and a server render queue.
  composition   Minimal Vite app: one composition, <smoove-player> preview,
                autoreload.

Options:
  --ts / --js   Language for the composition template (default: ask)
  --no-install  Skip installing dependencies
  --no-git      Skip git init
  --no-skill    Skip the smoove-video agent-skill install
  -h, --help    Show this help
`;

async function main(): Promise<void> {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(pc.red(String(err instanceof Error ? err.message : err)));
    console.error(HELP);
    process.exit(1);
  }
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const interactive = process.stdout.isTTY === true;
  p.intro(pc.bgCyan(pc.black(" create-smoove ")));

  // -- resolve template ------------------------------------------------
  let template = opts.template;
  if (!template) {
    if (!interactive) bail("Pass a template (studio | composition) in non-interactive mode.");
    template = guard(
      await p.select({
        message: "Which template?",
        options: [
          {
            value: "studio" as const,
            label: "studio",
            hint: "timeline UI, props panel, server rendering",
          },
          {
            value: "composition" as const,
            label: "composition",
            hint: "one composition + player preview, Vite",
          },
        ],
      }),
    );
  }

  // -- resolve language (composition only) -----------------------------
  let language = opts.language;
  if (template === "composition" && !language) {
    if (!interactive) {
      language = "ts";
    } else {
      language = guard(
        await p.select({
          message: "TypeScript or JavaScript?",
          options: [
            { value: "ts" as const, label: "TypeScript" },
            { value: "js" as const, label: "JavaScript" },
          ],
        }),
      );
    }
  }
  const templateDir = template === "composition" ? `composition-${language}` : "studio";

  // -- resolve target dir ----------------------------------------------
  let dir = opts.dir;
  if (!dir) {
    if (!interactive) bail("Pass a target directory in non-interactive mode.");
    dir = guard(
      await p.text({
        message: "Where should the project go?",
        placeholder: template === "studio" ? "./my-smoove-studio" : "./my-composition",
        validate: (v) => (v?.trim() ? undefined : "Enter a directory"),
      }),
    ).trim();
  }
  const targetDir = path.resolve(dir);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    if (!interactive) bail(`Target directory ${dir} is not empty.`);
    const overwrite = guard(
      await p.confirm({
        message: `${dir} is not empty. Continue and write into it anyway?`,
        initialValue: false,
      }),
    );
    if (!overwrite) bail("Aborted.");
  }

  // -- scaffold ----------------------------------------------------------
  const s = p.spinner();
  s.start(`Fetching the ${template} template`);
  let pkgName: string;
  try {
    await fetchTemplate(templateDir, targetDir);
    pkgName = await patchPackageName(targetDir);
  } catch (err) {
    s.stop("Fetch failed");
    bail(String(err instanceof Error ? err.message : err));
  }
  s.stop(`Scaffolded ${pc.cyan(pkgName)}`);

  // -- optional steps ----------------------------------------------------
  const notes: string[] = [];
  const pm = detectPackageManager();

  if (opts.git && !isInsideGitRepo(targetDir)) {
    if (!gitInit(targetDir)) notes.push("git init failed — run it yourself.");
  }

  if (opts.install) {
    p.log.step(`Installing dependencies with ${pm}`);
    if (!installDeps(pm, targetDir))
      notes.push(`Install failed — run \`${pm} install\` in ${dir}.`);
  } else {
    notes.push(`Install dependencies: cd ${dir} && ${pm} install`);
  }

  let skill = opts.skill;
  if (skill === undefined) {
    skill = interactive
      ? guard(
          await p.confirm({
            message: "Install the smoove-video agent skill (Claude Code, Cursor, Codex, ...)?",
            initialValue: true,
          }),
        )
      : false;
  }
  if (skill) {
    if (!installSkill(targetDir))
      notes.push(
        "Skill install failed — run `npx skills add smoove-dev/smoove -s smoove-video` in the project.",
      );
  } else {
    notes.push("Agent skill (optional): npx skills add smoove-dev/smoove -s smoove-video");
  }

  // -- summary -----------------------------------------------------------
  const dev = pm === "npm" ? "npm run dev" : `${pm} dev`;
  p.note(
    [`cd ${dir}`, opts.install ? dev : `${pm} install && ${dev}`, "", ...notes].join("\n"),
    "Next steps",
  );
  p.outro(`Docs: ${pc.underline("https://smoove.dev")}`);
}

/** Unwrap a clack prompt result, exiting cleanly on Ctrl-C. */
function guard<T>(value: T | symbol): T {
  if (p.isCancel(value)) bail("Cancelled.");
  return value as T;
}

function bail(message: string): never {
  p.cancel(message);
  process.exit(1);
}

main().catch((err) => {
  console.error(pc.red(String(err instanceof Error ? (err.stack ?? err.message) : err)));
  process.exit(1);
});
