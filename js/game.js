import { Building } from "./buildings.js";
import { Upgrade } from "./upgrades.js";
import { AchievementManager } from "./achievements.js";
import { PrestigeManager } from "./prestige.js";
import { VisualEffects } from "./visualEffects.js";
import { Tutorial } from "./tutorial.js";
import { buildings, upgrades, heavenlyUpgrades } from "./gameData.js";
import { formatNumberInWords, setShortNumbers } from "./utils.js";
import { encryptSave, decryptSave, isEncrypted } from "./saveCrypto.js";
import { SoundManager } from "./soundManager.js";
import {
  GAME, LUCKY_CLICK, FRENZY_BURSTS, PARTICLES,
  EASTER_EGGS, GOLDEN_COOKIE, SOFT_CAP, GRANDMAPOCALYPSE
} from "./config.js";
import { GrandmapocalypseManager } from "./grandmapocalypse.js";
import { WrinklerManager } from "./wrinklerManager.js";
import { CookieNum } from "./cookieNum.js";
import { getBuildingIcon } from "./buildingIcons.js";

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

    this.updateCookieCount();
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

  _openDebugPanel() {
    // Achievement + easter egg tip on first open
    this.achievementManager.unlockById('debugger');
    if (this.tutorial) this.tutorial.triggerEvent('debuggerFound');

    const overlay = document.getElementById("debug-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    this.soundManager.debugPanelOpen();
    this._renderDebugPanel();

    // Setup close handlers (once)
    if (!this._debugBound) {
      this._debugBound = true;
      document.getElementById("debug-close").addEventListener("click", () => {
        overlay.classList.add("hidden");
        this.soundManager.panelClose();
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { overlay.classList.add("hidden"); this.soundManager.panelClose(); }
      });
    }
  }

  _renderDebugPanel() {
    const body = document.getElementById("debug-body");
    if (!body) return;

    const fmt = (v) => (typeof v === 'number' || (v && v.toNumber)) ? formatNumberInWords(v) : v;
    const spendable = this.prestige.getSpendableChips();

    body.innerHTML = `
      <div class="debug-section">
        <h3>Resources</h3>
        <div class="debug-row">
          <label>Cookies</label>
          <input type="number" data-field="cookies" value="${Math.floor(this.cookies.toNumber())}" />
          <button class="debug-set-btn" data-field="cookies">Set</button>
        </div>
        <div class="debug-row">
          <label>CPS Multiplier</label>
          <input type="number" step="0.1" data-field="globalCpsMultiplier" value="${this.globalCpsMultiplier}" />
          <button class="debug-set-btn" data-field="globalCpsMultiplier">Set</button>
        </div>
        <div class="debug-row">
          <label>Cookies/Click</label>
          <input type="number" data-field="cookiesPerClick" value="${this.cookiesPerClick.toNumber()}" />
          <button class="debug-set-btn" data-field="cookiesPerClick">Set</button>
        </div>
      </div>

      <div class="debug-section">
        <h3>Prestige</h3>
        <div class="debug-row">
          <label>Heavenly Chips (total)</label>
          <input type="number" data-field="heavenlyChips" value="${this.prestige.heavenlyChips}" />
          <button class="debug-set-btn" data-field="heavenlyChips">Set</button>
        </div>
        <div class="debug-row">
          <label>Spent Chips</label>
          <input type="number" data-field="spentChips" value="${this.prestige.spentChips}" />
          <button class="debug-set-btn" data-field="spentChips">Set</button>
        </div>
        <div class="debug-row">
          <label>Times Prestiged</label>
          <input type="number" data-field="timesPrestiged" value="${this.prestige.timesPrestiged}" />
          <button class="debug-set-btn" data-field="timesPrestiged">Set</button>
        </div>
      </div>

      <div class="debug-section">
        <h3>Quick Actions</h3>
        <div class="debug-actions">
          <button class="debug-action-btn" data-action="addCookies">+1M Cookies</button>
          <button class="debug-action-btn" data-action="addBillion">+1B Cookies</button>
          <button class="debug-action-btn" data-action="addChips">+100 Chips</button>
          <button class="debug-action-btn" data-action="maxBuildings">Max Buildings</button>
          <button class="debug-action-btn" data-action="unlockAll">Unlock All Upgrades</button>
          <button class="debug-action-btn" data-action="triggerFrenzy">Trigger Frenzy</button>
          <button class="debug-action-btn" data-action="resetSave">Reset Save</button>
        </div>
      </div>

      <div class="debug-section">
        <h3>Grandmapocalypse</h3>
        <div class="debug-info">
          <span>Stage: ${this.grandmapocalypse ? this.grandmapocalypse.stage : 0}</span>
          <span>Research: ${this.grandmapocalypse ? [...this.grandmapocalypse.researchPurchased].join(', ') || 'none' : 'none'}</span>
          <span>Wrinklers: ${this.wrinklerManager ? this.wrinklerManager.getWrinklerCount() : 0}/${GRANDMAPOCALYPSE.maxWrinklers}</span>
          <span>Wrinklers: ${this.wrinklerManager ? this.wrinklerManager.getWrinklerCount() : 0}/${GRANDMAPOCALYPSE.maxWrinklers} (${this.wrinklerManager ? this.wrinklerManager.wrinklers.filter(w => w.elder).length : 0} elder)</span>
          <span>Wrinkler drain: ${this.wrinklerManager ? (() => { let d=0; for(const w of this.wrinklerManager.wrinklers) d += w.elder ? GRANDMAPOCALYPSE.elderWrinklerDrainFraction : GRANDMAPOCALYPSE.wrinklerCpsDrainFraction; return (d*100).toFixed(0); })() : 0}%</span>
          <span>Cookies in wrinklers: ${this.wrinklerManager ? fmt(this.wrinklerManager.getTotalCookiesEaten()) : 0}</span>
          <span>Cookie decay: ${this.grandmapocalypse && this.grandmapocalypse.stage >= 2 ? ((GRANDMAPOCALYPSE.cookieDecay['stage'+this.grandmapocalypse.stage]||0)*100).toFixed(3)+'%/s' : 'none'}</span>
          <span>Pledge active: ${this.grandmapocalypse ? (this.grandmapocalypse.elderPledgeActive ? 'Yes' : 'No') : 'No'}</span>
          <span>Covenant: ${this.grandmapocalypse ? (this.grandmapocalypse.covenantActive ? 'Yes (-'+GRANDMAPOCALYPSE.covenantCpsPenalty*100+'% CPS)' : 'No') : 'No'}</span>
          <span>Wrath cookie chance: ${this.grandmapocalypse ? (this.grandmapocalypse.getWrathCookieProbability() * 100).toFixed(0) : 0}%</span>
        </div>
        <div class="debug-actions" style="margin-top:8px">
          <button class="debug-action-btn" data-action="gpStage1">Set Stage 1</button>
          <button class="debug-action-btn" data-action="gpStage2">Set Stage 2</button>
          <button class="debug-action-btn" data-action="gpStage3">Set Stage 3</button>
          <button class="debug-action-btn" data-action="gpReset">Reset GP</button>
          <button class="debug-action-btn" data-action="spawnWrinkler">+1 Wrinkler</button>
          <button class="debug-action-btn" data-action="spawnShiny">+1 Shiny</button>
          <button class="debug-action-btn" data-action="popAll">Pop All</button>
          <button class="debug-action-btn" data-action="triggerWrath">Trigger Wrath</button>
          <button class="debug-action-btn" data-action="triggerElderFrenzy">Elder Frenzy</button>
        </div>
      </div>

      <div class="debug-section">
        <h3>State</h3>
        <div class="debug-info">
          <span>Effective CPS: ${fmt(this.getEffectiveCPS())}</span>
          <span>Effective CPC: ${fmt(this.getEffectiveCPC())}</span>
          <span>Buildings: ${this.getTotalBuildingCount()}</span>
          <span>Upgrades bought: ${this.upgrades.filter(u => u.level > 0).length}</span>
          <span>Achievements: ${this.achievementManager.getUnlockedCount()}/${this.achievementManager.getTotalCount()}</span>
          <span>Prestige mult: x${this.prestige.getPrestigeMultiplier().toFixed(2)}</span>
          <span>Achievement mult: x${this.achievementManager.getMultiplier().toFixed(2)}</span>
          <span>Chips balance: ${fmt(spendable)}</span>
          <span>Buffs: ${this.activeBuffs.length > 0 ? this.activeBuffs.map(b => b.type + ' x' + b.multiplier).join(', ') : 'none'}</span>
          <span>Wrinklers popped: ${this.stats.wrinklersPopped || 0}</span>
          <span>Wrath clicked: ${this.stats.wrathCookiesClicked || 0}</span>
        </div>
      </div>
    `;

    // Wire up Set buttons
    body.querySelectorAll('.debug-set-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const input = body.querySelector(`input[data-field="${field}"]`);
        const val = parseFloat(input.value);
        if (isNaN(val)) return;

        switch (field) {
          case 'cookies': this.cookies = CookieNum.from(val); break;
          case 'globalCpsMultiplier': this.globalCpsMultiplier = val; break;
          case 'cookiesPerClick': this.cookiesPerClick = CookieNum.from(val); break;
          case 'heavenlyChips': this.prestige.heavenlyChips = val; break;
          case 'spentChips': this.prestige.spentChips = val; break;
          case 'timesPrestiged': this.prestige.timesPrestiged = val; break;
        }

        this.calculateCPS();
        this.updateCookieCount();
        this.updateLeftPanel();
        this.updateUI();
        this.saveGame();
        this._renderDebugPanel();
      });
    });

    // Wire up action buttons
    body.querySelectorAll('.debug-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.soundManager.debugAction();
        switch (btn.dataset.action) {
          case 'addCookies':
            this.cookies = this.cookies.add(CookieNum.from(1000000));
            break;
          case 'addChips':
            this.prestige.heavenlyChips += 100;
            break;
          case 'maxBuildings':
            this.buildings.forEach(b => { b.count = 100; b.recalculateCost(); });
            break;
          case 'unlockAll':
            this.upgrades.forEach(u => {
              if (u.level === 0) { u.level = 1; u.applyEffect(); }
            });
            break;
          case 'triggerFrenzy':
            this.startFrenzy('cps', 7, 60);
            break;
          case 'addBillion':
            this.cookies = this.cookies.add(CookieNum.from(1000000000));
            break;
          case 'gpStage1':
          case 'gpStage2':
          case 'gpStage3': {
            if (!this.grandmapocalypse) break;
            const targetStage = btn.dataset.action === 'gpStage1' ? 1 : btn.dataset.action === 'gpStage2' ? 2 : 3;
            // Grant required research
            this.grandmapocalypse.researchPurchased.add('bingoCenter');
            if (targetStage >= 2) this.grandmapocalypse.researchPurchased.add('communalBrainsweep');
            if (targetStage >= 3) this.grandmapocalypse.researchPurchased.add('elderPact');
            this.grandmapocalypse.stage = targetStage;
            this.grandmapocalypse._previousStage = targetStage;
            this.grandmapocalypse._applyResearchBoosts();
            this.grandmapocalypse._onStageChange(targetStage);
            this.calculateCPS();
            this.grandmapocalypse._panelOpen = true;
            const gpEl = document.getElementById("grandmapocalypse-panel");
            if (gpEl) gpEl.classList.add("gp-expanded");
            this.grandmapocalypse._renderResearchPanel();
            break;
          }
          case 'gpReset':
            if (this.grandmapocalypse) {
              this.grandmapocalypse.stage = 0;
              this.grandmapocalypse._previousStage = 0;
              this.grandmapocalypse.researchPurchased.clear();
              this.grandmapocalypse.elderPledgeActive = false;
              this.grandmapocalypse.covenantActive = false;
              this.grandmapocalypse._covenantPenaltyApplied = false;
              this._grandmapocalypseGrandmaBoost = 1;
              this.globalCpsMultiplier = 1;
              this.grandmapocalypse.applyStageTheme(0);
              if (this.wrinklerManager) { this.wrinklerManager.wrinklers = []; this.wrinklerManager._stopSpawning(); }
              this.calculateCPS();
              this.grandmapocalypse._renderResearchPanel();
            }
            break;
          case 'spawnWrinkler':
            if (this.wrinklerManager && this.grandmapocalypse && this.grandmapocalypse.stage >= 1) {
              this.wrinklerManager._spawnWrinkler();
            }
            break;
          case 'spawnShiny':
            if (this.wrinklerManager && this.grandmapocalypse && this.grandmapocalypse.stage >= 1) {
              const orig = GRANDMAPOCALYPSE.shinyWrinklerChance;
              GRANDMAPOCALYPSE.shinyWrinklerChance = 1;
              this.wrinklerManager._spawnWrinkler();
              GRANDMAPOCALYPSE.shinyWrinklerChance = orig;
            }
            break;
          case 'popAll':
            if (this.wrinklerManager) {
              while (this.wrinklerManager.wrinklers.length > 0) {
                this.wrinklerManager.popWrinkler(this.wrinklerManager.wrinklers[0].id);
              }
            }
            break;
          case 'triggerWrath':
            if (this.visualEffects) {
              const el = document.getElementById("golden-cookie");
              if (el) {
                el.dataset.isWrath = "1";
                el.textContent = "🔴";
                el.classList.add("wrath-cookie");
                el.classList.remove("hidden");
                el.classList.add("golden-appear");
              }
            }
            break;
          case 'triggerElderFrenzy':
            this.startFrenzy('cps', 666, 6);
            this.stats.elderFrenzyTriggered = (this.stats.elderFrenzyTriggered || 0) + 1;
            break;
          case 'resetSave':
            if (confirm('Are you sure? This will wipe ALL save data.')) {
              localStorage.removeItem('cookieClickerSave');
              location.reload();
            }
            return;
        }

        this.calculateCPS();
        this.updateCookieCount();
        this.updateLeftPanel();
        this.updateUI();
        this.visualEffects.update();
        this.saveGame();
        this._renderDebugPanel();
      });
    });
  }

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
    // Stats
    const statsEl = document.getElementById("menu-stats");
    if (statsEl) {
      // Cache previous stat values for change detection
      const prevValues = [];
      statsEl.querySelectorAll('.stat-value').forEach(el => prevValues.push(el.textContent));

      const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const hrs = Math.floor(mins / 60);
      const timeStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m ${elapsed % 60}s`;

      statsEl.innerHTML = `
        <div class="menu-stat-card">
          <span class="stat-icon">🍪</span>
          <span class="stat-value">${formatNumberInWords(this.stats.totalCookiesBaked)}</span>
          <span class="stat-label">Total Baked</span>
        </div>
        <div class="menu-stat-card">
          <span class="stat-icon">👆</span>
          <span class="stat-value">${formatNumberInWords(this.stats.handmadeCookies)}</span>
          <span class="stat-label">By Hand</span>
        </div>
        <div class="menu-stat-card">
          <span class="stat-icon">🖱️</span>
          <span class="stat-value">${formatNumberInWords(this.stats.totalClicks)}</span>
          <span class="stat-label">Total Clicks</span>
        </div>
        <div class="menu-stat-card">
          <span class="stat-icon">🏗️</span>
          <span class="stat-value">${this.getTotalBuildingCount()}</span>
          <span class="stat-label">Buildings</span>
        </div>
        <div class="menu-stat-card">
          <span class="stat-icon">🍀</span>
          <span class="stat-value">${this.stats.luckyClicks}</span>
          <span class="stat-label">${(this.luckyClickChance * 100).toFixed(2)}% Luck</span>
        </div>
        <div class="menu-stat-card">
          <span class="stat-icon">🔥</span>
          <span class="stat-value">${this.stats.frenziesTriggered}</span>
          <span class="stat-label">Frenzies</span>
        </div>
        <div class="menu-stat-card">
          <span class="stat-icon">⬆️</span>
          <span class="stat-value">${this.stats.totalUpgradesPurchased || 0}</span>
          <span class="stat-label">Upgrades Bought</span>
        </div>
        <div class="menu-stat-card">
          <span class="stat-icon">⏱️</span>
          <span class="stat-value">${timeStr}</span>
          <span class="stat-label">Session Time</span>
        </div>
      `;

      // Flash stat values that changed
      if (prevValues.length > 0) {
        const newEls = statsEl.querySelectorAll('.stat-value');
        newEls.forEach((el, i) => {
          if (prevValues[i] !== undefined && prevValues[i] !== el.textContent) {
            el.classList.add('stat-value-pop');
            el.addEventListener('animationend', () => el.classList.remove('stat-value-pop'), { once: true });
          }
        });
      }

      // Newspaper banner button to open stats
      if (!statsEl.querySelector('.sn-open-btn')) {
        const btn = document.createElement('button');
        btn.className = 'sn-open-btn';
        btn.innerHTML = `<div class="sn-btn-masthead">The Cookie Chronicle</div><div class="sn-btn-teaser">Tap to read the latest — ${formatNumberInWords(this.stats.totalCookiesBaked)} cookies and counting</div>`;
        btn.addEventListener('click', () => this._openStatsOverlay());
        statsEl.appendChild(btn);
      }
    }

    // Achievement progress bar
    const unlocked = this.achievementManager.getUnlockedCount();
    const total = this.achievementManager.getTotalCount();
    const pct = total > 0 ? Math.floor((unlocked / total) * 100) : 0;

    const countEl = document.getElementById("menu-achv-count");
    const pctEl = document.getElementById("menu-achv-pct");
    const fillEl = document.getElementById("menu-achv-fill");
    if (countEl) countEl.textContent = `${unlocked} / ${total}`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;

    // Full achievement list
    const listEl = document.getElementById("menu-achievements-list");
    if (listEl) {
      listEl.innerHTML = "";
      this.achievementManager.achievements.forEach(achv => {
        const item = document.createElement("div");
        item.className = `menu-achv-item ${achv.unlocked ? 'unlocked' : 'locked'}`;
        item.innerHTML = `
          <span class="menu-achv-icon">${achv.unlocked ? '🏆' : '🔒'}</span>
          <div class="menu-achv-info">
            <span class="menu-achv-name">${achv.name}</span>
            <span class="menu-achv-desc">${achv.desc}</span>
          </div>
          <span class="menu-achv-status">${achv.unlocked ? '✓' : '—'}</span>
        `;
        listEl.appendChild(item);
      });

      // Easter egg: scroll to bottom of achievement list
      if (!listEl._tutorialScrollBound) {
        listEl._tutorialScrollBound = true;
        listEl.addEventListener('scroll', () => {
          if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 10) {
            if (this.tutorial) this.tutorial.triggerEvent('achievementScrollBottom');
          }
        });
      }
    }
  }

  // === Music Player ===

  _openMusicPlayer() {
    const overlay = document.getElementById("music-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    this._renderMusicPlayer();
    if (this._musicPlayerInterval) clearInterval(this._musicPlayerInterval);
    this._musicPlayerInterval = setInterval(() => this._updateMusicPlayerUI(), 250);

    if (!this._musicPlayerBound) {
      this._musicPlayerBound = true;
      const close = () => {
        overlay.classList.add("hidden");
        this.soundManager.panelClose();
        if (this._musicPlayerInterval) { clearInterval(this._musicPlayerInterval); this._musicPlayerInterval = null; }
      };
      document.getElementById("music-close").addEventListener("click", close);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    }
  }

  _openMinigameSelector() {
    const overlay = document.getElementById("minigame-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    this.soundManager.panelOpen();

    const games = [
      { id: "slots",      emoji: "🎰", name: "Cookie Slots",      desc: "Spin the reels for cookies" },
      { id: "speed",      emoji: "⚡", name: "Speed Click",        desc: "Click as fast as you can" },
      { id: "catch",      emoji: "🍪", name: "Cookie Catch",       desc: "Catch falling cookies" },
      { id: "trivia",     emoji: "🧠", name: "Cookie Trivia",      desc: "Test your cookie knowledge" },
      { id: "memory",     emoji: "🃏", name: "Emoji Memory",       desc: "Match emoji pairs" },
      { id: "cutter",     emoji: "✂️", name: "Cookie Cutter",      desc: "Trace shapes precisely" },
      { id: "defense",    emoji: "🛡️", name: "Cookie Defense",     desc: "Tower defense mini-game" },
      { id: "kitchen",    emoji: "👵", name: "Grandma's Kitchen",  desc: "Bake cookies at the right time" },
      { id: "math",       emoji: "🔢", name: "Math Baker",         desc: "Solve math for cookies" },
      { id: "dungeon",    emoji: "⚔️", name: "Dungeon Crawl",      desc: "Turn-based RPG adventure" },
      { id: "safe",       emoji: "🔐", name: "Safe Cracker",       desc: "Crack the combination lock" },
      { id: "launch",     emoji: "🚀", name: "Cookie Launch",      desc: "Slingshot cookies to the target" },
      { id: "wordle",     emoji: "📝", name: "Cookie Wordle",      desc: "Guess the baking word" },
      { id: "assembly",   emoji: "🧑‍🍳", name: "Cookie Assembly",   desc: "Replicate the target cookie" },
    ];

    const body = document.getElementById("minigame-select-body");
    if (!body) return;
    body.innerHTML = games.map(g =>
      `<button class="minigame-select-btn" data-game="${g.id}">
        <span class="minigame-select-emoji">${g.emoji}</span>
        <div class="minigame-select-info">
          <span class="minigame-select-name">${g.name}</span>
          <span class="minigame-select-desc">${g.desc}</span>
        </div>
      </button>`
    ).join('');

    const mg = this.visualEffects.miniGames;
    const launchMap = {
      slots:   () => mg._slotMachine(),
      speed:   () => mg._speedClick(),
      catch:   () => mg._cookieCatch(),
      trivia:  () => mg._trivia(),
      memory:  () => mg._emojiMemory(),
      cutter:  () => mg._cookieCutter(),
      defense: () => mg._cookieDefense(),
      kitchen: () => mg._grandmasKitchen(),
      math:    () => mg._mathBaker(),
      dungeon: () => mg._dungeonCrawl(),
      safe:    () => mg._safeCracker(),
      launch:  () => mg._cookieLaunch(),
      wordle:  () => mg._cookieWordle(),
      assembly:() => mg._cookieAssembly(),
    };

    body.querySelectorAll('.minigame-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = btn.dataset.game;
        if (mg._active) return;
        overlay.classList.add("hidden");
        this.soundManager.uiClick();
        if (launchMap[gameId]) launchMap[gameId]();
      });
    });

    if (!this._minigameSelectorBound) {
      this._minigameSelectorBound = true;
      const close = () => {
        overlay.classList.add("hidden");
        this.soundManager.panelClose();
      };
      document.getElementById("minigame-close").addEventListener("click", close);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    }
  }

  // === Building Synergy Visualizer ===

  _openSynergyVisualizer() {
    const overlay = document.getElementById('synergy-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    this.soundManager.panelOpen();

    // Update subtitle
    const synergies = this.upgrades.filter(u => u.type === 'synergy');
    const activeCount = synergies.filter(u => u.level > 0).length;
    const sub = document.getElementById('synergy-subtitle');
    if (sub) sub.textContent = `${activeCount} of ${synergies.length} active · Hover nodes & lines for details`;

    // Legend
    const legend = document.getElementById('synergy-legend');
    if (legend) legend.innerHTML = `<span class="syn-leg-item"><span class="syn-leg-line syn-leg-active"></span> Active</span><span class="syn-leg-item"><span class="syn-leg-line syn-leg-inactive"></span> Locked</span>`;

    this._renderSynergyGraph();

    if (!this._synergyBound) {
      this._synergyBound = true;
      const close = () => {
        overlay.classList.add('hidden');
        this.soundManager.panelClose();
      };
      document.getElementById('synergy-close').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }
  }

  _renderSynergyGraph() {
    const svgEl = document.getElementById('synergy-svg');
    const tooltip = document.getElementById('synergy-tooltip');
    if (!svgEl) return;

    // Per-building theme colors
    const bColors = {
      'Cursor': '#00ff88', 'Grandma': '#e8a0c0', 'Farm': '#6abf4b', 'Factory': '#c0c0c0',
      'Mine': '#d4a052', 'Shipment': '#5088cc', 'Alchemy Lab': '#ffd700', 'Portal': '#bf5fff',
      'Time Machine': '#40e0d0', 'Antimatter Condenser': '#ff4060', 'Prism': '#ffe066',
      'Chancemaker': '#ff8040', 'Fractal Engine': '#80ffcc', 'Idleverse': '#a070e0',
      'Cortex Baker': '#ff70a0', 'Reality Bender': '#ffffff',
    };
    const bColor = (name) => bColors[name] || '#f8c471';

    const synergyUpgrades = this.upgrades.filter(u => u.type === 'synergy');
    const synergyMult = this.prestige.getSynergyMultiplier() * this.prestige.getSynergyMultiplier2() * this.prestige.getSynergyMultiplier3();

    // Collect unique building names involved in synergies
    const buildingSet = new Set();
    synergyUpgrades.forEach(u => { buildingSet.add(u.source); buildingSet.add(u.target); });
    const unordered = Array.from(buildingSet);

    // Arrange buildings so connected pairs are NOT adjacent or directly opposite.
    // Greedy placement: for each slot, pick the building that has the fewest
    // synergy connections to already-placed neighbors.
    const edges = new Set();
    synergyUpgrades.forEach(u => { edges.add(u.source + '|' + u.target); edges.add(u.target + '|' + u.source); });
    const connected = (a, b) => edges.has(a + '|' + b);
    const n = unordered.length;
    const half = Math.floor(n / 2);

    // Score: penalize adjacent and opposite positions heavily
    const buildingNames = [];
    const remaining = new Set(unordered);
    // Start with the node that has the most connections (hardest to place)
    const connCount = (name) => synergyUpgrades.filter(u => u.source === name || u.target === name).length;
    const first = unordered.reduce((best, b) => connCount(b) > connCount(best) ? b : best, unordered[0]);
    buildingNames.push(first);
    remaining.delete(first);

    while (remaining.size > 0) {
      let bestName = null, bestScore = Infinity;
      const idx = buildingNames.length; // slot index being filled
      for (const cand of remaining) {
        let score = 0;
        // Penalize if connected to the previous slot (adjacent)
        if (idx > 0 && connected(cand, buildingNames[idx - 1])) score += 10;
        // Penalize if connected to the first slot (will be adjacent when circle closes)
        if (idx === n - 1 && connected(cand, buildingNames[0])) score += 10;
        // Penalize if connected to the node directly opposite (if that slot is filled)
        const oppIdx = (idx + half) % n;
        if (oppIdx < buildingNames.length && connected(cand, buildingNames[oppIdx])) score += 10;
        // Also check if WE would be opposite to an already-placed node
        for (let j = 0; j < buildingNames.length; j++) {
          if (Math.abs(idx - j) === half && connected(cand, buildingNames[j])) score += 10;
        }
        // Slight preference for fewer total connections (spread out hubs)
        score += connCount(cand) * 0.1;
        if (score < bestScore) { bestScore = score; bestName = cand; }
      }
      buildingNames.push(bestName);
      remaining.delete(bestName);
    }

    // Position buildings in a circle — radius scales with node count for spacing
    const nodeR = 30;
    const minGap = nodeR * 3.2; // minimum arc distance between node centers
    const circumNeeded = n * minGap;
    const radius = Math.max(210, circumNeeded / (2 * Math.PI));
    const W = (radius + nodeR + 40) * 2;
    const H = (radius + nodeR + 40) * 2;
    const cx = W / 2, cy = H / 2;
    const nodePositions = {};
    buildingNames.forEach((name, i) => {
      const angle = (2 * Math.PI * i / n) - Math.PI / 2;
      nodePositions[name] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });

    const ns = 'http://www.w3.org/2000/svg';
    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // Defs: glow filter, arrowhead markers (active + inactive)
    svgEl.innerHTML = `<defs>
      <filter id="syn-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <marker id="syn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="#f8c471" opacity="0.9"/></marker>
      <marker id="syn-arrow-off" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="#666" opacity="0.5"/></marker>
    </defs>`;

    // Show tooltip near cursor (use body-relative positions for reliability)
    const showTip = (e, html) => {
      tooltip.innerHTML = html;
      tooltip.style.opacity = '1';
      const rect = svgEl.closest('.synergy-body').getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
    };
    const moveTip = (e) => {
      const rect = svgEl.closest('.synergy-body').getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
    };
    const hideTip = () => { tooltip.style.opacity = '0'; };

    // ── Draw edges: curved bezier lines ──
    synergyUpgrades.forEach(u => {
      const src = nodePositions[u.source];
      const tgt = nodePositions[u.target];
      if (!src || !tgt) return;

      const active = u.level > 0;

      // Cubic bezier: control points pull toward the center of the graph
      const pull = 0.4;
      const cp1x = src.x + (cx - src.x) * pull;
      const cp1y = src.y + (cy - src.y) * pull;
      const cp2x = tgt.x + (cx - tgt.x) * pull;
      const cp2y = tgt.y + (cy - tgt.y) * pull;

      // Place endpoints on circle edge in the direction the curve actually leaves
      // Source: direction toward cp1
      const d1x = cp1x - src.x, d1y = cp1y - src.y;
      const d1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
      const x1 = src.x + (d1x / d1) * nodeR, y1 = src.y + (d1y / d1) * nodeR;
      // Target: direction from cp2 toward target (arrow lands on circle edge)
      const d2x = tgt.x - cp2x, d2y = tgt.y - cp2y;
      const d2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1;
      const x2 = tgt.x - (d2x / d2) * (nodeR + 4), y2 = tgt.y - (d2y / d2) * (nodeR + 4);

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', active ? bColor(u.source) : '#555');
      path.setAttribute('stroke-width', active ? '2.5' : '1.5');
      path.setAttribute('stroke-opacity', active ? '0.8' : '0.35');
      if (!active) path.setAttribute('stroke-dasharray', '8 5');
      path.setAttribute('marker-end', active ? 'url(#syn-arrow)' : 'url(#syn-arrow-off)');
      path.style.cursor = 'pointer';
      path.style.transition = 'stroke-opacity 0.2s, stroke-width 0.2s';

      // Invisible fat hitbox for easier hovering
      const hitbox = document.createElementNS(ns, 'path');
      hitbox.setAttribute('d', `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`);
      hitbox.setAttribute('fill', 'none');
      hitbox.setAttribute('stroke', 'transparent');
      hitbox.setAttribute('stroke-width', '16');
      hitbox.style.cursor = 'pointer';

      const sourceB = this.buildings.find(b => b.name === u.source);
      const targetB = this.buildings.find(b => b.name === u.target);
      const totalCps = (sourceB && targetB && active) ? sourceB.count * u.bonus * u.level * synergyMult * targetB.count : 0;

      const onEnter = (e) => {
        path.setAttribute('stroke-opacity', '1');
        path.setAttribute('stroke-width', active ? '4' : '2.5');
        if (active) path.setAttribute('filter', 'url(#syn-glow)');
        showTip(e, `
          <div style="font-weight:700;color:#f8c471;margin-bottom:4px">${u.name}</div>
          <div style="font-size:11px;color:#d5c4a1">${u.source} → ${u.target}</div>
          <div style="margin-top:6px;display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:11px">
            <span style="color:#a08060">Level</span><span style="font-weight:700">${u.level} / ${u.max_level || '?'}</span>
            <span style="color:#a08060">Bonus</span><span style="font-weight:700">${u.bonus}/source</span>
            <span style="color:#a08060">CPS Added</span><span style="font-weight:700;color:${active ? '#a0d060' : '#888'}">${active ? formatNumberInWords(totalCps) + '/s' : 'Inactive'}</span>
          </div>
          ${!active ? '<div style="margin-top:4px;font-size:10px;color:#e07050">Not yet purchased</div>' : ''}`);
      };
      const onLeave = () => {
        path.setAttribute('stroke-opacity', active ? '0.8' : '0.35');
        path.setAttribute('stroke-width', active ? '2.5' : '1.5');
        path.removeAttribute('filter');
        hideTip();
      };
      hitbox.addEventListener('mouseenter', onEnter);
      hitbox.addEventListener('mousemove', moveTip);
      hitbox.addEventListener('mouseleave', onLeave);

      svgEl.appendChild(path);
      svgEl.appendChild(hitbox);
    });

    // ── Draw building nodes: icon + ring ──
    buildingNames.forEach(name => {
      const pos = nodePositions[name];
      const building = this.buildings.find(b => b.name === name);
      const owned = building && building.count > 0;
      const color = bColor(name);

      const g = document.createElementNS(ns, 'g');
      g.style.cursor = 'pointer';

      // Outer glow ring (owned only)
      if (owned) {
        const glow = document.createElementNS(ns, 'circle');
        glow.setAttribute('cx', pos.x); glow.setAttribute('cy', pos.y);
        glow.setAttribute('r', nodeR + 4);
        glow.setAttribute('fill', 'none'); glow.setAttribute('stroke', color);
        glow.setAttribute('stroke-width', '1.5'); glow.setAttribute('stroke-opacity', '0.3');
        g.appendChild(glow);
      }

      // Background circle
      const bg = document.createElementNS(ns, 'circle');
      bg.setAttribute('cx', pos.x); bg.setAttribute('cy', pos.y);
      bg.setAttribute('r', nodeR);
      bg.setAttribute('fill', owned ? '#1a0e06' : '#120a04');
      bg.setAttribute('stroke', owned ? color : '#444');
      bg.setAttribute('stroke-width', owned ? '2.5' : '1');
      bg.setAttribute('stroke-opacity', owned ? '1' : '0.5');
      g.appendChild(bg);

      // Building icon (canvas → data URL → SVG image)
      try {
        const iconCanvas = getBuildingIcon(name, 36);
        const dataUrl = iconCanvas.toDataURL();
        const img = document.createElementNS(ns, 'image');
        img.setAttribute('href', dataUrl);
        img.setAttribute('x', pos.x - 18); img.setAttribute('y', pos.y - 18);
        img.setAttribute('width', 36); img.setAttribute('height', 36);
        if (!owned) img.setAttribute('opacity', '0.35');
        g.appendChild(img);
      } catch (_) { /* fallback: no icon */ }

      // Name label below
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', pos.x); label.setAttribute('y', pos.y + nodeR + 14);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', owned ? color : '#666');
      label.setAttribute('font-size', '10'); label.setAttribute('font-weight', '600');
      label.setAttribute('font-family', 'system-ui, sans-serif');
      label.textContent = name;
      g.appendChild(label);

      // Count badge (if owned)
      if (owned) {
        const badge = document.createElementNS(ns, 'text');
        badge.setAttribute('x', pos.x); badge.setAttribute('y', pos.y + nodeR + 24);
        badge.setAttribute('text-anchor', 'middle');
        badge.setAttribute('fill', '#a08060'); badge.setAttribute('font-size', '9');
        badge.setAttribute('font-family', 'system-ui, sans-serif');
        badge.textContent = `x${building.count}`;
        g.appendChild(badge);
      }

      // Hover / click
      const cps = building ? building.cps.mul(building.count) : CookieNum.ZERO;
      const relatedSynergies = synergyUpgrades.filter(u => u.source === name || u.target === name);
      g.addEventListener('mouseenter', (e) => {
        bg.setAttribute('stroke-width', '3.5');
        const synLines = relatedSynergies.map(u => {
          const dir = u.source === name ? `→ ${u.target}` : `← ${u.source}`;
          return `<div style="font-size:10px;color:#d5c4a1">${u.level > 0 ? '✅' : '🔒'} ${u.name} (${dir})</div>`;
        }).join('');
        showTip(e, `
          <div style="font-weight:700;color:${color};font-size:14px;margin-bottom:4px">${name}</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:11px;margin-bottom:6px">
            <span style="color:#a08060">Owned</span><span style="font-weight:700">${building ? building.count : 0}</span>
            <span style="color:#a08060">CPS Each</span><span style="font-weight:700">${building ? formatNumberInWords(building.cps) : '0'}/s</span>
            <span style="color:#a08060">Total CPS</span><span style="font-weight:700;color:#a0d060">${formatNumberInWords(cps)}/s</span>
          </div>
          ${synLines ? `<div style="border-top:1px solid rgba(165,120,71,0.3);padding-top:4px;margin-top:2px"><div style="font-size:9px;color:#8b6a4a;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Synergies</div>${synLines}</div>` : ''}`);
      });
      g.addEventListener('mousemove', moveTip);
      g.addEventListener('mouseleave', () => { bg.setAttribute('stroke-width', owned ? '2.5' : '1'); hideTip(); });

      svgEl.appendChild(g);
    });

    // Center label — brighter so it reads clearly
    const activeN = synergyUpgrades.filter(u => u.level > 0).length;
    const centerText = document.createElementNS(ns, 'text');
    centerText.setAttribute('x', cx); centerText.setAttribute('y', cy - 8);
    centerText.setAttribute('text-anchor', 'middle');
    centerText.setAttribute('fill', 'rgba(200,160,240,0.5)'); centerText.setAttribute('font-size', '16');
    centerText.setAttribute('font-weight', '700'); centerText.setAttribute('font-family', 'Georgia, serif');
    centerText.setAttribute('letter-spacing', '2');
    centerText.textContent = 'SYNERGY NETWORK';
    svgEl.appendChild(centerText);
    const centerSub = document.createElementNS(ns, 'text');
    centerSub.setAttribute('x', cx); centerSub.setAttribute('y', cy + 12);
    centerSub.setAttribute('text-anchor', 'middle');
    centerSub.setAttribute('fill', 'rgba(200,160,240,0.35)'); centerSub.setAttribute('font-size', '12');
    centerSub.setAttribute('font-family', 'Georgia, serif');
    centerSub.textContent = `${activeN} of ${synergyUpgrades.length} active`;
    svgEl.appendChild(centerSub);
  }

  // === Statistics Dashboard ===

  _openStatsOverlay() {
    // Close the settings menu if it's open
    const menu = document.getElementById("menu-overlay");
    if (menu && !menu.classList.contains("hidden")) {
      menu.classList.add("hidden");
    }

    const overlay = document.getElementById("stats-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    this.soundManager.panelOpen();

    // Dateline
    const dl = document.getElementById("sn-dateline");
    if (dl) {
      const d = new Date();
      dl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        + ` · Est. ${new Date(this.stats.startTime).getFullYear()}`;
    }

    this._snPage = 0;
    this._renderStatsPage();

    if (!this._statsBound) {
      this._statsBound = true;

      document.getElementById("sn-prev").addEventListener("click", () => {
        if (this._snPage > 0) { this._snPage--; this._renderStatsPage(); this.soundManager.uiClick(); }
      });
      document.getElementById("sn-next").addEventListener("click", () => {
        if (this._snPage < this._snTotalPages() - 1) { this._snPage++; this._renderStatsPage(); this.soundManager.uiClick(); }
      });

      const close = () => { overlay.classList.add("hidden"); this.soundManager.panelClose(); };
      document.getElementById("stats-close").addEventListener("click", close);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    }
  }

  _snTotalPages() { return 6; }

  _renderStatsPage() {
    const body = document.getElementById("sn-body");
    if (!body) return;

    const total = this._snTotalPages();
    const pages = ['Front Page', 'Industry', 'Upgrades', 'Entertainment', 'Achievements', 'The Dark Side'];
    const label = document.getElementById("sn-page-label");
    label.innerHTML = `<span class="sn-page-name">${pages[this._snPage]}</span><span class="sn-page-num">${this._snPage + 1} / ${total}</span>`;
    document.getElementById("sn-prev").disabled = this._snPage === 0;
    document.getElementById("sn-next").disabled = this._snPage >= total - 1;

    // Page turn animation
    body.classList.remove('sn-page-enter');
    void body.offsetWidth; // force reflow
    body.classList.add('sn-page-enter');

    const fmt = (v) => {
      if (v && typeof v === 'object' && v.toNumber) return formatNumberInWords(v);
      if (typeof v === 'number') return formatNumberInWords(v);
      return v;
    };

    switch (this._snPage) {
      case 0: this._renderFrontPage(body, fmt); break;
      case 1: this._renderIndustryPage(body, fmt); break;
      case 2: this._renderUpgradesPage(body, fmt); break;
      case 3: this._renderEntertainmentPage(body, fmt); break;
      case 4: this._renderAchievementsPage(body, fmt); break;
      case 5: this._renderDarkSidePage(body, fmt); break;
    }
  }

  _renderFrontPage(body, fmt) {
    const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
    const mins = Math.floor(elapsed / 60); const hrs = Math.floor(mins / 60); const days = Math.floor(hrs / 24);
    let timeStr;
    if (days > 0) timeStr = `${days} days, ${hrs % 24} hours`;
    else if (hrs > 0) timeStr = `${hrs} hours, ${mins % 60} minutes`;
    else timeStr = `${mins} minutes`;

    const totalClicks = this.stats.totalClicks || 0;
    const avgPerClick = totalClicks > 0 ? fmt(this.stats.handmadeCookies.div(totalClicks)) : '0';
    const cps = fmt(this.getEffectiveCPS());

    body.innerHTML = `
      <div class="sn-article sn-lead">
        <h2 class="sn-headline">Empire Reaches ${fmt(this.stats.totalCookiesBaked)} Cookies</h2>
        <p class="sn-byline">By Our Cookie Correspondent · ${timeStr} of operation</p>
        <p class="sn-body-text">The bakery empire has now produced a staggering <strong>${fmt(this.stats.totalCookiesBaked)}</strong> cookies since its founding, officials confirmed today. Current output stands at <strong>${cps}</strong> cookies per second.</p>
      </div>
      <div class="sn-rule"></div>
      <div class="sn-two-col">
        <div class="sn-article sn-col-article">
          <h3 class="sn-subhead">By the Numbers</h3>
          <div class="sn-fact-list">
            <div class="sn-fact"><span class="sn-fact-num">${fmt(totalClicks)}</span><span class="sn-fact-label">Total Clicks</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${avgPerClick}</span><span class="sn-fact-label">Avg. per Click</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.goldenCookiesClicked)}</span><span class="sn-fact-label">Golden Cookies</span></div>
          </div>
        </div>
        <div class="sn-col-divider"></div>
        <div class="sn-article sn-col-article">
          <h3 class="sn-subhead">Market Report</h3>
          <div class="sn-fact-list">
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.frenziesTriggered)}</span><span class="sn-fact-label">Frenzies</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.luckyClicks)}</span><span class="sn-fact-label">Lucky Clicks</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${this.stats.timesPrestiged}</span><span class="sn-fact-label">Times Ascended</span></div>
          </div>
        </div>
      </div>`;
  }

  _renderIndustryPage(body, fmt) {
    const owned = this.buildings.filter(b => b.count > 0);

    // Sum raw building CPS for accurate percentages
    let rawTotalCps = CookieNum.ZERO;
    owned.forEach(b => { rawTotalCps = rawTotalCps.add(b.cps.mul(b.count)); });
    const rawTotalNum = rawTotalCps.toNumber();

    // Top producer for headline
    let topName = 'None', topCps = CookieNum.ZERO;
    owned.forEach(b => { const t = b.cps.mul(b.count); if (t.gt(topCps)) { topCps = t; topName = b.name; } });

    const rows = owned.map(b => {
      const bTotalCps = b.cps.mul(b.count);
      const pct = rawTotalNum > 0 ? ((bTotalCps.toNumber() / rawTotalNum) * 100).toFixed(1) : '0.0';
      const barW = rawTotalNum > 0 ? Math.max(2, (bTotalCps.toNumber() / rawTotalNum) * 100) : 0;
      return `<div class="sn-building-row">
        <span class="sn-b-name"><strong>${b.name}</strong> <span class="sn-b-dim">x${b.count}</span></span>
        <div class="sn-b-bar-track"><div class="sn-b-bar-fill" style="width:${barW}%"></div></div>
        <span class="sn-b-val">${pct}%</span>
      </div>`;
    }).join('');

    body.innerHTML = `
      <div class="sn-article sn-lead">
        <h2 class="sn-headline">${topName} Leads Production at ${fmt(topCps)}/s</h2>
        <p class="sn-byline">Industry Desk · ${owned.length} of ${this.buildings.length} sectors active</p>
        <p class="sn-body-text">The bakery's ${owned.length} active divisions generated a combined <strong>${fmt(rawTotalCps)}</strong> base cookies per second today. Multipliers push effective output to <strong>${fmt(this.getEffectiveCPS())}</strong>/s.</p>
      </div>
      <div class="sn-rule"></div>
      <div class="sn-article">
        <h3 class="sn-subhead">Production Share by Division</h3>
        <div class="sn-building-list">${rows || '<p class="sn-body-text" style="color:#8b5e34;font-style:italic">No divisions operational yet.</p>'}</div>
      </div>`;
  }

  _renderUpgradesPage(body, fmt) {
    const purchased = this.upgrades.filter(u => u.level > 0);
    const total = this.upgrades.length;
    const maxed = this.upgrades.filter(u => {
      if (u.type === 'tieredUpgrade') return u.level > 0 && u.currentTier >= (u.tiers || []).length - 1;
      return u.level >= u.getEffectiveMaxLevel();
    }).length;

    // Categorize
    const clickUpgrades = purchased.filter(u => u.type === 'clickMultiplier' || (u.type === 'tieredUpgrade' && u.subtype === 'clickMultiplier'));
    const synergyUpgrades = purchased.filter(u => u.type === 'synergy');
    const otherUpgrades = purchased.filter(u => !clickUpgrades.includes(u) && !synergyUpgrades.includes(u));

    // Global multiplier breakdown
    const globalMult = this.globalCpsMultiplier;
    const achMult = this.achievementManager.getMultiplier();
    const prestMult = this.prestige.getPrestigeMultiplier();

    body.innerHTML = `
      <div class="sn-article sn-lead">
        <h2 class="sn-headline">${purchased.length} Upgrades Purchased of ${total}</h2>
        <p class="sn-byline">Technology Desk · ${maxed} fully maxed</p>
        <p class="sn-body-text">The bakery's research division reports <strong>${purchased.length}</strong> active upgrades powering current production. Combined multipliers have reached extraordinary levels.</p>
      </div>
      <div class="sn-rule"></div>
      <div class="sn-two-col">
        <div class="sn-article sn-col-article">
          <h3 class="sn-subhead">Multipliers</h3>
          <div class="sn-fact-list">
            <div class="sn-fact"><span class="sn-fact-num">x${globalMult.toFixed(2)}</span><span class="sn-fact-label">Global CPS</span></div>
            <div class="sn-fact"><span class="sn-fact-num">x${achMult.toFixed(2)}</span><span class="sn-fact-label">Achievement</span></div>
            <div class="sn-fact"><span class="sn-fact-num">x${prestMult.toFixed(2)}</span><span class="sn-fact-label">Prestige</span></div>
          </div>
        </div>
        <div class="sn-col-divider"></div>
        <div class="sn-article sn-col-article">
          <h3 class="sn-subhead">By Category</h3>
          <div class="sn-fact-list">
            <div class="sn-fact"><span class="sn-fact-num">${clickUpgrades.length}</span><span class="sn-fact-label">Click Power</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${synergyUpgrades.length}</span><span class="sn-fact-label">Synergies</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${otherUpgrades.length}</span><span class="sn-fact-label">Other</span></div>
          </div>
        </div>
      </div>`;
  }

  _renderEntertainmentPage(body, fmt) {
    const wonList = this.stats.miniGamesWon || [];
    const played = this.stats.miniGamesPlayed || 0;
    const winRate = played > 0 ? ((wonList.length / played) * 100).toFixed(0) : '0';

    const dungeonRuns = this.stats.dungeonRuns || 0;
    const dungeonBosses = this.stats.dungeonBossesDefeated || 0;
    const dungeonBest = this.stats.dungeonBestRooms || 0;

    body.innerHTML = `
      <div class="sn-article sn-lead">
        <h2 class="sn-headline">Mini-Games: ${played} Rounds Played</h2>
        <p class="sn-byline">Entertainment Section</p>
        <p class="sn-body-text">The bakery's recreational program has seen <strong>${played}</strong> games played to date, with a <strong>${winRate}%</strong> win rate across all categories.</p>
      </div>
      <div class="sn-rule"></div>
      <div class="sn-two-col">
        <div class="sn-article sn-col-article">
          <h3 class="sn-subhead">Records</h3>
          <div class="sn-fact-list">
            <div class="sn-fact"><span class="sn-fact-num">${wonList.length}</span><span class="sn-fact-label">Unique Wins</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.slotsJackpots)}</span><span class="sn-fact-label">Jackpots</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${(this.stats.cutterBestAccuracy || 0).toFixed(0)}%</span><span class="sn-fact-label">Best Cutter</span></div>
          </div>
        </div>
        <div class="sn-col-divider"></div>
        <div class="sn-article sn-col-article">
          <h3 class="sn-subhead">Dungeon Report</h3>
          <div class="sn-fact-list">
            <div class="sn-fact"><span class="sn-fact-num">${dungeonRuns}</span><span class="sn-fact-label">Runs</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${dungeonBosses}</span><span class="sn-fact-label">Bosses Slain</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${dungeonBest}</span><span class="sn-fact-label">Best Depth</span></div>
          </div>
        </div>
      </div>
      ${wonList.length > 0 ? `<div class="sn-rule"></div><div class="sn-article"><p class="sn-body-text" style="font-size:11px;color:#6b4a2a"><strong>Won:</strong> ${wonList.join(', ')}</p></div>` : ''}`;
  }

  _renderAchievementsPage(body, fmt) {
    const am = this.achievementManager;
    const unlocked = am.getUnlockedCount();
    const total = am.getTotalCount();
    const pct = total > 0 ? ((unlocked / total) * 100).toFixed(0) : '0';
    const mult = am.getMultiplier();

    // Get recent achievements (last 5 unlocked)
    const allAch = am.achievements || [];
    const unlockedAch = allAch.filter(a => a.unlocked);
    const recent = unlockedAch.slice(-5).reverse();
    const recentHtml = recent.map(a =>
      `<div class="sn-ach-row"><span class="sn-ach-icon">${a.icon || '🏆'}</span><strong>${a.name}</strong><span class="sn-ach-desc">${a.desc || ''}</span></div>`
    ).join('');

    // Locked teasers (first 3 locked)
    const locked = allAch.filter(a => !a.unlocked).slice(0, 3);
    const teaserHtml = locked.map(a =>
      `<div class="sn-ach-row sn-ach-locked"><span class="sn-ach-icon">🔒</span><span class="sn-ach-hint">${a.hint || '???'}</span></div>`
    ).join('');

    body.innerHTML = `
      <div class="sn-article sn-lead">
        <h2 class="sn-headline">${unlocked} of ${total} Achievements Unlocked</h2>
        <p class="sn-byline">Honors & Awards Section</p>
        <p class="sn-body-text">The bakery has earned <strong>${pct}%</strong> of all possible achievements, providing a <strong>x${mult.toFixed(2)}</strong> production multiplier. ${total - unlocked > 0 ? `${total - unlocked} achievements remain hidden, waiting to be discovered.` : 'All achievements unlocked — legendary status achieved!'}</p>
      </div>
      <div class="sn-rule"></div>
      <div class="sn-ach-bar-wrap">
        <div class="sn-ach-bar"><div class="sn-ach-bar-fill" style="width:${pct}%"></div></div>
        <span class="sn-ach-bar-label">${pct}% Complete</span>
      </div>
      ${recent.length > 0 ? `
      <div class="sn-rule"></div>
      <div class="sn-article">
        <h3 class="sn-subhead">Latest Honors</h3>
        ${recentHtml}
      </div>` : ''}
      ${locked.length > 0 ? `
      <div class="sn-rule"></div>
      <div class="sn-article">
        <h3 class="sn-subhead">Coming Up Next</h3>
        ${teaserHtml}
      </div>` : ''}`;
  }

  _renderDarkSidePage(body, fmt) {
    const stage = this.grandmapocalypse ? this.grandmapocalypse.stage : 0;
    const stageNames = ['Dormant — The grandmas are content. For now.', 'Displeased — They whisper. They watch.', 'Angered — The baking has taken a dark turn.', 'Awoken — They have transcended. Cookie production is eternal suffering.'];
    const stageLine = stageNames[stage] || `Stage ${stage}`;

    body.innerHTML = `
      <div class="sn-article sn-lead sn-dark-lead">
        <h2 class="sn-headline">The Grandmapocalypse: Stage ${stage}</h2>
        <p class="sn-byline">Investigative Report · Classified</p>
        <p class="sn-body-text"><em>${stageLine}</em></p>
      </div>
      <div class="sn-rule"></div>
      <div class="sn-two-col">
        <div class="sn-article sn-col-article">
          <h3 class="sn-subhead">Wrinkler Activity</h3>
          <div class="sn-fact-list">
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrinklersFed || 0)}</span><span class="sn-fact-label">Fed</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrinklersPopped || 0)}</span><span class="sn-fact-label">Popped</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.shinyWrinklersPopped || 0)}</span><span class="sn-fact-label">Shiny Popped</span></div>
          </div>
        </div>
        <div class="sn-col-divider"></div>
        <div class="sn-article sn-col-article">
          <h3 class="sn-subhead">Elder Affairs</h3>
          <div class="sn-fact-list">
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.elderPledgesUsed || 0)}</span><span class="sn-fact-label">Pledges Used</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.elderFrenzyTriggered || 0)}</span><span class="sn-fact-label">Elder Frenzies</span></div>
            <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrathCookiesClicked || 0)}</span><span class="sn-fact-label">Wrath Cookies</span></div>
          </div>
        </div>
      </div>`;
  }

  _fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  _updateMusicPlayerUI() {
    const gm = this.soundManager._gameMusic;
    const name = gm ? gm.getCurrentName() : '';

    // Progress bar
    const nameEl = document.getElementById("music-progress-name");
    const timeEl = document.getElementById("music-progress-time");
    const fillEl = document.getElementById("music-progress-fill");
    if (nameEl) nameEl.textContent = name || 'Nothing playing';
    if (gm && name && gm._playStartTime) {
      const elapsed = gm.getElapsed();
      const total = gm._lastDuration || 30; // guard against 0/undefined
      const pct = Math.min(100, (elapsed / total) * 100);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (timeEl) timeEl.textContent = `${this._fmtTime(elapsed)} / ${this._fmtTime(total)}`;
    } else {
      if (fillEl) fillEl.style.width = '0%';
      if (timeEl) timeEl.textContent = '';
    }

    // Highlight playing track
    document.querySelectorAll('.music-track').forEach(tr => {
      tr.classList.toggle('playing', !!(name && tr.dataset.display === name));
    });
  }

  _renderMusicPlayer() {
    const body = document.getElementById("music-body");
    if (!body) return;

    const gm = this.soundManager._gameMusic;
    let vol1, vol2, vol3, displayNames;
    if (gm) {
      const C = gm.constructor;
      vol1 = C._VOL1 || [];
      vol2 = C._VOL2 || [];
      vol3 = C._VOL3 || [];
      displayNames = C._DISPLAY_NAMES || {};
    } else {
      body.innerHTML = '<p class="music-hint">Enable music in settings to browse tracks.</p>';
      return;
    }

    const makeTrack = (name, cls) => {
      const display = displayNames[name] || name;
      return `<div class="music-track ${cls}" data-name="${name}" data-display="${display}">
        <span class="music-track-name">${display}</span>
        <button class="music-track-play">Play</button>
      </div>`;
    };

    body.innerHTML = `
      <div class="music-section-label">Volume I</div>
      ${vol1.map(n => makeTrack(n, '')).join('')}
      <div class="music-section-label">Volume II — Grandmapocalypse</div>
      ${vol2.map(n => makeTrack(n, 'dark')).join('')}
      <div class="music-section-label">Volume III</div>
      ${vol3.map(n => makeTrack(n, '')).join('')}
    `;

    // Play buttons — instant swap, auto-resumes after track ends
    body.querySelectorAll('.music-track-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const track = btn.closest('.music-track');
        const name = track.dataset.name;
        this.soundManager._ensureContext();
        if (!this.soundManager._gameMusic) this.soundManager.startMelody();
        const m = this.soundManager._gameMusic;
        if (m) {
          // Cancel start()'s auto-play timer so it doesn't stomp the user's pick
          if (m._timer) { clearTimeout(m._timer); m._timer = null; }
          m.playTrackInstant(name);
          this._updateMusicPlayerUI();
        }
      });
    });

    // Click track row = play
    body.querySelectorAll('.music-track').forEach(track => {
      track.addEventListener('click', () => track.querySelector('.music-track-play').click());
    });

    this._updateMusicPlayerUI();
  }

  // === Cookie Particles ===
  initParticles() {
    this._particles = [];
    const canvas = document.getElementById("cookie-particles");
    if (!canvas) return;
    const container = document.getElementById("cookie-container");
    const resize = () => {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const ctx = canvas.getContext("2d");

    // Ambient floating particles
    for (let i = 0; i < PARTICLES.ambientCount; i++) {
      this._particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.5 + 1,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4 - 0.2,
        alpha: Math.random() * 0.5 + 0.2,
        color: ['#f8c471', '#e67e22', '#d4a76a', '#ffd700'][Math.floor(Math.random() * 4)],
        life: 1,
        maxLife: 1,
        ambient: true,
      });
    }

    const animLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = this._particles.length - 1; i >= 0; i--) {
        const p = this._particles[i];
        p.x += p.dx;
        p.y += p.dy;
        if (!p.ambient) {
          // Apply gravity if present
          if (p.gravity) p.dy += p.gravity;
          p.life -= 0.02;
          if (p.life <= 0) { this._particles.splice(i, 1); continue; }
        } else {
          // Wrap around
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;
        }
        const alpha = p.ambient ? p.alpha : p.alpha * p.life;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(animLoop);
    };
    animLoop();
  }

  spawnClickParticles(event) {
    const canvas = document.getElementById("cookie-particles");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const colors = ['#f8c471', '#e67e22', '#ffd700', '#fff8dc', '#d4a76a', '#ffe082', '#ffb347'];
    // Big burst particles with varied sizes and slight gravity
    for (let i = 0; i < PARTICLES.clickBurstCount; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLES.clickBurstCount + (Math.random() - 0.5) * 0.6;
      const speed = Math.random() * 4 + 2;
      const size = Math.random() * 4 + 1;
      this._particles.push({
        x: cx, y: cy,
        r: size,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 1.5,
        alpha: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        maxLife: 1,
        ambient: false,
        gravity: PARTICLES.burstGravity,
      });
    }
    // Larger "sparkle" particles
    for (let i = 0; i < PARTICLES.clickSparkleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 0.8;
      this._particles.push({
        x: cx, y: cy,
        r: Math.random() * 2 + 3,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 0.8,
        alpha: 1,
        color: '#ffd700',
        life: 1,
        maxLife: 1,
        ambient: false,
        gravity: PARTICLES.sparkleGravity,
      });
    }
  }

  spawnClickRipple(event) {
    const container = document.getElementById("cookie-container");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Spawn two ripples with slight delay for layered effect
    for (let i = 0; i < 2; i++) {
      setTimeout(() => {
        const ripple = document.createElement("div");
        ripple.classList.add("cookie-ripple");
        if (i === 1) ripple.classList.add("cookie-ripple-delayed");
        ripple.style.left = x + "px";
        ripple.style.top = y + "px";
        container.appendChild(ripple);
        setTimeout(() => ripple.remove(), PARTICLES.rippleRemovalMs);
      }, i * PARTICLES.rippleLayerDelayMs);
    }
  }

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
  
  createFloatingText(event, text, isSpecial = false) {
    // Cap concurrent floating texts to prevent DOM bloat
    if (!this._floatingTexts) this._floatingTexts = [];
    while (this._floatingTexts.length >= 8) {
      const oldest = this._floatingTexts.shift();
      oldest.remove();
    }

    const floatingText = document.createElement("span");
    floatingText.textContent = text;
    floatingText.classList.add("cookie-text");
    if (isSpecial) floatingText.classList.add("special-text");

    let x = event.clientX;
    let y = event.clientY;
    // Synthetic clicks (keyboard Space/Enter) have 0,0 — fall back to cookie center
    if (!x && !y) {
      const btn = document.getElementById('cookie-button');
      if (btn) {
        const r = btn.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height * 0.3;
      }
    }
    floatingText.style.left = `${x}px`;
    floatingText.style.top = `${y}px`;

    document.body.appendChild(floatingText);
    this._floatingTexts.push(floatingText);
    setTimeout(() => {
      floatingText.remove();
      const idx = this._floatingTexts.indexOf(floatingText);
      if (idx !== -1) this._floatingTexts.splice(idx, 1);
    }, PARTICLES.floatingTextDurationMs);
  }
  
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

  // === Save / Load ===
  saveGame() {
    if (this._wipedSave || this._savePending) return;
    let saveData = {
      cookies: this.cookies.toJSON(),
      cookiesPerClick: this.cookiesPerClick.toJSON(),
      globalCpsMultiplier: this.globalCpsMultiplier,
      luckyClickChance: this.luckyClickChance,
      cpsClickBonus: this.cpsClickBonus,
      miniGameBonus: this.miniGameBonus,
      frenzyDurationMultiplier: this.frenzyDurationMultiplier,
      buildings: this.buildings.map(b => ({
        count: b.count,
        cost: b.cost.toJSON(),
        baseCost: b.baseCost.toJSON(),
      })),
      upgrades: this.upgrades.map(u => {
        const data = { level: u.level, cost: u.cost.toJSON() };
        if (u.type === "tieredUpgrade") {
          data.currentTier = u.currentTier;
          data.multiplier = u.multiplier;
          if (u.bonus !== undefined) data.bonus = u.bonus;
          if (u.chance !== undefined) data.chance = u.chance;
        }
        return data;
      }),
      stats: {
        ...this.stats,
        totalCookiesBaked: this.stats.totalCookiesBaked.toJSON(),
        handmadeCookies: this.stats.handmadeCookies.toJSON(),
      },
      achievements: this.achievementManager.getSaveData(),
      prestige: this.prestige.getSaveData(),
      tutorial: this.tutorial.getSaveData(),
      grandmapocalypse: this.grandmapocalypse ? this.grandmapocalypse.getSaveData() : null,
      wrinklers: this.wrinklerManager ? this.wrinklerManager.getSaveData() : null,
      settings: this.settings,
      lastSavedTime: Date.now(),
      saveVersion: 6,
    };
    const jsonStr = JSON.stringify(saveData);
    this._savePending = true;
    encryptSave(jsonStr).then(encrypted => {
      localStorage.setItem("cookieClickerSave", encrypted);
    }).finally(() => {
      this._savePending = false;
    });
  }

  loadGame() {
    const stored = localStorage.getItem("cookieClickerSave");
    if (!stored) return Promise.resolve();

    if (isEncrypted(stored)) {
      return decryptSave(stored).then(json => {
        this._restoreSave(JSON.parse(json));
      }).catch(err => {
        console.error("Failed to decrypt save — starting fresh.", err);
      });
    } else {
      // Legacy unencrypted save — restore now, re-encrypted on next save
      this._restoreSave(JSON.parse(stored));
      return Promise.resolve();
    }
  }

  /**
   * Migrate v1 saves (before tiered cursor/lucky/cpsClick) to v2 format.
   * Old: 39 upgrades with individual cursorScaling (22-25), luckyChance (26-29), cpsClick (30-34)
   * New: 29 upgrades with those collapsed into tiered upgrades at indices 22-24
   */
  _migrateUpgradesV1(oldUpgrades) {
    if (!oldUpgrades) return oldUpgrades;
    const migrated = [];

    // Indices 0-21 are unchanged — carry over level but strip stale cost
    for (let i = 0; i <= 21 && i < oldUpgrades.length; i++) {
      const { cost, ...rest } = oldUpgrades[i];
      migrated.push(rest);
    }
    // Pad if old save was shorter
    while (migrated.length < 22) migrated.push({ level: 0 });

    // Old 22-25 (cursorScaling) → new 22 (tiered cursorScaling)
    const cursorBought = [22, 23, 24, 25].reduce((n, i) => n + ((oldUpgrades[i] && oldUpgrades[i].level) || 0), 0);
    migrated.push(cursorBought > 0
      ? { level: 1, currentTier: cursorBought - 1 }
      : { level: 0 });

    // Old 26-29 (luckyChance) → new 23 (tiered luckyChance)
    const luckyBought = [26, 27, 28, 29].reduce((n, i) => n + ((oldUpgrades[i] && oldUpgrades[i].level) || 0), 0);
    migrated.push(luckyBought > 0
      ? { level: 1, currentTier: luckyBought - 1 }
      : { level: 0 });

    // Old 30-34 (cpsClick) → new 24 (tiered cpsClick)
    const clickBought = [30, 31, 32, 33, 34].reduce((n, i) => n + ((oldUpgrades[i] && oldUpgrades[i].level) || 0), 0);
    migrated.push(clickBought > 0
      ? { level: 1, currentTier: clickBought - 1 }
      : { level: 0 });

    // Old 35 → new 25 (Game Master) — strip cost
    const gm = oldUpgrades[35] ? (({ cost, ...r }) => r)(oldUpgrades[35]) : { level: 0 };
    migrated.push(gm);
    // Old 36 → new 26 (Extended Frenzy)
    const ef = oldUpgrades[36] ? (({ cost, ...r }) => r)(oldUpgrades[36]) : { level: 0 };
    migrated.push(ef);
    // Old 37 → new 27 (Mega Frenzy)
    const mf = oldUpgrades[37] ? (({ cost, ...r }) => r)(oldUpgrades[37]) : { level: 0 };
    migrated.push(mf);
    // Old 38 → new 28 (Offline Production tiered)
    migrated.push(oldUpgrades[38] || { level: 0 });

    return migrated;
  }

  /**
   * Apply one-time setting enforcements. Each enforcement has a unique id;
   * once applied, the id is stored in settings._enforced so it never re-runs.
   * @param {Array<{id: string, key: string, value: any}>} list
   */
  _applyEnforcements(list) {
    // Migrate old single-flag system → new registry
    if (this.settings._ambientVolEnforced) {
      if (!this.settings._enforced) this.settings._enforced = [];
      if (!this.settings._enforced.includes('ambient-vol-15')) {
        this.settings._enforced.push('ambient-vol-15');
      }
      delete this.settings._ambientVolEnforced;
    }

    if (!this.settings._enforced) this.settings._enforced = [];
    const applied = new Set(this.settings._enforced);
    for (const { id, key, value } of list) {
      if (!applied.has(id)) {
        this.settings[key] = value;
        this.settings._enforced.push(id);
      }
    }
  }

  _restoreSave(data) {
    // Migrate old save formats
    if (!data.saveVersion || data.saveVersion < 2) {
      data.upgrades = this._migrateUpgradesV1(data.upgrades);
    }
    // V2 → V3: heavenly upgrades & new buildings/upgrades (arrays just grow; new entries auto-initialize)
    if (data.saveVersion && data.saveVersion < 3) {
      // Prestige save data gains new fields — handled by loadSaveData defaults
      if (data.prestige && !data.prestige.purchasedUpgrades) {
        data.prestige.purchasedUpgrades = [];
        data.prestige.spentChips = 0;
      }
    }
    // V3 → V4: more upgrades, buildings adjustments, new heavenly upgrades — arrays grow, auto-initialized
    // V4 → V5: CookieNum precision — all numeric fields now use CookieNum.fromJSON() which
    //   accepts both plain numbers (old saves) and [mantissa, exponent] arrays (new saves).
    //   No explicit data migration needed; fromJSON handles both formats transparently.

    this.cookies = CookieNum.fromJSON(data.cookies || 0);
    this.cookiesPerClick = CookieNum.from(1);
    this.globalCpsMultiplier = 1;
    this.luckyClickChance = 0;
    this.cpsClickBonus = 0;
    this.miniGameBonus = 1;
    this.frenzyDurationMultiplier = 1;

    // Load prestige first (affects multipliers)
    this.prestige.loadSaveData(data.prestige);

    // Load achievements
    this.achievementManager.loadSaveData(data.achievements);

    // Load tutorial state
    if (data.tutorial) {
      this.tutorial.loadSaveData(data.tutorial);
    }

    // Load settings
    if (data.settings) {
      this.settings = { ...this.settings, ...data.settings };
    }

    // ── One-time setting enforcements ──
    // Add entries here to force a setting value once for all players (new and existing).
    // Each entry runs once per save — after that the player's changes are respected.
    // To enforce a new value: add a new entry with a unique id.
    this._applyEnforcements([
      { id: 'ambient-vol-15', key: 'ambientVolume', value: 0.15 },
      // { id: 'music-vol-80',  key: 'musicVolume',   value: 0.8 },
    ]);

    // Load stats
    if (data.stats) {
      this.stats = { ...this.stats, ...data.stats };
      // Restore CookieNum fields from JSON
      this.stats.totalCookiesBaked = CookieNum.fromJSON(data.stats.totalCookiesBaked || 0);
      this.stats.handmadeCookies = CookieNum.fromJSON(data.stats.handmadeCookies || 0);
    }

    // Load Buildings
    if (data.buildings) {
      const len = Math.min(data.buildings.length, this.buildings.length);
      for (let i = 0; i < len; i++) {
        const savedBuilding = data.buildings[i];
        this.buildings[i].count = savedBuilding.count || 0;
        this.buildings[i].cost = savedBuilding.cost ? CookieNum.fromJSON(savedBuilding.cost) : this.buildings[i].cost;
        if (savedBuilding.baseCost) {
          this.buildings[i].baseCost = CookieNum.fromJSON(savedBuilding.baseCost);
        }
      }

      // Fallback for old saves without baseCost: re-apply Twin Gates discount
      const buildingDiscount = this.prestige.getBuildingCostReduction();
      if (buildingDiscount > 0) {
        for (let i = 0; i < this.buildings.length; i++) {
          if (!data.buildings[i] || !data.buildings[i].baseCost) {
            this.buildings[i].baseCost = this.buildings[i].baseCost.mul(1 - buildingDiscount).floor();
          }
        }
      }
    }

    // Load Upgrades and reapply effects
    if (data.upgrades) {
      const len = Math.min(data.upgrades.length, this.upgrades.length);
      for (let i = 0; i < len; i++) {
        const savedUpgrade = data.upgrades[i];
        const upgrade = this.upgrades[i];

        upgrade.level = savedUpgrade.level || 0;

        // Restore saved cost, or recalculate from definition if missing
        if (savedUpgrade.cost) {
          upgrade.cost = CookieNum.fromJSON(savedUpgrade.cost);
        } else if (upgrade.level > 0 && upgrade.type !== 'tieredUpgrade') {
          // Recalculate cost from definition for leveled non-tiered upgrades
          let c = CookieNum.from(upgrade.upgrade.cost);
          for (let lv = 1; lv <= upgrade.level; lv++) {
            let cm = lv > upgrade.base_max_level
              ? (upgrade.prestige_cost_multiplier || upgrade.cost_multiplier)
              : upgrade.cost_multiplier;
            if (upgrade.accel_start && upgrade.cost_acceleration && lv >= upgrade.accel_start) {
              const extra = lv - upgrade.accel_start + 1;
              c = c.mul(cm).mul(CookieNum.from(upgrade.cost_acceleration).pow(extra));
            } else {
              c = c.mul(cm);
            }
          }
          upgrade.cost = c;
        }

        if (upgrade.type === "tieredUpgrade" && upgrade.tiers) {
          upgrade.currentTier = savedUpgrade.currentTier || 0;
          upgrade.updateTierProperties();
          if (savedUpgrade.multiplier !== undefined) upgrade.multiplier = savedUpgrade.multiplier;
          if (savedUpgrade.bonus !== undefined) upgrade.bonus = savedUpgrade.bonus;
          if (savedUpgrade.chance !== undefined) upgrade.chance = savedUpgrade.chance;
        }

        // Re-apply effects
        if (upgrade.level > 0) {
          for (let j = 0; j < upgrade.level; j++) {
            upgrade.applyEffect();
          }
        }
      }
    }

    // Load grandmapocalypse and wrinkler state
    if (data.grandmapocalypse && this.grandmapocalypse) {
      this.grandmapocalypse.loadSaveData(data.grandmapocalypse);
    }
    if (data.wrinklers && this.wrinklerManager) {
      this.wrinklerManager.loadSaveData(data.wrinklers);
    }
    // V5 → V6: grandmapocalypse + wrinklers added. No migration needed; fields default gracefully.

    // Apply heavenly upgrade effects (e.g. Cosmic Grandma)
    this.prestige.applyAllEffects();

    // Restore exact saved values after reapply
    this.cookiesPerClick = CookieNum.fromJSON(data.cookiesPerClick || 1);
    if (data.globalCpsMultiplier) this.globalCpsMultiplier = data.globalCpsMultiplier;
    if (data.luckyClickChance) this.luckyClickChance = data.luckyClickChance;
    if (data.cpsClickBonus) this.cpsClickBonus = data.cpsClickBonus;
    if (data.miniGameBonus) this.miniGameBonus = data.miniGameBonus;
    if (data.frenzyDurationMultiplier) this.frenzyDurationMultiplier = data.frenzyDurationMultiplier;

    // Calculate offline earnings
    if (data.lastSavedTime) {
      const now = Date.now();
      const elapsedTime = Math.floor((now - data.lastSavedTime) / 1000);

      if (elapsedTime > 0) {
        this.calculateCPS();

        let offlineMultiplier = GAME.offlineMultiplier;
        this.upgrades.forEach(upgrade => {
          if (upgrade.name && upgrade.name.startsWith("Offline Production") && upgrade.level > 0) {
            offlineMultiplier = upgrade.multiplier;
          }
        });

        // Exclude wrinkler drain — wrinklers don't feed while offline
        const baseCps = this.getEffectiveCPS({ excludeWrinklerDrain: true });
        const offlineEarnings = baseCps.mul(elapsedTime * offlineMultiplier);
        this.cookies = this.cookies.add(offlineEarnings);
        this.stats.totalCookiesBaked = this.stats.totalCookiesBaked.add(offlineEarnings);

        if (offlineEarnings.gt(0)) {
          if (this.visualEffects) this.visualEffects.triggerIncomeRain(offlineEarnings.toNumber());
          if (this.tutorial) {
            // Build enhanced offline report data
            const buildingsData = this.buildings
              .filter(b => b.count > 0)
              .map(b => ({ name: b.name, count: b.count, cps: b.cps.mul(b.count).toNumber() }))
              .sort((a, b) => b.cps - a.cps);

            const wrinklerCount = data.wrinklers?.wrinklers?.length || 0;
            const wrinklerCookies = (data.wrinklers?.wrinklers || []).reduce(
              (sum, w) => sum + (typeof w.cookiesEaten === 'number' ? w.cookiesEaten : parseFloat(w.cookiesEaten) || 0), 0
            );

            const missedGoldenCookies = Math.floor(elapsedTime / 120);
            const grandmaStage = this.grandmapocalypse ? this.grandmapocalypse.stage : 0;

            this.tutorial.showOfflineEarnings({
              elapsedSec: elapsedTime,
              baseCps: baseCps.toNumber(),
              offlineMultiplier,
              totalEarned: offlineEarnings.toNumber(),
              formatFn: formatNumberInWords,
              buildings: buildingsData,
              wrinklerCount,
              wrinklerCookies: formatNumberInWords(wrinklerCookies),
              missedGoldenCookies,
              grandmaStage,
            });
          }
        }
      }
    }

    // Full UI refresh so buildings, upgrades, and stats reflect restored state
    this.updateUI();
    this.updateLeftPanel();
  }
}