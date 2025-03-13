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
  
  // Update properties based on current tier
  updateTierProperties() {
    if (!this.tiers || this.currentTier >= this.tiers.length) return;
    
    const tier = this.tiers[this.currentTier];
    this.name = tier.name;
    this.effect = tier.effect;
    this.multiplier = tier.multiplier;
    this.cost = tier.cost;
  }
  
  // Check if next tier is available
  canUpgradeTier() {
    if (!this.tiers || this.currentTier >= this.tiers.length - 1) return false;
    
    const nextTier = this.tiers[this.currentTier + 1];
    const totalBuildings = this.game.getTotalBuildingCount();
    
    return totalBuildings >= nextTier.buildingsRequired;
  }
  
  // Attempt to upgrade to next tier
  upgradeTier() {
    if (!this.canUpgradeTier()) return false;
    
    this.currentTier++;
    this.updateTierProperties();
    return true;
  }

  buy() {
    if (this.game.cookies >= this.cost) {
      if (this.type === "tieredUpgrade") {
        // For tiered upgrades, we check if this is an initial purchase or tier upgrade
        if (this.level === 0) {
          // First purchase
          this.game.cookies -= this.cost;
          this.level = 1;
          this.applyEffect();
          this.game.updateUI();
          return true;
        } else if (this.canUpgradeTier()) {
          // Upgrade to next tier
          this.game.cookies -= this.cost;
          this.upgradeTier();
          this.applyEffect();
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
          this.game.updateUI();
          return true;
        }
      }
    }
    return false;
  }

  applyEffect() {
    if (this.type === "clickMultiplier" || this.type === "tieredUpgrade") {
      // This prevents multiplier stacking when upgrading tiers
      if (this.type === "tieredUpgrade" && this.level > 1) {
        // For tier upgrades after first purchase, we reset and apply new multiplier
        const previousTier = this.tiers[this.currentTier - 1];
        this.game.cookiesPerClick /= previousTier.multiplier;
        this.game.cookiesPerClick *= this.multiplier;
      } else {
        // First purchase or regular click multiplier
        this.game.cookiesPerClick = parseFloat((this.game.cookiesPerClick * this.multiplier).toFixed(1));
      }
      
      // Apply to cursors as well
      this.game.buildings.forEach(b => {
        if(b.name === 'Cursor') {
          if (this.type === "tieredUpgrade" && this.level > 1) {
            const previousTier = this.tiers[this.currentTier - 1];
            b.cps /= previousTier.multiplier;
            b.cps *= this.multiplier;
          } else {
            b.cps = parseFloat((b.cps * this.multiplier).toFixed(1));
          }
        }
      });
    } else if (this.type === "buildingBoost" && this.target) {
      this.game.buildings.forEach(b => {
        if (b.name === this.target) {
          b.cps = parseFloat((b.cps * this.multiplier).toFixed(1));
        }
      });
    }
    this.game.calculateCPS(); // Recalculate CPS after applying an upgrade
  }

  getButton(index) {
    let button = document.createElement("button");
    button.classList.add("upgrade-btn");
    
    // For tiered upgrades, show different text
    if (this.type === "tieredUpgrade") {
      // Set the tier level as a data attribute for CSS styling
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
      // Regular upgrades display as before
      button.textContent = `${this.name} (Level: ${this.level})`;
    }
    
    button.addEventListener("click", () => this.buy());

    // Handle button state for tiered upgrades
    if (this.type === "tieredUpgrade") {
      if (this.game.cookies < this.cost) {
        button.disabled = true;
        button.dataset.disabledReason = 'Not Enough Cookies';
      } else if (this.level > 0 && !this.canUpgradeTier()) {
        button.disabled = true;
        
        // Show buildings required for next tier
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
      // Regular upgrade handling
      if (this.game.cookies < this.cost) {
        button.disabled = true;
        button.dataset.disabledReason = 'Not Enough Cookies';
      } else if (this.max_level <= this.level) {
        button.disabled = true;
        button.dataset.disabledReason = `Max Level: ${this.max_level}`;
      }
    }

    // Tooltip for tiered upgrades shows current and next tier info
    if (this.type === "tieredUpgrade") {
      button.dataset.tooltipEffect = this.effect;
      button.dataset.tooltipCost = this.cost;
      
      if (this.level > 0 && this.currentTier < this.tiers.length - 1) {
        const nextTier = this.tiers[this.currentTier + 1];
        const totalBuildings = this.game.getTotalBuildingCount();
        button.dataset.tooltipNextTier = `Next: ${nextTier.name} (${nextTier.effect})`;
        button.dataset.tooltipRequirement = `Requires ${nextTier.buildingsRequired} buildings (have ${totalBuildings})`;
      }
    } else {
      // Regular tooltip
      button.dataset.tooltipEffect = this.effect;
      button.dataset.tooltipCost = this.cost;
    }
    
    return button;
  }
} 