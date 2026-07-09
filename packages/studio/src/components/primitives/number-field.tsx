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
      <NumberField.Group className="flex items-stretch overflow-hidden bg-bg-2 border border-transparent rounded-control focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]">
        <NumberField.Input className="flex-1 min-w-0 w-full bg-transparent outline-none text-ink-1 border-0 font-mono text-[13px] px-3 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        {suffix && (
          <span className="flex items-center pr-3 text-[10.5px] font-bold text-ink-3 select-none">
            {suffix}
          </span>
        )}
      </NumberField.Group>
    </NumberField.Root>
  );
}
