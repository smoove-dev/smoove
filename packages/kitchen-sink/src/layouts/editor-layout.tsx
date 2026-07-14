import { Editor } from "@smoove/editor";
import { Studio } from "@smoove/studio";
import { Outlet, useNavigate } from "react-router";
import editorRegistry from "../editor-registry.js";

/**
 * The editor frame. No `render` backend on purpose: `/api/render` resolves ids
 * through the DEMO registry (`server/resolve.ts`), so a project id would never
 * resolve. `StudioProps.render` is optional, so omitting it degrades the render
 * affordance instead of failing at the click. Server-rendering project
 * compositions is out of scope for Phase 2.
 */
export default function EditorLayout() {
  const navigate = useNavigate();
  return (
    <Studio registry={editorRegistry} onNavigate={(id) => navigate(`/editor?c=${id}`)}>
      <Studio.Body>
        <Editor.ChatRail endpoint="/api/agent" />
        <Outlet />
      </Studio.Body>
      <Studio.Toasts />
    </Studio>
  );
}
