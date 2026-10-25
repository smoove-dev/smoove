/**
 * `models`: what local transcription needs, installed once per machine into
 * a shared cache, and only when asked: the sherpa-onnx runtime from npm and
 * NVIDIA's Parakeet model, each file checked against its pinned hash.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CACHE_DIR_ENV } from "@smoove/agent";
import { type CommandResult, type RunContext, spell } from "../commands.js";
import { MediaError } from "../media/cache.js";
import { alive } from "../project.js";
import { done, fail } from "../run.js";

export function cacheDir(env: NodeJS.ProcessEnv): string {
  return env[CACHE_DIR_ENV] || join(homedir(), ".cache", "smoove");
}

/** Newest release with prebuilt builds for macOS, Linux and Windows. */
export const RUNTIME = { package: "sherpa-onnx-node", version: "1.13.8" } as const;

export function runtimeDir(dir: string): string {
  return join(dir, "runtime", `sherpa-${RUNTIME.version}`);
}

export function runtimeInstalled(dir: string): boolean {
  return existsSync(join(runtimeDir(dir), "node_modules", RUNTIME.package, "package.json"));
}

const PARAKEET =
  "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/2bda32ec70b097a55adaa07d9a7173915b43cc78";

/** Single files, not the release tarball: Node can't unpack bzip2. */
export const MODELS = {
  parakeet: {
    title: "NVIDIA Parakeet TDT 0.6B v3 (int8)",
    languages: "en es fr de bg hr cs da nl et fi el hu it lv lt mt pl pt ro sk sl sv ru uk".split(
      " ",
    ),
    files: [
      {
        name: "encoder.int8.onnx",
        url: `${PARAKEET}/encoder.int8.onnx`,
        bytes: 652_184_281,
        sha256: "acfc2b4456377e15d04f0243af540b7fe7c992f8d898d751cf134c3a55fd2247",
      },
      {
        name: "decoder.int8.onnx",
        url: `${PARAKEET}/decoder.int8.onnx`,
        bytes: 11_845_275,
        sha256: "179e50c43d1a9de79c8a24149a2f9bac6eb5981823f2a2ed88d655b24248db4e",
      },
      {
        name: "joiner.int8.onnx",
        url: `${PARAKEET}/joiner.int8.onnx`,
        bytes: 6_355_277,
        sha256: "3164c13fc2821009440d20fcb5fdc78bff28b4db2f8d0f0b329101719c0948b3",
      },
      {
        name: "tokens.txt",
        url: `${PARAKEET}/tokens.txt`,
        bytes: 93_939,
        sha256: "d58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d",
      },
    ],
  },
};

export type ModelName = keyof typeof MODELS;

export function modelDir(dir: string, name: ModelName): string {
  return join(dir, "models", name);
}

/** Every file present at its pinned size. Hashes are checked when downloaded. */
export function modelInstalled(dir: string, name: ModelName): boolean {
  return MODELS[name].files.every(
    (f) => statSync(join(modelDir(dir, name), f.name), { throwIfNoEntry: false })?.size === f.bytes,
  );
}

export const modelBytes = (name: ModelName) => MODELS[name].files.reduce((a, f) => a + f.bytes, 0);
export const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

export interface ModelEntry {
  name: string;
  title: string;
  installed: boolean;
  bytes: number;
  languages: string[];
}

export function modelStatus(dir: string): ModelEntry[] {
  return [
    {
      name: RUNTIME.package,
      title: `sherpa-onnx ${RUNTIME.version}, the runtime that runs the model`,
      installed: runtimeInstalled(dir),
      bytes: 0,
      languages: [],
    },
    ...(Object.keys(MODELS) as ModelName[]).map((name) => ({
      name,
      title: MODELS[name].title,
      installed: modelInstalled(dir, name),
      bytes: modelBytes(name),
      languages: MODELS[name].languages,
    })),
  ];
}

function npmInstall(dir: string): Promise<void> {
  const prefix = runtimeDir(dir);
  mkdirSync(prefix, { recursive: true });
  const win = process.platform === "win32";
  return new Promise((resolve, reject) => {
    const child = spawn(
      win ? "npm.cmd" : "npm",
      [
        "install",
        "--prefix",
        prefix,
        "--no-save",
        "--no-audit",
        "--no-fund",
        `${RUNTIME.package}@${RUNTIME.version}`,
      ],
      { stdio: "ignore", shell: win },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new MediaError(
              "media-error",
              `npm couldn't install ${RUNTIME.package}@${RUNTIME.version} (exit ${code}).`,
            ),
          ),
    );
  });
}

/** Install the runtime and `name`'s files. Each download is hashed before it's kept. */
export async function installModel(
  dir: string,
  name: ModelName,
  progress: (share: number, message: string) => void,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!runtimeInstalled(dir)) {
    progress(0, `Installing ${RUNTIME.package} ${RUNTIME.version}`);
    await npmInstall(dir);
  }
  const target = modelDir(dir, name);
  mkdirSync(target, { recursive: true });
  const total = modelBytes(name);
  let doneBytes = 0;
  let lastPct = -1;
  for (const file of MODELS[name].files) {
    const final = join(target, file.name);
    if (statSync(final, { throwIfNoEntry: false })?.size === file.bytes) {
      doneBytes += file.bytes;
      continue;
    }
    const part = `${final}.part`;
    const res = await fetcher(file.url);
    if (!res.ok || !res.body) {
      throw new MediaError(
        "media-error",
        `Couldn't download ${file.name} (HTTP ${res.status}). Check the network and try again.`,
      );
    }
    const hash = createHash("sha256");
    let got = 0;
    const body = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream<Uint8Array>);
    body.on("data", (chunk: Buffer) => {
      hash.update(chunk);
      got += chunk.length;
      // Once a percent: a download arrives in thousands of chunks.
      const pct = Math.floor(((doneBytes + got) / total) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        progress((doneBytes + got) / total, `Downloading ${file.name}, ${pct} percent`);
      }
    });
    try {
      await pipeline(body, createWriteStream(part));
    } catch (err) {
      rmSync(part, { force: true });
      throw err;
    }
    if (got !== file.bytes || hash.digest("hex") !== file.sha256) {
      rmSync(part, { force: true });
      throw new MediaError(
        "media-error",
        `${file.name} didn't match its pinned size and hash, so it was thrown away. Try again.`,
      );
    }
    renameSync(part, final);
    doneBytes += file.bytes;
  }
  progress(1, `Installed ${name}`);
}

const installs = new Map<string, { promise: Promise<void>; share: number; message: string }>();
const lockFile = (dir: string, name: ModelName) => join(modelDir(dir, name), ".install.lock");

/** How a running install in this process is going, or null. */
export function installProgress(
  dir: string,
  name: ModelName,
): { share: number; message: string } | null {
  const state = installs.get(`${dir}\0${name}`);
  return state ? { share: state.share, message: state.message } : null;
}

/**
 * Install `name`, once: a second call in this process shares the first one's
 * download, and a lock file keeps another process from writing the same files.
 */
export function startInstall(
  dir: string,
  name: ModelName,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const key = `${dir}\0${name}`;
  const running = installs.get(key);
  if (running) return running.promise;
  const lock = lockFile(dir, name);
  const holder = Number(existsSync(lock) ? readFileSync(lock, "utf8").trim() : 0);
  if (holder && holder !== process.pid && alive(holder)) {
    return Promise.reject(
      new MediaError(
        "media-error",
        `${name} is being installed by another process (${holder}). Run models again in a while to see when it's done.`,
      ),
    );
  }
  mkdirSync(modelDir(dir, name), { recursive: true });
  writeFileSync(lock, String(process.pid));
  const state = { share: 0, message: "Starting", promise: Promise.resolve() };
  state.promise = installModel(
    dir,
    name,
    (share, message) => {
      state.share = share;
      state.message = message;
    },
    fetcher,
  ).finally(() => {
    installs.delete(key);
    rmSync(lock, { force: true });
  });
  installs.set(key, state);
  return state.promise;
}

export function runModels(
  ctx: RunContext,
  input: { install?: ModelName },
  fetcher: typeof fetch = fetch,
): Promise<CommandResult> {
  return (async () => {
    const dir = cacheDir(ctx.env);
    if (input.install) {
      const name = input.install;
      const install = startInstall(dir, name, fetcher);
      // The work goes on in the background when this call hands back.
      install.catch(() => {});
      const started = Date.now();
      let settled = false;
      void install.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      while (!settled) {
        if (ctx.maxWaitMs !== undefined && Date.now() - started >= ctx.maxWaitMs) {
          const p = installProgress(dir, name);
          return done({ installing: name }, [
            `Still installing ${name}: ${Math.round((p?.share ?? 0) * 100)} percent (${p?.message ?? "starting"}). It goes on in the background; run models again to see how it's going.`,
          ]);
        }
        await Promise.race([install.catch(() => {}), new Promise((r) => setTimeout(r, 250))]);
        const p = installProgress(dir, name);
        if (p)
          ctx.progress?.({ progress: Math.round(p.share * 100), total: 100, message: p.message });
      }
      await install;
    }
    const status = modelStatus(dir);
    const installing = (name: string) => {
      const p = name in MODELS ? installProgress(dir, name as ModelName) : null;
      return p ? `installing, ${Math.round(p.share * 100)} percent` : null;
    };
    const lines = status.map(
      (s) =>
        `${s.name}: ${s.installed ? "installed" : (installing(s.name) ?? "not installed")}${s.bytes ? `, ${megabytes(s.bytes)}` : ""}. ${s.title}${s.languages.length ? `. Languages: ${s.languages.join(" ")}` : ""}.`,
    );
    if (!status.every((s) => s.installed)) {
      lines.push(
        `To transcribe on this machine, ask the user first, then run ${spell(ctx, "models")} with install parakeet: about ${megabytes(modelBytes("parakeet"))} for the model, plus the sherpa-onnx runtime from npm, once per machine, into ${dir}.`,
      );
    }
    return done({ dir, models: status }, lines);
  })().catch((err) => {
    if (err instanceof MediaError) return fail(err.code, err.message);
    throw err;
  });
}
