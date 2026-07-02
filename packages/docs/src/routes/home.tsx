import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { ClientOnly } from "../components/client-only";
import { HomeHeader } from "../components/home-header";
import {
  BrandMark,
  IconArrowRight,
  IconBook,
  IconCube,
  IconGithub,
  IconNpm,
  IconTimeline,
  IconType,
} from "../components/icons";
import { useCopyButtons } from "../components/use-copy-buttons";

import homeBgUrl from "../demos/home-bg.ts?comp-url";
import "../styles/base.css";
import "../styles/home.css";
import type { Route } from "./+types/home";

const GH_URL = "https://github.com/smoove-dev/smoove";
const INSTALL_CMD = "npm install smoove";

export function loader() {
  // Doc slugs are stable (content/docs/<slug>.mdx); link to them directly.
  return {
    getStarted: "/docs/introduction",
    links: {
      introduction: "/docs/introduction",
      installation: "/docs/installation",
      concepts: "/docs/layout-and-shapes",
      components: "/docs/components",
    },
  };
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: "smoove · Smooth moves, in code" },
    {
      name: "description",
      content:
        "A timeline-driven animation engine for Konva. Animate any node, sequence it, loop it, and play it back smoothly in the browser or on the server.",
    },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { getStarted, links } = loaderData;
  useCopyButtons();

  // Honor reduced-motion: the hero background autoplays, but pause it for users
  // who prefer less motion (the player exposes an imperative pause()).
  const heroPlayerRef = useRef<(HTMLElement & { pause(): void }) | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches) heroPlayerRef.current?.pause();
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <>
      <HomeHeader />

      {/* Live smoove composition pinned as a fixed, page-wide backdrop so it
          stays at the top of the viewport as you scroll (behind all content). */}
      <div className="page-bg" aria-hidden="true">
        <ClientOnly>
          <smoove-player
            ref={heroPlayerRef as React.Ref<HTMLElement>}
            src={homeBgUrl}
            autoplay
            loop
          />
        </ClientOnly>
      </div>

      <section className="hero">
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__glow" aria-hidden="true" />

        <div className="hero__inner">
          <span className="pill">
            <span className="dot" /> smoove <span className="ver">v0.1.0</span>
          </span>
          <h1>
            Smooth <span className="grad">moves</span>,
            <br />
            in code.
          </h1>
          <p className="sub">
            A timeline-driven animation engine for Konva. Animate any node's position, scale,
            rotation, and color, then sequence it, loop it, and play it back smoothly.
          </p>
          <div className="hero__cta">
            <Link className="btn btn--primary" to={getStarted}>
              Get started
              <IconArrowRight />
            </Link>
            <a className="btn btn--ghost" href={GH_URL} target="_blank" rel="noopener noreferrer">
              <IconGithub />
              View on GitHub
            </a>
          </div>

          <div className="hero__install">
            <div className="copy-cmd">
              <span>
                <span className="prompt">$</span> {INSTALL_CMD}
              </span>
              <button type="button" data-copy={INSTALL_CMD} aria-label="Copy install command">
                <svg
                  className="ic-copy"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="6" y="6" width="9" height="9" rx="2" />
                  <path d="M12 6V4.5A1.5 1.5 0 0010.5 3h-6A1.5 1.5 0 003 4.5v6A1.5 1.5 0 004.5 12H6" />
                </svg>
                <svg
                  className="ic-check"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 9.5l3.2 3L14 5.5" />
                </svg>
              </button>
            </div>
          </div>

          <div className="shields">
            <span className="shield">
              license <b>MIT</b>
            </span>
          </div>
        </div>

        <div className="hero__code">
          <div className="code-block">
            <div className="code-block__bar">
              <span className="code-block__dots">
                <i />
                <i />
                <i />
              </span>
              <span className="code-block__lang">js</span>
            </div>
            <pre className="scroll">
              {/* Hand-highlighted static sample — token spans use the brand
                  --tok-* colors (.t-* in home.css). Docs pages use Shiki. */}
              <code className="language-javascript">
                <span className="t-key">import</span>
                {" { "}
                <span className="t-fn">Composition</span>
                {", "}
                <span className="t-fn">Sequence</span>
                {", "}
                <span className="t-fn">Circle</span>
                {" } "}
                <span className="t-key">from</span> <span className="t-str">"@smoove/core"</span>
                {";\n\n"}
                <span className="t-key">const</span>
                {" comp = "}
                <span className="t-key">new</span> <span className="t-fn">Composition</span>
                {"({ fps: "}
                <span className="t-num">60</span>
                {", durationInFrames: "}
                <span className="t-num">1800</span>
                {" });\n"}
                <span className="t-key">const</span>
                {" scene = "}
                <span className="t-key">new</span> <span className="t-fn">Sequence</span>
                {"({ from: "}
                <span className="t-num">0</span>
                {", durationInFrames: "}
                <span className="t-num">1800</span>
                {" });\n\n"}
                <span className="t-key">const</span>
                {" orb = "}
                <span className="t-key">new</span> <span className="t-fn">Circle</span>
                {"({ x: "}
                <span className="t-num">800</span>
                {", y: "}
                <span className="t-num">450</span>
                {", radius: "}
                <span className="t-num">200</span>
                {", fill: "}
                <span className="t-str">"#FF5640"</span>
                {" });\n"}
                {"scene."}
                <span className="t-fn">add</span>
                {"(orb);\n\n"}
                {"scene."}
                <span className="t-fn">register</span>
                {"((frame) => {\n"}
                {"  "}
                <span className="t-key">const</span>
                {" t = frame / "}
                <span className="t-num">1800</span>
                {";\n"}
                {"  orb."}
                <span className="t-fn">x</span>
                {"("}
                <span className="t-num">800</span>
                {" + "}
                <span className="t-num">220</span>
                {" * "}
                <span className="t-fn">Math</span>
                {"."}
                <span className="t-fn">sin</span>
                {"(t * "}
                <span className="t-fn">Math</span>
                {".PI * "}
                <span className="t-num">2</span>
                {"));\n"}
                {"  orb."}
                <span className="t-fn">radius</span>
                {"("}
                <span className="t-num">200</span>
                {" + "}
                <span className="t-num">50</span>
                {" * "}
                <span className="t-fn">Math</span>
                {"."}
                <span className="t-fn">sin</span>
                {"(t * "}
                <span className="t-fn">Math</span>
                {".PI * "}
                <span className="t-num">2</span>
                {"));\n"}
                {"});\n\n"}
                {"comp."}
                <span className="t-fn">add</span>
                {"(scene);"}
              </code>
            </pre>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__eyebrow">Why smoove</div>
        <div className="pillars">
          <div className="pillar">
            <h3>Smooth</h3>
            <p>
              Animation that feels good to watch and to write. A frame-accurate timeline drives
              every tween, so playback stays fluid and the code stays readable.
            </p>
          </div>
          <div className="pillar">
            <h3>Light</h3>
            <p>
              Less to install, less to run. A small footprint and low server requirements, with no
              React and no WASM in the way.
            </p>
          </div>
          <div className="pillar">
            <h3>Anywhere</h3>
            <p>
              One engine, every runtime. The same composition plays in the browser, renders in Node,
              and runs headless for offline output.
            </p>
          </div>
          <div className="pillar">
            <h3>Authorable</h3>
            <p>
              Built on concepts you already know: keyframes, timelines, flexbox layout, and standard
              shapes. The API reads the way you'd guess, familiar enough that a model can reason
              about it too.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__eyebrow">Start here</div>
        <div className="quick">
          <Link className="qcard" to={links.introduction}>
            <span className="qcard__icon">
              <IconBook />
            </span>
            <span className="qcard__title">
              Introduction <span className="arr">→</span>
            </span>
            <p className="qcard__desc">
              What smoove is, how the timeline drives your tweens, and when to reach for it.
            </p>
          </Link>
          <Link className="qcard" to={links.installation}>
            <span className="qcard__icon">
              <IconCube />
            </span>
            <span className="qcard__title">
              Installation <span className="arr">→</span>
            </span>
            <p className="qcard__desc">
              Add the package, set up a stage, and play your first tween.
            </p>
          </Link>
          <Link className="qcard" to={links.concepts}>
            <span className="qcard__icon">
              <IconTimeline />
            </span>
            <span className="qcard__title">
              Core concepts <span className="arr">→</span>
            </span>
            <p className="qcard__desc">Timelines, easing, springs, and how sequences compose.</p>
          </Link>
          <Link className="qcard" to={links.components}>
            <span className="qcard__icon">
              <IconType />
            </span>
            <span className="qcard__title">
              Components &amp; type <span className="arr">→</span>
            </span>
            <p className="qcard__desc">Every content component, documented in one reference.</p>
          </Link>
        </div>
      </section>

      <footer className="home-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link className="brand" to="/">
              <span className="brand__mark">
                <BrandMark gradient />
              </span>
              <span className="brand__word">Smoove</span>
            </Link>
            <p>
              A timeline and tweening engine for Konva. Free and open source under the MIT license.
            </p>
            <div className="social">
              <a href={GH_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <IconGithub />
              </a>
              <a
                href="https://www.npmjs.com/package/smoove"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="npm"
              >
                <IconNpm />
              </a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Documentation</h4>
            <ul>
              <li>
                <Link to={links.introduction}>Introduction</Link>
              </li>
              <li>
                <Link to={links.installation}>Installation</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Community</h4>
            <ul>
              <li>
                <a href={GH_URL} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={`${GH_URL}/blob/main/CONTRIBUTING.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contributing
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-col" />
        </div>

        <div className="footer-bottom">
          <span>© 2026 smoove · Released under the MIT License</span>
        </div>
      </footer>
    </>
  );
}
