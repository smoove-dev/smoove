import config from "virtual:smoove/config";
import registry from "virtual:smoove/registry.ts";
import { Studio, useSignalValue, useStudio } from "@smoove/studio";
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { createHttpRenderBackend } from "../render-client.js";

// Real backend: talks to the /api/render resource routes (POST + SSE + download).
// Left out when smoove.config.ts turns rendering off, which hides every render control.
const render = config.render ? createHttpRenderBackend("/api/render") : undefined;

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
      <Problems />
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
      <Studio.Brand
        onClick={() => navigate("/")}
        {...(config.name ? { name: <b className="text-ink-1">{config.name}</b> } : {})}
        {...(config.logoUrl
          ? { icon: <img src={config.logoUrl} alt="" width={16} height={16} /> }
          : {})}
      />
      {config.render && (
        <Studio.Section>
          <Studio.NavItem
            icon="queue"
            title="Render Queue"
            badge={queueCount}
            active={location.pathname === "/queue"}
            onClick={() => navigate("/queue")}
          />
        </Studio.Section>
      )}
      <Studio.Library />
    </Studio.Sidebar>
  );
}

/** Problems already shown, so StrictMode's second effect run doesn't repeat them. */
const shown = new Set<string>();

/** Say what's wrong with the compositions folder: a folder without an index, a duplicate id. */
function Problems() {
  const store = useStudio();
  useEffect(() => {
    for (const p of registry.problems()) {
      if (shown.has(p.message)) continue;
      shown.add(p.message);
      store.addToast(p.message, p.level === "error" ? "close" : "info");
    }
  }, [store]);
  return null;
}
