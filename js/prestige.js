import { formatNumberInWords } from "./utils.js";
import { heavenlyUpgrades } from "./gameData.js";
import { PRESTIGE } from "./config.js";

export class PrestigeManager {
  constructor(game) {
    this.game = game;
    this.heavenlyChips = 0;
    this.spentChips = 0;
    this.timesPrestiged = 0;
    this.totalCookiesBakedAllTime = 0; // Across all ascensions

    // Heavenly upgrades — track purchased state by id
    this.purchasedUpgrades = new Set();
  }

  // Heavenly chips earned = (total cookies / 1 trillion) ^ exponent
  calculateHeavenlyChipsOnReset() {
    const total = this.totalCookiesBakedAllTime + this.game.stats.totalCookiesBaked;
    let chips = Math.floor(Math.pow(total / PRESTIGE.chipDivisor, PRESTIGE.chipExponent));

    // HC Interest bonus from heavenly upgrade
    if (this.hasUpgrade('hcInterest')) {
      const interestValue = this._getUpgradeData('hcInterest').value;
      chips = Math.floor(chips * (1 + interestValue));
    }

    return Math.max(0, chips - this.heavenlyChips); // Only new chips
  }

  getPrestigeMultiplier() {
    // Each heavenly chip = +1% CPS (based on total earned, not remaining)
    let mult = 1 + (this.heavenlyChips * PRESTIGE.bonusPerChip);

    // Season Savings: +10% CPS per prestige level
    if (this.hasUpgrade('seasonSavings')) {
      const bonus = this._getUpgradeData('seasonSavings').value;
      mult *= (1 + bonus * this.timesPrestiged);
    }

    // Angels: +5% base CPS permanently
    if (this.hasUpgrade('angels')) {
      mult *= (1 + this._getUpgradeData('angels').value);
    }

    return mult;
  }

  canPrestige() {
    return this.calculateHeavenlyChipsOnReset() > 0;
  }

  performPrestige() {
    const newChips = this.calculateHeavenlyChipsOnReset();
    if (newChips <= 0) return false;

    this.heavenlyChips += newChips;
    this.totalCookiesBakedAllTime += this.game.stats.totalCookiesBaked;
    this.timesPrestiged++;

    // Track session prestiges for achievement
    this.game.stats.sessionPrestiges = (this.game.stats.sessionPrestiges || 0) + 1;

    // Easter egg: ascension junkie (3 prestiges in one session)
    if (this.game.stats.sessionPrestiges >= 3 && this.game.tutorial) {
      this.game.tutorial.triggerEvent('ascensionJunkie');
    }

    // Reset game state but keep prestige data
    this.game.resetForPrestige();
    return true;
  }

  // === Heavenly Upgrade Shop ===

  getSpendableChips() {
    return this.heavenlyChips - this.spentChips;
  }

  hasUpgrade(id) {
    return this.purchasedUpgrades.has(id);
  }

  getHeavenlyUpgradeCount() {
    return this.purchasedUpgrades.size;
  }

  canBuyUpgrade(id) {
    const upgrade = heavenlyUpgrades.find(u => u.id === id);
    if (!upgrade) return false;
    if (this.hasUpgrade(id)) return false;
    if (this.getSpendableChips() < upgrade.cost) return false;

    // Check prerequisites
    if (upgrade.requires && upgrade.requires.length > 0) {
      for (const reqId of upgrade.requires) {
        if (!this.hasUpgrade(reqId)) return false;
      }
    }

    return true;
  }

  buyUpgrade(id) {
    if (!this.canBuyUpgrade(id)) return false;
    const upgrade = heavenlyUpgrades.find(u => u.id === id);
    this.spentChips += upgrade.cost;
    this.purchasedUpgrades.add(id);

    // Apply immediate effects that don't need game loop
    this._applyUpgradeEffect(upgrade);

    return true;
  }

  _getUpgradeData(id) {
    return heavenlyUpgrades.find(u => u.id === id) || null;
  }

  _applyUpgradeEffect(upgrade) {
    switch (upgrade.effect) {
      case 'cosmicGrandma': {
        // Multiply Grandma base CPS by value
        const grandma = this.game.buildings.find(b => b.name === 'Grandma');
        if (grandma) {
          grandma.cps = parseFloat((grandma.cps * upgrade.value).toFixed(1));
        }
        this.game.calculateCPS();
        break;
      }
      case 'allBuildingCpsMultiplier': {
        // Multiply all building CPS by value
        if (this.game.buildings) {
          for (const b of this.game.buildings) {
            b.cps = parseFloat((b.cps * upgrade.value).toFixed(1));
          }
        }
        this.game.calculateCPS();
        break;
      }
      case 'frenzyMultiplier':
      case 'goldenCookieFrequency':
      case 'goldenCookieFrequency2':
      case 'luckyClickMultiplier':
      case 'clickMultiplier':
      case 'cpsPerBuildingType':
      case 'bonusUpgradeLevels':
      case 'persistentMemory2':
      case 'synergyTripler':
        // Checked dynamically during gameplay
        break;
      default:
        // Most effects are checked dynamically during gameplay
        break;
    }
  }

  // Apply all purchased heavenly upgrade effects (called on game load / after prestige)
  applyAllEffects() {
    for (const id of this.purchasedUpgrades) {
      const upgrade = heavenlyUpgrades.find(u => u.id === id);
      if (upgrade) {
        this._applyUpgradeEffect(upgrade);
      }
    }
  }

  // === Helpers for game.js to query effects ===

  getStartingCookiesMultiplier() {
    if (this.hasUpgrade('heavenlyCookies')) {
      return this._getUpgradeData('heavenlyCookies').value;
    }
    return 1;
  }

  getBuildingCostReduction() {
    if (this.hasUpgrade('twinGates')) {
      return this._getUpgradeData('twinGates').value;
    }
    return 0;
  }

  getUpgradeCostReduction() {
    if (this.hasUpgrade('divineDiscount')) {
      return this._getUpgradeData('divineDiscount').value;
    }
    return 0;
  }

  getStarterBuildings() {
    if (this.hasUpgrade('starterKit')) {
      return this._getUpgradeData('starterKit').value; // [0, 1, 2]
    }
    return [];
  }

  getPersistentMemoryFraction() {
    if (this.hasUpgrade('persistentMemory')) {
      return this._getUpgradeData('persistentMemory').value;
    }
    return 0;
  }

  getBuildingCpsPerPrestige() {
    if (this.hasUpgrade('divineBakeries')) {
      return this._getUpgradeData('divineBakeries').value * this.timesPrestiged;
    }
    return 0;
  }

  getCpsPerAchievementBonus() {
    if (this.hasUpgrade('kittenWorkers')) {
      return this._getUpgradeData('kittenWorkers').value;
    }
    return 0;
  }

  getSynergyMultiplier() {
    if (this.hasUpgrade('synergyVol2')) {
      return this._getUpgradeData('synergyVol2').value;
    }
    return 1;
  }

  getFrenzyBonusMultiplier() {
    if (this.hasUpgrade('frenzyOverload')) {
      return this._getUpgradeData('frenzyOverload').value;
    }
    return 1;
  }

  getGoldenCookieFrequencyBonus() {
    if (this.hasUpgrade('heavenlyLuck')) {
      return this._getUpgradeData('heavenlyLuck').value;
    }
    return 0;
  }

  getPrestigeBuildingDiscount() {
    if (this.hasUpgrade('ascendantBakers')) {
      return this._getUpgradeData('ascendantBakers').value;
    }
    return 0;
  }

  getLuckyClickMultiplier() {
    if (this.hasUpgrade('luckyStars')) {
      return this._getUpgradeData('luckyStars').value;
    }
    return 1;
  }

  getGoldenCookieFrequencyBonus2() {
    if (this.hasUpgrade('goldenAge')) {
      return this._getUpgradeData('goldenAge').value;
    }
    return 0;
  }

  getBonusUpgradeLevels() {
    if (this.hasUpgrade('infiniteWisdom')) {
      return this._getUpgradeData('infiniteWisdom').value;
    }
    return 0;
  }

  getCpsPerBuildingTypeBonus() {
    if (this.hasUpgrade('cosmicResonance')) {
      return this._getUpgradeData('cosmicResonance').value;
    }
    return 0;
  }

  getClickMultiplier() {
    if (this.hasUpgrade('heavenlyClicking')) {
      return this._getUpgradeData('heavenlyClicking').value;
    }
    return 1;
  }

  getPersistentMemoryFraction2() {
    if (this.hasUpgrade('divinePersistence')) {
      return this._getUpgradeData('divinePersistence').value;
    }
    return 0;
  }

  getSynergyMultiplier2() {
    if (this.hasUpgrade('cosmicSynergy')) {
      return this._getUpgradeData('cosmicSynergy').value;
    }
    return 1;
  }

  // === Save / Load ===

  getSaveData() {
    return {
      heavenlyChips: this.heavenlyChips,
      spentChips: this.spentChips,
      timesPrestiged: this.timesPrestiged,
      totalCookiesBakedAllTime: this.totalCookiesBakedAllTime,
      purchasedUpgrades: Array.from(this.purchasedUpgrades),
    };
  }

  loadSaveData(data) {
    if (!data) return;
    this.heavenlyChips = data.heavenlyChips || 0;
    this.spentChips = data.spentChips || 0;
    this.timesPrestiged = data.timesPrestiged || 0;
    this.totalCookiesBakedAllTime = data.totalCookiesBakedAllTime || 0;
    this.purchasedUpgrades = new Set(data.purchasedUpgrades || []);
  }
}
