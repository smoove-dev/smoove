import { Callout } from "fumadocs-ui/components/callout";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Badge } from "./badge";
import { Demo } from "./demo";
import { Prop } from "./prop";
import { PropsPlayground } from "./props-playground";

// MDX component map handed to every doc body. Fumadocs defaults (headings, code
// blocks with copy buttons, links, tables…) plus the components our content
// references: Callout/Steps from fumadocs-ui, and our Demo/Prop/Badge that
// replace the old `:::demo` / `:::prop` / `{{…}}` markdown-it containers.
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout,
    Steps,
    Step,
    Tab,
    Tabs,
    Demo,
    PropsPlayground,
    Prop,
    Badge,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
