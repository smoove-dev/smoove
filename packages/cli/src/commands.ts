/**
 * The one definition of every `smoove` command. The command line maps its
 * flags onto a command's input and prints its result; the MCP server
 * (`smoove agent mcp`) registers each one as a tool with the same input and returns
 * the same result. Neither front door has a command the other lacks.
 */
import type { ToolAnnotations } from "@modelcontextprotocol/server";
import * as z from "zod";
import { runAssetAdd } from "./assets/add.js";
import { runAssets } from "./assets/ledger.js";
import { runAssetSearch } from "./assets/openverse.js";
import { runPageShot } from "./assets/page-shot.js";
import { runCutPlan } from "./cuts/plan.js";
import { runMediaAudio } from "./media/audio-map.js";
import { runExtractAudio } from "./media/extract.js";
import { runFootageAdd } from "./media/footage.js";
import { runMediaInfo } from "./media/info.js";
import { runMediaSheet } from "./media/sheet.js";
import { runMediaStatus } from "./media/status.js";
import { runMediaVideo } from "./media/video-map.js";
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
import { runModels } from "./transcribe/models.js";
import { runTranscribe } from "./transcribe/run.js";

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
      template: z
        .enum(["title", "recut"])
        .optional()
        .describe(
          "title (default): a title card. recut: plays ranges of footage from the original file, read from its cuts.json, with captions from the transcript; portrait by default.",
        ),
      source: z
        .string()
        .min(1)
        .optional()
        .describe("Recut only: the footage, a path inside the project, like footage/talk.mp4."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false },
    run: runNew,
  }),
);

/** A `from`/`to` range of a source, when both are given, runs forward. */
const toAfterFrom = (v: { from?: number; to?: number }) =>
  v.from === undefined || v.to === undefined || v.to > v.from;
const toAfterFromIssue = { message: "to must come after from." };

const source = z
  .string()
  .min(1)
  .describe("The media file, as a path inside the project, like footage/talk.mp4.");

COMMANDS.push(
  define({
    name: "footage_add",
    group: "agent",
    summary: "Copy a recording into the project's footage/ folder",
    description:
      "Bring a video or audio file into the project so the studio and the other media tools can use it. A file outside the project is copied whole into footage/, which is kept out of git. It is never trimmed, and the original is never moved or changed. A file already inside the project stays where it is. Returns the path every other media tool takes.",
    input: z.object({
      path: z.string().min(1).describe("The file, anywhere on this machine."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    run: runFootageAdd,
  }),
  define({
    name: "media_info",
    group: "agent",
    summary: "What's in a media file: length, size, frame rate, tracks",
    description:
      "A media file's length, picture size, frame rate, rotation, codecs, and whether it has video and audio, read from its container without decoding. Call it first on any footage.",
    input: z.object({ source }),
    annotations: { readOnlyHint: true },
    run: runMediaInfo,
  }),
  define({
    name: "media_audio",
    group: "agent",
    summary: "Where a recording is quiet, where someone speaks, where it's loud",
    description:
      "Map a recording's audio: the quiet stretches, the stretches of speech, and the loudest moments (laughter, applause, a raised voice), each with its time in seconds. The full loudness curve goes to a file. Use it to find pauses to trim and candidate highlights. A long file can hand back a job id; read it with media_status.",
    input: z.object({
      source,
      thresholdDb: z
        .number()
        .min(0)
        .optional()
        .describe("Quiet is this many dB under the clip's typical level. Default 20."),
      minQuiet: z
        .number()
        .min(0)
        .optional()
        .describe("Shortest quiet stretch, in seconds. Default 0.5."),
      peaks: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("How many loud moments to list. Default 10."),
    }),
    annotations: { readOnlyHint: true },
    run: runMediaAudio,
  }),
  define({
    name: "extract_audio",
    group: "agent",
    summary: "Write a recording's audio as its own file",
    description:
      "Write the audio of a video or audio file as its own file: an m4a for the user by default, or 16 kHz mono WAV with preset transcribe, for a transcription tool. from and to take one range of it. This is the only media tool that writes a media file. The source is never changed. To silence a video in a composition, set muted on the Video instead.",
    input: z
      .object({
        source,
        preset: z.enum(["transcribe", "m4a"]).optional(),
        from: z.number().min(0).optional().describe("Start of the range, in source seconds."),
        to: z.number().min(0).optional().describe("End of the range, in source seconds."),
        out: z
          .string()
          .min(1)
          .optional()
          .describe("m4a only: where it goes. Default <source name>.m4a."),
        overwrite: z
          .boolean()
          .optional()
          .describe(
            "Replace a file already at out. Without it, an existing file is never touched.",
          ),
      })
      .refine(toAfterFrom, toAfterFromIssue),
    annotations: { readOnlyHint: false, destructiveHint: false },
    run: runExtractAudio,
  }),
  define({
    name: "media_sheet",
    group: "agent",
    summary: "A contact sheet of raw footage, each tile stamped with its time",
    description:
      "A contact sheet of a video file: tiles in a grid, each stamped with its time in the source. Returns the image. Use it to see long footage without watching it: one sheet across the whole file first, then closer sheets around the moments the transcript or the audio map point to. Tiles land on the keyframe at or before each time, which keeps sheets fast; pass exact for exact times.",
    input: z
      .object({
        source,
        tiles: z
          .number()
          .int()
          .min(2)
          .max(24)
          .optional()
          .describe("How many evenly spaced tiles. Default 12."),
        from: z
          .number()
          .min(0)
          .optional()
          .describe("Start of the range to space tiles across, in seconds."),
        to: z.number().min(0).optional().describe("End of that range, in seconds."),
        at: z
          .array(z.number().min(0))
          .min(1)
          .max(24)
          .optional()
          .describe("Exact times for the tiles, in seconds, instead of spacing them."),
        width: z.number().int().min(1).optional().describe("Tile width in pixels. Default 320."),
        exact: z
          .boolean()
          .optional()
          .describe("Decode the exact times instead of the keyframe before each. Slower."),
      })
      .refine(toAfterFrom, toAfterFromIssue),
    annotations: { readOnlyHint: true },
    run: runMediaSheet,
  }),
  define({
    name: "media_video",
    group: "agent",
    summary: "Where footage is black, white or frozen, and where it cuts",
    description:
      "Scan a video's picture for stretches of solid black or white, a frozen picture (like a paused screen share), and the times the shot cuts. It decodes every frame of the range, so on long footage scan the stretches the transcript or audio map point to with from and to. A long scan can hand back a job id; read it with media_status.",
    input: z
      .object({
        source,
        from: z.number().min(0).optional().describe("Start of the range, in seconds. Default 0."),
        to: z.number().min(0).optional().describe("End of the range, in seconds. Default the end."),
        rate: z.number().positive().max(30).optional().describe("Samples a second. Default 4."),
      })
      .refine(toAfterFrom, toAfterFromIssue),
    annotations: { readOnlyHint: true },
    run: runMediaVideo,
  }),
  define({
    name: "transcribe",
    group: "agent",
    summary: "Every word of a recording with its time",
    description:
      "Transcribe a recording to every word with its start and end, written to transcripts/<name>.json, plus <name>.txt (one phrase per line with its time, the file to read) and <name>.srt. If your own tools can transcribe, use them first and pass their SRT, VTT or JSON here to import it. Otherwise it runs locally once the model is installed with models, or through an API the user set up. An existing transcript is kept, since it may hold corrections, unless fresh is set. After correcting the JSON, call it on the JSON to rewrite the text and subtitles.",
    input: z.object({
      source: z
        .string()
        .min(1)
        .describe(
          "A media file, or a .srt, .vtt or .json transcript to import, as a path inside the project.",
        ),
      engine: z
        .enum(["auto", "import", "local", "api"])
        .optional()
        .describe("Default auto: import a transcript file, else local, else the API."),
      language: z.string().min(2).optional().describe("The spoken language, like en, when known."),
      fresh: z.boolean().optional().describe("Replace an existing transcript in transcripts/."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (ctx, input) => runTranscribe(ctx, input),
  }),
  define({
    name: "models",
    group: "agent",
    summary: "List or install the local transcription model",
    description:
      "List what local transcription needs and whether it's installed, or install it with install parakeet: NVIDIA's Parakeet model (about 670 MB) and the sherpa-onnx runtime from npm, once per machine, into a shared cache. A long install hands back; run models again to see how it's going. Install only after the user agrees. Tell them the size first. Parakeet covers English and 24 more European languages; for others, use your own tools or an API.",
    input: z.object({
      install: z.enum(["parakeet"]).optional().describe("Download and install this model."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (ctx, input) => runModels(ctx, input),
  }),
  define({
    name: "media_status",
    group: "agent",
    summary: "How a long media job handed back by another tool is going",
    description:
      "How a transcription, audio map or video scan is going, with the job id the tool returned when it handed back before finishing: running with its progress, done with the files it wrote, or failed with why.",
    input: z.object({ job: z.string().min(1).describe("The job id the media tool returned.") }),
    annotations: { readOnlyHint: true },
    run: runMediaStatus,
  }),
  define({
    name: "cut_plan",
    group: "agent",
    summary: "Turn editing choices into the exact source ranges a recut plays",
    description:
      "Write a recut composition's cuts.json: the exact ranges of the original footage it plays, back to back. Give the ranges to keep (with labels) or to remove, in source seconds, and optionally filler words to drop (uses the transcript), a longest pause (uses the audio map), and a target length. Cuts snap to the frame grid and never split a word. The footage itself is never cut or changed, so any edit stays a change to these numbers. Make the composition first with new and template recut.",
    input: z.object({
      composition: z.string().min(1).describe("The recut composition's id."),
      keep: z
        .array(
          z.object({
            start: z.number().min(0),
            end: z.number().min(0),
            label: z.string().optional(),
          }),
        )
        .optional()
        .describe("Ranges of the source to keep, in order, in seconds."),
      remove: z
        .array(z.object({ start: z.number().min(0), end: z.number().min(0) }))
        .optional()
        .describe("Ranges of the source to drop, in seconds. The rest is kept."),
      fillers: z
        .array(z.string().min(1))
        .optional()
        .describe('Filler words to drop, like ["um", "uh"].'),
      maxPause: z
        .number()
        .min(0)
        .optional()
        .describe("Shorten every pause longer than this many seconds to it."),
      pad: z
        .number()
        .min(0)
        .optional()
        .describe("Seconds kept around the cuts it makes. Default 0.1."),
      target: z
        .number()
        .positive()
        .optional()
        .describe("Warn when the total misses this many seconds."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    run: runCutPlan,
  }),
  define({
    name: "asset_search",
    group: "agent",
    summary: "Search Creative Commons images and sounds on Openverse",
    description:
      "If your own tools can search for images or sounds, use them first. Otherwise this searches Openverse, which needs no key, and lists each hit with its title, licence, author and a preview address. By default only licences that allow commercial use. Add one with asset_add and its id, and the credit is filled in.",
    input: z.object({
      query: z.string().min(1).describe("What to look for."),
      type: z.enum(["image", "audio"]).optional().describe("Default image."),
      count: z.number().int().min(1).max(50).optional().describe("How many results. Default 10."),
      anyLicense: z
        .boolean()
        .optional()
        .describe("Include licences that don't allow commercial use."),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: (ctx, input) => runAssetSearch(ctx, input),
  }),
  define({
    name: "asset_add",
    group: "agent",
    summary: "Bring an image, sound or video into assets/ with its credit",
    description:
      "If your own tools can fetch images, use them first, then add the file here so it's credited. Copies an address, a local file or an Openverse result into assets/, checks that it opens, and records its source, page, licence and author in assets/credits.json. Returns the import line for a composition. Files over 100 MB are refused; bring footage in with footage_add instead.",
    input: z
      .object({
        from: z.string().min(1).optional().describe("An address or a file path."),
        openverse: z
          .string()
          .min(1)
          .optional()
          .describe('An asset_search result, like "image:<id>".'),
        name: z
          .string()
          .min(1)
          .optional()
          .describe("What to call the file. Default from its title or address."),
        license: z.string().min(1).optional().describe("Its licence, when you know it."),
        author: z.string().min(1).optional(),
        page: z.string().min(1).optional().describe("The page it was found on."),
        title: z.string().min(1).optional(),
      })
      .refine((v) => v.from !== undefined || v.openverse !== undefined, {
        message: "asset_add needs from or openverse.",
      }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (ctx, input) => runAssetAdd(ctx, input),
  }),
  define({
    name: "assets",
    group: "agent",
    summary: "List the assets brought in, with their credits",
    description:
      "List every file in assets/credits.json with its kind, licence, author and source, to reuse what's there and to build a credits card.",
    input: z.object({}),
    annotations: { readOnlyHint: true },
    run: runAssets,
  }),
  define({
    name: "page_shot",
    group: "agent",
    summary: "A screenshot of a web page, kept as a credited asset",
    description:
      "If your own tools can take a screenshot of a page, use them first, then add the file with asset_add. Otherwise this opens the page in the installed Chrome, Chromium or Edge, headless, at a window size, and keeps the screenshot in assets/ with the page as its credit. Returns the image. A tall window captures a long page. Cookie banners and logins show as they would to a new visitor.",
    input: z.object({
      url: z.string().url().describe("The page, an http or https address."),
      width: z.number().int().min(200).max(4000).optional().describe("Window width. Default 1280."),
      height: z
        .number()
        .int()
        .min(200)
        .max(16000)
        .optional()
        .describe("Window height. Default 800."),
      name: z
        .string()
        .min(1)
        .optional()
        .describe("What to call the file. Default from the address."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: runPageShot,
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
