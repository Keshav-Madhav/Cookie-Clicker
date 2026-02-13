import { buildings } from "./gameData.js";
import { formatNumberInWords } from "./utils.js";

export class Building {
  constructor(index, game) {
    this.game = game; // Store game instance
    this.building = buildings[index];
    this.name = this.building.name;
    this.baseCost = this.building.cost; // Store original cost for calculations
    this.baseCps = this.building.cps;   // Store original CPS for calculations
    this.cost = this.building.cost;
    this.cps = this.building.cps;
    this.cost_multiplier = this.building.cost_multiplier || 1.15;
    this.requires = this.building.requires || null;
    this.desc = this.building.desc || '';
    this.flavor = this.building.flavor || '';
    this.lore = this.building.lore || '';
    this.count = 0;
  }

  /** Check a single requirement condition */
  _checkCondition(cond) {
    switch (cond.type) {
      case "totalBuildings":
        return this.game.getTotalBuildingCount() >= cond.min;
      case "cps":
        return this.game.cookiesPerSecond >= cond.min;
      case "totalCookies":
        return this.game.stats.totalCookiesBaked >= cond.min;
      default:
        return true;
    }
  }

  /** Check if all special requirements are met */
  meetsRequirements() {
    if (!this.requires) return true;
    const conditions = Array.isArray(this.requires) ? this.requires : [this.requires];
    return conditions.every(c => this._checkCondition(c));
  }

  /** Get human-readable text for unmet requirements */
  getRequirementText() {
    if (!this.requires) return '';
    const conditions = Array.isArray(this.requires) ? this.requires : [this.requires];
    const unmet = conditions.filter(c => !this._checkCondition(c));
    return unmet.map(cond => {
      switch (cond.type) {
        case "totalBuildings":
          return `Need ${cond.min} total bakers (have ${this.game.getTotalBuildingCount()})`;
        case "cps":
          return `Need ${formatNumberInWords(cond.min)} CPS`;
        case "totalCookies":
          return `Need ${formatNumberInWords(cond.min)} total cookies baked`;
        default:
          return 'Unknown requirement';
      }
    }).join(' • ');
  }

  buy() {
    if (!this.meetsRequirements()) return false;
    const amount = this.game.purchaseAmount;
    
    if (amount === 'Max') {
      const result = this.buyMax();
      // Easter egg: efficient buyer (used Max purchase)
      if (result && this.game.tutorial) {
        this.game.tutorial.triggerEvent('efficientBuyer');
      }
      return result;
    } else {
      const result = this.bulkBuy(amount);
      // Track bulk buying for achievement
      if (result && amount >= 100) {
        this.game.stats.bulkBuyerTriggered = true;
      }
      return result;
    }
  }
  
  // Calculate cost for buying a specific amount of buildings
  calculateBulkCost(amount) {
    let totalCost = 0;
    const currentCount = this.count;
    
    for (let i = 0; i < amount; i++) {
      const cost = Math.floor(this.baseCost * Math.pow(this.cost_multiplier, currentCount + i));
      totalCost += cost;
    }
    
    return totalCost;
  }
  
  // Calculate how many buildings can be bought with current cookies
  calculateMaxBuyable() {
    let count = 0;
    let tempCost = this.cost;
    let tempCookies = this.game.cookies;
    
    while (tempCookies >= tempCost) {
      tempCookies -= tempCost;
      count++;
      tempCost = Math.floor(this.baseCost * Math.pow(this.cost_multiplier, this.count + count));
    }
    
    return count;
  }
  
  // Add these methods to Building class
  bulkBuy(amount) {
    // Calculate total cost for buying 'amount' buildings
    const totalCost = this.calculateBulkCost(amount);
    
    // Check if player has enough cookies
    if (this.game.cookies >= totalCost) {
      this.game.cookies -= totalCost;
      this.game.cookies = parseFloat(this.game.cookies.toFixed(1));
      this.count += parseInt(amount);
      this.cost = Math.floor(this.baseCost * Math.pow(this.cost_multiplier, this.count));
      this.game.calculateCPS();
      this.game.updateUI();

      // Cookie rain burst on building purchase (scales with amount bought)
      if (this.game.visualEffects) {
        const burstCount = Math.min(30, 5 + parseInt(amount) * 2);
        this.game.visualEffects.triggerCookieBurst(burstCount, 2);
      }



      return true;
    }
    return false;
  }
  
  buyMax() {
    // Calculate how many buildings can be bought with current cookies
    const maxBuyable = this.calculateMaxBuyable();
    
    if (maxBuyable > 0) {
      return this.bulkBuy(maxBuyable);
    }
    return false;
  }

  // Reset CPS to base value (for when loading game)
  resetCps() {
    this.cps = this.baseCps;
  }
  
  // Calculate cost based on count
  recalculateCost() {
    this.cost = Math.floor(this.baseCost * Math.pow(this.cost_multiplier, this.count));
  }  

  /** How close the player is to meeting requirements (0..1) */
  getProgressRatio() {
    if (!this.requires) return 1;
    const conditions = Array.isArray(this.requires) ? this.requires : [this.requires];
    let total = 0;
    for (const c of conditions) {
      let current = 0, target = c.min;
      switch (c.type) {
        case "totalBuildings": current = this.game.getTotalBuildingCount(); break;
        case "cps":            current = this.game.cookiesPerSecond; break;
        case "totalCookies":   current = this.game.stats.totalCookiesBaked; break;
        default:               current = target; break;
      }
      total += Math.min(current / target, 1);
    }
    return total / conditions.length;
  }

  /** Scramble text into gibberish of similar length */
  _scrambleText(text) {
    const words = 'cookie bake flour sugar dough crumb oven whisk butter chip sprinkle glaze frost cream choco vanilla swirl batch knead rise fold drizzle caramel toffee syrup crust flaky golden crisp warm gooey melted sweet tooth crunch snap nibble morsel taste treat yummy delight'.split(' ');
    return text.replace(/[a-zA-Z]+/g, (match) => {
      const w = words[Math.floor(Math.random() * words.length)];
      let result = w;
      while (result.length < match.length) result += words[Math.floor(Math.random() * words.length)];
      result = result.slice(0, match.length);
      if (match[0] === match[0].toUpperCase()) result = result[0].toUpperCase() + result.slice(1);
      return result;
    });
  }

  /** Get total cookies spent on this building */
  getNetCost() {
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      total += Math.floor(this.baseCost * Math.pow(this.cost_multiplier, i));
    }
    return total;
  }

  /** Find upgrades related to this building */
  getRelatedUpgrades() {
    if (!this.game.upgrades) return [];
    return this.game.upgrades.filter(u => {
      if (u.target === this.name || u.source === this.name) return true;
      // Building-specific requirement
      if (u.requires) {
        const conds = Array.isArray(u.requires) ? u.requires : [u.requires];
        return conds.some(c => c.type === 'building' && c.name === this.name);
      }
      return false;
    });
  }

  /** Show the building info detail panel */
  showInfoPanel(index) {
    // Remove existing panel if any
    const existing = document.getElementById('building-info-panel');
    if (existing) existing.remove();

    const locked = !this.meetsRequirements() && this.count === 0;
    const overlay = document.createElement('div');
    overlay.id = 'building-info-panel';
    overlay.className = 'building-info-overlay';

    const panel = document.createElement('div');
    panel.className = 'building-info-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'building-info-header';
    header.innerHTML = `<h2>${this.name}</h2><button class="building-info-close">✕</button>`;
    panel.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'building-info-body';

    // Lore / Story
    if (this.lore) {
      const loreSection = document.createElement('div');
      loreSection.className = 'building-info-section';
      if (locked) {
        // Scramble text to gibberish so inspect won't reveal it
        const gibberish = this._scrambleText(this.lore);
        loreSection.innerHTML = `<h3>📖 Story</h3><p class="building-info-lore">${this.flavor}</p><div class="building-info-story-locked"><p class="building-info-story building-info-blurred">${gibberish}</p><div class="building-info-unlock-overlay">🔒 Unlock this baker to read</div></div>`;
      } else {
        loreSection.innerHTML = `<h3>📖 Story</h3><p class="building-info-lore">${this.flavor}</p><p class="building-info-story">${this.lore}</p>`;
      }
      body.appendChild(loreSection);
    }

    // Stats
    const statsSection = document.createElement('div');
    statsSection.className = 'building-info-section';
    statsSection.innerHTML = `<h3>📊 Details</h3>`;

    const grid = document.createElement('div');
    grid.className = 'building-info-grid';

    const totalCps = parseFloat((this.count * this.cps).toFixed(1));
    const rows = [
      ['Owned', locked ? '🔒' : `${this.count}`],
      ['Base CPS', locked ? '???' : `${this.baseCps}/s`],
      ['Current CPS', locked ? '???' : `${this.cps}/s each`],
      ['Total Generation', locked ? '???' : `${formatNumberInWords(totalCps)}/s`],
      ['Base Cost', `${formatNumberInWords(this.baseCost)}`],
      ['Next Cost', locked ? '???' : `${formatNumberInWords(this.cost)}`],
      ['Total Invested', locked ? '???' : `${formatNumberInWords(this.getNetCost())}`],
    ];

    if (!locked && totalCps > 0) {
      const pct = ((totalCps / Math.max(this.game.cookiesPerSecond, 0.001)) * 100).toFixed(1);
      rows.push(['% of Total CPS', `${pct}%`]);
    }

    rows.forEach(([label, value]) => {
      grid.innerHTML += `<span>${label}</span><span>${value}</span>`;
    });
    statsSection.appendChild(grid);
    body.appendChild(statsSection);

    // Requirements (if any)
    if (this.requires) {
      const reqSection = document.createElement('div');
      reqSection.className = 'building-info-section';
      reqSection.innerHTML = `<h3>🔓 Requirements</h3>`;
      const reqList = document.createElement('div');
      reqList.className = 'building-info-reqs';
      const conditions = Array.isArray(this.requires) ? this.requires : [this.requires];
      conditions.forEach(c => {
        const met = this._checkCondition(c);
        let text = '';
        switch (c.type) {
          case 'totalBuildings': text = `${formatNumberInWords(c.min)} total bakers`; break;
          case 'totalCookies': text = `${formatNumberInWords(c.min)} total cookies baked`; break;
          case 'cps': text = `${formatNumberInWords(c.min)} CPS`; break;
        }
        reqList.innerHTML += `<span class="${met ? 'req-met' : 'req-unmet'}">${met ? '✅' : '❌'} ${text}</span>`;
      });
      reqSection.appendChild(reqList);
      body.appendChild(reqSection);
    }

    // Related upgrades (hidden when locked)
    if (!locked) {
      const related = this.getRelatedUpgrades();
      if (related.length > 0) {
        const upgSection = document.createElement('div');
        upgSection.className = 'building-info-section';
        upgSection.innerHTML = `<h3>⬆️ Related Upgrades</h3>`;
        const upgList = document.createElement('div');
        upgList.className = 'building-info-upgrades';
        related.forEach(u => {
          const owned = u.level > 0;
          const maxed = u.level >= u.getEffectiveMaxLevel();
          let status = '🔲';
          if (maxed) status = '✅';
          else if (owned) status = `⬆ Lv.${u.level}`;
          upgList.innerHTML += `<div class="building-info-upgrade-row"><span>${status} ${u.name}</span><span class="building-info-upgrade-effect">${u.effect}</span></div>`;
        });
        upgSection.appendChild(upgList);
        body.appendChild(upgSection);
      }
    }

    panel.appendChild(body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Close handlers
    const close = () => overlay.remove();
    header.querySelector('.building-info-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  getButton(index) {
    let button = document.createElement("button");
    button.addEventListener("click", () => this.buy());
    button.classList.add("building");
    button.dataset.buildingIndex = index;

    const locked = !this.meetsRequirements() && this.count === 0;

    let name_p = document.createElement("p");
    name_p.classList.add("name_p");

    if (locked) {
      // Always show name, but hide CPS
      name_p.innerHTML = `${this.name} <span>(?/s each)</span>`;
    } else {
      const totalBuildingCps = parseFloat((this.count * this.cps).toFixed(1));
      if (this.count > 0) {
        name_p.innerHTML = `${this.name} <span>(${this.cps}/s each · <strong class="building-total-cps">${formatNumberInWords(totalBuildingCps)}/s</strong>)</span>`;
      } else {
        name_p.innerHTML = `${this.name} <span>(${this.cps}/s each)</span>`;
      }
    }

    // Short description (only visible when unlocked)
    let desc_p = null;
    if (!locked && this.desc) {
      desc_p = document.createElement("p");
      desc_p.classList.add("building-desc");
      desc_p.textContent = this.desc;
    }

    let price_p = document.createElement("p");
    price_p.classList.add("price_p");

    if (locked) {
      button.disabled = true;
      button.classList.add('building-locked');
      price_p.textContent = `🔒 ${this.getRequirementText()}`;
    } else {
      // Calculate price and amount based on purchase amount
      const purchaseAmount = this.game.purchaseAmount;
      let displayCost, displayAmount;
      let canAfford = false;

      if (purchaseAmount === 'Max') {
        const maxBuyable = this.calculateMaxBuyable();
        displayCost = maxBuyable > 0 ? this.calculateBulkCost(maxBuyable) : this.cost;
        displayAmount = maxBuyable > 0 ? maxBuyable : 0;
        price_p.textContent = `Cost: ${formatNumberInWords(displayCost)} (${displayAmount})`;
        canAfford = maxBuyable > 0;
      } else {
        displayCost = this.calculateBulkCost(purchaseAmount);
        price_p.textContent = `Cost: ${formatNumberInWords(displayCost)} (${purchaseAmount})`;
        canAfford = this.game.cookies >= displayCost;
      }
      button.disabled = !canAfford;
    }

    // Store flavor text for tooltip
    if (this.flavor) {
      button.dataset.buildingFlavor = this.flavor;
    }

    let subDiv = document.createElement("div");
    subDiv.classList.add("building-main");
    subDiv.appendChild(name_p);
    if (desc_p) subDiv.appendChild(desc_p);
    subDiv.appendChild(price_p);
    button.appendChild(subDiv);

    // Info icon
    let infoBtn = document.createElement("span");
    infoBtn.className = 'building-info-icon';
    infoBtn.textContent = 'ℹ';
    infoBtn.title = `${this.name} details`;
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.showInfoPanel(index);
    });
    button.appendChild(infoBtn);

    let quantity_p = document.createElement("p");
    quantity_p.classList.add("quantity_p");
    quantity_p.textContent = locked ? `🔒` : `${this.count}`;

    button.appendChild(quantity_p);
    return button;
  }
}