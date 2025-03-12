import { Building } from "./buildings.js";
import { Upgrade } from "./upgrades.js";

export class Game {
  constructor() {
    this.cookies = 0;
    this.cookiesPerClick = 1;
    this.cookiesPerSecond = 0;
    this.upgrades = [
      new Upgrade("+1 per Click", 10, 1, this)
    ];
    this.buildings = [];

    for (let i = 0; i < 10; i++) {
      this.buildings.push(new Building(`Auto-Baker ${i + 1}`, 50 * (i + 1), 1 * (i + 1), this));
    }

    this.loadGame();
    this.updateUI();
  }

  start() {
    document.getElementById("cookie-button").addEventListener("click", () => this.clickCookie());
    setInterval(() => {
      this.cookies += this.cookiesPerSecond;
      this.updateUI();
    }, 1000);
    setInterval(() => this.saveGame(), 5000);
  }

  clickCookie() {
    this.cookies += this.cookiesPerClick;
    this.updateUI();
  }

  updateUI() {
    document.getElementById("cookie-count").textContent = this.cookies;
    document.getElementById("cps-count").textContent = this.cookiesPerSecond;

    // Update Upgrades
    let upgradeList = document.getElementById("upgrade-list");
    upgradeList.innerHTML = "";
    this.upgrades.forEach((upgrade, index) => {
      let btn = upgrade.getButton(index);
      upgradeList.appendChild(btn);
    });

    // Update Buildings
    let buildingList = document.getElementById("building-list");
    buildingList.innerHTML = "";
    this.buildings.forEach((building, index) => {
      let div = building.getButton(index);
      buildingList.appendChild(div);
    });
  }

  calculateCPS() {
    this.cookiesPerSecond = this.buildings.reduce((total, b) => total + (b.count * b.cps), 0);
  }

  saveGame() {
    let saveData = {
      cookies: this.cookies,
      cookiesPerClick: this.cookiesPerClick,
      cookiesPerSecond: this.cookiesPerSecond,
      buildings: this.buildings.map(b => ({ count: b.count, cost: b.cost })),
    };
    localStorage.setItem("cookieClickerSave", JSON.stringify(saveData));
  }

  loadGame() {
    let savedGame = localStorage.getItem("cookieClickerSave");
    if (savedGame) {
      let data = JSON.parse(savedGame);
      this.cookies = data.cookies;
      this.cookiesPerClick = data.cookiesPerClick;
      this.cookiesPerSecond = data.cookiesPerSecond;
      this.buildings.forEach((b, i) => {
        b.count = data.buildings[i].count;
        b.cost = data.buildings[i].cost;
      });
    }
  }
}
