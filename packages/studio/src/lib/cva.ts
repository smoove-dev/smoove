import { cn } from "./cn.js";

type VariantMap = Record<string, Record<string, string>>;

type VariantProps<V extends VariantMap> = {
  [K in keyof V]?: keyof V[K];
};

type DefaultVariants<V extends VariantMap> = { [K in keyof V]?: keyof V[K] };

export type CvaConfig<V extends VariantMap> = {
  variants?: V;
  defaultVariants?: DefaultVariants<V>;
};

/**
 * cva-lite: build a className from a base + variant maps.
 *
 *   const button = cva("inline-flex …", {
 *     variants: { tone: { primary: "…", ghost: "…" } },
 *     defaultVariants: { tone: "ghost" },
 *   });
 *   button({ tone: "primary", className: "extra" });
 */
export function cva<V extends VariantMap>(base: string, config: CvaConfig<V> = {}) {
  const { variants = {} as V, defaultVariants = {} as DefaultVariants<V> } = config;
  return (props: VariantProps<V> & { className?: string } = {}): string => {
    const { className, ...rest } = props as Record<string, unknown> & { className?: string };
    const picks = (Object.keys(variants) as Array<keyof V>).map((key) => {
      const chosen = rest[key as string] !== undefined ? rest[key as string] : defaultVariants[key];
      const group = variants[key];
      return group && chosen != null ? group[chosen as string] : undefined;
    });
    return cn(base, ...picks, className);
  };
}
