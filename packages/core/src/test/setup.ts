// Konva needs a canvas implementation in Node. The skia backend patches
// Konva.Util.createCanvasElement/createImageElement and installs
// DOMMatrix/Path2D globals — same backend @smoove/renderer uses in production,
// so tests exercise the real server code path.
import "konva/skia-backend";
