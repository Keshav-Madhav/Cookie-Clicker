import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** DungeonCrawl mixin */
export const DungeonCrawlMixin = {
/* ════════════════════════════════════════════════════════════
   ⚔️  DUNGEON CRAWL v4 — exploration + combat
   ════════════════════════════════════════════════════════════

   Design:
   - 5-10 random floors, boss on last floor
   - Between floors: choose a path (combat, elite, rest, event, treasure, trap)
   - Combat: Attack / Block / Heavy / Scout / Potion / Flee
   - Enemy shows INTENT before acting
   - Loot after combat, other rooms have unique interactions
*/

_dungeonCrawl() {
  const C = MINI_GAME_SETTINGS.dungeon;
  const g = this.game;
  const cps = g.getEffectiveCPS().toNumber();
  const fee = Math.floor(cps * C.entryFeeMultiplier);

  if (fee > 0 && g.cookies.toNumber() < fee) {
    this._show(`<div class="mini-game-card dungeon-card"><div class="dng-head">⚔️ Cookie Dungeon</div>
      <div class="dng-splash">🚫<br>Not enough cookies!<br><b>${formatNumberInWords(fee)}</b> needed</div>
      <div class="dng-btns"><button class="dng-b dng-b-run" id="dng-x">Close</button></div></div>`);
    document.getElementById('dng-x')?.addEventListener('click', () => this._close());
    return;
  }
  if (fee > 0) { g.cookies = g.cookies.sub(fee); g.updateCookieCount(); }
  g.stats.dungeonRuns = (g.stats.dungeonRuns || 0) + 1;

  // Weighted floor count: lower floors more common, higher floors rare
  // Uses squared random to skew toward minFloors (e.g. 8-10 common, 14-16 rare)
  const range = C.maxFloors - C.minFloors + 1;
  const roll = Math.random() * Math.random(); // squared distribution: ~50% below 0.25, ~75% below 0.5
  const totalFloors = C.minFloors + Math.floor(roll * range);

  // Build room list: floor 0 = combat, last = boss, middle = TBD (filled by path choices)
  const rooms = [];
  for (let i = 0; i < totalFloors; i++) {
    if (i === 0) rooms.push({ type: 'combat', resolved: false });
    else if (i === totalFloors - 1) rooms.push({ type: 'boss', resolved: false });
    else rooms.push({ type: null, resolved: false }); // filled by path choice
  }

  const mhp = Math.floor(C.baseHp + g.getTotalBuildingCount() * C.hpPerBuilding);
  this._dng = {
    C, rooms, totalFloors, fl: 0, busy: false, log: [],
    scouted: false, stunned: false, usedUtil: false, coins: 0,
    usedNames: new Set(), treasureCount: 0, lastRestFloor: -99,
    enemy: null, // current enemy (set when entering combat/elite/boss)
    p: { hp: mhp, maxHp: mhp, atk: Math.min(C.atkCap, C.baseAtk + cps * C.atkCpsScale),
         pot: C.potions, crit: C.critChance, x2: false, x2Count: 0 },
  };
  // Start floor 0 (always combat)
  this._dEnterRoom();
},

/* ══════  LOOT APPLICATION — handles coin bonuses  ══════ */

_dApplyLoot(lootItem) {
  const D = this._dng;
  lootItem.apply(D.p);
  if (lootItem.coins) D.coins += lootItem.coins;
},

/* ══════  TOOLTIP CLEANUP — hide all tooltips on screen change  ══════ */

_dClearTooltips() {
  const gt = document.getElementById('global-tooltip');
  if (gt) gt.style.opacity = '0';
  this._dHideTip();
},

/* ══════  ROOM ENTRY — dispatch based on room type  ══════ */

_dEnterRoom() {
  this._dClearTooltips();
  const D = this._dng, { C, rooms } = D;
  const room = rooms[D.fl];

  if (room.type === 'combat' || room.type === 'elite' || room.type === 'boss') {
    const enemy = this._dMakeEnemy(room.type);
    D.enemy = enemy;
    room.resolved = true;
    D.scouted = false;
    D.stunned = false;
    D.usedUtil = false;
    const entranceTexts = enemy.isElite
      ? [`💀 An elite ${enemy.name} blocks your path!`]
      : [`${enemy.emoji} A ${enemy.name} appears!`, `${enemy.emoji} You encounter a ${enemy.name}!`, `${enemy.emoji} ${enemy.name} lunges from the shadows!`];
    D.log = [entranceTexts[Math.floor(Math.random() * entranceTexts.length)]];
    if (room.type === 'boss') {
      // Boss entrance splash
      const pips = this._dPips();
      this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
        <div class="dng-head">
          <span>⚔️ Cookie Dungeon</span>
          <span class="dng-earned" id="dng-earned">🪙 ${D.coins}</span>
          <span class="dng-fl">Floor ${D.fl + 1}/${D.totalFloors}</span>
        </div>
        <div class="dng-pips">${pips}</div>
        <div class="dng-room-card dng-boss-intro">
          <div class="dng-room-emoji">${enemy.emoji}</div>
          <div class="dng-room-title">${enemy.name}</div>
          <div class="dng-room-text">The final guardian stands before you. Prepare yourself...</div>
          <div class="dng-path-status">
            <span style="color:#ef4444">❤️ ${enemy.maxHp} HP</span>
            <span style="color:#fbbf24">⚔️ ${enemy.atk} ATK</span>
          </div>
          <div class="dng-btns"><button class="dng-b dng-b-atk" id="dng-fight">Fight!</button></div>
        </div>
      </div>`);
      document.getElementById('dng-fight')?.addEventListener('click', () => {
        this.game.soundManager.dungeonAttack();
        this._dR();
      });
      return;
    }
    this._dR(); // render combat
  } else if (room.type === 'rest') {
    room.resolved = true;
    this._dRoomRest();
  } else if (room.type === 'treasure') {
    room.resolved = true;
    this._dRoomTreasure();
  } else if (room.type === 'event') {
    room.resolved = true;
    this._dRoomEvent();
  } else if (room.type === 'trap') {
    room.resolved = true;
    this._dRoomTrap();
  }
},

/* ══════  ENEMY GENERATION  ══════ */

_dMakeEnemy(roomType) {
  const D = this._dng, { C } = D;
  if (roomType === 'boss') {
    const base = C.bosses[Math.floor(Math.random() * C.bosses.length)];
    const extraFloors = D.totalFloors - C.minFloors;
    const hpScale = 1 + extraFloors * C.bossHpScale;
    const atkScale = 1 + extraFloors * C.bossAtkScale;
    return { ...base, hp: Math.floor(base.hp * hpScale), atk: Math.floor(base.atk * atkScale),
      maxHp: Math.floor(base.hp * hpScale), isBoss: true, intent: this._dI(C, null) };
  }
  // Regular or elite combat
  const progress = D.fl / (D.totalFloors - 1);
  const tierIdx = progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;
  let pool = C.enemyTiers[tierIdx].filter(e => !D.usedNames.has(e.name));
  if (pool.length === 0) {
    C.enemyTiers[tierIdx].forEach(e => D.usedNames.delete(e.name));
    pool = C.enemyTiers[tierIdx];
  }
  const base = pool[Math.floor(Math.random() * pool.length)];
  D.usedNames.add(base.name);
  let s = 1 + D.fl * C.depthScale;
  let hpMult = 1, atkMult = 1;
  if (roomType === 'elite') { hpMult = C.eliteHpMult; atkMult = C.eliteAtkMult; }
  return { ...base, hp: Math.floor(base.hp * s * hpMult), atk: Math.floor(base.atk * s * atkMult),
    maxHp: Math.floor(base.hp * s * hpMult), isBoss: false, isElite: roomType === 'elite',
    intent: this._dI(C, null) };
},

/* ══════  PATH CHOICE — shown between floors  ══════ */

_dPathChoice() {
  this._dClearTooltips();
  const D = this._dng, { C, rooms, p } = D;
  D.busy = false;

  // Generate 2-3 room options for next floor
  const progress = D.fl / (D.totalFloors - 1);
  const phase = progress < 0.4 ? 'early' : progress < 0.7 ? 'mid' : 'late';
  const weights = { ...C.roomWeights[phase] };

  // Apply rules: no consecutive rest, no early elite, treasure cap
  if (D.fl - D.lastRestFloor < C.restCooldown) weights.rest = 0;
  if (progress < C.eliteMinFloor) weights.elite = 0;
  if (D.treasureCount >= C.maxTreasurePerRun) weights.treasure = 0;

  const pickType = () => {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) return 'combat';
    let r = Math.random() * totalWeight;
    for (const [type, w] of Object.entries(weights)) {
      r -= w;
      if (r <= 0) return type;
    }
    return 'combat';
  };

  // Generate unique options, always including at least one combat
  const options = [];
  const usedTypes = new Set();
  options.push('combat');
  usedTypes.add('combat');
  // Fill remaining with non-combat types
  const floorsRemaining = D.totalFloors - D.fl - 1; // floors after this one (boss counts)
  const numChoices = Math.min(C.pathChoices, floorsRemaining > 1 ? 3 : 2);
  let attempts = 0;
  while (options.length < numChoices && attempts < 50) {
    const type = pickType();
    if (!usedTypes.has(type)) {
      options.push(type);
      usedTypes.add(type);
    }
    attempts++;
  }

  // Shuffle so combat isn't always first
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  // Render path choice card
  const pips = this._dPips();
  const phpPct = Math.max(0, p.hp / p.maxHp * 100);
  const hpc = phpPct > 50 ? '#22c55e' : phpPct > 25 ? '#eab308' : '#ef4444';

  // Pick unique hints — no two doors show the same text
  const usedHints = new Set();
  const doorsHtml = options.map((type, i) => {
    const hints = C.doorHints[type];
    let hint;
    let hAttempts = 0;
    do {
      hint = hints[Math.floor(Math.random() * hints.length)];
      hAttempts++;
    } while (usedHints.has(hint) && hAttempts < 20);
    usedHints.add(hint);
    return `<div class="dng-door" data-door="${i}" data-type="${type}">
      <div class="dng-door-hint">${hint}</div>
    </div>`;
  }).join('');

  this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
    <div class="dng-head">
      <span>⚔️ Cookie Dungeon</span>
      <span class="dng-earned" id="dng-earned">🪙 ${D.coins}</span>
      <span class="dng-fl">Floor ${D.fl + 1}/${D.totalFloors}</span>
      <button class="dng-help-btn" id="dng-help">?</button>
    </div>
    <div class="dng-pips">${pips}</div>
    <div class="dng-path-choice">
      <div class="dng-path-head">Choose your path</div>
      <div class="dng-path-status">
        <span style="color:${hpc}">❤️ ${Math.ceil(p.hp)}/${p.maxHp}</span>
        <span>⚔️ ${Math.floor(p.atk)}</span>
        ${p.pot > 0 ? `<span>💊 ${p.pot}</span>` : ''}
        ${D.coins > 0 ? `<span style="color:#fbbf24">🪙 ${D.coins}</span>` : ''}
      </div>
      <div class="dng-doors">${doorsHtml}</div>
    </div>
  </div>`);

  // Bind door clicks
  document.querySelectorAll('.dng-door').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      rooms[D.fl].type = type;
      if (type === 'rest') D.lastRestFloor = D.fl;
      if (type === 'treasure') D.treasureCount++;
      this.game.soundManager.uiClick();
      this._dEnterRoom();
    });
  });

  // Help tooltip
  const helpBtn = document.getElementById('dng-help');
  if (helpBtn) {
    helpBtn.addEventListener('mouseenter', () => this._dShowTip(helpBtn));
    helpBtn.addEventListener('mouseleave', () => this._dHideTip());
    helpBtn.addEventListener('click', (ev) => { ev.stopPropagation(); this._dShowTip(helpBtn); });
  }
},

/* ══════  NON-COMBAT ROOMS  ══════ */

_dRoomRest() {
  const D = this._dng, { C, p } = D;
  const healAmt = Math.floor(p.maxHp * C.restHealPercent);
  const pips = this._dPips();

  let optionsHtml = `
    <div class="dng-loot" data-choice="heal"><span class="dng-loot-ico">❤️‍🩹</span><span class="dng-loot-txt">Heal ${healAmt} HP</span></div>
    <div class="dng-loot" data-choice="atk"><span class="dng-loot-ico">🗡️</span><span class="dng-loot-txt">+${C.restAtkBonus} Attack</span></div>
    <div class="dng-loot" data-choice="coins"><span class="dng-loot-ico">🪙</span><span class="dng-loot-txt">+${C.coinRestBonus} Coins</span></div>`;
  if (Math.random() < C.restPotionChance) {
    optionsHtml += `<div class="dng-loot" data-choice="pot"><span class="dng-loot-ico">🧪</span><span class="dng-loot-txt">+1 Potion</span></div>`;
  }

  this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
    <div class="dng-head">
      <span>⚔️ Cookie Dungeon</span>
      <span class="dng-earned" id="dng-earned">🪙 ${D.coins}</span>
      <span class="dng-fl">Floor ${D.fl + 1}/${D.totalFloors}</span>
    </div>
    <div class="dng-pips">${pips}</div>
    <div class="dng-room-card">
      <div class="dng-room-emoji">🏕️</div>
      <div class="dng-room-title">Cookie Campfire</div>
      <div class="dng-room-text">A warm campfire crackles. The smell of baking cookies fills the air. Take a moment to recover...</div>
      <div class="dng-loot-head">Choose one:</div>
      <div class="dng-loots">${optionsHtml}</div>
    </div>
  </div>`);

  document.querySelectorAll('.dng-loot').forEach(el => el.addEventListener('click', () => {
    const choice = el.dataset.choice;
    if (choice === 'heal') p.hp = Math.min(p.maxHp, p.hp + healAmt);
    else if (choice === 'atk') p.atk += C.restAtkBonus;
    else if (choice === 'coins') D.coins += C.coinRestBonus;
    else if (choice === 'pot') p.pot++;
    this.game.soundManager.dungeonLoot();
    this._dAdvanceFloor();
  }));
},

_dRoomTreasure() {
  const D = this._dng, { C, p } = D;
  // Treasure rooms always grant bonus coins
  D.coins += C.coinTreasureBonus;
  const progress = D.fl / (D.totalFloors - 1);
  const lootTable = progress >= 0.5 ? C.lootLate : C.lootEarly;
  const pool = [...lootTable].sort(() => Math.random() - 0.5).slice(0, 3);
  const pips = this._dPips();

  this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
    <div class="dng-head">
      <span>⚔️ Cookie Dungeon</span>
      <span class="dng-earned" id="dng-earned">🪙 ${D.coins}</span>
      <span class="dng-fl">Floor ${D.fl + 1}/${D.totalFloors}</span>
    </div>
    <div class="dng-pips">${pips}</div>
    <div class="dng-room-card">
      <div class="dng-room-emoji">💰</div>
      <div class="dng-room-title">Treasure Room</div>
      <div class="dng-room-text">A hidden stash of cookie treasures! +${C.coinTreasureBonus} 🪙. Take your pick.</div>
      <div class="dng-loot-head">Choose one:</div>
      <div class="dng-loots">${pool.map((l, i) =>
        `<div class="dng-loot" data-li="${i}"><span class="dng-loot-ico">${l.icon}</span><span class="dng-loot-txt">${l.label}</span></div>`
      ).join('')}</div>
    </div>
  </div>`);

  document.querySelectorAll('.dng-loot').forEach(el => el.addEventListener('click', () => {
    this._dApplyLoot(pool[parseInt(el.dataset.li)]);
    this.game.soundManager.dungeonLoot();
    this._dAdvanceFloor();
  }));
},

_dRoomEvent() {
  const D = this._dng, { C, p } = D;
  const event = C.events[Math.floor(Math.random() * C.events.length)];
  const pips = this._dPips();

  const choicesHtml = event.choices.map((ch, i) =>
    `<div class="dng-choice" data-ci="${i}">
      <span class="dng-choice-arrow">→</span>
      <span class="dng-choice-label">${ch.label}</span>
    </div>`
  ).join('');

  this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
    <div class="dng-head">
      <span>⚔️ Cookie Dungeon</span>
      <span class="dng-earned" id="dng-earned">🪙 ${D.coins}</span>
      <span class="dng-fl">Floor ${D.fl + 1}/${D.totalFloors}</span>
    </div>
    <div class="dng-pips">${pips}</div>
    <div class="dng-room-card">
      <div class="dng-room-emoji">${event.emoji}</div>
      <div class="dng-room-title">${event.name}</div>
      <div class="dng-room-text">${event.text}</div>
      <div class="dng-choices">${choicesHtml}</div>
    </div>
  </div>`);

  document.querySelectorAll('.dng-choice').forEach(el => el.addEventListener('click', () => {
    const choice = event.choices[parseInt(el.dataset.ci)];
    // Snapshot stats before effect
    const before = { hp: p.hp, maxHp: p.maxHp, atk: p.atk, pot: p.pot, crit: p.crit };
    // Weighted random outcome
    const totalW = choice.outcomes.reduce((a, o) => a + o.weight, 0);
    let r = Math.random() * totalW;
    let outcome = choice.outcomes[0];
    for (const o of choice.outcomes) {
      r -= o.weight;
      if (r <= 0) { outcome = o; break; }
    }
    outcome.effect(p);
    if (outcome.good) this.game.soundManager.dungeonLoot();
    else this.game.soundManager.dungeonHurt();

    // Build stat diff summary
    const diffs = [];
    const hpDiff = Math.ceil(p.hp) - Math.ceil(before.hp);
    const maxHpDiff = p.maxHp - before.maxHp;
    const atkDiff = Math.floor(p.atk) - Math.floor(before.atk);
    const potDiff = p.pot - before.pot;
    const critDiff = Math.round((p.crit - before.crit) * 100);
    if (hpDiff !== 0) diffs.push(`<span style="color:${hpDiff > 0 ? '#4ade80' : '#ef4444'}">${hpDiff > 0 ? '+' : ''}${hpDiff} HP</span>`);
    if (maxHpDiff !== 0) diffs.push(`<span style="color:#4ade80">+${maxHpDiff} Max HP</span>`);
    if (atkDiff !== 0) diffs.push(`<span style="color:${atkDiff > 0 ? '#fbbf24' : '#ef4444'}">${atkDiff > 0 ? '+' : ''}${atkDiff} ATK</span>`);
    if (potDiff !== 0) diffs.push(`<span style="color:${potDiff > 0 ? '#93c5fd' : '#ef4444'}">${potDiff > 0 ? '+' : ''}${potDiff} Pot</span>`);
    if (critDiff !== 0) diffs.push(`<span style="color:#c4b5fd">+${critDiff}% Crit</span>`);
    const diffHtml = diffs.length > 0 ? `<div class="dng-stat-diff">${diffs.join(' · ')}</div>` : '';

    // Show result
    const card = document.querySelector('.dng-room-card');
    if (card) {
      card.innerHTML = `
        <div class="dng-room-emoji">${outcome.good ? '✨' : '💥'}</div>
        <div class="dng-room-title">${outcome.good ? 'Fortune smiles!' : 'Misfortune...'}</div>
        <div class="dng-room-text">${outcome.text}</div>
        ${diffHtml}
        <div class="dng-btns"><button class="dng-b dng-b-run" id="dng-continue">Continue</button></div>`;
      document.getElementById('dng-continue')?.addEventListener('click', () => {
        if (p.hp <= 0) { p.hp = 0; this._dEnd(false, true); return; }
        this._dAdvanceFloor();
      });
    }
  }));
},

_dRoomTrap() {
  const D = this._dng, { C, p } = D;
  const riskHp = Math.floor(p.maxHp * C.trapRiskPercent);
  const pips = this._dPips();

  this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
    <div class="dng-head">
      <span>⚔️ Cookie Dungeon</span>
      <span class="dng-earned" id="dng-earned">🪙 ${D.coins}</span>
      <span class="dng-fl">Floor ${D.fl + 1}/${D.totalFloors}</span>
    </div>
    <div class="dng-pips">${pips}</div>
    <div class="dng-room-card">
      <div class="dng-room-emoji">⚠️</div>
      <div class="dng-room-title">Trapped Chamber</div>
      <div class="dng-room-text">The room hums with hidden mechanisms. A treasure chest sits in the center, but the floor is rigged...</div>
      <div class="dng-choices">
        <div class="dng-choice" data-choice="risk">
          <span class="dng-choice-arrow">🎲</span>
          <span class="dng-choice-label">Risk it (-${riskHp} HP if it fails)</span>
        </div>
        <div class="dng-choice" data-choice="skip">
          <span class="dng-choice-arrow">🚶</span>
          <span class="dng-choice-label">Walk away safely</span>
        </div>
      </div>
    </div>
  </div>`);

  document.querySelectorAll('.dng-choice').forEach(el => el.addEventListener('click', () => {
    const choice = el.dataset.choice;
    const card = document.querySelector('.dng-room-card');
    if (!card) return;

    if (choice === 'skip') {
      card.innerHTML = `
        <div class="dng-room-emoji">🚶</div>
        <div class="dng-room-title">Caution wins</div>
        <div class="dng-room-text">You leave the treasure behind. Probably wise.</div>
        <div class="dng-btns"><button class="dng-b dng-b-run" id="dng-continue">Continue</button></div>`;
      document.getElementById('dng-continue')?.addEventListener('click', () => this._dAdvanceFloor());
      return;
    }

    // Risk it
    const roll = Math.random();
    const progress = D.fl / (D.totalFloors - 1);
    const lootTable = progress >= 0.5 ? C.lootLate : C.lootEarly;

    if (roll < C.trapGoodChance) {
      // Good outcome — give loot + coins
      const isGreat = Math.random() < C.trapGreatChance;
      const coinBonus = isGreat ? C.coinGreatTrapBonus : C.coinTrapBonus;
      D.coins += coinBonus;
      const pool = [...lootTable].sort(() => Math.random() - 0.5).slice(0, isGreat ? 3 : 2);
      this.game.soundManager.dungeonLoot();

      card.innerHTML = `
        <div class="dng-room-emoji">${isGreat ? '🌟' : '✨'}</div>
        <div class="dng-room-title">${isGreat ? 'Incredible find!' : 'You made it through!'}</div>
        <div class="dng-room-text">The trap disarms and reveals its treasure. +${coinBonus} 🪙</div>
        <div class="dng-loot-head">Choose one:</div>
        <div class="dng-loots">${pool.map((l, i) =>
          `<div class="dng-loot" data-li="${i}"><span class="dng-loot-ico">${l.icon}</span><span class="dng-loot-txt">${l.label}</span></div>`
        ).join('')}</div>`;
      document.querySelectorAll('.dng-loot').forEach(lel => lel.addEventListener('click', () => {
        this._dApplyLoot(pool[parseInt(lel.dataset.li)]);
        this.game.soundManager.dungeonLoot();
        this._dAdvanceFloor();
      }));
    } else {
      // Bad outcome — take damage
      p.hp = Math.max(1, p.hp - riskHp);
      this.game.soundManager.dungeonHurt();

      card.innerHTML = `
        <div class="dng-room-emoji">💥</div>
        <div class="dng-room-title">Trap sprung!</div>
        <div class="dng-room-text">The mechanism triggers! You take ${riskHp} damage.</div>
        <div class="dng-btns"><button class="dng-b dng-b-run" id="dng-continue">Continue (-${riskHp} HP)</button></div>`;
      document.getElementById('dng-continue')?.addEventListener('click', () => this._dAdvanceFloor());
    }
  }));
},

/* ══════  FLOOR ADVANCEMENT  ══════ */

_dAdvanceFloor() {
  const D = this._dng;
  D.fl++;
  if (D.fl >= D.totalFloors) {
    // Shouldn't happen (boss is last), but safety
    this._dEnd(true, false);
  } else if (D.rooms[D.fl].type === 'boss') {
    // Boss floor — go straight to combat
    this._dEnterRoom();
  } else {
    // Show path choice for next floor
    this._dPathChoice();
  }
},

/* ══════  PIP BAR  ══════ */

_dPips() {
  const D = this._dng, { C, rooms } = D;
  return rooms.map((room, i) => {
    const done = i < D.fl;
    const now = i === D.fl;
    let icon;
    if (done) icon = C.doorIcons[room.type] || '✓';
    else if (room.type === 'boss') icon = C.doorIcons.boss;
    else if (now && room.type) icon = C.doorIcons[room.type] || '?';
    else icon = '·';
    return `<span class="dng-pip${done ? ' done' : now ? ' now' : ''}">${icon}</span>`;
  }).join('');
},

/* ══════  COMBAT RENDER  ══════ */

/** Smart enemy AI — picks intent based on HP context */
_dI(C, enemy) {
  const hpPct = enemy ? enemy.hp / enemy.maxHp : 1;
  const r = Math.random();
  if (hpPct < C.enemyFleeHpThreshold && r < C.enemyFleeChance) return 'flee';
  if (hpPct < 0.7 && Math.random() < C.enemyHealChance) return 'heal';
  if (Math.random() < C.enemyBlockChance) return 'block';
  const heavyChance = enemy?.isBoss ? C.enemyHeavyChance * 1.5 : C.enemyHeavyChance;
  if (Math.random() < heavyChance) return 'heavy';
  return 'atk';
},

_dR() {
  const D = this._dng, { C, p, log } = D;
  const e = D.enemy;
  const php = Math.max(0, p.hp / p.maxHp * 100);
  const ehp = Math.max(0, e.hp / e.maxHp * 100);
  const hpc = php > 50 ? '#22c55e' : php > 25 ? '#eab308' : '#ef4444';
  const pips = this._dPips();

  const { iTag, iHint } = this._dIntentHtml(e, C, D.scouted);
  const logHtml = log.slice(-2).map((l, i, a) =>
    `<div class="dng-ll" style="opacity:${i === a.length - 1 ? '1' : '0.4'}">${l}</div>`).join('');

  const eliteTag = e.isElite ? ' <span style="color:#fbbf24;font-size:10px">ELITE</span>' : '';

  this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
    <div class="dng-head">
      <span>⚔️ Cookie Dungeon</span>
      <span class="dng-earned" id="dng-earned">🪙 ${D.coins}</span>
      <span class="dng-fl">Floor ${D.fl + 1}/${D.totalFloors}</span>
      <button class="dng-help-btn" id="dng-help">?</button>
    </div>
    <div class="dng-pips">${pips}</div>

    <div class="dng-field">
      <div class="dng-side" id="dng-ps">
        <div class="dng-avatar" id="dng-pi">🧙</div>
        <div class="dng-hpwrap"><div class="dng-hpbar" id="dng-pb" style="width:${php}%;background:${hpc}"></div><div class="dng-hpghost" id="dng-pg" style="width:${php}%"></div></div>
        <div class="dng-stat" id="dng-pt"><b>${Math.ceil(p.hp)}</b>/${Math.ceil(p.maxHp)} HP</div>
        <div class="dng-stat">${Math.floor(p.atk)} ATK${p.pot > 0 ? ` · 💊${p.pot}` : ''}${p.x2 ? ` · ⚡2×${p.x2Count > 1 ? '(' + p.x2Count + ')' : ''}` : ''}</div>
        <div class="dng-float" id="dng-pf"></div>
      </div>

      <div class="dng-center">
        ${iTag}
        ${iHint ? `<div class="dng-hint">${iHint}</div>` : ''}
      </div>

      <div class="dng-side dng-eside" id="dng-es">
        <div class="dng-avatar ${e.isBoss ? 'dng-boss' : ''}" id="dng-ei">${e.emoji}</div>
        <div class="dng-ename">${e.name}${eliteTag}</div>
        <div class="dng-hpwrap"><div class="dng-hpbar dng-ehp" id="dng-eb" style="width:${ehp}%"></div><div class="dng-hpghost dng-eghp" id="dng-eg" style="width:${ehp}%"></div></div>
        <div class="dng-stat" id="dng-et"><b>${Math.ceil(e.hp)}</b>/${e.maxHp} HP</div>
        <div class="dng-float" id="dng-ef"></div>
      </div>
    </div>

    <div class="dng-log" id="dng-log">${logHtml}</div>

    <div class="dng-bottom">
      <div class="dng-utils" id="dng-utils">
        <span class="dng-util-label">1 per turn</span>
        <button class="dng-u dng-u-scout" data-a="scout" data-tip="Reveal enemy intent. Costs 1 HP. One utility per turn.">
          <svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="14" r="8" fill="none" stroke="#a78bfa" stroke-width="1.8"/><circle cx="16" cy="14" r="5" fill="none" stroke="#a78bfa" stroke-width="1"/><circle cx="16" cy="14" r="2" fill="#c4b5fd"/><line x1="22" y1="20" x2="27" y2="27" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="14" r="8" fill="rgba(167,139,250,0.06)"/></svg>
        </button>
        <button class="dng-u dng-u-pot" data-a="pot" ${p.pot <= 0 ? 'disabled' : ''} data-tip="Heal ${Math.floor(p.maxHp * C.potionHeal)} HP (${p.pot} left). One utility per turn.">
          <svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="pg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="transparent"/><stop offset="45%" stop-color="transparent"/><stop offset="45%" stop-color="rgba(74,222,128,0.35)"/><stop offset="100%" stop-color="rgba(34,197,94,0.6)"/></linearGradient></defs><path d="M12 4h8v2h2l1 4-2 18H11L9 10l1-4h2V4z" fill="url(#pg1)" stroke="#4ade80" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 4h8v2H12z" fill="rgba(74,222,128,0.2)" stroke="#4ade80" stroke-width="1.2"/><circle cx="14" cy="20" r="1" fill="#86efac" opacity="0.5"/><circle cx="17" cy="22" r="0.7" fill="#86efac" opacity="0.4"/><circle cx="15" cy="17" r="0.6" fill="#86efac" opacity="0.3"/><line x1="14" y1="8" x2="18" y2="8" stroke="rgba(74,222,128,0.3)" stroke-width="0.8"/></svg>
          ${p.pot > 0 ? `<span class="dng-u-badge">${p.pot}</span>` : ''}
        </button>
        <button class="dng-u dng-u-run" data-a="run" data-tip="Flee and keep ${D.coins} coins. Dying = 50% coin penalty. One utility per turn.">
          <svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="20" cy="7" r="3" fill="none" stroke="#d1d5db" stroke-width="1.5"/><path d="M17 12l-5 6 3 1-2 9" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M17 12l4 5 4-2" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12 18l-5 3" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M5 14l3 1" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/><path d="M6 17l2 0" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/></svg>
        </button>
      </div>
      <div class="dng-btns" id="dng-btns">
        <button class="dng-b dng-b-atk" data-a="atk" ${D.stunned ? 'disabled' : ''} data-tip="Deal ${Math.floor(p.atk * 0.8)}-${Math.floor(p.atk * 1.2)} damage. ${Math.round(p.crit * 100)}% crit chance.">Attack (${Math.floor(p.atk)})</button>
        <button class="dng-b dng-b-heavy" data-a="heavy" ${D.stunned ? 'disabled' : ''} data-tip="Deal ${Math.floor(p.atk * C.heavyAtkMult * 0.8)}-${Math.floor(p.atk * C.heavyAtkMult * 1.2)} damage. Skips next turn.">Heavy (${Math.floor(p.atk * C.heavyAtkMult)})</button>
        <button class="dng-b dng-b-blk" data-a="blk" ${D.stunned ? 'disabled' : ''} data-tip="Block ${Math.round(C.blockPercent * 100)}% of incoming damage this turn.">Block (${Math.round(C.blockPercent * 100)}%)</button>
        <button class="dng-b dng-b-skip" data-a="skip" ${D.stunned ? '' : 'disabled'} data-tip="Skip your turn. Used when recovering from heavy attack.">Skip 💫</button>
      </div>
    </div>
  </div>`);

  // Bind all buttons
  document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => {
    b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!D.busy) this._dA(b.dataset.a); });
    if (b.dataset.tip) {
      b.addEventListener('mouseenter', () => {
        const gt = document.getElementById('global-tooltip');
        if (gt) { gt.innerHTML = b.dataset.tip; gt.style.opacity = '1'; }
      });
      b.addEventListener('mousemove', (ev) => {
        const gt = document.getElementById('global-tooltip');
        if (gt) { gt.style.left = (ev.clientX + 12) + 'px'; gt.style.top = (ev.clientY - 30) + 'px'; }
      });
      b.addEventListener('mouseleave', () => {
        const gt = document.getElementById('global-tooltip');
        if (gt) gt.style.opacity = '0';
      });
    }
  });

  // Help tooltip
  const helpBtn = document.getElementById('dng-help');
  if (helpBtn) {
    helpBtn.addEventListener('mouseenter', () => this._dShowTip(helpBtn));
    helpBtn.addEventListener('mouseleave', () => this._dHideTip());
    helpBtn.addEventListener('click', (ev) => { ev.stopPropagation(); this._dShowTip(helpBtn); });
  }
},

/* ══════  HELP TOOLTIP  ══════ */
_dShowTip(anchor) {
  let tip = document.getElementById('dng-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'dng-tooltip';
    tip.className = 'dng-tooltip';
    tip.innerHTML = `
      <div class="dng-tip-title">How to Play</div>
      <div class="dng-tip-grid">
        <div class="dng-tip-item"><span class="dng-tip-key">⚔️ Attack</span><span class="dng-tip-desc">Deal damage. Crits happen randomly.</span></div>
        <div class="dng-tip-item"><span class="dng-tip-key">💀 Heavy</span><span class="dng-tip-desc">1.6× damage, skip next turn.</span></div>
        <div class="dng-tip-item"><span class="dng-tip-key">🛡️ Block</span><span class="dng-tip-desc">Reduce incoming damage by 65%.</span></div>
        <div class="dng-tip-item"><span class="dng-tip-key">👁️ Scout</span><span class="dng-tip-desc">Reveal enemy intent. Costs 1 HP.</span></div>
        <div class="dng-tip-item"><span class="dng-tip-key">💊 Potion</span><span class="dng-tip-desc">Heal 35% HP. Limited supply.</span></div>
        <div class="dng-tip-item"><span class="dng-tip-key">🏃 Flee</span><span class="dng-tip-desc">Keep rewards. Dying = 50% penalty.</span></div>
      </div>
      <div class="dng-tip-footer">⚠️ Scout, Potion, and Flee share one use per turn — choose wisely!<br>Between floors, choose a path: 🗡️Combat 💀Elite 🏕️Rest ❓Event 💰Treasure ⚠️Trap</div>`;
    document.body.appendChild(tip);
  }
  const r = anchor.getBoundingClientRect();
  tip.style.top = (r.bottom + 8) + 'px';
  tip.style.left = Math.max(8, r.left - 120) + 'px';
  tip.style.opacity = '1';
  tip.style.pointerEvents = 'auto';
},

_dHideTip() {
  const tip = document.getElementById('dng-tooltip');
  if (tip) { tip.style.opacity = '0'; tip.style.pointerEvents = 'none'; }
},

/** Build intent display */
_dIntentHtml(e, C, scouted) {
  if (!scouted) {
    return { iTag: `<div class="dng-intent dng-i-unknown">❓ Unknown</div>`, iHint: 'Scout to reveal!' };
  }
  const i = e.intent;
  if (i === 'heavy') {
    const lo = Math.floor(e.atk * C.heavyMult * 0.8), hi = Math.floor(e.atk * C.heavyMult * 1.2);
    return { iTag: `<div class="dng-intent dng-i-heavy">💀 HEAVY ${lo}-${hi}</div>`, iHint: 'Block now!' };
  }
  if (i === 'block') return { iTag: `<div class="dng-intent dng-i-block">🛡️ Blocking</div>`, iHint: 'Heavy attack!' };
  if (i === 'heal') return { iTag: `<div class="dng-intent dng-i-heal">💚 Healing</div>`, iHint: 'Attack hard!' };
  if (i === 'flee') return { iTag: `<div class="dng-intent dng-i-flee">🏃 Fleeing!</div>`, iHint: 'Kill fast!' };
  const lo = Math.floor(e.atk * 0.8), hi = Math.floor(e.atk * 1.2);
  return { iTag: `<div class="dng-intent dng-i-atk">⚔️ Atk ${lo}-${hi}</div>`, iHint: '' };
},

/* ══════  FLOAT NUMBERS  ══════ */
_dF(id, text, color, big) {
  const c = document.getElementById(id); if (!c) return;
  const el = document.createElement('div');
  el.className = `dng-floater${big ? ' dng-floater-big' : ''}`;
  el.style.color = color; el.innerHTML = text;
  c.innerHTML = ''; c.appendChild(el);
  setTimeout(() => el.remove(), 900);
},

/* ══════  ACTION — player first, then enemy  ══════ */
_dA(a) {
  const D = this._dng, { C, p } = D, e = D.enemy;
  D.busy = true;
  const snd = this.game.soundManager;

  // ── UTILITY ACTIONS (one per turn, don't consume combat turn) ──
  if (a === 'run' || a === 'scout' || a === 'pot') {
    if (D.usedUtil) { D.busy = false; return; }
    D.usedUtil = true;

    if (a === 'run') { D.log.push('🏃 You fled!'); snd.dungeonFlee(); this._dEnd(false, false); return; }

    if (a === 'scout') {
      const cost = C.scoutCost;
      p.hp = Math.max(1, p.hp - cost);
      D.scouted = true;
      this._dF('dng-pf', `-${cost}`, '#a78bfa');
      const { iTag, iHint } = this._dIntentHtml(e, C, true);
      const mid = document.querySelector('.dng-center');
      if (mid) mid.innerHTML = `${iTag}${iHint ? `<div class="dng-hint">${iHint}</div>` : ''}`;
      D.log.push(`👁️ Scouted! <span class="dng-dim">(-${cost} HP)</span>`);
      snd.uiClick(); this._dSync();
      D.busy = false;
      this._dRefreshUtils();
      return;
    }

    if (a === 'pot') {
      if (p.pot <= 0) { D.usedUtil = false; D.busy = false; return; }
      p.pot--;
      const h = Math.floor(p.maxHp * C.potionHeal);
      p.hp = Math.min(p.maxHp, p.hp + h);
      D.log.push(`💊 +<b>${h}</b> HP (${p.pot} left)`);
      this._dF('dng-pf', `+${h}`, '#4ade80');
      this._dFx('dng-pi', 'dng-heal'); snd.dungeonHeal(); this._dSync();
      D.busy = false;
      this._dRefreshUtils();
      return;
    }
  }

  // ── COMBAT ACTIONS — disable buttons and reset scout ──
  D.scouted = false;
  document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => b.disabled = true);

  if (a === 'skip') {
    D.stunned = false;
    D.log.push('💫 Recovering from heavy attack...');
    this._dSync();
    setTimeout(() => this._dEnemyTurn(a), 500 + Math.floor(Math.random() * 500));
    return;
  }

  // ── PLAYER ACTS ──
  if (a === 'atk' || a === 'heavy') this._dFx('dng-pi', 'dng-lunge');

  setTimeout(() => {
    if (a === 'atk') {
      let dmg = Math.floor(p.atk * (0.8 + Math.random() * 0.4));
      if (p.x2) { dmg *= 2; if (p.x2Count > 1) { p.x2Count--; } else { p.x2 = false; p.x2Count = 0; } }
      const crit = Math.random() < p.crit;
      if (crit) dmg = Math.floor(dmg * C.critMult);
      if (e.intent === 'block') dmg = Math.floor(dmg * C.enemyBlockReduction);
      e.hp = Math.max(0, e.hp - dmg);
      this._dFx('dng-ei', 'dng-hit');
      this._dF('dng-ef', `${dmg}`, crit ? '#fbbf24' : '#fff', crit);
      if (crit) { this._dFx('dng-card', 'dng-shake'); snd.dungeonCrit(); } else { snd.dungeonAttack(); }
      const blkNote = e.intent === 'block' ? ' <span class="dng-dim">(enemy blocked)</span>' : '';
      D.log.push(crit ? `💥 CRIT! <b>${dmg}</b>!${blkNote}` : `⚔️ <b>${dmg}</b> dmg${blkNote}`);

    } else if (a === 'heavy') {
      let dmg = Math.floor(p.atk * C.heavyAtkMult * (0.8 + Math.random() * 0.4));
      if (p.x2) { dmg *= 2; if (p.x2Count > 1) { p.x2Count--; } else { p.x2 = false; p.x2Count = 0; } }
      if (e.intent === 'block') dmg = Math.floor(dmg * C.enemyBlockReduction);
      e.hp = Math.max(0, e.hp - dmg);
      D.stunned = true;
      this._dFx('dng-ei', 'dng-hit'); this._dFx('dng-card', 'dng-shake');
      this._dF('dng-ef', `${dmg}`, '#ff6b35', true);
      snd.dungeonCrit();
      const blkNote = e.intent === 'block' ? ' <span class="dng-dim">(enemy blocked)</span>' : '';
      D.log.push(`💀 HEAVY! <b>${dmg}</b> dmg!${blkNote} <span class="dng-dim">(skip next turn)</span>`);

    } else if (a === 'blk') {
      D.log.push('🛡️ Guarding.');
      this._dFx('dng-pi', 'dng-def'); snd.dungeonBlock();
    }

    this._dSync();

    // Enemy dead?
    if (e.hp <= 0) {
      const coinReward = e.isBoss ? C.coinPerBoss : e.isElite ? C.coinPerElite : C.coinPerCombat;
      D.coins += coinReward;
      D.log.push(`☠️ ${e.name} defeated! <span style="color:#fbbf24">+${coinReward} 🪙</span>`);
      this._dFx('dng-ei', 'dng-die'); snd.dungeonKill();
      const earnedEl = document.getElementById('dng-earned');
      if (earnedEl) earnedEl.textContent = '🪙 ' + D.coins;
      this._dSync();

      if (e.isBoss) {
        // Boss defeated — victory!
        setTimeout(() => this._dEnd(true, false), 800);
      } else {
        // Show loot, then path choice
        setTimeout(() => this._dLoot(), 700);
      }
      return;
    }

    // ── ENEMY ACTS ──
    setTimeout(() => this._dEnemyTurn(a), 500 + Math.floor(Math.random() * 500));
  }, 100);
},

/** Enemy turn */
_dEnemyTurn(playerAction) {
  const D = this._dng, { C, p } = D, e = D.enemy;
  const snd = this.game.soundManager;
  const intent = e.intent;

  if (intent === 'flee') {
    const fleeCoinReward = C.coinPerFlee;
    D.coins += fleeCoinReward;
    D.log.push(`${e.emoji} ${e.name} flees! <span style="color:#fbbf24">+${fleeCoinReward} 🪙</span>`);
    this._dF('dng-ef', '🏃', '#93c5fd');
    snd.dungeonFlee();
    const earnedEl = document.getElementById('dng-earned');
    if (earnedEl) earnedEl.textContent = '🪙 ' + D.coins;
    this._dSync();
    // Enemy fled — show loot then advance
    setTimeout(() => this._dLoot(), 500);
    return;

  } else if (intent === 'heal') {
    const h = Math.floor(e.maxHp * C.enemyHealAmount);
    e.hp = Math.min(e.maxHp, e.hp + h);
    D.log.push(`${e.emoji} heals <b>${h}</b> HP!`);
    this._dF('dng-ef', `+${h}`, '#4ade80');
    snd.dungeonHeal();

  } else if (intent === 'block') {
    D.log.push(`${e.emoji} blocked! <span class="dng-dim">(took 50% dmg)</span>`);
    this._dFx('dng-ei', 'dng-def'); snd.dungeonBlock();

  } else {
    const mult = intent === 'heavy' ? C.heavyMult : 1;
    let dmg = Math.floor(e.atk * mult * (0.8 + Math.random() * 0.4));
    if (playerAction === 'blk') dmg = Math.floor(dmg * (1 - C.blockPercent));
    p.hp = Math.max(0, p.hp - dmg);
    this._dFx('dng-pi', playerAction === 'blk' ? 'dng-blk' : 'dng-hit');
    this._dF('dng-pf', `${dmg}`, playerAction === 'blk' ? '#93c5fd' : '#ef4444', intent === 'heavy');
    if (playerAction === 'blk') { snd.dungeonBlock(); }
    else if (intent === 'heavy') { snd.dungeonHeavy(); this._dFx('dng-card', 'dng-shake'); }
    else { snd.dungeonHurt(); }
    const tag = intent === 'heavy' ? '💀 ' : '';
    D.log.push(`${e.emoji} ${tag}<b>${dmg}</b>${playerAction === 'blk' ? ' <span class="dng-dim">(blocked)</span>' : ''}`);
  }

  e.intent = this._dI(C, e);
  D.scouted = false;

  setTimeout(() => {
    this._dSync();
    if (p.hp <= 0) {
      D.log.push('💀 <b>Defeated!</b>');
      snd.dungeonDeath(); this._dSync();
      setTimeout(() => this._dEnd(false, true), 600);
      return;
    }
    D.busy = false;
    this._dUpdateIntent(e, C);
    this._dEnableBtns();
  }, 150);
},

_dUpdateIntent(e, C) {
  const D = this._dng;
  const mid = document.querySelector('.dng-center');
  if (mid) {
    const { iTag, iHint } = this._dIntentHtml(e, C, D.scouted);
    mid.innerHTML = `${iTag}${iHint ? `<div class="dng-hint">${iHint}</div>` : ''}`;
  }
  const p = D.p;
  const pt = document.getElementById('dng-pt');
  if (pt) pt.innerHTML = `<b>${Math.ceil(p.hp)}</b>/${Math.ceil(p.maxHp)} HP`;
  const stats = document.querySelectorAll('#dng-ps .dng-stat');
  if (stats.length >= 2) stats[1].textContent = `${Math.floor(p.atk)} ATK${p.pot > 0 ? ` · 💊${p.pot}` : ''}${p.x2 ? ` · ⚡2×${p.x2Count > 1 ? '(' + p.x2Count + ')' : ''}` : ''}`;
},

/** After a utility action, refresh button states */
_dRefreshUtils() {
  const D = this._dng, p = D.p;
  document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => {
    const a = b.dataset.a;
    if (a === 'scout' || a === 'pot' || a === 'run') {
      if (D.usedUtil) { b.disabled = true; return; }
      if (a === 'scout' && D.scouted) { b.disabled = true; return; }
      if (a === 'pot' && p.pot <= 0) { b.disabled = true; return; }
      b.disabled = false;
      return;
    }
    // Combat buttons — re-enable after utility use
    if (a === 'skip') { b.disabled = !D.stunned; return; }
    if (D.stunned && (a === 'atk' || a === 'heavy' || a === 'blk')) { b.disabled = true; return; }
    b.disabled = false;
  });
  const potBtn = document.querySelector('[data-a="pot"]');
  if (potBtn) {
    const badge = potBtn.querySelector('.dng-u-badge');
    if (badge) {
      if (p.pot > 0) badge.textContent = p.pot;
      else badge.remove();
    }
    potBtn.dataset.tip = `Heal ${Math.floor(p.maxHp * D.C.potionHeal)} HP (${p.pot} left). One utility per turn.`;
  }
  const runBtn = document.querySelector('[data-a="run"]');
  if (runBtn) {
    runBtn.dataset.tip = `Flee and keep ${D.coins} coins. Dying = 50% coin penalty. One utility per turn.`;
  }
  const label = document.querySelector('.dng-util-label');
  if (label) label.textContent = D.usedUtil ? 'used ✓' : '1 per turn';
},

/** Re-enable all buttons after enemy turn */
_dEnableBtns() {
  const D = this._dng, p = D.p;
  D.scouted = false;
  D.usedUtil = false;

  document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => {
    const a = b.dataset.a;
    if (a === 'pot' && p.pot <= 0) { b.disabled = true; return; }
    if (a === 'scout' || a === 'run' || a === 'pot') { b.disabled = false; return; }
    if (D.stunned) {
      if (a === 'atk' || a === 'heavy' || a === 'blk') { b.disabled = true; return; }
      if (a === 'skip') { b.disabled = false; return; }
    } else {
      if (a === 'skip') { b.disabled = true; return; }
    }
    b.disabled = false;
  });
  const label = document.querySelector('.dng-util-label');
  if (label) label.textContent = '1 per turn';
},

/* ══════  LOOT — after combat  ══════ */
_dLoot() {
  this._dClearTooltips();
  const D = this._dng, { C, p } = D;
  D.busy = false;
  const progress = D.fl / (D.totalFloors - 1);
  const lootTable = progress >= 0.5 ? C.lootLate : C.lootEarly;
  const isElite = D.enemy && D.enemy.isElite;
  const numChoices = isElite ? C.eliteLootChoices : 2;
  const pool = [...lootTable].sort(() => Math.random() - 0.5).slice(0, numChoices);
  const btns = document.getElementById('dng-btns');
  if (btns) {
    const phpPct = Math.max(0, p.hp / p.maxHp * 100);
    const hpc = phpPct > 50 ? '#22c55e' : phpPct > 25 ? '#eab308' : '#ef4444';
    btns.className = 'dng-loot-area';
    btns.innerHTML = `<div class="dng-loot-head">${isElite ? '🌟 Elite reward!' : '🎁 Pick a reward'}</div>
      <div class="dng-path-status" style="margin-bottom:10px">
        <span style="color:${hpc}">❤️ ${Math.ceil(p.hp)}/${p.maxHp}</span>
        <span>⚔️ ${Math.floor(p.atk)}</span>
        ${p.pot > 0 ? `<span>💊 ${p.pot}</span>` : ''}
        <span style="color:#fbbf24">🪙 ${D.coins}</span>
      </div>
      <div class="dng-loots">${pool.map((l, i) =>
        `<div class="dng-loot" data-li="${i}"><span class="dng-loot-ico">${l.icon}</span><span class="dng-loot-txt">${l.label}</span></div>`
      ).join('')}</div>`;
  }
  // Hide utils during loot
  const utils = document.getElementById('dng-utils');
  if (utils) utils.style.display = 'none';

  D.log.push(isElite ? '🌟 Elite reward — choose wisely...' : '🎁 Choose a reward...');
  this._dSync();
  document.querySelectorAll('.dng-loot').forEach(el => el.addEventListener('click', () => {
    this._dApplyLoot(pool[parseInt(el.dataset.li)]);
    this.game.soundManager.dungeonLoot();
    D.fl++;
    // After loot: path choice or boss
    if (D.fl >= D.totalFloors) {
      this._dEnd(true, false); // shouldn't happen, boss is last
    } else if (D.rooms[D.fl].type === 'boss') {
      this._dEnterRoom();
    } else {
      this._dPathChoice();
    }
  }));
},

/* ══════  END  ══════ */
_dEnd(victory, died) {
  this._dClearTooltips();
  const D = this._dng, { C, rooms, p } = D, g = this.game;
  const cleared = victory ? D.totalFloors : D.fl;
  g.stats.dungeonBestRooms = Math.max(g.stats.dungeonBestRooms || 0, cleared);
  if (victory) {
    g.stats.dungeonBossesDefeated = (g.stats.dungeonBossesDefeated || 0) + 1;
    g.soundManager.dungeonVictory();
  }

  this._dHideTip();

  const clearPct = D.totalFloors > 0 ? cleared / D.totalFloors : 0;
  const thresholds = C.rewardTierThresholds;
  const tier = clearPct >= thresholds.legendary ? 'legendary'
             : clearPct >= thresholds.epic ? 'epic'
             : clearPct >= thresholds.great ? 'great'
             : clearPct >= thresholds.normal ? 'normal' : null;
  let icon = victory ? '🏆' : cleared >= Math.floor(D.totalFloors * 0.5) ? '⭐' : cleared > 0 ? '🏃' : '💀';
  let title = victory ? 'DUNGEON CONQUERED!' : cleared > 0 ? `Cleared ${cleared}/${D.totalFloors}` : 'Defeated';

  // Convert coins to cookies: coins × max(CPS × multiplier, minPayout)
  let finalCoins = D.coins;
  let penaltyNote = '';
  if (died && !victory) {
    const penalty = Math.floor(finalCoins * 0.5);
    finalCoins -= penalty;
    penaltyNote = `<div class="dng-penalty">💀 Death penalty: -${penalty} 🪙 (50%)</div>`;
  }

  const cps = g.getEffectiveCPS().toNumber();
  const perCoin = Math.max(C.coinMinPayout, Math.floor(cps * C.coinCpsMultiplier));
  const cookiePayout = finalCoins * perCoin;

  // Also give tier bonus via existing reward system
  let tierBonus = 0;
  if (tier) {
    tierBonus = this._giveReward(tier, 'dungeon');
  }
  const totalCookies = cookiePayout + tierBonus;

  if (totalCookies > 0) {
    g.cookies = g.cookies.add(totalCookies);
    g.stats.totalCookiesBaked = g.stats.totalCookiesBaked.add(totalCookies);
    g.updateCookieCount();
  }

  // Build room summary
  const roomSummary = rooms.filter(r => r.resolved).map(r => C.doorIcons[r.type] || '?').join(' ');

  const tierLabel = tier ? { legendary: '🏅 Legendary', epic: '💎 Epic', great: '⭐ Great', normal: '📦 Normal' }[tier] : '';
  const tierHtml = tierLabel ? `<div class="dng-tier-badge dng-tier-${tier}">${tierLabel} Run</div>` : '';

  this._show(`<div class="mini-game-card dungeon-card">
    <div class="dng-head">⚔️ Cookie Dungeon</div>
    <div class="dng-result">
      <div class="dng-r-icon">${icon}</div>
      <div class="dng-r-title">${title}</div>
      ${tierHtml}
      <div class="dng-r-path">${roomSummary}</div>
      <div class="dng-coin-summary">🪙 ${finalCoins} coins${died ? ` <span style="font-size:12px;opacity:0.6">(${D.coins} - ${D.coins - finalCoins} penalty)</span>` : ''}</div>
      ${penaltyNote}
      ${totalCookies > 0 ? `<div class="dng-reward">+${formatNumberInWords(totalCookies)} cookies</div>` : ''}
      ${finalCoins > 0 ? `<div class="dng-coin-rate">${formatNumberInWords(perCoin)} per coin × ${finalCoins}</div>` : ''}
      <div class="dng-r-stats">❤️ ${Math.ceil(p.hp)}/${Math.ceil(p.maxHp)} · ⚔️ ${Math.floor(p.atk)} · Floors ${cleared}/${D.totalFloors}</div>
    </div>
    <div class="dng-btns"><button class="dng-b dng-b-run" id="dng-x">Close</button></div>
  </div>`);
  document.getElementById('dng-x')?.addEventListener('click', () => this._close());
},

/* ── helpers ── */
_dFx(id, cls) {
  const el = document.getElementById(id);
  if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 400);
},
_dSync() {
  const D = this._dng; if (!D.enemy) return;
  // Allow syncing at hp=0 (killing blow), but bail if DOM is gone (screen already changed)
  if (D.enemy.hp <= 0 && !document.getElementById('dng-eb')) return;
  const e = D.enemy, p = D.p;
  const php = Math.max(0, p.hp / p.maxHp * 100), ehp = Math.max(0, e.hp / e.maxHp * 100);
  const hpc = php > 50 ? '#22c55e' : php > 25 ? '#eab308' : '#ef4444';
  const pb = document.getElementById('dng-pb'); if (pb) { pb.style.width = php + '%'; pb.style.background = hpc; }
  const pg = document.getElementById('dng-pg'); if (pg) setTimeout(() => pg.style.width = php + '%', 400);
  const eb = document.getElementById('dng-eb'); if (eb) eb.style.width = ehp + '%';
  const eg = document.getElementById('dng-eg'); if (eg) setTimeout(() => eg.style.width = ehp + '%', 400);
  const pt = document.getElementById('dng-pt'); if (pt) pt.innerHTML = `<b>${Math.ceil(p.hp)}</b>/${Math.ceil(p.maxHp)} HP`;
  const et = document.getElementById('dng-et'); if (et) et.innerHTML = `<b>${Math.ceil(e.hp)}</b>/${e.maxHp} HP`;
  const logEl = document.getElementById('dng-log');
  if (logEl) { const ls = D.log.slice(-2); logEl.innerHTML = ls.map((l, i) => `<div class="dng-ll dng-ll-new" style="opacity:${i === ls.length - 1 ? 1 : 0.4}">${l}</div>`).join(''); }
}

};
