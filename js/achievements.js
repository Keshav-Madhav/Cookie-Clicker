import { achievements } from "./gameData.js";
import { ACHIEVEMENTS } from "./config.js";

export class AchievementManager {
  constructor(game) {
    this.game = game;
    this.achievements = achievements.map(a => ({
      ...a,
      unlocked: false,
      unlockedAt: null
    }));
    this.bonusPerAchievement = ACHIEVEMENTS.bonusPerAchievement; // +CPS per achievement
    this.newlyUnlocked = []; // Queue for showing notifications
  }

  getUnlockedCount() {
    return this.achievements.filter(a => a.unlocked).length;
  }

  isUnlocked(id) {
    const a = this.achievements.find(a => a.id === id);
    return a ? a.unlocked : false;
  }

  getTotalCount() {
    return this.achievements.length;
  }

  getMultiplier() {
    return 1 + (this.getUnlockedCount() * this.bonusPerAchievement);
  }

  check() {
    const stats = this.game.stats;
    
    this.achievements.forEach(achievement => {
      if (achievement.unlocked) return;

      let met = false;
      switch (achievement.type) {
        case "totalCookies":
          met = stats.totalCookiesBaked >= achievement.requirement;
          break;
        case "cps":
          met = this.game.getEffectiveCPS() >= achievement.requirement;
          break;
        case "totalClicks":
          met = stats.totalClicks >= achievement.requirement;
          break;
        case "totalBuildings":
          met = this.game.getTotalBuildingCount() >= achievement.requirement;
          break;
        case "allBuildingTypes":
          met = this.game.buildings.every(b => b.count >= achievement.requirement);
          break;
        case "luckyClicks":
          met = stats.luckyClicks >= achievement.requirement;
          break;
        case "frenziesTriggered":
          met = stats.frenziesTriggered >= achievement.requirement;
          break;
        case "timesPrestiged":
          met = stats.timesPrestiged >= achievement.requirement;
          break;
        case "heavenlyChips":
          met = this.game.prestige.heavenlyChips >= achievement.requirement;
          break;
        case "totalUpgradesPurchased":
          met = stats.totalUpgradesPurchased >= achievement.requirement;
          break;
        case "buildingCount":
          met = this.game.buildings[achievement.buildingIndex] &&
                this.game.buildings[achievement.buildingIndex].count >= achievement.requirement;
          break;
        case "speedrunner": {
          const sessionSec = (Date.now() - stats.startTime) / 1000;
          met = sessionSec < ACHIEVEMENTS.speedrunnerTimeSec && this.game.getEffectiveCPS() >= achievement.requirement;
          break;
        }
        case "bulkBuyer":
          met = !!stats.bulkBuyerTriggered;
          break;
        case "miniGamesWon":
          met = Array.isArray(stats.miniGamesWon) &&
                stats.miniGamesWon.length >= achievement.requirement;
          break;
        case "heavenlyUpgradesPurchased":
          met = this.game.prestige &&
                this.game.prestige.getHeavenlyUpgradeCount() >= achievement.requirement;
          break;
      }

      if (met) {
        achievement.unlocked = true;
        achievement.unlockedAt = Date.now();
        this.newlyUnlocked.push(achievement);
      }
    });

    // Show notifications for newly unlocked achievements
    while (this.newlyUnlocked.length > 0) {
      const a = this.newlyUnlocked.shift();
      this.showNotification(a);

      // Cookie rain burst on achievement unlock
      if (this.game.visualEffects) {
        this.game.visualEffects.triggerCookieBurst(ACHIEVEMENTS.unlockBurst.count, ACHIEVEMENTS.unlockBurst.speed);
      }

      // Tutorial: first achievement event
      if (this.game.tutorial) {
        this.game.tutorial.triggerEvent('firstAchievement');
      }
    }
  }

  showNotification(achievement) {
    const notif = document.createElement("div");
    notif.classList.add("achievement-notification");
    notif.innerHTML = `<strong>🏆 Achievement Unlocked!</strong><br>${achievement.name}<br><small>${achievement.desc}</small>`;
    document.body.appendChild(notif);

    // Trigger animation
    requestAnimationFrame(() => {
      notif.classList.add("show");
    });

    setTimeout(() => {
      notif.classList.remove("show");
      setTimeout(() => notif.remove(), ACHIEVEMENTS.notificationFadeMs);
    }, ACHIEVEMENTS.notificationDurationMs);
  }

  getSaveData() {
    return this.achievements
      .filter(a => a.unlocked)
      .map(a => a.id);
  }

  loadSaveData(unlockedIds) {
    if (!unlockedIds) return;
    unlockedIds.forEach(id => {
      const achievement = this.achievements.find(a => a.id === id);
      if (achievement) {
        achievement.unlocked = true;
      }
    });
  }
}
