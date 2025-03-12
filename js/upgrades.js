// Update the Upgrade class to use data attributes instead of tooltip spans
import { upgrades } from "./gameData.js";

export class Upgrade {
  constructor(index, game) {
    this.game = game;
    this.name = upgrades[index].name;
    this.cost = upgrades[index].cost;
    this.effect = upgrades[index].effect;
    this.type = upgrades[index].type;
    this.multiplier = upgrades[index].multiplier || 1;
    this.target = upgrades[index].target || null;
    this.one_time = upgrades[index].one_time || false;
    this.level = 0;
  }

  buy() {
    if (this.game.cookies >= this.cost && (!this.one_time || this.level === 0)) {
      this.game.cookies -= this.cost;
      this.level += 1;
      this.applyEffect();
      this.cost = Math.floor(this.cost * 3); // Increase cost for next purchase
      this.game.updateUI();
    }
  }

  applyEffect() {
    if (this.type === "clickMultiplier") {
      this.game.cookiesPerClick = parseFloat((this.game.cookiesPerClick * this.multiplier).toFixed(1));
    } else if (this.type === "buildingBoost" && this.target) {
      this.game.buildings.forEach(b => {
        if (b.name === this.target) {
          b.cps *= this.multiplier;
        }
      });
    }
    this.game.calculateCPS(); // Recalculate CPS after applying an upgrade
  }

  getButton(index) {
    let button = document.createElement("button");
    button.classList.add("upgrade-btn");
    button.textContent = `${this.name} (Level: ${this.level})`;
    button.addEventListener("click", () => this.buy());

    if (this.one_time && this.level > 0) {
      button.disabled = true;
    }

    // Use data attributes for tooltip information
    button.dataset.tooltipEffect = this.effect;
    button.dataset.tooltipCost = this.cost;
    
    return button;
  }
}