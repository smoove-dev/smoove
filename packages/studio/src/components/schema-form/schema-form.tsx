import { useComposition } from "../../hooks/use-composition.js";
import { usePropsForm } from "../../hooks/use-props-form.js";
import { Icon } from "../icon/icon.js";
import { Field } from "./field.js";

/** Schema-driven props form for the active composition. */
export function SchemaForm() {
  const { selectedId, entry } = useComposition();
  const form = usePropsForm(selectedId);
  const fields = form.schema ? Object.entries(form.schema.fields) : [];
  const hasFields = fields.some(([, f]) => f.type !== "divider");

  if (!hasFields) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full text-ink-3 gap-3 py-10">
        <div className="size-11 rounded-xl bg-bg-2 grid place-items-center border border-line">
          <Icon name="sliders" size={20} />
        </div>
        <h4 className="m-0 text-[14px] text-ink-2 font-semibold">No props</h4>
        <p className="m-0 text-[12.5px] leading-relaxed max-w-[200px]">
          “{entry?.title ?? selectedId}” exposes no overridable settings.
        </p>
      </div>
    );
  }

  const values = form.values;
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10.5px] font-bold tracking-[.08em] uppercase text-ink-3">
          {entry?.title ?? selectedId} · props
        </div>
        <button
          type="button"
          onClick={form.reset}
          className="text-[11px] text-ink-2 bg-bg-2 border border-line rounded-full px-2.5 py-0.5 font-medium hover:text-ink-1 hover:border-line-2"
        >
          Reset
        </button>
      </div>
      {fields.map(([key, field]) => (
        <Field
          key={key}
          field={field}
          value={values[key]}
          onChange={(v) => form.setValue(key, v)}
        />
      ))}
    </>
  );
}
