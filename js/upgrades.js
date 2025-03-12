// Update the Upgrade class to use data attributes instead of tooltip spans
import { upgrades } from "./gameData.js";

export class Upgrade {
  constructor(index, game) {
    this.game = game;
    this.upgrade = upgrades[index];
    this.name = this.upgrade.name;
    this.cost = this.upgrade.cost;
    this.effect = this.upgrade.effect;
    this.type = this.upgrade.type;
    this.multiplier = this.upgrade.multiplier || 1;
    this.target = this.upgrade.target || null;
    this.max_level = this.upgrade.max_level || Infinity;
    this.cost_multiplier = this.upgrade.cost_multiplier || 3
    this.level = 0;
  }

  buy() {
    if (this.game.cookies >= this.cost && this.max_level > this.level){
      this.game.cookies -= this.cost;
      this.level += 1;
      this.applyEffect();
      this.cost = Math.floor(this.cost * this.cost_multiplier); // Increase cost for next purchase
      this.game.updateUI()
    }
  }

  applyEffect() {
    if (this.type === "clickMultiplier") {
      this.game.cookiesPerClick = parseFloat((this.game.cookiesPerClick * this.multiplier).toFixed(1));
      this.game.buildings.forEach(b => {
        if(b.name === 'Cursor') {
          b.cps = parseFloat((b.cps*this.multiplier).toFixed(1))
        }
      })
    } else if (this.type === "buildingBoost" && this.target) {
      this.game.buildings.forEach(b => {
        if (b.name === this.target) {
          b.cps = parseFloat((b.cps*this.multiplier).toFixed(1))
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

    if (this.game.cookies < this.cost){
      button.disabled = true;
      button.dataset.disabledReason = 'Not Enough Cookies'
    } else if( this.max_level <= this.level) {
      button.disabled = true;
      button.dataset.disabledReason = `Max Level: ${this.max_level}`
    }

    // Use data attributes for tooltip information
    button.dataset.tooltipEffect = this.effect;
    button.dataset.tooltipCost = this.cost;
    
    return button;
  }
}