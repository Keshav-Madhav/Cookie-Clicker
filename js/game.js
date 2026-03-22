import { Building } from "./buildings.js";
import { Upgrade } from "./upgrades.js";
import { AchievementManager } from "./achievements.js";
import { PrestigeManager } from "./prestige.js";
import { VisualEffects } from "./visualEffects.js";
import { Tutorial } from "./tutorial.js";
import { buildings, upgrades, heavenlyUpgrades } from "./gameData.js";
import { formatNumberInWords, setShortNumbers } from "./utils.js";
import { SoundManager } from "./soundManager.js";
import {
  GAME, LUCKY_CLICK, FRENZY_BURSTS, PARTICLES,
  EASTER_EGGS, GOLDEN_COOKIE, SOFT_CAP, GRANDMAPOCALYPSE
} from "./config.js";
import { GrandmapocalypseManager } from "./grandmapocalypse.js";
import { WrinklerManager } from "./wrinklerManager.js";
import { CookieNum } from "./cookieNum.js";
import { getBuildingIcon } from "./buildingIcons.js";
import { NewspaperMixin } from "./newspaper.js";
import { SaveLoadMixin } from "./gameSave.js";
import { OverlaysMixin } from "./gameOverlays.js";
import { ParticlesMixin } from "./gameParticles.js";

export class Game {
  constructor() {
    this.cookies = CookieNum.from(GAME.startingCookies);
    this.cookiesPerClick = CookieNum.from(GAME.startingCookiesPerClick);
    this.cookiesPerSecond = CookieNum.ZERO;
    this.globalCpsMultiplier = 1;
    this.luckyClickChance = 0;
    this.cpsClickBonus = 0;
    this.miniGameBonus = 1;
    this.frenzyDurationMultiplier = 1;
    this._particles = [];
    this._particleMaxNonAmbient = 200; // cap non-ambient particles for performance
    this._upgradePage = 0;
    this._upgradeOrder = []; // sorted indices for upgrade display
    this._upgradeSortTimer = null;
    this._buildingSort = 'default'; // default, price, cps, efficiency, owned

    // User settings
    this.settings = {
      particles: true,       // cookie rain in viewport
      shortNumbers: true,    // e.g. "1.5M" vs "1,500,000"
      shimmers: true,        // shimmer sparkles in viewport
      music: true,           // background symphony music
      soundEffects: true,    // procedural sound effects
      ambient: true,         // bakery ambient soundscape
      musicVolume: 0.8,      // music volume (0–1)
      effectsVolume: 0.75,    // effects volume (0–1)
      ambientVolume: 0.15,   // ambient volume (0–1)
    };

    // Visual-effect throttle: max ~30 visual updates/sec for click effects
    this._lastVisualClickTime = 0;
    this._visualClickMinGap = 33; // ms (~30 fps)
    this._pendingCookieCountUpdate = false;

    // Active buff system (supports multiple concurrent frenzies)
    this.activeBuffs = [];  // Array of { id, type: 'cps'|'click', multiplier, endTime }

    // Stats tracking
    this.stats = {
      totalCookiesBaked: CookieNum.ZERO,
      totalClicks: 0,
      totalUpgradesPurchased: 0,
      luckyClicks: 0,
      frenziesTriggered: 0,
      timesPrestiged: 0,
      startTime: Date.now(),
      handmadeCookies: CookieNum.ZERO,
      miniGamesWon: [],  // tracks which mini-games have been won
      cutterBestAccuracy: 0,  // best accuracy in cookie cutter
      kitchenBestStreak: 0,   // best perfect streak in grandma's kitchen
      slotsJackpots: 0,       // number of jackpots hit in slots
      goldenCookiesClicked: 0, // golden cookies clicked
      sessionPrestiges: 0,    // prestiges in current session
      miniGamesPlayed: 0,     // total minigames played
      melodyIndex: 0,         // current position in click melody
      // Grandmapocalypse stats
      wrinklersPopped: 0,
      wrinklersFed: 0,
      shinyWrinklersPopped: 0,
      wrinklerBigPop: 0,
      elderPledgesUsed: 0,
      elderCovenantSigned: false,
      wrathCookiesClicked: 0,
      wrathClotSurvived: 0,
      elderFrenzyTriggered: 0,
      dungeonRuns: 0,
      dungeonBossesDefeated: 0,
      dungeonBestRooms: 0,
      perGame: {},  // per-minigame stats { [name]: { played, wins, totalReward, bestReward } }
    };

    // Load buildings & upgrades from gameData.js
    this.buildings = buildings.map((_, index) => new Building(index, this));
    this.upgrades = upgrades.map((_, index) => new Upgrade(index, this));

    // Achievement & Prestige systems
    this.achievementManager = new AchievementManager(this);
    this.prestige = new PrestigeManager(this);
    this.visualEffects = new VisualEffects(this);
    this.tutorial = new Tutorial(this);
    this.soundManager = new SoundManager(this);
    this.grandmapocalypse = new GrandmapocalypseManager(this);
    this.wrinklerManager = new WrinklerManager(this);
    this._grandmapocalypseGrandmaBoost = 1;
    this._rhythmSynced = false;

    this.purchaseAmount = 1;

    this._saveLoaded = this.loadGame();  // promise — resolves when save is restored
    this.updateUI();
  }

  start() {
    document.getElementById("cookie-button").addEventListener("click", (event) => this.clickCookie(event));

    // Count ALL clicks (cookie, buy, navigate, upgrade) toward totalClicks
    document.addEventListener("click", () => {
      this.stats.totalClicks++;
    });

    this.createPurchaseAmountButtons();
    this.setupPrestigeButton();
    this.setupHeavenlyShop();
    this.setupUpgradeNav();
    this.setupMenu();

    // Floating newspaper button
    const newsBtn = document.getElementById("newspaper-btn");
    if (newsBtn) newsBtn.addEventListener("click", () => this._openStatsOverlay());
    // Floating synergy button
    const synBtn = document.getElementById("synergy-float-btn");
    if (synBtn) synBtn.addEventListener("click", () => this._openSynergyVisualizer());
    this.initParticles();
    this.visualEffects.init();
    this.soundManager.init();
    this.wrinklerManager.init();

    // Apply Elder Knowledge heavenly upgrade: give bingo center for free
    if (this.prestige.hasUpgrade('elderKnowledge') &&
        !this.grandmapocalypse.hasResearch('bingoCenter')) {
      this.grandmapocalypse.researchPurchased.add('bingoCenter');
      this.grandmapocalypse.stage = 1;
      this.grandmapocalypse._previousStage = 1;
      this.grandmapocalypse._applyResearchBoosts();
      this.grandmapocalypse._onStageChange(1);
    }

    // Render grandmapocalypse research panel
    this.grandmapocalypse._renderResearchPanel();

    // Easter egg: typing "cookie" or "debugging" anywhere
    this._typedKeys = '';
    document.addEventListener('keydown', (e) => {
      // Only track letter keys
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        this._typedKeys += e.key.toLowerCase();
        // Keep only last 9 characters (longest trigger word)
        if (this._typedKeys.length > 9) {
          this._typedKeys = this._typedKeys.slice(-9);
        }
        // Check if "cookie" was typed
        if (this._typedKeys.endsWith('cookie') && this.tutorial) {
          this.tutorial.triggerEvent('cookieTyped');
          this._typedKeys = '';
        }
        // Check if "debugging" was typed — open debug panel
        if (this._typedKeys.endsWith('debugging')) {
          this._openDebugPanel();
          this._typedKeys = '';
        }
        // Check if "music" was typed — open music player
        if (this._typedKeys.endsWith('music')) {
          this._openMusicPlayer();
          this._typedKeys = '';
        }
        // Check if "minigames" was typed — open minigame selector
        if (this._typedKeys.endsWith('minigames')) {
          this._openMinigameSelector();
          this._typedKeys = '';
        }
      }
      // Reset idle timer on any key
      this._resetIdleTimer();
    });

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', (e) => {
      // Skip when typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key !== 'Escape') return;
      }

      // Skip non-Escape when mini-game overlay is open
      const miniOverlay = document.getElementById('mini-game-overlay');
      if (miniOverlay && !miniOverlay.classList.contains('hidden') && e.key !== 'Escape') return;

      switch (e.key) {
        case ' ':
        case 'Enter': {
          e.preventDefault();
          const btn = document.getElementById('cookie-button');
          if (btn) btn.click();
          break;
        }
        case '1': this.setPurchaseAmount(GAME.purchaseAmounts[0]); break;
        case '2': this.setPurchaseAmount(GAME.purchaseAmounts[1]); break;
        case '3': this.setPurchaseAmount(GAME.purchaseAmounts[2]); break;
        case '4': this.setPurchaseAmount(GAME.purchaseAmounts[3]); break;
        case '5': this.setPurchaseAmount(GAME.purchaseAmounts[4]); break;
        case 'g':
        case 'G': {
          const gc = document.getElementById('golden-cookie');
          if (gc && !gc.classList.contains('hidden')) gc.click();
          break;
        }
        case 'Escape': {
          // Close topmost overlay
          let closed = false;
          const overlays = ['building-info-panel', 'synergy-overlay', 'minigame-overlay', 'music-overlay', 'debug-overlay', 'heavenly-overlay', 'stats-overlay', 'menu-overlay'];
          for (const id of overlays) {
            const ol = document.getElementById(id);
            if (ol && !ol.classList.contains('hidden')) {
              if (id === 'building-info-panel') ol.remove();
              else ol.classList.add('hidden');
              closed = true;
              break;
            }
          }
          // Also close mini-game overlay
          if (miniOverlay && !miniOverlay.classList.contains('hidden')) {
            miniOverlay.classList.add('hidden');
            closed = true;
          }
          if (closed) this.soundManager.panelClose();
          break;
        }
      }
    });

    // Easter egg: selecting the word "cookie" in the news
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (selection && selection.toString().toLowerCase().trim() === 'cookie') {
        if (this.tutorial) {
          this.tutorial.triggerEvent('cookieSelected');
        }
      }
    });

    // Easter egg: the watcher (10 minutes idle)
    this._idleTime = 0;
    this._idleTimer = null;
    this._resetIdleTimer();
    document.addEventListener('click', () => this._resetIdleTimer());
    this._lastIdleReset = 0;
    document.addEventListener('mousemove', () => {
      const now = Date.now();
      if (now - this._lastIdleReset > 1000) {
        this._lastIdleReset = now;
        this._resetIdleTimer();
      }
    });
    // Apply saved settings to visual effects
    this.visualEffects.particlesEnabled = this.settings.particles;
    this.visualEffects.shimmersEnabled = this.settings.shimmers;
    setShortNumbers(this.settings.shortNumbers);
    this._updateRhythmMeterUI();
    this.tutorial.init();

    // Main game loop - 1 second tick
    setInterval(() => {
      const effectiveCPS = this.getEffectiveCPS();
      this.cookies = this.cookies.add(effectiveCPS);
      this.stats.totalCookiesBaked = this.stats.totalCookiesBaked.add(effectiveCPS);

      // Remove expired buffs
      this.expireBuffs();

      this.achievementManager.check();
      this.updateCookieCount();
      this.updateLeftPanel();
      this.visualEffects.update();

      // Grandmapocalypse tick
      if (this.grandmapocalypse) {
        this.grandmapocalypse.tick();

        // Cookie decay — cookies slowly rot at higher stages
        const gpStage = this.grandmapocalypse.stage;
        if (gpStage >= 1 && !this.grandmapocalypse.elderPledgeActive && !this.grandmapocalypse.covenantActive) {
          const decayKey = `stage${gpStage}`;
          const decayRate = GRANDMAPOCALYPSE.cookieDecay[decayKey] || 0;
          if (decayRate > 0 && this.cookies.gt(0)) {
            const decayed = this.cookies.mul(decayRate);
            this.cookies = this.cookies.sub(decayed);
            if (this.cookies.lt(0)) this.cookies = CookieNum.ZERO;
          }
        }
      }
      // Wrinkler feeding tick
      if (this.wrinklerManager && this.grandmapocalypse && this.grandmapocalypse.stage >= 1) {
        this.wrinklerManager.update(GAME.tickIntervalMs);
      }

      // Easter egg: night owl (playing between configured hours)
      const hr = new Date().getHours();
      const mins = new Date().getMinutes();
      if (hr >= EASTER_EGGS.nightOwlStartHour && hr < EASTER_EGGS.nightOwlEndHour && this.tutorial) {
        this.tutorial.triggerEvent('nightOwl');
      }

      // Easter egg: midnight baker (exactly midnight)
      if (hr === 0 && mins === 0 && this.tutorial) {
        this.tutorial.triggerEvent('midnightBaker');
      }

      // Easter egg: balanced empire (all unlocked buildings have same count)
      if (this.tutorial) {
        this._checkBalancedEmpire();
      }

    }, GAME.tickIntervalMs);

    // Newspaper nudge — 50% chance once per hour
    setInterval(() => {
      if (Math.random() < 0.5) {
        this._showChronicleNudge();
      }
    }, 3600000);

    // Smooth frenzy timer updates (200ms instead of waiting for 1s tick)
    setInterval(() => {
      if (this.activeBuffs.length > 0) {
        this.expireBuffs();
        this.updateFrenzyIndicator();
      }
      // Lose rhythm sync / stop auto-play if player stops clicking
      if (this.soundManager.syncTimedOut()) {
        if (this._rhythmSynced) {
          this._rhythmSynced = false;
          this._updateRhythmMeterUI();
        }
        if (this.soundManager.isAutoPlaying()) {
          this.soundManager.stopAutoPlay();
          this._updateRhythmMeterUI();
        }
      }
      // Keep "Now Playing" in sync with current melody
      this._updateNowPlaying();
    }, 200);

    // Auto-save
    setInterval(() => this.saveGame(), GAME.saveIntervalMs);

    // Initial left panel render
    this.updateLeftPanel();
  }

  getEffectiveCPS({ excludeWrinklerDrain = false } = {}) {
    // Phase 1: In-run CPS — buildings, upgrades, global multipliers, achievements
    // This is the CPS the player earned during THIS run through normal gameplay.
    let inRunCps = this.cookiesPerSecond.mul(this.globalCpsMultiplier);
    inRunCps = inRunCps.mul(this.achievementManager.getMultiplier());

    // Phase 2: Apply soft cap on in-run CPS
    // Creates a natural plateau that makes prestige the path forward.
    let cps = this._applySoftCap(inRunCps);

    // Phase 3: Prestige multipliers — applied AFTER the cap.
    // This is the primary reward for prestiging: prestige multipliers
    // are never diminished by the soft cap.
    cps = cps.mul(this.prestige.getPrestigeMultiplier());

    // Kitten Workers: +0.5% CPS per achievement (prestige upgrade)
    const kittenBonus = this.prestige.getCpsPerAchievementBonus();
    if (kittenBonus > 0) {
      cps = cps.mul(1 + kittenBonus * this.achievementManager.getUnlockedCount());
    }

    // Medal Cabinet: +1% CPS per achievement (prestige upgrade)
    const medalBonus = this.prestige.getCpsPerAchievementBonus2();
    if (medalBonus > 0) {
      cps = cps.mul(1 + medalBonus * this.achievementManager.getUnlockedCount());
    }

    // Cosmic Resonance: +0.5% CPS per building type owned (prestige upgrade)
    const buildingTypeBonus = this.prestige.getCpsPerBuildingTypeBonus();
    if (buildingTypeBonus > 0) {
      const typesOwned = this.buildings.filter(b => b.count > 0).length;
      cps = cps.mul(1 + buildingTypeBonus * typesOwned);
    }

    // Cosmic Harvest: +0.6% CPS per building type owned (stacks)
    const buildingTypeBonus2 = this.prestige.getCpsPerBuildingTypeBonus2();
    if (buildingTypeBonus2 > 0) {
      const typesOwned = this.buildings.filter(b => b.count > 0).length;
      cps = cps.mul(1 + buildingTypeBonus2 * typesOwned);
    }

    // Omniscient Baking: +2% CPS per achievement unlocked
    const omniscientBonus = this.prestige.getCpsPerAchievementBonus3();
    if (omniscientBonus > 0) {
      cps = cps.mul(1 + omniscientBonus * this.achievementManager.getUnlockedCount());
    }

    // Apply all active CPS buffs (frenzies, golden cookies)
    for (const buff of this.activeBuffs) {
      if (buff.type === 'cps') cps = cps.mul(buff.multiplier);
    }

    // Wrinkler visual drain — reduces displayed CPS to show wrinklers intercepting production
    // Note: wrinklers accumulate cookies independently and return them at 1.1x on pop
    if (!excludeWrinklerDrain && this.wrinklerManager && this.grandmapocalypse && this.grandmapocalypse.stage >= 1 &&
        !this.grandmapocalypse.elderPledgeActive && !this.grandmapocalypse.covenantActive) {
      const wrinklers = this.wrinklerManager.wrinklers;
      if (wrinklers.length > 0) {
        let drainFraction = 0;
        for (const w of wrinklers) {
          drainFraction += w.elder ? GRANDMAPOCALYPSE.elderWrinklerDrainFraction : GRANDMAPOCALYPSE.wrinklerCpsDrainFraction;
        }
        cps = cps.mul(Math.max(0, 1 - drainFraction));
        // Warn player when wrinklers have fully drained CPS
        if (drainFraction >= 1 && !this._wrinklerDrainWarningShown) {
          this._wrinklerDrainWarningShown = true;
          if (this.visualEffects && this.visualEffects.showStageTransitionText) {
            this.visualEffects.showStageTransitionText("Your CPS has been fully drained! Pop a wrinkler to recover.");
          }
        } else if (drainFraction < 1) {
          this._wrinklerDrainWarningShown = false;
        }
      }
    }

    return cps;
  }

  // ═══ CPS Soft Cap ═══════════════════════════════════════════

  /**
   * Apply logarithmic diminishing returns to in-run CPS.
   * Below the threshold: no change.
   * Above: effective = threshold × (1 + ln(raw/threshold) × generosity)
   */
  _applySoftCap(rawCps) {
    const threshold = this._getCpsSoftCapThreshold();
    const thresholdCN = CookieNum.from(threshold);

    if (rawCps.lte(thresholdCN)) return rawCps;

    // Use mantissa/exponent for ln() so it works at arbitrary precision
    const lnRaw = Math.log(Math.abs(rawCps.mantissa)) + rawCps.exponent * Math.LN10;
    const lnThreshold = Math.log(threshold);
    const lnRatio = lnRaw - lnThreshold;  // ln(raw / threshold)

    const effectiveNum = threshold * (1 + lnRatio * SOFT_CAP.generosity);

    // Enforce minimum efficiency floor
    const minEffective = rawCps.mul(SOFT_CAP.minEfficiency);
    const result = CookieNum.from(effectiveNum);
    return result.lt(minEffective) ? minEffective : result;
  }

  /** Soft-cap threshold, scaling with prestige level. */
  _getCpsSoftCapThreshold() {
    const prestiges = this.prestige ? this.prestige.timesPrestiged : 0;
    const scalingBonus = this.prestige ? this.prestige.getSoftCapScalingBonus() : 1;
    const effectiveScaling = SOFT_CAP.prestigeScaling * scalingBonus;
    return SOFT_CAP.baseThreshold * Math.pow(effectiveScaling, prestiges);
  }

  /** Current production efficiency (0–1). 1 = no cap effect. */
  getProductionEfficiency() {
    const inRunCps = this.cookiesPerSecond.mul(this.globalCpsMultiplier)
      .mul(this.achievementManager.getMultiplier());

    if (inRunCps.isZero()) return 1;

    const threshold = this._getCpsSoftCapThreshold();
    if (inRunCps.lte(CookieNum.from(threshold))) return 1;

    // efficiency = effective / raw
    // = [threshold × (1 + lnRatio × g)] / raw
    // = (threshold/raw) × (1 + lnRatio × g)
    // = exp(-lnRatio) × (1 + lnRatio × g)
    const lnRaw = Math.log(Math.abs(inRunCps.mantissa)) + inRunCps.exponent * Math.LN10;
    const lnThreshold = Math.log(threshold);
    const lnRatio = lnRaw - lnThreshold;

    const efficiency = Math.exp(-lnRatio) * (1 + lnRatio * SOFT_CAP.generosity);
    return Math.max(Math.min(efficiency, 1), SOFT_CAP.minEfficiency);
  }

  getEffectiveCPC() {
    // Base click value with multipliers
    let baseClick = this.cookiesPerClick.mul(this.prestige.getPrestigeMultiplier());
    baseClick = baseClick.mul(this.achievementManager.getMultiplier());

    // CPS-based click bonus — uses soft-capped CPS so clicking
    // can't bypass the production wall
    let cpsBonus = CookieNum.ZERO;
    if (this.cpsClickBonus > 0) {
      let inRunCps = this.cookiesPerSecond.mul(this.globalCpsMultiplier);
      inRunCps = inRunCps.mul(this.achievementManager.getMultiplier());
      // Apply soft cap before prestige mult (same as getEffectiveCPS)
      let cappedCps = this._applySoftCap(inRunCps);
      cappedCps = cappedCps.mul(this.prestige.getPrestigeMultiplier());
      cpsBonus = cappedCps.mul(this.cpsClickBonus);
    }

    let cpc = baseClick.add(cpsBonus);
    // Practiced Hands: x1.5 clicking power
    cpc = cpc.mul(this.prestige.getClickMultiplier2());
    // Heavenly Clicking: x2 clicking power
    cpc = cpc.mul(this.prestige.getClickMultiplier());
    // Astral Clicking: x3 clicking power
    cpc = cpc.mul(this.prestige.getClickMultiplier3());
    // Apply all active click buffs
    for (const buff of this.activeBuffs) {
      if (buff.type === 'click') cpc = cpc.mul(buff.multiplier);
    }
    // Rhythm sync bonus — clicking in time with the melody
    if (this._rhythmSynced) cpc = cpc.mul(1.5);
    return cpc;
  }

  clickCookie(event) {
    const clickAmount = this.getEffectiveCPC();
    this.cookies = this.cookies.add(clickAmount);
    this.stats.totalCookiesBaked = this.stats.totalCookiesBaked.add(clickAmount);
    this.stats.handmadeCookies = this.stats.handmadeCookies.add(clickAmount);

    // Easter egg: rapid clicker
    if (this.tutorial) {
      const now = Date.now();
      this.tutorial._clickTimestamps = this.tutorial._clickTimestamps || [];
      this.tutorial._clickTimestamps.push(now);
      // Keep only last N timestamps
      if (this.tutorial._clickTimestamps.length > EASTER_EGGS.rapidClicker.clickThreshold) {
        this.tutorial._clickTimestamps.shift();
      }
      if (this.tutorial._clickTimestamps.length >= EASTER_EGGS.rapidClicker.clickThreshold) {
        const elapsed = now - this.tutorial._clickTimestamps[0];
        if (elapsed <= EASTER_EGGS.rapidClicker.windowMs) {
          this.tutorial.triggerEvent('rapidClicker');
        }
      }
    }

    // Throttle visual effects to ~30/sec for performance at high click rates
    const perfNow = performance.now();
    const doVisuals = (perfNow - this._lastVisualClickTime) >= this._visualClickMinGap;
    if (doVisuals) this._lastVisualClickTime = perfNow;

    // Batch cookie count DOM updates via rAF
    if (!this._pendingCookieCountUpdate) {
      this._pendingCookieCountUpdate = true;
      requestAnimationFrame(() => {
        this._pendingCookieCountUpdate = false;
        this.updateCookieCount();
      });
    }

    if (doVisuals) {
      this.createFloatingText(event, `+${formatNumberInWords(clickAmount)}`);
      this.spawnClickParticles(event);
      this.spawnClickRipple(event);
      this.soundManager.click();
      this._updateRhythmSync();

      // Flash effect on container
      const container = document.getElementById("cookie-container");
      if (container) {
        const flash = document.createElement("div");
        flash.classList.add("cookie-flash");
        container.appendChild(flash);
        setTimeout(() => flash.remove(), PARTICLES.flashDurationMs);
      }

      // Bounce animation on cookie
      const cookieBtn = document.getElementById("cookie-button");
      if (cookieBtn) {
        cookieBtn.classList.remove("clicking");
        void cookieBtn.offsetWidth; // force reflow
        cookieBtn.classList.add("clicking");
        cookieBtn.addEventListener("animationend", () => {
          cookieBtn.classList.remove("clicking");
        }, { once: true });
      }
    }

    // Lucky click check
    this.checkLuckyClick(event);

    // Check achievements periodically on click
    if (this.stats.totalClicks % EASTER_EGGS.achievementCheckInterval === 0) {
      this.achievementManager.check();
    }

    // Tutorial: check if this was the first click (for waitFor)
    if (this.stats.totalClicks === 1) {
      // First click registered — tutorial may wait for this
    }
  }

  _checkBalancedEmpire() {
    // Get all unlocked (owned at least once) buildings
    const unlockedBuildings = this.buildings.filter(b => b.count > 0);
    if (unlockedBuildings.length < 5) return; // Need at least 5 buildings

    // Check if all have the same count
    const firstCount = unlockedBuildings[0].count;
    if (firstCount < 1) return;
    
    const allSame = unlockedBuildings.every(b => b.count === firstCount);
    if (allSame) {
      this.tutorial.triggerEvent('balancedEmpire');
    }
  }

  _resetIdleTimer() {
    this._idleTime = 0;
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => this._idleTick(), 1000);
  }

  _idleTick() {
    this._idleTime++;
    if (this._idleTime >= 600 && this.tutorial) {
      this.tutorial.triggerEvent('theWatcher');
      this._idleTime = 0;
    }
    this._idleTimer = setTimeout(() => this._idleTick(), 1000);
  }

  checkLuckyClick(event) {
    if (this.luckyClickChance <= 0) return;

    // Hard cap: skip lucky roll if already at max active buffs
    if (this.activeBuffs.length >= 4) return;

    if (Math.random() < this.luckyClickChance) {
      this.stats.luckyClicks++;
      this.soundManager.luckyClick();

      // Tutorial: lucky click event
      if (this.tutorial) this.tutorial.triggerEvent('luckyClick');
      
      // Random bonus type
      const roll = Math.random();
      if (roll < LUCKY_CLICK.cookieRollMax) {
        // Lucky: CPS bonus (minimum floor), amplified by Lucky Stars
        const luckyMult = this.prestige.getLuckyClickMultiplier();
        const bonus = CookieNum.max(
          CookieNum.from(LUCKY_CLICK.cookie.minCookies),
          this.getEffectiveCPS().mul(LUCKY_CLICK.cookie.cpsMultiplier)
        ).mul(luckyMult);
        this.cookies = this.cookies.add(bonus);
        this.stats.totalCookiesBaked = this.stats.totalCookiesBaked.add(bonus);
        this.createFloatingText(event, `🍀 LUCKY! +${formatNumberInWords(bonus)}`, true);
        if (this.visualEffects) this.visualEffects.triggerIncomeRain(bonus.toNumber());
      } else if (roll < LUCKY_CLICK.frenzyRollMax) {
        // CPS Frenzy
        this.startFrenzy('cps', LUCKY_CLICK.cpsFrenzy.multiplier, LUCKY_CLICK.cpsFrenzy.durationSec);
        this.createFloatingText(event, `🔥 FRENZY! ${LUCKY_CLICK.cpsFrenzy.multiplier}x CPS!`, true);
      } else {
        // Click frenzy
        this.startFrenzy('click', LUCKY_CLICK.clickFrenzy.multiplier, LUCKY_CLICK.clickFrenzy.durationSec);
        this.createFloatingText(event, `⚡ CLICK FRENZY! ${LUCKY_CLICK.clickFrenzy.multiplier}x!`, true);
        // Easter egg: 777x click frenzy
        if (this.tutorial) this.tutorial.triggerEvent('clickFrenzy777');
      }
    }
  }

  startFrenzy(type, multiplier, durationSec) {
    // Hard cap: max 4 concurrent buffs
    if (this.activeBuffs.length >= 4) return;

    const wasAlreadyActive = this.activeBuffs.length > 0;
    const duration = durationSec * 1000 * this.frenzyDurationMultiplier * (this.prestige ? this.prestige.getFrenzyDurationMultiplier() : 1);
    // Frenzy Overload + Frenzy Mastery: amplify frenzy multiplier (buffs only, not debuffs)
    const isDebuff = multiplier < 1;
    const frenzyBonus = (!isDebuff && this.prestige)
      ? this.prestige.getFrenzyBonusMultiplier() * this.prestige.getFrenzyBonusMultiplier2()
      : 1;
    const effectiveMultiplier = multiplier * frenzyBonus;

    this.activeBuffs.push({
      id: Date.now() + Math.random(),
      type,
      multiplier: effectiveMultiplier,
      endTime: Date.now() + duration,
    });

    this.stats.frenziesTriggered++;
    this.soundManager.frenzy();
    this.updateFrenzyIndicator();

    // Tutorial: frenzy event
    if (this.tutorial) this.tutorial.triggerEvent('frenzy');

    // Cookie rain burst on frenzy start
    if (this.visualEffects) {
      if (type === 'click') {
        this.visualEffects.triggerCookieBurst(FRENZY_BURSTS.clickFrenzy.count, FRENZY_BURSTS.clickFrenzy.speed);
      } else {
        this.visualEffects.triggerCookieBurst(FRENZY_BURSTS.cpsFrenzy.count, FRENZY_BURSTS.cpsFrenzy.speed);
      }
    }

    // Easter egg: double frenzy (new frenzy while one was already running)
    if (wasAlreadyActive && this.tutorial) {
      this.tutorial.triggerEvent('doubleFrenzy');
    }
  }

  expireBuffs() {
    const now = Date.now();
    const hadBuffs = this.activeBuffs.length > 0;
    this.activeBuffs = this.activeBuffs.filter(b => b.endTime > now);
    if (hadBuffs && this.activeBuffs.length === 0) {
      this.updateFrenzyIndicator();
    }
  }

  endFrenzy() {
    this.activeBuffs = [];
    this.updateFrenzyIndicator();
  }

  updateFrenzyIndicator() {
    const indicator = document.getElementById("frenzy-indicator");
    if (!indicator) return;

    if (this.activeBuffs.length > 0) {
      indicator.innerHTML = '';
      for (const buff of this.activeBuffs) {
        const remaining = Math.max(0, Math.ceil((buff.endTime - Date.now()) / 1000));
        const line = document.createElement('div');
        const isDebuff = buff.multiplier < 1;
        line.className = `buff-line buff-${buff.type}${isDebuff ? ' buff-debuff' : ''}`;
        if (isDebuff && buff.type === 'click') {
          line.textContent = `🖐️ CURSED ${buff.multiplier}x Clicks (${remaining}s)`;
        } else if (isDebuff) {
          const pct = Math.round((1 - buff.multiplier) * 100);
          line.textContent = `🩸 CLOT -${pct}% CPS (${remaining}s)`;
        } else if (buff.type === 'cps') {
          line.textContent = `🔥 FRENZY ${buff.multiplier}x CPS (${remaining}s)`;
        } else {
          line.textContent = `⚡ CLICK FRENZY ${buff.multiplier}x (${remaining}s)`;
        }
        indicator.appendChild(line);
      }
      indicator.classList.add("active");
    } else {
      indicator.innerHTML = '';
      indicator.classList.remove("active");
    }
  }

  /** Check rhythm sync after each click and update UI. */
  _updateRhythmSync() {
    const synced = this.soundManager.isInSync();
    this._rhythmSynced = synced;
    this._updateRhythmMeterUI();
  }

  /** Refresh the rhythm meter display. */
  _updateRhythmMeterUI() {
    const meter = document.getElementById('rhythm-meter');
    if (!meter) return;

    const soundOn = this.settings.music;
    meter.classList.toggle('active', soundOn);
    meter.classList.toggle('synced', this._rhythmSynced);

    // Update beat pulse speed when piece changes (pulse at click rate, not note rate)
    if (this.soundManager.pieceChanged() || !meter.style.getPropertyValue('--beat-dur')) {
      const ms = Math.round(60000 / this.soundManager.getTargetClickBPM());
      meter.style.setProperty('--beat-dur', ms + 'ms');
    }

    const pieceEl = document.getElementById('rhythm-piece');
    if (pieceEl) pieceEl.textContent = '♪ ' + this.soundManager.getCurrentPieceName();

    const bpmEl = document.getElementById('rhythm-bpm');
    if (bpmEl) bpmEl.textContent = this.soundManager.getTargetClickBPM() + ' bpm';

    const syncEl = document.getElementById('rhythm-sync');
    const auto = this.soundManager.isAutoPlaying();
    if (syncEl) syncEl.textContent = this._rhythmSynced ? '· 1.5×' : auto ? '· auto' : '';

    // Click BPM above cookie
    const clickBpmEl = document.getElementById('click-bpm');
    if (clickBpmEl) {
      const cBpm = this.soundManager.getClickBPM();
      if (cBpm > 0 && soundOn) {
        clickBpmEl.textContent = cBpm + ' clicks/min';
        clickBpmEl.classList.add('active');
        clickBpmEl.classList.toggle('synced', this._rhythmSynced);
      } else {
        clickBpmEl.classList.remove('active', 'synced');
      }
    }
  }

  /** Keep the "Now Playing" widget in the middle panel up-to-date. */
  _updateNowPlaying() {
    if (!this.soundManager?._ctx) return; // not ready yet
    const npTitle = document.getElementById('now-playing-title');
    if (npTitle) {
      const melodyName = this.soundManager.getGenerativeMelodyName();
      const pieceName = this.soundManager.getCurrentPieceName();
      npTitle.textContent = melodyName || pieceName || '';
    }
    // Show volume label (Vol I / II / III)
    const npVol = document.getElementById('now-playing-volume');
    if (npVol) {
      const gm = this.soundManager._gameMusic;
      if (gm) {
        const C = gm.constructor;
        const trackName = gm._currentName;
        const dn = C._DISPLAY_NAMES || {};
        // Find which volume the current track belongs to
        const findKey = Object.entries(dn).find(([, v]) => v === trackName)?.[0];
        if (findKey && (C._VOL1 || []).includes(findKey)) {
          npVol.textContent = 'Vol. I';
        } else if (findKey && (C._VOL2 || []).includes(findKey)) {
          npVol.textContent = 'Vol. II';
        } else if (findKey && (C._VOL3 || []).includes(findKey)) {
          npVol.textContent = 'Vol. III';
        } else {
          npVol.textContent = '';
        }
      } else {
        npVol.textContent = '';
      }
    }
    const npWrap = document.getElementById('now-playing');
    if (npWrap) npWrap.classList.toggle('active', this.settings.music && this.settings.musicVolume > 0);
  }

  setPurchaseAmount(amount) {
    this.purchaseAmount = amount;
    this.updatePurchaseButtons();
    this.updateUI();

    // Easter egg: indecisive clicker (changed amount 6+ times)
    if (this.tutorial) {
      this.tutorial._purchaseChanges = (this.tutorial._purchaseChanges || 0) + 1;
      if (this.tutorial._purchaseChanges >= EASTER_EGGS.indecisiveClickerThreshold) {
        this.tutorial.triggerEvent('indecisiveClicker');
      }
    }
  }

  setBuildingSort(sortKey) {
    this._buildingSort = sortKey;
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === sortKey);
    });
    this._animateBuildings = true;
    this.updateUI();

    // Easter egg: tried every sort option
    if (this.tutorial) {
      this.tutorial._usedSorts = this.tutorial._usedSorts || new Set();
      this.tutorial._usedSorts.add(sortKey);
      if (this.tutorial._usedSorts.size >= EASTER_EGGS.ocdSorterThreshold) {
        this.tutorial.triggerEvent('ocdSorter');
      }
    }
  }

  getSortedBuildingIndices() {
    const indices = this.buildings.map((_, i) => i);
    switch (this._buildingSort) {
      case 'price':
        indices.sort((a, b) => this.buildings[a].cost.cmp(this.buildings[b].cost));
        break;
      case 'cps':
        indices.sort((a, b) => this.buildings[b].cps.cmp(this.buildings[a].cps));
        break;
      case 'efficiency':
        // Cost per CPS — lower is better
        indices.sort((a, b) => {
          const effA = this.buildings[a].cps.gt(0) ? this.buildings[a].cost.div(this.buildings[a].cps).toNumber() : Infinity;
          const effB = this.buildings[b].cps.gt(0) ? this.buildings[b].cost.div(this.buildings[b].cps).toNumber() : Infinity;
          return effA - effB;
        });
        break;
      case 'owned':
        indices.sort((a, b) => this.buildings[b].count - this.buildings[a].count);
        break;
      default:
        break; // original order
    }
    return indices;
  }

  updatePurchaseButtons() {
    const buttons = document.querySelectorAll('.purchase-amount-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.amount === this.purchaseAmount.toString()) {
        btn.classList.add('active');
      }
    });
  }

  createPurchaseAmountButtons() {
    const container = document.getElementById('purchase-amount-container');
    if (!container) {
      const shopDiv = document.getElementById('shop');
      const buildingList = document.getElementById('building-list');
      
      // Main toolbar container
      const toolbar = document.createElement('div');
      toolbar.id = 'purchase-amount-container';
      toolbar.classList.add('shop-toolbar');

      // Left side: Buy amount
      const buyGroup = document.createElement('div');
      buyGroup.classList.add('toolbar-group');
      const buyLabel = document.createElement('span');
      buyLabel.textContent = 'Buy:';
      buyLabel.classList.add('toolbar-label');
      buyGroup.appendChild(buyLabel);
      
      const amounts = GAME.purchaseAmounts;
      amounts.forEach(amount => {
        const btn = document.createElement('button');
        btn.textContent = amount.toString();
        btn.classList.add('purchase-amount-btn');
        btn.dataset.amount = amount;
        if ((amount === 1 && this.purchaseAmount === 1) || amount === this.purchaseAmount) {
          btn.classList.add('active');
        }
        btn.addEventListener('click', () => { this.setPurchaseAmount(amount); this.soundManager.uiClick(); });
        buyGroup.appendChild(btn);
      });

      // Right side: Sort
      const sortGroup = document.createElement('div');
      sortGroup.classList.add('toolbar-group');
      const sortLabel = document.createElement('span');
      sortLabel.textContent = 'Sort:';
      sortLabel.classList.add('toolbar-label');
      sortGroup.appendChild(sortLabel);

      const sorts = [
        { key: 'default', label: 'Def' },
        { key: 'price', label: 'Price' },
        { key: 'cps', label: 'CPS' },
        { key: 'efficiency', label: 'Eff' },
        { key: 'owned', label: 'Own' },
      ];
      sorts.forEach(s => {
        const btn = document.createElement('button');
        btn.textContent = s.label;
        btn.classList.add('sort-btn');
        btn.dataset.sort = s.key;
        btn.title = `Sort by ${s.key}`;
        if (s.key === this._buildingSort) btn.classList.add('active');
        btn.addEventListener('click', () => { this.setBuildingSort(s.key); this.soundManager.uiClick(); });
        sortGroup.appendChild(btn);
      });

      toolbar.appendChild(buyGroup);
      toolbar.appendChild(sortGroup);
      const insertTarget = document.getElementById('building-list-wrap') || buildingList;
      shopDiv.insertBefore(toolbar, insertTarget);
    }
  }

  setupPrestigeButton() {
    const btn = document.getElementById("prestige-btn");
    if (btn) {
      btn.addEventListener("click", () => { this.soundManager.prestigeConfirm(); this.handlePrestige(); });
    }

    // Easter egg: clicking the prestige cookie
    const prestEl = document.getElementById("left-prestige");
    if (prestEl) {
      prestEl.addEventListener("click", (e) => {
        // Only trigger if clicking the cookie icon itself, not the button
        if (e.target.classList.contains('chip-icon') || e.target.closest('.prestige-chips')) {
          if (this.tutorial) this.tutorial.triggerEvent('oooShiny');
        }
      });
    }
  }

  setupHeavenlyShop() {
    const btn = document.getElementById("heavenly-shop-btn");
    const overlay = document.getElementById("heavenly-overlay");
    const closeBtn = document.getElementById("heavenly-close");

    if (btn && overlay) {
      btn.addEventListener("click", () => {
        this.renderHeavenlyShop();
        overlay.classList.remove("hidden");
        this.soundManager.panelOpen();
      });
    }
    if (closeBtn && overlay) {
      closeBtn.addEventListener("click", () => { overlay.classList.add("hidden"); this.soundManager.panelClose(); });
    }
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { overlay.classList.add("hidden"); this.soundManager.panelClose(); }
      });
    }
  }

  renderHeavenlyShop() {
    const grid = document.getElementById("heavenly-upgrade-grid");
    const chipsEl = document.getElementById("heavenly-available-chips");
    if (!grid) return;

    const spendable = this.prestige.getSpendableChips();
    if (chipsEl) chipsEl.textContent = formatNumberInWords(spendable);

    grid.innerHTML = "";
    heavenlyUpgrades.forEach(upgrade => {
      const owned = this.prestige.hasUpgrade(upgrade.id);
      const canBuy = this.prestige.canBuyUpgrade(upgrade.id);

      const prereqsMet = !upgrade.requires || upgrade.requires.length === 0 ||
        upgrade.requires.every(r => this.prestige.hasUpgrade(r));
      const unaffordable = !owned && !canBuy && prereqsMet && spendable < upgrade.cost;

      const card = document.createElement("div");
      card.className = `heavenly-card${owned ? ' heavenly-owned' : ''}${canBuy ? ' heavenly-buyable' : ''}${!prereqsMet && !owned ? ' heavenly-locked' : ''}${unaffordable ? ' heavenly-unaffordable' : ''}`;

      const costStr = formatNumberInWords(upgrade.cost);
      const prereqNames = (upgrade.requires || []).map(r => {
        const u = heavenlyUpgrades.find(h => h.id === r);
        return u ? u.name : r;
      });

      card.innerHTML = `
        <div class="heavenly-card-header">
          <span class="heavenly-card-name">${upgrade.name}</span>
          <span class="heavenly-card-cost">${owned ? '✓' : `<span class="heavenly-cookie-small">🍪</span> ${costStr}`}</span>
        </div>
        <div class="heavenly-card-desc">${upgrade.desc}</div>
        ${!prereqsMet && !owned ? `<div class="heavenly-card-prereq">Requires: ${prereqNames.join(', ')}</div>` : ''}
        ${unaffordable ? `<div class="heavenly-card-prereq">Need ${costStr} chips (have ${formatNumberInWords(spendable)})</div>` : ''}
      `;

      if (!owned && canBuy) {
        card.addEventListener("click", () => {
          if (this.prestige.buyUpgrade(upgrade.id)) {
            this.soundManager.prestigeUpgrade();
            this.renderHeavenlyShop();
            this.calculateCPS();
            this.updateLeftPanel();
            this.saveGame();
            const newChipsEl = document.getElementById("heavenly-available-chips");
            if (newChipsEl) newChipsEl.classList.add('heavenly-chip-flash');
          }
        });
      }

      grid.appendChild(card);
    });
  }

  updateHeavenlyShopButton() {
    // Access moved to upgrade grid — always hide left panel button
    const btn = document.getElementById("heavenly-shop-btn");
    if (btn) btn.style.display = 'none';
  }

  // === Debug Panel ===

  // Overlay methods (debug, music, synergy) in gameOverlays.js
  setupUpgradeNav() {
    const prev = document.getElementById("upgrade-prev");
    const next = document.getElementById("upgrade-next");
    if (prev) prev.addEventListener("click", () => {
      if (this._upgradePage > 0) { this._upgradePage--; this._upgradeNavDir = 'left'; this.renderUpgradePage(true); this.updateButtonsState(); this.soundManager.upgradePageNav(); }
    });
    if (next) next.addEventListener("click", () => {
      const totalPages = this._getUpgradeTotalPages();
      if (this._upgradePage < totalPages - 1) { this._upgradePage++; this._upgradeNavDir = 'right'; this.renderUpgradePage(true); this.updateButtonsState(); this.soundManager.upgradePageNav(); }
    });
  }

  setupMenu() {
    const menuBtn = document.getElementById("menu-btn");
    const overlay = document.getElementById("menu-overlay");
    const closeBtn = document.getElementById("menu-close");

    if (menuBtn && overlay) {
      menuBtn.addEventListener("click", () => {
        this.updateMenu();
        this._syncToggles();
        overlay.classList.remove("hidden");
        this.soundManager.panelOpen();
        // Easter egg: first time opening settings
        if (this.tutorial) this.tutorial.triggerEvent('settingsOpened');
      });
    }
    if (closeBtn && overlay) {
      closeBtn.addEventListener("click", () => { overlay.classList.add("hidden"); this.soundManager.panelClose(); });
    }
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { overlay.classList.add("hidden"); this.soundManager.panelClose(); }
      });
    }

    // Replay Tutorial button
    const replayBtn = document.getElementById("replay-tutorial-btn");
    if (replayBtn) {
      replayBtn.addEventListener("click", () => {
        this.soundManager.replayTutorial();
        overlay.classList.add("hidden");
        this.tutorial.replayTutorial();
      });
    }

    // ── Settings toggles ──
    this._bindToggle("setting-particles", "particles", (v) => {
      if (this.visualEffects) this.visualEffects.particlesEnabled = v;
    });
    this._bindToggle("setting-short-numbers", "shortNumbers", (v) => {
      setShortNumbers(v);
      this.updateUI();
    });
    this._bindToggle("setting-shimmers", "shimmers", (v) => {
      if (this.visualEffects) this.visualEffects.shimmersEnabled = v;
    });
    this._bindToggle("setting-music", "music", () => {
      if (this.settings.music) {
        this.soundManager.startMusic();
        this.soundManager.startMelody();
      } else {
        this.soundManager.stopMusic();
        this.soundManager.stopMelody();
      }
      this._updateRhythmMeterUI();
    });
    this._bindToggle("setting-effects", "soundEffects");
    this._bindToggle("setting-ambient", "ambient", () => {
      if (this.settings.ambient) this.soundManager.startAmbient();
      else this.soundManager.stopAmbient();
    });

    // Volume sliders
    this._bindSlider("vol-music", "musicVolume", (v) => { this.soundManager.setMusicVolume(v); this._updateNowPlaying(); });
    this._bindSlider("vol-effects", "effectsVolume", (v) => this.soundManager.setEffectsVolume(v));
    this._bindSlider("vol-ambient", "ambientVolume", (v) => this.soundManager.setAmbientVolume(v));

    // ── Element-specific ambient hover sounds ──
    this._bindHoverAmbient('shop', () => this.soundManager.shopAmbientTick());
    this._bindHoverAmbient('news-broadcast', () => this.soundManager.newsAmbientTick());
    this._bindHoverAmbient('click-area', () => this.soundManager.bakeAmbientTick());

    // ── Export Save ──
    const exportBtn = document.getElementById("export-save-btn");
    const saveArea = document.getElementById("save-text-area");
    if (exportBtn && saveArea) {
      exportBtn.addEventListener("click", () => {
        this.soundManager.exportSave();
        const raw = localStorage.getItem("cookieClickerSave");
        if (raw) {
          saveArea.style.display = "block";
          saveArea.value = raw;
          saveArea.select();
          navigator.clipboard.writeText(raw).catch(() => {});
          exportBtn.textContent = "✓ Copied!";
          setTimeout(() => { exportBtn.textContent = "📤 Export Save"; }, 2000);
        }
      });
    }

    // ── Import Save ──
    const importBtn = document.getElementById("import-save-btn");
    if (importBtn && saveArea) {
      importBtn.addEventListener("click", () => {
        this.soundManager.importSave();
        if (saveArea.style.display === "none") {
          saveArea.style.display = "block";
          saveArea.value = "";
          saveArea.placeholder = "Paste your save data here, then click Import again...";
          importBtn.textContent = "📥 Confirm Import";
        } else if (saveArea.value.trim()) {
          if (confirm("This will overwrite your current save. Continue?")) {
            localStorage.setItem("cookieClickerSave", saveArea.value.trim());
            location.reload();
          }
        }
      });
    }

    // ── Wipe Save ──
    const wipeBtn = document.getElementById("wipe-save-btn");
    if (wipeBtn) {
      wipeBtn.addEventListener("click", () => {
        this.soundManager.wipeSave();
        if (confirm("Are you sure? This will permanently delete ALL your progress!")) {
          if (confirm("Really? There is no undo. All cookies, buildings, and upgrades will be gone.")) {
            this._wipedSave = true; // Prevent auto-save from re-writing
            localStorage.removeItem("cookieClickerSave");
            location.reload();
          }
        }
      });
    }
  }

  /** Helper: bind a checkbox toggle to a settings property */
  _bindToggle(elementId, settingsKey, onChange) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.checked = this.settings[settingsKey];
    el.addEventListener("change", () => {
      this.settings[settingsKey] = el.checked;
      this.soundManager.uiClick();
      if (onChange) onChange(el.checked);
      this.saveGame();
    });
  }

  _bindSlider(elementId, settingsKey, onChange) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.value = (this.settings[settingsKey] ?? 0.5) * 100;
    el.addEventListener("input", () => {
      const v = el.value / 100;
      this.settings[settingsKey] = v;
      if (onChange) onChange(v);
      // Update the percentage label if present
      const label = el.parentElement?.querySelector('.vol-pct');
      if (label) label.textContent = Math.round(v * 100) + '%';
    });
    el.addEventListener("change", () => this.saveGame());
  }

  /** Bind hover ambient sounds to an element — plays a tick at random intervals while hovering. */
  _bindHoverAmbient(elementId, tickFn) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let timer = null;
    const schedule = () => {
      timer = setTimeout(() => {
        tickFn();
        schedule();
      }, 800 + Math.random() * 1800);   // tick every 0.8–2.6 s
    };
    el.addEventListener('mouseenter', () => { if (!timer) schedule(); });
    el.addEventListener('mouseleave', () => { clearTimeout(timer); timer = null; });
  }

  /** Sync toggle checkboxes and volume sliders with current settings (called on menu open) */
  _syncToggles() {
    const map = { "setting-particles": "particles", "setting-short-numbers": "shortNumbers", "setting-shimmers": "shimmers", "setting-music": "music", "setting-effects": "soundEffects", "setting-ambient": "ambient" };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.checked = this.settings[key];
    }
    const sliders = { "vol-music": "musicVolume", "vol-effects": "effectsVolume", "vol-ambient": "ambientVolume" };
    for (const [id, key] of Object.entries(sliders)) {
      const el = document.getElementById(id);
      if (el) {
        el.value = (this.settings[key] ?? 0.5) * 100;
        const label = el.parentElement?.querySelector('.vol-pct');
        if (label) label.textContent = Math.round((this.settings[key] ?? 0.5) * 100) + '%';
      }
    }
  }

  updateMenu() {
    // Stats now live in The Cookie Chronicle newspaper — just show the open button
    const statsEl = document.getElementById("menu-stats");
    if (statsEl && !statsEl.querySelector('.sn-open-btn')) {
      statsEl.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'sn-open-btn';
      btn.innerHTML = `<div class="sn-btn-masthead">The Cookie Chronicle</div><div class="sn-btn-teaser">Tap to read the latest — ${formatNumberInWords(this.stats.totalCookiesBaked)} cookies and counting</div>`;
      btn.addEventListener('click', () => this._openStatsOverlay());
      statsEl.appendChild(btn);
    }
  }

  // === Music Player ===

  // More overlay methods in gameOverlays.js
  // === Cookie Particles ===
  // Particle methods in gameParticles.js

  handlePrestige() {
    const newChips = this.prestige.calculateHeavenlyChipsOnReset();
    if (newChips < 10) return;

    if (confirm(`Prestige now to earn ${newChips} Prestige Chips?\n\nYou'll reset all cookies and buildings but keep your Prestige Chips which give permanent CPS bonuses.\n\nBalance after: ${this.prestige.getSpendableChips() + newChips} (spending chips on upgrades reduces your bonus)`)) {
      this.prestige.performPrestige();

      // Massive cookie rain burst on prestige
      if (this.visualEffects) {
        this.visualEffects.triggerCookieBurst(FRENZY_BURSTS.prestige.count, FRENZY_BURSTS.prestige.speed);
      }

      // Easter egg: first prestige
      if (this.tutorial) this.tutorial.triggerEvent('firstPrestige');
    }
  }

  resetForPrestige() {
    // Heavenly Cookies: start with more cookies
    const startingMultiplier = this.prestige.getStartingCookiesMultiplier();
    this.cookies = CookieNum.from(GAME.startingCookies * startingMultiplier);
    this.cookiesPerClick = CookieNum.from(GAME.startingCookiesPerClick);
    this.cookiesPerSecond = CookieNum.ZERO;
    this.globalCpsMultiplier = 1;
    this.luckyClickChance = 0;
    this.cpsClickBonus = 0;
    this.miniGameBonus = 1;
    this.frenzyDurationMultiplier = 1;
    this.activeBuffs = [];

    // Reset grandmapocalypse state
    if (this.grandmapocalypse) {
      const keepStage = this.prestige.hasUpgrade('elderKnowledge');
      this.grandmapocalypse.stage = keepStage ? 1 : 0;
      this.grandmapocalypse.researchPurchased = keepStage ? new Set(['bingoCenter']) : new Set();
      this.grandmapocalypse.elderPledgeActive = false;
      clearTimeout(this.grandmapocalypse._pledgeTimer);
      this.grandmapocalypse.pledgeCount = 0;
      this.grandmapocalypse.covenantActive = false;
      this.grandmapocalypse._covenantPenaltyApplied = false;
      this.grandmapocalypse._previousStage = keepStage ? 1 : 0;
      this.grandmapocalypse._apocalypseStartTime = 0;
      this.grandmapocalypse._pledgeTimer = null;
      this._grandmapocalypseGrandmaBoost = 1;
      this.grandmapocalypse._applyResearchBoosts();
      this.grandmapocalypse.applyStageTheme(keepStage ? 1 : 0);
      this.grandmapocalypse._panelOpen = false;
      const gpPanel = document.getElementById("grandmapocalypse-panel");
      if (gpPanel) gpPanel.classList.remove("gp-expanded");
      this.grandmapocalypse._renderResearchPanel();
    }
    // Clear wrinklers on prestige
    if (this.wrinklerManager) {
      this.wrinklerManager.wrinklers = [];
      this.wrinklerManager._stopSpawning();
      this.wrinklerManager._stopRenderLoop();
      if (this.grandmapocalypse && this.grandmapocalypse.stage >= 1) {
        this.wrinklerManager._startRenderLoop();
        this.wrinklerManager.onStageChange(this.grandmapocalypse.stage);
      }
    }

    // Reset middle panel / UI state
    this._upgradePage = 0;
    this._upgradeOrder = [];
    this._buildingSort = 'default';
    this._animateBuildings = false;
    if (this._upgradeSortTimer) {
      clearTimeout(this._upgradeSortTimer);
      this._upgradeSortTimer = null;
    }

    // Close heavenly overlay if open
    const heavenlyOverlay = document.getElementById('heavenly-overlay');
    if (heavenlyOverlay) heavenlyOverlay.classList.add('hidden');

    // Reset golden cookie / frenzy timers
    if (this.visualEffects) {
      clearTimeout(this.visualEffects.goldenCookieTimer);
      clearTimeout(this.visualEffects._goldenTimeout);
      // Restart golden cookie spawn cycle
      this.visualEffects._scheduleGoldenCookie();
    }

    // Clear mobile golden cookie badge
    if (this._mobileNav) this._mobileNav.clearGoldenBadge();

    // Switch to default tab on mobile
    if (this._mobileNav && this._mobileNav.isMobile()) {
      this._mobileNav.switchTab('click-area');
    }

    // Persistent Memory: save upgrade levels before reset (use highest of all tiers)
    const memoryFraction = Math.max(
      this.prestige.getPersistentMemoryFraction(),
      this.prestige.getPersistentMemoryFraction2(),
      this.prestige.getPersistentMemoryFraction3()
    );
    const savedUpgradeLevels = [];
    if (memoryFraction > 0) {
      this.upgrades.forEach((u, i) => {
        if (u.type !== 'tieredUpgrade' && u.level > 0) {
          const retainedLevels = Math.floor(u.level * memoryFraction);
          if (retainedLevels > 0) {
            savedUpgradeLevels.push({ index: i, level: retainedLevels });
          }
        }
      });
    }

    // Reset buildings
    this.buildings = buildings.map((_, index) => new Building(index, this));
    // Reset upgrades
    this.upgrades = upgrades.map((_, index) => new Upgrade(index, this));

    // Twin Gates: apply building cost reduction
    const buildingDiscount = this.prestige.getBuildingCostReduction();
    if (buildingDiscount > 0) {
      this.buildings.forEach(b => {
        b.baseCost = b.baseCost.mul(1 - buildingDiscount).floor();
        b.cost = b.baseCost.clone();
      });
    }

    // Starter Kit: give free buildings
    const starterBuildings = this.prestige.getStarterBuildings();
    starterBuildings.forEach(idx => {
      if (this.buildings[idx]) {
        this.buildings[idx].count = 1;
        this.buildings[idx].recalculateCost();
      }
    });

    // Cookie Stockpile: give additional free buildings (Factory, Mine)
    const starterBuildings2 = this.prestige.getStarterBuildings2();
    starterBuildings2.forEach(idx => {
      if (this.buildings[idx]) {
        this.buildings[idx].count = 1;
        this.buildings[idx].recalculateCost();
      }
    });

    // Divine Granaries: give free Shipment, Alchemy Lab, Portal
    const starterBuildings3 = this.prestige.getStarterBuildings3();
    starterBuildings3.forEach(idx => {
      if (this.buildings[idx]) {
        this.buildings[idx].count = 1;
        this.buildings[idx].recalculateCost();
      }
    });

    // Persistent Memory: restore retained upgrade levels
    savedUpgradeLevels.forEach(({ index, level }) => {
      const upgrade = this.upgrades[index];
      if (upgrade) {
        for (let i = 0; i < level; i++) {
          upgrade.level++;
          upgrade.applyEffect();
          let costMult = upgrade.level > upgrade.base_max_level ? upgrade.prestige_cost_multiplier : upgrade.cost_multiplier;
          if (upgrade.accel_start && upgrade.cost_acceleration && upgrade.level >= upgrade.accel_start) {
            const extra = upgrade.level - upgrade.accel_start + 1;
            upgrade.cost = upgrade.cost.mul(costMult).mul(CookieNum.from(upgrade.cost_acceleration).pow(extra));
          } else {
            upgrade.cost = upgrade.cost.mul(costMult);
          }
        }
      }
    });

    // Cosmic Grandma: apply grandma multiplier
    this.prestige.applyAllEffects();

    // Reset stats for this run (but keep prestige stats)
    this.stats = {
      totalCookiesBaked: CookieNum.ZERO,
      totalClicks: 0,
      totalUpgradesPurchased: 0,
      luckyClicks: 0,
      frenziesTriggered: 0,
      timesPrestiged: this.prestige.timesPrestiged,
      startTime: Date.now(),
      handmadeCookies: CookieNum.ZERO,
      miniGamesWon: [],
      cutterBestAccuracy: 0,
      kitchenBestStreak: 0,
      slotsJackpots: 0,
      goldenCookiesClicked: 0,
      sessionPrestiges: (this.stats.sessionPrestiges || 0) + 1,
      miniGamesPlayed: 0,
      // Grandmapocalypse stats (persist across prestiges)
      wrinklersPopped: this.stats.wrinklersPopped || 0,
      wrinklersFed: this.stats.wrinklersFed || 0,
      shinyWrinklersPopped: this.stats.shinyWrinklersPopped || 0,
      wrinklerBigPop: this.stats.wrinklerBigPop || 0,
      elderPledgesUsed: this.stats.elderPledgesUsed || 0,
      elderCovenantSigned: this.stats.elderCovenantSigned || false,
      wrathCookiesClicked: this.stats.wrathCookiesClicked || 0,
      wrathClotSurvived: this.stats.wrathClotSurvived || 0,
      elderFrenzyTriggered: this.stats.elderFrenzyTriggered || 0,
      // Per-minigame stats (persist across prestiges)
      perGame: this.stats.perGame || {},
      // Alchemy stats (persist across prestiges — too grindy to lose)
      alchemyDiscovered: this.stats.alchemyDiscovered || [],
      alchemyResets: this.stats.alchemyResets || 0,
      alchemyBestSession: this.stats.alchemyBestSession || 0,
      alchemyTotalMerges: this.stats.alchemyTotalMerges || 0,
      alchemyPerfectSessions: this.stats.alchemyPerfectSessions || 0,
    };

    // Reset purchase amount to default
    this.purchaseAmount = 1;

    this.calculateCPS();
    this.saveGame();

    // Reset all visual/UI artifacts before re-rendering
    if (this.visualEffects) {
      this.visualEffects.resetForPrestige();
    }

    // Remove any lingering floating text from clicks
    document.querySelectorAll('.cookie-text').forEach(el => el.remove());

    this.updateUI();
    this.updateLeftPanel();
    this.updatePurchaseButtons();
    this.updateFrenzyIndicator();
    this.visualEffects.update();
  }
  
  // createFloatingText in gameParticles.js
  // Offline earnings are now shown via Tutorial.showOfflineEarnings() popup

  updateCookieCount() {
    document.getElementById("cookie-count").textContent = formatNumberInWords(this.cookies);
    document.getElementById("cps-count").textContent = formatNumberInWords(this.getEffectiveCPS());
    document.getElementById("cpc-count").textContent = formatNumberInWords(this.getEffectiveCPC());



    if (this.purchaseAmount === 'Max') {
      this.renderBuildingList(false);
      this.renderUpgradePage();
    }
    this.updateButtonsState();

    // Update frenzy timer
    if (this.activeBuffs.length > 0) {
      this.updateFrenzyIndicator();
    }
  }
  
  updateButtonsState() {
    let anyUpgradeAffordable = false;
    document.querySelectorAll(".upgrade-btn").forEach((button) => {
      const index = parseInt(button.dataset.index, 10);
      const upgrade = this.upgrades[index];
      if (!upgrade) return;
      
      // Requirements check first
      if (!upgrade.meetsRequirements()) {
        button.disabled = true;
        button.classList.add('upgrade-locked');
        button.dataset.disabledReason = `🔒 ${upgrade.getRequirementText()}`;
        return;
      }
      button.classList.remove('upgrade-locked');

      const effectiveCost = upgrade.getEffectiveCost();
      if (upgrade.type === "tieredUpgrade") {
        if (upgrade.level > 0 && upgrade.currentTier >= upgrade.tiers.length - 1) {
          button.disabled = true;
          button.dataset.disabledReason = 'Maximum Tier Reached';
        } else if (upgrade.level > 0 && !upgrade.canUpgradeTier()) {
          button.disabled = true;
          const nextTier = upgrade.tiers[upgrade.currentTier + 1];
          const totalBuildings = this.getTotalBuildingCount();
          button.dataset.disabledReason = `Need ${nextTier.buildingsRequired} buildings (have ${totalBuildings})`;
        } else if (this.cookies.lt(effectiveCost)) {
          button.disabled = true;
          button.dataset.disabledReason = "Not Enough Cookies";
        } else {
          button.disabled = false;
          delete button.dataset.disabledReason;
          anyUpgradeAffordable = true;
        }
      } else {
        const effectiveMax = upgrade.getEffectiveMaxLevel();
        if (upgrade.level >= effectiveMax) {
          button.disabled = true;
          button.dataset.disabledReason = upgrade.prestige_bonus_levels > 0
            ? `Max Level: ${effectiveMax} (Prestige to unlock more!)`
            : `Max Level: ${effectiveMax}`;
        } else if (this.cookies.lt(effectiveCost)) {
          button.disabled = true;
          button.dataset.disabledReason = "Not Enough Cookies";
        } else {
          button.disabled = false;
          delete button.dataset.disabledReason;
          anyUpgradeAffordable = true;
        }
      }
    });

    // Tutorial: first time an upgrade becomes affordable
    if (anyUpgradeAffordable) {
      this.tutorial.triggerEvent('firstUpgradeBuyable');
    }
  
    document.querySelectorAll(".building").forEach((button) => {
      const index = parseInt(button.dataset.buildingIndex, 10);
      const building = this.buildings[index];
      if (!building) return;
      const purchaseAmount = this.purchaseAmount;
      
      if (purchaseAmount === 'Max') {
        button.disabled = this.cookies.lt(building.cost);
      } else {
        const totalCost = building.calculateBulkCost(purchaseAmount);
        button.disabled = this.cookies.lt(totalCost);
      }
    });
  }

  renderBuildingList(animate = false) {
    const buildingList = document.getElementById("building-list");
    buildingList.innerHTML = "";
    const sortedIndices = this.getSortedBuildingIndices();

    // Show ALL buildings — locked ones get locked styling
    sortedIndices.forEach((index, i) => {
      const div = this.buildings[index].getButton(index);
      if (animate) {
        div.classList.add('building-enter');
        div.style.animationDelay = `${i * 30}ms`;
      }
      buildingList.appendChild(div);
    });

    // Refresh shop visual overlays synchronously (before paint) to avoid pulse
    if (this.visualEffects && this.visualEffects.shopEffects) {
      this.visualEffects.shopEffects.refresh();
    }

    // Apply purchase flash to buildings that were just bought
    this.buildings.forEach((b, idx) => {
      if (b._pendingFlash) {
        b._pendingFlash = false;
        const btn = buildingList.querySelector(`.building[data-building-index="${idx}"]`);
        if (btn) {
          btn.classList.add('building-purchase-flash');
          btn.addEventListener('animationend', () => btn.classList.remove('building-purchase-flash'), { once: true });
        }
      }
    });
  }

  /** Lightweight update after a purchase — avoids full DOM rebuild so rapid clicks register */
  updateAfterPurchase() {
    this.calculateCPS();
    this.updateCookieCount();
    // Schedule a deferred full DOM rebuild to update button text/cost
    if (this._purchaseRenderTimer) clearTimeout(this._purchaseRenderTimer);
    this._purchaseRenderTimer = setTimeout(() => {
      this._purchaseRenderTimer = null;
      this.renderUpgradePage();
      this.renderBuildingList(false);
      // Refresh research panel costs/availability
      if (this.grandmapocalypse) this.grandmapocalypse._renderResearchPanel();
    }, 150);
  }

  updateUI() {
    // Update Upgrades (paginated)
    this.renderUpgradePage();

    // Update Buildings (sorted, with optional animation)
    const animate = this._animateBuildings || false;
    this._animateBuildings = false;
    this.renderBuildingList(animate);

    this.calculateCPS();
    this.updateCookieCount();
  }

  // === Paginated Upgrades ===
  get upgradePageSize() { return GAME.upgradePageSize; }

  _getUpgradeTotalPages() {
    const total = (this._upgradeOrder || this.upgrades).length;
    const pageSize = this.upgradePageSize;
    const firstPageCapacity = pageSize - 1; // reserve last slot for heavenly icon
    if (total <= firstPageCapacity) return 1;
    const remaining = total - firstPageCapacity;
    return 1 + Math.ceil(remaining / pageSize);
  }

  _createHeavenlyShopIcon() {
    const btn = document.createElement("button");
    btn.classList.add("upgrade-btn", "heavenly-shop-icon");

    const hasPrestiged = this.prestige.timesPrestiged >= 1;

    if (hasPrestiged) {
      btn.innerHTML = "<span class='heavenly-cookie-small'>🍪</span> Prestige<br>Upgrades";
      btn.addEventListener("click", () => {
        this.renderHeavenlyShop();
        const overlay = document.getElementById("heavenly-overlay");
        if (overlay) overlay.classList.remove("hidden");
      });
    } else {
      btn.innerHTML = "🔒 Prestige<br>Upgrades";
      btn.classList.add("locked");
      btn.disabled = true;
      btn.dataset.disabledReason = "Prestige at least once to unlock";
    }

    return btn;
  }

  renderUpgradePage(animated = false) {
    if (this._upgradePage === undefined) this._upgradePage = 0;
    // Initialize sort order if not set — use full maxed-aware sort
    if (!this._upgradeOrder || this._upgradeOrder.length !== this.upgrades.length) {
      this.sortUpgradesByCost(false);
    }
    const pageSize = this.upgradePageSize;
    const firstPageCapacity = pageSize - 1; // reserve last slot for heavenly icon
    const totalPages = this._getUpgradeTotalPages();
    if (this._upgradePage >= totalPages) this._upgradePage = totalPages - 1;

    let start, count;
    if (this._upgradePage === 0) {
      start = 0;
      count = Math.min(firstPageCapacity, this._upgradeOrder.length);
    } else {
      start = firstPageCapacity + (this._upgradePage - 1) * pageSize;
      count = pageSize;
    }
    const pageIndices = this._upgradeOrder.slice(start, start + count);

    const list = document.getElementById("upgrade-list");

    const populate = () => {
      list.innerHTML = "";
      pageIndices.forEach((upgradeIdx, i) => {
        const upgrade = this.upgrades[upgradeIdx];
        const btn = upgrade.getButton(upgradeIdx);
        if (animated) {
          btn.classList.add('upgrade-enter');
          btn.style.animationDelay = `${i * 25}ms`;
          btn.addEventListener('animationend', () => btn.classList.remove('upgrade-enter'), { once: true });
        }
        list.appendChild(btn);
      });
      // Always add heavenly shop icon as last item on page 0
      if (this._upgradePage === 0) {
        const heavenlyBtn = this._createHeavenlyShopIcon();
        if (animated) {
          heavenlyBtn.classList.add('upgrade-enter');
          heavenlyBtn.style.animationDelay = `${pageIndices.length * 25}ms`;
          heavenlyBtn.addEventListener('animationend', () => heavenlyBtn.classList.remove('upgrade-enter'), { once: true });
        }
        list.appendChild(heavenlyBtn);
      }
    };

    if (animated && list.children.length > 0) {
      const dir = this._upgradeNavDir || 'right';
      list.classList.remove('upgrade-slide-left', 'upgrade-slide-right', 'upgrade-slide-in-left', 'upgrade-slide-in-right');
      list.classList.add(dir === 'right' ? 'upgrade-slide-left' : 'upgrade-slide-right');
      const onEnd = () => {
        list.removeEventListener('animationend', onEnd);
        list.classList.remove('upgrade-slide-left', 'upgrade-slide-right');
        populate();
        list.classList.add(dir === 'right' ? 'upgrade-slide-in-right' : 'upgrade-slide-in-left');
        const onIn = () => {
          list.removeEventListener('animationend', onIn);
          list.classList.remove('upgrade-slide-in-left', 'upgrade-slide-in-right');
        };
        list.addEventListener('animationend', onIn, { once: true });
      };
      list.addEventListener('animationend', onEnd, { once: true });
    } else {
      populate();
    }

    // Update nav
    const prev = document.getElementById("upgrade-prev");
    const next = document.getElementById("upgrade-next");
    const info = document.getElementById("upgrade-page-info");
    if (prev) prev.disabled = this._upgradePage <= 0;
    if (next) next.disabled = this._upgradePage >= totalPages - 1;
    if (info) info.textContent = `${this._upgradePage + 1} / ${totalPages}`;
  }

  // === Upgrade sorting by cost ===
  sortUpgradesByCost(render = true) {
    this._upgradeOrder = this.upgrades.map((_, i) => i);
    this._upgradeOrder.sort((a, b) => {
      const upA = this.upgrades[a];
      const upB = this.upgrades[b];
      // Priority: 0 = buyable/unlocked, 1 = locked (requirements not met), 2 = maxed
      const getPriority = (u) => {
        const maxed = u.type === 'tieredUpgrade'
          ? (u.level > 0 && u.currentTier >= u.tiers.length - 1)
          : (u.level >= u.getEffectiveMaxLevel());
        if (maxed) return 2;
        if (!u.meetsRequirements()) return 1;
        return 0;
      };
      const prioA = getPriority(upA);
      const prioB = getPriority(upB);
      if (prioA !== prioB) return prioA - prioB;
      return upA.cost.cmp(upB.cost);
    });
    this._upgradePage = 0;
    if (render) this.renderUpgradePage(true);
  }

  scheduleUpgradeSort() {
    if (this._upgradeSortTimer) clearTimeout(this._upgradeSortTimer);
    this._upgradeSortTimer = setTimeout(() => {
      this._upgradeSortTimer = null;
      this.sortUpgradesByCost();
    }, GAME.upgradeSortDelayMs);
  }

  calculateCPS() {
    // Base CPS from buildings
    let baseCps = this.buildings.reduce((acc, b) => acc.add(b.cps.mul(b.count)), CookieNum.ZERO);

    // Divine Bakeries: +X% CPS per prestige level to all buildings
    const buildingPrestigeBonus = this.prestige.getBuildingCpsPerPrestige();
    if (buildingPrestigeBonus > 0) {
      baseCps = baseCps.mul(1 + buildingPrestigeBonus);
    }

    // Synergy multiplier from Synergy Vol. II, Cosmic Synergy, and Celestial Synergy heavenly upgrades
    const synergyMult = this.prestige.getSynergyMultiplier() * this.prestige.getSynergyMultiplier2() * this.prestige.getSynergyMultiplier3();

    // Add synergy bonuses
    this.upgrades.forEach(upgrade => {
      if (upgrade.type === "synergy" && upgrade.level > 0) {
        const sourceBuilding = this.buildings.find(b => b.name === upgrade.source);
        const targetBuilding = this.buildings.find(b => b.name === upgrade.target);
        if (sourceBuilding && targetBuilding) {
          // Each level multiplies the bonus, doubled by Synergy Vol. II
          const synergyBonus = sourceBuilding.count * upgrade.bonus * upgrade.level * synergyMult;
          baseCps = baseCps.add(CookieNum.from(targetBuilding.count * synergyBonus));
        }
      }
    });

    // Add cursor scaling bonuses
    const cursorBuilding = this.buildings.find(b => b.name === "Cursor");
    if (cursorBuilding && cursorBuilding.count > 0) {
      let cursorBonusPerBuilding = 0;
      this.upgrades.forEach(upgrade => {
        if (upgrade.type === "cursorScaling" && upgrade.level > 0) {
          cursorBonusPerBuilding += upgrade.bonus;
        }
        // Tiered cursor scaling: sum all unlocked tier bonuses
        if (upgrade.type === "tieredUpgrade" && upgrade.subtype === "cursorScaling" && upgrade.level > 0) {
          for (let t = 0; t <= upgrade.currentTier; t++) {
            cursorBonusPerBuilding += upgrade.tiers[t].bonus;
          }
        }
      });
      if (cursorBonusPerBuilding > 0) {
        const nonCursorBuildings = this.buildings.filter(b => b.name !== "Cursor").reduce((sum, b) => sum + b.count, 0);
        baseCps = baseCps.add(CookieNum.from(cursorBuilding.count * nonCursorBuildings * cursorBonusPerBuilding));
      }
    }

    // Grandmapocalypse boost to Grandma buildings
    if (this._grandmapocalypseGrandmaBoost > 1) {
      const grandmaBuilding = this.buildings.find(b => b.name === "Grandma");
      if (grandmaBuilding && grandmaBuilding.count > 0) {
        const baseGrandmaCps = grandmaBuilding.cps.mul(grandmaBuilding.count);
        const boostedExtra = baseGrandmaCps.mul(this._grandmapocalypseGrandmaBoost - 1);
        baseCps = baseCps.add(boostedExtra);
      }
    }

    this.cookiesPerSecond = baseCps;
    return this.cookiesPerSecond;
  }

  getTotalBuildingCount() {
    return this.buildings.reduce((total, building) => total + building.count, 0);
  }

  // === Left Panel Update ===
  updateLeftPanel() {
    // Multipliers section — colored bars
    const multEl = document.getElementById("left-multipliers");
    if (multEl) {
      const globalVal = this.globalCpsMultiplier;
      const achVal = this.achievementManager.getMultiplier();
      const prestVal = this.prestige.getPrestigeMultiplier();
      const combined = globalVal * achVal * prestVal;
      // Bar width: logarithmic scaling — fills gradually over a wide multiplier range
      // Individual bars reach 100% at ~x100, combined at ~x10000
      const barPct = (v) => Math.min(100, v > 1 ? Math.log10(v) * GAME.multiplierBarLogScale : 0).toFixed(0);
      const combinedBarPct = (v) => Math.min(100, v > 1 ? Math.log10(v) * GAME.combinedBarLogScale : 0).toFixed(0);

      const efficiency = this.getProductionEfficiency();
      const effPct = (efficiency * 100).toFixed(0);
      const effClass = efficiency >= 0.8 ? 'eff-high' : efficiency >= 0.4 ? 'eff-mid' : 'eff-low';

      multEl.innerHTML = `
        <div class="mult-row">
          <span class="mult-label">Global</span>
          <div class="mult-bar-track"><div class="mult-bar-fill global" style="width:${barPct(globalVal)}%"></div></div>
          <span class="mult-value">x${globalVal.toFixed(2)}</span>
        </div>
        <div class="mult-row">
          <span class="mult-label">Achiev.</span>
          <div class="mult-bar-track"><div class="mult-bar-fill achieve" style="width:${barPct(achVal)}%"></div></div>
          <span class="mult-value">x${achVal.toFixed(2)}</span>
        </div>
        <div class="mult-row">
          <span class="mult-label">Prestige</span>
          <div class="mult-bar-track"><div class="mult-bar-fill prestige" style="width:${barPct(prestVal)}%"></div></div>
          <span class="mult-value">x${prestVal.toFixed(2)}</span>
        </div>
        <div class="mult-row">
          <span class="mult-label">Total</span>
          <div class="mult-bar-track"><div class="mult-bar-fill combined" style="width:${combinedBarPct(combined)}%"></div></div>
          <span class="mult-value">x${combined.toFixed(2)}</span>
        </div>
        <div class="mult-row eff-row ${effClass}" title="Production efficiency — when this drops, ascending raises the ceiling">
          <span class="mult-label">Efficiency</span>
          <div class="mult-bar-track"><div class="mult-bar-fill efficiency" style="width:${effPct}%"></div></div>
          <span class="mult-value">${effPct}%</span>
        </div>
        ${efficiency < 0.5 ? '<div class="eff-hint">⬆ Ascend to raise the CPS ceiling</div>' : ''}
      `;
    }

    // Prestige section — chips display + info rows
    const prestEl = document.getElementById("left-prestige");
    if (prestEl) {
      const potentialChips = this.prestige.calculateHeavenlyChipsOnReset();
      const spendable = this.prestige.getSpendableChips();
      const curThreshold = this._getCpsSoftCapThreshold();
      const nextThreshold = SOFT_CAP.baseThreshold * Math.pow(SOFT_CAP.prestigeScaling, this.prestige.timesPrestiged + 1);
      prestEl.innerHTML = `
        <div class="prestige-chips">
          <span class="chip-icon heavenly-cookie">🍪</span>
          <span class="chip-count">${formatNumberInWords(spendable)}</span>
        </div>
        <div class="prestige-row"><span>Ascended</span><span>${this.prestige.timesPrestiged}x</span></div>
        <div class="prestige-row"><span>On reset</span><span>+${formatNumberInWords(potentialChips)}</span></div>
        <div class="prestige-row"><span>Total earned</span><span>${formatNumberInWords(this.prestige.heavenlyChips)}</span></div>
        ${this.prestige.spentChips > 0 ? `<div class="prestige-row"><span>Spent</span><span>${formatNumberInWords(this.prestige.spentChips)}</span></div>` : ''}
        <div class="prestige-row ceiling-row" title="CPS above this threshold has diminishing returns. Ascending raises it."><span>CPS Ceiling</span><span>${formatNumberInWords(curThreshold)}</span></div>
        <div class="prestige-row ceiling-next"><span>After Ascend</span><span>${formatNumberInWords(nextThreshold)}</span></div>
      `;
      
      // Tutorial: nudge at 25+ potential chips (before prestige available check)
      if (potentialChips >= 25 && this.tutorial) {
        this.tutorial.triggerEvent('prestigeNudge');
      }

      const btn = document.getElementById("prestige-btn");
      if (btn) {
        btn.disabled = !this.prestige.canPrestige();
        if (this.prestige.canPrestige()) {
          btn.textContent = `Ascend (+${formatNumberInWords(potentialChips)} chips)`;
          // Tutorial: prestige available event
          if (this.tutorial) this.tutorial.triggerEvent('prestigeAvailable');
        } else if (potentialChips > 0) {
          btn.textContent = `Ascend (need 10+ chips)`;
        } else {
          btn.textContent = `Ascend (need more cookies)`;
        }
      }
    }

    // Heavenly shop button visibility
    this.updateHeavenlyShopButton();

    // Frenzy indicator
    this.updateFrenzyIndicator();
  }

  // Save/Load methods are in gameSave.js (mixed in via SaveLoadMixin)
}

// Mix in extracted modules
Object.assign(Game.prototype, NewspaperMixin, SaveLoadMixin, OverlaysMixin, ParticlesMixin);
