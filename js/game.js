import { Building } from "./buildings.js";
import { Upgrade } from "./upgrades.js";
import { buildings, upgrades } from "./gameData.js";
import { formatNumberInWords } from "./utils.js";

export class Game {
  constructor() {
    this.cookies = 0;
    this.cookiesPerClick = 1;
    this.cookiesPerSecond = 0;

    // Load buildings & upgrades from gameData.js
    this.upgrades = upgrades.map((_, index) => new Upgrade(index, this));
    this.buildings = buildings.map((_, index) => new Building(index, this));

    this.loadGame(); // Load saved game data
    this.updateUI();
  }

  start() {
    document.getElementById("cookie-button").addEventListener("click", (event) => this.clickCookie(event));

    setInterval(() => {
      this.cookies += this.cookiesPerSecond;
      this.cookies = parseFloat(this.cookies.toFixed(1));
      this.updateCookieCount();
    }, 1000);

    setInterval(() => this.saveGame(), 5000);
  }

  clickCookie(event) {
    const clickAmount = this.cookiesPerClick;
    this.cookies += clickAmount;
    this.cookies = parseFloat(this.cookies.toFixed(1));
    this.updateCookieCount();
    
    this.createFloatingText(event, `+${formatNumberInWords(clickAmount)} cookies`);
  }
  
  createFloatingText(event, text) {
    const floatingText = document.createElement("span");
    floatingText.textContent = text;
    floatingText.classList.add("cookie-text");
  
    const cookieButton = document.getElementById("cookie-button");
    const rect = cookieButton.getBoundingClientRect();
  
    // Position the text at the click location relative to the button
    floatingText.style.left = `${event.clientX - rect.left}px`;
    floatingText.style.top = `${event.clientY - rect.top}px`;
  
    cookieButton.appendChild(floatingText);
  
    // Remove the text after animation ends
    setTimeout(() => {
      floatingText.remove();
    }, 1500);
  }  

  updateCookieCount() {
    document.getElementById("cookie-count").textContent = formatNumberInWords(this.cookies);
    document.getElementById("cps-count").textContent = formatNumberInWords(this.cookiesPerSecond);
    document.getElementById("cpc-count").textContent = formatNumberInWords(this.cookiesPerClick);
  }

  updateUI() {
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
    this.updateCookieCount();
  }

  calculateCPS() {
    this.cookiesPerSecond = parseFloat(this.buildings.reduce((acc, b) => acc + b.count * b.cps, 0).toFixed(1));
    return this.cookiesPerSecond;
  }

  saveGame() {
    let saveData = {
      cookies: this.cookies,
      cookiesPerSecond: this.cookiesPerSecond,
      buildings: this.buildings.map(b => ({ count: b.count })),
      upgrades: this.upgrades.map(u => ({ level: u.level }))
    };
    localStorage.setItem("cookieClickerSave", JSON.stringify(saveData));
  }

  loadGame() {
    let savedGame = localStorage.getItem("cookieClickerSave");
    if (savedGame) {
      let data = JSON.parse(savedGame);
      this.cookies = data.cookies || 0;
      this.cookiesPerSecond = data.cookiesPerSecond || 0;

      // Load Buildings
      this.buildings.forEach((b, i) => {
        b.count = data.buildings[i]?.count || 0;
        b.cost = Math.floor(b.cost * Math.pow(1.15, b.count)); // Scale cost based on count
      });

      // Load Upgrades
      this.upgrades.forEach((u, i) => {
        u.level = data.upgrades[i]?.level || 0;
        u.cost = Math.floor(u.cost * Math.pow(3, u.level)); // Scale cost based on level

        // Apply the effect for each level
        for (let j = 0; j < u.level; j++) {
          u.applyEffect();
        }
      });

      this.calculateCPS();
      this.updateUI();
    }
  }
}
