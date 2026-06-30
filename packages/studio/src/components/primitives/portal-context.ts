import { createContext, useContext } from "react";

/**
 * Base UI portals (menus/dialogs/tooltips/toasts) render to `document.body` by
 * default. The Studio root provides a container that lives INSIDE the
 * `.smoove-studio` subtree so scoped base styles + theme tokens still apply; every
 * primitive routes its `*.Portal` through this container.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = (): HTMLElement | null => useContext(PortalContainerContext);
