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

  /** Multiplier bar log scaling — individual bars: log10(v) × this = bar%. 50 → 100% at x100 */
  multiplierBarLogScale: 50,
  /** Combined multiplier bar log scaling — 25 → 100% at x10000 */
  combinedBarLogScale: 25,
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
//  MINI-GAMES — reward tiers
// ─────────────────────────────────────────────────────────────
export const MINI_GAME_REWARDS = {
  /**
   * Reward formula uses diminishing returns to soft-cap relative to cookies:
   *   raw = CPS × cpsMult + sqrt(clicks) × clickMult + buildings × empireMult + chips × prestMult
   *   scaling = raw / (raw + cookies)            ← approaches 1 but never reaches it
   *   reward = cookies × scaling × tierScale     ← self-limiting, no hard cap
   *
   * No ceiling — infinite cookies = infinite reward. The formula naturally prevents
   * rewards from exceeding cookies since scaling < 1 always.
   */
  cpsMultiplier:      { legendary: 1500, epic: 1000, jackpot: 600, great: 300, normal: 150 },
  /** Click dedication: raw += sqrt(totalClicks) × multiplier */
  clickMultiplier:    { legendary: 40,  epic: 25,  jackpot: 15,  great: 10,  normal: 5 },
  /** Empire bonus: raw += totalBuildings × multiplier */
  empireMultiplier:   { legendary: 200, epic: 120, jackpot: 75,  great: 40,  normal: 20 },
  /** Prestige bonus: raw += spendableChips × multiplier */
  prestigeMultiplier: { legendary: 60,  epic: 40,  jackpot: 25,  great: 15,  normal: 5 },
  /** Tier scaling — multiplier on the final reward (no hard cap, formula self-limits) */
  tierScale:          { legendary: 1.0, epic: 0.70, jackpot: 0.50, great: 0.30, normal: 0.15 },
  /** Minimum floor reward (early game when cookies are very low) */
  floor:              { legendary: 2000, epic: 1000, jackpot: 500,  great: 200,  normal: 50 },
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

  // ═══════════════════════════════════════════════════════════
  //  NEW EXTENDED MINIGAMES (higher rewards for longer play)
  // ═══════════════════════════════════════════════════════════

  cookieCutter: {
    /** Time limit (ms) */
    durationMs: 25000,
    /** Canvas size */
    canvasSize: 280,
    /** Line width for the shape outline (dashed) */
    shapeLineWidth: 8,
    /** User's drawing line width */
    drawLineWidth: 4,
    /** Points along path for scoring */
    pathResolution: 100,
    /** Max distance from line to still get points (pixels) - stricter scoring */
    maxScoringDistance: 18,
    /** Available shapes */
    shapes: ['circle', 'star', 'heart', 'umbrella', 'triangle', 'diamond', 'hexagon', 'crescent', 'flower', 'cross'],
    /** Score thresholds (0-100 accuracy percentage) - stricter */
    legendaryThreshold: 85,
    epicThreshold: 70,
    greatThreshold: 55,
    normalThreshold: 35,
    /** Result display time (ms) */
    resultDisplayMs: 3000,
  },

  cookieDefense: {
    /** Planning phase duration (ms) - time to place towers */
    planningPhaseMs: 60000,
    /** Battle phase duration (ms) */
    battlePhaseMs: 25000,
    /** Starting lives (cookies) */
    startingLives: 5,
    /** Grid size for the level */
    gridCols: 10,
    gridRows: 7,
    /** Enemy spawn interval during battle (ms) */
    enemySpawnIntervalMs: 1200,
    /** Total enemies to spawn */
    totalEnemies: 22,
    /** Enemy base speed (cells per second) */
    enemyBaseSpeed: 1.0,
    /** Tower types - distinct roles */
    towers: [
      { id: "cursor", emoji: "👆", name: "Cursor", damage: 1, range: 1.2, fireRate: 400, color: "#60a5fa", desc: "⚡ Rapid Fire", details: "DMG: 1 | RNG: Short | SPD: Very Fast" },
      { id: "grandma", emoji: "👵", name: "Grandma", damage: 3, range: 2.0, fireRate: 1000, color: "#f472b6", desc: "💪 Heavy Hitter", details: "DMG: 3 | RNG: Medium | SPD: Slow" },
      { id: "farm", emoji: "🌾", name: "Farm", damage: 1, range: 3.0, fireRate: 700, color: "#4ade80", desc: "🎯 Sniper", details: "DMG: 1 | RNG: Long | SPD: Medium" },
    ],
    /** Enemy types - buffed health and speed */
    enemies: [
      { emoji: "🐜", name: "Ant", health: 5, speed: 1.2 },
      { emoji: "🐛", name: "Caterpillar", health: 10, speed: 0.7 },
      { emoji: "🐁", name: "Mouse", health: 7, speed: 1.5 },
      { emoji: "🦗", name: "Cricket", health: 4, speed: 2.0 },
      { emoji: "🪲", name: "Beetle", health: 14, speed: 0.9 },
    ],
    /** Towers allowed - always 3 (one of each type) */
    towersAllowed: 3,
    /** Reward tiers based on lives remaining */
    legendaryLives: 5,
    epicLives: 4,
    greatLives: 3,
    normalLives: 1,
    /** Result display time (ms) */
    resultDisplayMs: 3000,
  },

  grandmasKitchen: {
    /** Game duration (ms) */
    durationMs: 18000,
    /** Number of ovens */
    ovenCount: 4,
    /** Baking time range (ms) */
    bakeTimeMin: 2000,
    bakeTimeMax: 3500,
    /** Perfect timing window (ms before/after optimal) */
    perfectWindowMs: 350,
    goodWindowMs: 700,
    /** Time before cookie burns after optimal (ms) */
    burnWindowMs: 900,
    /** Points per cookie */
    perfectPoints: 20,
    goodPoints: 12,
    okPoints: 5,
    burntPoints: -8,
    rawPoints: 0,
    /** Score thresholds */
    legendaryThreshold: 100,
    epicThreshold: 70,
    greatThreshold: 45,
    normalThreshold: 20,
    /** Spawn interval for new cookies (ms) */
    cookieSpawnIntervalMin: 1200,
    cookieSpawnIntervalMax: 2200,
    /** Result display time (ms) */
    resultDisplayMs: 2500,
  },

  mathBaker: {
    /** Game duration (ms) */
    durationMs: 18000,
    /** Time per question (ms) */
    questionTimeMs: 6000,
    /** Points per correct answer */
    correctPoints: 15,
    /** Bonus points for fast answer (under 2 seconds) */
    fastBonusPoints: 10,
    /** Points lost for wrong answer */
    wrongPenalty: 5,
    /** Score thresholds */
    legendaryThreshold: 80,
    epicThreshold: 60,
    greatThreshold: 40,
    normalThreshold: 20,
    /** Difficulty settings */
    easyMaxNumber: 20,
    mediumMaxNumber: 50,
    hardMaxNumber: 100,
    /** Questions ramp up difficulty over time */
    easyQuestionsCount: 2,
    mediumQuestionsCount: 2,
    /** Result display time (ms) */
    resultDisplayMs: 2500,
  },

  dungeon: {
    totalFloors: 5,
    entryFeeMultiplier: 8,
    // Player
    baseHp: 100, hpPerBuilding: 0.2, baseAtk: 12, atkCpsScale: 0.0002, atkCap: 35,
    potions: 2, potionHeal: 0.35,
    // Combat
    critChance: 0.12, critMult: 1.75,
    blockPercent: 0.65,
    heavyAtkMult: 1.6,       // player heavy attack: 1.6x dmg but skip next turn
    scoutCost: 0.08,          // scout costs 8% of max HP
    // Enemy AI — context-aware, not random pool
    enemyHeavyChance: 0.2,    // 20% chance of heavy (increased for bosses)
    enemyBlockChance: 0.15,   // 15% chance to block
    enemyHealChance: 0.25,    // heal when below 70% HP, 25% chance
    enemyHealAmount: 0.2,     // heals 20% of max HP
    enemyFleeHpThreshold: 0.5, // can flee below 50% HP
    enemyFleeChance: 0.08,    // 8% chance to flee (rare)
    heavyMult: 1.7,           // enemy heavy does 1.7x
    enemyBlockReduction: 0.5, // enemy block reduces player dmg by 50%
    // Enemy pools by tier (randomly picked per floor)
    enemyTiers: [
      // Tier 1 — floors 1-2
      [
        { name: "Stale Cookie",    emoji: "🍘", hp: 55, atk: 13 },
        { name: "Crumb Rat",       emoji: "🐀", hp: 50, atk: 15 },
        { name: "Flour Phantom",   emoji: "👻", hp: 48, atk: 16 },
        { name: "Moldy Morsel",    emoji: "🦠", hp: 52, atk: 12 },
      ],
      // Tier 2 — floors 3-4
      [
        { name: "Raisin Imposter", emoji: "🫘", hp: 80, atk: 20 },
        { name: "Burnt Batch",     emoji: "🌋", hp: 85, atk: 21 },
        { name: "Cookie Golem",    emoji: "🗿", hp: 90, atk: 18 },
        { name: "Sugar Wraith",    emoji: "💀", hp: 75, atk: 23 },
        { name: "Dough Beast",     emoji: "🫠", hp: 95, atk: 17 },
      ],
      // Tier 3 — elite
      [
        { name: "Grandma's Wrath", emoji: "👹", hp: 110, atk: 26 },
        { name: "Sugar Elemental", emoji: "⚡", hp: 120, atk: 25 },
        { name: "Oven Fiend",      emoji: "😈", hp: 115, atk: 28 },
        { name: "Frosting Hydra",  emoji: "🐲", hp: 125, atk: 24 },
      ],
    ],
    // Boss pool — one randomly chosen per run
    bosses: [
      { name: "Cookie Dragon",     emoji: "🐉", hp: 280, atk: 34 },
      { name: "The Grand Grandma", emoji: "👑", hp: 260, atk: 36 },
      { name: "Dough Titan",       emoji: "🦍", hp: 300, atk: 32 },
      { name: "Infernal Oven",     emoji: "🌋", hp: 240, atk: 38 },
    ],
    /** Which tier to use per floor index (0-based). Last floor is always boss. */
    floorTiers: [0, 0, 1, 1, 2],
    depthScale: 0.15,
    loot: [
      { icon: "🗡️", label: "+3 Attack",     apply: (p) => { p.atk += 3; } },
      { icon: "🛡️", label: "+15 Max HP",    apply: (p) => { p.maxHp += 15; p.hp = Math.min(p.hp + 15, p.maxHp); } },
      { icon: "🧪", label: "+1 Potion",     apply: (p) => { p.potions++; } },
      { icon: "❤️‍🩹", label: "Heal 40%",      apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.4)); } },
      { icon: "🎯", label: "+10% Crit",     apply: (p) => { p.critChance = Math.min(0.5, p.critChance + 0.1); } },
      { icon: "⚡", label: "Next hit 2x",   apply: (p) => { p.x2 = true; } },
    ],
    rewardTiers: { 5: "legendary", 4: "epic", 3: "great", 2: "normal", 1: "normal", 0: null },
  },

  safeCracker: {
    /** Total time limit (ms) */
    durationMs: 30000,
    /** Combo length (how many numbers to crack) */
    comboLength: 3,
    /** Dial range: numbers go from 0 to dialMax-1 */
    dialMax: 40,
    /** Tolerance: how close the player needs to be (±this many ticks) to start hold */
    tolerance: 1,
    /** Near-zone size for deeper clicks and glow hints (±this many ticks) */
    nearZone: 5,
    /** How long to hold on the correct number to lock it (ms) */
    holdDurationMs: 800,
    /** Directions: alternating CW/CCW for each combo number */
    directions: ['cw', 'ccw', 'cw'],
    /** Score thresholds (seconds remaining when cracked) */
    legendaryThreshold: 15,
    epicThreshold: 10,
    greatThreshold: 5,
    normalThreshold: 0,
    /** Result display time (ms) */
    resultDisplayMs: 2500,
  },

  cookieLaunch: {
    /** Number of rounds */
    rounds: 3,
    /** Canvas dimensions — large for comfortable dragging */
    canvasWidth: 520,
    canvasHeight: 320,
    /** Ground Y level (flat ground across entire canvas) */
    groundY: 260,
    /** Gravity (pixels/frame²) */
    gravity: 0.22,
    /** Wind range (pixels/frame, randomised per round) */
    windMin: -0.06,
    windMax: 0.06,
    /** Launch power scaling (drag distance → velocity) */
    powerScale: 0.11,
    /** Max drag distance for power */
    maxDrag: 140,
    /** Launcher X position (fixed) */
    launcherX: 100,
    /** Target distance from launcher (randomised per round) */
    targetDistMin: 180,
    targetDistMax: 360,
    /** Wall bounce restitution (left/right walls) */
    wallBounce: 0.5,
    /** Trickshot bonus points for scoring via wall bounce */
    trickshotBonus: 25,
    /** Bounce physics */
    bounceRestitution: 0.45,
    bounceFriction: 0.8,
    maxBounces: 3,
    /** Rolling ground friction (multiplied per frame) */
    rollFriction: 0.94,
    /** Minimum vx to stop rolling */
    rollStopThreshold: 0.3,
    /** Trajectory preview max length (frames to simulate) */
    previewMaxFrames: 35,
    /** Obstacle wall settings (round 3 only) */
    obstacleRound: 3,
    /** Obstacle X: fraction of distance between launcher and target (0.3-0.7) */
    obstacleXFracMin: 0.3,
    obstacleXFracMax: 0.7,
    /** Obstacle height: fraction of play area (ground to top), max 70% */
    obstacleHeightMin: 0.3,
    obstacleHeightMax: 0.7,
    /** Obstacle width in pixels */
    obstacleWidth: 10,
    /** Bullseye radius and zone radii for scoring */
    bullseyeRadius: 14,
    greatRadius: 36,
    okRadius: 64,
    /** Points per hit zone */
    bullseyePoints: 100,
    greatPoints: 60,
    okPoints: 30,
    missPoints: 0,
    /** Score thresholds (total across all rounds) */
    legendaryThreshold: 260,
    epicThreshold: 180,
    greatThreshold: 100,
    normalThreshold: 30,
    /** Result display time (ms) */
    resultDisplayMs: 2500,
  },

  cookieWordle: {
    /** Word length */
    wordLength: 5,
    /** Max guesses */
    maxGuesses: 6,
    /** Score thresholds (guesses used — fewer = better) */
    legendaryGuesses: 2,
    epicGuesses: 3,
    greatGuesses: 4,
    normalGuesses: 6,
    /** Result display time (ms) */
    resultDisplayMs: 3000,
    /** Word pool — 5-letter baking/cookie themed words */
    words: [
      'FLOUR', 'SUGAR', 'CREAM', 'DOUGH', 'BATCH',
      'SWEET', 'FROST', 'YEAST', 'CRUST', 'GLAZE',
      'BLEND', 'WHISK', 'KNEAD', 'RISEN', 'TOAST',
      'CANDY', 'FUDGE', 'SCONE', 'SPICE', 'HONEY',
      'MAPLE', 'COCOA', 'CRUMB', 'FLAKY', 'MOIST',
      'BAKED', 'MIXER', 'GRAIN', 'ROLLS', 'ICING',
      'MOCHA', 'PECAN', 'LEMON', 'GRATE', 'SIFTS',
      'TORTE', 'TREAT', 'CRISP', 'LAYER', 'PLATE',
    ],
  },

  cookieAssembly: {
    rounds: 3,
    categoriesPerRound: [3, 4, 5],
    roundTimeMs: 10000,
    correctPoints: 20,
    timeBonusPerSec: 2,
    legendaryThreshold: 250,
    epicThreshold: 200,
    greatThreshold: 140,
    normalThreshold: 60,
    resultDisplayMs: 2500,
    /** Canvas size for cookie preview */
    cookieSize: 130,
    /** Categories — id-based, all drawing done in code */
    categories: [
      { name: 'Shape', options: ['circle', 'square', 'star', 'heart', 'diamond'] },
      { name: 'Color', options: ['golden', 'brown', 'pink', 'ivory', 'dark'] },
      { name: 'Topping', options: ['chips', 'sprinkles', 'nuts', 'raisins', 'none'] },
      { name: 'Drizzle', options: ['chocolate', 'caramel', 'strawberry', 'white', 'none'] },
      { name: 'Garnish', options: ['cherry', 'mint', 'powdered', 'frosting', 'none'] },
    ],
    /** Color map for cookie base */
    colorMap: {
      golden: '#d4a050', brown: '#8B4513', pink: '#e8a0b4', ivory: '#f0ead6', dark: '#3d1f0a',
    },
    /** Drizzle color map */
    drizzleMap: {
      chocolate: '#3a1a08', caramel: '#c8860a', strawberry: '#d4456a', white: '#f5f0dc',
    },
    /** Display labels */
    labels: {
      circle: 'Round', square: 'Square', star: 'Star', heart: 'Heart', diamond: 'Diamond',
      golden: 'Golden', brown: 'Brown', pink: 'Pink', ivory: 'Ivory', dark: 'Dark',
      chips: 'Choc Chips', sprinkles: 'Sprinkles', nuts: 'Nuts', raisins: 'Raisins',
      chocolate: 'Chocolate', caramel: 'Caramel', strawberry: 'Strawberry', white: 'White',
      cherry: 'Cherry', mint: 'Mint Leaf', powdered: 'Powdered', frosting: 'Frosting',
      none: 'None',
    },
  },

  // cookieAlchemy — all config moved to js/cookieAlchemy.js
};

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
//  MATH BAKER OPERATIONS  (used by the Math Baker mini-game)
// ─────────────────────────────────────────────────────────────
export const MATH_OPERATIONS = {
  easy: ['+', '-'],
  medium: ['+', '-', '×'],
  hard: ['+', '-', '×', '÷'],
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

// ─────────────────────────────────────────────────────────────
//  SHOP VISUAL EFFECTS
// ─────────────────────────────────────────────────────────────
export const SHOP_VISUAL = {
  frameThrottleMs: 33,  // ~30fps

  background: {
    dustCount: 30,
    sparkleCount: 15,
    crumbCount: 12,
    dustSpeedMin: 0.08,
    dustSpeedRange: 0.25,
    dustSizeMin: 1,
    dustSizeRange: 2.5,
    crumbRiseSpeed: 0.15,
    crumbRiseSpeedRange: 0.12,
  },

  rows: {
    baseOpacity: 0.08,
    maxOpacity: 0.22,
    animSpeedBase: 0.6,
    warmUndertone: [255, 200, 140],
  },

  scroll: {
    parallaxLayer1: 0.3,
    parallaxLayer2: 0.6,
    parallaxLayer3: 1.0,
    edgeGlowIntensity: 0.15,
  },

  dock: {
    maxScale: 1.06,        // scale of the row directly under the mouse
    minScale: 0.97,        // scale of rows far from the mouse
    sigma: 90,             // gaussian spread in pixels (how far the effect reaches)
    restScale: 1.0,        // scale when mouse is not over the list
    lerpSpeed: 0.18,       // interpolation speed toward target (0-1, per frame)
    maxMargin: 12,         // extra vertical margin (px) for the row closest to mouse
    baseMargin: 5,         // default row margin when mouse is away
  },

  upgradeTilt: {
    maxRotate: 10,         // max tilt angle in degrees (card directly under mouse)
    sigma: 120,            // gaussian spread in px (how far the effect reaches)
    lerpSpeed: 0.18,       // interpolation speed toward target (0-1 per frame)
    returnSpeed: 0.12,     // speed at which cards return to flat
    maxLiftZ: 6,           // max translateZ (px) for closest card
    maxShine: 0.85,        // max shine opacity for closest card
  },

  header: {
    swayAmount: 1.5,
    swaySpeed: 1.2,
    lanternFlickerSpeed: 1.2,
    chainLinks: 5,
  },
};

// ─────────────────────────────────────────────────────────────
//  GRANDMAPOCALYPSE
// ─────────────────────────────────────────────────────────────
export const GRANDMAPOCALYPSE = {
  // ── Wrinkler Settings ──
  maxWrinklers: 12,
  shinyWrinklerChance: 0.004,            // 0.4% — very rare
  elderWrinklerChance: 0.08,             // 8% chance a wrinkler is an Elder Wrinkler (stage 3 only)
  wrinklerSpawnIntervalBase: 22,         // seconds between spawn attempts at stage 1
  wrinklerSpawnChancePerAttempt: 0.35,
  wrinklerCpsDrainFraction: 0.06,        // each normal wrinkler eats 6% of CPS
  elderWrinklerDrainFraction: 0.08,      // elder wrinklers eat 8% — greedy
  wrinklerReturnMultiplier: 1.1,         // returns 110%
  elderWrinklerReturnMultiplier: 1.5,    // elder wrinklers return 150% — worth the pain
  shinyReturnMultiplier: 3.5,            // shiny returns 350%
  wrinklerSizeMin: 28,
  wrinklerSizeMax: 40,
  elderWrinklerSizeMin: 38,              // elder wrinklers are bigger
  elderWrinklerSizeMax: 50,

  // ── Wrath Cookie Probabilities Per Stage [0, 1, 2, 3] ──
  wrathCookieProbability: [0, 0.45, 0.80, 1.0],

  // ── Wrath Cookie Spawn Speed Multiplier Per Stage ──
  // At higher stages, wrath cookies appear more often (multiply golden cookie delay)
  wrathSpawnSpeedMult: [1.0, 0.85, 0.65, 0.5],

  // ── Wrath Cookie Outcome Tables Per Stage ──
  // Stage 1: introduction — mostly mild with occasional sting
  wrathOutcomesStage1: {
    clotRollMax: 0.28,            // 28% Clot
    ruinRollMax: 0.42,            // 14% Ruin
    cursedFingersRollMax: 0.48,   // 6% Cursed Fingers
    buildingFreezeRollMax: 0.52,  // 4% Building Freeze (NEW)
    elderFrenzyRollMax: 0.66,     // 14% Elder Frenzy
    luckyRollMax: 0.84,           // 18% Lucky
    // 16% Cookie Storm
  },
  // Stage 2: punishing — negatives dominate, new horrors
  wrathOutcomesStage2: {
    clotRollMax: 0.26,            // 26% Clot
    ruinRollMax: 0.46,            // 20% Ruin
    cursedFingersRollMax: 0.55,   // 9% Cursed Fingers
    buildingFreezeRollMax: 0.62,  // 7% Building Freeze
    elderFrenzyRollMax: 0.74,     // 12% Elder Frenzy
    luckyRollMax: 0.86,           // 12% Lucky
    // 14% Cookie Storm
  },
  // Stage 3: absolute chaos — everything hits harder
  wrathOutcomesStage3: {
    clotRollMax: 0.22,            // 22% Clot (devastating)
    ruinRollMax: 0.42,            // 20% Ruin (half your bank)
    cursedFingersRollMax: 0.52,   // 10% Cursed Fingers
    buildingFreezeRollMax: 0.60,  // 8% Building Freeze
    elderFrenzyRollMax: 0.74,     // 14% Elder Frenzy (massive)
    luckyRollMax: 0.84,           // 10% Lucky
    // 16% Cookie Storm (huge)
  },

  // ── Wrath Effects Scale By Stage ──
  clot: {
    stage1: { multiplier: 0.5, durationSec: 60 },
    stage2: { multiplier: 0.25, durationSec: 88 },
    stage3: { multiplier: 0.1, durationSec: 120 },   // 90% CPS reduction for 2 MINUTES
  },
  ruin: {
    stage1: { cookieFractionLost: 0.15 },
    stage2: { cookieFractionLost: 0.40 },
    stage3: { cookieFractionLost: 0.60 },             // lose 60% of your bank
  },
  cursedFingers: {
    stage1: { multiplier: 0.1, durationSec: 25 },
    stage2: { multiplier: 0.03, durationSec: 40 },
    stage3: { multiplier: 0.005, durationSec: 60 },   // clicks essentially worthless for 1 minute
  },
  buildingFreeze: {
    stage1: { cpsFractionLost: 0.30, durationSec: 30 },  // 30% of buildings "stop" for 30s
    stage2: { cpsFractionLost: 0.50, durationSec: 45 },   // half production frozen
    stage3: { cpsFractionLost: 0.75, durationSec: 60 },   // 75% production frozen for a minute
  },
  elderFrenzy: {
    stage1: { multiplier: 666, durationSec: 6 },
    stage2: { multiplier: 2222, durationSec: 8 },
    stage3: { multiplier: 4444, durationSec: 7 },     // can earn hours of production in seconds
  },
  cookieStorm: {
    stage1: { cpsMultiplier: 3600, minCookies: 5000 },
    stage2: { cpsMultiplier: 10800, minCookies: 50000 },
    stage3: { cpsMultiplier: 66600, minCookies: 666666 },  // 18.5 hours of CPS in one click
  },

  // ── Cookie Decay — at stage 3, your cookies slowly rot ──
  // Lose a tiny fraction of your bank every second. Forces active play.
  cookieDecay: {
    stage1: 0,                  // no decay
    stage2: 0.00001,            // 0.001% per second — barely noticeable
    stage3: 0.0001,             // 0.01% per second — ~36% lost per hour if idle
  },

  // ── Elder Pledge — expensive, degrades over time ──
  pledgeBaseCost: 1000000,               // 1M base
  pledgeCostMultiplier: 3,               // triples each use
  pledgeDurationMs: 15 * 60 * 1000,     // only 15 minutes
  pledgeDurationDecayPerUse: 0.85,       // each pledge is 15% shorter than the last
  pledgeDurationMinMs: 1 * 60 * 1000,   // minimum 1 minute

  // ── Elder Covenant — devastating sacrifice ──
  covenantCpsPenalty: 0.15,              // -15% CPS

  // ── Research Chain Costs — heavy investment required ──
  researchCosts: [
    2000000,           // Bingo Center — 2M
    25000000,          // One Mind — 25M
    250000000,         // Communal Brainsweep — 250M
    2500000000,        // Elder Pact — 2.5B
    25000000000,       // Festive Baking — 25B
    250000000000,      // Unholy Bakery — 250B
  ],

  // ── News Messages Per Stage ──
  newsStage1: [
    "Grandma mutters something about 'the others'...",
    "Strange symbols appear in your grandma's cookies.",
    "Grandma's eyes went glassy for a moment. She says she's fine.",
    "A faint humming emanates from the grandma quarters.",
    "Several grandmas were found facing the same direction for no reason.",
    "Grandma keeps whispering numbers. They don't add up.",
    "The cookies taste... different today. Nobody can explain how.",
    "One of the grandmas drew something on the wall. We painted over it.",
    "Grandma asked who else is in the room. You were alone.",
    "The baking timers all stopped at the same second. Coincidence?",
  ],

  newsStage2: [
    "BREAKING: Grandma uprising reported in sector 7. Cookies blamed.",
    "The grandmas are no longer baking alone. They are one.",
    "Alert: grandma hivemind has established colony in your basement.",
    "Do not make eye contact with the grandmas. They know.",
    "Grandma production is off the charts. The charts are scared.",
    "We found the missing interns. They were in the cookie dough.",
    "The grandmas hum in unison now. The frequency makes dogs howl.",
    "HR has been dissolved. The grandmas deemed it unnecessary.",
    "The ovens bake at temperatures we didn't set. The cookies are perfect.",
    "Grandma asked to see the manager. All twelve of her.",
  ],

  newsStage3: [
    "THE ELDER ONES ARE AWAKE. COOKIES ARE JUST THE BEGINNING.",
    "Reality is thinning. Your cookies taste like regret.",
    "ERROR: grandma.exe has exceeded maximum permitted grandma.",
    "The flesh is sweet. The dough rises. We are become cookie.",
    "You did this. You brought this upon us all.",
    "The cookie is a door. The grandmas are the key. You are the lock.",
    "Time flows backwards in the bakery. The cookies un-eat themselves.",
    "The elder ones speak in a language made of cookie crumbs. We understand.",
    "Your browser cannot contain what the grandmas have become.",
    "The walls are dough. The sky is frosting. You are the sprinkle.",
    "Ph'nglui mglw'nafh Grandma R'lyeh wgah'nagl fhtagn.",
    "ALERT: The concept of 'enough cookies' has been permanently deleted.",
    "The wrinklers are not eating your cookies. They are translating them.",
    "Every cookie you bake feeds something beneath the bakery.",
    "The oven opened on its own. What came out was not a cookie.",
    "We counted the grandmas. There are more than we hired.",
    "The cookie dough is warm. It has a pulse.",
    "RUIN approaches. It always knew your name.",
    "The Elder Frenzy wasn't a gift. It was a taste.",
    "Your clicks echo in dimensions you cannot perceive.",
  ],

  // ── Stage Transition Messages ──
  stageTransitionMessages: [
    null,
    "The grandmas grow restless...",
    "The Grandmapocalypse has begun. There is no mercy here.",
    "THE ELDER PACT IS SEALED. YOU BELONG TO THEM NOW.",
  ],

  // ── Visual Theme Variables Per Stage ──
  themes: [
    { bgTint: 'none', cookieFilter: 'none', vignetteIntensity: 0, milkColor: null },
    { bgTint: 'rgba(80,20,0,0.08)', cookieFilter: 'sepia(0.2)', vignetteIntensity: 0.15, milkColor: null },
    { bgTint: 'rgba(120,10,10,0.18)', cookieFilter: 'sepia(0.5) hue-rotate(-20deg)', vignetteIntensity: 0.35, milkColor: '#8b0000' },
    { bgTint: 'rgba(60,0,0,0.30)', cookieFilter: 'sepia(0.8) hue-rotate(-35deg) saturate(1.8)', vignetteIntensity: 0.55, milkColor: '#5a0000' },
  ],
};
