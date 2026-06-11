import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { IconButton } from "../button/icon-button.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";
import { usePortalContainer } from "./portal-context.js";

const popupCls = cn(
  "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col max-h-[calc(100vh-48px)]",
  "bg-bg-1 border border-line-2 rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] overflow-hidden outline-none",
  "transition-[transform,opacity] data-[starting-style]:opacity-0 data-[starting-style]:scale-[.97] data-[ending-style]:opacity-0 data-[ending-style]:scale-[.97]",
);

function DialogRoot({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

function DialogPopup({
  width = 480,
  children,
  className,
}: {
  width?: number;
  children: ReactNode;
  className?: string;
}) {
  const container = usePortalContainer();
  return (
    <Dialog.Portal container={container}>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-[rgba(6,6,9,.62)] backdrop-blur-[3px] transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
      <Dialog.Popup className={cn(popupCls, className)} style={{ width }}>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

function DialogHeader({ icon, title }: { icon?: IconName; title: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3.5 border-b border-line">
      {icon && (
        <span className="size-[30px] grid place-items-center rounded-ui bg-accent-soft text-accent-2 border border-accent-line">
          <Icon name={icon} size={16} />
        </span>
      )}
      <Dialog.Title className="text-[15px] font-bold tracking-tight flex-1">{title}</Dialog.Title>
      <Dialog.Close render={<IconButton size="sm" icon="close" aria-label="Close" />} />
    </div>
  );
}

const DialogBody = ({ children }: { children: ReactNode }) => (
  <div className="p-4 overflow-y-auto scroll">{children}</div>
);

const DialogFooter = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-t border-line bg-bg-0">{children}</div>
);

export const StDialog = Object.assign(DialogRoot, {
  Popup: DialogPopup,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
  Title: Dialog.Title,
  Description: Dialog.Description,
  Close: Dialog.Close,
  Trigger: Dialog.Trigger,
});
