import { type ChildProcess, spawn } from "node:child_process";
import { accessSync, constants, mkdirSync, rmSync } from "node:fs";
import { delimiter, join } from "node:path";

/** A running headless browser the bridge launched. */
export interface LaunchedBrowser {
  /** Resolves when the browser process exits, for any reason. */
  readonly exited: Promise<void>;
  /** Stop the browser and remove its profile folder. */
  close(): void;
}

/** Opens `url` in a headless browser. Throws `NoBrowserError` when there's none to open. */
export type BrowserLauncher = (url: string) => LaunchedBrowser;

export class NoBrowserError extends Error {}

/** The environment variable that points at a browser binary. */
export const BROWSER_ENV = "SMOOVE_BROWSER";

const MAC_APPS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
];

const PATH_NAMES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
  "microsoft-edge-stable",
  "chrome",
];

function executable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * The browser to launch: `SMOOVE_BROWSER` if set (and only it, so a wrong
 * value fails loudly), then the usual macOS install paths, then Chrome,
 * Chromium and Edge on the `PATH`. Null when none is found.
 */
export function findBrowser(env: NodeJS.ProcessEnv = process.env): string | null {
  const forced = env[BROWSER_ENV];
  if (forced) return executable(forced) ? forced : null;
  if (process.platform === "darwin") {
    for (const app of MAC_APPS) if (executable(app)) return app;
  }
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const name of PATH_NAMES) {
      const file = join(dir, name);
      if (executable(file)) return file;
    }
  }
  return null;
}

function removeProfile(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best effort; the next launch clears it too.
  }
}

/**
 * The default launcher: an installed Chrome, Chromium or Edge in its new
 * headless mode, with a throwaway profile under `profileDir`. Nothing drives
 * it remotely; the studio page connects itself to the bridge.
 */
export function chromeLauncher(profileDir: string): BrowserLauncher {
  return (url) => {
    const binary = findBrowser();
    if (!binary) {
      throw new NoBrowserError(
        process.env[BROWSER_ENV]
          ? `${BROWSER_ENV} is set to "${process.env[BROWSER_ENV]}", which isn't a browser that can run.`
          : "No Chrome, Chromium or Edge is installed where smoove looks for one.",
      );
    }
    rmSync(profileDir, { recursive: true, force: true });
    mkdirSync(profileDir, { recursive: true });
    const child: ChildProcess = spawn(
      binary,
      [
        "--headless=new",
        `--user-data-dir=${profileDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--mute-audio",
        "--hide-scrollbars",
        "--window-size=1920,1080",
        "--autoplay-policy=no-user-gesture-required",
        // A headless page is never in front; keep its timers and decoders awake.
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        url,
      ],
      { stdio: "ignore" },
    );
    const exited = new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.once("error", () => resolve());
    });
    let closed = false;
    return {
      exited,
      close() {
        if (closed) return;
        closed = true;
        if (child.exitCode == null && child.signalCode == null) child.kill("SIGKILL");
        // Now, in case the dev server itself is exiting and never sees the exit
        // event; and again once Chrome is gone, since it may still be writing.
        removeProfile(profileDir);
        void exited.then(() => removeProfile(profileDir));
      },
    };
  };
}

/**
 * A screenshot of `url` at a window size, from the installed browser's own
 * screenshot flag: no remote control, no dev server. Resolves once the file is
 * written; the profile folder is removed either way.
 */
export function captureScreenshot(
  url: string,
  opts: {
    out: string;
    width: number;
    height: number;
    profileDir: string;
    /** How long the page gets to load and settle. Default 5 seconds. */
    waitMs?: number;
    /** Give up after this long. Default 30 seconds. */
    timeoutMs?: number;
  },
): Promise<void> {
  const binary = findBrowser();
  if (!binary) {
    return Promise.reject(
      new NoBrowserError(
        process.env[BROWSER_ENV]
          ? `${BROWSER_ENV} is set to "${process.env[BROWSER_ENV]}", which isn't a browser that can run.`
          : "No Chrome, Chromium or Edge is installed where smoove looks for one.",
      ),
    );
  }
  rmSync(opts.profileDir, { recursive: true, force: true });
  mkdirSync(opts.profileDir, { recursive: true });
  rmSync(opts.out, { force: true });
  const child = spawn(
    binary,
    [
      "--headless=new",
      `--user-data-dir=${opts.profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--mute-audio",
      `--window-size=${opts.width},${opts.height}`,
      `--virtual-time-budget=${opts.waitMs ?? 5000}`,
      `--screenshot=${opts.out}`,
      url,
    ],
    { stdio: "ignore" },
  );
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`The browser didn't finish the screenshot of ${url} in time.`));
    }, opts.timeoutMs ?? 30_000);
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      removeProfile(opts.profileDir);
      if (err) reject(err);
      else resolve();
    };
    child.once("error", (err) => finish(err));
    child.once("exit", () => {
      try {
        accessSync(opts.out, constants.R_OK);
        finish();
      } catch {
        finish(new Error(`The browser closed without writing a screenshot of ${url}.`));
      }
    });
  });
}
