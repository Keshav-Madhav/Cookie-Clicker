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
      // Easter egg: bulk buyer (bought 100 at once)
      if (result && amount >= 100 && this.game.tutorial) {
        this.game.tutorial.triggerEvent('bulkBuyer');
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

      // Easter eggs: building milestones
      if (this.game.tutorial) {
        if (this.name === "Cursor" && this.count >= 100) {
          this.game.tutorial.triggerEvent('hundredCursors');
        }
        if (this.name === "Grandma" && this.count >= 50) {
          this.game.tutorial.triggerEvent('grandmaArmy');
        }
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

  getButton(index) {
    let button = document.createElement("button");
    button.addEventListener("click", () => this.buy());
    button.classList.add("building");
    button.dataset.buildingIndex = index;

    let name_p = document.createElement("p");
    name_p.classList.add("name_p");
    name_p.innerHTML = `${this.name} <span>(${this.cps}/sec)</span>`;

    let price_p = document.createElement("p");
    price_p.classList.add("price_p");
    
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

    let subDiv = document.createElement("div");
    subDiv.appendChild(name_p);
    subDiv.appendChild(price_p);
    button.appendChild(subDiv);

    let quantity_p = document.createElement("p");
    quantity_p.classList.add("quantity_p");
    quantity_p.textContent = `${this.count}`;

    // FIXED: Ensure the button is disabled if the player can't afford the purchase
    if (!this.meetsRequirements()) {
      button.disabled = true;
      button.classList.add('building-locked');
      price_p.textContent = `🔒 ${this.getRequirementText()}`;
    } else {
      button.disabled = !canAfford;
    }

    button.appendChild(quantity_p);
    return button;
  }
}