
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
    minFloors: 8, maxFloors: 16,  // random floor count per run
    entryFeeMultiplier: 8,
    // Player
    baseHp: 120, hpPerBuilding: 0.2, baseAtk: 14, atkCpsScale: 0.0002, atkCap: 38,
    potions: 2, potionHeal: 0.35,
    // Combat
    critChance: 0.12, critMult: 1.75,
    blockPercent: 0.65,
    heavyAtkMult: 1.6,       // player heavy attack: 1.6x dmg but skip next turn
    scoutCost: 1,             // scout costs 1 flat HP
    // Enemy AI — context-aware, not random pool
    enemyHeavyChance: 0.2,    // 20% chance of heavy (increased for bosses)
    enemyBlockChance: 0.15,   // 15% chance to block
    enemyHealChance: 0.25,    // heal when below 70% HP, 25% chance
    enemyHealAmount: 0.15,    // heals 15% of max HP
    enemyFleeHpThreshold: 0.5, // can flee below 50% HP
    enemyFleeChance: 0.08,    // 8% chance to flee (rare)
    heavyMult: 1.5,           // enemy heavy does 1.5x
    enemyBlockReduction: 0.5, // enemy block reduces player dmg by 50%
    // Enemy pools by tier — ATK ramps up noticeably per tier
    enemyTiers: [
      // Tier 0 — early floors: 2-3 hits to kill, gentle damage
      [
        { name: "Stale Cookie",    emoji: "🍘", hp: 70, atk: 10 },
        { name: "Crumb Rat",       emoji: "🐀", hp: 65, atk: 12 },
        { name: "Flour Phantom",   emoji: "👻", hp: 60, atk: 13 },
        { name: "Moldy Morsel",    emoji: "🦠", hp: 75, atk: 9 },
      ],
      // Tier 1 — mid floors: 3-4 hits to kill, hits start hurting
      [
        { name: "Raisin Imposter", emoji: "🫘", hp: 100, atk: 18 },
        { name: "Burnt Batch",     emoji: "🌋", hp: 110, atk: 19 },
        { name: "Cookie Golem",    emoji: "🗿", hp: 120, atk: 16 },
        { name: "Sugar Wraith",    emoji: "💀", hp: 95, atk: 21 },
        { name: "Dough Beast",     emoji: "🫠", hp: 115, atk: 17 },
      ],
      // Tier 2 — elite: 4-5 hits to kill, serious damage
      [
        { name: "Grandma's Wrath", emoji: "👹", hp: 150, atk: 24 },
        { name: "Sugar Elemental", emoji: "⚡", hp: 160, atk: 22 },
        { name: "Oven Fiend",      emoji: "😈", hp: 145, atk: 26 },
        { name: "Frosting Hydra",  emoji: "🐲", hp: 170, atk: 21 },
      ],
    ],
    // Boss pool — high HP, punishing ATK. A long fight where blocking and potions matter.
    // 5-floor boss: ~15 hits to kill, deals ~28 per hit (player must block/heal)
    // 10-floor boss: ~22 hits to kill, deals ~35 per hit (need loot HP + potions to survive)
    bosses: [
      { name: "Cookie Dragon",     emoji: "🐉", hp: 500, atk: 28 },
      { name: "The Grand Grandma", emoji: "👑", hp: 480, atk: 30 },
      { name: "Dough Titan",       emoji: "🦍", hp: 550, atk: 26 },
      { name: "Infernal Oven",     emoji: "🌋", hp: 460, atk: 32 },
    ],
    bossHpScale: 0.10,       // boss HP scales +10% per floor beyond 8 (8 extra = 1.8x)
    bossAtkScale: 0.04,      // boss ATK scales +4% per floor beyond 8 (8 extra = 1.32x)
    depthScale: 0.04,        // regular enemy stat scaling per floor (gentle for 16 floors)
    // Loot tables — early and late game rewards
    lootEarly: [
      { icon: "🗡️", label: "+3 Attack",     apply: (p) => { p.atk += 3; } },
      { icon: "🛡️", label: "+12 Max HP",    apply: (p) => { p.maxHp += 12; p.hp = Math.min(p.hp + 12, p.maxHp); } },
      { icon: "🧪", label: "+1 Potion",     apply: (p) => { p.pot++; } },
      { icon: "❤️‍🩹", label: "Heal 30%",      apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.3)); } },
      { icon: "🎯", label: "+8% Crit",      apply: (p) => { p.crit = Math.min(0.5, p.crit + 0.08); } },
      { icon: "⚡", label: "Next hit 2x",   apply: (p) => { p.x2 = true; p.x2Count = (p.x2Count || 0) + 1; } },
      { icon: "🪙", label: "+3 Coins",      apply: () => {}, coins: 3 },
    ],
    lootLate: [
      { icon: "🗡️", label: "+6 Attack",     apply: (p) => { p.atk += 6; } },
      { icon: "🛡️", label: "+25 Max HP",    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.hp + 25, p.maxHp); } },
      { icon: "🧪", label: "+2 Potions",    apply: (p) => { p.pot += 2; } },
      { icon: "❤️‍🩹", label: "Heal 50%",      apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.5)); } },
      { icon: "🎯", label: "+15% Crit",     apply: (p) => { p.crit = Math.min(0.6, p.crit + 0.15); } },
      { icon: "⚡", label: "Next 2 hits 2x", apply: (p) => { p.x2 = true; p.x2Count = (p.x2Count || 0) + 2; } },
      { icon: "💪", label: "+4 ATK, +15 HP", apply: (p) => { p.atk += 4; p.maxHp += 15; p.hp = Math.min(p.hp + 15, p.maxHp); } },
      { icon: "🪙", label: "+5 Coins",      apply: () => {}, coins: 5 },
    ],
    // Coin economy
    coinPerCombat: 3,         // coins for killing a regular enemy
    coinPerElite: 6,          // coins for killing an elite
    coinPerBoss: 15,          // coins for killing the boss
    coinPerFlee: 2,           // coins when enemy flees
    coinRestBonus: 4,          // coins from rest room coin option
    coinTreasureBonus: 4,     // bonus coins from treasure rooms
    coinTrapBonus: 3,         // bonus coins from successful traps
    coinGreatTrapBonus: 6,    // bonus coins from great trap outcome
    // Coin → cookie conversion: cookies = coins × CPS × coinMultiplier
    coinCpsMultiplier: 30,    // each coin = 30 seconds of CPS
    coinMinPayout: 100,       // minimum payout per coin (for early game)
    // Reward tiers by floors cleared (keys are string floor counts)
    rewardTierThresholds: { legendary: 0.9, epic: 0.7, great: 0.5, normal: 0.2 },

    // ── Exploration: room types and path generation ──
    // Room types: 'combat', 'elite', 'rest', 'treasure', 'event', 'trap'
    // Path choices shown between floors (2-3 doors with hints)
    pathChoices: 3,           // number of doors to show (2 or 3)
    // Room weights by dungeon phase (early = first 40%, mid = 40-70%, late = 70%+)
    roomWeights: {
      early:  { combat: 50, rest: 20, event: 20, treasure: 10, trap: 0,  elite: 0  },
      mid:    { combat: 35, rest: 15, event: 25, treasure: 5,  trap: 10, elite: 10 },
      late:   { combat: 30, rest: 10, event: 20, treasure: 0,  trap: 15, elite: 25 },
    },
    // Rules
    maxTreasurePerRun: 1,
    restCooldown: 2,          // minimum floors between rest rooms
    eliteMinFloor: 0.35,      // elite can't appear before 35% through the dungeon
    // Rest room config
    restHealPercent: 0.35,    // heal 35% of max HP
    restAtkBonus: 4,          // +4 ATK permanently
    restPotionChance: 0.3,    // 30% chance rest also offers a potion option
    // Elite combat scaling
    eliteHpMult: 1.4,         // elite enemies have 1.4x HP
    eliteAtkMult: 1.2,        // elite enemies have 1.2x ATK
    eliteLootChoices: 3,      // elite gives 3 loot options instead of 2
    // Trap/gamble config
    trapRiskPercent: 0.20,    // risk 20% of max HP
    trapGoodChance: 0.55,     // 55% chance of good outcome
    trapGreatChance: 0.15,    // 15% chance of great outcome (within the 55%)
    // Mystery events
    events: [
      {
        name: "The Cookie Fountain",
        text: "A fountain bubbles with melted chocolate. Steam rises in sweet spirals...",
        emoji: "⛲",
        choices: [
          { label: "Drink deeply", outcomes: [
            { weight: 65, text: "Refreshing! The warmth fills you.", effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.3)); }, good: true },
            { weight: 35, text: "Too hot! It scalds your throat.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.12)); }, good: false },
          ]},
          { label: "Fill your flask", outcomes: [
            { weight: 100, text: "You carefully bottle the liquid. +1 Potion.", effect: (p) => { p.pot++; }, good: true },
          ]},
        ],
      },
      {
        name: "The Grandma's Riddle",
        text: "An ancient grandma blocks the path. Her eyes glint with challenge...",
        emoji: "👵",
        choices: [
          { label: "Answer her riddle", outcomes: [
            { weight: 55, text: "Correct! She nods and empowers your weapon.", effect: (p) => { p.atk += 4; }, good: true },
            { weight: 45, text: "Wrong. She cackles and vanishes. Nothing happens.", effect: () => {}, good: false },
          ]},
          { label: "Offer cookies", outcomes: [
            { weight: 100, text: "She smiles warmly and heals your wounds.", effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.2)); }, good: true },
          ]},
        ],
      },
      {
        name: "Suspicious Oven",
        text: "A glowing oven sits open in an empty room. Something's baking inside...",
        emoji: "🔥",
        choices: [
          { label: "Reach in", outcomes: [
            { weight: 50, text: "A perfectly baked cookie! You feel stronger.", effect: (p) => { p.atk += 3; p.maxHp += 10; p.hp = Math.min(p.hp + 10, p.maxHp); }, good: true },
            { weight: 50, text: "OW! The oven snaps shut on your hand.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.18)); }, good: false },
          ]},
          { label: "Walk away", outcomes: [
            { weight: 100, text: "You leave it alone. Probably wise.", effect: () => {}, good: false },
          ]},
        ],
      },
      {
        name: "The Wishing Well",
        text: "A deep well hums with energy. Coins glitter at the bottom...",
        emoji: "🕳️",
        choices: [
          { label: "Toss in some cookies", outcomes: [
            { weight: 40, text: "The well grants you great power!", effect: (p) => { p.atk += 5; }, good: true },
            { weight: 35, text: "A potion floats to the surface!", effect: (p) => { p.pot += 1; }, good: true },
            { weight: 25, text: "The cookies sink. Nothing happens.", effect: () => {}, good: false },
          ]},
          { label: "Peer inside", outcomes: [
            { weight: 70, text: "You see a vision of the future. Knowledge is power.", effect: (p) => { p.crit = Math.min(0.5, p.crit + 0.06); }, good: true },
            { weight: 30, text: "Something stares back. You stumble away.", effect: (p) => { p.hp = Math.max(1, p.hp - 5); }, good: false },
          ]},
        ],
      },
      {
        name: "Abandoned Bakery",
        text: "Shelves of forgotten recipes line the walls. Dust covers everything...",
        emoji: "🏚️",
        choices: [
          { label: "Search the shelves", outcomes: [
            { weight: 60, text: "You find a secret recipe! Your attacks feel sharper.", effect: (p) => { p.crit = Math.min(0.5, p.crit + 0.08); }, good: true },
            { weight: 40, text: "Just dust and cobwebs. You cough.", effect: () => {}, good: false },
          ]},
          { label: "Check the oven", outcomes: [
            { weight: 50, text: "Stale but edible cookies! You scarf them down.", effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.15)); }, good: true },
            { weight: 50, text: "Empty. But the oven is still warm...", effect: () => {}, good: false },
          ]},
        ],
      },
      {
        name: "The Cookie Golem's Offer",
        text: "A dormant cookie golem awakens. It speaks in crumbs: 'Trade?'",
        emoji: "🗿",
        choices: [
          { label: "Trade HP for power", outcomes: [
            { weight: 100, text: "You feel drained but mighty. -15% HP, +6 ATK.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.15)); p.atk += 6; }, good: true },
          ]},
          { label: "Trade power for HP", outcomes: [
            { weight: 100, text: "Your strikes soften but you feel restored. -3 ATK, +30% HP.", effect: (p) => { p.atk = Math.max(5, p.atk - 3); p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.30)); }, good: true },
          ]},
        ],
      },
      {
        name: "Mysterious Shrine",
        text: "An altar glows with strange symbols. You feel its power calling...",
        emoji: "🛕",
        choices: [
          { label: "Pray for strength", outcomes: [
            { weight: 50, text: "The shrine blesses you! +20 Max HP.", effect: (p) => { p.maxHp += 20; p.hp = Math.min(p.hp + 20, p.maxHp); }, good: true },
            { weight: 50, text: "The shrine demands tribute. -10% HP.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.10)); }, good: false },
          ]},
          { label: "Leave an offering", outcomes: [
            { weight: 100, text: "The altar hums. Your next 2 hits deal double!", effect: (p) => { p.x2 = true; p.x2Count = (p.x2Count || 0) + 2; }, good: true },
          ]},
        ],
      },
      {
        name: "Cookie Merchant",
        text: "A hooded figure sits behind stacked crates. 'Psst... want some potions?'",
        emoji: "🧙",
        choices: [
          { label: "Buy potions (-15% HP)", outcomes: [
            { weight: 100, text: "The merchant hands over 2 potions. Your wallet... er, HP hurts.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.15)); p.pot += 2; }, good: true },
          ]},
          { label: "Ask for a tip", outcomes: [
            { weight: 70, text: "'Block when they wind up, kid.' +5% crit.", effect: (p) => { p.crit = Math.min(0.5, p.crit + 0.05); }, good: true },
            { weight: 30, text: "'Get lost.' He vanishes in a puff of flour.", effect: () => {}, good: false },
          ]},
        ],
      },
      {
        name: "The Dough Mirror",
        text: "A mirror made of polished cookie dough reflects a stronger version of you...",
        emoji: "🪞",
        choices: [
          { label: "Step through the mirror", outcomes: [
            { weight: 45, text: "You merge with your reflection! Permanently stronger.", effect: (p) => { p.atk += 5; p.maxHp += 15; p.hp = Math.min(p.hp + 15, p.maxHp); }, good: true },
            { weight: 55, text: "The reflection shatters. Glass cuts you.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.15)); }, good: false },
          ]},
          { label: "Smash the mirror", outcomes: [
            { weight: 100, text: "Shards scatter. You find a potion hidden behind it.", effect: (p) => { p.pot++; }, good: true },
          ]},
        ],
      },
      {
        name: "Rolling Pin of Doom",
        text: "A massive rolling pin blocks the corridor. It looks... sentient.",
        emoji: "🪵",
        choices: [
          { label: "Try to dodge past it", outcomes: [
            { weight: 60, text: "You roll under just in time! The adrenaline sharpens your reflexes.", effect: (p) => { p.crit = Math.min(0.5, p.crit + 0.10); }, good: true },
            { weight: 40, text: "It clips you. Ouch.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.12)); }, good: false },
          ]},
          { label: "Wait for it to pass", outcomes: [
            { weight: 100, text: "Patience pays off. It rolls away harmlessly.", effect: () => {}, good: true },
          ]},
        ],
      },
      {
        name: "The Sugar Sprite",
        text: "A tiny glowing sprite made of crystallized sugar hovers before you. 'A gift or a game?'",
        emoji: "✨",
        choices: [
          { label: "Accept the gift", outcomes: [
            { weight: 50, text: "The sprite dissolves into healing energy!", effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.25)); }, good: true },
            { weight: 50, text: "It was a trick! The sprite steals some of your strength.", effect: (p) => { p.atk = Math.max(5, p.atk - 2); }, good: false },
          ]},
          { label: "Play the game", outcomes: [
            { weight: 40, text: "You win! The sprite grants you great power.", effect: (p) => { p.atk += 4; p.crit = Math.min(0.5, p.crit + 0.05); }, good: true },
            { weight: 35, text: "A draw. The sprite giggles and vanishes.", effect: () => {}, good: false },
            { weight: 25, text: "You lose. The sprite takes a potion!", effect: (p) => { p.pot = Math.max(0, p.pot - 1); }, good: false },
          ]},
        ],
      },
      {
        name: "Flooded Kitchen",
        text: "Ankle-deep milk floods this room. Something large moves beneath the surface...",
        emoji: "🥛",
        choices: [
          { label: "Wade through quickly", outcomes: [
            { weight: 55, text: "You splash through safely. The milk was just milk.", effect: () => {}, good: true },
            { weight: 45, text: "Something bites your ankle! It stings.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.10)); }, good: false },
          ]},
          { label: "Search underwater", outcomes: [
            { weight: 40, text: "You find a waterproof pouch with supplies!", effect: (p) => { p.pot++; p.maxHp += 10; p.hp = Math.min(p.hp + 10, p.maxHp); }, good: true },
            { weight: 60, text: "Just soggy cookies. What a waste of time.", effect: () => {}, good: false },
          ]},
        ],
      },
      {
        name: "The Eternal Oven",
        text: "An oven that has been burning for centuries. The heat is unbearable but the cookies inside look divine...",
        emoji: "🔥",
        choices: [
          { label: "Brave the heat", outcomes: [
            { weight: 35, text: "You grab a legendary cookie! Its power flows through you.", effect: (p) => { p.atk += 6; }, good: true },
            { weight: 65, text: "Too hot! You burn your hands badly.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.20)); }, good: false },
          ]},
          { label: "Use a potion to cool it", outcomes: [
            { weight: 100, text: "The potion evaporates but cools the oven enough. You grab two cookies!", effect: (p) => { if (p.pot > 0) { p.pot--; p.atk += 4; p.maxHp += 12; p.hp = Math.min(p.hp + 12, p.maxHp); } else { p.hp = Math.max(1, p.hp - 5); } }, good: true },
          ]},
          { label: "Walk away", outcomes: [
            { weight: 100, text: "Not worth the risk. You move on.", effect: () => {}, good: true },
          ]},
        ],
      },
      {
        name: "Crumbling Bridge",
        text: "A narrow cookie bridge spans a dark chasm. It's cracking...",
        emoji: "🌉",
        choices: [
          { label: "Sprint across", outcomes: [
            { weight: 70, text: "You make it! Heart pounding, but alive.", effect: (p) => { p.crit = Math.min(0.5, p.crit + 0.06); }, good: true },
            { weight: 30, text: "The bridge collapses! You barely grab the edge.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.15)); }, good: false },
          ]},
          { label: "Look for another way", outcomes: [
            { weight: 50, text: "A hidden side passage! And there's loot here.", effect: (p) => { p.pot++; }, good: true },
            { weight: 50, text: "Dead end. You have to go back and cross anyway.", effect: () => {}, good: false },
          ]},
        ],
      },
      {
        name: "The Cookie Oracle",
        text: "A fortune cookie the size of a boulder pulses with ancient wisdom...",
        emoji: "🥠",
        choices: [
          { label: "Crack it open", outcomes: [
            { weight: 33, text: "'Your future holds great strength.' +5 ATK!", effect: (p) => { p.atk += 5; }, good: true },
            { weight: 33, text: "'Health is the greatest wealth.' +25 Max HP!", effect: (p) => { p.maxHp += 25; p.hp = Math.min(p.hp + 25, p.maxHp); }, good: true },
            { weight: 34, text: "'The next two strikes shall be mighty.' Double damage x2!", effect: (p) => { p.x2 = true; p.x2Count = (p.x2Count || 0) + 2; }, good: true },
          ]},
          { label: "Read the outside", outcomes: [
            { weight: 100, text: "Faded text reads: 'Block the heavy, strike the healer.' Useful advice.", effect: (p) => { p.crit = Math.min(0.5, p.crit + 0.04); }, good: true },
          ]},
        ],
      },
      {
        name: "Grandma's Secret Stash",
        text: "Behind a false wall, you find a grandma's hidden pantry. Jars line the shelves...",
        emoji: "🫙",
        choices: [
          { label: "Open the red jar", outcomes: [
            { weight: 50, text: "Spicy cookie salve! Your attacks burn hotter. +3 ATK.", effect: (p) => { p.atk += 3; }, good: true },
            { weight: 50, text: "Hot sauce. Very, very hot sauce. Your mouth is on fire.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.08)); }, good: false },
          ]},
          { label: "Open the blue jar", outcomes: [
            { weight: 50, text: "Cooling cream! It soothes your wounds.", effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.20)); }, good: true },
            { weight: 50, text: "Old milk. You feel a bit queasy.", effect: (p) => { p.hp = Math.max(1, p.hp - Math.floor(p.maxHp * 0.05)); }, good: false },
          ]},
          { label: "Take a jar for later", outcomes: [
            { weight: 100, text: "You pocket a jar. It'll come in handy. +1 Potion.", effect: (p) => { p.pot++; }, good: true },
          ]},
        ],
      },
    ],
    // Door hints — intentionally ambiguous. Some overlap between types to prevent easy gaming.
    // Player should be able to narrow down with thought, but never be 100% certain.
    // 25 hints per type = 150 total. Intentionally ambiguous — some overlap between types.
    doorHints: {
      combat: [
        "Something paces behind the door...",
        "You hear heavy breathing...",
        "Claw marks line the doorframe...",
        "A low growl rumbles from within...",
        "Shadows shift underneath the crack...",
        "A sharp scraping noise echoes...",
        "The air feels tense and charged...",
        "Something slams against the other side...",
        "Dried crumbs trail through the doorway...",
        "You smell sweat and burnt sugar...",
        "The door shudders rhythmically...",
        "Teeth marks cover the handle...",
        "A guttural hiss seeps through the gap...",
        "The wood is splintered from the inside...",
        "You hear bones crunching...",
        "Something sniffs at the door crack...",
        "A tail-like shadow sweeps beneath...",
        "The air reeks of stale dough...",
        "You hear claws on stone...",
        "A wet, smacking sound from within...",
        "The door rattles in its frame...",
        "Footsteps circle the room beyond...",
        "You hear a plate shatter...",
        "An angry chittering fills the air...",
        "The handle vibrates with impact...",
      ],
      elite: [
        "The ground vibrates with each step...",
        "An overwhelming presence radiates...",
        "The door is reinforced with iron...",
        "You feel a chill in your bones...",
        "The air crackles with dark energy...",
        "Something massive shifts beyond...",
        "Ancient warning symbols cover the walls...",
        "A deep, rhythmic thumping echoes...",
        "The torches flicker violently...",
        "Your instincts scream danger...",
        "The stone around the frame is cracked...",
        "Heat radiates through the iron door...",
        "You hear chains dragging on stone...",
        "The air itself feels heavy here...",
        "A low horn sounds from deep within...",
        "The door is scratched by something huge...",
        "Red light pulses through the keyhole...",
        "Your hands tremble involuntarily...",
        "The hallway narrows to this door...",
        "Scorch marks blacken the threshold...",
        "A foul wind blows from the gap...",
        "Something roars, muffled by stone...",
        "The door is twice the normal height...",
        "You feel your courage wavering...",
        "Battle scars mark every surface...",
      ],
      rest: [
        "A gentle warmth seeps through...",
        "The air smells faintly sweet...",
        "Quiet crackling sounds, like a fire...",
        "A soft humming drifts from within...",
        "The door feels pleasantly warm...",
        "You catch the scent of cinnamon...",
        "Faint music plays from somewhere...",
        "The corridor feels calmer here...",
        "A warm orange light glows underneath...",
        "You hear something bubbling gently...",
        "The smell of fresh-baked cookies...",
        "A rocking chair creaks softly...",
        "Steam curls from under the door...",
        "You hear a kettle whistling...",
        "The wood here is polished smooth...",
        "A cat purrs somewhere nearby...",
        "Dried flowers hang from the lintel...",
        "The air is warm and humid...",
        "You smell vanilla and brown sugar...",
        "Soft candlelight flickers within...",
        "A welcome mat sits at the threshold...",
        "You hear the clink of a teacup...",
        "The walls here are painted, not stone...",
        "A blanket is draped over the handle...",
        "You feel your shoulders relax...",
      ],
      treasure: [
        "Something catches the light inside...",
        "The door has ornate carvings...",
        "A faint shimmer reflects off the walls...",
        "The lock on this door is already broken...",
        "You notice a sweet, rich aroma...",
        "The hinges are gold-plated...",
        "Dust motes sparkle in the air...",
        "The room beyond seems untouched...",
        "An old sign reads 'KEEP OUT'...",
        "You hear a faint, musical chime...",
        "The door is inlaid with gems...",
        "A golden thread hangs from the keyhole...",
        "The air smells of wealth and old wood...",
        "You spot a coin near the threshold...",
        "The frame is carved with cookie shapes...",
        "Velvet curtains are visible through the gap...",
        "A chest's shadow is visible underneath...",
        "The door is heavier than the others...",
        "You notice a wax seal on the frame...",
        "Light refracts in rainbow patterns...",
        "The stonework here is finer quality...",
        "An inscription reads 'For the worthy'...",
        "You smell aged wood and polish...",
        "The handle is wrapped in silk...",
        "Something glints behind the keyhole...",
      ],
      event: [
        "Strange whispers echo from within...",
        "The air shimmers oddly...",
        "Something feels... different here...",
        "An unfamiliar sound hums ahead...",
        "The walls seem to pulse faintly...",
        "A curious smell you can't place...",
        "The door handle tingles when touched...",
        "You feel watched, but not threatened...",
        "Symbols glow faintly on the threshold...",
        "The air tastes like static...",
        "Colors seem wrong near this door...",
        "You hear your own voice echoed back...",
        "The door is neither hot nor cold...",
        "A butterfly lands on the handle...",
        "The grain of the wood spirals inward...",
        "You smell something that triggers a memory...",
        "The shadows don't match the light source...",
        "A single musical note repeats...",
        "The floor tiles change pattern here...",
        "You feel a slight breeze from nowhere...",
        "The door seems to breathe...",
        "Your shadow moves independently...",
        "Time feels slower near this door...",
        "The keyhole shows swirling colors...",
        "A riddle is carved into the stone...",
      ],
      trap: [
        "You notice thin wires near the floor...",
        "The stones here are unevenly placed...",
        "A faint clicking comes from the walls...",
        "The dust pattern looks disturbed...",
        "Something about this door feels wrong...",
        "You spot scratches around the handle...",
        "The air has a sharp, metallic tang...",
        "A barely visible groove crosses the floor...",
        "The torchlight reveals hidden holes...",
        "You smell oil and old mechanisms...",
        "The handle has a suspicious seam...",
        "One floorboard is slightly raised...",
        "You notice a pressure plate outline...",
        "The ceiling has a suspiciously clean patch...",
        "Tiny dart holes line the walls...",
        "A tripwire glints in the torchlight...",
        "The door opens too easily...",
        "You hear a spring under tension...",
        "The mortar between stones is fresh...",
        "A faint ticking emanates from within...",
        "The handle has a needle-thin groove...",
        "Scuff marks suggest something slides...",
        "You notice a counterweight above...",
        "The threshold stone wobbles slightly...",
        "A chemical smell wafts from inside...",
      ],
    },
    // Door icons (shown when scouted or after choice)
    doorIcons: { combat: '🗡️', elite: '💀', rest: '🏕️', treasure: '💰', event: '❓', trap: '⚠️', boss: '👑' },
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

