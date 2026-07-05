// Derived from paper-design/shaders packages/shaders/src/shaders/heatmap.ts (Apache-2.0). See NOTICE.
// The heatmap fragment samples a pre-processed image: R = light contour blur,
// G = large outer blur, B = small inner blur (grayscale box blurs of the
// source). Adapted: takes an already-loaded image (any CanvasImageSource with
// dimensions), uses Konva's cross-platform canvas factory, returns a canvas.
import Konva from "konva";

export type ProcessedImage = { canvas: HTMLCanvasElement; aspectRatio: number };

export type SizedImage = CanvasImageSource & {
  naturalWidth?: number;
  naturalHeight?: number;
  width?: number;
  height?: number;
};

function sizeOf(img: SizedImage): { w: number; h: number } {
  const w = Number(img.naturalWidth || img.width || 0);
  const h = Number(img.naturalHeight || img.height || 0);
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

export function computeHeatmapField(image: SizedImage): ProcessedImage {
  const canvasSize = 1000;
  const { w: nw, h: nh } = sizeOf(image);
  const ratio = nw / nh;

  const maxBlur = Math.floor(canvasSize * 0.15);
  const padding = Math.ceil(maxBlur * 2.5);
  let imgWidth = canvasSize;
  let imgHeight = canvasSize;
  if (ratio > 1) {
    imgHeight = Math.floor(canvasSize / ratio);
  } else {
    imgWidth = Math.floor(canvasSize * ratio);
  }

  const canvas = Konva.Util.createCanvasElement();
  canvas.width = imgWidth + 2 * padding;
  canvas.height = imgHeight + 2 * padding;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

  // 1) Draw original image on white.
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, padding, padding, imgWidth, imgHeight);

  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height).data;

  // 2) Grayscale (luma).
  const totalPixels = width * height;
  const gray = new Uint8ClampedArray(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const px = i * 4;
    gray[i] =
      (0.299 * (src[px] ?? 0) + 0.587 * (src[px + 1] ?? 0) + 0.114 * (src[px + 2] ?? 0)) | 0;
  }

  // 3) Three blur scales → three channels.
  const bigBlurGray = multiPassBlurGray(gray, width, height, maxBlur, 3);
  const innerBlurGray = multiPassBlurGray(
    gray,
    width,
    height,
    Math.max(1, Math.round(0.12 * maxBlur)),
    3,
  );
  const contourGray = multiPassBlurGray(gray, width, height, 5, 1);

  const processed = ctx.createImageData(width, height);
  const dst = processed.data;
  for (let i = 0; i < totalPixels; i++) {
    const px = i * 4;
    dst[px] = contourGray[i] ?? 0;
    dst[px + 1] = bigBlurGray[i] ?? 0;
    dst[px + 2] = innerBlurGray[i] ?? 0;
    dst[px + 3] = 255;
  }
  ctx.putImageData(processed, 0, 0);

  return { canvas, aspectRatio: width / height };
}

/** Fast box blur for grayscale images using an integral image. */
function blurGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) return gray.slice();

  const out = new Uint8ClampedArray(width * height);
  const integral = new Uint32Array(width * height);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      rowSum += gray[idx] ?? 0;
      integral[idx] = rowSum + (y > 0 ? (integral[idx - width] ?? 0) : 0);
    }
  }

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);
      const A = integral[y2 * width + x2] ?? 0;
      const B = x1 > 0 ? (integral[y2 * width + (x1 - 1)] ?? 0) : 0;
      const C = y1 > 0 ? (integral[(y1 - 1) * width + x2] ?? 0) : 0;
      const D = x1 > 0 && y1 > 0 ? (integral[(y1 - 1) * width + (x1 - 1)] ?? 0) : 0;
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      out[y * width + x] = Math.round((A - B - C + D) / area);
    }
  }
  return out;
}

function multiPassBlurGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  passes: number,
): Uint8ClampedArray {
  if (radius <= 0 || passes <= 1) return blurGray(gray, width, height, radius);
  let input = gray;
  for (let p = 0; p < passes; p++) input = blurGray(input, width, height, radius);
  return input;
}
