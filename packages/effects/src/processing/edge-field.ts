// Derived from paper-design/shaders packages/shaders/src/shaders/liquid-metal.ts
// and gem-smoke.ts (Apache-2.0). See NOTICE.
// Both fragments sample a pre-processed image whose R channel carries a smooth
// interior gradient (a Poisson equation solved over the shape's alpha mask,
// red-black SOR) and whose G channel carries the original alpha. Adapted:
// takes an already-loaded image, uses Konva's cross-platform canvas factory,
// no SVG/blob special-casing or perf logging.
import Konva from "konva";
import type { ProcessedImage, SizedImage } from "./heatmap-field.js";

const WORKING_SIZE = 512;
const ITERATIONS = 40;

function sizeOf(img: SizedImage): { w: number; h: number } {
  const w = Number(img.naturalWidth || img.width || 0);
  const h = Number(img.naturalHeight || img.height || 0);
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

/**
 * Compute the R=edge-gradient / G=alpha field the liquid-metal and gem-smoke
 * fragments expect. `padding` is a fraction of each dimension (gem-smoke uses
 * 0.025 so the smoke has room to escape the shape; liquid-metal uses 0).
 */
export function computeEdgeField(image: SizedImage, padding = 0): ProcessedImage {
  const { w: originalWidth, h: originalHeight } = sizeOf(image);

  // Solve at reduced working resolution.
  const minDimension = Math.min(originalWidth, originalHeight);
  const scaleFactor = WORKING_SIZE / minDimension;
  const width = Math.max(2, Math.round(originalWidth * scaleFactor));
  const height = Math.max(2, Math.round(originalHeight * scaleFactor));

  const padX = Math.ceil(width * padding);
  const padY = Math.ceil(height * padding);

  const shapeCanvas = Konva.Util.createCanvasElement();
  shapeCanvas.width = width;
  shapeCanvas.height = height;
  const shapeCtx = shapeCanvas.getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  shapeCtx.drawImage(image, padX, padY, width - 2 * padX, height - 2 * padY);

  // 1) Shape mask from alpha.
  const data = shapeCtx.getImageData(0, 0, width, height).data;
  const shapeMask = new Uint8Array(width * height);
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    shapeMask[idx] = data[i + 3] === 0 ? 0 : 1;
  }

  // 2) Interior vs boundary pixels.
  const interiorIndices: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!shapeMask[idx]) continue;
      let isBoundary = false;
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        isBoundary = true;
      } else {
        isBoundary =
          !shapeMask[idx - 1] ||
          !shapeMask[idx + 1] ||
          !shapeMask[idx - width] ||
          !shapeMask[idx + width] ||
          !shapeMask[idx - width - 1] ||
          !shapeMask[idx - width + 1] ||
          !shapeMask[idx + width - 1] ||
          !shapeMask[idx + width + 1];
      }
      if (!isBoundary) interiorIndices.push(idx);
    }
  }

  // 3) Precompute 4-neighbor indices for the sparse solver.
  const pixelCount = interiorIndices.length;
  const interior = new Uint32Array(interiorIndices);
  const neighborIndices = new Int32Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const idx = interior[i] as number;
    const x = idx % width;
    const y = Math.floor(idx / width);
    neighborIndices[i * 4 + 0] = x < width - 1 && shapeMask[idx + 1] ? idx + 1 : -1;
    neighborIndices[i * 4 + 1] = x > 0 && shapeMask[idx - 1] ? idx - 1 : -1;
    neighborIndices[i * 4 + 2] = y > 0 && shapeMask[idx - width] ? idx - width : -1;
    neighborIndices[i * 4 + 3] = y < height - 1 && shapeMask[idx + width] ? idx + width : -1;
  }

  // 4) Red-black SOR Poisson solve.
  const C = 0.01;
  const omega = 1.9;
  const u = new Float32Array(width * height);
  const redPixels: number[] = [];
  const blackPixels: number[] = [];
  for (let i = 0; i < pixelCount; i++) {
    const idx = interior[i] as number;
    (((idx % width) + Math.floor(idx / width)) % 2 === 0 ? redPixels : blackPixels).push(i);
  }
  const relax = (list: number[]) => {
    for (const i of list) {
      const idx = interior[i] as number;
      let sumN = 0;
      const e = neighborIndices[i * 4 + 0] as number;
      const w2 = neighborIndices[i * 4 + 1] as number;
      const n = neighborIndices[i * 4 + 2] as number;
      const s = neighborIndices[i * 4 + 3] as number;
      if (e >= 0) sumN += u[e] as number;
      if (w2 >= 0) sumN += u[w2] as number;
      if (n >= 0) sumN += u[n] as number;
      if (s >= 0) sumN += u[s] as number;
      u[idx] = omega * ((C + sumN) / 4) + (1 - omega) * (u[idx] as number);
    }
  };
  for (let iter = 0; iter < ITERATIONS; iter++) {
    relax(redPixels);
    relax(blackPixels);
  }

  // 5) Gradient image at working resolution (gray = 1 - u/max inside shape).
  let maxVal = 0;
  for (let i = 0; i < pixelCount; i++) {
    const v = u[interior[i] as number] as number;
    if (v > maxVal) maxVal = v;
  }
  const tempCanvas = Konva.Util.createCanvasElement();
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  const tempImg = tempCtx.createImageData(width, height);
  for (let idx = 0; idx < width * height; idx++) {
    const px = idx * 4;
    if (!shapeMask[idx]) {
      tempImg.data[px] = 255;
      tempImg.data[px + 1] = 255;
      tempImg.data[px + 2] = 255;
      tempImg.data[px + 3] = 0;
    } else {
      const gray = 255 * (1 - (u[idx] as number) / (maxVal || 1));
      tempImg.data[px] = gray;
      tempImg.data[px + 1] = gray;
      tempImg.data[px + 2] = gray;
      tempImg.data[px + 3] = 255;
    }
  }
  tempCtx.putImageData(tempImg, 0, 0);

  // 6) Upscale smoothly to the original size, then re-apply crisp edges from
  //    the original-resolution alpha: R = gradient, G = original alpha.
  const canvas = Konva.Util.createCanvasElement();
  canvas.width = originalWidth;
  canvas.height = originalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, originalWidth, originalHeight);
  const outImg = ctx.getImageData(0, 0, originalWidth, originalHeight);

  const originalCanvas = Konva.Util.createCanvasElement();
  originalCanvas.width = originalWidth;
  originalCanvas.height = originalHeight;
  const originalCtx = originalCanvas.getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  const origPadX = Math.ceil(originalWidth * padding);
  const origPadY = Math.ceil(originalHeight * padding);
  originalCtx.drawImage(
    image,
    origPadX,
    origPadY,
    originalWidth - 2 * origPadX,
    originalHeight - 2 * origPadY,
  );
  const originalData = originalCtx.getImageData(0, 0, originalWidth, originalHeight);

  for (let i = 0; i < outImg.data.length; i += 4) {
    const a = originalData.data[i + 3] as number;
    const upscaledAlpha = outImg.data[i + 3] as number;
    if (a === 0) {
      outImg.data[i] = 255;
      outImg.data[i + 1] = 0;
    } else {
      outImg.data[i] = upscaledAlpha === 0 ? 0 : (outImg.data[i] as number);
      outImg.data[i + 1] = a;
    }
    outImg.data[i + 2] = 255;
    outImg.data[i + 3] = 255;
  }
  ctx.putImageData(outImg, 0, 0);

  return { canvas, aspectRatio: originalWidth / originalHeight };
}
