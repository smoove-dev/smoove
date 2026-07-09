import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import type { SmooveField } from "../../schema/types.js";
import { Icon } from "../icon/icon.js";
import { StSelect } from "../primitives/select.js";
import { StSlider } from "../primitives/slider.js";
import { StSwitch } from "../primitives/switch.js";

type FieldProps = { field: SmooveField; value: unknown; onChange: (value: unknown) => void };

const labelCls = "text-[12.5px] text-ink-2 font-medium";
const inputCls =
  "w-full bg-bg-2 border border-transparent rounded-control text-[13px] text-ink-1 placeholder:text-ink-3 px-3 py-2 outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-soft)]";

export function Field({ field, value, onChange }: FieldProps) {
  switch (field.type) {
    case "divider":
      return (
        <div className="flex items-center gap-2.5 mt-5 mb-3 first:mt-0">
          {field.label && (
            <span className="text-[10.5px] font-bold tracking-[.08em] uppercase text-ink-3">
              {field.label}
            </span>
          )}
          <span className="flex-1 h-px bg-line" />
        </div>
      );

    case "boolean":
      return (
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className={labelCls}>{field.label}</span>
          <StSwitch checked={Boolean(value)} onCheckedChange={onChange} />
        </div>
      );

    case "text":
      return (
        <Labeled label={field.label} description={field.description}>
          <input
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          />
        </Labeled>
      );

    case "multiline":
      return (
        <Labeled label={field.label} description={field.description}>
          <textarea
            value={String(value ?? "")}
            placeholder={field.placeholder}
            rows={field.rows ?? 3}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputCls, "resize-y leading-relaxed")}
          />
        </Labeled>
      );

    case "number": {
      const num = typeof value === "number" ? value : (field.default ?? field.min ?? 0);
      const slider = field.min != null && field.max != null;
      return (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={labelCls}>{field.label}</span>
            <span className="font-mono text-[11.5px] text-ink-1 bg-bg-2 border border-line px-2 py-0.5 rounded-[5px]">
              {num}
              {field.unit ?? ""}
            </span>
          </div>
          {slider ? (
            <StSlider
              value={num}
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              onValueChange={onChange}
            />
          ) : (
            <input
              type="number"
              value={num}
              step={field.step ?? 1}
              onChange={(e) => onChange(Number(e.target.value))}
              className={inputCls}
            />
          )}
        </div>
      );
    }

    case "color": {
      const swatches = field.swatches ?? ["#ffffff", "#ff5640", "#2bd9c4", "#ff8a3d", "#ff5d8f"];
      const current = String(value ?? field.default ?? "#ffffff");
      return (
        <Labeled label={field.label} description={field.description}>
          <div className="flex gap-2 flex-wrap items-center">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className={cn(
                  "size-[26px] rounded-[7px] shadow-[0_0_0_1px_rgba(255,255,255,.1)_inset]",
                  current === c && "ring-2 ring-accent-2 ring-offset-2 ring-offset-bg-1",
                )}
                style={{ background: c }}
              />
            ))}
            <input
              value={current}
              onChange={(e) => onChange(e.target.value)}
              className="w-[88px] bg-bg-2 border border-transparent rounded-control text-[12px] font-mono text-ink-1 px-2 py-1.5 outline-none focus:border-line-2"
            />
          </div>
        </Labeled>
      );
    }

    case "select":
      return (
        <Labeled label={field.label} description={field.description}>
          <StSelect
            value={String(value ?? field.default ?? field.options[0]?.value ?? "")}
            onValueChange={onChange}
            options={field.options}
          />
        </Labeled>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (v: string) =>
        onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
      return (
        <Labeled label={field.label} description={field.description}>
          <div className="flex gap-1.5 flex-wrap">
            {field.options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={cn(
                    "text-[12px] font-medium rounded-full px-2.5 py-1 border transition-colors",
                    on
                      ? "bg-accent-soft border-accent-line text-white"
                      : "bg-bg-2 border-line text-ink-2 hover:text-ink-1",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </Labeled>
      );
    }

    case "object": {
      const obj = isObj(value) ? value : {};
      return (
        <div className="mb-4 rounded-ui border border-line bg-bg-2/40 p-3">
          {field.label && (
            <div className="text-[11px] font-bold tracking-[.06em] uppercase text-ink-3 mb-2.5">
              {field.label}
            </div>
          )}
          {Object.entries(field.fields).map(([k, f]) => (
            <Field
              key={k}
              field={f}
              value={obj[k]}
              onChange={(v) => onChange({ ...obj, [k]: v })}
            />
          ))}
        </div>
      );
    }

    case "array": {
      const items = Array.isArray(value) ? value : [];
      const setItem = (i: number, v: unknown) =>
        onChange(items.map((it, idx) => (idx === i ? v : it)));
      const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
      const move = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= items.length) return;
        const next = items.slice();
        const a = next[i];
        const b = next[j];
        next[i] = b;
        next[j] = a;
        onChange(next);
      };
      const add = () => onChange([...items, defaultItem(field.of)]);
      const atMax = field.max != null && items.length >= field.max;
      const atMin = field.min != null && items.length <= field.min;
      return (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={labelCls}>{field.label}</span>
            <span className="text-[10.5px] font-mono text-ink-3">{items.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {items.map((it, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: array items are positional
              <div key={i} className="rounded-control border border-line bg-bg-2/40 p-2.5">
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[10.5px] font-mono text-ink-3 flex-1">
                    {field.itemLabel ?? "Item"} {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="size-6 grid place-items-center rounded text-ink-3 hover:text-ink-1 hover:bg-bg-3 disabled:opacity-30 rotate-180"
                    title="Move up"
                  >
                    <Icon name="chevron" size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    className="size-6 grid place-items-center rounded text-ink-3 hover:text-ink-1 hover:bg-bg-3 disabled:opacity-30"
                    title="Move down"
                  >
                    <Icon name="chevron" size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={atMin}
                    className="size-6 grid place-items-center rounded text-ink-3 hover:text-danger hover:bg-danger/12 disabled:opacity-30"
                    title="Remove"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <Field field={field.of} value={it} onChange={(v) => setItem(i, v)} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={add}
            disabled={atMax}
            className="mt-2 flex items-center justify-center gap-1.5 w-full text-[12px] font-medium text-ink-2 bg-bg-2 border border-line border-dashed rounded-control py-2 hover:text-ink-1 hover:border-line-2 disabled:opacity-40"
          >
            <Icon name="plus" size={14} /> Add {field.itemLabel ?? "item"}
          </button>
        </div>
      );
    }
  }
}

function Labeled({
  label,
  description,
  children,
}: {
  label?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      {label && <div className={cn(labelCls, "mb-2")}>{label}</div>}
      {children}
      {description && (
        <div className="text-[11px] text-ink-3 mt-1.5 leading-relaxed">{description}</div>
      )}
    </div>
  );
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function defaultItem(field: SmooveField): unknown {
  switch (field.type) {
    case "object": {
      const o: Record<string, unknown> = {};
      for (const [k, f] of Object.entries(field.fields)) {
        if (f.type !== "divider") o[k] = defaultItem(f);
      }
      return o;
    }
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
    case "array":
      return field.default ?? [];
    default:
      return undefined;
  }
}
