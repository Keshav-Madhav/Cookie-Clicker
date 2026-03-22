
// ─────────────────────────────────────────────────────────────
//  CORE GAME SETTINGS
// ─────────────────────────────────────────────────────────────
export const GAME = {
  /** Cookies the player starts with (and gets after prestige) */
  startingCookies: 15,
  /** Base cookies earned per click before any multipliers */
  startingCookiesPerClick: 1,

  /** Main game loop tick interval in milliseconds */
  tickIntervalMs: 1000,
  /** Auto-save interval in milliseconds */
  saveIntervalMs: 5000,

  /** Default offline production multiplier (0.5 = 50% of CPS while away) */
  offlineMultiplier: 0.5,

  /** Upgrade grid page size (3x3) */
  upgradePageSize: 9,
  /** Delay before auto-resorting upgrades by cost (ms) */
  upgradeSortDelayMs: 10000,

  /** Buy-amount buttons shown in the shop toolbar */
  purchaseAmounts: [1, 10, 25, 100, 'Max'],

  /** Multiplier bar log scaling — individual bars: log10(v) × this = bar%. 50 → 100% at x100 */
  multiplierBarLogScale: 50,
  /** Combined multiplier bar log scaling — 25 → 100% at x10000 */
  combinedBarLogScale: 25,
};


// ─────────────────────────────────────────────────────────────
//  PRESTIGE / HEAVENLY CHIPS
// ─────────────────────────────────────────────────────────────
export const PRESTIGE = {
  /** Prestige chip formula: floor( (totalCookies / divisor) ^ exponent )
   *  100M → 1, 1B → 3, 10B → 10, 100B → 31, 1T → 100, 100T → 1K, 1Qi → 100K */
  chipDivisor: 1e8,
  chipExponent: 0.5,
  /** CPS multiplier from chips: 1 + bonusScale × chips^bonusExponent
   *  Diminishing returns — 1 chip → 1.2x, 100 → 2.6x, 1K → 5.5x, 10K → 15x */
  bonusScale: 0.2,
  bonusExponent: 0.45,
};


// ─────────────────────────────────────────────────────────────
//  CPS SOFT CAP — creates natural prestige plateaus
// ─────────────────────────────────────────────────────────────
export const SOFT_CAP = {
  /**
   * Production soft-cap. Once in-run CPS (before prestige multiplier)
   * exceeds the threshold, additional production suffers logarithmic
   * diminishing returns, creating a natural wall that makes prestige
   * the attractive path forward.
   *
   * Formula (above threshold):
   *   effectiveCPS = threshold × (1 + ln(rawCPS / threshold) × generosity)
   *
   * The threshold scales with prestige: base × prestigeScaling ^ timesPrestiged
   *
   * Example first-run (threshold = 1M, generosity = 0.75):
   *   Raw  500K →  500K effective (100%)     — below cap, no effect
   *   Raw    5M → 2.21M effective  (44%)     — slowing down
   *   Raw   50M → 3.93M effective   (8%)     — hard wall
   *   Raw  500M → 5.66M effective   (1%)     — barely moving
   *
   * After 1st prestige (threshold = 5M):
   *   Raw    5M →    5M effective (100%)     — smooth sailing
   *   Raw   50M → 11.1M effective  (22%)     — new wall, further out
   */

  /** Base CPS threshold where diminishing returns begin (no prestige). */
  baseThreshold: 1_000_000,

  /** How much CPS leaks through above the cap (higher = more generous).
   *  0.75 gives a moderate curve: 10× over → 27% eff, 100× over → 4.5% eff. */
  generosity: 0.75,

  /** Each prestige multiplies the threshold by this factor.
   *  5 → first prestige raises cap from 1M to 5M, second to 25M, etc. */
  prestigeScaling: 5,

  /** Minimum efficiency floor — CPS never drops below this fraction of raw. */
  minEfficiency: 0.01,
};


// ─────────────────────────────────────────────────────────────
//  ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = {
  /** CPS bonus per unlocked achievement (0.02 = +2%) */
  bonusPerAchievement: 0.02,
  /** Cookie burst when an achievement unlocks */
  unlockBurst: { count: 15, speed: 2 },
  /** How long the notification shows (ms) */
  notificationDurationMs: 3000,
  /** Fade-out animation delay before DOM removal (ms) */
  notificationFadeMs: 500,
  /** Speedrunner achievement: max session time in seconds */
  speedrunnerTimeSec: 300,
};


// ─────────────────────────────────────────────────────────────
//  EASTER EGGS / TUTORIAL TRIGGERS
// ─────────────────────────────────────────────────────────────
export const EASTER_EGGS = {
  /** Night owl: playing between these hours triggers the event */
  nightOwlStartHour: 1,
  nightOwlEndHour: 5,

  /** Rapid clicker: N clicks within windowMs */
  rapidClicker: {
    clickThreshold: 15,
    windowMs: 2000,
  },

  /** Indecisive clicker: changed purchase amount N times */
  indecisiveClickerThreshold: 6,

  /** OCD sorter: tried all N sort options */
  ocdSorterThreshold: 5,

  /** Achievement check frequency: every N clicks */
  achievementCheckInterval: 10,

  /** Nice milk: triggers at this achievement percentage */
  niceMilkPctMin: 69,
  niceMilkPctMax: 70,
};


// ─────────────────────────────────────────────────────────────
//  TUTORIAL
// ─────────────────────────────────────────────────────────────
export const TUTORIAL = {
  /** Minimum milliseconds between contextual tips */
  eventCooldownMs: 3500,
  /** Delay before starting onboarding (ms) */
  onboardingDelayMs: 800,
  /** Anti-spam lock duration after advancing a step (ms) */
  advanceLockMs: 300,
};

