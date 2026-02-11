import { formatNumberInWords } from "./utils.js";

export class PrestigeManager {
  constructor(game) {
    this.game = game;
    this.heavenlyChips = 0;
    this.timesPrestiged = 0;
    this.totalCookiesBakedAllTime = 0; // Across all ascensions
  }

  // Heavenly chips earned = cube root of (total cookies / 1 trillion)
  calculateHeavenlyChipsOnReset() {
    const total = this.totalCookiesBakedAllTime + this.game.stats.totalCookiesBaked;
    const chips = Math.floor(Math.pow(total / 1e12, 0.45));
    return Math.max(0, chips - this.heavenlyChips); // Only new chips
  }

  getPrestigeMultiplier() {
    // Each heavenly chip = +1% CPS
    return 1 + (this.heavenlyChips * 0.01);
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

    // Reset game state but keep prestige data
    this.game.resetForPrestige();
    return true;
  }

  getSaveData() {
    return {
      heavenlyChips: this.heavenlyChips,
      timesPrestiged: this.timesPrestiged,
      totalCookiesBakedAllTime: this.totalCookiesBakedAllTime
    };
  }

  loadSaveData(data) {
    if (!data) return;
    this.heavenlyChips = data.heavenlyChips || 0;
    this.timesPrestiged = data.timesPrestiged || 0;
    this.totalCookiesBakedAllTime = data.totalCookiesBakedAllTime || 0;
  }
}
