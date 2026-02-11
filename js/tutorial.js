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
        text: "Click the big cookie to start earning cookies. Every click adds to your total — the more you click, the faster you grow!",
        target: "#cookie-button",
        position: "right",
      },
      {
        title: "Cookie Counter",
        text: "This is your cookie count — the total cookies you currently have to spend. Earn enough and you can buy buildings and upgrades to automate production.",
        target: "#click-area h1",
        position: "right",
      },
      {
        title: "Cookies Per Second",
        text: "This displays your CPS — cookies earned automatically each second from buildings you own. The higher this number, the faster your empire grows without clicking.",
        target: "#cps-count",
        position: "right",
      },
      {
        title: "Buy a Cursor",
        text: "The Cursor is your first auto-baker — it automatically clicks for you, producing 0.1 cookies per second. Purchase one as soon as you can afford it!",
        target: () => document.querySelector('#building-list .building'),
        position: "left",
        waitFor: "buildingPurchased",
      },
      {
        title: "Auto-Bakers",
        text: "Buildings are the backbone of your cookie empire. Each type produces cookies every second automatically. More expensive buildings generate far more CPS — keep buying to unlock new ones!",
        target: "#building-list",
        position: "left",
      },
      {
        title: "Upgrades",
        text: "Upgrades give powerful permanent bonuses — they can multiply your click power, boost specific buildings, or unlock special abilities. Always buy upgrades when you can afford them!",
        target: "#upgrade-list",
        position: "left",
      },
      {
        title: "The Viewport",
        text: "This is your bakery overview. Watch the cookie rain, read the news ticker for fun messages, and keep an eye out for golden cookies — they give massive temporary bonuses when clicked!",
        target: "#stats",
        position: "left",
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
        text: "That covers the basics — keep clicking, buy buildings to automate, grab upgrades for multipliers, and click golden cookies when they appear. Good luck, baker!",
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
        text: "You can now afford your first upgrade! Upgrades give powerful permanent bonuses — click one in the shop to purchase it. Check the tooltip for details on what each upgrade does.",
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
        text: "A golden cookie just appeared in the viewport! Click it quickly before it disappears — it can reward you with a huge pile of bonus cookies, a CPS frenzy (7x production), or a click frenzy (777x click power)!",
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
        text: "As you unlock achievements, milk gradually fills the viewport. The milk changes color at higher achievement thresholds — from plain white, to caramel, lavender, and eventually golden milk. It's a visual badge of your progress!",
        target: "#milk-layer",
        position: "top",
      },
      prestigeAvailable: {
        title: "Prestige Available!",
        text: "You've baked enough cookies to Ascend! Prestiging will reset ALL your cookies, buildings, and upgrades — but in return you earn permanent Heavenly Chips. Each chip gives +1% CPS forever, and they stack across all future runs. It's the key to long-term exponential growth!",
        target: "#prestige-btn",
        position: "right",
      },
      touchUpgrade: {
        title: "Touch Upgrade!",
        text: "Touch upgrades (Iron Touch, Silver Touch, Golden Touch, etc.) each double your clicking power. They unlock at building count milestones — the more buildings you own across all types, the stronger your clicks become!",
        target: null,
        position: "left",
      },
      offlineUpgrade: {
        title: "Offline Production!",
        text: "Offline Production upgrades let you earn cookies even when you close the game! Each tier increases the offline multiplier — at the highest tier you can earn 3x your normal CPS while away. Great for overnight gains!",
        target: null,
        position: "left",
      },
      luckyClick: {
        title: "Lucky Click!",
        text: "You just triggered a Lucky Click — a random bonus event! These can give you 10 minutes worth of CPS instantly, start a 7x CPS frenzy, or even a 777x Click Frenzy. Buy Lucky Cookies upgrades to increase your luck chance!",
        target: "#cookie-button",
        position: "right",
      },
      powerMultiplier: {
        title: "Power Growing!",
        text: "Your Global CPS Multiplier just increased! This multiplier applies to ALL cookie production from every building. It stacks multiplicatively with your Achievement and Prestige multipliers — visible in the Power panel on the left.",
        target: "#left-multipliers",
        position: "right",
      },
      synergyUpgrade: {
        title: "Synergy Unlocked!",
        text: "Synergy upgrades create a link between two building types — each unit of the source building adds bonus CPS to the target building. For example, each Grandma can boost your Farms. The more of both you own, the bigger the bonus!",
        target: null,
        position: "left",
      },
      cursorScaling: {
        title: "Thousand Fingers!",
        text: "Cursor scaling upgrades make every Cursor more powerful based on how many OTHER buildings you own. The more diverse your empire, the stronger each Cursor becomes — they scale with your entire operation!",
        target: null,
        position: "left",
      },
      frenzyDuration: {
        title: "Extended Frenzy!",
        text: "Frenzies now last longer! Duration upgrades multiply how long each frenzy lasts, giving you even more time at boosted production. Combine with higher lucky click chances for maximum impact!",
        target: null,
        position: "left",
      },
    };
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
    // Overlay container — pointer-events:none so game is usable
    this.overlay = document.createElement("div");
    this.overlay.id = "tutorial-overlay";
    this.overlay.classList.add("tutorial-hidden");

    // Cutout box — uses a huge box-shadow to tint everything EXCEPT itself
    this.cutoutBox = document.createElement("div");
    this.cutoutBox.id = "tutorial-cutout";
    this.overlay.appendChild(this.cutoutBox);

    // Tooltip bubble
    this.tooltip = document.createElement("div");
    this.tooltip.id = "tutorial-tooltip";
    this.tooltip.innerHTML = `
      <div class="tutorial-title"></div>
      <div class="tutorial-text"></div>
      <div class="tutorial-actions">
        <button class="tutorial-btn tutorial-next-btn">Next</button>
      </div>
      <div class="tutorial-step-dots"></div>
    `;
    this.overlay.appendChild(this.tooltip);

    // Skip bar at the bottom
    this.skipBar = document.createElement("div");
    this.skipBar.id = "tutorial-skip-bar";
    this.skipBar.innerHTML = `<button class="tutorial-skip-btn">Skip Tutorial</button>`;
    this.overlay.appendChild(this.skipBar);

    document.body.appendChild(this.overlay);

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
    requestAnimationFrame(() => this.overlay.classList.add("tutorial-visible"));
  }

  _hideOverlay() {
    this.overlay.classList.remove("tutorial-visible");
    this.overlay.classList.add("tutorial-hidden");
    this.cutoutBox.style.display = "none";
    document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));
  }

  _renderStep() {
    if (!this.activeSequence) return;
    const step = this.activeSequence[this.currentStep];
    if (!step) return;

    // Update title & text
    this.tooltip.querySelector(".tutorial-title").textContent = step.title;
    this.tooltip.querySelector(".tutorial-text").textContent = step.text;

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

    // Position cutout + tooltip
    this._positionOnTarget(step);

    // Set up wait-for if needed
    if (step.waitFor) {
      this._setupWaitFor(step.waitFor);
    }
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

    // Position tooltip
    this.tooltip.style.transform = "";
    this.tooltip.className = "";
    this.tooltip.id = "tutorial-tooltip";

    const tooltipWidth = 290;
    const tooltipHeight = 180;
    const gap = 16;

    let left, top;
    const pos = step.position || "right";

    switch (pos) {
      case "right":
        left = rect.right + gap;
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        this.tooltip.classList.add("arrow-left");
        break;
      case "left":
        left = rect.left - tooltipWidth - gap;
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        this.tooltip.classList.add("arrow-right");
        break;
      case "top":
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        top = rect.top - tooltipHeight - gap;
        this.tooltip.classList.add("arrow-bottom");
        break;
      case "bottom":
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        top = rect.bottom + gap;
        this.tooltip.classList.add("arrow-top");
        break;
      case "bottom-right":
        left = rect.right + gap;
        top = rect.bottom + gap;
        this.tooltip.classList.add("arrow-top-left");
        break;
      default:
        left = rect.right + gap;
        top = rect.top;
        this.tooltip.classList.add("arrow-left");
    }

    // Clamp to viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + tooltipWidth > vw - 10) left = vw - tooltipWidth - 10;
    if (left < 10) left = 10;
    if (top + tooltipHeight > vh - 60) top = vh - tooltipHeight - 60;
    if (top < 10) top = 10;

    this.tooltip.style.left = left + "px";
    this.tooltip.style.top = top + "px";
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
