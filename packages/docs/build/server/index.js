import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { PassThrough } from 'node:stream';
import { createReadableStreamFromReadable } from '@react-router/node';
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter, UNSAFE_withHydrateFallbackProps, UNSAFE_withComponentProps, Outlet, Meta, Links, ScrollRestoration, Scripts, Link, NavLink, useMatches, redirect, UNSAFE_withErrorBoundaryProps, useRouteError, isRouteErrorResponse, data } from 'react-router';
import { useEffect, useState, useRef, useMemo } from 'react';
import matter from 'gray-matter';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import container from 'markdown-it-container';
import kbd from 'markdown-it-kbd';
import taskLists from 'markdown-it-task-lists';

const ABORT_DELAY = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, _loadContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let status = responseStatusCode;
    const userAgent = request.headers.get("user-agent");
    const readyOption = userAgent && isbot(userAgent) ? "onAllReady" : "onShellReady";
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(new Response(stream, { headers: responseHeaders, status }));
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          status = 500;
          if (shellRendered) console.error(error);
        }
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
function isbot(ua) {
  return /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview/i.test(ua);
}

const entryServer = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: 'Module' }));

function links() {
  return [{
    rel: "preconnect",
    href: "https://fonts.googleapis.com"
  }, {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous"
  }, {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
  }];
}
const THEME_INIT = `(function(){try{var t=localStorage.getItem("km-docs-theme");if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
function Layout({
  children
}) {
  return (
    // data-theme is rewritten by the inline script before hydration; the
    // server/client attribute mismatch on first paint is expected.
    /* @__PURE__ */
    jsxs("html", {
      lang: "en",
      "data-theme": "dark",
      suppressHydrationWarning: true,
      children: [/* @__PURE__ */jsxs("head", {
        children: [/* @__PURE__ */jsx("meta", {
          charSet: "utf-8"
        }), /* @__PURE__ */jsx("meta", {
          name: "viewport",
          content: "width=device-width, initial-scale=1.0"
        }), /* @__PURE__ */jsx(Meta, {}), /* @__PURE__ */jsx(Links, {}), /* @__PURE__ */jsx("script", {
          dangerouslySetInnerHTML: {
            __html: THEME_INIT
          }
        })]
      }), /* @__PURE__ */jsxs("body", {
        children: [children, /* @__PURE__ */jsx(ScrollRestoration, {}), /* @__PURE__ */jsx(Scripts, {})]
      })]
    })
  );
}
const HydrateFallback = UNSAFE_withHydrateFallbackProps(function HydrateFallback() {
  return /* @__PURE__ */jsx("div", {
    className: "km-boot",
    children: "Loading…"
  });
});
const root = UNSAFE_withComponentProps(function Root() {
  return /* @__PURE__ */jsx(Outlet, {});
});

const route0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  HydrateFallback,
  Layout,
  default: root,
  links
}, Symbol.toStringTag, { value: 'Module' }));

function Line(props) {
  const { children, ...rest } = props;
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 18 18",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      ...rest,
      children
    }
  );
}
function BrandMark(props) {
  return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 18 18", "aria-hidden": "true", ...props, children: /* @__PURE__ */ jsx("path", { d: "M9 3l1.6 4.4L15 9l-4.4 1.6L9 15l-1.6-4.4L3 9l4.4-1.6z", fill: "currentColor" }) });
}
const IconMenu = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M3 5h12M3 9h12M3 13h12" }) });
const IconClose = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M5 5l8 8M13 5l-8 8" }) });
const IconSearch = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("circle", { cx: "7.5", cy: "7.5", r: "4.5" }),
  /* @__PURE__ */ jsx("path", { d: "M11 11l3.5 3.5" })
] });
const IconChevronRight = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M6.5 4l4 4-4 4" }) });
const IconArrowRight = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M4 9h10M10 5l4 4-4 4" }) });
const IconChevronLeftSm = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M11 4l-4 5 4 5" }) });
const IconChevronRightSm = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M7 4l4 5-4 5" }) });
const IconExternal = (p) => /* @__PURE__ */ jsx(Line, { strokeWidth: 1.6, ...p, children: /* @__PURE__ */ jsx("path", { d: "M7 4h7v7M14 4L4 14" }) });
const IconEdit = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("path", { d: "M11.5 3.5l3 3L7 14l-3.5.5L4 11z" }),
  /* @__PURE__ */ jsx("path", { d: "M10.5 4.5l3 3" })
] });
const IconInfo = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("circle", { cx: "9", cy: "9", r: "6.2" }),
  /* @__PURE__ */ jsx("path", { d: "M9 6v3.6M9 11.8v.01" })
] });
const IconSun = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("circle", { cx: "9", cy: "9", r: "3.4" }),
  /* @__PURE__ */ jsx("path", { d: "M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4" })
] });
const IconMoon = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M14.5 10.2A5.8 5.8 0 017.8 3.5a5.8 5.8 0 102.9 11.2 5.8 5.8 0 003.8-4.5z" }) });
const IconGithub = (p) => /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", ...p, children: /* @__PURE__ */ jsx("path", { d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" }) });
const IconDiscord = (p) => /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", ...p, children: /* @__PURE__ */ jsx("path", { d: "M20.317 4.369a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" }) });
const IconNpm = (p) => /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", ...p, children: /* @__PURE__ */ jsx("path", { d: "M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" }) });
const IconX = (p) => /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", ...p, children: /* @__PURE__ */ jsx("path", { d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" }) });
const IconStar = (p) => /* @__PURE__ */ jsx("svg", { viewBox: "0 0 18 18", fill: "currentColor", "aria-hidden": "true", ...p, children: /* @__PURE__ */ jsx("path", { d: "M9 2l1.9 3.9 4.3.6-3.1 3 .7 4.3L9 11.8 5.2 13.8l.7-4.3-3.1-3 4.3-.6z" }) });
const IconBook = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("path", { d: "M3 4.5h6a2 2 0 012 2v8a2 2 0 00-2-2H3z" }),
  /* @__PURE__ */ jsx("path", { d: "M15 4.5H9a2 2 0 00-2 2v8a2 2 0 012-2h6z" })
] });
const IconCube = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("path", { d: "M9 2.5l5.5 3v7L9 15.5 3.5 12.5v-7z" }),
  /* @__PURE__ */ jsx("path", { d: "M3.7 5.6L9 8.5l5.3-2.9M9 8.5v7" })
] });
const IconBolt = (p) => /* @__PURE__ */ jsx("svg", { viewBox: "0 0 18 18", "aria-hidden": "true", ...p, children: /* @__PURE__ */ jsx("path", { d: "M4 9l3.5-6 1 4.5H14l-3.5 6-1-4.5z", fill: "currentColor" }) });
const IconTimeline = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("path", { d: "M3 9h12" }),
  /* @__PURE__ */ jsx("path", { d: "M6 6v6M10.5 7v4" })
] });
const IconWave = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M3 13c4-9 8-9 12 0" }) });
const IconLayers = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("path", { d: "M9 3l6 3-6 3-6-3 6-3z" }),
  /* @__PURE__ */ jsx("path", { d: "M3 9l6 3 6-3M3 12l6 3 6-3" })
] });
const IconType = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M4 5h10M9 5v9M6.5 14h5" }) });
const IconStage = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("rect", { x: "3.5", y: "3.5", width: "11", height: "11", rx: "1.5" }),
  /* @__PURE__ */ jsx("path", { d: "M3.5 7.5h11M8 7.5v7" })
] });
const IconTransition = (p) => /* @__PURE__ */ jsxs(
  "svg",
  {
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    "aria-hidden": "true",
    ...p,
    children: [
      /* @__PURE__ */ jsx("path", { d: "M3 9h12" }),
      /* @__PURE__ */ jsx("circle", { cx: "11.5", cy: "9", r: "2.2", fill: "currentColor", stroke: "none" })
    ]
  }
);
const IconCode = (p) => /* @__PURE__ */ jsx(Line, { ...p, children: /* @__PURE__ */ jsx("path", { d: "M7 6l-3 3 3 3M11 6l3 3-3 3" }) });
const IconClock = (p) => /* @__PURE__ */ jsxs(Line, { ...p, children: [
  /* @__PURE__ */ jsx("circle", { cx: "9", cy: "9", r: "6" }),
  /* @__PURE__ */ jsx("path", { d: "M9 5.4V9l2.6 1.6" })
] });
const DOC_ICONS = {
  book: IconBook,
  cube: IconCube,
  bolt: IconBolt,
  timeline: IconTimeline,
  wave: IconWave,
  layers: IconLayers,
  type: IconType,
  stage: IconStage,
  transition: IconTransition,
  code: IconCode,
  clock: IconClock,
  github: IconGithub,
  discord: IconDiscord
};
function DocIcon({ name, ...rest }) {
  const Cmp = name && DOC_ICONS[name] || IconBook;
  return /* @__PURE__ */ jsx(Cmp, { ...rest });
}

function Brand({ className }) {
  return /* @__PURE__ */ jsxs(
    Link,
    {
      to: "/",
      className: `brand${className ? ` ${className}` : ""}`,
      "aria-label": "konva-motion home",
      children: [
        /* @__PURE__ */ jsx("span", { className: "brand__mark", children: /* @__PURE__ */ jsx(BrandMark, {}) }),
        /* @__PURE__ */ jsxs("span", { className: "brand__word", children: [
          "konva",
          /* @__PURE__ */ jsx("span", { className: "dim", children: "-motion" })
        ] })
      ]
    }
  );
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("km-docs-theme", next);
  } catch {
  }
}
function ThemeToggle() {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      className: "icon-btn theme-toggle",
      onClick: toggleTheme,
      "aria-label": "Toggle color theme",
      title: "Toggle theme",
      children: [
        /* @__PURE__ */ jsx(IconSun, { className: "sun" }),
        /* @__PURE__ */ jsx(IconMoon, { className: "moon" })
      ]
    }
  );
}

const GH_URL$2 = "https://github.com/konva-motion/konva-motion";
function HomeHeader() {
  return /* @__PURE__ */ jsxs("header", { className: "home-header", children: [
    /* @__PURE__ */ jsx(Brand, {}),
    /* @__PURE__ */ jsx("span", { className: "spacer" }),
    /* @__PURE__ */ jsxs("nav", { className: "home-header__links", children: [
      /* @__PURE__ */ jsx(Link, { to: "/docs", children: "Docs" }),
      /* @__PURE__ */ jsx(Link, { to: "/docs", children: "Components" }),
      /* @__PURE__ */ jsx(Link, { to: "/docs", children: "Examples" })
    ] }),
    /* @__PURE__ */ jsxs(
      "a",
      {
        className: "gh-link",
        href: GH_URL$2,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": "konva-motion on GitHub",
        children: [
          /* @__PURE__ */ jsx(IconGithub, {}),
          /* @__PURE__ */ jsx("span", { className: "gh-name", children: "GitHub" }),
          /* @__PURE__ */ jsxs("span", { className: "stars", children: [
            /* @__PURE__ */ jsx(IconStar, {}),
            "2.4k"
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx(ThemeToggle, {})
  ] });
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  fallbackCopy(text);
  return Promise.resolve();
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
  }
  document.body.removeChild(ta);
}
function useCopyButtons(dep) {
  useEffect(() => {
    const cleanups = [];
    const flash = (btn, label) => {
      btn.classList.add("is-copied");
      const prev = label?.textContent ?? "";
      if (label) label.textContent = "Copied";
      const t = setTimeout(() => {
        btn.classList.remove("is-copied");
        if (label) label.textContent = prev;
      }, 1600);
      cleanups.push(() => clearTimeout(t));
    };
    for (const btn of Array.from(document.querySelectorAll(".code-block__copy"))) {
      const handler = () => {
        const code = btn.closest(".code-block")?.querySelector("code");
        if (!code) return;
        copyText(code.innerText).then(
          () => flash(btn, btn.querySelector(".copy-label"))
        );
      };
      btn.addEventListener("click", handler);
      cleanups.push(() => btn.removeEventListener("click", handler));
    }
    for (const btn of Array.from(document.querySelectorAll("[data-copy]"))) {
      const handler = () => {
        copyText(btn.getAttribute("data-copy") ?? "").then(() => flash(btn));
      };
      btn.addEventListener("click", handler);
      cleanups.push(() => btn.removeEventListener("click", handler));
    }
    return () => {
      for (const fn of cleanups) fn();
    };
  }, [dep]);
}

const __vite_glob_0_0 = "---\ntitle: Introduction\ngroup: Getting Started\norder: 1\neyebrow: Getting Started\ndescription: What konva-motion is, how the timeline drives tweens, and when to reach for it.\nicon: book\n---\n\nkonva-motion adds a timeline and a tweening engine to [Konva](https://konvajs.org). Describe motion declaratively — animate any node, sequence and loop it, then play it back smoothly or render it to video.\n\n## Why konva-motion\n\nKonva gives you a fast 2D canvas scene graph. konva-motion gives that scene graph a\nclock: a frame-accurate timeline that drives your nodes' attributes over time. Instead\nof wiring up `requestAnimationFrame` loops by hand, you describe **what** should change\nand **when** — the engine handles the rest.\n\n- Declarative, timeline-driven animation for Konva — no framework required.\n- Composable timelines with nested sequences.\n- Works with any Konva node — shapes, text, groups, and images.\n- The same timeline that plays in the browser renders to video on the server.\n\n## How it fits together\n\nA `Composition` owns a frame clock (fps + duration). A `Sequence` is a range-gated\nlayer — visible only while the playhead is inside its window. On each tick the\ncomposition walks its sequences, runs their updaters, and repaints the active ones.\n\n> Animation is not the art of drawings that move, but the art of movements that are drawn.\n>\n> — Norman McLaren\n\n## Next steps\n\nHead to [Installation](/docs/installation) to add the package and play your first\ntween, or jump to [Components & Typography](/docs/components) for the full content\nreference.\n";

const __vite_glob_0_1 = "---\ntitle: Installation\ngroup: Getting Started\norder: 2\neyebrow: Getting Started\ndescription: Add the package, create a Konva Stage, and play your first tween.\nicon: cube\n---\n\nkonva-motion ships as an ES module with `konva` as a peer dependency. Install both, build a scene, and drive it from a timeline.\n\n## Install\n\n```bash\nnpm install konva konva-motion\n# or\npnpm add konva konva-motion\n```\n\n:::note Konva is a peer dependency\nPin the `konva` version yourself — konva-motion extends Konva's classes, so the two must resolve to a single copy.\n:::\n\n## Your first tween\n\n```js\nimport Konva from \"konva\";\nimport { Timeline, easeOut } from \"konva-motion\";\n\n// a regular Konva stage + layer\nconst stage = new Konva.Stage({ container: \"scene\", width: 1280, height: 720 });\nconst layer = new Konva.Layer();\nstage.add(layer);\n\nconst title = new Konva.Text({ text: \"Motion in minutes\", fontSize: 96, y: 80, opacity: 0 });\nlayer.add(title);\n\n// describe the motion on a timeline, then play it\nconst tl = new Timeline({ loop: true });\ntl.to(title, { y: 0, opacity: 1, duration: 0.9, easing: easeOut });\ntl.play();\n```\n\n:::warning Heads up\nAdd a node to a Konva `Layer` before you tween it — animating a detached node updates its attributes but nothing repaints.\n:::\n\n## Step by step\n\n:::steps\n1. **Create a Stage & Layer**\n\n   Set up a Konva `Stage` bound to a container element, add a `Layer`, and place your shapes on it.\n\n2. **Build a Timeline**\n\n   Create a `Timeline` — it sequences your tweens and repaints the layer for you on every frame.\n\n3. **Tween a node**\n\n   Call `tl.to(node, { …attrs, duration })` to animate any Konva attribute, then `tl.play()`.\n:::\n\nYou're ready — explore the full content toolkit in [Components & Typography](/docs/components).\n";

const __vite_glob_0_2 = "---\ntitle: Components & Typography\ngroup: Components\norder: 3\neyebrow: Components\ndescription: The konva-motion documentation template — every content component, themeable in light and dark.\nicon: type\n---\n\nThis page is the living style reference for konva-motion docs. Every content element below is a building block — write it in plain Markdown and it inherits this rhythm, spacing, and color automatically, in both light and dark themes.\n\n:::note A template, not a page\nThe header, sidebar, table of contents, and footer stay identical across every doc. Only the article in the middle changes — so authoring a new page means writing a Markdown file, **no HTML required**.\n:::\n\n## Headings\n\nHeadings establish the document outline and feed the \"On this page\" index on the right.\n`h2` sections open with a hairline rule; deeper levels nest without one. Hover any\nheading to reveal its anchor link.\n\n### Third-level heading\n\nUse `h3` for sub-topics inside a section. They appear indented in the table of contents.\n\n#### Fourth-level heading\n\nReserve `h4` for fine-grained labels — option groups, edge cases, footnoted details.\n\n## Text & inline elements\n\nBody copy runs at a comfortable measure of about 68 characters. You can mix **bold\nemphasis**, *italics*, and [inline links](/docs/introduction) freely. Reference an API\nwith inline code like `tl.to()` or a value such as `easeInOut`. Keyboard shortcuts\nrender as keys: press [[Space]] to play and [[⌘]][[K]] to search.\n\nStatus is communicated with badges: {{accent:stable}} {{good:v1.0}} {{warn:beta}} {{deprecated}}.\n\n## Lists\n\nUnordered lists use a compact accent marker:\n\n- Declarative, timeline-driven animation for Konva — no framework required.\n- Composable timelines with nested sequences\n  - Stagger children with a single delay value.\n  - Reverse, loop, or yoyo any segment.\n- Works with any Konva node — shapes, text, groups, and images.\n\nOrdered lists number each step in a monospaced chip:\n\n1. Build your scene with Konva — a `Stage`, `Layer`, and shapes.\n2. Create a `Timeline` to orchestrate the motion.\n3. Tween any node with `tl.to(node, { … })`.\n\nTask lists track progress:\n\n- [x] Install the package\n- [ ] Add a `Konva.Stage`\n- [ ] Export an MP4\n\n## Code blocks\n\nFenced code renders with a language label, window dots, and a one-click copy button.\nSyntax is highlighted on the server and re-colored for whichever theme is active.\n\n```js\nimport Konva from \"konva\";\nimport { Timeline, easeOut } from \"konva-motion\";\n\nconst tl = new Timeline({ loop: true });\ntl.to(title, { y: 0, opacity: 1, duration: 0.9, easing: easeOut });\ntl.play();\n```\n\nShell commands work the same way:\n\n```bash\nnpm install konva konva-motion\n```\n\n## Callouts\n\nFour admonition styles draw the eye without shouting. Each pairs a tinted surface with an icon.\n\n:::tip Tip\nChain tweens with `.to()` — each one starts after the last finishes, so you describe a sequence in the order it plays.\n:::\n\n:::danger Breaking in v1\nThe standalone `tween()` helper was removed. Use `timeline.to()` instead — it returns the timeline so calls stay chainable.\n:::\n\n## Blockquotes\n\n> Animation is not the art of drawings that move, but the art of movements that are drawn.\n>\n> — Norman McLaren\n\n## Tables & API reference\n\nTabular data scrolls horizontally on small screens without breaking the layout.\n\n| Prop | Type | Default | Description |\n| --- | --- | --- | --- |\n| `duration` | `number` | `0.5` | Length of the tween, in seconds. |\n| `delay` | `number` | `0` | Wait before the tween starts, in seconds. |\n| `easing` | `function` | `linear` | Easing curve applied across the tween. |\n| `loop` | `boolean` | `false` | Replay the timeline once it finishes. |\n\nFor longer entries, a property list reads better than a table:\n\n:::prop timeline.to | (node, config) → Timeline\nTweens a Konva node's attributes to target values over a `duration`. Returns the timeline, so calls chain.\n:::\n\n:::prop timeline.from | (node, config) → Timeline | v1.0\nAnimates a node *from* the given attributes to its current ones — ideal for entrances.\n:::\n\n:::prop stagger | (amount) → number\nOffsets each node's start time so a group of tweens cascades instead of firing at once.\n:::\n\n## Step-by-step\n\nFor guided walkthroughs, numbered steps connect along a single rail:\n\n:::steps\n1. **Create a Stage & Layer**\n\n   Set up a Konva `Stage` bound to a container element, add a `Layer`, and place your shapes on it.\n\n2. **Build a Timeline**\n\n   Create a `Timeline` — it sequences your tweens and repaints the layer for you on every frame.\n\n3. **Tween a node**\n\n   Call `tl.to(node, { …attrs, duration })` to animate any Konva attribute, then `tl.play()`.\n:::\n\n## Live demo\n\nPages can embed a running example with the `<km-player>` web component from\n`@konva-motion/player`. The element is registered in the browser, so it hydrates after\nload and plays a composition like an HTML5 `<video>`:\n\n```html\n<km-player src=\"/demos/pulse.js\" controls autoplay loop></km-player>\n```\n\nUntil a composition is wired in, the themed canvas frame below holds its place — sized\n16:9 and ready to mount a real preview.\n\n:::demo 1280 × 720 canvas\n:::\n\n---\n\nEvery element on this page is driven by `prose.css`. Restyle it once and every doc updates together.\n";

const __vite_glob_0_3 = "---\ntitle: Layout & Shapes\ngroup: Layout\norder: 4\neyebrow: Layout\ndescription: Flexbox layout for Konva, plus a flex-aware wrapper for every Konva shape — all driven by the timeline.\nicon: layers\n---\n\n`@konva-motion/core` ships a synchronous flexbox engine and a flex-aware\nwrapper for **every Konva drawing primitive**. Import the whole vocabulary from\none place — you never reach for `Konva.*` shapes directly.\n\n:::note One import surface\n`Composition`, `Sequence`, the layout containers (`Flex`, `Block`), media\n(`Image`, `Video`, `Audio`), `Text`, and all shapes (`Rect`, `Circle`, …) come\nfrom `@konva-motion/core`. konva-motion is the primary API surface.\n:::\n\n## Flex containers\n\n`Flex` and `Block` are flexbox containers (Konva groups). A `Block` is a `Flex`\nthat also paints a background, border, shadow, and corner radius. When a\ncontainer sits inside a `Sequence`, its layout recomputes every frame — so\nanimating `width`, `gap`, or child sizes reflows everything for free.\n\n```ts\nimport { Flex, Block, Rect, Circle, Text } from \"@konva-motion/core\";\n\nconst card = new Block({\n  flexDirection: \"column\",\n  padding: 24,\n  gap: 16,\n  background: \"#15151f\",\n  borderSize: 1,\n  borderColor: \"#2a2a38\",\n  cornerRadius: 16,\n});\n\nconst row = new Flex({ flexDirection: \"row\", gap: 24, alignItems: \"center\" });\nrow.add(new Rect({ width: 140, height: 140, fill: \"#38bdf8\", cornerRadius: 16 }));\nrow.add(new Circle({ radius: 70, fill: \"#f472b6\" }));\n\ncard.add(new Text({ text: \"Shapes in a flex row\", fontSize: 28, fill: \"#eceaf2\" }));\ncard.add(row);\n```\n\nContainer props: `flexDirection`, `justifyContent`, `alignItems`, `gap`,\n`padding`. Sizes accept a `number` (px) or a CSS-style `\"50%\"` string. Every\nflex child also accepts `flexGrow`, `flexShrink`, `flexBasis`, `alignSelf`, and\n`margin`.\n\n## Shapes\n\nEach Konva shape is re-exported as a wrapper with the same name and config, plus\nflex child props and `px`/`%` `width`/`height`:\n\n| | |\n| --- | --- |\n| `Rect` | `Circle` |\n| `Ellipse` | `Line` |\n| `Arrow` | `Star` |\n| `Ring` | `Arc` |\n| `Wedge` | `RegularPolygon` |\n| `Path` | `TextPath` |\n| `Sprite` | |\n\n- A shape with no explicit `width`/`height` lays out at its **intrinsic size**\n  (its `getSelfRect()` bounds — a circle's diameter, a line's points box).\n- Positions are **origin-corrected**: a `Circle`'s bounding box lands in the\n  flex slot, not its center, so centered-origin shapes align with rectangles.\n\n:::tip flexGrow on radius shapes\nFor radius/points-based shapes, `width`/`height` map onto geometry, so\n`flexGrow`-driven stretch can distort them. Give those an explicit size (or\nleave them un-stretched) for predictable results.\n:::\n\n## Animating layout\n\nMutate any flex attr inside `Sequence.register`; the next tick reflows\npositions and sizes — no explicit layout call:\n\n```ts\nseq.register((frame) => {\n  card.width(320 + 200 * Math.sin(frame / 30));   // siblings rewrap/resize\n  row.setAttr(\"gap\", frame % 48);                 // animate the gap\n});\n```\n\nThis is the canonical demonstration: change **one** element's size and its\nsiblings reflow (and, with `flexShrink`, resize) automatically.\n\n## Custom shapes & the layout contract\n\nLayout participation is an **open contract**, `KMLayoutNode` — the engine checks\nfor it with `isKMLayoutNode` rather than a hard-coded type switch, so adding a\nnode type never means editing the engine.\n\n:::prop KMLayoutNode._kmRole | \"container\" | \"leaf\"\nA container (`Flex`/`Block`) has its children laid out and recursed into; a leaf\n(`Image`/`Text`/shapes) is sized by its own measure.\n:::\n\n:::prop KMLayoutNode._kmMeasure | (flexNode, ctx) → void\nLeaf only — configure the flexily node's size (explicit `px`/`%`, or intrinsic\nfrom `getSelfRect()`).\n:::\n\n:::prop KMLayoutNode._kmPlace | (box) → void\nWrite the computed `{ left, top, width, height }` back onto the node (position\norigin-corrected; containers also restyle).\n:::\n\nTo make a custom `Konva.Shape` subclass flex-aware, wrap it with the\n`FlexShape` mixin — it supplies the leaf contract, `px`/`%` size handling, and\nconfig stripping:\n\n```ts\nimport Konva from \"konva\";\nimport { FlexShape, type LeafConfig } from \"@konva-motion/core\";\n\ntype MyConfig = Omit<Konva.MyShapeConfig, \"width\" | \"height\"> & LeafConfig;\nclass MyShape extends FlexShape<Konva.MyShape, MyConfig>(Konva.MyShape) {}\n```\n";

const __vite_glob_0_4 = "---\ntitle: Player\ngroup: Player\norder: 5\neyebrow: Player\ndescription: Play a composition in the browser with the <km-player> web component — including loading one from a remote file.\nicon: bolt\n---\n\n`@konva-motion/player` is a framework-agnostic **web component** that plays a\n`Composition` like an HTML5 `<video>` — letterbox-scaling it to its box, with\nfullscreen, keyboard control, and a Remotion-style imperative + event API.\n\n```ts\nimport \"@konva-motion/player\"; // registers <km-player> and the controls\nimport \"@konva-motion/player/styles.css\"; // opt-in default styling\n\nconst player = document.querySelector(\"km-player\");\nplayer.composition = comp; // a Composition — no container needed\n```\n\n## Loading from a remote file\n\nInstead of assigning a composition imperatively, point the player at a **remote\nESM module** with the `src` attribute — just like `<video src>`:\n\n```html\n<km-player src=\"https://cdn.example/orbit.js\" controls loop></km-player>\n```\n\nThe player dynamically `import()`s the URL and resolves its **default export** to\na live `Composition`. That export may be a `Composition` instance, a factory\nreturning one (sync or async), or a factory resolving to `{ default: Composition }`:\n\n```ts\n// orbit.js — the remote module\nimport { Composition, Sequence } from \"@konva-motion/core\";\n\nconst comp = new Composition({ id: \"orbit\", fps: 60, durationInFrames: 180 });\n// …build the scene…\n\nexport default comp; // or: () => comp / async () => comp\n```\n\nThe demo below is exactly that. The composition lives in its own module; the\ndocs hand the player its URL with Vite's [`?url`](https://vite.dev/guide/assets#explicit-url-imports)\nimport, so the player fetches and runs it at load time — the same path a truly\nremote file would take.\n\n:::demo orbit | loaded via src\n:::\n\nRelative `src` values resolve against the document base. The player emits\n`loadstart` when a load begins and `loaded` once mounted; a failed import — or a\nmodule that doesn't resolve to a `Composition` — emits `error`. A `loading`\nattribute is reflected on the host while the import is in flight.\n\n:::warning Only load trusted URLs\n\n`src` performs a dynamic `import()`, which **executes arbitrary code** from the\nURL. Load only modules you trust, and make sure your CSP `script-src` allows the\norigin.\n:::\n\n## Attributes\n\n:::prop src | string | new\nURL of an ESM module whose default export resolves to a `Composition`. An\nimperatively-assigned `composition` property takes precedence over `src`.\n:::\n\nOther attributes: `controls`, `loop`, `autoplay`, `muted`, `volume`,\n`playbackrate`, `initialframe`, `no-click-to-play`, `no-space-key`,\n`no-keyboard`, `double-click-fullscreen`.\n";

const COPY_SVGS = `<svg class="ic-copy" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="9" height="9" rx="2"/><path d="M12 6V4.5A1.5 1.5 0 0010.5 3h-6A1.5 1.5 0 003 4.5v6A1.5 1.5 0 004.5 12H6"/></svg><svg class="ic-check" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5l3.2 3L14 5.5"/></svg>`;
const CALLOUT_ICONS = {
  note: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6.2"/><path d="M9 8v4M9 5.6v.01"/></svg>`,
  tip: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5a4.2 4.2 0 00-2.5 7.6c.5.4.8 1 .8 1.6V12h3.4v-.3c0-.6.3-1.2.8-1.6A4.2 4.2 0 009 2.5z"/><path d="M7.3 14.5h3.4M7.8 16h2.4"/></svg>`,
  warning: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.8l6.2 11A1 1 0 0114.3 15H3.7a1 1 0 01-.9-1.2z"/><path d="M9 7v3.4M9 12.6v.01"/></svg>`,
  danger: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6.2"/><path d="M9 5.5v4M9 11.9v.01"/></svg>`
};
const DEMO_HINT = `<div class="demo-slot__hint"><span class="ring"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5l8 4.5-8 4.5z" fill="currentColor" stroke="none"/></svg></span><b>Demo slot</b><span>Mount a &lt;km-player&gt; here — this frame keeps its aspect ratio and theming intact.</span></div>`;
function slugify(s) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
}
const md = new MarkdownIt({
  html: false,
  // pure Markdown — every design element is produced by the parser
  linkify: true,
  typographer: false
});
const esc = (s) => md.utils.escapeHtml(s);
md.use(anchor, {
  slugify,
  permalink: anchor.permalink.linkInsideHeader({
    symbol: "#",
    class: "heading-anchor",
    placement: "after",
    space: false,
    ariaHidden: true
  })
});
md.use(kbd);
md.use(taskLists, { label: true });
function calloutContainer(name, mod, defaultTitle) {
  md.use(container, name, {
    render(tokens, idx) {
      const token = tokens[idx];
      if (!token) return "";
      if (token.nesting === 1) {
        const title = token.info.trim().slice(name.length).trim() || defaultTitle;
        return `<div class="callout callout--${mod}"><span class="callout__icon">${CALLOUT_ICONS[name]}</span><div class="callout__body"><div class="callout__title">${esc(title)}</div>`;
      }
      return "</div></div>\n";
    }
  });
}
calloutContainer("note", "note", "Note");
calloutContainer("tip", "tip", "Tip");
calloutContainer("warning", "warning", "Heads up");
calloutContainer("danger", "danger", "Warning");
md.use(container, "demo", {
  render(tokens, idx) {
    const token = tokens[idx];
    if (!token) return "";
    if (token.nesting === 1) {
      const raw = token.info.trim().slice("demo".length).trim();
      const sep = raw.indexOf("|");
      const id = sep >= 0 ? raw.slice(0, sep).trim() : "";
      const tag = sep >= 0 ? raw.slice(sep + 1).trim() : raw;
      const tagHtml = tag ? `<span class="tag">${esc(tag)}</span>` : "";
      const demoAttr = id ? ` data-km-demo="${esc(id)}"` : "";
      return `<div class="demo-slot"><div class="demo-slot__bar"><span class="glow" aria-hidden="true"></span><span class="label">Live demo</span>${tagHtml}</div><div class="demo-slot__stage"${demoAttr}>${DEMO_HINT}`;
    }
    return "</div></div>\n";
  }
});
md.use(container, "prop", {
  render(tokens, idx) {
    const token = tokens[idx];
    if (!token) return "";
    if (token.nesting === 1) {
      const parts = token.info.trim().slice("prop".length).split("|");
      const name = esc((parts[0] ?? "").trim());
      const type = parts[1] ? `<span class="prop__type">${esc(parts[1].trim())}</span>` : "";
      const badge = parts[2] ? `<span class="badge badge--good">${esc(parts[2].trim())}</span>` : "";
      return `<div class="prop"><div class="prop__head"><span class="prop__name">${name}</span>${type}${badge}</div>`;
    }
    return "</div>\n";
  }
});
md.use(container, "steps", {
  render(tokens, idx) {
    return tokens[idx]?.nesting === 1 ? `<div class="steps">
` : "</div>\n";
  }
});
function htmlToken(state, content) {
  const t = new state.Token("html_block", "", 0);
  t.content = content;
  return t;
}
function buildSteps(state, inner) {
  const out = [];
  let i = 0;
  while (i < inner.length) {
    if (inner[i]?.type === "list_item_open") {
      const level = inner[i]?.level ?? 0;
      let end = i + 1;
      while (end < inner.length && !(inner[end]?.type === "list_item_close" && inner[end]?.level === level)) {
        end++;
      }
      const body = inner.slice(i + 1, end);
      out.push(htmlToken(state, '<div class="steps__item">'));
      if (body[0]?.type === "paragraph_open") {
        let pc = 1;
        while (pc < body.length && body[pc]?.type !== "paragraph_close") pc++;
        out.push(htmlToken(state, '<div class="steps__title">'));
        for (let z = 1; z < pc; z++) {
          const tk = body[z];
          if (tk) out.push(tk);
        }
        out.push(htmlToken(state, "</div>"));
        for (let z = pc + 1; z < body.length; z++) {
          const tk = body[z];
          if (tk) out.push(tk);
        }
      } else {
        out.push(...body);
      }
      out.push(htmlToken(state, "</div>"));
      i = end + 1;
    } else {
      i++;
    }
  }
  return out;
}
md.core.ruler.push("km_steps", (state) => {
  const t = state.tokens;
  let i = 0;
  while (i < t.length) {
    if (t[i]?.type === "container_steps_open") {
      let j = i + 1;
      while (j < t.length && t[j]?.type !== "ordered_list_open" && t[j]?.type !== "bullet_list_open" && t[j]?.type !== "container_steps_close") {
        j++;
      }
      const open = t[j];
      if (open && (open.type === "ordered_list_open" || open.type === "bullet_list_open")) {
        const closeType = open.type === "ordered_list_open" ? "ordered_list_close" : "bullet_list_close";
        let k = j + 1;
        while (k < t.length && !(t[k]?.type === closeType && t[k]?.level === open.level)) k++;
        const replacement = buildSteps(state, t.slice(j + 1, k));
        t.splice(j, k - j + 1, ...replacement);
        i = j + replacement.length;
        continue;
      }
    }
    i++;
  }
});
const BADGE_VARIANTS = /* @__PURE__ */ new Set(["accent", "good", "warn"]);
md.inline.ruler.before("emphasis", "km_badge", (state, silent) => {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 123 || state.src.charCodeAt(start + 1) !== 123)
    return false;
  const end = state.src.indexOf("}}", start + 2);
  if (end < 0) return false;
  if (!silent) {
    const raw = state.src.slice(start + 2, end);
    const m = raw.match(/^(\w+):([\s\S]+)$/);
    let cls = "badge";
    let text = raw;
    if (m?.[1] && BADGE_VARIANTS.has(m[1])) {
      cls = `badge badge--${m[1]}`;
      text = m[2] ?? "";
    }
    const token = state.push("html_inline", "", 0);
    token.content = `<span class="${cls}">${esc(text.trim())}</span>`;
  }
  state.pos = end + 2;
  return true;
});
md.core.ruler.push("km_lead", (state) => {
  const first = state.tokens.find((t) => t.level === 0 && t.nesting === 1);
  if (first?.type === "paragraph_open") first.attrJoin("class", "lead");
});
md.core.ruler.push("km_cite", (state) => {
  const t = state.tokens;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    const tok = t[i];
    if (!tok) continue;
    if (tok.type === "blockquote_open") depth++;
    else if (tok.type === "blockquote_close") depth--;
    else if (depth > 0 && tok.type === "paragraph_open") {
      const inline = t[i + 1];
      const close = t[i + 2];
      const firstChild = inline?.children?.[0];
      if (inline?.type === "inline" && close?.type === "paragraph_close" && firstChild?.type === "text") {
        const m = firstChild.content.match(/^(?:—|--)\s?([\s\S]*)$/);
        if (m) {
          tok.tag = "cite";
          close.tag = "cite";
          firstChild.content = m[1] ?? "";
        }
      }
    }
  }
});
md.core.ruler.push("km_figure", (state) => {
  const t = state.tokens;
  for (let i = 0; i < t.length; i++) {
    if (t[i]?.type !== "paragraph_open") continue;
    const inline = t[i + 1];
    const close = t[i + 2];
    const open = t[i];
    if (!open || inline?.type !== "inline" || close?.type !== "paragraph_close") continue;
    const children = inline.children ?? [];
    const meaningful = children.filter((c) => !(c.type === "text" && c.content.trim() === ""));
    const img = meaningful[0];
    if (meaningful.length !== 1 || img?.type !== "image") continue;
    open.tag = "figure";
    close.tag = "figure";
    const title = img.attrGet("title");
    if (title) {
      img.attrSet("title", "");
      const cap = new state.Token("html_inline", "", 0);
      cap.content = `<figcaption>${esc(title)}</figcaption>`;
      children.push(cap);
    }
  }
});
md.renderer.rules.table_open = () => `<div class="table-wrap"><table>`;
md.renderer.rules.table_close = () => "</table></div>";
const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token?.attrGet("href") ?? "";
  if (token && /^https?:\/\//.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  if (!token) return "";
  const lang = (token.info.trim().split(/\s+/g)[0] || "text").toLowerCase();
  const code = token.content;
  let highlighted;
  if (lang && lang !== "text" && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(code, { language: lang }).value;
    } catch {
      highlighted = esc(code);
    }
  } else {
    highlighted = esc(code);
  }
  const label = esc(lang);
  return `<div class="code-block"><div class="code-block__bar"><span class="code-block__dots"><i></i><i></i><i></i></span><span class="code-block__lang">${label}</span><button class="code-block__copy" aria-label="Copy code">${COPY_SVGS}<span class="copy-label">Copy</span></button></div><pre class="scroll"><code class="language-${label} hljs">${highlighted}</code></pre></div>`;
};
function collectHeadings(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t || t.type !== "heading_open") continue;
    if (t.tag !== "h2" && t.tag !== "h3") continue;
    const id = t.attrGet("id") ?? "";
    const inline = tokens[i + 1];
    const text = inline && inline.type === "inline" ? inline.content : "";
    out.push({ id, text, level: t.tag === "h2" ? 2 : 3 });
  }
  return out;
}
function renderMarkdown(src) {
  const env = {};
  const tokens = md.parse(src, env);
  const headings = collectHeadings(tokens);
  const html = md.renderer.render(tokens, md.options, env);
  return { html, headings };
}

const GROUP_ORDER = ["Getting Started", "Core Concepts", "Components", "API Reference"];
const rawModules = /* #__PURE__ */ Object.assign({"../content/01-introduction.md": __vite_glob_0_0,"../content/02-installation.md": __vite_glob_0_1,"../content/03-components.md": __vite_glob_0_2,"../content/04-layout-and-shapes.md": __vite_glob_0_3,"../content/05-player.md": __vite_glob_0_4



});
function fileSlug(path) {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/, "").replace(/^\d+[-_]/, "");
}
function filePrefixOrder(path) {
  const base = path.split("/").pop() ?? path;
  const m = base.match(/^(\d+)[-_]/);
  return m?.[1] ? Number(m[1]) : Number.POSITIVE_INFINITY;
}
const docs$1 = Object.entries(rawModules).map(([path, raw]) => {
  const { data, content } = matter(raw);
  const slug = typeof data.slug === "string" ? data.slug : fileSlug(path);
  const order = typeof data.order === "number" ? data.order : filePrefixOrder(path);
  const meta = {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    group: typeof data.group === "string" ? data.group : "Docs",
    order,
    eyebrow: typeof data.eyebrow === "string" ? data.eyebrow : void 0,
    description: typeof data.description === "string" ? data.description : void 0,
    icon: typeof data.icon === "string" ? data.icon : void 0
  };
  return { meta, body: content };
}).sort((a, b) => a.meta.order - b.meta.order || a.meta.title.localeCompare(b.meta.title));
const pageCache = /* @__PURE__ */ new Map();
function getAllDocs() {
  return docs$1.map((d) => d.meta);
}
function getFirstDocSlug() {
  return docs$1[0]?.meta.slug;
}
function getDoc(slug) {
  const cached = pageCache.get(slug);
  if (cached) return cached;
  const found = docs$1.find((d) => d.meta.slug === slug);
  if (!found) return null;
  const { html, headings } = renderMarkdown(found.body);
  const page = { meta: found.meta, html, headings };
  pageCache.set(slug, page);
  return page;
}
function buildNav() {
  const groups = /* @__PURE__ */ new Map();
  for (const { meta } of docs$1) {
    const list = groups.get(meta.group) ?? [];
    list.push(meta);
    groups.set(meta.group, list);
  }
  const ordered = [...groups.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return ordered.map((label) => ({ label, items: groups.get(label) ?? [] }));
}
function getPrevNext(slug) {
  const i = docs$1.findIndex((d) => d.meta.slug === slug);
  if (i === -1) return {};
  return { prev: docs$1[i - 1]?.meta, next: docs$1[i + 1]?.meta };
}

const GH_URL$1 = "https://github.com/konva-motion/konva-motion";
const INSTALL_CMD = "npm install konva-motion";
function loader$3() {
  const docs = getAllDocs();
  const has = slug => docs.some(d => d.slug === slug);
  const link = slug => has(slug) ? `/docs/${slug}` : "/docs";
  return {
    getStarted: getFirstDocSlug() ? `/docs/${getFirstDocSlug()}` : "/docs",
    links: {
      introduction: link("introduction"),
      installation: link("installation"),
      concepts: link("core-concepts"),
      components: link("components")
    }
  };
}
function meta$1(_) {
  return [{
    title: "konva-motion · Declarative motion for the canvas"
  }, {
    name: "description",
    content: "konva-motion adds a timeline and tweening engine to Konva — animate any node, sequence and loop it, and play it back smoothly."
  }];
}
const home = UNSAFE_withComponentProps(function Home({
  loaderData
}) {
  const {
    getStarted,
    links
  } = loaderData;
  useCopyButtons();
  return /* @__PURE__ */jsxs(Fragment, {
    children: [/* @__PURE__ */jsx(HomeHeader, {}), /* @__PURE__ */jsxs("section", {
      className: "hero",
      children: [/* @__PURE__ */jsx("div", {
        className: "hero__grid",
        "aria-hidden": "true"
      }), /* @__PURE__ */jsx("div", {
        className: "hero__glow",
        "aria-hidden": "true"
      }), /* @__PURE__ */jsxs("div", {
        className: "hero__inner",
        children: [/* @__PURE__ */jsxs("span", {
          className: "pill",
          children: [/* @__PURE__ */jsx("span", {
            className: "dot"
          }), " Konva animation toolkit ", /* @__PURE__ */jsx("span", {
            className: "ver",
            children: "v1.0.0"
          })]
        }), /* @__PURE__ */jsxs("h1", {
          children: ["Declarative ", /* @__PURE__ */jsx("span", {
            className: "grad",
            children: "motion"
          }), /* @__PURE__ */jsx("br", {}), "for the canvas."]
        }), /* @__PURE__ */jsx("p", {
          className: "sub",
          children: "konva-motion adds a timeline and tweens to Konva. Animate any node — position, scale, rotation, color — then sequence it, loop it, and play it back smoothly."
        }), /* @__PURE__ */jsxs("div", {
          className: "hero__cta",
          children: [/* @__PURE__ */jsxs(Link, {
            className: "btn btn--primary",
            to: getStarted,
            children: ["Get started", /* @__PURE__ */jsx(IconArrowRight, {})]
          }), /* @__PURE__ */jsxs("a", {
            className: "btn btn--ghost",
            href: GH_URL$1,
            target: "_blank",
            rel: "noopener noreferrer",
            children: [/* @__PURE__ */jsx(IconGithub, {}), "View on GitHub"]
          })]
        }), /* @__PURE__ */jsx("div", {
          className: "hero__install",
          children: /* @__PURE__ */jsxs("div", {
            className: "copy-cmd",
            children: [/* @__PURE__ */jsxs("span", {
              children: [/* @__PURE__ */jsx("span", {
                className: "prompt",
                children: "$"
              }), " ", INSTALL_CMD]
            }), /* @__PURE__ */jsxs("button", {
              type: "button",
              "data-copy": INSTALL_CMD,
              "aria-label": "Copy install command",
              children: [/* @__PURE__ */jsxs("svg", {
                className: "ic-copy",
                viewBox: "0 0 18 18",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 1.6,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
                children: [/* @__PURE__ */jsx("rect", {
                  x: "6",
                  y: "6",
                  width: "9",
                  height: "9",
                  rx: "2"
                }), /* @__PURE__ */jsx("path", {
                  d: "M12 6V4.5A1.5 1.5 0 0010.5 3h-6A1.5 1.5 0 003 4.5v6A1.5 1.5 0 004.5 12H6"
                })]
              }), /* @__PURE__ */jsx("svg", {
                className: "ic-check",
                viewBox: "0 0 18 18",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 1.8,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
                children: /* @__PURE__ */jsx("path", {
                  d: "M4 9.5l3.2 3L14 5.5"
                })
              })]
            })]
          })
        }), /* @__PURE__ */jsxs("div", {
          className: "shields",
          children: [/* @__PURE__ */jsxs("span", {
            className: "shield",
            children: [/* @__PURE__ */jsx(IconNpm, {}), "npm ", /* @__PURE__ */jsx("span", {
              className: "v",
              children: "v1.0.0"
            })]
          }), /* @__PURE__ */jsxs("span", {
            className: "shield",
            children: ["license ", /* @__PURE__ */jsx("b", {
              children: "MIT"
            })]
          }), /* @__PURE__ */jsxs("span", {
            className: "shield",
            children: [/* @__PURE__ */jsx(IconStar, {}), "stars ", /* @__PURE__ */jsx("b", {
              children: "2.4k"
            })]
          }), /* @__PURE__ */jsxs("span", {
            className: "shield",
            children: ["minzip ", /* @__PURE__ */jsx("b", {
              children: "7.8 kB"
            })]
          })]
        })]
      }), /* @__PURE__ */jsx("div", {
        className: "hero__code",
        children: /* @__PURE__ */jsxs("div", {
          className: "code-block",
          children: [/* @__PURE__ */jsxs("div", {
            className: "code-block__bar",
            children: [/* @__PURE__ */jsxs("span", {
              className: "code-block__dots",
              children: [/* @__PURE__ */jsx("i", {}), /* @__PURE__ */jsx("i", {}), /* @__PURE__ */jsx("i", {})]
            }), /* @__PURE__ */jsx("span", {
              className: "code-block__lang",
              children: "js"
            })]
          }), /* @__PURE__ */jsx("pre", {
            className: "scroll",
            children: /* @__PURE__ */jsx("code", {
              className: "language-javascript",
              children: `const tl = new Timeline();

tl.to(circle, {
  x: 480,
  scaleX: 1.4,
  duration: 0.8,
  easing: easeOut,
});

tl.play();`
            })
          })]
        })
      })]
    }), /* @__PURE__ */jsxs("section", {
      className: "section",
      children: [/* @__PURE__ */jsx("div", {
        className: "section__eyebrow",
        children: "Start here"
      }), /* @__PURE__ */jsxs("div", {
        className: "quick",
        children: [/* @__PURE__ */jsxs(Link, {
          className: "qcard",
          to: links.introduction,
          children: [/* @__PURE__ */jsx("span", {
            className: "qcard__icon",
            children: /* @__PURE__ */jsx(IconBook, {})
          }), /* @__PURE__ */jsxs("span", {
            className: "qcard__title",
            children: ["Introduction ", /* @__PURE__ */jsx("span", {
              className: "arr",
              children: "→"
            })]
          }), /* @__PURE__ */jsx("p", {
            className: "qcard__desc",
            children: "What konva-motion is, how the timeline drives tweens, and when to reach for it."
          })]
        }), /* @__PURE__ */jsxs(Link, {
          className: "qcard",
          to: links.installation,
          children: [/* @__PURE__ */jsx("span", {
            className: "qcard__icon",
            children: /* @__PURE__ */jsx(IconCube, {})
          }), /* @__PURE__ */jsxs("span", {
            className: "qcard__title",
            children: ["Installation ", /* @__PURE__ */jsx("span", {
              className: "arr",
              children: "→"
            })]
          }), /* @__PURE__ */jsx("p", {
            className: "qcard__desc",
            children: "Add the package, create a Konva Stage, and play your first tween."
          })]
        }), /* @__PURE__ */jsxs(Link, {
          className: "qcard",
          to: links.concepts,
          children: [/* @__PURE__ */jsx("span", {
            className: "qcard__icon",
            children: /* @__PURE__ */jsx(IconTimeline, {})
          }), /* @__PURE__ */jsxs("span", {
            className: "qcard__title",
            children: ["Core concepts ", /* @__PURE__ */jsx("span", {
              className: "arr",
              children: "→"
            })]
          }), /* @__PURE__ */jsx("p", {
            className: "qcard__desc",
            children: "Timelines, easing, springs, and composing sequences."
          })]
        }), /* @__PURE__ */jsxs(Link, {
          className: "qcard",
          to: links.components,
          children: [/* @__PURE__ */jsx("span", {
            className: "qcard__icon",
            children: /* @__PURE__ */jsx(IconType, {})
          }), /* @__PURE__ */jsxs("span", {
            className: "qcard__title",
            children: ["Components & type ", /* @__PURE__ */jsx("span", {
              className: "arr",
              children: "→"
            })]
          }), /* @__PURE__ */jsx("p", {
            className: "qcard__desc",
            children: "The full reference of every documented content component."
          })]
        })]
      })]
    }), /* @__PURE__ */jsxs("footer", {
      className: "home-footer",
      children: [/* @__PURE__ */jsxs("div", {
        className: "footer-main",
        children: [/* @__PURE__ */jsxs("div", {
          className: "footer-brand",
          children: [/* @__PURE__ */jsxs(Link, {
            className: "brand",
            to: "/",
            children: [/* @__PURE__ */jsx("span", {
              className: "brand__mark",
              children: /* @__PURE__ */jsx(BrandMark, {})
            }), /* @__PURE__ */jsxs("span", {
              className: "brand__word",
              children: ["konva", /* @__PURE__ */jsx("span", {
                className: "dim",
                children: "-motion"
              })]
            })]
          }), /* @__PURE__ */jsx("p", {
            children: "A timeline and tweening engine for Konva. Free and open source under the MIT license."
          }), /* @__PURE__ */jsxs("div", {
            className: "social",
            children: [/* @__PURE__ */jsx("a", {
              href: GH_URL$1,
              target: "_blank",
              rel: "noopener noreferrer",
              "aria-label": "GitHub",
              children: /* @__PURE__ */jsx(IconGithub, {})
            }), /* @__PURE__ */jsx("a", {
              href: "https://www.npmjs.com/package/konva-motion",
              target: "_blank",
              rel: "noopener noreferrer",
              "aria-label": "npm",
              children: /* @__PURE__ */jsx(IconNpm, {})
            }), /* @__PURE__ */jsx("a", {
              href: "https://x.com/konvamotion",
              target: "_blank",
              rel: "noopener noreferrer",
              "aria-label": "X / Twitter",
              children: /* @__PURE__ */jsx(IconX, {})
            }), /* @__PURE__ */jsx("a", {
              href: "https://discord.gg/konva-motion",
              target: "_blank",
              rel: "noopener noreferrer",
              "aria-label": "Discord",
              children: /* @__PURE__ */jsx(IconDiscord, {})
            })]
          })]
        }), /* @__PURE__ */jsxs("div", {
          className: "footer-col",
          children: [/* @__PURE__ */jsx("h4", {
            children: "Documentation"
          }), /* @__PURE__ */jsxs("ul", {
            children: [/* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx(Link, {
                to: links.introduction,
                children: "Introduction"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx(Link, {
                to: links.installation,
                children: "Installation"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx(Link, {
                to: links.components,
                children: "Components"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx(Link, {
                to: "/docs",
                children: "API reference"
              })
            })]
          })]
        }), /* @__PURE__ */jsxs("div", {
          className: "footer-col",
          children: [/* @__PURE__ */jsx("h4", {
            children: "Community"
          }), /* @__PURE__ */jsxs("ul", {
            children: [/* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx("a", {
                href: GH_URL$1,
                target: "_blank",
                rel: "noopener noreferrer",
                children: "GitHub"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx("a", {
                href: `${GH_URL$1}/discussions`,
                target: "_blank",
                rel: "noopener noreferrer",
                children: "Discussions"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx("a", {
                href: "https://discord.gg/konva-motion",
                target: "_blank",
                rel: "noopener noreferrer",
                children: "Discord"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx("a", {
                href: `${GH_URL$1}/blob/main/CONTRIBUTING.md`,
                target: "_blank",
                rel: "noopener noreferrer",
                children: "Contributing"
              })
            })]
          })]
        }), /* @__PURE__ */jsxs("div", {
          className: "footer-col",
          children: [/* @__PURE__ */jsx("h4", {
            children: "Resources"
          }), /* @__PURE__ */jsxs("ul", {
            children: [/* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx(Link, {
                to: "/docs",
                children: "Changelog"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx(Link, {
                to: "/docs",
                children: "Examples"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx("a", {
                href: "https://www.npmjs.com/package/konva-motion",
                target: "_blank",
                rel: "noopener noreferrer",
                children: "npm package"
              })
            }), /* @__PURE__ */jsx("li", {
              children: /* @__PURE__ */jsx("a", {
                href: `${GH_URL$1}/blob/main/LICENSE`,
                target: "_blank",
                rel: "noopener noreferrer",
                children: "License"
              })
            })]
          })]
        })]
      }), /* @__PURE__ */jsxs("div", {
        className: "footer-bottom",
        children: [/* @__PURE__ */jsx("span", {
          children: "© 2026 konva-motion · Released under the MIT License"
        }), /* @__PURE__ */jsx("span", {
          className: "spacer"
        }), /* @__PURE__ */jsx("span", {
          children: "Built with the konva-motion design system"
        })]
      })]
    })]
  });
});

const route1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: home,
  loader: loader$3,
  meta: meta$1
}, Symbol.toStringTag, { value: 'Module' }));

const GH_URL = "https://github.com/konva-motion/konva-motion";
function DocHeader({ onMenu }) {
  return /* @__PURE__ */ jsxs("header", { className: "doc-header", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "icon-btn menu-btn",
        onClick: onMenu,
        "aria-label": "Open navigation",
        children: /* @__PURE__ */ jsx(IconMenu, {})
      }
    ),
    /* @__PURE__ */ jsx(Brand, {}),
    /* @__PURE__ */ jsx("span", { className: "doc-header__sep", "aria-hidden": "true" }),
    /* @__PURE__ */ jsxs("nav", { className: "doc-header__links", children: [
      /* @__PURE__ */ jsx(Link, { to: "/docs", className: "is-active", children: "Docs" }),
      /* @__PURE__ */ jsx(Link, { to: "/docs", children: "Examples" }),
      /* @__PURE__ */ jsx(Link, { to: "/docs", children: "Changelog" })
    ] }),
    /* @__PURE__ */ jsx("span", { className: "doc-header__spacer" }),
    /* @__PURE__ */ jsx("span", { className: "pill ver-pill", children: /* @__PURE__ */ jsx("span", { className: "ver", children: "v1.0.0" }) }),
    /* @__PURE__ */ jsx(
      "a",
      {
        className: "gh-link gh-link--icon",
        href: GH_URL,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": "konva-motion on GitHub",
        children: /* @__PURE__ */ jsx(IconGithub, {})
      }
    ),
    /* @__PURE__ */ jsx(ThemeToggle, {})
  ] });
}

const COMMUNITY = [
  {
    label: "GitHub",
    href: "https://github.com/konva-motion/konva-motion",
    icon: "github",
    external: true
  },
  { label: "Discord", href: "https://discord.gg/konva-motion", icon: "discord", external: true }
];
function matches(text, q) {
  return !q || text.toLowerCase().includes(q);
}
function Sidebar({ nav, onNavigate }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const q = query.trim().toLowerCase();
  useEffect(() => {
    const onKey = (e) => {
      const active = document.activeElement;
      const tag = active?.tagName;
      if (e.key === "/" && active !== inputRef.current && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && active === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const filtered = useMemo(
    () => nav.map((g) => ({
      ...g,
      items: g.items.filter((it) => matches(it.title, q) || matches(g.label, q))
    })).filter((g) => g.items.length > 0),
    [nav, q]
  );
  const communityVisible = COMMUNITY.filter((l) => matches(l.label, q));
  const nothing = filtered.length === 0 && communityVisible.length === 0;
  return /* @__PURE__ */ jsxs("aside", { className: "sidebar", "aria-label": "Documentation navigation", children: [
    /* @__PURE__ */ jsxs("div", { className: "sidebar__drawer-head", children: [
      /* @__PURE__ */ jsx(Brand, {}),
      /* @__PURE__ */ jsx("span", { className: "doc-header__spacer" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "icon-btn",
          onClick: onNavigate,
          "aria-label": "Close navigation",
          children: /* @__PURE__ */ jsx(IconClose, {})
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "sidebar__head", children: /* @__PURE__ */ jsxs("div", { className: "sidebar__search", children: [
      /* @__PURE__ */ jsx(IconSearch, {}),
      /* @__PURE__ */ jsx(
        "input",
        {
          ref: inputRef,
          type: "text",
          placeholder: "Search docs…",
          "aria-label": "Search documentation",
          value: query,
          onChange: (e) => setQuery(e.target.value)
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "kbd-hint", children: "/" })
    ] }) }),
    /* @__PURE__ */ jsxs("nav", { className: "sidebar__nav scroll", onClick: onNavigate, children: [
      filtered.map((group) => /* @__PURE__ */ jsxs("div", { className: "nav-group", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-group__label", children: group.label }),
        group.items.map((item) => /* @__PURE__ */ jsxs(
          NavLink,
          {
            to: `/docs/${item.slug}`,
            className: ({ isActive }) => `nav-link${isActive ? " is-active" : ""}`,
            children: [
              /* @__PURE__ */ jsx("span", { className: "ic", children: /* @__PURE__ */ jsx(DocIcon, { name: item.icon }) }),
              item.title
            ]
          },
          item.slug
        ))
      ] }, group.label)),
      communityVisible.length > 0 && /* @__PURE__ */ jsxs("div", { className: "nav-group", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-group__label", children: "Community" }),
        communityVisible.map((link) => /* @__PURE__ */ jsxs(
          "a",
          {
            className: "nav-link",
            href: link.href,
            target: link.external ? "_blank" : void 0,
            rel: link.external ? "noopener noreferrer" : void 0,
            children: [
              /* @__PURE__ */ jsx("span", { className: "ic", children: link.icon === "github" ? /* @__PURE__ */ jsx(IconGithub, {}) : /* @__PURE__ */ jsx(DocIcon, { name: link.icon }) }),
              link.label,
              link.external && /* @__PURE__ */ jsx("span", { className: "tag", children: /* @__PURE__ */ jsx(IconExternal, { style: { width: 13, height: 13, color: "var(--ink-3)" } }) })
            ]
          },
          link.label
        ))
      ] }),
      nothing && /* @__PURE__ */ jsx("div", { className: "nav-empty", style: { display: "block" }, children: "No pages match your search." })
    ] })
  ] });
}

function Toc({ headings }) {
  const [active, setActive] = useState(headings[0]?.id ?? "");
  useEffect(() => {
    if (headings.length === 0) return;
    setActive(headings[0]?.id ?? "");
    const visible = /* @__PURE__ */ new Map();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (visible.size === 0) return;
        let top = null;
        let ty = Number.POSITIVE_INFINITY;
        visible.forEach((y, id) => {
          if (y < ty) {
            ty = y;
            top = id;
          }
        });
        if (top) setActive(top);
      },
      { rootMargin: "-12% 0px -72% 0px", threshold: [0, 1] }
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [headings]);
  if (headings.length === 0) return /* @__PURE__ */ jsx("aside", { className: "toc scroll", "aria-label": "On this page" });
  return /* @__PURE__ */ jsxs("aside", { className: "toc scroll", "aria-label": "On this page", children: [
    /* @__PURE__ */ jsx("div", { className: "toc__title", children: "On this page" }),
    /* @__PURE__ */ jsx("ul", { className: "toc__list", children: headings.map((h) => /* @__PURE__ */ jsx("li", { className: `toc__item toc__item--h${h.level}`, children: /* @__PURE__ */ jsx(
      "a",
      {
        href: `#${h.id}`,
        className: h.id === active ? "is-active" : void 0,
        onClick: () => setActive(h.id),
        children: h.text
      }
    ) }, h.id)) })
  ] });
}

function loader$2() {
  return {
    nav: buildNav()
  };
}
const docs = UNSAFE_withComponentProps(function DocsLayout({
  loaderData
}) {
  const {
    nav
  } = loaderData;
  const [navOpen, setNavOpen] = useState(false);
  const matches = useMatches();
  const page = matches.find(m => m.id.endsWith("docs.page"));
  const headings = page?.data?.page?.headings ?? [];
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const close = () => setNavOpen(false);
  return /* @__PURE__ */jsxs(Fragment, {
    children: [/* @__PURE__ */jsx(DocHeader, {
      onMenu: () => setNavOpen(true)
    }), /* @__PURE__ */jsxs("div", {
      className: navOpen ? "nav-open" : void 0,
      children: [/* @__PURE__ */jsx("div", {
        className: "nav-scrim",
        onClick: close,
        "aria-hidden": "true"
      }), /* @__PURE__ */jsxs("div", {
        className: "shell",
        children: [/* @__PURE__ */jsx(Sidebar, {
          nav,
          onNavigate: close
        }), /* @__PURE__ */jsx("main", {
          className: "content",
          children: /* @__PURE__ */jsx("div", {
            className: "content__inner",
            children: /* @__PURE__ */jsx(Outlet, {})
          })
        }), /* @__PURE__ */jsx(Toc, {
          headings
        })]
      })]
    })]
  });
});

const route2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: docs,
  loader: loader$2
}, Symbol.toStringTag, { value: 'Module' }));

function loader$1() {
  const slug = getFirstDocSlug();
  return redirect(slug ? `/docs/${slug}` : "/");
}
const docs_index = UNSAFE_withComponentProps(function DocsIndex() {
  return null;
});

const route3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: docs_index,
  loader: loader$1
}, Symbol.toStringTag, { value: 'Module' }));

function useDemoMounts(dep) {
  useEffect(() => {
    let cancelled = false;
    void import('./assets/mount-Rib9TP73.js').then((m) => {
      if (!cancelled) m.mountDemos();
    });
    return () => {
      cancelled = true;
    };
  }, [dep]);
}

const GH_EDIT = "https://github.com/konva-motion/konva-motion/edit/main/packages/docs/src/content";
const GH_ISSUE = "https://github.com/konva-motion/konva-motion/issues/new";
function loader({
  params
}) {
  const page = getDoc(params.slug);
  if (!page) throw data(`No doc page "${params.slug}"`, {
    status: 404
  });
  const {
    prev,
    next
  } = getPrevNext(params.slug);
  return {
    page,
    prev,
    next
  };
}
function meta({
  loaderData
}) {
  if (!loaderData) return [{
    title: "Not found · konva-motion"
  }];
  const {
    meta: meta2
  } = loaderData.page;
  return [{
    title: `${meta2.title} · konva-motion`
  }, {
    name: "description",
    content: meta2.description ?? ""
  }];
}
const docs_page = UNSAFE_withComponentProps(function DocPage({
  loaderData
}) {
  const {
    page,
    prev,
    next
  } = loaderData;
  useCopyButtons(page.meta.slug);
  useDemoMounts(page.meta.slug);
  return /* @__PURE__ */jsxs(Fragment, {
    children: [/* @__PURE__ */jsxs("nav", {
      className: "crumbs",
      "aria-label": "Breadcrumb",
      children: [/* @__PURE__ */jsx(Link, {
        to: "/docs",
        children: page.meta.group
      }), /* @__PURE__ */jsx(IconChevronRight, {}), /* @__PURE__ */jsx("span", {
        className: "cur",
        children: page.meta.title
      })]
    }), /* @__PURE__ */jsxs("article", {
      className: "prose",
      children: [page.meta.eyebrow && /* @__PURE__ */jsx("span", {
        className: "eyebrow",
        children: page.meta.eyebrow
      }), /* @__PURE__ */jsx("h1", {
        children: page.meta.title
      }), /* @__PURE__ */jsx("div", {
        dangerouslySetInnerHTML: {
          __html: page.html
        }
      })]
    }), /* @__PURE__ */jsxs("footer", {
      className: "page-foot",
      children: [/* @__PURE__ */jsxs("nav", {
        className: "page-nav",
        "aria-label": "Pagination",
        children: [prev ? /* @__PURE__ */jsxs(Link, {
          className: "page-nav__card page-nav__card--prev",
          to: `/docs/${prev.slug}`,
          children: [/* @__PURE__ */jsxs("span", {
            className: "page-nav__dir",
            children: [/* @__PURE__ */jsx(IconChevronLeftSm, {}), " Previous"]
          }), /* @__PURE__ */jsx("span", {
            className: "page-nav__title",
            children: prev.title
          })]
        }) : /* @__PURE__ */jsx("span", {}), next ? /* @__PURE__ */jsxs(Link, {
          className: "page-nav__card page-nav__card--next",
          to: `/docs/${next.slug}`,
          children: [/* @__PURE__ */jsxs("span", {
            className: "page-nav__dir",
            children: [/* @__PURE__ */jsx(IconChevronRightSm, {}), " Next"]
          }), /* @__PURE__ */jsx("span", {
            className: "page-nav__title",
            children: next.title
          })]
        }) : /* @__PURE__ */jsx("span", {})]
      }), /* @__PURE__ */jsxs("div", {
        className: "page-meta",
        children: [/* @__PURE__ */jsxs("div", {
          className: "page-meta__links",
          children: [/* @__PURE__ */jsxs("a", {
            href: `${GH_EDIT}/${page.meta.slug}.md`,
            target: "_blank",
            rel: "noopener noreferrer",
            children: [/* @__PURE__ */jsx(IconEdit, {}), "Edit this page on GitHub"]
          }), /* @__PURE__ */jsxs("a", {
            href: GH_ISSUE,
            target: "_blank",
            rel: "noopener noreferrer",
            children: [/* @__PURE__ */jsx(IconInfo, {}), "Report an issue"]
          })]
        }), /* @__PURE__ */jsx("span", {
          children: "Last updated June 2026"
        })]
      })]
    })]
  });
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return /* @__PURE__ */jsxs("article", {
    className: "prose",
    children: [/* @__PURE__ */jsx("span", {
      className: "eyebrow",
      children: is404 ? "404" : "Error"
    }), /* @__PURE__ */jsx("h1", {
      children: is404 ? "Page not found" : "Something went wrong"
    }), /* @__PURE__ */jsxs("p", {
      children: [is404 ? "That documentation page doesn’t exist (yet)." : "An unexpected error occurred while loading this page.", " ", /* @__PURE__ */jsx(Link, {
        to: "/docs",
        children: "Back to the docs"
      }), "."]
    })]
  });
});

const route4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: docs_page,
  loader,
  meta
}, Symbol.toStringTag, { value: 'Module' }));

const serverManifest = {'entry':{'module':'/assets/entry.client-CVACyNNN.js','imports':['/assets/jsx-runtime-Dzbvb8CX.js','/assets/play-button-BMivxslo.js','/assets/chunk-6CSD65Y2-hCBiNnel.js','/assets/_commonjsHelpers-CqkleIqs.js'],'css':['/assets/entry-Ck-UVINd.css']},'routes':{'root':{'id':'root','parentId':undefined,'path':'','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':false,'hasClientAction':false,'hasClientLoader':false,'hasClientMiddleware':false,'hasDefaultExport':true,'hasErrorBoundary':false,'module':'/assets/root-DsQjYeuO.js','imports':['/assets/jsx-runtime-Dzbvb8CX.js','/assets/play-button-BMivxslo.js','/assets/chunk-6CSD65Y2-hCBiNnel.js','/assets/_commonjsHelpers-CqkleIqs.js'],'css':['/assets/entry-Ck-UVINd.css','/assets/root-B0qTE_TU.css'],'clientActionModule':undefined,'clientLoaderModule':undefined,'clientMiddlewareModule':undefined,'hydrateFallbackModule':undefined},'routes/home':{'id':'routes/home','parentId':'root','path':undefined,'index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasClientMiddleware':false,'hasDefaultExport':true,'hasErrorBoundary':false,'module':'/assets/home-DWjUVBQu.js','imports':['/assets/chunk-6CSD65Y2-hCBiNnel.js','/assets/jsx-runtime-Dzbvb8CX.js','/assets/theme-toggle-DdWjKLzS.js','/assets/icons-DHraIx8x.js','/assets/use-copy-buttons-B4eCyK8d.js','/assets/_commonjsHelpers-CqkleIqs.js'],'css':['/assets/home-3jI0sj71.css'],'clientActionModule':undefined,'clientLoaderModule':undefined,'clientMiddlewareModule':undefined,'hydrateFallbackModule':undefined},'routes/docs':{'id':'routes/docs','parentId':'root','path':'docs','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasClientMiddleware':false,'hasDefaultExport':true,'hasErrorBoundary':false,'module':'/assets/docs-DoBvk5o6.js','imports':['/assets/chunk-6CSD65Y2-hCBiNnel.js','/assets/jsx-runtime-Dzbvb8CX.js','/assets/theme-toggle-DdWjKLzS.js','/assets/icons-DHraIx8x.js','/assets/_commonjsHelpers-CqkleIqs.js'],'css':[],'clientActionModule':undefined,'clientLoaderModule':undefined,'clientMiddlewareModule':undefined,'hydrateFallbackModule':undefined},'routes/docs.index':{'id':'routes/docs.index','parentId':'routes/docs','path':undefined,'index':true,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasClientMiddleware':false,'hasDefaultExport':true,'hasErrorBoundary':false,'module':'/assets/docs.index-Czezzd8_.js','imports':['/assets/chunk-6CSD65Y2-hCBiNnel.js','/assets/_commonjsHelpers-CqkleIqs.js'],'css':[],'clientActionModule':undefined,'clientLoaderModule':undefined,'clientMiddlewareModule':undefined,'hydrateFallbackModule':undefined},'routes/docs.page':{'id':'routes/docs.page','parentId':'routes/docs','path':':slug','index':undefined,'caseSensitive':undefined,'hasAction':false,'hasLoader':true,'hasClientAction':false,'hasClientLoader':false,'hasClientMiddleware':false,'hasDefaultExport':true,'hasErrorBoundary':true,'module':'/assets/docs.page-D7Mumgqd.js','imports':['/assets/chunk-6CSD65Y2-hCBiNnel.js','/assets/jsx-runtime-Dzbvb8CX.js','/assets/icons-DHraIx8x.js','/assets/use-copy-buttons-B4eCyK8d.js','/assets/preload-helper-BlTxHScW.js','/assets/_commonjsHelpers-CqkleIqs.js'],'css':[],'clientActionModule':undefined,'clientLoaderModule':undefined,'clientMiddlewareModule':undefined,'hydrateFallbackModule':undefined}},'url':'/assets/manifest-d9517295.js','version':'d9517295','sri':undefined};

const assetsBuildDirectory = "build/client";
      const basename = "/";
      const future = {"unstable_optimizeDeps":false,"v8_passThroughRequests":false,"v8_trailingSlashAwareDataRequests":false,"unstable_previewServerPrerendering":false,"v8_middleware":false,"v8_splitRouteModules":false,"v8_viteEnvironmentApi":false};
      const ssr = true;
      const isSpaMode = false;
      const prerender = [];
      const routeDiscovery = {"mode":"lazy","manifestPath":"/__manifest"};
      const publicPath = "/";
      const entry = { module: entryServer };
      const routes = {
        "root": {
          id: "root",
          parentId: undefined,
          path: "",
          index: undefined,
          caseSensitive: undefined,
          module: route0
        },
  "routes/home": {
          id: "routes/home",
          parentId: "root",
          path: undefined,
          index: true,
          caseSensitive: undefined,
          module: route1
        },
  "routes/docs": {
          id: "routes/docs",
          parentId: "root",
          path: "docs",
          index: undefined,
          caseSensitive: undefined,
          module: route2
        },
  "routes/docs.index": {
          id: "routes/docs.index",
          parentId: "routes/docs",
          path: undefined,
          index: true,
          caseSensitive: undefined,
          module: route3
        },
  "routes/docs.page": {
          id: "routes/docs.page",
          parentId: "routes/docs",
          path: ":slug",
          index: undefined,
          caseSensitive: undefined,
          module: route4
        }
      };
      
      const allowedActionOrigins = false;

export { allowedActionOrigins, serverManifest as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, prerender, publicPath, routeDiscovery, routes, ssr };
