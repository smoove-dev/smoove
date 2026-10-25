/**
 * Openverse: Creative Commons images and sounds, searchable with no key. Each
 * hit carries the licence and author a credit needs.
 */
import type { CommandResult, RunContext } from "../commands.js";
import { MediaError } from "../media/cache.js";
import { done, fail } from "../run.js";

const API = "https://api.openverse.org/v1";

export type OpenverseType = "image" | "audio";

export interface OpenverseHit {
  id: string;
  type: OpenverseType;
  title: string;
  url: string;
  preview: string | null;
  width?: number;
  height?: number;
  /** Like "CC BY 4.0". */
  license: string;
  author: string | null;
  /** The page the file was found on. */
  page: string | null;
}

type Raw = {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  thumbnail?: unknown;
  creator?: unknown;
  license?: unknown;
  license_version?: unknown;
  foreign_landing_url?: unknown;
  width?: unknown;
  height?: unknown;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** "by", "4.0" as "CC BY 4.0"; the public domain tools by their names. */
export function licenseName(license: unknown, version: unknown): string {
  const l = str(license)?.toLowerCase() ?? "unknown";
  const v = str(version);
  const name = l === "cc0" ? "CC0" : l === "pdm" ? "Public Domain Mark" : `CC ${l.toUpperCase()}`;
  return v ? `${name} ${v}` : name;
}

function toHit(raw: Raw, type: OpenverseType): OpenverseHit | null {
  const id = str(raw.id);
  const url = str(raw.url);
  if (!id || !url) return null;
  const hit: OpenverseHit = {
    id,
    type,
    title: str(raw.title) ?? id,
    url,
    preview: str(raw.thumbnail),
    license: licenseName(raw.license, raw.license_version),
    author: str(raw.creator),
    page: str(raw.foreign_landing_url),
  };
  if (typeof raw.width === "number") hit.width = raw.width;
  if (typeof raw.height === "number") hit.height = raw.height;
  return hit;
}

const path = (type: OpenverseType) => (type === "image" ? "images" : "audio");

async function getJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new MediaError(
      "media-error",
      `Openverse couldn't be reached: ${err instanceof Error ? err.message : String(err)}.`,
    );
  }
  if (!res.ok) throw new MediaError("media-error", `Openverse answered ${res.status} for ${url}.`);
  return res.json();
}

export async function searchOpenverse(
  q: { query: string; type: OpenverseType; count: number; anyLicense: boolean },
  fetcher: typeof fetch = fetch,
): Promise<OpenverseHit[]> {
  const params = new URLSearchParams({ q: q.query, page_size: String(q.count) });
  if (!q.anyLicense) params.set("license_type", "commercial");
  const data = (await getJson(`${API}/${path(q.type)}/?${params}`, fetcher)) as { results?: Raw[] };
  return (data.results ?? []).map((r) => toHit(r, q.type)).filter((h) => h !== null);
}

export async function openverseById(
  type: OpenverseType,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<OpenverseHit> {
  const hit = toHit(
    (await getJson(`${API}/${path(type)}/${encodeURIComponent(id)}/`, fetcher)) as Raw,
    type,
  );
  if (!hit) throw new MediaError("not-found", `Openverse has no ${type} with id ${id}.`);
  return hit;
}

export function runAssetSearch(
  _ctx: RunContext,
  input: { query: string; type?: OpenverseType; count?: number; anyLicense?: boolean },
  fetcher: typeof fetch = fetch,
): Promise<CommandResult> {
  return (async () => {
    const type = input.type ?? "image";
    const hits = await searchOpenverse(
      { query: input.query, type, count: input.count ?? 10, anyLicense: input.anyLicense ?? false },
      fetcher,
    );
    if (hits.length === 0) {
      return done(
        [],
        [
          `Openverse has no ${type} for "${input.query}"${input.anyLicense ? "" : " under a licence that allows commercial use"}.`,
        ],
      );
    }
    return done(hits, [
      ...hits.map(
        (h) =>
          `${h.type}:${h.id}: "${h.title}", ${h.license}${h.author ? `, by ${h.author}` : ""}${h.width ? `, ${h.width} by ${h.height}` : ""}. Preview: ${h.preview ?? h.url}`,
      ),
      "Add one with asset_add and openverse set to its id, like image:<id>, and the credit is filled in.",
    ]);
  })().catch((err) => {
    if (err instanceof MediaError) return fail(err.code, err.message);
    throw err;
  });
}
