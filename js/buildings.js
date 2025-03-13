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
    if (this.game.cookies >= this.cost) {
      this.game.cookies -= this.cost;
      this.game.cookies = parseFloat(this.game.cookies.toFixed(1));
      this.count++;
      this.cost = Math.floor(this.baseCost * Math.pow(this.cost_multiplier, this.count));
      this.game.calculateCPS();
      this.game.updateUI();
      return true;
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

    let name_p = document.createElement("p");
    name_p.classList.add("name_p");
    name_p.innerHTML = `${this.name} <span>(${this.cps}/sec)</span>`;

    let price_p = document.createElement("p");
    price_p.classList.add("price_p");
    price_p.textContent = `Cost: ${formatNumberInWords(this.cost)}`;

    let subDiv = document.createElement("div");
    subDiv.appendChild(name_p);
    subDiv.appendChild(price_p);
    button.appendChild(subDiv);

    let quantity_p = document.createElement("p");
    quantity_p.classList.add("quantity_p");
    quantity_p.textContent = `${this.count}`;

    if(this.cost > this.game.cookies){
      button.disabled = true;
    }

    button.appendChild(quantity_p);
    return button;
  }
}