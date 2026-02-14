import { formatNumberInWords } from "./utils.js";
import {
  MINI_GAME_REWARDS, MINI_GAME_SETTINGS, TRIVIA_QUESTIONS
} from "./config.js";

/**
 * MiniGames — five fun micro-games launched from the news ticker 🎲
 * Purely for entertainment + a cookie reward on success.
 */
export class MiniGames {
  constructor(game) {
    this.game = game;
    this._active = false;
  }

  init() {
    const btn = document.getElementById("news-play");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this._active) return;

      const games = [
        () => this._slotMachine(),
        () => this._speedClick(),
        () => this._cookieCatch(),
        () => this._trivia(),
        () => this._emojiMemory(),
      ];
      games[Math.floor(Math.random() * games.length)]();

      btn.classList.add("dice-spin");
      setTimeout(() => btn.classList.remove("dice-spin"), 600);
    });
  }

  /* ─── reward helper — dynamic scaling ─── */
  _giveReward(tier = "normal", gameName = "") {
    const g = this.game;
    const cps = g.getEffectiveCPS();
    const clicks = g.stats.totalClicks;
    const buildings = g.getTotalBuildingCount();
    const prestige = g.prestige.heavenlyChips || 0;

    // Base reward from CPS
    const cpsBonus = cps * (MINI_GAME_REWARDS.cpsMultiplier[tier] || MINI_GAME_REWARDS.cpsMultiplier.normal);

    // Percentage of current cookies
    const cookiePercent = MINI_GAME_REWARDS.cookiePercent[tier] || MINI_GAME_REWARDS.cookiePercent.normal;
    const cookieBonus = g.cookies * cookiePercent;

    // Click dedication bonus — scales with how much the player clicks
    const clickMult = MINI_GAME_REWARDS.clickMultiplier[tier] || MINI_GAME_REWARDS.clickMultiplier.normal;
    const clickBonus = Math.sqrt(clicks) * clickMult;

    // Empire bonus — more buildings = bigger payoff
    const empireMult = MINI_GAME_REWARDS.empireMultiplier[tier] || MINI_GAME_REWARDS.empireMultiplier.normal;
    const empireBonus = buildings * empireMult;

    // Prestige bonus
    const prestMult = MINI_GAME_REWARDS.prestigeMultiplier[tier] || MINI_GAME_REWARDS.prestigeMultiplier.normal;
    const prestigeBonus = prestige * prestMult;

    // Minimum floor
    const floor = MINI_GAME_REWARDS.floor[tier] || MINI_GAME_REWARDS.floor.normal;

    let reward = Math.max(cpsBonus + cookieBonus + clickBonus + empireBonus + prestigeBonus, floor);
    // Apply mini-game bonus upgrade multiplier
    reward *= (g.miniGameBonus || 1);
    reward = Math.floor(reward);

    g.cookies += reward;
    g.stats.totalCookiesBaked += reward;
    g.updateCookieCount();
    // Income-proportional cookie rain
    if (g.visualEffects) g.visualEffects.triggerIncomeRain(reward);

    // Track mini-game win for achievements
    if (gameName && g.stats.miniGamesWon) {
      if (!g.stats.miniGamesWon.includes(gameName)) {
        g.stats.miniGamesWon.push(gameName);
      }
      g.achievementManager.check();
    }

    return reward;
  }

  /* ─── overlay helpers ─── */
  _show(html) {
    const overlay = document.getElementById("mini-game-overlay");
    if (!overlay) return null;
    this._active = true;
    overlay.innerHTML = html;
    overlay.classList.remove("hidden");
    overlay.classList.add("mini-game-enter");
    setTimeout(() => overlay.classList.remove("mini-game-enter"), 400);
    return overlay;
  }

  _close() {
    const overlay = document.getElementById("mini-game-overlay");
    if (!overlay) return;
    overlay.classList.add("mini-game-exit");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("mini-game-exit");
      overlay.innerHTML = "";
      this._active = false;
    }, 300);
  }

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
      }, cfg.spinIntervalMs);

      cfg.reelStopDelays.forEach((delay, i) => {
        setTimeout(() => {
          const r = document.getElementById(`reel-${i}`);
          if (r) {
            r.textContent = results[i];
            r.dataset.stopped = "true";
            r.classList.add("slot-stop");
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
          const r = this._giveReward("jackpot", "slots");
          totalReward += r;
          resultEl.textContent = `✨ JACKPOT! Three ${results[0]}! +${formatNumberInWords(r)} cookies!`;
          resultEl.classList.add("mini-win");
          won = true;
          // Jackpot always ends
          setTimeout(() => this._close(), 2500);
          return;
        } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
          const r = this._giveReward("normal", "slots");
          totalReward += r;
          resultEl.textContent = `A pair! +${formatNumberInWords(r)} cookies!`;
          resultEl.classList.add("mini-win");
          won = true;
        } else {
          const quips = ["No match!", "The slots are cold today.", "Almost!", "Try again?"];
          resultEl.textContent = quips[Math.floor(Math.random() * quips.length)];
        }

        // Show spin-again button or close
        if (spinsLeft > 0 && actionsEl) {
          const btn = document.createElement("button");
          btn.className = "mini-action-btn";
          btn.textContent = `🎰 Spin Again (${spinsLeft} left)`;
          btn.addEventListener("click", (e) => { e.stopPropagation(); doSpin(); });
          actionsEl.appendChild(btn);

          const closeBtn = document.createElement("button");
          closeBtn.className = "mini-action-btn mini-action-secondary";
          closeBtn.textContent = totalReward > 0 ? `Cash out (+${formatNumberInWords(totalReward)})` : "Leave";
          closeBtn.addEventListener("click", (e) => { e.stopPropagation(); this._close(); });
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
    const cdInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        if (countEl) countEl.textContent = countdown;
      } else {
        clearInterval(cdInterval);
        if (countEl) { countEl.textContent = "0"; countEl.classList.add("speed-go"); }
        if (subEl) subEl.textContent = "GO! Click anywhere in this box!";
        active = true;

        // Start timer bar
        requestAnimationFrame(() => {
          const bar = document.getElementById("speed-timer");
          if (bar) { bar.style.transition = `width ${cfg.durationMs / 1000}s linear`; bar.style.width = "0%"; }
          if (countEl) countEl.classList.remove("speed-go");
        });

        // End after duration
        setTimeout(() => {
          active = false;
          if (countEl) countEl.classList.add("mini-win");
          let msg, tier = null;
          if (clicks >= cfg.greatThreshold) { msg = `${clicks} clicks! Inhuman speed!`; tier = "great"; }
          else if (clicks >= cfg.normalThreshold) { msg = `${clicks} clicks! Impressive!`; tier = "normal"; }
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
        if (countEl) countEl.textContent = clicks;
      });
    }
  }

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
        const el = document.getElementById("catch-count");
        if (el) el.textContent = score;
        cookie.textContent = "✨";
        cookie.classList.add("mini-caught");
        setTimeout(() => cookie.remove(), 200);
      });
      zone.appendChild(cookie);
      setTimeout(() => { if (cookie.parentNode) cookie.remove(); }, cfg.cookieLifetimeMs);
      if (active) setTimeout(spawnCookie, cfg.spawnIntervalMinMs + Math.random() * cfg.spawnIntervalRangeMs);
    };

    spawnCookie();
    requestAnimationFrame(() => {
      const bar = document.getElementById("catch-timer");
      if (bar) { bar.style.transition = `width ${durationSec}s linear`; bar.style.width = "0%"; }
    });

    setTimeout(() => {
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
  }

  /* ════════════════════════════════════════════════════════════
     🧠  TRIVIA  — expanded questions, shuffled options
     ════════════════════════════════════════════════════════════ */
  _trivia() {
    const cfg = MINI_GAME_SETTINGS.trivia;
    const questions = TRIVIA_QUESTIONS;

    const trivia = questions[Math.floor(Math.random() * questions.length)];
    const correctAnswer = trivia.a[trivia.correct];

    // Fisher-Yates shuffle for proper randomization
    const shuffled = [...trivia.a];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const correctIdx = shuffled.indexOf(correctAnswer);

    const btnsHtml = shuffled.map((a, i) =>
      `<button class="trivia-btn" data-idx="${i}">${a}</button>`
    ).join("");

    const overlay = this._show(`
      <div class="mini-game-card">
        <div class="mini-title">🧠 Cookie Trivia</div>
        <div class="trivia-question">${trivia.q}</div>
        <div class="trivia-answers">${btnsHtml}</div>
        <div class="mini-result" id="trivia-result"></div>
      </div>
    `);
    if (!overlay) return;

    let answered = false;
    let autoCloseTimer = null;

    overlay.querySelectorAll(".trivia-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (answered) return;
        answered = true;
        if (autoCloseTimer) clearTimeout(autoCloseTimer);
        const idx = parseInt(btn.dataset.idx);
        const resultEl = document.getElementById("trivia-result");

        overlay.querySelectorAll(".trivia-btn").forEach((b, i) => {
          if (i === correctIdx) b.classList.add("trivia-correct");
          else b.classList.add("trivia-wrong");
          b.disabled = true;
        });

        if (idx === correctIdx) {
          const r = this._giveReward("normal", "trivia");
          if (resultEl) {
            resultEl.textContent = `✅ Correct! +${formatNumberInWords(r)} cookies!`;
            resultEl.classList.add("mini-win");
          }
        } else {
          if (resultEl) resultEl.textContent = `❌ Nope! It's ${correctAnswer}.`;
        }
        setTimeout(() => this._close(), cfg.resultDisplayMs);
      });
    });

    autoCloseTimer = setTimeout(() => {
      if (!answered) {
        answered = true;
        const resultEl = document.getElementById("trivia-result");
        if (resultEl) resultEl.textContent = "⏰ Time's up!";
        overlay.querySelectorAll(".trivia-btn").forEach((b, i) => {
          if (i === correctIdx) b.classList.add("trivia-correct");
          else b.classList.add("trivia-wrong");
          b.disabled = true;
        });
        setTimeout(() => this._close(), cfg.timeUpDisplayMs);
      }
    }, cfg.autoCloseMs);
  }

  /* ════════════════════════════════════════════════════════════
     🧠  EMOJI MEMORY  — 5 pairs (10 cards)
     ════════════════════════════════════════════════════════════ */
  _emojiMemory() {
    const cfg = MINI_GAME_SETTINGS.emojiMemory;
    const pool = [...cfg.emojiPool];
    // Fisher-Yates to pick pairs
    const shuffledPool = [...pool];
    for (let i = shuffledPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }
    const chosen = shuffledPool.slice(0, cfg.totalPairs);
    const cards = [...chosen, ...chosen];
    // Shuffle cards
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    let flipped = [];
    let matched = 0;
    let checking = false;
    let moves = 0;
    const totalPairs = cfg.totalPairs;

    const cardsHtml = cards.map((_, i) =>
      `<div class="memory-card" data-idx="${i}">❓</div>`
    ).join("");

    const overlay = this._show(`
      <div class="mini-game-card mini-memory-card">
        <div class="mini-title">🧠 Memory Match! <span class="mini-sub" id="memory-moves">0 moves</span></div>
        <div class="memory-grid memory-grid-5">${cardsHtml}</div>
        <div class="mini-result" id="memory-result"></div>
      </div>
    `);
    if (!overlay) return;

    overlay.querySelectorAll(".memory-card").forEach(card => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(card.dataset.idx);
        if (checking || card.classList.contains("memory-flipped") || card.classList.contains("memory-matched")) return;

        card.textContent = cards[idx];
        card.classList.add("memory-flipped");
        flipped.push({ idx, card });

        if (flipped.length === 2) {
          checking = true;
          moves++;
          const movesEl = document.getElementById("memory-moves");
          if (movesEl) movesEl.textContent = `${moves} moves`;

          const [a, b] = flipped;
          if (cards[a.idx] === cards[b.idx]) {
            a.card.classList.add("memory-matched");
            b.card.classList.add("memory-matched");
            matched++;
            flipped = [];
            checking = false;
            if (matched === totalPairs) {
              const res = document.getElementById("memory-result");
              let tier = moves <= cfg.greatMovesThreshold ? "great" : "normal";
              const r = this._giveReward(tier, "memory");
              if (res) {
                const ratingMsg = moves <= cfg.greatMovesThreshold ? "🎉 Incredible memory!" : moves <= 12 ? "🎉 Well done!" : "🎉 All matched!";
                res.textContent = `${ratingMsg} +${formatNumberInWords(r)} cookies!`;
                res.classList.add("mini-win");
              }
              setTimeout(() => this._close(), cfg.resultDisplayMs);
            }
          } else {
            setTimeout(() => {
              a.card.textContent = "❓";
              b.card.textContent = "❓";
              a.card.classList.remove("memory-flipped");
              b.card.classList.remove("memory-flipped");
              flipped = [];
              checking = false;
            }, cfg.mismatchDelayMs);
          }
        }
      });
    });

    // Auto-close after 25 seconds
    setTimeout(() => {
      if (matched < totalPairs) {
        const res = document.getElementById("memory-result");
        if (res) res.textContent = `⏰ Time's up! Found ${matched}/${totalPairs} pairs.`;
        if (matched >= cfg.partialRewardMinPairs) {
          const r = this._giveReward("normal", "memory");
          if (res) res.textContent += ` +${formatNumberInWords(r)}!`;
        }
        setTimeout(() => this._close(), cfg.timeUpDisplayMs);
      }
    }, cfg.autoCloseMs);
  }
}
