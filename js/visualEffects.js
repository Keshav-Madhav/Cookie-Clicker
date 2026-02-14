import { formatNumberInWords } from "./utils.js";
import { MiniGames } from "./miniGames.js";
import { getBuildingIcon } from "./buildingIcons.js";
import { VISUAL, NEWS, GOLDEN_COOKIE, MILK, INCOME_RAIN } from "./config.js";

/**
 * VisualEffects — manages the middle-panel "viewport" with
 * cookie rain, golden cookies, news ticker, building showcase,
 * milk level, and ambient shimmer particles.
 */
export class VisualEffects {
  constructor(game) {
    this.game = game;
    this.canvas = null;
    this.ctx = null;
    this.raindrops = [];
    this.shimmers = [];
    this.goldenCookieEl = null;
    this.goldenCookieTimer = null;
    this.newsIndex = 0;
    this.newsTimer = null;
    this._animFrame = null;

    // Dynamic rain intensity state
    this._rainSpeedMult = 1;
    this._rainTargetCount = VISUAL.rain.baseCount;
    this._rainBaseCount = VISUAL.rain.baseCount;
    this._lastIntensityUpdate = 0;

    // Pre-allocated burst pool (avoids per-burst GC)
    this._burstPoolCap = VISUAL.burst.poolCap;
    this._burstPool = new Array(this._burstPoolCap);
    this._burstCount = 0;  // active burst drops = _burstPool[0.._burstCount-1]
    for (let i = 0; i < this._burstPoolCap; i++) {
      this._burstPool[i] = { x:0, y:0, size:10, speed:1, wobbleAmp:0, wobbleSpeed:0, wobblePhase:0, rotation:0, rotSpeed:0, opacity:0 };
    }

    // News ticker pause state
    this._newsPaused = false;

    // User-togglable flags (synced with game.settings)
    this.particlesEnabled = true;
    this.shimmersEnabled = true;

    this.newsMessages = NEWS.messages;
  }

  /* ───────────────────────── bootstrap ───────────────────────── */
  init() {
    const panel = document.getElementById("stats");
    if (!panel) return;

    panel.innerHTML = `
      <div id="viewport-wrap">
        <!-- news broadcast bar -->
        <div id="news-broadcast">
          <div id="news-tv">
            <div id="news-tv-screen">
              <div id="news-anchor">
                <div class="anchor-head">
                  <div class="anchor-hair"></div>
                  <div class="anchor-face">
                    <div class="anchor-eyes">
                      <div class="anchor-eye"></div>
                      <div class="anchor-eye"></div>
                    </div>
                    <div class="anchor-mouth"></div>
                  </div>
                </div>
                <div class="anchor-body"></div>
              </div>
            </div>
            <div id="news-tv-frame"></div>
          </div>
          <div id="news-content">
            <div id="news-label">COOKIE NEWS</div>
            <div id="news-text-wrap">
              <span id="news-text">Welcome to Cookie Clicker!</span>
            </div>
            <div id="news-ticker-strip"></div>
          </div>
          <span id="news-play" title="Play a mini-game!"><span id="news-play-dpad"></span><span id="news-play-btns"></span></span>
        </div>
        <!-- mini-game overlay -->
        <div id="mini-game-overlay" class="hidden"></div>

        <!-- main viewport canvas (rain + shimmers) -->
        <canvas id="viewport-canvas"></canvas>

        <!-- milk level overlay -->
        <div id="milk-layer">
          <svg id="milk-wave" viewBox="0 0 1200 18" preserveAspectRatio="none">
            <path d="M0,9 C25,9 50,2 75,2 C100,2 125,9 150,9 C175,9 200,16 225,16 C250,16 275,9 300,9 C325,9 350,2 375,2 C400,2 425,9 450,9 C475,9 500,16 525,16 C550,16 575,9 600,9 C625,9 650,2 675,2 C700,2 725,9 750,9 C775,9 800,16 825,16 C850,16 875,9 900,9 C925,9 950,2 975,2 C1000,2 1025,9 1050,9 C1075,9 1100,16 1125,16 C1150,16 1175,9 1200,9 L1200,18 L0,18 Z"/>
          </svg>
        </div>
        <div id="milk-label"></div>

        <!-- golden cookie (hidden initially) -->
        <div id="golden-cookie" class="hidden">🍪</div>

        <!-- CPS live counter -->
        <div id="viewport-cps">
          <span id="viewport-cps-label">cookies per second:</span>
          <span id="viewport-cps-value">0</span>
        </div>

        <!-- building row -->
        <div id="building-showcase"></div>
      </div>
    `;

    this.canvas = document.getElementById("viewport-canvas");
    this.ctx = this.canvas.getContext("2d");
    this._resize();
    window.addEventListener("resize", () => this._resize());

    this._seedRain(VISUAL.rain.seedCount);
    this._seedShimmers(VISUAL.shimmers.seedCount);
    this._startAnimLoop();
    this._startNewsTicker();
    this.miniGames = new MiniGames(this.game);
    this.miniGames.init();
    this._scheduleGoldenCookie();
    this._setupGoldenCookieClick();

    // initial render
    this.updateBuildingShowcase();
    this.updateMilk();
    this.updateCPS();
  }

  /* ───────────────────────── canvas helpers ───────────────────── */
  _resize() {
    if (!this.canvas) return;
    const wrap = this.canvas.parentElement;
    this.canvas.width  = wrap.clientWidth;
    this.canvas.height = wrap.clientHeight;
  }

  /* ─── cookie rain ─── */
  _seedRain(n) {
    for (let i = 0; i < n; i++) {
      this.raindrops.push(this._makeRaindrop(true));
    }
  }

  /* ─── dynamic rain intensity ─── */

  /**
   * Recalculates rain intensity based on CPS using smooth log scaling.
   * The ambient rain visually represents your ongoing cookie income.
   * Called every ~500 ms.
   *
   * CPS        ~drops   speed
   * ────────   ──────   ─────
   *    0         40      1.0×
   *   10         48      1.08×
   *  100         56      1.16×
   *   1k         64      1.24×
   *  10k         72      1.32×
   * 100k         80      1.40×
   *   1M         88      1.48×
   *   1B        112      1.72×
   */
  _updateRainIntensity() {
    const g = this.game;
    const cps = g.getEffectiveCPS();

    // Smooth log-based scaling — rain grows with income
    const logCps = cps > 0 ? Math.log10(cps) : 0;
    let targetCount = Math.floor(this._rainBaseCount + logCps * VISUAL.rain.countScale);
    let speedMult   = 1 + logCps * VISUAL.rain.speedScale;

    // Frenzy overlay — income spike = rain spike
    if (g.frenzyActive) {
      if (g.frenzyType === 'click') {
        targetCount += VISUAL.rainFrenzy.clickExtraDrops;
        speedMult  *= VISUAL.rainFrenzy.clickSpeedMult;
      } else {
        targetCount += VISUAL.rainFrenzy.cpsExtraDrops;
        speedMult  *= VISUAL.rainFrenzy.cpsSpeedMult;
      }
    }

    // Clamp to reasonable values (raised cap — canvas rendering is cheap)
    targetCount = Math.min(VISUAL.rain.maxCount, Math.max(this._rainBaseCount, targetCount));
    speedMult   = Math.min(VISUAL.rain.maxSpeedMult, speedMult);

    this._rainTargetCount = targetCount;
    this._rainSpeedMult   = speedMult;

    // Grow / shrink the raindrop pool to match the target
    while (this.raindrops.length < this._rainTargetCount) {
      this.raindrops.push(this._makeRaindrop(true));
    }
    // Shrink: just truncate (objects are lightweight, GC handles them)
    if (this.raindrops.length > this._rainTargetCount) {
      this.raindrops.length = this._rainTargetCount;
    }
  }

  /**
   * Trigger a short burst of extra fast cookies.
   * Used for one-off events (golden cookie, achievement, building purchase, prestige).
   *
   * @param {number} count      how many burst cookies to spawn
   * @param {number} speedMult  speed multiplier for the burst (e.g. 2 = twice default)
   */
  triggerCookieBurst(count = VISUAL.burst.defaultCount, speedMult = VISUAL.burst.defaultSpeed) {
    for (let i = 0; i < count; i++) {
      if (this._burstCount >= this._burstPoolCap) break; // pool full
      const d = this._burstPool[this._burstCount];
      this._resetDrop(d, false);
      d.y = -(Math.random() * 60);
      d.speed *= speedMult;
      d.opacity = Math.random() * 0.5 + 0.3;
      d.size = Math.random() * 16 + 10;
      this._burstCount++;
    }
  }

  _makeRaindrop(randomY = false) {
    const w = this.canvas ? this.canvas.width : 600;
    const h = this.canvas ? this.canvas.height : 400;
    const rd = VISUAL.raindrop;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20,
      size: Math.random() * rd.sizeRange + rd.sizeMin,
      speed: Math.random() * rd.speedRange + rd.speedMin,
      wobbleAmp: Math.random() * rd.wobbleAmpRange + rd.wobbleAmpMin,
      wobbleSpeed: Math.random() * rd.wobbleSpeedRange + rd.wobbleSpeedMin,
      wobblePhase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      opacity: Math.random() * rd.opacityRange + rd.opacityMin,
    };
  }

  /** Reset an existing drop object in-place (zero allocation). */
  _resetDrop(d, randomY) {
    const w = this.canvas ? this.canvas.width : 600;
    const h = this.canvas ? this.canvas.height : 400;
    const rd = VISUAL.raindrop;
    d.x = Math.random() * w;
    d.y = randomY ? Math.random() * h : -20;
    d.size = Math.random() * rd.sizeRange + rd.sizeMin;
    d.speed = Math.random() * rd.speedRange + rd.speedMin;
    d.wobbleAmp = Math.random() * rd.wobbleAmpRange + rd.wobbleAmpMin;
    d.wobbleSpeed = Math.random() * rd.wobbleSpeedRange + rd.wobbleSpeedMin;
    d.wobblePhase = Math.random() * Math.PI * 2;
    d.rotation = Math.random() * Math.PI * 2;
    d.rotSpeed = (Math.random() - 0.5) * 0.02;
    d.opacity = Math.random() * rd.opacityRange + rd.opacityMin;
  }

  /* ─── shimmer sparkles ─── */
  _seedShimmers(n) {
    for (let i = 0; i < n; i++) {
      this.shimmers.push(this._makeShimmer());
    }
  }

  _makeShimmer() {
    const w = this.canvas ? this.canvas.width : 600;
    const h = this.canvas ? this.canvas.height : 400;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * VISUAL.shimmers.radiusRange + VISUAL.shimmers.radiusMin,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * VISUAL.shimmers.speedRange + VISUAL.shimmers.speedMin,
      color: ['#ffd700','#f8c471','#fff8dc','#ffe082'][Math.floor(Math.random()*4)],
    };
  }

  /* ───────────────────────── main animation loop ────────────── */
  _startAnimLoop() {
    // Pre-render cookie emoji to an offscreen canvas for performance
    this._cookieCache = document.createElement('canvas');
    this._cookieCache.width = 32;
    this._cookieCache.height = 32;
    const cctx = this._cookieCache.getContext('2d');
    cctx.font = '28px serif';
    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    cctx.fillText('🍪', 16, 16);

    let lastTime = 0;
    const loop = (timestamp) => {
      this._animFrame = requestAnimationFrame(loop);
      // Throttle to ~30fps for perf
      if (timestamp - lastTime < VISUAL.frameThrottleMs) return;
      lastTime = timestamp;

      if (!this.ctx || !this.canvas) return;
      const { width: W, height: H } = this.canvas;
      this.ctx.clearRect(0, 0, W, H);

      /* update rain intensity every ~500 ms */
      if (timestamp - this._lastIntensityUpdate > VISUAL.rain.intensityUpdateMs) {
        this._lastIntensityUpdate = timestamp;
        this._updateRainIntensity();
      }

      const sMult = this._rainSpeedMult;
      const cache = this._cookieCache;
      const ctx = this.ctx;

      /* cookie rain — setTransform eliminates save/restore overhead */
      if (this.particlesEnabled) {
      for (let i = 0, len = this.raindrops.length; i < len; i++) {
        const d = this.raindrops[i];
        d.y += d.speed * sMult;
        d.wobblePhase += d.wobbleSpeed;
        d.x += Math.sin(d.wobblePhase) * d.wobbleAmp;
        d.rotation += d.rotSpeed;

        if (d.y > H + 30) {
          this._resetDrop(d, false);  // recycle in-place, zero allocation
          continue;
        }

        const s = d.size / 28;
        const cos = Math.cos(d.rotation) * s;
        const sin = Math.sin(d.rotation) * s;
        ctx.globalAlpha = d.opacity;
        // setTransform = translate(x,y) * rotate * scale — no save/restore needed
        ctx.setTransform(cos, sin, -sin, cos, d.x, d.y);
        ctx.drawImage(cache, -16, -16, 32, 32);
      }
      } // end particlesEnabled

      /* burst cookies — swap-and-pop removal, no splice */
      for (let i = this._burstCount - 1; i >= 0; i--) {
        const d = this._burstPool[i];
        d.y += d.speed;
        d.wobblePhase += d.wobbleSpeed;
        d.x += Math.sin(d.wobblePhase) * d.wobbleAmp;
        d.rotation += d.rotSpeed;

        if (d.y > H + 30) {
          // Swap with last active, shrink active count — O(1) removal
          const last = this._burstCount - 1;
          if (i !== last) {
            const tmp = this._burstPool[i];
            this._burstPool[i] = this._burstPool[last];
            this._burstPool[last] = tmp;
          }
          this._burstCount--;
          continue;
        }

        const s = d.size / 28;
        const cos = Math.cos(d.rotation) * s;
        const sin = Math.sin(d.rotation) * s;
        ctx.globalAlpha = d.opacity;
        ctx.setTransform(cos, sin, -sin, cos, d.x, d.y);
        ctx.drawImage(cache, -16, -16, 32, 32);
      }

      // Reset transform for shimmer drawing below
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      /* shimmer sparkles — batch into single path per color */
      if (this.shimmersEnabled) {
      const colorGroups = {};
      for (const s of this.shimmers) {
        s.phase += s.speed;
        const alpha = (Math.sin(s.phase) + 1) / 2 * 0.7 + 0.1;
        const scale = (Math.sin(s.phase * 1.3) + 1) / 2 * 0.6 + 0.7;
        const r = s.r * scale;
        const key = s.color + '|' + (alpha * 10 | 0);
        if (!colorGroups[key]) colorGroups[key] = { color: s.color, alpha, points: [] };
        colorGroups[key].points.push({ x: s.x, y: s.y, r });
      }
      for (const key in colorGroups) {
        const g = colorGroups[key];
        this.ctx.globalAlpha = g.alpha;
        this.ctx.fillStyle = g.color;
        this.ctx.beginPath();
        for (const p of g.points) {
          this.ctx.moveTo(p.x, p.y - p.r * 2);
          this.ctx.lineTo(p.x + p.r * 0.4, p.y - p.r * 0.4);
          this.ctx.lineTo(p.x + p.r * 2, p.y);
          this.ctx.lineTo(p.x + p.r * 0.4, p.y + p.r * 0.4);
          this.ctx.lineTo(p.x, p.y + p.r * 2);
          this.ctx.lineTo(p.x - p.r * 0.4, p.y + p.r * 0.4);
          this.ctx.lineTo(p.x - p.r * 2, p.y);
          this.ctx.lineTo(p.x - p.r * 0.4, p.y - p.r * 0.4);
          this.ctx.closePath();
        }
        this.ctx.fill();
      }
      } // end shimmersEnabled
      this.ctx.globalAlpha = 1;
    };
    requestAnimationFrame(loop);
  }

  /* ───────────────────────── news ticker ────────────────────── */
  _startNewsTicker() {
    const el = document.getElementById("news-text");
    if (!el) return;

    const rotate = () => {
      // Skip rotation if paused (tutorial tip is showing)
      if (this._newsPaused) return;

      // mix in dynamic messages
      const dynamic = this._getDynamicNews();
      const pool = [...this.newsMessages, ...dynamic];

      // 1-in-100 chance of a rare news article
      if (Math.random() < NEWS.rareChance) {
        const rarePool = NEWS.rareMessages;
        const rareMsg = rarePool[Math.floor(Math.random() * rarePool.length)];
        this.newsIndex = pool.length; // doesn't matter, we override
        el.classList.add("news-exit");

        // Anchor reacts to rare news + TV static effect
        const anchor = document.getElementById("news-anchor");
        const broadcast = document.getElementById("news-broadcast");
        const tvScreen = document.getElementById("news-tv-screen");
        if (anchor) { anchor.classList.add("anchor-excited"); }
        if (broadcast) { broadcast.classList.add("broadcast-rare"); }
        if (tvScreen) {
          tvScreen.classList.add("tv-static");
          setTimeout(() => {
            tvScreen.classList.remove("tv-static");
            tvScreen.classList.add("tv-color-bars");
            setTimeout(() => tvScreen.classList.remove("tv-color-bars"), 1600);
          }, 400);
        }

        setTimeout(() => {
          el.textContent = "✨ " + rareMsg;
          el.classList.remove("news-exit");
          el.classList.add("news-enter", "news-rare");
          if (broadcast) { broadcast.classList.remove("broadcast-speak"); void broadcast.offsetWidth; broadcast.classList.add("broadcast-speak"); }
          setTimeout(() => el.classList.remove("news-enter"), 500);
          // Keep rare styling longer, then fade it out
          setTimeout(() => {
            el.classList.remove("news-rare");
            if (anchor) anchor.classList.remove("anchor-excited");
            if (broadcast) broadcast.classList.remove("broadcast-rare");
          }, NEWS.rareStylingMs);
        }, 400);
        // Easter egg: rare news spotted
        if (this.game.tutorial) this.game.tutorial.triggerEvent('rareNews');
        // Rare headlines stay visible longer — skip the next 2 rotations
        clearInterval(this.newsTimer);
        setTimeout(() => {
          this.newsTimer = setInterval(rotate, NEWS.rotationIntervalMs);
        }, NEWS.rareLingerMs);
        return;
      }

      this.newsIndex = (this.newsIndex + 1) % pool.length;

      el.classList.add("news-exit");
      setTimeout(() => {
        el.textContent = pool[this.newsIndex];
        el.classList.remove("news-exit");
        el.classList.add("news-enter");
        // Broadcast speak animation
        const broadcast = document.getElementById("news-broadcast");
        if (broadcast) { broadcast.classList.remove("broadcast-speak"); void broadcast.offsetWidth; broadcast.classList.add("broadcast-speak"); }
        setTimeout(() => el.classList.remove("news-enter"), 500);
      }, 400);
    };

    this.newsTimer = setInterval(rotate, NEWS.rotationIntervalMs);
  }

  _getDynamicNews() {
    const msgs = [];
    const g = this.game;
    const cps = g.getEffectiveCPS();
    if (cps > 0) msgs.push(`Your bakeries are churning out ${formatNumberInWords(cps)} cookies every second!`);
    const total = g.stats.totalCookiesBaked;
    if (total > 1000) msgs.push(`Over ${formatNumberInWords(total)} cookies have been baked in total!`);
    if (g.stats.totalClicks > 100) msgs.push(`You've clicked ${formatNumberInWords(g.stats.totalClicks)} times! Your fingers must be tired.`);
    const buildings = g.getTotalBuildingCount();
    if (buildings > 10) msgs.push(`You now own ${buildings} buildings across your cookie empire.`);
    if (g.prestige.heavenlyChips > 0) msgs.push(`Your ${formatNumberInWords(g.prestige.heavenlyChips)} heavenly chips glow with prestige.`);
    if (g.frenzyActive) msgs.push("FRENZY IS ACTIVE! Bake faster!");
    return msgs;
  }

  /* ───────────────────────── golden cookie ──────────────────── */
  _scheduleGoldenCookie() {
    // Appear every 60-180 seconds
    const delay = (Math.random() * GOLDEN_COOKIE.delayRangeSec + GOLDEN_COOKIE.delayMinSec) * 1000;
    this.goldenCookieTimer = setTimeout(() => this._spawnGoldenCookie(), delay);
  }

  _spawnGoldenCookie() {
    const el = document.getElementById("golden-cookie");
    if (!el) return;

    const wrap = document.getElementById("viewport-wrap");
    // Constrain golden cookie to the center region of the viewport
    const wW = wrap.clientWidth;
    const wH = wrap.clientHeight;
    const marginX = wW * GOLDEN_COOKIE.positionMargin;
    const marginY = wH * GOLDEN_COOKIE.positionMargin;
    const rangeX = wW * 0.5 - 70;
    const rangeY = wH * 0.5 - 70;
    el.style.left = (marginX + Math.random() * Math.max(rangeX, 40)) + "px";
    el.style.top  = (marginY + Math.random() * Math.max(rangeY, 40)) + "px";
    el.classList.remove("hidden");
    el.classList.add("golden-appear");

    // Tutorial: golden cookie appeared
    if (this.game.tutorial) this.game.tutorial.triggerEvent('goldenCookie');

    // Mobile badge: notify user a golden cookie appeared
    if (this.game._mobileNav) this.game._mobileNav.showGoldenBadge();

    // Disappear after 12 seconds if not clicked
    const fadeGolden = () => {
      // If tutorial tip is active, wait and retry
      if (this.game.tutorial && this.game.tutorial._eventBusy) {
        this._goldenTimeout = setTimeout(fadeGolden, 2000);
        return;
      }
      el.classList.add("golden-fade");
      setTimeout(() => {
        el.classList.add("hidden");
        el.classList.remove("golden-appear", "golden-fade");
        if (this.game._mobileNav) this.game._mobileNav.clearGoldenBadge();
        this._scheduleGoldenCookie();
      }, 600);
    };
    this._goldenTimeout = setTimeout(fadeGolden, GOLDEN_COOKIE.lifetimeMs);
  }

  _setupGoldenCookieClick() {
    const el = document.getElementById("golden-cookie");
    if (!el) return;

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      clearTimeout(this._goldenTimeout);

      // Reward
      const roll = Math.random();
      const g = this.game;
      let msg = "";
      let incomeAmount = 0;
      if (roll < GOLDEN_COOKIE.luckyRollMax) {
        const bonus = Math.max(GOLDEN_COOKIE.lucky.minCookies, g.getEffectiveCPS() * GOLDEN_COOKIE.lucky.cpsMultiplier);
        g.cookies += bonus;
        g.stats.totalCookiesBaked += bonus;
        msg = `🍀 Lucky! +${formatNumberInWords(bonus)}`;
        incomeAmount = bonus;
      } else if (roll < GOLDEN_COOKIE.frenzyRollMax) {
        g.startFrenzy('cps', GOLDEN_COOKIE.cpsFrenzy.multiplier, GOLDEN_COOKIE.cpsFrenzy.durationSec);
        msg = `🔥 Frenzy! ${GOLDEN_COOKIE.cpsFrenzy.multiplier}x CPS for ${GOLDEN_COOKIE.cpsFrenzy.durationSec}s!`;
      } else if (roll < GOLDEN_COOKIE.clickRollMax) {
        g.startFrenzy('click', GOLDEN_COOKIE.clickFrenzy.multiplier, GOLDEN_COOKIE.clickFrenzy.durationSec);
        msg = `⚡ Click Frenzy! ${GOLDEN_COOKIE.clickFrenzy.multiplier}x for ${GOLDEN_COOKIE.clickFrenzy.durationSec}s!`;
      } else {
        const bonus = Math.max(GOLDEN_COOKIE.cookieStorm.minCookies, g.getEffectiveCPS() * GOLDEN_COOKIE.cookieStorm.cpsMultiplier);
        g.cookies += bonus;
        g.stats.totalCookiesBaked += bonus;
        msg = `💎 Cookie Storm! +${formatNumberInWords(bonus)}`;
        incomeAmount = bonus;
        // Easter egg: cookie storm (rarest golden reward)
        if (this.game.tutorial) this.game.tutorial.triggerEvent('cookieStorm');
      }
      g.stats.luckyClicks++;
      g.updateCookieCount();

      // Income-proportional cookie rain (or small burst for frenzies)
      if (incomeAmount > 0) {
        this.triggerIncomeRain(incomeAmount);
      } else {
        this.triggerCookieBurst(VISUAL.burst.defaultCount, VISUAL.burst.defaultSpeed);
      }

      // Burst particles
      this._goldenBurst(el);

      // Show reward text
      this._showRewardText(msg);

      el.classList.add("hidden");
      el.classList.remove("golden-appear", "golden-fade");

      // Clear mobile badge
      if (this.game._mobileNav) this.game._mobileNav.clearGoldenBadge();

      this._scheduleGoldenCookie();
    });
  }

  _goldenBurst(el) {
    const rect = el.getBoundingClientRect();
    const wrapRect = document.getElementById("viewport-wrap").getBoundingClientRect();
    const cx = rect.left - wrapRect.left + rect.width / 2;
    const cy = rect.top - wrapRect.top + rect.height / 2;
    const wrap = document.getElementById("viewport-wrap");

    const gc = GOLDEN_COOKIE.clickBurst;
    for (let i = 0; i < gc.sparkCount; i++) {
      const spark = document.createElement("div");
      spark.className = "golden-spark";
      const angle = (Math.PI * 2 * i) / gc.sparkCount;
      const dist = Math.random() * gc.sparkDistRange + gc.sparkDistMin;
      spark.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
      spark.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
      spark.style.left = cx + "px";
      spark.style.top  = cy + "px";
      wrap.appendChild(spark);
      setTimeout(() => spark.remove(), gc.sparkRemovalMs);
    }
  }

  _showRewardText(msg) {
    const wrap = document.getElementById("viewport-wrap");
    const el = document.createElement("div");
    el.className = "golden-reward-text";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), GOLDEN_COOKIE.rewardTextMs);
  }

  /* ───────────────────────── building showcase ──────────────── */
  updateBuildingShowcase() {
    const container = document.getElementById("building-showcase");
    if (!container) return;
    container.innerHTML = "";

    this.game.buildings.forEach((b, i) => {
      if (b.count <= 0) return;
      const el = document.createElement("div");
      el.className = "showcase-building";

      const iconCanvas = getBuildingIcon(b.name, 28);
      iconCanvas.className = "showcase-icon";
      el.appendChild(iconCanvas);

      const countSpan = document.createElement("span");
      countSpan.className = "showcase-count";
      countSpan.textContent = b.count;
      el.appendChild(countSpan);

      const nameSpan = document.createElement("span");
      nameSpan.className = "showcase-name";
      nameSpan.textContent = b.name;
      el.appendChild(nameSpan);

      el.title = `${b.name}: ${b.count} owned\nProducing ${formatNumberInWords(b.count * b.cps)} CPS`;
      container.appendChild(el);
    });

    if (container.children.length === 0) {
      container.innerHTML = `<div class="showcase-empty">Purchase buildings to see them here!</div>`;
    }
  }

  /* ───────────────────────── milk level ─────────────────────── */
  updateMilk() {
    const el = document.getElementById("milk-layer");
    const label = document.getElementById("milk-label");
    if (!el) return;
    const achvMgr = this.game.achievementManager;
    const unlocked = achvMgr.getUnlockedCount();
    const total = achvMgr.getTotalCount();
    const pct = total > 0 ? (unlocked / total) * 100 : 0;
    // Milk rises from 0% to max 45% of panel height
    const milkHeight = Math.min(MILK.maxHeightPct, pct * MILK.heightFactor);
    el.style.height = milkHeight + "%";

    // Tutorial: milk rising event (once when milk first appears)
    if (pct > 0 && this.game.tutorial) {
      this.game.tutorial.triggerEvent('milkRising');
    }

    // Easter egg: milk at 69%
    if (Math.floor(pct) >= 69 && Math.floor(pct) <= 70 && this.game.tutorial) {
      this.game.tutorial.triggerEvent('niceMilk');
    }

    // Milk color shifts — solid, no transparency fade
    const wavePath = document.querySelector("#milk-wave path");
    if (pct > MILK.goldenThreshold) {
      // Golden milk
      el.style.background = "linear-gradient(to top, rgba(255,223,100,0.95), rgba(255,235,160,0.80))";
      if (wavePath) wavePath.style.fill = "rgba(255,235,160,0.80)";
    } else if (pct > MILK.lavenderThreshold) {
      // Lavender milk
      el.style.background = "linear-gradient(to top, rgba(220,210,255,0.95), rgba(230,220,255,0.80))";
      if (wavePath) wavePath.style.fill = "rgba(230,220,255,0.80)";
    } else if (pct > MILK.warmThreshold) {
      // Warm milk
      el.style.background = "linear-gradient(to top, rgba(255,240,220,0.95), rgba(255,245,230,0.80))";
      if (wavePath) wavePath.style.fill = "rgba(255,245,230,0.80)";
    } else {
      // Plain white milk
      el.style.background = "linear-gradient(to top, rgba(255,255,255,0.95), rgba(255,255,255,0.80))";
      if (wavePath) wavePath.style.fill = "rgba(255,255,255,0.80)";
    }

    // Update label
    if (label) {
      if (pct > 0) {
        const milkName = pct > MILK.goldenThreshold ? "Golden Milk" : pct > MILK.lavenderThreshold ? "Lavender Milk" : pct > MILK.warmThreshold ? "Caramel Milk" : "Plain Milk";
        label.textContent = `🥛 ${milkName} | ${Math.floor(pct)}% achievements`;
        label.classList.add("visible");
      } else {
        label.textContent = "";
        label.classList.remove("visible");
      }
    }
  }

  /* ───────────────────────── CPS counter ────────────────────── */
  updateCPS() {
    const el = document.getElementById("viewport-cps-value");
    if (el) el.textContent = formatNumberInWords(this.game.getEffectiveCPS());
  }

  /* ───────────────────────── called by game loop ────────────── */
  update() {
    this.updateCPS();
    this.updateBuildingShowcase();
    this.updateMilk();
  }

  /* ───────────── income-based cookie rain burst ─────────────
   * Spawns cookies proportional to the income relative to CPS.
   * Small income (1s of CPS) → gentle burst.
   * Big bonus (600s of CPS)  → dramatic cookie shower.
   */
  triggerIncomeRain(cookiesReceived) {
    const cps = Math.max(1, this.game.getEffectiveCPS());
    const secondsWorth = cookiesReceived / cps;

    // Burst count: log2 scaling, 5–120 range (pool supports up to 200)
    const count = Math.floor(Math.min(INCOME_RAIN.maxCount, Math.max(INCOME_RAIN.minCount, Math.log2(secondsWorth + 1) * INCOME_RAIN.countScale)));

    // Speed: bigger bonuses fall faster
    const speed = Math.min(INCOME_RAIN.maxSpeed, Math.max(INCOME_RAIN.minSpeed, 1.5 + Math.log10(secondsWorth + 1) * INCOME_RAIN.speedScale));

    this.triggerCookieBurst(count, speed);
  }

  /* ───────────────────────── pause / resume (for tutorial) ── */
  pauseNews()  { this._newsPaused = true; }
  resumeNews() { this._newsPaused = false; }

  destroy() {
    cancelAnimationFrame(this._animFrame);
    clearInterval(this.newsTimer);
    clearTimeout(this.goldenCookieTimer);
    clearTimeout(this._goldenTimeout);
  }
}
