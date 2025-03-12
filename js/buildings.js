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

    let progressBarContainer = document.createElement("div");
    progressBarContainer.classList.add("building-progress");

    let progressBar = document.createElement("div");
    progressBar.style.width = `${Math.min(this.count * 10, 100)}%`; // Adjusts progress

    progressBarContainer.appendChild(progressBar);

    let button = document.createElement("button");
    button.textContent = `Buy (${this.cost})`;
    button.addEventListener("click", () => {
        this.buy();
        progressBar.style.width = `${Math.min(this.count * 10, 100)}%`;
    });

    div.appendChild(span);
    div.appendChild(progressBarContainer);
    div.appendChild(button);

    return div;
  }
}
