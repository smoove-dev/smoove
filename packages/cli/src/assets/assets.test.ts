import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetRecord } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { addAsset, runAssetAdd } from "./add.js";
import { runAssets } from "./ledger.js";
import { runAssetSearch, searchOpenverse } from "./openverse.js";

let project: ReturnType<typeof tempProject>;
let png: Buffer;

beforeEach(async () => {
  project = tempProject();
  const { Canvas } = await import("skia-canvas");
  const c = new Canvas(40, 30);
  const g = c.getContext("2d");
  g.fillStyle = "#3080ff";
  g.fillRect(0, 0, 40, 30);
  png = await c.toBuffer("png");
});

afterEach(() => project.remove());

const ctx = (): RunContext => ({ cwd: project.root, env: {}, sleep: async () => {}, door: "mcp" });

/** A fetch that answers from a table of URL prefixes, and records what it was asked. */
function fakeFetch(routes: Record<string, () => Response>, asked: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    asked.push(url);
    const hit = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    return hit ? (routes[hit] as () => Response)() : new Response("missing", { status: 404 });
  }) as typeof fetch;
}

const image = () => new Response(png, { headers: { "Content-Type": "image/png" } });
const hit = {
  id: "abc-123",
  title: "Heat pump outside a house",
  url: "https://img.example/heat.png",
  thumbnail: "https://api.openverse.org/v1/images/abc-123/thumb/",
  creator: "Dana",
  license: "by",
  license_version: "4.0",
  foreign_landing_url: "https://flickr.example/photo/1",
  width: 40,
  height: 30,
};

const credits = () =>
  JSON.parse(readFileSync(join(project.root, "assets/credits.json"), "utf8")) as AssetRecord[];

describe("asset_search", () => {
  it("searches with a commercial licence filter by default", async () => {
    const asked: string[] = [];
    const hits = await searchOpenverse(
      { query: "heat pump", type: "image", count: 5, anyLicense: false },
      fakeFetch(
        { "https://api.openverse.org/v1/images/": () => Response.json({ results: [hit] }) },
        asked,
      ),
    );
    expect(asked[0]).toContain("license_type=commercial");
    expect(asked[0]).toContain("q=heat+pump");
    expect(hits[0]).toMatchObject({ id: "abc-123", license: "CC BY 4.0", author: "Dana" });
  });

  it("lists each hit with the id asset_add takes", async () => {
    const result = await runAssetSearch(
      ctx(),
      { query: "heat pump" },
      fakeFetch({
        "https://api.openverse.org/v1/images/": () => Response.json({ results: [hit] }),
      }),
    );
    expect(result.text).toContain("image:abc-123");
    expect(result.text).toContain("CC BY 4.0");
    expect(result.text).toContain("Dana");
  });

  it("drops the filter when any licence will do", async () => {
    const asked: string[] = [];
    await searchOpenverse(
      { query: "rain", type: "audio", count: 5, anyLicense: true },
      fakeFetch(
        { "https://api.openverse.org/v1/audio/": () => Response.json({ results: [] }) },
        asked,
      ),
    );
    expect(asked[0]).not.toContain("license_type");
  });
});

describe("asset_add", () => {
  it("adds an Openverse image with its credit filled in", async () => {
    const f = fakeFetch({
      "https://api.openverse.org/v1/images/abc-123/": () => Response.json(hit),
      "https://img.example/heat.png": image,
    });
    const added = await addAsset(
      project.root,
      { openverse: { type: "image", id: "abc-123" } },
      {},
      f,
    );
    expect(added.record).toMatchObject({
      file: "assets/heat-pump-outside-a-house.png",
      kind: "image",
      title: "Heat pump outside a house",
      author: "Dana",
      license: "CC BY 4.0",
      page: "https://flickr.example/photo/1",
    });
    expect(added).toMatchObject({ width: 40, height: 30 });
    expect(credits()).toHaveLength(1);
  });

  it("records unknowns as null", async () => {
    const added = await addAsset(
      project.root,
      { url: "https://img.example/a.png" },
      {},
      fakeFetch({ "https://img.example/": image }),
    );
    expect(added.record).toMatchObject({
      file: "assets/a.png",
      license: null,
      author: null,
      page: null,
    });
  });

  it("gives the import line for a composition", async () => {
    const added = await addAsset(
      project.root,
      { url: "https://img.example/heat-pump.png" },
      {},
      fakeFetch({ "https://img.example/": image }),
    );
    expect(added.importLine).toBe('import heatPump from "../../assets/heat-pump.png";');
  });

  it("names a file by its content type when the address ends in a script", async () => {
    const added = await addAsset(
      project.root,
      { url: "https://img.example/render.php?id=7" },
      {},
      fakeFetch({ "https://img.example/": image }),
    );
    expect(added.record.file).toBe("assets/render.png");
    expect(added.record.kind).toBe("image");
  });

  it("refuses an HTML page saved as an image", async () => {
    const page = () =>
      new Response("<html>nope</html>", { headers: { "Content-Type": "text/html" } });
    await expect(
      addAsset(
        project.root,
        { url: "https://img.example/a.png" },
        {},
        fakeFetch({ "https://img.example/": page }),
      ),
    ).rejects.toThrow(/text\/html/);
    expect(existsSync(join(project.root, "assets/a.png"))).toBe(false);
  });

  it("refuses a file over the size limit", async () => {
    const big = () =>
      new Response(png, {
        headers: { "Content-Type": "image/png", "Content-Length": String(200 * 1024 * 1024) },
      });
    await expect(
      addAsset(
        project.root,
        { url: "https://img.example/a.png" },
        {},
        fakeFetch({ "https://img.example/": big }),
      ),
    ).rejects.toThrow(/100 MB/);
  });

  it("refuses an image that doesn't decode", async () => {
    const broken = () => new Response("not a png", { headers: { "Content-Type": "image/png" } });
    await expect(
      addAsset(
        project.root,
        { url: "https://img.example/a.png" },
        {},
        fakeFetch({ "https://img.example/": broken }),
      ),
    ).rejects.toThrow(/doesn't open/);
    expect(existsSync(join(project.root, "assets/a.png"))).toBe(false);
  });

  it("never overwrites a different file", async () => {
    const f = fakeFetch({ "https://img.example/": image });
    await addAsset(project.root, { url: "https://img.example/a.png" }, {}, f);
    writeFileSync(join(project.root, "assets/a.png"), Buffer.concat([png, Buffer.from([0])]));
    const second = await addAsset(project.root, { url: "https://img.example/a.png" }, {}, f);
    expect(second.record.file).toBe("assets/a-2.png");
  });

  it("adds a local file too", async () => {
    writeFileSync(join(project.root, "logo.png"), png);
    const result = await runAssetAdd(ctx(), { from: "logo.png", license: "ours" }, fakeFetch({}));
    expect(result.code).toBe(0);
    expect(credits()[0]).toMatchObject({
      file: "assets/logo.png",
      source: "logo.png",
      license: "ours",
    });
  });
});

describe("assets", () => {
  it("lists the ledger", async () => {
    await addAsset(
      project.root,
      { url: "https://img.example/a.png" },
      { license: "CC0 1.0" },
      fakeFetch({ "https://img.example/": image }),
    );
    const result = await runAssets(ctx());
    expect(result.text).toContain("assets/a.png");
    expect(result.text).toContain("CC0 1.0");
  });
});
