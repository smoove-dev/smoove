// Register the <km-player> custom element — browser-only entry, so this
// `customElements.define` side effect never runs during SSR. Doc pages can then
// embed live demos by dropping a <km-player> into their Markdown.
import "@konva-motion/player";
// Opt-in default styling for the player chrome (control bar, overlay, colors).
import "@konva-motion/player/styles.css";
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
