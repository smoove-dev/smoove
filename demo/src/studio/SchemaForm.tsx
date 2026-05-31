/* ============================================================
   KmStudio — SchemaForm: renders a kf/Zod schema as a form.
   Reads __km metadata + Zod's .describe() text. Fully controlled.
   ============================================================ */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import { type KmMeta, type KmOption, type KmSchema, kmItemDefault } from "./kf.js";

const HEX6 = /^#[0-9a-f]{6}$/i;

const desc = (schema: KmSchema, m: KmMeta): string | null =>
  schema?._def?.description || m?.description || null;

type ChangeFn = (value: unknown) => void;

/* ---------- small shared dropdown (matches zoom menu) ---------- */
function Dropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: unknown;
  options: KmOption[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find((o) => o.value === value);
  return (
    <div className={`kf-dd${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="kf-dd-btn" onClick={() => setOpen((o) => !o)}>
        <span className={cur ? "" : "kf-dd-ph"}>{cur ? cur.label : placeholder || "Select…"}</span>
        <span className="kf-dd-chev">
          <Icon name="chevron" size={13} />
        </span>
      </button>
      {open && (
        <div className="kf-dd-menu scroll">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              className={`kf-dd-item${o.value === value ? " sel" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="kf-dd-lbl">
                {o.label}
                {o.description && <span className="kf-dd-od">{o.description}</span>}
              </span>
              {o.value === value && (
                <span className="kf-dd-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- leaf field shell ---------- */
function FieldShell({
  label,
  description,
  children,
}: {
  label?: string;
  description?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="kf-field">
      {(label || description) && (
        <div className="kf-field-head">{label && <span className="kf-label">{label}</span>}</div>
      )}
      {children}
      {description && <div className="kf-desc">{description}</div>}
    </div>
  );
}

type CtrlProps = { schema: KmSchema; m: KmMeta; value: unknown; onChange: ChangeFn };

/* ---------- controls ---------- */
function KText({ schema, m, value, onChange }: CtrlProps) {
  return (
    <FieldShell label={m.label} description={desc(schema, m)}>
      <input
        className="kf-input"
        type="text"
        value={(value as string) ?? ""}
        placeholder={m.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}
function KMultiline({ schema, m, value, onChange }: CtrlProps) {
  return (
    <FieldShell label={m.label} description={desc(schema, m)}>
      <textarea
        className="kf-input kf-textarea"
        rows={m.rows}
        value={(value as string) ?? ""}
        placeholder={m.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}
function KNumber({ schema, m, value, onChange }: CtrlProps) {
  const v = (value as number) ?? m.min ?? 0;
  return (
    <FieldShell label={m.label} description={desc(schema, m)}>
      <div className="kf-num">
        <input
          className="kf-range"
          type="range"
          min={m.min}
          max={m.max}
          step={m.step}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="kf-num-val">
          {v}
          {m.unit || ""}
        </span>
      </div>
    </FieldShell>
  );
}
function KColor({ schema, m, value, onChange }: CtrlProps) {
  const v = (value as string) ?? "";
  return (
    <FieldShell label={m.label} description={desc(schema, m)}>
      <div className="kf-color">
        <div className="kf-swatches">
          {(m.swatches ?? []).map((c) => (
            <button
              type="button"
              key={c}
              className={`kf-swatch${v.toLowerCase() === c.toLowerCase() ? " sel" : ""}`}
              style={{ background: c }}
              onClick={() => onChange(c)}
              title={c}
            />
          ))}
          <label className="kf-swatch kf-swatch-custom" title="Custom color">
            <input
              type="color"
              value={HEX6.test(v) ? v : "#7c5cff"}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
        </div>
        <div className="kf-hex">
          <span className="kf-hex-dot" style={{ background: v }} />
          <input
            className="kf-hex-input"
            value={v}
            maxLength={7}
            onChange={(e) => {
              let next = e.target.value;
              if (next && next[0] !== "#") next = `#${next}`;
              onChange(next);
            }}
          />
        </div>
      </div>
    </FieldShell>
  );
}
function KBool({ schema, m, value, onChange }: CtrlProps) {
  return (
    <div className="kf-field kf-bool-field">
      <div className="kf-bool-row">
        <div className="kf-bool-text">
          {m.label && <span className="kf-label">{m.label}</span>}
          {desc(schema, m) && (
            <div className="kf-desc" style={{ marginTop: 2 }}>
              {desc(schema, m)}
            </div>
          )}
        </div>
        <button
          type="button"
          className={`toggle${value ? " on" : ""}`}
          onClick={() => onChange(!value)}
          aria-pressed={!!value}
        />
      </div>
    </div>
  );
}
function KSelect({ schema, m, value, onChange }: CtrlProps) {
  return (
    <FieldShell label={m.label} description={desc(schema, m)}>
      <Dropdown value={value} options={m.options ?? []} onChange={onChange} />
    </FieldShell>
  );
}
function KMultiselect({ schema, m, value, onChange }: CtrlProps) {
  const vals = (value as string[]) ?? [];
  const toggle = (v: string) =>
    onChange(vals.includes(v) ? vals.filter((x) => x !== v) : [...vals, v]);
  return (
    <FieldShell label={m.label} description={desc(schema, m)}>
      <div className="kf-chips">
        {(m.options ?? []).map((o) => {
          const on = vals.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              className={`kf-chip${on ? " on" : ""}`}
              onClick={() => toggle(o.value)}
            >
              {on && (
                <span className="kf-chip-check">
                  <Icon name="check" size={12} />
                </span>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}
function KDivider({ m }: { m: KmMeta }) {
  return (
    <div className="kf-divider">
      {m.label ? (
        <span className="kf-divider-label">{m.label}</span>
      ) : (
        <span className="kf-divider-line" />
      )}
    </div>
  );
}

/* ---------- object container ---------- */
function KObject({
  schema,
  m,
  value,
  onChange,
  depth,
  root,
}: CtrlProps & { depth: number; root?: boolean }) {
  const [open, setOpen] = useState(!m.collapsed);
  const obj = (value as Record<string, unknown>) ?? {};
  const setKey = (k: string, v: unknown) => onChange({ ...obj, [k]: v });
  const body = (
    <div className="kf-object-body">
      {(m.fields ?? []).map(([k, s], i) =>
        s.__km.control === "divider" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: dividers have no value/identity
          <KDivider key={`d${i}`} m={s.__km} />
        ) : (
          <Field
            key={k}
            schema={s}
            value={obj[k]}
            onChange={(v) => setKey(k, v)}
            depth={depth + 1}
          />
        ),
      )}
    </div>
  );
  if (root) return body;
  return (
    <div className="kf-field">
      <div className={`kf-object${open ? "" : " collapsed"}`}>
        <button
          type="button"
          className="kf-object-head"
          onClick={() => m.collapsible && setOpen((o) => !o)}
        >
          {m.collapsible && (
            <span className="kf-object-chev">
              <Icon name="chevron" size={13} />
            </span>
          )}
          <span className="kf-object-title">{m.label || "Group"}</span>
        </button>
        {desc(schema, m) && open && <div className="kf-object-desc">{desc(schema, m)}</div>}
        {open && body}
      </div>
    </div>
  );
}

/* ---------- array container ---------- */
function KArray({ schema, m, value, onChange, depth }: CtrlProps & { depth: number }) {
  const [dragI, setDragI] = useState<number | null>(null);
  const [overI, setOverI] = useState<number | null>(null);
  const list = (value as unknown[]) ?? [];
  const item = m.item as KmSchema;
  const isObjectItem = item.__km.control === "object";
  const atMax = m.max != null && list.length >= m.max;
  const atMin = m.min != null && list.length <= m.min;
  const itemLabel = m.itemLabel ?? "Item";

  const add = () => {
    if (!atMax) onChange([...list, kmItemDefault(item)]);
  };
  const removeAt = (i: number) => {
    if (!atMin) onChange(list.filter((_, j) => j !== i));
  };
  const setAt = (i: number, v: unknown) => onChange(list.map((x, j) => (j === i ? v : x)));
  const move = (from: number | null, to: number | null) => {
    if (from == null || to == null || from === to) return;
    const a = [...list];
    const [x] = a.splice(from, 1);
    a.splice(to, 0, x);
    onChange(a);
  };

  return (
    <div className="kf-field">
      <div className="kf-array">
        <div className="kf-array-head">
          <span className="kf-label">{m.label || "Items"}</span>
          <span className="kf-array-count">
            {list.length}
            {m.max ? `/${m.max}` : ""}
          </span>
        </div>
        {desc(schema, m) && <div className="kf-desc kf-array-desc">{desc(schema, m)}</div>}

        <div className="kf-array-list">
          {list.length === 0 && <div className="kf-array-empty">No items yet — add one below.</div>}
          {list.map((v, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: array order is the identity here
              key={i}
              className={`kf-item${isObjectItem ? " obj" : " leaf"}${
                overI === i && dragI !== null ? " over" : ""
              }${dragI === i ? " dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverI(i);
              }}
              onDrop={() => {
                move(dragI, i);
                setDragI(null);
                setOverI(null);
              }}
            >
              <div
                className="kf-item-grip"
                draggable
                onDragStart={(e) => {
                  setDragI(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragI(null);
                  setOverI(null);
                }}
                title="Drag to reorder"
              >
                <Icon name="grip" size={14} />
              </div>
              {isObjectItem ? (
                <div className="kf-item-body">
                  <div className="kf-item-head">
                    <span className="kf-item-index">{String(i + 1).padStart(2, "0")}</span>
                    <span className="kf-item-name">
                      {itemLabel} {i + 1}
                    </span>
                    <button
                      type="button"
                      className="kf-item-x"
                      onClick={() => removeAt(i)}
                      disabled={atMin}
                      title="Remove"
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                  <Field
                    schema={item}
                    value={v}
                    onChange={(nv) => setAt(i, nv)}
                    depth={depth + 1}
                    root
                  />
                </div>
              ) : (
                <div className="kf-item-leaf">
                  <div className="kf-item-leaf-control">
                    <Field
                      schema={item}
                      value={v}
                      onChange={(nv) => setAt(i, nv)}
                      depth={depth + 1}
                      leafInline
                    />
                  </div>
                  <button
                    type="button"
                    className="kf-item-x"
                    onClick={() => removeAt(i)}
                    disabled={atMin}
                    title="Remove"
                  >
                    <Icon name="close" size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="button" className="kf-add" onClick={add} disabled={atMax}>
          <Icon name="plus" size={14} /> {m.addLabel || `Add ${itemLabel.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}

/* compact color for primitive array rows */
function InlineColor({ m, value, onChange }: { m: KmMeta; value: unknown; onChange: ChangeFn }) {
  const v = (value as string) ?? "";
  return (
    <div className="kf-inline-color">
      <label className="kf-swatch kf-swatch-custom" style={{ background: v }} title="Pick color">
        <input
          type="color"
          value={HEX6.test(v) ? v : "#7c5cff"}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <input
        className="kf-hex-input"
        value={v}
        maxLength={7}
        onChange={(e) => {
          let next = e.target.value;
          if (next && next[0] !== "#") next = `#${next}`;
          onChange(next);
        }}
      />
    </div>
  );
}

/* ---------- dispatcher ---------- */
function Field({
  schema,
  value,
  onChange,
  depth = 0,
  root,
  leafInline,
}: {
  schema: KmSchema;
  value: unknown;
  onChange: ChangeFn;
  depth?: number;
  root?: boolean;
  leafInline?: boolean;
}) {
  const m = schema.__km;
  if (!m) return null;
  const props: CtrlProps = { schema, m, value, onChange };
  switch (m.control) {
    case "text":
      return leafInline ? (
        <input
          className="kf-input"
          type="text"
          value={(value as string) ?? ""}
          placeholder={m.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <KText {...props} />
      );
    case "multiline":
      return <KMultiline {...props} />;
    case "number":
      return <KNumber {...props} />;
    case "color":
      return leafInline ? (
        <InlineColor m={m} value={value} onChange={onChange} />
      ) : (
        <KColor {...props} />
      );
    case "boolean":
      return <KBool {...props} />;
    case "select":
      return leafInline ? (
        <Dropdown value={value} options={m.options ?? []} onChange={onChange} />
      ) : (
        <KSelect {...props} />
      );
    case "multiselect":
      return <KMultiselect {...props} />;
    case "object":
      return <KObject {...props} depth={depth} root={root} />;
    case "array":
      return <KArray {...props} depth={depth} />;
    case "divider":
      return <KDivider m={m} />;
    default:
      return null;
  }
}

/* ---------- top-level form ---------- */
export function SchemaForm({
  schema,
  value,
  onChange,
}: {
  schema: KmSchema;
  value: unknown;
  onChange: ChangeFn;
}) {
  if (!schema?.__km || schema.__km.control !== "object") return null;
  return (
    <div className="kf-form">
      <KObject schema={schema} m={schema.__km} value={value} onChange={onChange} depth={0} root />
    </div>
  );
}
