let jobSeq = 1;

/** A stable-enough job id for the in-memory render queue. */
export function makeJobId(): string {
  return `job-${jobSeq++}-${Math.random().toString(36).slice(2, 6)}`;
}
