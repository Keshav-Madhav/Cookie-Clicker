import { animDrawers } from "./visuals/rowAnimDrawers.js";

/**
 * Animated overlays for building row backgrounds.
 * Each building type has a unique, hand-crafted animation drawn on a
 * transparent overlay canvas that sits on top of the static row background.
 *
 * Animations are time-based (stateless — everything computed from `t`),
 * so there's no per-frame state to track and no ghosting.
 */

export class RowAnimator {
  constructor() {
    this._animFrame = null;
    this._entries = new Map(); // buildingName → { overlay, ctx, w, h, dpr }
    this._extras = new Map();  // arbitrary key → { name, overlay, ctx, w, h, dpr }
    this._startTime = performance.now();
    this._lastFrame = 0;
  }

  init() {
    this._startAnimLoop();
  }

  /**
   * Scan the DOM for unlocked baker rows, create/update overlay canvases.
   * Call after updateBuildingShowcase().
   */
  refresh() {
    const container = document.getElementById('building-showcase');
    if (!container) return;

    const rows = container.querySelectorAll('.baker-row:not(.baker-row-locked)');
    const seen = new Set();

    rows.forEach(row => {
      const name = row.dataset.type;
      if (!name || !animDrawers[name]) return;
      seen.add(name);

      const bgWrap = row.querySelector('.baker-row-bg');
      if (!bgWrap) return;
      const rw = row.clientWidth;
      const rh = row.clientHeight;
      if (rw <= 0 || rh <= 0) return;

      let entry = this._entries.get(name);

      // Already set up at correct size
      if (entry && entry.overlay.isConnected && entry.w === rw && entry.h === rh) return;

      const dpr = window.devicePixelRatio || 1;
      let overlay = bgWrap.querySelector('.baker-row-anim');
      if (!overlay) {
        overlay = document.createElement('canvas');
        overlay.className = 'baker-row-anim';
        bgWrap.appendChild(overlay);
      }
      overlay.width = rw * dpr;
      overlay.height = rh * dpr;
      overlay.style.width = rw + 'px';
      overlay.style.height = rh + 'px';
      const ctx = overlay.getContext('2d');
      ctx.scale(dpr, dpr);

      this._entries.set(name, { el: row, overlay, ctx, w: rw, h: rh, dpr });
    });

    // Remove stale entries
    for (const [name, entry] of this._entries) {
      if (!seen.has(name) || !entry.overlay.isConnected) {
        this._entries.delete(name);
      }
    }
  }

  /**
   * Register an external overlay canvas (e.g. for the info panel banner).
   * @param {string} key   Unique key for this overlay (so it can be removed later).
   * @param {string} name  Building name (must match an animDrawers key).
   * @param {HTMLCanvasElement} canvas  The overlay canvas element.
   * @param {number} w  Logical width.
   * @param {number} h  Logical height.
   */
  addOverlay(key, name, canvas, w, h) {
    if (!animDrawers[name]) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    this._extras.set(key, { name, overlay: canvas, ctx, w, h, dpr });
  }

  /**
   * Remove a previously registered external overlay.
   * @param {string} key  The key passed to addOverlay().
   */
  removeOverlay(key) {
    this._extras.delete(key);
  }

  _startAnimLoop() {
    const loop = (timestamp) => {
      this._animFrame = requestAnimationFrame(loop);
      // Throttle to ~30fps
      if (timestamp - this._lastFrame < 33) return;
      this._lastFrame = timestamp;

      const t = (timestamp - this._startTime) / 1000;

      for (const [name, data] of this._entries) {
        if (!data.overlay.isConnected) continue;
        const { ctx, w, h, dpr } = data;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const drawFn = animDrawers[name];
        if (drawFn) drawFn(ctx, w, h, t);
      }

      // Draw extra (external) overlays (e.g. info panel banner)
      for (const [key, data] of this._extras) {
        if (!data.overlay.isConnected) {
          this._extras.delete(key);
          continue;
        }
        const { name, ctx, w, h, dpr } = data;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const drawFn = animDrawers[name];
        if (drawFn) drawFn(ctx, w, h, t);
      }
    };
    requestAnimationFrame(loop);
  }

  destroy() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

