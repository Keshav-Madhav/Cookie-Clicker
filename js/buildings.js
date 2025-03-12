export class Building {
  constructor(name, cost, cps, game) {
    this.name = name;
    this.cost = cost;
    this.cps = cps;
    this.count = 0;
    this.game = game;
  }

  buy() {
    if (this.game.cookies >= this.cost) {
      this.game.cookies -= this.cost;
      this.count++;
      this.cost = Math.floor(this.cost * 1.3);
      this.game.calculateCPS();
      this.game.updateUI();
    }
  }

  getButton(index) {
    let div = document.createElement("div");
    div.classList.add("building");

    let span = document.createElement("span");
    span.textContent = `${this.name} (x${this.count}) - ${this.cps} CPS`;

    let button = document.createElement("button");
    button.textContent = `Buy (${this.cost})`;
    button.addEventListener("click", () => this.buy()); // ✅ Event listener instead of `onclick`

    div.appendChild(span);
    div.appendChild(button);

    return div;
  }
}
