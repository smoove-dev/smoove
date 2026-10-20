import { smoove } from "@smoove/vite";
import { parseCLI, startVitest } from "vitest/node";

/**
 * Run the compositions' tests (`compositions/**\/*.test.{ts,js}`) in Node, with
 * the renderer's Node backend registered first, so a project needs no Vitest
 * config. A check sweep over a long composition takes a while, so a test gets
 * a minute by default. `args` are Vitest's own (file filters, `-t`,
 * `--reporter`, ...). Resolves to the exit code.
 */
export async function testPreset(opts: {
  root: string;
  watch?: boolean;
  args?: string[];
}): Promise<number> {
  const cli = parseCLI(["vitest", ...(opts.args ?? [])]);
  const vitest = await startVitest(
    "test",
    cli.filter,
    {
      root: opts.root,
      config: false,
      watch: opts.watch ?? false,
      environment: "node",
      include: ["compositions/**/*.test.{ts,js}"],
      setupFiles: ["@smoove/renderer/register"],
      passWithNoTests: true,
      testTimeout: 60_000,
      hookTimeout: 60_000,
      ...cli.options,
    },
    // Vitest bundles its own copy of Vite's types; the plugin is the same object.
    { plugins: [smoove({ root: opts.root, agent: false }) as never] },
  );
  const failed =
    vitest.state.getCountOfFailedTests() > 0 || vitest.state.getUnhandledErrors().length > 0;
  if (!opts.watch) await vitest.close();
  return failed ? 1 : 0;
}
