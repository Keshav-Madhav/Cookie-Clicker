import { formatNumberInWords } from "./utils.js";

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
    const cpsBonus = tier === "jackpot" ? cps * 120
                   : tier === "great"   ? cps * 60
                   :                      cps * 30;

    // Percentage of current cookies
    const cookiePercent = tier === "jackpot" ? 0.08
                        : tier === "great"   ? 0.05
                        :                      0.03;
    const cookieBonus = g.cookies * cookiePercent;

    // Click dedication bonus — scales with how much the player clicks
    const clickBonus = Math.sqrt(clicks) * (tier === "jackpot" ? 3 : tier === "great" ? 2 : 1);

    // Empire bonus — more buildings = bigger payoff
    const empireBonus = buildings * (tier === "jackpot" ? 15 : tier === "great" ? 8 : 4);

    // Prestige bonus
    const prestigeBonus = prestige * (tier === "jackpot" ? 5 : tier === "great" ? 3 : 1);

    // Minimum floor
    const floor = tier === "jackpot" ? 500 : tier === "great" ? 200 : 50;

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
    const symbols = ["🍪", "🎂", "🧁", "🍩", "🥐", "🍰", "👵", "⭐"];
    const pick = () => symbols[Math.floor(Math.random() * symbols.length)];
    let spinsLeft = 3;
    let totalReward = 0;

    const doSpin = () => {
      spinsLeft--;

      // Update the card content
      const overlay = document.getElementById("mini-game-overlay");
      if (!overlay) return;
      overlay.innerHTML = `
        <div class="mini-game-card">
          <div class="mini-title">🎰 Cookie Slots <span class="mini-sub">(${spinsLeft + 1}/3 spins)</span></div>
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
      }, 80);

      [800, 1400, 2000].forEach((delay, i) => {
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
          if (bar) { bar.style.transition = "width 5s linear"; bar.style.width = "0%"; }
          if (countEl) countEl.classList.remove("speed-go");
        });

        // End after 5 seconds
        setTimeout(() => {
          active = false;
          if (countEl) countEl.classList.add("mini-win");
          let msg, tier = null;
          if (clicks >= 40) { msg = `${clicks} clicks! Inhuman speed!`; tier = "great"; }
          else if (clicks >= 25) { msg = `${clicks} clicks! Impressive!`; tier = "normal"; }
          else if (clicks >= 15) { msg = `${clicks} clicks! Not bad!`; tier = "normal"; }
          else { msg = `${clicks} clicks. Keep practicing!`; }
          if (subEl) subEl.textContent = msg;

          if (tier) {
            const r = this._giveReward(tier, "speed");
            if (subEl) subEl.textContent += ` +${formatNumberInWords(r)} cookies!`;
          }
          setTimeout(() => this._close(), 2500);
        }, 5000);
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
    const overlay = this._show(`
      <div class="mini-game-card mini-catch-area" id="catch-area">
        <div class="mini-title">🍪 Cookie Catch! 6 seconds!</div>
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
      const emojis = ["🍪", "🍪", "🍪", "🧁", "🍩"];
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
      setTimeout(() => { if (cookie.parentNode) cookie.remove(); }, 1000);
      if (active) setTimeout(spawnCookie, 250 + Math.random() * 350);
    };

    spawnCookie();
    requestAnimationFrame(() => {
      const bar = document.getElementById("catch-timer");
      if (bar) { bar.style.transition = "width 6s linear"; bar.style.width = "0%"; }
    });

    setTimeout(() => {
      active = false;
      const el = document.getElementById("catch-count");
      if (el) el.classList.add("mini-win");
      const title = document.getElementById("catch-area")?.querySelector(".mini-title");
      let tier = null;
      if (score >= 15) { if (title) title.textContent = `${score} caught! Cookie ninja!`; tier = "great"; }
      else if (score >= 8) { if (title) title.textContent = `${score} caught! Quick hands!`; tier = "normal"; }
      else { if (title) title.textContent = `${score} caught. They're fast!`; }

      if (tier) {
        const r = this._giveReward(tier, "catch");
        if (title) title.textContent += ` +${formatNumberInWords(r)}!`;
      }
      setTimeout(() => this._close(), 2500);
    }, 6000);
  }

  /* ════════════════════════════════════════════════════════════
     🧠  TRIVIA  — expanded questions, shuffled options
     ════════════════════════════════════════════════════════════ */
  _trivia() {
    const questions = [
      { q: "What's the most expensive cookie ingredient?", a: ["Saffron", "Vanilla", "Butter", "Sugar"], correct: 0 },
      { q: "Where was the chocolate chip cookie invented?", a: ["Massachusetts", "France", "Italy", "California"], correct: 0 },
      { q: "What's a cookie called in the UK?", a: ["Biscuit", "Crumpet", "Scone", "Pastry"], correct: 0 },
      { q: "How many cookies does the avg American eat yearly?", a: ["~35 lbs", "~10 lbs", "~5 lbs", "~50 lbs"], correct: 0 },
      { q: "What year was the Oreo first sold?", a: ["1912", "1935", "1899", "1952"], correct: 0 },
      { q: "Which country eats the most cookies per capita?", a: ["Netherlands", "USA", "France", "Japan"], correct: 0 },
      { q: "What gives snickerdoodles their flavor?", a: ["Cinnamon sugar", "Nutmeg", "Ginger", "Cardamom"], correct: 0 },
      { q: "What's the cookie emoji unicode?", a: ["U+1F36A", "U+1F370", "U+1F382", "U+1F369"], correct: 0 },
      { q: "What does 'cookie' mean in Dutch?", a: ["Little cake", "Round bread", "Sweet disk", "Baked snack"], correct: 0 },
      { q: "Which Girl Scout cookie sells the most?", a: ["Thin Mints", "Samoas", "Tagalongs", "Do-si-dos"], correct: 0 },
      { q: "What's the world record for largest cookie weight?", a: ["~40,000 lbs", "~10,000 lbs", "~5,000 lbs", "~100,000 lbs"], correct: 0 },
      { q: "Fortune cookies were invented in which country?", a: ["USA (by Japanese immigrants)", "China", "Japan", "Korea"], correct: 0 },
      { q: "What's the key ingredient in macaron shells?", a: ["Almond flour", "Wheat flour", "Coconut flour", "Rice flour"], correct: 0 },
      { q: "Cookies were originally used for what?", a: ["Testing oven temperature", "Religious offerings", "Currency", "Medicine"], correct: 0 },
      { q: "What cookie has an 'O-R-E-O' on every piece?", a: ["Oreo", "Hydrox", "Chips Ahoy", "Nutter Butter"], correct: 0 },
      { q: "Milano cookies are made by which brand?", a: ["Pepperidge Farm", "Nabisco", "Keebler", "Pillsbury"], correct: 0 },
      { q: "What's the filling in an Oreo primarily made of?", a: ["Sugar & vegetable oil", "Cream cheese", "Butter", "Whipped cream"], correct: 0 },
      { q: "Which cookie is traditionally left for Santa?", a: ["Chocolate chip", "Oatmeal raisin", "Sugar cookie", "Gingerbread"], correct: 0 },
      { q: "Biscotti means what in Italian?", a: ["Twice baked", "Sweet bread", "Hard cookie", "Almond snack"], correct: 0 },
      { q: "What temperature is ideal for baking cookies (°F)?", a: ["350°F", "275°F", "425°F", "500°F"], correct: 0 },
    ];

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
        setTimeout(() => this._close(), 2500);
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
        setTimeout(() => this._close(), 2000);
      }
    }, 10000);
  }

  /* ════════════════════════════════════════════════════════════
     🧠  EMOJI MEMORY  — 5 pairs (10 cards)
     ════════════════════════════════════════════════════════════ */
  _emojiMemory() {
    const pool = ["🍪", "👵", "🏭", "🌾", "⚗️", "🚀", "🌀", "⏳", "⚛️", "🌈"];
    // Fisher-Yates to pick 5
    const shuffledPool = [...pool];
    for (let i = shuffledPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }
    const chosen = shuffledPool.slice(0, 5);
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
    const totalPairs = 5;

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
              let tier = moves <= 8 ? "great" : "normal";
              const r = this._giveReward(tier, "memory");
              if (res) {
                const ratingMsg = moves <= 8 ? "🎉 Incredible memory!" : moves <= 12 ? "🎉 Well done!" : "🎉 All matched!";
                res.textContent = `${ratingMsg} +${formatNumberInWords(r)} cookies!`;
                res.classList.add("mini-win");
              }
              setTimeout(() => this._close(), 2500);
            }
          } else {
            setTimeout(() => {
              a.card.textContent = "❓";
              b.card.textContent = "❓";
              a.card.classList.remove("memory-flipped");
              b.card.classList.remove("memory-flipped");
              flipped = [];
              checking = false;
            }, 600);
          }
        }
      });
    });

    // Auto-close after 25 seconds
    setTimeout(() => {
      if (matched < totalPairs) {
        const res = document.getElementById("memory-result");
        if (res) res.textContent = `⏰ Time's up! Found ${matched}/${totalPairs} pairs.`;
        if (matched >= 3) {
          const r = this._giveReward("normal", "memory");
          if (res) res.textContent += ` +${formatNumberInWords(r)}!`;
        }
        setTimeout(() => this._close(), 2000);
      }
    }, 25000);
  }
}
