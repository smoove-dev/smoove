/** `media_status`: how a long media job handed back by another tool is going. */
import type { CommandResult, RunContext } from "../commands.js";
import { done, fail } from "../run.js";
import { readJob } from "./jobs.js";
import { runMedia } from "./runtime.js";

export function runMediaStatus(ctx: RunContext, input: { job: string }): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const job = readJob(root, input.job);
    if (job === null)
      return fail("not-found", `There's no media job ${input.job} in this project.`);
    if (job === "stale") {
      return done({ id: input.job, status: "stale" }, [
        "That job stopped when its process ended. Call the tool again to restart it.",
      ]);
    }
    if (job.status === "error" && job.error) return fail(job.error.code, job.error.message);
    if (job.status === "done") {
      return done(job, [`Job ${job.id} is done.`, ...(job.result ?? [])]);
    }
    return done(job, [
      `Job ${job.id} is running: ${Math.round(job.progress * 100)} percent. ${job.message}`.trim(),
    ]);
  });
}
