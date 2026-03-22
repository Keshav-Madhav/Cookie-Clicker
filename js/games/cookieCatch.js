import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** CookieCatch mixin */
export const CookieCatchMixin = {
/* ════════════════════════════════════════════════════════════
   🍪  COOKIE CATCH  — bigger area, fixed spawn grid
   ════════════════════════════════════════════════════════════ */
_cookieCatch() {
  const cfg = MINI_GAME_SETTINGS.cookieCatch;
  const durationSec = cfg.durationMs / 1000;
  const overlay = this._show(`
    <div class="mini-game-card mini-catch-area" id="catch-area">
      <div class="mini-title">🍪 Cookie Catch! ${durationSec} seconds!</div>
      <div class="mini-big-number" id="catch-count">0</div>
      <div class="catch-zone" id="catch-zone"></div>
      <div class="mini-timer-bar"><div class="mini-timer-fill" id="catch-timer"></div></div>
    </div>
  `);
  if (!overlay) return;

  const zone = document.getElementById("catch-zone");
  if (!zone) return;
  let score = 0;
  let active = true;

  // Fixed spawn positions — a 4x3 grid of slots
  const spawnSlots = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      spawnSlots.push({
        left: 8 + col * 23,   // percentage
        top: 5 + row * 32,    // percentage
      });
    }
  }

  const spawnCookie = () => {
    if (!active) return;
    const slot = spawnSlots[Math.floor(Math.random() * spawnSlots.length)];
    const cookie = document.createElement("span");
    cookie.className = "mini-falling-cookie";
    // Vary emoji for fun
    const emojis = cfg.emojis;
    cookie.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    cookie.style.left = slot.left + "%";
    cookie.style.top = slot.top + "%";
    cookie.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!active) return;
      score++;
      this.game.soundManager.catchCookieCaught();
      const el = document.getElementById("catch-count");
      if (el) el.textContent = score;
      cookie.textContent = "✨";
      cookie.classList.add("mini-caught");
      setTimeout(() => cookie.remove(), 200);
    });
    zone.appendChild(cookie);
    this.game.soundManager.catchCookieSpawn();
    setTimeout(() => { if (cookie.parentNode) { this.game.soundManager.catchCookieMissed(); cookie.remove(); } }, cfg.cookieLifetimeMs);
    if (active) setTimeout(spawnCookie, cfg.spawnIntervalMinMs + Math.random() * cfg.spawnIntervalRangeMs);
  };

  spawnCookie();
  requestAnimationFrame(() => {
    const bar = document.getElementById("catch-timer");
    if (bar) { bar.style.transition = `width ${durationSec}s linear`; bar.style.width = "0%"; }
  });

  const catchEndTimer = setTimeout(() => {
    active = false;
    const el = document.getElementById("catch-count");
    if (el) el.classList.add("mini-win");
    const title = document.getElementById("catch-area")?.querySelector(".mini-title");
    let tier = null;
    if (score >= cfg.greatThreshold) { if (title) title.textContent = `${score} caught! Cookie ninja!`; tier = "great"; }
    else if (score >= cfg.normalThreshold) { if (title) title.textContent = `${score} caught! Quick hands!`; tier = "normal"; }
    else { if (title) title.textContent = `${score} caught. They're fast!`; }

    if (tier) {
      const r = this._giveReward(tier, "catch");
      if (title) title.textContent += ` +${formatNumberInWords(r)}!`;
    }
    setTimeout(() => this._close(), cfg.resultDisplayMs);
  }, cfg.durationMs);
  this._activeCleanup = () => { active = false; clearTimeout(catchEndTimer); };
}

};
