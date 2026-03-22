
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

