import type { EditorToolContext } from "./context.js";

export type ReadFileInput = { path: string };
export type WriteFileInput = { path: string; content: string };
export type EditFileInput = { path: string; oldString: string; newString: string };

/** Read a project file. Plain function — callable directly, no LLM required. */
export function readFile(ctx: EditorToolContext, input: ReadFileInput): Promise<string> {
  return ctx.project.read(input.path);
}

/** Create or overwrite a project file. Plain function. */
export async function writeFile(
  ctx: EditorToolContext,
  input: WriteFileInput,
): Promise<{ path: string; bytes: number }> {
  await ctx.project.write(input.path, input.content);
  return { path: input.path, bytes: Buffer.byteLength(input.content, "utf8") };
}

/** Replace a unique string in a project file. Plain function. */
export async function editFile(
  ctx: EditorToolContext,
  input: EditFileInput,
): Promise<{ path: string; ok: true }> {
  await ctx.project.edit(input.path, input.oldString, input.newString);
  return { path: input.path, ok: true };
}
