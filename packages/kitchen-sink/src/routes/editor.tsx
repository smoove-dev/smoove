import { Studio, useStudio } from "@smoove/studio";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { ClientOnly } from "../components/client-only.js";
import editorRegistry from "../editor-registry.js";

/** The project starts empty — say so, instead of showing a blank stage. */
function EmptyProject() {
  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-2 text-center">
      <p className="font-display text-ink-1">No compositions yet</p>
      <p className="max-w-xs text-sm text-ink-3">
        Describe one in the chat and smoove will write it into the project.
      </p>
    </div>
  );
}

export default function EditorRoute() {
  const store = useStudio();
  const [params] = useSearchParams();
  // The editor has no library sidebar, so nothing else selects a composition.
  // Load the one named by `?c=<id>` (written by the layout's onNavigate), or
  // fall back to the first entry — otherwise the stage stays blank and
  // getTimeline has no playhead to report.
  const id = params.get("c") ?? editorRegistry.entries()[0]?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable.
  useEffect(() => {
    if (id) store.syncSelected(id);
  }, [id]);

  return (
    <Studio.Main>
      <ClientOnly fallback={<div className="flex-1 min-h-0" />}>
        {() =>
          id ? (
            <>
              <Studio.Stage />
              <Studio.Timeline />
            </>
          ) : (
            <EmptyProject />
          )
        }
      </ClientOnly>
    </Studio.Main>
  );
}
