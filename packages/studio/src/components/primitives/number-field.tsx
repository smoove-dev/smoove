import { NumberField } from "@base-ui/react/number-field";
import { cn } from "../../lib/cn.js";

export type StNumberFieldProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Short unit suffix shown inside the field (e.g. "W", "H", "fps"). */
  suffix?: string;
  className?: string;
};

export function StNumberField({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  suffix,
  className,
}: StNumberFieldProps) {
  return (
    <NumberField.Root
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange(v ?? min ?? 0)}
      className={cn("flex-1", className)}
    >
      <NumberField.Group className="flex items-center bg-bg-2 border border-line rounded-control pr-2.5 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]">
        <NumberField.Input className="flex-1 min-w-0 w-full bg-transparent outline-none text-ink-1 font-mono text-[13px] px-2.5 py-2.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        {suffix && <span className="text-[10.5px] font-bold text-ink-3">{suffix}</span>}
      </NumberField.Group>
    </NumberField.Root>
  );
}
