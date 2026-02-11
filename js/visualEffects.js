import { formatNumberInWords } from "./utils.js";

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

    this.buildingIcons = [
      { name: "Cursor",     icon: "🖱️" },
      { name: "Grandma",    icon: "👵" },
      { name: "Farm",       icon: "🌾" },
      { name: "Factory",    icon: "🏭" },
      { name: "Mine",       icon: "⛏️" },
      { name: "Shipment",   icon: "🚀" },
      { name: "Alchemy Lab",icon: "⚗️" },
      { name: "Portal",     icon: "🌀" },
      { name: "Time Machine", icon: "⏳" },
      { name: "Antimatter Condenser", icon: "⚛️" },
      { name: "Prism",      icon: "🌈" },
      { name: "Chancemaker", icon: "🎰" },
      { name: "Fractal Engine", icon: "🔮" },
    ];

    this.newsMessages = [
      "News: cookie production is at an all-time high!",
      "Tip: click the golden cookie for massive bonuses!",
      "Grandma says: \"Back in my day, we baked by hand.\"",
      "Scientists discover cookie-based energy source.",
      "Breaking: local bakery can't keep up with demand!",
      "Cookie stocks soar as production accelerates.",
      "Rumor: ancient cookie recipe found in forgotten temple.",
      "Weather forecast: scattered cookie crumbs with a chance of sprinkles.",
      "Economists baffled by cookie-based economy.",
      "New study: clicking cookies is great exercise.",
      "Alert: cookie reserves reaching critical mass!",
      "Grandma's secret: always use real butter.",
      "Archaeologists unearth prehistoric cookie mold.",
      "Cookie monster sighted near factory district.",
      "Breaking: cookies declared the fifth food group.",
      "Local farms report record chocolate chip harvests.",
      "The cookie singularity approaches...",
      "Experts warn: too many cookies may cause happiness.",
      "Portal technology now powered entirely by cookies.",
      "Time travelers confirm: cookies are eternal.",
      "Breaking: world's largest cookie measured at 40 feet across.",
      "Grandma just unlocked a new recipe. She won't share it.",
      "Cookie dough futures hit record high on the stock exchange.",
      "Tip: upgrades stack multiplicatively. Buy them early!",
      "Scientists confirm: the universe smells faintly of vanilla.",
      "Local cursor union demands shorter clicking hours.",
      "New flavor discovered: quantum chocolate chip.",
      "Warning: cookie output exceeds local storage capacity.",
      "Grandma's advice: never trust a cookie that doesn't crumble.",
      "Shipment of cookies intercepted by hungry delivery drivers.",
      "Mining operation uncovers vast underground cookie vein.",
      "Factory workers report cookies are baking themselves now.",
      "Alchemy lab successfully turns lead into cookie dough.",
      "Portal malfunction sends cookies to parallel universe.",
      "Time machine retrieves cookies from the far future. They're still fresh.",
      "Antimatter condenser creates cookies from pure energy.",
      "Prism refracts sunlight into rainbow-flavored cookies.",
      "Chancemaker rolls a natural 20. Double cookie output!",
      "Fractal engine generates infinite cookie recursion. Delicious.",
      "Survey: 9 out of 10 grandmas recommend more grandmas.",
      "Cookie-based cryptocurrency launches. Somehow less volatile than Bitcoin.",
      "Motivational poster in factory reads: 'Every cookie counts.'",
      "Fun fact: if you stacked all your cookies, they'd reach the moon. Twice.",
      "Intern accidentally eats prototype cookie. Gains temporary omniscience.",
      "New law requires all buildings to be made of at least 30% cookie.",
      "Cookies per second now classified as a unit of measurement.",
      "Your cursor has filed a restraining order against your mouse.",
      "Grandma's book club is now just a cookie exchange ring.",
      "R&D team invents self-clicking cookie. Patent pending.",
      "Local news: residents complain about constant cookie smell. Secretly love it.",
    ];
  }

  /* ───────────────────────── bootstrap ───────────────────────── */
  init() {
    const panel = document.getElementById("stats");
    if (!panel) return;

    panel.innerHTML = `
      <div id="viewport-wrap">
        <!-- news ticker -->
        <div id="news-ticker">
          <span id="news-icon">📰</span>
          <span id="news-text">Welcome to Cookie Clicker!</span>
        </div>

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

    this._seedRain(40);
    this._seedShimmers(12);
    this._startAnimLoop();
    this._startNewsTicker();
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

  _makeRaindrop(randomY = false) {
    const w = this.canvas ? this.canvas.width : 600;
    const h = this.canvas ? this.canvas.height : 400;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20,
      size: Math.random() * 14 + 8,
      speed: Math.random() * 1.2 + 0.4,
      wobbleAmp: Math.random() * 1.5 + 0.3,
      wobbleSpeed: Math.random() * 0.03 + 0.01,
      wobblePhase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      opacity: Math.random() * 0.35 + 0.15,
    };
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
      r: Math.random() * 2.5 + 1,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.04 + 0.02,
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
      if (timestamp - lastTime < 32) return;
      lastTime = timestamp;

      if (!this.ctx || !this.canvas) return;
      const { width: W, height: H } = this.canvas;
      this.ctx.clearRect(0, 0, W, H);

      /* cookie rain — use cached bitmap */
      const cache = this._cookieCache;
      for (let i = 0; i < this.raindrops.length; i++) {
        const d = this.raindrops[i];
        d.y += d.speed;
        d.wobblePhase += d.wobbleSpeed;
        d.x += Math.sin(d.wobblePhase) * d.wobbleAmp;
        d.rotation += d.rotSpeed;

        if (d.y > H + 30) {
          this.raindrops[i] = this._makeRaindrop(false);
          continue;
        }

        this.ctx.globalAlpha = d.opacity;
        this.ctx.save();
        this.ctx.translate(d.x, d.y);
        this.ctx.rotate(d.rotation);
        const s = d.size / 28;
        this.ctx.drawImage(cache, -16 * s, -16 * s, 32 * s, 32 * s);
        this.ctx.restore();
      }

      /* shimmer sparkles — batch into single path per color */
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
      this.ctx.globalAlpha = 1;
    };
    requestAnimationFrame(loop);
  }

  /* ───────────────────────── news ticker ────────────────────── */
  _startNewsTicker() {
    const el = document.getElementById("news-text");
    if (!el) return;

    const rotate = () => {
      // mix in dynamic messages
      const dynamic = this._getDynamicNews();
      const pool = [...this.newsMessages, ...dynamic];

      // 1-in-50 chance of a rare news article
      if (Math.random() < 0.02) {
        const rarePool = [
          "BREAKING: Cookie discovered on Mars. NASA denies involvement.",
          "Grandma spotted bench-pressing a rolling pin. Authorities baffled.",
          "Time travelers warn: do NOT eat the cookie from 3024.",
          "Local man claims cookie talked to him. Cookie declines interview.",
          "Scientists prove cookies are 4th-dimensional objects. Nobody understands the paper.",
          "Cookie rain reported in downtown area. Citizens advised to bring plates.",
          "Philosopher asks: if a cookie crumbles and no one is around, does it make a sound?",
          "Aliens make first contact. They want the cookie recipe.",
          "Underground cookie fight club exposed. First rule: always share crumbs.",
          "Researchers find that 99.7% of the universe is made of cookies. The rest is milk.",
          "Portal to cookie dimension discovered in grandma's basement.",
          "EXCLUSIVE: Cookie monster reveals he's actually a cookie all along.",
          "Ancient prophecy foretold: 'When the cookies number as the stars, the baker shall ascend.'",
          "Quantum physicist bakes Schrodinger's Cookie. It's both delicious and stale.",
          "Cookie-powered spacecraft achieves light speed. Tastes slightly burnt.",
          "Breaking: the moon is actually a giant cookie. Always has been.",
          "Stock exchange replaced by cookie exchange. Economy thrives.",
          "Grandma achieves enlightenment through baking. Opens monastery.",
          "ERROR: Reality.js line 42: too many cookies. Wrapping to negative infinity.",
          "The simulation theory is true and we're all inside a cookie clicker game.",
        ];
        const rareMsg = rarePool[Math.floor(Math.random() * rarePool.length)];
        this.newsIndex = pool.length; // doesn't matter, we override
        el.classList.add("news-exit");
        setTimeout(() => {
          el.textContent = rareMsg;
          el.classList.remove("news-exit");
          el.classList.add("news-enter");
          setTimeout(() => el.classList.remove("news-enter"), 500);
        }, 400);
        // Easter egg: rare news spotted
        if (this.game.tutorial) this.game.tutorial.triggerEvent('rareNews');
        return;
      }

      this.newsIndex = (this.newsIndex + 1) % pool.length;

      el.classList.add("news-exit");
      setTimeout(() => {
        el.textContent = pool[this.newsIndex];
        el.classList.remove("news-exit");
        el.classList.add("news-enter");
        setTimeout(() => el.classList.remove("news-enter"), 500);
      }, 400);
    };

    this.newsTimer = setInterval(rotate, 6000);
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
    const delay = (Math.random() * 120 + 60) * 1000;
    this.goldenCookieTimer = setTimeout(() => this._spawnGoldenCookie(), delay);
  }

  _spawnGoldenCookie() {
    const el = document.getElementById("golden-cookie");
    if (!el) return;

    const wrap = document.getElementById("viewport-wrap");
    // Constrain golden cookie to the center region of the viewport
    const wW = wrap.clientWidth;
    const wH = wrap.clientHeight;
    const marginX = wW * 0.25;
    const marginY = wH * 0.25;
    const rangeX = wW * 0.5 - 70;
    const rangeY = wH * 0.5 - 70;
    el.style.left = (marginX + Math.random() * Math.max(rangeX, 40)) + "px";
    el.style.top  = (marginY + Math.random() * Math.max(rangeY, 40)) + "px";
    el.classList.remove("hidden");
    el.classList.add("golden-appear");

    // Tutorial: golden cookie appeared
    if (this.game.tutorial) this.game.tutorial.triggerEvent('goldenCookie');

    // Disappear after 12 seconds if not clicked
    this._goldenTimeout = setTimeout(() => {
      el.classList.add("golden-fade");
      setTimeout(() => {
        el.classList.add("hidden");
        el.classList.remove("golden-appear", "golden-fade");
        this._scheduleGoldenCookie();
      }, 600);
    }, 12000);
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
      if (roll < 0.45) {
        const bonus = Math.max(200, g.getEffectiveCPS() * 600);
        g.cookies += bonus;
        g.stats.totalCookiesBaked += bonus;
        msg = `🍀 Lucky! +${formatNumberInWords(bonus)}`;
      } else if (roll < 0.75) {
        g.startFrenzy('cps', 7, 77);
        msg = "🔥 Frenzy! 7x CPS for 77s!";
      } else if (roll < 0.9) {
        g.startFrenzy('click', 777, 13);
        msg = "⚡ Click Frenzy! 777x for 13s!";
      } else {
        const bonus = Math.max(5000, g.getEffectiveCPS() * 3600);
        g.cookies += bonus;
        g.stats.totalCookiesBaked += bonus;
        msg = `💎 Cookie Storm! +${formatNumberInWords(bonus)}`;
        // Easter egg: cookie storm (rarest golden reward)
        if (this.game.tutorial) this.game.tutorial.triggerEvent('cookieStorm');
      }
      g.stats.luckyClicks++;
      g.updateCookieCount();

      // Burst particles
      this._goldenBurst(el);

      // Show reward text
      this._showRewardText(msg);

      el.classList.add("hidden");
      el.classList.remove("golden-appear", "golden-fade");
      this._scheduleGoldenCookie();
    });
  }

  _goldenBurst(el) {
    const rect = el.getBoundingClientRect();
    const wrapRect = document.getElementById("viewport-wrap").getBoundingClientRect();
    const cx = rect.left - wrapRect.left + rect.width / 2;
    const cy = rect.top - wrapRect.top + rect.height / 2;
    const wrap = document.getElementById("viewport-wrap");

    for (let i = 0; i < 18; i++) {
      const spark = document.createElement("div");
      spark.className = "golden-spark";
      const angle = (Math.PI * 2 * i) / 18;
      const dist = Math.random() * 80 + 40;
      spark.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
      spark.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
      spark.style.left = cx + "px";
      spark.style.top  = cy + "px";
      wrap.appendChild(spark);
      setTimeout(() => spark.remove(), 700);
    }
  }

  _showRewardText(msg) {
    const wrap = document.getElementById("viewport-wrap");
    const el = document.createElement("div");
    el.className = "golden-reward-text";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  /* ───────────────────────── building showcase ──────────────── */
  updateBuildingShowcase() {
    const container = document.getElementById("building-showcase");
    if (!container) return;
    container.innerHTML = "";

    this.game.buildings.forEach((b, i) => {
      if (b.count <= 0) return;
      const iconData = this.buildingIcons[i] || { icon: "🏠" };
      const el = document.createElement("div");
      el.className = "showcase-building";
      el.innerHTML = `
        <span class="showcase-icon">${iconData.icon}</span>
        <span class="showcase-count">${b.count}</span>
        <span class="showcase-name">${b.name}</span>
      `;
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
    const milkHeight = Math.min(45, pct * 0.65);
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
    if (pct > 80) {
      // Golden milk
      el.style.background = "linear-gradient(to top, rgba(255,223,100,0.95), rgba(255,235,160,0.80))";
      if (wavePath) wavePath.style.fill = "rgba(255,235,160,0.80)";
    } else if (pct > 50) {
      // Lavender milk
      el.style.background = "linear-gradient(to top, rgba(220,210,255,0.95), rgba(230,220,255,0.80))";
      if (wavePath) wavePath.style.fill = "rgba(230,220,255,0.80)";
    } else if (pct > 25) {
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
        const milkName = pct > 80 ? "Golden Milk" : pct > 50 ? "Lavender Milk" : pct > 25 ? "Caramel Milk" : "Plain Milk";
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

  destroy() {
    cancelAnimationFrame(this._animFrame);
    clearInterval(this.newsTimer);
    clearTimeout(this.goldenCookieTimer);
    clearTimeout(this._goldenTimeout);
  }
}
