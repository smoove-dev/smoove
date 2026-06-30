// <smoove-player> is registered + styled by the standalone <script>/<link> tags in
// root.tsx (the dogfooded CDN-style distribution), so it is no longer bundled
// here. Doc pages embed live demos by dropping a <smoove-player> into their Markdown.
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
