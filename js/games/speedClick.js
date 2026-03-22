import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** SpeedClick mixin */
export const SpeedClickMixin = {
/* ════════════════════════════════════════════════════════════
   ⚡  SPEED CLICK  — 3-2-1-GO countdown, then 5 seconds
   ════════════════════════════════════════════════════════════ */
_speedClick() {
  const cfg = MINI_GAME_SETTINGS.speedClick;
  const overlay = this._show(`
    <div class="mini-game-card mini-clickable" id="speed-card">
      <div class="mini-title">⚡ Speed Click!</div>
      <div class="mini-big-number" id="speed-count">3</div>
      <div class="mini-sub" id="speed-sub">Get ready...</div>
      <div class="mini-timer-bar"><div class="mini-timer-fill" id="speed-timer"></div></div>
    </div>
  `);
  if (!overlay) return;

  let clicks = 0;
  let active = false;
  const countEl = document.getElementById("speed-count");
  const subEl = document.getElementById("speed-sub");

  // Countdown: 3-2-1-GO
  let countdown = 3;
  let gameEndTimer = null;
  const cdInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      if (countEl) countEl.textContent = countdown;
      this.game.soundManager.speedCountdownTick();
    } else {
      clearInterval(cdInterval);
      if (countEl) { countEl.textContent = "0"; countEl.classList.add("speed-go"); }
      if (subEl) subEl.textContent = "GO! Click anywhere in this box!";
      this.game.soundManager.speedGo();
      active = true;

      // Start timer bar
      requestAnimationFrame(() => {
        const bar = document.getElementById("speed-timer");
        if (bar) { bar.style.transition = `width ${cfg.durationMs / 1000}s linear`; bar.style.width = "0%"; }
        if (countEl) countEl.classList.remove("speed-go");
      });

      // End after duration
      gameEndTimer = setTimeout(() => {
        active = false;
        this.game.soundManager.speedEnd();
        if (countEl) countEl.classList.add("mini-win");
        let msg, tier = null;
        if (clicks >= cfg.greatThreshold) { msg = `${clicks} clicks! Inhuman speed!`; tier = "epic"; }
        else if (clicks >= cfg.normalThreshold) { msg = `${clicks} clicks! Impressive!`; tier = "great"; }
        else if (clicks >= cfg.minThreshold) { msg = `${clicks} clicks! Not bad!`; tier = "normal"; }
        else { msg = `${clicks} clicks. Keep practicing!`; }
        if (subEl) subEl.textContent = msg;

        if (tier) {
          const r = this._giveReward(tier, "speed");
          if (subEl) subEl.textContent += ` +${formatNumberInWords(r)} cookies!`;
        }
        setTimeout(() => this._close(), cfg.resultDisplayMs);
      }, cfg.durationMs);
    }
  }, 1000);

  // Click handler on card
  const card = document.getElementById("speed-card");
  if (card) {
    card.addEventListener("click", () => {
      if (!active) return;
      clicks++;
      this.game.soundManager.speedTap();
      if (countEl) countEl.textContent = clicks;
    });
  }
  this._activeCleanup = () => { clearInterval(cdInterval); if (gameEndTimer) clearTimeout(gameEndTimer); active = false; };
}

};
