import { Link } from "react-router";
import { Brand } from "./brand";
import { IconGithub, IconStar } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const GH_URL = "https://github.com/konva-motion/konva-motion";

export function HomeHeader() {
  return (
    <header className="home-header">
      <Brand />
      <span className="spacer" />
      <nav className="home-header__links">
        <Link to="/docs/introduction">Docs</Link>
      </nav>
      <a
        className="gh-link"
        href={GH_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="konva-motion on GitHub"
      >
        <IconGithub />
        <span className="gh-name">GitHub</span>
        <span className="stars">
          <IconStar />
          0
        </span>
      </a>
      <ThemeToggle />
    </header>
  );
}
