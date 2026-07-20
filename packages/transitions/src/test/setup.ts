// Konva needs a canvas implementation in Node. The skia backend patches
// Konva.Util.createCanvasElement/createImageElement and installs
// DOMMatrix/Path2D globals — the same backend @smoove/renderer uses in
// production, so tests exercise the real server code path (including the
// per-scene `toCanvas()` captures a Tier B transition makes each frame).
import "konva/skia-backend";
