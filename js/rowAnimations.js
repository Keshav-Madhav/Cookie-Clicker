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

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
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

/** Pseudo-random from seed (deterministic) */
function hash(i, seed) {
  return ((i * 997 + seed * 137) % 65537) / 65537;
}

/** Natural flicker: mix of multiple sine waves */
function flicker(t, speed, seed) {
  return 0.55 + 0.22 * Math.sin(t * speed * 8 + seed)
             + 0.12 * Math.sin(t * speed * 13 + seed * 2.3)
             + 0.11 * Math.sin(t * speed * 17.7 + seed * 4.1);
}

/* ═══════════════════════════════════════════════════════════════════
   Per-building animation drawers
   Each receives (ctx, w, h, t) where t = seconds since start.
   Draw ONLY animated overlay elements on a transparent canvas.
   ═══════════════════════════════════════════════════════════════════ */

const animDrawers = {

  /* ── Cursor: Digital workspace — screens flicker, cursors click ── */
  Cursor(ctx, w, h, t) {
    const monitorCount = Math.floor(w / 80);

    // Pulsing screen glow on monitors
    for (let i = 0; i < monitorCount; i++) {
      const mx = 20 + i * 70 + Math.sin(i * 2.3) * 15;
      const my = h * 0.25;
      const pulse = 0.15 + 0.12 * Math.sin(t * 2.5 + i * 1.7);
      const hue = i % 3 === 0 ? '0,255,100' : i % 3 === 1 ? '100,150,255' : '0,200,255';
      const glow = ctx.createRadialGradient(mx + 15, my + 10, 0, mx + 15, my + 10, 22);
      glow.addColorStop(0, `rgba(${hue},${pulse})`);
      glow.addColorStop(1, `rgba(${hue},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(mx - 5, my - 5, 40, 30);

      // Scrolling data lines on screen
      ctx.fillStyle = `rgba(0,255,100,${0.3 + 0.1 * Math.sin(t * 3 + i)})`;
      for (let l = 0; l < 4; l++) {
        const lineY = my + 3 + ((l * 4 + t * 12 + i * 7) % 18);
        if (lineY > my + 1 && lineY < my + 17) {
          const lw = 6 + hash(i * 10 + l, 42) * 12;
          ctx.fillRect(mx + 3, lineY, lw, 1.2);
        }
      }
    }

    // Floating cursor arrow that moves and clicks
    const cursorX = w * 0.3 + Math.sin(t * 0.6) * w * 0.25;
    const cursorY = h * 0.65 + Math.cos(t * 0.45) * h * 0.12;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(cursorX, cursorY);
    ctx.lineTo(cursorX, cursorY + 10);
    ctx.lineTo(cursorX + 3.5, cursorY + 7);
    ctx.lineTo(cursorX + 6, cursorY + 11);
    ctx.lineTo(cursorX + 7.5, cursorY + 10);
    ctx.lineTo(cursorX + 5, cursorY + 6);
    ctx.lineTo(cursorX + 8, cursorY + 5);
    ctx.closePath();
    ctx.fill();

    // Click ripple (pulses every ~2.5 seconds)
    const clickPhase = (t * 0.4) % 1;
    if (clickPhase < 0.3) {
      const rippleR = clickPhase * 30;
      const rippleAlpha = 0.25 * (1 - clickPhase / 0.3);
      ctx.strokeStyle = `rgba(0,255,136,${rippleAlpha})`;
      ctx.lineWidth = 1.5;
      circle(ctx, cursorX + 2, cursorY + 3, rippleR);
      ctx.stroke();
    }

    // Blinking typing cursor on first monitor
    if (monitorCount > 0) {
      const blinkOn = Math.sin(t * 4) > 0;
      if (blinkOn) {
        ctx.fillStyle = 'rgba(0,255,100,0.6)';
        ctx.fillRect(28, h * 0.25 + 12, 1.5, 6);
      }
    }
  },

  /* ── Grandma: Warm bakery — ovens with fire, steam, mixer, cookie trays ── */
  Grandma(ctx, w, h, t) {
    // Warm ambient glow on walls & ceiling
    const glowIntensity = flicker(t, 0.8, 0);
    const ovenGlow = ctx.createRadialGradient(w * 0.5, h * 0.85, 0, w * 0.5, h * 0.85, h * 0.7);
    ovenGlow.addColorStop(0, `rgba(255,140,40,${glowIntensity * 0.22})`);
    ovenGlow.addColorStop(0.5, `rgba(255,100,20,${glowIntensity * 0.1})`);
    ovenGlow.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = ovenGlow;
    ctx.fillRect(0, h * 0.3, w, h * 0.7);

    const wallFlicker = 0.04 + 0.03 * Math.sin(t * 6 + 1.7);
    ctx.fillStyle = `rgba(255,180,100,${wallFlicker})`;
    ctx.fillRect(0, 0, w, h * 0.65);

    // ── Oven openings with flickering fire ──
    const ovenCount = Math.max(2, Math.floor(w / 130));
    for (let i = 0; i < ovenCount; i++) {
      const ox = w * 0.18 + i * (w * 0.64 / Math.max(1, ovenCount - 1));
      const oy = h * 0.74;
      const ow = 26, oh = 14;
      // Oven opening (dark)
      ctx.fillStyle = 'rgba(20,8,2,0.92)';
      ctx.fillRect(ox - ow / 2, oy - oh / 2, ow, oh);
      // Fire — multiple dancing flames
      for (let f = 0; f < 5; f++) {
        const fx = ox - ow * 0.32 + f * (ow * 0.16);
        const fH = 5 + Math.sin(t * 9 + f * 2.5 + i * 4) * 2.5;
        const fW = 2.2 + Math.sin(t * 7 + f * 1.7 + i) * 0.8;
        const fA = 0.7 + 0.2 * Math.sin(t * 10 + f * 3 + i);
        // Outer flame (orange-red)
        ctx.fillStyle = `rgba(255,${80 + Math.floor(Math.sin(t * 10 + f) * 40)},20,${fA})`;
        ctx.beginPath();
        ctx.moveTo(fx - fW, oy + oh * 0.25);
        ctx.quadraticCurveTo(fx, oy - fH + oh * 0.2, fx + fW, oy + oh * 0.25);
        ctx.fill();
        // Inner flame (yellow)
        ctx.fillStyle = `rgba(255,230,60,${fA * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(fx - fW * 0.35, oy + oh * 0.25);
        ctx.quadraticCurveTo(fx, oy - fH * 0.45 + oh * 0.2, fx + fW * 0.35, oy + oh * 0.25);
        ctx.fill();
      }
      // Fire glow emanating outward
      const fGlow = ctx.createRadialGradient(ox, oy, 2, ox, oy, 30);
      fGlow.addColorStop(0, `rgba(255,120,30,${0.14 + 0.06 * Math.sin(t * 7 + i * 3)})`);
      fGlow.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = fGlow;
      ctx.fillRect(ox - 30, oy - 30, 60, 60);
    }

    // ── Cookie tray sliding in/out of oven ──
    if (ovenCount > 0) {
      const trayOvenX = w * 0.18;
      const traySlide = Math.sin(t * 0.5) * 14;
      const trayX = trayOvenX + Math.max(0, traySlide);
      const trayY = h * 0.76;
      ctx.fillStyle = 'rgba(185,185,195,0.9)';
      ctx.fillRect(trayX - 14, trayY, 28, 2.5);
      if (traySlide > 2) {
        const vis = Math.min(0.9, (traySlide - 2) * 0.1);
        ctx.fillStyle = `rgba(232,184,76,${vis})`;
        circle(ctx, trayX - 6, trayY - 2, 2.5); ctx.fill();
        circle(ctx, trayX + 2, trayY - 2.5, 2.2); ctx.fill();
        circle(ctx, trayX + 8, trayY - 2, 2); ctx.fill();
        ctx.fillStyle = `rgba(90,56,24,${vis * 0.85})`;
        circle(ctx, trayX - 5, trayY - 2.5, 0.6); ctx.fill();
        circle(ctx, trayX + 3, trayY - 3, 0.5); ctx.fill();
      }
    }

    // ── Mixing bowl with spinning whisk ──
    const bowlX = w * 0.78, bowlY = h * 0.72;
    ctx.fillStyle = 'rgba(210,195,175,0.85)';
    ctx.beginPath();
    ctx.ellipse(bowlX, bowlY + 2, 11, 6, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,130,110,0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Batter
    ctx.fillStyle = 'rgba(240,220,170,0.7)';
    ctx.beginPath();
    ctx.ellipse(bowlX, bowlY + 1, 9, 3, 0, 0, Math.PI);
    ctx.fill();
    // Whisk
    ctx.save();
    ctx.translate(bowlX + 2, bowlY - 1);
    ctx.rotate(0.35);
    ctx.strokeStyle = 'rgba(110,90,70,0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -14); ctx.stroke();
    ctx.strokeStyle = 'rgba(195,195,205,0.75)';
    ctx.lineWidth = 0.7;
    for (let ww = 0; ww < 5; ww++) {
      const a = t * 5 + ww * Math.PI * 2 / 5;
      const wx = Math.cos(a) * 3.5;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(wx, 3, 0, 6);
      ctx.stroke();
    }
    ctx.restore();
    // Batter splash particles
    for (let s = 0; s < 3; s++) {
      const sa = t * 5 + s * Math.PI * 2 / 3;
      const sr = 7 + Math.sin(t * 3 + s) * 3;
      const sx = bowlX + 2 + Math.cos(sa) * sr;
      const sy = bowlY - 1 + Math.sin(sa) * sr * 0.4;
      if (sy < bowlY) {
        ctx.fillStyle = `rgba(240,220,170,${0.25 + 0.1 * Math.sin(t * 4 + s * 2)})`;
        circle(ctx, sx, sy, 1); ctx.fill();
      }
    }

    // ── Rising steam wisps (visible) ──
    const steamCount = Math.max(4, Math.floor(w / 75));
    ctx.lineCap = 'round';
    for (let i = 0; i < steamCount; i++) {
      const baseX = w * 0.08 + i * (w * 0.84 / steamCount);
      const phase = (t * 0.28 + i * 0.22) % 1;
      const y = h * 0.50 - phase * h * 0.38;
      const drift = Math.sin(t * 1.2 + i * 2.1) * 8;
      const opacity = 0.35 * (1 - phase) * (phase > 0.05 ? 1 : phase / 0.05);
      ctx.strokeStyle = `rgba(255,245,230,${opacity})`;
      ctx.lineWidth = 2.5 + (1 - phase) * 2.5;
      ctx.beginPath();
      ctx.moveTo(baseX + drift, y + 12);
      ctx.bezierCurveTo(
        baseX + drift + Math.sin(t + i) * 5, y + 7,
        baseX + drift - Math.sin(t * 1.3 + i) * 4, y + 3,
        baseX + drift + Math.sin(t * 1.5 + i) * 7, y
      );
      ctx.stroke();
    }

    // ── Warm embers floating up (visible) ──
    for (let i = 0; i < 8; i++) {
      const phase = (t * 0.2 + i * 0.125) % 1;
      const ex = w * 0.12 + hash(i, 88) * w * 0.75 + Math.sin(t * 0.7 + i) * 10;
      const ey = h * 0.72 - phase * h * 0.55;
      const opacity = 0.55 * (1 - phase) * Math.min(1, phase * 5);
      ctx.fillStyle = `rgba(255,${160 + Math.floor(hash(i, 77) * 60)},50,${opacity})`;
      circle(ctx, ex, ey, 1.2 + hash(i, 99) * 1.5);
      ctx.fill();
    }
  },

  /* ── Farm: Living field — clouds, cows grazing, butterflies, swaying crops ── */
  Farm(ctx, w, h, t) {
    // ── Drifting clouds ──
    const cloudCount = Math.max(2, Math.floor(w / 110));
    for (let i = 0; i < cloudCount; i++) {
      const speed = 10 + hash(i, 10) * 8;
      const cx = ((t * speed + hash(i, 20) * w * 2) % (w + 80)) - 40;
      const cy = h * 0.06 + hash(i, 30) * h * 0.18;
      const size = 13 + hash(i, 40) * 10;
      const opacity = 0.18 + hash(i, 50) * 0.1;
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      circle(ctx, cx, cy, size * 0.6); ctx.fill();
      circle(ctx, cx - size * 0.45, cy + size * 0.15, size * 0.45); ctx.fill();
      circle(ctx, cx + size * 0.5, cy + size * 0.1, size * 0.5); ctx.fill();
    }

    // ── Sun glow — pulsing ──
    const sunPulse = 0.07 + 0.04 * Math.sin(t * 0.8);
    const sunGlow = ctx.createRadialGradient(w * 0.88, h * 0.05, 2, w * 0.88, h * 0.05, h * 0.3);
    sunGlow.addColorStop(0, `rgba(255,250,120,${sunPulse * 1.5})`);
    sunGlow.addColorStop(0.4, `rgba(255,240,100,${sunPulse})`);
    sunGlow.addColorStop(1, 'rgba(255,240,100,0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(w * 0.55, 0, w * 0.45, h * 0.4);

    // ── Grass blades swaying at ground line (visible) ──
    ctx.lineCap = 'round';
    for (let x = 0; x < w; x += 6) {
      const sway = Math.sin(t * 2.2 + x * 0.05) * 3.5;
      const gh = 5 + Math.sin(x * 0.35) * 2.5;
      const grassAlpha = 0.32 + 0.1 * Math.sin(x * 0.2);
      ctx.strokeStyle = `rgba(60,170,40,${grassAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.38);
      ctx.quadraticCurveTo(x + sway * 0.5, h * 0.38 - gh * 0.5, x + sway, h * 0.38 - gh);
      ctx.stroke();
    }

    // ── Butterflies (boosted) ──
    for (let i = 0; i < 3; i++) {
      const bx = w * 0.15 + Math.sin(t * 0.45 + i * 2.1) * w * 0.25 + i * w * 0.22;
      const by = h * 0.13 + Math.cos(t * 0.32 + i * 1.7) * h * 0.1;
      const wingFlap = Math.abs(Math.sin(t * 6.5 + i * 2));
      const colors = ['rgba(255,180,50,0.4)', 'rgba(255,100,100,0.35)', 'rgba(100,200,255,0.35)'];
      ctx.fillStyle = colors[i % 3];
      ctx.beginPath(); ctx.ellipse(bx - 2, by, 3.5, 2.5 * wingFlap + 0.5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx + 2, by, 3.5, 2.5 * wingFlap + 0.5, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(60,40,20,0.35)';
      ctx.fillRect(bx - 0.5, by - 2, 1, 4);
    }

    // ── Cows grazing in the lower field ──
    const cowData = [
      { baseX: w * 0.2, y: h * 0.78, scale: 0.9, dir: 1, seed: 0 },
      { baseX: w * 0.55, y: h * 0.83, scale: 0.8, dir: -1, seed: 17 },
      { baseX: w * 0.82, y: h * 0.76, scale: 0.85, dir: 1, seed: 33 },
    ];
    for (const cow of cowData) {
      if (cow.baseX > w + 20) continue;
      const cowX = cow.baseX + Math.sin(t * 0.12 + cow.seed) * 8;
      const cowY = cow.y;
      const s = cow.scale;
      const dir = cow.dir;
      const legPhase = t * 1.2 + cow.seed;
      const eatCycle = (t * 0.3 + cow.seed * 0.1) % 1;
      const headDip = eatCycle < 0.4 ? Math.sin(eatCycle / 0.4 * Math.PI) * 4 : 0;
      const tailSwish = Math.sin(t * 2 + cow.seed);

      ctx.save();
      ctx.translate(cowX, cowY);
      if (dir < 0) ctx.scale(-1, 1);

      // Body
      ctx.fillStyle = 'rgba(245,240,225,0.92)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,145,125,0.6)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // Spots
      ctx.fillStyle = 'rgba(70,45,20,0.8)';
      ctx.beginPath(); ctx.ellipse(-3 * s, -1.5 * s, 4 * s, 2.5 * s, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5 * s, 1 * s, 3 * s, 2 * s, -0.2, 0, Math.PI * 2); ctx.fill();
      // Head
      ctx.fillStyle = 'rgba(245,240,225,0.92)';
      ctx.beginPath();
      ctx.ellipse(12 * s, -1 * s + headDip, 4.5 * s, 3.5 * s, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,145,125,0.5)';
      ctx.stroke();
      // Snout
      ctx.fillStyle = 'rgba(235,210,195,0.85)';
      ctx.beginPath(); ctx.ellipse(15 * s, 0.5 * s + headDip, 2.5 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
      // Eye
      ctx.fillStyle = 'rgba(20,15,5,0.9)';
      circle(ctx, 13 * s, -2.5 * s + headDip, 0.8 * s); ctx.fill();
      // Ear
      ctx.fillStyle = 'rgba(220,200,180,0.8)';
      ctx.beginPath(); ctx.ellipse(10 * s, -4.5 * s + headDip, 2.5 * s, 1.2 * s, -0.4, 0, Math.PI * 2); ctx.fill();
      // Legs (walking)
      ctx.strokeStyle = 'rgba(210,200,185,0.9)';
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      const fSwing = Math.sin(legPhase) * 2 * s;
      const bSwing = Math.sin(legPhase + Math.PI) * 2 * s;
      ctx.beginPath(); ctx.moveTo(7 * s, 5 * s); ctx.lineTo(7 * s + fSwing, 11 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5 * s, 5 * s); ctx.lineTo(5 * s - fSwing, 11 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6 * s, 5 * s); ctx.lineTo(-6 * s + bSwing, 11 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8 * s, 5 * s); ctx.lineTo(-8 * s - bSwing, 11 * s); ctx.stroke();
      // Tail
      ctx.strokeStyle = 'rgba(180,170,150,0.85)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(-11 * s, -1 * s);
      ctx.quadraticCurveTo(-15 * s, -5 * s + tailSwish * 3 * s, -16 * s, -2 * s + tailSwish * 2 * s);
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,80,60,0.7)';
      circle(ctx, -16 * s, -2 * s + tailSwish * 2 * s, 1.5 * s); ctx.fill();

      ctx.restore();
    }

    // ── Birds flying across ──
    for (let i = 0; i < 2; i++) {
      const birdX = ((t * (20 + i * 8) + hash(i, 60) * w) % (w + 40)) - 20;
      const birdY = h * 0.1 + i * h * 0.08 + Math.sin(t * 2 + i * 3) * 3;
      const wingUp = Math.sin(t * 5 + i * 2.5) * 3;
      ctx.strokeStyle = 'rgba(40,30,20,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(birdX - 4, birdY + wingUp);
      ctx.quadraticCurveTo(birdX - 1, birdY - 1, birdX, birdY);
      ctx.quadraticCurveTo(birdX + 1, birdY - 1, birdX + 4, birdY + wingUp);
      ctx.stroke();
    }

    // ── Wheat / crop stalks swaying along furrow lines ──
    for (let i = 0; i < Math.floor(w / 28); i++) {
      const sx = 10 + i * 26 + hash(i, 45) * 8;
      const sy = h * 0.52 + (i % 4) * h * 0.08;
      const sway = Math.sin(t * 2 + sx * 0.04 + i) * 2.5;
      ctx.strokeStyle = 'rgba(180,160,60,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + sway * 0.5, sy - 5, sx + sway, sy - 9);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220,190,80,0.3)';
      ctx.beginPath();
      ctx.ellipse(sx + sway, sy - 10, 1.5, 3, sway * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /* ── Factory: Conveyor belt rolling, gears spinning, smoke rising ── */
  Factory(ctx, w, h, t) {
    // Conveyor belt movement — rollers/dividers scroll right
    const beltSpeed = t * 30; // pixels per second
    ctx.strokeStyle = 'rgba(120,120,120,0.8)';
    ctx.lineWidth = 1;
    const beltOffset = ((beltSpeed % 15) + 15) % 15;
    for (let x = beltOffset - 15; x < w + 15; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.7);
      ctx.lineTo(x, h * 0.85);
      ctx.stroke();
    }

    // Cookies sliding on conveyor belt
    const cookieCount = Math.floor(w / 40);
    for (let i = 0; i < cookieCount; i++) {
      const baseX = i * 38 + 20;
      const scrolledX = ((baseX + beltSpeed * 0.8) % (w + 20)) - 10;
      const opacity = 0.88;
      // Simple cookie circle
      circle(ctx, scrolledX, h * 0.74, 3.5);
      const g = ctx.createRadialGradient(scrolledX - 1, h * 0.74 - 1, 0, scrolledX, h * 0.74, 3.5);
      g.addColorStop(0, `rgba(232,184,76,${opacity})`);
      g.addColorStop(1, `rgba(196,144,48,${opacity})`);
      ctx.fillStyle = g;
      ctx.fill();
      // Chip
      ctx.fillStyle = `rgba(90,56,24,${opacity})`;
      circle(ctx, scrolledX + 1, h * 0.74 - 1, 0.8);
      ctx.fill();
    }

    // Rotating gears
    const gearPositions = [];
    for (let i = 0; i < Math.floor(w / 120); i++) {
      gearPositions.push({ x: 60 + i * 110, y: h * 0.45, r: 10, teeth: 8, speed: (i % 2 === 0 ? 1 : -1) * 0.5 });
    }
    for (const g of gearPositions) {
      if (g.x > w + 15) continue;
      const angle = t * g.speed;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(angle);
      // Gear outer ring
      ctx.strokeStyle = 'rgba(180,160,120,0.75)';
      ctx.lineWidth = 1.5;
      circle(ctx, 0, 0, g.r);
      ctx.stroke();
      // Teeth
      for (let tt = 0; tt < g.teeth; tt++) {
        const a = (tt * Math.PI * 2) / g.teeth;
        ctx.beginPath();
        ctx.moveTo(g.r * Math.cos(a), g.r * Math.sin(a));
        ctx.lineTo((g.r + 3.5) * Math.cos(a), (g.r + 3.5) * Math.sin(a));
        ctx.stroke();
      }
      // Hub
      circle(ctx, 0, 0, 2.5);
      ctx.fillStyle = 'rgba(180,160,120,0.7)';
      ctx.fill();
      ctx.restore();
    }

    // Chimney smoke puffs rising
    const smokeCount = Math.max(2, Math.floor(w / 150));
    for (let i = 0; i < smokeCount; i++) {
      for (let p = 0; p < 3; p++) {
        const phase = (t * 0.25 + p * 0.33 + i * 0.5) % 1;
        const baseX = 37 + i * 140 + hash(i, 55) * 20;
        const drift = Math.sin(t * 0.5 + p + i) * 8 + phase * 10;
        const y = 8 - phase * 18;
        const opacity = 0.3 * (1 - phase);
        const size = 3 + phase * 5;
        ctx.fillStyle = `rgba(180,180,180,${opacity})`;
        circle(ctx, baseX + drift, y, size);
        ctx.fill();
      }
    }
  },

  /* ── Mine: Flickering lanterns, 3D rolling minecart, twinkling ore ── */
  Mine(ctx, w, h, t) {
    // ── Flickering lantern glows (boosted) ──
    const lanternCount = Math.floor(w / 100);
    for (let i = 0; i < lanternCount; i++) {
      const lx = 50 + i * 90;
      const ly = h * 0.15;
      const intensity = flicker(t, 1.2, i * 3.7);
      const radius = 20 + Math.sin(t * 5 + i * 2) * 3;
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
      glow.addColorStop(0, `rgba(255,200,80,${intensity * 0.4})`);
      glow.addColorStop(0.5, `rgba(255,160,40,${intensity * 0.18})`);
      glow.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2);
      // Lantern flame (bigger, brighter)
      const flameH = 4 + Math.sin(t * 10 + i * 5) * 1.5;
      ctx.fillStyle = `rgba(255,220,100,${intensity * 0.65})`;
      ctx.beginPath();
      ctx.moveTo(lx - 2, ly + 1);
      ctx.quadraticCurveTo(lx, ly - flameH, lx + 2, ly + 1);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,200,${intensity * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(lx - 0.8, ly + 1);
      ctx.quadraticCurveTo(lx, ly - flameH * 0.5, lx + 0.8, ly + 1);
      ctx.fill();
    }

    // ── 3D Minecart on the 2-rail track ──
    // Track: far rail at h*0.85, near rail at h*0.92 (viewed from slight above)
    const nearRailY = h * 0.92;
    const farRailY = h * 0.85;
    const cartCenterX = w * 0.3 + Math.sin(t * 0.4) * w * 0.25;
    const cartBob = Math.sin(t * 3.5) * 0.6;
    const cartW = 18;
    const cartBodyH = 12;
    const dOff = (nearRailY - farRailY) * 0.55; // 3D depth offset

    // Shadow under cart
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cartCenterX + dOff * 0.3, (nearRailY + farRailY) / 2 + cartBob, cartW * 0.65, (nearRailY - farRailY) * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cart geometry (3D box with perspective)
    const fBy = nearRailY - 1 + cartBob;  // front bottom (near rail)
    const fTy = fBy - cartBodyH;           // front top
    const bBy = farRailY - 1 + cartBob;   // back bottom (far rail)
    const bTy = bBy - cartBodyH * 0.85;   // back top (shorter = further)

    // Back face (partially visible above)
    ctx.fillStyle = 'rgba(75,52,26,0.9)';
    ctx.beginPath();
    ctx.moveTo(cartCenterX - cartW / 2 + dOff + 2, bBy);
    ctx.lineTo(cartCenterX - cartW / 2 + dOff + 3, bTy);
    ctx.lineTo(cartCenterX + cartW / 2 + dOff - 3, bTy);
    ctx.lineTo(cartCenterX + cartW / 2 + dOff - 2, bBy);
    ctx.closePath();
    ctx.fill();

    // Left side face (depth visible)
    ctx.fillStyle = 'rgba(90,65,34,0.88)';
    ctx.beginPath();
    ctx.moveTo(cartCenterX - cartW / 2, fBy);
    ctx.lineTo(cartCenterX - cartW / 2 + 1, fTy);
    ctx.lineTo(cartCenterX - cartW / 2 + dOff + 3, bTy);
    ctx.lineTo(cartCenterX - cartW / 2 + dOff + 2, bBy);
    ctx.closePath();
    ctx.fill();

    // Front face (main visible — trapezoidal)
    ctx.fillStyle = 'rgba(150,108,62,0.92)';
    ctx.beginPath();
    ctx.moveTo(cartCenterX - cartW / 2, fBy);
    ctx.lineTo(cartCenterX - cartW / 2 + 1.5, fTy);
    ctx.lineTo(cartCenterX + cartW / 2 - 1.5, fTy);
    ctx.lineTo(cartCenterX + cartW / 2, fBy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,20,0.85)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Plank lines on front
    ctx.strokeStyle = 'rgba(80,55,28,0.5)';
    ctx.lineWidth = 0.6;
    for (let p = 1; p <= 2; p++) {
      const py = fTy + p * cartBodyH / 3;
      ctx.beginPath();
      ctx.moveTo(cartCenterX - cartW / 2 + 2, py);
      ctx.lineTo(cartCenterX + cartW / 2 - 2, py);
      ctx.stroke();
    }

    // Right side face
    ctx.fillStyle = 'rgba(110,80,42,0.88)';
    ctx.beginPath();
    ctx.moveTo(cartCenterX + cartW / 2, fBy);
    ctx.lineTo(cartCenterX + cartW / 2 - 1.5, fTy);
    ctx.lineTo(cartCenterX + cartW / 2 + dOff - 3, bTy);
    ctx.lineTo(cartCenterX + cartW / 2 + dOff - 2, bBy);
    ctx.closePath();
    ctx.fill();

    // Top face (opening — cookies visible!)
    ctx.fillStyle = 'rgba(50,35,18,0.85)';
    ctx.beginPath();
    ctx.moveTo(cartCenterX - cartW / 2 + 1.5, fTy);
    ctx.lineTo(cartCenterX - cartW / 2 + dOff + 3, bTy);
    ctx.lineTo(cartCenterX + cartW / 2 + dOff - 3, bTy);
    ctx.lineTo(cartCenterX + cartW / 2 - 1.5, fTy);
    ctx.closePath();
    ctx.fill();

    // Cookies piled in cart (visible from top)
    const cookieY = fTy + 2;
    ctx.fillStyle = 'rgba(232,184,76,0.9)';
    circle(ctx, cartCenterX - 3 + dOff * 0.2, cookieY - 1, 3); ctx.fill();
    circle(ctx, cartCenterX + 4 + dOff * 0.2, cookieY - 2, 2.5); ctx.fill();
    ctx.fillStyle = 'rgba(200,155,55,0.85)';
    circle(ctx, cartCenterX + 1 + dOff * 0.3, cookieY - 3, 2.2); ctx.fill();
    ctx.fillStyle = 'rgba(90,56,24,0.8)';
    circle(ctx, cartCenterX - 2 + dOff * 0.2, cookieY - 1.5, 0.7); ctx.fill();
    circle(ctx, cartCenterX + 5 + dOff * 0.2, cookieY - 2.5, 0.6); ctx.fill();

    // Wheels on near rail (larger, closer)
    const wR = 3;
    ctx.fillStyle = 'rgba(150,150,150,0.92)';
    ctx.strokeStyle = 'rgba(80,80,80,0.85)';
    ctx.lineWidth = 0.8;
    circle(ctx, cartCenterX - cartW / 2 + 3, nearRailY + cartBob, wR); ctx.fill(); ctx.stroke();
    circle(ctx, cartCenterX + cartW / 2 - 3, nearRailY + cartBob, wR); ctx.fill(); ctx.stroke();
    // Rotating spokes on near wheels
    const wAngle = t * (Math.abs(Math.cos(t * 0.4)) * 2 + 0.5);
    ctx.strokeStyle = 'rgba(180,180,180,0.7)';
    ctx.lineWidth = 0.6;
    for (const wx of [cartCenterX - cartW / 2 + 3, cartCenterX + cartW / 2 - 3]) {
      for (let sp = 0; sp < 4; sp++) {
        const a = wAngle + sp * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(wx, nearRailY + cartBob);
        ctx.lineTo(wx + Math.cos(a) * (wR - 0.5), nearRailY + cartBob + Math.sin(a) * (wR - 0.5));
        ctx.stroke();
      }
    }

    // Wheels on far rail (smaller — perspective)
    ctx.fillStyle = 'rgba(130,130,130,0.85)';
    circle(ctx, cartCenterX - cartW / 2 + 3 + dOff, farRailY + cartBob, 2.3); ctx.fill();
    circle(ctx, cartCenterX + cartW / 2 - 3 + dOff, farRailY + cartBob, 2.3); ctx.fill();

    // Axles connecting near and far wheels
    ctx.strokeStyle = 'rgba(120,120,120,0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cartCenterX - cartW / 2 + 3, nearRailY + cartBob);
    ctx.lineTo(cartCenterX - cartW / 2 + 3 + dOff, farRailY + cartBob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cartCenterX + cartW / 2 - 3, nearRailY + cartBob);
    ctx.lineTo(cartCenterX + cartW / 2 - 3 + dOff, farRailY + cartBob);
    ctx.stroke();

    // ── Ore vein twinkle sparkles (boosted) ──
    const oreCount = Math.floor(w / 50);
    for (let i = 0; i < oreCount; i++) {
      const ox = 20 + i * 45 + Math.sin(i * 2.7) * 10;
      const oy = h * 0.3 + Math.cos(i * 1.8) * h * 0.2;
      const twinkle = Math.max(0, Math.sin(t * 3.5 + i * 2.3));
      if (twinkle > 0.5) {
        const sparkAlpha = (twinkle - 0.5) * 1.0;
        ctx.fillStyle = `rgba(255,220,80,${sparkAlpha})`;
        star(ctx, ox + 3, oy - 2, 3, 1.2, 4);
        ctx.fill();
        const sGlow = ctx.createRadialGradient(ox + 3, oy - 2, 0, ox + 3, oy - 2, 6);
        sGlow.addColorStop(0, `rgba(255,220,80,${sparkAlpha * 0.3})`);
        sGlow.addColorStop(1, 'rgba(255,220,80,0)');
        ctx.fillStyle = sGlow;
        circle(ctx, ox + 3, oy - 2, 6);
        ctx.fill();
      }
    }

    // ── Dripping water ──
    for (let i = 0; i < 3; i++) {
      const dx = w * 0.2 + i * w * 0.3;
      const dropPhase = (t * 0.5 + i * 0.33) % 1;
      const dy = h * 0.05 + dropPhase * h * 0.4;
      const dropAlpha = 0.28 * (1 - dropPhase * 0.5);
      if (dropPhase < 0.85) {
        ctx.fillStyle = `rgba(150,200,255,${dropAlpha})`;
        ctx.beginPath();
        ctx.ellipse(dx, dy, 1.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const splashPhase = (dropPhase - 0.85) / 0.15;
        ctx.fillStyle = `rgba(150,200,255,${0.22 * (1 - splashPhase)})`;
        circle(ctx, dx, h * 0.4, splashPhase * 5);
        ctx.fill();
      }
    }

    // ── Dust motes in lantern light ──
    for (let i = 0; i < 6; i++) {
      const dmx = w * 0.1 + hash(i, 66) * w * 0.8;
      const dmy = h * 0.1 + hash(i, 77) * h * 0.5;
      const drift = Math.sin(t * 0.3 + i * 1.5) * 3;
      const moteAlpha = 0.18 + 0.1 * Math.sin(t * 1.5 + i * 2);
      ctx.fillStyle = `rgba(255,220,150,${moteAlpha})`;
      circle(ctx, dmx + drift, dmy + Math.cos(t * 0.2 + i) * 2, 0.8);
      ctx.fill();
    }
  },

  /* ── Shipment: Twinkling stars, shooting stars, rocket trails ── */
  Shipment(ctx, w, h, t) {
    // Star twinkling
    const starCount = Math.floor(w / 2.5);
    for (let i = 0; i < starCount; i++) {
      const sx = Math.sin(i * 7.13 + 0.5) * w * 0.5 + w * 0.5;
      const sy = Math.cos(i * 4.37 + 0.3) * h * 0.5 + h * 0.5;
      const baseBright = 0.15 + Math.sin(i * 2.1) * 0.1;
      // Twinkle: slow oscillation unique to each star
      const twinkle = baseBright + 0.15 * Math.sin(t * (1.5 + hash(i, 7) * 2) + i * 1.3);
      if (twinkle > baseBright + 0.08) {
        const extra = twinkle - baseBright;
        ctx.fillStyle = `rgba(255,255,255,${extra})`;
        circle(ctx, sx, sy, 0.5 + extra * 2);
        ctx.fill();
      }
    }

    // Shooting stars (2-3 at different phases)
    for (let i = 0; i < 3; i++) {
      const period = 4 + i * 2.5;
      const phase = (t / period + hash(i, 33)) % 1;
      if (phase < 0.15) {
        const progress = phase / 0.15;
        const startX = hash(i, 44) * w * 0.6 + w * 0.2;
        const startY = hash(i, 55) * h * 0.3;
        const endX = startX + 60 + hash(i, 66) * 40;
        const endY = startY + 30 + hash(i, 77) * 20;
        const x = startX + (endX - startX) * progress;
        const y = startY + (endY - startY) * progress;
        const tailLen = 25;
        const tailX = x - (endX - startX) / Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2) * tailLen;
        const tailY = y - (endY - startY) / Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2) * tailLen;

        const grad = ctx.createLinearGradient(tailX, tailY, x, y);
        grad.addColorStop(0, 'rgba(200,230,255,0)');
        grad.addColorStop(1, `rgba(255,255,255,${0.35 * (1 - progress * 0.3)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.stroke();
        // Head glow
        ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - progress * 0.5)})`;
        circle(ctx, x, y, 1.5);
        ctx.fill();
      }
    }

    // Rocket exhaust flicker on rocket positions
    for (let i = 0; i < Math.floor(w / 160); i++) {
      const rx = 70 + i * 150;
      const ry = h * 0.55 + Math.sin(i * 2.5) * h * 0.15;
      const rot = -0.4 + i * 0.2;
      const flameLen = 5 + Math.sin(t * 8 + i * 3) * 3;
      const flameAlpha = 0.4 + 0.15 * Math.sin(t * 12 + i * 5);
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(rot);
      // Outer flame
      ctx.fillStyle = `rgba(255,140,40,${flameAlpha})`;
      ctx.beginPath();
      ctx.moveTo(-2.5, 5);
      ctx.quadraticCurveTo(0, 5 + flameLen, 2.5, 5);
      ctx.fill();
      // Inner flame
      ctx.fillStyle = `rgba(255,220,80,${flameAlpha * 0.8})`;
      ctx.beginPath();
      ctx.moveTo(-1.2, 5);
      ctx.quadraticCurveTo(0, 5 + flameLen * 0.6, 1.2, 5);
      ctx.fill();
      ctx.restore();
    }

    // Nebula shimmer
    const nebulaPositions = [
      { x: w * 0.2, y: h * 0.4 },
      { x: w * 0.65, y: h * 0.3 },
    ];
    for (const n of nebulaPositions) {
      if (n.x > w) continue;
      const shimmer = 0.03 + 0.02 * Math.sin(t * 0.5 + n.x * 0.01);
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, h * 0.5);
      glow.addColorStop(0, `rgba(150,80,220,${shimmer})`);
      glow.addColorStop(1, 'rgba(100,40,180,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(n.x - h * 0.5, n.y - h * 0.5, h, h);
    }
  },

  /* ── Alchemy Lab: Rising bubbles, drifting sparkles, pulsing circles ── */
  'Alchemy Lab'(ctx, w, h, t) {
    // Rising bubbles from flask positions
    const flaskCount = Math.floor(w / 30);
    for (let i = 0; i < flaskCount; i++) {
      const fx = 10 + i * 28 + Math.sin(i * 2.3) * 4;
      // Each flask spawns bubbles periodically
      for (let b = 0; b < 2; b++) {
        const phase = (t * 0.35 + b * 0.5 + i * 0.17) % 1;
        const bx = fx + Math.sin(t * 2 + i + b * 3) * 3;
        const by = h * 0.2 - phase * h * 0.22;
        const opacity = 0.4 * (1 - phase) * Math.min(1, phase * 4);
        const size = 1 + hash(i * 2 + b, 77) * 1.5 + (1 - phase) * 0.5;

        if (opacity > 0.02) {
          ctx.strokeStyle = `rgba(200,160,255,${opacity})`;
          ctx.lineWidth = 0.6;
          circle(ctx, bx, by, size);
          ctx.stroke();
          // Highlight on bubble
          ctx.fillStyle = `rgba(255,220,255,${opacity * 0.5})`;
          circle(ctx, bx - size * 0.3, by - size * 0.3, size * 0.25);
          ctx.fill();
        }
      }
    }

    // Drifting magical sparkle motes
    const sparkleCount = Math.floor(w / 35);
    for (let i = 0; i < sparkleCount; i++) {
      const baseX = 20 + i * 32;
      const baseY = h * 0.35 + Math.sin(i * 2.7) * h * 0.15;
      // Sparkles drift in lazy figure-8 patterns
      const sx = baseX + Math.sin(t * 0.6 + i * 1.3) * 8;
      const sy = baseY + Math.cos(t * 0.4 + i * 0.9) * 5;
      const pulse = 0.3 + 0.2 * Math.sin(t * 2.5 + i * 1.7);

      ctx.fillStyle = `rgba(220,180,255,${pulse})`;
      star(ctx, sx, sy, 2.5, 1, 4);
      ctx.fill();
    }

    // Pulsing alchemical floor circles
    for (let i = 0; i < Math.floor(w / 80); i++) {
      const cx = 40 + i * 75;
      const cy = h * 0.86;
      const pulse = 0.22 + 0.12 * Math.sin(t * 1.5 + i * 2.1);

      // Pulsing ring
      ctx.strokeStyle = `rgba(180,100,255,${pulse})`;
      ctx.lineWidth = 1.5;
      const r = 14 + Math.sin(t * 1.5 + i * 2.1) * 1.5;
      circle(ctx, cx, cy, r);
      ctx.stroke();

      // Core glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
      glow.addColorStop(0, `rgba(180,100,255,${pulse * 0.6})`);
      glow.addColorStop(1, 'rgba(180,100,255,0)');
      ctx.fillStyle = glow;
      circle(ctx, cx, cy, 10);
      ctx.fill();
    }

    // Dripping potion from shelf edges
    for (let i = 0; i < Math.floor(w / 70); i++) {
      const dx = 35 + i * 65;
      const dropPhase = (t * 0.4 + i * 0.25) % 1;
      if (dropPhase < 0.7) {
        const dy = h * 0.56 + dropPhase * h * 0.15;
        const opacity = 0.35 * (1 - dropPhase / 0.7);
        ctx.fillStyle = `rgba(160,80,255,${opacity})`;
        ctx.beginPath();
        ctx.ellipse(dx, dy, 1.2, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  /* ── Portal: Rotating vortexes, orbiting particles, pulsing rifts ── */
  Portal(ctx, w, h, t) {
    // Rotating portal spirals
    const portalCount = Math.max(2, Math.floor(w / 90));
    for (let p = 0; p < portalCount; p++) {
      const px = 45 + p * 85;
      const py = h * 0.38 + Math.sin(p * 1.7) * h * 0.12;
      const pr = 12 + (p % 3) * 4;
      if (px > w + 20) continue;

      // Rotating spiral arms
      ctx.strokeStyle = 'rgba(220,160,255,0.38)';
      ctx.lineWidth = 1;
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        for (let s = 0; s < 1; s += 0.03) {
          const angle = s * Math.PI * 3 + arm * Math.PI * 0.5 + p + t * 0.8;
          const r = s * pr * 0.65;
          const x = px + r * Math.cos(angle);
          const y = py + r * Math.sin(angle);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Orbiting energy particles
      for (let ep = 0; ep < 3; ep++) {
        const orbitAngle = t * 1.2 + ep * Math.PI * 2 / 3 + p * 0.5;
        const orbitR = pr * 1.3 + Math.sin(t * 2 + ep) * 2;
        const ex = px + orbitR * Math.cos(orbitAngle);
        const ey = py + orbitR * Math.sin(orbitAngle);
        ctx.fillStyle = 'rgba(200,140,255,0.45)';
        circle(ctx, ex, ey, 1.8);
        ctx.fill();
      }
    }

    // Dimensional rift cracks pulsing
    for (let i = 0; i < Math.floor(w / 60); i++) {
      const rx = i * 55 + 20;
      const pulse = 0.2 + 0.15 * Math.sin(t * 2 + i * 1.3);
      ctx.strokeStyle = `rgba(220,100,255,${pulse})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 8, h * 0.2);
      ctx.lineTo(rx + 3, h * 0.35);
      ctx.lineTo(rx + 12, h * 0.5);
      ctx.stroke();
    }

    // Undulating tentacle hints
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ty = h * 0.6 + i * 12;
      const wave = Math.sin(t * 1.5 + i * 0.8) * 5;
      const alpha = 0.18 + 0.08 * Math.sin(t * 1 + i);
      ctx.strokeStyle = `rgba(160,80,220,${alpha})`;
      // Left tentacle
      ctx.beginPath();
      ctx.moveTo(0, ty + wave);
      ctx.bezierCurveTo(15, ty - 10 + wave * 1.2, 25, ty + 10 - wave, 40, ty - 5 + wave * 0.5);
      ctx.stroke();
      // Right tentacle
      ctx.beginPath();
      ctx.moveTo(w, ty + 5 - wave);
      ctx.bezierCurveTo(w - 15, ty - 5 - wave * 1.1, w - 25, ty + 15 + wave * 0.7, w - 40, ty + wave * 0.3);
      ctx.stroke();
    }

    // Floating void particles
    for (let i = 0; i < Math.floor(w / 12); i++) {
      const px = Math.sin(i * 5.7 + t * 0.15) * w * 0.5 + w * 0.5;
      const py = Math.cos(i * 3.2 + t * 0.1) * h * 0.5 + h * 0.5;
      const pulse = 0.2 + 0.12 * Math.sin(t * 1.8 + i * 0.7);
      ctx.fillStyle = `rgba(200,120,255,${pulse})`;
      circle(ctx, px, py, 1);
      ctx.fill();
    }
  },

  /* ── Time Machine: Rotating gears, ticking clocks, expanding ripples ── */
  'Time Machine'(ctx, w, h, t) {
    // Rotating gears — each pair interlocks
    const gearSets = [
      { x: w * 0.15, y: h * 0.35, r: 22, teeth: 12, speed: 0.3 },
      { x: w * 0.15 + 28, y: h * 0.55, r: 16, teeth: 10, speed: -0.42 },
      { x: w * 0.5, y: h * 0.6, r: 26, teeth: 14, speed: 0.2 },
      { x: w * 0.5 + 18, y: h * 0.3, r: 14, teeth: 8, speed: -0.36 },
      { x: w * 0.8, y: h * 0.4, r: 20, teeth: 11, speed: 0.25 },
      { x: w * 0.8 - 10, y: h * 0.65, r: 12, teeth: 8, speed: -0.38 },
    ];

    for (const g of gearSets) {
      if (g.x > w + 30) continue;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(t * g.speed);

      // Gear teeth (animated rotation makes them move!)
      ctx.strokeStyle = 'rgba(200,180,120,0.3)';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < g.teeth; i++) {
        const a = (i * Math.PI * 2) / g.teeth;
        ctx.beginPath();
        ctx.moveTo(g.r * Math.cos(a), g.r * Math.sin(a));
        ctx.lineTo((g.r + 4) * Math.cos(a), (g.r + 4) * Math.sin(a));
        ctx.stroke();
      }
      // Spokes
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(g.r * 0.15 * Math.cos(a), g.r * 0.15 * Math.sin(a));
        ctx.lineTo(g.r * 0.6 * Math.cos(a), g.r * 0.6 * Math.sin(a));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Ticking clock second hands
    const clocks = [
      { x: w * 0.3, y: h * 0.2, r: 10 },
      { x: w * 0.6, y: h * 0.15, r: 8 },
      { x: w * 0.85, y: h * 0.75, r: 12 },
      { x: w * 0.1, y: h * 0.7, r: 7 },
    ];
    for (const c of clocks) {
      if (c.x > w + 15) continue;
      // Second hand sweeps continuously
      const secAngle = (t * Math.PI * 2 / 5) - Math.PI / 2; // 5-second period
      ctx.strokeStyle = 'rgba(255,100,80,0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + c.r * 0.85 * Math.cos(secAngle), c.y + c.r * 0.85 * Math.sin(secAngle));
      ctx.stroke();
    }

    // Expanding time vortex ripples
    const vcx = w * 0.5, vcy = h * 0.5;
    for (let i = 0; i < 4; i++) {
      const ripplePhase = (t * 0.3 + i * 0.25) % 1;
      const rippleR = 15 + ripplePhase * 80;
      const rippleAlpha = 0.18 * (1 - ripplePhase);
      ctx.strokeStyle = `rgba(120,200,255,${rippleAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(vcx, vcy, rippleR, 0, Math.PI * 0.8);
      ctx.stroke();
    }

    // Occasional lightning sparks
    const lightningPhase = (t * 0.5) % 1;
    if (lightningPhase < 0.05) {
      const sparkAlpha = 0.5 * (1 - lightningPhase / 0.05);
      const lx = w * 0.3 + Math.sin(t * 7) * w * 0.3;
      ctx.strokeStyle = `rgba(120,220,255,${sparkAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, h * 0.2);
      ctx.lineTo(lx + 5, h * 0.28);
      ctx.lineTo(lx - 2, h * 0.32);
      ctx.lineTo(lx + 6, h * 0.42);
      ctx.stroke();
    }
  },

  /* ── Antimatter Condenser: Orbiting electrons, beam pulse, collision sparks ── */
  'Antimatter Condenser'(ctx, w, h, t) {
    // Orbiting electron dots along atom paths
    const atomCount = Math.floor(w / 90);
    for (let i = 0; i < atomCount; i++) {
      const ax = 45 + i * 85;
      const ay = h * 0.4 + Math.sin(i * 2.5) * h * 0.15;
      if (ax > w + 15) continue;

      // 3 orbiting electrons per atom
      for (let e = 0; e < 3; e++) {
        const orbitAngle = t * (1.5 + e * 0.3) + e * Math.PI * 2 / 3;
        const orbitTilt = (e * Math.PI) / 3;
        // Projected position on tilted ellipse
        const ex = ax + 10 * Math.cos(orbitAngle) * Math.cos(orbitTilt) - 4 * Math.sin(orbitAngle) * Math.sin(orbitTilt);
        const ey = ay + 10 * Math.cos(orbitAngle) * Math.sin(orbitTilt) + 4 * Math.sin(orbitAngle) * Math.cos(orbitTilt);

        // Electron
        ctx.fillStyle = 'rgba(0,220,255,0.8)';
        circle(ctx, ex, ey, 2);
        ctx.fill();

        // Trail
        const trailAngle = orbitAngle - 0.3;
        const trailX = ax + 10 * Math.cos(trailAngle) * Math.cos(orbitTilt) - 4 * Math.sin(trailAngle) * Math.sin(orbitTilt);
        const trailY = ay + 10 * Math.cos(trailAngle) * Math.sin(orbitTilt) + 4 * Math.sin(trailAngle) * Math.cos(orbitTilt);
        ctx.strokeStyle = 'rgba(0,200,255,0.25)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(trailX, trailY);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // Nucleus pulse
      const nPulse = 0.25 + 0.15 * Math.sin(t * 3 + i * 2);
      const glow = ctx.createRadialGradient(ax, ay, 0, ax, ay, 6);
      glow.addColorStop(0, `rgba(255,80,120,${nPulse})`);
      glow.addColorStop(1, 'rgba(255,60,100,0)');
      ctx.fillStyle = glow;
      circle(ctx, ax, ay, 6);
      ctx.fill();
    }

    // Energy beam pulse along the beam line
    const beamPulse = 0.18 + 0.1 * Math.sin(t * 4);
    ctx.strokeStyle = `rgba(255,80,120,${beamPulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();
    // Beam glow
    ctx.strokeStyle = `rgba(255,60,100,${beamPulse * 0.3})`;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();

    // Traveling energy pulse along beam
    const pulseX = ((t * 80) % (w + 40)) - 20;
    const pulseGlow = ctx.createRadialGradient(pulseX, h * 0.5, 0, pulseX, h * 0.5, 12);
    pulseGlow.addColorStop(0, 'rgba(255,200,255,0.25)');
    pulseGlow.addColorStop(1, 'rgba(255,100,200,0)');
    ctx.fillStyle = pulseGlow;
    ctx.fillRect(pulseX - 12, h * 0.5 - 12, 24, 24);

    // Random collision sparks at center
    const sparkPhase = (t * 2.5) % 1;
    if (sparkPhase < 0.1) {
      const sparkAlpha = 0.35 * (1 - sparkPhase / 0.1);
      const sparkX = w * 0.5 + Math.sin(t * 17) * 8;
      const sparkY = h * 0.5 + Math.cos(t * 13) * 4;
      ctx.fillStyle = `rgba(255,255,255,${sparkAlpha})`;
      star(ctx, sparkX, sparkY, 4, 1.5, 4);
      ctx.fill();
      // Spark rays
      ctx.strokeStyle = `rgba(0,220,255,${sparkAlpha * 0.6})`;
      ctx.lineWidth = 0.8;
      for (let r = 0; r < 6; r++) {
        const angle = (r * Math.PI * 2) / 6 + t * 3;
        ctx.beginPath();
        ctx.moveTo(sparkX + 3 * Math.cos(angle), sparkY + 3 * Math.sin(angle));
        ctx.lineTo(sparkX + 8 * Math.cos(angle), sparkY + 8 * Math.sin(angle));
        ctx.stroke();
      }
    }

    // Collider ring glow pulse
    const ringPulse = 0.04 + 0.03 * Math.sin(t * 1.5);
    ctx.strokeStyle = `rgba(0,220,255,${ringPulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 2, w * 0.45, h * 1.5, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  },

  /* ── Prism: Sweeping rainbow beams, crystal flashes, color-shifting pools ── */
  Prism(ctx, w, h, t) {
    // Sweeping rainbow beams — angle oscillates slowly
    const beamColors = [
      [255, 60, 60], [255, 150, 40], [255, 240, 60],
      [60, 220, 90], [60, 130, 255], [150, 60, 255],
    ];
    const angleShift = Math.sin(t * 0.3) * 0.06;
    for (let b = 0; b < beamColors.length; b++) {
      const [r, g, bl] = beamColors[b];
      const startY = h * 0.35;
      const endY = h * 0.1 + b * (h * 0.14) + angleShift * h * (b - 2.5);
      const pulse = 0.16 + 0.08 * Math.sin(t * 2 + b * 0.7);

      // Beam glow (wider, softer)
      ctx.strokeStyle = `rgba(${r},${g},${bl},${pulse * 0.5})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.lineTo(w, endY);
      ctx.stroke();
      // Beam core
      ctx.strokeStyle = `rgba(${r},${g},${bl},${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.lineTo(w, endY);
      ctx.stroke();
    }

    // Crystal tip sparkle sequence
    const crystalCount = Math.floor(w / 40);
    for (let i = 0; i < crystalCount; i++) {
      const cx = 18 + i * 38 + Math.sin(i * 2.7) * 8;
      const cy = h * 0.52 + Math.sin(i * 1.3) * h * 0.03;
      const hue = ((i / crystalCount) * 360 + t * 40) % 360;

      // Staggered twinkle
      const twinkle = Math.max(0, Math.sin(t * 3 + i * 0.8));
      if (twinkle > 0.5) {
        const sparkAlpha = (twinkle - 0.5) * 0.8;
        ctx.fillStyle = `hsla(${hue}, 80%, 80%, ${sparkAlpha})`;
        star(ctx, cx, cy, 3.5, 1.4, 4);
        ctx.fill();
        // Tiny glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 5);
        glow.addColorStop(0, `hsla(${hue}, 80%, 80%, ${sparkAlpha * 0.5})`);
        glow.addColorStop(1, `hsla(${hue}, 80%, 80%, 0)`);
        ctx.fillStyle = glow;
        circle(ctx, cx, cy, 5);
        ctx.fill();
      }
    }

    // Floor light pools shifting color
    for (let i = 0; i < Math.floor(w / 25); i++) {
      const lx = 10 + i * 23 + Math.sin(i * 1.7) * 4;
      const ly = h * 0.84 + Math.sin(i * 2.1) * 4;
      const hue = ((i * 50 + t * 30) % 360);
      const poolR = 6 + Math.sin(i * 1.3) * 3;
      const pulse = 0.2 + 0.1 * Math.sin(t * 1.5 + i * 0.9);

      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, poolR);
      glow.addColorStop(0, `hsla(${hue}, 85%, 65%, ${pulse})`);
      glow.addColorStop(1, `hsla(${hue}, 85%, 65%, 0)`);
      circle(ctx, lx, ly, poolR);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Floating prismatic sparkles drifting
    for (let i = 0; i < Math.floor(w / 20); i++) {
      const baseX = Math.sin(i * 6.3) * w * 0.5 + w * 0.5;
      const baseY = Math.cos(i * 3.7) * h * 0.5 + h * 0.5;
      const dx = baseX + Math.sin(t * 0.5 + i * 0.3) * 4;
      const dy = baseY + Math.cos(t * 0.4 + i * 0.5) * 3;
      const sparkHue = ((i * 45 + t * 25) % 360);
      const pulse = 0.22 + 0.14 * Math.sin(t * 2.5 + i * 1.1);
      ctx.fillStyle = `hsla(${sparkHue}, 80%, 80%, ${pulse})`;
      star(ctx, dx, dy, 2, 0.8, 4);
      ctx.fill();
    }
  },

  /* ── Chancemaker: Twinkling stars, coin glints, rising lucky dust ── */
  Chancemaker(ctx, w, h, t) {
    // Golden star twinkle sequence
    const starPositions = Math.floor(w / 30);
    for (let i = 0; i < starPositions; i++) {
      const sx = 15 + i * 28 + Math.sin(i * 4.3) * 5;
      const sy = h * 0.15 + Math.cos(i * 1.7) * h * 0.12 + Math.sin(i * 2.9) * h * 0.08;
      // Staggered sequential twinkle
      const twinkle = Math.max(0, Math.sin(t * 2.5 + i * 0.6));
      if (twinkle > 0.4) {
        const sparkAlpha = (twinkle - 0.4) * 0.8;
        const size = 2 + Math.sin(i * 1.9) * 1.2;
        ctx.fillStyle = `rgba(255,220,50,${sparkAlpha})`;
        star(ctx, sx, sy, size * (0.8 + twinkle * 0.4), size * 0.35, 4);
        ctx.fill();
      }
    }

    // Coin glint flashes
    const coinCount = Math.floor(w / 45);
    for (let i = 0; i < coinCount; i++) {
      const coinX = 20 + i * 42 + Math.sin(i * 3.1) * 8;
      const coinY = h * 0.78 + Math.cos(i * 2.1) * h * 0.06;
      // Each coin glints briefly at different times
      const glintPhase = (t * 0.8 + i * 0.37) % 1;
      if (glintPhase < 0.08) {
        const glintAlpha = 0.65 * Math.sin(glintPhase / 0.08 * Math.PI);
        ctx.fillStyle = `rgba(255,255,200,${glintAlpha})`;
        star(ctx, coinX + 1, coinY - 1, 3, 1, 4);
        ctx.fill();
      }
    }

    // Rising lucky dust particles
    const dustCount = Math.floor(w / 20);
    for (let i = 0; i < dustCount; i++) {
      const phase = (t * 0.15 + hash(i, 33) * 2) % 1;
      const baseX = hash(i, 44) * w;
      const dx = baseX + Math.sin(t * 0.8 + i * 1.3) * 10;
      const dy = h - phase * h * 1.1;
      const opacity = 0.25 * Math.sin(phase * Math.PI); // fade in and out

      if (opacity > 0.01) {
        ctx.fillStyle = `rgba(255,215,0,${opacity})`;
        circle(ctx, dx, dy, 1 + hash(i, 55) * 1);
        ctx.fill();
      }
    }

    // Clover shimmer (emerald glow pulses)
    const cloverGlow = 0.05 + 0.04 * Math.sin(t * 1.2);
    ctx.fillStyle = `rgba(50,200,80,${cloverGlow})`;
    ctx.fillRect(0, 0, w, h * 0.5);

    // Horseshoe gentle sway
    for (let i = 0; i < Math.floor(w / 100); i++) {
      const hx = 50 + i * 95;
      const hy = h * 0.18;
      const sway = Math.sin(t * 1.5 + i * 2) * 0.08;
      ctx.save();
      ctx.translate(hx, hy - 3);
      ctx.rotate(sway);
      ctx.strokeStyle = 'rgba(220,200,80,0.65)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 3, 8, 0.3, Math.PI - 0.3);
      ctx.stroke();
      ctx.restore();
    }
  },

  /* ── Fractal Engine: Rotating fractals, spinning spiral, floating symbols ── */
  'Fractal Engine'(ctx, w, h, t) {
    // Slowly rotating recursive squares
    const sqCount = Math.max(1, Math.floor(w / 155));
    for (let i = 0; i < sqCount; i++) {
      const cx = 75 + i * 150;
      const cy = h * 0.55;
      const baseRot = Math.PI / 8 + i * 0.2 + t * 0.15;

      function drawRecSquare(x, y, size, depth, rot) {
        if (depth <= 0 || size < 2) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.strokeStyle = `rgba(220,180,60,${0.12 + depth * 0.06})`;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.restore();
        if (depth > 1) {
          const sub = size * 0.42;
          const off = size * 0.38;
          const nextRot = rot + Math.PI / 6;
          drawRecSquare(x - off, y - off, sub, depth - 1, nextRot);
          drawRecSquare(x + off, y - off, sub, depth - 1, nextRot);
          drawRecSquare(x - off, y + off, sub, depth - 1, nextRot);
          drawRecSquare(x + off, y + off, sub, depth - 1, nextRot);
        }
      }
      drawRecSquare(cx, cy, 24, 3, baseRot);
    }

    // Golden spiral rotation
    const spiralCount = Math.max(1, Math.floor(w / 240));
    const phi = 1.618033988749;
    for (let i = 0; i < spiralCount; i++) {
      const sx = 110 + i * 230;
      const sy = h * 0.5;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t * 0.2);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,210,80,0.25)';
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 3 * Math.PI * 2; s += 0.05) {
        const r = 28 * Math.pow(phi, s / (Math.PI * 2)) / Math.pow(phi, 3);
        const px = r * Math.cos(s);
        const py = r * Math.sin(s);
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Floating math symbols drifting upward
    const symbols = ['∞', 'π', '∑', '∫', 'φ', '√', 'Δ', 'Ω', 'λ'];
    const symbolCount = Math.min(symbols.length, Math.floor(w / 65));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < symbolCount; i++) {
      const phase = (t * 0.08 + hash(i, 88) * 3) % 1;
      const baseX = 30 + i * 62 + Math.sin(i * 2.1) * 8;
      const x = baseX + Math.sin(t * 0.4 + i * 1.5) * 5;
      const y = h * 0.9 - phase * h * 0.8;
      const opacity = 0.22 * Math.sin(phase * Math.PI);

      if (opacity > 0.01) {
        ctx.font = '13px serif';
        ctx.fillStyle = `rgba(220,190,100,${opacity})`;
        ctx.fillText(symbols[i % symbols.length], x, y);
      }
    }

    // Pulsing grid
    const gridPulse = 0.04 + 0.025 * Math.sin(t * 1.2);
    ctx.strokeStyle = `rgba(200,160,60,${gridPulse})`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Golden dust orbiting
    for (let i = 0; i < Math.floor(w / 15); i++) {
      const angle = t * 0.3 + i * 0.5;
      const orbitR = 20 + hash(i, 99) * 30;
      const cx = (hash(i, 11) * w * 0.8 + w * 0.1);
      const cy = (hash(i, 22) * h * 0.8 + h * 0.1);
      const px = cx + Math.cos(angle) * orbitR * 0.5;
      const py = cy + Math.sin(angle) * orbitR * 0.3;
      const pulse = 0.18 + 0.1 * Math.sin(t * 2 + i * 1.1);
      ctx.fillStyle = `rgba(255,210,60,${pulse})`;
      circle(ctx, px, py, 1);
      ctx.fill();
    }
  },

  /* ── Idleverse: Swirling portal vortexes, drifting dimension sparks, cookie rifts ── */
  Idleverse(ctx, w, h, t) {
    // Portal vortex rotation — spinning rings around each portal position
    const portalCount = Math.max(2, Math.floor(w / 140));
    for (let i = 0; i < portalCount; i++) {
      const px = (i + 0.5) * (w / portalCount);
      const py = h * 0.45 + Math.sin(i * 1.7) * h * 0.15;
      const pr = 18 + Math.sin(i * 2.3) * 6;

      // Slowly rotating outer ring
      const ringAngle = t * 0.4 + i * 1.2;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ringAngle);
      ctx.strokeStyle = `rgba(168,85,247,${0.15 + 0.08 * Math.sin(t * 1.5 + i)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, pr * 1.1, pr * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Counter-rotating inner ring
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-ringAngle * 0.7);
      ctx.strokeStyle = `rgba(192,132,252,${0.12 + 0.06 * Math.sin(t * 2 + i * 0.5)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, pr * 0.65, pr * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Pulsing core glow
      const coreAlpha = 0.06 + 0.04 * Math.sin(t * 2.5 + i * 1.7);
      const coreGlow = ctx.createRadialGradient(px, py, 0, px, py, pr * 0.8);
      coreGlow.addColorStop(0, `rgba(192,132,252,${coreAlpha * 2})`);
      coreGlow.addColorStop(1, `rgba(139,92,246,0)`);
      circle(ctx, px, py, pr * 0.8);
      ctx.fillStyle = coreGlow;
      ctx.fill();
    }

    // Interdimensional sparks drifting between portals
    const sparkCount = Math.floor(w / 12);
    for (let i = 0; i < sparkCount; i++) {
      const phase = (t * 0.1 + hash(i, 77) * 3) % 1;
      const baseX = hash(i, 33) * w;
      const drift = Math.sin(t * 0.6 + i * 1.7) * 15;
      const dx = baseX + drift;
      const dy = h - phase * h * 1.2;
      const opacity = 0.25 * Math.sin(phase * Math.PI);

      if (opacity > 0.01) {
        const hue = (i * 25 + t * 15) % 360;
        ctx.fillStyle = `hsla(${270 + hue % 60}, 70%, 75%, ${opacity})`;
        star(ctx, dx, dy, 1.8 + hash(i, 44) * 1.2, 0.6, 4);
        ctx.fill();
      }
    }

    // Floating cookie silhouettes drifting through portals
    for (let i = 0; i < Math.floor(w / 80); i++) {
      const phase = (t * 0.07 + hash(i, 88) * 4) % 1;
      const baseX = hash(i, 55) * w;
      const fx = baseX + Math.sin(t * 0.3 + i * 2.1) * 20;
      const fy = h * 0.8 - phase * h * 0.7;
      const opacity = 0.18 * Math.sin(phase * Math.PI);

      if (opacity > 0.01) {
        ctx.fillStyle = `rgba(192,132,252,${opacity})`;
        circle(ctx, fx, fy, 3 + hash(i, 66) * 2);
        ctx.fill();
        // Cookie chip dots
        ctx.fillStyle = `rgba(139,92,246,${opacity * 0.8})`;
        circle(ctx, fx - 1, fy - 1, 0.8);
        ctx.fill();
        circle(ctx, fx + 1.5, fy + 0.5, 0.6);
        ctx.fill();
      }
    }

    // Wispy energy tendrils connecting portals (animated flow)
    ctx.lineWidth = 0.6;
    for (let i = 0; i < portalCount - 1; i++) {
      const x1 = (i + 0.5) * (w / portalCount);
      const x2 = (i + 1.5) * (w / portalCount);
      const flowOffset = Math.sin(t * 0.8 + i) * 12;
      const alpha = 0.06 + 0.03 * Math.sin(t * 1.5 + i * 2);
      ctx.strokeStyle = `rgba(168,85,247,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(x1, h * 0.5);
      ctx.bezierCurveTo(
        x1 + 30, h * 0.3 + flowOffset,
        x2 - 30, h * 0.6 - flowOffset,
        x2, h * 0.5
      );
      ctx.stroke();

      // Traveling pulse along tendril
      const pulsePos = ((t * 0.5 + i * 0.3) % 1);
      const pulsePx = x1 + (x2 - x1) * pulsePos;
      const pulsePy = h * 0.5 + Math.sin(pulsePos * Math.PI) * (flowOffset - 10);
      const pulseGlow = ctx.createRadialGradient(pulsePx, pulsePy, 0, pulsePx, pulsePy, 6);
      pulseGlow.addColorStop(0, `rgba(192,132,252,${alpha * 4})`);
      pulseGlow.addColorStop(1, 'rgba(192,132,252,0)');
      circle(ctx, pulsePx, pulsePy, 6);
      ctx.fillStyle = pulseGlow;
      ctx.fill();
    }

    // Ambient purple shimmer wash
    const shimmer = 0.02 + 0.015 * Math.sin(t * 0.8);
    ctx.fillStyle = `rgba(139,92,246,${shimmer})`;
    ctx.fillRect(0, 0, w, h);
  },

  /* ── Cortex Baker: Pulses along random neural web + animated EEG waves ── */
  'Cortex Baker'(ctx, w, h, t) {
    // Rebuild the same random node positions as the static background
    const nodeCount = Math.max(18, Math.floor((w * h) / 1800));
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const px = ((i * 0.618033988 + 0.1) % 1) * w * 0.9 + w * 0.05;
      const py = ((i * 0.414213562 + 0.2) % 1) * h * 0.75 + h * 0.05;
      const jx = Math.sin(i * 13.7 + 3.1) * w * 0.04;
      const jy = Math.cos(i * 9.3 + 7.7) * h * 0.06;
      nodes.push({
        x: Math.max(4, Math.min(w - 4, px + jx)),
        y: Math.max(4, Math.min(h - 4, py + jy)),
      });
    }

    // Rebuild edges (same nearest-neighbour logic as static bg)
    const maxConnDist = Math.hypot(w, h) * 0.28;
    const edges = [];
    const edgeSet = new Set();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dists = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const d = Math.hypot(nodes[j].x - n.x, nodes[j].y - n.y);
        if (d < maxConnDist) dists.push({ j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      const connectCount = 2 + (Math.sin(i * 5.7) > 0.3 ? 1 : 0);
      for (let k = 0; k < Math.min(connectCount, dists.length); k++) {
        const j = dists[k].j;
        const key = Math.min(i, j) + ',' + Math.max(i, j);
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        edges.push([i, j]);
      }
    }

    // ── Traveling pulses along edges ──
    const pulseCount = Math.max(6, Math.floor(edges.length / 3));
    for (let p = 0; p < pulseCount; p++) {
      const edgeIdx = Math.floor(hash(p, 100) * edges.length);
      const [a, b] = edges[edgeIdx];
      const n1 = nodes[a], n2 = nodes[b];
      const speed = 0.3 + hash(p, 110) * 0.5;
      const offset = hash(p, 120) * 6;
      const phase = ((t * speed + offset) % 2);

      if (phase < 1) {
        const pos = phase;
        const ex = n1.x + (n2.x - n1.x) * pos;
        const ey = n1.y + (n2.y - n1.y) * pos;
        const alpha = 0.35 * Math.sin(pos * Math.PI);

        // Trailing light
        const trailStart = Math.max(0, pos - 0.3);
        const tx = n1.x + (n2.x - n1.x) * trailStart;
        const ty = n1.y + (n2.y - n1.y) * trailStart;
        const lineGrad = ctx.createLinearGradient(tx, ty, ex, ey);
        lineGrad.addColorStop(0, 'rgba(248,113,113,0)');
        lineGrad.addColorStop(1, `rgba(252,165,165,${(alpha * 0.6).toFixed(3)})`);
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Pulse dot
        const pulseGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
        pulseGlow.addColorStop(0, `rgba(252,165,165,${alpha.toFixed(3)})`);
        pulseGlow.addColorStop(1, 'rgba(252,165,165,0)');
        circle(ctx, ex, ey, 5);
        ctx.fillStyle = pulseGlow;
        ctx.fill();
      }
    }

    // ── Pulsing nodes ──
    nodes.forEach((n, i) => {
      const pulse = 0.04 + 0.05 * Math.sin(t * 1.8 + i * 0.9);
      const nodeGlow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 8);
      nodeGlow.addColorStop(0, `rgba(248,113,113,${pulse.toFixed(3)})`);
      nodeGlow.addColorStop(1, 'rgba(248,113,113,0)');
      circle(ctx, n.x, n.y, 8);
      ctx.fillStyle = nodeGlow;
      ctx.fill();
    });

    // ── Occasional bright synapse flash ──
    const flashIdx = Math.floor(((t * 0.4) % 1) * nodes.length);
    const flashAlpha = 0.2 * Math.sin(((t * 0.4) % 1) * Math.PI);
    if (flashAlpha > 0.02 && flashIdx < nodes.length) {
      const fn = nodes[flashIdx];
      const flashGlow = ctx.createRadialGradient(fn.x, fn.y, 0, fn.x, fn.y, 14);
      flashGlow.addColorStop(0, `rgba(255,200,200,${flashAlpha.toFixed(3)})`);
      flashGlow.addColorStop(0.5, `rgba(248,113,113,${(flashAlpha * 0.4).toFixed(3)})`);
      flashGlow.addColorStop(1, 'rgba(248,113,113,0)');
      circle(ctx, fn.x, fn.y, 14);
      ctx.fillStyle = flashGlow;
      ctx.fill();
    }

    // ── Animated EEG waves (3 waves scrolling along the bottom) ──
    const waveSpeed = t * 3;
    const waveConfigs = [
      { y: h * 0.84, freq1: 0.05, amp1: 5, freq2: 0.13, amp2: 2.5, speed1: 40, speed2: 25, color: 'rgba(252,165,165,0.18)', lw: 1.0 },
      { y: h * 0.89, freq1: 0.07, amp1: 4, freq2: 0.11, amp2: 2, speed1: 30, speed2: 45, color: 'rgba(248,113,113,0.12)', lw: 0.8 },
      { y: h * 0.94, freq1: 0.04, amp1: 3, freq2: 0.16, amp2: 1.5, speed1: 50, speed2: 35, color: 'rgba(220,38,38,0.09)', lw: 0.6 },
    ];
    waveConfigs.forEach((wc) => {
      ctx.strokeStyle = wc.color;
      ctx.lineWidth = wc.lw;
      ctx.beginPath();
      ctx.moveTo(0, wc.y);
      for (let x = 0; x < w; x += 2) {
        ctx.lineTo(
          x,
          wc.y +
            Math.sin((x + waveSpeed * wc.speed1) * wc.freq1) * wc.amp1 +
            Math.sin((x + waveSpeed * wc.speed2) * wc.freq2) * wc.amp2
        );
      }
      ctx.stroke();
    });

    // ── Subtle ambient red glow pulse ──
    const ambientPulse = 0.015 + 0.008 * Math.sin(t * 0.7);
    const ambient = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, h * 0.8);
    ambient.addColorStop(0, `rgba(220,38,38,${ambientPulse.toFixed(3)})`);
    ambient.addColorStop(1, 'rgba(220,38,38,0)');
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, w, h);
  },

  /* ── Reality Bender: Warping grid, golden fractures, dimensional flickers ── */
  'Reality Bender'(ctx, w, h, t) {
    // Animated warping grid distortion — silver/white lines
    const gridSize = 40;
    const warpIntensity = 8 + 3 * Math.sin(t * 0.5);
    ctx.strokeStyle = `rgba(180,200,220,${0.03 + 0.015 * Math.sin(t * 0.8)})`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y < h; y += 5) {
        const warp = Math.sin((x + y) * 0.01 + t * 0.5) * warpIntensity;
        ctx.lineTo(x + warp, y);
      }
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < w; x += 5) {
        const warp = Math.cos((x + y) * 0.01 + t * 0.3) * warpIntensity;
        ctx.lineTo(x, y + warp);
      }
      ctx.stroke();
    }

    // Reality fracture lightning — bright golden cracks
    for (let i = 0; i < 3; i++) {
      const crackPhase = (t * 0.15 + i * 0.33) % 1;
      const crackAlpha = crackPhase < 0.4 ? 0.25 * Math.sin(crackPhase / 0.4 * Math.PI) : 0;

      if (crackAlpha > 0.01) {
        // Core crack — bright gold
        ctx.strokeStyle = `rgba(251,191,36,${crackAlpha})`;
        ctx.lineWidth = 1.2;
        let sx = hash(i, 11) * w;
        let sy = 0;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        while (sy < h) {
          sx += (hash(Math.floor(sy) + i * 100, 22) - 0.5) * 35;
          sy += 8 + hash(Math.floor(sy) + i * 50, 33) * 12;
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        // Glow around crack — warm amber
        ctx.strokeStyle = `rgba(245,158,11,${crackAlpha * 0.35})`;
        ctx.lineWidth = 5;
        sx = hash(i, 11) * w;
        sy = 0;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        while (sy < h) {
          sx += (hash(Math.floor(sy) + i * 100, 22) - 0.5) * 35;
          sy += 8 + hash(Math.floor(sy) + i * 50, 33) * 12;
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    }

    // Tesseract rotation — golden edges
    const cubeCount = Math.max(2, Math.floor(w / 180));
    for (let i = 0; i < cubeCount; i++) {
      const tx = (i + 0.5) * (w / cubeCount);
      const ty = h * 0.5 + Math.sin(i * 2.1) * h * 0.12;
      const ts = 16 + Math.sin(i * 1.4) * 4;
      const rot = t * 0.3 + i * 1.5;

      // Rotating golden highlight edges
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(rot);
      const edgeAlpha = 0.12 + 0.06 * Math.sin(t * 2 + i);
      ctx.strokeStyle = `rgba(251,191,36,${edgeAlpha})`;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-ts * 0.4, -ts * 0.4, ts * 0.8, ts * 0.8);
      ctx.restore();

      // Pulsing golden center glow
      const glowAlpha = 0.06 + 0.04 * Math.sin(t * 2.5 + i * 1.3);
      const cubeGlow = ctx.createRadialGradient(tx, ty, 0, tx, ty, ts);
      cubeGlow.addColorStop(0, `rgba(251,191,36,${glowAlpha})`);
      cubeGlow.addColorStop(0.5, `rgba(245,158,11,${glowAlpha * 0.4})`);
      cubeGlow.addColorStop(1, 'rgba(0,0,0,0)');
      circle(ctx, tx, ty, ts);
      ctx.fillStyle = cubeGlow;
      ctx.fill();
    }

    // Dimensional flicker particles — golden flashes
    for (let i = 0; i < Math.floor(w / 25); i++) {
      const flickerPhase = (t * 0.3 + hash(i, 55) * 8) % 1;
      if (flickerPhase < 0.04) {
        const fx = hash(i, 66) * w;
        const fy = hash(i, 77) * h;
        const flickAlpha = 0.45 * Math.sin(flickerPhase / 0.04 * Math.PI);
        ctx.fillStyle = `rgba(253,224,71,${flickAlpha})`;
        star(ctx, fx, fy, 2.5, 0.8, 4);
        ctx.fill();
      }
    }

    // Floating reality-warped cookie echoes — golden glitch
    for (let i = 0; i < Math.floor(w / 100); i++) {
      const phase = (t * 0.05 + hash(i, 99) * 5) % 1;
      const ex = hash(i, 12) * w + Math.sin(t * 0.3 + i * 2) * 15;
      const ey = h * 0.9 - phase * h * 0.8;
      const opacity = 0.12 * Math.sin(phase * Math.PI);
      const wobble = Math.sin(t * 2 + i * 3) * 0.3;

      if (opacity > 0.01) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(wobble);
        ctx.globalAlpha = opacity;
        // Cookie outline — golden
        ctx.strokeStyle = 'rgba(251,191,36,0.7)';
        ctx.lineWidth = 0.8;
        circle(ctx, 0, 0, 3.5);
        ctx.stroke();
        // Duplicate offset (glitch effect) — amber
        ctx.strokeStyle = 'rgba(245,158,11,0.5)';
        circle(ctx, 1.5, -1, 3.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // Ambient warm golden dimensional wash
    const dimWash = 0.012 + 0.008 * Math.sin(t * 0.6);
    const washGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.6);
    washGrad.addColorStop(0, `rgba(251,191,36,${dimWash})`);
    washGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = washGrad;
    ctx.fillRect(0, 0, w, h);
  },
};
