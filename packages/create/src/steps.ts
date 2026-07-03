import { spawnSync } from "node:child_process";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** Whatever launched us (npm create / pnpm create / yarn create) installs. */
export function detectPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent ?? "";
  if (agent.startsWith("pnpm")) return "pnpm";
  if (agent.startsWith("yarn")) return "yarn";
  if (agent.startsWith("bun")) return "bun";
  return "npm";
}

/** Run an interactive child command; false = non-zero exit or spawn failure. */
export function run(command: string, args: string[], cwd: string): boolean {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  return result.status === 0;
}

/** True if dir is already inside a git work tree (skip git init). */
export function isInsideGitRepo(cwd: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd,
    stdio: "ignore",
  });
  return result.status === 0;
}

export function gitInit(cwd: string): boolean {
  return run("git", ["init", "-q"], cwd);
}

export function installDeps(pm: PackageManager, cwd: string): boolean {
  return run(pm, ["install"], cwd);
}

/**
 * The skills CLI owns the agent picker (Claude Code / Cursor / Codex / ...).
 * `--skill` preselects smoove-video so the user isn't shown the whole repo's
 * skill list — only the agent choice remains.
 */
export function installSkill(cwd: string): boolean {
  return run("npx", ["-y", "skills", "add", "smoove-dev/smoove", "--skill", "smoove-video"], cwd);
}
