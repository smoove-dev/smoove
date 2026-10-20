/**
 * The one definition of every `smoove` command. The command line maps its
 * flags onto a command's input and prints its result; the MCP server
 * (`smoove agent mcp`) registers each one as a tool with the same input and returns
 * the same result. Neither front door has a command the other lacks.
 */
import type { ToolAnnotations } from "@modelcontextprotocol/server";
import * as z from "zod";
import { KEBAB } from "./new/ids.js";
import { runNew } from "./new/new.js";
import {
  runCheck,
  runContext,
  runRender,
  runRenderStatus,
  runSeek,
  runSheet,
  runSnap,
  runStart,
  runStatus,
  runStop,
  runTimeline,
} from "./run.js";

/** Where a command runs and how it reports while it works. */
export interface RunContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  sleep(ms: number): Promise<void>;
  /** Which front door called: messages that name the next step differ. */
  door: "cli" | "mcp";
  /** Live progress. The command line prints `message`; the MCP server sends a progress notification. */
  progress?(update: { progress: number; total?: number; message: string }): void;
  /** Aborted when the MCP client cancels the call or goes away. */
  signal?: AbortSignal;
  /** Longest a command waits on a job before handing back its id. Unset: wait as long as it takes. */
  maxWaitMs?: number;
}

export interface CommandImage {
  path: string;
  /** Return the bytes inline through MCP. The command line only ever prints the path. */
  inline: boolean;
}

export interface CommandResult {
  /** 0 ok, 1 the bridge, the tab or the check failed. (2 is the command line's own usage error.) */
  code: 0 | 1;
  /** What `--json` prints and MCP returns as structured content. */
  answer: unknown;
  /** Standard output text: what a person or an agent reads. */
  text: string;
  /** Standard error text: the error message and warnings, or "". */
  errors: string;
  images: CommandImage[];
}

export interface Command<S extends z.ZodObject = z.ZodObject> {
  name: string;
  /** Where the command line puts it: `smoove <name>`, or `smoove agent <name>`. */
  group: "top" | "agent";
  /** One line for `smoove --help`. */
  summary: string;
  /** For the MCP tool: what it does and when to use it, written for an agent. */
  description: string;
  input: S;
  annotations: ToolAnnotations;
  run(ctx: RunContext, input: z.infer<S>): Promise<CommandResult>;
}

/** Input the command can't use. The command line exits 2; MCP returns an error result. */
export class UsageError extends Error {}

const frame = z.number().int().min(0);
const composition = z
  .string()
  .describe("The composition id. Default: the one the user is watching.");
const at = z
  .string()
  .describe(
    'A beat: "hook" (its contact-sheet frame), or hook.start, hook.settled, hook.last or hook.end.',
  );

function define<S extends z.ZodObject>(command: Command<S>): Command {
  return command as unknown as Command;
}

export const COMMANDS: Command[] = [
  define({
    name: "status",
    group: "agent",
    summary: "What the user's studio tab shows",
    description:
      "What the user's studio tab shows: the composition, the frame, whether it's playing, the tabs, and whether the user marked something. Never starts anything.",
    input: z.object({}),
    annotations: { readOnlyHint: true },
    run: runStatus,
  }),
  define({
    name: "start",
    group: "agent",
    summary: "Start the studio dev server in the background",
    description:
      "Start the studio dev server in the background and return its URL. Give that URL to the user so they can watch. If it's already running, returns the running one.",
    input: z.object({ port: z.number().int().min(1).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    run: runStart,
  }),
  define({
    name: "stop",
    group: "agent",
    summary: "Stop the dev server smoove agent start started",
    description:
      "Stop the studio dev server that start started. Refuses to stop one the user started themselves.",
    input: z.object({}),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    run: runStop,
  }),
  define({
    name: "seek",
    group: "agent",
    summary: "Move the user's playhead (or --at <beat>)",
    description:
      "Move the playhead in the user's studio tab, which changes what they see. Use it only when the user asks to be shown something; to look yourself, use snap.",
    input: z
      .object({ frame: frame.optional(), at: at.optional(), composition: composition.optional() })
      .refine((v) => v.frame !== undefined || v.at !== undefined, {
        message: "seek needs a frame or --at <beat>.",
      }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    run: runSeek,
  }),
  define({
    name: "snap",
    group: "agent",
    summary: "One frame as a PNG",
    description:
      "One frame of a composition as a PNG, drawn by the studio without changing what the user sees. Returns the image. Pick the frame with frame or at.",
    input: z.object({
      composition: composition.optional(),
      frame: frame.optional(),
      at: at.optional(),
      width: z.number().int().min(1).optional().describe("Image width in pixels. Default 640."),
    }),
    annotations: { readOnlyHint: true },
    run: runSnap,
  }),
  define({
    name: "sheet",
    group: "agent",
    summary: "A contact sheet: one tile per beat",
    description:
      "A contact sheet of a composition: one tile per beat, each at the moment the beat is fully on screen, stamped with its frame and beat name. Returns the image. Look at one sheet per pass.",
    input: z.object({
      composition: composition.optional(),
      frames: z
        .number()
        .int()
        .min(2)
        .max(24)
        .optional()
        .describe("Evenly spaced frames instead of one per beat."),
      width: z.number().int().min(1).optional().describe("Tile width in pixels. Default 320."),
    }),
    annotations: { readOnlyHint: true },
    run: runSheet,
  }),
  define({
    name: "timeline",
    group: "agent",
    summary: "Beats and sequences, in frames",
    description:
      "A composition's length, fps, beats (start, settled, end) and sequences, in frames.",
    input: z.object({ composition: composition.optional() }),
    annotations: { readOnlyHint: true },
    run: runTimeline,
  }),
  define({
    name: "context",
    group: "agent",
    summary: "Read and clear the user's mark from the studio",
    description:
      'Read what the user marked by dragging a rectangle over the frame in the studio: the frame, its beat, and the nodes inside, smallest first, each with the file and line that made it. Call it first when the user says "this", "here" or "that one". Reading clears the mark.',
    input: z.object({
      image: z.boolean().optional().describe("Also return the marked frame as an image."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
    run: runContext,
  }),
  define({
    name: "check",
    group: "agent",
    summary: "Check a composition for purity, layout, motion and style problems",
    description:
      "Check a composition for what you'd otherwise catch by watching: code that breaks scrubbing, text cut or off the canvas, low contrast, colors outside the palette, frozen stretches, and the intents in its checks file. Fix every error; fix each warning or allow it with a reason in the checks file.",
    input: z.object({
      composition: composition.optional(),
      all: z.boolean().optional().describe("Check every composition in the catalog."),
      groups: z
        .array(z.enum(["purity", "layout", "intent", "motion", "style"]))
        .optional()
        .describe("Run only these groups."),
      images: z
        .boolean()
        .optional()
        .describe("Write an image of each error and held warning, and list their paths."),
    }),
    annotations: { readOnlyHint: true },
    run: runCheck,
  }),
  define({
    name: "render",
    group: "top",
    summary: "Render a video (only when the user asks for one)",
    description:
      "Render a composition to a video file through the studio's render queue. Takes minutes. Use it only when the user asks for a video, never to check your own work; look with sheet, snap and check instead.",
    input: z
      .object({
        composition: composition.optional(),
        format: z.enum(["mp4", "webm"]).optional(),
        from: frame.optional(),
        to: frame.optional(),
        out: z
          .string()
          .optional()
          .describe("Where the file goes. Default out/<composition>.<format>."),
        wait: z
          .boolean()
          .optional()
          .describe("Wait for the file (default), or return once the job is queued."),
      })
      .refine((v) => (v.from === undefined) === (v.to === undefined), {
        message: "Give both --from and --to, or neither.",
      }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: runRender,
  }),
];

COMMANDS.push(
  define({
    name: "render_status",
    group: "agent",
    summary: "How a render handed back by render is going",
    description:
      "How a render is going: its status, its progress and where the file goes. Use it with the job id render returned when it handed back before the file was written.",
    input: z.object({ job: z.string().min(1).describe("The job id render returned.") }),
    annotations: { readOnlyHint: true },
    run: runRenderStatus,
  }),
);

COMMANDS.push(
  define({
    name: "new",
    group: "top",
    summary: "Create a composition",
    description:
      "Create a composition folder under compositions/: a title card showing the title, with its index.ts entry, props schema, checks and tests, ready to edit. The studio picks it up as soon as it's written.",
    input: z.object({
      title: z.string().min(1).describe("What the title card says, and the studio's name for it."),
      id: z
        .string()
        .regex(KEBAB, "The id must be kebab case: lowercase words joined by dashes.")
        .optional()
        .describe("The id and folder name. Default: the title in kebab case."),
      group: z.string().min(1).optional().describe('The sidebar group. Default "Compositions".'),
      description: z.string().optional().describe("One line for the studio's catalog."),
      format: z
        .enum(["landscape", "portrait", "square"])
        .optional()
        .describe("1920 by 1080, 1080 by 1920, or 1080 by 1080. Default landscape."),
      seconds: z.number().positive().optional().describe("The length. Default 5."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
    run: runNew,
  }),
);

export function commandNamed(name: string): Command | undefined {
  return COMMANDS.find((c) => c.name === name);
}

/** How a command is run from the caller's front door: `smoove agent snap`, or `the snap tool`. */
export function spell(ctx: Pick<RunContext, "door">, name: string): string {
  if (ctx.door === "mcp") return `the ${name} tool`;
  return commandNamed(name)?.group === "top" ? `smoove ${name}` : `smoove agent ${name}`;
}
