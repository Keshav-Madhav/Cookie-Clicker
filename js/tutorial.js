/**
 * Tutorial System — guided onboarding + contextual event tips.
 *
 * Uses a box-shadow cutout overlay so the highlighted element is
 * the ONLY thing visible through the dark tint. Everything behind
 * the overlay remains fully clickable.  Event tips are queued so
 * they never clobber each other (e.g. achievement → milk).
 */
export class Tutorial {
  constructor(game) {
    this.game = game;

    /* ── persisted state ── */
    this.completed = false;
    this.currentStep = 0;
    this.activeSequence = null;
    this.seenEvents = new Set();

    /* ── event tip queue ── */
    this._eventQueue = [];          // pending {eventKey, dynamicTarget}
    this._eventBusy = false;        // true while a tip is on-screen
    this._eventCooldown = 3500;     // min ms between tips

    /* ── timing guards ── */
    this._waitTimer = null;
    this._advanceLock = false;

    /* ── DOM refs (created in init) ── */
    this.overlay = null;
    this.tooltip = null;
    this.skipBar = null;
    this.cutoutBox = null;          // the box-shadow cutout element

    /* ──────────────────────────────────────────────
       ONBOARDING SEQUENCE
       ────────────────────────────────────────────── */
    this.onboardingSteps = [
      {
        title: "Welcome to Cookie Clicker!",
        text: "Click the big cookie to start earning cookies. Every click adds to your total, and the more you click, the faster you grow!",
        target: "#cookie-button",
        position: "right",
      },
      {
        title: "Cookie Counter",
        text: "This is your cookie count, the total cookies you currently have to spend. Earn enough and you can buy buildings and upgrades to automate production.",
        target: "#click-area h1",
        position: "right",
      },
      {
        title: "Cookies Per Second",
        text: "This displays your CPS, cookies earned automatically each second from buildings you own. The higher this number, the faster your empire grows without clicking.",
        target: "#cps-count",
        position: "right",
      },
      {
        title: "Buy a Cursor",
        text: "The Cursor is your first auto-baker. It automatically clicks for you, producing 0.1 cookies per second. Purchase one as soon as you can afford it!",
        target: () => document.querySelector('#building-list .building'),
        position: "left",
        waitFor: "buildingPurchased",
      },
      {
        title: "Auto-Bakers",
        text: "Buildings are the backbone of your cookie empire. Each type produces cookies every second automatically. More expensive buildings generate far more CPS, so keep buying to unlock new ones!",
        target: "#building-list",
        position: "left",
      },
      {
        title: "Upgrades",
        text: "Upgrades give powerful permanent bonuses. They can multiply your click power, boost specific buildings, or unlock special abilities. Always buy upgrades when you can afford them!",
        target: "#upgrade-list",
        position: "left",
      },
      {
        title: "The Viewport",
        text: "This is your bakery overview. Watch the cookie rain, read the news ticker for fun messages, and keep an eye out for golden cookies. They give massive temporary bonuses when clicked!",
        target: "#stats",
        position: "left",
      },
      {
        title: "Cookie News Broadcast",
        text: "The news bar at the top keeps you updated with headlines about your bakery empire. Rare golden headlines appear occasionally with special messages. And see that little controller icon? Click it anytime to play a mini-game for bonus cookies!",
        target: "#news-broadcast",
        position: "bottom",
      },
      {
        title: "Power and Multipliers",
        text: "These bars show your production multipliers. Global multiplier comes from upgrades, Achievement multiplier grows as you unlock achievements (+2% each), and Prestige multiplier comes from Heavenly Chips. They all multiply together for your final output!",
        target: "#left-multipliers",
        position: "right",
      },
      {
        title: "Settings and Stats",
        text: "Click the gear icon to view detailed statistics, your full achievement list, and to replay this tutorial anytime.",
        target: "#menu-btn",
        position: "bottom-right",
      },
      {
        title: "You're all set!",
        text: "That covers the basics! Keep clicking, buy buildings to automate, grab upgrades for multipliers, and click golden cookies when they appear. Good luck, baker!",
        target: "#cookie-button",
        position: "right",
        isLast: true,
      },
    ];

    /* ──────────────────────────────────────────────
       EVENT-TRIGGERED TIPS  (shown once each, queued)
       ────────────────────────────────────────────── */
    this.eventTips = {
      firstUpgradeBuyable: {
        title: "Upgrade Available!",
        text: "You can now afford your first upgrade! Upgrades give powerful permanent bonuses, so click one in the shop to purchase it. Check the tooltip for details on what each upgrade does.",
        target: "#upgrade-list",
        position: "left",
      },
      firstAchievement: {
        title: "Achievement Unlocked!",
        text: "You just earned your first achievement! Every achievement you unlock permanently increases your CPS by 2%. Open the menu to browse all available achievements and plan your next milestone.",
        target: "#menu-btn",
        position: "bottom-right",
      },
      goldenCookie: {
        title: "Golden Cookie!",
        text: "A golden cookie just appeared in the viewport! Click it quickly before it disappears. It can reward you with a huge pile of bonus cookies, a CPS frenzy (7x production), or a click frenzy (777x click power)!",
        target: "#golden-cookie",
        position: "left",
      },
      frenzy: {
        title: "Frenzy Activated!",
        text: "Your production just got a massive temporary boost! During a CPS frenzy your cookies per second are multiplied, and during a Click Frenzy every click is worth hundreds of times more. Make the most of it while it lasts!",
        target: "#frenzy-indicator",
        position: "right",
      },
      milkRising: {
        title: "Milk is Rising!",
        text: "As you unlock achievements, milk gradually fills the viewport. The milk changes color at higher achievement thresholds, going from plain white, to caramel, lavender, and eventually golden milk. It's a visual badge of your progress!",
        target: "#milk-layer",
        position: "top",
      },
      prestigeAvailable: {
        title: "Prestige Available!",
        text: "You've baked enough cookies to Ascend! Prestiging will reset ALL your cookies, buildings, and upgrades, but in return you earn permanent Heavenly Chips. Each chip gives +1% CPS forever, and they stack across all future runs. It's the key to long-term exponential growth!",
        target: "#prestige-btn",
        position: "right",
      },
      touchUpgrade: {
        title: "Touch Upgrade!",
        text: "Touch upgrades (Iron Touch, Silver Touch, Golden Touch, etc.) each double your clicking power. They unlock at building count milestones, so the more buildings you own across all types, the stronger your clicks become!",
        target: null,
        position: "left",
      },
      offlineUpgrade: {
        title: "Offline Production!",
        text: "Offline Production upgrades let you earn cookies even when you close the game! Each tier increases the offline multiplier, and at the highest tier you can earn 3x your normal CPS while away. Great for overnight gains!",
        target: null,
        position: "left",
      },
      luckyClick: {
        title: "Lucky Click!",
        text: "You just triggered a Lucky Click, a random bonus event! These can give you 10 minutes worth of CPS instantly, start a 7x CPS frenzy, or even a 777x Click Frenzy. Buy Lucky Cookies upgrades to increase your luck chance!",
        target: "#cookie-button",
        position: "right",
      },
      powerMultiplier: {
        title: "Power Growing!",
        text: "Your Global CPS Multiplier just increased! This multiplier applies to ALL cookie production from every building. It stacks multiplicatively with your Achievement and Prestige multipliers, visible in the Power panel on the left.",
        target: "#left-multipliers",
        position: "right",
      },
      synergyUpgrade: {
        title: "Synergy Unlocked!",
        text: "Synergy upgrades create a link between two building types. Each unit of the source building adds bonus CPS to the target building. For example, each Grandma can boost your Farms. The more of both you own, the bigger the bonus!",
        target: null,
        position: "left",
      },
      cursorScaling: {
        title: "Thousand Fingers!",
        text: "Cursor scaling upgrades make every Cursor more powerful based on how many OTHER buildings you own. The more diverse your empire, the stronger each Cursor becomes. They scale with your entire operation!",
        target: null,
        position: "left",
      },
      frenzyDuration: {
        title: "Extended Frenzy!",
        text: "Frenzies now last longer! Duration upgrades multiply how long each frenzy lasts, giving you even more time at boosted production. Combine with higher lucky click chances for maximum impact!",
        target: null,
        position: "left",
      },

      /* ─────────────── EASTER EGGS / FUN TIPS ─────────────── */

      settingsOpened: {
        title: "Snooping Around?",
        text: "Welcome to the settings! Here you'll find your full stats, every achievement you've earned (and haven't), and the button to replay this very tutorial. Consider it your cookie scrapbook.",
        target: "#menu-panel",
        position: "left",
      },
      achievementScrollBottom: {
        title: "The Completionist",
        text: "You scrolled ALL the way to the bottom of the achievement list. That's either dedication or procrastination. Either way, respect. There are secrets hiding in every corner of this bakery...",
        target: null,
        position: "left",
      },
      upgradeMaxedOut: {
        title: "Maxed Out!",
        text: "You pushed an upgrade to its absolute limit. There's a special kind of satisfaction in seeing 'Maximum Level Reached', like filling the last page of a notebook. What will you max next?",
        target: null,
        position: "left",
      },
      niceMilk: {
        title: "Nice.",
        text: "Your achievement completion just hit the magic number. Perfectly balanced, as all things should be. The milk gods smile upon you today.",
        target: "#milk-layer",
        position: "top",
      },
      rareNews: {
        title: "Did You Catch That?",
        text: "A rare news article just scrolled by! The news ticker occasionally broadcasts ultra-rare messages. Blink and you'll miss them. Consider yourself a true connoisseur of cookie journalism.",
        target: "#news-broadcast",
        position: "bottom",
      },
      clickFrenzy777: {
        title: "JACKPOT!",
        text: "777x Click Frenzy! Every. Single. Click. Is worth 777 times more right now. Stop reading this and CLICK THAT COOKIE! This is the rarest and most powerful frenzy in the game!",
        target: "#cookie-button",
        position: "right",
      },

      cookieStorm: {
        title: "Cookie Storm!",
        text: "You just triggered the rarest golden cookie reward, a full Cookie Storm! That's a one-hour bonus of CPS dumped into your jar in an instant. The cookie gods have chosen you.",
        target: "#cookie-button",
        position: "right",
      },

      nightOwl: {
        title: "Night Owl Baker",
        text: "Baking cookies past midnight? The cookies taste better when nobody's watching. Night shifts at the bakery hit different. Just don't let the grandmas catch you snacking.",
        target: "#cookie-button",
        position: "right",
      },


      efficientBuyer: {
        title: "Efficient Buyer",
        text: "Using 'Max' to buy buildings? A true min-maxer. Why click ten times when one click empties the entire wallet? Your accountant would be proud. Or horrified. Probably both.",
        target: "#building-list",
        position: "left",
      },
      ocdSorter: {
        title: "Look At You, OCD Sorter",
        text: "You've tried every single sort option for the building list. Price, CPS, Efficiency, Owned, and back to Default. Everything in its right place. Marie Kondo would approve of your bakery.",
        target: "#purchase-amount-container",
        position: "left",
      },
      oooShiny: {
        title: "Ooo, Shiny!",
        text: "You clicked the prestige diamond! It IS very pretty, isn't it? Those Heavenly Chips sparkle with the weight of every cookie you've ever sacrificed. Can't. Stop. Staring.",
        target: "#left-prestige",
        position: "right",
      },
      rapidClicker: {
        title: "Carpal Tunnel Incoming",
        text: "15 clicks in under 2 seconds?! Your fingers are a blur. At this rate you should consider competitive cookie clicking. Yes, that's a thing now. You just invented it.",
        target: "#cookie-button",
        position: "right",
      },

      indecisiveClicker: {
        title: "The Indecisive Baker",
        text: "You've changed the purchase amount 6 times now. 1... no wait, 10... actually 25... hmm, Max? You know what, back to 1. Decision-making is hard when every cookie counts.",
        target: "#purchase-amount-container",
        position: "left",
      },
      firstPrestige: {
        title: "The Great Reset",
        text: "You actually did it. You sacrificed everything: every cookie, every building, every upgrade, all for a handful of shiny chips. Was it worth it? Ask yourself again in an hour when you're back on top, but stronger.",
        target: "#left-prestige",
        position: "right",
      },
      doubleFrenzy: {
        title: "Double Frenzy!",
        text: "A frenzy triggered DURING another frenzy? The cookie matrix is glitching. Your production just went absolutely nuclear. This is what peak cookie performance looks like.",
        target: "#frenzy-indicator",
        position: "right",
      },
    };

    /* ── rapid-click tracking ── */
    this._clickTimestamps = [];
    /* ── sort tracking ── */
    this._usedSorts = new Set();
    /* ── purchase amount change tracking ── */
    this._purchaseChanges = 0;
  }

  /* ═══════════════════════════════════════════════════
     INITIALISATION
     ═══════════════════════════════════════════════════ */
  init() {
    this._buildDOM();
    if (!this.completed) {
      setTimeout(() => this.startOnboarding(), 800);
    }
  }

  _buildDOM() {
    if (this.overlay) return;           // already built — avoid duplicates

    // Overlay container — pointer-events:none so game is usable
    this.overlay = document.createElement("div");
    this.overlay.id = "tutorial-overlay";
    this.overlay.classList.add("tutorial-hidden");

    // Cutout box — uses a huge box-shadow to tint everything EXCEPT itself
    this.cutoutBox = document.createElement("div");
    this.cutoutBox.id = "tutorial-cutout";
    this.overlay.appendChild(this.cutoutBox);

    // Tooltip bubble — appended to body (NOT overlay) so it stays
    // in the root stacking context, above .tutorial-glow elements
    this.tooltip = document.createElement("div");
    this.tooltip.id = "tutorial-tooltip";
    this.tooltip.classList.add("tutorial-hidden");
    this.tooltip.innerHTML = `
      <div class="tutorial-title"></div>
      <div class="tutorial-text"></div>
      <div class="tutorial-actions">
        <button class="tutorial-btn tutorial-next-btn">Next</button>
      </div>
      <div class="tutorial-step-dots"></div>
    `;

    // Skip bar at the bottom — also on body for same reason
    this.skipBar = document.createElement("div");
    this.skipBar.id = "tutorial-skip-bar";
    this.skipBar.classList.add("tutorial-hidden");
    this.skipBar.innerHTML = `<button class="tutorial-skip-btn">Skip Tutorial</button>`;

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.tooltip);
    document.body.appendChild(this.skipBar);

    // Event: Skip
    this.skipBar.querySelector(".tutorial-skip-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.endTutorial(true);
    });

    // Event: Next
    this.tooltip.querySelector(".tutorial-next-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.advanceStep();
    });
  }

  /* ═══════════════════════════════════════════════════
     ONBOARDING
     ═══════════════════════════════════════════════════ */
  startOnboarding() {
    this.activeSequence = this.onboardingSteps;
    this.currentStep = 0;
    this._showOverlay();
    this._renderStep();
  }

  replayTutorial() {
    this.completed = false;
    this.seenEvents = new Set();
    this.currentStep = 0;
    this._eventQueue = [];
    this._eventBusy = false;
    this.startOnboarding();
  }

  advanceStep() {
    if (this._advanceLock) return;
    this._advanceLock = true;
    setTimeout(() => this._advanceLock = false, 300);

    if (!this.activeSequence) return;

    const step = this.activeSequence[this.currentStep];
    if (step && step.isLast) {
      this.endTutorial(false);
      return;
    }

    this.currentStep++;
    if (this.currentStep >= this.activeSequence.length) {
      this.endTutorial(false);
    } else {
      this._renderStep();
    }
  }

  endTutorial(skipped) {
    clearTimeout(this._waitTimer);
    this._hideOverlay();
    this.activeSequence = null;
    this.currentStep = 0;
    this.completed = true;

    // If ending an event tip, mark not busy and process queue after cooldown
    if (this._eventBusy) {
      this._eventBusy = false;
      // Resume news ticker
      if (this.game.visualEffects) this.game.visualEffects.resumeNews();
      if (this._eventQueue.length > 0) {
        setTimeout(() => this._processEventQueue(), this._eventCooldown);
      }
    }

    this.game.saveGame();
  }

  /* ═══════════════════════════════════════════════════
     EVENT TIPS  (queued, never overlap)
     ═══════════════════════════════════════════════════ */
  triggerEvent(eventKey, dynamicTarget) {
    if (!this.overlay) return;               // DOM not built yet (init hasn't run)
    if (this.seenEvents.has(eventKey)) return;
    // Don't interrupt onboarding
    if (this.activeSequence && this.activeSequence === this.onboardingSteps) return;

    const tip = this.eventTips[eventKey];
    if (!tip) return;

    this.seenEvents.add(eventKey);

    // Push to queue
    this._eventQueue.push({ eventKey, tip, dynamicTarget });

    // If not currently showing a tip, process immediately
    if (!this._eventBusy) {
      this._processEventQueue();
    }
    this.game.saveGame();
  }

  _processEventQueue() {
    if (this._eventQueue.length === 0) return;
    if (this._eventBusy) return;
    // Don't interrupt onboarding
    if (this.activeSequence && this.activeSequence === this.onboardingSteps) return;

    this._eventBusy = true;
    // Pause news ticker while tip is visible
    if (this.game.visualEffects) this.game.visualEffects.pauseNews();
    const { tip, dynamicTarget } = this._eventQueue.shift();

    const step = { ...tip };
    if (dynamicTarget) step.target = dynamicTarget;
    step.isLast = true;

    this.activeSequence = [step];
    this.currentStep = 0;
    this._showOverlay();
    this._renderStep();
  }

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */
  _showOverlay() {
    this.overlay.classList.remove("tutorial-hidden");
    this.tooltip.classList.remove("tutorial-hidden");
    this.skipBar.classList.remove("tutorial-hidden");
    requestAnimationFrame(() => {
      this.overlay.classList.add("tutorial-visible");
      this.tooltip.classList.add("tutorial-visible");
      this.skipBar.classList.add("tutorial-visible");
    });
  }

  _hideOverlay() {
    this.overlay.classList.remove("tutorial-visible");
    this.overlay.classList.add("tutorial-hidden");
    this.tooltip.classList.remove("tutorial-visible");
    this.tooltip.classList.add("tutorial-hidden");
    this.skipBar.classList.remove("tutorial-visible");
    this.skipBar.classList.add("tutorial-hidden");
    this.cutoutBox.style.display = "none";
    document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));
  }

  _renderStep() {
    if (!this.activeSequence) return;
    const step = this.activeSequence[this.currentStep];
    if (!step) return;

    // Update title & text
    this.tooltip.querySelector(".tutorial-title").textContent = step.title;
    const textEl = this.tooltip.querySelector(".tutorial-text");
    if (step.html) {
      textEl.innerHTML = step.text;
    } else {
      textEl.textContent = step.text;
    }

    // Update button text
    const btn = this.tooltip.querySelector(".tutorial-next-btn");
    if (step.isLast) {
      btn.textContent = "Got it!";
    } else if (step.waitFor) {
      btn.textContent = "Waiting...";
      btn.disabled = true;
    } else {
      btn.textContent = "Next";
      btn.disabled = false;
    }

    // Step dots
    const dotsContainer = this.tooltip.querySelector(".tutorial-step-dots");
    dotsContainer.innerHTML = "";
    if (this.activeSequence.length > 1) {
      this.activeSequence.forEach((_, i) => {
        const dot = document.createElement("span");
        dot.className = "tutorial-dot" + (i === this.currentStep ? " active" : "") + (i < this.currentStep ? " done" : "");
        dotsContainer.appendChild(dot);
      });
    }

    // Skip bar: hide for single event tips
    this.skipBar.style.display = this.activeSequence.length <= 1 ? "none" : "";

    // Auto-switch mobile tab to show the target, then position
    const switched = this._autoSwitchTab(step);
    if (switched) {
      // After tab switch, wait for layout to settle before positioning
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._positionOnTarget(step);
        });
      });
    } else {
      this._positionOnTarget(step);
    }

    // Set up wait-for if needed
    if (step.waitFor) {
      this._setupWaitFor(step.waitFor);
    }
  }

  /* ═══════════════════════════════════════════════════
     AUTO-SWITCH MOBILE TAB
     ═══════════════════════════════════════════════════ */
  _autoSwitchTab(step) {
    const nav = this.game._mobileNav;
    if (!nav || !nav.isMobile()) return false;

    // Resolve target element
    let targetEl = null;
    if (typeof step.target === 'function') {
      targetEl = step.target();
    } else if (typeof step.target === 'string') {
      targetEl = document.querySelector(step.target);
    }

    // Determine which panel the target lives in
    let neededTab = null;
    if (targetEl) {
      const clickArea = document.getElementById('click-area');
      const stats     = document.getElementById('stats');
      const shop      = document.getElementById('shop');
      if (clickArea && clickArea.contains(targetEl)) neededTab = 'click-area';
      else if (shop && shop.contains(targetEl))      neededTab = 'shop';
      else if (stats && stats.contains(targetEl))    neededTab = 'stats';
    }

    // For targets not inside any panel (e.g. #menu-btn), skip switching
    if (neededTab && neededTab !== nav.activeTab) {
      nav.switchTab(neededTab);
      return true;
    }
    return false;
  }

  _positionOnTarget(step) {
    // Remove previous glow
    document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));

    let targetEl = null;
    if (typeof step.target === 'function') {
      targetEl = step.target();
    } else if (typeof step.target === 'string') {
      targetEl = document.querySelector(step.target);
    }

    if (!targetEl) {
      // No target — center tooltip, hide cutout, show full tint
      this.cutoutBox.style.display = "none";
      this.tooltip.style.left = "50%";
      this.tooltip.style.top = "50%";
      this.tooltip.style.transform = "translate(-50%, -50%)";
      this.tooltip.className = "tutorial-tooltip-center";
      this.tooltip.id = "tutorial-tooltip";
      return;
    }

    // Add glow class to target (raises z-index above overlay)
    targetEl.classList.add('tutorial-glow');

    const rect = targetEl.getBoundingClientRect();
    const pad = 10;

    // Position cutout box — the box-shadow creates the dark overlay everywhere else
    this.cutoutBox.style.display = "block";
    this.cutoutBox.style.left = (rect.left - pad) + "px";
    this.cutoutBox.style.top = (rect.top - pad) + "px";
    this.cutoutBox.style.width = (rect.width + pad * 2) + "px";
    this.cutoutBox.style.height = (rect.height + pad * 2) + "px";

    const isLargeTarget = rect.width > 300 || rect.height > 300;
    this.cutoutBox.style.borderRadius = isLargeTarget ? "14px" : "10px";

    // Position tooltip with smart auto-placement
    this.tooltip.style.transform = "";
    this.tooltip.className = "";
    this.tooltip.id = "tutorial-tooltip";

    const tooltipWidth = 290;
    const gap = 16;
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const navHeight = (this.game._mobileNav && this.game._mobileNav.isMobile()) ? 62 : 0;
    const availH = vh - navHeight;

    // Measure actual tooltip height (render offscreen to measure)
    this.tooltip.style.left = "-9999px";
    this.tooltip.style.top = "-9999px";
    this.tooltip.style.width = tooltipWidth + "px";
    const tooltipHeight = Math.max(this.tooltip.offsetHeight, 100);

    // Candidate positions: direction → {left, top}
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const candidates = [
      { dir: "right",  l: rect.right + gap,                       t: cy - tooltipHeight / 2, arrow: "arrow-left" },
      { dir: "left",   l: rect.left - tooltipWidth - gap,         t: cy - tooltipHeight / 2, arrow: "arrow-right" },
      { dir: "bottom", l: cx - tooltipWidth / 2,                  t: rect.bottom + gap,      arrow: "arrow-top" },
      { dir: "top",    l: cx - tooltipWidth / 2,                  t: rect.top - tooltipHeight - gap, arrow: "arrow-bottom" },
    ];

    // Score each candidate: how much of the tooltip is visible (0..1)
    // and whether it overlaps the target (penalty)
    const preferred = step.position || "right";

    function scorePlacement(c) {
      const cl = Math.max(c.l, margin);
      const ct = Math.max(c.t, margin);
      const cr = Math.min(c.l + tooltipWidth, vw - margin);
      const cb = Math.min(c.t + tooltipHeight, availH - margin);
      const visibleW = Math.max(0, cr - cl);
      const visibleH = Math.max(0, cb - ct);
      const visibleArea = visibleW * visibleH;
      const totalArea = tooltipWidth * tooltipHeight;
      const visibility = totalArea > 0 ? visibleArea / totalArea : 0;

      // Overlap with target rect
      const ox1 = Math.max(c.l, rect.left - pad);
      const oy1 = Math.max(c.t, rect.top - pad);
      const ox2 = Math.min(c.l + tooltipWidth, rect.right + pad);
      const oy2 = Math.min(c.t + tooltipHeight, rect.bottom + pad);
      const overlap = Math.max(0, ox2 - ox1) * Math.max(0, oy2 - oy1);
      const overlapPenalty = totalArea > 0 ? overlap / totalArea : 0;

      // Prefer the author's hint direction
      const prefBonus = c.dir === preferred ? 0.05 : 0;

      return visibility - overlapPenalty * 0.8 + prefBonus;
    }

    // Pick best placement
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const c of candidates) {
      const s = scorePlacement(c);
      if (s > bestScore) { bestScore = s; best = c; }
    }

    // If best score is too low (tooltip mostly off-screen / heavily overlapping),
    // center the tooltip over the highlighted area so it's always interactable
    if (bestScore < 0.45) {
      const centerL = cx - tooltipWidth / 2;
      const centerT = cy - tooltipHeight / 2;
      let left = Math.max(margin, Math.min(centerL, vw - tooltipWidth - margin));
      let top  = Math.max(margin, Math.min(centerT, availH - tooltipHeight - margin));
      this.tooltip.classList.add("tutorial-tooltip-center");
      this.tooltip.style.left = left + "px";
      this.tooltip.style.top = top + "px";
      this.tooltip.style.width = tooltipWidth + "px";
      return;
    }

    let left = best.l;
    let top  = best.t;

    // Clamp to viewport (allow overlap only as last resort, which the scorer already handles)
    if (left + tooltipWidth > vw - margin) left = vw - tooltipWidth - margin;
    if (left < margin) left = margin;
    if (top + tooltipHeight > availH - margin) top = availH - tooltipHeight - margin;
    if (top < margin) top = margin;

    this.tooltip.classList.add(best.arrow);
    this.tooltip.style.left = left + "px";
    this.tooltip.style.top = top + "px";
    this.tooltip.style.width = tooltipWidth + "px";
  }

  /* ═══════════════════════════════════════════════════
     WAIT-FOR CONDITIONS
     ═══════════════════════════════════════════════════ */
  _setupWaitFor(condition) {
    clearTimeout(this._waitTimer);
    const check = () => {
      let met = false;
      switch (condition) {
        case "buildingPurchased":
          met = this.game.getTotalBuildingCount() > 0;
          break;
        case "upgradePurchased":
          met = this.game.stats.totalUpgradesPurchased > 0;
          break;
        default:
          met = true;
      }

      if (met) {
        const btn = this.tooltip.querySelector(".tutorial-next-btn");
        btn.textContent = "Next";
        btn.disabled = false;
        this._waitTimer = setTimeout(() => this.advanceStep(), 600);
      } else {
        this._waitTimer = setTimeout(check, 300);
      }
    };
    check();
  }

  /* ═══════════════════════════════════════════════════
     OFFLINE EARNINGS POPUP
     ═══════════════════════════════════════════════════ */
  showOfflineEarnings({ elapsedSec, baseCps, offlineMultiplier, totalEarned, formatFn }) {
    const fmt = formatFn || (n => n.toLocaleString());

    // Time away in human-readable form
    let timeStr;
    if (elapsedSec < 60) {
      timeStr = `${elapsedSec}s`;
    } else if (elapsedSec < 3600) {
      const m = Math.floor(elapsedSec / 60);
      const s = elapsedSec % 60;
      timeStr = s > 0 ? `${m}m ${s}s` : `${m}m`;
    } else {
      const h = Math.floor(elapsedSec / 3600);
      const m = Math.floor((elapsedSec % 3600) / 60);
      timeStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
    }

    const html = `
      <div class="offline-summary">
        <div class="offline-total">+${fmt(totalEarned)} cookies</div>
        <div class="offline-details">
          <span>Time away</span><span>${timeStr}</span>
          <span>Base CPS</span><span>${fmt(baseCps)}/s</span>
          <span>Offline multiplier</span><span>${offlineMultiplier}x</span>
          <span>Effective rate</span><span>${fmt(parseFloat((baseCps * offlineMultiplier).toFixed(1)))}/s</span>
        </div>
      </div>`;

    const step = {
      title: "Welcome Back, Baker!",
      text: html,
      html: true,
      target: null,
      position: "left",
      isLast: true,
    };

    // Ensure DOM is built (showOfflineEarnings may fire before init())
    if (!this.overlay) this._buildDOM();

    // Show immediately — bypass event queue since this is a one-shot popup
    this._eventBusy = true;
    if (this.game.visualEffects) this.game.visualEffects.pauseNews();
    this.activeSequence = [step];
    this.currentStep = 0;
    this._showOverlay();
    this._renderStep();
  }

  /* ═══════════════════════════════════════════════════
     SAVE / LOAD
     ═══════════════════════════════════════════════════ */
  getSaveData() {
    return {
      completed: this.completed,
      seenEvents: Array.from(this.seenEvents),
    };
  }

  loadSaveData(data) {
    if (!data) return;
    this.completed = !!data.completed;
    if (data.seenEvents) {
      this.seenEvents = new Set(data.seenEvents);
    }
  }
}
