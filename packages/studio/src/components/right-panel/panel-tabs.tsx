import { useComposition } from "../../hooks/use-composition.js";
import { useStudio } from "../../hooks/use-studio.js";
import { useSignalValue } from "../../signals/signal-bridge.js";
import { IconButton } from "../button/icon-button.js";
import { Icon } from "../icon/icon.js";
import { StTabs, Tab, TabList, TabPanel } from "../primitives/tabs.js";
import { StTooltip } from "../primitives/tooltip.js";
import { SchemaForm } from "../schema-form/schema-form.js";

/** Props (schema form) / Info tabs for the active composition. */
export function PanelTabs() {
  const store = useStudio();
  const tab = useSignalValue(store.panelTab);
  const { composition: comp, entry } = useComposition();

  return (
    <StTabs value={tab} onValueChange={(v) => store.setPanelTab(v as "props" | "info")}>
      <TabList>
        <Tab value="props" icon="sliders">
          Props
        </Tab>
        <Tab value="info" icon="info">
          Info
        </Tab>
        <div className="flex-1" />
        <div className="flex items-center pr-1">
          <StTooltip content="Collapse">
            <IconButton size="sm" icon="close" onClick={() => store.setPanelOpen(false)} />
          </StTooltip>
        </div>
      </TabList>

      <TabPanel value="props" className="p-4">
        <SchemaForm />
      </TabPanel>

      <TabPanel value="info" className="p-4">
        {entry?.description && (
          <p className="text-[13px] leading-relaxed text-ink-2 mt-0 mb-4.5">{entry.description}</p>
        )}
        {(entry?.tags ?? []).length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-4.5">
            {entry?.tags?.map((t) => (
              <span
                key={t}
                className="text-[11px] text-ink-2 bg-bg-2 border border-line rounded-full px-2.5 py-0.5"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        {comp ? (
          <InfoRows
            group={entry?.group ?? "Compositions"}
            durationS={comp.durationInFrames.get() / comp.fps}
            fps={comp.fps}
            frames={comp.durationInFrames.get()}
            size={`${comp.width()}×${comp.height()}`}
          />
        ) : (
          <div className="text-[12.5px] text-ink-3">Loading…</div>
        )}
      </TabPanel>
    </StTabs>
  );
}

function InfoRows({
  group,
  durationS,
  fps,
  frames,
  size,
}: {
  group: string;
  durationS: number;
  fps: number;
  frames: number;
  size: string;
}) {
  const rows: Array<[string, string]> = [
    ["Subject", group],
    ["Duration", `${durationS.toFixed(1)}s`],
    ["Frame rate", `${fps} fps`],
    ["Frames", String(frames)],
    ["Composition", size],
  ];
  return (
    <>
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex justify-between py-2.5 border-b border-line last:border-0 text-[13px]"
        >
          <span className="text-ink-3">{k}</span>
          <span className="text-ink-1 font-mono text-[12px]">{v}</span>
        </div>
      ))}
    </>
  );
}
