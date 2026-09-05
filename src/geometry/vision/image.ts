/**
 * Classical image processing over plain typed arrays, so it runs in a worker
 * and in tests without a canvas. Images are row-major, width x height.
 */

export interface Gray {
  width: number;
  height: number;
  /** 0 = black, 255 = white. */
  data: Uint8ClampedArray;
}

export interface Binary {
  width: number;
  height: number;
  /** 1 = ink (wall), 0 = paper. */
  data: Uint8Array;
}

export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4] ?? 0;
    const g = rgba[i * 4 + 1] ?? 0;
    const b = rgba[i * 4 + 2] ?? 0;
    const a = (rgba[i * 4 + 3] ?? 255) / 255;
    // Transparent pixels count as paper.
    out[i] = Math.round((0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a));
  }
  return { width, height, data: out };
}

/** Summed-area table for fast window means. */
function integral(img: Gray): Float64Array {
  const { width, height, data } = img;
  const sat = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let row = 0;
    for (let x = 1; x <= width; x++) {
      row += data[(y - 1) * width + (x - 1)] ?? 0;
      sat[y * (width + 1) + x] = (sat[(y - 1) * (width + 1) + x] ?? 0) + row;
    }
  }
  return sat;
}

/**
 * Adaptive threshold: a pixel is ink when it is darker than the mean of its
 * neighbourhood by `offset`. Handles uneven scan lighting where a global
 * threshold would not.
 */
export function adaptiveThreshold(img: Gray, window = 31, offset = 15): Binary {
  const { width, height, data } = img;
  const sat = integral(img);
  const half = Math.floor(window / 2);
  const out = new Uint8Array(width * height);
  const W = width + 1;
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const sum =
        (sat[y1 * W + x1] ?? 0) -
        (sat[y0 * W + x1] ?? 0) -
        (sat[y1 * W + x0] ?? 0) +
        (sat[y0 * W + x0] ?? 0);
      const mean = sum / ((y1 - y0) * (x1 - x0));
      out[y * width + x] = (data[y * width + x] ?? 255) < mean - offset ? 1 : 0;
    }
  }
  return { width, height, data: out };
}

function morph(img: Binary, radius: number, dilate: boolean): Binary {
  const { width, height, data } = img;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = dilate ? 0 : 1;
      for (let dy = -radius; dy <= radius && (dilate ? hit === 0 : hit === 1); dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) {
          if (!dilate) hit = 0;
          continue;
        }
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          const v = xx < 0 || xx >= width ? 0 : (data[yy * width + xx] ?? 0);
          if (dilate && v === 1) {
            hit = 1;
            break;
          }
          if (!dilate && v === 0) {
            hit = 0;
            break;
          }
        }
      }
      out[y * width + x] = hit;
    }
  }
  return { width, height, data: out };
}

/** Closing (dilate then erode) fills hairline gaps in scanned wall lines. */
export const close = (img: Binary, radius = 1): Binary =>
  morph(morph(img, radius, true), radius, false);

/** Nearest-neighbour downsample so the skew search stays cheap on large scans. */
export function downsample(img: Binary, maxWidth: number): Binary {
  if (img.width <= maxWidth) return img;
  const f = Math.ceil(img.width / maxWidth);
  const width = Math.floor(img.width / f);
  const height = Math.floor(img.height / f);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let any = 0;
      for (let dy = 0; dy < f && !any; dy++)
        for (let dx = 0; dx < f; dx++)
          if (img.data[(y * f + dy) * img.width + x * f + dx] === 1) {
            any = 1;
            break;
          }
      data[y * width + x] = any;
    }
  }
  return { width, height, data };
}

/** Sharpness of the row projection: Σ (ink per row)². Highest when lines are horizontal. */
function rowSharpness(img: Binary): number {
  let score = 0;
  for (let y = 0; y < img.height; y++) {
    let n = 0;
    for (let x = 0; x < img.width; x++) n += img.data[y * img.width + x] ?? 0;
    score += n * n;
  }
  return score;
}

/**
 * Corrective rotation in degrees (pass it to `rotate` to straighten the image) by the projection profile method: rotate a small copy
 * through candidate angles and keep the one whose row histogram is sharpest,
 * coarse search in 0.5 degree steps, then refined in 0.1 degree steps.
 */
export function estimateSkew(img: Binary, maxDeg = 6): number {
  const small = downsample(img, 400);
  const best = (from: number, to: number, step: number) => {
    let bestDeg = 0;
    let bestScore = -1;
    for (let deg = from; deg <= to + 1e-9; deg += step) {
      const score = rowSharpness(Math.abs(deg) < 1e-9 ? small : rotate(small, deg));
      if (score > bestScore) {
        bestScore = score;
        bestDeg = deg;
      }
    }
    return bestDeg;
  };
  const coarse = best(-maxDeg, maxDeg, 0.5);
  const fine = best(coarse - 0.5, coarse + 0.5, 0.1);
  return Math.round(fine * 10) / 10;
}

/** Rotates a binary image by `deg` about its centre with nearest sampling; canvas size unchanged. */
export function rotate(img: Binary, deg: number): Binary {
  const { width, height, data } = img;
  const out = new Uint8Array(width * height);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const sx = Math.round(cx + dx * cos + dy * sin);
      const sy = Math.round(cy - dx * sin + dy * cos);
      if (sx >= 0 && sx < width && sy >= 0 && sy < height)
        out[y * width + x] = data[sy * width + sx] ?? 0;
    }
  }
  return { width, height, data: out };
}
