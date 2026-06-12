// Register the <km-player> custom element — browser-only entry, so this
// `customElements.define` side effect never runs during the Node SPA prerender.
import "@konva-motion/player";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
