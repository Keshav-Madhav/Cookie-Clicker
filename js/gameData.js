export const buildings = [
  { name: "Cursor", cost: 15, cps: 0.1, cost_multiplier: 1.25 },
  { name: "Grandma", cost: 100, cps: 1, cost_multiplier: 1.2 },
  { name: "Farm", cost: 1100, cps: 8 },
  { name: "Factory", cost: 12000, cps: 47 },
  { name: "Mine", cost: 130000, cps: 260 },
  { name: "Shipment", cost: 1400000,cps: 1400 },
  { name: "Alchemy Lab", cost: 20000000, cps: 7800 },
  { name: "Portal", cost: 330000000,  cps: 44000 },
];

export const upgrades = [
  { name: "Better Click", cost: 50, effect: "Increase clicking power by 50%", type: "clickMultiplier", multiplier: 1.5 },
  { name: "Efficient Grandmas", cost: 500, effect: "Grandmas produce twice as much", type: "buildingBoost", target: "Grandma", multiplier: 2 },
  { name: "Farm Expansion", cost: 5000, effect: "Farms produce 50% more", type: "buildingBoost", target: "Farm", multiplier: 1.5 },
  { name: "Golden Touch", cost: 10000, effect: "Clicking gives 5x cookies", type: "clickMultiplier", multiplier: 5 , max_level: 1},
  { name: "Factory Overdrive", cost: 100000, effect: "Factories are twice as efficient", type: "buildingBoost", target: "Factory", multiplier: 2 },
  { name: "Mine Boost", cost: 1000000, effect: "Mines produce 50% more", type: "buildingBoost", target: "Mine", multiplier: 1.5, cost_multiplier: 1.5 },
  { name: "Shipment Upgrade", cost: 10000000, effect: "Shipments are twice as efficient", type: "buildingBoost", target: "Shipment", multiplier: 2 },
  { name: "Alchemy Lab Boost", cost: 100000000, effect: "Alchemy Labs produce 50% more", type: "buildingBoost", target: "Alchemy Lab", multiplier: 1.5, cost_multiplier: 1.35 },
  { name: "Portal Boost", cost: 1000000000, effect: "Portals are twice as efficient", type: "buildingBoost", target: "Portal", multiplier: 2 },
];
