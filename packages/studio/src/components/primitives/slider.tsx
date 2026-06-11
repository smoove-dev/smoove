import { Slider } from "@base-ui/react/slider";
import { cn } from "../../lib/cn.js";

export type StSliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export function StSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
}: StSliderProps) {
  return (
    <Slider.Root
      value={value}
      onValueChange={(v) => onValueChange(Array.isArray(v) ? (v[0] ?? 0) : v)}
      min={min}
      max={max}
      step={step}
      className={cn("flex-1", className)}
    >
      <Slider.Control className="flex items-center h-4 w-full cursor-pointer">
        <Slider.Track className="h-1 w-full rounded-full bg-bg-3 relative">
          <Slider.Indicator className="rounded-full bg-accent" />
          <Slider.Thumb className="size-[15px] rounded-full bg-accent-2 outline-none shadow-[0_0_0_3px_var(--color-accent-soft)] focus-visible:shadow-[0_0_0_4px_var(--color-accent-soft)]" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
