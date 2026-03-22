
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

