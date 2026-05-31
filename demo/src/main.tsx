import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./studio/App.js";
import "./studio/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

// HashRouter so a reload on /#/<demo-id> resolves with no dev/host server config.
// (No StrictMode: each demo builds an imperative Konva Composition in an effect;
// double-invoking would tear down and rebuild canvases/audio/video on every mount.)
createRoot(root).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
