/**
 * ═══════════════════════════════════════════════════════════════
 *  COOKIE CLICKER — MASTER CONFIGURATION
 *  ───────────────────────────────────────
 *  All tweakable game constants in one place.
 *  Edit values here to tune gameplay without touching logic code.
 * ═══════════════════════════════════════════════════════════════
 */

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

  /** Multiplier bar scaling — bar reaches 100% at this multiplier (e.g. 4 → x5 = full) */
  multiplierBarScale: 4,
};

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
    cpsMultiplier: 600,
    minCookies: 100,
  },

  /** CPS frenzy: production multiplied */
  cpsFrenzy: {
    multiplier: 7,
    durationSec: 30,
  },

  /** Click frenzy: each click multiplied */
  clickFrenzy: {
    multiplier: 777,
    durationSec: 15,
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
//  CLICK PARTICLES  (left panel cookie area)
// ─────────────────────────────────────────────────────────────
export const PARTICLES = {
  /** Number of ambient floating particles */
  ambientCount: 15,
  /** Burst particles on each click */
  clickBurstCount: 20,
  /** Sparkle particles on each click */
  clickSparkleCount: 6,
  /** Gravity for burst particles (acceleration per frame) */
  burstGravity: 0.04,
  /** Gravity for sparkle particles */
  sparkleGravity: 0.02,
  /** Floating text duration before removal (ms) */
  floatingTextDurationMs: 1500,
  /** Cookie flash effect duration (ms) */
  flashDurationMs: 300,
  /** Ripple removal delay (ms) */
  rippleRemovalMs: 700,
  /** Delay between layered ripples (ms) */
  rippleLayerDelayMs: 80,
};

// ─────────────────────────────────────────────────────────────
//  PRESTIGE / HEAVENLY CHIPS
// ─────────────────────────────────────────────────────────────
export const PRESTIGE = {
  /** Heavenly chip formula: floor( (totalCookies / divisor) ^ exponent ) */
  chipDivisor: 1e12,
  chipExponent: 0.45,
  /** CPS bonus per heavenly chip (0.01 = +1% each) */
  bonusPerChip: 0.01,
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
//  MINI-GAMES — reward tiers
// ─────────────────────────────────────────────────────────────
export const MINI_GAME_REWARDS = {
  /**
   * CPS bonus: reward += CPS × multiplier
   *   jackpot / great / normal
   */
  cpsMultiplier:    { jackpot: 120, great: 60,  normal: 30 },
  /** Cookie percentage: reward += cookies × percentage */
  cookiePercent:    { jackpot: 0.08, great: 0.05, normal: 0.03 },
  /** Click dedication: reward += sqrt(totalClicks) × multiplier */
  clickMultiplier:  { jackpot: 3, great: 2, normal: 1 },
  /** Empire bonus: reward += totalBuildings × multiplier */
  empireMultiplier: { jackpot: 15, great: 8, normal: 4 },
  /** Prestige bonus: reward += heavenlyChips × multiplier */
  prestigeMultiplier: { jackpot: 5, great: 3, normal: 1 },
  /** Minimum floor reward */
  floor:            { jackpot: 500, great: 200, normal: 50 },
};

// ─────────────────────────────────────────────────────────────
//  MINI-GAMES — individual game settings
// ─────────────────────────────────────────────────────────────
export const MINI_GAME_SETTINGS = {
  slots: {
    /** Number of spins per session */
    maxSpins: 3,
    /** Symbols on the reels */
    symbols: ["🍪", "🎂", "🧁", "🍩", "🥐", "🍰", "👵", "⭐"],
    /** Delay per reel stop (ms) */
    reelStopDelays: [800, 1400, 2000],
    /** Spin animation interval (ms) */
    spinIntervalMs: 80,
    /** Result display time before close (ms) */
    resultDisplayMs: 2500,
  },

  speedClick: {
    /** Duration of the clicking phase (ms) */
    durationMs: 5000,
    /** Thresholds: clicks required for each tier */
    greatThreshold: 40,
    normalThreshold: 25,
    minThreshold: 15,
    /** Result display time (ms) */
    resultDisplayMs: 2500,
  },

  cookieCatch: {
    /** Game duration (ms) */
    durationMs: 6000,
    /** Cookie spawn interval range (ms) — random between min and min+range */
    spawnIntervalMinMs: 250,
    spawnIntervalRangeMs: 350,
    /** How long each cookie stays before vanishing (ms) */
    cookieLifetimeMs: 1100,
    /** Score thresholds */
    greatThreshold: 10,
    normalThreshold: 4,
    /** Emoji pool for falling cookies */
    emojis: ["🍪", "🍪", "🍪", "🧁", "🍩"],
    /** Result display time (ms) */
    resultDisplayMs: 2500,
  },

  trivia: {
    /** Auto-close timeout if no answer (ms) */
    autoCloseMs: 10000,
    /** Result display time (ms) */
    resultDisplayMs: 2500,
    /** Time-up display time (ms) */
    timeUpDisplayMs: 2000,
  },

  emojiMemory: {
    /** Number of pairs to match */
    totalPairs: 5,
    /** Auto-close timeout (ms) */
    autoCloseMs: 25000,
    /** Mismatched cards flip-back delay (ms) */
    mismatchDelayMs: 600,
    /** "Great" tier threshold (moves ≤ this) */
    greatMovesThreshold: 8,
    /** Partial reward: need at least this many pairs when time runs out */
    partialRewardMinPairs: 3,
    /** Emoji pool to choose pairs from */
    emojiPool: ["🍪", "👵", "🏭", "🌾", "⚗️", "🚀", "🌀", "⏳", "⚛️", "🌈"],
    /** Result display time (ms) */
    resultDisplayMs: 2500,
    /** Time-up display time (ms) */
    timeUpDisplayMs: 2000,
  },
};

// ─────────────────────────────────────────────────────────────
//  VISUAL EFFECTS — viewport rain, shimmers, bursts
// ─────────────────────────────────────────────────────────────
export const VISUAL = {
  rain: {
    /** Base raindrop count (at 0 CPS) */
    baseCount: 40,
    /** Initial seed count */
    seedCount: 40,
    /** Log-CPS scaling: count += logCps × countScale */
    countScale: 8,
    /** Log-CPS speed scaling: speed = 1 + logCps × speedScale */
    speedScale: 0.08,
    /** Max raindrop count clamp */
    maxCount: 200,
    /** Max speed multiplier clamp */
    maxSpeedMult: 3,
    /** Intensity recalculation interval (ms) */
    intensityUpdateMs: 500,
  },

  rainFrenzy: {
    /** Extra drops during click frenzy */
    clickExtraDrops: 40,
    clickSpeedMult: 2.5,
    /** Extra drops during CPS frenzy */
    cpsExtraDrops: 25,
    cpsSpeedMult: 2.0,
  },

  raindrop: {
    /** Size range: random × sizeRange + sizeMin */
    sizeMin: 8,
    sizeRange: 14,
    /** Speed range */
    speedMin: 0.4,
    speedRange: 1.2,
    /** Wobble amplitude range */
    wobbleAmpMin: 0.3,
    wobbleAmpRange: 1.5,
    /** Wobble speed range */
    wobbleSpeedMin: 0.01,
    wobbleSpeedRange: 0.03,
    /** Opacity range */
    opacityMin: 0.15,
    opacityRange: 0.35,
  },

  shimmers: {
    /** Initial shimmer sparkle count */
    seedCount: 12,
    /** Radius range */
    radiusMin: 1,
    radiusRange: 2.5,
    /** Animation speed range */
    speedMin: 0.02,
    speedRange: 0.04,
  },

  burst: {
    /** Pre-allocated burst pool capacity */
    poolCap: 200,
    /** Default burst count */
    defaultCount: 20,
    /** Default burst speed multiplier */
    defaultSpeed: 2.5,
  },

  /** Animation loop throttle (~30fps) in ms */
  frameThrottleMs: 32,
};

// ─────────────────────────────────────────────────────────────
//  NEWS TICKER
// ─────────────────────────────────────────────────────────────
export const NEWS = {
  /** Normal rotation interval (ms) */
  rotationIntervalMs: 9000,
  /** Chance of a rare news story per rotation (0.01 = 1%) */
  rareChance: 0.01,
  /** How long rare headlines stay visible before resuming (ms) */
  rareLingerMs: 15000,
  /** How long rare styling stays active (ms) */
  rareStylingMs: 14000,

  /** Normal news messages */
  messages: [
    "News: cookie production is at an all-time high!",
    "Tip: click the golden cookie for massive bonuses!",
    "Grandma says: \"Back in my day, we baked by hand.\"",
    "Scientists discover cookie-based energy source.",
    "Breaking: local bakery can't keep up with demand!",
    "Cookie stocks soar as production accelerates.",
    "Rumor: ancient cookie recipe found in forgotten temple.",
    "Weather forecast: scattered cookie crumbs with a chance of sprinkles.",
    "Economists baffled by cookie-based economy.",
    "New study: clicking cookies is great exercise.",
    "Alert: cookie reserves reaching critical mass!",
    "Grandma's secret: always use real butter.",
    "Archaeologists unearth prehistoric cookie mold.",
    "Cookie monster sighted near factory district.",
    "Breaking: cookies declared the fifth food group.",
    "Local farms report record chocolate chip harvests.",
    "The cookie singularity approaches...",
    "Experts warn: too many cookies may cause happiness.",
    "Portal technology now powered entirely by cookies.",
    "Time travelers confirm: cookies are eternal.",
    "Breaking: world's largest cookie measured at 40 feet across.",
    "Grandma just unlocked a new recipe. She won't share it.",
    "Cookie dough futures hit record high on the stock exchange.",
    "Tip: upgrades stack multiplicatively. Buy them early!",
    "Scientists confirm: the universe smells faintly of vanilla.",
    "Local cursor union demands shorter clicking hours.",
    "New flavor discovered: quantum chocolate chip.",
    "Warning: cookie output exceeds local storage capacity.",
    "Grandma's advice: never trust a cookie that doesn't crumble.",
    "Shipment of cookies intercepted by hungry delivery drivers.",
    "Mining operation uncovers vast underground cookie vein.",
    "Factory workers report cookies are baking themselves now.",
    "Alchemy lab successfully turns lead into cookie dough.",
    "Portal malfunction sends cookies to parallel universe.",
    "Time machine retrieves cookies from the far future. They're still fresh.",
    "Antimatter condenser creates cookies from pure energy.",
    "Prism refracts sunlight into rainbow-flavored cookies.",
    "Chancemaker rolls a natural 20. Double cookie output!",
    "Fractal engine generates infinite cookie recursion. Delicious.",
    "Survey: 9 out of 10 grandmas recommend more grandmas.",
    "Cookie-based cryptocurrency launches. Somehow less volatile than Bitcoin.",
    "Motivational poster in factory reads: 'Every cookie counts.'",
    "Fun fact: if you stacked all your cookies, they'd reach the moon. Twice.",
    "Intern accidentally eats prototype cookie. Gains temporary omniscience.",
    "New law requires all buildings to be made of at least 30% cookie.",
    "Cookies per second now classified as a unit of measurement.",
    "Your cursor has filed a restraining order against your mouse.",
    "Grandma's book club is now just a cookie exchange ring.",
    "R&D team invents self-clicking cookie. Patent pending.",
    "Local news: residents complain about constant cookie smell. Secretly love it.",
  ],

  /** Rare news messages (shown with special effects) */
  rareMessages: [
    "BREAKING: Cookie discovered on Mars. NASA denies involvement.",
    "Grandma spotted bench-pressing a rolling pin. Authorities baffled.",
    "Time travelers warn: do NOT eat the cookie from 3024.",
    "Local man claims cookie talked to him. Cookie declines interview.",
    "Scientists prove cookies are 4th-dimensional objects. Nobody understands the paper.",
    "Cookie rain reported in downtown area. Citizens advised to bring plates.",
    "Philosopher asks: if a cookie crumbles and no one is around, does it make a sound?",
    "Aliens make first contact. They want the cookie recipe.",
    "Underground cookie fight club exposed. First rule: always share crumbs.",
    "Researchers find that 99.7% of the universe is made of cookies. The rest is milk.",
    "Portal to cookie dimension discovered in grandma's basement.",
    "EXCLUSIVE: Cookie monster reveals he's actually a cookie all along.",
    "Ancient prophecy foretold: 'When the cookies number as the stars, the baker shall ascend.'",
    "Quantum physicist bakes Schrodinger's Cookie. It's both delicious and stale.",
    "Cookie-powered spacecraft achieves light speed. Tastes slightly burnt.",
    "Breaking: the moon is actually a giant cookie. Always has been.",
    "Stock exchange replaced by cookie exchange. Economy thrives.",
    "Grandma achieves enlightenment through baking. Opens monastery.",
    "ERROR: Reality.js line 42: too many cookies. Wrapping to negative infinity.",
    "The simulation theory is true and we're all inside a cookie clicker game.",
  ],
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

// ─────────────────────────────────────────────────────────────
//  MILK LEVEL (visual — rises with achievement %)
// ─────────────────────────────────────────────────────────────
export const MILK = {
  /** Maximum milk height as % of panel */
  maxHeightPct: 45,
  /** Achievement % to milk height conversion factor */
  heightFactor: 0.65,
  /** Milk color thresholds (achievement %) */
  goldenThreshold: 80,
  lavenderThreshold: 50,
  warmThreshold: 25,
};

// ─────────────────────────────────────────────────────────────
//  INCOME RAIN (burst proportional to income received)
// ─────────────────────────────────────────────────────────────
export const INCOME_RAIN = {
  /** Burst count: log2(secondsWorth + 1) × countScale, clamped to [minCount, maxCount] */
  countScale: 15,
  minCount: 5,
  maxCount: 120,
  /** Speed: 1.5 + log10(secondsWorth + 1) × speedScale, clamped to [minSpeed, maxSpeed] */
  speedScale: 0.8,
  minSpeed: 2,
  maxSpeed: 4,
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

// ─────────────────────────────────────────────────────────────
//  TRIVIA QUESTIONS  (used by the Trivia mini-game)
// ─────────────────────────────────────────────────────────────
export const TRIVIA_QUESTIONS = [
  { q: "What's the most expensive cookie ingredient?", a: ["Saffron", "Vanilla", "Butter", "Sugar"], correct: 0 },
  { q: "Where was the chocolate chip cookie invented?", a: ["Massachusetts", "France", "Italy", "California"], correct: 0 },
  { q: "What's a cookie called in the UK?", a: ["Biscuit", "Crumpet", "Scone", "Pastry"], correct: 0 },
  { q: "How many cookies does the avg American eat yearly?", a: ["~35 lbs", "~10 lbs", "~5 lbs", "~50 lbs"], correct: 0 },
  { q: "What year was the Oreo first sold?", a: ["1912", "1935", "1899", "1952"], correct: 0 },
  { q: "Which country eats the most cookies per capita?", a: ["Netherlands", "USA", "France", "Japan"], correct: 0 },
  { q: "What gives snickerdoodles their flavor?", a: ["Cinnamon sugar", "Nutmeg", "Ginger", "Cardamom"], correct: 0 },
  { q: "What's the cookie emoji unicode?", a: ["U+1F36A", "U+1F370", "U+1F382", "U+1F369"], correct: 0 },
  { q: "What does 'cookie' mean in Dutch?", a: ["Little cake", "Round bread", "Sweet disk", "Baked snack"], correct: 0 },
  { q: "Which Girl Scout cookie sells the most?", a: ["Thin Mints", "Samoas", "Tagalongs", "Do-si-dos"], correct: 0 },
  { q: "What's the world record for largest cookie weight?", a: ["~40,000 lbs", "~10,000 lbs", "~5,000 lbs", "~100,000 lbs"], correct: 0 },
  { q: "Fortune cookies were invented in which country?", a: ["USA (by Japanese immigrants)", "China", "Japan", "Korea"], correct: 0 },
  { q: "What's the key ingredient in macaron shells?", a: ["Almond flour", "Wheat flour", "Coconut flour", "Rice flour"], correct: 0 },
  { q: "Cookies were originally used for what?", a: ["Testing oven temperature", "Religious offerings", "Currency", "Medicine"], correct: 0 },
  { q: "What cookie has an 'O-R-E-O' on every piece?", a: ["Oreo", "Hydrox", "Chips Ahoy", "Nutter Butter"], correct: 0 },
  { q: "Milano cookies are made by which brand?", a: ["Pepperidge Farm", "Nabisco", "Keebler", "Pillsbury"], correct: 0 },
  { q: "What's the filling in an Oreo primarily made of?", a: ["Sugar & vegetable oil", "Cream cheese", "Butter", "Whipped cream"], correct: 0 },
  { q: "Which cookie is traditionally left for Santa?", a: ["Chocolate chip", "Oatmeal raisin", "Sugar cookie", "Gingerbread"], correct: 0 },
  { q: "Biscotti means what in Italian?", a: ["Twice baked", "Sweet bread", "Hard cookie", "Almond snack"], correct: 0 },
  { q: "What temperature is ideal for baking cookies (°F)?", a: ["350°F", "275°F", "425°F", "500°F"], correct: 0 },
];
