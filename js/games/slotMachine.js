import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** SlotMachine mixin */
export const SlotMachineMixin = {
/* ════════════════════════════════════════════════════════════
   🎰  SLOT MACHINE  — up to 3 spins per session
   ════════════════════════════════════════════════════════════ */
_slotMachine() {
  const cfg = MINI_GAME_SETTINGS.slots;
  const symbols = cfg.symbols;
  const pick = () => symbols[Math.floor(Math.random() * symbols.length)];
  let spinsLeft = cfg.maxSpins;
  let totalReward = 0;

  const doSpin = () => {
    spinsLeft--;

    // Update the card content
    const overlay = document.getElementById("mini-game-overlay");
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="mini-game-card">
        <div class="mini-title">🎰 Cookie Slots <span class="mini-sub">(${spinsLeft + 1}/${cfg.maxSpins} spins)</span></div>
        <div class="slot-reels">
          <span class="slot-reel" id="reel-0">❓</span>
          <span class="slot-reel" id="reel-1">❓</span>
          <span class="slot-reel" id="reel-2">❓</span>
        </div>
        <div class="mini-result" id="slot-result">Spinning...</div>
        <div id="slot-actions"></div>
      </div>
    `;

    const results = [pick(), pick(), pick()];
    const spinInterval = setInterval(() => {
      for (let i = 0; i < 3; i++) {
        const r = document.getElementById(`reel-${i}`);
        if (r && !r.dataset.stopped) r.textContent = pick();
      }
      this.game.soundManager.slotReelTick();
    }, cfg.spinIntervalMs);

    cfg.reelStopDelays.forEach((delay, i) => {
      setTimeout(() => {
        const r = document.getElementById(`reel-${i}`);
        if (r) {
          r.textContent = results[i];
          r.dataset.stopped = "true";
          r.classList.add("slot-stop");
          this.game.soundManager.slotReelStop();
        }
      }, delay);
    });

    setTimeout(() => {
      clearInterval(spinInterval);
      const resultEl = document.getElementById("slot-result");
      const actionsEl = document.getElementById("slot-actions");
      if (!resultEl) return;

      let won = false;
      if (results[0] === results[1] && results[1] === results[2]) {
        this.game.soundManager.slotJackpot();
        const r = this._giveReward("legendary", "slots");
        totalReward += r;
        resultEl.innerHTML = `<span class="jackpot-text">🎉 JACKPOT! 🎉</span><br>Three ${results[0]}! +${formatNumberInWords(r)} cookies!`;
        resultEl.classList.add("mini-win", "jackpot-win");
        won = true;

        // Massive visual celebration
        if (this.game.visualEffects) {
          this.game.visualEffects.triggerCookieBurst(80, 3);
          this.game.visualEffects.showStageTransitionText(`🎰 JACKPOT! +${formatNumberInWords(r)} 🎰`);
        }
        // Screen shake effect
        const card = overlay.querySelector('.mini-game-card');
        if (card) card.classList.add('jackpot-shake');

        // Track jackpots for achievement
        this.game.stats.slotsJackpots = (this.game.stats.slotsJackpots || 0) + 1;
        this.game.achievementManager.check();
        // Jackpot always ends (longer display for celebration)
        setTimeout(() => this._close(), 4000);
        return;
      } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
        this.game.soundManager.slotPairWin();
        const r = this._giveReward("normal", "slots");
        totalReward += r;
        resultEl.textContent = `A pair! +${formatNumberInWords(r)} cookies!`;
        resultEl.classList.add("mini-win");
        won = true;
      } else {
        this.game.soundManager.slotLoss();
        const quips = ["No match!", "The slots are cold today.", "Almost!", "Try again?"];
        resultEl.textContent = quips[Math.floor(Math.random() * quips.length)];
      }

      // Show spin-again button or close
      if (spinsLeft > 0 && actionsEl) {
        const btn = document.createElement("button");
        btn.className = "mini-action-btn";
        btn.textContent = `🎰 Spin Again (${spinsLeft} left)`;
        btn.addEventListener("click", (e) => { e.stopPropagation(); this.game.soundManager.slotSpinAgain(); doSpin(); });
        actionsEl.appendChild(btn);

        const closeBtn = document.createElement("button");
        closeBtn.className = "mini-action-btn mini-action-secondary";
        closeBtn.textContent = totalReward > 0 ? `Cash out (+${formatNumberInWords(totalReward)})` : "Leave";
        closeBtn.addEventListener("click", (e) => { e.stopPropagation(); this.game.soundManager.slotCashOut(); this._close(); });
        actionsEl.appendChild(closeBtn);
      } else {
        if (totalReward > 0) {
          resultEl.textContent += ` Total: +${formatNumberInWords(totalReward)}`;
        }
        setTimeout(() => this._close(), 2500);
      }
    }, 2200);
  };

  this._show("");
  doSpin();
}

};
