
// ─────────────────────────────────────────────────────────────
//  LUCKY CLICK REWARDS  (triggered by Lucky Cookie upgrades)
// ─────────────────────────────────────────────────────────────
export const LUCKY_CLICK = {
  /**
   * Roll thresholds for bonus type:
   *   roll < cookieRollMax       → cookie bonus
   *   roll < frenzyRollMax       → CPS frenzy
   *   roll >= frenzyRollMax      → click frenzy
   */
  cookieRollMax: 0.5,
  frenzyRollMax: 0.8,

  /** Cookie bonus = max(minCookies, CPS × cpsMultiplier) */
  cookie: {
    cpsMultiplier: 120,
    minCookies: 100,
  },

  /** CPS frenzy: production multiplied (weaker than golden cookie frenzies) */
  cpsFrenzy: {
    multiplier: 3,
    durationSec: 15,
  },

  /** Click frenzy: each click multiplied (weaker than golden cookie frenzies) */
  clickFrenzy: {
    multiplier: 77,
    durationSec: 8,
  },
};


// ─────────────────────────────────────────────────────────────
//  FRENZY VISUAL EFFECTS
// ─────────────────────────────────────────────────────────────
export const FRENZY_BURSTS = {
  /** Cookie burst when a click frenzy starts */
  clickFrenzy: { count: 35, speed: 3.5 },
  /** Cookie burst when a CPS frenzy starts */
  cpsFrenzy:   { count: 25, speed: 2.5 },
  /** Cookie burst on prestige */
  prestige:    { count: 70, speed: 4 },
};


// ─────────────────────────────────────────────────────────────
//  GOLDEN COOKIE
// ─────────────────────────────────────────────────────────────
export const GOLDEN_COOKIE = {
  /** Spawn delay: random × delayRangeSec + delayMinSec (in seconds) */
  delayMinSec: 60,
  delayRangeSec: 120,
  /** Disappear if not clicked (ms) */
  lifetimeMs: 12000,
  /** Position margin — fraction of viewport width/height */
  positionMargin: 0.25,

  /**
   * Reward roll thresholds:
   *   roll < luckyRollMax     → lucky bonus
   *   roll < frenzyRollMax    → CPS frenzy
   *   roll < clickRollMax     → click frenzy
   *   roll >= clickRollMax    → cookie storm (rarest)
   */
  luckyRollMax: 0.45,
  frenzyRollMax: 0.75,
  clickRollMax: 0.9,

  /** Lucky bonus */
  lucky: {
    cpsMultiplier: 600,
    minCookies: 200,
  },

  /** CPS frenzy from golden cookie */
  cpsFrenzy: {
    multiplier: 7,
    durationSec: 77,
  },

  /** Click frenzy from golden cookie */
  clickFrenzy: {
    multiplier: 777,
    durationSec: 13,
  },

  /** Cookie storm (rarest reward) */
  cookieStorm: {
    cpsMultiplier: 3600,
    minCookies: 5000,
  },

  /** Golden cookie click burst particles */
  clickBurst: {
    sparkCount: 18,
    sparkDistMin: 40,
    sparkDistRange: 80,
    sparkRemovalMs: 700,
  },

  /** Reward text display time (ms) */
  rewardTextMs: 2500,
};

