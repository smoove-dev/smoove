import { Brand } from "./components/brand/brand.js";
/** @smoove/studio — public barrel. */
import { Button } from "./components/button/button.js";
import { IconButton } from "./components/button/icon-button.js";
import { Header } from "./components/header/header.js";
import { HeaderTitle } from "./components/header/header-title.js";
import { Zoom } from "./components/header/zoom.js";
import { Icon } from "./components/icon/icon.js";
import { Library } from "./components/left-panel/library.js";
import { Sidebar } from "./components/left-panel/sidebar.js";
import { SidebarGroup } from "./components/left-panel/sidebar-group.js";
import { NavItem, SidebarItem } from "./components/left-panel/sidebar-item.js";
import { StDialog } from "./components/primitives/dialog.js";
import { MenuItem, MenuSeparator, StMenu } from "./components/primitives/menu.js";
import { StNumberField } from "./components/primitives/number-field.js";
import { StSelect } from "./components/primitives/select.js";
import { StSlider } from "./components/primitives/slider.js";
import { StSwitch } from "./components/primitives/switch.js";
import { StTabs, Tab, TabList, TabPanel } from "./components/primitives/tabs.js";
import { StTooltip } from "./components/primitives/tooltip.js";
import { ExportFrameDialog } from "./components/render/export-frame-dialog.js";
import { RenderDialog } from "./components/render/render-dialog.js";
import { RenderQueue } from "./components/render/render-queue.js";
import { Panel } from "./components/right-panel/panel.js";
import { PanelHandle } from "./components/right-panel/panel-handle.js";
import { PanelTabs } from "./components/right-panel/panel-tabs.js";
import { SchemaForm } from "./components/schema-form/schema-form.js";
import { Stage } from "./components/stage/stage.js";
import { Body, Main, Section, Spacer } from "./components/studio/layout.js";
import { StudioRoot } from "./components/studio/studio.js";
import { LayeredBody } from "./components/timeline/layered-body.js";
import { Scrubber } from "./components/timeline/scrubber.js";
import { Timeline } from "./components/timeline/timeline.js";
import { TimelineHeader } from "./components/timeline/timeline-header.js";
import { Transport } from "./components/timeline/transport.js";
import { Toasts } from "./components/toasts/toasts.js";

const Menu = Object.assign(StMenu, { Item: MenuItem, Separator: MenuSeparator });
const SidebarNs = Object.assign(Sidebar, { Group: SidebarGroup, Item: SidebarItem });
const HeaderNs = Object.assign(Header, { Title: HeaderTitle });
const PanelNs = Object.assign(Panel, { Tabs: PanelTabs, Handle: PanelHandle });

/**
 * The compound root + namespace. `<Studio registry render>` provides context;
 * compose the regions as children (`<Studio.Header>`, `<Studio.Stage>`, …).
 */
export const Studio = Object.assign(StudioRoot, {
  // layout shells
  Body,
  Main,
  Section,
  Spacer,
  // brand
  Brand,
  // left panel
  Sidebar: SidebarNs,
  Library,
  NavItem,
  SidebarItem,
  SidebarGroup,
  // header
  Header: HeaderNs,
  HeaderTitle,
  Zoom,
  Menu,
  MenuItem,
  MenuSeparator,
  // stage + timeline
  Stage,
  Timeline,
  TimelineHeader,
  Scrubber,
  Transport,
  LayeredBody,
  // right panel
  Panel: PanelNs,
  PanelTabs,
  PanelHandle,
  SchemaForm,
  // render
  RenderDialog,
  ExportFrameDialog,
  RenderQueue,
  Toasts,
  // primitives
  Button,
  IconButton,
  Icon,
  Dialog: StDialog,
  Tabs: StTabs,
  Tab,
  TabList,
  TabPanel,
  Slider: StSlider,
  Switch: StSwitch,
  Select: StSelect,
  Tooltip: StTooltip,
  NumberField: StNumberField,
});

// Icon primitive + type
export { Icon, type IconProps } from "./components/icon/icon.js";
export type { IconName } from "./components/icon/paths.js";
export type { StudioProps } from "./components/studio/studio.js";
export { useComposition } from "./hooks/use-composition.js";
export { applyLayerVisibility, deriveLayers, sequencesOf } from "./hooks/use-layers.js";
export { usePlayback } from "./hooks/use-playback.js";
export { usePropsForm } from "./hooks/use-props-form.js";
export { useRealFps } from "./hooks/use-real-fps.js";
export { useShortcuts } from "./hooks/use-shortcuts.js";
// Hooks
export { useStudio } from "./hooks/use-studio.js";
// Catalog constants
export { LAYER_KINDS, type LayerKind, type LayerKindMeta, ZOOM_STEPS } from "./lib/constants.js";
// Registry (isomorphic)
export { defineRegistry } from "./registry/define-registry.js";
export { createPropsSignal } from "./registry/props-signal.js";
// Schema DSL
export { defaultForField, defaultsFor, isValueField, kf, resolveDefaults } from "./schema/kf.js";
export type * from "./schema/types.js";
// React ↔ signal bridges
export { usePlayerSignal, useSignalValue } from "./signals/signal-bridge.js";

// Public types
export type * from "./types.js";
