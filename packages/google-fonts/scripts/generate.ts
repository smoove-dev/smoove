/**
 * Generates one typed `Font` subclass per Google font family into `src/fonts/`,
 * plus `src/manifest.ts`. Run by maintainers/CI:
 *
 *   GOOGLE_FONTS_API_KEY=… node --experimental-strip-types scripts/generate.ts
 *
 * The family catalog comes from the Google Webfonts Developer API (needs a free
 * key). Per-subset woff2 URLs come from the Google CSS2 API (no key) — one
 * request per family, throttled — because the Developer API only returns a
 * single full file per variant, with no per-subset breakdown. Each generated
 * module groups faces by subset; the runtime loads one subset (default "latin").
 *
 * Offline/CI: set GOOGLE_FONTS_FIXTURE=<json> to a catalog file (the Developer
 * API shape) to skip the key; CSS2 is still fetched live per family.
 * See doc/google-fonts-package-plan.md.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type WebfontItem = { family: string; variants: string[]; subsets: string[] };
type WebfontResponse = { items: WebfontItem[] };
type Face = { weight: string; style: "normal" | "italic" };
/** subset → (variant `"<weight>-<style>"` → woff2 URL). */
type SubsetFaces = Record<string, Record<string, string>>;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONTS_DIR = path.join(ROOT, "src", "fonts");
const MANIFEST = path.join(ROOT, "src", "manifest.ts");

// A desktop UA makes the CSS2 API return woff2 with per-subset @font-face blocks.
const CSS_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const CONCURRENCY = 16;

const API_KEY = process.env.GOOGLE_FONTS_API_KEY;
const FIXTURE = process.env.GOOGLE_FONTS_FIXTURE;
if (!API_KEY && !FIXTURE) {
  console.error(
    "GOOGLE_FONTS_API_KEY is required (a free Google Cloud API key with the Web Fonts Developer API enabled).\n" +
      "Set it in packages/google-fonts/.env (see .env.example) or pass it inline: GOOGLE_FONTS_API_KEY=… pnpm generate",
  );
  process.exit(1);
}

async function fetchCatalog(): Promise<WebfontResponse> {
  if (FIXTURE) return JSON.parse(await readFile(FIXTURE, "utf8")) as WebfontResponse;
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?capability=WOFF2&sort=alpha&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Webfonts API request failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  return (await res.json()) as WebfontResponse;
}

/** "regular" → 400/normal, "italic" → 400/italic, "700" → 700/normal, "700italic" → 700/italic. */
function parseVariant(variant: string): Face | null {
  if (variant === "regular") return { weight: "400", style: "normal" };
  if (variant === "italic") return { weight: "400", style: "italic" };
  const m = variant.match(/^(\d+)(italic)?$/);
  if (m?.[1]) return { weight: m[1], style: m[2] ? "italic" : "normal" };
  return null;
}

/** Build the CSS2 request URL covering every (italic, weight) tuple the family ships. */
function css2Url(family: string, variants: string[]): string | null {
  const tuples: [number, number][] = [];
  for (const v of variants) {
    const f = parseVariant(v);
    if (f) tuples.push([f.style === "italic" ? 1 : 0, Number(f.weight)]);
  }
  if (tuples.length === 0) return null;
  tuples.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const axis = tuples.map((t) => `${t[0]},${t[1]}`).join(";");
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:ital,wght@${axis}&display=swap`;
}

/** Parse a CSS2 response into subset → variant → woff2 URL. */
function parseCss2(css: string): SubsetFaces {
  const out: SubsetFaces = {};
  let subset = "latin";
  let weight = "400";
  let style = "normal";
  for (const line of css.split("\n")) {
    const cm = line.match(/\/\*\s*([a-z0-9-]+)\s*\*\//i);
    if (cm?.[1]) subset = cm[1];
    const sm = line.match(/font-style:\s*(\w+)/);
    if (sm?.[1]) style = sm[1];
    const wm = line.match(/font-weight:\s*(\d+)/);
    if (wm?.[1]) weight = wm[1];
    const um = line.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (um?.[1]) {
      let bucket = out[subset];
      if (!bucket) {
        bucket = {};
        out[subset] = bucket;
      }
      bucket[`${weight}-${style}`] = um[1];
    }
  }
  return out;
}

async function fetchSubsetFaces(item: WebfontItem): Promise<SubsetFaces | null> {
  const url = css2Url(item.family, item.variants);
  if (!url) return null;
  const res = await fetch(url, { headers: { "User-Agent": CSS_UA } });
  if (!res.ok) {
    console.warn(`  ! CSS2 failed for "${item.family}": ${res.status}`);
    return null;
  }
  const faces = parseCss2(await res.text());
  return Object.keys(faces).length > 0 ? faces : null;
}

/** "Noto Sans JP" → "noto-sans-jp". */
function toSlug(family: string): string {
  return family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "DM Sans" → "DMSans", "Press Start 2P" → "PressStart2P". */
function toClassName(family: string): string {
  const pascal = family
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return /^[0-9]/.test(pascal) ? `Font${pascal}` : pascal;
}

function uniqueSortedWeights(faces: SubsetFaces): string[] {
  const set = new Set<string>();
  for (const variants of Object.values(faces))
    for (const k of Object.keys(variants)) set.add(k.split("-")[0] as string);
  return [...set].sort((a, b) => Number(a) - Number(b));
}

function uniqueStyles(faces: SubsetFaces): string[] {
  const set = new Set<string>();
  for (const variants of Object.values(faces))
    for (const k of Object.keys(variants)) set.add(k.split("-")[1] as string);
  return [...set].sort();
}

function quote(s: string): string {
  return JSON.stringify(s);
}

function renderFontModule(family: string, faces: SubsetFaces) {
  const className = toClassName(family);
  const subsets = Object.keys(faces).sort();
  const weights = uniqueSortedWeights(faces);
  const styles = uniqueStyles(faces);

  const facesBody = subsets
    .map((sub) => {
      const variants = faces[sub] as Record<string, string>;
      const rows = Object.keys(variants)
        .sort()
        .map((v) => `    ${quote(v)}: ${quote(variants[v] as string)},`)
        .join("\n");
      return `  ${quote(sub)}: {\n${rows}\n  },`;
    })
    .join("\n");

  const code = `// AUTO-GENERATED by scripts/generate.ts — do not edit.
import { GoogleFont, type GoogleFontOptions } from "../runtime.js";

const FAMILY = ${quote(family)};

const FACES = {
${facesBody}
} as const;

export type ${className}Weight = ${weights.map(quote).join(" | ")};
export type ${className}Style = ${styles.map(quote).join(" | ")};
export type ${className}Subset = ${subsets.map(quote).join(" | ")};
export type ${className}Options = GoogleFontOptions<${className}Weight, ${className}Style, ${className}Subset>;

/**
 * ${family} — Google font. Pass \`weights\`/\`styles\` to register a subset of
 * faces (omit for all) and \`subset\` to choose the character set (default "latin").
 */
export default class ${className} extends GoogleFont<${className}Weight, ${className}Style, ${className}Subset> {
  constructor(options?: ${className}Options) {
    super(FAMILY, FACES, options);
  }
}
`;
  return { slug: toSlug(family), family, weights, styles, subsets, code };
}

function renderManifest(
  entries: {
    slug: string;
    family: string;
    weights: string[];
    styles: string[];
    subsets: string[];
  }[],
): string {
  const rows = entries
    .map(
      (e) =>
        `  { slug: ${quote(e.slug)}, family: ${quote(e.family)}, weights: [${e.weights.map(quote).join(", ")}], styles: [${e.styles.map(quote).join(", ")}], subsets: [${e.subsets.map(quote).join(", ")}] },`,
    )
    .join("\n");
  return `// AUTO-GENERATED by scripts/generate.ts — do not edit.

/** Metadata for every generated family. NOT a font barrel — importing this does
    not pull any font module, so per-font tree-shaking is preserved. */
export interface GoogleFontInfo {
  /** Import slug: \`@konva-motion/google-fonts/<slug>\`. */
  slug: string;
  family: string;
  weights: string[];
  styles: string[];
  subsets: string[];
}

export const fonts: GoogleFontInfo[] = [
${rows}
];
`;
}

/** Run `worker` over `items` with bounded concurrency, preserving order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i] as T, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main(): Promise<void> {
  console.log(FIXTURE ? `Reading fixture ${FIXTURE}…` : "Fetching Google Fonts catalog…");
  const data = await fetchCatalog();
  console.log(`Catalog: ${data.items.length} families. Fetching per-subset URLs…`);

  await rm(FONTS_DIR, { recursive: true, force: true });
  await mkdir(FONTS_DIR, { recursive: true });

  const seenSlugs = new Map<string, string>();
  const manifest: {
    slug: string;
    family: string;
    weights: string[];
    styles: string[];
    subsets: string[];
  }[] = [];
  let written = 0;
  let skipped = 0;

  const mods = await mapLimit(data.items, CONCURRENCY, async (item) => {
    const faces = await fetchSubsetFaces(item);
    return faces ? renderFontModule(item.family, faces) : null;
  });

  for (const mod of mods) {
    if (!mod) {
      skipped++;
      continue;
    }
    const prior = seenSlugs.get(mod.slug);
    if (prior) {
      console.error(
        `Slug collision: "${mod.slug}" from both "${prior}" and "${mod.family}". Aborting.`,
      );
      process.exit(1);
    }
    seenSlugs.set(mod.slug, mod.family);
    await writeFile(path.join(FONTS_DIR, `${mod.slug}.ts`), mod.code, "utf8");
    manifest.push({
      slug: mod.slug,
      family: mod.family,
      weights: mod.weights,
      styles: mod.styles,
      subsets: mod.subsets,
    });
    written++;
  }

  manifest.sort((a, b) => a.slug.localeCompare(b.slug));
  await writeFile(MANIFEST, renderManifest(manifest), "utf8");

  console.log(
    `Wrote ${written} font modules${skipped ? ` (skipped ${skipped} with no usable faces)` : ""}.`,
  );
  console.log(`Wrote manifest with ${manifest.length} entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
