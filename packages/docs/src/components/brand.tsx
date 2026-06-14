import { Link } from "react-router";
import { BrandMark } from "./icons";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`brand${className ? ` ${className}` : ""}`}
      aria-label="konva-motion home"
    >
      <span className="brand__mark">
        <BrandMark />
      </span>
      <span className="brand__word">
        konva<span className="dim">-motion</span>
      </span>
    </Link>
  );
}
