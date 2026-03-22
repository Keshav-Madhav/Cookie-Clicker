import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** DungeonCrawl mixin */
export const DungeonCrawlMixin = {
/* ════════════════════════════════════════════════════════════
   ⚔️  DUNGEON CRAWL v3 — simple, smooth, strategic
   ════════════════════════════════════════════════════════════

   Design:
   - One continuous UI, never full-redraws mid-fight
   - 3 actions: Attack / Block / Potion (limited)
   - Enemy shows INTENT before acting (attack, heavy, rest)
   - Between floors: pick 1 of 2 loot buffs
   - 5 floors: 4 enemies + boss
   - Whole run takes ~3 minutes
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

  const floors = [];
  const usedNames = new Set();
  for (let i = 0; i < C.totalFloors; i++) {
    const isBoss = i === C.totalFloors - 1;
    let base;
    if (isBoss) {
      // Random boss
      base = C.bosses[Math.floor(Math.random() * C.bosses.length)];
    } else {
      // Pick from the tier pool for this floor, avoiding repeats
      const tierIdx = C.floorTiers[Math.min(i, C.floorTiers.length - 1)];
      const pool = C.enemyTiers[tierIdx].filter(e => !usedNames.has(e.name));
      base = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)]
                              : C.enemyTiers[tierIdx][Math.floor(Math.random() * C.enemyTiers[tierIdx].length)];
      usedNames.add(base.name);
    }
    const s = 1 + i * C.depthScale;
    floors.push({ ...base, hp: Math.floor(base.hp * s), atk: Math.floor(base.atk * s),
      maxHp: Math.floor(base.hp * s), isBoss, intent: this._dI(C, null) });
  }

  const mhp = Math.floor(C.baseHp + g.getTotalBuildingCount() * C.hpPerBuilding);
  this._dng = { C, floors, fl: 0, busy: false, log: [],
    scouted: false, stunned: false, earned: 0,
    p: { hp: mhp, maxHp: mhp, atk: Math.min(C.atkCap, C.baseAtk + cps * C.atkCpsScale),
         pot: C.potions, crit: C.critChance, x2: false } };
  this._dR();
},

/** Smart enemy AI — picks intent based on HP context */
_dI(C, enemy) {
  const hpPct = enemy ? enemy.hp / enemy.maxHp : 1;
  const r = Math.random();

  // Can flee? Only below 50% HP, rare
  if (hpPct < C.enemyFleeHpThreshold && r < C.enemyFleeChance) return 'flee';
  // Heal when hurt (below 70%), chance-based
  if (hpPct < 0.7 && Math.random() < C.enemyHealChance) return 'heal';
  // Block sometimes
  if (Math.random() < C.enemyBlockChance) return 'block';
  // Heavy attack (rarer, more likely for bosses)
  const heavyChance = enemy?.isBoss ? C.enemyHeavyChance * 1.5 : C.enemyHeavyChance;
  if (Math.random() < heavyChance) return 'heavy';
  // Default: normal attack
  return 'atk';
},

/* ══════  RENDER  ══════ */
_dR() {
  const D = this._dng, { C, floors, fl, p, log } = D;
  const e = floors[fl];
  const php = Math.max(0, p.hp / p.maxHp * 100);
  const ehp = Math.max(0, e.hp / e.maxHp * 100);
  const hpc = php > 50 ? '#22c55e' : php > 25 ? '#eab308' : '#ef4444';

  const pips = floors.map((f, i) =>
    `<span class="dng-pip${i < fl ? ' done' : i === fl ? ' now' : ''}">${i < fl ? '✓' : f.isBoss ? '👑' : f.emoji}</span>`
  ).join('');

  // Intent display — hidden unless scouted
  const { iTag, iHint } = this._dIntentHtml(e, C, D.scouted);

  const logHtml = log.slice(-2).map((l, i, a) =>
    `<div class="dng-ll" style="opacity:${i === a.length - 1 ? '1' : '0.4'}">${l}</div>`).join('');

  this._show(`<div class="mini-game-card dungeon-card" id="dng-card">
    <div class="dng-head">
      <span>⚔️ Cookie Dungeon</span>
      <span class="dng-earned" id="dng-earned">${D.earned > 0 ? '+' + formatNumberInWords(D.earned) : ''}</span>
      <span class="dng-fl">Floor ${fl + 1}/${floors.length}</span>
      <button class="dng-help-btn" id="dng-help">?</button>
    </div>
    <div class="dng-pips">${pips}</div>

    <div class="dng-field">
      <div class="dng-side" id="dng-ps">
        <div class="dng-avatar" id="dng-pi">🧙</div>
        <div class="dng-hpwrap"><div class="dng-hpbar" id="dng-pb" style="width:${php}%;background:${hpc}"></div><div class="dng-hpghost" id="dng-pg" style="width:${php}%"></div></div>
        <div class="dng-stat" id="dng-pt"><b>${Math.ceil(p.hp)}</b>/${Math.ceil(p.maxHp)} HP</div>
        <div class="dng-stat">${Math.floor(p.atk)} ATK${p.pot > 0 ? ` · 💊${p.pot}` : ''}${p.x2 ? ' · ⚡2×' : ''}</div>
        <div class="dng-float" id="dng-pf"></div>
      </div>

      <div class="dng-center">
        ${iTag}
        ${iHint ? `<div class="dng-hint">${iHint}</div>` : ''}
      </div>

      <div class="dng-side dng-eside" id="dng-es">
        <div class="dng-avatar ${e.isBoss ? 'dng-boss' : ''}" id="dng-ei">${e.emoji}</div>
        <div class="dng-ename">${e.name}</div>
        <div class="dng-hpwrap"><div class="dng-hpbar dng-ehp" id="dng-eb" style="width:${ehp}%"></div><div class="dng-hpghost dng-eghp" id="dng-eg" style="width:${ehp}%"></div></div>
        <div class="dng-stat" id="dng-et"><b>${Math.ceil(e.hp)}</b>/${e.maxHp} HP</div>
        <div class="dng-float" id="dng-ef"></div>
      </div>
    </div>

    <div class="dng-log" id="dng-log">${logHtml}</div>

    <div class="dng-bottom">
      <div class="dng-utils" id="dng-utils">
        <button class="dng-u dng-u-scout" data-a="scout" data-tip="Reveal enemy intent. Costs ${Math.max(1, Math.floor(p.maxHp * C.scoutCost))} HP. Free action.">
          <svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="14" r="8" fill="none" stroke="#a78bfa" stroke-width="1.8"/><circle cx="16" cy="14" r="5" fill="none" stroke="#a78bfa" stroke-width="1"/><circle cx="16" cy="14" r="2" fill="#c4b5fd"/><line x1="22" y1="20" x2="27" y2="27" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="14" r="8" fill="rgba(167,139,250,0.06)"/></svg>
        </button>
        <button class="dng-u dng-u-pot" data-a="pot" ${p.pot <= 0 ? 'disabled' : ''} data-tip="Heal ${Math.floor(p.maxHp * C.potionHeal)} HP (${p.pot} left). Free action.">
          <svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="pg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="transparent"/><stop offset="45%" stop-color="transparent"/><stop offset="45%" stop-color="rgba(74,222,128,0.35)"/><stop offset="100%" stop-color="rgba(34,197,94,0.6)"/></linearGradient></defs><path d="M12 4h8v2h2l1 4-2 18H11L9 10l1-4h2V4z" fill="url(#pg1)" stroke="#4ade80" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 4h8v2H12z" fill="rgba(74,222,128,0.2)" stroke="#4ade80" stroke-width="1.2"/><circle cx="14" cy="20" r="1" fill="#86efac" opacity="0.5"/><circle cx="17" cy="22" r="0.7" fill="#86efac" opacity="0.4"/><circle cx="15" cy="17" r="0.6" fill="#86efac" opacity="0.3"/><line x1="14" y1="8" x2="18" y2="8" stroke="rgba(74,222,128,0.3)" stroke-width="0.8"/></svg>
          ${p.pot > 0 ? `<span class="dng-u-badge">${p.pot}</span>` : ''}
        </button>
        <button class="dng-u dng-u-run" data-a="run" data-tip="Flee and keep earned cookies (${D.earned > 0 ? formatNumberInWords(D.earned) : '0'} so far). Dying = 50% penalty.">
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
    // Custom hover tooltip from data-tip
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

/* ══════  HELP TOOLTIP (floating, not inline)  ══════ */
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
        <div class="dng-tip-item"><span class="dng-tip-key">👁️ Scout</span><span class="dng-tip-desc">Reveal enemy intent. Costs 8% HP.</span></div>
        <div class="dng-tip-item"><span class="dng-tip-key">💊 Potion</span><span class="dng-tip-desc">Heal 35% HP. Limited supply.</span></div>
        <div class="dng-tip-item"><span class="dng-tip-key">🏃 Flee</span><span class="dng-tip-desc">Keep rewards. Dying = 50% penalty.</span></div>
      </div>
      <div class="dng-tip-footer">Enemies attack, block, heal, or flee. <b>Scout</b> to see what's coming!</div>`;
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

/** Build intent display — hidden unless scouted this turn */
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
  const D = this._dng, { C, floors, p } = D, e = floors[D.fl];
  D.busy = true;
  D.scouted = false; // reset scout each turn
  document.querySelectorAll('#dng-btns .dng-b').forEach(b => b.disabled = true);
  const snd = this.game.soundManager;

  // ── FREE ACTIONS (don't consume turn) ──

  if (a === 'run') { D.log.push('🏃 You fled!'); snd.dungeonFlee(); this._dEnd(false, false); return; }

  if (a === 'scout') {
    const cost = Math.max(1, Math.floor(p.maxHp * C.scoutCost));
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
    if (p.pot <= 0) { D.busy = false; return; }
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

  // Skip turn action (used when stunned)
  if (a === 'skip') {
    D.stunned = false;
    D.log.push('💫 Recovering from heavy attack...');
    this._dSync();
    setTimeout(() => this._dEnemyTurn(a), 500 + Math.floor(Math.random() * 500));
    return;
  }

  // If stunned from previous heavy attack, skip player turn
  if (D.stunned) {
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
      if (p.x2) { dmg *= 2; p.x2 = false; }
      const crit = Math.random() < p.crit;
      if (crit) dmg = Math.floor(dmg * C.critMult);
      // Enemy blocking? Reduce player damage
      if (e.intent === 'block') dmg = Math.floor(dmg * C.enemyBlockReduction);
      e.hp = Math.max(0, e.hp - dmg);
      this._dFx('dng-ei', 'dng-hit');
      this._dF('dng-ef', `${dmg}`, crit ? '#fbbf24' : '#fff', crit);
      if (crit) { this._dFx('dng-card', 'dng-shake'); snd.dungeonCrit(); } else { snd.dungeonAttack(); }
      const blkNote = e.intent === 'block' ? ' <span class="dng-dim">(enemy blocked)</span>' : '';
      D.log.push(crit ? `💥 CRIT! <b>${dmg}</b>!${blkNote}` : `⚔️ <b>${dmg}</b> dmg${blkNote}`);

    } else if (a === 'heavy') {
      let dmg = Math.floor(p.atk * C.heavyAtkMult * (0.8 + Math.random() * 0.4));
      if (p.x2) { dmg *= 2; p.x2 = false; }
      if (e.intent === 'block') dmg = Math.floor(dmg * C.enemyBlockReduction);
      e.hp = Math.max(0, e.hp - dmg);
      D.stunned = true; // skip next turn
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
      // Per-floor cookie reward
      const floorReward = Math.floor(e.maxHp * (e.isBoss ? 3 : 1.5));
      D.earned += floorReward;
      D.log.push(`☠️ ${e.name} defeated! <span style="color:#4ade80">+${floorReward}</span>`);
      this._dFx('dng-ei', 'dng-die'); snd.dungeonKill();
      // Update earned display
      const earnedEl = document.getElementById('dng-earned');
      if (earnedEl) earnedEl.textContent = '+' + formatNumberInWords(D.earned);
      this._dSync();
      D.fl++;
      if (D.fl >= floors.length) { setTimeout(() => this._dEnd(true, false), 800); }
      else { setTimeout(() => this._dLoot(), 700); }
      return;
    }

    // ── ENEMY ACTS (500-1000ms delay) ──
    setTimeout(() => this._dEnemyTurn(a), 500 + Math.floor(Math.random() * 500));
  }, 100);
},

/** Enemy turn — extracted so stunned turns can call it directly */
_dEnemyTurn(playerAction) {
  const D = this._dng, { C, floors, p } = D, e = floors[D.fl];
  const snd = this.game.soundManager;
  const intent = e.intent;

  if (intent === 'flee') {
    const fleeReward = Math.floor(e.maxHp * 0.8);
    D.earned += fleeReward;
    D.log.push(`${e.emoji} ${e.name} flees! <span style="color:#4ade80">+${fleeReward}</span>`);
    this._dF('dng-ef', '🏃', '#93c5fd');
    snd.dungeonFlee();
    const earnedEl = document.getElementById('dng-earned');
    if (earnedEl) earnedEl.textContent = '+' + formatNumberInWords(D.earned);
    this._dSync();
    D.fl++;
    if (D.fl >= floors.length) { setTimeout(() => this._dEnd(true, false), 600); }
    else { setTimeout(() => this._dLoot(), 500); }
    return;

  } else if (intent === 'heal') {
    const h = Math.floor(e.maxHp * C.enemyHealAmount);
    e.hp = Math.min(e.maxHp, e.hp + h);
    D.log.push(`${e.emoji} heals <b>${h}</b> HP!`);
    this._dF('dng-ef', `+${h}`, '#4ade80');
    snd.dungeonHeal();

  } else if (intent === 'block') {
    // Block already applied during player's damage calc — just log it
    D.log.push(`${e.emoji} blocked! <span class="dng-dim">(took 50% dmg)</span>`);
    this._dFx('dng-ei', 'dng-def'); snd.dungeonBlock();

  } else {
    // atk or heavy
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

/** Update intent + stats in-place — no full re-render */
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
  // Update stat line
  const stats = document.querySelectorAll('#dng-ps .dng-stat');
  if (stats.length >= 2) stats[1].textContent = `${Math.floor(p.atk)} ATK${p.pot > 0 ? ` · 💊${p.pot}` : ''}${p.x2 ? ' · ⚡2×' : ''}`;
},

/** After a free action (scout/potion), refresh button states */
_dRefreshUtils() {
  const D = this._dng, p = D.p;
  document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => {
    const a = b.dataset.a;
    if (a === 'scout' && D.scouted) b.disabled = true;
    else if (a === 'pot' && p.pot <= 0) b.disabled = true;
    else if (a === 'heavy' && D.stunned) b.disabled = true;
    else b.disabled = false;
  });
  // Update potion label
  const potBtn = document.querySelector('[data-a="pot"]');
  if (potBtn) potBtn.innerHTML = `💊 ${p.pot > 0 ? `(${p.pot})` : '—'}`;
},

/** Re-enable all buttons after enemy turn */
_dEnableBtns() {
  const D = this._dng, p = D.p;
  D.scouted = false;

  document.querySelectorAll('#dng-btns .dng-b, #dng-utils .dng-u').forEach(b => {
    const a = b.dataset.a;
    if (a === 'pot' && p.pot <= 0) { b.disabled = true; return; }
    if (a === 'scout') { b.disabled = false; return; }
    // When stunned: disable atk/heavy/blk, enable skip
    if (D.stunned) {
      if (a === 'atk' || a === 'heavy' || a === 'blk') { b.disabled = true; return; }
      if (a === 'skip') { b.disabled = false; return; }
    } else {
      if (a === 'skip') { b.disabled = true; return; }
    }
    b.disabled = false;
  });
},

/* ══════  LOOT — inline  ══════ */
_dLoot() {
  const D = this._dng, { C, p } = D;
  D.busy = false;
  const pool = [...C.loot].sort(() => Math.random() - 0.5).slice(0, 2);
  const btns = document.getElementById('dng-btns');
  if (btns) {
    btns.className = 'dng-loot-area'; // swap grid layout to loot layout
    btns.innerHTML = `<div class="dng-loot-head">🎁 Pick a reward</div>
      <div class="dng-loots">${pool.map((l, i) =>
        `<div class="dng-loot" data-li="${i}"><span class="dng-loot-ico">${l.icon}</span><span class="dng-loot-txt">${l.label}</span></div>`
      ).join('')}</div>`;
  }
  D.log.push('🎁 Choose a reward...');
  this._dSync();
  document.querySelectorAll('.dng-loot').forEach(el => el.addEventListener('click', () => {
    pool[parseInt(el.dataset.li)].apply(p);
    this.game.soundManager.dungeonLoot();
    this._dR();
  }));
},

/* ══════  END  ══════ */
_dEnd(victory, died) {
  const D = this._dng, { C, floors, p } = D, g = this.game;
  const cleared = victory ? floors.length : D.fl;
  g.stats.dungeonBestRooms = Math.max(g.stats.dungeonBestRooms || 0, cleared);
  if (victory) {
    g.stats.dungeonBossesDefeated = (g.stats.dungeonBossesDefeated || 0) + 1;
    g.soundManager.dungeonVictory();
  }

  // Hide help tooltip if visible
  this._dHideTip();

  const tier = C.rewardTiers[String(cleared)] || (cleared > 0 ? 'normal' : null);
  let icon = victory ? '🏆' : cleared >= 3 ? '⭐' : cleared > 0 ? '🏃' : '💀';
  let title = victory ? 'DUNGEON CONQUERED!' : cleared > 0 ? `Cleared ${cleared}/${floors.length}` : 'Defeated';

  let rewardHtml = '', penaltyNote = '';
  // Floor earnings (always awarded if > 0)
  let totalReward = D.earned;
  if (tier) {
    totalReward += this._giveReward(tier, 'dungeon');
  }
  // Add floor earnings to cookies
  if (D.earned > 0) {
    g.cookies = g.cookies.add(D.earned);
    g.stats.totalCookiesBaked = g.stats.totalCookiesBaked.add(D.earned);
    g.updateCookieCount();
  }
  if (died && !victory) {
    const penalty = Math.floor(totalReward * 0.5);
    g.cookies = g.cookies.sub(penalty);
    totalReward -= penalty;
    penaltyNote = `<div class="dng-penalty">💀 Death penalty: -50% reward</div>`;
  }
  if (totalReward > 0) {
    rewardHtml = `<div class="dng-reward">+${formatNumberInWords(totalReward)} cookies</div>`;
  }

  this._show(`<div class="mini-game-card dungeon-card">
    <div class="dng-head">⚔️ Cookie Dungeon</div>
    <div class="dng-result">
      <div class="dng-r-icon">${icon}</div>
      <div class="dng-r-title">${title}</div>
      ${rewardHtml}${penaltyNote}
      <div class="dng-r-stats">HP: ${Math.ceil(p.hp)}/${Math.ceil(p.maxHp)} · ATK: ${Math.floor(p.atk)} · Best: ${g.stats.dungeonBestRooms}</div>
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
  const D = this._dng; if (D.fl >= D.floors.length) return;
  const e = D.floors[D.fl], p = D.p;
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
