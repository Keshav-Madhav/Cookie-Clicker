import { Building } from "./buildings.js";
import { Upgrade } from "./upgrades.js";
import { AchievementManager } from "./achievements.js";
import { PrestigeManager } from "./prestige.js";
import { VisualEffects } from "./visualEffects.js";
import { Tutorial } from "./tutorial.js";
import { buildings, upgrades, heavenlyUpgrades } from "./gameData.js";
import { formatNumberInWords, setShortNumbers } from "./utils.js";
import { encryptSave, decryptSave, isEncrypted } from "./saveCrypto.js";
import {
  GAME, LUCKY_CLICK, FRENZY_BURSTS, PARTICLES,
  EASTER_EGGS, GOLDEN_COOKIE
} from "./config.js";

export class Game {
  constructor() {
    this.cookies = GAME.startingCookies;
    this.cookiesPerClick = GAME.startingCookiesPerClick;
    this.cookiesPerSecond = 0;
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
    };

    // Frenzy state
    this.frenzyActive = false;
    this.frenzyMultiplier = 1;
    this.frenzyEndTime = 0;
    this.frenzyType = null;  // 'cps' or 'click'

    // Stats tracking
    this.stats = {
      totalCookiesBaked: 0,
      totalClicks: 0,
      totalUpgradesPurchased: 0,
      luckyClicks: 0,
      frenziesTriggered: 0,
      timesPrestiged: 0,
      startTime: Date.now(),
      handmadeCookies: 0,
      miniGamesWon: [],  // tracks which mini-games have been won
      cutterBestAccuracy: 0,  // best accuracy in cookie cutter
      kitchenBestStreak: 0,   // best perfect streak in grandma's kitchen
      slotsJackpots: 0,       // number of jackpots hit in slots
      goldenCookiesClicked: 0, // golden cookies clicked
      sessionPrestiges: 0,    // prestiges in current session
      miniGamesPlayed: 0,     // total minigames played
    };

    // Load buildings & upgrades from gameData.js
    this.buildings = buildings.map((_, index) => new Building(index, this));
    this.upgrades = upgrades.map((_, index) => new Upgrade(index, this));

    // Achievement & Prestige systems
    this.achievementManager = new AchievementManager(this);
    this.prestige = new PrestigeManager(this);
    this.visualEffects = new VisualEffects(this);
    this.tutorial = new Tutorial(this);

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
    this.initParticles();
    this.visualEffects.init();

    // Easter egg: typing "cookie" anywhere
    this._typedKeys = '';
    document.addEventListener('keydown', (e) => {
      // Only track letter keys
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        this._typedKeys += e.key.toLowerCase();
        // Keep only last 6 characters
        if (this._typedKeys.length > 6) {
          this._typedKeys = this._typedKeys.slice(-6);
        }
        // Check if "cookie" was typed
        if (this._typedKeys === 'cookie' && this.tutorial) {
          this.tutorial.triggerEvent('cookieTyped');
          this._typedKeys = ''; // Reset after triggering
        }
      }
      // Reset idle timer on any key
      this._resetIdleTimer();
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
    document.addEventListener('mousemove', () => this._resetIdleTimer());
    // Apply saved settings to visual effects
    this.visualEffects.particlesEnabled = this.settings.particles;
    this.visualEffects.shimmersEnabled = this.settings.shimmers;
    setShortNumbers(this.settings.shortNumbers);
    this.tutorial.init();

    // Main game loop - 1 second tick
    setInterval(() => {
      const effectiveCPS = this.getEffectiveCPS();
      this.cookies += effectiveCPS;
      this.cookies = parseFloat(this.cookies.toFixed(1));
      this.stats.totalCookiesBaked += effectiveCPS;

      // Check frenzy expiry
      if (this.frenzyActive && Date.now() >= this.frenzyEndTime) {
        this.endFrenzy();
      }

      this.achievementManager.check();
      this.updateCookieCount();
      this.updateLeftPanel();
      this.visualEffects.update();

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

    // Auto-save
    setInterval(() => this.saveGame(), GAME.saveIntervalMs);

    // Initial left panel render
    this.updateLeftPanel();
  }

  getEffectiveCPS() {
    let cps = this.cookiesPerSecond * this.globalCpsMultiplier;
    cps *= this.achievementManager.getMultiplier();
    cps *= this.prestige.getPrestigeMultiplier();

    // Kitten Workers: +1% CPS per achievement
    const kittenBonus = this.prestige.getCpsPerAchievementBonus();
    if (kittenBonus > 0) {
      cps *= (1 + kittenBonus * this.achievementManager.getUnlockedCount());
    }

    // Cosmic Resonance: +0.5% CPS per building type owned
    const buildingTypeBonus = this.prestige.getCpsPerBuildingTypeBonus();
    if (buildingTypeBonus > 0) {
      const typesOwned = this.buildings.filter(b => b.count > 0).length;
      cps *= (1 + buildingTypeBonus * typesOwned);
    }

    if (this.frenzyActive && this.frenzyType === 'cps') {
      cps *= this.frenzyMultiplier;
    }
    return parseFloat(cps.toFixed(1));
  }

  getEffectiveCPC() {
    // Base click value with multipliers
    let baseClick = this.cookiesPerClick;
    baseClick *= this.prestige.getPrestigeMultiplier();
    baseClick *= this.achievementManager.getMultiplier();

    // CPS-based click bonus (uses steady-state CPS, no frenzy)
    let cpsBonus = 0;
    if (this.cpsClickBonus > 0) {
      let baseCps = this.cookiesPerSecond * this.globalCpsMultiplier;
      baseCps *= this.achievementManager.getMultiplier();
      baseCps *= this.prestige.getPrestigeMultiplier();
      cpsBonus = baseCps * this.cpsClickBonus;
    }

    let cpc = baseClick + cpsBonus;
    // Heavenly Clicking: x3 clicking power
    cpc *= this.prestige.getClickMultiplier();
    if (this.frenzyActive && this.frenzyType === 'click') {
      cpc *= this.frenzyMultiplier;
    }
    return parseFloat(cpc.toFixed(1));
  }

  clickCookie(event) {
    const clickAmount = this.getEffectiveCPC();
    this.cookies += clickAmount;
    this.cookies = parseFloat(this.cookies.toFixed(1));
    this.stats.totalCookiesBaked += clickAmount;
    this.stats.handmadeCookies += clickAmount;



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
    clearInterval(this._idleTimer);
    this._idleTimer = setInterval(() => {
      this._idleTime++;
      // 10 minutes = 600 seconds
      if (this._idleTime >= 600 && this.tutorial) {
        this.tutorial.triggerEvent('theWatcher');
        this._idleTime = 0; // Reset so it can trigger again after another 10 min
      }
    }, 1000);
  }

  checkLuckyClick(event) {
    if (this.luckyClickChance <= 0) return;
    
    if (Math.random() < this.luckyClickChance) {
      this.stats.luckyClicks++;

      // Tutorial: lucky click event
      if (this.tutorial) this.tutorial.triggerEvent('luckyClick');
      
      // Random bonus type
      const roll = Math.random();
      if (roll < LUCKY_CLICK.cookieRollMax) {
        // Lucky: CPS bonus (minimum floor), amplified by Lucky Stars
        const luckyMult = this.prestige.getLuckyClickMultiplier();
        const bonus = Math.max(LUCKY_CLICK.cookie.minCookies, this.getEffectiveCPS() * LUCKY_CLICK.cookie.cpsMultiplier) * luckyMult;
        this.cookies += bonus;
        this.stats.totalCookiesBaked += bonus;
        this.createFloatingText(event, `🍀 LUCKY! +${formatNumberInWords(bonus)}`, true);
        if (this.visualEffects) this.visualEffects.triggerIncomeRain(bonus);
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
    const wasAlreadyActive = this.frenzyActive;
    const duration = durationSec * 1000 * this.frenzyDurationMultiplier;
    this.frenzyActive = true;
    this.frenzyType = type;
    // Frenzy Overload: double frenzy multiplier
    this.frenzyMultiplier = multiplier * this.prestige.getFrenzyBonusMultiplier();
    this.frenzyEndTime = Date.now() + duration;
    this.stats.frenziesTriggered++;
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

  endFrenzy() {
    this.frenzyActive = false;
    this.frenzyType = null;
    this.frenzyMultiplier = 1;
    this.frenzyEndTime = 0;
    this.updateFrenzyIndicator();
  }

  updateFrenzyIndicator() {
    const indicator = document.getElementById("frenzy-indicator");
    if (!indicator) return;
    
    if (this.frenzyActive) {
      const remaining = Math.ceil((this.frenzyEndTime - Date.now()) / 1000);
      if (this.frenzyType === 'cps') {
        indicator.textContent = `🔥 FRENZY ${this.frenzyMultiplier}x CPS (${remaining}s)`;
      } else {
        indicator.textContent = `⚡ CLICK FRENZY ${this.frenzyMultiplier}x (${remaining}s)`;
      }
      indicator.classList.add("active");
    } else {
      indicator.textContent = "";
      indicator.classList.remove("active");
    }
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
        indices.sort((a, b) => this.buildings[a].cost - this.buildings[b].cost);
        break;
      case 'cps':
        indices.sort((a, b) => this.buildings[b].cps - this.buildings[a].cps);
        break;
      case 'efficiency':
        // Cost per CPS — lower is better
        indices.sort((a, b) => {
          const effA = this.buildings[a].cps > 0 ? this.buildings[a].cost / this.buildings[a].cps : Infinity;
          const effB = this.buildings[b].cps > 0 ? this.buildings[b].cost / this.buildings[b].cps : Infinity;
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
        btn.addEventListener('click', () => this.setPurchaseAmount(amount));
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
        btn.addEventListener('click', () => this.setBuildingSort(s.key));
        sortGroup.appendChild(btn);
      });

      toolbar.appendChild(buyGroup);
      toolbar.appendChild(sortGroup);
      shopDiv.insertBefore(toolbar, buildingList);
    }
  }

  setupPrestigeButton() {
    const btn = document.getElementById("prestige-btn");
    if (btn) {
      btn.addEventListener("click", () => this.handlePrestige());
    }

    // Easter egg: clicking the prestige diamond
    const prestEl = document.getElementById("left-prestige");
    if (prestEl) {
      prestEl.addEventListener("click", (e) => {
        // Only trigger if clicking the diamond icon itself, not the button
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
      });
    }
    if (closeBtn && overlay) {
      closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));
    }
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.add("hidden");
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

      // Check prerequisites
      const prereqsMet = !upgrade.requires || upgrade.requires.length === 0 ||
        upgrade.requires.every(r => this.prestige.hasUpgrade(r));

      const card = document.createElement("div");
      card.className = `heavenly-card ${owned ? 'heavenly-owned' : ''} ${canBuy ? 'heavenly-buyable' : ''} ${!prereqsMet && !owned ? 'heavenly-locked' : ''}`;

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
      `;

      if (!owned && canBuy) {
        card.addEventListener("click", () => {
          if (this.prestige.buyUpgrade(upgrade.id)) {
            this.renderHeavenlyShop();
            this.calculateCPS();
            this.updateLeftPanel();
            this.saveGame();
          }
        });
      }

      grid.appendChild(card);
    });
  }

  updateHeavenlyShopButton() {
    const btn = document.getElementById("heavenly-shop-btn");
    if (btn) {
      btn.style.display = this.prestige.timesPrestiged >= 1 ? '' : 'none';
    }
  }

  setupUpgradeNav() {
    const prev = document.getElementById("upgrade-prev");
    const next = document.getElementById("upgrade-next");
    if (prev) prev.addEventListener("click", () => {
      if (this._upgradePage > 0) { this._upgradePage--; this._upgradeNavDir = 'left'; this.renderUpgradePage(true); this.updateButtonsState(); }
    });
    if (next) next.addEventListener("click", () => {
      const totalPages = Math.ceil((this._upgradeOrder || this.upgrades).length / this.upgradePageSize);
      if (this._upgradePage < totalPages - 1) { this._upgradePage++; this._upgradeNavDir = 'right'; this.renderUpgradePage(true); this.updateButtonsState(); }
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
        // Easter egg: first time opening settings
        if (this.tutorial) this.tutorial.triggerEvent('settingsOpened');
      });
    }
    if (closeBtn && overlay) {
      closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));
    }
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.add("hidden");
      });
    }

    // Replay Tutorial button
    const replayBtn = document.getElementById("replay-tutorial-btn");
    if (replayBtn) {
      replayBtn.addEventListener("click", () => {
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

    // ── Export Save ──
    const exportBtn = document.getElementById("export-save-btn");
    const saveArea = document.getElementById("save-text-area");
    if (exportBtn && saveArea) {
      exportBtn.addEventListener("click", () => {
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
      if (onChange) onChange(el.checked);
      this.saveGame();
    });
  }

  /** Sync toggle checkboxes with current settings (called on menu open) */
  _syncToggles() {
    const map = { "setting-particles": "particles", "setting-short-numbers": "shortNumbers", "setting-shimmers": "shimmers" };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.checked = this.settings[key];
    }
  }

  updateMenu() {
    // Stats
    const statsEl = document.getElementById("menu-stats");
    if (statsEl) {
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
          <span class="stat-label">${(this.luckyClickChance * 100).toFixed(1)}% Luck</span>
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
    if (newChips <= 0) return;

    if (confirm(`Prestige now to earn ${newChips} Heavenly Chips?\n\nYou'll reset all cookies and buildings but keep your Heavenly Chips which give +${newChips}% permanent CPS bonus.\n\nTotal HC after: ${this.prestige.heavenlyChips + newChips}`)) {
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
    this.cookies = GAME.startingCookies * startingMultiplier;
    this.cookiesPerClick = GAME.startingCookiesPerClick;
    this.cookiesPerSecond = 0;
    this.globalCpsMultiplier = 1;
    this.luckyClickChance = 0;
    this.cpsClickBonus = 0;
    this.miniGameBonus = 1;
    this.frenzyDurationMultiplier = 1;
    this.frenzyActive = false;
    this.frenzyMultiplier = 1;
    this.frenzyEndTime = 0;
    this.frenzyType = null;

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
      // Remove any active golden cookie element
      if (this.visualEffects.goldenCookieEl) {
        this.visualEffects.goldenCookieEl.remove();
        this.visualEffects.goldenCookieEl = null;
      }
      // Restart golden cookie spawn cycle
      this.visualEffects._scheduleGoldenCookie();
    }

    // Switch to default tab on mobile
    if (this._mobileNav && this._mobileNav.isMobile()) {
      this._mobileNav.switchTab('cookie');
    }

    // Persistent Memory: save upgrade levels before reset (use higher of the two tiers)
    const memoryFraction = Math.max(this.prestige.getPersistentMemoryFraction(), this.prestige.getPersistentMemoryFraction2());
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
        b.baseCost = Math.floor(b.baseCost * (1 - buildingDiscount));
        b.cost = b.baseCost;
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
            costMult *= Math.pow(upgrade.cost_acceleration, extra);
          }
          upgrade.cost = Math.floor(upgrade.cost * costMult);
        }
      }
    });

    // Cosmic Grandma: apply grandma multiplier
    this.prestige.applyAllEffects();

    // Reset stats for this run (but keep prestige stats)
    this.stats = {
      totalCookiesBaked: 0,
      totalClicks: 0,
      totalUpgradesPurchased: 0,
      luckyClicks: 0,
      frenziesTriggered: 0,
      timesPrestiged: this.prestige.timesPrestiged,
      startTime: Date.now(),
      handmadeCookies: 0,
      miniGamesWon: [],
    };

    this.calculateCPS();
    this.saveGame();
    this.updateUI();
    this.updateLeftPanel();
    this.visualEffects.update();
  }
  
  createFloatingText(event, text, isSpecial = false) {
    const floatingText = document.createElement("span");
    floatingText.textContent = text;
    floatingText.classList.add("cookie-text");
    if (isSpecial) floatingText.classList.add("special-text");
  
    floatingText.style.left = `${event.clientX}px`;
    floatingText.style.top = `${event.clientY}px`;
  
    document.body.appendChild(floatingText);
    setTimeout(() => floatingText.remove(), PARTICLES.floatingTextDurationMs);
  }
  
  // Offline earnings are now shown via Tutorial.showOfflineEarnings() popup

  updateCookieCount() {
    document.getElementById("cookie-count").textContent = formatNumberInWords(this.cookies);
    document.getElementById("cps-count").textContent = formatNumberInWords(this.getEffectiveCPS());
    document.getElementById("cpc-count").textContent = formatNumberInWords(this.getEffectiveCPC());



    if (this.purchaseAmount === 'Max') {
      this.renderBuildingList(false);
      this.renderUpgradePage();
      this.updateButtonsState(); 
    } else {
      this.renderBuildingList(false);
      this.updateButtonsState(); 
    }

    // Update frenzy timer
    if (this.frenzyActive) {
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
        if (this.cookies < effectiveCost) {
          button.disabled = true;
          button.dataset.disabledReason = "Not Enough Cookies";
        } else if (upgrade.level > 0 && !upgrade.canUpgradeTier()) {
          button.disabled = true;
          if (upgrade.currentTier < upgrade.tiers.length - 1) {
            const nextTier = upgrade.tiers[upgrade.currentTier + 1];
            const totalBuildings = this.getTotalBuildingCount();
            button.dataset.disabledReason = `Need ${nextTier.buildingsRequired} buildings (have ${totalBuildings})`;
          } else {
            button.dataset.disabledReason = 'Maximum Tier Reached';
          }
        } else if (upgrade.currentTier >= upgrade.tiers.length - 1 && upgrade.level > 0) {
          button.disabled = true;
          button.dataset.disabledReason = 'Maximum Tier Reached';
        } else {
          button.disabled = false;
          delete button.dataset.disabledReason;
          anyUpgradeAffordable = true;
        }
      } else {
        if (this.cookies < effectiveCost) {
          button.disabled = true;
          button.dataset.disabledReason = "Not Enough Cookies";
        } else if (upgrade.level >= upgrade.max_level) {
          button.disabled = true;
          button.dataset.disabledReason = `Max Level: ${upgrade.max_level}`;
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
        button.disabled = this.cookies < building.cost;
      } else {
        let totalCost = 0;
        const currentCount = building.count;
        for (let i = 0; i < purchaseAmount; i++) {
          const cost = Math.floor(building.baseCost * Math.pow(building.cost_multiplier, currentCount + i));
          totalCost += cost;
        }
        button.disabled = this.cookies < totalCost;
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

  renderUpgradePage(animated = false) {
    if (this._upgradePage === undefined) this._upgradePage = 0;
    // Initialize sort order if not set — use full maxed-aware sort
    if (!this._upgradeOrder || this._upgradeOrder.length !== this.upgrades.length) {
      this.sortUpgradesByCost(false);
    }
    const pageSize = this.upgradePageSize;
    const totalPages = Math.max(1, Math.ceil(this._upgradeOrder.length / pageSize));
    if (this._upgradePage >= totalPages) this._upgradePage = totalPages - 1;

    const start = this._upgradePage * pageSize;
    const pageIndices = this._upgradeOrder.slice(start, start + pageSize);

    const list = document.getElementById("upgrade-list");

    const populate = () => {
      list.innerHTML = "";
      pageIndices.forEach((upgradeIdx, i) => {
        const upgrade = this.upgrades[upgradeIdx];
        const btn = upgrade.getButton(upgradeIdx);
        if (animated) {
          btn.classList.add('upgrade-enter');
          btn.style.animationDelay = `${i * 25}ms`;
        }
        list.appendChild(btn);
      });
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
      // Maxed upgrades go to the end
      const maxedA = upA.type === 'tieredUpgrade'
        ? (upA.level > 0 && upA.currentTier >= upA.tiers.length - 1)
        : (upA.level >= upA.getEffectiveMaxLevel());
      const maxedB = upB.type === 'tieredUpgrade'
        ? (upB.level > 0 && upB.currentTier >= upB.tiers.length - 1)
        : (upB.level >= upB.getEffectiveMaxLevel());
      if (maxedA !== maxedB) return maxedA ? 1 : -1;
      return upA.cost - upB.cost;
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
    let baseCps = this.buildings.reduce((acc, b) => acc + b.count * b.cps, 0);

    // Divine Bakeries: +X% CPS per prestige level to all buildings
    const buildingPrestigeBonus = this.prestige.getBuildingCpsPerPrestige();
    if (buildingPrestigeBonus > 0) {
      baseCps *= (1 + buildingPrestigeBonus);
    }

    // Synergy multiplier from Synergy Vol. II and Cosmic Synergy heavenly upgrades
    const synergyMult = this.prestige.getSynergyMultiplier() * this.prestige.getSynergyMultiplier2();

    // Add synergy bonuses
    this.upgrades.forEach(upgrade => {
      if (upgrade.type === "synergy" && upgrade.level > 0) {
        const sourceBuilding = this.buildings.find(b => b.name === upgrade.source);
        const targetBuilding = this.buildings.find(b => b.name === upgrade.target);
        if (sourceBuilding && targetBuilding) {
          // Each level multiplies the bonus, doubled by Synergy Vol. II
          const synergyBonus = sourceBuilding.count * upgrade.bonus * upgrade.level * synergyMult;
          baseCps += targetBuilding.count * synergyBonus;
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
        baseCps += cursorBuilding.count * nonCursorBuildings * cursorBonusPerBuilding;
      }
    }

    this.cookiesPerSecond = parseFloat(baseCps.toFixed(1));
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
      // Bar width: capped at 100%, scaled so x5 = full bar
      const barPct = (v) => Math.min(100, ((v - 1) / GAME.multiplierBarScale) * 100).toFixed(0);

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
          <div class="mult-bar-track"><div class="mult-bar-fill combined" style="width:${barPct(combined)}%"></div></div>
          <span class="mult-value">x${combined.toFixed(2)}</span>
        </div>
      `;
    }

    // Prestige section — chips display + info rows
    const prestEl = document.getElementById("left-prestige");
    if (prestEl) {
      const potentialChips = this.prestige.calculateHeavenlyChipsOnReset();
      const spendable = this.prestige.getSpendableChips();
      prestEl.innerHTML = `
        <div class="prestige-chips">
          <span class="chip-icon heavenly-cookie">🍪</span>
          <span class="chip-count">${formatNumberInWords(this.prestige.heavenlyChips)}</span>
        </div>
        <div class="prestige-row"><span>Ascended</span><span>${this.prestige.timesPrestiged}x</span></div>
        <div class="prestige-row"><span>On reset</span><span>+${formatNumberInWords(potentialChips)}</span></div>
        ${this.prestige.spentChips > 0 ? `<div class="prestige-row"><span>Available</span><span><span class="heavenly-cookie-small">🍪</span> ${formatNumberInWords(spendable)}</span></div>` : ''}
      `;
      
      const btn = document.getElementById("prestige-btn");
      if (btn) {
        btn.disabled = !this.prestige.canPrestige();
        if (this.prestige.canPrestige()) {
          btn.textContent = `Ascend (+${formatNumberInWords(potentialChips)} HC)`;
          // Tutorial: prestige available event
          if (this.tutorial) this.tutorial.triggerEvent('prestigeAvailable');
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
    if (this._wipedSave) return; // Don't save after wipe
    let saveData = {
      cookies: this.cookies,
      cookiesPerClick: this.cookiesPerClick,
      globalCpsMultiplier: this.globalCpsMultiplier,
      luckyClickChance: this.luckyClickChance,
      cpsClickBonus: this.cpsClickBonus,
      miniGameBonus: this.miniGameBonus,
      frenzyDurationMultiplier: this.frenzyDurationMultiplier,
      buildings: this.buildings.map(b => ({
        count: b.count,
        cost: b.cost,
      })),
      upgrades: this.upgrades.map(u => {
        const data = { level: u.level, cost: u.cost };
        if (u.type === "tieredUpgrade") {
          data.currentTier = u.currentTier;
          data.multiplier = u.multiplier;
          if (u.bonus !== undefined) data.bonus = u.bonus;
          if (u.chance !== undefined) data.chance = u.chance;
        }
        return data;
      }),
      stats: this.stats,
      achievements: this.achievementManager.getSaveData(),
      prestige: this.prestige.getSaveData(),
      tutorial: this.tutorial.getSaveData(),
      settings: this.settings,
      lastSavedTime: Date.now(),
      saveVersion: 4,
    };
    const jsonStr = JSON.stringify(saveData);
    encryptSave(jsonStr).then(encrypted => {
      localStorage.setItem("cookieClickerSave", encrypted);
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

    this.cookies = parseFloat(data.cookies || 0);
    this.cookiesPerClick = 1;
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

    // Load stats
    if (data.stats) {
      this.stats = { ...this.stats, ...data.stats };
    }

    // Load Buildings
    if (data.buildings) {
      const len = Math.min(data.buildings.length, this.buildings.length);
      for (let i = 0; i < len; i++) {
        const savedBuilding = data.buildings[i];
        this.buildings[i].count = savedBuilding.count || 0;
        this.buildings[i].cost = savedBuilding.cost || this.buildings[i].cost;
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
          upgrade.cost = savedUpgrade.cost;
        } else if (upgrade.level > 0 && upgrade.type !== 'tieredUpgrade') {
          // Recalculate cost from definition for leveled non-tiered upgrades
          let c = upgrade.upgrade.cost;
          for (let lv = 1; lv <= upgrade.level; lv++) {
            let cm = lv > upgrade.base_max_level
              ? (upgrade.prestige_cost_multiplier || upgrade.cost_multiplier)
              : upgrade.cost_multiplier;
            if (upgrade.accel_start && upgrade.cost_acceleration && lv >= upgrade.accel_start) {
              const extra = lv - upgrade.accel_start + 1;
              cm *= Math.pow(upgrade.cost_acceleration, extra);
            }
            c = Math.floor(c * cm);
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

    // Apply heavenly upgrade effects (e.g. Cosmic Grandma)
    this.prestige.applyAllEffects();

    // Restore exact saved values after reapply
    this.cookiesPerClick = parseFloat(data.cookiesPerClick || 1);
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

        const baseCps = this.getEffectiveCPS();
        const offlineEarnings = elapsedTime * baseCps * offlineMultiplier;
        this.cookies += offlineEarnings;
        this.stats.totalCookiesBaked += offlineEarnings;
        this.cookies = parseFloat(this.cookies.toFixed(1));

        if (offlineEarnings > 0) {
          if (this.visualEffects) this.visualEffects.triggerIncomeRain(offlineEarnings);
          if (this.tutorial) {
            this.tutorial.showOfflineEarnings({
              elapsedSec: elapsedTime,
              baseCps,
              offlineMultiplier,
              totalEarned: parseFloat(offlineEarnings.toFixed(1)),
              formatFn: formatNumberInWords,
            });
          }
        }
      }
    }

    this.calculateCPS();
    this.updateCookieCount();
  }
}