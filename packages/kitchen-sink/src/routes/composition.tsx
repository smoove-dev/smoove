import { Studio, useSignalValue, useStudio } from "@smoove/studio";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ClientOnly } from "../components/client-only.js";
import type { Route } from "./+types/composition";

/** The studio view for a single composition: stage + timeline + inspector. */
export default function Composition({ params }: Route.ComponentProps) {
  const store = useStudio();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"render" | "frame" | null>(null);

  // Sync the active id from the route param (deep-links, back/forward).
  // biome-ignore lint/correctness/useExhaustiveDependencies: store is stable.
  useEffect(() => {
    store.syncSelected(params.id);
  }, [params.id]);

  const comp = useSignalValue(store.composition);
  const entry = store.getEntry(params.id);
  const sub = comp
    ? `${comp.width()}×${comp.height()} · ${(comp.durationInFrames.get() / comp.fps).toFixed(1)}s`
    : "loading…";

  return (
    <>
      <Studio.Main>
        <Studio.Header>
          <Studio.Menu icon="dots" tooltip="Menu">
            <Studio.Menu.Item icon="server" onClick={() => setDialog("render")}>
              Render…
            </Studio.Menu.Item>
            <Studio.Menu.Item icon="camera" onClick={() => setDialog("frame")}>
              Export frame…
            </Studio.Menu.Item>
            <Studio.Menu.Separator />
            <Studio.Menu.Item icon="queue" onClick={() => navigate("/queue")}>
              Render Queue
            </Studio.Menu.Item>
            <Studio.Menu.Item icon="spark" onClick={() => navigate("/")}>
              Home
            </Studio.Menu.Item>
          </Studio.Menu>
          <Studio.HeaderTitle icon="film" title={entry?.title ?? params.id} sub={sub} />
          <Studio.Spacer />
          <Studio.Zoom />
        </Studio.Header>
        <ClientOnly fallback={<div className="flex-1 min-h-0" />}>
          {() => <Studio.Stage />}
        </ClientOnly>
        <Studio.Timeline />
      </Studio.Main>

      <Studio.Panel />

      <Studio.RenderDialog
        open={dialog === "render"}
        onOpenChange={(o) => setDialog(o ? "render" : null)}
        onSubmitted={() => navigate("/queue")}
      />
      <Studio.ExportFrameDialog
        open={dialog === "frame"}
        onOpenChange={(o) => setDialog(o ? "frame" : null)}
      />
    </>
  );
}
