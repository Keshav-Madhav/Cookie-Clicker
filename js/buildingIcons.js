import { iconDrawers, drawDefaultIcon } from "./visuals/iconDrawers.js";
import { rowBgDrawers, drawDefaultRowBg } from "./visuals/rowBgDrawers.js";

/**
 * Canvas-drawn icons for each building type.
 * Each function draws a unique icon on a given canvas context.
 * Call getBuildingIcon(name, size) to get a <canvas> element with the icon.
 */

const iconCache = new Map();

/** Get (or create) a canvas icon for a building */
export function getBuildingIcon(buildingName, size = 48) {
  const key = `${buildingName}_${size}`;
  const dpr = window.devicePixelRatio || 1;

  if (!iconCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const drawFn = iconDrawers[buildingName];
    if (drawFn) {
      drawFn(ctx, size);
    } else {
      drawDefaultIcon(ctx, size);
    }
    iconCache.set(key, canvas);
  }

  // Create a fresh canvas and copy the cached pixels onto it
  const src = iconCache.get(key);
  const copy = document.createElement('canvas');
  copy.width = src.width;
  copy.height = src.height;
  copy.style.width = `${size}px`;
  copy.style.height = `${size}px`;
  copy.getContext('2d').drawImage(src, 0, 0);
  return copy;
}

/** Clear the cache (e.g. on DPR change) */
export function clearIconCache() {
  iconCache.clear();
}

/* ════════════════════════════════════════════════════════════════
   Row background drawers — wide panoramic scenes per building type
   drawn in the same quirky canvas style as the icons.
   Called via getRowBackground(name, width, height).
   ════════════════════════════════════════════════════════════════ */

const rowBgCache = new Map();

/** Get (or create) a canvas row background for a building type */
export function getRowBackground(buildingName, w, h) {
  const dpr = window.devicePixelRatio || 1;
  const key = `${buildingName}_${w}_${h}_${dpr}`;
  if (rowBgCache.has(key)) return rowBgCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const drawFn = rowBgDrawers[buildingName];
  if (drawFn) {
    drawFn(ctx, w, h);
  } else {
    drawDefaultRowBg(ctx, w, h);
  }
  rowBgCache.set(key, canvas);
  return canvas;
}

/** Clear row bg cache (on resize) */
export function clearRowBgCache() {
  rowBgCache.clear();
}

/* ─── Row background drawers ─── */

