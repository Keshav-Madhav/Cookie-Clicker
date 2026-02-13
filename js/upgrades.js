import { upgrades } from "./gameData.js";
import { formatNumberInWords } from "./utils.js";

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
    this.requires = this.upgrade.requires || null;
    this.level = 0;
    this.base_max_level = this.max_level;
    this.prestige_bonus_levels = this.upgrade.prestige_bonus_levels || 0;
    this.prestige_cost_multiplier = this.upgrade.prestige_cost_multiplier || this.cost_multiplier;
    this.accel_start = this.upgrade.accel_start || null;
    this.cost_acceleration = this.upgrade.cost_acceleration || null;

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

  getEffectiveMaxLevel() {
    if (!this.prestige_bonus_levels || !isFinite(this.base_max_level)) return this.base_max_level;
    const prestigeCount = this.game.prestige ? this.game.prestige.timesPrestiged : 0;
    return this.base_max_level + (this.prestige_bonus_levels * prestigeCount);
  }

  /** Check a single requirement condition */
  _checkCondition(cond) {
    switch (cond.type) {
      case "totalBuildings":
        return this.game.getTotalBuildingCount() >= cond.min;
      case "building": {
        const b = this.game.buildings.find(b => b.name === cond.name);
        return b ? b.count >= cond.min : false;
      }
      case "cps":
        return this.game.cookiesPerSecond >= cond.min;
      case "totalCookies":
        return this.game.stats.totalCookiesBaked >= cond.min;
      case "totalClicks":
        return this.game.stats.totalClicks >= cond.min;
      case "achievements":
        return this.game.achievementManager
          ? this.game.achievementManager.getUnlockedCount() >= cond.min
          : false;
      case "prestige":
        return this.game.stats.timesPrestiged >= cond.min;
      case "totalUpgradesPurchased":
        return this.game.stats.totalUpgradesPurchased >= cond.min;
      case "miniGamesWon":
        return Array.isArray(this.game.stats.miniGamesWon) &&
               this.game.stats.miniGamesWon.length >= cond.min;
      default:
        return true;
    }
  }

  /** Check if all requirements are met */
  meetsRequirements() {
    if (!this.requires) return true;
    const conditions = Array.isArray(this.requires) ? this.requires : [this.requires];
    return conditions.every(c => this._checkCondition(c));
  }

  /** Get human-readable unmet requirement text */
  getRequirementText() {
    if (!this.requires) return '';
    const conditions = Array.isArray(this.requires) ? this.requires : [this.requires];
    const unmet = conditions.filter(c => !this._checkCondition(c));
    return unmet.map(cond => {
      switch (cond.type) {
        case "totalBuildings":
          return `Need ${cond.min} total buildings`;
        case "building": {
          const b = this.game.buildings.find(b => b.name === cond.name);
          return `Need ${cond.min} ${cond.name}s (have ${b ? b.count : 0})`;
        }
        case "cps":
          return `Need ${formatNumberInWords(cond.min)} CPS`;
        case "totalCookies":
          return `Need ${formatNumberInWords(cond.min)} total cookies`;
        case "totalClicks":
          return `Need ${cond.min} clicks`;
        case "achievements":
          return `Need ${cond.min} achievements`;
        case "prestige":
          return `Need ${cond.min} prestige`;
        case "totalUpgradesPurchased":
          return `Need ${cond.min} upgrades purchased`;
        case "miniGamesWon":
          return `Need ${cond.min} mini-game type${cond.min > 1 ? 's' : ''} won`;
        default:
          return 'Unknown requirement';
      }
    }).join(' • ');
  }

  buy() {
    if (!this.meetsRequirements()) return false;
    if (this.game.cookies >= this.cost) {
      if (this.type === "tieredUpgrade") {
        if (this.level === 0) {
          this.game.cookies -= this.cost;
          this.level = 1;
          this.applyEffect();
          this.game.stats.totalUpgradesPurchased++;
          this._triggerTutorialEvent();
          // Easter egg: maxed out (single-tier or last tier)
          if (this.currentTier >= this.tiers.length - 1 && this.game.tutorial) {
            this.game.tutorial.triggerEvent('upgradeMaxedOut');
          }
          this.game.scheduleUpgradeSort();
          this.game.updateUI();
          return true;
        } else if (this.canUpgradeTier()) {
          this.game.cookies -= this.cost;
          this.upgradeTier(); // upgradeTier already calls applyEffect
          this.game.stats.totalUpgradesPurchased++;
          this._triggerTutorialEvent();
          // Easter egg: maxed out (reached final tier)
          if (this.currentTier >= this.tiers.length - 1 && this.game.tutorial) {
            this.game.tutorial.triggerEvent('upgradeMaxedOut');
          }
          this.game.scheduleUpgradeSort();
          this.game.updateUI();
          return true;
        }
        return false;
      } else {
        if (this.getEffectiveMaxLevel() > this.level) {
          this.game.cookies -= this.cost;
          this.level += 1;
          this.applyEffect();
          let costMult = this.level > this.base_max_level ? this.prestige_cost_multiplier : this.cost_multiplier;
          // Cost acceleration: each level past accel_start makes the multiplier exponentially larger
          if (this.accel_start && this.cost_acceleration && this.level >= this.accel_start) {
            const extra = this.level - this.accel_start + 1;
            costMult *= Math.pow(this.cost_acceleration, extra);
          }
          this.cost = Math.floor(this.cost * costMult);
          this.game.stats.totalUpgradesPurchased++;
          this._triggerTutorialEvent();
          // Easter egg: maxed out
          if (this.level >= this.getEffectiveMaxLevel() && this.game.tutorial) {
            this.game.tutorial.triggerEvent('upgradeMaxedOut');
          }
          this.game.scheduleUpgradeSort();
          this.game.updateUI();
          return true;
        }
      }
    }
    return false;
  }

  /** Fire a tutorial event based on the upgrade type */
  _triggerTutorialEvent() {
    if (!this.game.tutorial) return;
    const t = this.game.tutorial;
    switch (this.type) {
      case "tieredUpgrade":
        // Check if it's a touch upgrade or offline upgrade by name
        if (this.name && this.name.includes("Touch")) {
          t.triggerEvent('touchUpgrade');
        } else if (this.name && this.name.includes("Offline")) {
          t.triggerEvent('offlineUpgrade');
        }
        break;
      case "globalCpsMultiplier":
        t.triggerEvent('powerMultiplier');
        break;
      case "synergy":
        t.triggerEvent('synergyUpgrade');
        break;
      case "cursorScaling":
        t.triggerEvent('cursorScaling');
        break;
      case "frenzyDuration":
        t.triggerEvent('frenzyDuration');
        break;
    }
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
        // Offline production tiers are looked up by name during load, not click power
        if (this.name && this.name.includes("Offline")) break;
        // Click-related tiers (Touch upgrades) multiply click power
        this.game.cookiesPerClick = parseFloat((this.game.cookiesPerClick * this.multiplier).toFixed(1));
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

      case "cpsClick":
        this.game.cpsClickBonus += this.bonus;
        break;

      case "miniGameBonus":
        this.game.miniGameBonus *= this.multiplier;
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
      const effectiveMax = this.getEffectiveMaxLevel();
      if (this.level >= effectiveMax) {
        button.textContent = this.prestige_bonus_levels > 0
          ? `${this.name} (MAX ✦)`
          : `${this.name} (MAX)`;
      } else if (this.level > this.base_max_level) {
        button.textContent = `${this.name} (Lv ${this.level} ✦)`;
      } else {
        button.textContent = `${this.name} (Lv ${this.level})`;
      }
    }
    
    button.addEventListener("click", () => this.buy());

    // Requirements check — takes highest priority
    if (!this.meetsRequirements()) {
      button.disabled = true;
      button.classList.add('upgrade-locked');
      button.dataset.disabledReason = `🔒 ${this.getRequirementText()}`;
    } else if (this.type === "tieredUpgrade") {
      // Disable logic for tiered
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
      } else if (this.getEffectiveMaxLevel() <= this.level) {
        button.disabled = true;
        button.dataset.disabledReason = this.prestige_bonus_levels > 0
          ? `Max Level: ${this.getEffectiveMaxLevel()} (Prestige to unlock more!)`
          : `Max Level: ${this.getEffectiveMaxLevel()}`;
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