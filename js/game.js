import { Building } from "./buildings.js";
import { Upgrade } from "./upgrades.js";
import { AchievementManager } from "./achievements.js";
import { PrestigeManager } from "./prestige.js";
import { buildings, upgrades } from "./gameData.js";
import { formatNumberInWords } from "./utils.js";

export class Game {
  constructor() {
    this.cookies = 15;
    this.cookiesPerClick = 1;
    this.cookiesPerSecond = 0;
    this.globalCpsMultiplier = 1;
    this.luckyClickChance = 0;
    this.frenzyDurationMultiplier = 1;
    this._particles = [];
    this._upgradePage = 0;
    this._buildingSort = 'default'; // default, price, cps, efficiency, owned

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
    };

    // Load buildings & upgrades from gameData.js
    this.buildings = buildings.map((_, index) => new Building(index, this));
    this.upgrades = upgrades.map((_, index) => new Upgrade(index, this));

    // Achievement & Prestige systems
    this.achievementManager = new AchievementManager(this);
    this.prestige = new PrestigeManager(this);

    this.purchaseAmount = 1;

    this.loadGame();
    this.updateUI();
  }

  start() {
    document.getElementById("cookie-button").addEventListener("click", (event) => this.clickCookie(event));

    this.createPurchaseAmountButtons();
    this.setupPrestigeButton();
    this.setupUpgradeNav();
    this.setupMenu();
    this.initParticles();

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
    }, 1000);

    // Save every 5 seconds
    setInterval(() => this.saveGame(), 5000);

    // Initial left panel render
    this.updateLeftPanel();
  }

  getEffectiveCPS() {
    let cps = this.cookiesPerSecond * this.globalCpsMultiplier;
    cps *= this.achievementManager.getMultiplier();
    cps *= this.prestige.getPrestigeMultiplier();
    if (this.frenzyActive && this.frenzyType === 'cps') {
      cps *= this.frenzyMultiplier;
    }
    return parseFloat(cps.toFixed(1));
  }

  getEffectiveCPC() {
    let cpc = this.cookiesPerClick;
    cpc *= this.prestige.getPrestigeMultiplier();
    cpc *= this.achievementManager.getMultiplier();
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
    this.stats.totalClicks++;

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
      setTimeout(() => flash.remove(), 300);
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
    if (this.stats.totalClicks % 10 === 0) {
      this.achievementManager.check();
    }
  }

  checkLuckyClick(event) {
    if (this.luckyClickChance <= 0) return;
    
    if (Math.random() < this.luckyClickChance) {
      this.stats.luckyClicks++;
      
      // Random bonus type
      const roll = Math.random();
      if (roll < 0.5) {
        // Lucky: 10 min of CPS (minimum 100 cookies)
        const bonus = Math.max(100, this.getEffectiveCPS() * 600);
        this.cookies += bonus;
        this.stats.totalCookiesBaked += bonus;
        this.createFloatingText(event, `🍀 LUCKY! +${formatNumberInWords(bonus)}`, true);
      } else if (roll < 0.8) {
        // Frenzy: 7x CPS for 30 seconds
        this.startFrenzy('cps', 7, 30);
        this.createFloatingText(event, `🔥 FRENZY! 7x CPS!`, true);
      } else {
        // Click frenzy: 777x clicks for 15 seconds
        this.startFrenzy('click', 777, 15);
        this.createFloatingText(event, `⚡ CLICK FRENZY! 777x!`, true);
      }
    }
  }

  startFrenzy(type, multiplier, durationSec) {
    const duration = durationSec * 1000 * this.frenzyDurationMultiplier;
    this.frenzyActive = true;
    this.frenzyType = type;
    this.frenzyMultiplier = multiplier;
    this.frenzyEndTime = Date.now() + duration;
    this.stats.frenziesTriggered++;
    this.updateFrenzyIndicator();
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
  }

  setBuildingSort(sortKey) {
    this._buildingSort = sortKey;
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === sortKey);
    });
    this._animateBuildings = true;
    this.updateUI();
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
      
      const amounts = [1, 10, 25, 100, 'Max'];
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
  }

  setupUpgradeNav() {
    const prev = document.getElementById("upgrade-prev");
    const next = document.getElementById("upgrade-next");
    if (prev) prev.addEventListener("click", () => {
      if (this._upgradePage > 0) { this._upgradePage--; this._upgradeNavDir = 'left'; this.renderUpgradePage(true); this.updateButtonsState(); }
    });
    if (next) next.addEventListener("click", () => {
      const totalPages = Math.ceil(this.upgrades.length / this.upgradePageSize);
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
    for (let i = 0; i < 15; i++) {
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
    // Big burst: 20 particles with varied sizes and slight gravity
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.6;
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
        gravity: 0.04,
      });
    }
    // Larger "sparkle" particles
    for (let i = 0; i < 6; i++) {
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
        gravity: 0.02,
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
        setTimeout(() => ripple.remove(), 700);
      }, i * 80);
    }
  }

  handlePrestige() {
    const newChips = this.prestige.calculateHeavenlyChipsOnReset();
    if (newChips <= 0) return;

    if (confirm(`Prestige now to earn ${newChips} Heavenly Chips?\n\nYou'll reset all cookies and buildings but keep your Heavenly Chips which give +${newChips}% permanent CPS bonus.\n\nTotal HC after: ${this.prestige.heavenlyChips + newChips}`)) {
      this.prestige.performPrestige();
    }
  }

  resetForPrestige() {
    this.cookies = 15;
    this.cookiesPerClick = 1;
    this.cookiesPerSecond = 0;
    this.globalCpsMultiplier = 1;
    this.luckyClickChance = 0;
    this.frenzyDurationMultiplier = 1;
    this.frenzyActive = false;
    this.frenzyMultiplier = 1;
    this.frenzyEndTime = 0;
    this.frenzyType = null;

    // Reset buildings
    this.buildings = buildings.map((_, index) => new Building(index, this));
    // Reset upgrades
    this.upgrades = upgrades.map((_, index) => new Upgrade(index, this));

    // Reset stats for this run (but keep prestige stats)
    const timesPrestiged = this.stats.timesPrestiged;
    this.stats = {
      totalCookiesBaked: 0,
      totalClicks: 0,
      totalUpgradesPurchased: 0,
      luckyClicks: 0,
      frenziesTriggered: 0,
      timesPrestiged: this.prestige.timesPrestiged,
      startTime: Date.now(),
      handmadeCookies: 0,
    };

    this.saveGame();
    this.updateUI();
    this.updateLeftPanel();
  }
  
  createFloatingText(event, text, isSpecial = false) {
    const floatingText = document.createElement("span");
    floatingText.textContent = text;
    floatingText.classList.add("cookie-text");
    if (isSpecial) floatingText.classList.add("special-text");
  
    floatingText.style.left = `${event.clientX}px`;
    floatingText.style.top = `${event.clientY}px`;
  
    document.body.appendChild(floatingText);
    setTimeout(() => floatingText.remove(), 1500);
  }
  
  showOfflineEarningsText(earnings) {
    const floatingText = document.createElement("span");
    floatingText.textContent = `+${formatNumberInWords(earnings)} cookies while offline!`;
    floatingText.classList.add("cookie-text", "offline-earnings");
    floatingText.style.left = "50%";
    floatingText.style.top = "10%";
    floatingText.style.transform = "translateX(-50%)";
    document.body.appendChild(floatingText);
    setTimeout(() => floatingText.remove(), 3000);
  }

  updateCookieCount() {
    document.getElementById("cookie-count").textContent = formatNumberInWords(this.cookies);
    document.getElementById("cps-count").textContent = formatNumberInWords(this.getEffectiveCPS());
    document.getElementById("cpc-count").textContent = formatNumberInWords(this.getEffectiveCPC());
    
    if (this.purchaseAmount === 'Max') {
      this.renderBuildingList(false);
      this.renderUpgradePage();
      this.updateButtonsState(); 
    } else {
      this.updateButtonsState(); 
    }

    // Update frenzy timer
    if (this.frenzyActive) {
      this.updateFrenzyIndicator();
    }
  }
  
  updateButtonsState() {
    document.querySelectorAll(".upgrade-btn").forEach((button) => {
      const index = parseInt(button.dataset.index, 10);
      const upgrade = this.upgrades[index];
      if (!upgrade) return;
      
      if (upgrade.type === "tieredUpgrade") {
        if (this.cookies < upgrade.cost) {
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
        }
      } else {
        if (this.cookies < upgrade.cost) {
          button.disabled = true;
          button.dataset.disabledReason = "Not Enough Cookies";
        } else if (upgrade.level >= upgrade.max_level) {
          button.disabled = true;
          button.dataset.disabledReason = `Max Level: ${upgrade.max_level}`;
        } else {
          button.disabled = false;
          delete button.dataset.disabledReason;
        }
      }
    });
  
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
  get upgradePageSize() { return 9; } // 3 cols x 3 rows per page

  renderUpgradePage(animated = false) {
    if (this._upgradePage === undefined) this._upgradePage = 0;
    const pageSize = this.upgradePageSize;
    const totalPages = Math.max(1, Math.ceil(this.upgrades.length / pageSize));
    if (this._upgradePage >= totalPages) this._upgradePage = totalPages - 1;

    const start = this._upgradePage * pageSize;
    const pageUpgrades = this.upgrades.slice(start, start + pageSize);

    const list = document.getElementById("upgrade-list");

    const populate = () => {
      list.innerHTML = "";
      pageUpgrades.forEach((upgrade, i) => {
        const btn = upgrade.getButton(start + i);
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

  calculateCPS() {
    // Base CPS from buildings
    let baseCps = this.buildings.reduce((acc, b) => acc + b.count * b.cps, 0);

    // Add synergy bonuses
    this.upgrades.forEach(upgrade => {
      if (upgrade.type === "synergy" && upgrade.level > 0) {
        const sourceBuilding = this.buildings.find(b => b.name === upgrade.source);
        const targetBuilding = this.buildings.find(b => b.name === upgrade.target);
        if (sourceBuilding && targetBuilding) {
          // Each level multiplies the bonus
          const synergyBonus = sourceBuilding.count * upgrade.bonus * upgrade.level;
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
      const barPct = (v) => Math.min(100, ((v - 1) / 4) * 100).toFixed(0);

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
      prestEl.innerHTML = `
        <div class="prestige-chips">
          <span class="chip-icon">💎</span>
          <span class="chip-count">${formatNumberInWords(this.prestige.heavenlyChips)}</span>
        </div>
        <div class="prestige-row"><span>Ascended</span><span>${this.prestige.timesPrestiged}x</span></div>
        <div class="prestige-row"><span>On reset</span><span>+${formatNumberInWords(potentialChips)}</span></div>
      `;
      
      const btn = document.getElementById("prestige-btn");
      if (btn) {
        btn.disabled = !this.prestige.canPrestige();
        if (this.prestige.canPrestige()) {
          btn.textContent = `Ascend (+${formatNumberInWords(potentialChips)} HC)`;
        } else {
          btn.textContent = `Ascend (need more cookies)`;
        }
      }
    }

    // Frenzy indicator
    this.updateFrenzyIndicator();
  }

  // === Save / Load ===
  saveGame() {
    let saveData = {
      cookies: this.cookies,
      cookiesPerClick: this.cookiesPerClick,
      globalCpsMultiplier: this.globalCpsMultiplier,
      luckyClickChance: this.luckyClickChance,
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
        }
        return data;
      }),
      stats: this.stats,
      achievements: this.achievementManager.getSaveData(),
      prestige: this.prestige.getSaveData(),
      lastSavedTime: Date.now(),
    };
    localStorage.setItem("cookieClickerSave", JSON.stringify(saveData));
  }

  loadGame() {
    let savedGame = localStorage.getItem("cookieClickerSave");
    if (savedGame) {
      let data = JSON.parse(savedGame);
      
      this.cookies = parseFloat(data.cookies || 0);
      this.cookiesPerClick = 1;
      this.globalCpsMultiplier = 1;
      this.luckyClickChance = 0;
      this.frenzyDurationMultiplier = 1;

      // Load prestige first (affects multipliers)
      this.prestige.loadSaveData(data.prestige);

      // Load achievements
      this.achievementManager.loadSaveData(data.achievements);

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
          upgrade.cost = savedUpgrade.cost || upgrade.cost;
          
          if (upgrade.type === "tieredUpgrade" && upgrade.tiers) {
            upgrade.currentTier = savedUpgrade.currentTier || 0;
            upgrade.updateTierProperties();
            upgrade.multiplier = savedUpgrade.multiplier || upgrade.multiplier;
          }
          
          // Re-apply effects
          if (upgrade.level > 0) {
            for (let j = 0; j < upgrade.level; j++) {
              upgrade.applyEffect();
            }
          }
        }
      }
      
      // Restore exact saved values after reapply
      this.cookiesPerClick = parseFloat(data.cookiesPerClick || 1);
      if (data.globalCpsMultiplier) this.globalCpsMultiplier = data.globalCpsMultiplier;
      if (data.luckyClickChance) this.luckyClickChance = data.luckyClickChance;
      if (data.frenzyDurationMultiplier) this.frenzyDurationMultiplier = data.frenzyDurationMultiplier;
      
      // Calculate offline earnings
      if (data.lastSavedTime) {
        const now = Date.now();
        const elapsedTime = Math.floor((now - data.lastSavedTime) / 1000);
        
        if (elapsedTime > 0) {
          this.calculateCPS();
          
          let offlineMultiplier = 0.5;
          this.upgrades.forEach(upgrade => {
            if (upgrade.name && upgrade.name.startsWith("Offline Production") && upgrade.level > 0) {
              offlineMultiplier = upgrade.multiplier;
            }
          });
          
          const offlineEarnings = elapsedTime * this.getEffectiveCPS() * offlineMultiplier;
          this.cookies += offlineEarnings;
          this.stats.totalCookiesBaked += offlineEarnings;
          this.cookies = parseFloat(this.cookies.toFixed(1));
          
          if (offlineEarnings > 0) {
            this.showOfflineEarningsText(offlineEarnings);
          }
        }
      }
      
      this.calculateCPS();
    }
  }
}