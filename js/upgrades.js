export class Upgrade {
  constructor(name, cost, value, game) {
    this.name = name;
    this.cost = cost;
    this.value = value;
    this.game = game;
  }

  buy() {
    if (this.game.cookies >= this.cost) {
      this.game.cookies -= this.cost;
      this.game.cookiesPerClick += this.value;
      this.cost = Math.floor(this.cost * 1.5);
      this.game.updateUI();
    }
  }

  getButton(index) {
    let btn = document.createElement("button");
    btn.classList.add("upgrade-btn");
    btn.innerHTML = `${this.name} (Cost: ${this.cost})`;
    btn.onclick = () => this.buy();
    return btn;
  }
}
