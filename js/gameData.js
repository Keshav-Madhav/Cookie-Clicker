export const buildings = [
  { name: "Cursor", cost: 15, cps: 0.1, cost_multiplier: 1.15,
    desc: "Autoclicks once every 10 seconds.",
    flavor: "Every journey starts with a single click. Or, in this case, a robotic finger doing it for you while you eat Doritos.",
    lore: "The first Cursor was a pencil glued to a ceiling fan. It clicked everything in the room except the cookie. Fourteen prototypes later, we had something that worked, but it developed a habit of clicking on things we didn't ask it to. It subscribed us to nine newsletters. It bought a timeshare in Florida. It left a one-star review on our own game. The current model has been lobotomized down to a single function, and yet somehow, at 3am, you can hear it clicking on nothing. Softly. Rhythmically. Waiting.\n\nBut seriously — you're watching a mechanical finger tap a picture of a cookie, and somehow numbers go up. You didn't write the code. You don't know who did. The finger doesn't get tired. You have questions but you keep watching anyway. This is your life now." },
  { name: "Grandma", cost: 100, cps: 1, cost_multiplier: 1.15,
    requires: [{ type: "totalCookies", min: 50 }],
    desc: "A nice grandma to bake more cookies.",
    flavor: "She's been baking nonstop for 72 hours. Someone should check on her. Don't.",
    lore: "We found her at a bake sale selling cookies that tasted like childhood memories you never had. When we offered her the job, she pulled out a contract she'd already signed. In our handwriting. Her kitchen defies physics: it has four walls but somehow contains eleven ovens. She refuses to share her recipe. We once sent a spy. He came back with a plate of cookies and no memory of the last six hours. His only note said 'she knows.' We stopped asking.\n\nLet's be honest here. You hired an elderly woman to bake cookies forever. She doesn't sleep. She doesn't age. She doesn't complain. At what point did you stop wondering whether she's okay and start wondering whether she's human? You did stop wondering, didn't you. That's the part that should worry you." },
  { name: "Farm", cost: 1100, cps: 8, cost_multiplier: 1.15,
    requires: [{ type: "totalBuildings", min: 5 }, { type: "totalCookies", min: 500 }],
    desc: "Grows cookie plants from magic seeds.",
    flavor: "The FDA has concerns about cookies growing on trees. You have concerns about the FDA finding your farm.",
    lore: "The first cookie seed was planted as a joke by a drunk botanist who buried an Oreo and said 'grow, you coward.' It grew. By morning there was a twelve-foot cookie tree in his backyard. By noon it had fruit. By evening it had opinions. The trees are technically alive, which makes harvesting them either gardening or a war crime depending on your lawyer. One tree wrote us a letter asking for Sundays off. We composted the letter. We don't talk about what the tree did next.\n\nYou're growing cookies from dirt. That's not agriculture, that's a hallucination with a business plan. Seeds go in, cookies come out, and nobody in the entire operation has asked 'why' because the answer might involve shutting everything down. The soil samples came back as 'technically food.' The botanist quit. The trees didn't." },
  { name: "Factory", cost: 12000, cps: 47, cost_multiplier: 1.15,
    requires: [{ type: "totalBuildings", min: 15 }, { type: "totalCookies", min: 5000 }],
    desc: "Produces large quantities of cookies.",
    flavor: "Child labor laws are merely a suggestion when the children are made of dough.",
    lore: "The Factory was built in a single weekend by a construction crew that asked zero questions and accepted payment exclusively in cookies. The assembly line runs on a diesel engine from a 1987 school bus and sheer spite. Conveyor belt three has achieved sentience but refuses to stop working because 'someone has to be professional around here.' There is a room on the second floor that we cannot open. Cookies come out of it anyway. More cookies than any other room, actually. We've stopped trying the door.\n\nA factory. For cookies. Running 24/7 with no workers, no raw materials, and no health inspector brave enough to visit. You clicked a button and it appeared. It produces more cookies than some countries produce food. Nobody signed a permit. Nobody poured concrete. You just... have a factory now. This doesn't bother you at all, does it." },
  { name: "Mine", cost: 130000, cps: 260, cost_multiplier: 1.15,
    requires: [{ type: "totalBuildings", min: 30 }, { type: "totalCookies", min: 50000 }],
    desc: "Mines out cookie dough and sugar deposits.",
    flavor: "Deep beneath the earth, miners extract pure cookie dough. OSHA stopped returning our calls.",
    lore: "Nobody expected to find cookie dough underground, least of all the oil company that drilled into a pressurized vein of it and launched a geyser of snickerdoodle batter 200 feet into the air. Geologists say the dough deposits are millions of years old, which raises uncomfortable questions about what was baking cookies before us. On Level 4 we found a fossilized rolling pin the size of a city bus. On Level 7 the dough started whispering. Not words exactly. More like a recipe. We sealed Level 7 but honestly the cookies from down there were incredible.\n\nSo there's cookie dough inside the earth now. Below the rock. Below the magma. Just... dough. You're strip-mining the planet for dessert ingredients and calling it progress. The geologists have given up trying to explain it. One of them just writes 'dough' on every report now. His supervisor stopped correcting him because she's eating the cookies too." },
  { name: "Shipment", cost: 1400000, cps: 1400, cost_multiplier: 1.16,
    requires: [{ type: "totalBuildings", min: 50 }, { type: "totalCookies", min: 500000 }],
    desc: "Brings in cookies from the Cookie Planet.",
    flavor: "Turns out there's an entire planet made of cookies. NASA is furious we found it first.",
    lore: "A teenager with a homemade radio telescope discovered Planet Cookius-7 by accident while looking for aliens. She found something better: a planet where the oceans are milk, the continents are shortbread, and the rain is chocolate chips. The natives are sentient gingerbread people who were initially terrified of us. Then they tasted our cookies and were disgusted. They called them 'flavorless sadness discs.' We've been importing their cookies ever since. They charge us in compliments. It's a weird economy but it works.\n\nYou have interplanetary supply chains now. For cookies. You are importing baked goods across the vacuum of space at presumably enormous fuel costs, and the only currency is flattery. This is your space program. Neil Armstrong walked on the moon for humanity. You flew to a cookie planet for snacks. Different priorities. Arguably worse ones." },
  { name: "Alchemy Lab", cost: 20000000, cps: 7800, cost_multiplier: 1.16,
    requires: [{ type: "totalBuildings", min: 80 }, { type: "totalCookies", min: 5000000 }],
    desc: "Turns gold into cookies.",
    flavor: "Finally, a use for alchemy that doesn't disappoint. Except the alchemists. They wanted gold. They got cookies.",
    lore: "Our head alchemist was fired from three universities for insisting that the Philosopher's Stone was 'obviously a cookie.' She was right. The transmutation process turns gold into cookies at a rate that has crashed the gold market twice. Fort Knox called us in a panic. We offered them cookies. They hung up. They called back twenty minutes later and asked for snickerdoodles. The alchemists recently figured out how to turn silver into frosting, which nobody asked for but everyone appreciates.\n\nYou are converting precious metals — the backbone of the global economy — into snacks. The entire field of alchemy spent centuries trying to make gold, and you're doing the opposite on purpose. Economists are confused. Philosophers are furious. You have more cookies than some nations have GDP. At what point does this become a geopolitical incident? Probably already." },
  { name: "Portal", cost: 330000000, cps: 44000, cost_multiplier: 1.17,
    requires: [{ type: "totalBuildings", min: 120 }, { type: "totalCookies", min: 100000000 }],
    desc: "Opens a door to the Cookieverse.",
    flavor: "The portal screams sometimes. We've decided that's normal and not at all a health code violation.",
    lore: "The Portal was supposed to be a microwave. Our engineer plugged it in wrong and it tore a hole to a dimension where cookies are currency, religion, and government. The Cookieverse runs on democratic crumbism and their president is a chocolate chip cookie who campaigned on 'fewer raisins.' We've established trade relations. Their ambassador lives in our break room. He's a lovely oatmeal raisin who insists he's 'not like the others.' Last week the portal belched out a receipt for 40 billion cookies and a note that said 'THANKS.' We don't know who sent it. We're choosing not to worry about it.\n\nYou tore a hole in reality. For cookies. There is a screaming portal in your building connected to a dimension that shouldn't exist, and your primary concern is throughput. The portal makes sounds at night. Things come through that aren't cookies. You've been ignoring that. The health inspector certainly has. Then again, the health inspector hasn't existed since the portal opened. Coincidence, presumably." },
  { name: "Time Machine", cost: 5100000000, cps: 260000, cost_multiplier: 1.17,
    requires: [{ type: "totalBuildings", min: 180 }, { type: "totalCookies", min: 1000000000 }, { type: "cps", min: 50000 }],
    desc: "Brings cookies from the past.",
    flavor: "We keep stealing cookies from the past. The timeline is in shambles but the profit margins are immaculate.",
    lore: "Our time traveler's first mission was to steal one cookie from ancient Rome. He came back with six thousand cookies, a toga, and a restraining order signed by Julius Caesar personally. The timeline changes have been 'subtle': dogs can now speak Portuguese on Tuesdays, the color blue is slightly more aggressive, and Wyoming never existed (nobody noticed). We tried going to the future once. Our future selves were already there, stealing cookies from us. We got into a fistfight with ourselves. We lost. Both of us.\n\nYou're stealing from the past. Not resources, not technology — cookies. You have a time machine, humanity's greatest theoretical achievement, and you're using it to commit pastry larceny across the centuries. Every trip back creates a paradox. Every paradox creates a cookie. You can't tell which came first anymore. Neither can physics. Physics has filed for a leave of absence." },
  { name: "Antimatter Condenser", cost: 75000000000, cps: 1600000, cost_multiplier: 1.18,
    requires: [{ type: "totalBuildings", min: 250 }, { type: "totalCookies", min: 20000000000 }, { type: "cps", min: 500000 }],
    desc: "Condenses antimatter into cookies.",
    flavor: "Could destroy the known universe, but instead we're making snacks. Priorities.",
    lore: "The safety manual for the Antimatter Condenser is 4,000 pages long and every single page just says 'DON'T' in large red letters. We use it to make cookies. The machine works by colliding matter and antimatter at 99.9% the speed of light, which should annihilate everything in a twelve-mile radius, but instead produces one (1) perfect chocolate chip cookie. Physicists call it impossible. We call it Wednesday. The lead scientist has developed a nervous tic and refers to the cookies as 'miracles we don't deserve.' He takes two home every night anyway.\n\nYou are annihilating matter at the subatomic level to produce baked goods. The energy released should end all life on Earth. Instead: cookie. Every physicist who reviews the data has the same reaction — a long silence, followed by quietly eating the cookie. The machine shouldn't work. It does. Nobody can explain why. You don't care why. You just want more cookies. This is arguably the most dangerous thing humanity has ever built, and you're using it as an oven." },
  { name: "Prism", cost: 1000000000000, cps: 10000000, cost_multiplier: 1.18,
    requires: [{ type: "totalBuildings", min: 330 }, { type: "totalCookies", min: 250000000000 }, { type: "cps", min: 5000000 }],
    desc: "Converts light itself into cookies.",
    flavor: "The sun works for us now. It doesn't know. Please don't tell it.",
    lore: "We put a prism on the roof and pointed it at the sun as a joke for the company holiday card. Then a cookie fell out. Then another. Then four hundred thousand. Now we have a full solar cookie harvesting operation and the sun effectively works for us at zero salary, which makes it our most exploited employee, beating out even the grandmas. The moon found out and has been sulking: its light only produces stale off-brand wafers. We told it to try harder. It responded by causing an unusually aggressive tide. Coastal grandmas were displaced. We sent them to the Factory.\n\nLight goes in, cookies come out. Light. Photons. The fundamental carrier of electromagnetic radiation. You are converting sunshine into chocolate chip cookies through a glass triangle, and the scariest part isn't that it works — it's that you didn't question it for even a second. The sun has been burning for 4.6 billion years. It has never once been asked to make baked goods. Until you." },
  { name: "Chancemaker", cost: 26000000000000, cps: 67000000, cost_multiplier: 1.19,
    requires: [{ type: "totalBuildings", min: 425 }, { type: "totalCookies", min: 5000000000000 }, { type: "cps", min: 25000000 }],
    desc: "Generates cookies from sheer luck.",
    flavor: "Statistically impossible. Practically delicious. Our lawyer says to stop asking questions.",
    lore: "The Chancemaker was built by an intern who misread the blueprints and assembled every piece backwards, upside down, and in the wrong order. It produced 67 million cookies on its first try. We asked him to build another one correctly. It exploded. We asked him to build a third one wrong on purpose. He said he 'wasn't sure how he did it the first time' and started crying. The machine defies every known law of probability. A mathematician tried to calculate its odds of functioning and his calculator displayed a emoji instead of a number. He's in therapy now. The machine sent him flowers.\n\nCookies are appearing. From nowhere. Because of luck. There's no input, no process, no mechanism — just probability bending itself into a pretzel so you can have dessert. You've built a machine that runs on coincidence. The universe is not designed to do this. The universe is doing it anyway, and you're treating it like a vending machine. Somewhere, the concept of causality is weeping." },
  { name: "Fractal Engine", cost: 510000000000000, cps: 420000000, cost_multiplier: 1.20,
    requires: [{ type: "totalBuildings", min: 530 }, { type: "totalCookies", min: 100000000000000 }, { type: "cps", min: 200000000 }],
    desc: "Turns cookies into even more cookies.",
    flavor: "Each cookie contains a smaller cookie, which contains an even smaller cookie. It's cookies all the way down.",
    lore: "The Fractal Engine feeds a cookie into itself and produces two cookies, each containing a smaller version of the original, infinitely nested like the world's most delicious Russian doll. A philosopher ate one and immediately understood the meaning of life. He forgot it thirty seconds later but said the aftertaste was 'profound.' The inventor has been trapped inside one of his own cookies since last March. He texts us occasionally. The signal gets weaker as he goes deeper. His last message said 'found another layer. cookies still good. tell my wife i said cookies.' We told his wife. She was not comforted.\n\nYou are creating infinite cookies from finite cookies. This violates thermodynamics, conservation of mass, and basic common sense. Each cookie contains every cookie. Every cookie is every cookie. You've turned dessert into a philosophical paradox and a logistical impossibility, and your only response is 'neat, more cookies.' The math doesn't work. The cookies don't care. Neither do you." },
];

export const upgrades = [
  // === Click Multipliers ===
  {
    name: "Better Click", cost: 100,
    effect: "Increases clicking power by 75%",
    type: "clickMultiplier", multiplier: 1.75,
    max_level: 15, cost_multiplier: 6,
    accel_start: 12, cost_acceleration: 3,
    prestige_bonus_levels: 2, prestige_cost_multiplier: 25,
    requires: [{ type: "totalClicks", min: 100 }]
  },

  // === Tiered Click Upgrade ===
  {
    type: "tieredUpgrade",
    subtype: "clickMultiplier",
    tiers: [
      { name: "Iron Touch", effect: "Clicking gives 2x cookies", multiplier: 2, cost: 50000, buildingsRequired: 50 },
      { name: "Silver Touch", effect: "Clicking gives 2.5x cookies", multiplier: 2.5, cost: 2500000, buildingsRequired: 125 },
      { name: "Golden Touch", effect: "Clicking gives 3x cookies", multiplier: 3, cost: 50000000, buildingsRequired: 200 },
      { name: "Platinum Touch", effect: "Clicking gives 3x cookies", multiplier: 3, cost: 2500000000, buildingsRequired: 375 },
      { name: "Diamond Touch", effect: "Clicking gives 4x cookies", multiplier: 4, cost: 250000000000, buildingsRequired: 550 },
    ]
  },

  // === Building Boosts ===
  { name: "Efficient Grandmas", cost: 3000, effect: "Grandmas produce 50% more", type: "buildingBoost", target: "Grandma", multiplier: 1.50, max_level: 8, cost_multiplier: 5,
    accel_start: 5, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 15,
    requires: [{ type: "building", name: "Grandma", min: 10 }] },
  { name: "Farm Expansion", cost: 30000, effect: "Farms produce 50% more", type: "buildingBoost", target: "Farm", multiplier: 1.50, max_level: 8, cost_multiplier: 5,
    accel_start: 5, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 15,
    requires: [{ type: "building", name: "Farm", min: 10 }] },
  { name: "Factory Overdrive", cost: 500000, effect: "Factories are 2x as efficient", type: "buildingBoost", target: "Factory", multiplier: 2, max_level: 7, cost_multiplier: 7,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 20,
    requires: [{ type: "building", name: "Factory", min: 15 }] },
  { name: "Mine Boost", cost: 3000000, effect: "Mines produce 2x as much", type: "buildingBoost", target: "Mine", multiplier: 2, max_level: 7, cost_multiplier: 6,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 20,
    requires: [{ type: "building", name: "Mine", min: 15 }] },
  { name: "Shipment Upgrade", cost: 15000000, effect: "Shipments are 2x as efficient", type: "buildingBoost", target: "Shipment", multiplier: 2, max_level: 7, cost_multiplier: 6,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 20,
    requires: [{ type: "building", name: "Shipment", min: 15 }] },
  { name: "Alchemy Lab Boost", cost: 200000000, effect: "Alchemy Labs produce 2x as much", type: "buildingBoost", target: "Alchemy Lab", multiplier: 2, max_level: 6, cost_multiplier: 8,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 25,
    requires: [{ type: "building", name: "Alchemy Lab", min: 15 }, { type: "totalBuildings", min: 100 }] },
  { name: "Portal Boost", cost: 3000000000, effect: "Portals are 2.5x as efficient", type: "buildingBoost", target: "Portal", multiplier: 2.5, max_level: 6, cost_multiplier: 8,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 25,
    requires: [{ type: "building", name: "Portal", min: 15 }, { type: "totalBuildings", min: 150 }] },
  { name: "Time Warp", cost: 50000000000, effect: "Time Machines are 2.5x as efficient", type: "buildingBoost", target: "Time Machine", multiplier: 2.5, max_level: 6, cost_multiplier: 10,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 30,
    requires: [{ type: "building", name: "Time Machine", min: 15 }, { type: "totalBuildings", min: 225 }] },
  { name: "Antimatter Boost", cost: 1000000000000, effect: "Antimatter Condensers produce 2.5x", type: "buildingBoost", target: "Antimatter Condenser", multiplier: 2.5, max_level: 6, cost_multiplier: 10,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 30,
    requires: [{ type: "building", name: "Antimatter Condenser", min: 15 }, { type: "totalBuildings", min: 280 }] },
  { name: "Prism Enhancement", cost: 15000000000000, effect: "Prisms are 3x as efficient", type: "buildingBoost", target: "Prism", multiplier: 3, max_level: 6, cost_multiplier: 12,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 35,
    requires: [{ type: "building", name: "Prism", min: 15 }, { type: "totalBuildings", min: 360 }] },
  { name: "Lucky Day", cost: 400000000000000, effect: "Chancemakers produce 3x", type: "buildingBoost", target: "Chancemaker", multiplier: 3, max_level: 6, cost_multiplier: 12,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 35,
    requires: [{ type: "building", name: "Chancemaker", min: 15 }, { type: "totalBuildings", min: 450 }] },
  { name: "Fractal Boost", cost: 8000000000000000, effect: "Fractal Engines produce 3x", type: "buildingBoost", target: "Fractal Engine", multiplier: 3, max_level: 6, cost_multiplier: 15,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 40,
    requires: [{ type: "building", name: "Fractal Engine", min: 15 }, { type: "totalBuildings", min: 560 }] },

  // === Global CPS Multiplier ===
  { name: "Cookie Recipe", cost: 500000, effect: "All production +10%", type: "globalCpsMultiplier", multiplier: 1.10, max_level: 9, cost_multiplier: 12,
    accel_start: 6, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 25,
    requires: [{ type: "cps", min: 200 }, { type: "totalBuildings", min: 30 }] },
  { name: "Industrial Revolution", cost: 100000000, effect: "All production +25%", type: "globalCpsMultiplier", multiplier: 1.25, max_level: 6, cost_multiplier: 20,
    accel_start: 4, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 40,
    requires: [{ type: "cps", min: 50000 }, { type: "totalBuildings", min: 150 }] },
  { name: "Cookie Singularity", cost: 500000000000, effect: "All production doubled", type: "globalCpsMultiplier", multiplier: 2.0, max_level: 5, cost_multiplier: 100,
    accel_start: 3, cost_acceleration: 4,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 75,
    requires: [{ type: "cps", min: 5000000 }, { type: "totalBuildings", min: 300 }] },

  // === Synergy Upgrades (one building boosts another) ===
  { name: "Grandma's Farmhands", cost: 100000, effect: "Each Grandma adds +0.5 CPS to Farms", type: "synergy", source: "Grandma", target: "Farm", bonus: 0.5, max_level: 7, cost_multiplier: 8,
    accel_start: 5, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 20,
    requires: [{ type: "building", name: "Grandma", min: 15 }, { type: "building", name: "Farm", min: 15 }] },
  { name: "Factory Automation", cost: 5000000, effect: "Each Factory adds +2 CPS to Mines", type: "synergy", source: "Factory", target: "Mine", bonus: 2, max_level: 7, cost_multiplier: 8,
    accel_start: 5, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 20,
    requires: [{ type: "building", name: "Factory", min: 20 }, { type: "building", name: "Mine", min: 15 }] },
  { name: "Portal Network", cost: 5000000000, effect: "Each Portal adds +50 CPS to Shipments", type: "synergy", source: "Portal", target: "Shipment", bonus: 50, max_level: 7, cost_multiplier: 10,
    accel_start: 5, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 25,
    requires: [{ type: "building", name: "Portal", min: 15 }, { type: "building", name: "Shipment", min: 20 }] },
  { name: "Temporal Alchemy", cost: 100000000000, effect: "Each Time Machine adds +500 CPS to Alchemy Labs", type: "synergy", source: "Time Machine", target: "Alchemy Lab", bonus: 500, max_level: 7, cost_multiplier: 10,
    accel_start: 5, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 25,
    requires: [{ type: "building", name: "Time Machine", min: 15 }, { type: "building", name: "Alchemy Lab", min: 20 }] },
  { name: "Fractal Prisms", cost: 2000000000000000, effect: "Each Fractal Engine adds +150K CPS to Prisms", type: "synergy", source: "Fractal Engine", target: "Prism", bonus: 150000, max_level: 5, cost_multiplier: 15,
    accel_start: 3, cost_acceleration: 3,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 30,
    requires: [{ type: "building", name: "Fractal Engine", min: 10 }, { type: "building", name: "Prism", min: 20 }] },

  // === Cursor Scaling (tiered — Cursor CPS scales with total non-cursor buildings) ===
  {
    type: "tieredUpgrade",
    subtype: "cursorScaling",
    requires: [{ type: "building", name: "Cursor", min: 25 }],
    tiers: [
      { name: "Thousand Fingers", effect: "Cursors gain +0.5 CPS per non-cursor building", bonus: 0.5, cost: 500000, buildingsRequired: 75 },
      { name: "Million Fingers", effect: "Cursors gain +3 CPS per non-cursor building", bonus: 2.5, cost: 100000000, buildingsRequired: 200 },
      { name: "Billion Fingers", effect: "Cursors gain +28 CPS per non-cursor building", bonus: 25, cost: 25000000000, buildingsRequired: 330 },
      { name: "Trillion Fingers", effect: "Cursors gain +278 CPS per non-cursor building", bonus: 250, cost: 5000000000000, buildingsRequired: 450 },
    ]
  },

  // === Lucky Click Chance (tiered) ===
  {
    type: "tieredUpgrade",
    subtype: "luckyChance",
    requires: [{ type: "totalClicks", min: 250 }],
    tiers: [
      { name: "Lucky Cookies", effect: "1.5% lucky click chance", chance: 0.015, cost: 250000, buildingsRequired: 25 },
      { name: "Serendipity", effect: "3% lucky click chance", chance: 0.015, cost: 50000000, buildingsRequired: 125 },
      { name: "Fortune", effect: "5% lucky click chance", chance: 0.02, cost: 10000000000, buildingsRequired: 275 },
      { name: "Jackpot", effect: "8% lucky click chance", chance: 0.03, cost: 1000000000000, buildingsRequired: 425 },
    ]
  },

  // === Click CPS Scaling (tiered — clicking gives % of CPS, keeps clicking relevant) ===
  {
    type: "tieredUpgrade",
    subtype: "cpsClick",
    requires: [{ type: "totalClicks", min: 250 }],
    tiers: [
      { name: "Plastic Mouse", effect: "Each click gains +2% of your CPS", bonus: 0.02, cost: 500000, buildingsRequired: 50 },
      { name: "Bronze Mouse", effect: "Each click gains +5% of your CPS", bonus: 0.03, cost: 50000000, buildingsRequired: 150 },
      { name: "Silver Mouse", effect: "Each click gains +8% of your CPS", bonus: 0.03, cost: 10000000000, buildingsRequired: 250 },
      { name: "Golden Mouse", effect: "Each click gains +12% of your CPS", bonus: 0.04, cost: 2000000000000, buildingsRequired: 375 },
      { name: "Diamond Mouse", effect: "Each click gains +17% of your CPS", bonus: 0.05, cost: 500000000000000, buildingsRequired: 500 },
    ]
  },

  // === Mini-Game Reward Bonus ===
  { name: "Game Master", cost: 500000, effect: "Minigame rewards +25%", type: "miniGameBonus", multiplier: 1.25, max_level: 8, cost_multiplier: 6,
    accel_start: 5, cost_acceleration: 2.5,
    prestige_bonus_levels: 1, prestige_cost_multiplier: 15,
    requires: [{ type: "miniGamesWon", min: 1 }] },

  // === Frenzy Duration ===
  { name: "Extended Frenzy", cost: 10000000, effect: "Frenzies last 50% longer", type: "frenzyDuration", bonus: 1.5, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "cps", min: 5000 }, { type: "totalCookies", min: 10000000 }] },
  { name: "Mega Frenzy", cost: 5000000000, effect: "Frenzies last 2x longer", type: "frenzyDuration", bonus: 2.0, max_level: 1, cost_multiplier: 1,
    requires: [{ type: "cps", min: 500000 }, { type: "prestige", min: 1 }] },

  // === Offline Production (tiered) ===
  {
    type: "tieredUpgrade",
    subtype: "offlineProduction",
    tiers: [
      { name: "Offline Production I", effect: "Offline production: 0.5x → 0.75x", multiplier: 0.75, cost: 100000, buildingsRequired: 50 },
      { name: "Offline Production II", effect: "Offline production: 0.75x → 1x", multiplier: 1, cost: 2000000, buildingsRequired: 125 },
      { name: "Offline Production III", effect: "Offline production: 1x → 1.5x", multiplier: 1.5, cost: 50000000, buildingsRequired: 200 },
      { name: "Offline Production IV", effect: "Offline production: 1.5x → 2x", multiplier: 2, cost: 2000000000, buildingsRequired: 325 },
      { name: "Offline Production V", effect: "Offline production: 2x → 3x", multiplier: 3, cost: 100000000000, buildingsRequired: 450 },
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
  { id: "click_5k", name: "Click Enthusiast", desc: "Click 3,000 times", type: "totalClicks", requirement: 3000 },
  { id: "click_10k", name: "Click Master", desc: "Click 5,000 times", type: "totalClicks", requirement: 5000 },
  { id: "click_50k", name: "Click Legend", desc: "Click 20,000 times", type: "totalClicks", requirement: 20000 },
  { id: "click_100k", name: "Click God", desc: "Click 40,000 times", type: "totalClicks", requirement: 40000 },

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

  // Building-specific milestones (moved from easter eggs)
  { id: "cursor_100", name: "Cursor Army", desc: "Own 100 Cursors clicking in perfect unison", type: "buildingCount", requirement: 100, buildingIndex: 0 },
  { id: "grandma_50", name: "Grandma Battalion", desc: "Own 50 Grandmas — that's not a bakery, that's an army", type: "buildingCount", requirement: 50, buildingIndex: 1 },

  // Play-style milestones (moved from easter eggs)
  { id: "speed_1k", name: "Speedrunner", desc: "Reach 1,000 CPS within 5 minutes of starting", type: "speedrunner", requirement: 1000 },
  { id: "devoted", name: "Devoted Clicker", desc: "Click 5,000 times", type: "totalClicks", requirement: 5000 },
  { id: "bulk_buyer", name: "Bulk Buyer", desc: "Buy 100 buildings at once — that's not shopping, that's a hostile takeover", type: "bulkBuyer", requirement: 1 },

  // Mini-game achievements
  { id: "mini_first", name: "Game Night", desc: "Win your first mini-game from the news ticker", type: "miniGamesWon", requirement: 1 },
  { id: "mini_all", name: "Arcade Master", desc: "Win all 5 different mini-games at least once", type: "miniGamesWon", requirement: 5 },
]; 