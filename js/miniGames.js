import { formatNumberInWords } from "./utils.js";
import {
  MINI_GAME_REWARDS, MINI_GAME_SETTINGS, TRIVIA_QUESTIONS, MATH_OPERATIONS
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
      this.game.soundManager.newsPlayDice();

      const games = [
        () => this._slotMachine(),
        () => this._speedClick(),
        () => this._cookieCatch(),
        () => this._trivia(),
        () => this._emojiMemory(),
        () => this._cookieCutter(),
        () => this._cookieDefense(),
        () => this._grandmasKitchen(),
        () => this._mathBaker(),
        () => this._dungeonCrawl(),
        () => this._safeCracker(),
        () => this._cookieLaunch(),
        () => this._cookieWordle(),
      ];
      games[Math.floor(Math.random() * games.length)]();

      btn.classList.add("dice-spin");
      setTimeout(() => btn.classList.remove("dice-spin"), 600);
    });
  }

  /* ─── reward helper — diminishing-returns scaling ─── */
  _giveReward(tier = "normal", gameName = "") {
    const g = this.game;
    const cps = g.getEffectiveCPS();
    const clicks = g.stats.totalClicks;
    const buildings = g.getTotalBuildingCount();
    const prestige = g.prestige.getSpendableChips() || 0;

    // Raw reward value from game progress (not directly from cookies)
    const cpsMult    = MINI_GAME_REWARDS.cpsMultiplier[tier]      || MINI_GAME_REWARDS.cpsMultiplier.normal;
    const clickMult  = MINI_GAME_REWARDS.clickMultiplier[tier]    || MINI_GAME_REWARDS.clickMultiplier.normal;
    const empireMult = MINI_GAME_REWARDS.empireMultiplier[tier]   || MINI_GAME_REWARDS.empireMultiplier.normal;
    const prestMult  = MINI_GAME_REWARDS.prestigeMultiplier[tier] || MINI_GAME_REWARDS.prestigeMultiplier.normal;

    const raw = cps.toNumber() * cpsMult
              + Math.sqrt(clicks) * clickMult
              + buildings * empireMult
              + prestige * prestMult;

    // Diminishing returns: scaling approaches 1 as raw grows, but never reaches it.
    // reward = cookies × scaling × tierScale — no hard cap, the formula self-limits
    const cookiesNum = Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, g.cookies.toNumber()));
    const scaling = raw / (raw + cookiesNum);
    const tierScale = MINI_GAME_REWARDS.tierScale[tier] || MINI_GAME_REWARDS.tierScale.normal;

    // Minimum floor for early game (when cookies are near zero)
    const floor = MINI_GAME_REWARDS.floor[tier] || MINI_GAME_REWARDS.floor.normal;

    let reward = Math.max(cookiesNum * scaling * tierScale, floor);
    // Apply mini-game bonus upgrade multiplier
    reward *= (g.miniGameBonus || 1);
    reward = Math.floor(reward);

    g.cookies = g.cookies.add(reward);
    g.stats.totalCookiesBaked = g.stats.totalCookiesBaked.add(reward);
    g.updateCookieCount();
    // Income-proportional cookie rain
    if (g.visualEffects) g.visualEffects.triggerIncomeRain(reward);
    g.soundManager.miniGameWin();

    // Track mini-game win for achievements
    if (gameName && g.stats.miniGamesWon) {
      if (!g.stats.miniGamesWon.includes(gameName)) {
        g.stats.miniGamesWon.push(gameName);
      }
    }

    // Track total minigames played
    g.stats.miniGamesPlayed = (g.stats.miniGamesPlayed || 0) + 1;

    // Easter egg: minigame addict (100 games played)
    if (g.stats.miniGamesPlayed === 100 && g.tutorial) {
      g.tutorial.triggerEvent('miniGameAddict');
    }

    g.achievementManager.check();

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
    this.game.soundManager.panelOpen();
    return overlay;
  }

  _close() {
    const overlay = document.getElementById("mini-game-overlay");
    if (!overlay) return;
    this.game.soundManager.panelClose();
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
        setTimeout(() => {
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
    this.game.soundManager.triviaQuestionAppear();

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
          this.game.soundManager.triviaCorrect();
          const r = this._giveReward("great", "trivia");
          if (resultEl) {
            resultEl.textContent = `✅ Correct! +${formatNumberInWords(r)} cookies!`;
            resultEl.classList.add("mini-win");
          }
        } else {
          this.game.soundManager.triviaWrong();
          if (resultEl) resultEl.textContent = `❌ Nope! It's ${correctAnswer}.`;
        }
        setTimeout(() => this._close(), cfg.resultDisplayMs);
      });
    });

    autoCloseTimer = setTimeout(() => {
      if (!answered) {
        answered = true;
        this.game.soundManager.triviaTimeUp();
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
        this.game.soundManager.memoryFlip();
        flipped.push({ idx, card });

        if (flipped.length === 2) {
          checking = true;
          moves++;
          const movesEl = document.getElementById("memory-moves");
          if (movesEl) movesEl.textContent = `${moves} moves`;

          const [a, b] = flipped;
          if (cards[a.idx] === cards[b.idx]) {
            this.game.soundManager.memoryMatch();
            a.card.classList.add("memory-matched");
            b.card.classList.add("memory-matched");
            matched++;
            flipped = [];
            checking = false;
            if (matched === totalPairs) {
              this.game.soundManager.memoryCelebration();
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
            this.game.soundManager.memoryMismatch();
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

  /* ════════════════════════════════════════════════════════════
     ✂️  COOKIE CUTTER  — Drawing/Tracing game!
     Draw over the dashed outline - closer = higher score!
     ════════════════════════════════════════════════════════════ */
  _cookieCutter() {
    const cfg = MINI_GAME_SETTINGS.cookieCutter;
    const durationSec = cfg.durationMs / 1000;
    const size = cfg.canvasSize;
    
    // Pick a random shape
    const shapeName = cfg.shapes[Math.floor(Math.random() * cfg.shapes.length)];

    const overlay = this._show(`
      <div class="mini-game-card mini-cutter-card">
        <div class="mini-title">✂️ Cookie Cutter! <span class="mini-sub">Draw the ${shapeName}!</span></div>
        <div class="cutter-instructions">
          Draw over the dashed line. The closer you trace, the higher your score!
        </div>
        <div class="cutter-stats">
          <span>Accuracy: <span id="cutter-accuracy" class="cutter-accuracy-value">--</span>%</span>
          <span>Coverage: <span id="cutter-coverage">0</span>%</span>
        </div>
        <div class="cutter-canvas-wrap" id="cutter-wrap">
          <canvas id="cutter-canvas" width="${size}" height="${size}"></canvas>
        </div>
        <div class="mini-timer-bar"><div class="mini-timer-fill" id="cutter-timer"></div></div>
        <div class="mini-result" id="cutter-result"></div>
      </div>
    `);
    if (!overlay) return;

    const canvas = document.getElementById('cutter-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Generate path points for the shape
    const pathPoints = this._generateShapePath(shapeName, size, cfg.pathResolution);
    
    let active = true;
    let isDrawing = false;
    let userPath = []; // Store all user drawing points
    let lastPos = null;
    
    // For scoring
    const pointScores = new Array(pathPoints.length).fill(null); // null = not covered, 0-1 = accuracy
    
    // Cookie texture (generate once)
    const texturePoints = [];
    for (let i = 0; i < 30; i++) {
      texturePoints.push({
        x: Math.random() * size,
        y: Math.random() * size,
        r: 2 + Math.random() * 5
      });
    }

    // Draw everything
    const drawAll = () => {
      ctx.clearRect(0, 0, size, size);
      
      // Draw cookie background
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(0, 0, size, size);
      
      // Draw subtle cookie texture
      ctx.fillStyle = 'rgba(139, 90, 43, 0.15)';
      texturePoints.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw the dashed shape outline
      ctx.strokeStyle = '#5a3921';
      ctx.lineWidth = cfg.shapeLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([12, 8]); // Dashed line
      ctx.beginPath();
      ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
      for (let i = 1; i < pathPoints.length; i++) {
        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
      }
      if (!pathPoints._open) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]); // Reset
      
      // Draw user's path with color coding based on accuracy
      if (userPath.length > 1) {
        ctx.lineWidth = cfg.drawLineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        for (let i = 1; i < userPath.length; i++) {
          const prev = userPath[i - 1];
          const curr = userPath[i];
          
          // Color based on accuracy (green = good, yellow = ok, red = bad)
          const accuracy = curr.accuracy;
          let color;
          if (accuracy >= 0.8) {
            color = '#22c55e'; // Green
          } else if (accuracy >= 0.5) {
            color = '#eab308'; // Yellow
          } else if (accuracy >= 0.2) {
            color = '#f97316'; // Orange
          } else {
            color = '#ef4444'; // Red
          }
          
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();
        }
      }
    };

    const updateStats = () => {
      const accuracyEl = document.getElementById('cutter-accuracy');
      const coverageEl = document.getElementById('cutter-coverage');
      
      // Calculate coverage (how many path points have been traced near)
      const coveredPoints = pointScores.filter(s => s !== null).length;
      const coverage = Math.round((coveredPoints / pathPoints.length) * 100);
      if (coverageEl) coverageEl.textContent = coverage;
      
      // Calculate average accuracy of covered points
      const scores = pointScores.filter(s => s !== null);
      if (scores.length > 0) {
        const avgAccuracy = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
        if (accuracyEl) {
          accuracyEl.textContent = avgAccuracy;
          // Color code the accuracy
          if (avgAccuracy >= 75) accuracyEl.style.color = '#22c55e';
          else if (avgAccuracy >= 50) accuracyEl.style.color = '#eab308';
          else accuracyEl.style.color = '#ef4444';
        }
      }
    };

    const getCanvasPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      
      let clientX, clientY;
      if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const scorePoint = (pos) => {
      // Find closest path point and calculate accuracy
      let minDist = Infinity;
      let closestIdx = -1;
      
      for (let i = 0; i < pathPoints.length; i++) {
        const dx = pos.x - pathPoints[i].x;
        const dy = pos.y - pathPoints[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      
      // Calculate accuracy (1 = perfect, 0 = at max distance)
      const accuracy = Math.max(0, 1 - (minDist / cfg.maxScoringDistance));
      
      // Update the score for nearby path points
      for (let i = Math.max(0, closestIdx - 1); i <= Math.min(pathPoints.length - 1, closestIdx + 1); i++) {
        if (pointScores[i] === null || accuracy > pointScores[i]) {
          pointScores[i] = accuracy;
        }
      }
      
      return accuracy;
    };

    const handleMove = (e) => {
      if (!active || !isDrawing) return;
      e.preventDefault();

      const pos = getCanvasPos(e);
      const accuracy = scorePoint(pos);

      userPath.push({ x: pos.x, y: pos.y, accuracy });
      lastPos = pos;
      this.game.soundManager.cutterDrawStroke();

      drawAll();
      updateStats();
    };

    const handleStart = (e) => {
      if (!active) return;
      e.preventDefault();
      
      isDrawing = true;
      const pos = getCanvasPos(e);
      const accuracy = scorePoint(pos);
      userPath.push({ x: pos.x, y: pos.y, accuracy });
      lastPos = pos;
      
      drawAll();
      updateStats();
    };

    const handleEnd = () => {
      isDrawing = false;
      lastPos = null;
    };

    // Event listeners
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', handleEnd);
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd);

    // Initial draw
    drawAll();

    // Start timer
    requestAnimationFrame(() => {
      const bar = document.getElementById("cutter-timer");
      if (bar) { bar.style.transition = `width ${durationSec}s linear`; bar.style.width = "0%"; }
    });

    // Time's up
    setTimeout(() => {
      if (active) {
        active = false;
        this._finishCookieCutter(pointScores, cfg);
      }
    }, cfg.durationMs);
  }

  _generateShapePath(shapeName, size, resolution) {
    const points = [];
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.35;
    
    switch (shapeName) {
      case 'circle':
        for (let i = 0; i < resolution; i++) {
          const angle = (i / resolution) * Math.PI * 2;
          points.push({
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r
          });
        }
        break;
        
      case 'star':
        const starPoints = 5;
        const innerR = r * 0.4;
        for (let i = 0; i < resolution; i++) {
          const angle = (i / resolution) * Math.PI * 2 - Math.PI / 2;
          const pointIndex = (i / resolution) * starPoints * 2;
          const isOuter = Math.floor(pointIndex) % 2 === 0;
          const currentR = isOuter ? r : innerR;
          const nextIsOuter = Math.floor(pointIndex + 1) % 2 === 0;
          const nextR = nextIsOuter ? r : innerR;
          const t = pointIndex % 1;
          const interpR = currentR + (nextR - currentR) * t;
          points.push({
            x: cx + Math.cos(angle) * interpR,
            y: cy + Math.sin(angle) * interpR
          });
        }
        break;
        
      case 'heart':
        for (let i = 0; i < resolution; i++) {
          const t = (i / resolution) * Math.PI * 2;
          const x = 16 * Math.pow(Math.sin(t), 3);
          const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
          points.push({
            x: cx + x * (r / 17),
            y: cy + y * (r / 17)
          });
        }
        break;
        
      case 'umbrella': {
        // Dome arc (top half semicircle, from left to right)
        const domeY = cy - r * 0.15;
        for (let i = 0; i <= resolution * 0.5; i++) {
          const angle = Math.PI + (i / (resolution * 0.5)) * Math.PI;
          points.push({
            x: cx + Math.cos(angle) * r,
            y: domeY + Math.sin(angle) * r * 0.7
          });
        }
        // Handle (straight line down from center of dome)
        const umbHandleTop = domeY;
        const umbHandleBottom = cy + r * 0.85;
        for (let i = 0; i <= resolution * 0.3; i++) {
          const t = i / (resolution * 0.3);
          points.push({
            x: cx,
            y: umbHandleTop + t * (umbHandleBottom - umbHandleTop)
          });
        }
        // Hook curve at bottom
        for (let i = 0; i <= resolution * 0.2; i++) {
          const angle = -Math.PI / 2 + (i / (resolution * 0.2)) * Math.PI;
          points.push({
            x: cx - r * 0.15 + Math.cos(angle) * r * 0.15,
            y: umbHandleBottom + Math.sin(angle) * r * 0.15
          });
        }
        // Mark as open shape (no closePath)
        points._open = true;
        break;
      }
        
      case 'triangle':
        const triPoints = [
          { x: cx, y: cy - r },
          { x: cx + r * 0.87, y: cy + r * 0.5 },
          { x: cx - r * 0.87, y: cy + r * 0.5 }
        ];
        const perSide = Math.floor(resolution / 3);
        for (let side = 0; side < 3; side++) {
          const start = triPoints[side];
          const end = triPoints[(side + 1) % 3];
          for (let i = 0; i < perSide; i++) {
            const t = i / perSide;
            points.push({
              x: start.x + (end.x - start.x) * t,
              y: start.y + (end.y - start.y) * t
            });
          }
        }
        break;
        
      case 'diamond':
        const diamondPts = [
          { x: cx, y: cy - r },        // top
          { x: cx + r * 0.7, y: cy },  // right
          { x: cx, y: cy + r },        // bottom
          { x: cx - r * 0.7, y: cy }   // left
        ];
        const perDiamondSide = Math.floor(resolution / 4);
        for (let side = 0; side < 4; side++) {
          const start = diamondPts[side];
          const end = diamondPts[(side + 1) % 4];
          for (let i = 0; i < perDiamondSide; i++) {
            const t = i / perDiamondSide;
            points.push({
              x: start.x + (end.x - start.x) * t,
              y: start.y + (end.y - start.y) * t
            });
          }
        }
        break;
        
      case 'hexagon':
        for (let i = 0; i < resolution; i++) {
          const angle = (i / resolution) * Math.PI * 2 - Math.PI / 2;
          const segment = Math.floor((i / resolution) * 6);
          const segmentAngle = (segment / 6) * Math.PI * 2 - Math.PI / 2;
          const nextSegmentAngle = ((segment + 1) / 6) * Math.PI * 2 - Math.PI / 2;
          const segmentProgress = ((i / resolution) * 6) % 1;
          
          const x1 = cx + Math.cos(segmentAngle) * r;
          const y1 = cy + Math.sin(segmentAngle) * r;
          const x2 = cx + Math.cos(nextSegmentAngle) * r;
          const y2 = cy + Math.sin(nextSegmentAngle) * r;
          
          points.push({
            x: x1 + (x2 - x1) * segmentProgress,
            y: y1 + (y2 - y1) * segmentProgress
          });
        }
        break;
        
      case 'crescent':
        // Outer arc (larger)
        for (let i = 0; i < resolution * 0.7; i++) {
          const angle = Math.PI * 0.2 + (i / (resolution * 0.7)) * Math.PI * 1.6;
          points.push({
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r
          });
        }
        // Inner arc (smaller, offset) going back
        for (let i = 0; i < resolution * 0.3; i++) {
          const angle = Math.PI * 1.8 - (i / (resolution * 0.3)) * Math.PI * 1.6;
          const innerR = r * 0.6;
          const offsetX = r * 0.3;
          points.push({
            x: cx + offsetX + Math.cos(angle) * innerR,
            y: cy + Math.sin(angle) * innerR
          });
        }
        break;
        
      case 'flower':
        const petals = 5;
        const innerFlowerR = r * 0.4;
        for (let i = 0; i < resolution; i++) {
          const angle = (i / resolution) * Math.PI * 2;
          const petalPhase = (angle * petals) % (Math.PI * 2);
          const petalR = innerFlowerR + (r - innerFlowerR) * Math.pow(Math.sin(petalPhase / 2), 2);
          points.push({
            x: cx + Math.cos(angle) * petalR,
            y: cy + Math.sin(angle) * petalR
          });
        }
        break;
        
      case 'cross':
        const armWidth = r * 0.35;
        const crossPts = [
          { x: cx - armWidth, y: cy - r },      // top-left of top arm
          { x: cx + armWidth, y: cy - r },      // top-right of top arm
          { x: cx + armWidth, y: cy - armWidth }, // inner top-right
          { x: cx + r, y: cy - armWidth },      // right arm top
          { x: cx + r, y: cy + armWidth },      // right arm bottom
          { x: cx + armWidth, y: cy + armWidth }, // inner bottom-right
          { x: cx + armWidth, y: cy + r },      // bottom-right of bottom arm
          { x: cx - armWidth, y: cy + r },      // bottom-left of bottom arm
          { x: cx - armWidth, y: cy + armWidth }, // inner bottom-left
          { x: cx - r, y: cy + armWidth },      // left arm bottom
          { x: cx - r, y: cy - armWidth },      // left arm top
          { x: cx - armWidth, y: cy - armWidth }  // inner top-left
        ];
        const perCrossSide = Math.floor(resolution / 12);
        for (let side = 0; side < 12; side++) {
          const start = crossPts[side];
          const end = crossPts[(side + 1) % 12];
          for (let i = 0; i < perCrossSide; i++) {
            const t = i / perCrossSide;
            points.push({
              x: start.x + (end.x - start.x) * t,
              y: start.y + (end.y - start.y) * t
            });
          }
        }
        break;
    }
    
    return points;
  }

  _finishCookieCutter(pointScores, cfg) {
    this.game.soundManager.cutterShapeComplete();
    const resultEl = document.getElementById('cutter-result');
    
    // Calculate final score
    const coveredPoints = pointScores.filter(s => s !== null);
    const coverage = coveredPoints.length / pointScores.length;
    const avgAccuracy = coveredPoints.length > 0 
      ? coveredPoints.reduce((a, b) => a + b, 0) / coveredPoints.length 
      : 0;
    
    // Final score combines coverage and accuracy
    const finalScore = Math.round((coverage * 0.4 + avgAccuracy * 0.6) * 100);
    
    // Track best accuracy for achievement
    if (finalScore > (this.game.stats.cutterBestAccuracy || 0)) {
      this.game.stats.cutterBestAccuracy = finalScore;
    }

    // Easter egg: perfectionist (99% accuracy)
    if (finalScore === 99 && this.game.tutorial) {
      this.game.tutorial.triggerEvent('perfectionist99');
    }

    let tier = null;
    let msg = '';

    if (finalScore >= cfg.legendaryThreshold) {
      tier = 'legendary';
      msg = `🏆 LEGENDARY! ${finalScore}% score!`;
    } else if (finalScore >= cfg.epicThreshold) {
      tier = 'epic';
      msg = `⭐ EPIC! ${finalScore}% score!`;
    } else if (finalScore >= cfg.greatThreshold) {
      tier = 'great';
      msg = `✂️ Great! ${finalScore}% score!`;
    } else if (finalScore >= cfg.normalThreshold) {
      tier = 'normal';
      msg = `🍪 Not bad! ${finalScore}% score`;
    } else {
      msg = `😅 ${finalScore}% - Keep practicing!`;
    }

    if (tier) {
      const r = this._giveReward(tier, 'cookieCutter');
      if (resultEl) {
        resultEl.textContent = `${msg} +${formatNumberInWords(r)} cookies!`;
        resultEl.classList.add('mini-win');
      }
    } else {
      if (resultEl) resultEl.textContent = msg;
    }

    this.game.achievementManager.check();
    setTimeout(() => this._close(), cfg.resultDisplayMs);
  }

  /* ════════════════════════════════════════════════════════════
     🛡️  COOKIE DEFENSE  — Mini Tower Defense!
     Place towers strategically, defend against critters!
     ════════════════════════════════════════════════════════════ */
  _cookieDefense() {
    const cfg = MINI_GAME_SETTINGS.cookieDefense;
    
    // Generate a random path through the grid
    const path = this._generateDefensePath(cfg.gridCols, cfg.gridRows);
    
    // Fixed number of towers allowed
    const towersAllowed = cfg.towersAllowed;
    
    // Build grid HTML
    let gridHtml = '';
    const pathSet = new Set(path.map(p => `${p.x},${p.y}`));
    for (let y = 0; y < cfg.gridRows; y++) {
      for (let x = 0; x < cfg.gridCols; x++) {
        const isPath = pathSet.has(`${x},${y}`);
        const isStart = path[0].x === x && path[0].y === y;
        const isEnd = path[path.length - 1].x === x && path[path.length - 1].y === y;
        let cellClass = 'td-cell';
        if (isPath) cellClass += ' td-path';
        if (isStart) cellClass += ' td-start';
        if (isEnd) cellClass += ' td-end';
        gridHtml += `<div class="${cellClass}" data-x="${x}" data-y="${y}">${isStart ? '🚪' : isEnd ? '🍪' : ''}</div>`;
      }
    }

    // Tower selection buttons with detailed stats
    const towerBtns = cfg.towers.map(t => 
      `<button class="td-tower-btn" data-tower="${t.id}" style="--tower-color: ${t.color}">
        <div class="td-tower-header">
          <span class="td-tower-emoji">${t.emoji}</span>
          <span class="td-tower-name">${t.name}</span>
        </div>
        <div class="td-tower-desc">${t.desc}</div>
        <div class="td-tower-details">${t.details}</div>
      </button>`
    ).join('');

    const overlay = this._show(`
      <div class="mini-game-card mini-td-card">
        <div class="mini-title">🛡️ Cookie Defense!</div>
        <div class="td-phase-indicator" id="td-phase-indicator">
          <span class="td-phase-icon">📋</span>
          <span class="td-phase-text" id="td-phase">PLANNING PHASE</span>
        </div>
        <div class="td-instructions" id="td-instructions">
          <strong>How to play:</strong> Select a tower type below, then click on a <span class="td-highlight">brown cell</span> (not the path) to place it. Click a placed tower to remove it.
        </div>
        <div class="td-stats">
          <span class="td-stat">🍪 <span id="td-lives">${cfg.startingLives}</span></span>
          <span class="td-stat">🗼 <span id="td-towers-left">${towersAllowed}</span></span>
          <span class="td-stat">🐛 <span id="td-enemies">0</span>/${cfg.totalEnemies}</span>
        </div>
        <div class="td-tower-select" id="td-tower-select">${towerBtns}</div>
        <div class="td-grid-wrapper">
          <div class="td-grid" id="td-grid" style="grid-template-columns: repeat(${cfg.gridCols}, 1fr);">${gridHtml}</div>
          <div class="td-projectiles" id="td-projectiles"></div>
        </div>
        <div class="td-controls" id="td-controls">
          <button class="td-start-btn" id="td-start-btn">⚔️ Start Battle!</button>
        </div>
        <div class="mini-timer-bar"><div class="mini-timer-fill" id="td-timer"></div></div>
        <div class="mini-result" id="td-result"></div>
      </div>
    `);
    if (!overlay) return;

    let phase = 'planning';
    let lives = cfg.startingLives;
    let towersLeft = towersAllowed;
    let selectedTower = null;
    let placedTowers = [];
    let enemies = [];
    let enemiesSpawned = 0;
    let enemiesKilled = 0;
    let active = true;
    let battleLoop = null;
    let spawnInterval = null;
    let lastTime = 0;

    // Start planning timer
    const planTimerBar = document.getElementById('td-timer');
    if (planTimerBar) {
      planTimerBar.style.transition = `width ${cfg.planningPhaseMs / 1000}s linear`;
      planTimerBar.style.width = '0%';
    }

    const updateStats = () => {
      const livesEl = document.getElementById('td-lives');
      const towersEl = document.getElementById('td-towers-left');
      const enemiesEl = document.getElementById('td-enemies');
      if (livesEl) livesEl.textContent = lives;
      if (towersEl) towersEl.textContent = towersLeft;
      if (enemiesEl) enemiesEl.textContent = enemiesKilled;
    };

    // Tower selection
    overlay.querySelectorAll('.td-tower-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (phase !== 'planning') return;
        this.game.soundManager.defenseSelectTower();

        overlay.querySelectorAll('.td-tower-btn').forEach(b => b.classList.remove('td-selected'));
        btn.classList.add('td-selected');
        selectedTower = btn.dataset.tower;
        
        // Show range preview on grid
        const towerType = cfg.towers.find(t => t.id === selectedTower);
        overlay.querySelectorAll('.td-cell').forEach(cell => {
          cell.classList.remove('td-in-range');
        });
      });
    });

    // Grid cell click - place or remove tower
    overlay.querySelectorAll('.td-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        if (phase !== 'planning') return;

        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);

        // Click on existing tower = remove it
        if (cell.classList.contains('td-has-tower')) {
          cell.classList.remove('td-has-tower');
          cell.style.removeProperty('--tower-color');
          cell.innerHTML = '';
          placedTowers = placedTowers.filter(t => t.x !== x || t.y !== y);
          towersLeft++;
          updateStats();
          this.game.soundManager.uiClick();
          return;
        }

        if (!selectedTower || towersLeft <= 0) return;
        if (cell.classList.contains('td-path')) return;

        const towerType = cfg.towers.find(t => t.id === selectedTower);
        if (!towerType) return;

        this.game.soundManager.defensePlaceTower();
        cell.classList.add('td-has-tower');
        cell.style.setProperty('--tower-color', towerType.color);
        cell.innerHTML = `
          <span class="td-placed-tower">${towerType.emoji}</span>
          <div class="td-tower-range" style="--range: ${towerType.range}"></div>
        `;
        placedTowers.push({ x, y, type: towerType, element: cell, lastFired: 0 });

        towersLeft--;
        updateStats();

        overlay.querySelectorAll('.td-tower-btn').forEach(b => b.classList.remove('td-selected'));
        selectedTower = null;
      });
    });

    // Start battle button
    const startBtn = document.getElementById('td-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (placedTowers.length === 0) {
          const resultEl = document.getElementById('td-result');
          if (resultEl) {
            resultEl.textContent = '⚠️ Place at least one tower first!';
            setTimeout(() => { if (resultEl.textContent.includes('Place')) resultEl.textContent = ''; }, 2000);
          }
          return;
        }
        startBattle();
      });
    }

    const startBattle = () => {
      if (phase === 'battle') return;
      phase = 'battle';
      this.game.soundManager.defenseBattleStart();

      const phaseEl = document.getElementById('td-phase');
      const phaseIndicator = document.getElementById('td-phase-indicator');
      const instrEl = document.getElementById('td-instructions');
      const selectEl = document.getElementById('td-tower-select');
      const controlsEl = document.getElementById('td-controls');
      
      if (phaseEl) phaseEl.textContent = 'BATTLE!';
      if (phaseIndicator) phaseIndicator.classList.add('td-battle-phase');
      if (instrEl) instrEl.innerHTML = 'Towers attack automatically. Protect your cookies!';
      if (selectEl) selectEl.style.visibility = 'hidden';
      if (controlsEl) controlsEl.style.visibility = 'hidden';

      // Hide timer bar — battle ends when all enemies are dealt with
      const timerBar = document.getElementById('td-timer');
      if (timerBar) timerBar.style.display = 'none';

      spawnInterval = setInterval(spawnEnemy, cfg.enemySpawnIntervalMs);
      spawnEnemy();

      lastTime = performance.now();
      battleLoop = requestAnimationFrame(updateBattle);
    };

    const spawnEnemy = () => {
      if (!active || enemiesSpawned >= cfg.totalEnemies) return;

      const enemyType = cfg.enemies[Math.floor(Math.random() * cfg.enemies.length)];
      const grid = document.getElementById('td-grid');
      if (!grid) return;

      const enemy = document.createElement('div');
      enemy.className = 'td-enemy';
      enemy.innerHTML = `
        <span class="td-enemy-sprite">${enemyType.emoji}</span>
        <div class="td-enemy-health-bar">
          <div class="td-enemy-health-fill" style="width: 100%"></div>
        </div>
      `;
      
      const startCell = path[0];
      const cellWidth = 100 / cfg.gridCols;
      const cellHeight = 100 / cfg.gridRows;
      enemy.style.left = `${startCell.x * cellWidth + cellWidth / 2}%`;
      enemy.style.top = `${startCell.y * cellHeight + cellHeight / 2}%`;
      
      grid.appendChild(enemy);
      
      enemies.push({
        element: enemy,
        healthBar: enemy.querySelector('.td-enemy-health-fill'),
        pathIndex: 0,
        pathProgress: 0,
        health: enemyType.health,
        maxHealth: enemyType.health,
        speed: enemyType.speed * cfg.enemyBaseSpeed,
        type: enemyType
      });
      
      enemiesSpawned++;
    };

    const createProjectile = (fromX, fromY, toX, toY, color) => {
      const projectiles = document.getElementById('td-projectiles');
      if (!projectiles) return;
      
      const proj = document.createElement('div');
      proj.className = 'td-projectile';
      proj.style.setProperty('--from-x', `${fromX}%`);
      proj.style.setProperty('--from-y', `${fromY}%`);
      proj.style.setProperty('--to-x', `${toX}%`);
      proj.style.setProperty('--to-y', `${toY}%`);
      proj.style.background = color;
      projectiles.appendChild(proj);
      
      setTimeout(() => proj.remove(), 200);
    };

    const updateBattle = (currentTime) => {
      if (!active || phase !== 'battle') return;

      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const cellWidth = 100 / cfg.gridCols;
      const cellHeight = 100 / cfg.gridRows;

      // Move enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        if (enemy.pathIndex >= path.length - 1) {
          lives--;
          this.game.soundManager.defenseLifeLost();
          enemy.element.classList.add('td-enemy-escaped');
          setTimeout(() => enemy.element.remove(), 300);
          enemies.splice(i, 1);
          updateStats();
          
          if (lives <= 0) {
            endBattle();
            return;
          }
          continue;
        }

        enemy.pathProgress += enemy.speed * deltaTime;
        
        while (enemy.pathProgress >= 1 && enemy.pathIndex < path.length - 1) {
          enemy.pathProgress -= 1;
          enemy.pathIndex++;
        }

        const currentCell = path[enemy.pathIndex];
        const nextCell = path[Math.min(enemy.pathIndex + 1, path.length - 1)];
        const progress = Math.min(enemy.pathProgress, 1);
        
        const x = currentCell.x + (nextCell.x - currentCell.x) * progress;
        const y = currentCell.y + (nextCell.y - currentCell.y) * progress;
        
        enemy.element.style.left = `${x * cellWidth + cellWidth / 2}%`;
        enemy.element.style.top = `${y * cellHeight + cellHeight / 2}%`;
        enemy.x = x;
        enemy.y = y;
      }

      // Towers attack
      placedTowers.forEach(tower => {
        if (currentTime - tower.lastFired < tower.type.fireRate) return;
        
        let closestEnemy = null;
        let closestDist = Infinity;
        
        enemies.forEach(enemy => {
          if (enemy.x === undefined) return;
          const dx = enemy.x - tower.x;
          const dy = enemy.y - tower.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist <= tower.type.range && dist < closestDist) {
            closestDist = dist;
            closestEnemy = enemy;
          }
        });

        if (closestEnemy) {
          tower.lastFired = currentTime;
          this.game.soundManager.defenseTowerFire();

          // Visual effects
          tower.element.classList.add('td-tower-fire');
          setTimeout(() => tower.element.classList.remove('td-tower-fire'), 100);

          // Projectile
          const towerX = tower.x * cellWidth + cellWidth / 2;
          const towerY = tower.y * cellHeight + cellHeight / 2;
          const enemyX = closestEnemy.x * cellWidth + cellWidth / 2;
          const enemyY = closestEnemy.y * cellHeight + cellHeight / 2;
          createProjectile(towerX, towerY, enemyX, enemyY, tower.type.color);

          // Damage
          closestEnemy.health -= tower.type.damage;
          this.game.soundManager.defenseEnemyHit();
          closestEnemy.element.classList.add('td-enemy-hit');
          setTimeout(() => closestEnemy.element.classList.remove('td-enemy-hit'), 100);
          
          // Update health bar
          const healthPct = Math.max(0, (closestEnemy.health / closestEnemy.maxHealth) * 100);
          if (closestEnemy.healthBar) {
            closestEnemy.healthBar.style.width = `${healthPct}%`;
          }
          
          if (closestEnemy.health <= 0) {
            this.game.soundManager.defenseEnemyDestroyed();
            enemiesKilled++;
            closestEnemy.element.classList.add('td-enemy-dead');
            setTimeout(() => closestEnemy.element.remove(), 200);
            enemies = enemies.filter(e => e !== closestEnemy);
            updateStats();
          }
        }
      });

      // End when all enemies spawned and none remain on board
      if (enemiesSpawned >= cfg.totalEnemies && enemies.length === 0) {
        endBattle();
        return;
      }

      if (active) {
        battleLoop = requestAnimationFrame(updateBattle);
      }
    };

    const endBattle = () => {
      active = false;
      phase = 'ended';
      clearInterval(spawnInterval);
      cancelAnimationFrame(battleLoop);
      
      this._finishCookieDefense(lives, cfg);
    };

    // Auto-start battle after planning phase
    setTimeout(() => {
      if (active && phase === 'planning') {
        startBattle();
      }
    }, cfg.planningPhaseMs);
  }

  _generateDefensePath(cols, rows) {
    const path = [];
    let x = 0;
    let y = Math.floor(Math.random() * (rows - 2)) + 1; // Random start row (not edges)
    
    path.push({ x, y });
    
    let lastDir = 'right';
    
    while (x < cols - 1) {
      const canUp = y > 0 && lastDir !== 'down';
      const canDown = y < rows - 1 && lastDir !== 'up';
      
      const rand = Math.random();
      
      if (rand < 0.5) {
        x++;
        lastDir = 'right';
      } else if (rand < 0.7 && canUp) {
        y--;
        lastDir = 'up';
      } else if (rand < 0.9 && canDown) {
        y++;
        lastDir = 'down';
      } else {
        x++;
        lastDir = 'right';
      }
      
      const last = path[path.length - 1];
      if (last.x !== x || last.y !== y) {
        path.push({ x, y });
      }
    }
    
    return path;
  }

  _finishCookieDefense(lives, cfg) {
    this.game.soundManager.defenseBattleResult();
    const resultEl = document.getElementById('td-result');
    let tier = null;
    let msg = '';

    if (lives <= 0) {
      msg = '😱 All cookies stolen!';
    } else if (lives >= cfg.legendaryLives) {
      tier = 'legendary';
      msg = '🏆 PERFECT DEFENSE!';
    } else if (lives >= cfg.epicLives) {
      tier = 'epic';
      msg = '⭐ EPIC! Almost perfect!';
    } else if (lives >= cfg.greatLives) {
      tier = 'great';
      msg = '🛡️ Great defense!';
    } else if (lives >= cfg.normalLives) {
      tier = 'normal';
      msg = '👍 Cookies defended!';
    }

    if (tier) {
      const r = this._giveReward(tier, 'cookieDefense');
      if (resultEl) {
        resultEl.textContent = `${msg} +${formatNumberInWords(r)} cookies!`;
        resultEl.classList.add('mini-win');
      }
    } else {
      if (resultEl) resultEl.textContent = msg;
    }

    setTimeout(() => this._close(), cfg.resultDisplayMs);
  }

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
    setTimeout(() => {
      if (active) {
        active = false;
        this._finishGrandmasKitchen(score, perfectCount, burntCount, cfg);
      }
    }, cfg.durationMs);
  }

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

  /* ════════════════════════════════════════════════════════════
     🧮  MATH BAKER  — solve math problems for cookies!
     Higher reward for longer gameplay!
     ════════════════════════════════════════════════════════════ */
  _mathBaker() {
    const cfg = MINI_GAME_SETTINGS.mathBaker;
    const durationSec = cfg.durationMs / 1000;

    const overlay = this._show(`
      <div class="mini-game-card mini-math-card">
        <div class="mini-title">🧮 Math Baker! <span class="mini-sub">Calculate recipe portions!</span></div>
        <div class="math-problem" id="math-problem">Loading...</div>
        <div class="math-answers" id="math-answers"></div>
        <div class="math-stats">
          <span>⭐ Score: <span id="math-score">0</span></span>
          <span>✅ Correct: <span id="math-correct">0</span></span>
          <span>❌ Wrong: <span id="math-wrong">0</span></span>
        </div>
        <div class="mini-timer-bar"><div class="mini-timer-fill" id="math-timer"></div></div>
        <div class="math-question-timer"><div class="math-question-fill" id="math-q-timer"></div></div>
        <div class="mini-result" id="math-result"></div>
      </div>
    `);
    if (!overlay) return;

    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let questionNum = 0;
    let active = true;
    let questionTimeout = null;
    let questionStartTime = 0;

    // Start main timer
    requestAnimationFrame(() => {
      const bar = document.getElementById("math-timer");
      if (bar) { bar.style.transition = `width ${durationSec}s linear`; bar.style.width = "0%"; }
    });

    const updateStats = () => {
      const scoreEl = document.getElementById('math-score');
      const correctEl = document.getElementById('math-correct');
      const wrongEl = document.getElementById('math-wrong');
      if (scoreEl) scoreEl.textContent = score;
      if (correctEl) correctEl.textContent = correctCount;
      if (wrongEl) wrongEl.textContent = wrongCount;
    };

    const getDifficulty = () => {
      if (questionNum < cfg.easyQuestionsCount) return 'easy';
      if (questionNum < cfg.easyQuestionsCount + cfg.mediumQuestionsCount) return 'medium';
      return 'hard';
    };

    const generateQuestion = () => {
      const difficulty = getDifficulty();
      const ops = MATH_OPERATIONS[difficulty];
      const op = ops[Math.floor(Math.random() * ops.length)];
      
      let maxNum;
      if (difficulty === 'easy') maxNum = cfg.easyMaxNumber;
      else if (difficulty === 'medium') maxNum = cfg.mediumMaxNumber;
      else maxNum = cfg.hardMaxNumber;

      let a, b, answer;
      
      switch (op) {
        case '+':
          // Avoid trivial: both numbers at least 3
          a = Math.floor(Math.random() * (maxNum - 3)) + 3;
          b = Math.floor(Math.random() * (maxNum - 3)) + 3;
          answer = a + b;
          break;
        case '-':
          // Ensure a > b and both meaningful (avoid x - 0, x - 1)
          a = Math.floor(Math.random() * (maxNum - 5)) + 8;
          b = Math.floor(Math.random() * (a - 4)) + 2; // b is at least 2, leaves result >= 2
          answer = a - b;
          break;
        case '×':
          // Avoid ×1 and ×0: both numbers at least 2, max 12 for reasonable difficulty
          a = Math.floor(Math.random() * 10) + 2; // 2-11
          b = Math.floor(Math.random() * 10) + 2; // 2-11
          answer = a * b;
          break;
        case '÷':
          // Avoid ÷1: divisor at least 2, result at least 2
          b = Math.floor(Math.random() * 10) + 2; // 2-11
          answer = Math.floor(Math.random() * 10) + 2; // result 2-11
          a = b * answer; // Ensure clean division
          break;
      }

      return { a, b, op, answer };
    };

    const generateWrongAnswers = (correctAnswer) => {
      const wrongs = new Set();
      const variance = Math.max(10, Math.abs(correctAnswer) * 0.3);
      
      while (wrongs.size < 3) {
        let wrong;
        const r = Math.random();
        if (r < 0.3) {
          // Close to correct
          wrong = correctAnswer + Math.floor(Math.random() * 5) + 1;
        } else if (r < 0.6) {
          wrong = correctAnswer - Math.floor(Math.random() * 5) - 1;
        } else {
          // Random in range
          wrong = correctAnswer + Math.floor((Math.random() - 0.5) * variance * 2);
        }
        if (wrong !== correctAnswer && wrong >= 0) {
          wrongs.add(wrong);
        }
      }
      return Array.from(wrongs);
    };

    const showQuestion = () => {
      if (!active) return;
      this.game.soundManager.mathQuestionAppear();

      const q = generateQuestion();
      const wrongAnswers = generateWrongAnswers(q.answer);
      const allAnswers = [q.answer, ...wrongAnswers];
      
      // Shuffle answers
      for (let i = allAnswers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
      }

      const problemEl = document.getElementById('math-problem');
      const answersEl = document.getElementById('math-answers');
      
      if (problemEl) {
        problemEl.textContent = `${q.a} ${q.op} ${q.b} = ?`;
        problemEl.classList.remove('math-correct', 'math-wrong');
      }

      if (answersEl) {
        answersEl.innerHTML = allAnswers.map(ans => 
          `<button class="math-btn" data-answer="${ans}">${ans}</button>`
        ).join('');

        answersEl.querySelectorAll('.math-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!active) return;
            
            const selected = parseInt(btn.dataset.answer);
            const timeTaken = Date.now() - questionStartTime;
            
            clearTimeout(questionTimeout);
            
            answersEl.querySelectorAll('.math-btn').forEach(b => {
              b.disabled = true;
              if (parseInt(b.dataset.answer) === q.answer) {
                b.classList.add('math-btn-correct');
              }
            });

            if (selected === q.answer) {
              correctCount++;
              let points = cfg.correctPoints;
              if (timeTaken < 3000) {
                points += cfg.fastBonusPoints;
                this.game.soundManager.mathFastBonus();
              } else {
                this.game.soundManager.mathCorrect();
              }
              score += points;
              if (problemEl) {
                problemEl.classList.add('math-correct');
                problemEl.textContent = `✅ +${points}!`;
              }
            } else {
              this.game.soundManager.mathWrong();
              wrongCount++;
              score = Math.max(0, score - cfg.wrongPenalty);
              btn.classList.add('math-btn-wrong');
              if (problemEl) {
                problemEl.classList.add('math-wrong');
                problemEl.textContent = `❌ It was ${q.answer}`;
              }
            }

            updateStats();
            questionNum++;

            setTimeout(() => {
              if (active) showQuestion();
            }, 800);
          });
        });
      }

      // Question timer
      const qTimer = document.getElementById('math-q-timer');
      if (qTimer) {
        qTimer.style.transition = 'none';
        qTimer.style.width = '100%';
        requestAnimationFrame(() => {
          qTimer.style.transition = `width ${cfg.questionTimeMs}ms linear`;
          qTimer.style.width = '0%';
        });
      }

      questionStartTime = Date.now();
      questionTimeout = setTimeout(() => {
        if (!active) return;
        this.game.soundManager.mathTimeUp();
        wrongCount++;
        score = Math.max(0, score - cfg.wrongPenalty);
        if (problemEl) {
          problemEl.classList.add('math-wrong');
          problemEl.textContent = `⏰ Time! Answer: ${q.answer}`;
        }
        updateStats();
        questionNum++;
        setTimeout(() => {
          if (active) showQuestion();
        }, 800);
      }, cfg.questionTimeMs);
    };

    // Start first question
    showQuestion();

    // Game end
    setTimeout(() => {
      if (active) {
        active = false;
        clearTimeout(questionTimeout);
        this._finishMathBaker(score, correctCount, wrongCount, cfg);
      }
    }, cfg.durationMs);
  }

  _finishMathBaker(score, correctCount, wrongCount, cfg) {
    const resultEl = document.getElementById('math-result');
    let tier = null;
    let msg = '';

    if (score >= cfg.legendaryThreshold) {
      tier = 'legendary';
      msg = '🏆 LEGENDARY! Math genius!';
    } else if (score >= cfg.epicThreshold) {
      tier = 'epic';
      msg = '⭐ EPIC! Calculator brain!';
    } else if (score >= cfg.greatThreshold) {
      tier = 'great';
      msg = '🧮 Great math skills!';
    } else if (score >= cfg.normalThreshold) {
      tier = 'normal';
      msg = '📊 Not bad, mathematician!';
    } else {
      msg = '😅 Math is hard! Keep trying!';
    }

    if (tier) {
      const r = this._giveReward(tier, 'mathBaker');
      if (resultEl) {
        resultEl.textContent = `${msg} +${formatNumberInWords(r)} cookies!`;
        resultEl.classList.add('mini-win');
      }
    } else {
      if (resultEl) resultEl.textContent = msg;
    }

    setTimeout(() => this._close(), cfg.resultDisplayMs);
  }

  /* ════════════════════════════════════════════════════════════
     ⚔️  DUNGEON CRAWL v3 — simple, smooth, strategic
     ════════════════════════════════════════════════════════════

     Design:
     - One continuous UI, never full-redraws mid-fight
     - 3 actions: Attack / Block / Potion (limited)
     - Enemy shows INTENT before acting (attack, heavy, rest)
     - Between floors: pick 1 of 2 loot buffs
     - 5 floors: 4 enemies + boss
     - Whole run takes ~3 minutes
  */

  _dungeonCrawl() {
    const C = MINI_GAME_SETTINGS.dungeon;
    const g = this.game;
    const cps = g.getEffectiveCPS().toNumber();
    const fee = Math.floor(cps * C.entryFeeMultiplier);

    if (fee > 0 && g.cookies.toNumber() < fee) {
      this._show(`<div class="mini-game-card dungeon-card"><div class="dng-head">⚔️ Cookie Dungeon</div>
        <div class="dng-splash">🚫<br>Not enough cookies!<br><b>${formatNumberInWords(fee)}</b> needed</div>
        <div class="dng-btns"><button class="dng-b dng-b-run" id="dng-x">Close</button></div></div>`);
      document.getElementById('dng-x')?.addEventListener('click', () => this._close());
      return;
    }
    if (fee > 0) { g.cookies = g.cookies.sub(fee); g.updateCookieCount(); }
    g.stats.dungeonRuns = (g.stats.dungeonRuns || 0) + 1;

    const floors = [];
    for (let i = 0; i < C.totalFloors; i++) {
      const boss = i === C.totalFloors - 1;
      const base = boss ? C.boss : C.enemies[Math.min(i, C.enemies.length - 1)];
      const s = 1 + i * C.depthScale;
      floors.push({ ...base, hp: Math.floor(base.hp * s), atk: Math.floor(base.atk * s),
        maxHp: Math.floor(base.hp * s), isBoss: boss, intent: this._dI(C, null) });
    }

    const mhp = Math.floor(C.baseHp + g.getTotalBuildingCount() * C.hpPerBuilding);
    this._dng = { C, floors, fl: 0, busy: false, log: [],
      scouted: false, stunned: false,
      p: { hp: mhp, maxHp: mhp, atk: Math.min(C.atkCap, C.baseAtk + cps * C.atkCpsScale),
           pot: C.potions, crit: C.critChance, x2: false } };
    this._dR();
  }

  /** Smart enemy AI — picks intent based on HP context */
  _dI(C, enemy) {
    const hpPct = enemy ? enemy.hp / enemy.maxHp : 1;
    const r = Math.random();

    // Can flee? Only below 50% HP, rare
    if (hpPct < C.enemyFleeHpThreshold && r < C.enemyFleeChance) return 'flee';
    // Heal when hurt (below 70%), chance-based
    if (hpPct < 0.7 && Math.random() < C.enemyHealChance) return 'heal';
    // Block sometimes
    if (Math.random() < C.enemyBlockChance) return 'block';
    // Heavy attack (rarer, more likely for bosses)
    const heavyChance = enemy?.isBoss ? C.enemyHeavyChance * 1.5 : C.enemyHeavyChance;
    if (Math.random() < heavyChance) return 'heavy';
    // Default: normal attack
    return 'atk';
  }

  /* ══════  RENDER  ══════ */
  _dR() {
    const D = this._dng, { C, floors, fl, p, log } = D;
    const e = floors[fl];
    const php = Math.max(0, p.hp / p.maxHp * 100);
    const ehp = Math.max(0, e.hp / e.maxHp * 100);
    const hpc = php > 50 ? '#22c55e' : php > 25 ? '#eab308' : '#ef4444';

    const pips = floors.map((f, i) =>
      `<span class="dng-pip${i < fl ? ' done' : i === fl ? ' now' : ''}">${i < fl ? '✓' : f.isBoss ? '👑' : f.emoji}</span>`
    ).join('');

    // Intent display — hidden unless scouted
    const { iTag, iHint } = this._dIntentHtml(e, C, D.scouted);

    const logHtml = log.slice(-2).map((l, i, a) =>
      `<div class="dng-ll" style="opacity:${i === a.length - 1 ? '1' : '0.4'}">${l}</div>`).join('');

    this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
      <div class="dng-head">
        <span>⚔️ Cookie Dungeon</span>
        <span class="dng-fl">Floor ${fl + 1}/${floors.length}</span>
        <button class="dng-help-btn" id="dng-help">?</button>
      </div>
      <div class="dng-pips">${pips}</div>

      <div class="dng-field">
        <div class="dng-side" id="dng-ps">
          <div class="dng-avatar" id="dng-pi">🧙</div>
          <div class="dng-hpwrap"><div class="dng-hpbar" id="dng-pb" style="width:${php}%;background:${hpc}"></div><div class="dng-hpghost" id="dng-pg" style="width:${php}%"></div></div>
          <div class="dng-stat" id="dng-pt"><b>${Math.ceil(p.hp)}</b>/${Math.ceil(p.maxHp)} HP</div>
          <div class="dng-stat">${Math.floor(p.atk)} ATK${p.pot > 0 ? ` · 💊${p.pot}` : ''}${p.x2 ? ' · ⚡2×' : ''}</div>
          <div class="dng-float" id="dng-pf"></div>
        </div>

        <div class="dng-center">
          ${iTag}
          ${iHint ? `<div class="dng-hint">${iHint}</div>` : ''}
        </div>

        <div class="dng-side dng-eside" id="dng-es">
          <div class="dng-avatar ${e.isBoss ? 'dng-boss' : ''}" id="dng-ei">${e.emoji}</div>
          <div class="dng-ename">${e.name}</div>
          <div class="dng-hpwrap"><div class="dng-hpbar dng-ehp" id="dng-eb" style="width:${ehp}%"></div><div class="dng-hpghost dng-eghp" id="dng-eg" style="width:${ehp}%"></div></div>
          <div class="dng-stat" id="dng-et"><b>${Math.ceil(e.hp)}</b>/${e.maxHp} HP</div>
          <div class="dng-float" id="dng-ef"></div>
        </div>
      </div>

      <div class="dng-log" id="dng-log">${logHtml}</div>

      <div class="dng-bottom">
        <div class="dng-utils" id="dng-utils">
          <button class="dng-u dng-u-scout" data-a="scout" data-tip="Reveal enemy intent. Costs ${Math.max(1, Math.floor(p.maxHp * C.scoutCost))} HP. Free action.">
            <svg viewBox="0 0 32 32" width="100%" height="100%"><defs><radialGradient id="eg1" cx="50%" cy="40%"><stop offset="0%" stop-color="#c4b5fd"/><stop offset="100%" stop-color="#7c3aed"/></radialGradient></defs><ellipse cx="16" cy="16" rx="13" ry="8" fill="none" stroke="#a78bfa" stroke-width="1.8"/><ellipse cx="16" cy="16" rx="9" ry="5.5" fill="rgba(167,139,250,0.1)"/><circle cx="16" cy="16" r="4" fill="url(#eg1)"/><circle cx="16" cy="16" r="1.8" fill="#1a0a2e"/><line x1="14" y1="9" x2="12" y2="5" stroke="#a78bfa" stroke-width="1" opacity="0.5"/><line x1="18" y1="9" x2="20" y2="5" stroke="#a78bfa" stroke-width="1" opacity="0.5"/><line x1="16" y1="8" x2="16" y2="4" stroke="#a78bfa" stroke-width="1" opacity="0.5"/></svg>
          </button>
          <button class="dng-u dng-u-pot" data-a="pot" ${p.pot <= 0 ? 'disabled' : ''} data-tip="Heal ${Math.floor(p.maxHp * C.potionHeal)} HP (${p.pot} left). Free action.">
            <svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="pg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="transparent"/><stop offset="55%" stop-color="transparent"/><stop offset="55%" stop-color="rgba(74,222,128,0.3)"/><stop offset="100%" stop-color="rgba(34,197,94,0.5)"/></linearGradient></defs><path d="M11 5h10v4l3 17H8L11 9V5z" fill="url(#pg1)" stroke="#4ade80" stroke-width="1.5" stroke-linejoin="round"/><line x1="11" y1="5" x2="21" y2="5" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/><ellipse cx="16" cy="20" rx="3" ry="1.5" fill="rgba(74,222,128,0.3)"/><circle cx="14" cy="18" r="0.8" fill="#86efac" opacity="0.6"/><circle cx="17" cy="21" r="0.6" fill="#86efac" opacity="0.4"/></svg>
            ${p.pot > 0 ? `<span class="dng-u-badge">${p.pot}</span>` : ''}
          </button>
          <button class="dng-u dng-u-run" data-a="run" data-tip="Flee with earned rewards. Dying = 50% penalty.">
            <svg viewBox="0 0 32 32" width="100%" height="100%"><rect x="14" y="4" width="12" height="24" rx="2" fill="rgba(156,163,175,0.1)" stroke="#9ca3af" stroke-width="1.5"/><rect x="22" y="13" width="2" height="5" rx="1" fill="#9ca3af"/><path d="M12 16H4" stroke="#d1d5db" stroke-width="2" stroke-linecap="round"/><path d="M7 12l-4 4 4 4" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          </button>
        </div>
        <div class="dng-btns" id="dng-btns">
          <button class="dng-b dng-b-atk" data-a="atk" data-tip="Deal ${Math.floor(p.atk * 0.8)}-${Math.floor(p.atk * 1.2)} damage. ${Math.round(p.crit * 100)}% crit chance.">Attack (${Math.floor(p.atk)})</button>
          <button class="dng-b dng-b-heavy" data-a="heavy" ${D.stunned ? 'disabled' : ''} data-tip="Deal ${Math.floor(p.atk * C.heavyAtkMult * 0.8)}-${Math.floor(p.atk * C.heavyAtkMult * 1.2)} damage. Skips next turn.">Heavy (${Math.floor(p.atk * C.heavyAtkMult)})${D.stunned ? ' ⏳' : ''}</button>
          <button class="dng-b dng-b-blk" data-a="blk" data-tip="Block ${Math.round(C.blockPercent * 100)}% of incoming damage this turn.">Block (${Math.round(C.blockPercent * 100)}%)</button>
        </div>
      </div>
    </div>`);

    // Bind all buttons
    document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => {
      b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!D.busy) this._dA(b.dataset.a); });
      // Custom hover tooltip from data-tip
      if (b.dataset.tip) {
        b.addEventListener('mouseenter', () => {
          const gt = document.getElementById('global-tooltip');
          if (gt) { gt.innerHTML = b.dataset.tip; gt.style.opacity = '1'; }
        });
        b.addEventListener('mousemove', (ev) => {
          const gt = document.getElementById('global-tooltip');
          if (gt) { gt.style.left = (ev.clientX + 12) + 'px'; gt.style.top = (ev.clientY - 30) + 'px'; }
        });
        b.addEventListener('mouseleave', () => {
          const gt = document.getElementById('global-tooltip');
          if (gt) gt.style.opacity = '0';
        });
      }
    });

    // Help tooltip
    const helpBtn = document.getElementById('dng-help');
    if (helpBtn) {
      helpBtn.addEventListener('mouseenter', () => this._dShowTip(helpBtn));
      helpBtn.addEventListener('mouseleave', () => this._dHideTip());
      helpBtn.addEventListener('click', (ev) => { ev.stopPropagation(); this._dShowTip(helpBtn); });
    }
  }

  /* ══════  HELP TOOLTIP (floating, not inline)  ══════ */
  _dShowTip(anchor) {
    let tip = document.getElementById('dng-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'dng-tooltip';
      tip.className = 'dng-tooltip';
      tip.innerHTML = `
        <div class="dng-tip-title">How to Play</div>
        <div class="dng-tip-grid">
          <div class="dng-tip-item"><span class="dng-tip-key">⚔️ Attack</span><span class="dng-tip-desc">Deal damage. Crits happen randomly.</span></div>
          <div class="dng-tip-item"><span class="dng-tip-key">💀 Heavy</span><span class="dng-tip-desc">1.6× damage, skip next turn.</span></div>
          <div class="dng-tip-item"><span class="dng-tip-key">🛡️ Block</span><span class="dng-tip-desc">Reduce incoming damage by 65%.</span></div>
          <div class="dng-tip-item"><span class="dng-tip-key">👁️ Scout</span><span class="dng-tip-desc">Reveal enemy intent. Costs 8% HP.</span></div>
          <div class="dng-tip-item"><span class="dng-tip-key">💊 Potion</span><span class="dng-tip-desc">Heal 35% HP. Limited supply.</span></div>
          <div class="dng-tip-item"><span class="dng-tip-key">🏃 Flee</span><span class="dng-tip-desc">Keep rewards. Dying = 50% penalty.</span></div>
        </div>
        <div class="dng-tip-footer">Enemies attack, block, heal, or flee. <b>Scout</b> to see what's coming!</div>`;
      document.body.appendChild(tip);
    }
    const r = anchor.getBoundingClientRect();
    tip.style.top = (r.bottom + 8) + 'px';
    tip.style.left = Math.max(8, r.left - 120) + 'px';
    tip.style.opacity = '1';
    tip.style.pointerEvents = 'auto';
  }

  _dHideTip() {
    const tip = document.getElementById('dng-tooltip');
    if (tip) { tip.style.opacity = '0'; tip.style.pointerEvents = 'none'; }
  }

  /** Build intent display — hidden unless scouted this turn */
  _dIntentHtml(e, C, scouted) {
    if (!scouted) {
      return { iTag: `<div class="dng-intent dng-i-unknown">❓ Unknown</div>`, iHint: 'Scout to reveal!' };
    }
    const i = e.intent;
    if (i === 'heavy') {
      const lo = Math.floor(e.atk * C.heavyMult * 0.8), hi = Math.floor(e.atk * C.heavyMult * 1.2);
      return { iTag: `<div class="dng-intent dng-i-heavy">💀 HEAVY ${lo}-${hi}</div>`, iHint: 'Block now!' };
    }
    if (i === 'block') return { iTag: `<div class="dng-intent dng-i-block">🛡️ Blocking</div>`, iHint: 'Heavy attack!' };
    if (i === 'heal') return { iTag: `<div class="dng-intent dng-i-heal">💚 Healing</div>`, iHint: 'Attack hard!' };
    if (i === 'flee') return { iTag: `<div class="dng-intent dng-i-flee">🏃 Fleeing!</div>`, iHint: 'Kill fast!' };
    const lo = Math.floor(e.atk * 0.8), hi = Math.floor(e.atk * 1.2);
    return { iTag: `<div class="dng-intent dng-i-atk">⚔️ Atk ${lo}-${hi}</div>`, iHint: '' };
  }

  /* ══════  FLOAT NUMBERS  ══════ */
  _dF(id, text, color, big) {
    const c = document.getElementById(id); if (!c) return;
    const el = document.createElement('div');
    el.className = `dng-floater${big ? ' dng-floater-big' : ''}`;
    el.style.color = color; el.innerHTML = text;
    c.innerHTML = ''; c.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /* ══════  ACTION — player first, then enemy  ══════ */
  _dA(a) {
    const D = this._dng, { C, floors, p } = D, e = floors[D.fl];
    D.busy = true;
    D.scouted = false; // reset scout each turn
    document.querySelectorAll('#dng-btns .dng-b').forEach(b => b.disabled = true);
    const snd = this.game.soundManager;

    // ── FREE ACTIONS (don't consume turn) ──

    if (a === 'run') { D.log.push('🏃 You fled!'); snd.dungeonFlee(); this._dEnd(false, false); return; }

    if (a === 'scout') {
      const cost = Math.max(1, Math.floor(p.maxHp * C.scoutCost));
      p.hp = Math.max(1, p.hp - cost);
      D.scouted = true;
      this._dF('dng-pf', `-${cost}`, '#a78bfa');
      const { iTag, iHint } = this._dIntentHtml(e, C, true);
      const mid = document.querySelector('.dng-center');
      if (mid) mid.innerHTML = `${iTag}${iHint ? `<div class="dng-hint">${iHint}</div>` : ''}`;
      D.log.push(`👁️ Scouted! <span class="dng-dim">(-${cost} HP)</span>`);
      snd.uiClick(); this._dSync();
      D.busy = false;
      this._dRefreshUtils();
      return;
    }

    if (a === 'pot') {
      if (p.pot <= 0) { D.busy = false; return; }
      p.pot--;
      const h = Math.floor(p.maxHp * C.potionHeal);
      p.hp = Math.min(p.maxHp, p.hp + h);
      D.log.push(`💊 +<b>${h}</b> HP (${p.pot} left)`);
      this._dF('dng-pf', `+${h}`, '#4ade80');
      this._dFx('dng-pi', 'dng-heal'); snd.dungeonHeal(); this._dSync();
      D.busy = false;
      this._dRefreshUtils();
      return;
    }

    // If stunned from previous heavy attack, skip player turn
    if (D.stunned) {
      D.stunned = false;
      D.log.push('💫 Recovering from heavy attack...');
      this._dSync();
      setTimeout(() => this._dEnemyTurn(a), 500 + Math.floor(Math.random() * 500));
      return;
    }

    // ── PLAYER ACTS ──
    if (a === 'atk' || a === 'heavy') this._dFx('dng-pi', 'dng-lunge');

    setTimeout(() => {
      if (a === 'atk') {
        let dmg = Math.floor(p.atk * (0.8 + Math.random() * 0.4));
        if (p.x2) { dmg *= 2; p.x2 = false; }
        const crit = Math.random() < p.crit;
        if (crit) dmg = Math.floor(dmg * C.critMult);
        // Enemy blocking? Reduce player damage
        if (e.intent === 'block') dmg = Math.floor(dmg * C.enemyBlockReduction);
        e.hp = Math.max(0, e.hp - dmg);
        this._dFx('dng-ei', 'dng-hit');
        this._dF('dng-ef', `${dmg}`, crit ? '#fbbf24' : '#fff', crit);
        if (crit) { this._dFx('dng-card', 'dng-shake'); snd.dungeonCrit(); } else { snd.dungeonAttack(); }
        const blkNote = e.intent === 'block' ? ' <span class="dng-dim">(enemy blocked)</span>' : '';
        D.log.push(crit ? `💥 CRIT! <b>${dmg}</b>!${blkNote}` : `⚔️ <b>${dmg}</b> dmg${blkNote}`);

      } else if (a === 'heavy') {
        let dmg = Math.floor(p.atk * C.heavyAtkMult * (0.8 + Math.random() * 0.4));
        if (p.x2) { dmg *= 2; p.x2 = false; }
        if (e.intent === 'block') dmg = Math.floor(dmg * C.enemyBlockReduction);
        e.hp = Math.max(0, e.hp - dmg);
        D.stunned = true; // skip next turn
        this._dFx('dng-ei', 'dng-hit'); this._dFx('dng-card', 'dng-shake');
        this._dF('dng-ef', `${dmg}`, '#ff6b35', true);
        snd.dungeonCrit();
        const blkNote = e.intent === 'block' ? ' <span class="dng-dim">(enemy blocked)</span>' : '';
        D.log.push(`💀 HEAVY! <b>${dmg}</b> dmg!${blkNote} <span class="dng-dim">(skip next turn)</span>`);

      } else if (a === 'blk') {
        D.log.push('🛡️ Guarding.');
        this._dFx('dng-pi', 'dng-def'); snd.dungeonBlock();
      }

      this._dSync();

      // Enemy dead?
      if (e.hp <= 0) {
        D.log.push(`☠️ ${e.name} defeated!`);
        this._dFx('dng-ei', 'dng-die'); snd.dungeonKill();
        this._dSync();
        D.fl++;
        if (D.fl >= floors.length) { setTimeout(() => this._dEnd(true, false), 800); }
        else { setTimeout(() => this._dLoot(), 700); }
        return;
      }

      // ── ENEMY ACTS (500-1000ms delay) ──
      setTimeout(() => this._dEnemyTurn(a), 500 + Math.floor(Math.random() * 500));
    }, 100);
  }

  /** Enemy turn — extracted so stunned turns can call it directly */
  _dEnemyTurn(playerAction) {
    const D = this._dng, { C, floors, p } = D, e = floors[D.fl];
    const snd = this.game.soundManager;
    const intent = e.intent;

    if (intent === 'flee') {
      D.log.push(`${e.emoji} ${e.name} flees!`);
      this._dF('dng-ef', '🏃', '#93c5fd');
      snd.dungeonFlee();
      // Enemy fleeing = player wins this floor without killing
      this._dSync();
      D.fl++;
      if (D.fl >= floors.length) { setTimeout(() => this._dEnd(true, false), 600); }
      else { setTimeout(() => this._dLoot(), 500); }
      return;

    } else if (intent === 'heal') {
      const h = Math.floor(e.maxHp * C.enemyHealAmount);
      e.hp = Math.min(e.maxHp, e.hp + h);
      D.log.push(`${e.emoji} heals <b>${h}</b> HP!`);
      this._dF('dng-ef', `+${h}`, '#4ade80');
      snd.dungeonHeal();

    } else if (intent === 'block') {
      // Block already applied during player's damage calc — just log it
      D.log.push(`${e.emoji} blocked! <span class="dng-dim">(took 50% dmg)</span>`);
      this._dFx('dng-ei', 'dng-def'); snd.dungeonBlock();

    } else {
      // atk or heavy
      const mult = intent === 'heavy' ? C.heavyMult : 1;
      let dmg = Math.floor(e.atk * mult * (0.8 + Math.random() * 0.4));
      if (playerAction === 'blk') dmg = Math.floor(dmg * (1 - C.blockPercent));
      p.hp = Math.max(0, p.hp - dmg);
      this._dFx('dng-pi', playerAction === 'blk' ? 'dng-blk' : 'dng-hit');
      this._dF('dng-pf', `${dmg}`, playerAction === 'blk' ? '#93c5fd' : '#ef4444', intent === 'heavy');
      if (playerAction === 'blk') { snd.dungeonBlock(); }
      else if (intent === 'heavy') { snd.dungeonHeavy(); this._dFx('dng-card', 'dng-shake'); }
      else { snd.dungeonHurt(); }
      const tag = intent === 'heavy' ? '💀 ' : '';
      D.log.push(`${e.emoji} ${tag}<b>${dmg}</b>${playerAction === 'blk' ? ' <span class="dng-dim">(blocked)</span>' : ''}`);
    }

    e.intent = this._dI(C, e);
    D.scouted = false;

    setTimeout(() => {
      this._dSync();
      if (p.hp <= 0) {
        D.log.push('💀 <b>Defeated!</b>');
        snd.dungeonDeath(); this._dSync();
        setTimeout(() => this._dEnd(false, true), 600);
        return;
      }
      D.busy = false;
      this._dUpdateIntent(e, C);
      this._dEnableBtns();
    }, 150);
  }

  /** Update intent + stats in-place — no full re-render */
  _dUpdateIntent(e, C) {
    const D = this._dng;
    const mid = document.querySelector('.dng-center');
    if (mid) {
      const { iTag, iHint } = this._dIntentHtml(e, C, D.scouted);
      mid.innerHTML = `${iTag}${iHint ? `<div class="dng-hint">${iHint}</div>` : ''}`;
    }
    const p = D.p;
    const pt = document.getElementById('dng-pt');
    if (pt) pt.innerHTML = `<b>${Math.ceil(p.hp)}</b>/${Math.ceil(p.maxHp)} HP`;
    // Update stat line
    const stats = document.querySelectorAll('#dng-ps .dng-stat');
    if (stats.length >= 2) stats[1].textContent = `${Math.floor(p.atk)} ATK${p.pot > 0 ? ` · 💊${p.pot}` : ''}${p.x2 ? ' · ⚡2×' : ''}`;
  }

  /** After a free action (scout/potion), refresh button states */
  _dRefreshUtils() {
    const D = this._dng, p = D.p;
    document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => {
      const a = b.dataset.a;
      if (a === 'scout' && D.scouted) b.disabled = true;
      else if (a === 'pot' && p.pot <= 0) b.disabled = true;
      else if (a === 'heavy' && D.stunned) b.disabled = true;
      else b.disabled = false;
    });
    // Update potion label
    const potBtn = document.querySelector('[data-a="pot"]');
    if (potBtn) potBtn.innerHTML = `💊 ${p.pot > 0 ? `(${p.pot})` : '—'}`;
  }

  /** Re-enable all buttons after enemy turn */
  _dEnableBtns() {
    const D = this._dng, p = D.p;
    D.scouted = false; // reset scout for new turn
    document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => {
      const a = b.dataset.a;
      if (a === 'pot' && p.pot <= 0) { b.disabled = true; return; }
      if (a === 'heavy' && D.stunned) { b.disabled = true; b.textContent = '💀 Heavy (stun)'; return; }
      if (a === 'scout') { b.disabled = false; return; } // reset scout each turn
      b.disabled = false;
      if (a === 'heavy') b.textContent = '💀 Heavy';
    });
  }

  /* ══════  LOOT — inline  ══════ */
  _dLoot() {
    const D = this._dng, { C, p } = D;
    D.busy = false;
    const pool = [...C.loot].sort(() => Math.random() - 0.5).slice(0, 2);
    const btns = document.getElementById('dng-btns');
    if (btns) {
      btns.className = 'dng-loot-area'; // swap grid layout to loot layout
      btns.innerHTML = `<div class="dng-loot-head">🎁 Pick a reward</div>
        <div class="dng-loots">${pool.map((l, i) =>
          `<div class="dng-loot" data-li="${i}"><span class="dng-loot-ico">${l.icon}</span><span class="dng-loot-txt">${l.label}</span></div>`
        ).join('')}</div>`;
    }
    D.log.push('🎁 Choose a reward...');
    this._dSync();
    document.querySelectorAll('.dng-loot').forEach(el => el.addEventListener('click', () => {
      pool[parseInt(el.dataset.li)].apply(p);
      this.game.soundManager.dungeonLoot();
      this._dR();
    }));
  }

  /* ══════  END  ══════ */
  _dEnd(victory, died) {
    const D = this._dng, { C, floors, p } = D, g = this.game;
    const cleared = victory ? floors.length : D.fl;
    g.stats.dungeonBestRooms = Math.max(g.stats.dungeonBestRooms || 0, cleared);
    if (victory) {
      g.stats.dungeonBossesDefeated = (g.stats.dungeonBossesDefeated || 0) + 1;
      g.soundManager.dungeonVictory();
    }

    // Hide help tooltip if visible
    this._dHideTip();

    const tier = C.rewardTiers[String(cleared)] || (cleared > 0 ? 'normal' : null);
    let icon = victory ? '🏆' : cleared >= 3 ? '⭐' : cleared > 0 ? '🏃' : '💀';
    let title = victory ? 'DUNGEON CONQUERED!' : cleared > 0 ? `Cleared ${cleared}/${floors.length}` : 'Defeated';

    let rewardHtml = '', penaltyNote = '';
    if (tier) {
      let r = this._giveReward(tier, 'dungeon');
      if (died && !victory) {
        // Death penalty: lose half the reward (already given, so take it back)
        const penalty = Math.floor(r * 0.5);
        g.cookies = g.cookies.sub(penalty);
        r = r - penalty;
        penaltyNote = `<div class="dng-penalty">💀 Death penalty: -50% reward</div>`;
      }
      rewardHtml = `<div class="dng-reward">+${formatNumberInWords(r)} cookies</div>`;
    }

    this._show(`<div class="mini-game-card dungeon-card">
      <div class="dng-head">⚔️ Cookie Dungeon</div>
      <div class="dng-result">
        <div class="dng-r-icon">${icon}</div>
        <div class="dng-r-title">${title}</div>
        ${rewardHtml}${penaltyNote}
        <div class="dng-r-stats">HP: ${Math.ceil(p.hp)}/${Math.ceil(p.maxHp)} · ATK: ${Math.floor(p.atk)} · Best: ${g.stats.dungeonBestRooms}</div>
      </div>
      <div class="dng-btns"><button class="dng-b dng-b-run" id="dng-x">Close</button></div>
    </div>`);
    document.getElementById('dng-x')?.addEventListener('click', () => this._close());
  }

  /* ── helpers ── */
  _dFx(id, cls) {
    const el = document.getElementById(id);
    if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 400);
  }
  _dSync() {
    const D = this._dng; if (D.fl >= D.floors.length) return;
    const e = D.floors[D.fl], p = D.p;
    const php = Math.max(0, p.hp / p.maxHp * 100), ehp = Math.max(0, e.hp / e.maxHp * 100);
    const hpc = php > 50 ? '#22c55e' : php > 25 ? '#eab308' : '#ef4444';
    const pb = document.getElementById('dng-pb'); if (pb) { pb.style.width = php + '%'; pb.style.background = hpc; }
    const pg = document.getElementById('dng-pg'); if (pg) setTimeout(() => pg.style.width = php + '%', 400);
    const eb = document.getElementById('dng-eb'); if (eb) eb.style.width = ehp + '%';
    const eg = document.getElementById('dng-eg'); if (eg) setTimeout(() => eg.style.width = ehp + '%', 400);
    const pt = document.getElementById('dng-pt'); if (pt) pt.innerHTML = `<b>${Math.ceil(p.hp)}</b>/${Math.ceil(p.maxHp)} HP`;
    const et = document.getElementById('dng-et'); if (et) et.innerHTML = `<b>${Math.ceil(e.hp)}</b>/${e.maxHp} HP`;
    const logEl = document.getElementById('dng-log');
    if (logEl) { const ls = D.log.slice(-2); logEl.innerHTML = ls.map((l, i) => `<div class="dng-ll dng-ll-new" style="opacity:${i === ls.length - 1 ? 1 : 0.4}">${l}</div>`).join(''); }
  }

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

      const dir = C.directions[state.currentNum];
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
          <div class="safe-dial" id="safe-dial" style="transform: rotate(${state.dialAngle}deg)">
            ${this._safeDialTicks(C.dialMax)}
            <div class="safe-dial-pointer"></div>
          </div>
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
    };

    render();
  }

  _safeDialTicks(dialMax) {
    let ticks = '';
    for (let i = 0; i < dialMax; i++) {
      const angle = (i / dialMax) * 360;
      const isMajor = i % 5 === 0;
      ticks += `<div class="safe-tick${isMajor ? ' safe-tick-major' : ''}" style="transform: rotate(${angle}deg)">
        ${isMajor ? `<span class="safe-tick-label" style="transform: rotate(${-angle}deg)">${i}</span>` : ''}
      </div>`;
    }
    return ticks;
  }

  _safeBindDrag(state, C, combo, angleToDial, getCurrentNum, getDist) {
    const wrap = document.getElementById('safe-dial-wrap');
    const dial = document.getElementById('safe-dial');
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
    };
  }

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
      const dir = C.directions[state.currentNum];
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
  }

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

  /* ════════════════════════════════════════════════════════════
     🚀  COOKIE LAUNCH — slingshot projectile with bounce physics
     ════════════════════════════════════════════════════════════
     3 rounds. Flat ground, walls bounce cookie back.
     Drag back to aim + set power, release to launch.
     Cookie bounces and rolls — score counted when it stops.
  */

  _cookieLaunch() {
    const C = MINI_GAME_SETTINGS.cookieLaunch;
    const snd = this.game.soundManager;
    const GY = C.groundY;
    const launcherY = GY - 8; // cookie sits just above ground

    const state = {
      round: 0,
      totalScore: 0,
      roundScores: [],
      phase: 'aim',     // 'aim' | 'flight' | 'rolling' | 'scored'
      wind: 0,
      targetX: 0,
      wallBounced: false,
      obstacle: null,
      dragging: false,
      dragX: 0, dragY: 0,
      px: 0, py: 0, vx: 0, vy: 0,
      bounces: 0,
      trail: [],
      // Wind particles — simulate same physics as cookie for real reference
      windParticles: [],
      windSpawnTimer: 0,
      animFrame: null,
      canvas: null, ctx: null,
      _cleanup: null,
    };

    const initRound = () => {
      state.phase = 'aim';
      state.wind = C.windMin + Math.random() * (C.windMax - C.windMin);
      // Random distance between launcher and target
      const dist = C.targetDistMin + Math.random() * (C.targetDistMax - C.targetDistMin);
      state.targetX = Math.min(C.canvasWidth - 30, C.launcherX + dist);
      state.dragging = false;
      state.trail = [];
      state.px = C.launcherX;
      state.py = launcherY;
      state.vx = 0;
      state.vy = 0;
      state.bounces = 0;
      state.wallBounced = false;

      // Obstacle on round 3
      if (state.round + 1 >= C.obstacleRound) {
        const frac = C.obstacleXFracMin + Math.random() * (C.obstacleXFracMax - C.obstacleXFracMin);
        const ox = C.launcherX + (state.targetX - C.launcherX) * frac;
        const hFrac = C.obstacleHeightMin + Math.random() * (C.obstacleHeightMax - C.obstacleHeightMin);
        state.obstacle = { x: ox, height: GY * hFrac };
      } else {
        state.obstacle = null;
      }
      // Reset wind particles for new wind
      state.windParticles = [];
      state.windSpawnTimer = 0;
    };

    // Wind particle system — drift horizontally to show wind direction/strength
    const spawnWindParticle = () => {
      const w = state.wind;
      if (Math.abs(w) < 0.01) return;
      const fromLeft = w > 0;
      const x = fromLeft ? -5 : C.canvasWidth + 5;
      const y = 20 + Math.random() * (GY - 40);
      // Horizontal speed proportional to wind, with slight variation
      const speed = (Math.abs(w) * 25) + Math.random() * 1.5;
      const vx = (fromLeft ? 1 : -1) * speed;
      // Slight vertical wobble, no gravity
      const vy = (Math.random() - 0.5) * 0.3;
      state.windParticles.push({
        x, y, vx, vy,
        wobbleAmp: 0.2 + Math.random() * 0.4,
        wobbleSpeed: 0.04 + Math.random() * 0.04,
        life: 0, maxLife: 100 + Math.random() * 80,
        size: 1 + Math.random() * 1.5,
        opacity: 0.1 + Math.random() * 0.15,
      });
    };

    const updateWindParticles = () => {
      const w = state.wind;
      state.windSpawnTimer++;
      const spawnRate = Math.abs(w) > 0.04 ? 3 : 6;
      if (state.windSpawnTimer % spawnRate === 0 && Math.abs(w) > 0.01) {
        spawnWindParticle();
      }
      if (state.windParticles.length > 35) {
        state.windParticles = state.windParticles.slice(-35);
      }
      for (let i = state.windParticles.length - 1; i >= 0; i--) {
        const p = state.windParticles[i];
        p.x += p.vx;
        // Gentle vertical wobble (like dust/leaves in wind)
        p.y += p.vy + Math.sin(p.life * p.wobbleSpeed) * p.wobbleAmp;
        p.life++;
        if (p.life > p.maxLife || p.x < -20 || p.x > C.canvasWidth + 20) {
          state.windParticles.splice(i, 1);
        }
      }
    };

    initRound();

    const render = () => {
      const windLabel = state.wind > 0.02 ? 'Wind >>>' : state.wind < -0.02 ? '<<< Wind' : 'Calm';
      const windStrength = Math.abs(state.wind) < 0.02 ? '' :
        Math.abs(state.wind) < 0.04 ? ' (light)' : ' (strong)';

      this._show(`<div class="mini-game-card launch-card">
        <div class="mini-title">Cookie Launch <span class="mini-sub">Round ${state.round + 1}/${C.rounds}</span></div>
        <div class="launch-info">
          <span class="launch-wind">${windLabel}${windStrength}</span>
          <span class="launch-score">Score: ${state.totalScore}</span>
        </div>
        <canvas id="launch-canvas" width="${C.canvasWidth}" height="${C.canvasHeight}" class="launch-canvas"></canvas>
        <div class="launch-hint" id="launch-hint">Drag back from the cookie to aim, release to launch!${state.obstacle ? ' (Watch the wall!)' : ''}</div>
      </div>`);

      state.canvas = document.getElementById('launch-canvas');
      state.ctx = state.canvas.getContext('2d');
      this._launchDraw(state, C, launcherY);
      this._launchBind(state, C, snd, initRound, render, launcherY, updateWindParticles);

      // Animate wind particles during aim phase
      const aimLoop = () => {
        if (state.phase !== 'aim' || !state.ctx) return;
        updateWindParticles();
        this._launchDraw(state, C, launcherY);
        state.animFrame = requestAnimationFrame(aimLoop);
      };
      state.animFrame = requestAnimationFrame(aimLoop);
    };

    render();
  }

  _launchDraw(state, C, launcherY) {
    const ctx = state.ctx;
    if (!ctx) return;
    const W = C.canvasWidth, H = C.canvasHeight, GY = C.groundY;

    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#0d0620');
    sky.addColorStop(0.5, '#1a0d30');
    sky.addColorStop(1, '#2d1a0a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GY);

    // Moon
    ctx.beginPath();
    ctx.arc(W - 60, 40, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,240,200,0.12)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W - 60, 40, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,240,200,0.08)';
    ctx.fill();

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 137.5 + 43) % W;
      const sy = (i * 73.3 + 17) % (GY * 0.4);
      const sz = (i % 3 === 0) ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }

    // Distant hills silhouette
    ctx.fillStyle = '#1a0e08';
    ctx.beginPath();
    ctx.moveTo(0, GY);
    for (let x = 0; x <= W; x += 20) {
      const h = Math.sin(x * 0.008) * 25 + Math.sin(x * 0.02 + 1) * 12 + 30;
      ctx.lineTo(x, GY - h);
    }
    ctx.lineTo(W, GY);
    ctx.fill();

    // Ground — layered for depth
    const ground = ctx.createLinearGradient(0, GY, 0, H);
    ground.addColorStop(0, '#5a3921');
    ground.addColorStop(0.3, '#4a2e18');
    ground.addColorStop(1, '#3a2010');
    ctx.fillStyle = ground;
    ctx.fillRect(0, GY, W, H - GY);
    // Ground surface highlight
    ctx.fillStyle = '#7a4f2e';
    ctx.fillRect(0, GY, W, 2);
    ctx.fillStyle = 'rgba(139,94,52,0.4)';
    ctx.fillRect(0, GY + 2, W, 1);
    // Grass tufts
    ctx.fillStyle = '#4a7a3a';
    for (let i = 0; i < W; i += 14) {
      const tx2 = i + (i * 7 % 9);
      ctx.fillRect(tx2, GY - 3, 1.5, 5);
      ctx.fillStyle = '#3d6b2e';
      ctx.fillRect(tx2 + 3, GY - 2, 1, 4);
      ctx.fillStyle = '#4a7a3a';
    }

    // Wind arrow — centered in the play area (between launcher and canvas middle height)
    if (Math.abs(state.wind) > 0.02) {
      const dir = state.wind > 0 ? 1 : -1;
      const mag = Math.min(1, Math.abs(state.wind) / 0.06);
      const arrowLen = 20 + mag * 20;
      ctx.save();
      ctx.strokeStyle = `rgba(173,216,230,${0.3 + mag * 0.4})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      // Center of play area
      const wx = (C.launcherX + state.targetX) / 2;
      const wy = GY / 2;
      ctx.beginPath();
      ctx.moveTo(wx - dir * arrowLen, wy);
      ctx.lineTo(wx + dir * arrowLen, wy);
      ctx.lineTo(wx + dir * (arrowLen - 8), wy - 6);
      ctx.moveTo(wx + dir * arrowLen, wy);
      ctx.lineTo(wx + dir * (arrowLen - 8), wy + 6);
      ctx.stroke();
      ctx.setLineDash([]);
      // Wind label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = `rgba(173,216,230,${0.4 + mag * 0.3})`;
      ctx.textAlign = 'center';
      ctx.fillText('WIND', wx, wy - 12);
      ctx.restore();
    }

    // Wind particles — streaks showing wind direction and speed
    for (const p of state.windParticles) {
      const a = p.opacity;
      // Draw as a short streak in direction of travel
      const len = Math.min(8, Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 2.5);
      const ang = Math.atan2(p.vy, p.vx);
      ctx.strokeStyle = `rgba(200,220,240,${a.toFixed(3)})`;
      ctx.lineWidth = p.size * 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(ang) * len, p.y - Math.sin(ang) * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // Obstacle wall (round 3+)
    if (state.obstacle) {
      const ob = state.obstacle;
      const obTop = GY - ob.height;
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(ob.x - C.obstacleWidth / 2, obTop, C.obstacleWidth, ob.height);
      // Brick lines
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.5;
      for (let y = obTop; y < GY; y += 10) {
        const offset = (Math.floor((y - obTop) / 10) % 2) * 5;
        ctx.beginPath();
        ctx.moveTo(ob.x - C.obstacleWidth / 2, y);
        ctx.lineTo(ob.x + C.obstacleWidth / 2, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ob.x - C.obstacleWidth / 2 + offset, y);
        ctx.lineTo(ob.x - C.obstacleWidth / 2 + offset, y + 10);
        ctx.stroke();
      }
      // Top cap
      ctx.fillStyle = '#8b5e34';
      ctx.fillRect(ob.x - C.obstacleWidth / 2 - 2, obTop - 3, C.obstacleWidth + 4, 5);
    }

    // Target rings (on ground)
    const tx = state.targetX;
    ctx.beginPath();
    ctx.arc(tx, GY, C.okRadius, Math.PI, 0);
    ctx.fillStyle = 'rgba(96,165,250,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(96,165,250,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, GY, C.greatRadius, Math.PI, 0);
    ctx.fillStyle = 'rgba(74,222,128,0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,222,128,0.4)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, GY, C.bullseyeRadius, Math.PI, 0);
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Flag pole
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx, GY);
    ctx.lineTo(tx, GY - 35);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(tx, GY - 35);
    ctx.lineTo(tx + 14, GY - 30);
    ctx.lineTo(tx, GY - 25);
    ctx.fill();

    // Launcher slingshot fork
    ctx.strokeStyle = '#8b5e34';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(C.launcherX - 10, GY);
    ctx.lineTo(C.launcherX - 8, GY - 18);
    ctx.moveTo(C.launcherX + 10, GY);
    ctx.lineTo(C.launcherX + 8, GY - 18);
    ctx.stroke();

    // Trail — fading gradient
    if (state.trail.length > 2) {
      const tLen = state.trail.length;
      for (let i = 1; i < tLen; i++) {
        const alpha = (i / tLen) * 0.4;
        ctx.strokeStyle = `rgba(255,200,100,${alpha.toFixed(3)})`;
        ctx.lineWidth = 1 + (i / tLen) * 1.5;
        ctx.beginPath();
        ctx.moveTo(state.trail[i - 1].x, state.trail[i - 1].y);
        ctx.lineTo(state.trail[i].x, state.trail[i].y);
        ctx.stroke();
      }
    }

    // ── Cookie + aim UI ──
    if (state.phase === 'aim') {
      ctx.font = '20px serif';
      ctx.textAlign = 'center';

      if (state.dragging) {
        const dx = C.launcherX - state.dragX;
        const dy = launcherY - state.dragY;
        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), C.maxDrag);
        const ang = Math.atan2(dy, dx);

        // Rubber bands
        ctx.strokeStyle = '#c89050';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(C.launcherX - 8, launcherY - 10);
        ctx.lineTo(state.dragX, state.dragY);
        ctx.moveTo(C.launcherX + 8, launcherY - 10);
        ctx.lineTo(state.dragX, state.dragY);
        ctx.stroke();

        // Power bar
        const power = dist / C.maxDrag;
        ctx.fillStyle = power > 0.7 ? '#ef4444' : power > 0.4 ? '#ffd700' : '#4ade80';
        ctx.fillRect(10, H - 16, power * 50, 5);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(10, H - 16, 50, 5);

        // Trajectory preview — limited frames, does NOT include wind
        const pvx = Math.cos(ang) * dist * C.powerScale;
        const pvy = Math.sin(ang) * dist * C.powerScale;
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        let ppx = C.launcherX, ppy = launcherY, svx = pvx, svy = pvy;
        ctx.moveTo(ppx, ppy);
        for (let t = 0; t < C.previewMaxFrames; t++) {
          ppx += svx; ppy += svy;
          svy += C.gravity;
          if (ppy > GY || ppx > W || ppx < 0) break;
          ctx.lineTo(ppx, ppy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Cookie at drag point
        ctx.fillText('🍪', state.dragX, state.dragY + 2);
      } else {
        ctx.fillText('🍪', C.launcherX, launcherY + 2);
      }
    } else if (state.phase === 'flight' || state.phase === 'rolling') {
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🍪', state.px, state.py + 2);
    } else if (state.phase === 'scored') {
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🍪', state.px, state.py + 2);

      const lastScore = state.roundScores[state.roundScores.length - 1];
      if (lastScore !== undefined) {
        ctx.font = 'bold 14px sans-serif';
        const isTrick = state.wallBounced && lastScore > 0;
        ctx.fillStyle = lastScore >= C.bullseyePoints ? '#ffd700' :
                        lastScore >= C.greatPoints ? '#4ade80' :
                        lastScore > 0 ? '#60a5fa' : '#ef4444';
        const label = lastScore >= C.bullseyePoints ? 'BULLSEYE!' :
                      lastScore >= C.greatPoints ? 'Great!' :
                      lastScore > 0 ? 'OK' : 'Miss!';
        const trickLabel = isTrick ? ' TRICKSHOT!' : '';
        ctx.fillText(`${label}${trickLabel} +${lastScore}`, state.px, state.py - 18);
      }
    }
  }

  _launchBind(state, C, snd, initRound, render, launcherY, updateWindParticles) {
    const canvas = state.canvas;
    if (!canvas) return;
    const W = C.canvasWidth, GY = C.groundY;
    const halfOb = C.obstacleWidth / 2;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = C.canvasWidth / rect.width;
      const scaleY = C.canvasHeight / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const nextRound = () => {
      state.round++;
      if (state.round >= C.rounds) {
        this._launchFinish(state, C);
      } else {
        initRound();
        render();
      }
    };

    // Obstacle collision check — returns true if collided (and adjusts velocity)
    const checkObstacle = () => {
      if (!state.obstacle) return false;
      const ob = state.obstacle;
      const obLeft = ob.x - halfOb;
      const obRight = ob.x + halfOb;
      const obTop = GY - ob.height;

      // Only check if cookie is within obstacle X range and below its top
      if (state.px >= obLeft - 6 && state.px <= obRight + 6 && state.py >= obTop) {
        // Determine which side we hit from
        const fromLeft = state.vx > 0 && state.px <= ob.x;
        const fromRight = state.vx < 0 && state.px >= ob.x;
        if (fromLeft || fromRight) {
          state.vx = -state.vx * C.wallBounce;
          state.px = fromLeft ? obLeft - 7 : obRight + 7;
          state.wallBounced = true;
          snd.launchBounce();
          return true;
        }
        // Hit from top
        if (state.vy > 0 && state.py <= obTop + 8) {
          state.vy = -state.vy * C.bounceRestitution;
          state.py = obTop - 1;
          snd.launchBounce();
          return true;
        }
      }
      return false;
    };

    const onStart = (e) => {
      if (state.phase !== 'aim') return;
      e.preventDefault();
      state.dragging = true;
      const p = getPos(e);
      state.dragX = p.x;
      state.dragY = p.y;
      this._launchDraw(state, C, launcherY);
    };

    let lastStretchTick = 0;
    const onMove = (e) => {
      if (!state.dragging || state.phase !== 'aim') return;
      e.preventDefault();
      const p = getPos(e);
      state.dragX = p.x;
      state.dragY = p.y;

      // Stretch sound — throttled, pitch scales with power
      const now = Date.now();
      if (now - lastStretchTick > 80) {
        const dx2 = C.launcherX - state.dragX;
        const dy2 = launcherY - state.dragY;
        const d = Math.min(Math.sqrt(dx2 * dx2 + dy2 * dy2), C.maxDrag);
        if (d > 15) {
          snd.launchStretch(d / C.maxDrag);
          lastStretchTick = now;
        }
      }

      this._launchDraw(state, C, launcherY);
    };

    const onEnd = () => {
      if (!state.dragging || state.phase !== 'aim') return;
      state.dragging = false;

      const dx = C.launcherX - state.dragX;
      const dy = launcherY - state.dragY;
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), C.maxDrag);

      if (dist < 15) {
        this._launchDraw(state, C, launcherY);
        return;
      }

      const ang = Math.atan2(dy, dx);
      state.vx = Math.cos(ang) * dist * C.powerScale;
      state.vy = Math.sin(ang) * dist * C.powerScale;
      state.px = C.launcherX;
      state.py = launcherY;
      state.trail = [{ x: state.px, y: state.py }];
      state.bounces = 0;
      state.wallBounced = false;
      // Cancel aim animation loop before starting flight
      if (state.animFrame) cancelAnimationFrame(state.animFrame);
      state.phase = 'flight';
      snd.launchFire();
      // Wind whoosh — intensity based on wind strength
      const windStr = Math.min(1, Math.abs(state.wind) / 0.06);
      snd.launchWindWhoosh(windStr);

      const hint = document.getElementById('launch-hint');
      if (hint) hint.textContent = '';

      const scoreAndEnd = () => {
        state.phase = 'scored';
        const hitDist = Math.abs(state.px - state.targetX);
        let pts = C.missPoints;
        if (hitDist <= C.bullseyeRadius) { pts = C.bullseyePoints; snd.launchBullseye(); }
        else if (hitDist <= C.greatRadius) { pts = C.greatPoints; snd.launchHit(); }
        else if (hitDist <= C.okRadius) { pts = C.okPoints; snd.launchHit(); }
        else { snd.launchMiss(); }

        // Trickshot bonus for wall bounces
        if (state.wallBounced && pts > 0) {
          pts += C.trickshotBonus;
        }

        state.roundScores.push(pts);
        state.totalScore += pts;
        this._launchDraw(state, C, launcherY);
        setTimeout(nextRound, 1400);
      };

      const step = () => {
        if (state.phase !== 'flight' && state.phase !== 'rolling') return;
        updateWindParticles();

        if (state.phase === 'flight') {
          state.vx += state.wind;
          state.vy += C.gravity;
          state.px += state.vx;
          state.py += state.vy;
          state.trail.push({ x: state.px, y: state.py });

          // Wall bounces (left and right)
          if (state.px <= 6) {
            state.px = 6;
            state.vx = Math.abs(state.vx) * C.wallBounce;
            state.wallBounced = true;
            snd.launchBounce();
          } else if (state.px >= W - 6) {
            state.px = W - 6;
            state.vx = -Math.abs(state.vx) * C.wallBounce;
            state.wallBounced = true;
            snd.launchBounce();
          }

          // Obstacle collision
          checkObstacle();

          // Ground bounce
          if (state.py >= GY) {
            state.py = GY;
            state.bounces++;

            if (Math.abs(state.vy) > 1.5 && state.bounces <= C.maxBounces) {
              state.vy = -state.vy * C.bounceRestitution;
              state.vx *= C.bounceFriction;
              snd.launchBounce();
            } else {
              state.vy = 0;
              state.phase = 'rolling';
            }
          }
        }

        if (state.phase === 'rolling') {
          state.vx *= C.rollFriction;
          state.px += state.vx;
          state.py = GY;

          // Wall bounces while rolling
          if (state.px <= 6) {
            state.px = 6;
            state.vx = Math.abs(state.vx) * C.wallBounce;
            state.wallBounced = true;
          } else if (state.px >= W - 6) {
            state.px = W - 6;
            state.vx = -Math.abs(state.vx) * C.wallBounce;
            state.wallBounced = true;
          }

          // Obstacle collision while rolling
          if (state.obstacle) {
            const ob = state.obstacle;
            const obLeft = ob.x - halfOb;
            const obRight = ob.x + halfOb;
            if (state.px >= obLeft - 6 && state.px <= obRight + 6) {
              state.vx = -state.vx * C.wallBounce;
              state.px = state.vx > 0 ? obRight + 7 : obLeft - 7;
              state.wallBounced = true;
            }
          }

          // Stopped?
          if (Math.abs(state.vx) < C.rollStopThreshold) {
            state.vx = 0;
            scoreAndEnd();
            return;
          }
        }

        this._launchDraw(state, C, launcherY);
        state.animFrame = requestAnimationFrame(step);
      };

      state.animFrame = requestAnimationFrame(step);
    };

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    state._cleanup = () => {
      if (state.animFrame) cancelAnimationFrame(state.animFrame);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchend', onEnd);
    };
  }

  _launchFinish(state, C) {
    const score = state.totalScore;
    let tier = null;
    if (score >= C.legendaryThreshold) tier = 'legendary';
    else if (score >= C.epicThreshold) tier = 'epic';
    else if (score >= C.greatThreshold) tier = 'great';
    else if (score >= C.normalThreshold) tier = 'normal';

    const tierLabels = { legendary: 'LEGENDARY!', epic: 'EPIC!', great: 'GREAT!', normal: 'Nice!' };

    let rewardHtml = '';
    if (tier) {
      let reward = this._giveReward(tier, 'cookieLaunch');
      // Cookie Launch has higher payouts due to skill ceiling (bounce prediction, wind, obstacles)
      const launchBonus = Math.floor(reward * 0.5);
      this.game.cookies = this.game.cookies.add(launchBonus);
      this.game.stats.totalCookiesBaked = this.game.stats.totalCookiesBaked.add(launchBonus);
      reward += launchBonus;
      rewardHtml = `<div class="mini-reward">+${formatNumberInWords(reward)} cookies</div>`;
    }

    const roundDetails = state.roundScores.map((s) => {
      const base = s > C.trickshotBonus ? s - C.trickshotBonus : s;
      const isTrick = s > 0 && s !== base;
      const label = base >= C.bullseyePoints ? 'Bullseye' : base >= C.greatPoints ? 'Great' : base > 0 ? 'OK' : 'Miss';
      return `<span class="launch-round-score">${label} ${s}${isTrick ? ' (trick!)' : ''}</span>`;
    }).join('');

    this._show(`<div class="mini-game-card launch-card">
      <div class="mini-title">Cookie Launch</div>
      <div class="launch-result">
        <div class="launch-result-tier">${tier ? tierLabels[tier] : 'Keep practicing!'}</div>
        <div class="launch-result-total">Total: ${score} pts</div>
        <div class="launch-round-scores">${roundDetails}</div>
        ${rewardHtml}
      </div>
    </div>`);
    setTimeout(() => this._close(), C.resultDisplayMs);
  }

  /* ════════════════════════════════════════════════════════════
     📝  COOKIE WORDLE — guess a 5-letter baking word in 6 tries
     ════════════════════════════════════════════════════════════ */

  _cookieWordle() {
    const C = MINI_GAME_SETTINGS.cookieWordle;
    const snd = this.game.soundManager;
    const answer = C.words[Math.floor(Math.random() * C.words.length)];

    const state = {
      guesses: [],
      results: [],
      current: '',
      done: false,
      won: false,
      letterStates: {},
      _cleanup: null,
    };

    // ── Build initial DOM (once) ──
    let gridHtml = '';
    for (let row = 0; row < C.maxGuesses; row++) {
      gridHtml += '<div class="wordle-row">';
      for (let col = 0; col < C.wordLength; col++) {
        gridHtml += `<div class="wordle-cell" id="wc-${row}-${col}"></div>`;
      }
      gridHtml += '</div>';
    }

    const kbRows = [
      'QWERTYUIOP'.split(''),
      'ASDFGHJKL'.split(''),
      ['ENTER', ...'ZXCVBNM'.split(''), 'DEL'],
    ];
    let kbHtml = '';
    for (const kbRow of kbRows) {
      kbHtml += '<div class="wordle-kb-row">';
      for (const key of kbRow) {
        const wide = (key === 'ENTER' || key === 'DEL') ? ' wordle-key-wide' : '';
        kbHtml += `<button class="wordle-key${wide}" id="wk-${key}" data-key="${key}">${key === 'DEL' ? '⌫' : key}</button>`;
      }
      kbHtml += '</div>';
    }

    this._show(`<div class="mini-game-card wordle-card">
      <div class="mini-title">Cookie Wordle <button class="wordle-help-btn" id="wordle-help">?</button></div>
      <div class="wordle-grid">${gridHtml}</div>
      <div class="wordle-message" id="wordle-msg"></div>
      <div class="wordle-keyboard" id="wordle-kb">${kbHtml}</div>
    </div>`);

    // Help tooltip — hover-based like dungeon crawler
    const helpBtn = document.getElementById('wordle-help');
    if (helpBtn) {
      const showTip = () => {
        let tip = document.getElementById('wordle-tooltip');
        if (!tip) {
          tip = document.createElement('div');
          tip.id = 'wordle-tooltip';
          tip.className = 'wordle-tooltip';
          tip.innerHTML = `
            <div class="wordle-tip-title">How to Play</div>
            <p>Guess a 5-letter baking word in 6 tries.</p>
            <p>Type a word and press <b>Enter</b> to submit.</p>
            <div class="wordle-tip-grid">
              <div class="wordle-tip-item"><span class="wordle-tip-swatch" style="background:#538d4e"></span><span>Green = correct letter, correct spot</span></div>
              <div class="wordle-tip-item"><span class="wordle-tip-swatch" style="background:#b59f3b"></span><span>Yellow = correct letter, wrong spot</span></div>
              <div class="wordle-tip-item"><span class="wordle-tip-swatch" style="background:rgba(58,58,60,0.8)"></span><span>Gray = letter not in word</span></div>
            </div>
            <div class="wordle-tip-footer">All words are baking/cookie themed!</div>`;
          document.body.appendChild(tip);
        }
        const r = helpBtn.getBoundingClientRect();
        tip.style.top = (r.bottom + 8) + 'px';
        tip.style.left = Math.max(8, r.left - 140) + 'px';
        tip.style.opacity = '1';
        tip.style.pointerEvents = 'auto';
      };
      const hideTip = () => {
        const tip = document.getElementById('wordle-tooltip');
        if (tip) { tip.style.opacity = '0'; tip.style.pointerEvents = 'none'; }
      };
      helpBtn.addEventListener('mouseenter', showTip);
      helpBtn.addEventListener('mouseleave', hideTip);
      helpBtn.addEventListener('click', (e) => { e.stopPropagation(); showTip(); });
    }

    // ── In-place UI updates (no DOM rebuild) ──
    const updateGrid = () => {
      for (let row = 0; row < C.maxGuesses; row++) {
        for (let col = 0; col < C.wordLength; col++) {
          const cell = document.getElementById(`wc-${row}-${col}`);
          if (!cell) continue;

          if (row < state.guesses.length) {
            cell.textContent = state.guesses[row][col];
            cell.className = `wordle-cell wordle-${state.results[row][col]} wordle-reveal`;
            cell.style.animationDelay = `${col * 0.1}s`;
          } else if (row === state.guesses.length) {
            cell.textContent = col < state.current.length ? state.current[col] : '';
            cell.className = col < state.current.length ? 'wordle-cell wordle-filled' : 'wordle-cell';
            cell.style.animationDelay = '';
          } else {
            cell.textContent = '';
            cell.className = 'wordle-cell';
            cell.style.animationDelay = '';
          }
        }
      }
    };

    const updateKeyboard = () => {
      for (const key in state.letterStates) {
        const el = document.getElementById(`wk-${key}`);
        if (el) {
          el.className = el.className.replace(/\s*wordle-key-(correct|present|absent)/g, '');
          el.classList.add(`wordle-key-${state.letterStates[key]}`);
        }
      }
    };

    const showMessage = (text) => {
      const msg = document.getElementById('wordle-msg');
      if (msg) { msg.textContent = text; setTimeout(() => { if (msg) msg.textContent = ''; }, 1500); }
    };

    // ── Key handler ──
    const handleKey = (key) => {
      if (state.done) return;

      if (key === 'DEL') {
        if (state.current.length > 0) {
          state.current = state.current.slice(0, -1);
          snd.wordleDelete();
          updateGrid();
        }
        return;
      }

      if (key === 'ENTER') {
        if (state.current.length < C.wordLength) {
          showMessage('Not enough letters');
          snd.wordleInvalid();
          const rows = document.querySelectorAll('.wordle-row');
          const curRow = rows[state.guesses.length];
          if (curRow) {
            curRow.classList.remove('wordle-shake');
            void curRow.offsetWidth;
            curRow.classList.add('wordle-shake');
          }
          return;
        }

        const guess = state.current;
        const result = this._wordleEvaluate(guess, answer);
        state.guesses.push(guess);
        state.results.push(result);

        for (let i = 0; i < C.wordLength; i++) {
          const letter = guess[i];
          const r = result[i];
          const prev = state.letterStates[letter];
          if (r === 'correct') state.letterStates[letter] = 'correct';
          else if (r === 'present' && prev !== 'correct') state.letterStates[letter] = 'present';
          else if (!prev) state.letterStates[letter] = 'absent';
        }

        state.current = '';
        updateGrid();
        updateKeyboard();

        // Play reveal sounds — staggered per tile
        const correctCount = result.filter(r => r === 'correct').length;
        for (let i = 0; i < C.wordLength; i++) {
          setTimeout(() => {
            if (result[i] === 'correct') snd.wordleCorrect();
            else if (result[i] === 'present') snd.wordlePresent();
            else snd.wordleAbsent();
          }, i * 100);
        }

        if (guess === answer) {
          state.done = true;
          state.won = true;
          setTimeout(() => snd.miniGameWin(), C.wordLength * 100 + 100);
          setTimeout(() => this._wordleFinish(state, C), 1500);
          return;
        }

        if (state.guesses.length >= C.maxGuesses) {
          state.done = true;
          setTimeout(() => {
            showMessage(`It was ${answer}`);
            snd.wordleInvalid();
          }, C.wordLength * 100 + 100);
          setTimeout(() => this._wordleFinish(state, C), 2500);
          return;
        }

        return;
      }

      // Letter input
      if (state.current.length < C.wordLength) {
        state.current += key;
        snd.wordleType();
        updateGrid();
      }
    };

    // ── Bind on-screen keyboard (once) ──
    document.querySelectorAll('.wordle-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleKey(btn.dataset.key);
      });
    });

    // ── Bind physical keyboard (once) ──
    const keyHandler = (e) => {
      if (state.done) return;
      const k = e.key.toUpperCase();
      if (k === 'ENTER') handleKey('ENTER');
      else if (k === 'BACKSPACE') handleKey('DEL');
      else if (/^[A-Z]$/.test(k)) handleKey(k);
    };
    document.addEventListener('keydown', keyHandler);
    state._cleanup = () => document.removeEventListener('keydown', keyHandler);
  }

  _wordleEvaluate(guess, answer) {
    const result = new Array(guess.length).fill('absent');
    const answerArr = answer.split('');
    const used = new Array(guess.length).fill(false);

    // First pass: correct positions
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === answer[i]) {
        result[i] = 'correct';
        used[i] = true;
        answerArr[i] = null;
      }
    }
    // Second pass: present but wrong position
    for (let i = 0; i < guess.length; i++) {
      if (result[i] === 'correct') continue;
      const idx = answerArr.indexOf(guess[i]);
      if (idx !== -1) {
        result[i] = 'present';
        answerArr[idx] = null;
      }
    }
    return result;
  }

  _wordleFinish(state, C) {
    if (state._cleanup) state._cleanup();

    let tier = null;
    if (state.won) {
      const g = state.guesses.length;
      if (g <= C.legendaryGuesses) tier = 'legendary';
      else if (g <= C.epicGuesses) tier = 'epic';
      else if (g <= C.greatGuesses) tier = 'great';
      else tier = 'normal';
    }

    const tierLabels = { legendary: 'LEGENDARY!', epic: 'EPIC!', great: 'GREAT!', normal: 'Nice!' };

    let rewardHtml = '';
    if (tier) {
      const reward = this._giveReward(tier, 'cookieWordle');
      rewardHtml = `<div class="mini-reward">+${formatNumberInWords(reward)} cookies</div>`;
    }

    // Show compact results grid
    const gridEmoji = state.results.map(row =>
      row.map(r => r === 'correct' ? '🟩' : r === 'present' ? '🟨' : '⬛').join('')
    ).join('<br>');

    this._show(`<div class="mini-game-card wordle-card">
      <div class="mini-title">Cookie Wordle</div>
      <div class="wordle-result">
        <div class="wordle-result-tier">${state.won ? tierLabels[tier] : 'Better luck next time!'}</div>
        <div class="wordle-result-guesses">${state.won ? `${state.guesses.length}/${C.maxGuesses} guesses` : `The word was ${state.guesses.length > 0 ? '' : ''}...`}</div>
        <div class="wordle-result-grid">${gridEmoji}</div>
        ${rewardHtml}
      </div>
    </div>`);
    setTimeout(() => this._close(), C.resultDisplayMs);
  }
}
