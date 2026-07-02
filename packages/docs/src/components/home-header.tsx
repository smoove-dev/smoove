import { Link } from "react-router";
import { Brand } from "./brand";
import { IconGithub } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const GH_URL = "https://github.com/smoove-dev/smoove";

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
        aria-label="smoove on GitHub"
      >
        <IconGithub />
        <span className="gh-name">GitHub</span>
      </a>
      <ThemeToggle />
    </header>
  );
}
