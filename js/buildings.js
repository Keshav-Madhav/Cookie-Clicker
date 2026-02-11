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
    this.count = 0;
  }

  buy() {
    const amount = this.game.purchaseAmount;
    
    if (amount === 'Max') {
      return this.buyMax();
    } else {
      return this.bulkBuy(amount);
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
    button.disabled = !canAfford;

    button.appendChild(quantity_p);
    return button;
  }
}