import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";

export function StTabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(v) => onValueChange(String(v))}
      className={cn("flex flex-col min-h-0 flex-1", className)}
    >
      {children}
    </Tabs.Root>
  );
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Tabs.List
      className={cn(
        "relative flex items-stretch h-14 flex-none border-b border-line px-1.5",
        className,
      )}
    >
      {children}
      <Tabs.Indicator className="absolute bottom-0 left-0 h-0.5 bg-accent rounded-full transition-all duration-200 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)]" />
    </Tabs.List>
  );
}

export function Tab({
  value,
  icon,
  children,
}: {
  value: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <Tabs.Tab
      value={value}
      className="relative flex items-center gap-1.5 px-3.5 text-[13px] font-semibold text-ink-3 hover:text-ink-2 data-[selected]:text-ink-1 cursor-default outline-none"
    >
      {icon && <Icon name={icon} size={15} />} {children}
    </Tabs.Tab>
  );
}

export function TabPanel({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tabs.Panel
      value={value}
      className={cn("flex-1 min-h-0 overflow-y-auto scroll outline-none", className)}
    >
      {children}
    </Tabs.Panel>
  );
}
