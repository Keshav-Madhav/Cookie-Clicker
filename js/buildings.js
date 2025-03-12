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
      this.game.updateUI(); // Refresh UI after buying
    }
  }  

  getButton(index) {
    let div = document.createElement("div");
    div.addEventListener("click", () => this.buy());
    div.classList.add("building");

    let name_p = document.createElement("p");
    name_p.classList.add("name_p")
    name_p.innerHTML = `${this.name} <span>(${this.cps}/sec)</span>`;

    let price_p = document.createElement("p");
    price_p.classList.add("price_p")
    price_p.textContent = `Cost: ${this.cost}`;

    let subDiv = document.createElement("div");
    subDiv.appendChild(name_p);
    subDiv.appendChild(price_p);
    div.appendChild(subDiv);

    let quantity_p = document.createElement("p");
    quantity_p.classList.add("quantity_p")
    quantity_p.textContent = `${this.count}`;

    div.appendChild(quantity_p);
    return div;
  }
}
