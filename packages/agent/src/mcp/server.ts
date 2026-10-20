/**
 * `smoove mcp`: every `smoove` command as an MCP tool, from the same table
 * the command line runs. Standard output belongs to the protocol, so nothing
 * here prints; a command's text comes back in its result.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { type CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { COMMANDS, type CommandResult, type RunContext, UsageError } from "../cli/commands.js";

type Base = Omit<RunContext, "door" | "progress" | "signal" | "maxWaitMs">;

/** How long `render` waits through MCP before handing back its job id. */
export const RENDER_WAIT_MS = 50_000;
type Content = CallToolResult["content"][number];

/**
 * A command's result as MCP content: its text, inline PNGs, and isError. No
 * structured content: Claude Code shows that to the model in place of the
 * text, which would hand the agent raw JSON instead of the command's words.
 */
export function toToolResult(result: CommandResult): CallToolResult {
  const content: Content[] = [];
  const unread: string[] = [];
  for (const image of result.images) {
    if (!image.inline) continue;
    try {
      content.push({
        type: "image",
        data: readFileSync(image.path).toString("base64"),
        mimeType: "image/png",
      });
    } catch {
      unread.push(`Warning: the image at ${image.path} couldn't be read, so it isn't attached.`);
    }
  }
  const text = [result.text, result.errors, ...unread].filter(Boolean).join("\n");
  content.unshift({ type: "text", text });
  return { content, ...(result.code !== 0 ? { isError: true } : {}) };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** One tool per command, named and typed as the table says. */
export function createMcpServer(base: Base, version: string): McpServer {
  const server = new McpServer({ name: "smoove", version });
  for (const command of COMMANDS) {
    server.registerTool(
      command.name,
      {
        description: command.description,
        inputSchema: command.input,
        annotations: command.annotations,
      },
      async (input: unknown, ctx) => {
        const token = ctx.mcpReq._meta?.progressToken;
        const run: RunContext = {
          ...base,
          door: "mcp",
          signal: ctx.mcpReq.signal,
          // Some clients cut tool calls off after a minute; a longer render hands back its job.
          maxWaitMs: RENDER_WAIT_MS,
          progress:
            token === undefined
              ? undefined
              : (u) => {
                  void ctx.mcpReq
                    .notify({
                      method: "notifications/progress",
                      params: {
                        progressToken: token,
                        progress: u.progress,
                        total: u.total,
                        message: u.message,
                      },
                    })
                    .catch(() => {});
                },
        };
        try {
          return toToolResult(await command.run(run, input as never));
        } catch (err) {
          if (err instanceof UsageError) return errorResult(err.message);
          throw err;
        }
      },
    );
  }
  return server;
}

function packageVersion(): string {
  try {
    return (createRequire(import.meta.url)("../../package.json") as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

/** `smoove mcp`: serve over standard input and output until standard input closes. */
export async function serveStdio(base: Base): Promise<void> {
  const server = createMcpServer(base, packageVersion());
  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => {
    server.server.onclose = () => resolve();
  });
  await server.connect(transport);
  await closed;
}
