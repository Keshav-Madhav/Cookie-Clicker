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
    this.one_time = upgrades[index].one_time || false;
    this.is_purchased = false;
  }

  buy() {
    if (this.game.cookies >= this.cost && !this.is_purchased) {
      if (this.one_time) {
        this.is_purchased = true;
      }
      this.game.cookies -= this.cost;
      this.applyEffect();
      this.cost = Math.floor(this.cost * 5);
      this.game.updateUI(); // Refresh UI after buying
    }
  }

  applyEffect() {
    if (this.type === "clickMultiplier") {
      this.game.cookiesPerClick *= this.multiplier;
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

    if (this.is_purchased) {
      button.disabled = true;
      button.textContent += " (Purchased)";
    }

    let tooltip = document.createElement("span");
    tooltip.classList.add("tooltip");
    tooltip.textContent = `${this.effect} (Cost: ${this.cost})`;

    button.appendChild(tooltip);
    return button;
  }
}
