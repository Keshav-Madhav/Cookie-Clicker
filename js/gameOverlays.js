import { formatNumberInWords } from "./utils.js";
import { getBuildingIcon } from "./buildingIcons.js";
import { GRANDMAPOCALYPSE } from "./config.js";
import { CookieNum } from "./cookieNum.js";

export const OverlaysMixin = {
_openDebugPanel() {
  // Achievement + easter egg tip on first open
  this.achievementManager.unlockById('debugger');
  if (this.tutorial) this.tutorial.triggerEvent('debuggerFound');

  const overlay = document.getElementById("debug-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  this.soundManager.debugPanelOpen();
  this._renderDebugPanel();

  // Setup close handlers (once)
  if (!this._debugBound) {
    this._debugBound = true;
    document.getElementById("debug-close").addEventListener("click", () => {
      overlay.classList.add("hidden");
      this.soundManager.panelClose();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) { overlay.classList.add("hidden"); this.soundManager.panelClose(); }
    });
  }
},

_renderDebugPanel() {
  const body = document.getElementById("debug-body");
  if (!body) return;

  const fmt = (v) => (typeof v === 'number' || (v && v.toNumber)) ? formatNumberInWords(v) : v;
  const spendable = this.prestige.getSpendableChips();

  body.innerHTML = `
    <div class="debug-section">
      <h3>Resources</h3>
      <div class="debug-row">
        <label>Cookies</label>
        <input type="number" data-field="cookies" value="${Math.floor(this.cookies.toNumber())}" />
        <button class="debug-set-btn" data-field="cookies">Set</button>
      </div>
      <div class="debug-row">
        <label>CPS Multiplier</label>
        <input type="number" step="0.1" data-field="globalCpsMultiplier" value="${this.globalCpsMultiplier}" />
        <button class="debug-set-btn" data-field="globalCpsMultiplier">Set</button>
      </div>
      <div class="debug-row">
        <label>Cookies/Click</label>
        <input type="number" data-field="cookiesPerClick" value="${this.cookiesPerClick.toNumber()}" />
        <button class="debug-set-btn" data-field="cookiesPerClick">Set</button>
      </div>
    </div>

    <div class="debug-section">
      <h3>Prestige</h3>
      <div class="debug-row">
        <label>Heavenly Chips (total)</label>
        <input type="number" data-field="heavenlyChips" value="${this.prestige.heavenlyChips}" />
        <button class="debug-set-btn" data-field="heavenlyChips">Set</button>
      </div>
      <div class="debug-row">
        <label>Spent Chips</label>
        <input type="number" data-field="spentChips" value="${this.prestige.spentChips}" />
        <button class="debug-set-btn" data-field="spentChips">Set</button>
      </div>
      <div class="debug-row">
        <label>Times Prestiged</label>
        <input type="number" data-field="timesPrestiged" value="${this.prestige.timesPrestiged}" />
        <button class="debug-set-btn" data-field="timesPrestiged">Set</button>
      </div>
    </div>

    <div class="debug-section">
      <h3>Quick Actions</h3>
      <div class="debug-actions">
        <button class="debug-action-btn" data-action="addCookies">+1M Cookies</button>
        <button class="debug-action-btn" data-action="addBillion">+1B Cookies</button>
        <button class="debug-action-btn" data-action="addChips">+100 Chips</button>
        <button class="debug-action-btn" data-action="maxBuildings">Max Buildings</button>
        <button class="debug-action-btn" data-action="unlockAll">Unlock All Upgrades</button>
        <button class="debug-action-btn" data-action="triggerFrenzy">Trigger Frenzy</button>
        <button class="debug-action-btn" data-action="resetSave">Reset Save</button>
      </div>
    </div>

    <div class="debug-section">
      <h3>Grandmapocalypse</h3>
      <div class="debug-info">
        <span>Stage: ${this.grandmapocalypse ? this.grandmapocalypse.stage : 0}</span>
        <span>Research: ${this.grandmapocalypse ? [...this.grandmapocalypse.researchPurchased].join(', ') || 'none' : 'none'}</span>
        <span>Wrinklers: ${this.wrinklerManager ? this.wrinklerManager.getWrinklerCount() : 0}/${GRANDMAPOCALYPSE.maxWrinklers}</span>
        <span>Wrinklers: ${this.wrinklerManager ? this.wrinklerManager.getWrinklerCount() : 0}/${GRANDMAPOCALYPSE.maxWrinklers} (${this.wrinklerManager ? this.wrinklerManager.wrinklers.filter(w => w.elder).length : 0} elder)</span>
        <span>Wrinkler drain: ${this.wrinklerManager ? (() => { let d=0; for(const w of this.wrinklerManager.wrinklers) d += w.elder ? GRANDMAPOCALYPSE.elderWrinklerDrainFraction : GRANDMAPOCALYPSE.wrinklerCpsDrainFraction; return (d*100).toFixed(0); })() : 0}%</span>
        <span>Cookies in wrinklers: ${this.wrinklerManager ? fmt(this.wrinklerManager.getTotalCookiesEaten()) : 0}</span>
        <span>Cookie decay: ${this.grandmapocalypse && this.grandmapocalypse.stage >= 2 ? ((GRANDMAPOCALYPSE.cookieDecay['stage'+this.grandmapocalypse.stage]||0)*100).toFixed(3)+'%/s' : 'none'}</span>
        <span>Pledge active: ${this.grandmapocalypse ? (this.grandmapocalypse.elderPledgeActive ? 'Yes' : 'No') : 'No'}</span>
        <span>Covenant: ${this.grandmapocalypse ? (this.grandmapocalypse.covenantActive ? 'Yes (-'+GRANDMAPOCALYPSE.covenantCpsPenalty*100+'% CPS)' : 'No') : 'No'}</span>
        <span>Wrath cookie chance: ${this.grandmapocalypse ? (this.grandmapocalypse.getWrathCookieProbability() * 100).toFixed(0) : 0}%</span>
      </div>
      <div class="debug-actions" style="margin-top:8px">
        <button class="debug-action-btn" data-action="gpStage1">Set Stage 1</button>
        <button class="debug-action-btn" data-action="gpStage2">Set Stage 2</button>
        <button class="debug-action-btn" data-action="gpStage3">Set Stage 3</button>
        <button class="debug-action-btn" data-action="gpReset">Reset GP</button>
        <button class="debug-action-btn" data-action="spawnWrinkler">+1 Wrinkler</button>
        <button class="debug-action-btn" data-action="spawnShiny">+1 Shiny</button>
        <button class="debug-action-btn" data-action="popAll">Pop All</button>
        <button class="debug-action-btn" data-action="triggerWrath">Trigger Wrath</button>
        <button class="debug-action-btn" data-action="triggerElderFrenzy">Elder Frenzy</button>
      </div>
    </div>

    <div class="debug-section">
      <h3>State</h3>
      <div class="debug-info">
        <span>Effective CPS: ${fmt(this.getEffectiveCPS())}</span>
        <span>Effective CPC: ${fmt(this.getEffectiveCPC())}</span>
        <span>Buildings: ${this.getTotalBuildingCount()}</span>
        <span>Upgrades bought: ${this.upgrades.filter(u => u.level > 0).length}</span>
        <span>Achievements: ${this.achievementManager.getUnlockedCount()}/${this.achievementManager.getTotalCount()}</span>
        <span>Prestige mult: x${this.prestige.getPrestigeMultiplier().toFixed(2)}</span>
        <span>Achievement mult: x${this.achievementManager.getMultiplier().toFixed(2)}</span>
        <span>Chips balance: ${fmt(spendable)}</span>
        <span>Buffs: ${this.activeBuffs.length > 0 ? this.activeBuffs.map(b => b.type + ' x' + b.multiplier).join(', ') : 'none'}</span>
        <span>Wrinklers popped: ${this.stats.wrinklersPopped || 0}</span>
        <span>Wrath clicked: ${this.stats.wrathCookiesClicked || 0}</span>
      </div>
    </div>
  `;

  // Wire up Set buttons
  body.querySelectorAll('.debug-set-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const input = body.querySelector(`input[data-field="${field}"]`);
      const val = parseFloat(input.value);
      if (isNaN(val)) return;

      switch (field) {
        case 'cookies': this.cookies = CookieNum.from(val); break;
        case 'globalCpsMultiplier': this.globalCpsMultiplier = val; break;
        case 'cookiesPerClick': this.cookiesPerClick = CookieNum.from(val); break;
        case 'heavenlyChips': this.prestige.heavenlyChips = val; break;
        case 'spentChips': this.prestige.spentChips = val; break;
        case 'timesPrestiged': this.prestige.timesPrestiged = val; break;
      }

      this.calculateCPS();
      this.updateCookieCount();
      this.updateLeftPanel();
      this.updateUI();
      this.saveGame();
      this._renderDebugPanel();
    });
  });

  // Wire up action buttons
  body.querySelectorAll('.debug-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      this.soundManager.debugAction();
      switch (btn.dataset.action) {
        case 'addCookies':
          this.cookies = this.cookies.add(CookieNum.from(1000000));
          break;
        case 'addChips':
          this.prestige.heavenlyChips += 100;
          break;
        case 'maxBuildings':
          this.buildings.forEach(b => { b.count = 100; b.recalculateCost(); });
          break;
        case 'unlockAll':
          this.upgrades.forEach(u => {
            if (u.level === 0) { u.level = 1; u.applyEffect(); }
          });
          break;
        case 'triggerFrenzy':
          this.startFrenzy('cps', 7, 60);
          break;
        case 'addBillion':
          this.cookies = this.cookies.add(CookieNum.from(1000000000));
          break;
        case 'gpStage1':
        case 'gpStage2':
        case 'gpStage3': {
          if (!this.grandmapocalypse) break;
          const targetStage = btn.dataset.action === 'gpStage1' ? 1 : btn.dataset.action === 'gpStage2' ? 2 : 3;
          // Grant required research
          this.grandmapocalypse.researchPurchased.add('bingoCenter');
          if (targetStage >= 2) this.grandmapocalypse.researchPurchased.add('communalBrainsweep');
          if (targetStage >= 3) this.grandmapocalypse.researchPurchased.add('elderPact');
          this.grandmapocalypse.stage = targetStage;
          this.grandmapocalypse._previousStage = targetStage;
          this.grandmapocalypse._applyResearchBoosts();
          this.grandmapocalypse._onStageChange(targetStage);
          this.calculateCPS();
          this.grandmapocalypse._panelOpen = true;
          const gpEl = document.getElementById("grandmapocalypse-panel");
          if (gpEl) gpEl.classList.add("gp-expanded");
          this.grandmapocalypse._renderResearchPanel();
          break;
        }
        case 'gpReset':
          if (this.grandmapocalypse) {
            this.grandmapocalypse.stage = 0;
            this.grandmapocalypse._previousStage = 0;
            this.grandmapocalypse.researchPurchased.clear();
            this.grandmapocalypse.elderPledgeActive = false;
            this.grandmapocalypse.covenantActive = false;
            this.grandmapocalypse._covenantPenaltyApplied = false;
            this._grandmapocalypseGrandmaBoost = 1;
            this.globalCpsMultiplier = 1;
            this.grandmapocalypse.applyStageTheme(0);
            if (this.wrinklerManager) { this.wrinklerManager.wrinklers = []; this.wrinklerManager._stopSpawning(); }
            this.calculateCPS();
            this.grandmapocalypse._renderResearchPanel();
          }
          break;
        case 'spawnWrinkler':
          if (this.wrinklerManager && this.grandmapocalypse && this.grandmapocalypse.stage >= 1) {
            this.wrinklerManager._spawnWrinkler();
          }
          break;
        case 'spawnShiny':
          if (this.wrinklerManager && this.grandmapocalypse && this.grandmapocalypse.stage >= 1) {
            const orig = GRANDMAPOCALYPSE.shinyWrinklerChance;
            GRANDMAPOCALYPSE.shinyWrinklerChance = 1;
            this.wrinklerManager._spawnWrinkler();
            GRANDMAPOCALYPSE.shinyWrinklerChance = orig;
          }
          break;
        case 'popAll':
          if (this.wrinklerManager) {
            while (this.wrinklerManager.wrinklers.length > 0) {
              this.wrinklerManager.popWrinkler(this.wrinklerManager.wrinklers[0].id);
            }
          }
          break;
        case 'triggerWrath':
          if (this.visualEffects) {
            const el = document.getElementById("golden-cookie");
            if (el) {
              el.dataset.isWrath = "1";
              el.textContent = "🔴";
              el.classList.add("wrath-cookie");
              el.classList.remove("hidden");
              el.classList.add("golden-appear");
            }
          }
          break;
        case 'triggerElderFrenzy':
          this.startFrenzy('cps', 666, 6);
          this.stats.elderFrenzyTriggered = (this.stats.elderFrenzyTriggered || 0) + 1;
          break;
        case 'resetSave':
          if (confirm('Are you sure? This will wipe ALL save data.')) {
            localStorage.removeItem('cookieClickerSave');
            location.reload();
          }
          return;
      }

      this.calculateCPS();
      this.updateCookieCount();
      this.updateLeftPanel();
      this.updateUI();
      this.visualEffects.update();
      this.saveGame();
      this._renderDebugPanel();
    });
  });
},


_openMusicPlayer() {
  const overlay = document.getElementById("music-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  this._renderMusicPlayer();
  if (this._musicPlayerInterval) clearInterval(this._musicPlayerInterval);
  this._musicPlayerInterval = setInterval(() => this._updateMusicPlayerUI(), 250);

  if (!this._musicPlayerBound) {
    this._musicPlayerBound = true;
    const close = () => {
      overlay.classList.add("hidden");
      this.soundManager.panelClose();
      if (this._musicPlayerInterval) { clearInterval(this._musicPlayerInterval); this._musicPlayerInterval = null; }
    };
    document.getElementById("music-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  }
},

_openMinigameSelector() {
  const overlay = document.getElementById("minigame-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  this.soundManager.panelOpen();

  const games = [
    { id: "slots",      emoji: "🎰", name: "Cookie Slots",      desc: "Spin the reels for cookies" },
    { id: "speed",      emoji: "⚡", name: "Speed Click",        desc: "Click as fast as you can" },
    { id: "catch",      emoji: "🍪", name: "Cookie Catch",       desc: "Catch falling cookies" },
    { id: "trivia",     emoji: "🧠", name: "Cookie Trivia",      desc: "Test your cookie knowledge" },
    { id: "memory",     emoji: "🃏", name: "Emoji Memory",       desc: "Match emoji pairs" },
    { id: "cutter",     emoji: "✂️", name: "Cookie Cutter",      desc: "Trace shapes precisely" },
    { id: "defense",    emoji: "🛡️", name: "Cookie Defense",     desc: "Tower defense mini-game" },
    { id: "kitchen",    emoji: "👵", name: "Grandma's Kitchen",  desc: "Bake cookies at the right time" },
    { id: "math",       emoji: "🔢", name: "Math Baker",         desc: "Solve math for cookies" },
    { id: "dungeon",    emoji: "⚔️", name: "Dungeon Crawl",      desc: "Turn-based RPG adventure" },
    { id: "safe",       emoji: "🔐", name: "Safe Cracker",       desc: "Crack the combination lock" },
    { id: "launch",     emoji: "🚀", name: "Cookie Launch",      desc: "Slingshot cookies to the target" },
    { id: "wordle",     emoji: "📝", name: "Cookie Wordle",      desc: "Guess the baking word" },
    { id: "assembly",   emoji: "🧑‍🍳", name: "Cookie Assembly",   desc: "Replicate the target cookie" },
    { id: "alchemy",    emoji: "🧪", name: "Cookie Alchemy",    desc: "Combine ingredients, discover recipes" },
  ];

  const body = document.getElementById("minigame-select-body");
  if (!body) return;
  body.innerHTML = games.map(g =>
    `<button class="minigame-select-btn" data-game="${g.id}">
      <span class="minigame-select-emoji">${g.emoji}</span>
      <div class="minigame-select-info">
        <span class="minigame-select-name">${g.name}</span>
        <span class="minigame-select-desc">${g.desc}</span>
      </div>
    </button>`
  ).join('');

  const mg = this.visualEffects.miniGames;
  const launchMap = {
    slots:   () => mg._slotMachine(),
    speed:   () => mg._speedClick(),
    catch:   () => mg._cookieCatch(),
    trivia:  () => mg._trivia(),
    memory:  () => mg._emojiMemory(),
    cutter:  () => mg._cookieCutter(),
    defense: () => mg._cookieDefense(),
    kitchen: () => mg._grandmasKitchen(),
    math:    () => mg._mathBaker(),
    dungeon: () => mg._dungeonCrawl(),
    safe:    () => mg._safeCracker(),
    launch:  () => mg._cookieLaunch(),
    wordle:  () => mg._cookieWordle(),
    assembly:() => mg._cookieAssembly(),
    alchemy: () => mg._cookieAlchemy(),
  };

  body.querySelectorAll('.minigame-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gameId = btn.dataset.game;
      if (mg._active) return;
      overlay.classList.add("hidden");
      this.soundManager.uiClick();
      if (launchMap[gameId]) launchMap[gameId]();
    });
  });

  if (!this._minigameSelectorBound) {
    this._minigameSelectorBound = true;
    const close = () => {
      overlay.classList.add("hidden");
      this.soundManager.panelClose();
    };
    document.getElementById("minigame-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  }
},

// === Building Synergy Visualizer ===

_openSynergyVisualizer() {
  const overlay = document.getElementById('synergy-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  this.soundManager.panelOpen();

  // Update subtitle
  const synergies = this.upgrades.filter(u => u.type === 'synergy');
  const activeCount = synergies.filter(u => u.level > 0).length;
  const sub = document.getElementById('synergy-subtitle');
  if (sub) sub.textContent = `${activeCount} of ${synergies.length} active · Hover nodes & lines for details`;

  // Legend
  const legend = document.getElementById('synergy-legend');
  if (legend) legend.innerHTML = `<span class="syn-leg-item"><span class="syn-leg-line syn-leg-active"></span> Active</span><span class="syn-leg-item"><span class="syn-leg-line syn-leg-inactive"></span> Locked</span>`;

  this._renderSynergyGraph();

  if (!this._synergyBound) {
    this._synergyBound = true;
    const close = () => {
      overlay.classList.add('hidden');
      this.soundManager.panelClose();
    };
    document.getElementById('synergy-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }
},

_renderSynergyGraph() {
  const svgEl = document.getElementById('synergy-svg');
  const tooltip = document.getElementById('synergy-tooltip');
  if (!svgEl) return;

  // Per-building theme colors
  const bColors = {
    'Cursor': '#00ff88', 'Grandma': '#e8a0c0', 'Farm': '#6abf4b', 'Factory': '#c0c0c0',
    'Mine': '#d4a052', 'Shipment': '#5088cc', 'Alchemy Lab': '#ffd700', 'Portal': '#bf5fff',
    'Time Machine': '#40e0d0', 'Antimatter Condenser': '#ff4060', 'Prism': '#ffe066',
    'Chancemaker': '#ff8040', 'Fractal Engine': '#80ffcc', 'Idleverse': '#a070e0',
    'Cortex Baker': '#ff70a0', 'Reality Bender': '#ffffff',
  };
  const bColor = (name) => bColors[name] || '#f8c471';

  const synergyUpgrades = this.upgrades.filter(u => u.type === 'synergy');
  const synergyMult = this.prestige.getSynergyMultiplier() * this.prestige.getSynergyMultiplier2() * this.prestige.getSynergyMultiplier3();

  // Collect unique building names involved in synergies
  const buildingSet = new Set();
  synergyUpgrades.forEach(u => { buildingSet.add(u.source); buildingSet.add(u.target); });
  const unordered = Array.from(buildingSet);

  // Arrange buildings so connected pairs are NOT adjacent or directly opposite.
  // Greedy placement: for each slot, pick the building that has the fewest
  // synergy connections to already-placed neighbors.
  const edges = new Set();
  synergyUpgrades.forEach(u => { edges.add(u.source + '|' + u.target); edges.add(u.target + '|' + u.source); });
  const connected = (a, b) => edges.has(a + '|' + b);
  const n = unordered.length;
  const half = Math.floor(n / 2);

  // Score: penalize adjacent and opposite positions heavily
  const buildingNames = [];
  const remaining = new Set(unordered);
  // Start with the node that has the most connections (hardest to place)
  const connCount = (name) => synergyUpgrades.filter(u => u.source === name || u.target === name).length;
  const first = unordered.reduce((best, b) => connCount(b) > connCount(best) ? b : best, unordered[0]);
  buildingNames.push(first);
  remaining.delete(first);

  while (remaining.size > 0) {
    let bestName = null, bestScore = Infinity;
    const idx = buildingNames.length; // slot index being filled
    for (const cand of remaining) {
      let score = 0;
      // Penalize if connected to the previous slot (adjacent)
      if (idx > 0 && connected(cand, buildingNames[idx - 1])) score += 10;
      // Penalize if connected to the first slot (will be adjacent when circle closes)
      if (idx === n - 1 && connected(cand, buildingNames[0])) score += 10;
      // Penalize if connected to the node directly opposite (if that slot is filled)
      const oppIdx = (idx + half) % n;
      if (oppIdx < buildingNames.length && connected(cand, buildingNames[oppIdx])) score += 10;
      // Also check if WE would be opposite to an already-placed node
      for (let j = 0; j < buildingNames.length; j++) {
        if (Math.abs(idx - j) === half && connected(cand, buildingNames[j])) score += 10;
      }
      // Slight preference for fewer total connections (spread out hubs)
      score += connCount(cand) * 0.1;
      if (score < bestScore) { bestScore = score; bestName = cand; }
    }
    buildingNames.push(bestName);
    remaining.delete(bestName);
  }

  // Position buildings in a circle — radius scales with node count for spacing
  const nodeR = 30;
  const minGap = nodeR * 3.2; // minimum arc distance between node centers
  const circumNeeded = n * minGap;
  const radius = Math.max(210, circumNeeded / (2 * Math.PI));
  const W = (radius + nodeR + 40) * 2;
  const H = (radius + nodeR + 40) * 2;
  const cx = W / 2, cy = H / 2;
  const nodePositions = {};
  buildingNames.forEach((name, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    nodePositions[name] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  const ns = 'http://www.w3.org/2000/svg';
  svgEl.innerHTML = '';
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Defs: glow filter, arrowhead markers (active + inactive)
  svgEl.innerHTML = `<defs>
    <filter id="syn-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <marker id="syn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="#f8c471" opacity="0.9"/></marker>
    <marker id="syn-arrow-off" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="#666" opacity="0.5"/></marker>
  </defs>`;

  // Show tooltip near cursor (use body-relative positions for reliability)
  const showTip = (e, html) => {
    tooltip.innerHTML = html;
    tooltip.style.opacity = '1';
    const rect = svgEl.closest('.synergy-body').getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
    tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
  };
  const moveTip = (e) => {
    const rect = svgEl.closest('.synergy-body').getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
    tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
  };
  const hideTip = () => { tooltip.style.opacity = '0'; };

  // ── Draw edges: curved bezier lines ──
  synergyUpgrades.forEach(u => {
    const src = nodePositions[u.source];
    const tgt = nodePositions[u.target];
    if (!src || !tgt) return;

    const active = u.level > 0;

    // Cubic bezier: control points pull toward the center of the graph
    const pull = 0.4;
    const cp1x = src.x + (cx - src.x) * pull;
    const cp1y = src.y + (cy - src.y) * pull;
    const cp2x = tgt.x + (cx - tgt.x) * pull;
    const cp2y = tgt.y + (cy - tgt.y) * pull;

    // Place endpoints on circle edge in the direction the curve actually leaves
    // Source: direction toward cp1
    const d1x = cp1x - src.x, d1y = cp1y - src.y;
    const d1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
    const x1 = src.x + (d1x / d1) * nodeR, y1 = src.y + (d1y / d1) * nodeR;
    // Target: direction from cp2 toward target (arrow lands on circle edge)
    const d2x = tgt.x - cp2x, d2y = tgt.y - cp2y;
    const d2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1;
    const x2 = tgt.x - (d2x / d2) * (nodeR + 4), y2 = tgt.y - (d2y / d2) * (nodeR + 4);

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', active ? bColor(u.source) : '#555');
    path.setAttribute('stroke-width', active ? '2.5' : '1.5');
    path.setAttribute('stroke-opacity', active ? '0.8' : '0.35');
    if (!active) path.setAttribute('stroke-dasharray', '8 5');
    path.setAttribute('marker-end', active ? 'url(#syn-arrow)' : 'url(#syn-arrow-off)');
    path.style.cursor = 'pointer';
    path.style.transition = 'stroke-opacity 0.2s, stroke-width 0.2s';

    // Invisible fat hitbox for easier hovering
    const hitbox = document.createElementNS(ns, 'path');
    hitbox.setAttribute('d', `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`);
    hitbox.setAttribute('fill', 'none');
    hitbox.setAttribute('stroke', 'transparent');
    hitbox.setAttribute('stroke-width', '16');
    hitbox.style.cursor = 'pointer';

    const sourceB = this.buildings.find(b => b.name === u.source);
    const targetB = this.buildings.find(b => b.name === u.target);
    const totalCps = (sourceB && targetB && active) ? sourceB.count * u.bonus * u.level * synergyMult * targetB.count : 0;

    const onEnter = (e) => {
      path.setAttribute('stroke-opacity', '1');
      path.setAttribute('stroke-width', active ? '4' : '2.5');
      if (active) path.setAttribute('filter', 'url(#syn-glow)');
      showTip(e, `
        <div style="font-weight:700;color:#f8c471;margin-bottom:4px">${u.name}</div>
        <div style="font-size:11px;color:#d5c4a1">${u.source} → ${u.target}</div>
        <div style="margin-top:6px;display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:11px">
          <span style="color:#a08060">Level</span><span style="font-weight:700">${u.level} / ${u.max_level || '?'}</span>
          <span style="color:#a08060">Bonus</span><span style="font-weight:700">${u.bonus}/source</span>
          <span style="color:#a08060">CPS Added</span><span style="font-weight:700;color:${active ? '#a0d060' : '#888'}">${active ? formatNumberInWords(totalCps) + '/s' : 'Inactive'}</span>
        </div>
        ${!active ? '<div style="margin-top:4px;font-size:10px;color:#e07050">Not yet purchased</div>' : ''}`);
    };
    const onLeave = () => {
      path.setAttribute('stroke-opacity', active ? '0.8' : '0.35');
      path.setAttribute('stroke-width', active ? '2.5' : '1.5');
      path.removeAttribute('filter');
      hideTip();
    };
    hitbox.addEventListener('mouseenter', onEnter);
    hitbox.addEventListener('mousemove', moveTip);
    hitbox.addEventListener('mouseleave', onLeave);

    svgEl.appendChild(path);
    svgEl.appendChild(hitbox);
  });

  // ── Draw building nodes: icon + ring ──
  buildingNames.forEach(name => {
    const pos = nodePositions[name];
    const building = this.buildings.find(b => b.name === name);
    const owned = building && building.count > 0;
    const color = bColor(name);

    const g = document.createElementNS(ns, 'g');
    g.style.cursor = 'pointer';

    // Outer glow ring (owned only)
    if (owned) {
      const glow = document.createElementNS(ns, 'circle');
      glow.setAttribute('cx', pos.x); glow.setAttribute('cy', pos.y);
      glow.setAttribute('r', nodeR + 4);
      glow.setAttribute('fill', 'none'); glow.setAttribute('stroke', color);
      glow.setAttribute('stroke-width', '1.5'); glow.setAttribute('stroke-opacity', '0.3');
      g.appendChild(glow);
    }

    // Background circle
    const bg = document.createElementNS(ns, 'circle');
    bg.setAttribute('cx', pos.x); bg.setAttribute('cy', pos.y);
    bg.setAttribute('r', nodeR);
    bg.setAttribute('fill', owned ? '#1a0e06' : '#120a04');
    bg.setAttribute('stroke', owned ? color : '#444');
    bg.setAttribute('stroke-width', owned ? '2.5' : '1');
    bg.setAttribute('stroke-opacity', owned ? '1' : '0.5');
    g.appendChild(bg);

    // Building icon (canvas → data URL → SVG image)
    try {
      const iconCanvas = getBuildingIcon(name, 36);
      const dataUrl = iconCanvas.toDataURL();
      const img = document.createElementNS(ns, 'image');
      img.setAttribute('href', dataUrl);
      img.setAttribute('x', pos.x - 18); img.setAttribute('y', pos.y - 18);
      img.setAttribute('width', 36); img.setAttribute('height', 36);
      if (!owned) img.setAttribute('opacity', '0.35');
      g.appendChild(img);
    } catch (_) { /* fallback: no icon */ }

    // Name label below
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', pos.x); label.setAttribute('y', pos.y + nodeR + 14);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', owned ? color : '#666');
    label.setAttribute('font-size', '10'); label.setAttribute('font-weight', '600');
    label.setAttribute('font-family', 'system-ui, sans-serif');
    label.textContent = name;
    g.appendChild(label);

    // Count badge (if owned)
    if (owned) {
      const badge = document.createElementNS(ns, 'text');
      badge.setAttribute('x', pos.x); badge.setAttribute('y', pos.y + nodeR + 24);
      badge.setAttribute('text-anchor', 'middle');
      badge.setAttribute('fill', '#a08060'); badge.setAttribute('font-size', '9');
      badge.setAttribute('font-family', 'system-ui, sans-serif');
      badge.textContent = `x${building.count}`;
      g.appendChild(badge);
    }

    // Hover / click
    const cps = building ? building.cps.mul(building.count) : CookieNum.ZERO;
    const relatedSynergies = synergyUpgrades.filter(u => u.source === name || u.target === name);
    g.addEventListener('mouseenter', (e) => {
      bg.setAttribute('stroke-width', '3.5');
      const synLines = relatedSynergies.map(u => {
        const dir = u.source === name ? `→ ${u.target}` : `← ${u.source}`;
        return `<div style="font-size:10px;color:#d5c4a1">${u.level > 0 ? '✅' : '🔒'} ${u.name} (${dir})</div>`;
      }).join('');
      showTip(e, `
        <div style="font-weight:700;color:${color};font-size:14px;margin-bottom:4px">${name}</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:11px;margin-bottom:6px">
          <span style="color:#a08060">Owned</span><span style="font-weight:700">${building ? building.count : 0}</span>
          <span style="color:#a08060">CPS Each</span><span style="font-weight:700">${building ? formatNumberInWords(building.cps) : '0'}/s</span>
          <span style="color:#a08060">Total CPS</span><span style="font-weight:700;color:#a0d060">${formatNumberInWords(cps)}/s</span>
        </div>
        ${synLines ? `<div style="border-top:1px solid rgba(165,120,71,0.3);padding-top:4px;margin-top:2px"><div style="font-size:9px;color:#8b6a4a;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Synergies</div>${synLines}</div>` : ''}`);
    });
    g.addEventListener('mousemove', moveTip);
    g.addEventListener('mouseleave', () => { bg.setAttribute('stroke-width', owned ? '2.5' : '1'); hideTip(); });

    svgEl.appendChild(g);
  });

  // Center label — brighter so it reads clearly
  const activeN = synergyUpgrades.filter(u => u.level > 0).length;
  const centerText = document.createElementNS(ns, 'text');
  centerText.setAttribute('x', cx); centerText.setAttribute('y', cy - 8);
  centerText.setAttribute('text-anchor', 'middle');
  centerText.setAttribute('fill', 'rgba(200,160,240,0.5)'); centerText.setAttribute('font-size', '16');
  centerText.setAttribute('font-weight', '700'); centerText.setAttribute('font-family', 'Georgia, serif');
  centerText.setAttribute('letter-spacing', '2');
  centerText.textContent = 'SYNERGY NETWORK';
  svgEl.appendChild(centerText);
  const centerSub = document.createElementNS(ns, 'text');
  centerSub.setAttribute('x', cx); centerSub.setAttribute('y', cy + 12);
  centerSub.setAttribute('text-anchor', 'middle');
  centerSub.setAttribute('fill', 'rgba(200,160,240,0.35)'); centerSub.setAttribute('font-size', '12');
  centerSub.setAttribute('font-family', 'Georgia, serif');
  centerSub.textContent = `${activeN} of ${synergyUpgrades.length} active`;
  svgEl.appendChild(centerSub);
},

// Newspaper methods are in newspaper.js (mixed in via NewspaperMixin)

_fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
},

_updateMusicPlayerUI() {
  const gm = this.soundManager._gameMusic;
  const name = gm ? gm.getCurrentName() : '';

  // Progress bar
  const nameEl = document.getElementById("music-progress-name");
  const timeEl = document.getElementById("music-progress-time");
  const fillEl = document.getElementById("music-progress-fill");
  if (nameEl) nameEl.textContent = name || 'Nothing playing';
  if (gm && name && gm._playStartTime) {
    const elapsed = gm.getElapsed();
    const total = gm._lastDuration || 30; // guard against 0/undefined
    const pct = Math.min(100, (elapsed / total) * 100);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (timeEl) timeEl.textContent = `${this._fmtTime(elapsed)} / ${this._fmtTime(total)}`;
  } else {
    if (fillEl) fillEl.style.width = '0%';
    if (timeEl) timeEl.textContent = '';
  }

  // Highlight playing track
  document.querySelectorAll('.music-track').forEach(tr => {
    tr.classList.toggle('playing', !!(name && tr.dataset.display === name));
  });
},

_renderMusicPlayer() {
  const body = document.getElementById("music-body");
  if (!body) return;

  const gm = this.soundManager._gameMusic;
  let vol1, vol2, vol3, displayNames;
  if (gm) {
    const C = gm.constructor;
    vol1 = C._VOL1 || [];
    vol2 = C._VOL2 || [];
    vol3 = C._VOL3 || [];
    displayNames = C._DISPLAY_NAMES || {};
  } else {
    body.innerHTML = '<p class="music-hint">Enable music in settings to browse tracks.</p>';
    return;
  }

  const makeTrack = (name, cls) => {
    const display = displayNames[name] || name;
    return `<div class="music-track ${cls}" data-name="${name}" data-display="${display}">
      <span class="music-track-name">${display}</span>
      <button class="music-track-play">Play</button>
    </div>`;
  };

  body.innerHTML = `
    <div class="music-section-label">Volume I</div>
    ${vol1.map(n => makeTrack(n, '')).join('')}
    <div class="music-section-label">Volume II — Grandmapocalypse</div>
    ${vol2.map(n => makeTrack(n, 'dark')).join('')}
    <div class="music-section-label">Volume III</div>
    ${vol3.map(n => makeTrack(n, '')).join('')}
  `;

  // Play buttons — instant swap, auto-resumes after track ends
  body.querySelectorAll('.music-track-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const track = btn.closest('.music-track');
      const name = track.dataset.name;
      this.soundManager._ensureContext();
      if (!this.soundManager._gameMusic) this.soundManager.startMelody();
      const m = this.soundManager._gameMusic;
      if (m) {
        // Cancel start()'s auto-play timer so it doesn't stomp the user's pick
        if (m._timer) { clearTimeout(m._timer); m._timer = null; }
        m.playTrackInstant(name);
        this._updateMusicPlayerUI();
      }
    });
  });

  // Click track row = play
  body.querySelectorAll('.music-track').forEach(track => {
    track.addEventListener('click', () => track.querySelector('.music-track-play').click());
  });

  this._updateMusicPlayerUI();
}

};
