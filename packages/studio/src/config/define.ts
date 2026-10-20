/** The settings a project can change in `smoove.config.ts` without detaching the studio. */
export interface StudioConfig {
  /** The app name: the sidebar wordmark and the browser tab title. */
  name?: string;
  /** An image in the project, relative to `smoove.config.ts` (svg, png, jpg or webp). */
  logo?: string;
  /** Any CSS color. Sets the studio's accent: buttons, selection and the playhead. */
  primaryColor?: string;
  /** `false` turns rendering off: no render buttons, no queue, no render routes. Default `true`. */
  render?: boolean;
}

/** Types `smoove.config.ts`. Returns its argument unchanged. */
export function defineConfig(config: StudioConfig): StudioConfig {
  return config;
}
