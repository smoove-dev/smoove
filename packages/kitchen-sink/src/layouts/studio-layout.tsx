import { Studio, useSignalValue, useStudio } from "@smoove/studio";
import { Outlet, useLocation, useNavigate } from "react-router";
import registry from "../registry.js";
import { createHttpRenderBackend } from "../render-client.js";

// Real backend: talks to the /api/render resource routes (POST + SSE + download).
const render = createHttpRenderBackend("/api/render");

/**
 * Persistent shell: the Studio provider + the left rail + a route Outlet. The
 * center (home doc / stage / queue) and the right panel are decided entirely by
 * the matched child route — switching views = navigating, not store state.
 */
export default function StudioLayout() {
  const navigate = useNavigate();
  return (
    <Studio registry={registry} render={render} onNavigate={(id) => navigate(`/c/${id}`)}>
      <Studio.Body>
        <SideRail />
        <Outlet />
      </Studio.Body>
      <Studio.Toasts />
    </Studio>
  );
}

function SideRail() {
  const store = useStudio();
  const navigate = useNavigate();
  const location = useLocation();
  const queueCount = useSignalValue(store.queueCount);
  return (
    <Studio.Sidebar>
      <Studio.Brand onClick={() => navigate("/")} />
      <Studio.Section>
        <Studio.NavItem
          icon="spark"
          title="Editor"
          active={location.pathname === "/editor"}
          onClick={() => navigate("/editor")}
        />
        <Studio.NavItem
          icon="play"
          title="Player"
          active={location.pathname === "/player"}
          onClick={() => navigate("/player")}
        />
        <Studio.NavItem
          icon="queue"
          title="Render Queue"
          badge={queueCount}
          active={location.pathname === "/queue"}
          onClick={() => navigate("/queue")}
        />
      </Studio.Section>
      <Studio.Library />
    </Studio.Sidebar>
  );
}
