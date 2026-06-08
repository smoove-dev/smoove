/* ============================================================
   KmStudio demo catalog — wraps the real @konva-motion/core demos
   (demos/*.ts) with display metadata the sidebar / panel need.

   `build(props)` is the DemoDef builder — each demo owns its native size.
   The `width`/`height`/`fps`/`durationInFrames` here are cosmetic labels for
   the sidebar; the live Composition drives the real frame size.
   ============================================================ */
import { audioMixerDemo } from "../demos/audio-mixer.js";
import { basicDemo } from "../demos/basic.js";
import { bouncingDemo } from "../demos/bouncing.js";
import { cohabitDemo } from "../demos/cohabit.js";
import { colorsDemo } from "../demos/colors.js";
import { easingsDemo } from "../demos/easings.js";
import { flexLayoutDemo } from "../demos/flex-layout.js";
import { flexRowGrowDemo } from "../demos/flex-row-grow.js";
import { flexShowcaseDemo } from "../demos/flex-showcase.js";
import { flexTypewriterDemo } from "../demos/flex-typewriter.js";
import { igStoryDemo } from "../demos/ig-story.js";
import { imageClipDemo } from "../demos/image-clip.js";
import { imageFadeDemo } from "../demos/image-fade.js";
import { imageSliderDemo } from "../demos/image-slider.js";
import { journeyDemo } from "../demos/journey.js";
import { keyframesDemo } from "../demos/keyframes.js";
import { staggeredDemo } from "../demos/staggered.js";
import { textFitDemo } from "../demos/text-fit.js";
import { textHighlightDemo } from "../demos/text-highlight.js";
import { textTypewriterDemo } from "../demos/text-typewriter.js";
import { transformsDemo } from "../demos/transforms.js";
import { TRANSITION_GALLERY } from "../demos/transition-gallery.js";
import type { DemoDef } from "../demos/types.js";
import { typewriterDemo } from "../demos/typewriter.js";
import { videoSyncDemo } from "../demos/video-sync.js";
import { type KmSchema, kmDefault, kmMerge } from "./kf.js";

export type StudioDemo = {
  id: string;
  title: string;
  group: string;
  groupIcon: string;
  /** intended build input (the live comp drives the real frame size) */
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  desc: string;
  tags: string[];
  build: DemoDef["build"];
  /** optional auto-form schema + its derived (defaultProps-merged) values */
  schema?: KmSchema;
  defaults: Record<string, unknown>;
  /** non-divider top-level fields the form exposes */
  fieldCount: number;
};

export type StudioGroup = {
  group: string;
  icon: string;
  items: StudioDemo[];
};

type Entry = Omit<StudioDemo, "group" | "groupIcon" | "schema" | "defaults" | "fieldCount"> & {
  demo: DemoDef;
};

const entry = (
  demo: DemoDef,
  meta: Omit<
    StudioDemo,
    "id" | "title" | "build" | "group" | "groupIcon" | "schema" | "defaults" | "fieldCount"
  > & {
    title?: string;
  },
): Entry => ({
  id: demo.id,
  title: meta.title ?? demo.name,
  width: meta.width,
  height: meta.height,
  fps: meta.fps,
  durationInFrames: meta.durationInFrames,
  desc: meta.desc,
  tags: meta.tags,
  build: demo.build,
  demo,
});

const W16 = 1280;
const H16 = 720;

const GROUPS: { group: string; icon: string; items: Entry[] }[] = [
  {
    group: "Text",
    icon: "text",
    items: [
      entry(textFitDemo, {
        title: "Fit text",
        width: 512,
        height: 512,
        fps: 30,
        durationInFrames: 150,
        desc: "fitText keeps a headline filling its box as the box width animates, then contrasts single-line vs multi-line fitting.",
        tags: ["text", "fit", "flex"],
      }),
      entry(textTypewriterDemo, {
        title: "Typewriter text",
        width: 512,
        height: 512,
        fps: 30,
        durationInFrames: 200,
        desc: "Word- and letter-mode typewriter reveals inside flex bubbles that reserve their final height up front.",
        tags: ["text", "typewriter", "cursor"],
      }),
      entry(textHighlightDemo, {
        title: "Text highlight",
        width: 512,
        height: 512,
        fps: 30,
        durationInFrames: 150,
        desc: "Animated marker highlights sweep across phrases — rounded pills, partial fills and per-range styling.",
        tags: ["text", "highlight", "marker"],
      }),
      entry(typewriterDemo, {
        title: "Typewriter — AI chat",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 407,
        desc: "A staggered chat thread that types each message bubble out in sequence, growing the bubble as it goes.",
        tags: ["text", "chat", "stagger"],
      }),
      entry(flexTypewriterDemo, {
        title: "Typewriter pushes image",
        width: 1280,
        height: 720,
        fps: 30,
        durationInFrames: 240,
        desc: "An image glued to the bottom of a typing block slides down as new lines appear — no manual height math.",
        tags: ["text", "flex", "reflow"],
      }),
    ],
  },
  {
    group: "Layout",
    icon: "layout",
    items: [
      entry(flexLayoutDemo, {
        title: "Auto card",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 180,
        desc: "A Flex card re-flows live as its width animates — text never overlaps the image because Flexily walks the tree each tick.",
        tags: ["flex", "reflow", "card"],
      }),
      entry(flexRowGrowDemo, {
        title: "Row of growing images",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 240,
        desc: "A flex row where the active image grows and its neighbours shrink — flexGrow animated across the row.",
        tags: ["flex", "row", "grow"],
      }),
      entry(flexShowcaseDemo, {
        title: "Feature showcase",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 240,
        desc: "justifyContent, alignItems, flexGrow and gap all animate in sequence to showcase the layout engine.",
        tags: ["flex", "showcase"],
      }),
      entry(igStoryDemo, {
        title: "IG Story · 30s",
        width: 720,
        height: 1280,
        fps: 60,
        durationInFrames: 1800,
        desc: "A ten-scene 9:16 vertical story reel — kinetic type, stickers and transitions, locked to portrait.",
        tags: ["portrait", "story", "kinetic"],
      }),
      entry(journeyDemo, {
        title: "A Traveler's Journey",
        width: W16,
        height: H16,
        fps: 60,
        durationInFrames: 2400,
        desc: "A four-chapter cinematic sequence with polaroids, letterboxing and timecode — the showpiece composition.",
        tags: ["cinematic", "chapters"],
      }),
    ],
  },
  {
    group: "Images",
    icon: "image",
    items: [
      entry(imageSliderDemo, {
        title: "Slider",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 240,
        desc: "A four-image carousel with slide-in / slide-out transitions and progress dots.",
        tags: ["image", "carousel", "slide"],
      }),
      entry(imageFadeDemo, {
        title: "Crossfade",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 360,
        desc: "Dissolves between four photos with a gentle Ken-Burns drift on each frame.",
        tags: ["image", "crossfade", "pan"],
      }),
      entry(imageClipDemo, {
        title: "Circular clip reveal",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 300,
        desc: "Each photo is revealed through an expanding circular clip mask, then handed off to the next.",
        tags: ["image", "clip", "reveal"],
      }),
    ],
  },
  {
    group: "Transitions",
    icon: "basic",
    items: [
      ...TRANSITION_GALLERY.map((g) =>
        entry(g.def, {
          title: `${g.title}${g.tier === "B" ? " · shader" : ""}`,
          width: W16,
          height: H16,
          fps: 30,
          durationInFrames: 90,
          desc: g.desc,
          tags: ["transition", g.tier === "A" ? "geometric" : "shader"],
        }),
      ),
    ],
  },
  {
    group: "Video & Audio",
    icon: "media",
    items: [
      entry(videoSyncDemo, {
        title: "Playback sync",
        width: 1080,
        height: 1080,
        fps: 30,
        durationInFrames: 900,
        desc: "Three phases — top alone, bottom alone, then both together — proving frame-accurate video sync to the timeline.",
        tags: ["video", "sync"],
      }),
      entry(audioMixerDemo, {
        title: "Mixer & ducking",
        width: 1080,
        height: 1080,
        fps: 30,
        durationInFrames: 780,
        desc: "Three tracks with ducking, crossfade and an outro fade, visualised as animated level meters.",
        tags: ["audio", "mixer", "ducking"],
      }),
    ],
  },
  {
    group: "Basics",
    icon: "basic",
    items: [
      entry(basicDemo, {
        title: "Circle + fade",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 90,
        desc: "The simplest build: a circle slides across while a square fades out. Start here.",
        tags: ["intro", "fade"],
      }),
      entry(bouncingDemo, {
        title: "Bouncing ball",
        width: W16,
        height: H16,
        fps: 60,
        durationInFrames: 120,
        desc: "A looping ball with eased fall and squash/stretch on impact — a primer on easing.",
        tags: ["motion", "easing", "loop"],
      }),
      entry(staggeredDemo, {
        title: "Staggered fade-in",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 180,
        desc: "A row of cards fades and rises in along a stagger — the building block for list intros.",
        tags: ["stagger", "fade"],
      }),
      entry(transformsDemo, {
        title: "Rotate + scale",
        width: W16,
        height: H16,
        fps: 60,
        durationInFrames: 240,
        desc: "Rotation and scale animated together, capped by a small particle burst.",
        tags: ["transform", "rotate", "scale"],
      }),
      entry(easingsDemo, {
        title: "Race of curves",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 120,
        desc: "Several easing curves race left-to-right so you can feel the difference between them.",
        tags: ["easing", "compare"],
      }),
      entry(colorsDemo, {
        title: "Color interpolation",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 180,
        desc: "Fill and stroke colors interpolate through a palette via interpolateColors.",
        tags: ["color", "interpolate"],
      }),
      entry(keyframesDemo, {
        title: "Multi-stop interpolate",
        width: W16,
        height: H16,
        fps: 30,
        durationInFrames: 150,
        desc: "A node follows a path defined by multiple interpolate stops for x and y.",
        tags: ["keyframes", "interpolate", "path"],
      }),
      entry(cohabitDemo, {
        title: "Cohabit — brand spot",
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 1020,
        desc: "A four-scene branded promo with mixed audio (music bed, VO ducking, whoosh hits) and a logo reveal.",
        tags: ["brand", "audio", "cinematic"],
      }),
    ],
  },
];

export const KM_DEMOS: StudioGroup[] = GROUPS.map((g) => ({
  group: g.group,
  icon: g.icon,
  items: g.items.map((e): StudioDemo => {
    const schema = e.demo.schema;
    const defaults = schema
      ? (kmMerge(kmDefault(schema), e.demo.defaultProps) as Record<string, unknown>)
      : {};
    const fieldCount =
      schema?.__km.fields?.filter(([, s]) => s.__km.control !== "divider").length ?? 0;
    return {
      id: e.id,
      title: e.title,
      group: g.group,
      groupIcon: g.icon,
      width: e.width,
      height: e.height,
      fps: e.fps,
      durationInFrames: e.durationInFrames,
      desc: e.desc,
      tags: e.tags,
      build: e.build,
      schema,
      defaults,
      fieldCount,
    };
  }),
}));

export const KM_FLAT: StudioDemo[] = KM_DEMOS.flatMap((g) => g.items);

const first = KM_FLAT[0];
if (!first) throw new Error("KmStudio: empty demo catalog");
export const FIRST_DEMO_ID = first.id;

export const findDemo = (id: string | undefined): StudioDemo | undefined =>
  KM_FLAT.find((d) => d.id === id);
