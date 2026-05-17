import type { Composition } from "@konva-motion/core";

export type DemoDef = {
  id: string;
  name: string;
  build: (container: string, width: number, height: number) => Composition;
};
