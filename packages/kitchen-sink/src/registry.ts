import { defineRegistry } from "@smoove/studio";
import audioMixer from "./compositions/audio-mixer/index.js";
import audioVisuals from "./compositions/audio-visuals/index.js";
// Media.
import audiogram from "./compositions/audiogram/index.js";
// Basics.
import basic from "./compositions/basic/index.js";
import bouncing from "./compositions/bouncing/index.js";
// Film.
import code from "./compositions/code/index.js";
import codeEdit from "./compositions/code-edit/index.js";
import codeSelect from "./compositions/code-select/index.js";
import codeTheme from "./compositions/code-theme/index.js";
import cohabit from "./compositions/cohabit/index.js";
import colors from "./compositions/colors/index.js";
import customFont from "./compositions/custom-font/index.js";
import easings from "./compositions/easings/index.js";
import eqSpectrum from "./compositions/eq-spectrum/index.js";
// Layout.
import flexLayout from "./compositions/flex-layout/index.js";
import flexRowGrow from "./compositions/flex-row-grow/index.js";
import flexShowcase from "./compositions/flex-showcase/index.js";
import flexTypewriter from "./compositions/flex-typewriter/index.js";
import googleFont from "./compositions/google-font/index.js";
import helloSmoove from "./compositions/hello-smoove/index.js";
import igStory from "./compositions/ig-story/index.js";
// Images.
import imageClip from "./compositions/image-clip/index.js";
import imageFade from "./compositions/image-fade/index.js";
import imageSlider from "./compositions/image-slider/index.js";
import journey from "./compositions/journey/index.js";
import keyframes from "./compositions/keyframes/index.js";
// Featured (ungrouped) — the props-driven intro.
import pulse from "./compositions/pulse/index.js";
// Text.
import ribbon from "./compositions/ribbon/index.js";
import shapesFlex from "./compositions/shapes-flex/index.js";
import shapesPlayground from "./compositions/shapes-playground/index.js";
import staggered from "./compositions/staggered/index.js";
import textFit from "./compositions/text-fit/index.js";
import textHighlight from "./compositions/text-highlight/index.js";
import textTypewriter from "./compositions/text-typewriter/index.js";
import transforms from "./compositions/transforms/index.js";
// Transitions.
import trBookFlip from "./compositions/transitions/tr-book-flip/index.js";
import trClockWipe from "./compositions/transitions/tr-clock-wipe/index.js";
import trCrossZoom from "./compositions/transitions/tr-cross-zoom/index.js";
import trCrosswarp from "./compositions/transitions/tr-crosswarp/index.js";
import trDissolve from "./compositions/transitions/tr-dissolve/index.js";
import trDreamyZoom from "./compositions/transitions/tr-dreamy-zoom/index.js";
import trFade from "./compositions/transitions/tr-fade/index.js";
import trFilmBurn from "./compositions/transitions/tr-film-burn/index.js";
import trFlip from "./compositions/transitions/tr-flip/index.js";
import trIris from "./compositions/transitions/tr-iris/index.js";
import trLinearBlur from "./compositions/transitions/tr-linear-blur/index.js";
import trNone from "./compositions/transitions/tr-none/index.js";
import trRipple from "./compositions/transitions/tr-ripple/index.js";
import trSlide from "./compositions/transitions/tr-slide/index.js";
import trSwap from "./compositions/transitions/tr-swap/index.js";
import trWipe from "./compositions/transitions/tr-wipe/index.js";
import trZoomBlur from "./compositions/transitions/tr-zoom-blur/index.js";
import trZoomInOut from "./compositions/transitions/tr-zoom-in-out/index.js";
import typewriter from "./compositions/typewriter/index.js";
import videoSync from "./compositions/video-sync/index.js";

/**
 * The demo registry. Each demo lives in its own directory — `schema.ts`
 * (optional), `composition.ts` (default-exports the `Composition`), and
 * `index.ts` (default-exports the `RegistryEntry`). The `@smoove/vite`
 * plugin wires HMR for each entry automatically. Sidebar grouping is driven by
 * each entry's `group` field; order below is preserved within a group.
 */
export default defineRegistry([
  // Featured.
  pulse,
  // Basics.
  basic,
  bouncing,
  staggered,
  transforms,
  easings,
  colors,
  keyframes,
  // Text.
  ribbon,
  textFit,
  textTypewriter,
  textHighlight,
  code,
  codeEdit,
  codeSelect,
  codeTheme,
  typewriter,
  flexTypewriter,
  customFont,
  googleFont,
  // Layout.
  flexLayout,
  flexRowGrow,
  flexShowcase,
  shapesFlex,
  shapesPlayground,
  igStory,
  journey,
  // Images.
  imageSlider,
  imageFade,
  imageClip,
  // Transitions.
  trFade,
  trSlide,
  trWipe,
  trClockWipe,
  trIris,
  trFlip,
  trNone,
  trDissolve,
  trCrosswarp,
  trCrossZoom,
  trDreamyZoom,
  trFilmBurn,
  trLinearBlur,
  trRipple,
  trZoomBlur,
  trZoomInOut,
  trSwap,
  trBookFlip,
  // Media.
  videoSync,
  audioMixer,
  audioVisuals,
  eqSpectrum,
  audiogram,
  // Film.
  cohabit,
  helloSmoove,
]);
