import { Building } from "./buildings.js";
import { Upgrade } from "./upgrades.js";
import { buildings, upgrades } from "./gameData.js";

export class Game {
  constructor() {
    this.cookies = 0;
    this.cookiesPerClick = 1;
    this.cookiesPerSecond = 0;

    // Load buildings & upgrades from gameData.js
    this.upgrades = upgrades.map((_, index) => new Upgrade(index, this));
    this.buildings = buildings.map((_, index) => new Building(index, this));

    this.loadGame();
    this.updateUI();
  }

  start() {
    document.getElementById("cookie-button").addEventListener("click", () => this.clickCookie());
  
    setInterval(() => {
      this.cookies += this.cookiesPerSecond;
      this.cookies = parseFloat(this.cookies.toFixed(1));
      document.getElementById("cookie-count").textContent = this.cookies; // Only update cookies
    }, 1000);
  
    setInterval(() => this.saveGame(), 5000);
  }  

  clickCookie() {
    this.cookies += this.cookiesPerClick;
    this.cookies = parseFloat(this.cookies.toFixed(1));
    document.getElementById("cookie-count").textContent = this.cookies;
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

    this.calculateCPS();
  }

  calculateCPS() {
    this.cookiesPerSecond = this.buildings.reduce((total, b) => total + (b.count * b.cps), 0);
    return this.cookiesPerSecond; // Return updated CPS
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
        b.count = data.buildings[i]?.count || 0;
        b.cost = data.buildings[i]?.cost || buildings[i].cost;
      });
    }
  }
}
