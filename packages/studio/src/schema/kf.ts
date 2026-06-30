import type {
  ArrayField,
  BooleanField,
  ColorField,
  DividerField,
  SmooveField,
  SmooveSchema,
  MultilineField,
  MultiselectField,
  NumberField,
  ObjectField,
  SelectField,
  TextField,
} from "./types.js";

/**
 * `kf` — the studio's field-descriptor builder. Each call returns a plain
 * descriptor object; `kf.object({...})` is the top-level schema you attach to a
 * registry entry's `propsSchema`. The form renders these and writes values back
 * into the composition's props signal.
 */
export const kf = {
  text: (o: Omit<TextField, "type"> = {}): TextField => ({ type: "text", ...o }),
  multiline: (o: Omit<MultilineField, "type"> = {}): MultilineField => ({
    type: "multiline",
    ...o,
  }),
  color: (o: Omit<ColorField, "type"> = {}): ColorField => ({ type: "color", ...o }),
  boolean: (o: Omit<BooleanField, "type"> = {}): BooleanField => ({ type: "boolean", ...o }),
  number: (o: Omit<NumberField, "type"> = {}): NumberField => ({ type: "number", ...o }),
  select: (o: Omit<SelectField, "type">): SelectField => ({ type: "select", ...o }),
  multiselect: (o: Omit<MultiselectField, "type">): MultiselectField => ({
    type: "multiselect",
    ...o,
  }),
  divider: (o: Omit<DividerField, "type"> = {}): DividerField => ({ type: "divider", ...o }),
  object: (o: Omit<ObjectField, "type">): ObjectField => ({ type: "object", ...o }),
  array: (o: Omit<ArrayField, "type">): ArrayField => ({ type: "array", ...o }),
};

/** Fields with a value (everything but dividers) — used by the form + defaults. */
export function isValueField(f: SmooveField): f is Exclude<SmooveField, DividerField> {
  return f.type !== "divider";
}

/** Derive a default value for a single field. */
export function defaultForField(field: SmooveField): unknown {
  switch (field.type) {
    case "divider":
      return undefined;
    case "text":
    case "multiline":
      return field.default ?? "";
    case "color":
      return field.default ?? "#ffffff";
    case "boolean":
      return field.default ?? false;
    case "number":
      return field.default ?? field.min ?? 0;
    case "select":
      return field.default ?? field.options[0]?.value ?? "";
    case "multiselect":
      return field.default ?? [];
    case "object":
      return defaultsFor(field);
    case "array":
      return field.default ? [...field.default] : [];
  }
}

/** Build the default value record for an object schema (skips dividers). */
export function defaultsFor(schema: ObjectField): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.fields)) {
    if (!isValueField(field)) continue;
    out[key] = defaultForField(field);
  }
  return out;
}

/** Defaults for a schema, deep-merged with caller-supplied overrides. */
export function resolveDefaults(
  schema: SmooveSchema | undefined,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const base = schema ? defaultsFor(schema) : {};
  return overrides ? deepMerge(base, overrides) : base;
}

function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const prev = out[k];
    if (isPlainObject(prev) && isPlainObject(v)) out[k] = deepMerge(prev, v);
    else out[k] = v; // arrays + primitives replace
  }
  return out;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
