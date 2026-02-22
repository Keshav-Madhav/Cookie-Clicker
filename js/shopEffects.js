/**
 * ShopEffects — animated visual effects for the right-side shop panel.
 *
 * Features:
 *  1. Floating background particles (golden dust, sparkles, cookie crumbs)
 *  2. Per-building themed row canvas backgrounds (added later)
 *  5. Scroll-linked parallax, vignette, and depth effects (added later)
 *  8. Animated header decorations with wooden signs & lanterns (added later)
 *
 * Architecture mirrors RowAnimator: single RAF loop, ~30fps throttle,
 * time-based stateless animations, DPR-scaled canvases.
 */

import { SHOP_VISUAL } from "./config.js";

/* ═══════════════════════════════════════════════════════════════════
   Helpers (same pattern as rowAnimations.js)
   ═══════════════════════════════════════════════════════════════════ */

function hash(i, seed) {
  return ((i * 997 + seed * 137) % 65537) / 65537;
}

function star(ctx, cx, cy, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function flicker(t, speed, seed) {
  return 0.55 + 0.22 * Math.sin(t * speed * 8 + seed)
             + 0.12 * Math.sin(t * speed * 13 + seed * 2.3)
             + 0.11 * Math.sin(t * speed * 17.7 + seed * 4.1);
}

/* ═══════════════════════════════════════════════════════════════════
   Particle types for background
   ═══════════════════════════════════════════════════════════════════ */

const DUST_COLORS = [
  [255, 215, 0],    // gold
  [248, 196, 113],  // amber
  [255, 248, 220],  // warm white
  [255, 200, 100],  // deep gold
  [230, 180, 80],   // burnished gold
];

const CRUMB_COLORS = [
  [180, 140, 80],
  [160, 120, 60],
  [200, 160, 100],
  [140, 100, 55],
];

/* ═══════════════════════════════════════════════════════════════════
   ShopEffects class
   ═══════════════════════════════════════════════════════════════════ */

export class ShopEffects {
  constructor() {
    this._animFrame = null;
    this._startTime = performance.now();
    this._lastFrame = 0;

    // Feature 1: Background particles
    this._bgCanvas = null;
    this._bgCtx = null;
    this._bgW = 0;
    this._bgH = 0;
    this._dust = [];
    this._sparkles = [];
    this._crumbs = [];

    // Feature 2: Building row canvas backgrounds
    this._rowEntries = new Map();

    // Feature 5: Scroll & Dock state
    this._scrollTop = 0;
    this._scrollMax = 0;
    this._scrollDirty = false;
    this._lastScrollTop = 0;
    this._vigCanvas = null;
    this._vigCtx = null;
    this._vigW = 0;
    this._vigH = 0;
    this._buildingListEl = null;
    this._onScroll = null;

    // Dock effect (mouse proximity scaling)
    this._mouseY = -1;           // -1 = mouse not over list
    this._mouseActive = false;
    this._rowScales = new Map();  // buildingIndex -> currentScale (for lerp)
    this._rowMargins = new Map(); // buildingIndex -> currentMargin (for lerp)

    // Feature 8: Header canvases
    this._headers = [];

    // Resize handler ref
    this._onResize = () => this._handleResize();
  }

  /* ───────────────────────── bootstrap ───────────────────────── */

  init() {
    this._setupBackground();
    this._seedParticles();
    this._setupHeaders();
    this._setupScrollEffects();
    window.addEventListener('resize', this._onResize);
    this._startAnimLoop();
  }

  /** Re-scan DOM after renderBuildingList rebuilds rows */
  refresh() {
    this._scrollDirty = true;
    // Immediately apply dock scales to new rows so there's no flash
    this._applyDockEffect();
    // Feature 2 will hook here
  }

  destroy() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    window.removeEventListener('resize', this._onResize);
    if (this._buildingListEl && this._onScroll) {
      this._buildingListEl.removeEventListener('scroll', this._onScroll);
    }
  }

  /* ───────────────────────── animation loop ───────────────────── */

  _startAnimLoop() {
    const loop = (timestamp) => {
      this._animFrame = requestAnimationFrame(loop);
      if (timestamp - this._lastFrame < SHOP_VISUAL.frameThrottleMs) return;
      this._lastFrame = timestamp;

      const t = (timestamp - this._startTime) / 1000;

      this._drawBackground(t);
      this._drawScrollEffects(t);
      this._drawHeaders(t);
    };
    requestAnimationFrame(loop);
  }

  /* ═══════════════════════════════════════════════════════════════
     Feature 1: Animated Shop Background
     ═══════════════════════════════════════════════════════════════ */

  _setupBackground() {
    this._bgCanvas = document.getElementById('shop-bg-canvas');
    if (!this._bgCanvas) return;

    const shop = this._bgCanvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = shop.clientWidth;
    const h = shop.clientHeight;

    this._bgCanvas.width = w * dpr;
    this._bgCanvas.height = h * dpr;
    this._bgCanvas.style.width = w + 'px';
    this._bgCanvas.style.height = h + 'px';

    this._bgCtx = this._bgCanvas.getContext('2d');
    this._bgCtx.scale(dpr, dpr);
    this._bgW = w;
    this._bgH = h;
  }

  _seedParticles() {
    const cfg = SHOP_VISUAL.background;
    const w = this._bgW;
    const h = this._bgH;
    if (w === 0 || h === 0) return;

    // Golden dust motes (layer 1 — slowest parallax)
    this._dust = [];
    for (let i = 0; i < cfg.dustCount; i++) {
      this._dust.push({
        x: hash(i, 1) * w,
        y: hash(i, 2) * h,
        speed: cfg.dustSpeedMin + hash(i, 3) * cfg.dustSpeedRange,
        size: cfg.dustSizeMin + hash(i, 4) * cfg.dustSizeRange,
        wobbleSpeed: 0.3 + hash(i, 5) * 0.6,
        wobbleAmp: 8 + hash(i, 6) * 15,
        phase: hash(i, 7) * Math.PI * 2,
        pulseSpeed: 0.4 + hash(i, 8) * 0.8,
        pulsePhase: hash(i, 9) * Math.PI * 2,
        color: DUST_COLORS[Math.floor(hash(i, 10) * DUST_COLORS.length)],
        baseOpacity: 0.05 + hash(i, 11) * 0.15,
        layer: 1,
      });
    }

    // Sparkles (layer 2 — medium parallax)
    this._sparkles = [];
    for (let i = 0; i < cfg.sparkleCount; i++) {
      this._sparkles.push({
        x: hash(i, 20) * w,
        y: hash(i, 21) * h,
        driftX: (hash(i, 22) - 0.5) * 0.15,
        driftY: -0.02 - hash(i, 23) * 0.05,
        size: 1.5 + hash(i, 24) * 1.5,
        phase: hash(i, 25) * Math.PI * 2,
        cycleSpeed: 0.3 + hash(i, 26) * 0.5,
        color: DUST_COLORS[Math.floor(hash(i, 27) * 3)], // gold/amber/white only
        baseOpacity: 0.08 + hash(i, 28) * 0.17,
        layer: 2,
      });
    }

    // Cookie crumbs (layer 3 — fastest parallax)
    this._crumbs = [];
    for (let i = 0; i < cfg.crumbCount; i++) {
      this._crumbs.push({
        x: hash(i, 40) * w,
        y: hash(i, 41) * h,
        speed: cfg.crumbRiseSpeed + hash(i, 42) * cfg.crumbRiseSpeedRange,
        size: 2 + hash(i, 43) * 3,
        rotation: hash(i, 44) * Math.PI * 2,
        rotSpeed: (hash(i, 45) - 0.5) * 0.8,
        wobbleAmp: 5 + hash(i, 46) * 8,
        wobbleSpeed: 0.2 + hash(i, 47) * 0.4,
        phase: hash(i, 48) * Math.PI * 2,
        color: CRUMB_COLORS[Math.floor(hash(i, 49) * CRUMB_COLORS.length)],
        baseOpacity: 0.06 + hash(i, 50) * 0.14,
        layer: 3,
      });
    }
  }

  _drawBackground(t) {
    const ctx = this._bgCtx;
    if (!ctx) return;
    const w = this._bgW;
    const h = this._bgH;
    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Parallax offsets based on scroll (Feature 5 integration)
    const scrollCfg = SHOP_VISUAL.scroll;
    const scrollOff1 = this._scrollTop * scrollCfg.parallaxLayer1;
    const scrollOff2 = this._scrollTop * scrollCfg.parallaxLayer2;
    const scrollOff3 = this._scrollTop * scrollCfg.parallaxLayer3;

    // --- Layer 1: Golden dust motes (slowest parallax) ---
    for (const d of this._dust) {
      // Move upward
      d.y -= d.speed;
      if (d.y < -10) {
        d.y = h + 10;
        d.x = Math.random() * w;
      }

      const wobbleX = Math.sin(t * d.wobbleSpeed + d.phase) * d.wobbleAmp;
      const drawX = d.x + wobbleX;
      const drawY = ((d.y - scrollOff1) % (h + 20) + (h + 20)) % (h + 20) - 10;

      // Pulsing opacity
      const pulse = 0.5 + 0.5 * Math.sin(t * d.pulseSpeed + d.pulsePhase);
      const alpha = d.baseOpacity + pulse * 0.15;

      // Draw soft circle with glow
      const [r, g, b] = d.color;
      const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, d.size * 2.5);
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.5})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(drawX - d.size * 2.5, drawY - d.size * 2.5, d.size * 5, d.size * 5);
    }

    // --- Layer 2: Sparkles (medium parallax) ---
    for (const s of this._sparkles) {
      // Gentle drift
      s.x += s.driftX;
      s.y += s.driftY;
      if (s.y < -10) { s.y = h + 10; s.x = Math.random() * w; }
      if (s.x < -10) s.x = w + 10;
      if (s.x > w + 10) s.x = -10;

      // Phase-based fade: visible for only part of the cycle
      const phase = (Math.sin(t * s.cycleSpeed + s.phase) + 1) / 2;
      const fadeWindow = Math.max(0, phase * 2 - 1); // only visible top half of sine
      if (fadeWindow <= 0) continue;

      const alpha = s.baseOpacity * fadeWindow;
      const [r, g, b] = s.color;

      const drawY = ((s.y - scrollOff2) % (h + 20) + (h + 20)) % (h + 20) - 10;

      ctx.save();
      ctx.translate(s.x, drawY);
      ctx.rotate(t * 0.3 + s.phase);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      star(ctx, 0, 0, s.size, s.size * 0.35, 4);
      ctx.fill();

      // Tiny glow around sparkle
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s.size * 3);
      glow.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.3})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(-s.size * 3, -s.size * 3, s.size * 6, s.size * 6);

      ctx.restore();
    }

    // --- Layer 3: Cookie crumbs (fastest parallax) ---
    for (const c of this._crumbs) {
      c.y -= c.speed;
      c.rotation += c.rotSpeed * 0.016; // ~60fps normalized
      if (c.y < -10) {
        c.y = h + 10;
        c.x = Math.random() * w;
      }

      const wobbleX = Math.sin(t * c.wobbleSpeed + c.phase) * c.wobbleAmp;
      const drawX = c.x + wobbleX;
      const drawY = ((c.y - scrollOff3) % (h + 20) + (h + 20)) % (h + 20) - 10;

      // Fade based on vertical position (fade near edges)
      const edgeFade = Math.sin((drawY / h) * Math.PI);
      const alpha = c.baseOpacity * Math.max(0.2, edgeFade);

      const [r, g, b] = c.color;
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(c.rotation);
      ctx.globalAlpha = alpha;

      // Irregular crumb shape: rotated rectangle with slight variation
      const hw = c.size * 0.6;
      const hh = c.size * 0.4;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(-hw, -hh * 0.7);
      ctx.lineTo(hw * 0.8, -hh);
      ctx.lineTo(hw, hh * 0.6);
      ctx.lineTo(-hw * 0.6, hh);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     Feature 8: Animated Header Decorations
     ═══════════════════════════════════════════════════════════════ */

  _setupHeaders() {
    this._headers = [];
    const canvases = document.querySelectorAll('.shop-header-canvas');
    const dpr = window.devicePixelRatio || 1;

    canvases.forEach(canvas => {
      const container = canvas.parentElement;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      const label = canvas.dataset.label || '';
      const isBuildings = label === 'Auto-Bakers';

      this._headers.push({ canvas, ctx, w, h, dpr, label, isBuildings });
    });
  }

  _drawHeaders(t) {
    const cfg = SHOP_VISUAL.header;

    for (const hdr of this._headers) {
      if (!hdr.canvas.isConnected) continue;
      const { ctx, w, h, label, isBuildings, dpr } = hdr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Layout constants
      const signW = Math.min(w * 0.68, 200);
      const signH = 28;
      const signTop = 16;
      const signCx = w / 2;
      const signCy = signTop;
      const signR = 5; // border radius

      // Sway angle (pivot at top-center of sign)
      const swayAngle = Math.sin(t * cfg.swaySpeed) * cfg.swayAmount * Math.PI / 180;

      // Chain anchor points (fixed at top)
      const chainLeftX = signCx - signW * 0.35;
      const chainRightX = signCx + signW * 0.35;
      const chainTopY = 2;

      // Sign corner positions after sway (for chain endpoints)
      const cosA = Math.cos(swayAngle);
      const sinA = Math.sin(swayAngle);
      const signLeftOff = -signW * 0.35;
      const signRightOff = signW * 0.35;
      // After rotation around (signCx, signCy):
      const chainLeftEndX = signCx + signLeftOff * cosA;
      const chainLeftEndY = signCy + signLeftOff * sinA;
      const chainRightEndX = signCx + signRightOff * cosA;
      const chainRightEndY = signCy + signRightOff * sinA;

      // --- Draw chains ---
      this._drawChain(ctx, chainLeftX, chainTopY, chainLeftEndX, chainLeftEndY, cfg.chainLinks, t, 0);
      this._drawChain(ctx, chainRightX, chainTopY, chainRightEndX, chainRightEndY, cfg.chainLinks, t, 1);

      // --- Draw sign (rotated) ---
      ctx.save();
      ctx.translate(signCx, signCy);
      ctx.rotate(swayAngle);

      // Sign board shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      this._roundRect(ctx, -signW / 2 + 2, 3, signW, signH, signR);
      ctx.fill();

      // Sign board body — wood grain gradient
      const woodGrad = ctx.createLinearGradient(-signW / 2, 0, -signW / 2, signH);
      woodGrad.addColorStop(0, '#9B7530');
      woodGrad.addColorStop(0.3, '#8B6914');
      woodGrad.addColorStop(0.7, '#7A5C12');
      woodGrad.addColorStop(1, '#6B4F12');
      ctx.fillStyle = woodGrad;
      this._roundRect(ctx, -signW / 2, 0, signW, signH, signR);
      ctx.fill();

      // Wood grain lines
      ctx.strokeStyle = 'rgba(90,57,33,0.25)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 6; i++) {
        const gy = 3 + i * (signH - 6) / 5 + hash(i, 80) * 3;
        ctx.beginPath();
        ctx.moveTo(-signW / 2 + 4, gy);
        // Wavy grain line
        const cp1x = -signW / 4;
        const cp1y = gy + (hash(i, 81) - 0.5) * 4;
        const cp2x = signW / 4;
        const cp2y = gy + (hash(i, 82) - 0.5) * 4;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, signW / 2 - 4, gy + (hash(i, 83) - 0.5) * 2);
        ctx.stroke();
      }

      // Sign border
      ctx.strokeStyle = '#5a3921';
      ctx.lineWidth = 1.5;
      this._roundRect(ctx, -signW / 2, 0, signW, signH, signR);
      ctx.stroke();

      // Inner highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      this._roundRect(ctx, -signW / 2 + 1.5, 1.5, signW - 3, signH - 3, signR - 1);
      ctx.stroke();

      // Corner nails
      const nailOffX = signW / 2 - 6;
      const nailOffY = signH / 2;
      for (const nx of [-nailOffX, nailOffX]) {
        ctx.beginPath();
        ctx.arc(nx, nailOffY, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#8a7040';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(nx - 0.3, nailOffY - 0.3, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();
      }

      // --- Text on the sign ---
      const fontSize = Math.min(14, signH * 0.48);
      ctx.font = `bold ${fontSize}px Georgia, "Times New Roman", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Text shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(label, 1, signH / 2 + 1.5);
      // Main text
      ctx.fillStyle = '#f5e8d3';
      ctx.shadowColor = 'rgba(255,200,100,0.2)';
      ctx.shadowBlur = 6;
      ctx.fillText(label, 0, signH / 2);
      ctx.shadowBlur = 0;

      // --- Lanterns (at sign corners, sway with sign) ---
      this._drawLantern(ctx, -signW / 2 - 2, -1, t, cfg.lanternFlickerSpeed, 10);
      this._drawLantern(ctx, signW / 2 + 2, -1, t, cfg.lanternFlickerSpeed, 20);

      // --- Tiny shopkeeper (Auto-Bakers only) ---
      if (isBuildings) {
        this._drawShopkeeper(ctx, signW / 2 - 16, -1, t);
      }

      ctx.restore();

      // --- Ambient warm glow behind sign ---
      const glowAlpha = 0.03 + 0.015 * Math.sin(t * 0.8);
      const glow = ctx.createRadialGradient(signCx, signCy + signH / 2, 0, signCx, signCy + signH / 2, signW * 0.7);
      glow.addColorStop(0, `rgba(255,200,100,${glowAlpha})`);
      glow.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
  }

  _drawChain(ctx, x1, y1, x2, y2, links, t, seed) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(160,140,110,0.6)';
    ctx.lineWidth = 1.2;

    for (let i = 0; i <= links; i++) {
      const frac = i / links;
      const px = x1 + dx * frac;
      const py = y1 + dy * frac;

      // Alternating horizontal/vertical oval links
      const linkW = 3;
      const linkH = len / links * 0.55;
      const isHoriz = i % 2 === 0;

      ctx.beginPath();
      if (isHoriz) {
        ctx.ellipse(px, py, linkW, linkH * 0.5, Math.atan2(dy, dx), 0, Math.PI * 2);
      } else {
        ctx.ellipse(px, py, linkH * 0.5, linkW, Math.atan2(dy, dx), 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    // Tiny highlight on top link
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(x1, y1 + 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawLantern(ctx, x, y, t, flickerSpeed, seed) {
    const fl = flicker(t, flickerSpeed, seed);

    // Lantern glow
    const glowR = 12 + fl * 4;
    const glow = ctx.createRadialGradient(x, y - 2, 0, x, y - 2, glowR);
    glow.addColorStop(0, `rgba(255,180,60,${fl * 0.18})`);
    glow.addColorStop(0.5, `rgba(255,150,40,${fl * 0.08})`);
    glow.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - glowR, y - 2 - glowR, glowR * 2, glowR * 2);

    // Lantern body (tiny trapezoid)
    ctx.fillStyle = '#6B4F12';
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y);
    ctx.lineTo(x + 2.5, y);
    ctx.lineTo(x + 2, y + 6);
    ctx.lineTo(x - 2, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a7040';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Lantern glass (warm glow inside)
    ctx.fillStyle = `rgba(255,200,80,${0.3 + fl * 0.3})`;
    ctx.fillRect(x - 1.5, y + 1, 3, 4);

    // Flame
    const flameH = 3 + Math.sin(t * 10 + seed) * 1;
    const flameW = 1.5 + Math.sin(t * 7 + seed * 1.5) * 0.5;
    ctx.fillStyle = `rgba(255,200,60,${0.6 + fl * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(x - flameW, y);
    ctx.quadraticCurveTo(x - flameW * 0.3, y - flameH * 0.6, x, y - flameH);
    ctx.quadraticCurveTo(x + flameW * 0.3, y - flameH * 0.6, x + flameW, y);
    ctx.closePath();
    ctx.fill();

    // Flame core (brighter)
    ctx.fillStyle = `rgba(255,240,180,${0.5 + fl * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(x - flameW * 0.4, y);
    ctx.quadraticCurveTo(x, y - flameH * 0.7, x + flameW * 0.4, y);
    ctx.closePath();
    ctx.fill();

    // Hook at top
    ctx.strokeStyle = 'rgba(160,140,110,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y - 1, 1.5, Math.PI, 0);
    ctx.stroke();
  }

  _drawShopkeeper(ctx, x, baseY, t) {
    // Bob up and down
    const bob = Math.sin(t * 1.2) * 1.5;
    // Occasionally duck behind sign (~every 6 seconds, hidden for 1s)
    const duckCycle = (t * 0.167) % 1; // 6 second period
    const isDucking = duckCycle > 0.83;
    const duckOffset = isDucking ? 8 * Math.sin((duckCycle - 0.83) / 0.17 * Math.PI) : 0;
    const y = baseY + bob + duckOffset;

    // Chef hat (white, above head)
    ctx.fillStyle = '#f0ebe0';
    // Hat brim
    ctx.fillRect(x - 4, y - 5, 10, 2);
    // Hat top (puffy)
    ctx.beginPath();
    ctx.arc(x + 1, y - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 2, y - 8, 6, 4);

    // Head
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(x + 1, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#2c1810';
    ctx.beginPath();
    ctx.arc(x - 0.5, y - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2.5, y - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (tiny smile)
    ctx.strokeStyle = '#8b5e34';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(x + 1, y + 1.5, 1.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Body (small, peeking)
    ctx.fillStyle = '#f0ebe0'; // white chef coat
    ctx.fillRect(x - 2, y + 3, 6, 5);
    // Coat buttons
    ctx.fillStyle = '#8a7040';
    ctx.beginPath();
    ctx.arc(x + 1, y + 5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 1, y + 7, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ═══════════════════════════════════════════════════════════════
     Feature 5: Scroll-Linked Ambient Effects
     ═══════════════════════════════════════════════════════════════ */

  _setupScrollEffects() {
    this._buildingListEl = document.getElementById('building-list');
    this._vigCanvas = document.getElementById('shop-scroll-vignette');
    if (!this._vigCanvas || !this._buildingListEl) return;

    const wrap = document.getElementById('building-list-wrap');
    if (!wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;

    this._vigCanvas.width = w * dpr;
    this._vigCanvas.height = h * dpr;
    this._vigCanvas.style.width = w + 'px';
    this._vigCanvas.style.height = h + 'px';
    this._vigCtx = this._vigCanvas.getContext('2d');
    this._vigCtx.scale(dpr, dpr);
    this._vigW = w;
    this._vigH = h;

    // Passive scroll listener
    this._onScroll = () => {
      this._lastScrollTop = this._scrollTop;
      this._scrollTop = this._buildingListEl.scrollTop;
      this._scrollMax = Math.max(1, this._buildingListEl.scrollHeight - this._buildingListEl.clientHeight);
      this._scrollDirty = true;
    };
    this._buildingListEl.addEventListener('scroll', this._onScroll, { passive: true });
    // Initialize
    this._onScroll();

    // Dock effect: mouse tracking on the building list
    this._buildingListEl.addEventListener('mousemove', (e) => {
      this._mouseY = e.clientY;
      this._mouseActive = true;
    }, { passive: true });

    this._buildingListEl.addEventListener('mouseleave', () => {
      this._mouseActive = false;
    }, { passive: true });
  }

  _drawScrollEffects(t) {
    const ctx = this._vigCtx;
    if (!ctx) return;
    const w = this._vigW;
    const h = this._vigH;
    const dpr = window.devicePixelRatio || 1;
    const cfg = SHOP_VISUAL.scroll;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const scrollRatio = this._scrollMax > 1 ? this._scrollTop / this._scrollMax : 0;
    const canScroll = this._scrollMax > 1;

    if (!canScroll) return;

    // --- Top edge warm glow (stronger when scrolled down) ---
    const topAlpha = scrollRatio * cfg.edgeGlowIntensity;
    if (topAlpha > 0.005) {
      const topGrad = ctx.createLinearGradient(0, 0, 0, 35);
      topGrad.addColorStop(0, `rgba(90,57,33,${topAlpha * 1.8})`);
      topGrad.addColorStop(0.4, `rgba(160,100,40,${topAlpha * 0.5})`);
      topGrad.addColorStop(1, 'rgba(160,100,40,0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, w, 35);

      // Warm accent line at very top
      ctx.fillStyle = `rgba(255,200,100,${topAlpha * 0.4})`;
      ctx.fillRect(0, 0, w, 1.5);
    }

    // --- Bottom edge warm glow (stronger when scrolled up) ---
    const bottomAlpha = (1 - scrollRatio) * cfg.edgeGlowIntensity;
    if (bottomAlpha > 0.005) {
      const bottomGrad = ctx.createLinearGradient(0, h - 35, 0, h);
      bottomGrad.addColorStop(0, 'rgba(160,100,40,0)');
      bottomGrad.addColorStop(0.6, `rgba(160,100,40,${bottomAlpha * 0.5})`);
      bottomGrad.addColorStop(1, `rgba(90,57,33,${bottomAlpha * 1.8})`);
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, h - 35, w, 35);

      // Warm accent line at very bottom
      ctx.fillStyle = `rgba(255,200,100,${bottomAlpha * 0.4})`;
      ctx.fillRect(0, h - 1.5, w, 1.5);
    }

    // --- Scroll boundary pulse (at top/bottom limits) ---
    if (this._scrollTop <= 0) {
      const pulseAlpha = (0.06 + 0.04 * Math.sin(t * 2)) * (1 - scrollRatio);
      const pulseGrad = ctx.createLinearGradient(0, 0, 0, 12);
      pulseGrad.addColorStop(0, `rgba(255,200,100,${pulseAlpha})`);
      pulseGrad.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = pulseGrad;
      ctx.fillRect(0, 0, w, 12);
    }
    if (this._scrollTop >= this._scrollMax - 1) {
      const pulseAlpha = (0.06 + 0.04 * Math.sin(t * 2)) * scrollRatio;
      const pulseGrad = ctx.createLinearGradient(0, h - 12, 0, h);
      pulseGrad.addColorStop(0, 'rgba(255,200,100,0)');
      pulseGrad.addColorStop(1, `rgba(255,200,100,${pulseAlpha})`);
      ctx.fillStyle = pulseGrad;
      ctx.fillRect(0, h - 12, w, 12);
    }

    // --- Dock effect: mouse proximity row scaling ---
    this._applyDockEffect();
  }

  _applyDockEffect() {
    if (!this._buildingListEl) return;
    const dock = SHOP_VISUAL.dock;
    const rows = this._buildingListEl.querySelectorAll('.building');
    if (!rows.length) return;

    const sigma2x2 = 2 * dock.sigma * dock.sigma;
    const lerp = dock.lerpSpeed;

    for (const row of rows) {
      const idx = row.dataset.buildingIndex || '0';
      let targetScale, targetMargin;

      if (this._mouseActive && this._mouseY >= 0) {
        // Calculate distance from mouse to row center
        const rect = row.getBoundingClientRect();
        const rowCenter = rect.top + rect.height / 2;
        const dist = Math.abs(this._mouseY - rowCenter);

        // Gaussian falloff: 1.0 at mouse, falls off with distance
        const influence = Math.exp(-(dist * dist) / sigma2x2);

        // Scale: lerp between minScale (far) and maxScale (near)
        targetScale = dock.minScale + (dock.maxScale - dock.minScale) * influence;
        // Margin: concentrated near mouse (squared falloff = tighter focus)
        const marginInfluence = influence * influence;
        targetMargin = dock.baseMargin + (dock.maxMargin - dock.baseMargin) * marginInfluence;
      } else {
        targetScale = dock.restScale;
        targetMargin = dock.baseMargin;
      }

      // Smooth interpolation toward targets
      const curScale = this._rowScales.get(idx) ?? dock.restScale;
      const newScale = curScale + (targetScale - curScale) * lerp;
      this._rowScales.set(idx, newScale);

      const curMargin = this._rowMargins.get(idx) ?? dock.baseMargin;
      const newMargin = curMargin + (targetMargin - curMargin) * lerp;
      this._rowMargins.set(idx, newMargin);

      // Apply (round to avoid sub-pixel jitter)
      const s = Math.round(newScale * 1000) / 1000;
      const m = Math.round(newMargin * 10) / 10;
      row.style.transform = `scale(${s})`;
      row.style.marginTop = `${m}px`;
      row.style.marginBottom = `${m}px`;
    }
  }

  _setupScrollVignetteCanvas() {
    if (!this._vigCanvas) return;
    const wrap = document.getElementById('building-list-wrap');
    if (!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    this._vigCanvas.width = w * dpr;
    this._vigCanvas.height = h * dpr;
    this._vigCanvas.style.width = w + 'px';
    this._vigCanvas.style.height = h + 'px';
    this._vigCtx = this._vigCanvas.getContext('2d');
    this._vigCtx.scale(dpr, dpr);
    this._vigW = w;
    this._vigH = h;
  }

  /** Helper: draw a rounded rectangle path */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ═══════════════════════════════════════════════════════════════
     Resize handling
     ═══════════════════════════════════════════════════════════════ */

  _handleResize() {
    this._setupBackground();
    this._setupHeaders();
    this._setupScrollVignetteCanvas();
    // Re-scale existing particles to new dimensions
    const w = this._bgW;
    const h = this._bgH;
    if (w === 0 || h === 0) return;

    for (const d of this._dust) { d.x = Math.random() * w; d.y = Math.random() * h; }
    for (const s of this._sparkles) { s.x = Math.random() * w; s.y = Math.random() * h; }
    for (const c of this._crumbs) { c.x = Math.random() * w; c.y = Math.random() * h; }
  }
}
