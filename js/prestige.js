import { formatNumberInWords } from "./utils.js";
import { heavenlyUpgrades } from "./gameData.js";
import { PRESTIGE } from "./config.js";
import { CookieNum } from "./cookieNum.js";

export class PrestigeManager {
  constructor(game) {
    this.game = game;
    this.heavenlyChips = 0;
    this.spentChips = 0;
    this.timesPrestiged = 0;
    this.totalCookiesBakedAllTime = CookieNum.ZERO; // Across all ascensions

    // Heavenly upgrades — track purchased state by id
    this.purchasedUpgrades = new Set();
  }

  // Heavenly chips earned = (total cookies / divisor) ^ exponent
  // Using 0.35 exponent (close to original CC's cube root 0.333) — to double HC
  // you need ~7.2× more cookies, providing natural diminishing returns without a soft cap.
  calculateHeavenlyChipsOnReset() {
    const total = this.totalCookiesBakedAllTime.add(this.game.stats.totalCookiesBaked);
    let chips = Math.floor(Math.pow(total.toNumber() / PRESTIGE.chipDivisor, PRESTIGE.chipExponent));

    // HC Interest bonus from heavenly upgrade
    if (this.hasUpgrade('hcInterest')) {
      const interestValue = this._getUpgradeData('hcInterest').value;
      chips = Math.floor(chips * (1 + interestValue));
    }

    // Compound Wealth: additional HC interest bonus (stacks)
    if (this.hasUpgrade('compoundWealth')) {
      const interestValue2 = this._getUpgradeData('compoundWealth').value;
      chips = Math.floor(chips * (1 + interestValue2));
    }

    return Math.max(0, chips - this.heavenlyChips); // Only new chips
  }

  getPrestigeMultiplier() {
    // Diminishing returns based on AVAILABLE (unspent) chips — spending chips reduces the bonus
    const available = this.getSpendableChips();
    let mult = 1 + PRESTIGE.bonusScale * Math.pow(available, PRESTIGE.bonusExponent);

    // Veteran's Bonus: +3% CPS per effective prestige (diminishing: n^0.7)
    if (this.hasUpgrade('seasonSavings')) {
      const bonus = this._getUpgradeData('seasonSavings').value;
      const effectivePrestiges = Math.pow(this.timesPrestiged, 0.7);
      mult *= (1 + bonus * effectivePrestiges);
    }

    // Timeless Baking: +5% CPS per effective prestige (diminishing: n^0.7, stacks)
    if (this.hasUpgrade('timelessBaking')) {
      const bonus = this._getUpgradeData('timelessBaking').value;
      const effectivePrestiges = Math.pow(this.timesPrestiged, 0.7);
      mult *= (1 + bonus * effectivePrestiges);
    }

    // Angels: +5% base CPS permanently
    if (this.hasUpgrade('angels')) {
      mult *= (1 + this._getUpgradeData('angels').value);
    }

    // First Light: +1% base CPS
    if (this.hasUpgrade('firstLight')) {
      mult *= (1 + this._getUpgradeData('firstLight').value);
    }

    return mult;
  }

  canPrestige() {
    return this.calculateHeavenlyChipsOnReset() >= 10;
  }

  performPrestige() {
    const newChips = this.calculateHeavenlyChipsOnReset();
    if (newChips <= 0) return false;

    this.heavenlyChips += newChips;
    this.totalCookiesBakedAllTime = this.totalCookiesBakedAllTime.add(this.game.stats.totalCookiesBaked);
    this.timesPrestiged++;
    this.game.soundManager.prestige();

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
          grandma.cps = grandma.cps.mul(upgrade.value);
        }
        this.game.calculateCPS();
        break;
      }
      case 'allBuildingCpsMultiplier': {
        // Multiply all building CPS by value
        if (this.game.buildings) {
          for (const b of this.game.buildings) {
            b.cps = b.cps.mul(upgrade.value);
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
      case 'goldenCookieRewardMultiplier':
      case 'starterBuildings2':
      case 'clickMultiplier2':
      case 'cpsPerAchievement2':
      case 'frenzyMultiplier2':
      case 'softCapScalingBonus':
      case 'starterBuildings3':
      case 'clickMultiplier3':
      case 'bonusUpgradeLevels2':
      case 'goldenCookieRewardMultiplier2':
      case 'persistentMemory3':
      case 'cpsPerBuildingType2':
      case 'cpsPerPrestige2':
      case 'frenzyDuration':
      case 'synergyMultiplier3':
      case 'cpsPerAchievement3':
      case 'hcInterest2':
      case 'prestigeBuildingDiscount2':
      case 'elderKnowledge':
      case 'wrinklerReturnBonus':
      case 'elderPledgeDiscount':
      case 'baseCpsMultiplier2':
      case 'clickMultiplier4':
      case 'clickMultiplier5':
      case 'clickMultiplier6':
      case 'clickMultiplier7':
      case 'offlineBonus':
      case 'offlineBonus2':
      case 'offlineBonus3':
      case 'goldenCookieDuration':
      case 'goldenCookieDuration2':
        // Checked dynamically during gameplay
        break;
      case 'minigamePrestigeBonus':
      case 'minigamePrestigeBonus2':
      case 'minigamePrestigeBonus3': {
        // Apply directly to game.miniGameBonus (replayed via applyAllEffects)
        if (this.game.miniGameBonus !== undefined) {
          this.game.miniGameBonus *= upgrade.value;
        }
        break;
      }
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

  getGoldenCookieRewardMultiplier() {
    if (this.hasUpgrade('goldenWindfall')) {
      return this._getUpgradeData('goldenWindfall').value;
    }
    return 1;
  }

  getStarterBuildings2() {
    if (this.hasUpgrade('cookieStockpile')) {
      return this._getUpgradeData('cookieStockpile').value; // [3, 4]
    }
    return [];
  }

  getClickMultiplier2() {
    if (this.hasUpgrade('practicedHands')) {
      return this._getUpgradeData('practicedHands').value;
    }
    return 1;
  }

  getCpsPerAchievementBonus2() {
    if (this.hasUpgrade('medalCabinet')) {
      return this._getUpgradeData('medalCabinet').value;
    }
    return 0;
  }

  getFrenzyBonusMultiplier2() {
    if (this.hasUpgrade('frenzyMastery')) {
      return this._getUpgradeData('frenzyMastery').value;
    }
    return 1;
  }

  // === Tier 5+ Getters ===

  getSoftCapScalingBonus() {
    if (this.hasUpgrade('eternityRising')) {
      return this._getUpgradeData('eternityRising').value;
    }
    return 1;
  }

  getStarterBuildings3() {
    if (this.hasUpgrade('divineGranaries')) {
      return this._getUpgradeData('divineGranaries').value; // [5, 6, 7]
    }
    return [];
  }

  getClickMultiplier3() {
    if (this.hasUpgrade('astralClicking')) {
      return this._getUpgradeData('astralClicking').value;
    }
    return 1;
  }

  getBonusUpgradeLevels2() {
    if (this.hasUpgrade('wisdomEternal')) {
      return this._getUpgradeData('wisdomEternal').value;
    }
    return 0;
  }

  getGoldenCookieRewardMultiplier2() {
    if (this.hasUpgrade('goldenEmpire')) {
      return this._getUpgradeData('goldenEmpire').value;
    }
    return 1;
  }

  getPersistentMemoryFraction3() {
    if (this.hasUpgrade('soulMemory')) {
      return this._getUpgradeData('soulMemory').value;
    }
    return 0;
  }

  getCpsPerBuildingTypeBonus2() {
    if (this.hasUpgrade('cosmicHarvest')) {
      return this._getUpgradeData('cosmicHarvest').value;
    }
    return 0;
  }

  getCpsPerPrestige2() {
    if (this.hasUpgrade('timelessBaking')) {
      return this._getUpgradeData('timelessBaking').value;
    }
    return 0;
  }

  getFrenzyDurationMultiplier() {
    if (this.hasUpgrade('ascendantFrenzies')) {
      return this._getUpgradeData('ascendantFrenzies').value;
    }
    return 1;
  }

  getSynergyMultiplier3() {
    if (this.hasUpgrade('celestialSynergy')) {
      return this._getUpgradeData('celestialSynergy').value;
    }
    return 1;
  }

  getCpsPerAchievementBonus3() {
    if (this.hasUpgrade('omniscientBaking')) {
      return this._getUpgradeData('omniscientBaking').value;
    }
    return 0;
  }

  getHcInterest2() {
    if (this.hasUpgrade('compoundWealth')) {
      return this._getUpgradeData('compoundWealth').value;
    }
    return 0;
  }

  getPrestigeBuildingDiscount2() {
    if (this.hasUpgrade('realityArchitect')) {
      return this._getUpgradeData('realityArchitect').value;
    }
    return 0;
  }

  // === NEW upgrade getters ===

  getBaseCpsMultiplier2() {
    return this.hasUpgrade('firstLight') ? this._getUpgradeData('firstLight').value : 0;
  }

  getClickMultiplier4() {
    return this.hasUpgrade('quickFingers') ? this._getUpgradeData('quickFingers').value : 1;
  }

  getClickMultiplier5() {
    return this.hasUpgrade('nimbleClicks') ? this._getUpgradeData('nimbleClicks').value : 1;
  }

  getClickMultiplier6() {
    return this.hasUpgrade('clickStorm') ? this._getUpgradeData('clickStorm').value : 1;
  }

  getClickMultiplier7() {
    return this.hasUpgrade('clickNirvana') ? this._getUpgradeData('clickNirvana').value : 1;
  }

  getOfflineBonus() {
    let bonus = 0;
    if (this.hasUpgrade('idleAngels')) bonus += this._getUpgradeData('idleAngels').value;
    if (this.hasUpgrade('idleEmpire')) bonus += this._getUpgradeData('idleEmpire').value;
    if (this.hasUpgrade('idleMastery')) bonus += this._getUpgradeData('idleMastery').value;
    return bonus; // additive: 0.15 + 0.20 + 0.15 = 0.50 max extra
  }

  getGoldenCookieDurationBonus() {
    let bonus = 0;
    if (this.hasUpgrade('touchOfGold')) bonus += this._getUpgradeData('touchOfGold').value;
    if (this.hasUpgrade('goldenGlow')) bonus += this._getUpgradeData('goldenGlow').value;
    return bonus; // additive: 0.30 + 0.50 = 0.80 → 80% longer
  }

  // === Grandmapocalypse Heavenly Upgrade Getters ===

  getElderPledgeDiscount() {
    if (this.hasUpgrade('grandmasForgiveness')) {
      return this._getUpgradeData('grandmasForgiveness').value;
    }
    return 0;
  }

  getWrinklerReturnBonus() {
    if (this.hasUpgrade('wrinklerWhisperer')) {
      return this._getUpgradeData('wrinklerWhisperer').value;
    }
    return 1;
  }

  // === Save / Load ===

  getSaveData() {
    return {
      heavenlyChips: this.heavenlyChips,
      spentChips: this.spentChips,
      timesPrestiged: this.timesPrestiged,
      totalCookiesBakedAllTime: this.totalCookiesBakedAllTime.toJSON(),
      purchasedUpgrades: Array.from(this.purchasedUpgrades),
    };
  }

  loadSaveData(data) {
    if (!data) return;
    this.heavenlyChips = data.heavenlyChips || 0;
    this.spentChips = data.spentChips || 0;
    this.timesPrestiged = data.timesPrestiged || 0;
    this.totalCookiesBakedAllTime = CookieNum.fromJSON(data.totalCookiesBakedAllTime || 0);
    this.purchasedUpgrades = new Set(data.purchasedUpgrades || []);
  }
}
