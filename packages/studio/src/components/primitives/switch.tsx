import { Switch } from "@base-ui/react/switch";

export function StSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="w-10 h-[23px] rounded-full bg-bg-3 data-[checked]:bg-accent relative transition-colors cursor-pointer flex-none outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <Switch.Thumb className="block size-[17px] rounded-full bg-white absolute top-[3px] left-[3px] transition-transform data-[checked]:translate-x-[17px]" />
    </Switch.Root>
  );
}
