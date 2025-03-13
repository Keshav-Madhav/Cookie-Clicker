import { Building } from "./buildings.js";
import { Upgrade } from "./upgrades.js";
import { buildings, upgrades } from "./gameData.js";
import { formatNumberInWords } from "./utils.js";

export class Game {
  constructor() {
    this.cookies = 15;
    this.cookiesPerClick = 1; // Base value
    this.cookiesPerSecond = 0;

    // Load buildings & upgrades from gameData.js
    this.buildings = buildings.map((_, index) => new Building(index, this));
    this.upgrades = upgrades.map((_, index) => new Upgrade(index, this));

    this.purchaseAmount = 1;

    this.loadGame(); // Load saved game data
    this.updateUI();
  }

  start() {
    document.getElementById("cookie-button").addEventListener("click", (event) => this.clickCookie(event));

    this.createPurchaseAmountButtons();

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

  // Add this method to Game class
  setPurchaseAmount(amount) {
    this.purchaseAmount = amount;
    this.updatePurchaseButtons();
    this.updateUI();
  }

  // Add this method to Game class
  updatePurchaseButtons() {
    const buttons = document.querySelectorAll('.purchase-amount-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.amount === this.purchaseAmount.toString()) {
        btn.classList.add('active');
      }
    });
  }

  createPurchaseAmountButtons() {
    const container = document.getElementById('purchase-amount-container');
    if (!container) {
      const shopDiv = document.getElementById('shop');
      const buildingList = document.getElementById('building-list');
      
      // Create container for purchase amount buttons
      const purchaseContainer = document.createElement('div');
      purchaseContainer.id = 'purchase-amount-container';
      purchaseContainer.classList.add('purchase-amount-container');
      
      // Add a label
      const label = document.createElement('span');
      label.textContent = 'Buy Amount:';
      label.classList.add('purchase-amount-label');
      purchaseContainer.appendChild(label);
      
      // Add buttons
      const amounts = [1, 10, 20, 50, 'Max'];
      amounts.forEach(amount => {
        const btn = document.createElement('button');
        btn.textContent = amount.toString();
        btn.classList.add('purchase-amount-btn');
        btn.dataset.amount = amount;
        
        if ((amount === 1 && this.purchaseAmount === 1) || 
            (amount === 'Max' && this.purchaseAmount === 'Max') ||
            (amount === this.purchaseAmount)) {
          btn.classList.add('active');
        }
        
        btn.addEventListener('click', () => {
          this.setPurchaseAmount(amount);
        });
        
        purchaseContainer.appendChild(btn);
      });
      
      // Insert after the "Auto-Bakers" heading and before the building list
      shopDiv.insertBefore(purchaseContainer, buildingList);
    }
  }
  
  createFloatingText(event, text) {
    const floatingText = document.createElement("span");
    floatingText.textContent = text;
    floatingText.classList.add("cookie-text");
  
    // Position the text relative to the window
    floatingText.style.left = `${event.clientX}px`;
    floatingText.style.top = `${event.clientY}px`;
  
    document.body.appendChild(floatingText);
  
    // Remove the text after animation ends
    setTimeout(() => {
      floatingText.remove();
    }, 1500);
  }
  
  showOfflineEarningsText(earnings) {
    const floatingText = document.createElement("span");
    floatingText.textContent = `+${formatNumberInWords(earnings)} cookies while offline!`;
    floatingText.classList.add("cookie-text", "offline-earnings");
  
    // Position it at the top center of the screen
    floatingText.style.left = "50%";
    floatingText.style.top = "10%";
    floatingText.style.transform = "translateX(-50%)";
  
    document.body.appendChild(floatingText);
  
    // Remove after 3 seconds
    setTimeout(() => {
      floatingText.remove();
    }, 3000);
  }
  

  updateCookieCount() {
    document.getElementById("cookie-count").textContent = formatNumberInWords(this.cookies);
    document.getElementById("cps-count").textContent = formatNumberInWords(this.cookiesPerSecond);
    document.getElementById("cpc-count").textContent = formatNumberInWords(this.cookiesPerClick);
    
    if(this.purchaseAmount === 'Max'){
      let buildingList = document.getElementById("building-list");
      buildingList.innerHTML = "";
      this.buildings.forEach((building, index) => {
        let div = building.getButton(index);
        buildingList.appendChild(div);
      });
    } else {
      this.updateButtonsState(); 
    }
  }
  
  updateButtonsState() {
    // Update Upgrades
    document.querySelectorAll(".upgrade-btn").forEach((button, index) => {
      const upgrade = this.upgrades[index];
      
      if (upgrade.type === "tieredUpgrade") {
        if (this.cookies < upgrade.cost) {
          button.disabled = true;
          button.dataset.disabledReason = "Not Enough Cookies";
        } else if (upgrade.level > 0 && !upgrade.canUpgradeTier()) {
          button.disabled = true;
          
          // Show buildings required for next tier
          if (upgrade.currentTier < upgrade.tiers.length - 1) {
            const nextTier = upgrade.tiers[upgrade.currentTier + 1];
            const totalBuildings = this.getTotalBuildingCount();
            button.dataset.disabledReason = `Need ${nextTier.buildingsRequired} buildings (have ${totalBuildings})`;
          } else {
            button.dataset.disabledReason = 'Maximum Tier Reached';
          }
        } else if (upgrade.currentTier >= upgrade.tiers.length - 1 && upgrade.level > 0) {
          button.disabled = true;
          button.dataset.disabledReason = 'Maximum Tier Reached';
        } else {
          button.disabled = false;
          delete button.dataset.disabledReason;
        }
      } else {
        // Regular upgrades
        if (this.cookies < upgrade.cost) {
          button.disabled = true;
          button.dataset.disabledReason = "Not Enough Cookies";
        } else if (upgrade.level >= upgrade.max_level) {
          button.disabled = true;
          button.dataset.disabledReason = `Max Level: ${upgrade.max_level}`;
        } else {
          button.disabled = false;
          delete button.dataset.disabledReason;
        }
      }
    });
  
    // Update Buildings - Now with bulk purchase cost check
    document.querySelectorAll(".building").forEach((button, index) => {
      const building = this.buildings[index];
      const purchaseAmount = this.purchaseAmount;
      
      if (purchaseAmount === 'Max') {
        // For 'Max', disable if we can't buy even one
        button.disabled = this.cookies < building.cost;
      } else {
        // For bulk purchase, calculate the total cost for the amount
        let totalCost = 0;
        const currentCount = building.count;
        
        for (let i = 0; i < purchaseAmount; i++) {
          const cost = Math.floor(building.baseCost * Math.pow(building.cost_multiplier, currentCount + i));
          totalCost += cost;
        }
        
        button.disabled = this.cookies < totalCost;
      }
    });
  }
  
  updateTierProgressIndicators() {
    document.querySelectorAll('.upgrade-btn[data-tooltip-requirement]').forEach(button => {
      const requirementText = button.dataset.tooltipRequirement;
      if (requirementText) {
        const matches = requirementText.match(/Requires (\d+) buildings \(have (\d+)\)/);
        if (matches && matches.length === 3) {
          const required = parseInt(matches[1]);
          const current = parseInt(matches[2]);
          const progress = Math.min(100, Math.floor((current / required) * 100));
          button.style.setProperty('--progress-width', `${progress}%`);
        }
      }
    });
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
    this.updateTierProgressIndicators();
  }

  calculateCPS() {
    this.cookiesPerSecond = parseFloat(this.buildings.reduce((acc, b) => acc + b.count * b.cps, 0).toFixed(1));
    return this.cookiesPerSecond;
  }

  getTotalBuildingCount() {
    return this.buildings.reduce((total, building) => total + building.count, 0);
  }

  saveGame() {
    let saveData = {
      cookies: this.cookies,
      cookiesPerClick: this.cookiesPerClick,
      // Save each building with its current properties
      buildings: this.buildings.map(b => ({
        count: b.count,
        cost: b.cost,
      })),
      // Save each upgrade with its current properties
      upgrades: this.upgrades.map(u => {
        if (u.type === "tieredUpgrade") {
          return { 
            level: u.level,
            currentTier: u.currentTier,
            cost: u.cost,
            multiplier: u.multiplier
          };
        }
        return { 
          level: u.level,
          cost: u.cost
        };
      }),
      lastSavedTime: Date.now() // Store current timestamp
    };
    localStorage.setItem("cookieClickerSave", JSON.stringify(saveData));
  }

  loadGame() {
    let savedGame = localStorage.getItem("cookieClickerSave");
    if (savedGame) {
      let data = JSON.parse(savedGame);
      
      // First, load basic game state
      this.cookies = parseFloat(data.cookies || 0);
      
      // Reset to base values before applying upgrades
      this.cookiesPerClick = 1;
      
      // Load Buildings with their saved properties
      if (data.buildings && data.buildings.length === this.buildings.length) {
        this.buildings.forEach((building, index) => {
          const savedBuilding = data.buildings[index];
          building.count = savedBuilding.count || 0;
          building.cost = savedBuilding.cost || building.cost;
        });
      }
      
      // Load Upgrades with their saved properties
      if (data.upgrades && data.upgrades.length === this.upgrades.length) {
        this.upgrades.forEach((upgrade, index) => {
          const savedUpgrade = data.upgrades[index];
          upgrade.level = savedUpgrade.level || 0;
          upgrade.cost = savedUpgrade.cost || upgrade.cost;
          
          // Handle tiered upgrades
          if (upgrade.type === "tieredUpgrade" && upgrade.tiers) {
            upgrade.currentTier = savedUpgrade.currentTier || 0;
            upgrade.updateTierProperties();
            upgrade.multiplier = savedUpgrade.multiplier || upgrade.multiplier;
          }
          
          // Apply each upgrade's effect
          if (upgrade.level > 0) {
            for (let i = 0; i < upgrade.level; i++) {
              upgrade.applyEffect();
            }
          }
        });
      }
      
      // After loading both buildings and upgrades, set the cookiesPerClick from saved value
      // This ensures we maintain the exact value from the saved game
      this.cookiesPerClick = parseFloat(data.cookiesPerClick || 1);
      
      // Calculate offline earnings
      if (data.lastSavedTime) {
        const now = Date.now();
        const elapsedTime = Math.floor((now - data.lastSavedTime) / 1000); // Convert ms to seconds
        
        // Only calculate offline earnings if reasonable time has passed
        if (elapsedTime > 0) {
          this.calculateCPS(); // Ensure CPS is calculated before offline earnings
          
          // Apply offline multiplier if the player has purchased the upgrade
          let offlineMultiplier = 0.5;
          this.upgrades.forEach(upgrade => {
            if (upgrade.name === "Offline Production" && upgrade.level > 0) {
              offlineMultiplier = upgrade.multiplier;
            }
          });
          
          const offlineEarnings = elapsedTime * this.cookiesPerSecond * offlineMultiplier;
          this.cookies += offlineEarnings;
          this.cookies = parseFloat(this.cookies.toFixed(1));
          
          // Show notification about offline earnings when game loads
          console.log(`Offline earnings: ${offlineEarnings} cookies (${elapsedTime} seconds offline)`);
          
          if(offlineEarnings > 0) {
            this.showOfflineEarningsText(offlineEarnings);
          }
        }
      }
      
      this.calculateCPS();
    }
  }
}