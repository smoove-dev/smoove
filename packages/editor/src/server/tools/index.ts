import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { listCompositions } from "./compositions.js";
import type { EditorToolContext } from "./context.js";
import { editFile, readFile, writeFile } from "./files.js";
import { scaffoldComposition } from "./scaffold.js";
import { getTimeline } from "./timeline.js";
import { typecheck } from "./typecheck.js";

/**
 * The opinionated default toolkit: read the project, author into it, and check
 * the work. Every tool here is ALSO exported as a plain function you can call
 * directly — see the package's server barrel.
 *
 * The return type MUST stay annotated `ToolSet`, or tsc leaks unnameable
 * @ai-sdk internals into the emitted .d.ts (TS2883).
 */
export function getDefaultSmooveEditorTools(ctx: EditorToolContext): ToolSet {
  return {
    listCompositions: tool({
      description: "List the compositions in the project, with their size and timing.",
      inputSchema: z.object({}),
      execute: async () => listCompositions(ctx),
    }),

    getTimeline: tool({
      description:
        "Get the active composition's timeline: current frame, fps, total duration, and each sequence's frame range.",
      inputSchema: z.object({}),
      execute: async () => getTimeline(ctx),
    }),

    readFile: tool({
      description: "Read a file from the project, e.g. 'good-job/composition.ts'.",
      inputSchema: z.object({
        path: z.string().describe("Project-relative path."),
      }),
      execute: async (input) => readFile(ctx, input),
    }),

    writeFile: tool({
      description:
        "Create or overwrite a project file with its full contents. To change part of an existing file, prefer editFile.",
      inputSchema: z.object({
        path: z.string().describe("Project-relative path."),
        content: z.string().describe("The complete new contents of the file."),
      }),
      execute: async (input) => writeFile(ctx, input),
    }),

    editFile: tool({
      description:
        "Replace an exact, unique string in a project file. Fails if the string is missing or appears more than once — include surrounding context to make it unique.",
      inputSchema: z.object({
        path: z.string().describe("Project-relative path."),
        oldString: z.string().describe("The exact text to replace. Must appear exactly once."),
        newString: z.string().describe("The replacement text."),
      }),
      execute: async (input) => editFile(ctx, input),
    }),

    scaffoldComposition: tool({
      description:
        "Create a new composition: writes <id>/meta.json and a minimal valid <id>/composition.ts (correct size and clock, empty black stage). Author the motion afterwards with editFile.",
      inputSchema: z.object({
        id: z.string().describe('Lowercase kebab-case id and directory name, e.g. "good-job".'),
        width: z.number().int().positive().describe("Pixels, e.g. 1080."),
        height: z.number().int().positive().describe("Pixels, e.g. 1920."),
        fps: z.number().int().positive().describe("Frames per second, e.g. 30."),
        durationInFrames: z
          .number()
          .int()
          .positive()
          .describe("Total length in frames — seconds x fps."),
        title: z.string().optional(),
        group: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
      execute: async (input) => scaffoldComposition(ctx, input),
    }),

    typecheck: tool({
      description:
        "Typecheck every composition in the project with the TypeScript compiler. Run this after every edit and fix what it reports.",
      inputSchema: z.object({}),
      execute: async () => typecheck(ctx),
    }),
  };
}

export type EditorToolSet = ReturnType<typeof getDefaultSmooveEditorTools>;

export { listCompositions } from "./compositions.js";
export type { EditorToolContext } from "./context.js";
export {
  type EditFileInput,
  editFile,
  type ReadFileInput,
  readFile,
  type WriteFileInput,
  writeFile,
} from "./files.js";
export { scaffoldComposition } from "./scaffold.js";
export { getTimeline } from "./timeline.js";
export { typecheck } from "./typecheck.js";
