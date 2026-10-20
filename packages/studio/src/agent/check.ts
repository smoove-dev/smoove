import {
  AgentError,
  type CheckFinding,
  type CheckParams,
  type CheckResult,
  DEFAULT_SNAPSHOT_WIDTH,
} from "@smoove/agent";
import type { Composition } from "@smoove/core";
import { type CheckGroup, type Checks, checksFrom, runChecks } from "@smoove/core/testing";
import type { RegistryEntry } from "../types.js";
import { beatsOf } from "./beats.js";
import { captureFrames, encodePng, scaleCanvas } from "./capture.js";
import { strokeRect } from "./mark.js";

/** Load an entry's checks file fresh, or null when it has none. */
async function loadChecks(entry: RegistryEntry | undefined): Promise<Checks | null> {
  if (!entry?.checks) return null;
  const file = `the checks file for "${entry.id}"`;
  try {
    return checksFrom(await entry.checks(), file);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AgentError(
      "checks-error",
      message.includes(file) ? message : `${file} failed to load: ${message}`,
    );
  }
}

/** Should this finding get an image? Errors and held warnings do. */
const pictured = (f: CheckFinding): boolean => f.severity === "error" || f.held;

/**
 * Run every check on a composition the tab has open and ready, and hand back
 * the report, with an image per error and held warning when asked. The
 * checks file is imported fresh, so an edit to it counts on the next run.
 */
export async function answerCheck(
  id: string,
  comp: Composition,
  entries: RegistryEntry[],
  params: CheckParams,
): Promise<CheckResult> {
  const entry = entries.find((e) => e.id === id);
  const checks = await loadChecks(entry);
  // A hot reload rebuilds the composition module, and the checks file imports
  // it again; use the instance the checks were defined with, so selectors and
  // beat points refer to the same nodes.
  const target = checks && checks.composition !== comp ? checks.composition : comp;
  if (target !== comp) await target.whenReady();

  const { beats } = beatsOf(target);
  const report = await runChecks(target, checks, {
    beats,
    ...(params.groups ? { groups: params.groups as CheckGroup[] } : {}),
  });
  // Core's Finding is the agent's wire shape: this assignment is the guard.
  const findings: CheckFinding[] = report.findings;
  const allowed: CheckResult["allowed"] = report.allowed;

  const images: NonNullable<CheckResult["images"]> = [];
  if (params.images) {
    const compW = target.width();
    const width = Math.min(DEFAULT_SNAPSHOT_WIDTH, compW);
    const height = Math.round((width / compW) * target.height());
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i] as CheckFinding;
      const frame = f.frames[0]?.from;
      if (!pictured(f) || frame === undefined) continue;
      let png: Blob | null = null;
      await captureFrames(target, [frame], width / compW, (canvas) => {
        const scaled = scaleCanvas(canvas, width, height);
        if (f.node) strokeRect(scaled, f.node.box, width / compW);
        png = encodePng(scaled);
      });
      if (png) images.push({ finding: i, frame, png });
    }
  }

  return {
    composition: id,
    catalog: entries.map((e) => e.id),
    hasChecksFile: checks !== null,
    hasPalette: Boolean(checks?.options.style?.palette),
    frames: target.durationInFrames.get(),
    beats: beats.length,
    samples: report.samples,
    findings,
    allowed,
    colorsInUse: report.colorsInUse,
    ...(images.length > 0 ? { images } : {}),
  };
}
