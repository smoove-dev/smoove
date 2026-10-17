import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { CaseResult } from "./types.js";

const OUT_DIR = fileURLToPath(new URL("./out/", import.meta.url));

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function card(r: CaseResult): string {
  const rows = Object.entries(r.geometry)
    .map(
      ([name, b]) =>
        `<tr><td><code>.${escapeHtml(name)}</code></td><td>${b.x.toFixed(0)}</td>` +
        `<td>${b.y.toFixed(0)}</td><td>${b.width.toFixed(0)}</td><td>${b.height.toFixed(0)}</td></tr>`,
    )
    .join("");
  const status = r.failures.length > 0 ? "fail" : "pass";
  const divergence = r.case.divergence
    ? `<p class="flag divergence"><strong>Diverges from CSS.</strong> ${escapeHtml(
        r.case.divergence,
      )}</p>`
    : "";
  const failure =
    r.failures.length > 0
      ? `<p class="flag failure"><strong>Fails.</strong> ${escapeHtml(r.failures.join("; "))}</p>`
      : "";
  const width = r.case.size?.[0] ?? 480;
  return `<article class="case ${status}" id="${escapeHtml(r.case.id)}">
  <h3>${escapeHtml(r.case.title)}</h3>
  <p class="note">${escapeHtml(r.case.note)}</p>
  ${divergence}${failure}
  <div class="shot"><img src="${r.png}" alt="${escapeHtml(
    r.case.title,
  )}" width="${width}" loading="lazy"></div>
  <pre><code>${escapeHtml(r.source)}</code></pre>
  <details><summary>Measured geometry</summary>
    <table><thead><tr><th>node</th><th>x</th><th>y</th><th>w</th><th>h</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </details>
</article>`;
}

const GAPS = `<section id="gaps"><h2>Not supported yet</h2>
<p class="lede">flexily, the layout engine underneath smoove, implements every one of these.
smoove does not surface them on <code>FlexProps</code> or <code>FlexChildProps</code>, so they
are the natural candidates for a future release.</p>
<ul class="gaps">
<li><code>flexWrap</code> — multi-line flex containers</li>
<li><code>alignContent</code> — cross-axis distribution of wrapped lines</li>
<li><code>minWidth</code> / <code>maxWidth</code> / <code>minHeight</code> / <code>maxHeight</code> — <code>Text</code> has <code>maxWidth</code> and <code>maxHeight</code> of its own, but flex children do not</li>
<li><code>aspectRatio</code></li>
<li><code>position: absolute</code> with edge offsets</li>
<li>separate row and column gaps — flexily has <code>GUTTER_ROW</code> and <code>GUTTER_COLUMN</code>; smoove always sets <code>GUTTER_ALL</code></li>
<li><code>auto</code> margins</li>
<li>percent <code>flexBasis</code> — <code>flexBasis</code> takes a number only</li>
<li>baseline alignment — <code>alignItems</code> stops at <code>stretch</code></li>
<li><code>order</code> — children lay out in tree order</li>
</ul></section>`;

const CSS = `
:root {
  --bg: #ffffff; --fg: #111827; --muted: #5b6472; --line: #e5e7eb;
  --card: #f9fafb; --code-bg: #f3f4f6; --pass: #2f9e44; --fail: #e03131; --warn: #f08c00;
  --shot-bg: #f3f4f6;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117; --fg: #e6edf3; --muted: #9198a1; --line: #30363d;
    --card: #161b22; --code-bg: #0b0f14; --pass: #7ee787; --fail: #ff7b72; --warn: #f0b429;
    --shot-bg: #0b0f14;
  }
}
:root[data-theme="dark"] {
  --bg: #0d1117; --fg: #e6edf3; --muted: #9198a1; --line: #30363d;
  --card: #161b22; --code-bg: #0b0f14; --pass: #7ee787; --fail: #ff7b72; --warn: #f0b429;
  --shot-bg: #0b0f14;
}
:root[data-theme="light"] {
  --bg: #ffffff; --fg: #111827; --muted: #5b6472; --line: #e5e7eb;
  --card: #f9fafb; --code-bg: #f3f4f6; --pass: #2f9e44; --fail: #e03131; --warn: #f08c00;
  --shot-bg: #f3f4f6;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 40px 24px 80px; background: var(--bg); color: var(--fg);
  font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  overflow-x: hidden;
}
h1, h2, h3, p, ul { color: var(--fg); }
.wrap { max-width: 1240px; margin: 0 auto; }
h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -0.02em; }
h2 {
  font-size: 20px; margin: 56px 0 4px; padding-bottom: 8px;
  border-bottom: 1px solid var(--line); letter-spacing: -0.01em;
}
h3 { font-size: 14px; margin: 0 0 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
p { margin: 0 0 12px; }
.lede { color: var(--muted); max-width: 70ch; }
.summary { color: var(--muted); margin-bottom: 28px; }
.summary strong { color: var(--fg); }
nav { margin: 0 0 8px; }
nav a { color: var(--muted); text-decoration: none; margin-right: 14px; font-size: 13px; }
nav a:hover { color: var(--fg); text-decoration: underline; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; margin-top: 20px; }
.case {
  background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--pass);
  border-radius: 10px; padding: 16px; min-width: 0;
}
.case.fail { border-left-color: var(--fail); }
.note { color: var(--muted); font-size: 13px; }
.flag { font-size: 12.5px; border-radius: 6px; padding: 8px 10px; }
.divergence { background: color-mix(in srgb, var(--warn) 14%, transparent); }
.failure { background: color-mix(in srgb, var(--fail) 14%, transparent); }
.shot { background: var(--shot-bg); border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
.shot img { display: block; width: 100%; height: auto; }
pre {
  background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px;
  padding: 12px; overflow-x: auto; margin: 0 0 10px;
  white-space: pre-wrap; word-break: break-word;
}
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
details summary { cursor: pointer; color: var(--muted); font-size: 12.5px; }
table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; }
th, td { text-align: right; padding: 3px 6px; border-bottom: 1px solid var(--line); }
th:first-child, td:first-child { text-align: left; }
th { color: var(--muted); font-weight: 500; }
ul.gaps { color: var(--muted); max-width: 80ch; padding-left: 20px; }
ul.gaps li { margin-bottom: 6px; }
`;

export async function writeReport(results: CaseResult[]): Promise<void> {
  if (results.length === 0) return;
  const groups = [...new Set(results.map((r) => r.case.group))];
  const passed = results.filter((r) => r.failures.length === 0).length;
  const diverging = results.filter((r) => r.case.divergence).length;

  const nav = groups
    .map((g) => `<a href="#${slug(g)}">${escapeHtml(g)}</a>`)
    .concat('<a href="#gaps">Not supported yet</a>')
    .join("");

  const sections = groups
    .map((g) => {
      const inGroup = results.filter((r) => r.case.group === g);
      return `<section id="${slug(g)}"><h2>${escapeHtml(g)}</h2>
<p class="lede">${inGroup.length} cases.</p>
<div class="grid">${inGroup.map(card).join("")}</div></section>`;
    })
    .join("");

  // A fragment, not a document: it renders standalone in a browser and is also
  // what the artifact host expects (it supplies the document skeleton itself).
  const html = `<style>${CSS}</style>
<div class="wrap">
<h1>smoove layout conformance</h1>
<p class="summary"><strong>${passed} of ${results.length}</strong> cases match CSS flexbox.
${results.length - passed} fail. ${diverging} document a deliberate divergence.
Every example below is a real composition, laid out headlessly and rasterized through the same
skia backend the server renderer uses. The code on each card is the function that produced the
image next to it.</p>
<nav>${nav}</nav>
${sections}
${GAPS}
</div>`;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}report.html`, html, "utf8");
}
