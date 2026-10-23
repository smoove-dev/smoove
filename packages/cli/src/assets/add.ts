/**
 * `asset_add`: bring an image, sound or short video into `assets/` from an
 * address, a local file or an Openverse result, check that it opens, and
 * record its credit.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ASSETS_DIR, type AssetRecord } from "@smoove/agent";
import { type CommandResult, type RunContext, UsageError } from "../commands.js";
import { MediaError } from "../media/cache.js";
import { readInfo } from "../media/info.js";
import { loadMedia, runMedia } from "../media/runtime.js";
import { done } from "../run.js";
import { addCredit } from "./ledger.js";
import { type OpenverseType, openverseById } from "./openverse.js";

export const MAX_ASSET_BYTES = 100 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};
const KIND_BY_EXT: Record<string, AssetRecord["kind"]> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".gif": "image",
  ".svg": "image",
  ".mp3": "audio",
  ".wav": "audio",
  ".ogg": "audio",
  ".m4a": "audio",
  ".flac": "audio",
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
};

export type AssetFrom =
  | { url: string }
  | { path: string }
  | { openverse: { type: OpenverseType; id: string } };

export interface AssetMeta {
  name?: string;
  license?: string;
  author?: string;
  page?: string;
  title?: string;
  kind?: AssetRecord["kind"];
  /** Where it came from, when that isn't the file itself (a page shot's page). */
  source?: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "asset";

function camel(stem: string): string {
  const id = stem
    .replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
    .replace(/[^A-Za-z0-9_$]/g, "");
  return /^[A-Za-z_$]/.test(id) ? id : `asset${id}`;
}

async function download(
  url: string,
  fetcher: typeof fetch,
): Promise<{ bytes: Buffer; type: string }> {
  let res: Response;
  try {
    res = await fetcher(url);
  } catch (err) {
    throw new MediaError(
      "media-error",
      `${url} couldn't be reached: ${err instanceof Error ? err.message : String(err)}.`,
    );
  }
  if (!res.ok || !res.body) throw new MediaError("media-error", `${url} answered ${res.status}.`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (type.startsWith("text/")) {
    throw new MediaError(
      "media-error",
      `${url} answered with ${type}, a page rather than a file. Use the address of the file itself.`,
    );
  }
  const length = Number(res.headers.get("content-length") ?? 0);
  const limit = `${MAX_ASSET_BYTES / 1024 / 1024} MB`;
  if (length > MAX_ASSET_BYTES)
    throw new MediaError("media-error", `${url} is over the ${limit} limit for assets.`);
  const chunks: Uint8Array[] = [];
  let got = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    got += chunk.length;
    if (got > MAX_ASSET_BYTES)
      throw new MediaError("media-error", `${url} is over the ${limit} limit for assets.`);
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks), type };
}

/** `assets/<stem><ext>`, the same file when the bytes match, else `<stem>-2<ext>` and on. */
function destination(root: string, stem: string, ext: string, bytes: Buffer): string {
  const hash = (b: Buffer) => createHash("sha1").update(b).digest("hex");
  const mine = hash(bytes);
  for (let n = 1; ; n++) {
    const rel = `${ASSETS_DIR}/${n === 1 ? stem : `${stem}-${n}`}${ext}`;
    const abs = join(root, rel);
    if (!existsSync(abs) || hash(readFileSync(abs)) === mine) return rel;
  }
}

export async function addAsset(
  root: string,
  from: AssetFrom,
  meta: AssetMeta,
  fetcher: typeof fetch = fetch,
): Promise<{ record: AssetRecord; width?: number; height?: number; importLine: string }> {
  let bytes: Buffer;
  let type = "";
  let source: string;
  let given: string;
  const credit: AssetMeta = { ...meta };
  if ("openverse" in from) {
    const hit = await openverseById(from.openverse.type, from.openverse.id, fetcher);
    ({ bytes, type } = await download(hit.url, fetcher));
    source = hit.url;
    given = hit.url;
    credit.title ??= hit.title;
    credit.author ??= hit.author ?? undefined;
    credit.license ??= hit.license;
    credit.page ??= hit.page ?? undefined;
    credit.name ??= hit.title;
    credit.kind ??= hit.type === "audio" ? "audio" : "image";
  } else if ("url" in from) {
    ({ bytes, type } = await download(from.url, fetcher));
    source = from.url;
    given = new URL(from.url).pathname;
  } else {
    const abs = isAbsolute(from.path) ? from.path : join(root, from.path);
    if (!existsSync(abs)) throw new MediaError("not-found", `There's no file at ${from.path}.`);
    bytes = readFileSync(abs);
    if (bytes.length > MAX_ASSET_BYTES)
      throw new MediaError("media-error", `${from.path} is over the 100 MB limit for assets.`);
    source = from.path;
    given = abs;
  }

  // The address's extension when it names a kind of file (not a script like
  // image.php), else the one its content type implies.
  const givenExt = extname(given).toLowerCase();
  const ext = KIND_BY_EXT[givenExt] ? givenExt : (EXT_BY_TYPE[type] ?? givenExt);
  const kind =
    credit.kind ??
    KIND_BY_EXT[ext] ??
    (type.startsWith("audio/") ? "audio" : type.startsWith("video/") ? "video" : "image");
  const stem = slug(credit.name ?? basename(given, extname(given)));
  const rel = destination(root, stem, ext, bytes);
  const abs = join(root, rel);
  const fresh = !existsSync(abs);
  mkdirSync(join(root, ASSETS_DIR), { recursive: true });
  if (fresh) writeFileSync(abs, bytes);

  let width: number | undefined;
  let height: number | undefined;
  try {
    if (kind === "image" || kind === "screenshot") {
      const { skia } = await loadMedia();
      const img = await skia.loadImage(bytes);
      width = img.width;
      height = img.height;
    } else {
      const info = await readInfo(root, rel);
      width = info.width;
      height = info.height;
    }
  } catch {
    if (fresh) rmSync(abs, { force: true });
    throw new MediaError(
      "media-error",
      `${source} doesn't open as ${kind === "audio" ? "audio" : `an ${kind}`}, so it wasn't added.`,
    );
  }

  const record: AssetRecord = {
    file: rel,
    kind,
    source: credit.source ?? source,
    page: credit.page ?? null,
    title: credit.title ?? null,
    license: credit.license ?? null,
    author: credit.author ?? null,
    added: new Date().toISOString().slice(0, 10),
  };
  addCredit(root, record);
  return {
    record,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    importLine: `import ${camel(basename(rel, ext))} from "../../${rel}";`,
  };
}

export interface AssetAddInput {
  from?: string;
  openverse?: string;
  name?: string;
  license?: string;
  author?: string;
  page?: string;
  title?: string;
}

export function runAssetAdd(
  ctx: RunContext,
  input: AssetAddInput,
  fetcher: typeof fetch = fetch,
): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    let from: AssetFrom;
    if (input.openverse) {
      const m = /^(image|audio):(.+)$/.exec(input.openverse);
      if (!m)
        throw new UsageError(
          'openverse takes "image:<id>" or "audio:<id>", from an asset_search result.',
        );
      from = { openverse: { type: m[1] as OpenverseType, id: m[2] as string } };
    } else if (input.from && /^https?:\/\//i.test(input.from)) {
      from = { url: input.from };
    } else if (input.from) {
      const abs = isAbsolute(input.from) ? input.from : resolve(ctx.cwd, input.from);
      const rel = relative(root, abs);
      from = { path: rel.startsWith("..") || isAbsolute(rel) ? abs : rel.split(sep).join("/") };
    } else {
      throw new UsageError(
        "asset_add needs from (an address or a file) or openverse (an asset_search result).",
      );
    }
    const added = await addAsset(root, from, input, fetcher);
    const r = added.record;
    return done(added, [
      r.file,
      `Added ${r.kind}${added.width ? `, ${added.width} by ${added.height}` : ""}. Credit: ${r.license ?? "licence unknown"}${r.author ? `, by ${r.author}` : ""}${r.page ? `, from ${r.page}` : ""}.`,
      `In a composition: ${added.importLine}`,
    ]);
  });
}
