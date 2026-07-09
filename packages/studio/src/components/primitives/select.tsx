import { Select } from "@base-ui/react/select";
import { cn } from "../../lib/cn.js";
import { Icon } from "../icon/icon.js";
import { usePortalContainer } from "./portal-context.js";

export type SelectOption = { value: string; label: string; desc?: string };

export type StSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
};

export function StSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
}: StSelectProps) {
  const container = usePortalContainer();
  const labelFor = (v: string): string => options.find((o) => o.value === v)?.label ?? placeholder;
  return (
    <Select.Root value={value} onValueChange={(v) => onValueChange(String(v))}>
      <Select.Trigger
        className={cn(
          "flex items-center justify-between gap-2 w-full bg-bg-2 border border-transparent rounded-control text-[13px] text-ink-1 px-3 py-2 text-left hover:bg-bg-3 data-[popup-open]:border-accent data-[popup-open]:shadow-[0_0_0_3px_var(--color-accent-soft)] outline-none",
          className,
        )}
      >
        <Select.Value className="truncate">{(val: string) => labelFor(val)}</Select.Value>
        <Select.Icon className="text-ink-3">
          <Icon name="chevron" size={13} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner sideOffset={5} className="z-50">
          <Select.Popup className="min-w-[var(--anchor-width)] max-h-72 overflow-y-auto scroll bg-bg-1/98 backdrop-blur-xl border border-line-2 rounded-ui p-1.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,.7)] outline-none origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="flex items-start gap-2 px-2.5 py-2 rounded-control text-[13px] text-ink-2 data-[highlighted]:bg-bg-3 data-[highlighted]:text-ink-1 data-[selected]:text-ink-1 cursor-default outline-none"
              >
                <Select.ItemText className="flex-1">
                  <span className="block">{o.label}</span>
                  {o.desc && <span className="block text-[11px] text-ink-3">{o.desc}</span>}
                </Select.ItemText>
                <Select.ItemIndicator className="text-accent-2 mt-0.5">
                  <Icon name="check" size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
