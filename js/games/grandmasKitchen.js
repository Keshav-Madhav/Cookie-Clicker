import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** GrandmasKitchen mixin */
export const GrandmasKitchenMixin = {
/* ════════════════════════════════════════════════════════════
   👵  GRANDMA'S KITCHEN  — time cookies perfectly!
   Higher reward for longer gameplay!
   ════════════════════════════════════════════════════════════ */
_grandmasKitchen() {
  const cfg = MINI_GAME_SETTINGS.grandmasKitchen;
  const durationSec = cfg.durationMs / 1000;

  // Build oven HTML
  let ovensHtml = '';
  for (let i = 0; i < cfg.ovenCount; i++) {
    ovensHtml += `
      <div class="kitchen-oven" id="oven-${i}" data-state="empty">
        <div class="oven-display">🔲</div>
        <div class="oven-timer-bar"><div class="oven-timer-fill" id="oven-timer-${i}"></div></div>
        <div class="oven-status">Empty</div>
      </div>
    `;
  }

  const overlay = this._show(`
    <div class="mini-game-card mini-kitchen-card">
      <div class="mini-title">👵 Grandma's Kitchen! <span class="mini-sub">Click when golden!</span></div>
      <div class="kitchen-instructions">
        <div class="kitchen-legend">
          <span>🫓 Baking...</span>
          <span>🍪 <strong>CLICK NOW!</strong></span>
          <span>💨 Burnt!</span>
        </div>
        Wait for 🍪 then click! Too early = raw, too late = burnt.
      </div>
      <div class="kitchen-stats">
        <span>⭐ Score: <span id="kitchen-score">0</span></span>
        <span>🍪 Perfect: <span id="kitchen-perfect">0</span></span>
        <span>🔥 Burnt: <span id="kitchen-burnt">0</span></span>
      </div>
      <div class="kitchen-ovens" id="kitchen-ovens">${ovensHtml}</div>
      <div class="mini-timer-bar"><div class="mini-timer-fill" id="kitchen-timer"></div></div>
      <div class="mini-result" id="kitchen-result"></div>
    </div>
  `);
  if (!overlay) return;

  let score = 0;
  let perfectCount = 0;
  let burntCount = 0;
  let active = true;
  let currentPerfectStreak = 0; // Track consecutive perfect cookies
  const ovens = [];

  // Start main timer
  requestAnimationFrame(() => {
    const bar = document.getElementById("kitchen-timer");
    if (bar) { bar.style.transition = `width ${durationSec}s linear`; bar.style.width = "0%"; }
  });

  const updateStats = () => {
    const scoreEl = document.getElementById('kitchen-score');
    const perfectEl = document.getElementById('kitchen-perfect');
    const burntEl = document.getElementById('kitchen-burnt');
    if (scoreEl) scoreEl.textContent = score;
    if (perfectEl) perfectEl.textContent = perfectCount;
    if (burntEl) burntEl.textContent = burntCount;
  };

  const startCookieInOven = (ovenIdx) => {
    if (!active) return;
    
    const oven = document.getElementById(`oven-${ovenIdx}`);
    if (!oven || oven.dataset.state !== 'empty') return;

    const bakeTime = cfg.bakeTimeMin + Math.random() * (cfg.bakeTimeMax - cfg.bakeTimeMin);
    const display = oven.querySelector('.oven-display');
    const status = oven.querySelector('.oven-status');
    const timerBar = document.getElementById(`oven-timer-${ovenIdx}`);

    oven.dataset.state = 'baking';
    oven.dataset.startTime = Date.now();
    oven.dataset.bakeTime = bakeTime;
    this.game.soundManager.kitchenOvenOn();
    if (display) display.textContent = '🫓'; // Raw dough
    if (status) status.textContent = 'Baking...';
    oven.classList.add('oven-baking');
    oven.classList.remove('oven-empty', 'oven-ready', 'oven-burnt');

    // Animate timer bar
    if (timerBar) {
      timerBar.style.transition = 'none';
      timerBar.style.width = '100%';
      timerBar.style.background = 'linear-gradient(90deg, #ffd700, #ff8c00)';
      requestAnimationFrame(() => {
        timerBar.style.transition = `width ${bakeTime}ms linear`;
        timerBar.style.width = '0%';
      });
    }

    // Cookie becomes golden
    setTimeout(() => {
      if (!active || oven.dataset.state !== 'baking') return;
      oven.dataset.state = 'ready';
      this.game.soundManager.kitchenCookieReady();
      if (display) display.textContent = '🍪';
      if (status) status.textContent = 'READY!';
      oven.classList.remove('oven-baking');
      oven.classList.add('oven-ready');
      if (timerBar) timerBar.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
    }, bakeTime);

    // Cookie burns if not clicked
    setTimeout(() => {
      if (!active || oven.dataset.state !== 'ready') return;
      oven.dataset.state = 'burnt';
      this.game.soundManager.kitchenBurnt();
      if (display) display.textContent = '💨';
      if (status) status.textContent = 'Burnt!';
      oven.classList.remove('oven-ready');
      oven.classList.add('oven-burnt');
      if (timerBar) timerBar.style.background = '#666';
      score += cfg.burntPoints;
      burntCount++;
      updateStats();

      // Reset oven after a moment
      setTimeout(() => {
        if (!active) return;
        resetOven(ovenIdx);
        // Start new cookie after delay
        setTimeout(() => startCookieInOven(ovenIdx), 500 + Math.random() * 1000);
      }, 800);
    }, bakeTime + cfg.burnWindowMs);

    ovens[ovenIdx] = { bakeTime, startTime: Date.now() };
  };

  const resetOven = (ovenIdx) => {
    const oven = document.getElementById(`oven-${ovenIdx}`);
    if (!oven) return;
    
    const display = oven.querySelector('.oven-display');
    const status = oven.querySelector('.oven-status');
    const timerBar = document.getElementById(`oven-timer-${ovenIdx}`);

    oven.dataset.state = 'empty';
    if (display) display.textContent = '🔲';
    if (status) status.textContent = 'Empty';
    oven.classList.remove('oven-baking', 'oven-ready', 'oven-burnt');
    oven.classList.add('oven-empty');
    if (timerBar) {
      timerBar.style.transition = 'none';
      timerBar.style.width = '0%';
    }
  };

  const clickOven = (ovenIdx) => {
    if (!active) return;
    
    const oven = document.getElementById(`oven-${ovenIdx}`);
    if (!oven) return;

    const state = oven.dataset.state;
    const display = oven.querySelector('.oven-display');
    const status = oven.querySelector('.oven-status');

    if (state === 'baking') {
      // Too early — raw cookie
      const elapsed = Date.now() - parseInt(oven.dataset.startTime);
      const bakeTime = parseFloat(oven.dataset.bakeTime);
      const remaining = bakeTime - elapsed;

      if (remaining <= cfg.goodWindowMs) {
        // Close enough — good
        this.game.soundManager.kitchenGood();
        score += cfg.goodPoints;
        if (display) display.textContent = '✨';
        if (status) status.textContent = `+${cfg.goodPoints} Good!`;
      } else {
        // Too early — raw
        this.game.soundManager.kitchenRaw();
        score += cfg.rawPoints;
        if (display) display.textContent = '🫓';
        if (status) status.textContent = 'Too early!';
      }
      oven.dataset.state = 'clicked';
      oven.classList.remove('oven-baking');
      updateStats();

      setTimeout(() => {
        if (!active) return;
        resetOven(ovenIdx);
        setTimeout(() => startCookieInOven(ovenIdx), cfg.cookieSpawnIntervalMin + Math.random() * (cfg.cookieSpawnIntervalMax - cfg.cookieSpawnIntervalMin));
      }, 600);

    } else if (state === 'ready') {
      // Perfect timing!
      const elapsed = Date.now() - parseInt(oven.dataset.startTime);
      const bakeTime = parseFloat(oven.dataset.bakeTime);
      const timeSinceReady = elapsed - bakeTime;

      if (timeSinceReady <= cfg.perfectWindowMs) {
        this.game.soundManager.kitchenPerfect();
        score += cfg.perfectPoints;
        perfectCount++;
        currentPerfectStreak++;
        // Track best streak for achievement
        if (currentPerfectStreak > (this.game.stats.kitchenBestStreak || 0)) {
          this.game.stats.kitchenBestStreak = currentPerfectStreak;
        }
        if (display) display.textContent = '⭐';
        if (status) status.textContent = `+${cfg.perfectPoints} PERFECT!`;
      } else {
        this.game.soundManager.kitchenGood();
        score += cfg.goodPoints;
        currentPerfectStreak = 0; // Break the streak
        if (display) display.textContent = '✨';
        if (status) status.textContent = `+${cfg.goodPoints} Good!`;
      }
      oven.dataset.state = 'clicked';
      oven.classList.remove('oven-ready');
      updateStats();

      setTimeout(() => {
        if (!active) return;
        resetOven(ovenIdx);
        setTimeout(() => startCookieInOven(ovenIdx), cfg.cookieSpawnIntervalMin + Math.random() * (cfg.cookieSpawnIntervalMax - cfg.cookieSpawnIntervalMin));
      }, 600);
    }
  };

  // Set up click handlers
  for (let i = 0; i < cfg.ovenCount; i++) {
    const oven = document.getElementById(`oven-${i}`);
    if (oven) {
      oven.addEventListener('click', (e) => {
        e.stopPropagation();
        clickOven(i);
      });
    }
  }

  // Start cookies in ovens with staggered timing
  for (let i = 0; i < cfg.ovenCount; i++) {
    setTimeout(() => startCookieInOven(i), i * 600 + Math.random() * 400);
  }

  // Game end
  const kitchenEndTimer = setTimeout(() => {
    if (active) {
      active = false;
      this._finishGrandmasKitchen(score, perfectCount, burntCount, cfg);
    }
  }, cfg.durationMs);
  this._activeCleanup = () => { active = false; clearTimeout(kitchenEndTimer); };
},

_finishGrandmasKitchen(score, perfectCount, burntCount, cfg) {
  const resultEl = document.getElementById('kitchen-result');
  let tier = null;
  let msg = '';

  if (score >= cfg.legendaryThreshold) {
    tier = 'legendary';
    msg = '🏆 LEGENDARY! Master baker!';
  } else if (score >= cfg.epicThreshold) {
    tier = 'epic';
    msg = '⭐ EPIC! Grandma is proud!';
  } else if (score >= cfg.greatThreshold) {
    tier = 'great';
    msg = '👵 Great baking!';
  } else if (score >= cfg.normalThreshold) {
    tier = 'normal';
    msg = '🍪 Not bad, baker!';
  } else {
    msg = `😅 ${burntCount > 0 ? 'Too many burnt cookies!' : 'Keep practicing!'}`;
  }

  if (tier) {
    const r = this._giveReward(tier, 'grandmasKitchen');
    if (resultEl) {
      resultEl.textContent = `${msg} +${formatNumberInWords(r)} cookies!`;
      resultEl.classList.add('mini-win');
    }
  } else {
    if (resultEl) resultEl.textContent = msg;
  }

  setTimeout(() => this._close(), cfg.resultDisplayMs);
}

};
