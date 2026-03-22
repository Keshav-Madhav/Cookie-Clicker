import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** SafeCracker mixin */
export const SafeCrackerMixin = {
/* ════════════════════════════════════════════════════════════
   🔐  SAFE CRACKER — rotate a dial to crack a 3-number combo
   ════════════════════════════════════════════════════════════
   Inspired by The Last of Us Part II safe mechanic:
   - Every number tick produces a mechanical click
   - Near the target: deeper clicks, dial shake, glow intensifies
   - On the target: must HOLD for ~0.8s to lock the tumbler
   - Satisfying chime per locked number, vault-open on full crack
*/

_safeCracker() {
  const C = MINI_GAME_SETTINGS.safeCracker;
  const combo = [];
  for (let i = 0; i < C.comboLength; i++) {
    combo.push(Math.floor(Math.random() * C.dialMax));
  }

  const state = {
    currentNum: 0,
    dialAngle: 0,
    cracked: [],
    done: false,
    startTime: Date.now(),
    timerInterval: null,
    dragActive: false,
    lastMouseAngle: null,
    lastTickNum: -1,       // last dial number we ticked on (for detent sound)
    holdStart: 0,          // timestamp when we first landed on correct number
    holdActive: false,     // are we currently holding on the correct number?
    holdProgress: 0,       // 0-1 fill for the hold ring
    holdInterval: null,    // interval for updating hold progress
    shakeIntensity: 0,     // current shake amount for CSS
  };

  const angleToDial = (deg) => {
    const n = ((deg % 360) + 360) % 360;
    return (n / 360) * C.dialMax;
  };

  const getCurrentNum = () => {
    return ((Math.round(angleToDial(state.dialAngle)) % C.dialMax) + C.dialMax) % C.dialMax;
  };

  const getDist = (num) => {
    const target = combo[state.currentNum];
    return Math.min(
      Math.abs(num - target),
      C.dialMax - Math.abs(num - target)
    );
  };

  // ── Render ──
  const render = () => {
    const elapsed = Date.now() - state.startTime;
    const remaining = Math.max(0, C.durationMs - elapsed);
    const pct = (remaining / C.durationMs) * 100;

    const dir = C.directions[state.currentNum % C.directions.length] || 'cw';
    const dirLabel = dir === 'cw' ? '↻ Clockwise' : '↺ Counter-clockwise';

    const comboHtml = combo.map((n, i) => {
      if (i < state.currentNum) return `<span class="safe-num safe-num-done">✓</span>`;
      if (i === state.currentNum) return `<span class="safe-num safe-num-active">??</span>`;
      return `<span class="safe-num safe-num-locked">🔒</span>`;
    }).join('');

    this._show(`<div class="mini-game-card safe-card" id="safe-card">
      <div class="mini-title">🔐 Safe Cracker</div>
      <div class="safe-combo" id="safe-combo">${comboHtml}</div>
      <div class="safe-direction" id="safe-dir">${dirLabel}</div>
      <div class="safe-dial-wrap" id="safe-dial-wrap">
        <canvas id="safe-dial-canvas" width="220" height="220" class="safe-dial-canvas" style="transform: rotate(${state.dialAngle}deg)"></canvas>
        <div class="safe-marker">▼</div>
        <div class="safe-glow" id="safe-glow"></div>
        <div class="safe-hold-ring" id="safe-hold-ring">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>
            <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd700" stroke-width="4"
              stroke-dasharray="289" stroke-dashoffset="289" stroke-linecap="round"
              id="safe-hold-arc" transform="rotate(-90 50 50)"/>
          </svg>
        </div>
      </div>
      <div class="safe-readout" id="safe-readout">${getCurrentNum()}</div>
      <div class="safe-hint" id="safe-hint">Turn the dial...</div>
      <div class="mini-timer-bar"><div class="mini-timer-fill" id="safe-timer" style="width:${pct}%"></div></div>
    </div>`);

    this._safeBindDrag(state, C, combo, angleToDial, getCurrentNum, getDist);
    this._safeStartTimer(state, C);
    this._safeDrawDial(C.dialMax);
  };

  render();
},

/** Draw the entire safe dial as a detailed cookie with tick marks */
_safeDrawDial(dialMax) {
  const cvs = document.getElementById('safe-dial-canvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const s = 220, cx = s / 2, cy = s / 2, r = 104;

  ctx.clearRect(0, 0, s, s);

  // Outer shadow
  ctx.beginPath(); ctx.arc(cx + 2, cy + 3, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

  // Cookie body — radial gradient
  const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx + r * 0.1, cy + r * 0.1, r);
  grad.addColorStop(0, '#e8c078');
  grad.addColorStop(0.35, '#d4a050');
  grad.addColorStop(0.7, '#b8863a');
  grad.addColorStop(1, '#8a6020');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();

  // Crispy outer edge
  ctx.strokeStyle = '#6a4818';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Inner edge ring
  ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,220,160,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Surface texture — random bumps
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 30; i++) {
    const bx = cx + Math.sin(i * 2.7 + 0.3) * r * 0.7;
    const by = cy + Math.cos(i * 3.3 + 1.1) * r * 0.7;
    const br = 4 + (i % 5) * 2;
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bg.addColorStop(0, 'rgba(0,0,0,0.04)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  }

  // Cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 7; i++) {
    const ang = i * 0.9 + 0.2;
    const startR = r * 0.12;
    const endR = r * (0.35 + (i % 3) * 0.15);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * startR, cy + Math.sin(ang) * startR);
    for (let s2 = 1; s2 <= 4; s2++) {
      const t = s2 / 4;
      const cr = startR + (endR - startR) * t;
      const j = Math.sin(i * 7 + s2 * 3) * 0.12;
      ctx.lineTo(cx + Math.cos(ang + j) * cr, cy + Math.sin(ang + j) * cr);
    }
    ctx.stroke();
  }

  // Chocolate chips — scattered across the cookie
  const seed = (i, m) => ((i * 137.508 + 43.7) % m) / m;
  for (let i = 0; i < 14; i++) {
    const chipAng = seed(i, 97) * Math.PI * 2;
    const chipR = r * 0.2 + seed(i + 30, 83) * r * 0.55;
    const x = cx + Math.cos(chipAng) * chipR;
    const y = cy + Math.sin(chipAng) * chipR;
    const sz = 5 + (i % 3) * 2;
    const rot = seed(i + 10, 7) * Math.PI;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // Teardrop chip
    const cg = ctx.createRadialGradient(-1, -1, 0, 0, 0, sz);
    cg.addColorStop(0, '#4a2a14');
    cg.addColorStop(1, '#1a0a04');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(0, -sz);
    ctx.quadraticCurveTo(sz * 0.8, -sz * 0.3, sz * 0.6, sz * 0.4);
    ctx.quadraticCurveTo(0, sz * 0.7, -sz * 0.6, sz * 0.4);
    ctx.quadraticCurveTo(-sz * 0.8, -sz * 0.3, 0, -sz);
    ctx.fill();
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(-1.5, -sz * 0.3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Highlight crescent
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.15, cy - r * 0.2, r * 0.55, r * 0.3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Tick marks — drawn ON TOP of the cookie, around the edge
  for (let i = 0; i < dialMax; i++) {
    const ang = (i / dialMax) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % 5 === 0;
    const outerR = r - 2;
    const innerR = isMajor ? r - 16 : r - 10;

    // Tick line
    ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
    ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
    ctx.stroke();

    // Number labels for major ticks
    if (isMajor) {
      const labelR = r - 24;
      const lx = cx + Math.cos(ang) * labelR;
      const ly = cy + Math.sin(ang) * labelR;
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), lx, ly);
    }
  }

  // Red pointer at top
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(cx - 3, 6);
  ctx.lineTo(cx + 3, 6);
  ctx.lineTo(cx, 28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,100,100,0.4)';
  ctx.beginPath();
  ctx.moveTo(cx - 2, 8);
  ctx.lineTo(cx, 24);
  ctx.lineTo(cx + 2, 8);
  ctx.closePath();
  ctx.fill();
},

_safeBindDrag(state, C, combo, angleToDial, getCurrentNum, getDist) {
  const wrap = document.getElementById('safe-dial-wrap');
  const dial = document.getElementById('safe-dial-canvas');
  if (!wrap || !dial) return;
  const snd = this.game.soundManager;

  const getMouseAngle = (e) => {
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  };

  // ── Cancel hold when player moves off the target ──
  const cancelHold = () => {
    if (state.holdInterval) { clearInterval(state.holdInterval); state.holdInterval = null; }
    state.holdActive = false;
    state.holdStart = 0;
    state.holdProgress = 0;
    const arc = document.getElementById('safe-hold-arc');
    if (arc) arc.style.strokeDashoffset = '289';
    const hint = document.getElementById('safe-hint');
    if (hint) hint.textContent = 'Turn the dial...';
  };

  // ── Start hold timer when on target ──
  const startHold = () => {
    if (state.holdActive || state.done) return;
    state.holdActive = true;
    state.holdStart = Date.now();
    state.holdProgress = 0;
    snd.safeTumblerNear();

    const hint = document.getElementById('safe-hint');
    if (hint) { hint.textContent = 'Hold it...'; hint.classList.add('safe-hint-hold'); }

    state.holdInterval = setInterval(() => {
      if (state.done) { clearInterval(state.holdInterval); return; }
      const elapsed = Date.now() - state.holdStart;
      state.holdProgress = Math.min(1, elapsed / C.holdDurationMs);

      // Update hold ring arc
      const arc = document.getElementById('safe-hold-arc');
      if (arc) arc.style.strokeDashoffset = (289 * (1 - state.holdProgress)).toFixed(1);

      // Escalating shake
      state.shakeIntensity = state.holdProgress * 3;
      const card = document.getElementById('safe-card');
      if (card) {
        const sx = (Math.random() - 0.5) * state.shakeIntensity;
        const sy = (Math.random() - 0.5) * state.shakeIntensity;
        card.style.transform = `translate(${sx}px, ${sy}px)`;
      }

      // Escalating tick sounds as hold progresses
      if (state.holdProgress > 0.3 && Math.random() < 0.3) snd.safeTumblerClick();

      if (state.holdProgress >= 1) {
        // Cracked this number!
        clearInterval(state.holdInterval);
        state.holdInterval = null;
        state.holdActive = false;
        state.shakeIntensity = 0;
        const c = document.getElementById('safe-card');
        if (c) c.style.transform = '';
        this._safeCrackNumber(state, C, combo, angleToDial, getCurrentNum, getDist);
      }
    }, 30);
  };

  const onStart = (e) => {
    if (state.done) return;
    e.preventDefault();
    state.dragActive = true;
    state.lastMouseAngle = getMouseAngle(e);
  };

  const onMove = (e) => {
    if (!state.dragActive || state.done) return;
    e.preventDefault();
    const mouseAngle = getMouseAngle(e);
    let delta = mouseAngle - state.lastMouseAngle;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    state.dialAngle += delta;
    state.lastMouseAngle = mouseAngle;
    dial.style.transform = `rotate(${state.dialAngle}deg)`;

    const currentNum = getCurrentNum();
    const readout = document.getElementById('safe-readout');
    if (readout) readout.textContent = currentNum;

    // ── Detent tick: play a click every time the number changes ──
    if (currentNum !== state.lastTickNum) {
      const dist = getDist(currentNum);

      if (dist === 0) {
        // ON the target — deeper tumbler sound
        snd.safeTumblerHit();
        if (!state.holdActive) startHold();
      } else if (dist <= C.nearZone) {
        // NEAR the target — slightly heavier click, intensity scales with proximity
        snd.safeTumblerNear();
      } else {
        // Normal detent tick
        snd.safeDialTick();
      }
      state.lastTickNum = currentNum;
    }

    // ── If we moved off the target while holding, cancel ──
    const dist = getDist(currentNum);
    if (dist > C.tolerance && state.holdActive) {
      cancelHold();
    }

    // ── Glow + shake based on proximity ──
    const glow = document.getElementById('safe-glow');
    if (glow) {
      if (dist <= C.nearZone) {
        const intensity = 1 - (dist / C.nearZone);
        glow.style.opacity = (intensity * 0.7).toFixed(2);
        glow.style.boxShadow = `0 0 ${Math.round(intensity * 35)}px ${Math.round(intensity * 18)}px rgba(255,215,0,${(intensity * 0.5).toFixed(2)})`;

        // Subtle dial shake when near (not holding — hold shake is separate)
        if (!state.holdActive && dist <= 2) {
          const sx = (Math.random() - 0.5) * (1 - dist / 3) * 1.5;
          const sy = (Math.random() - 0.5) * (1 - dist / 3) * 1.5;
          dial.style.transform = `rotate(${state.dialAngle}deg) translate(${sx}px, ${sy}px)`;
        }
      } else {
        glow.style.opacity = '0';
        glow.style.boxShadow = 'none';
      }
    }

    // ── Readout color ──
    if (readout) {
      if (dist === 0) readout.className = 'safe-readout safe-readout-hit';
      else if (dist <= C.nearZone) readout.className = 'safe-readout safe-readout-near';
      else readout.className = 'safe-readout';
    }
  };

  const onEnd = () => {
    state.dragActive = false;
    // Hold continues even after mouse release — player just needs to
    // land on the number and wait, no need to keep dragging
  };

  wrap.addEventListener('mousedown', onStart);
  wrap.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);

  state._cleanup = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchend', onEnd);
    if (state.holdInterval) clearInterval(state.holdInterval);
    if (state.timerInterval) clearInterval(state.timerInterval);
  };
  this._activeCleanup = () => state._cleanup();
},

_safeCrackNumber(state, C, combo, angleToDial, getCurrentNum, getDist) {
  if (state.done) return;
  const snd = this.game.soundManager;

  state.cracked.push(combo[state.currentNum]);
  state.currentNum++;
  snd.safeCrackNum();

  // Flash the cracked number
  const nums = document.querySelectorAll('.safe-num');
  if (nums[state.currentNum - 1]) {
    nums[state.currentNum - 1].textContent = '✓';
    nums[state.currentNum - 1].className = 'safe-num safe-num-done safe-num-pop';
  }

  const hint = document.getElementById('safe-hint');
  if (hint) hint.classList.remove('safe-hint-hold');

  if (state.currentNum >= C.comboLength) {
    // All cracked!
    state.done = true;
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state._cleanup) state._cleanup();

    const elapsed = (Date.now() - state.startTime) / 1000;
    const remaining = Math.max(0, (C.durationMs / 1000) - elapsed);

    let tier = null;
    if (remaining >= C.legendaryThreshold) tier = 'legendary';
    else if (remaining >= C.epicThreshold) tier = 'epic';
    else if (remaining >= C.greatThreshold) tier = 'great';
    else tier = 'normal';

    snd.safeCrackOpen();
    const reward = this._giveReward(tier, 'safeCracker');
    const tierLabels = { legendary: '🏆 LEGENDARY', epic: '💎 EPIC', great: '⭐ GREAT', normal: '✅ Cracked!' };

    setTimeout(() => {
      this._show(`<div class="mini-game-card safe-card">
        <div class="mini-title">🔐 Safe Cracker</div>
        <div class="safe-result">
          <div class="safe-result-icon">🔓</div>
          <div class="safe-result-tier">${tierLabels[tier]}</div>
          <div class="safe-result-time">${elapsed.toFixed(1)}s · ${remaining.toFixed(1)}s left</div>
          <div class="mini-reward">+${formatNumberInWords(reward)} cookies</div>
        </div>
      </div>`);
      setTimeout(() => this._close(), C.resultDisplayMs);
    }, 600);
    return;
  }

  // Update direction label
  const dirEl = document.getElementById('safe-dir');
  if (dirEl) {
    const dir = C.directions[state.currentNum % C.directions.length] || 'cw';
    dirEl.textContent = dir === 'cw' ? '↻ Clockwise' : '↺ Counter-clockwise';
  }

  // Update active number display
  if (nums[state.currentNum]) {
    nums[state.currentNum].className = 'safe-num safe-num-active';
    nums[state.currentNum].textContent = '??';
  }

  if (hint) hint.textContent = 'Next number...';

  // Reset glow & hold ring
  const glow = document.getElementById('safe-glow');
  if (glow) { glow.style.opacity = '0'; glow.style.boxShadow = 'none'; }
  const arc = document.getElementById('safe-hold-arc');
  if (arc) arc.style.strokeDashoffset = '289';

  // Reset hold state for next number
  state.holdActive = false;
  state.holdStart = 0;
  state.holdProgress = 0;
  state.lastTickNum = -1;
},

_safeStartTimer(state, C) {
  state.timerInterval = setInterval(() => {
    if (state.done) { clearInterval(state.timerInterval); return; }
    const elapsed = Date.now() - state.startTime;
    const remaining = Math.max(0, C.durationMs - elapsed);
    const pct = (remaining / C.durationMs) * 100;

    const timerEl = document.getElementById('safe-timer');
    if (timerEl) timerEl.style.width = pct + '%';

    if (remaining <= 0) {
      state.done = true;
      clearInterval(state.timerInterval);
      if (state._cleanup) state._cleanup();
      this.game.soundManager.panelClose();

      this._show(`<div class="mini-game-card safe-card">
        <div class="mini-title">🔐 Safe Cracker</div>
        <div class="safe-result">
          <div class="safe-result-icon">⏰</div>
          <div class="safe-result-tier">Time's Up!</div>
          <div class="safe-result-time">Cracked ${state.currentNum}/${C.comboLength}</div>
        </div>
      </div>`);
      setTimeout(() => this._close(), 2000);
    }
  }, 100);
}

};
