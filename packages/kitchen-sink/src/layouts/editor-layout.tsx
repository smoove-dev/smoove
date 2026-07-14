import { Editor } from "@smoove/editor";
import { Studio } from "@smoove/studio";
import { Outlet, useNavigate } from "react-router";
import registry from "../registry.js";
import { createHttpRenderBackend } from "../render-client.js";

const render = createHttpRenderBackend("/api/render");

export default function EditorLayout() {
  const navigate = useNavigate();
  return (
    <Studio registry={registry} render={render} onNavigate={(id) => navigate(`/editor?c=${id}`)}>
      <Studio.Body>
        <Editor.ChatRail endpoint="/api/agent" />
        <Outlet />
      </Studio.Body>
      <Studio.Toasts />
    </Studio>
  );
}
