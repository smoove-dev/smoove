// The modules the smooveStudio() Vite plugin (`@smoove/studio/vite`) serves to the studio app.

declare module "virtual:smoove/registry.ts" {
  import type { Registry } from "@smoove/studio";

  const registry: Registry;
  export default registry;
}

declare module "virtual:smoove/config" {
  /** The project's smoove.config.ts, checked, as the studio app sees it. */
  const config: {
    name: string | null;
    /** The logo's served URL. */
    logoUrl: string | null;
    primaryColor: string | null;
    render: boolean;
  };
  export default config;
}
