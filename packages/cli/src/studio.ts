/**
 * The commands the command line runs itself: `smoove start`, `smoove build` and
 * `smoove test`. A preset project runs the studio that ships in
 * `@smoove/studio`; a detached one runs its own scripts, so the commands stay
 * the same after `smoove studio detach`.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { UsageError } from "./commands.js";
import type { Io } from "./main.js";
import { findProject, packageManager } from "./project.js";

/** What each command does, swappable for tests. Each resolves to an exit code. */
export interface StudioDeps {
  /** Run the hidden studio's dev server until it closes. */
  start(root: string, port?: number): Promise<number>;
  /** Serve the built studio until the server exits. */
  serve(root: string, port?: number): Promise<number>;
  build(root: string): Promise<number>;
  test(root: string): Promise<number>;
  /** Run one of the project's package.json scripts. */
  runScript(root: string, script: string, args: string[]): Promise<number>;
}

export interface StudioFlags {
  prod?: boolean;
  port?: number;
}

/** A detached project owns its app, which means it has a React Router config. */
function detached(root: string): boolean {
  return ["ts", "js", "mjs"].some((ext) => existsSync(join(root, `react-router.config.${ext}`)));
}

export async function runStudioCommand(
  name: "start" | "build" | "test",
  flags: StudioFlags,
  io: Io,
  deps: StudioDeps = defaultDeps,
): Promise<number> {
  const root = findProject(io.cwd);
  if (!root) {
    io.err("There's no smoove project here or above.");
    return 1;
  }
  try {
    if (detached(root)) {
      const port = flags.port !== undefined ? ["--port", String(flags.port)] : [];
      if (name === "start") return await deps.runScript(root, flags.prod ? "start" : "dev", port);
      return await deps.runScript(root, name, []);
    }
    if (name === "start") {
      return flags.prod ? await deps.serve(root, flags.port) : await deps.start(root, flags.port);
    }
    return name === "build" ? await deps.build(root) : await deps.test(root);
  } catch (err) {
    // A refusal from the preset (for example, no build to serve) is a message, not a crash.
    if (err instanceof Error && err.name === "PresetError") {
      io.err(err.message);
      return 1;
    }
    throw err;
  }
}

/** Wait for a child process and hand back its exit code. */
function exitCode(child: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolve) => {
    child.once("exit", (code) => resolve(code ?? 1));
    child.once("error", () => resolve(1));
  });
}

const defaultDeps: StudioDeps = {
  async start(root, port) {
    const { startPreset } = await import("@smoove/studio/preset");
    const server = await startPreset({ root, port });
    await new Promise<void>((resolve) => server.httpServer?.once("close", () => resolve()));
    return 0;
  },
  async serve(root, port) {
    const { servePreset } = await import("@smoove/studio/preset");
    return exitCode(servePreset({ root, port }));
  },
  async build(root) {
    const { buildPreset } = await import("@smoove/studio/preset");
    await buildPreset({ root });
    return 0;
  },
  async test(root) {
    const { testPreset } = await import("@smoove/studio/preset");
    return testPreset({ root });
  },
  runScript(root, script, args) {
    const pm = packageManager(root);
    const extra = args.length > 0 ? [...(pm === "npm" ? ["--"] : []), ...args] : [];
    return exitCode(spawn(pm, ["run", script, ...extra], { cwd: root, stdio: "inherit" }));
  },
};

/**
 * `smoove studio detach`: write the studio app into the project, for good.
 * Lists what it will write, then asks, unless `--yes`. Without a terminal to
 * ask in it needs `--yes`.
 */
export async function runDetach(flags: { yes?: boolean }, io: Io): Promise<number> {
  const root = findProject(io.cwd);
  if (!root) {
    io.err("There's no smoove project here or above.");
    return 1;
  }
  if (!flags.yes && !io.interactive) {
    throw new UsageError(
      "smoove studio detach changes the project for good, so it asks first. Without a terminal to ask in, pass --yes.",
    );
  }
  const { detach, isDetached, planDetach, PresetError } = await import("@smoove/studio/preset");
  try {
    if (isDetached(root)) throw new PresetError("This project is already detached.");
    const plan = planDetach(root);
    const top = [...new Set(plan.write.map((f) => (f.includes("/") ? `${f.split("/")[0]}/` : f)))];
    io.out(
      [
        "Detaching writes the studio app into this project. From then on the project owns it,",
        "and studio updates no longer reach it. It writes:",
        ...top.map((f) => `  ${f}`),
        `and points the dev, build, start, test and typecheck scripts at them.`,
      ].join("\n"),
    );
    if (!flags.yes) {
      const { confirm, isCancel } = await import("@clack/prompts");
      const ok = await confirm({ message: "Detach the studio?", initialValue: false });
      if (isCancel(ok) || !ok) {
        io.out("Nothing changed.");
        return 0;
      }
    }
    detach(root);
    io.out(
      [
        "Detached. The app is in studio/, and compositions/ and smoove.config.ts work as before.",
        "smoove start, smoove build and smoove test still work: they now run the project's scripts.",
      ].join("\n"),
    );
    return 0;
  } catch (err) {
    if (err instanceof PresetError) {
      io.err(err.message);
      return 1;
    }
    throw err;
  }
}
