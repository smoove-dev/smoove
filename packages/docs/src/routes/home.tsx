import { Link } from "react-router";
import { HomeHeader } from "../components/home-header";
import {
  BrandMark,
  IconArrowRight,
  IconBook,
  IconCube,
  IconDiscord,
  IconGithub,
  IconNpm,
  IconStar,
  IconTimeline,
  IconType,
  IconX,
} from "../components/icons";
import { useCopyButtons } from "../components/use-copy-buttons";
import { getAllDocs, getFirstDocSlug } from "../lib/content.server";
import "../styles/home.css";
import type { Route } from "./+types/home";

const GH_URL = "https://github.com/konva-motion/konva-motion";
const INSTALL_CMD = "npm install konva-motion";

export function loader() {
  const docs = getAllDocs();
  const has = (slug: string) => docs.some((d) => d.slug === slug);
  const link = (slug: string) => (has(slug) ? `/docs/${slug}` : "/docs");
  return {
    getStarted: getFirstDocSlug() ? `/docs/${getFirstDocSlug()}` : "/docs",
    links: {
      introduction: link("introduction"),
      installation: link("installation"),
      concepts: link("core-concepts"),
      components: link("components"),
    },
  };
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: "konva-motion · Declarative motion for the canvas" },
    {
      name: "description",
      content:
        "konva-motion adds a timeline and tweening engine to Konva — animate any node, sequence and loop it, and play it back smoothly.",
    },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { getStarted, links } = loaderData;
  useCopyButtons();

  return (
    <>
      <HomeHeader />

      <section className="hero">
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__glow" aria-hidden="true" />

        <div className="hero__inner">
          <span className="pill">
            <span className="dot" /> Konva animation toolkit <span className="ver">v1.0.0</span>
          </span>
          <h1>
            Declarative <span className="grad">motion</span>
            <br />
            for the canvas.
          </h1>
          <p className="sub">
            konva-motion adds a timeline and tweens to Konva. Animate any node — position, scale,
            rotation, color — then sequence it, loop it, and play it back smoothly.
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
              <IconNpm />
              npm <span className="v">v1.0.0</span>
            </span>
            <span className="shield">
              license <b>MIT</b>
            </span>
            <span className="shield">
              <IconStar />
              stars <b>2.4k</b>
            </span>
            <span className="shield">
              minzip <b>7.8&nbsp;kB</b>
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
              <code className="language-javascript">{`const tl = new Timeline();

tl.to(circle, {
  x: 480,
  scaleX: 1.4,
  duration: 0.8,
  easing: easeOut,
});

tl.play();`}</code>
            </pre>
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
              What konva-motion is, how the timeline drives tweens, and when to reach for it.
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
              Add the package, create a Konva Stage, and play your first tween.
            </p>
          </Link>
          <Link className="qcard" to={links.concepts}>
            <span className="qcard__icon">
              <IconTimeline />
            </span>
            <span className="qcard__title">
              Core concepts <span className="arr">→</span>
            </span>
            <p className="qcard__desc">Timelines, easing, springs, and composing sequences.</p>
          </Link>
          <Link className="qcard" to={links.components}>
            <span className="qcard__icon">
              <IconType />
            </span>
            <span className="qcard__title">
              Components &amp; type <span className="arr">→</span>
            </span>
            <p className="qcard__desc">The full reference of every documented content component.</p>
          </Link>
        </div>
      </section>

      <footer className="home-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link className="brand" to="/">
              <span className="brand__mark">
                <BrandMark />
              </span>
              <span className="brand__word">
                konva<span className="dim">-motion</span>
              </span>
            </Link>
            <p>
              A timeline and tweening engine for Konva. Free and open source under the MIT license.
            </p>
            <div className="social">
              <a href={GH_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <IconGithub />
              </a>
              <a
                href="https://www.npmjs.com/package/konva-motion"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="npm"
              >
                <IconNpm />
              </a>
              <a
                href="https://x.com/konvamotion"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X / Twitter"
              >
                <IconX />
              </a>
              <a
                href="https://discord.gg/konva-motion"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord"
              >
                <IconDiscord />
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
                <Link to={links.components}>Components</Link>
              </li>
              <li>
                <Link to="/docs">API reference</Link>
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
                <a href={`${GH_URL}/discussions`} target="_blank" rel="noopener noreferrer">
                  Discussions
                </a>
              </li>
              <li>
                <a href="https://discord.gg/konva-motion" target="_blank" rel="noopener noreferrer">
                  Discord
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

          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li>
                <Link to="/docs">Changelog</Link>
              </li>
              <li>
                <Link to="/docs">Examples</Link>
              </li>
              <li>
                <a
                  href="https://www.npmjs.com/package/konva-motion"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  npm package
                </a>
              </li>
              <li>
                <a href={`${GH_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
                  License
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 konva-motion · Released under the MIT License</span>
          <span className="spacer" />
          <span>Built with the konva-motion design system</span>
        </div>
      </footer>
    </>
  );
}
