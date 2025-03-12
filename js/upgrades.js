import { upgrades } from "./gameData.js";

export class Upgrade {
  constructor(index, game) {
    this.game = game; // Store game instance
    this.name = upgrades[index].name;
    this.cost = upgrades[index].cost;
    this.effect = upgrades[index].effect;
    this.type = upgrades[index].type;
    this.multiplier = upgrades[index].multiplier || 1;
    this.target = upgrades[index].target || null;
  }

  buy() {
    if (this.game.cookies >= this.cost) {
      this.game.cookies -= this.cost;
      this.applyEffect();
      this.cost = Math.floor(this.cost * 1.15); // Price increases
      this.game.updateUI(); // Refresh UI after buying
    }
  }

  applyEffect() {
    if (this.type === "clickMultiplier") {
      this.game.cookiesPerClick *= 2;
    } else if (this.type === "buildingBoost" && this.target) {
      this.game.buildings.forEach(b => {
        if (b.name === this.target) {
          b.cps *= this.multiplier;
        }
      });
    }
  }

  getButton(index) {
    let button = document.createElement("button");
    button.classList.add("upgrade-btn");
    button.textContent = this.name;
    button.addEventListener("click", () => this.buy());

    let tooltip = document.createElement("span");
    tooltip.classList.add("tooltip");
    tooltip.textContent = `${this.effect} (Cost: ${this.cost})`;

    button.appendChild(tooltip);
    return button;
  }
}
