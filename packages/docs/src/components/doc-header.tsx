import { Link } from "react-router";
import { Brand } from "./brand";
import { IconGithub, IconMenu } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const GH_URL = "https://github.com/konva-motion/konva-motion";

export function DocHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="doc-header">
      <button
        type="button"
        className="icon-btn menu-btn"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <IconMenu />
      </button>

      <Brand />

      <span className="doc-header__sep" aria-hidden="true" />
      <nav className="doc-header__links">
        <Link to="/docs" className="is-active">
          Docs
        </Link>
        <Link to="/docs">Examples</Link>
        <Link to="/docs">Changelog</Link>
      </nav>

      <span className="doc-header__spacer" />

      <span className="pill ver-pill">
        <span className="ver">v1.0.0</span>
      </span>
      <a
        className="gh-link gh-link--icon"
        href={GH_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="konva-motion on GitHub"
      >
        <IconGithub />
      </a>
      <ThemeToggle />
    </header>
  );
}
