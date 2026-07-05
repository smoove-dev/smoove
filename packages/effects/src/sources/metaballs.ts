import { metaballsFragmentShader } from "../glsl/vendor/metaballs.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react metaballs.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#6e33cc", "#ff5500", "#ffc105", "#ffc800", "#f585ff"],
    max: 8,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  count: { type: "number", uniform: "u_count", default: 10, min: 1, max: 20, step: 1 },
  // Upstream calls this `size`; renamed because Konva.Shape already has size().
  ballSize: { type: "number", uniform: "u_size", default: 0.83, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type MetaballsConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  count?: number;
  ballSize?: number;
  speed?: number;
};

export class Metaballs extends ShaderSource {
  constructor(config: MetaballsConfig = {}) {
    super(SCHEMA, metaballsFragmentShader, config);
  }
}

export interface Metaballs {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  count(): number;
  count(v: number): this;
  ballSize(): number;
  ballSize(v: number): this;
  speed(): number;
  speed(v: number): this;
}
