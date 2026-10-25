import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import corePkg from "../../../core/package.json";
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
const INSTALL_CMD = "npm create smoove";
// The prompt a visitor pastes into their coding agent: one line that names
// smoove and the studio, then the video. The agent finds the rest itself
// (/llms.txt, and the studio's AGENTS.md once it scaffolds).
const AGENT_PROMPT_LEAD =
  "Use smoove (https://smoove.dev) to make me a video in the smoove studio.";

// Starter ideas for the video line. Brackets mark the bits to make your own.
type VideoIdea = { label: string; video: string };
const VIDEO_IDEAS: [VideoIdea, ...VideoIdea[]] = [
  {
    label: "Product launch",
    video:
      "A 20-second launch teaser for [my app]: a logo reveal, three feature callouts, and a closing call to action.",
  },
  {
    label: "Explainer",
    video: "A 30-second explainer of how [a topic] works, built from simple shapes and captions.",
  },
  {
    label: "Data story",
    video:
      "A 15-second animated bar chart of [my numbers], with values counting up as the bars grow.",
  },
  {
    label: "Social clip",
    video: "A 10-second portrait clip with a bold quote in kinetic type, made for social.",
  },
  {
    label: "Code walkthrough",
    video:
      "A 25-second walkthrough that types out [a function] and highlights the line that matters.",
  },
  // The wedding kit asks for the date, venues and photos itself.
  {
    label: "Save the date",
    video: "A save the date for the wedding of [our names], to send on WhatsApp.",
  },
  {
    label: "Wedding invite",
    video: "A wedding invitation for [our names], to send on WhatsApp.",
  },
];

const agentPrompt = (video: string) => `${AGENT_PROMPT_LEAD}\n\n${video}`;

export function loader() {
  // Doc slugs are stable (content/docs/<slug>.mdx); link to them directly.
  return {
    version: corePkg.version,
    getStarted: "/docs/introduction",
    links: {
      introduction: "/docs/introduction",
      installation: "/docs/installation",
      concepts: "/docs/layout-and-shapes",
      components: "/docs/components",
      codingAgents: "/docs/coding-agents",
    },
  };
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: "smoove · What you code is what you play" },
    {
      name: "description",
      content:
        "A timeline-driven animation engine. Animate any node, sequence it, loop it, and play it back smoothly in the browser or on the server.",
    },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { version, getStarted, links } = loaderData;
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
          {/* max-pixel-ratio=1: this is a dim, masked backdrop — rendering it at
              retina density is invisible but quadruples the per-frame pixel work. */}
          <smoove-player
            ref={heroPlayerRef as React.Ref<HTMLElement>}
            src={homeBgUrl}
            autoplay
            loop
            max-pixel-ratio="1"
          />
        </ClientOnly>
      </div>

      <section className="hero">
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__glow" aria-hidden="true" />

        <div className="hero__inner">
          <span className="pill">
            <span className="dot" /> smoove <span className="ver">v{version}</span>
            <span className="alpha">alpha</span>
          </span>
          <h1>
            What you code
            <br />
            is what you play.
          </h1>
          <p className="sub">
            A timeline-driven animation engine. Animate any node's position, scale, rotation, and
            color, then sequence it, loop it, and play it back smoothly.
          </p>
          <StartTabs codingAgentsUrl={links.codingAgents} getStartedUrl={getStarted} />

          <div className="shields">
            <span className="shield">
              license <b>MIT</b>
            </span>
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
              A timeline and tweening engine, built on top of Konva. Free and open source under the
              MIT license.
            </p>
            <div className="social">
              <a href={GH_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <IconGithub />
              </a>
              <a
                href="https://www.npmjs.com/package/@smoove/core"
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
              <li>
                <Link to={links.codingAgents}>Coding agents</Link>
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

type Audience = "developer" | "agent";

// Agent first: describing the video to a coding agent is how smoove is meant
// to be written.
const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "agent", label: "Coding agent" },
  { id: "developer", label: "Developer" },
];

/**
 * How to start, for two readers: someone working through a coding agent gets a
 * prompt to paste (the default), a developer gets the scaffold command. Both
 * panels render on the server (the inactive one `hidden`), so an agent reading
 * the page sees both. `/#developer` opens on the developer tab.
 */
function StartTabs({
  codingAgentsUrl,
  getStartedUrl,
}: {
  codingAgentsUrl: string;
  getStartedUrl: string;
}) {
  const [active, setActive] = useState<Audience>("agent");
  const [ideaIndex, setIdeaIndex] = useState(0);
  const idea = VIDEO_IDEAS[ideaIndex] ?? VIDEO_IDEAS[0];
  const tabRefs = useRef<Record<Audience, HTMLButtonElement | null>>({
    developer: null,
    agent: null,
  });
  const id = useId();

  useEffect(() => {
    if (window.location.hash === "#developer") setActive("developer");
  }, []);

  // Arrow keys move between tabs (WAI-ARIA tabs pattern, automatic activation).
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = AUDIENCES.findIndex((a) => a.id === active);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % AUDIENCES.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + AUDIENCES.length) % AUDIENCES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = AUDIENCES.length - 1;
    else return;
    e.preventDefault();
    const to = AUDIENCES[next]?.id;
    if (!to) return;
    setActive(to);
    tabRefs.current[to]?.focus();
  };

  return (
    <div className="start">
      <div className="start__tabs" role="tablist" aria-label="How you'll build with smoove">
        {AUDIENCES.map((a) => (
          <button
            key={a.id}
            ref={(el) => {
              tabRefs.current[a.id] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${a.id}`}
            aria-selected={active === a.id}
            aria-controls={`${id}-panel-${a.id}`}
            tabIndex={active === a.id ? 0 : -1}
            className="start__tab"
            onClick={() => setActive(a.id)}
            onKeyDown={onKeyDown}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div
        className="start__panel"
        role="tabpanel"
        id={`${id}-panel-agent`}
        aria-labelledby={`${id}-tab-agent`}
        hidden={active !== "agent"}
      >
        <fieldset className="ideas" aria-label="Video ideas">
          {VIDEO_IDEAS.map((idea, i) => (
            <button
              key={idea.label}
              type="button"
              className="ideas__chip"
              aria-pressed={ideaIndex === i}
              onClick={() => setIdeaIndex(i)}
            >
              {idea.label}
            </button>
          ))}
        </fieldset>
        <div className="prompt-card">
          <div className="prompt-card__bar">
            <span>Paste this into your coding agent</span>
            <button type="button" className="prompt-card__copy" data-copy={agentPrompt(idea.video)}>
              <CopyIcons />
              <span className="copy-label">Copy prompt</span>
            </button>
          </div>
          <pre>
            {AGENT_PROMPT_LEAD}
            {"\n\n"}
            <span className="prompt-card__fill">{idea.video}</span>
          </pre>
        </div>
        <p className="start__hint">
          Pick an idea or write your own, then paste it into Claude Code, Cursor, Codex or any
          coding agent, in an empty folder. <Link to={codingAgentsUrl}>How it works</Link>
        </p>
      </div>

      <div
        className="start__panel"
        role="tabpanel"
        id={`${id}-panel-developer`}
        aria-labelledby={`${id}-tab-developer`}
        hidden={active !== "developer"}
      >
        <div className="copy-cmd">
          <span>
            <span className="prompt">$</span> {INSTALL_CMD}
          </span>
          <button type="button" data-copy={INSTALL_CMD} aria-label="Copy install command">
            <CopyIcons />
          </button>
        </div>
        <div className="hero__cta">
          <Link className="btn btn--primary" to={getStartedUrl}>
            Get started
            <IconArrowRight />
          </Link>
          <a className="btn btn--ghost" href={GH_URL} target="_blank" rel="noopener noreferrer">
            <IconGithub />
            View on GitHub
          </a>
        </div>
        <HeroCode />
      </div>
    </div>
  );
}

/** The static code sample shown on the Developer tab. */
function HeroCode() {
  return (
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
            {" fps = "}
            <span className="t-num">60</span>
            {";\n"}
            <span className="t-key">const</span>
            {" comp = "}
            <span className="t-key">new</span> <span className="t-fn">Composition</span>
            {"({\n"}
            {"  fps,\n"}
            {"  durationInFrames: fps * "}
            <span className="t-num">30</span>
            {",\n"}
            {"  width: "}
            <span className="t-num">1600</span>
            {",\n"}
            {"  height: "}
            <span className="t-num">900</span>
            {",\n"}
            {"});\n"}
            <span className="t-key">const</span>
            {" scene = "}
            <span className="t-key">new</span> <span className="t-fn">Sequence</span>
            {"();\n"}
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
            {"(scene);\n"}
            <span className="t-key">export default</span>
            {" comp;"}
          </code>
        </pre>
      </div>
    </div>
  );
}

function CopyIcons() {
  return (
    <>
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
    </>
  );
}
