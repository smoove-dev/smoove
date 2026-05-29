import type Konva from "konva";
import type { FlexChildProps, ObjectFit, ObjectPosition, SizeValue } from "../flex-types.js";
import type { VideoSourceFactory } from "./video-source.js";

/**
 * Config for {@link Video}. Mirrors {@link ImageConfig} plus Remotion's
 * `<Video>` playback props (`trimBefore`/`trimAfter`/`loop`/`muted`/`volume`/
 * `playbackRate`) and a `sourceFactory` dependency-injection seam.
 */
export type VideoConfig = Omit<Konva.GroupConfig, "width" | "height"> &
  FlexChildProps & {
    width?: SizeValue;
    height?: SizeValue;
    src: string;
    objectFit?: ObjectFit;
    objectPosition?: ObjectPosition;
    cornerRadius?: number | number[];
    /** Frames trimmed from the start of the media (composition fps). Remotion v4 name. */
    trimBefore?: number;
    /** Exclusive frame bound — media past this offset is trimmed (composition fps). */
    trimAfter?: number;
    /** @deprecated alias of {@link trimBefore} (Remotion's pre-v4.0.319 name). */
    startFrom?: number;
    /** @deprecated alias of {@link trimAfter} (Remotion's pre-v4.0.319 name). */
    endAt?: number;
    /** Repeat the trimmed clip within its sequence window instead of freezing on the last frame. */
    loop?: boolean;
    muted?: boolean;
    /** 0..1 */
    volume?: number;
    playbackRate?: number;
    /** Inject an alternative VideoSource. Defaults to BrowserVideoSource. */
    sourceFactory?: VideoSourceFactory;
  };
