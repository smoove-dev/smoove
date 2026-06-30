/** Field descriptors that drive the schema-driven props form. Authored fresh
    for the studio (a lightweight, typed descriptor DSL — see `kf`). */

export type FieldBase = {
  label?: string;
  description?: string;
};

export type TextField = FieldBase & {
  type: "text";
  default?: string;
  placeholder?: string;
};

export type MultilineField = FieldBase & {
  type: "multiline";
  default?: string;
  placeholder?: string;
  rows?: number;
};

export type ColorField = FieldBase & {
  type: "color";
  default?: string;
  /** Preset swatches shown alongside the hex input. */
  swatches?: string[];
};

export type BooleanField = FieldBase & {
  type: "boolean";
  default?: boolean;
};

export type NumberField = FieldBase & {
  type: "number";
  default?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

export type SelectOption = { value: string; label: string };

export type SelectField = FieldBase & {
  type: "select";
  default?: string;
  options: SelectOption[];
};

export type MultiselectField = FieldBase & {
  type: "multiselect";
  default?: string[];
  options: SelectOption[];
};

export type DividerField = {
  type: "divider";
  label?: string;
};

export type ObjectField = FieldBase & {
  type: "object";
  fields: Record<string, SmooveField>;
};

export type ArrayField = FieldBase & {
  type: "array";
  of: SmooveField;
  default?: unknown[];
  min?: number;
  max?: number;
  itemLabel?: string;
};

export type SmooveField =
  | TextField
  | MultilineField
  | ColorField
  | BooleanField
  | NumberField
  | SelectField
  | MultiselectField
  | DividerField
  | ObjectField
  | ArrayField;

/** The top-level schema is always an object of fields. */
export type SmooveSchema = ObjectField;
