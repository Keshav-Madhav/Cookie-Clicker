export const buildings = [
  { name: "Cursor", cost: 15, cps: 0.1, cost_multiplier: 1.15 },
  { name: "Grandma", cost: 100, cps: 1, cost_multiplier: 1.15 },
  { name: "Farm", cost: 1100, cps: 8, cost_multiplier: 1.135 },
  { name: "Factory", cost: 11000, cps: 47, cost_multiplier: 1.225 },
  { name: "Mine", cost: 120000, cps: 260, cost_multiplier: 1.15 },
  { name: "Shipment", cost: 1300000, cps: 1400, cost_multiplier: 1.15 },
  { name: "Alchemy Lab", cost: 14000000, cps: 7800, cost_multiplier: 1.2 },
  { name: "Portal", cost: 170000000, cps: 44000, cost_multiplier: 1.2 },
  { name: "Time Machine", cost: 2100000000, cps: 260000, cost_multiplier: 1.15 },
  { name: "Antimatter Condenser", cost: 26000000000, cps: 1600000, cost_multiplier: 1.15 },
  { name: "Prism", cost: 310000000000, cps: 10000000, cost_multiplier: 1.15 },
  { name: "Chancemaker", cost: 7100000000000, cps: 67000000, cost_multiplier: 1.15 },
  { name: "Fractal Engine", cost: 120000000000000, cps: 420000000, cost_multiplier: 1.15 },
];

export const upgrades = [
  // === Click Multipliers ===
  { 
    name: "Better Click", cost: 50, 
    effect: "Increase clicking power by 50%", 
    type: "clickMultiplier", multiplier: 1.5,
    max_level: 15, cost_multiplier: 3
  },

  // === Tiered Click Upgrade ===
  {
    type: "tieredUpgrade",
    tiers: [
      { name: "Iron Touch", effect: "Clicking gives 2x cookies", multiplier: 2, cost: 10000, buildingsRequired: 20 },
      { name: "Silver Touch", effect: "Clicking gives 2x cookies", multiplier: 2, cost: 300000, buildingsRequired: 50 },
      { name: "Golden Touch", effect: "Clicking gives 2x cookies", multiplier: 2, cost: 2500000, buildingsRequired: 100 },
      { name: "Platinum Touch", effect: "Clicking gives 2x cookies", multiplier: 2, cost: 27500000, buildingsRequired: 250 },
      { name: "Diamond Touch", effect: "Clicking gives 2x cookies", multiplier: 2, cost: 500000000, buildingsRequired: 500 },
    ]
  },

  // === Building Boosts ===
  { name: "Efficient Grandmas", cost: 500, effect: "Grandmas produce 2x as much", type: "buildingBoost", target: "Grandma", multiplier: 2, max_level: 10, cost_multiplier: 2,
    requires: [{ type: "building", name: "Grandma", min: 1 }] },
  { name: "Farm Expansion", cost: 5000, effect: "Farms produce 75% more", type: "buildingBoost", target: "Farm", multiplier: 1.75, max_level: 10, cost_multiplier: 2,
    requires: [{ type: "building", name: "Farm", min: 1 }] },
  { name: "Factory Overdrive", cost: 75000, effect: "Factories are 3x as efficient", type: "buildingBoost", target: "Factory", multiplier: 3, max_level: 7, cost_multiplier: 6,
    requires: [{ type: "building", name: "Factory", min: 5 }] },
  { name: "Mine Boost", cost: 750000, effect: "Mines produce 2x as much", type: "buildingBoost", target: "Mine", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Mine", min: 5 }] },
  { name: "Shipment Upgrade", cost: 7500000, effect: "Shipments are 2x as efficient", type: "buildingBoost", target: "Shipment", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Shipment", min: 5 }] },
  { name: "Alchemy Lab Boost", cost: 50000000, effect: "Alchemy Labs produce 2x as much", type: "buildingBoost", target: "Alchemy Lab", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Alchemy Lab", min: 5 }] },
  { name: "Portal Boost", cost: 500000000, effect: "Portals are 2x as efficient", type: "buildingBoost", target: "Portal", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Portal", min: 5 }] },
  { name: "Time Warp", cost: 5000000000, effect: "Time Machines are 2x as efficient", type: "buildingBoost", target: "Time Machine", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Time Machine", min: 5 }] },
  { name: "Antimatter Boost", cost: 60000000000, effect: "Antimatter Condensers produce 2x", type: "buildingBoost", target: "Antimatter Condenser", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Antimatter Condenser", min: 5 }] },
  { name: "Prism Enhancement", cost: 700000000000, effect: "Prisms are 2x as efficient", type: "buildingBoost", target: "Prism", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Prism", min: 5 }] },
  { name: "Lucky Day", cost: 8000000000000, effect: "Chancemakers produce 2x", type: "buildingBoost", target: "Chancemaker", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Chancemaker", min: 5 }] },
  { name: "Fractal Boost", cost: 250000000000000, effect: "Fractal Engines produce 2x", type: "buildingBoost", target: "Fractal Engine", multiplier: 2, max_level: 5, cost_multiplier: 4,
    requires: [{ type: "building", name: "Fractal Engine", min: 5 }] },

  // === Global CPS Multiplier ===
  { name: "Cookie Recipe", cost: 100000, effect: "All production +10%", type: "globalCpsMultiplier", multiplier: 1.10, max_level: 10, cost_multiplier: 10,
    requires: [{ type: "cps", min: 50 }] },
  { name: "Industrial Revolution", cost: 10000000, effect: "All production +25%", type: "globalCpsMultiplier", multiplier: 1.25, max_level: 5, cost_multiplier: 15,
    requires: [{ type: "cps", min: 5000 }, { type: "totalBuildings", min: 50 }] },
  { name: "Cookie Singularity", cost: 5000000000, effect: "All production +50%", type: "globalCpsMultiplier", multiplier: 1.50, max_level: 3, cost_multiplier: 50,
    requires: [{ type: "cps", min: 500000 }, { type: "totalBuildings", min: 150 }] },

  // === Synergy Upgrades (one building boosts another) ===
  { name: "Grandma's Farmhands", cost: 25000, effect: "Each Grandma adds +0.5 CPS to Farms", type: "synergy", source: "Grandma", target: "Farm", bonus: 0.5, max_level: 5, cost_multiplier: 5,
    requires: [{ type: "building", name: "Grandma", min: 5 }, { type: "building", name: "Farm", min: 5 }] },
  { name: "Factory Automation", cost: 500000, effect: "Each Factory adds +2 CPS to Mines", type: "synergy", source: "Factory", target: "Mine", bonus: 2, max_level: 5, cost_multiplier: 5,
    requires: [{ type: "building", name: "Factory", min: 10 }, { type: "building", name: "Mine", min: 5 }] },
  { name: "Portal Network", cost: 500000000, effect: "Each Portal adds +50 CPS to Shipments", type: "synergy", source: "Portal", target: "Shipment", bonus: 50, max_level: 5, cost_multiplier: 5,
    requires: [{ type: "building", name: "Portal", min: 5 }, { type: "building", name: "Shipment", min: 10 }] },
  { name: "Temporal Alchemy", cost: 10000000000, effect: "Each Time Machine adds +200 CPS to Alchemy Labs", type: "synergy", source: "Time Machine", target: "Alchemy Lab", bonus: 200, max_level: 5, cost_multiplier: 5,
    requires: [{ type: "building", name: "Time Machine", min: 5 }, { type: "building", name: "Alchemy Lab", min: 10 }] },
  { name: "Fractal Prisms", cost: 500000000000000, effect: "Each Fractal Engine adds +50K CPS to Prisms", type: "synergy", source: "Fractal Engine", target: "Prism", bonus: 50000, max_level: 3, cost_multiplier: 10,
    requires: [{ type: "building", name: "Fractal Engine", min: 5 }, { type: "building", name: "Prism", min: 10 }] },

  // === Cursor Scaling (Cursor CPS scales with total non-cursor buildings) ===
  { name: "Thousand Fingers", cost: 100000, effect: "Cursors gain +0.1 CPS per non-cursor building", type: "cursorScaling", bonus: 0.1, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "building", name: "Cursor", min: 25 }, { type: "totalBuildings", min: 30 }] },
  { name: "Million Fingers", cost: 10000000, effect: "Cursors gain +0.5 CPS per non-cursor building", type: "cursorScaling", bonus: 0.5, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "building", name: "Cursor", min: 50 }, { type: "totalBuildings", min: 100 }] },
  { name: "Billion Fingers", cost: 1000000000, effect: "Cursors gain +5 CPS per non-cursor building", type: "cursorScaling", bonus: 5, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "building", name: "Cursor", min: 100 }, { type: "totalBuildings", min: 200 }] },
  { name: "Trillion Fingers", cost: 100000000000, effect: "Cursors gain +50 CPS per non-cursor building", type: "cursorScaling", bonus: 50, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "building", name: "Cursor", min: 150 }, { type: "totalBuildings", min: 400 }] },

  // === Lucky Click Chance ===
  { name: "Lucky Cookies", cost: 50000, effect: "1.5% chance for bonus cookies on click", type: "luckyChance", chance: 0.015, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "totalClicks", min: 500 }] },
  { name: "Serendipity", cost: 5000000, effect: "+1.5% lucky click chance", type: "luckyChance", chance: 0.015, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "totalClicks", min: 2000 }, { type: "totalUpgradesPurchased", min: 5 }] },
  { name: "Fortune", cost: 500000000, effect: "+2% lucky click chance", type: "luckyChance", chance: 0.02, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "totalClicks", min: 5000 }, { type: "achievements", min: 10 }] },
  { name: "Jackpot", cost: 50000000000, effect: "+3% lucky click chance", type: "luckyChance", chance: 0.03, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "totalClicks", min: 15000 }, { type: "achievements", min: 20 }] },

  // === Frenzy Duration ===
  { name: "Extended Frenzy", cost: 1000000, effect: "Frenzies last 50% longer", type: "frenzyDuration", bonus: 1.5, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "cps", min: 500 }, { type: "totalCookies", min: 500000 }] },
  { name: "Mega Frenzy", cost: 100000000, effect: "Frenzies last 2x longer", type: "frenzyDuration", bonus: 2.0, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "cps", min: 50000 }, { type: "prestige", min: 1 }] },

  // === Offline Production (tiered) ===
  {
    type: "tieredUpgrade",
    tiers: [
      { name: "Offline Production I", effect: "Offline production: 0.5x → 0.75x", multiplier: 0.75, cost: 15000, buildingsRequired: 30 },
      { name: "Offline Production II", effect: "Offline production: 0.75x → 1x", multiplier: 1, cost: 275000, buildingsRequired: 60 },
      { name: "Offline Production III", effect: "Offline production: 1x → 1.5x", multiplier: 1.5, cost: 2500000, buildingsRequired: 120 },
      { name: "Offline Production IV", effect: "Offline production: 1.5x → 2x", multiplier: 2, cost: 20000000, buildingsRequired: 200 },
      { name: "Offline Production V", effect: "Offline production: 2x → 3x", multiplier: 3, cost: 100000000, buildingsRequired: 300 },
    ]
  },
];

// === Achievements ===
export const achievements = [
  // Cookie milestones
  { id: "bake_1k", name: "Apprentice Baker", desc: "Bake 1,000 cookies", type: "totalCookies", requirement: 1000 },
  { id: "bake_10k", name: "Journeyman Baker", desc: "Bake 10,000 cookies", type: "totalCookies", requirement: 10000 },
  { id: "bake_100k", name: "Master Baker", desc: "Bake 100,000 cookies", type: "totalCookies", requirement: 100000 },
  { id: "bake_1m", name: "Cookie Mogul", desc: "Bake 1 million cookies", type: "totalCookies", requirement: 1000000 },
  { id: "bake_100m", name: "Cookie Tycoon", desc: "Bake 100 million cookies", type: "totalCookies", requirement: 100000000 },
  { id: "bake_1b", name: "Cookie Empire", desc: "Bake 1 billion cookies", type: "totalCookies", requirement: 1000000000 },
  { id: "bake_100b", name: "Cookie Dynasty", desc: "Bake 100 billion cookies", type: "totalCookies", requirement: 100000000000 },
  { id: "bake_1t", name: "Cookie Universe", desc: "Bake 1 trillion cookies", type: "totalCookies", requirement: 1000000000000 },
  { id: "bake_100t", name: "Cookie Multiverse", desc: "Bake 100 trillion cookies", type: "totalCookies", requirement: 100000000000000 },

  // CPS milestones
  { id: "cps_10", name: "Slow Start", desc: "Reach 10 CPS", type: "cps", requirement: 10 },
  { id: "cps_100", name: "Getting There", desc: "Reach 100 CPS", type: "cps", requirement: 100 },
  { id: "cps_1k", name: "Cookie Stream", desc: "Reach 1,000 CPS", type: "cps", requirement: 1000 },
  { id: "cps_10k", name: "Cookie River", desc: "Reach 10,000 CPS", type: "cps", requirement: 10000 },
  { id: "cps_100k", name: "Cookie Flood", desc: "Reach 100,000 CPS", type: "cps", requirement: 100000 },
  { id: "cps_1m", name: "Cookie Tsunami", desc: "Reach 1 million CPS", type: "cps", requirement: 1000000 },
  { id: "cps_1b", name: "Cookie Singularity", desc: "Reach 1 billion CPS", type: "cps", requirement: 1000000000 },

  // Click milestones
  { id: "click_100", name: "Casual Clicker", desc: "Click 100 times", type: "totalClicks", requirement: 100 },
  { id: "click_1k", name: "Dedicated Clicker", desc: "Click 1,000 times", type: "totalClicks", requirement: 1000 },
  { id: "click_5k", name: "Click Enthusiast", desc: "Click 5,000 times", type: "totalClicks", requirement: 5000 },
  { id: "click_10k", name: "Click Master", desc: "Click 10,000 times", type: "totalClicks", requirement: 10000 },
  { id: "click_50k", name: "Click Legend", desc: "Click 50,000 times", type: "totalClicks", requirement: 50000 },
  { id: "click_100k", name: "Click God", desc: "Click 100,000 times", type: "totalClicks", requirement: 100000 },

  // Building milestones
  { id: "buildings_10", name: "Small Business", desc: "Own 10 buildings", type: "totalBuildings", requirement: 10 },
  { id: "buildings_50", name: "Growing Empire", desc: "Own 50 buildings", type: "totalBuildings", requirement: 50 },
  { id: "buildings_100", name: "Cookie Corporation", desc: "Own 100 buildings", type: "totalBuildings", requirement: 100 },
  { id: "buildings_200", name: "Cookie Conglomerate", desc: "Own 200 buildings", type: "totalBuildings", requirement: 200 },
  { id: "buildings_500", name: "Cookie Megacorp", desc: "Own 500 buildings", type: "totalBuildings", requirement: 500 },
  { id: "buildings_1000", name: "Cookie Monopoly", desc: "Own 1,000 buildings", type: "totalBuildings", requirement: 1000 },

  // Special
  { id: "all_buildings", name: "Diversified Portfolio", desc: "Own at least 1 of every building type", type: "allBuildingTypes", requirement: 1 },
  { id: "lucky_first", name: "Feeling Lucky", desc: "Trigger your first lucky click", type: "luckyClicks", requirement: 1 },
  { id: "lucky_50", name: "Luck of the Irish", desc: "Trigger 50 lucky clicks", type: "luckyClicks", requirement: 50 },
  { id: "frenzy_first", name: "Frenzy!", desc: "Trigger your first frenzy", type: "frenziesTriggered", requirement: 1 },
  { id: "frenzy_10", name: "Frenzy Fanatic", desc: "Trigger 10 frenzies", type: "frenziesTriggered", requirement: 10 },
  { id: "prestige_1", name: "Ascended", desc: "Prestige for the first time", type: "timesPrestiged", requirement: 1 },
  { id: "prestige_5", name: "Enlightened", desc: "Prestige 5 times", type: "timesPrestiged", requirement: 5 },
  { id: "hc_100", name: "Heavenly Baker", desc: "Earn 100 heavenly chips", type: "heavenlyChips", requirement: 100 },
  { id: "hc_1000", name: "Celestial Baker", desc: "Earn 1,000 heavenly chips", type: "heavenlyChips", requirement: 1000 },
  { id: "upgrades_10", name: "Upgrader", desc: "Purchase 10 upgrades", type: "totalUpgradesPurchased", requirement: 10 },
  { id: "upgrades_25", name: "Serial Upgrader", desc: "Purchase 25 upgrades", type: "totalUpgradesPurchased", requirement: 25 },
  { id: "upgrades_50", name: "Upgrade Addict", desc: "Purchase 50 upgrades", type: "totalUpgradesPurchased", requirement: 50 },
]; 