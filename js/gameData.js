export const buildings = [
  { 
    name: "Cursor", 
    cost: 15, 
    cps: 0.1, 
    cost_multiplier: 1.15 
  },
  { 
    name: "Grandma", 
    cost: 100, 
    cps: 1, 
    cost_multiplier: 1.15 
  },
  { 
    name: "Farm", 
    cost: 1100, 
    cps: 8,
    cost_multiplier: 1.135
  },
  { 
    name: "Factory", 
    cost: 11000,
    cps: 47,
    cost_multiplier: 1.225
  },
  { 
    name: "Mine", 
    cost: 120000,
    cps: 260,
    cost_multiplier: 1.15
  },
  { 
    name: "Shipment", 
    cost: 1300000,
    cps: 1400,
    cost_multiplier: 1.15
  },
  { 
    name: "Alchemy Lab", 
    cost: 14000000,
    cps: 7800,
    cost_multiplier: 1.2
  },
  { 
    name: "Portal", 
    cost: 170000000,
    cps: 44000,
    cost_multiplier: 1.2
  },
];

export const upgrades = [
  { 
    name: "Better Click", 
    cost: 50, 
    effect: "Increase clicking power by 50%", 
    type: "clickMultiplier", 
    multiplier: 1.5,
    max_level: 20,
    cost_multiplier: 1.5
  },
  { 
    name: "Efficient Grandmas", 
    cost: 500, 
    effect: "Grandmas produce twice as much", 
    type: "buildingBoost", 
    target: "Grandma", 
    multiplier: 2,
    max_level: 15,
    cost_multiplier: 2
  },
  { 
    name: "Farm Expansion", 
    cost: 5000, 
    effect: "Farms produce 75% more", 
    type: "buildingBoost", 
    target: "Farm", 
    multiplier: 1.75,
    max_level: 10,
    cost_multiplier: 2
  },
  {
    type: "tieredUpgrade",
    tiers: [
      {
        name: "Iron Touch",
        effect: "Clicking gives 2x cookies",
        multiplier: 2,
        cost: 10000,
        buildingsRequired: 20
      },
      {
        name: "Silver Touch",
        effect: "Clicking gives 4x cookies",
        multiplier: 4,
        cost: 100000,
        buildingsRequired: 50
      },
      {
        name: "Golden Touch",
        effect: "Clicking gives 8x cookies",
        multiplier: 8,
        cost: 1500000,
        buildingsRequired: 100
      },
      {
        name: "Platinum Touch",
        effect: "Clicking gives 16x cookies",
        multiplier: 16,
        cost: 25000000,
        buildingsRequired: 250
      }, 
    ]
  },
  { 
    name: "Factory Overdrive", 
    cost: 75000,
    effect: "Factories are 3 times as efficient", 
    type: "buildingBoost", 
    target: "Factory", 
    multiplier: 3,
    max_level: 10,
    cost_multiplier: 5
  },
  { 
    name: "Mine Boost", 
    cost: 750000,
    effect: "Mines produce 2x as much",
    type: "buildingBoost", 
    target: "Mine", 
    multiplier: 2, // Increased from 1.5
    max_level: 5,
    cost_multiplier: 4
  },
  { 
    name: "Shipment Upgrade", 
    cost: 7500000,
    effect: "Shipments are twice as efficient", 
    type: "buildingBoost", 
    target: "Shipment", 
    multiplier: 2,
    max_level: 5,
    cost_multiplier: 4
  },
  { 
    name: "Alchemy Lab Boost", 
    cost: 50000000,
    effect: "Alchemy Labs produce 2x as much", 
    type: "buildingBoost", 
    target: "Alchemy Lab", 
    multiplier: 2, // Increased from 1.5
    max_level: 5,
    cost_multiplier: 4
  },
  { 
    name: "Portal Boost",
    cost: 500000000,
    effect: "Portals are twice as efficient", 
    type: "buildingBoost", 
    target: "Portal", 
    multiplier: 2,
    max_level: 5,
    cost_multiplier: 4
  },

  {
    type: "tieredUpgrade",
    tiers: [
      {
        name: "Offline Production I",
        effect: "Increase offline cookie production 0.5x -> 0.75x",
        multiplier: 0.75,
        cost: 15000,
        buildingsRequired: 30
      },
      {
        name: "Offline Production II",
        effect: "Increase offline cookie production 0.75x -> 1x",
        multiplier: 1,
        cost: 275000,
        buildingsRequired: 60
      },
      {
        name: "Offline Production III",
        effect: "Increase offline cookie production 1x -> 1.5x",
        multiplier: 1.5,
        cost: 2500000,
        buildingsRequired: 120
      },
      {
        name: "Offline Production IV",
        effect: "Increase offline cookie production 1.5x -> 2x",
        multiplier: 2,
        cost: 20000000,
        buildingsRequired: 200
      }, {
        name: "Offline Production V",
        effect: "Increase offline cookie production 2x -> 3x",
        multiplier: 3,
        cost: 100000000,
        buildingsRequired: 300
      }
    ]
  },
]; 