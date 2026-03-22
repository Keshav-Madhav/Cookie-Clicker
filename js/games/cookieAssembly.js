import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** CookieAssembly mixin */
export const CookieAssemblyMixin = {
/* ════════════════════════════════════════════════════════════
   🧑‍🍳  COOKIE ASSEMBLY — replicate a cookie from a reference
   ════════════════════════════════════════════════════════════
   Order ticket + build station. Canvas-drawn cookies.
   3 rounds (3→4→5 categories). Tab-based category picker.
*/

_cookieAssembly() {
  const C = MINI_GAME_SETTINGS.cookieAssembly;
  const snd = this.game.soundManager;
  const S = C.cookieSize;

  const state = {
    round: 0, totalScore: 0, roundResults: [],
    target: {}, selected: {}, activeCats: [],
    activeTab: 0,
    timerInterval: null, startTime: 0, done: false,
  };

  const initRound = () => {
    const n = C.categoriesPerRound[Math.min(state.round, C.categoriesPerRound.length - 1)];
    state.activeCats = C.categories.slice(0, n);
    state.target = {};
    for (const cat of state.activeCats) {
      // Ensure target doesn't always pick 'none' for Topping/Drizzle/Garnish
      const opts = cat.options.filter(o => o !== 'none');
      const pool = Math.random() < 0.2 ? cat.options : (opts.length ? opts : cat.options);
      state.target[cat.name] = pool[Math.floor(Math.random() * pool.length)];
    }
    state.selected = {};
    state.activeTab = 0;
    state.startTime = Date.now();
  };

  initRound();

  const drawCookie = (canvasId, sel) => {
    const cvs = document.getElementById(canvasId);
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, r = S * 0.38;
    const shape = sel.Shape || 'circle';
    const color = C.colorMap[sel.Color] || '#a08060';

    // Draw full cookie base with texture, cracks, shading
    this._asmDrawBase(ctx, shape, cx, cy, r, color);

    // Layers clipped to shape
    ctx.save();
    this._asmShapePath(ctx, shape, cx, cy, r);
    ctx.clip();
    if (sel.Topping && sel.Topping !== 'none') this._asmDrawTopping(ctx, sel.Topping, cx, cy, r);
    if (sel.Drizzle && sel.Drizzle !== 'none') this._asmDrawDrizzle(ctx, sel.Drizzle, cx, cy, r, C);
    if (sel.Garnish && sel.Garnish !== 'none') this._asmDrawGarnish(ctx, sel.Garnish, cx, cy, r);
    ctx.restore();
  };

  // Build the order ticket showing what's needed
  const buildTicket = () => {
    let items = '';
    for (const cat of state.activeCats) {
      const val = state.target[cat.name];
      const label = C.labels[val] || val;
      items += `<div class="asm-ticket-item"><span class="asm-ticket-cat">${cat.name}:</span> <span class="asm-ticket-val">${label}</span></div>`;
    }
    return items;
  };

  // Build tab buttons for categories
  const buildTabs = () => {
    return state.activeCats.map((cat, i) => {
      const hasSel = !!state.selected[cat.name];
      return `<button class="asm-tab${i === state.activeTab ? ' asm-tab-active' : ''}${hasSel ? ' asm-tab-done' : ''}" data-idx="${i}">${cat.name}</button>`;
    }).join('');
  };

  // Build options for active tab
  const buildOptions = () => {
    const cat = state.activeCats[state.activeTab];
    if (!cat) return '';
    return cat.options.map(opt => {
      const isSel = state.selected[cat.name] === opt;
      const label = C.labels[opt] || opt;
      return `<button class="asm-opt${isSel ? ' asm-opt-sel' : ''}" data-cat="${cat.name}" data-id="${opt}">
        <canvas class="asm-opt-canvas" id="asw-${cat.name}-${opt}" width="40" height="40"></canvas>
        <span class="asm-opt-label">${label}</span>
      </button>`;
    }).join('');
  };

  const renderRound = () => {
    this._show(`<div class="mini-game-card asm-card">
      <div class="asm-header">
        <div class="asm-title">Cookie Assembly</div>
        <div class="asm-round-badge">Order ${state.round + 1}/${C.rounds}</div>
      </div>
      <div class="asm-body">
        <div class="asm-left">
          <div class="asm-ticket">
            <div class="asm-ticket-head">ORDER TICKET</div>
            ${buildTicket()}
          </div>
          <canvas id="asm-target" width="${S}" height="${S}" class="asm-canvas asm-canvas-target"></canvas>
        </div>
        <div class="asm-right">
          <canvas id="asm-player" width="${S}" height="${S}" class="asm-canvas asm-canvas-player"></canvas>
          <div class="asm-tabs" id="asm-tabs">${buildTabs()}</div>
          <div class="asm-options" id="asm-options">${buildOptions()}</div>
        </div>
      </div>
      <div class="asm-bottom">
        <button class="asm-submit" id="asm-submit">Serve</button>
        <div class="mini-timer-bar"><div class="mini-timer-fill" id="asm-timer" style="width:100%"></div></div>
      </div>
    </div>`);

    drawCookie('asm-target', state.target);
    drawCookie('asm-player', { Shape: 'circle', Color: 'golden', ...state.selected });
    drawSwatches();
    bindEvents();
    startTimer();
  };

  const drawSwatches = () => {
    const cat = state.activeCats[state.activeTab];
    if (!cat) return;
    for (const opt of cat.options) {
      this._asmDrawSwatch(`asw-${cat.name}-${opt}`, cat.name, opt, C, 40);
    }
  };

  const updateOptions = () => {
    const optEl = document.getElementById('asm-options');
    if (optEl) { optEl.innerHTML = buildOptions(); drawSwatches(); }
    const tabEl = document.getElementById('asm-tabs');
    if (tabEl) tabEl.innerHTML = buildTabs();
    bindEvents();
  };

  const bindEvents = () => {
    document.querySelectorAll('.asm-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selected[btn.dataset.cat] = btn.dataset.id;
        snd.assemblySelect();
        drawCookie('asm-player', { Shape: 'circle', Color: 'golden', ...state.selected });
        // Auto-advance to next tab if this was first selection
        const nextEmpty = state.activeCats.findIndex(c => !state.selected[c.name]);
        if (nextEmpty >= 0 && nextEmpty !== state.activeTab) {
          state.activeTab = nextEmpty;
        }
        updateOptions();
      });
    });
    document.querySelectorAll('.asm-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.activeTab = parseInt(btn.dataset.idx);
        snd.assemblyTab();
        updateOptions();
      });
    });
    document.getElementById('asm-submit')?.addEventListener('click', (e) => {
      e.stopPropagation(); submitRound();
    });
  };

  let lastTickSec = -1;
  const startTimer = () => {
    if (state.timerInterval) clearInterval(state.timerInterval);
    lastTickSec = -1;
    state.timerInterval = setInterval(() => {
      const rem = Math.max(0, C.roundTimeMs - (Date.now() - state.startTime));
      const timer = document.getElementById('asm-timer');
      if (timer) timer.style.width = ((rem / C.roundTimeMs) * 100) + '%';
      // Warning ticks in last 3 seconds
      const secLeft = Math.ceil(rem / 1000);
      if (secLeft <= 3 && secLeft > 0 && secLeft !== lastTickSec) {
        lastTickSec = secLeft;
        snd.assemblyTimeTick();
      }
      if (rem <= 0) { clearInterval(state.timerInterval); submitRound(); }
    }, 100);
  };

  const submitRound = () => {
    if (state.done) return;
    state.done = true;
    if (state.timerInterval) clearInterval(state.timerInterval);

    const remaining = Math.max(0, (C.roundTimeMs - (Date.now() - state.startTime)) / 1000);
    let correct = 0;
    const results = [];
    for (const cat of state.activeCats) {
      const ok = state.selected[cat.name] === state.target[cat.name];
      if (ok) correct++;
      results.push({ name: cat.name, ok, expected: C.labels[state.target[cat.name]], got: C.labels[state.selected[cat.name]] || 'None' });
    }
    const total = state.activeCats.length;
    const pts = correct * C.correctPoints + Math.floor(remaining * C.timeBonusPerSec);
    state.totalScore += pts;
    state.roundResults.push({ correct, total, pts });

    snd.assemblyServe();
    if (correct === total) setTimeout(() => snd.assemblyPerfect(), 200);
    else if (correct > 0) setTimeout(() => snd.assemblyPartial(), 200);
    else setTimeout(() => snd.assemblyFail(), 200);

    // Side-by-side comparison with per-category results
    const compRows = results.map(r =>
      `<div class="asm-comp-row ${r.ok ? 'asm-comp-ok' : 'asm-comp-wrong'}">
        <span class="asm-comp-cat">${r.name}</span>
        <span class="asm-comp-expected">${r.expected}</span>
        <span class="asm-comp-icon">${r.ok ? '=' : '/'}</span>
        <span class="asm-comp-got">${r.got}</span>
      </div>`
    ).join('');

    this._show(`<div class="mini-game-card asm-card">
      <div class="asm-header">
        <div class="asm-title">Cookie Assembly</div>
        <div class="asm-round-badge">Order ${state.round + 1}/${C.rounds}</div>
      </div>
      <div class="asm-compare">
        <div class="asm-compare-cookies">
          <div class="asm-cookie-col">
            <div class="asm-label">ORDER</div>
            <canvas id="asm-cmp-target" width="${S}" height="${S}" class="asm-canvas"></canvas>
          </div>
          <div class="asm-cookie-col">
            <div class="asm-label">YOURS</div>
            <canvas id="asm-cmp-player" width="${S}" height="${S}" class="asm-canvas"></canvas>
          </div>
        </div>
        <div class="asm-comp-details">${compRows}</div>
        <div class="asm-comp-score">
          <span class="asm-comp-pts">${correct}/${total}</span>
          <span class="asm-comp-bonus">+${pts} pts</span>
          ${correct === total ? '<span class="asm-comp-perfect">Perfect!</span>' : ''}
        </div>
      </div>
    </div>`);

    drawCookie('asm-cmp-target', state.target);
    drawCookie('asm-cmp-player', { Shape: 'circle', Color: 'golden', ...state.selected });

    setTimeout(() => {
      state.round++;
      state.done = false;
      if (state.round >= C.rounds) {
        this._asmFinish(state, C);
      } else {
        initRound();
        renderRound();
      }
    }, 2000);
  };

  this._activeCleanup = () => {
    if (state.timerInterval) clearInterval(state.timerInterval);
  };
  renderRound();
},

// ── Canvas drawing helpers for Cookie Assembly ──

_asmShapePath(ctx, shape, cx, cy, r) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === 'square') {
    const s = r * 0.85;
    ctx.roundRect(cx - s, cy - s, s * 2, s * 2, s * 0.25);
  } else if (shape === 'star') {
    for (let i = 0; i < 5; i++) {
      const a1 = (i * 72 - 90) * Math.PI / 180;
      const a2 = ((i * 72) + 36 - 90) * Math.PI / 180;
      ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      ctx.lineTo(cx + Math.cos(a2) * r * 0.5, cy + Math.sin(a2) * r * 0.5);
    }
    ctx.closePath();
  } else if (shape === 'heart') {
    const s = r * 0.58;
    ctx.moveTo(cx, cy + s * 1.3);
    ctx.bezierCurveTo(cx - s * 2.2, cy - s * 0.3, cx - s * 0.8, cy - s * 2, cx, cy - s * 0.7);
    ctx.bezierCurveTo(cx + s * 0.8, cy - s * 2, cx + s * 2.2, cy - s * 0.3, cx, cy + s * 1.3);
  } else if (shape === 'diamond') {
    // Rounded diamond
    const rx = r * 0.6, ry = r;
    ctx.moveTo(cx, cy - ry);
    ctx.quadraticCurveTo(cx + rx * 0.6, cy - ry * 0.3, cx + rx, cy);
    ctx.quadraticCurveTo(cx + rx * 0.6, cy + ry * 0.3, cx, cy + ry);
    ctx.quadraticCurveTo(cx - rx * 0.6, cy + ry * 0.3, cx - rx, cy);
    ctx.quadraticCurveTo(cx - rx * 0.6, cy - ry * 0.3, cx, cy - ry);
  }
},

/** Realistic cookie base with cracks, baked texture, edge detail */
_asmDrawBase(ctx, shape, cx, cy, r, color) {
  const lighter = this._asmLighten(color, 0.2);
  const darker = this._asmDarken(color, 0.25);
  const edge = this._asmDarken(color, 0.4);

  // Outer shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  this._asmShapePath(ctx, shape, cx, cy, r);
  ctx.fillStyle = darker;
  ctx.fill();
  ctx.restore();

  // Main body with radial gradient
  this._asmShapePath(ctx, shape, cx, cy, r);
  const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx + r * 0.1, cy + r * 0.1, r * 1.1);
  grad.addColorStop(0, lighter);
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, darker);
  ctx.fillStyle = grad;
  ctx.fill();

  // Crispy edge ring
  ctx.save();
  this._asmShapePath(ctx, shape, cx, cy, r);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Inner edge highlight
  this._asmShapePath(ctx, shape, cx, cy, r - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Baked surface texture — clip to shape
  ctx.save();
  this._asmShapePath(ctx, shape, cx, cy, r);
  ctx.clip();

  // Subtle bumps (uneven surface)
  for (let i = 0; i < 18; i++) {
    const bx = cx + Math.sin(i * 2.7 + 0.3) * r * 0.7;
    const by = cy + Math.cos(i * 3.3 + 1.1) * r * 0.7;
    const br = 3 + (i % 5) * 1.2;
    const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g2.addColorStop(0, 'rgba(0,0,0,0.05)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  }

  // Cracks — thin dark lines radiating from center
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) {
    const ang = (i * 1.3 + 0.4);
    const len = r * (0.3 + (i % 3) * 0.15);
    const startR = r * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * startR, cy + Math.sin(ang) * startR);
    // Jagged crack path
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const cr = startR + (len - startR) * t;
      const jitter = (Math.sin(i * 7 + s * 3) * 0.15);
      ctx.lineTo(cx + Math.cos(ang + jitter) * cr, cy + Math.sin(ang + jitter) * cr);
    }
    ctx.stroke();
  }

  // Top highlight — crescent shine
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.1, cy - r * 0.25, r * 0.55, r * 0.3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
},

_asmDrawTopping(ctx, topping, cx, cy, r) {
  const seed = (i, m) => ((i * 137.508 + 43.7) % m) / m;

  if (topping === 'chips') {
    // Chocolate chips — teardrop shapes with highlight
    for (let i = 0; i < 10; i++) {
      const x = cx + (seed(i, 97) - 0.5) * r * 1.5;
      const y = cy + (seed(i + 47, 89) - 0.5) * r * 1.5;
      const ang = seed(i, 7) * Math.PI * 2;
      const sz = 3.5 + (i % 3) * 1.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      // Teardrop body
      const g = ctx.createRadialGradient(-1, -1, 0, 0, 0, sz);
      g.addColorStop(0, '#4a2a14');
      g.addColorStop(1, '#1a0a04');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.quadraticCurveTo(sz * 0.8, -sz * 0.3, sz * 0.6, sz * 0.4);
      ctx.quadraticCurveTo(0, sz * 0.8, -sz * 0.6, sz * 0.4);
      ctx.quadraticCurveTo(-sz * 0.8, -sz * 0.3, 0, -sz);
      ctx.fill();
      // Shine dot
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(-1, -sz * 0.3, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else if (topping === 'sprinkles') {
    // Colorful rod sprinkles with rounded ends and slight 3D
    const colors = [
      ['#ff4060', '#cc2040'], ['#40a0ff', '#2070cc'], ['#ffcc20', '#cc9a10'],
      ['#40dd70', '#20aa50'], ['#ff60cc', '#cc40a0'], ['#ff8030', '#cc6020'],
    ];
    for (let i = 0; i < 16; i++) {
      const x = cx + (seed(i, 97) - 0.5) * r * 1.4;
      const y = cy + (seed(i + 31, 83) - 0.5) * r * 1.4;
      const ang = seed(i + 10, 13) * Math.PI;
      const [col, dark] = colors[i % colors.length];
      const len = 4 + (i % 3);
      ctx.lineCap = 'round';
      // Shadow
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * len + 0.5, y - Math.sin(ang) * len + 0.5);
      ctx.lineTo(x + Math.cos(ang) * len + 0.5, y + Math.sin(ang) * len + 0.5);
      ctx.stroke();
      // Body
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  } else if (topping === 'nuts') {
    // Chopped nuts — irregular polygons with grain texture
    for (let i = 0; i < 8; i++) {
      const x = cx + (seed(i, 97) - 0.5) * r * 1.3;
      const y = cy + (seed(i + 41, 83) - 0.5) * r * 1.3;
      const sz = 3 + (i % 4) * 1.5;
      const ang = seed(i, 11) * Math.PI * 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      // Irregular shape
      const g = ctx.createLinearGradient(-sz, -sz, sz, sz);
      g.addColorStop(0, '#d4a860');
      g.addColorStop(0.5, '#b8860b');
      g.addColorStop(1, '#8b6508');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.3, -sz);
      ctx.lineTo(sz * 0.7, -sz * 0.5);
      ctx.lineTo(sz, sz * 0.3);
      ctx.lineTo(sz * 0.2, sz * 0.8);
      ctx.lineTo(-sz * 0.8, sz * 0.4);
      ctx.lineTo(-sz, -sz * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6b4a08';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // Grain line
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(-sz * 0.5, 0); ctx.lineTo(sz * 0.5, -sz * 0.2); ctx.stroke();
      ctx.restore();
    }
  } else if (topping === 'raisins') {
    // Raisins — wrinkled dark ovals with sheen
    for (let i = 0; i < 8; i++) {
      const x = cx + (seed(i, 97) - 0.5) * r * 1.3;
      const y = cy + (seed(i + 53, 79) - 0.5) * r * 1.3;
      const sz = 3.5 + (i % 3);
      const ang = seed(i + 5, 9) * Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      // Body
      const g = ctx.createRadialGradient(-1, -1, 0, 0, 0, sz);
      g.addColorStop(0, '#3a1828');
      g.addColorStop(1, '#1a0810');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      // Wrinkle lines
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.4;
      for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        ctx.moveTo(-sz * 0.6 + w * sz * 0.4, -sz * 0.3);
        ctx.quadraticCurveTo(-sz * 0.3 + w * sz * 0.4, sz * 0.1, -sz * 0.5 + w * sz * 0.4, sz * 0.3);
        ctx.stroke();
      }
      // Sheen
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.ellipse(-sz * 0.2, -sz * 0.2, sz * 0.3, sz * 0.15, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
},

_asmDrawDrizzle(ctx, drizzle, cx, cy, r, C) {
  const color = C.drizzleMap[drizzle];
  if (!color) return;
  const lighter = this._asmLighten(color, 0.15);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Multiple organic drizzle lines with varying thickness
  for (let i = 0; i < 4; i++) {
    const baseY = cy - r * 0.5 + i * r * 0.32;
    const xOff = (i % 2 === 0 ? -1 : 1) * r * 0.05;

    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7 + xOff, baseY + 1);
    ctx.bezierCurveTo(cx - r * 0.3, baseY + 8 + 1, cx + r * 0.1, baseY - 5 + 1, cx + r * 0.65 + xOff, baseY + 2 + 1);
    ctx.stroke();

    // Main drizzle line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 + (i % 2) * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7 + xOff, baseY);
    ctx.bezierCurveTo(cx - r * 0.3, baseY + 8, cx + r * 0.1, baseY - 5, cx + r * 0.65 + xOff, baseY + 2);
    ctx.stroke();

    // Highlight on top edge
    ctx.strokeStyle = lighter;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6 + xOff, baseY - 1);
    ctx.bezierCurveTo(cx - r * 0.25, baseY + 6, cx + r * 0.15, baseY - 6, cx + r * 0.6 + xOff, baseY + 1);
    ctx.stroke();
  }
},

_asmDrawGarnish(ctx, garnish, cx, cy, r) {
  if (garnish === 'cherry') {
    const chX = cx, chY = cy - r * 0.1, chR = r * 0.22;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(chX + 1, chY + 2, chR + 1, 0, Math.PI * 2); ctx.fill();
    // Cherry body — gradient
    const g = ctx.createRadialGradient(chX - chR * 0.3, chY - chR * 0.3, chR * 0.1, chX, chY, chR);
    g.addColorStop(0, '#ff3a4a');
    g.addColorStop(0.6, '#cc1525');
    g.addColorStop(1, '#8a0a15');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(chX, chY, chR, 0, Math.PI * 2); ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(chX - chR * 0.25, chY - chR * 0.3, chR * 0.35, chR * 0.2, -0.3, 0, Math.PI * 2); ctx.fill();
    // Stem — curved green
    ctx.strokeStyle = '#2a7020';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(chX + 1, chY - chR + 1);
    ctx.quadraticCurveTo(chX + chR * 0.8, chY - chR * 2.2, chX + chR * 0.3, chY - chR * 2.5);
    ctx.stroke();
    // Tiny leaf at stem end
    ctx.fillStyle = '#3a9030';
    ctx.beginPath();
    ctx.ellipse(chX + chR * 0.5, chY - chR * 2, chR * 0.5, chR * 0.25, 0.5, 0, Math.PI * 2);
    ctx.fill();

  } else if (garnish === 'mint') {
    const lx = cx + r * 0.05, ly = cy - r * 0.2;
    // Two leaves
    for (let leaf = 0; leaf < 2; leaf++) {
      const lAng = leaf === 0 ? -0.3 : 0.8;
      const lOff = leaf === 0 ? -1 : 1;
      ctx.save();
      ctx.translate(lx + lOff * r * 0.12, ly);
      ctx.rotate(lAng);
      // Leaf body gradient
      const lg = ctx.createLinearGradient(0, -r * 0.18, 0, r * 0.18);
      lg.addColorStop(0, '#4aaa4a');
      lg.addColorStop(1, '#2a7a2a');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.2, -r * 0.18, r * 0.35, 0);
      ctx.quadraticCurveTo(r * 0.2, r * 0.18, 0, 0);
      ctx.fill();
      // Center vein
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.3, 0); ctx.stroke();
      // Side veins
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 0.4;
      for (let v = 1; v <= 2; v++) {
        ctx.beginPath();
        ctx.moveTo(r * 0.1 * v, 0);
        ctx.lineTo(r * 0.08 * v + r * 0.06, -r * 0.08);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.1 * v, 0);
        ctx.lineTo(r * 0.08 * v + r * 0.06, r * 0.08);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Small stem
    ctx.strokeStyle = '#2a6020';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 2, ly + r * 0.15); ctx.stroke();

  } else if (garnish === 'powdered') {
    // Powdered sugar — dense white dust with varying opacity
    for (let i = 0; i < 35; i++) {
      const px = cx + Math.sin(i * 3.7 + 0.5) * r * 0.75;
      const py = cy + Math.cos(i * 2.3 + 1.2) * r * 0.75;
      const pSz = 0.8 + (i % 4) * 0.6;
      const pAlpha = 0.25 + (i % 3) * 0.15;
      ctx.fillStyle = `rgba(255,255,250,${pAlpha})`;
      ctx.beginPath(); ctx.arc(px, py, pSz, 0, Math.PI * 2); ctx.fill();
    }
    // A few larger clumps
    for (let i = 0; i < 5; i++) {
      const px = cx + Math.cos(i * 2.1 + 3) * r * 0.4;
      const py = cy + Math.sin(i * 1.7 + 2) * r * 0.4;
      ctx.fillStyle = 'rgba(255,255,250,0.15)';
      ctx.beginPath(); ctx.arc(px, py, 4 + i % 3, 0, Math.PI * 2); ctx.fill();
    }

  } else if (garnish === 'frosting') {
    // Piped frosting rosette — concentric swirl with 3D shading
    ctx.lineCap = 'round';
    const rings = 4;
    for (let ring = rings; ring >= 0; ring--) {
      const ringR = ring * r * 0.12;
      const segs = 12 + ring * 4;
      // Shadow layer
      ctx.strokeStyle = 'rgba(200,180,160,0.5)';
      ctx.lineWidth = 4.5 - ring * 0.5;
      ctx.beginPath();
      for (let s = 0; s <= segs; s++) {
        const ang = (s / segs) * Math.PI * 2 + ring * 0.5;
        const wobble = Math.sin(s * 3) * 1.5;
        const px = cx + Math.cos(ang) * (ringR + wobble) + 0.5;
        const py = cy + Math.sin(ang) * (ringR + wobble) + 0.5;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Main frosting
      ctx.strokeStyle = ring === 0 ? '#fff5e6' : `rgba(255,245,235,${0.85 - ring * 0.05})`;
      ctx.lineWidth = 3.5 - ring * 0.4;
      ctx.beginPath();
      for (let s = 0; s <= segs; s++) {
        const ang = (s / segs) * Math.PI * 2 + ring * 0.5;
        const wobble = Math.sin(s * 3) * 1.5;
        const px = cx + Math.cos(ang) * (ringR + wobble);
        const py = cy + Math.sin(ang) * (ringR + wobble);
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Center dot
    ctx.fillStyle = '#fff8f0';
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
},

_asmDrawSwatch(canvasId, catName, optionId, C, size = 40) {
  const cvs = document.getElementById(canvasId);
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const s = size, cx = s / 2, cy = s / 2, r = s * 0.35;
  ctx.clearRect(0, 0, s, s);

  if (catName === 'Shape') {
    ctx.fillStyle = '#a08060';
    this._asmShapePath(ctx, optionId, cx, cy, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  } else if (catName === 'Color') {
    const col = C.colorMap[optionId] || '#888';
    const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, r);
    g.addColorStop(0, this._asmLighten(col, 0.1)); g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  } else if (catName === 'Topping') {
    if (optionId === 'none') {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s * 0.25, s * 0.75); ctx.lineTo(s * 0.75, s * 0.25); ctx.stroke();
    } else {
      // Draw on a subtle cookie background
      ctx.fillStyle = 'rgba(160,128,96,0.3)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      this._asmDrawTopping(ctx, optionId, cx, cy, r);
      ctx.restore();
    }
  } else if (catName === 'Drizzle') {
    if (optionId === 'none') {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s * 0.25, s * 0.75); ctx.lineTo(s * 0.75, s * 0.25); ctx.stroke();
    } else {
      const col = C.drizzleMap[optionId];
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(6, cy - 4);
      ctx.quadraticCurveTo(cx, cy + 6, s - 6, cy - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, cy + 5);
      ctx.quadraticCurveTo(cx, cy - 3, s - 6, cy + 5); ctx.stroke();
    }
  } else if (catName === 'Garnish') {
    if (optionId === 'none') {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s * 0.25, s * 0.75); ctx.lineTo(s * 0.75, s * 0.25); ctx.stroke();
    } else {
      this._asmDrawGarnish(ctx, optionId, cx, cy, r);
    }
  }
},

_asmLighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amt));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amt));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amt));
  return `rgb(${r},${g},${b})`;
},

_asmDarken(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amt));
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amt));
  return `rgb(${r},${g},${b})`;
},

_asmFinish(state, C) {
  const score = state.totalScore;
  let tier = null;
  if (score >= C.legendaryThreshold) tier = 'legendary';
  else if (score >= C.epicThreshold) tier = 'epic';
  else if (score >= C.greatThreshold) tier = 'great';
  else if (score >= C.normalThreshold) tier = 'normal';

  const tierLabels = { legendary: 'LEGENDARY!', epic: 'EPIC!', great: 'GREAT!', normal: 'Nice!' };

  let rewardHtml = '';
  if (tier) {
    const reward = this._giveReward(tier, 'cookieAssembly');
    rewardHtml = `<div class="mini-reward">+${formatNumberInWords(reward)} cookies</div>`;
  }

  const roundsHtml = state.roundResults.map((r) =>
    `<span class="asm-rnd-score">${r.correct}/${r.total} (+${r.pts})</span>`
  ).join('');

  this._show(`<div class="mini-game-card asm-card">
    <div class="mini-title">Cookie Assembly</div>
    <div class="asm-finish">
      <div class="asm-finish-tier">${tier ? tierLabels[tier] : 'Keep practicing!'}</div>
      <div class="asm-finish-total">Total: ${score} pts</div>
      <div class="asm-finish-rounds">${roundsHtml}</div>
      ${rewardHtml}
    </div>
  </div>`);
  setTimeout(() => this._close(), C.resultDisplayMs);
}

};
