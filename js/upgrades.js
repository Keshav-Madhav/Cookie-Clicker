import { upgrades } from "./gameData.js";

export class Upgrade {
  constructor(index, game) {
    this.game = game;
    this.upgrade = upgrades[index];
    this.name = this.upgrade.name;
    this.cost = this.upgrade.cost;
    this.effect = this.upgrade.effect;
    this.type = this.upgrade.type;
    this.multiplier = this.upgrade.multiplier || 1;
    this.target = this.upgrade.target || null;
    this.source = this.upgrade.source || null;
    this.bonus = this.upgrade.bonus || 0;
    this.chance = this.upgrade.chance || 0;
    this.max_level = this.upgrade.max_level || Infinity;
    this.cost_multiplier = this.upgrade.cost_multiplier || 3;
    this.level = 0;
    
    this.tiers = this.upgrade.tiers || null;
    this.currentTier = 0;
    
    // If this is a tiered upgrade, set initial properties from the first tier
    if (this.type === "tieredUpgrade" && this.tiers) {
      this.updateTierProperties();
    }
  }
  
  updateTierProperties() {
    if (!this.tiers || this.currentTier >= this.tiers.length) return;
    const tier = this.tiers[this.currentTier] || this.tiers[this.tiers.length - 1]; 
    this.name = tier.name;
    this.effect = tier.effect;
    this.multiplier = tier.multiplier;
    this.cost = tier.cost;
  }
  
  canUpgradeTier() {
    if (!this.tiers || this.currentTier >= this.tiers.length - 1) return false;
    const nextTier = this.tiers[this.currentTier + 1];
    const totalBuildings = this.game.getTotalBuildingCount();
    return totalBuildings >= nextTier.buildingsRequired;
  }
  
  upgradeTier() {
    if (!this.canUpgradeTier()) return false;
    this.currentTier++;
    this.updateTierProperties();
    this.applyEffect();
    return true;
  }

  buy() {
    if (this.game.cookies >= this.cost) {
      if (this.type === "tieredUpgrade") {
        if (this.level === 0) {
          this.game.cookies -= this.cost;
          this.level = 1;
          this.applyEffect();
          this.game.stats.totalUpgradesPurchased++;
          this.game.updateUI();
          return true;
        } else if (this.canUpgradeTier()) {
          this.game.cookies -= this.cost;
          this.upgradeTier();
          this.applyEffect();
          this.game.stats.totalUpgradesPurchased++;
          this.game.updateUI();
          return true;
        }
        return false;
      } else {
        if (this.max_level > this.level) {
          this.game.cookies -= this.cost;
          this.level += 1;
          this.applyEffect();
          this.cost = Math.floor(this.cost * this.cost_multiplier);
          this.game.stats.totalUpgradesPurchased++;
          this.game.updateUI();
          return true;
        }
      }
    }
    return false;
  }

  applyEffect() {
    switch (this.type) {
      case "clickMultiplier":
        this.game.cookiesPerClick = parseFloat((this.game.cookiesPerClick * this.multiplier).toFixed(1));
        this.game.buildings.forEach(b => {
          if (b.name === 'Cursor') {
            b.cps = parseFloat((b.cps * this.multiplier).toFixed(1));
          }
        });
        break;

      case "tieredUpgrade":
        if (this.level > 1) {
          const previousTier = this.tiers[this.currentTier - 1];
          this.game.cookiesPerClick /= previousTier.multiplier;
          this.game.cookiesPerClick *= this.multiplier;
        } else {
          this.game.cookiesPerClick = parseFloat((this.game.cookiesPerClick * this.multiplier).toFixed(1));
        }
        break;

      case "buildingBoost":
        if (this.target) {
          this.game.buildings.forEach(b => {
            if (b.name === this.target) {
              b.cps = parseFloat((b.cps * this.multiplier).toFixed(1));
            }
          });
        }
        break;

      case "globalCpsMultiplier":
        this.game.globalCpsMultiplier = parseFloat((this.game.globalCpsMultiplier * this.multiplier).toFixed(4));
        break;

      case "synergy":
        // Synergies are recalculated dynamically in game.calculateCPS()
        // Just mark as purchased; the bonus is applied during CPS calc
        break;

      case "cursorScaling":
        // Cursor scaling is recalculated dynamically in game.calculateCPS()
        break;

      case "luckyChance":
        this.game.luckyClickChance += this.chance;
        break;

      case "frenzyDuration":
        this.game.frenzyDurationMultiplier *= this.bonus;
        break;
    }

    this.game.calculateCPS();
  }

  // Reapply effect from save (without stacking issues)
  reapplyFromSave() {
    for (let i = 0; i < this.level; i++) {
      this.applyEffect();
    }
  }

  getButton(index) {
    let button = document.createElement("button");
    button.classList.add("upgrade-btn");
    button.dataset.index = index;
    
    if (this.type === "tieredUpgrade") {
      if (this.level > 0) {
        button.dataset.tierLevel = String(this.currentTier + 1);
      }
      
      if (this.level === 0) {
        button.textContent = `${this.name}`;
      } else {
        const nextTierIdx = this.currentTier + 1;
        if (nextTierIdx < this.tiers.length) {
          const nextTier = this.tiers[nextTierIdx];
          button.textContent = `Upgrade to ${nextTier.name}`;
        } else {
          button.textContent = `${this.name} (MAX)`;
        }
      }
    } else {
      if (this.level >= this.max_level) {
        button.textContent = `${this.name} (MAX)`;
      } else {
        button.textContent = `${this.name} (Lv ${this.level})`;
      }
    }
    
    button.addEventListener("click", () => this.buy());

    // Disable logic
    if (this.type === "tieredUpgrade") {
      if (this.game.cookies < this.cost) {
        button.disabled = true;
        button.dataset.disabledReason = 'Not Enough Cookies';
      } else if (this.level > 0 && !this.canUpgradeTier()) {
        button.disabled = true;
        if (this.currentTier < this.tiers.length - 1) {
          const nextTier = this.tiers[this.currentTier + 1];
          const totalBuildings = this.game.getTotalBuildingCount();
          button.dataset.disabledReason = `Need ${nextTier.buildingsRequired} buildings (have ${totalBuildings})`;
        } else {
          button.dataset.disabledReason = 'Maximum Tier Reached';
        }
      } else if (this.currentTier >= this.tiers.length - 1 && this.level > 0) {
        button.disabled = true;
        button.dataset.disabledReason = 'Maximum Tier Reached';
      }
    } else {
      if (this.game.cookies < this.cost) {
        button.disabled = true;
        button.dataset.disabledReason = 'Not Enough Cookies';
      } else if (this.max_level <= this.level) {
        button.disabled = true;
        button.dataset.disabledReason = `Max Level: ${this.max_level}`;
      }
    }

    // Tooltip data
    button.dataset.tooltipEffect = this.effect;
    button.dataset.tooltipCost = this.cost;
    
    if (this.type === "tieredUpgrade" && this.level > 0 && this.currentTier < this.tiers.length - 1) {
      const nextTier = this.tiers[this.currentTier + 1];
      const totalBuildings = this.game.getTotalBuildingCount();
      button.dataset.tooltipNextTier = `Next: ${nextTier.name} (${nextTier.effect})`;
      button.dataset.tooltipRequirement = `Requires ${nextTier.buildingsRequired} buildings (have ${totalBuildings})`;
    }
    
    return button;
  }
} 