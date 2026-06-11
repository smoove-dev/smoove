import type { CSSProperties } from "react";
import { type IconName, PATHS } from "./paths.js";

export type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/** Inline-SVG icon. `name` selects a glyph; `size` sets width/height (px). */
export function Icon({ name, size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      className={className}
      style={{ display: "block", flex: "0 0 auto", ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
