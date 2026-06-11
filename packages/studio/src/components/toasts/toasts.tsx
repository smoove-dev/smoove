import { Toast } from "@base-ui/react/toast";
import { type CSSProperties, useEffect } from "react";
import { useStudio } from "../../hooks/use-studio.js";
import { Icon } from "../icon/icon.js";
import type { IconName } from "../icon/paths.js";
import { usePortalContainer } from "../primitives/portal-context.js";

type ToastData = { icon?: IconName };

/** Toast viewport (Base UI Toast). Registers the store's toast sink so
    store.addToast routes through the manager (auto-dismiss + a11y). */
export function Toasts() {
  const store = useStudio();
  const container = usePortalContainer();
  const manager = Toast.useToastManager();

  useEffect(() => {
    store.setToastSink((title, icon) =>
      manager.add({ title, data: { icon } satisfies ToastData, timeout: 3600 }),
    );
    return () => store.setToastSink(null);
  }, [manager, store]);

  return (
    <Toast.Portal container={container}>
      <Toast.Viewport className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[320px] outline-none">
        {manager.toasts.map((t) => {
          const icon = (t.data as ToastData | undefined)?.icon ?? "check";
          return (
            <Toast.Root
              key={t.id}
              toast={t}
              className="flex items-center gap-2.5 bg-bg-1/97 backdrop-blur-xl border border-line-2 rounded-ui px-3.5 py-2.5 text-[13px] font-medium text-ink-1 shadow-[0_18px_44px_-12px_rgba(0,0,0,.7)] data-[starting-style]:opacity-0 data-[starting-style]:translate-y-3 data-[ending-style]:opacity-0 transition-all"
              style={{ "--gap": "8px" } as CSSProperties}
            >
              <span className="size-[18px] grid place-items-center text-accent-2 flex-none">
                <Icon name={icon} size={14} />
              </span>
              <Toast.Title className="flex-1" />
              <Toast.Close className="text-ink-3 hover:text-ink-1">
                <Icon name="close" size={13} />
              </Toast.Close>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
