
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

