import { Icon } from "./Icon.js";
import { SchemaForm } from "./SchemaForm.js";
import type { StudioDemo } from "./catalog.js";

export type PanelTab = "props" | "info" | "code";

type PropValues = Record<string, unknown>;

function PropsTab({
  demo,
  value,
  onChange,
  onReset,
}: {
  demo: StudioDemo;
  value: PropValues;
  onChange: (next: PropValues) => void;
  onReset: () => void;
}) {
  if (!demo.schema || demo.fieldCount === 0) {
    // Graceful empty state — demo exposes no overridable props.
    return (
      <div className="panel-empty">
        <div className="ic">
          <Icon name="sliders" size={20} />
        </div>
        <h4>No props for this demo</h4>
        <p>
          “{demo.title}” doesn’t expose any overridable settings yet. Pick a demo that does to tweak
          its inputs live.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div className="prop-group-label" style={{ margin: 0 }}>
          {demo.title} · props
        </div>
        <button type="button" className="kf-reset" onClick={onReset}>
          Reset
        </button>
      </div>
      <SchemaForm schema={demo.schema} value={value} onChange={(v) => onChange(v as PropValues)} />
    </div>
  );
}

function InfoTab({ demo }: { demo: StudioDemo }) {
  const frames = demo.durationInFrames;
  return (
    <div>
      <p className="info-desc">{demo.desc}</p>
      <div className="tagrow" style={{ marginBottom: 18 }}>
        {demo.tags.map((t) => (
          <span key={t} className="tag">
            #{t}
          </span>
        ))}
      </div>
      <div className="info-row">
        <span className="k">Subject</span>
        <span className="v">{demo.group}</span>
      </div>
      <div className="info-row">
        <span className="k">Duration</span>
        <span className="v">{(frames / demo.fps).toFixed(1)}s</span>
      </div>
      <div className="info-row">
        <span className="k">Frame rate</span>
        <span className="v">{demo.fps} fps</span>
      </div>
      <div className="info-row">
        <span className="k">Frames</span>
        <span className="v">{frames}</span>
      </div>
      <div className="info-row">
        <span className="k">Composition</span>
        <span className="v">
          {demo.width}×{demo.height}
        </span>
      </div>
      <div className="info-row">
        <span className="k">Engine</span>
        <span className="v">@konva-motion/core</span>
      </div>
    </div>
  );
}

function CodeTab({ demo }: { demo: StudioDemo }) {
  const frames = demo.durationInFrames;
  return (
    <div>
      <div className="prop-group-label">Composition source</div>
      <pre className="code">
        <span className="kw">const</span> comp = <span className="kw">new</span>{" "}
        <span className="fn">Composition</span>({"{"}
        {"\n"}
        {"  "}id: <span className="str">"{demo.id}"</span>,{"\n"}
        {"  "}fps: <span className="num">{demo.fps}</span>,{"\n"}
        {"  "}durationInFrames: <span className="num">{frames}</span>,{"\n"}
        {"  "}width: <span className="num">{demo.width}</span>, height:{" "}
        <span className="num">{demo.height}</span>,{"\n"}
        {"}"});{"\n"}
        {"\n"}
        <span className="kw">const</span> main = <span className="kw">new</span>{" "}
        <span className="fn">Sequence</span>({"{"} from: <span className="num">0</span>,
        durationInFrames: <span className="num">{frames}</span> {"}"});{"\n"}
        main.<span className="fn">register</span>((frame) =&gt; {"{"}
        {"\n"}
        {"  "}
        <span className="cm">{"// drive nodes from the playhead frame"}</span>
        {"\n"}
        {"}"});{"\n"}
        comp.<span className="fn">add</span>(main);
      </pre>
      <p style={{ fontSize: 12, color: "var(--t-3)", lineHeight: 1.6, marginTop: 14 }}>
        Read-only preview. The real source lives in <code>demo/src/demos/{demo.id}.ts</code> — each
        composition is a scrubbable timeline driven by the playhead above.
      </p>
    </div>
  );
}

export function RightPanel({
  tab,
  setTab,
  onClose,
  demo,
  value,
  onChange,
  onReset,
}: {
  tab: PanelTab;
  setTab: (t: PanelTab) => void;
  onClose: () => void;
  demo: StudioDemo;
  value: PropValues;
  onChange: (next: PropValues) => void;
  onReset: () => void;
}) {
  const tabs: { id: PanelTab; label: string; icon: string }[] = [
    { id: "props", label: "Props", icon: "sliders" },
    { id: "info", label: "Info", icon: "info" },
    { id: "code", label: "Code", icon: "code" },
  ];
  return (
    <div className="panel" style={{ display: "flex" }}>
      <div className="panel-tabs">
        {tabs.map((tb) => (
          <button
            type="button"
            key={tb.id}
            className={`panel-tab${tab === tb.id ? " active" : ""}`}
            onClick={() => setTab(tb.id)}
          >
            <Icon name={tb.icon} size={15} /> {tb.label}
          </button>
        ))}
        <button
          type="button"
          className="ctrl sm panel-close"
          onClick={onClose}
          title="Collapse panel"
        >
          <Icon name="close" size={15} />
        </button>
      </div>
      <div className="panel-body scroll">
        {tab === "props" && (
          <PropsTab demo={demo} value={value} onChange={onChange} onReset={onReset} />
        )}
        {tab === "info" && <InfoTab demo={demo} />}
        {tab === "code" && <CodeTab demo={demo} />}
      </div>
    </div>
  );
}

export function PanelHandle({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="panel-handle">
      <button type="button" className="handle-btn" onClick={onOpen} title="Open settings">
        <Icon name="panelRight" size={16} />
      </button>
      <button type="button" className="handle-label" onClick={onOpen}>
        Settings
      </button>
    </div>
  );
}
