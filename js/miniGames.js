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
      ctx.closePath();
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
        
      case 'umbrella':
        for (let i = 0; i <= resolution * 0.5; i++) {
          const angle = Math.PI + (i / (resolution * 0.5)) * Math.PI;
          points.push({
            x: cx + Math.cos(angle) * r,
            y: cy - r * 0.2 + Math.sin(angle) * r * 0.7
          });
        }
        const handleTop = cy - r * 0.2 + r * 0.7;
        const handleBottom = cy + r * 0.8;
        for (let i = 0; i <= resolution * 0.3; i++) {
          const t = i / (resolution * 0.3);
          points.push({
            x: cx,
            y: handleTop + t * (handleBottom - handleTop)
          });
        }
        for (let i = 0; i <= resolution * 0.2; i++) {
          const angle = -Math.PI / 2 + (i / (resolution * 0.2)) * Math.PI;
          points.push({
            x: cx - r * 0.15 + Math.cos(angle) * r * 0.15,
            y: handleBottom + Math.sin(angle) * r * 0.15
          });
        }
        break;
        
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
    const resultEl = document.getElementById('cutter-result');
    
    // Calculate final score
    const coveredPoints = pointScores.filter(s => s !== null);
    const coverage = coveredPoints.length / pointScores.length;
    const avgAccuracy = coveredPoints.length > 0 
      ? coveredPoints.reduce((a, b) => a + b, 0) / coveredPoints.length 
      : 0;
    
    // Final score combines coverage and accuracy
    const finalScore = Math.round((coverage * 0.4 + avgAccuracy * 0.6) * 100);
    
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
          <strong>How to play:</strong> Select a tower type below, then click on a <span class="td-highlight">brown cell</span> (not the path) to place it.
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

    // Grid cell click - place tower
    overlay.querySelectorAll('.td-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        if (phase !== 'planning' || !selectedTower || towersLeft <= 0) return;
        
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        
        if (cell.classList.contains('td-path') || cell.classList.contains('td-has-tower')) return;
        
        const towerType = cfg.towers.find(t => t.id === selectedTower);
        if (!towerType) return;

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

      const timerBar = document.getElementById('td-timer');
      if (timerBar) {
        timerBar.style.transition = 'none';
        timerBar.style.width = '100%';
        timerBar.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
        requestAnimationFrame(() => {
          timerBar.style.transition = `width ${cfg.battlePhaseMs / 1000}s linear`;
          timerBar.style.width = '0%';
        });
      }

      spawnInterval = setInterval(spawnEnemy, cfg.enemySpawnIntervalMs);
      spawnEnemy();
      
      lastTime = performance.now();
      battleLoop = requestAnimationFrame(updateBattle);

      setTimeout(() => {
        if (active && phase === 'battle') {
          endBattle();
        }
      }, cfg.battlePhaseMs);
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
          closestEnemy.element.classList.add('td-enemy-hit');
          setTimeout(() => closestEnemy.element.classList.remove('td-enemy-hit'), 100);
          
          // Update health bar
          const healthPct = Math.max(0, (closestEnemy.health / closestEnemy.maxHealth) * 100);
          if (closestEnemy.healthBar) {
            closestEnemy.healthBar.style.width = `${healthPct}%`;
          }
          
          if (closestEnemy.health <= 0) {
            enemiesKilled++;
            closestEnemy.element.classList.add('td-enemy-dead');
            setTimeout(() => closestEnemy.element.remove(), 200);
            enemies = enemies.filter(e => e !== closestEnemy);
            updateStats();
          }
        }
      });

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
          score += cfg.goodPoints;
          if (display) display.textContent = '✨';
          if (status) status.textContent = `+${cfg.goodPoints} Good!`;
        } else {
          // Too early — raw
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
          score += cfg.perfectPoints;
          perfectCount++;
          if (display) display.textContent = '⭐';
          if (status) status.textContent = `+${cfg.perfectPoints} PERFECT!`;
        } else {
          score += cfg.goodPoints;
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
              if (timeTaken < 3000) points += cfg.fastBonusPoints;
              score += points;
              if (problemEl) {
                problemEl.classList.add('math-correct');
                problemEl.textContent = `✅ +${points}!`;
              }
            } else {
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
}
