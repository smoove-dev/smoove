// Konva needs a canvas implementation in Node. The skia backend patches
// Konva.Util.createCanvasElement/createImageElement and installs
// DOMMatrix/Path2D globals — the same backend @smoove/renderer uses, so tests
// exercise the real server code path.
import "konva/skia-backend";
