// Moves the demo media (video, audio, images, fonts) out of the static build
// and into R2, before `wrangler deploy` uploads the rest.
//
// The build must have run with MEDIA_BASE_URL set, so the demo modules already
// point at `${MEDIA_BASE_URL}/assets/<file>`. This script finds every file
// they reference that way, uploads each to `${R2_BUCKET}/assets/<file>`, and
// deletes the local copy. Names carry a content hash, so uploads never
// overwrite a different file and old deploys keep working.
//
// Needs: MEDIA_BASE_URL, R2_BUCKET, and wrangler credentials
// (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const base = process.env.MEDIA_BASE_URL?.replace(/\/+$/, "");
const bucket = process.env.R2_BUCKET;
if (!base || !bucket) {
  console.error("upload-media: set MEDIA_BASE_URL and R2_BUCKET");
  process.exit(1);
}

const client = join(import.meta.dirname, "../build/client");
const assets = join(client, "assets");

const TYPES = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

// Every `${base}/assets/<file>` the built JavaScript references.
const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = new RegExp(`${escaped}/assets/([^"'\`\\s)]+)`, "g");
const media = new Set();
for (const name of readdirSync(assets)) {
  if (!name.endsWith(".js")) continue;
  for (const match of readFileSync(join(assets, name), "utf8").matchAll(pattern)) {
    media.add(match[1]);
  }
}

if (media.size === 0) {
  console.error(`upload-media: no files reference ${base}; was MEDIA_BASE_URL set at build time?`);
  process.exit(1);
}

for (const name of [...media].sort()) {
  const file = join(assets, name);
  const type = TYPES[extname(name).toLowerCase()] ?? "application/octet-stream";
  console.log(`upload-media: ${name} (${type})`);
  execFileSync(
    "npx",
    [
      "--yes",
      "wrangler@4",
      "r2",
      "object",
      "put",
      `${bucket}/assets/${name}`,
      "--remote",
      `--file=${file}`,
      `--content-type=${type}`,
      "--cache-control=public, max-age=31536000, immutable",
    ],
    { stdio: "inherit" },
  );
  rmSync(file);
}

// Cloudflare refuses static assets over 25 MiB; fail here, with the name,
// rather than halfway through the deploy.
const LIMIT = 25 * 1024 * 1024;
const tooBig = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (statSync(full).size > LIMIT) tooBig.push(full);
  }
};
walk(client);
if (tooBig.length > 0) {
  console.error(`upload-media: files over 25 MiB left in the build:\n${tooBig.join("\n")}`);
  process.exit(1);
}

console.log(`upload-media: moved ${media.size} files to ${bucket}`);
