import { encryptSave, decryptSave, isEncrypted } from "./saveCrypto.js";
import { CookieNum } from "./cookieNum.js";
import { GAME } from "./config.js";
import { formatNumberInWords } from "./utils.js";

/** Save/Load mixin — applied to Game.prototype */
export const SaveLoadMixin = {
// === Save / Load ===
saveGame() {
  if (this._wipedSave || this._savePending) return;
  let saveData = {
    cookies: this.cookies.toJSON(),
    cookiesPerClick: this.cookiesPerClick.toJSON(),
    globalCpsMultiplier: this.globalCpsMultiplier,
    luckyClickChance: this.luckyClickChance,
    cpsClickBonus: this.cpsClickBonus,
    miniGameBonus: this.miniGameBonus,
    frenzyDurationMultiplier: this.frenzyDurationMultiplier,
    buildings: this.buildings.map(b => ({
      count: b.count,
      cost: b.cost.toJSON(),
      baseCost: b.baseCost.toJSON(),
    })),
    upgrades: this.upgrades.map(u => {
      const data = { level: u.level, cost: u.cost.toJSON() };
      if (u.type === "tieredUpgrade") {
        data.currentTier = u.currentTier;
        data.multiplier = u.multiplier;
        if (u.bonus !== undefined) data.bonus = u.bonus;
        if (u.chance !== undefined) data.chance = u.chance;
      }
      return data;
    }),
    stats: {
      ...this.stats,
      totalCookiesBaked: this.stats.totalCookiesBaked.toJSON(),
      handmadeCookies: this.stats.handmadeCookies.toJSON(),
    },
    achievements: this.achievementManager.getSaveData(),
    prestige: this.prestige.getSaveData(),
    tutorial: this.tutorial.getSaveData(),
    grandmapocalypse: this.grandmapocalypse ? this.grandmapocalypse.getSaveData() : null,
    wrinklers: this.wrinklerManager ? this.wrinklerManager.getSaveData() : null,
    settings: this.settings,
    lastSavedTime: Date.now(),
    saveVersion: 6,
  };
  const jsonStr = JSON.stringify(saveData);
  this._savePending = true;
  encryptSave(jsonStr).then(encrypted => {
    localStorage.setItem("cookieClickerSave", encrypted);
  }).finally(() => {
    this._savePending = false;
  });
},

loadGame() {
  const stored = localStorage.getItem("cookieClickerSave");
  if (!stored) return Promise.resolve();

  if (isEncrypted(stored)) {
    return decryptSave(stored).then(json => {
      this._restoreSave(JSON.parse(json));
    }).catch(err => {
      console.error("Failed to decrypt save — starting fresh.", err);
    });
  } else {
    // Legacy unencrypted save — restore now, re-encrypted on next save
    this._restoreSave(JSON.parse(stored));
    return Promise.resolve();
  }
},

/**
 * Migrate v1 saves (before tiered cursor/lucky/cpsClick) to v2 format.
 * Old: 39 upgrades with individual cursorScaling (22-25), luckyChance (26-29), cpsClick (30-34)
 * New: 29 upgrades with those collapsed into tiered upgrades at indices 22-24
 */
_migrateUpgradesV1(oldUpgrades) {
  if (!oldUpgrades) return oldUpgrades;
  const migrated = [];

  // Indices 0-21 are unchanged — carry over level but strip stale cost
  for (let i = 0; i <= 21 && i < oldUpgrades.length; i++) {
    const { cost, ...rest } = oldUpgrades[i];
    migrated.push(rest);
  }
  // Pad if old save was shorter
  while (migrated.length < 22) migrated.push({ level: 0 });

  // Old 22-25 (cursorScaling) → new 22 (tiered cursorScaling)
  const cursorBought = [22, 23, 24, 25].reduce((n, i) => n + ((oldUpgrades[i] && oldUpgrades[i].level) || 0), 0);
  migrated.push(cursorBought > 0
    ? { level: 1, currentTier: cursorBought - 1 }
    : { level: 0 });

  // Old 26-29 (luckyChance) → new 23 (tiered luckyChance)
  const luckyBought = [26, 27, 28, 29].reduce((n, i) => n + ((oldUpgrades[i] && oldUpgrades[i].level) || 0), 0);
  migrated.push(luckyBought > 0
    ? { level: 1, currentTier: luckyBought - 1 }
    : { level: 0 });

  // Old 30-34 (cpsClick) → new 24 (tiered cpsClick)
  const clickBought = [30, 31, 32, 33, 34].reduce((n, i) => n + ((oldUpgrades[i] && oldUpgrades[i].level) || 0), 0);
  migrated.push(clickBought > 0
    ? { level: 1, currentTier: clickBought - 1 }
    : { level: 0 });

  // Old 35 → new 25 (Game Master) — strip cost
  const gm = oldUpgrades[35] ? (({ cost, ...r }) => r)(oldUpgrades[35]) : { level: 0 };
  migrated.push(gm);
  // Old 36 → new 26 (Extended Frenzy)
  const ef = oldUpgrades[36] ? (({ cost, ...r }) => r)(oldUpgrades[36]) : { level: 0 };
  migrated.push(ef);
  // Old 37 → new 27 (Mega Frenzy)
  const mf = oldUpgrades[37] ? (({ cost, ...r }) => r)(oldUpgrades[37]) : { level: 0 };
  migrated.push(mf);
  // Old 38 → new 28 (Offline Production tiered)
  migrated.push(oldUpgrades[38] || { level: 0 });

  return migrated;
},

/**
 * Apply one-time setting enforcements. Each enforcement has a unique id;
 * once applied, the id is stored in settings._enforced so it never re-runs.
 * @param {Array<{id: string, key: string, value: any}>} list
 */
_applyEnforcements(list) {
  // Migrate old single-flag system → new registry
  if (this.settings._ambientVolEnforced) {
    if (!this.settings._enforced) this.settings._enforced = [];
    if (!this.settings._enforced.includes('ambient-vol-15')) {
      this.settings._enforced.push('ambient-vol-15');
    }
    delete this.settings._ambientVolEnforced;
  }

  if (!this.settings._enforced) this.settings._enforced = [];
  const applied = new Set(this.settings._enforced);
  for (const { id, key, value } of list) {
    if (!applied.has(id)) {
      this.settings[key] = value;
      this.settings._enforced.push(id);
    }
  }
},

_restoreSave(data) {
  // Migrate old save formats
  if (!data.saveVersion || data.saveVersion < 2) {
    data.upgrades = this._migrateUpgradesV1(data.upgrades);
  }
  // V2 → V3: heavenly upgrades & new buildings/upgrades (arrays just grow; new entries auto-initialize)
  if (data.saveVersion && data.saveVersion < 3) {
    // Prestige save data gains new fields — handled by loadSaveData defaults
    if (data.prestige && !data.prestige.purchasedUpgrades) {
      data.prestige.purchasedUpgrades = [];
      data.prestige.spentChips = 0;
    }
  }
  // V3 → V4: more upgrades, buildings adjustments, new heavenly upgrades — arrays grow, auto-initialized
  // V4 → V5: CookieNum precision — all numeric fields now use CookieNum.fromJSON() which
  //   accepts both plain numbers (old saves) and [mantissa, exponent] arrays (new saves).
  //   No explicit data migration needed; fromJSON handles both formats transparently.

  this.cookies = CookieNum.fromJSON(data.cookies || 0);
  this.cookiesPerClick = CookieNum.from(1);
  this.globalCpsMultiplier = 1;
  this.luckyClickChance = 0;
  this.cpsClickBonus = 0;
  this.miniGameBonus = 1;
  this.frenzyDurationMultiplier = 1;

  // Load prestige first (affects multipliers)
  this.prestige.loadSaveData(data.prestige);

  // Load achievements
  this.achievementManager.loadSaveData(data.achievements);

  // Load tutorial state
  if (data.tutorial) {
    this.tutorial.loadSaveData(data.tutorial);
  }

  // Load settings
  if (data.settings) {
    this.settings = { ...this.settings, ...data.settings };
  }

  // ── One-time setting enforcements ──
  // Add entries here to force a setting value once for all players (new and existing).
  // Each entry runs once per save — after that the player's changes are respected.
  // To enforce a new value: add a new entry with a unique id.
  this._applyEnforcements([
    { id: 'ambient-vol-15', key: 'ambientVolume', value: 0.15 },
    // { id: 'music-vol-80',  key: 'musicVolume',   value: 0.8 },
  ]);

  // Load stats
  if (data.stats) {
    this.stats = { ...this.stats, ...data.stats };
    // Restore CookieNum fields from JSON
    this.stats.totalCookiesBaked = CookieNum.fromJSON(data.stats.totalCookiesBaked || 0);
    this.stats.handmadeCookies = CookieNum.fromJSON(data.stats.handmadeCookies || 0);
  }

  // Load Buildings
  if (data.buildings) {
    const len = Math.min(data.buildings.length, this.buildings.length);
    for (let i = 0; i < len; i++) {
      const savedBuilding = data.buildings[i];
      this.buildings[i].count = savedBuilding.count || 0;
      this.buildings[i].cost = savedBuilding.cost ? CookieNum.fromJSON(savedBuilding.cost) : this.buildings[i].cost;
      if (savedBuilding.baseCost) {
        this.buildings[i].baseCost = CookieNum.fromJSON(savedBuilding.baseCost);
      }
    }

    // Fallback for old saves without baseCost: re-apply Twin Gates discount
    const buildingDiscount = this.prestige.getBuildingCostReduction();
    if (buildingDiscount > 0) {
      for (let i = 0; i < this.buildings.length; i++) {
        if (!data.buildings[i] || !data.buildings[i].baseCost) {
          this.buildings[i].baseCost = this.buildings[i].baseCost.mul(1 - buildingDiscount).floor();
        }
      }
    }
  }

  // Load Upgrades and reapply effects
  if (data.upgrades) {
    const len = Math.min(data.upgrades.length, this.upgrades.length);
    for (let i = 0; i < len; i++) {
      const savedUpgrade = data.upgrades[i];
      const upgrade = this.upgrades[i];

      upgrade.level = savedUpgrade.level || 0;

      // Restore saved cost, or recalculate from definition if missing
      if (savedUpgrade.cost) {
        upgrade.cost = CookieNum.fromJSON(savedUpgrade.cost);
      } else if (upgrade.level > 0 && upgrade.type !== 'tieredUpgrade') {
        // Recalculate cost from definition for leveled non-tiered upgrades
        let c = CookieNum.from(upgrade.upgrade.cost);
        for (let lv = 1; lv <= upgrade.level; lv++) {
          let cm = lv > upgrade.base_max_level
            ? (upgrade.prestige_cost_multiplier || upgrade.cost_multiplier)
            : upgrade.cost_multiplier;
          if (upgrade.accel_start && upgrade.cost_acceleration && lv >= upgrade.accel_start) {
            const extra = lv - upgrade.accel_start + 1;
            c = c.mul(cm).mul(CookieNum.from(upgrade.cost_acceleration).pow(extra));
          } else {
            c = c.mul(cm);
          }
        }
        upgrade.cost = c;
      }

      if (upgrade.type === "tieredUpgrade" && upgrade.tiers) {
        upgrade.currentTier = savedUpgrade.currentTier || 0;
        upgrade.updateTierProperties();
        if (savedUpgrade.multiplier !== undefined) upgrade.multiplier = savedUpgrade.multiplier;
        if (savedUpgrade.bonus !== undefined) upgrade.bonus = savedUpgrade.bonus;
        if (savedUpgrade.chance !== undefined) upgrade.chance = savedUpgrade.chance;
      }

      // Re-apply effects
      if (upgrade.level > 0) {
        for (let j = 0; j < upgrade.level; j++) {
          upgrade.applyEffect();
        }
      }
    }
  }

  // Load grandmapocalypse and wrinkler state
  if (data.grandmapocalypse && this.grandmapocalypse) {
    this.grandmapocalypse.loadSaveData(data.grandmapocalypse);
  }
  if (data.wrinklers && this.wrinklerManager) {
    this.wrinklerManager.loadSaveData(data.wrinklers);
  }
  // V5 → V6: grandmapocalypse + wrinklers added. No migration needed; fields default gracefully.

  // Apply heavenly upgrade effects (e.g. Cosmic Grandma)
  this.prestige.applyAllEffects();

  // Restore exact saved values after reapply
  this.cookiesPerClick = CookieNum.fromJSON(data.cookiesPerClick || 1);
  if (data.globalCpsMultiplier) this.globalCpsMultiplier = data.globalCpsMultiplier;
  if (data.luckyClickChance) this.luckyClickChance = data.luckyClickChance;
  if (data.cpsClickBonus) this.cpsClickBonus = data.cpsClickBonus;
  if (data.miniGameBonus) this.miniGameBonus = data.miniGameBonus;
  if (data.frenzyDurationMultiplier) this.frenzyDurationMultiplier = data.frenzyDurationMultiplier;

  // Calculate offline earnings
  if (data.lastSavedTime) {
    const now = Date.now();
    const elapsedTime = Math.floor((now - data.lastSavedTime) / 1000);

    if (elapsedTime > 0) {
      this.calculateCPS();

      let offlineMultiplier = GAME.offlineMultiplier;
      this.upgrades.forEach(upgrade => {
        if (upgrade.name && upgrade.name.startsWith("Offline Production") && upgrade.level > 0) {
          offlineMultiplier = upgrade.multiplier;
        }
      });

      // Exclude wrinkler drain — wrinklers don't feed while offline
      const baseCps = this.getEffectiveCPS({ excludeWrinklerDrain: true });
      const offlineEarnings = baseCps.mul(elapsedTime * offlineMultiplier);
      this.cookies = this.cookies.add(offlineEarnings);
      this.stats.totalCookiesBaked = this.stats.totalCookiesBaked.add(offlineEarnings);

      if (offlineEarnings.gt(0)) {
        if (this.visualEffects) this.visualEffects.triggerIncomeRain(offlineEarnings.toNumber());
        if (this.tutorial) {
          // Build enhanced offline report data
          const buildingsData = this.buildings
            .filter(b => b.count > 0)
            .map(b => ({ name: b.name, count: b.count, cps: b.cps.mul(b.count).toNumber() }))
            .sort((a, b) => b.cps - a.cps);

          const wrinklerCount = data.wrinklers?.wrinklers?.length || 0;
          const wrinklerCookies = (data.wrinklers?.wrinklers || []).reduce(
            (sum, w) => sum + (typeof w.cookiesEaten === 'number' ? w.cookiesEaten : parseFloat(w.cookiesEaten) || 0), 0
          );

          const missedGoldenCookies = Math.floor(elapsedTime / 120);
          const grandmaStage = this.grandmapocalypse ? this.grandmapocalypse.stage : 0;

          this.tutorial.showOfflineEarnings({
            elapsedSec: elapsedTime,
            baseCps: baseCps.toNumber(),
            offlineMultiplier,
            totalEarned: offlineEarnings.toNumber(),
            formatFn: formatNumberInWords,
            buildings: buildingsData,
            wrinklerCount,
            wrinklerCookies: formatNumberInWords(wrinklerCookies),
            missedGoldenCookies,
            grandmaStage,
          });
        }
      }
    }
  }

  // Full UI refresh so buildings, upgrades, and stats reflect restored state
  this.updateUI();
  this.updateLeftPanel();
}
};
