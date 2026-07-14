import { Studio, useStudio } from "@smoove/studio";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { ClientOnly } from "../components/client-only.js";
import registry from "../registry.js";

export default function EditorRoute() {
  const store = useStudio();
  const [params] = useSearchParams();
  // The editor has no library sidebar, so nothing else selects a composition.
  // Load the one named by `?c=<id>` (written by the layout's onNavigate), or
  // fall back to the first registry entry — otherwise the stage stays blank and
  // getTimeline has no playhead to report.
  const id = params.get("c") ?? registry.entries()[0]?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable.
  useEffect(() => {
    if (id) store.syncSelected(id);
  }, [id]);

  return (
    <Studio.Main>
      <ClientOnly fallback={<div className="flex-1 min-h-0" />}>
        {() => (
          <>
            <Studio.Stage />
            <Studio.Timeline />
          </>
        )}
      </ClientOnly>
    </Studio.Main>
  );
}
