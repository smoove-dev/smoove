import type { Composition } from "@konva-motion/core";
import type { PlayerApi } from "@konva-motion/player";
import { Signal } from "signal-polyfill";
import type { IconName } from "../components/icon/paths.js";
import { makeJobId } from "../lib/ids.js";
import { createPropsSignal } from "../registry/props-signal.js";
import { resolveDefaults } from "../schema/kf.js";
import type {
  Registry,
  RegistryEntry,
  RenderBackend,
  RenderJob,
  RenderRequest,
  Toast,
  WritableSignal,
} from "../types.js";

export type LoadStatus = "idle" | "loading" | "ready" | "error";
export type TlMode = "progress" | "layered";
export type PanelTab = "props" | "info";
export type ZoomValue = "fit" | number;
export type Region = { in: number | null; out: number | null };

export type StudioStoreOptions = {
  registry: Registry;
  render?: RenderBackend;
  initialId?: string;
  /** Called when a composition is selected, so a router can sync the URL. */
  onNavigate?: (id: string) => void;
};

export type StudioStore = ReturnType<typeof createStore>;

export function createStore(opts: StudioStoreOptions) {
  const { registry, render } = opts;
  const entries = registry.entries();
  const firstId = opts.initialId ?? entries[0]?.id ?? "";

  // ---- reactive state -------------------------------------------------------
  const selectedId = new Signal.State<string>(firstId);
  const composition = new Signal.State<Composition | null>(null);
  /** The mounted `<km-player>` API — registered by the Stage. */
  const player = new Signal.State<PlayerApi | null>(null);
  const loadStatus = new Signal.State<Record<string, LoadStatus>>({});
  const loadError = new Signal.State<string | null>(null);
  const tlMode = new Signal.State<TlMode>("progress");
  const panelOpen = new Signal.State<boolean>(false);
  const panelTab = new Signal.State<PanelTab>("props");
  const zoom = new Signal.State<ZoomValue>("fit");
  /** The measured fit-scale (reported by the Stage) so Zoom can show "Fit %". */
  const fitScale = new Signal.State<number>(0.5);
  /** Horizontal zoom for the layered timeline (1 = fit width). */
  const timelineZoom = new Signal.State<number>(1);
  const region = new Signal.State<Region>({ in: null, out: null });
  const layerOff = new Signal.State<Record<string, Set<number>>>({});
  const jobs = new Signal.State<RenderJob[]>([]);
  const toasts = new Signal.State<Toast[]>([]);

  const queueCount = new Signal.Computed(
    () => jobs.get().filter((j) => j.status === "queued" || j.status === "rendering").length,
  );

  // ---- per-composition props signals (lazy, memoized) -----------------------
  const propsSignals = new Map<string, WritableSignal<Record<string, unknown>>>();
  const getEntry = (id: string): RegistryEntry | undefined => entries.find((e) => e.id === id);

  function getPropsSignal(id: string): WritableSignal<Record<string, unknown>> {
    let sig = propsSignals.get(id);
    if (!sig) {
      const entry = getEntry(id);
      sig = createPropsSignal<Record<string, unknown>>(
        resolveDefaults(entry?.propsSchema, entry?.defaultProps),
      );
      propsSignals.set(id, sig);
    }
    return sig;
  }

  function setStatus(id: string, status: LoadStatus): void {
    loadStatus.set({ ...loadStatus.get(), [id]: status });
  }

  // ---- selection / loading --------------------------------------------------
  // Bridge each composition's form props onto the comp exactly once: seed it
  // with the current values and forward later edits via `comp.setProps`, which
  // re-applies the current frame without rebuilding (playhead preserved).
  const wiredProps = new Set<string>();
  function wireProps(id: string, comp: Composition): void {
    const sig = getPropsSignal(id);
    comp.setProps(sig.get());
    if (wiredProps.has(id)) return;
    wiredProps.add(id);
    sig.subscribe((value) => comp.setProps(value));
  }

  async function loadActive(): Promise<void> {
    const id = selectedId.get();
    if (!id) return;
    const cached = registry.peek(id);
    if (cached) {
      composition.set(cached);
      setStatus(id, "ready");
      wireProps(id, cached);
      return;
    }
    setStatus(id, "loading");
    loadError.set(null);
    try {
      const comp = await registry.load(id);
      if (selectedId.get() !== id) return; // selection moved on
      composition.set(comp);
      setStatus(id, "ready");
      wireProps(id, comp);
    } catch (err) {
      if (selectedId.get() !== id) return;
      composition.set(null);
      setStatus(id, "error");
      loadError.set(err instanceof Error ? err.message : String(err));
    }
  }

  function applySelect(id: string, navigate: boolean): void {
    if (id === selectedId.get() && composition.get()) return;
    selectedId.set(id);
    region.set({ in: null, out: null });
    composition.set(registry.peek(id) ?? null);
    if (navigate) opts.onNavigate?.(id);
    void loadActive();
  }
  /** User-initiated selection — also syncs the router via onNavigate. */
  const select = (id: string): void => applySelect(id, true);
  /** Router-initiated selection (URL changed) — does NOT call onNavigate. */
  const syncSelected = (id: string): void => applySelect(id, false);

  // ---- dev hot-reload ------------------------------------------------------
  // When a composition's builder is swapped (registry.update, e.g. Vite HMR),
  // rebuild + remount the active one, preserving props (the props signal is
  // memoized per id) and the playhead. The Stage consumes `takeRestore()` after
  // mounting the rebuilt comp.
  let pendingRestore: { frame: number; playing: boolean } | null = null;
  const takeRestore = (): { frame: number; playing: boolean } | null => {
    const r = pendingRestore;
    pendingRestore = null;
    return r;
  };
  async function reloadActive(id: string): Promise<void> {
    const api = player.get();
    pendingRestore = api ? { frame: api.getCurrentFrame(), playing: api.isPlaying() } : null;
    wiredProps.delete(id);
    composition.set(null); // force the Stage to remount even if React keeps the ref
    await loadActive();
  }
  registry.onChange((id) => {
    if (id === selectedId.get()) void reloadActive(id);
  });

  // ---- layout / playback-view actions ---------------------------------------
  const setPlayer = (api: PlayerApi | null) => player.set(api);
  const setTlMode = (m: TlMode) => tlMode.set(m);
  const setPanelOpen = (open: boolean) => panelOpen.set(open);
  const setPanelTab = (t: PanelTab) => panelTab.set(t);
  const setZoom = (z: ZoomValue) => zoom.set(z);
  const setFitScale = (s: number) => fitScale.set(s);
  const setTimelineZoom = (z: number) => timelineZoom.set(Math.max(1, Math.min(16, z)));

  const setRegion = (r: Region) => region.set(r);
  const setRegionIn = (frame: number) => {
    const r = region.get();
    const max = r.out == null ? Number.POSITIVE_INFINITY : r.out - 1;
    region.set({ in: Math.min(frame, max), out: r.out });
  };
  const setRegionOut = (frame: number) => {
    const r = region.get();
    const min = r.in == null ? 0 : r.in + 1;
    region.set({ in: r.in, out: Math.max(frame, min) });
  };
  const clearRegion = () => region.set({ in: null, out: null });

  const isLayerOff = (id: string, index: number): boolean =>
    layerOff.get()[id]?.has(index) ?? false;
  const toggleLayer = (index: number): void => {
    const id = selectedId.get();
    const map = layerOff.get();
    const next = new Set(map[id] ?? []);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    layerOff.set({ ...map, [id]: next });
  };

  // ---- toasts ---------------------------------------------------------------
  // The Toasts component registers a sink (Base UI's Toast manager) so it owns
  // rendering + auto-dismiss; until then toasts queue in the signal as fallback.
  let toastSink: ((title: string, icon?: IconName) => void) | null = null;
  const setToastSink = (fn: ((title: string, icon?: IconName) => void) | null): void => {
    toastSink = fn;
  };
  const addToast = (title: string, icon?: IconName): void => {
    if (toastSink) {
      toastSink(title, icon);
      return;
    }
    toasts.set([...toasts.get(), { id: makeJobId(), title, icon }]);
  };
  const dismissToast = (id: string): void => {
    toasts.set(toasts.get().filter((t) => t.id !== id));
  };

  // ---- render jobs (transport-free; backend injected) -----------------------
  const updateJob = (jobId: string, patch: Partial<RenderJob>): void => {
    jobs.set(jobs.get().map((j) => (j.jobId === jobId ? { ...j, ...patch } : j)));
  };

  function enqueue(req: RenderRequest, queuedToast?: [string, IconName]): string {
    const job: RenderJob = {
      ...req,
      jobId: makeJobId(),
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
    };
    jobs.set([job, ...jobs.get()]);
    if (queuedToast) addToast(queuedToast[0], queuedToast[1]);

    if (!render) return job.jobId;
    Promise.resolve(render.start(job, (patch) => updateJob(job.jobId, patch)))
      .then((final) => {
        const cur = jobs.get().find((j) => j.jobId === job.jobId);
        if (!cur || cur.status === "canceled") return;
        updateJob(job.jobId, { status: "done", progress: 1, ...(final ?? {}) });
        if (job.kind === "still") addToast(`Frame exported · ${job.comp}`, "camera");
        else addToast(`Render ready · ${job.comp}`, "check");
      })
      .catch((err) => {
        updateJob(job.jobId, {
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
        addToast(`Render failed · ${job.comp}`, "close");
      });
    return job.jobId;
  }

  const startRender = (req: RenderRequest): string =>
    enqueue(req, [`Queued · ${req.comp}`, "server"]);
  const exportFrame = (req: RenderRequest): string => enqueue(req);

  const cancelJob = (jobId: string): void => {
    render?.cancel?.(jobId);
    updateJob(jobId, { status: "canceled" });
  };
  const removeJob = (jobId: string): void => {
    jobs.set(jobs.get().filter((j) => j.jobId !== jobId));
  };
  const clearDone = (): void => {
    jobs.set(jobs.get().filter((j) => j.status !== "done"));
  };
  const downloadJob = (job: RenderJob): void => {
    render?.download?.(job);
    addToast(`Download started · ${job.comp}`, "download");
  };

  return {
    // config / data
    registry,
    entries,
    getEntry,
    getPropsSignal,
    // state signals
    selectedId,
    composition,
    player,
    loadStatus,
    loadError,
    tlMode,
    panelOpen,
    panelTab,
    zoom,
    fitScale,
    timelineZoom,
    region,
    layerOff,
    jobs,
    toasts,
    queueCount,
    // actions
    select,
    syncSelected,
    loadActive,
    takeRestore,
    setPlayer,
    setToastSink,
    setTlMode,
    setPanelOpen,
    setPanelTab,
    setZoom,
    setFitScale,
    setTimelineZoom,
    setRegion,
    setRegionIn,
    setRegionOut,
    clearRegion,
    isLayerOff,
    toggleLayer,
    addToast,
    dismissToast,
    updateJob,
    startRender,
    exportFrame,
    cancelJob,
    removeJob,
    clearDone,
    downloadJob,
  };
}
