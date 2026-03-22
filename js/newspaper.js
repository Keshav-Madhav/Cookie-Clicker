import { formatNumberInWords } from "./utils.js";
import { CookieNum } from "./cookieNum.js";

/**
 * Newspaper (Cookie Chronicle) mixin methods for the Game class.
 * Applied to Game.prototype via Object.assign in game.js.
 */
export const NewspaperMixin = {
_showChronicleNudge() {
  // Don't show if newspaper or any overlay is already open
  if (document.querySelector('.stats-overlay:not(.hidden)')) return;
  if (document.querySelector('.chronicle-nudge')) return;

  const nudge = document.createElement('div');
  nudge.className = 'chronicle-nudge';
  nudge.innerHTML = `<span class="chronicle-nudge-label">TCC</span><span class="chronicle-nudge-text">Stay up to date with the news</span>`;
  document.body.appendChild(nudge);

  nudge.addEventListener('click', () => {
    nudge.classList.add('chronicle-nudge-exit');
    setTimeout(() => nudge.remove(), 300);
    this._openStatsOverlay();
  });

  setTimeout(() => {
    if (nudge.parentNode) {
      nudge.classList.add('chronicle-nudge-exit');
      setTimeout(() => nudge.remove(), 300);
    }
  }, 4000);
},

// === Statistics Dashboard ===

_openStatsOverlay() {
  // Close the settings menu if it's open
  const menu = document.getElementById("menu-overlay");
  if (menu && !menu.classList.contains("hidden")) {
    menu.classList.add("hidden");
  }

  const overlay = document.getElementById("stats-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  this.soundManager.panelOpen();

  // Dateline
  const dl = document.getElementById("sn-dateline");
  if (dl) {
    const d = new Date();
    dl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      + ` · Est. ${new Date(this.stats.startTime).getFullYear()}`;
  }

  this._snPage = 0;

  // Build page bubble nav (once)
  const paper = overlay.querySelector('.stats-newspaper');
  if (paper && !paper.querySelector('.sn-page-nav')) {
    const pages = ['Front Page', 'Industry', 'Upgrades', 'Entertainment', 'Craft & Skill', 'Adventure', 'Achievements', 'The Dark Side'];
    const nav = document.createElement('div');
    nav.className = 'sn-page-nav';
    const bubbles = [];
    pages.forEach((name, i) => {
      const b = document.createElement('div');
      b.className = 'sn-page-bubble';
      b.textContent = i + 1;
      b.setAttribute('data-label', name);
      b.setAttribute('data-page', i);
      b.addEventListener('click', () => {
        this._snPage = i;
        this._renderStatsPage();
        this.soundManager.uiClick();
      });
      nav.appendChild(b);
      bubbles.push(b);
    });
    paper.appendChild(nav);

    // Dock magnification effect — smooth Gaussian scaling on mousemove
    const baseMargin = 15; // px each side
    const maxScale = 1.5;
    const minScale = 1.0;
    const sigma = 60; // px — spread of the bell curve
    const sigma2x2 = 2 * sigma * sigma;

    const applyDock = (mouseY) => {
      for (const b of bubbles) {
        const rect = b.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(mouseY - center);
        const influence = Math.exp(-(dist * dist) / sigma2x2);
        const scale = minScale + (maxScale - minScale) * influence;
        const margin = baseMargin + 6 * influence;
        b.style.transform = `scale(${scale.toFixed(3)})`;
        b.style.margin = `${margin.toFixed(1)}px 0`;
        b.style.boxShadow = influence > 0.3
          ? `0 ${2 + 3 * influence}px ${6 + 10 * influence}px rgba(0,0,0,${0.15 + 0.2 * influence})`
          : '';
      }
    };

    const resetDock = () => {
      for (const b of bubbles) {
        b.style.transform = '';
        b.style.margin = `${baseMargin}px 0`;
        b.style.boxShadow = '';
      }
    };

    nav.addEventListener('mousemove', (e) => applyDock(e.clientY));
    nav.addEventListener('mouseleave', resetDock);
    // Set initial margins
    resetDock();
  }

  this._renderStatsPage();

  if (!this._statsBound) {
    this._statsBound = true;

    document.getElementById("sn-prev").addEventListener("click", () => {
      if (this._snPage > 0) { this._snPage--; this._renderStatsPage(); this.soundManager.uiClick(); }
    });
    document.getElementById("sn-next").addEventListener("click", () => {
      if (this._snPage < this._snTotalPages() - 1) { this._snPage++; this._renderStatsPage(); this.soundManager.uiClick(); }
    });

    const close = () => { overlay.classList.add("hidden"); this.soundManager.panelClose(); };
    document.getElementById("stats-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  }
},

_snTotalPages() { return 8; },

_renderStatsPage() {
  const body = document.getElementById("sn-body");
  if (!body) return;

  const total = this._snTotalPages();
  const pages = ['Front Page', 'Industry', 'Upgrades', 'Entertainment', 'Craft & Skill', 'Adventure', 'Achievements', 'The Dark Side'];
  const label = document.getElementById("sn-page-label");
  label.innerHTML = `<span class="sn-page-name">${pages[this._snPage]}</span><span class="sn-page-num">${this._snPage + 1} / ${total}</span>`;
  document.getElementById("sn-prev").disabled = this._snPage === 0;
  document.getElementById("sn-next").disabled = this._snPage >= total - 1;

  // Update bubble nav active state
  const bubbles = document.querySelectorAll('.sn-page-bubble');
  bubbles.forEach(b => {
    b.classList.toggle('sn-bubble-active', parseInt(b.dataset.page) === this._snPage);
  });

  // Determine transition
  const prev = this._snPrevPage;
  const cur = this._snPage;
  const isJump = prev !== undefined && prev !== cur && Math.abs(cur - prev) > 1;
  const direction = prev !== undefined && prev !== cur
    ? (cur > prev ? 'next' : 'prev')
    : null;
  this._snPrevPage = this._snPage;

  // Cancel any in-progress rapid-flip sequence
  if (this._snFlipTimer) { clearTimeout(this._snFlipTimer); this._snFlipTimer = null; }

  const fmt = (v) => {
    if (v && typeof v === 'object' && v.toNumber) return formatNumberInWords(v);
    if (typeof v === 'number') return formatNumberInWords(v);
    return v;
  };

  if (isJump) {
    // Rapid-flip: show each intermediate page briefly, then land on target
    const steps = Math.abs(cur - prev);
    const stepDir = cur > prev ? 1 : -1;
    const flipDuration = Math.min(120, 400 / steps); // faster for bigger jumps
    let step = 0;

    const flipNext = () => {
      const intermediate = prev + stepDir * (step + 1);
      const isLast = step === steps - 1;

      // Render intermediate (or final) page
      this._snRenderPage(body, fmt, isLast ? cur : intermediate);
      body.scrollTop = 0;

      // Animate slide
      const cls = stepDir > 0 ? 'sn-page-next' : 'sn-page-prev';
      body.classList.remove('sn-page-next', 'sn-page-prev');
      void body.offsetWidth;
      body.classList.add(cls);

      step++;
      if (!isLast) {
        this._snFlipTimer = setTimeout(flipNext, flipDuration);
      } else {
        this._snFlipTimer = null;
        body.addEventListener('animationend', () => {
          body.classList.remove('sn-page-next', 'sn-page-prev');
        }, { once: true });
      }
    };
    flipNext();
  } else {
    // Single page turn
    this._snRenderPage(body, fmt, cur);
    body.scrollTop = 0;

    if (direction) {
      const cls = direction === 'next' ? 'sn-page-next' : 'sn-page-prev';
      body.classList.remove('sn-page-next', 'sn-page-prev');
      void body.offsetWidth;
      body.classList.add(cls);
      body.addEventListener('animationend', () => {
        body.classList.remove('sn-page-next', 'sn-page-prev');
      }, { once: true });
    }
  }
},

_snRenderPage(body, fmt, page) {
  switch (page) {
    case 0: this._renderFrontPage(body, fmt); break;
    case 1: this._renderIndustryPage(body, fmt); break;
    case 2: this._renderUpgradesPage(body, fmt); break;
    case 3: this._renderEntertainmentPage(body, fmt); break;
    case 4: this._renderCraftSkillPage(body, fmt); break;
    case 5: this._renderAdventurePage(body, fmt); break;
    case 6: this._renderAchievementsPage(body, fmt); break;
    case 7: this._renderDarkSidePage(body, fmt); break;
  }
},

_renderFrontPage(body, fmt) {
  const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
  const mins = Math.floor(elapsed / 60); const hrs = Math.floor(mins / 60); const days = Math.floor(hrs / 24);
  let timeStr;
  if (days > 0) timeStr = `${days} days, ${hrs % 24} hours`;
  else if (hrs > 0) timeStr = `${hrs} hours, ${mins % 60} minutes`;
  else timeStr = `${mins} minutes`;
  const shortTime = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;

  const totalClicks = this.stats.totalClicks || 0;
  const avgPerClick = totalClicks > 0 ? fmt(this.stats.handmadeCookies.div(totalClicks)) : '0';
  const cps = fmt(this.getEffectiveCPS());
  const cpc = fmt(this.getEffectiveCPC());

  body.innerHTML = `
    <div class="sn-article sn-lead">
      <h2 class="sn-headline">Empire Reaches ${fmt(this.stats.totalCookiesBaked)} Cookies</h2>
      <p class="sn-byline">By Our Cookie Correspondent · ${timeStr} of operation</p>
      <p class="sn-body-text">The bakery empire has now produced a staggering <strong>${fmt(this.stats.totalCookiesBaked)}</strong> cookies since its founding, officials confirmed today. Current output stands at <strong>${cps}</strong> cookies per second, with <strong>${cpc}</strong> per click.</p>
    </div>
    <div class="sn-rule sn-rule-heavy"></div>
    <div class="sn-stat-grid">
      <div class="sn-stat-card"><span class="sn-stat-card-val">${fmt(this.stats.totalCookiesBaked)}</span><span class="sn-stat-card-label">Total Baked</span></div>
      <div class="sn-stat-card"><span class="sn-stat-card-val">${fmt(this.stats.handmadeCookies)}</span><span class="sn-stat-card-label">By Hand</span></div>
      <div class="sn-stat-card"><span class="sn-stat-card-val">${fmt(totalClicks)}</span><span class="sn-stat-card-label">Clicks</span></div>
      <div class="sn-stat-card"><span class="sn-stat-card-val">${this.getTotalBuildingCount()}</span><span class="sn-stat-card-label">Buildings</span></div>
      <div class="sn-stat-card"><span class="sn-stat-card-val">${this.stats.luckyClicks}</span><span class="sn-stat-card-label">Lucky Clicks</span></div>
      <div class="sn-stat-card"><span class="sn-stat-card-val">${this.stats.frenziesTriggered}</span><span class="sn-stat-card-label">Frenzies</span></div>
      <div class="sn-stat-card"><span class="sn-stat-card-val">${this.stats.totalUpgradesPurchased || 0}</span><span class="sn-stat-card-label">Upgrades</span></div>
      <div class="sn-stat-card"><span class="sn-stat-card-val">${shortTime}</span><span class="sn-stat-card-label">Session</span></div>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">By the Numbers</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${avgPerClick}</span><span class="sn-fact-label">Avg. per Click</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.goldenCookiesClicked)}</span><span class="sn-fact-label">Golden Cookies</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.miniGamesPlayed || 0)}</span><span class="sn-fact-label">Games Played</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${(this.luckyClickChance * 100).toFixed(1)}%</span><span class="sn-fact-label">Luck Chance</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Market Report</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${this.stats.timesPrestiged}</span><span class="sn-fact-label">Times Ascended</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrinklersPopped || 0)}</span><span class="sn-fact-label">Wrinklers Popped</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${this.achievementManager.getUnlockedCount()}/${this.achievementManager.getTotalCount()}</span><span class="sn-fact-label">Achievements</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.prestige.heavenlyChips || 0)}</span><span class="sn-fact-label">Heavenly Chips</span></div>
        </div>
      </div>
    </div>`;
},

_renderIndustryPage(body, fmt) {
  const owned = this.buildings.filter(b => b.count > 0);

  // Sum raw building CPS for accurate percentages
  let rawTotalCps = CookieNum.ZERO;
  owned.forEach(b => { rawTotalCps = rawTotalCps.add(b.cps.mul(b.count)); });
  const rawTotalNum = rawTotalCps.toNumber();

  // Top producer for headline
  let topName = 'None', topCps = CookieNum.ZERO;
  owned.forEach(b => { const t = b.cps.mul(b.count); if (t.gt(topCps)) { topCps = t; topName = b.name; } });

  const rows = owned.map(b => {
    const bTotalCps = b.cps.mul(b.count);
    const pct = rawTotalNum > 0 ? ((bTotalCps.toNumber() / rawTotalNum) * 100).toFixed(1) : '0.0';
    const barW = rawTotalNum > 0 ? Math.max(2, (bTotalCps.toNumber() / rawTotalNum) * 100) : 0;
    return `<div class="sn-building-row">
      <span class="sn-b-name"><strong>${b.name}</strong> <span class="sn-b-dim">x${b.count}</span></span>
      <div class="sn-b-bar-track"><div class="sn-b-bar-fill" style="width:${barW}%"></div></div>
      <span class="sn-b-val">${pct}%</span>
    </div>`;
  }).join('');

  // Most efficient building (highest CPS per unit cost)
  let bestEffName = '—', bestEffVal = 0;
  owned.forEach(b => {
    const eff = b.cps.toNumber() / Math.max(1, b.baseCost.toNumber());
    if (eff > bestEffVal) { bestEffVal = eff; bestEffName = b.name; }
  });

  // Newest building (highest index with count > 0)
  const newest = [...owned].reverse()[0];
  const totalOwned = this.getTotalBuildingCount();

  body.innerHTML = `
    <div class="sn-article sn-lead">
      <h2 class="sn-headline">${topName} Leads Production at ${fmt(topCps)}/s</h2>
      <p class="sn-byline">Industry Desk · ${owned.length} of ${this.buildings.length} sectors active</p>
      <p class="sn-body-text">The bakery's ${owned.length} active divisions generated a combined <strong>${fmt(rawTotalCps)}</strong> base cookies per second today. Multipliers push effective output to <strong>${fmt(this.getEffectiveCPS())}</strong>/s.</p>
    </div>
    <div class="sn-rule sn-rule-heavy"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Overview</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${totalOwned}</span><span class="sn-fact-label">Total Buildings</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${owned.length}/${this.buildings.length}</span><span class="sn-fact-label">Types Unlocked</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(rawTotalCps)}/s</span><span class="sn-fact-label">Base Output</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Highlights</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${topName}</span><span class="sn-fact-label">Top Producer</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${bestEffName}</span><span class="sn-fact-label">Most Efficient</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${newest ? newest.name : '—'}</span><span class="sn-fact-label">Latest Sector</span></div>
        </div>
      </div>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-article">
      <h3 class="sn-subhead">Production Share by Division</h3>
      <div class="sn-building-list">${rows || '<p class="sn-body-text" style="color:#8b5e34;font-style:italic">No divisions operational yet.</p>'}</div>
    </div>`;
},

_renderUpgradesPage(body, fmt) {
  const purchased = this.upgrades.filter(u => u.level > 0);
  const total = this.upgrades.length;
  const maxed = this.upgrades.filter(u => {
    if (u.type === 'tieredUpgrade') return u.level > 0 && u.currentTier >= (u.tiers || []).length - 1;
    return u.level >= u.getEffectiveMaxLevel();
  }).length;

  // Categorize
  const clickUpgrades = purchased.filter(u => u.type === 'clickMultiplier' || (u.type === 'tieredUpgrade' && u.subtype === 'clickMultiplier'));
  const synergyUpgrades = purchased.filter(u => u.type === 'synergy');
  const otherUpgrades = purchased.filter(u => !clickUpgrades.includes(u) && !synergyUpgrades.includes(u));

  // Global multiplier breakdown
  const globalMult = this.globalCpsMultiplier;
  const achMult = this.achievementManager.getMultiplier();
  const prestMult = this.prestige.getPrestigeMultiplier();

  body.innerHTML = `
    <div class="sn-article sn-lead">
      <h2 class="sn-headline">${purchased.length} Upgrades Purchased of ${total}</h2>
      <p class="sn-byline">Technology Desk · ${maxed} fully maxed</p>
      <p class="sn-body-text">The bakery's research division reports <strong>${purchased.length}</strong> active upgrades powering current production. Combined multipliers have reached extraordinary levels.</p>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Multipliers</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">x${globalMult.toFixed(2)}</span><span class="sn-fact-label">Global CPS</span></div>
          <div class="sn-fact"><span class="sn-fact-num">x${achMult.toFixed(2)}</span><span class="sn-fact-label">Achievement</span></div>
          <div class="sn-fact"><span class="sn-fact-num">x${prestMult.toFixed(2)}</span><span class="sn-fact-label">Prestige</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">By Category</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${clickUpgrades.length}</span><span class="sn-fact-label">Click Power</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${synergyUpgrades.length}</span><span class="sn-fact-label">Synergies</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${otherUpgrades.length}</span><span class="sn-fact-label">Other</span></div>
        </div>
      </div>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Combined Power</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">x${(globalMult * achMult * prestMult).toFixed(2)}</span><span class="sn-fact-label">Total Multiplier</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.getEffectiveCPS())}/s</span><span class="sn-fact-label">Effective CPS</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.getEffectiveCPC())}</span><span class="sn-fact-label">Per Click</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Heavenly</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.prestige.heavenlyChips || 0)}</span><span class="sn-fact-label">Chips Earned</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${this.prestige.getHeavenlyUpgradeCount ? this.prestige.getHeavenlyUpgradeCount() : 0}</span><span class="sn-fact-label">Heavenly Upgrades</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${maxed}/${total}</span><span class="sn-fact-label">Maxed Out</span></div>
        </div>
      </div>
    </div>`;
},

/** Helper: render a single minigame stat row for the newspaper */
_renderGameRow(name, label, extraStats = []) {
  const pg = (this.stats.perGame || {})[name] || { played: 0, wins: 0, totalReward: 0, bestReward: 0 };
  const winRate = pg.played > 0 ? ((pg.wins / pg.played) * 100).toFixed(0) : '—';
  const extras = extraStats.map(s => `<span class="sn-gr-extra">${s}</span>`).join('');
  return `<div class="sn-game-row">
    <div class="sn-gr-head"><span class="sn-gr-name">${label}</span></div>
    <div class="sn-gr-stats">
      <span class="sn-gr-stat"><strong>${pg.played}</strong> played</span>
      <span class="sn-gr-stat"><strong>${pg.wins}</strong> wins</span>
      <span class="sn-gr-stat"><strong>${winRate}%</strong> rate</span>
      <span class="sn-gr-stat"><strong>${formatNumberInWords(pg.bestReward)}</strong> best</span>
      <span class="sn-gr-stat"><strong>${formatNumberInWords(pg.totalReward)}</strong> earned</span>
      ${extras}
    </div>
  </div>`;
},

_renderEntertainmentPage(body, fmt) {
  const wonList = this.stats.miniGamesWon || [];
  const played = this.stats.miniGamesPlayed || 0;
  const pg = this.stats.perGame || {};
  const totalWins = Object.values(pg).reduce((s, g) => s + (g.wins || 0), 0);
  const winRate = played > 0 ? ((totalWins / played) * 100).toFixed(0) : '0';
  const totalEarned = Object.values(pg).reduce((s, g) => s + (g.totalReward || 0), 0);

  body.innerHTML = `
    <div class="sn-article sn-lead">
      <h2 class="sn-headline">Mini-Games: ${fmt(played)} Rounds Played</h2>
      <p class="sn-byline">Entertainment Desk · Arcade & Classics</p>
      <p class="sn-body-text">The bakery's recreational department reports <strong>${fmt(played)}</strong> total games across 15 categories, earning <strong>${fmt(totalEarned)}</strong> cookies. Overall win rate stands at <strong>${winRate}%</strong>.</p>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Overall Records</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${wonList.length}/15</span><span class="sn-fact-label">Unique Games Won</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(totalWins)}</span><span class="sn-fact-label">Total Victories</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(totalEarned)}</span><span class="sn-fact-label">Total Earned</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Highlights</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.slotsJackpots || 0)}</span><span class="sn-fact-label">Slot Jackpots</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${(this.stats.cutterBestAccuracy || 0).toFixed(0)}%</span><span class="sn-fact-label">Best Cutter Accuracy</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${this.stats.kitchenBestStreak || 0}</span><span class="sn-fact-label">Kitchen Best Streak</span></div>
        </div>
      </div>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-article">
      <h3 class="sn-subhead">Arcade Games — Per-Game Breakdown</h3>
      <div class="sn-game-list">
        ${this._renderGameRow('slots', 'Slot Machine', [`<strong>${fmt(this.stats.slotsJackpots || 0)}</strong> jackpots`])}
        ${this._renderGameRow('speed', 'Speed Click')}
        ${this._renderGameRow('catch', 'Cookie Catch')}
        ${this._renderGameRow('trivia', 'Trivia')}
        ${this._renderGameRow('memory', 'Emoji Memory')}
      </div>
    </div>`;
},

_renderCraftSkillPage(body, fmt) {
  body.innerHTML = `
    <div class="sn-article sn-lead">
      <h2 class="sn-headline">Craft & Skill Report</h2>
      <p class="sn-byline">Entertainment Desk · Precision & Strategy</p>
      <p class="sn-body-text">The bakery's skill-based programs test precision, timing, and strategic thinking. Here is a detailed performance report for each activity.</p>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-article">
      <div class="sn-game-list">
        ${this._renderGameRow('cookieCutter', 'Cookie Cutter', [`<strong>${(this.stats.cutterBestAccuracy || 0).toFixed(0)}%</strong> best accuracy`])}
        ${this._renderGameRow('cookieDefense', 'Cookie Defense')}
        ${this._renderGameRow('grandmasKitchen', "Grandma's Kitchen", [`<strong>${this.stats.kitchenBestStreak || 0}</strong> best streak`])}
        ${this._renderGameRow('mathBaker', 'Math Baker')}
        ${this._renderGameRow('cookieAssembly', 'Cookie Assembly')}
      </div>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Cutter Division</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${(this.stats.cutterBestAccuracy || 0).toFixed(0)}%</span><span class="sn-fact-label">All-Time Best</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${((this.stats.perGame || {}).cookieCutter || {}).played || 0}</span><span class="sn-fact-label">Total Attempts</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Kitchen Division</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${this.stats.kitchenBestStreak || 0}</span><span class="sn-fact-label">Perfect Streak</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${((this.stats.perGame || {}).grandmasKitchen || {}).played || 0}</span><span class="sn-fact-label">Total Sessions</span></div>
        </div>
      </div>
    </div>`;
},

_renderAdventurePage(body, fmt) {
  const dungeonRuns = this.stats.dungeonRuns || 0;
  const dungeonBosses = this.stats.dungeonBossesDefeated || 0;
  const dungeonBest = this.stats.dungeonBestRooms || 0;
  const alchDisc = (this.stats.alchemyDiscovered || []).length;
  const alchResets = this.stats.alchemyResets || 0;
  const alchMerges = this.stats.alchemyTotalMerges || 0;
  const alchBest = this.stats.alchemyBestSession || 0;
  const alchPerfect = this.stats.alchemyPerfectSessions || 0;

  body.innerHTML = `
    <div class="sn-article sn-lead">
      <h2 class="sn-headline">Adventure & Exploration</h2>
      <p class="sn-byline">Entertainment Desk · Dungeon, Alchemy & More</p>
      <p class="sn-body-text">From the depths of the Cookie Dungeon to the mysteries of Cookie Alchemy, adventurers have pushed the boundaries of what bakery employees can achieve.</p>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-article">
      <div class="sn-game-list">
        ${this._renderGameRow('dungeon', 'Dungeon Crawl', [`<strong>${dungeonBest}</strong> best depth`, `<strong>${dungeonBosses}</strong> bosses`])}
        ${this._renderGameRow('safeCracker', 'Safe Cracker')}
        ${this._renderGameRow('cookieLaunch', 'Cookie Launch')}
        ${this._renderGameRow('cookieWordle', 'Cookie Wordle')}
        ${this._renderGameRow('cookieAlchemy', 'Cookie Alchemy', [`<strong>${alchDisc}</strong> discovered`, `<strong>${alchResets}</strong> masteries`])}
      </div>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Dungeon Report</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${dungeonRuns}</span><span class="sn-fact-label">Total Runs</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${dungeonBosses}</span><span class="sn-fact-label">Bosses Slain</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${dungeonBest}</span><span class="sn-fact-label">Deepest Floor</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Alchemy Lab</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${alchDisc}</span><span class="sn-fact-label">Elements Found</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${alchMerges}</span><span class="sn-fact-label">Total Merges</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${alchResets}</span><span class="sn-fact-label">Masteries</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${alchBest}</span><span class="sn-fact-label">Best Session</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${alchPerfect}</span><span class="sn-fact-label">Perfect Sessions</span></div>
        </div>
      </div>
    </div>`;
},

_renderAchievementsPage(body, fmt) {
  const am = this.achievementManager;
  const unlocked = am.getUnlockedCount();
  const total = am.getTotalCount();
  const pct = total > 0 ? ((unlocked / total) * 100).toFixed(0) : '0';
  const mult = am.getMultiplier();
  const allAch = am.achievements || [];

  // Group achievements by type for newspaper sections
  const typeLabels = {
    totalCookies: 'Cookie Milestones', cps: 'Production Records',
    totalClicks: 'Clicking Feats', totalBuildings: 'Empire Expansion',
    allBuildingTypes: 'Empire Expansion', buildingCount: 'Building Specialists',
    totalUpgradesPurchased: 'Research & Development',
    timesPrestiged: 'Ascension', heavenlyChips: 'Heavenly Chips',
    heavenlyUpgradesPurchased: 'Heavenly Shop',
    luckyClicks: 'Luck & Fortune', frenziesTriggered: 'Frenzy Records',
    sessionPrestiges: 'Session Feats', speedrunner: 'Speed Records', bulkBuyer: 'Bulk Orders',
    miniGamesWon: 'Mini-Games', miniGamesPlayed: 'Mini-Games',
    cutterPerfect: 'Mini-Games', kitchenPerfectStreak: 'Mini-Games',
    slotsJackpot: 'Mini-Games', gameWins: 'Mini-Games',
    dungeonBestRooms: 'Mini-Games', dungeonBossesDefeated: 'Mini-Games',
    alchemyDiscovered: 'Mini-Games', alchemyMastery: 'Mini-Games',
    goldenCookiesClicked: 'Golden Cookies',
    manual: 'Secret', special: 'Special Reports',
    grandmapocalypseStage: 'Grandmapocalypse', elderPledge: 'Elder Affairs',
    elderCovenant: 'Elder Affairs',
    wrinklersFed: 'Wrinkler Watch', wrinklersPopped: 'Wrinkler Watch',
    wrinklersMaxed: 'Wrinkler Watch', wrinklerShiny: 'Wrinkler Watch',
    wrathCookiesClicked: 'Wrath Cookies', wrathClotSurvived: 'Wrath Cookies',
    elderFrenzyTriggered: 'Wrath Cookies', wrinklerBigPop: 'Wrinkler Watch',
  };
  const groups = {};
  for (const a of allAch) {
    const label = typeLabels[a.type] || a.type || 'Special Reports';
    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  }

  let sectionsHtml = '';
  for (const [label, achs] of Object.entries(groups)) {
    const groupUnlocked = achs.filter(a => a.unlocked).length;
    const rows = achs.map(a => {
      const isUnlocked = a.unlocked;
      const dateStr = a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `<div class="sn-achv-item ${isUnlocked ? 'sn-achv-unlocked' : 'sn-achv-locked'}" title="${a.desc}">
        <span class="sn-achv-icon">${isUnlocked ? '&#10003;' : '&mdash;'}</span>
        <div class="sn-achv-info">
          <span class="sn-achv-name">${isUnlocked ? a.name : '???'}</span>
          <span class="sn-achv-desc">${a.desc}</span>
        </div>
        <span class="sn-achv-date">${isUnlocked ? (dateStr || '✓') : '—'}</span>
      </div>`;
    }).join('');

    sectionsHtml += `
      <div class="sn-achv-section">
        <div class="sn-achv-section-head">
          <span class="sn-achv-section-title">${label}</span>
          <span class="sn-achv-section-count">${groupUnlocked}/${achs.length}</span>
        </div>
        ${rows}
      </div>`;
  }

  body.innerHTML = `
    <div class="sn-achv-page">
      <div class="sn-achv-header">
        <div class="sn-article sn-lead">
          <h2 class="sn-headline">${unlocked} of ${total} Achievements Unlocked</h2>
          <p class="sn-byline">Honors & Awards Section</p>
          <p class="sn-body-text">The bakery has earned <strong>${pct}%</strong> of all possible achievements, providing a <strong>x${mult.toFixed(2)}</strong> production multiplier. ${total - unlocked > 0 ? `${total - unlocked} achievements remain hidden, waiting to be discovered.` : 'All achievements unlocked — legendary status achieved!'}</p>
        </div>
        <div class="sn-rule"></div>
        <div class="sn-ach-bar-wrap">
          <div class="sn-ach-bar"><div class="sn-ach-bar-fill" style="width:${pct}%"></div></div>
          <span class="sn-ach-bar-label">${pct}% Complete</span>
        </div>
        <div class="sn-rule"></div>
      </div>
      <div class="sn-achv-scroll">
        ${sectionsHtml}
      </div>
    </div>`;
},

_renderDarkSidePage(body, fmt) {
  const stage = this.grandmapocalypse ? this.grandmapocalypse.stage : 0;
  const stageNames = ['Dormant — The grandmas are content. For now.', 'Displeased — They whisper. They watch.', 'Angered — The baking has taken a dark turn.', 'Awoken — They have transcended. Cookie production is eternal suffering.'];
  const stageLine = stageNames[stage] || `Stage ${stage}`;

  body.innerHTML = `
    <div class="sn-article sn-lead sn-dark-lead">
      <h2 class="sn-headline">The Grandmapocalypse: Stage ${stage}</h2>
      <p class="sn-byline">Investigative Report · Classified</p>
      <p class="sn-body-text"><em>${stageLine}</em></p>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Wrinkler Activity</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrinklersFed || 0)}</span><span class="sn-fact-label">Fed</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrinklersPopped || 0)}</span><span class="sn-fact-label">Popped</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.shinyWrinklersPopped || 0)}</span><span class="sn-fact-label">Shiny Popped</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Elder Affairs</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.elderPledgesUsed || 0)}</span><span class="sn-fact-label">Pledges Used</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.elderFrenzyTriggered || 0)}</span><span class="sn-fact-label">Elder Frenzies</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrathCookiesClicked || 0)}</span><span class="sn-fact-label">Wrath Cookies</span></div>
        </div>
      </div>
    </div>
    <div class="sn-rule"></div>
    <div class="sn-two-col">
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Wrath Report</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrathClotSurvived || 0)}</span><span class="sn-fact-label">Clots Survived</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${fmt(this.stats.wrinklerBigPop || 0)}</span><span class="sn-fact-label">Big Pops</span></div>
        </div>
      </div>
      <div class="sn-col-divider"></div>
      <div class="sn-article sn-col-article">
        <h3 class="sn-subhead">Current Status</h3>
        <div class="sn-fact-list">
          <div class="sn-fact"><span class="sn-fact-num">${this.wrinklerManager ? this.wrinklerManager.getWrinklerCount() : 0}</span><span class="sn-fact-label">Active Wrinklers</span></div>
          <div class="sn-fact"><span class="sn-fact-num">${this.grandmapocalypse && this.grandmapocalypse.covenantActive ? 'Yes' : 'No'}</span><span class="sn-fact-label">Covenant Active</span></div>
        </div>
      </div>
    </div>`;
}
};
