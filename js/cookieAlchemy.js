import { formatNumberInWords } from './utils.js';

// ─── Configuration ───
const ALCHEMY_CONFIG = {
  sessionDurationMs: 60000,
  discoveryTarget: null, // set dynamically from buildAlchemy() total
  legendaryThreshold: 15,
  epicThreshold: 10,
  greatThreshold: 6,
  normalThreshold: 3,
  resultDisplayMs: 3000,
  hintCount: 2, // shown only after 5 failed merges
};

// ─── 20 Base Ingredients ───
const ALCHEMY_BASES = [
  ['flour','🌾','Flour'],['sugar','🍬','Sugar'],['egg','🥚','Egg'],['butter','🧈','Butter'],
  ['milk','🥛','Milk'],['water','💧','Water'],['fire','🔥','Fire'],['chocolate','🍫','Chocolate'],
  ['vanilla','🌿','Vanilla'],['honey','🍯','Honey'],['fruit','🍓','Fruit'],['nuts','🥜','Nuts'],
  ['salt','🧂','Salt'],['cream','🍦','Cream'],['yeast','🫧','Yeast'],['spice','🫚','Spice'],
  ['ice','🧊','Ice'],['oil','🫒','Oil'],['lemon','🍋','Lemon'],['coffee','☕','Coffee'],
];

// ─── Starter Items (only these 4 are available at the start) ───
const STARTER_IDS = ['flour', 'water', 'fire', 'sugar'];

// ─── Base Unlock Milestones ───
const BASE_UNLOCKS = [
  { at: 5, id: 'egg' }, { at: 10, id: 'butter' }, { at: 15, id: 'milk' },
  { at: 20, id: 'chocolate' }, { at: 25, id: 'vanilla' }, { at: 30, id: 'honey' },
  { at: 35, id: 'fruit' }, { at: 40, id: 'nuts' }, { at: 45, id: 'salt' },
  { at: 50, id: 'cream' }, { at: 55, id: 'yeast' }, { at: 60, id: 'spice' },
  { at: 65, id: 'ice' }, { at: 70, id: 'oil' }, { at: 75, id: 'lemon' },
  { at: 80, id: 'coffee' },
];

// ─── Core Recipes ───
const CORE = [
  // ─── TIER 1: Base + Base (80) ───
  ['flour','water','dough','🫓','Dough',1,'dough'],
  ['flour','egg','batter','🥣','Batter',1,'batter'],
  ['flour','butter','crumble','🫗','Crumble',1,'mix'],
  ['flour','milk','roux','🥄','Roux',1,'sauce'],
  ['flour','oil','fry_batter','🍳','Fry Batter',1,'batter'],
  ['flour','yeast','bread_dough','🍞','Bread Dough',1,'dough'],
  ['flour','sugar','cookie_mix','🥄','Cookie Mix',1,'mix'],
  ['flour','salt','salted_dough','🧊','Salted Dough',1,'dough'],
  ['flour','spice','spiced_flour','🌶️','Spiced Flour',1,'mix'],
  ['flour','chocolate','choco_flour','🟫','Choco Flour',1,'mix'],
  ['flour','coffee','coffee_flour','☕','Coffee Flour',1,'mix'],
  ['flour','honey','honey_dough_raw','🍯','Honey Dough',1,'dough'],
  ['sugar','water','syrup','🫗','Syrup',1,'syrup'],
  ['sugar','fire','caramel','🍮','Caramel',1,'candy'],
  ['sugar','egg','meringue','🤍','Meringue',1,'meringue'],
  ['sugar','butter','toffee_base','✨','Toffee Base',1,'candy'],
  ['sugar','cream','sweet_cream','🍨','Sweet Cream',1,'cream'],
  ['sugar','fruit','fruit_candy','🍭','Fruit Candy',1,'candy'],
  ['sugar','vanilla','vanilla_sugar','🌸','Vanilla Sugar',1,'mix'],
  ['sugar','spice','spice_mix','🎭','Spice Mix',1,'mix'],
  ['sugar','lemon','lemon_sugar','🍋','Lemon Sugar',1,'mix'],
  ['sugar','coffee','coffee_sugar','☕','Coffee Sugar',1,'mix'],
  ['sugar','ice','sugar_ice','🧊','Sugar Ice',1,'frozen'],
  ['egg','fire','fried_egg','🍳','Fried Egg',1,'misc'],
  ['egg','milk','custard_base','🥧','Custard Base',1,'custard'],
  ['egg','cream','egg_cream','🥛','Egg Cream',1,'cream'],
  ['egg','vanilla','vanilla_egg','🌿','Vanilla Egg Mix',1,'mix'],
  ['butter','fire','ghee','💛','Ghee',1,'fat'],
  ['butter','chocolate','ganache','🟫','Ganache',1,'sauce'],
  ['butter','honey','honey_butter','🧈','Honey Butter',1,'spread'],
  ['butter','salt','salted_butter','🧈','Salted Butter',1,'fat'],
  ['butter','cream','buttercream','🎀','Buttercream',1,'frosting'],
  ['milk','fire','warm_milk','☕','Warm Milk',1,'drink'],
  ['milk','chocolate','hot_cocoa','☕','Hot Cocoa',1,'drink'],
  ['milk','vanilla','vanilla_milk','🥛','Vanilla Milk',1,'drink'],
  ['milk','honey','milk_honey','🍶','Milk Honey',1,'drink'],
  ['milk','coffee','cafe_latte','☕','Café Latte',1,'drink'],
  ['water','fire','steam','♨️','Steam',1,'misc'],
  ['water','fruit','juice','🧃','Juice',1,'drink'],
  ['water','honey','nectar','🌺','Nectar',1,'drink'],
  ['water','lemon','lemon_water','🍋','Lemon Water',1,'drink'],
  ['water','coffee','black_coffee','☕','Black Coffee',1,'drink'],
  ['water','ice','cold_water','💧','Cold Water',1,'misc'],
  ['fire','chocolate','melted_choco','🫕','Melted Choco',1,'chocolate'],
  ['fire','nuts','roasted_nuts','🥜','Roasted Nuts',1,'nuts'],
  ['fire','cream','scalded_cream','🔥','Scalded Cream',1,'cream'],
  ['fire','spice','toasted_spice','🫚','Toasted Spice',1,'mix'],
  ['fire','oil','hot_oil','🫒','Hot Oil',1,'misc'],
  ['chocolate','vanilla','dark_delight','🖤','Dark Delight',1,'chocolate'],
  ['chocolate','nuts','choco_nuts','🌰','Choco Nuts',1,'chocolate'],
  ['chocolate','cream','choco_cream','🍫','Choco Cream',1,'cream'],
  ['chocolate','honey','choco_honey','🍫','Choco Honey',1,'chocolate'],
  ['chocolate','coffee','mocha_mix','☕','Mocha Mix',1,'mix'],
  ['honey','fruit','preserve','🫙','Preserve',1,'jam'],
  ['honey','nuts','honey_nuts','🍯','Honey Nuts',1,'nuts'],
  ['honey','spice','spiced_honey','🐝','Spiced Honey',1,'mix'],
  ['fruit','cream','fruit_cream','🍓','Fruit Cream',1,'cream'],
  ['fruit','nuts','trail_mix','🥜','Trail Mix',1,'misc'],
  ['fruit','lemon','citrus_blend','🍊','Citrus Blend',1,'mix'],
  ['fruit','ice','frozen_fruit','🧊','Frozen Fruit',1,'frozen'],
  ['nuts','butter','nut_butter','🥜','Nut Butter',1,'spread'],
  ['nuts','sugar','candied_nuts_raw','🍬','Raw Candied Nuts',1,'misc'],
  ['nuts','salt','salted_nuts','🧂','Salted Nuts',1,'nuts'],
  ['cream','vanilla','vanilla_cream','🍦','Vanilla Cream',1,'cream'],
  ['cream','coffee','coffee_cream','☕','Coffee Cream',1,'cream'],
  ['cream','lemon','lemon_cream','🍋','Lemon Cream',1,'cream'],
  ['cream','ice','ice_cream_base','🍨','Ice Cream Base',1,'frozen'],
  ['salt','spice','seasoning','🧂','Seasoning',1,'mix'],
  ['salt','lemon','preserved_lemon','🍋','Preserved Lemon',1,'misc'],
  ['ice','milk','cold_milk','🥛','Cold Milk',1,'drink'],
  ['ice','coffee','iced_coffee','🧊','Iced Coffee',1,'drink'],
  ['ice','lemon','lemon_ice','🍋','Lemon Ice',1,'frozen'],
  ['oil','egg','aioli_base','🫒','Aioli Base',1,'sauce'],
  ['oil','spice','spiced_oil','🫒','Spiced Oil',1,'misc'],
  ['yeast','water','yeast_starter','🫧','Yeast Starter',1,'misc'],
  ['yeast','milk','milk_starter','🫧','Milk Starter',1,'misc'],
  ['yeast','sugar','active_yeast','🫧','Active Yeast',1,'misc'],
  ['lemon','vanilla','lemon_vanilla','🍋','Lemon Vanilla',1,'mix'],
  ['coffee','honey','coffee_honey','☕','Coffee Honey',1,'mix'],
  ['spice','vanilla','vanilla_spice','🌿','Vanilla Spice',1,'mix'],
  // ─── TIER 2: Basic Crafting (100) ───
  ['dough','fire','flatbread','🫓','Flatbread',2,'bread'],
  ['dough','sugar','sweet_dough','🍩','Sweet Dough',2,'dough'],
  ['dough','butter','rich_dough','🥐','Rich Dough',2,'dough'],
  ['dough','chocolate','choco_dough','🟫','Choco Dough',2,'dough'],
  ['dough','fruit','fruit_dough','🫐','Fruit Dough',2,'dough'],
  ['dough','nuts','nut_dough','🥜','Nut Dough',2,'dough'],
  ['dough','egg','egg_dough','🥚','Egg Dough',2,'dough'],
  ['dough','spice','spiced_dough','🫚','Spiced Dough',2,'dough'],
  ['dough','oil','fried_dough','🍩','Fried Dough',2,'pastry'],
  ['dough','salt','pretzel_dough','🥨','Pretzel Dough',2,'dough'],
  ['batter','fire','sponge','🎂','Sponge',2,'cake'],
  ['batter','chocolate','choco_batter','🍫','Choco Batter',2,'batter'],
  ['batter','fruit','fruit_batter','🍓','Fruit Batter',2,'batter'],
  ['batter','vanilla','vanilla_batter','🌿','Vanilla Batter',2,'batter'],
  ['batter','nuts','nut_batter','🌰','Nut Batter',2,'batter'],
  ['batter','coffee','coffee_batter','☕','Coffee Batter',2,'batter'],
  ['batter','lemon','lemon_batter','🍋','Lemon Batter',2,'batter'],
  ['batter','honey','honey_batter','🍯','Honey Batter',2,'batter'],
  ['batter','spice','spice_batter','🫚','Spice Batter',2,'batter'],
  ['bread_dough','fire','white_bread','🍞','White Bread',2,'bread'],
  ['bread_dough','sugar','brioche_dough','🥖','Brioche Dough',2,'dough'],
  ['bread_dough','butter','roll_dough','🫓','Roll Dough',2,'dough'],
  ['bread_dough','salt','sourdough_base','🍞','Sourdough Base',2,'dough'],
  ['cookie_mix','egg','cookie_dough','🍪','Cookie Dough',2,'dough'],
  ['cookie_mix','chocolate','choco_cookie_mix','🟫','Choco Cookie Mix',2,'mix'],
  ['cookie_mix','vanilla','vanilla_cookie_mix','🌸','Vanilla Cookie Mix',2,'mix'],
  ['cookie_mix','nuts','nut_cookie_mix','🥜','Nut Cookie Mix',2,'mix'],
  ['cookie_mix','spice','spice_cookie_mix','🫚','Spice Cookie Mix',2,'mix'],
  ['cookie_mix','lemon','lemon_cookie_mix','🍋','Lemon Cookie Mix',2,'mix'],
  ['cookie_mix','coffee','coffee_cookie_mix','☕','Coffee Cookie Mix',2,'mix'],
  ['cookie_mix','honey','honey_cookie_mix','🍯','Honey Cookie Mix',2,'mix'],
  ['syrup','fruit','fruit_syrup','🍇','Fruit Syrup',2,'syrup'],
  ['syrup','vanilla','vanilla_syrup','🫗','Vanilla Syrup',2,'syrup'],
  ['syrup','chocolate','choco_syrup','🍫','Choco Syrup',2,'syrup'],
  ['syrup','lemon','lemon_syrup','🍋','Lemon Syrup',2,'syrup'],
  ['syrup','fire','candy_base','🍬','Candy Base',2,'candy'],
  ['syrup','spice','spice_syrup','🫚','Spice Syrup',2,'syrup'],
  ['caramel','nuts','praline','🍬','Praline',2,'candy'],
  ['caramel','cream','caramel_cream','🤎','Caramel Cream',2,'cream'],
  ['caramel','salt','salted_caramel','🧂','Salted Caramel',2,'candy'],
  ['caramel','chocolate','choco_caramel','🍫','Choco Caramel',2,'candy'],
  ['caramel','butter','caramel_sauce','🫕','Caramel Sauce',2,'sauce'],
  ['caramel','vanilla','vanilla_caramel','🍮','Vanilla Caramel',2,'candy'],
  ['meringue','fire','baked_meringue','🤍','Baked Meringue',2,'meringue'],
  ['meringue','cream','mousse_base','🫧','Mousse Base',2,'mousse'],
  ['meringue','fruit','fruit_meringue','🍓','Fruit Meringue',2,'meringue'],
  ['meringue','chocolate','choco_meringue','🍫','Choco Meringue',2,'meringue'],
  ['custard_base','fire','baked_custard','🍮','Baked Custard',2,'pudding'],
  ['custard_base','vanilla','vanilla_custard','🍮','Vanilla Custard',2,'pudding'],
  ['custard_base','chocolate','choco_custard','🟫','Choco Custard',2,'pudding'],
  ['custard_base','lemon','lemon_custard','🍋','Lemon Custard',2,'pudding'],
  ['ganache','cream','truffle_base','🟤','Truffle Base',2,'candy'],
  ['ganache','vanilla','vanilla_ganache','🤎','Vanilla Ganache',2,'sauce'],
  ['ganache','nuts','nut_ganache','🤎','Nut Ganache',2,'sauce'],
  ['hot_cocoa','cream','mocha','🤎','Mocha',2,'drink'],
  ['melted_choco','cream','chocolate_sauce','🍫','Chocolate Sauce',2,'sauce'],
  ['melted_choco','nuts','choco_clusters','🌰','Choco Clusters',2,'candy'],
  ['melted_choco','butter','choco_fudge_base','🟫','Fudge Base',2,'candy'],
  ['toffee_base','fire','toffee','🟤','Toffee',2,'candy'],
  ['toffee_base','nuts','toffee_nuts','🥜','Toffee Nuts',2,'candy'],
  ['roasted_nuts','honey','glazed_nuts','🥜','Glazed Nuts',2,'candy'],
  ['roasted_nuts','sugar','candied_nuts','🍬','Candied Nuts',2,'candy'],
  ['preserve','sugar','marmalade','🟠','Marmalade',2,'jam'],
  ['preserve','cream','fruit_fool','🍓','Fruit Fool',2,'sauce'],
  ['juice','sugar','sorbet_mix','🧊','Sorbet Mix',2,'frozen'],
  ['juice','ice','popsicle_base','🧊','Popsicle Base',2,'frozen'],
  ['nut_butter','honey','nut_spread','🥜','Nut Spread',2,'spread'],
  ['nut_butter','chocolate','choco_spread','🟫','Choco Spread',2,'spread'],
  ['nut_butter','salt','salted_nut_butter','🥜','Salted Nut Butter',2,'spread'],
  ['vanilla_cream','sugar','pastry_cream','🍰','Pastry Cream',2,'cream'],
  ['buttercream','vanilla','vanilla_frosting','🎀','Vanilla Frosting',2,'frosting'],
  ['buttercream','chocolate','choco_frosting','🟫','Choco Frosting',2,'frosting'],
  ['buttercream','lemon','lemon_frosting','🍋','Lemon Frosting',2,'frosting'],
  ['buttercream','coffee','coffee_frosting','☕','Coffee Frosting',2,'frosting'],
  ['buttercream','fruit','fruit_frosting','🍓','Fruit Frosting',2,'frosting'],
  ['ice_cream_base','vanilla','vanilla_ice_cream','🍨','Vanilla Ice Cream',2,'frozen'],
  ['ice_cream_base','chocolate','choco_ice_cream','🍫','Choco Ice Cream',2,'frozen'],
  ['ice_cream_base','fruit','fruit_ice_cream','🍓','Fruit Ice Cream',2,'frozen'],
  ['ice_cream_base','coffee','coffee_ice_cream','☕','Coffee Ice Cream',2,'frozen'],
  ['ice_cream_base','honey','honey_ice_cream','🍯','Honey Ice Cream',2,'frozen'],
  ['ice_cream_base','nuts','nut_ice_cream','🥜','Nut Ice Cream',2,'frozen'],
  ['ice_cream_base','caramel','caramel_ice_cream','🍮','Caramel Ice Cream',2,'frozen'],
  ['cafe_latte','ice','iced_latte','🧊','Iced Latte',2,'drink'],
  ['cafe_latte','chocolate','mocha_latte','☕','Mocha Latte',2,'drink'],
  ['cafe_latte','vanilla','vanilla_latte','☕','Vanilla Latte',2,'drink'],
  ['cafe_latte','caramel','caramel_latte','☕','Caramel Latte',2,'drink'],
  ['lemon_water','sugar','lemonade','🍋','Lemonade',2,'drink'],
  ['lemon_water','honey','honey_lemonade','🍯','Honey Lemonade',2,'drink'],
  ['crumble','fire','biscuit_base','🍘','Biscuit Base',2,'cookie'],
  ['crumble','fruit','fruit_crumble_raw','🥧','Fruit Crumble Mix',2,'pie'],
  ['crumble','chocolate','choco_crumble','🍫','Choco Crumble',2,'mix'],
  ['sweet_cream','vanilla','creme_anglaise','🍰','Crème Anglaise',2,'sauce'],
  ['sweet_cream','chocolate','choco_cream_base','🍫','Choco Cream Base',2,'mousse'],
  ['spice_mix','dough','gingerbread_dough','🫚','Gingerbread Dough',2,'dough'],
  ['roux','butter','bechamel','🥄','Béchamel',2,'sauce'],
  ['fry_batter','fire','fritter','🍩','Fritter',2,'pastry'],
  ['honey_dough_raw','fire','honey_bread','🍯','Honey Bread',2,'bread'],
  ['salted_dough','fire','pretzel','🥨','Pretzel',2,'bread'],
  ['rich_dough','fire','butter_roll','🥐','Butter Roll',2,'roll'],
  // ─── TIER 3: Baked Goods & Treats (90) ───
  ['sweet_dough','fire','sweet_roll','🥐','Sweet Roll',3,'roll'],
  ['choco_dough','fire','choco_bread','🍞','Choco Bread',3,'bread'],
  ['fruit_dough','fire','fruit_bread','🍞','Fruit Bread',3,'bread'],
  ['nut_dough','fire','nut_bread','🍞','Nut Bread',3,'bread'],
  ['egg_dough','fire','egg_bread','🍞','Egg Bread',3,'bread'],
  ['spiced_dough','fire','spice_bread','🍞','Spice Bread',3,'bread'],
  ['pretzel_dough','fire','soft_pretzel','🥨','Soft Pretzel',3,'bread'],
  ['brioche_dough','fire','brioche','🍞','Brioche',3,'bread'],
  ['roll_dough','fire','dinner_roll','🥖','Dinner Roll',3,'roll'],
  ['sourdough_base','fire','sourdough','🍞','Sourdough',3,'bread'],
  ['gingerbread_dough','fire','gingerbread','🍪','Gingerbread',3,'cookie'],
  ['cookie_dough','fire','sugar_cookie','🍪','Sugar Cookie',3,'cookie'],
  ['choco_cookie_mix','egg','choco_cookie_dough','🍪','Choco Cookie Dough',3,'dough'],
  ['vanilla_cookie_mix','egg','vanilla_cookie_dough','🍪','Vanilla Cookie Dough',3,'dough'],
  ['nut_cookie_mix','egg','nut_cookie_dough','🥜','Nut Cookie Dough',3,'dough'],
  ['spice_cookie_mix','egg','spice_cookie_dough','🫚','Spice Cookie Dough',3,'dough'],
  ['lemon_cookie_mix','egg','lemon_cookie_dough','🍋','Lemon Cookie Dough',3,'dough'],
  ['coffee_cookie_mix','egg','coffee_cookie_dough','☕','Coffee Cookie Dough',3,'dough'],
  ['honey_cookie_mix','egg','honey_cookie_dough','🍯','Honey Cookie Dough',3,'dough'],
  ['choco_cookie_dough','fire','choco_chip_cookie','🍪','Choco Chip Cookie',3,'cookie'],
  ['vanilla_cookie_dough','fire','vanilla_cookie','🍪','Vanilla Cookie',3,'cookie'],
  ['nut_cookie_dough','fire','nut_cookie','🍪','Nut Cookie',3,'cookie'],
  ['spice_cookie_dough','fire','spice_cookie','🍪','Spice Cookie',3,'cookie'],
  ['lemon_cookie_dough','fire','lemon_cookie','🍪','Lemon Cookie',3,'cookie'],
  ['coffee_cookie_dough','fire','coffee_cookie','🍪','Coffee Cookie',3,'cookie'],
  ['honey_cookie_dough','fire','honey_cookie','🍪','Honey Cookie',3,'cookie'],
  ['choco_batter','fire','choco_cake','🎂','Chocolate Cake',3,'cake'],
  ['fruit_batter','fire','fruit_cake','🎂','Fruit Cake',3,'cake'],
  ['vanilla_batter','fire','vanilla_cake','🎂','Vanilla Cake',3,'cake'],
  ['nut_batter','fire','nut_cake','🎂','Nut Cake',3,'cake'],
  ['coffee_batter','fire','coffee_cake','🎂','Coffee Cake',3,'cake'],
  ['lemon_batter','fire','lemon_cake','🎂','Lemon Cake',3,'cake'],
  ['honey_batter','fire','honey_cake','🎂','Honey Cake',3,'cake'],
  ['spice_batter','fire','spice_cake','🎂','Spice Cake',3,'cake'],
  ['sponge','cream','cream_cake','🎂','Cream Cake',3,'cake'],
  ['sponge','fruit','fruit_sponge','🎂','Fruit Sponge',3,'cake'],
  ['sponge','chocolate','choco_sponge','🎂','Choco Sponge',3,'cake'],
  ['baked_meringue','cream','pavlova_base','🤍','Pavlova Base',3,'dessert'],
  ['baked_meringue','fruit','eton_mess','🍓','Eton Mess',3,'dessert'],
  ['mousse_base','chocolate','choco_mousse','🍫','Choco Mousse',3,'mousse'],
  ['mousse_base','fruit','fruit_mousse','🍓','Fruit Mousse',3,'mousse'],
  ['mousse_base','vanilla','vanilla_mousse','🌿','Vanilla Mousse',3,'mousse'],
  ['mousse_base','coffee','coffee_mousse','☕','Coffee Mousse',3,'mousse'],
  ['mousse_base','lemon','lemon_mousse','🍋','Lemon Mousse',3,'mousse'],
  ['baked_custard','caramel','creme_brulee','🍮','Crème Brûlée',3,'pudding'],
  ['vanilla_custard','fire','flan','🍮','Flan',3,'pudding'],
  ['choco_custard','cream','choco_pudding','🟫','Choco Pudding',3,'pudding'],
  ['lemon_custard','meringue','lemon_meringue_pie','🥧','Lemon Meringue Pie',3,'pie'],
  ['truffle_base','nuts','truffle','🟤','Truffle',3,'candy'],
  ['truffle_base','chocolate','choco_truffle','🟤','Choco Truffle',3,'candy'],
  ['truffle_base','coffee','coffee_truffle','☕','Coffee Truffle',3,'candy'],
  ['truffle_base','vanilla','vanilla_truffle','🤍','Vanilla Truffle',3,'candy'],
  ['praline','chocolate','praline_choco','🍬','Praline Chocolate',3,'candy'],
  ['salted_caramel','chocolate','salted_choco','🍫','Salted Chocolate',3,'candy'],
  ['toffee','chocolate','choco_toffee','🍫','Choco Toffee',3,'candy'],
  ['toffee','cream','toffee_cream','🤎','Toffee Cream',3,'candy'],
  ['candy_base','fruit','hard_candy','🍬','Hard Candy',3,'candy'],
  ['candy_base','lemon','lemon_drops','🍋','Lemon Drops',3,'candy'],
  ['choco_fudge_base','fire','fudge','🟫','Fudge',3,'candy'],
  ['pastry_cream','vanilla','creme_pat','🍰','Crème Pâtissière',3,'cream'],
  ['chocolate_sauce','cream','choco_fondue','🫕','Choco Fondue',3,'sauce'],
  ['caramel_sauce','cream','butterscotch','🤎','Butterscotch',3,'sauce'],
  ['fruit_syrup','cream','sundae_sauce','🍨','Sundae Sauce',3,'sauce'],
  ['sorbet_mix','ice','sorbet','🧊','Sorbet',3,'frozen'],
  ['popsicle_base','ice','popsicle','🧊','Popsicle',3,'frozen'],
  ['white_bread','butter','toast','🍞','Toast',3,'bread'],
  ['white_bread','honey','honey_toast','🍯','Honey Toast',3,'bread'],
  ['flatbread','oil','focaccia','🫓','Focaccia',3,'bread'],
  ['fried_dough','sugar','donut_base','🍩','Donut Base',3,'pastry'],
  ['fritter','sugar','sugar_fritter','🍩','Sugar Fritter',3,'pastry'],
  ['fritter','honey','honey_fritter','🍩','Honey Fritter',3,'pastry'],
  ['biscuit_base','butter','shortbread','🍪','Shortbread',3,'cookie'],
  ['biscuit_base','cream','cream_biscuit','🍪','Cream Biscuit',3,'cookie'],
  ['fruit_crumble_raw','fire','fruit_crumble','🥧','Fruit Crumble',3,'pie'],
  ['mocha','sugar','sweet_mocha','☕','Sweet Mocha',3,'drink'],
  ['mocha','ice','iced_mocha','🧊','Iced Mocha',3,'drink'],
  ['lemonade','ice','frozen_lemonade','🍋','Frozen Lemonade',3,'drink'],
  ['lemonade','fruit','fruit_punch','🍓','Fruit Punch',3,'drink'],
  ['iced_coffee','cream','coffee_frappe','☕','Coffee Frappé',3,'drink'],
  ['iced_latte','caramel','caramel_frappe','🍮','Caramel Frappé',3,'drink'],
  ['batter','oil','muffin_batter','🧁','Muffin Batter',3,'batter'],
  ['fruit_batter','oil','fruit_muffin_bat','🧁','Fruit Muffin Mix',3,'batter'],
  ['choco_batter','oil','choco_muffin_bat','🧁','Choco Muffin Mix',3,'batter'],
  ['nut_batter','oil','nut_muffin_bat','🧁','Nut Muffin Mix',3,'batter'],
  ['honey_batter','oil','honey_muffin_bat','🧁','Honey Muffin Mix',3,'batter'],
  ['coffee_batter','oil','coffee_muffin_bat','🧁','Coffee Muffin Mix',3,'batter'],
  ['lemon_batter','oil','lemon_muffin_bat','🧁','Lemon Muffin Mix',3,'batter'],
  ['spice_batter','oil','spice_muffin_bat','🧁','Spice Muffin Mix',3,'batter'],
  // ─── TIER 4: Specialty Items (70) ───
  ['muffin_batter','fire','muffin','🧁','Muffin',4,'muffin'],
  ['fruit_muffin_bat','fire','fruit_muffin','🧁','Fruit Muffin',4,'muffin'],
  ['choco_muffin_bat','fire','choco_muffin','🧁','Choco Muffin',4,'muffin'],
  ['nut_muffin_bat','fire','nut_muffin','🧁','Nut Muffin',4,'muffin'],
  ['honey_muffin_bat','fire','honey_muffin','🧁','Honey Muffin',4,'muffin'],
  ['coffee_muffin_bat','fire','coffee_muffin','🧁','Coffee Muffin',4,'muffin'],
  ['lemon_muffin_bat','fire','lemon_muffin','🧁','Lemon Muffin',4,'muffin'],
  ['spice_muffin_bat','fire','spice_muffin','🧁','Spice Muffin',4,'muffin'],
  ['sugar_cookie','vanilla_frosting','frosted_cookie','🍪','Frosted Cookie',4,'cookie'],
  ['sugar_cookie','ganache','glazed_cookie','🍪','Glazed Cookie',4,'cookie'],
  ['sugar_cookie','buttercream','decorated_cookie','🍪','Decorated Cookie',4,'cookie'],
  ['choco_chip_cookie','cream','cookie_sandwich','🍪','Cookie Sandwich',4,'dessert'],
  ['gingerbread','vanilla_cream','ginger_cream','🍪','Ginger Cream Cookie',4,'cookie'],
  ['shortbread','caramel','caramel_shortbread','🍪','Caramel Shortbread',4,'cookie'],
  ['shortbread','chocolate','choco_shortbread','🍪','Choco Shortbread',4,'cookie'],
  ['cream_cake','fruit','strawberry_cake','🍰','Strawberry Cake',4,'cake'],
  ['cream_cake','chocolate','black_forest_base','🎂','Black Forest Base',4,'cake'],
  ['choco_cake','ganache','glazed_choco_cake','🎂','Glazed Choco Cake',4,'cake'],
  ['vanilla_cake','pastry_cream','boston_cream','🎂','Boston Cream',4,'cake'],
  ['lemon_cake','lemon_frosting','lemon_drizzle','🎂','Lemon Drizzle Cake',4,'cake'],
  ['coffee_cake','coffee_frosting','mocha_cake','🎂','Mocha Cake',4,'cake'],
  ['fruit_sponge','cream','trifle_base','🎂','Trifle Base',4,'cake'],
  ['nut_cake','honey','baklava_base','🥐','Baklava Base',4,'pastry'],
  ['brioche','butter','butter_brioche','🍞','Butter Brioche',4,'bread'],
  ['brioche','chocolate','pain_au_chocolat','🥐','Pain au Chocolat',4,'pastry'],
  ['sourdough','butter','sourdough_toast','🍞','Sourdough Toast',4,'bread'],
  ['sweet_roll','vanilla_cream','cream_roll','🥐','Cream Roll',4,'roll'],
  ['sweet_roll','fruit','fruit_roll','🥐','Fruit Roll',4,'roll'],
  ['sweet_roll','spice','cinnamon_roll','🥐','Cinnamon Roll',4,'roll'],
  ['dinner_roll','butter','buttered_roll','🥖','Buttered Roll',4,'roll'],
  ['donut_base','fire','donut','🍩','Donut',4,'pastry'],
  ['donut','chocolate_sauce','choco_donut','🍩','Choco Donut',4,'pastry'],
  ['donut','vanilla_frosting','glazed_donut','🍩','Glazed Donut',4,'pastry'],
  ['donut','fruit','jelly_donut','🍩','Jelly Donut',4,'pastry'],
  ['pavlova_base','fruit','pavlova','🤍','Pavlova',4,'dessert'],
  ['creme_brulee','fruit','fruit_brulee','🍮','Fruit Brûlée',4,'pudding'],
  ['flan','caramel','caramel_flan','🍮','Caramel Flan',4,'pudding'],
  ['choco_pudding','cream','choco_mousse_cup','🟫','Choco Mousse Cup',4,'pudding'],
  ['fudge','nuts','rocky_road','🟫','Rocky Road',4,'candy'],
  ['fudge','cream','fudge_cream','🟫','Fudge Cream',4,'candy'],
  ['truffle','cream','luxury_truffle','💎','Luxury Truffle',4,'candy'],
  ['praline_choco','cream','praline_cream','🍬','Praline Cream',4,'candy'],
  ['vanilla_ice_cream','sugar_cookie','ice_cream_sandwich','🍦','Ice Cream Sandwich',4,'frozen'],
  ['vanilla_ice_cream','chocolate_sauce','sundae','🍨','Sundae',4,'frozen'],
  ['choco_ice_cream','nuts','rocky_road_ice','🍫','Rocky Road Ice Cream',4,'frozen'],
  ['fruit_ice_cream','fruit','fruit_parfait','🍓','Fruit Parfait',4,'frozen'],
  ['sorbet','fruit','fruit_sorbet','🧊','Fruit Sorbet',4,'frozen'],
  ['caramel_ice_cream','salted_caramel','salted_car_ice','🍮','Salted Caramel Gelato',4,'frozen'],
  ['coffee_frappe','choco_syrup','mocha_frappe','☕','Mocha Frappé',4,'drink'],
  ['vanilla_latte','honey','honey_vanilla_latte','🍯','Honey Vanilla Latte',4,'drink'],
  ['sweet_mocha','cream','mocha_cream','☕','Mocha Cream',4,'drink'],
  ['chocolate_sauce','sponge','choco_drizzle_cake','🎂','Choco Drizzle Cake',4,'cake'],
  ['caramel_sauce','sponge','caramel_cake','🎂','Caramel Cake',4,'cake'],
  ['focaccia','salt','sea_salt_focaccia','🫓','Sea Salt Focaccia',4,'bread'],
  ['marmalade','toast','marmalade_toast','🍞','Marmalade Toast',4,'bread'],
  ['choco_spread','toast','choco_toast','🍞','Choco Toast',4,'bread'],
  ['nut_spread','toast','nut_toast','🍞','Nut Toast',4,'bread'],
  ['honey_butter','toast','honey_butter_toast','🍞','Honey Butter Toast',4,'bread'],
  ['choco_mousse','cream','mousse_cup','🍫','Mousse Cup',4,'mousse'],
  ['fruit_mousse','cream','fruit_mousse_cup','🍓','Fruit Mousse Cup',4,'mousse'],
  ['fruit_crumble','cream','crumble_cream','🥧','Crumble à la Crème',4,'pie'],
  ['fruit_crumble','vanilla_ice_cream','crumble_mode','🥧','Crumble à la Mode',4,'pie'],
  ['biscuit_base','fruit','fruit_biscuit','🍪','Fruit Biscuit',4,'cookie'],
  ['biscuit_base','chocolate','choco_biscuit','🍪','Choco Biscuit',4,'cookie'],
  ['biscuit_base','honey','honey_biscuit','🍪','Honey Biscuit',4,'cookie'],
  ['biscuit_base','nuts','nut_biscuit','🍪','Nut Biscuit',4,'cookie'],
  ['biscuit_base','lemon','lemon_biscuit','🍪','Lemon Biscuit',4,'cookie'],
  ['biscuit_base','coffee','coffee_biscuit','🍪','Coffee Biscuit',4,'cookie'],
  ['biscuit_base','spice','spice_biscuit','🍪','Spice Biscuit',4,'cookie'],
  // ─── TIER 5: Premium Creations (40) ───
  ['frosted_cookie','fruit','fancy_fruit_cookie','🍪','Fancy Fruit Cookie',5,'cookie'],
  ['cookie_sandwich','chocolate_sauce','deluxe_sandwich','🍪','Deluxe Sandwich',5,'dessert'],
  ['glazed_cookie','nuts','nut_cluster_cookie','🍪','Nut Cluster Cookie',5,'cookie'],
  ['black_forest_base','cream','black_forest','🎂','Black Forest Cake',5,'cake'],
  ['glazed_choco_cake','nuts','celebration_cake','🎂','Celebration Cake',5,'cake'],
  ['boston_cream','chocolate_sauce','boston_cream_pie','🎂','Boston Cream Pie',5,'cake'],
  ['mocha_cake','coffee','tiramisu_base','🎂','Tiramisu Base',5,'cake'],
  ['trifle_base','custard_base','english_trifle','🎂','English Trifle',5,'cake'],
  ['strawberry_cake','cream','strawberry_cream_cake','🍰','Strawberry Cream Cake',5,'cake'],
  ['lemon_drizzle','cream','lemon_cream_cake','🍰','Lemon Cream Cake',5,'cake'],
  ['baklava_base','syrup','baklava','🥐','Baklava',5,'pastry'],
  ['pain_au_chocolat','cream','choco_cream_pastry','🥐','Choco Cream Pastry',5,'pastry'],
  ['cream_roll','chocolate','choco_cream_roll','🥐','Choco Cream Roll',5,'roll'],
  ['cinnamon_roll','vanilla_frosting','frosted_cinnamon','🥐','Frosted Cinnamon Roll',5,'roll'],
  ['donut','cream','cream_donut','🍩','Cream Donut',5,'pastry'],
  ['choco_donut','cream','boston_cream_donut','🍩','Boston Cream Donut',5,'pastry'],
  ['pavlova','cream','meringue_tower','🏰','Meringue Tower',5,'dessert'],
  ['flan','fruit','tropical_flan','🍮','Tropical Flan',5,'pudding'],
  ['creme_brulee','vanilla','classic_brulee','🍮','Classic Brûlée',5,'pudding'],
  ['rocky_road','chocolate_sauce','supreme_rocky','🟫','Supreme Rocky Road',5,'candy'],
  ['luxury_truffle','honey','golden_truffle','💎','Golden Truffle',5,'candy'],
  ['sundae','sugar_cookie','cookie_sundae','🍨','Cookie Sundae',5,'frozen'],
  ['sundae','nuts','nut_sundae','🍨','Nut Sundae',5,'frozen'],
  ['sundae','caramel_sauce','caramel_sundae','🍨','Caramel Sundae',5,'frozen'],
  ['ice_cream_sandwich','chocolate','deluxe_ice_cream','🍨','Deluxe Ice Cream',5,'frozen'],
  ['fruit_parfait','cream','layered_parfait','🍓','Layered Parfait',5,'frozen'],
  ['mocha_frappe','cream','supreme_frappe','☕','Supreme Frappé',5,'drink'],
  ['honey_vanilla_latte','spice','chai_latte','☕','Chai Latte',5,'drink'],
  ['ginger_cream','honey','ginger_snap','🍪','Ginger Snap',5,'cookie'],
  ['mousse_cup','fruit','fruit_mousse_tart','🍓','Fruit Mousse Tart',5,'dessert'],
  ['lemon_meringue_pie','vanilla_ice_cream','pie_ala_mode','🥧','Pie à la Mode',5,'pie'],
  ['lemon_meringue_pie','cream','lemon_cream_pie','🥧','Lemon Cream Pie',5,'pie'],
  ['muffin','vanilla_frosting','frosted_muffin','🧁','Frosted Muffin',5,'muffin'],
  ['choco_muffin','ganache','glazed_choco_muffin','🧁','Glazed Choco Muffin',5,'muffin'],
  ['fruit_muffin','cream','cream_fruit_muffin','🧁','Cream Fruit Muffin',5,'muffin'],
  ['nut_muffin','honey','honey_nut_muffin','🧁','Honey Nut Muffin',5,'muffin'],
  ['coffee_muffin','choco_frosting','mocha_muffin','🧁','Mocha Muffin',5,'muffin'],
  ['lemon_muffin','lemon_frosting','lemon_glazed_muffin','🧁','Lemon Glazed Muffin',5,'muffin'],
  ['spice_muffin','honey','honey_spice_muffin','🧁','Honey Spice Muffin',5,'muffin'],
  ['marmalade_toast','butter','breakfast_toast','🍞','Breakfast Toast',5,'bread'],
  // ─── TIER 6: Grand Desserts (20) ───
  ['black_forest','fruit','supreme_black_forest','🎂','Supreme Black Forest',6,'cake'],
  ['celebration_cake','fire','birthday_cake','🎂','Birthday Cake',6,'cake'],
  ['tiramisu_base','coffee','tiramisu','🎂','Tiramisu',6,'cake'],
  ['english_trifle','fruit','royal_trifle','🎂','Royal Trifle',6,'cake'],
  ['baklava','honey','golden_baklava','🥐','Golden Baklava',6,'pastry'],
  ['choco_cream_pastry','nuts','paris_pastry','🥐','Paris Pastry',6,'pastry'],
  ['frosted_cinnamon','cream','supreme_cinnamon','🥐','Supreme Cinnamon Roll',6,'roll'],
  ['boston_cream_donut','chocolate_sauce','ultimate_donut','🍩','Ultimate Donut',6,'pastry'],
  ['meringue_tower','fruit','fruit_tower','🏰','Fruit Tower',6,'dessert'],
  ['classic_brulee','chocolate','choco_brulee','🍮','Choco Brûlée',6,'pudding'],
  ['golden_truffle','chocolate','diamond_truffle','💎','Diamond Truffle',6,'candy'],
  ['supreme_rocky','cream','rocky_supreme','🟫','Rocky Road Supreme',6,'candy'],
  ['cookie_sundae','choco_syrup','ultimate_sundae','🍨','Ultimate Sundae',6,'frozen'],
  ['caramel_sundae','nuts','loaded_sundae','🍨','Loaded Sundae',6,'frozen'],
  ['chai_latte','honey','golden_chai','☕','Golden Chai',6,'drink'],
  ['ginger_snap','chocolate','choco_ginger','🍪','Choco Ginger Snap',6,'cookie'],
  ['fancy_fruit_cookie','ganache','artisan_cookie','🍪','Artisan Cookie',6,'cookie'],
  ['strawberry_cream_cake','chocolate','triple_layer','🎂','Triple Layer Cake',6,'cake'],
  ['lemon_cream_cake','meringue','lemon_tower','🎂','Lemon Tower Cake',6,'cake'],
  ['fruit_mousse_tart','chocolate','choco_fruit_tart','🍓','Choco Fruit Tart',6,'dessert'],
  // ─── TIER 7: Legendary (15) ───
  ['birthday_cake','cream','wedding_cake','💒','Wedding Cake',7,'cake'],
  ['tiramisu','chocolate','master_tiramisu','🎂','Master Tiramisu',7,'cake'],
  ['royal_trifle','cream','royal_dessert','👑','Royal Dessert',7,'cake'],
  ['supreme_black_forest','cream','forest_supreme','🎂','Forest Supreme',7,'cake'],
  ['golden_baklava','nuts','jeweled_baklava','💎','Jeweled Baklava',7,'pastry'],
  ['ultimate_donut','cream','dream_donut','🍩','Dream Donut',7,'pastry'],
  ['paris_pastry','cream','french_delicacy','🥐','French Delicacy',7,'pastry'],
  ['diamond_truffle','cream','celestial_truffle','💎','Celestial Truffle',7,'candy'],
  ['fruit_tower','cream','grand_pavlova','🏰','Grand Pavlova',7,'dessert'],
  ['artisan_cookie','cream','master_cookie','🍪','Master Cookie',7,'cookie'],
  ['ultimate_sundae','cream','dream_sundae','🍨','Dream Sundae',7,'frozen'],
  ['loaded_sundae','chocolate_sauce','mega_sundae','🍨','Mega Sundae',7,'frozen'],
  ['wedding_cake','chocolate','grand_gateau','👑','Grand Gâteau',7,'cake'],
  ['triple_layer','cream','patisserie_masterpiece','🏆','Pâtisserie Masterpiece',7,'cake'],
  ['grand_gateau','cream','magnum_opus','🏆','Magnum Opus',7,'cake'],
];

// ─── Expansion Modifiers ───
const MODIFIERS = [
  { id: 'chocolate', prefix: 'Choco',   emoji: '🍫', cats: ['cookie','cake','bread','pastry','frozen','mousse','muffin','roll','pie','pudding'], maxTier: 4 },
  { id: 'vanilla',   prefix: 'Vanilla', emoji: '🌿', cats: ['cookie','cake','frozen','mousse','muffin','pudding'], maxTier: 4 },
  { id: 'fruit',     prefix: 'Berry',   emoji: '🍓', cats: ['cookie','cake','bread','pastry','frozen','mousse','pie','roll','muffin'], maxTier: 4 },
  { id: 'nuts',      prefix: 'Nutty',   emoji: '🥜', cats: ['cookie','cake','bread','candy','frozen','roll','pie','muffin'], maxTier: 4 },
  { id: 'honey',     prefix: 'Honey',   emoji: '🍯', cats: ['cookie','cake','bread','roll','drink','muffin','pastry'], maxTier: 4 },
  { id: 'coffee',    prefix: 'Mocha',   emoji: '☕', cats: ['cookie','cake','frozen','mousse','muffin','pudding'], maxTier: 4 },
  { id: 'lemon',     prefix: 'Citrus',  emoji: '🍋', cats: ['cookie','cake','pie','mousse','drink','muffin'], maxTier: 4 },
  { id: 'spice',     prefix: 'Spiced',  emoji: '🫚', cats: ['cookie','cake','bread','roll','muffin','drink'], maxTier: 4 },
  { id: 'salt',      prefix: 'Salted',  emoji: '🧂', cats: ['cookie','bread','candy','pastry'], maxTier: 4 },
  { id: 'cream',     prefix: 'Creamy',  emoji: '🍦', cats: ['cookie','cake','pie','pastry','roll','muffin'], maxTier: 4 },
  { id: 'ice',       prefix: 'Iced',    emoji: '🧊', cats: ['drink','cake'], maxTier: 3 },
  { id: 'caramel',      prefix: 'Caramel',  emoji: '🍮', cats: ['cookie','cake','pastry','candy','frozen','pudding','muffin'], maxTier: 4 },
  { id: 'ganache',      prefix: 'Ganached',  emoji: '✨', cats: ['cookie','cake','pastry','muffin'], maxTier: 4 },
  { id: 'toffee',       prefix: 'Toffee',   emoji: '🍬', cats: ['cookie','cake','candy','frozen'], maxTier: 3 },
  { id: 'buttercream',  prefix: 'Frosted',  emoji: '🎀', cats: ['cookie','cake','roll','muffin'], maxTier: 4 },
  { id: 'pastry_cream', prefix: 'Filled',   emoji: '🍰', cats: ['pastry','roll','pie','cookie'], maxTier: 4 },
  { id: 'praline',      prefix: 'Praline',  emoji: '🍬', cats: ['cookie','cake','frozen','candy'], maxTier: 3 },
  { id: 'meringue',     prefix: 'Meringue', emoji: '🤍', cats: ['cookie','cake','pie'], maxTier: 3 },
];

// ─── Build Alchemy Database ───
function buildAlchemy() {
  const items = new Map();
  for (const [id, emoji, name] of ALCHEMY_BASES) {
    items.set(id, { id, emoji, name, tier: 0, cat: 'base' });
  }
  for (const [,, id, emoji, name, tier, cat] of CORE) {
    items.set(id, { id, emoji, name, tier, cat });
  }
  const recipeKeys = new Set();
  for (const r of CORE) {
    recipeKeys.add(`${r[0]}|${r[1]}`);
    recipeKeys.add(`${r[1]}|${r[0]}`);
  }
  const coreItemIds = new Set();
  for (const [,, id] of CORE) coreItemIds.add(id);
  const expanded = [];
  for (const mod of MODIFIERS) {
    for (const id of coreItemIds) {
      const item = items.get(id);
      if (!item || item.tier < 1 || item.tier > mod.maxTier) continue;
      if (!mod.cats.includes(item.cat)) continue;
      if (id.includes(mod.id)) continue;
      const key = `${id}|${mod.id}`;
      if (recipeKeys.has(key) || recipeKeys.has(`${mod.id}|${id}`)) continue;
      const newId = `${mod.id}_${id}`;
      if (items.has(newId)) continue;
      const newTier = Math.min(7, item.tier + 1);
      const newName = `${mod.prefix} ${item.name}`;
      expanded.push([id, mod.id, newId, mod.emoji, newName, newTier, item.cat]);
      items.set(newId, { id: newId, emoji: mod.emoji, name: newName, tier: newTier, cat: item.cat });
      recipeKeys.add(key);
      recipeKeys.add(`${mod.id}|${id}`);
    }
  }
  const allRecipes = [...CORE, ...expanded];
  return { items, recipes: allRecipes, totalCount: allRecipes.length, recipeLookup: recipeKeys };
}

// Cache the build result at module scope (deterministic, no need to rebuild each session)
let _cachedBuild = null;
function getCachedBuild() {
  if (!_cachedBuild) _cachedBuild = buildAlchemy();
  return _cachedBuild;
}

// ─── Shuffle helper ───
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Main exported function ───
export function runCookieAlchemy(mg) {
  const C = ALCHEMY_CONFIG;
  const stats = mg.game.stats;

  // Initialize persistent state
  if (!stats.alchemyDiscovered) stats.alchemyDiscovered = [];
  if (!stats.alchemyResets) stats.alchemyResets = 0;
  if (!stats.alchemyBestSession) stats.alchemyBestSession = 0;
  if (!stats.alchemyTotalMerges) stats.alchemyTotalMerges = 0;
  if (!stats.alchemyPerfectSessions) stats.alchemyPerfectSessions = 0;

  // Use cached build (deterministic — same every time)
  const { items: itemsMap, recipes: allRecipes, totalCount } = getCachedBuild();
  const discoveryTarget = totalCount;

  // Build recipe lookup (order-independent)
  const recipeLookup = {};
  for (const r of allRecipes) {
    recipeLookup[`${r[0]}|${r[1]}`] = r[2];
    recipeLookup[`${r[1]}|${r[0]}`] = r[2];
  }

  // Sanitize: remove stale IDs from discovered (e.g. recipes removed in code updates)
  stats.alchemyDiscovered = stats.alchemyDiscovered.filter(id => itemsMap.has(id));

  // Fast discovered lookup (O(1) instead of Array.includes O(n))
  const discoveredSet = new Set(stats.alchemyDiscovered);

  // Build base lookup for emoji display
  const baseLookup = new Map();
  for (const [id, emoji, name] of ALCHEMY_BASES) {
    baseLookup.set(id, { id, emoji, name });
  }

  // Available items: starters + unlocked bases + previously discovered
  const available = new Set(STARTER_IDS);
  const dc = stats.alchemyDiscovered.length;
  for (const u of BASE_UNLOCKS) {
    if (dc >= u.at) available.add(u.id);
  }
  for (const id of stats.alchemyDiscovered) available.add(id);

  // Session state
  let selectedA = null;
  let selectedB = null;
  let sessionNewCount = 0;
  let timeLeft = C.sessionDurationMs;
  let finished = false;
  let resultTimeout = null;
  let searchQuery = '';
  let sessionFailCount = 0; // wrong merges this session
  let successStreak = 0;    // consecutive successful merges

  // Sort items: bases first, then by tier, then alphabetically
  const getSortedItems = () => {
    const items = [];
    for (const id of available) {
      const item = itemsMap.get(id);
      if (item) items.push(item);
    }
    items.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.name.localeCompare(b.name);
    });
    return items;
  };

  // Compute random undiscovered merges from available items
  const getHints = () => {
    const candidates = [];
    for (const r of allRecipes) {
      if (available.has(r[0]) && available.has(r[1]) && !discoveredSet.has(r[2])) {
        const itemA = itemsMap.get(r[0]);
        const itemB = itemsMap.get(r[1]);
        if (itemA && itemB) {
          candidates.push({ emojiA: itemA.emoji, emojiB: itemB.emoji, nameA: itemA.name, nameB: itemB.name });
        }
      }
    }
    shuffle(candidates);
    return candidates.slice(0, C.hintCount);
  };

  // ── Initial render (only called ONCE) ──
  const discCount = stats.alchemyDiscovered.length;
  const targetPct = Math.min(100, Math.round((discCount / discoveryTarget) * 100));

  const overlay = mg._show(`<div class="mini-game-card alch-card">
    <div class="alch-header">
      <div class="mini-title">🧪 Cookie Alchemy</div>
      <div class="alch-prestige" id="alch-prestige">${stats.alchemyResets > 0 ? `Mastered: ${stats.alchemyResets}\u00d7` : ''}</div>
    </div>

    <div class="alch-stats-row">
      <div class="alch-stat">
        <span class="alch-stat-label">Discoveries</span>
        <span class="alch-stat-value" id="alch-disc-val">${discCount}/${discoveryTarget}</span>
        <div class="alch-progress-bar"><div class="alch-progress-fill alch-progress-score" id="alch-disc-bar" style="width:${targetPct}%"></div></div>
      </div>
      <div class="alch-stat">
        <span class="alch-stat-label">Available</span>
        <span class="alch-stat-value" id="alch-avail-val">${available.size}</span>
      </div>
      <div class="alch-stat">
        <span class="alch-stat-label">Session</span>
        <span class="alch-stat-value" id="alch-session-val">0 new</span>
      </div>
    </div>

    <div class="mini-timer-bar"><div class="mini-timer-fill" id="alch-timer-fill" style="width:100%"></div></div>

    <div class="alch-selection" id="alch-selection">
      <span class="alch-sel-slot" id="alch-sel-a">?</span>
      <span class="alch-sel-plus">+</span>
      <span class="alch-sel-slot" id="alch-sel-b">?</span>
    </div>
    <div class="alch-result-area" id="alch-result-area"></div>

    <div class="alch-search-bar">
      <input type="text" class="alch-search" id="alch-search" placeholder="Search items..." autocomplete="off" />
    </div>
    <div class="alch-items-scroll" id="alch-items-scroll">
      <div class="alch-grid" id="alch-grid"></div>
    </div>

    <div class="alch-hints" id="alch-hints"></div>

    <div class="alch-footer">
      <button class="alch-exit-btn" id="alch-exit">Exit & Save</button>
    </div>
  </div>`);

  if (!overlay) return;

  // ── Render grid (can be called to rebuild when items change) ──
  const renderGrid = () => {
    const grid = document.getElementById('alch-grid');
    if (!grid) return;
    const sorted = getSortedItems();
    const q = searchQuery.toLowerCase();

    grid.innerHTML = sorted
      .filter(item => !q || item.name.toLowerCase().includes(q) || item.emoji.includes(q))
      .map(item => {
        let cls = 'alch-cell';
        if (selectedA === item.id) cls += ' alch-sel-a';
        else if (selectedB === item.id) cls += ' alch-sel-b';
        const tierCls = item.tier === 0 ? 'alch-tier-base' : `alch-tier-${Math.min(item.tier, 7)}`;
        return `<button class="${cls} ${tierCls}" data-id="${item.id}" title="${item.name} (Tier ${item.tier})">
          <span class="alch-cell-emoji">${item.emoji}</span>
          <span class="alch-cell-name">${item.name}</span>
        </button>`;
      }).join('');
  };

  const renderHints = () => {
    const hintsEl = document.getElementById('alch-hints');
    if (!hintsEl) return;
    // Only show hints after 5+ failed merges this session
    if (sessionFailCount < 5) {
      hintsEl.innerHTML = '';
      return;
    }
    const hints = getHints();
    if (hints.length === 0) {
      hintsEl.innerHTML = '<div class="alch-hints-title">No new recipes with current items</div>';
      return;
    }
    hintsEl.innerHTML = '<div class="alch-hints-title">Try these:</div><div class="alch-hints-list">' +
      hints.map(h => `<div class="alch-hint-item">${h.emojiA} ${h.nameA} + ${h.emojiB} ${h.nameB} = ?</div>`).join('') + '</div>';
  };

  const updateStats = () => {
    const dc = stats.alchemyDiscovered.length;
    const el1 = document.getElementById('alch-disc-val');
    if (el1) el1.textContent = `${dc}/${discoveryTarget}`;
    const bar1 = document.getElementById('alch-disc-bar');
    if (bar1) bar1.style.width = `${Math.min(100, Math.round((dc / discoveryTarget) * 100))}%`;
    const el2 = document.getElementById('alch-avail-val');
    if (el2) el2.textContent = `${available.size}`;
    const el3 = document.getElementById('alch-session-val');
    if (el3) el3.textContent = `${sessionNewCount} new`;
  };

  const updateSelection = () => {
    const slotA = document.getElementById('alch-sel-a');
    const slotB = document.getElementById('alch-sel-b');
    const itemA = selectedA ? itemsMap.get(selectedA) : null;
    const itemB = selectedB ? itemsMap.get(selectedB) : null;
    if (slotA) {
      slotA.textContent = itemA ? `${itemA.emoji} ${itemA.name}` : '?';
      slotA.classList.toggle('alch-sel-filled', !!itemA);
    }
    if (slotB) {
      slotB.textContent = itemB ? `${itemB.emoji} ${itemB.name}` : '?';
      slotB.classList.toggle('alch-sel-filled', !!itemB);
    }
    // Update cell highlights
    document.querySelectorAll('.alch-cell.alch-sel-a').forEach(el => el.classList.remove('alch-sel-a'));
    document.querySelectorAll('.alch-cell.alch-sel-b').forEach(el => el.classList.remove('alch-sel-b'));
    if (selectedA) {
      const el = document.querySelector(`.alch-cell[data-id="${selectedA}"]`);
      if (el) el.classList.add('alch-sel-a');
    }
    if (selectedB) {
      const el = document.querySelector(`.alch-cell[data-id="${selectedB}"]`);
      if (el) el.classList.add('alch-sel-b');
    }
  };

  const showResult = (html) => {
    const area = document.getElementById('alch-result-area');
    if (area) area.innerHTML = html;
  };

  const clearResult = () => showResult('');

  // Check if new base ingredients should be unlocked
  const checkBaseUnlocks = () => {
    const dc = stats.alchemyDiscovered.length;
    const unlocked = [];
    for (const u of BASE_UNLOCKS) {
      if (dc >= u.at && !available.has(u.id)) {
        available.add(u.id);
        const base = baseLookup.get(u.id);
        if (base) {
          unlocked.push(base);
        }
      }
    }
    return unlocked;
  };

  // ── Event delegation — one listener on the overlay ──
  const clickHandler = (e) => {
    if (finished) return;

    // Exit button
    if (e.target.closest('#alch-exit')) {
      e.stopPropagation();
      finishSession();
      return;
    }

    // Item cell click
    const cell = e.target.closest('.alch-cell');
    if (!cell) return;
    e.stopPropagation();
    const id = cell.dataset.id;
    if (!id) return;

    if (resultTimeout) { clearTimeout(resultTimeout); resultTimeout = null; }
    clearResult();

    if (selectedA === null) {
      selectedA = id;
      updateSelection();
    } else if (selectedA === id) {
      selectedA = null;
      updateSelection();
    } else {
      selectedB = id;
      updateSelection();
      // Auto-combine after brief visual feedback
      setTimeout(() => tryCombine(), 150);
    }
  };

  overlay.addEventListener('click', clickHandler);

  // Search input
  const searchInput = document.getElementById('alch-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderGrid();
    });
    // Prevent ESC from closing the game while typing
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        searchInput.value = '';
        searchQuery = '';
        renderGrid();
      }
    });
  }

  // ── Combine logic ──
  const tryCombine = () => {
    if (!selectedA || !selectedB || finished) return;

    const key = `${selectedA}|${selectedB}`;
    const resultId = recipeLookup[key];

    if (!resultId) {
      sessionFailCount++;
      successStreak = 0;
      // Shake the second cell
      const cell = document.querySelector(`.alch-cell[data-id="${selectedB}"]`);
      if (cell) { cell.classList.add('alch-shake'); setTimeout(() => cell.classList.remove('alch-shake'), 400); }
      showResult('<div class="alch-result alch-result-fail">No recipe found!</div>');
      selectedA = null;
      selectedB = null;
      updateSelection();
      // Show hints once the player has struggled enough
      if (sessionFailCount === 5) renderHints();
      resultTimeout = setTimeout(clearResult, 1200);
      return;
    }

    stats.alchemyTotalMerges = (stats.alchemyTotalMerges || 0) + 1;
    const item = itemsMap.get(resultId);
    const isNew = !discoveredSet.has(resultId);

    if (isNew) {
      stats.alchemyDiscovered.push(resultId);
      discoveredSet.add(resultId);
      available.add(resultId);
      sessionNewCount++;

      showResult(`<div class="alch-result alch-result-new">
        <span class="alch-result-badge">NEW!</span>
        <span class="alch-result-emoji">${item.emoji}</span>
        <span class="alch-result-name">${item.name}</span>
      </div>`);

      // Check for base unlocks after new discovery
      const unlocked = checkBaseUnlocks();
      if (unlocked.length > 0) {
        const unlockHtml = unlocked.map(b => `<div class="alch-unlock"><span class="alch-unlock-text">\uD83D\uDD13 New ingredient: ${b.emoji} ${b.name}!</span></div>`).join('');
        const area = document.getElementById('alch-result-area');
        if (area) area.innerHTML += unlockHtml;
      }

      // Check for mastery
      if (stats.alchemyDiscovered.length >= discoveryTarget) {
        const reward = mg._giveReward('legendary', 'cookieAlchemy');
        stats.alchemyDiscovered = [];
        discoveredSet.clear();
        stats.alchemyResets++;
        available.clear();
        for (const id of STARTER_IDS) available.add(id);

        selectedA = null;
        selectedB = null;
        finished = true;
        clearInterval(timerInterval);

        mg._show(`<div class="mini-game-card alch-card">
          <div class="alch-mastery">
            <div class="alch-mastery-icon">\uD83C\uDFC6</div>
            <div class="alch-mastery-title">ALCHEMY MASTERY!</div>
            <div class="alch-mastery-sub">You discovered ${discoveryTarget} recipes!</div>
            <div class="alch-mastery-info">All recipes reset \u2014 begin a new journey!</div>
            <div class="alch-mastery-count">Mastery #${stats.alchemyResets}</div>
            <div class="mini-reward">+${formatNumberInWords(reward)} cookies</div>
          </div>
        </div>`);
        setTimeout(() => mg._close(), 4000);
        return;
      }

      // Add new item to grid + update stats + refresh hints if showing
      renderGrid();
      updateStats();
      if (sessionFailCount >= 5) renderHints();
      // Check achievements for discovery milestones
      if (mg.game.achievementManager) mg.game.achievementManager.check();
    } else {
      showResult(`<div class="alch-result alch-result-known">
        <span class="alch-result-emoji">${item.emoji}</span>
        <span class="alch-result-name">${item.name}</span>
        <span class="alch-result-already">Already discovered</span>
      </div>`);
    }

    // Hide hints after 3 successful merges in a row
    successStreak++;
    if (successStreak >= 3 && sessionFailCount >= 5) {
      sessionFailCount = 0;
      successStreak = 0;
      const hintsEl = document.getElementById('alch-hints');
      if (hintsEl) hintsEl.innerHTML = '';
    }

    selectedA = null;
    selectedB = null;
    updateSelection();
    resultTimeout = setTimeout(clearResult, 1800);
  };

  // Timer
  const timerInterval = setInterval(() => {
    if (finished) return;
    timeLeft -= 100;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      finishSession();
      return;
    }
    const fill = document.getElementById('alch-timer-fill');
    if (fill) fill.style.width = `${(timeLeft / C.sessionDurationMs) * 100}%`;
  }, 100);

  const finishSession = () => {
    if (finished) return;
    finished = true;
    clearInterval(timerInterval);
    if (resultTimeout) clearTimeout(resultTimeout);
    overlay.removeEventListener('click', clickHandler);

    // Track stats
    if (sessionNewCount > (stats.alchemyBestSession || 0)) stats.alchemyBestSession = sessionNewCount;
    if (sessionFailCount === 0 && sessionNewCount > 0) stats.alchemyPerfectSessions = (stats.alchemyPerfectSessions || 0) + 1;

    let tier = null;
    if (sessionNewCount >= C.legendaryThreshold) tier = 'legendary';
    else if (sessionNewCount >= C.epicThreshold) tier = 'epic';
    else if (sessionNewCount >= C.greatThreshold) tier = 'great';
    else if (sessionNewCount >= 1) tier = 'normal'; // any discovery = reward

    const tierLabels = { legendary: 'LEGENDARY!', epic: 'EPIC!', great: 'GREAT!', normal: 'Nice!' };
    let rewardHtml = '';
    if (tier) {
      const reward = mg._giveReward(tier, 'cookieAlchemy');
      rewardHtml = `<div class="mini-reward">+${formatNumberInWords(reward)} cookies</div>`;
    }

    const dc = stats.alchemyDiscovered.length;

    mg._show(`<div class="mini-game-card alch-card">
      <div class="mini-title">🧪 Cookie Alchemy</div>
      <div class="alch-finish">
        <div class="alch-finish-tier">${tier ? tierLabels[tier] : (sessionNewCount > 0 ? 'Progress saved!' : 'Try different combos!')}</div>
        <div class="alch-finish-session">This session: ${sessionNewCount} new recipe${sessionNewCount !== 1 ? 's' : ''}</div>
        <div class="alch-finish-total">
          <span>Discoveries: ${dc}/${discoveryTarget}</span>
          <span>Available: ${available.size} items</span>
        </div>
        ${stats.alchemyResets > 0 ? `<div class="alch-finish-mastery">Masteries: ${stats.alchemyResets}</div>` : ''}
        ${rewardHtml}
      </div>
    </div>`);
    setTimeout(() => mg._close(), C.resultDisplayMs);
  };

  mg._activeCleanup = () => {
    finished = true;
    clearInterval(timerInterval);
    if (resultTimeout) clearTimeout(resultTimeout);
    overlay.removeEventListener('click', clickHandler);
  };

  // Initial grid render + stats (hints hidden until 5 failed merges)
  renderGrid();
  updateStats();
}
