/* ============================================================
   KmStudio — Zod-driven form schema DSL  (kf)
   ------------------------------------------------------------
   Every field is a REAL Zod schema (so .safeParse works), tagged
   with a non-enumerable __km metadata object the renderer reads.
   Human-readable context is stored with Zod's native .describe(),
   and read back via schema._def.description.

   The builders are generic-preserving, so a schema's value type is
   inferred just like Zod:  type P = KmInfer<typeof mySchema>.

   Supported controls:
     text · multiline · color · boolean · select · multiselect
     number(*) · object · array · divider
   (* number is a practical addition beyond the core request)
   ============================================================ */
import { z } from "zod";

export type KmControl =
  | "text"
  | "multiline"
  | "color"
  | "boolean"
  | "number"
  | "select"
  | "multiselect"
  | "object"
  | "array"
  | "divider";

export type KmOption = { value: string; label: string; description?: string };
export type KmOptionInput = string | KmOption;

export type KmMeta = {
  control: KmControl;
  label?: string;
  description?: string;
  default?: unknown;
  placeholder?: string;
  rows?: number;
  swatches?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: KmOption[];
  /** object */
  fields?: [string, KmSchema][];
  collapsible?: boolean;
  collapsed?: boolean;
  /** array */
  item?: KmSchema;
  itemLabel?: string;
  addLabel?: string;
};

/** A Zod schema (of a specific shape S) carrying KmStudio renderer metadata. */
export type KmTag<S extends z.ZodTypeAny> = S & { __km: KmMeta };
/** The erased form — any tagged schema, for heterogeneous storage. */
export type KmSchema = KmTag<z.ZodTypeAny>;
/** Marks a divider pseudo-field so it's dropped from inferred value types. */
type KmDividerMark = { readonly __kmDivider: true };

/** Inferred value type of a schema — `type P = KmInfer<typeof schema>`. */
export type KmInfer<S extends KmSchema> = z.infer<S>;

/* curated swatch palette (studio violet + a spread of useful hues) */
export const KM_COLORS = ["#7c5cff", "#2dd4bf", "#ff8a3d", "#ff5d8f", "#56b8ff", "#ffffff"];

/* attach metadata + description without losing it through clones */
function tag(schema: z.ZodTypeAny, meta: KmMeta): KmSchema {
  const s = meta.description ? schema.describe(meta.description) : schema;
  Object.defineProperty(s, "__km", {
    value: meta,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return s as KmSchema;
}

/* normalize select options: "a" | {value,label,description} */
function normOpts(options: readonly KmOptionInput[] = []): KmOption[] {
  return options.map((o) =>
    typeof o === "string"
      ? { value: o, label: o }
      : { value: o.value, label: o.label ?? o.value, description: o.description },
  );
}

/* ---- type-level helpers for inference ---- */
/** The string value carried by a select/multiselect option literal. */
type OptValue<O> = O extends string
  ? O
  : O extends { value: infer V }
    ? V extends string
      ? V
      : never
    : never;
/** The inferred value of one tagged field (never for dividers). */
type KmOut<S> = S extends KmDividerMark ? never : S extends KmTag<infer Z> ? z.infer<Z> : never;
/** The inferred object value of an object's field record (dividers dropped). */
type FieldsOut<F> = {
  [K in keyof F as F[K] extends KmDividerMark ? never : K]: KmOut<F[K]>;
};

type TextOpts = {
  label?: string;
  description?: string;
  default?: string;
  placeholder?: string;
  min?: number;
  max?: number;
};
type MultilineOpts = TextOpts & { rows?: number };
type ColorOpts = {
  label?: string;
  description?: string;
  default?: string;
  swatches?: string[];
};
type BoolOpts = { label?: string; description?: string; default?: boolean };
type NumberOpts = {
  label?: string;
  description?: string;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};
type SelectOpts<O extends readonly KmOptionInput[]> = {
  label?: string;
  description?: string;
  default?: OptValue<O[number]>;
  options: O;
};
type ObjectOpts<F extends Record<string, KmSchema>> = {
  label?: string;
  description?: string;
  fields: F;
  collapsible?: boolean;
  collapsed?: boolean;
};
type ArrayOpts<I extends KmSchema> = {
  label?: string;
  description?: string;
  of: I;
  itemLabel?: string;
  addLabel?: string;
  default?: KmOut<I>[];
  min?: number;
  max?: number;
};
type DividerOpts = { label?: string };

export const kf = {
  /* ---- leaf controls ---- */
  text(o: TextOpts = {}): KmTag<z.ZodType<string>> {
    let s = z.string();
    if (o.min != null) s = s.min(o.min);
    if (o.max != null) s = s.max(o.max);
    return tag(s, {
      control: "text",
      label: o.label,
      description: o.description,
      default: o.default ?? "",
      placeholder: o.placeholder,
    }) as unknown as KmTag<z.ZodType<string>>;
  },
  multiline(o: MultilineOpts = {}): KmTag<z.ZodType<string>> {
    return tag(z.string(), {
      control: "multiline",
      label: o.label,
      description: o.description,
      default: o.default ?? "",
      placeholder: o.placeholder,
      rows: o.rows ?? 3,
    }) as unknown as KmTag<z.ZodType<string>>;
  },
  color(o: ColorOpts = {}): KmTag<z.ZodType<string>> {
    return tag(z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i), {
      control: "color",
      label: o.label,
      description: o.description,
      default: o.default ?? "#7c5cff",
      swatches: o.swatches || KM_COLORS,
    }) as unknown as KmTag<z.ZodType<string>>;
  },
  boolean(o: BoolOpts = {}): KmTag<z.ZodType<boolean>> {
    return tag(z.boolean(), {
      control: "boolean",
      label: o.label,
      description: o.description,
      default: o.default ?? false,
    }) as unknown as KmTag<z.ZodType<boolean>>;
  },
  number(o: NumberOpts = {}): KmTag<z.ZodType<number>> {
    let s = z.number();
    if (o.min != null) s = s.min(o.min);
    if (o.max != null) s = s.max(o.max);
    return tag(s, {
      control: "number",
      label: o.label,
      description: o.description,
      default: o.default ?? o.min ?? 0,
      min: o.min ?? 0,
      max: o.max ?? 100,
      step: o.step ?? 1,
      unit: o.unit,
    }) as unknown as KmTag<z.ZodType<number>>;
  },
  select<const O extends readonly KmOptionInput[]>(
    o: SelectOpts<O>,
  ): KmTag<z.ZodType<OptValue<O[number]>>> {
    const opts = normOpts(o.options);
    const values = opts.map((x) => x.value) as [string, ...string[]];
    return tag(z.enum(values), {
      control: "select",
      label: o.label,
      description: o.description,
      options: opts,
      default: o.default ?? opts[0]?.value,
    }) as unknown as KmTag<z.ZodType<OptValue<O[number]>>>;
  },
  multiselect<const O extends readonly KmOptionInput[]>(
    o: Omit<SelectOpts<O>, "default"> & { default?: OptValue<O[number]>[] },
  ): KmTag<z.ZodType<OptValue<O[number]>[]>> {
    const opts = normOpts(o.options);
    const values = opts.map((x) => x.value) as [string, ...string[]];
    return tag(z.array(z.enum(values)), {
      control: "multiselect",
      label: o.label,
      description: o.description,
      options: opts,
      default: o.default ?? [],
    }) as unknown as KmTag<z.ZodType<OptValue<O[number]>[]>>;
  },
  /* ---- containers ---- */
  object<F extends Record<string, KmSchema>>(o: ObjectOpts<F>): KmTag<z.ZodType<FieldsOut<F>>> {
    const fields = o.fields || ({} as F);
    // build zod shape, omitting divider pseudo-fields
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [k, sch] of Object.entries(fields)) {
      if (sch.__km && sch.__km.control !== "divider") shape[k] = sch;
    }
    return tag(z.object(shape), {
      control: "object",
      label: o.label,
      description: o.description,
      fields: Object.entries(fields) as [string, KmSchema][],
      collapsible: o.collapsible !== false,
      collapsed: o.collapsed || false,
    }) as unknown as KmTag<z.ZodType<FieldsOut<F>>>;
  },
  array<I extends KmSchema>(o: ArrayOpts<I>): KmTag<z.ZodType<KmOut<I>[]>> {
    const item = o.of;
    if (item?.__km && item.__km.control === "array") {
      throw new Error("kf.array: arrays of arrays are not allowed");
    }
    return tag(z.array(item), {
      control: "array",
      label: o.label,
      description: o.description,
      item,
      itemLabel: o.itemLabel || "Item",
      addLabel: o.addLabel,
      default: o.default,
      min: o.min,
      max: o.max,
    }) as unknown as KmTag<z.ZodType<KmOut<I>[]>>;
  },
  /* ---- visual only ---- */
  divider(o: DividerOpts = {}): KmTag<z.ZodType<undefined>> & KmDividerMark {
    return tag(z.any().optional(), {
      control: "divider",
      label: o.label,
    }) as unknown as KmTag<z.ZodType<undefined>> & KmDividerMark;
  },
};

/* ---- default value derivation ---- */
export function kmDefault(schema: KmSchema | undefined): unknown {
  const m = schema?.__km;
  if (!m) return undefined;
  switch (m.control) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, s] of m.fields ?? []) {
        if (s.__km.control !== "divider") out[k] = kmDefault(s);
      }
      return out;
    }
    case "array":
      return Array.isArray(m.default)
        ? m.default.map((v) => (v && typeof v === "object" ? structuredClone(v) : v))
        : [];
    case "multiselect":
      return Array.isArray(m.default) ? [...m.default] : [];
    default:
      return m.default;
  }
}

/* default for a fresh array item */
export function kmItemDefault(itemSchema: KmSchema): unknown {
  const d = kmDefault(itemSchema);
  return d && typeof d === "object" ? structuredClone(d) : d;
}

/* deep-merge user-supplied defaultProps over schema defaults (arrays replace) */
export function kmMerge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (Array.isArray(base) || Array.isArray(over)) {
    return over === undefined ? base : structuredClone(over);
  }
  if (base && typeof base === "object" && over && typeof over === "object") {
    const out: Record<string, unknown> = { ...(base as object) };
    for (const k of Object.keys(over as object)) {
      out[k] = kmMerge((base as Record<string, unknown>)[k], (over as Record<string, unknown>)[k]);
    }
    return out;
  }
  return over;
}
