import { afterAll, describe, expect, it } from "vitest";
import { corpus } from "./corpus.js";
import { runCase } from "./harness.js";
import { writeReport } from "./report.js";
import type { CaseResult } from "./types.js";

const results: CaseResult[] = [];

it("has a unique id per case", () => {
  const ids = corpus.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
});

for (const group of [...new Set(corpus.map((c) => c.group))]) {
  describe(group, () => {
    for (const c of corpus.filter((x) => x.group === group)) {
      it(c.title, async () => {
        const result = await runCase(c);
        results.push(result);
        expect(result.failures).toEqual([]);
      });
    }
  });
}

afterAll(async () => {
  await writeReport(results);
});
