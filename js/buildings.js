import { buildings } from "./gameData.js";

export class Building {
  constructor(index, game) {
    this.game = game; // Store game instance
    this.building = buildings[index];
    this.name = this.building.name
    this.cost = this.building.cost;
    this.cps = this.building.cps;
    this.count = 0;
  }

  buy() {
    if (this.game.cookies >= this.cost) {
      this.game.cookies -= this.cost;
      this.game.cookies = parseFloat(this.game.cookies.toFixed(1));
      this.count++;
      this.cost = Math.floor(this.cost * 1.15);
      
      document.getElementById("cookie-count").textContent = this.game.cookies;
      document.getElementById("cps-count").textContent = this.game.calculateCPS(); // Only update CPS
    }
  }  

  getButton(index) {
    let div = document.createElement("div");
    div.classList.add("building");

    let span = document.createElement("span");
    span.textContent = `${this.name} (x${this.count}) - ${this.cps} CPS`;

    let button = document.createElement("button");
    button.textContent = `Buy (${this.cost})`;
    button.addEventListener("click", () => {
      this.buy();
    });

    div.appendChild(span);
    div.appendChild(button);

    return div;
  }
}
