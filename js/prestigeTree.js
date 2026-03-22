import { heavenlyUpgrades } from "./gameData.js";
import { formatNumberInWords } from "./utils.js";

// ── Layout constants ────────────────────────────────────────
const NODE_W = 148, NODE_H = 56, NODE_RX = 10;
const COL = 195, ROW = 130, PAD_X = 80, PAD_Y = 55;
const SVG_NS = "http://www.w3.org/2000/svg";

// ── Physics tuning ──────────────────────────────────────────
const EDGE_K     = 0.8;    // spring along edges (keeps graph shape)
const DAMPING    = 0.78;   // velocity decay per frame — heavy friction
const MAX_VEL    = 60;     // hard velocity cap per axis
const SETTLE_K   = 45;     // home spring when resetting
const CLICK_MS   = 250;    // max ms for a click (vs drag)
const CLICK_PX   = 6;      // max px movement for a click

// Collision — hard overlaps resolved positionally, soft zone via gentle force
const MARGIN     = 14;     // soft repulsion buffer around nodes
const SOFT_K     = 1.5;    // gentle push per px of margin overlap

// ── Hand-tuned node positions (col, row) ────────────────────
const LAYOUT = {
  // NEW roots
  firstLight:[0,0], quickFingers:[15,0],
  // Existing roots
  heavenlyCookies:[2,0], twinGates:[4.5,0], heavenlyLuck:[7,0], angels:[9.5,0],
  // NEW tier 1.5
  gameTalent:[0,1], nimbleClicks:[15,1], touchOfGold:[5.5,1], idleAngels:[12.5,1],
  // Existing tier 2
  starterKit:[1,1], persistentMemory:[3,1], divineDiscount:[4.5,1],
  goldenWindfall:[7,1], seasonSavings:[9,1], divineBakeries:[11,1],
  // NEW tier 2 gap-fillers
  gameExpert:[0,2], goldenGlow:[5.5,2], idleEmpire:[14,2], clickStorm:[15,2],
  // Existing tier 2.5
  cookieStockpile:[1,2], practicedHands:[4.5,2], risingDough:[7.5,2],
  kittenWorkers:[9,2], timelessBaking:[10.5,2], synergyVol2:[12,2],
  // NEW tier 3
  idleMastery:[14,3],
  // Existing
  divineGranaries:[1,3], goldenEmpire:[7,3], cosmicGrandma:[9,3],
  hcInterest:[10.5,3], frenzyOverload:[12,3],
  ascendantBakers:[9.5,4], compoundWealth:[11,4], elderKnowledge:[13.5,4],
  luckyStars:[8,5], goldenAge:[9.5,5], realityArchitect:[11,5], wrinklerWhisperer:[13.5,5],
  infiniteWisdom:[7.5,6], heavenlyClicking:[9,6], cosmicResonance:[10.5,6], grandmasForgiveness:[13.5,6],
  // NEW tier 4+
  clickNirvana:[15,7],
  // Existing
  wisdomEternal:[6,7], divinePersistence:[7.5,7], eternalDominion:[9,7],
  astralClicking:[10.5,7], cosmicHarvest:[12,7],
  // NEW tier 4+
  gameMastery:[0,8],
  // Existing
  soulMemory:[6,8], medalCabinet:[7.5,8], frenzyMastery:[9,8],
  cosmicSynergy:[10.5,8], cookieSingularity:[12,8],
  omniscientBaking:[7,9], ascendantFrenzies:[8.5,9], eternityRising:[10,9], celestialSynergy:[12,9],
  cookieOmnipotence:[11,10],
};

// ── Category accent colours ─────────────────────────────────
const CAT = {
  starter:  { ids: new Set(["heavenlyCookies","starterKit","cookieStockpile","divineGranaries",
    "persistentMemory","divinePersistence","soulMemory"]), color: "#60a5fa" },
  economy:  { ids: new Set(["twinGates","divineDiscount","practicedHands"]), color: "#fbbf24" },
  golden:   { ids: new Set(["heavenlyLuck","goldenWindfall","goldenEmpire"]), color: "#f59e0b" },
  grandma:  { ids: new Set(["elderKnowledge","wrinklerWhisperer","grandmasForgiveness"]), color: "#f87171" },
  click:    { ids: new Set(["heavenlyClicking","astralClicking","quickFingers","nimbleClicks","clickStorm","clickNirvana"]), color: "#38bdf8" },
  idle:     { ids: new Set(["idleAngels","idleEmpire","idleMastery"]), color: "#34d399" },
  minigame: { ids: new Set(["gameTalent","gameExpert","gameMastery"]), color: "#fb923c" },
  frenzy:   { ids: new Set(["frenzyOverload","frenzyMastery","ascendantFrenzies"]), color: "#c084fc" },
  synergy:  { ids: new Set(["synergyVol2","cosmicSynergy","celestialSynergy"]), color: "#a78bfa" },
};
function catColor(id) {
  for (const c of Object.values(CAT)) if (c.ids.has(id)) return c.color;
  return "#a78bfa";
}

// Pre-compute home positions
const HOME = {};
for (const [id, [c, r]] of Object.entries(LAYOUT)) {
  HOME[id] = { x: c * COL + PAD_X, y: r * ROW + PAD_Y };
}

const TIERS = [
  { row: 0, label: "Tier 1" }, { row: 1, label: "Tier 2" },
  { row: 2, label: "Tier 3" }, { row: 4, label: "Tier 4" },
  { row: 7, label: "Tier 5" }, { row: 9, label: "Tier 6" },
];

// ═════════════════════════════════════════════════════════════
export class PrestigeTree {
  constructor(game) {
    this.game = game;
    this._svg = null;
    this._viewG = null;
    this._tooltip = null;
    this._container = null;

    // Pan / zoom
    this._pan = { x: 0, y: 0 };
    this._zoom = 1;
    this._zoomTarget = 1;    // animated zoom lerps toward this
    this._panTarget = null;  // { x, y } or null (animated pan for fit-to-view)
    this._panning = null;    // { sx, sy, px, py }

    // Physics
    this._phys = new Map();  // id → { x, y, vx, vy, homeX, homeY }
    this._grabbed = null;    // id of node being dragged
    this._grabOff = { x: 0, y: 0 };
    this._grabStart = { x: 0, y: 0, t: 0 };
    this._settling = false;

    // Render refs
    this._nodes = new Map(); // id → { g, inner, rect, costEl, nameEl, accent }
    this._edgeData = [];     // [{ pid, cid, path }]
    this._tierEls = [];      // [{ textEl, lineEl, row }]

    // Animation
    this._raf = 0;
    this._lastT = 0;
    this._starCanvas = null;
    this._starCtx = null;
    this._stars = [];
    this._shootingStars = [];
    this._nextShoot = 0;
    this._tutorialTimer = 0;

    this._boundMove = null;
    this._boundUp = null;
    this._progressEl = null;
  }

  // ── Public API ────────────────────────────────────────────

  render(container) {
    this._container = container;
    container.innerHTML = "";
    container.classList.add("prestige-tree-container");

    this._initStarData(container);
    this._buildSvg();
    this._initPhysics();

    container.appendChild(this._svg);
    this._createTooltip(container);
    this._createControls(container);
    this._bindEvents();

    this._lastT = performance.now();
    this._raf = requestAnimationFrame(t => this._loop(t));
    requestAnimationFrame(() => this._fitToView());

    // Tutorial: show tips on first-ever open
    if (!this.game._ptTutorialDone) {
      this.game._ptTutorialDone = true;
      this._showTutorial(container);
    }
  }

  _showTutorial(ctr) {
    const tips = [
      { icon: "🖱️", text: "Scroll to zoom, drag to pan" },
      { icon: "✋", text: "Drag nodes to rearrange — physics!" },
      { icon: "🍪", text: "Click glowing nodes to buy" },
    ];

    const toast = document.createElement("div");
    toast.className = "pt-toast";
    ctr.appendChild(toast);

    let current = 0;
    const show = () => {
      if (current >= tips.length) {
        toast.classList.add("pt-toast--fade");
        setTimeout(() => toast.remove(), 400);
        return;
      }
      const tip = tips[current];
      toast.classList.remove("pt-toast--fade");
      toast.innerHTML = `
        <span class="pt-toast-icon">${tip.icon}</span>
        <span class="pt-toast-text">${tip.text}</span>
        <span class="pt-toast-dots">${tips.map((_, i) => i === current ? "●" : "○").join("")}</span>
        <button class="pt-toast-next">${current < tips.length - 1 ? "Next" : "OK"}</button>
        <button class="pt-toast-skip">Skip</button>
      `;
      toast.querySelector(".pt-toast-next").addEventListener("click", () => { current++; show(); });
      toast.querySelector(".pt-toast-skip").addEventListener("click", () => { current = tips.length; show(); });
    };
    show();

    // Auto-advance after 6s if user ignores
    this._tutorialTimer = setInterval(() => {
      current++;
      if (current >= tips.length) { clearInterval(this._tutorialTimer); this._tutorialTimer = 0; }
      show();
    }, 6000);
    // Stop auto on any interaction
    toast.addEventListener("click", () => { clearInterval(this._tutorialTimer); this._tutorialTimer = 0; });
  }

  refresh() {
    if (!this._svg) return;
    const pr = this.game.prestige;
    const chips = pr.getSpendableChips();

    for (const u of heavenlyUpgrades) {
      const n = this._nodes.get(u.id);
      if (!n) continue;
      const owned = pr.hasUpgrade(u.id);
      const buy   = pr.canBuyUpgrade(u.id);
      const met   = !u.requires?.length || u.requires.every(r => pr.hasUpgrade(r));
      const broke = !owned && !buy && met && chips < u.cost;

      n.rect.setAttribute("class", rectCls(owned, buy, met, broke));
      n.accent.setAttribute("opacity", owned ? "0.95" : met ? "0.55" : "0.18");
      n.nameEl.setAttribute("class", "pt-name" + (owned ? " pt-name--owned" : ""));
      n.g.style.cursor = buy ? "pointer" : "default";

      if (owned) {
        n.costEl.textContent = "\u2713 Owned";
        n.costEl.setAttribute("class", "pt-cost pt-cost--owned");
      } else {
        n.costEl.textContent = "\uD83C\uDF6A " + formatNumberInWords(u.cost);
        n.costEl.setAttribute("class", "pt-cost");
      }
    }

    for (const { pid, cid, path } of this._edgeData) {
      const po = pr.hasUpgrade(pid), co = pr.hasUpgrade(cid), cb = pr.canBuyUpgrade(cid);
      path.setAttribute("class", "pt-edge" +
        (po && co ? " pt-edge--owned" : po && cb ? " pt-edge--active" : " pt-edge--dim"));
    }

    this._updateProgress();
  }

  destroy() {
    if (this._boundMove) window.removeEventListener("mousemove", this._boundMove);
    if (this._boundUp)   window.removeEventListener("mouseup", this._boundUp);
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._tutorialTimer) clearInterval(this._tutorialTimer);
    this._nodes.clear();
    this._phys.clear();
    this._edgeData = [];
    this._svg = this._viewG = this._tooltip = this._container = null;
  }

  // ── SVG construction ──────────────────────────────────────

  _buildSvg() {
    this._svg = mkSvg("svg", { width: "100%", height: "100%", class: "pt-svg" });

    const defs = mkSvg("defs");
    const clip = mkSvg("clipPath", { id: "pt-node-clip" });
    clip.appendChild(mkSvg("rect", {
      x: -NODE_W / 2, y: -NODE_H / 2, width: NODE_W, height: NODE_H, rx: NODE_RX,
    }));
    defs.appendChild(clip);
    this._svg.appendChild(defs);

    this._viewG = mkSvg("g");
    this._svg.appendChild(this._viewG);

    this._drawTiers();
    this._drawEdges();
    this._drawNodes();
  }

  _drawTiers() {
    const g = mkSvg("g", { class: "pt-tiers" });
    for (const { row, label } of TIERS) {
      const y = row * ROW + PAD_Y - NODE_H / 2 - 14;
      const t = mkSvg("text", { x: PAD_X - 55, y: y + 10, class: "pt-tier-label", "text-anchor": "end" });
      t.textContent = label;
      g.appendChild(t);
      const line = mkSvg("line", {
        x1: PAD_X - 35, y1: y + 4, x2: 16 * COL + PAD_X, y2: y + 4, class: "pt-tier-line",
      });
      g.appendChild(line);
      this._tierEls.push({ textEl: t, lineEl: line, row });
    }
    this._viewG.appendChild(g);
  }

  _drawEdges() {
    const g = mkSvg("g", { class: "pt-edges" });
    const pr = this.game.prestige;

    for (const u of heavenlyUpgrades) {
      if (!u.requires) continue;
      for (const pid of u.requires) {
        const p1 = HOME[pid], p2 = HOME[u.id];
        if (!p1 || !p2) continue;

        const d = bezier(p1.x, p1.y, p2.x, p2.y);
        const po = pr.hasUpgrade(pid), co = pr.hasUpgrade(u.id), cb = pr.canBuyUpgrade(u.id);
        const cls = "pt-edge" + (po && co ? " pt-edge--owned" : po && cb ? " pt-edge--active" : " pt-edge--dim");

        const path = mkSvg("path", { d, class: cls });
        g.appendChild(path);
        this._edgeData.push({ pid, cid: u.id, path });
      }
    }
    this._viewG.appendChild(g);
  }

  _drawNodes() {
    const g = mkSvg("g", { class: "pt-nodes" });
    const pr = this.game.prestige;
    const chips = pr.getSpendableChips();

    for (const u of heavenlyUpgrades) {
      const h = HOME[u.id];
      if (!h) continue;
      const owned = pr.hasUpgrade(u.id);
      const buy   = pr.canBuyUpgrade(u.id);
      const met   = !u.requires?.length || u.requires.every(r => pr.hasUpgrade(r));
      const broke = !owned && !buy && met && chips < u.cost;

      const ng = mkSvg("g", { transform: `translate(${h.x},${h.y})`, "data-id": u.id, class: "pt-node" });
      ng.style.cursor = buy ? "pointer" : "default";

      const inner = mkSvg("g", { class: "pt-node-inner" });

      const rect = mkSvg("rect", {
        x: -NODE_W / 2, y: -NODE_H / 2, width: NODE_W, height: NODE_H, rx: NODE_RX,
        class: rectCls(owned, buy, met, broke),
      });
      inner.appendChild(rect);

      const acClip = mkSvg("g", { "clip-path": "url(#pt-node-clip)" });
      const accent = mkSvg("rect", {
        x: -NODE_W / 2, y: -NODE_H / 2, width: NODE_W, height: 4,
        fill: catColor(u.id), opacity: owned ? 0.95 : met ? 0.55 : 0.18,
      });
      acClip.appendChild(accent);
      inner.appendChild(acClip);

      const nameEl = mkSvg("text", {
        x: 0, y: -6, "text-anchor": "middle",
        class: "pt-name" + (owned ? " pt-name--owned" : ""),
      });
      nameEl.textContent = u.name.length > 17 ? u.name.slice(0, 16) + "\u2026" : u.name;
      inner.appendChild(nameEl);

      const costEl = mkSvg("text", {
        x: 0, y: 14, "text-anchor": "middle",
        class: owned ? "pt-cost pt-cost--owned" : "pt-cost",
      });
      costEl.textContent = owned ? "\u2713 Owned" : "\uD83C\uDF6A " + formatNumberInWords(u.cost);
      inner.appendChild(costEl);

      ng.appendChild(inner);

      // Tooltip events
      ng.addEventListener("mouseenter", e => this._showTip(u, e));
      ng.addEventListener("mousemove", e => this._moveTip(e));
      ng.addEventListener("mouseleave", () => this._hideTip());

      // Node drag starts here (not on SVG)
      ng.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        e.stopPropagation(); // prevent pan
        const sv = this._mouseToSvg(e);
        const p = this._phys.get(u.id);
        this._grabbed = u.id;
        this._grabOff = { x: sv.x - p.x, y: sv.y - p.y };
        this._grabStart = { x: e.clientX, y: e.clientY, t: performance.now() };
        this._svg.style.cursor = "grabbing";
      });

      g.appendChild(ng);
      this._nodes.set(u.id, { g: ng, inner, rect, costEl, nameEl, accent });
    }
    this._viewG.appendChild(g);
  }

  // ── Physics ───────────────────────────────────────────────

  _initPhysics() {
    // Restore saved positions if user moved nodes in a previous session
    const saved = this.game._ptPhysCache;
    if (saved) {
      for (const [id, s] of Object.entries(saved)) {
        const h = HOME[id];
        if (!h) continue;
        this._phys.set(id, { x: s.x, y: s.y, vx: 0, vy: 0, homeX: h.x, homeY: h.y });
      }
      // Fill any new nodes not in cache
      for (const id of Object.keys(LAYOUT)) {
        if (!this._phys.has(id)) {
          const h = HOME[id];
          this._phys.set(id, { x: h.x, y: h.y, vx: 0, vy: 0, homeX: h.x, homeY: h.y });
        }
      }
      this._nodesMoved = true;
    } else {
      for (const id of Object.keys(LAYOUT)) {
        const h = HOME[id];
        this._phys.set(id, { x: h.x, y: h.y, vx: 0, vy: 0, homeX: h.x, homeY: h.y });
      }
      this._nodesMoved = false;
    }
  }

  _savePhysics() {
    const data = {};
    for (const [id, p] of this._phys) {
      data[id] = { x: p.x, y: p.y };
    }
    this.game._ptPhysCache = data;
  }

  _physicsTick(dt) {
    const ids = [...this._phys.keys()];
    const nhw = NODE_W / 2, nhh = NODE_H / 2;
    const mhw = nhw + MARGIN, mhh = nhh + MARGIN;

    // ── 1. Edge springs (gentle, keeps graph shape) ─────────
    for (const { pid, cid } of this._edgeData) {
      const a = this._phys.get(pid), b = this._phys.get(cid);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const rest = Math.hypot(b.homeX - a.homeX, b.homeY - a.homeY);
      const diff = dist - rest;
      const fx = (dx / dist) * diff * EDGE_K * dt;
      const fy = (dy / dist) * diff * EDGE_K * dt;
      if (pid !== this._grabbed) { a.vx += fx; a.vy += fy; }
      if (cid !== this._grabbed) { b.vx -= fx; b.vy -= fy; }
    }

    // ── 2. Hard overlap: positional resolution (no velocity) ─
    //    Directly separate overlapping rects along min axis.
    //    Multiple passes to resolve chains.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < ids.length; i++) {
        const a = this._phys.get(ids[i]);
        const aGrab = ids[i] === this._grabbed;
        for (let j = i + 1; j < ids.length; j++) {
          const b = this._phys.get(ids[j]);
          const bGrab = ids[j] === this._grabbed;
          if (aGrab && bGrab) continue;

          const dx = b.x - a.x, dy = b.y - a.y;
          const ox = nhw + nhw - Math.abs(dx);
          const oy = nhh + nhh - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue; // no overlap

          // Push along axis of least penetration
          if (ox < oy) {
            const half = ox * 0.52; // slightly over half to clear
            const sign = dx >= 0 ? 1 : -1;
            if (aGrab)      { b.x += sign * ox; }
            else if (bGrab) { a.x -= sign * ox; }
            else            { a.x -= sign * half; b.x += sign * half; }
          } else {
            const half = oy * 0.52;
            const sign = dy >= 0 ? 1 : -1;
            if (aGrab)      { b.y += sign * oy; }
            else if (bGrab) { a.y -= sign * oy; }
            else            { a.y -= sign * half; b.y += sign * half; }
          }
        }
      }
    }

    // ── 3. Soft margin repulsion (gentle velocity nudge) ────
    for (let i = 0; i < ids.length; i++) {
      const a = this._phys.get(ids[i]);
      for (let j = i + 1; j < ids.length; j++) {
        const b = this._phys.get(ids[j]);
        const dx = b.x - a.x, dy = b.y - a.y;
        const ox = mhw + mhw - Math.abs(dx);
        const oy = mhh + mhh - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue; // outside margin zone

        // Already resolved hard overlaps above, so this is just the soft buffer
        const hardOx = nhw + nhw - Math.abs(dx);
        const hardOy = nhh + nhh - Math.abs(dy);
        if (hardOx > 0 && hardOy > 0) continue; // still hard-overlapping, skip force

        if (ox < oy) {
          const f = (dx >= 0 ? 1 : -1) * ox * SOFT_K * dt;
          if (ids[i] !== this._grabbed) a.vx -= f;
          if (ids[j] !== this._grabbed) b.vx += f;
        } else {
          const f = (dy >= 0 ? 1 : -1) * oy * SOFT_K * dt;
          if (ids[i] !== this._grabbed) a.vy -= f;
          if (ids[j] !== this._grabbed) b.vy += f;
        }
      }
    }

    // ── 4. Home spring (only during reset) ──────────────────
    if (this._settling) {
      for (const [id, p] of this._phys) {
        if (id === this._grabbed) continue;
        p.vx += (p.homeX - p.x) * SETTLE_K * dt;
        p.vy += (p.homeY - p.y) * SETTLE_K * dt;
      }
    }

    // ── 5. Damping + velocity cap + integrate ───────────────
    for (const [id, p] of this._phys) {
      if (id === this._grabbed) { p.vx = 0; p.vy = 0; continue; }
      p.vx *= DAMPING;
      p.vy *= DAMPING;
      // Hard velocity cap prevents explosion
      p.vx = clamp(p.vx, -MAX_VEL, MAX_VEL);
      p.vy = clamp(p.vy, -MAX_VEL, MAX_VEL);
      p.x += p.vx;
      p.y += p.vy;
    }

    // ── 6. Auto-stop settling ───────────────────────────────
    if (this._settling) {
      let maxD = 0;
      for (const p of this._phys.values()) {
        maxD = Math.max(maxD, Math.abs(p.x - p.homeX), Math.abs(p.y - p.homeY));
      }
      if (maxD < 0.5) {
        this._settling = false;
        for (const p of this._phys.values()) {
          p.x = p.homeX; p.y = p.homeY; p.vx = 0; p.vy = 0;
        }
      }
    }
  }

  _syncPositions() {
    for (const [id, n] of this._nodes) {
      const p = this._phys.get(id);
      if (!p) continue;
      n.g.setAttribute("transform", `translate(${p.x},${p.y})`);
    }
    for (const { pid, cid, path } of this._edgeData) {
      const a = this._phys.get(pid), b = this._phys.get(cid);
      if (!a || !b) continue;
      path.setAttribute("d", bezier(a.x, a.y, b.x, b.y));
    }
  }

  _resetLayout() {
    this._settling = true;
    // Give a little kick for visual flair
    for (const p of this._phys.values()) {
      p.vx += (Math.random() - 0.5) * 2;
      p.vy += (Math.random() - 0.5) * 2;
    }
  }

  // ── Animation loop (physics + starfield) ──────────────────

  _loop(t) {
    const dt = clamp((t - this._lastT) / 1000, 0.001, 0.05);
    this._lastT = t;

    this._physicsTick(dt);
    this._syncPositions();
    this._animateZoom();
    this._drawStars(t);

    this._raf = requestAnimationFrame(t2 => this._loop(t2));
  }

  // ── Space background ─────────────────────────────────────

  _initStarData(ctr) {
    const cvs = document.createElement("canvas");
    cvs.className = "pt-stars-canvas";
    ctr.appendChild(cvs);
    this._starCanvas = cvs;
    this._starCtx = cvs.getContext("2d");
    this._starDpr = Math.min(window.devicePixelRatio || 1, 2);

    // ── Pre-render nebula texture (noise-based, once) ───────
    this._nebTex = null;
    this._nebW = 0; this._nebH = 0;

    // ── Pre-render static sprites (cached on game object across opens) ──
    const cache = this.game._ptSpriteCache || (this.game._ptSpriteCache = {});
    if (!cache.spike) {
      cache.spike = this._renderSpikeSprite();
      cache.bh = this._renderBlackHole();
      cache.planet1 = this._renderPlanet(120, [35, 45, 80], -0.7);
      cache.planet2 = this._renderPlanet(70, [70, 40, 30], 0.5);
      cache.planet3 = this._renderPlanet(90, [50, 70, 50], -1.2);
      cache.planet4 = this._renderPlanet(80, [80, 60, 90], 0.8);
      cache.galaxy = this._renderGalaxy();
      cache.cookiePlanet = this._renderCookiePlanet();
      cache.cookieCrumb = this._renderCookieCrumb();
      cache.ringed = this._renderRingedPlanet();
      cache.donut = this._renderDonutPlanet();
      cache.squircle = this._renderSquirclePlanet();
      cache.cookieMoon = this._renderCookieMoon();
    }
    this._spikeSprite = cache.spike;
    this._bhSprite = cache.bh;
    this._planetSprite = cache.planet1;
    this._planet2Sprite = cache.planet2;
    this._planet3Sprite = cache.planet3;
    this._planet4Sprite = cache.planet4;
    this._galaxySprite = cache.galaxy;
    this._cookiePlanetSprite = cache.cookiePlanet;
    this._cookieCrumbSprite = cache.cookieCrumb;
    this._ringedSprite = cache.ringed;
    this._donutSprite = cache.donut;
    this._squircleSprite = cache.squircle;
    this._cookieMoonSprite = cache.cookieMoon;

    // ── Scene data (cached so it persists across open/close) ──
    const sceneCache = this.game._ptSceneCache;
    if (sceneCache) {
      this._milkyWay = sceneCache.milkyWay;
      this._crumbs = sceneCache.crumbs;
      this._stars = sceneCache.stars;
      this._bodies = sceneCache.bodies;
      this._shootingStars = [];
      this._nextShoot = 2000 + Math.random() * 4000;
      return; // skip re-generating all the random data
    }

    // ── "Milky Way" band — dense, flowing, with sine-wave displacement ──
    this._milkyWay = [];
    for (let i = 0; i < 500; i++) {
      const along = Math.random();
      const spread = (Math.random() - 0.5);
      const isCore = Math.abs(spread) < 0.2;
      const isBright = Math.abs(spread) < 0.08;
      this._milkyWay.push({
        x: along,
        spread,
        phase: Math.random() * Math.PI * 2,
        r: isBright ? (0.5 + Math.random() * 1.2) : isCore ? (0.3 + Math.random() * 0.6) : (0.2 + Math.random() * 0.4),
        a: isBright ? (0.15 + Math.random() * 0.2) : isCore ? (0.06 + Math.random() * 0.1) : (0.02 + Math.random() * 0.05),
        hue: 25 + Math.random() * 25,
        sat: 50 + Math.random() * 35,
        lum: isBright ? (65 + Math.random() * 25) : isCore ? (50 + Math.random() * 20) : (35 + Math.random() * 20),
      });
    }

    // ── Floating cookie crumbs (scattered across space) ─────
    this._crumbs = [];
    for (let i = 0; i < 35; i++) {
      this._crumbs.push({
        x: Math.random(), y: Math.random(),
        sz: 0.008 + Math.random() * 0.015,
        rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 0.0003,
        drift: { x: (Math.random() - 0.5) * 0.0002, y: (Math.random() - 0.5) * 0.0002 },
        a: 0.2 + Math.random() * 0.35,
        prlx: 0.02 + Math.random() * 0.04,
      });
    }

    // ── Star layers ─────────────────────────────────────────
    this._stars = [];
    for (let i = 0; i < 140; i++) {  // far dust
      this._stars.push({ x: Math.random(), y: Math.random(), r: 0.3 + Math.random() * 0.5,
        base: 0.07 + Math.random() * 0.15, freq: 0.15 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2, drift: 0.0004 + Math.random() * 0.0015,
        hue: Math.random() < 0.35 ? 210 + Math.random() * 70 : 0, layer: 0, prlx: 0.006 });
    }
    for (let i = 0; i < 55; i++) {  // mid
      this._stars.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.1,
        base: 0.18 + Math.random() * 0.35, freq: 0.3 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2, drift: 0.0015 + Math.random() * 0.005,
        hue: Math.random() < 0.3 ? 250 + Math.random() * 50 : 0, layer: 1, prlx: 0.025 });
    }
    for (let i = 0; i < 12; i++) {  // near bright
      this._stars.push({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 1.8,
        base: 0.4 + Math.random() * 0.4, freq: 0.5 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2, drift: 0.004 + Math.random() * 0.01,
        hue: [0, 220, 270, 320, 45, 200][Math.floor(Math.random() * 6)],
        layer: 2, prlx: 0.06 });
    }

    this._shootingStars = [];
    this._nextShoot = 2000 + Math.random() * 4000;

    // ── Scattered celestial bodies (wide area, visible on zoom-out) ──
    const BX0 = -4000, BY0 = -4000, BW = 11000, BH = 9500;
    this._bodies = [];
    // Weighted types: cookies are most common
    const bodyTypes = [
      "cookie","cookie","cookie","cookieMoon","cookieMoon",
      "blue","blue","green","purple",
      "mars","mars",
      "ringed","ringed",
      "donut","squircle","squircle",
      "galaxy","galaxy",
    ];
    for (let i = 0; i < 90; i++) {
      const type = bodyTypes[Math.floor(Math.random() * bodyTypes.length)];
      let sz;
      switch (type) {
        case "galaxy":     sz = 50 + Math.random() * 100; break;
        case "ringed":     sz = 60 + Math.random() * 120; break;
        case "donut":      sz = 40 + Math.random() * 80; break;
        case "squircle":   sz = 35 + Math.random() * 70; break;
        case "cookie":     sz = 40 + Math.random() * 120; break;
        case "cookieMoon": sz = 25 + Math.random() * 60; break;
        default:           sz = 25 + Math.random() * 80; break;
      }
      // Reject if too close to black hole event horizon (center ~600,1600, radius ~800)
      let bx, by;
      do {
        bx = BX0 + Math.random() * BW;
        by = BY0 + Math.random() * BH;
      } while (Math.hypot(bx - 600, by - 1600) < 900);
      this._bodies.push({
        x: bx, y: by, sz, type,
        rot: Math.random() * Math.PI * 2,
        a: type === "galaxy" ? 0.3 + Math.random() * 0.25
         : type === "donut" || type === "squircle" ? 0.5 + Math.random() * 0.35
         : 0.6 + Math.random() * 0.35,
      });
    }

    // Cache scene data for re-opens
    this.game._ptSceneCache = {
      milkyWay: this._milkyWay,
      crumbs: this._crumbs,
      stars: this._stars,
      bodies: this._bodies,
    };
  }

  // ── Pre-render a diffraction spike sprite (64×64, additive) ─
  _renderSpikeSprite() {
    const sz = 64, hf = sz / 2;
    const c = document.createElement("canvas");
    c.width = c.height = sz;
    const x = c.getContext("2d");

    // Core glow
    const cg = x.createRadialGradient(hf, hf, 0, hf, hf, hf);
    cg.addColorStop(0, "rgba(255,255,255,0.95)");
    cg.addColorStop(0.08, "rgba(200,210,255,0.6)");
    cg.addColorStop(0.25, "rgba(150,160,255,0.15)");
    cg.addColorStop(1, "transparent");
    x.fillStyle = cg;
    x.fillRect(0, 0, sz, sz);

    // 4-point diffraction spikes
    x.globalCompositeOperation = "lighter";
    x.strokeStyle = "rgba(200,210,255,0.5)";
    x.lineWidth = 0.8;
    const angles = [0, Math.PI / 2, Math.PI / 4, Math.PI * 3 / 4];
    const lens = [hf * 0.9, hf * 0.9, hf * 0.55, hf * 0.55];
    for (let i = 0; i < 4; i++) {
      const dx = Math.cos(angles[i]) * lens[i];
      const dy = Math.sin(angles[i]) * lens[i];
      // Draw spike with gradient opacity
      const sg = x.createLinearGradient(hf - dx, hf - dy, hf + dx, hf + dy);
      sg.addColorStop(0, "transparent");
      sg.addColorStop(0.35, "rgba(200,215,255,0.35)");
      sg.addColorStop(0.5, "rgba(255,255,255,0.5)");
      sg.addColorStop(0.65, "rgba(200,215,255,0.35)");
      sg.addColorStop(1, "transparent");
      x.strokeStyle = sg;
      x.beginPath();
      x.moveTo(hf - dx, hf - dy);
      x.lineTo(hf + dx, hf + dy);
      x.stroke();
    }
    return c;
  }

  // ── Pre-render black hole components ────────────────────────
  // Returns { disk, haze, ehR, sz } — disk is CIRCULAR (top-down view),
  // perspective squash + spin applied at draw time for animation.
  _renderBlackHole() {
    const sz = 1200, hf = sz / 2;
    const ehR = sz * 0.1;
    const innerR = ehR * 1.3, outerR = ehR * 4.5;

    // ── Circular accretion disk (no perspective, top-down) ──
    const disk = document.createElement("canvas");
    disk.width = disk.height = sz;
    const dc = disk.getContext("2d");
    const img = dc.createImageData(sz, sz);
    const dd = img.data;

    for (let py = 0; py < sz; py++) {
      for (let px2 = 0; px2 < sz; px2++) {
        const ddx = px2 - hf, ddy = py - hf; // circular — no Y flattening
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < innerR || dist > outerR) continue;

        const angle = Math.atan2(ddy, ddx);
        const t = (dist - innerR) / (outerR - innerR);
        const ca = Math.cos(angle) * 3, sa = Math.sin(angle) * 3;
        const dr = dist * 0.015;
        const n1 = _fbm(ca + dr, sa + dr, 4, 2.2, 0.5);
        const n2 = _fbm(ca * 2 + sa + 50, dr + 50, 3, 2, 0.5);

        let dens = Math.sin(t * Math.PI) * (0.6 + n1 * 0.4);
        dens *= (0.7 + n2 * 0.3);
        dens = clamp(dens, 0, 1);

        let r, g, b;
        if (t < 0.25) {
          const it = t / 0.25;
          r = 255; g = 220 + (1 - it) * 35; b = 180 + (1 - it) * 75;
        } else if (t < 0.6) {
          const mt = (t - 0.25) / 0.35;
          r = 255; g = 220 - mt * 120; b = 180 - mt * 150;
        } else {
          const ot = (t - 0.6) / 0.4;
          r = 255 - ot * 80; g = 100 - ot * 70; b = 30 - ot * 20;
        }

        const idx = (py * sz + px2) * 4;
        const a = dens * (0.85 - t * 0.4);
        dd[idx]     = clamp(r * (0.8 + n1 * 0.2), 0, 255);
        dd[idx + 1] = clamp(g * (0.8 + n2 * 0.2), 0, 255);
        dd[idx + 2] = clamp(b, 0, 255);
        dd[idx + 3] = clamp(a * 255, 0, 255);
      }
    }
    dc.putImageData(img, 0, 0);
    // Additive glow on disk
    dc.globalCompositeOperation = "lighter";
    const gl = dc.createRadialGradient(hf, hf, ehR * 1.2, hf, hf, ehR * 3);
    gl.addColorStop(0, "rgba(255, 200, 100, 0.06)");
    gl.addColorStop(0.5, "rgba(255, 120, 50, 0.03)");
    gl.addColorStop(1, "transparent");
    dc.fillStyle = gl;
    dc.fillRect(0, 0, sz, sz);

    // ── Gravitational haze (separate, always behind) ────────
    const haze = document.createElement("canvas");
    haze.width = haze.height = sz;
    const hc = haze.getContext("2d");
    const hg = hc.createRadialGradient(hf, hf, ehR, hf, hf, hf);
    hg.addColorStop(0, "rgba(80, 30, 150, 0.12)");
    hg.addColorStop(0.4, "rgba(40, 15, 80, 0.05)");
    hg.addColorStop(1, "transparent");
    hc.fillStyle = hg;
    hc.fillRect(0, 0, sz, sz);

    return { disk, haze, ehR, sz };
  }

  // ── Pre-render planet with shading ────────────────────────
  _renderPlanet(sz, baseRGB, lightAngle) {
    const c = document.createElement("canvas");
    c.width = c.height = sz;
    const x = c.getContext("2d");
    const r = sz / 2 - 4; // leave room for atmosphere glow
    const cx = sz / 2, cy = sz / 2;
    const ltX = cx + Math.cos(lightAngle) * r * 0.45;
    const ltY = cy + Math.sin(lightAngle) * r * 0.45;

    // Atmosphere glow (behind planet)
    x.globalCompositeOperation = "lighter";
    const atm = x.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.4);
    atm.addColorStop(0, "rgba(80, 130, 255, 0.15)");
    atm.addColorStop(0.5, "rgba(60, 100, 220, 0.06)");
    atm.addColorStop(1, "transparent");
    x.fillStyle = atm;
    x.beginPath(); x.arc(cx, cy, r * 1.4, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = "source-over";

    // Planet body (clipped)
    x.save();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();

    // Base color
    x.fillStyle = `rgb(${baseRGB[0]},${baseRGB[1]},${baseRGB[2]})`;
    x.fillRect(0, 0, sz, sz);

    // Surface bands with noise
    x.globalAlpha = 0.12;
    for (let i = 0; i < 8; i++) {
      const by = cy - r + (r * 2 * (i + 0.3)) / 8;
      const bh = r * (0.06 + Math.sin(i * 2.1) * 0.03);
      const bri = i % 2 ? 1.3 : 0.7;
      x.fillStyle = `rgb(${clamp(baseRGB[0]*bri,0,255)},${clamp(baseRGB[1]*bri,0,255)},${clamp(baseRGB[2]*bri,0,255)})`;
      x.fillRect(0, by - bh / 2, sz, bh);
    }
    x.globalAlpha = 1;

    // Day/night shading
    const shade = x.createRadialGradient(ltX, ltY, r * 0.05, cx, cy, r);
    shade.addColorStop(0, "rgba(255, 255, 255, 0.18)");
    shade.addColorStop(0.3, "rgba(0, 0, 0, 0)");
    shade.addColorStop(0.6, "rgba(0, 0, 0, 0.5)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.9)");
    x.fillStyle = shade;
    x.fillRect(0, 0, sz, sz);

    // Atmospheric scattering on limb
    x.globalCompositeOperation = "lighter";
    const limb = x.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
    limb.addColorStop(0, "transparent");
    limb.addColorStop(0.6, "rgba(60, 120, 255, 0.04)");
    limb.addColorStop(1, "rgba(100, 170, 255, 0.25)");
    x.fillStyle = limb;
    x.fillRect(0, 0, sz, sz);
    x.restore();

    return c;
  }

  // ── Pre-render distant galaxy (tiny spiral, seen edge-on) ──
  _renderGalaxy() {
    const sz = 100, hf = sz / 2;
    const c = document.createElement("canvas");
    c.width = sz; c.height = sz / 2;
    const x = c.getContext("2d");
    const cy = sz / 4;

    // Core bulge
    const core = x.createRadialGradient(hf, cy, 0, hf, cy, 12);
    core.addColorStop(0, "rgba(255, 240, 200, 0.5)");
    core.addColorStop(0.4, "rgba(200, 180, 140, 0.2)");
    core.addColorStop(1, "transparent");
    x.fillStyle = core;
    x.fillRect(0, 0, sz, sz / 2);

    // Disk (thin ellipse)
    x.save();
    x.globalCompositeOperation = "lighter";
    x.translate(hf, cy);
    x.scale(1, 0.15);
    const disk = x.createRadialGradient(0, 0, 3, 0, 0, hf * 0.85);
    disk.addColorStop(0, "rgba(220, 210, 255, 0.35)");
    disk.addColorStop(0.3, "rgba(180, 170, 230, 0.15)");
    disk.addColorStop(0.7, "rgba(120, 110, 180, 0.06)");
    disk.addColorStop(1, "transparent");
    x.fillStyle = disk;
    x.beginPath(); x.arc(0, 0, hf * 0.85, 0, Math.PI * 2); x.fill();
    x.restore();

    return c;
  }

  // ── Pre-render cookie planet (noise-textured baked surface) ──
  _renderCookiePlanet() {
    const sz = 200, hf = sz / 2, r = hf - 8;
    const c = document.createElement("canvas");
    c.width = c.height = sz;
    const x = c.getContext("2d");

    // Atmosphere glow (warm golden)
    x.globalCompositeOperation = "lighter";
    const atm = x.createRadialGradient(hf, hf, r * 0.9, hf, hf, r * 1.5);
    atm.addColorStop(0, "rgba(210, 160, 60, 0.14)");
    atm.addColorStop(0.5, "rgba(180, 120, 30, 0.06)");
    atm.addColorStop(1, "transparent");
    x.fillStyle = atm;
    x.beginPath(); x.arc(hf, hf, r * 1.5, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = "source-over";

    // Planet surface via noise (pixel-by-pixel baked cookie texture)
    x.save();
    x.beginPath(); x.arc(hf, hf, r, 0, Math.PI * 2); x.clip();

    const img = x.createImageData(sz, sz);
    const d = img.data;
    for (let py = 0; py < sz; py++) {
      for (let px = 0; px < sz; px++) {
        const dx = px - hf, dy = py - hf;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) continue;

        const nx = px / sz, ny = py / sz;
        // Baked cookie surface noise
        const n1 = _fbm(nx * 8, ny * 8, 4, 2, 0.5);       // large grain
        const n2 = _fbm(nx * 16 + 30, ny * 16 + 30, 3, 2, 0.5); // fine grain
        // Chocolate chips: dark spots where noise exceeds threshold
        const chipNoise = _fbm(nx * 6 + 70, ny * 6 + 70, 3, 2.5, 0.45);
        const isChip = chipNoise > 0.62;

        let cr, cg, cb;
        if (isChip) {
          // Chocolate: dark brown with slight variation
          cr = 55 + n2 * 25; cg = 30 + n2 * 15; cb = 15 + n2 * 10;
        } else {
          // Cookie dough: warm tan with baked variation
          cr = 180 + n1 * 50 + n2 * 20;
          cg = 130 + n1 * 35 + n2 * 15;
          cb = 70 + n1 * 20;
        }

        // 3D sphere shading (lit from upper-left)
        const lightDot = clamp((-dx / r * 0.5 - dy / r * 0.6 + 0.3), -1, 1);
        const shade = 0.35 + lightDot * 0.65;

        const idx = (py * sz + px) * 4;
        d[idx]     = clamp(cr * shade, 0, 255);
        d[idx + 1] = clamp(cg * shade, 0, 255);
        d[idx + 2] = clamp(cb * shade, 0, 255);
        d[idx + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);

    // Atmospheric scattering on limb
    x.globalCompositeOperation = "lighter";
    const rim = x.createRadialGradient(hf, hf, r * 0.75, hf, hf, r);
    rim.addColorStop(0, "transparent");
    rim.addColorStop(0.6, "rgba(220, 180, 100, 0.02)");
    rim.addColorStop(1, "rgba(255, 210, 130, 0.18)");
    x.fillStyle = rim;
    x.fillRect(0, 0, sz, sz);
    x.restore();

    return c;
  }

  // ── Pre-render a small cookie crumb ───────────────────────
  _renderCookieCrumb() {
    const sz = 32, hf = sz / 2;
    const c = document.createElement("canvas");
    c.width = c.height = sz;
    const x = c.getContext("2d");

    // Irregular cookie shape (slightly lumpy circle)
    x.fillStyle = "#c49040";
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = hf * (0.55 + Math.sin(i * 3.7) * 0.12);
      const px = hf + Math.cos(a) * rr, py = hf + Math.sin(a) * rr;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();

    // A couple dark chip spots
    x.fillStyle = "#5a3518";
    x.beginPath(); x.arc(hf - 3, hf - 2, 2.5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(hf + 4, hf + 2, 2, 0, Math.PI * 2); x.fill();

    // Shading
    const sg = x.createRadialGradient(hf - 3, hf - 3, 1, hf, hf, hf * 0.7);
    sg.addColorStop(0, "rgba(255,240,200,0.3)");
    sg.addColorStop(1, "rgba(0,0,0,0.4)");
    x.globalCompositeOperation = "source-atop";
    x.fillStyle = sg;
    x.fillRect(0, 0, sz, sz);

    return c;
  }

  // ── Pre-render ringed planet (Saturn-like) ─────────────────
  _renderRingedPlanet() {
    const sz = 240, hf = sz / 2, r = sz * 0.15;
    const c = document.createElement("canvas");
    c.width = c.height = sz;
    const x = c.getContext("2d");

    // Ring (behind planet)
    x.save();
    x.translate(hf, hf);
    x.scale(1, 0.35);
    const ringOuter = r * 2.6, ringInner = r * 1.5;
    // Outer ring
    x.strokeStyle = "rgba(180, 160, 130, 0.35)";
    x.lineWidth = ringOuter - ringInner;
    x.beginPath();
    x.arc(0, 0, (ringOuter + ringInner) / 2, Math.PI, Math.PI * 2); // back half
    x.stroke();
    // Inner bright ring
    x.strokeStyle = "rgba(220, 200, 160, 0.25)";
    x.lineWidth = (ringOuter - ringInner) * 0.3;
    x.beginPath();
    x.arc(0, 0, (ringOuter + ringInner) / 2, Math.PI, Math.PI * 2);
    x.stroke();
    x.restore();

    // Planet body
    x.save();
    x.beginPath(); x.arc(hf, hf, r, 0, Math.PI * 2); x.clip();
    const pg = x.createRadialGradient(hf - r * 0.3, hf - r * 0.3, 0, hf, hf, r);
    pg.addColorStop(0, "rgb(200, 180, 140)");
    pg.addColorStop(0.5, "rgb(170, 150, 110)");
    pg.addColorStop(1, "rgb(80, 65, 45)");
    x.fillStyle = pg;
    x.fillRect(0, 0, sz, sz);
    // Bands
    x.globalAlpha = 0.12;
    for (let i = 0; i < 5; i++) {
      const by = hf - r + (r * 2 * i) / 5;
      x.fillStyle = i % 2 ? "#c8b888" : "#8a7850";
      x.fillRect(0, by, sz, r * 0.15);
    }
    x.globalAlpha = 1;
    x.restore();

    // Front ring (over planet)
    x.save();
    x.translate(hf, hf);
    x.scale(1, 0.35);
    x.strokeStyle = "rgba(180, 160, 130, 0.35)";
    x.lineWidth = ringOuter - ringInner;
    x.beginPath();
    x.arc(0, 0, (ringOuter + ringInner) / 2, 0, Math.PI); // front half
    x.stroke();
    x.strokeStyle = "rgba(220, 200, 160, 0.25)";
    x.lineWidth = (ringOuter - ringInner) * 0.3;
    x.beginPath();
    x.arc(0, 0, (ringOuter + ringInner) / 2, 0, Math.PI);
    x.stroke();
    x.restore();

    return c;
  }

  // ── Pre-render donut/torus planet ─────────────────────────
  _renderDonutPlanet() {
    const sz = 120, hf = sz / 2;
    const c = document.createElement("canvas");
    c.width = c.height = sz;
    const x = c.getContext("2d");
    const outerR = sz * 0.38, tubeR = sz * 0.13;

    // Torus seen from slight angle — draw as thick ring
    x.save();
    x.translate(hf, hf);
    x.scale(1, 0.55); // flatten for angle

    // Outer glow
    x.globalCompositeOperation = "lighter";
    const glow = x.createRadialGradient(0, 0, outerR - tubeR, 0, 0, outerR + tubeR * 2);
    glow.addColorStop(0, "rgba(100, 200, 180, 0.08)");
    glow.addColorStop(1, "transparent");
    x.fillStyle = glow;
    x.beginPath(); x.arc(0, 0, outerR + tubeR * 2, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = "source-over";

    // Torus body — thick stroke ring
    for (let pass = 0; pass < 3; pass++) {
      const w = tubeR * 2 * (1 - pass * 0.3);
      const a = [0.5, 0.7, 0.9][pass];
      const l = [25, 35, 50][pass];
      x.strokeStyle = `hsla(170, 50%, ${l}%, ${a})`;
      x.lineWidth = w;
      x.beginPath();
      x.arc(0, 0, outerR, 0, Math.PI * 2);
      x.stroke();
    }

    // Highlight on top
    x.globalCompositeOperation = "lighter";
    x.strokeStyle = "rgba(150, 255, 230, 0.15)";
    x.lineWidth = tubeR * 0.5;
    x.beginPath();
    x.arc(0, 0, outerR, Math.PI * 1.1, Math.PI * 1.9);
    x.stroke();
    x.restore();

    return c;
  }

  // ── Pre-render squircle (superellipse) planet ─────────────
  _renderSquirclePlanet() {
    const sz = 100, hf = sz / 2;
    const c = document.createElement("canvas");
    c.width = c.height = sz;
    const x = c.getContext("2d");
    const r = sz * 0.35;

    // Superellipse path: |x/r|^3 + |y/r|^3 = 1
    x.save();
    x.translate(hf, hf);
    x.beginPath();
    const n = 3; // squircle exponent
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const px = Math.sign(ca) * r * Math.pow(Math.abs(ca), 2 / n);
      const py = Math.sign(sa) * r * Math.pow(Math.abs(sa), 2 / n);
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.clip();

    // Gradient fill — crystalline purple
    const pg = x.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
    pg.addColorStop(0, "rgb(160, 120, 220)");
    pg.addColorStop(0.5, "rgb(100, 60, 160)");
    pg.addColorStop(1, "rgb(30, 15, 60)");
    x.fillStyle = pg;
    x.fillRect(-r, -r, r * 2, r * 2);

    // Facet highlights
    x.globalCompositeOperation = "lighter";
    const fg = x.createRadialGradient(-r * 0.3, -r * 0.4, 0, 0, 0, r * 0.7);
    fg.addColorStop(0, "rgba(200, 180, 255, 0.3)");
    fg.addColorStop(1, "transparent");
    x.fillStyle = fg;
    x.fillRect(-r, -r, r * 2, r * 2);
    x.restore();

    // Outer glow
    x.globalCompositeOperation = "lighter";
    const og = x.createRadialGradient(hf, hf, r * 0.8, hf, hf, r * 1.4);
    og.addColorStop(0, "rgba(140, 100, 220, 0.06)");
    og.addColorStop(1, "transparent");
    x.fillStyle = og;
    x.beginPath(); x.arc(hf, hf, r * 1.4, 0, Math.PI * 2); x.fill();

    return c;
  }

  // ── Pre-render cookie moon (small, bitten) ────────────────
  _renderCookieMoon() {
    const sz = 80, hf = sz / 2, r = sz * 0.35;
    const c = document.createElement("canvas");
    c.width = c.height = sz;
    const x = c.getContext("2d");

    // Cookie base with a bite taken out
    x.save();
    x.beginPath();
    x.arc(hf, hf, r, 0, Math.PI * 2);
    // Bite: subtract a circle from the upper-right
    x.arc(hf + r * 0.6, hf - r * 0.5, r * 0.45, 0, Math.PI * 2, true);
    x.clip();

    // Cookie surface (noise-textured)
    const img = x.createImageData(sz, sz);
    const d = img.data;
    for (let py = 0; py < sz; py++) {
      for (let px = 0; px < sz; px++) {
        const dx = px - hf, dy = py - hf;
        if (dx * dx + dy * dy > r * r * 1.1) continue;
        const nx = px / sz, ny = py / sz;
        const n1 = _fbm(nx * 10, ny * 10, 3, 2, 0.5);
        const chip = _fbm(nx * 7 + 40, ny * 7 + 40, 2, 2.5, 0.45) > 0.6;
        let cr, cg, cb;
        if (chip) { cr = 50; cg = 28; cb = 12; }
        else { cr = 175 + n1 * 45; cg = 125 + n1 * 30; cb = 65 + n1 * 15; }
        const shade = 0.4 + clamp(-dx / r * 0.4 - dy / r * 0.5 + 0.3, -0.5, 0.6);
        const idx = (py * sz + px) * 4;
        d[idx] = clamp(cr * shade, 0, 255);
        d[idx + 1] = clamp(cg * shade, 0, 255);
        d[idx + 2] = clamp(cb * shade, 0, 255);
        d[idx + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    x.restore();

    return c;
  }

  // ── Pre-render noise-based nebula to offscreen canvas ─────
  _renderNebulaTexture(w, h) {
    // Render at 1/3 resolution for performance — the blur from upscaling IS the softness
    const scale = 3;
    const nw = Math.ceil(w / scale), nh = Math.ceil(h / scale);
    const c = document.createElement("canvas");
    c.width = nw; c.height = nh;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(nw, nh);
    const d = img.data;

    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const idx = (y * nw + x) * 4;
        const nx = x / nw, ny = y / nh;

        // FBM noise layers for volumetric density
        const density = _fbm(nx * 3.5, ny * 3.5, 5, 2.0, 0.5);
        const detail  = _fbm(nx * 7 + 50, ny * 7 + 50, 4, 2.0, 0.5);
        const wisp    = _fbm(nx * 14 + 100, ny * 14 + 100, 3, 2.0, 0.5);

        // Combine with power curve for cloud vs void contrast
        let dens = clamp(density * 0.55 + detail * 0.3 + wisp * 0.15, 0, 1);
        dens = Math.pow(dens, 1.8);

        // Color: cosmic purples/blues blended with warm cookie caramel tones
        const rN = _fbm(nx * 2.5 + 200, ny * 2.5 + 200, 3, 2, 0.5);
        const gN = _fbm(nx * 2.5 + 400, ny * 2.5 + 400, 3, 2, 0.5);
        const bN = _fbm(nx * 2.5 + 600, ny * 2.5 + 600, 3, 2, 0.5);
        // Warm/cool mix: a noise field blends between purple-cosmic and caramel-warm
        const warmth = clamp(_fbm(nx * 1.8 + 900, ny * 1.8 + 900, 3, 2, 0.5) + 0.1, 0, 1);

        const r = dens * (60 + 140 * clamp(rN + 0.3, 0, 1) + warmth * 50);
        const g = dens * (20 + 50 * clamp(gN, 0, 1) + warmth * 30);
        const b = dens * (80 + 150 * clamp(bN + 0.4, 0, 1) * (1 - warmth * 0.5));

        // Dark dust lanes: subtract density where another noise layer is high
        const dust = clamp(_fbm(nx * 5 + 800, ny * 5 + 800, 3, 2, 0.5) - 0.1, 0, 1);
        const dustMask = 1 - dust * 0.7;

        d[idx]     = clamp(r * dustMask, 0, 255);
        d[idx + 1] = clamp(g * dustMask, 0, 255);
        d[idx + 2] = clamp(b * dustMask, 0, 255);
        d[idx + 3] = clamp(dens * 180 * dustMask, 0, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    this._nebTex = c;
    this._nebW = w; this._nebH = h;
  }

  _drawStars(t) {
    const cvs = this._starCanvas, ctx = this._starCtx;
    if (!cvs || !ctx) return;
    const ctr = this._container;
    const w = ctr.clientWidth, h = ctr.clientHeight;
    const dpr = this._starDpr;

    if (cvs.width !== w * dpr || cvs.height !== h * dpr) {
      cvs.width = w * dpr; cvs.height = h * dpr;
      cvs.style.width = w + "px"; cvs.style.height = h + "px";
    }
    // Apply zoom/pan transform so canvas content moves with the graph
    const zm = this._zoom;
    const panX = this._pan.x, panY = this._pan.y;
    ctx.setTransform(dpr * zm, 0, 0, dpr * zm, dpr * panX, dpr * panY);
    // "World" dimensions: how much canvas space we see at current zoom
    const ww = w / zm, wh = h / zm;
    // Top-left corner of visible area in world space
    const wx0 = -panX / zm, wy0 = -panY / zm;
    ctx.clearRect(wx0, wy0, ww, wh);
    const ts = t * 0.001;

    // Fixed world-space positions for celestial bodies
    const WW = 3300, WH = 1500;
    // Visible area padded generously for drawing
    const vx0 = wx0 - 200, vy0 = wy0 - 200, vw = ww + 400, vh = wh + 400;

    // ═══ NEBULA (stretched to fill visible area) ═══════════
    if (!this._nebTex || this._nebW !== w || this._nebH !== h) {
      this._renderNebulaTexture(w, h);
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.7;
    ctx.drawImage(this._nebTex, vx0, vy0, vw, vh);
    ctx.restore();

    // ═══ "MILKY WAY" — smooth flowing river of milk ══════════
    // Draw as a series of connected bezier strokes that flow like liquid
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Multiple flowing streams — wider and more transparent
    const streams = [
      { width: vh * 0.14, a: 0.025, off: 0 },       // wide diffuse outer
      { width: vh * 0.08, a: 0.04, off: 0.008 },     // mid layer
      { width: vh * 0.04, a: 0.07, off: -0.005 },    // inner bright
      { width: vh * 0.015, a: 0.12, off: 0.003 },    // core
    ];
    for (const st of streams) {
      ctx.beginPath();
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t2 = i / steps;
        // Diagonal path across visible area
        const bx = vx0 + t2 * vw;
        const by = vy0 + (1 - t2) * vh;
        // Smooth flowing sine curves (time-animated = river flow)
        const fy = Math.sin(t2 * 6 + ts * 0.15) * vh * 0.03
                 + Math.sin(t2 * 10 + ts * 0.25 + 2) * vh * 0.015
                 + st.off * vh;
        const fx = Math.cos(t2 * 8 + ts * 0.1) * vw * 0.01;
        i === 0 ? ctx.moveTo(bx + fx, by + fy) : ctx.lineTo(bx + fx, by + fy);
      }
      ctx.strokeStyle = `hsla(35,60%,75%,${st.a})`;
      ctx.lineWidth = st.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // All dots along and around the river — core + spread halo
    for (const m of this._milkyWay) {
      const t2 = m.x;
      const bx = vx0 + t2 * vw;
      const by = vy0 + (1 - t2) * vh;
      // Same sine flow as the river strokes so dots track the stream
      const fy = Math.sin(t2 * 6 + ts * 0.15) * vh * 0.03
               + Math.sin(t2 * 10 + ts * 0.25 + 2) * vh * 0.015
               + m.spread * vh * 0.14;
      const fx = Math.cos(t2 * 8 + ts * 0.1) * vw * 0.01;
      ctx.fillStyle = `hsla(${m.hue},${m.sat}%,${m.lum}%,${m.a})`;
      ctx.beginPath();
      ctx.arc(bx + fx, by + fy, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ═══ DISTANT GALAXY ════════════════════════════════════
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(WW * 0.3, -30);
    ctx.rotate(-0.25);
    ctx.drawImage(this._galaxySprite, -80, -20, 160, 40);
    ctx.restore();

    // ═══ BLACK HOLE (animated spinning disk) ══════════════════
    const bh = this._bhSprite; // { disk, haze, ehR, sz }
    const bhDiam = 8000;                      // disk diameter in world px (2x old bhSz of ~4000 visual)
    const bhScale = bhDiam / bh.sz;           // world pixels per sprite pixel
    const bhEhWorld = bh.ehR * bhScale;       // event horizon radius in world px
    const spin = ts * 0.06;                   // slow spin
    const squash = 0.3;                       // perspective flattening
    const hf2 = bhDiam / 2;
    // Clip margin: large enough for the full disk at any rotation
    const clipM = hf2 + 200;

    ctx.save();
    ctx.translate(600, WH + 100);
    ctx.rotate(0.3); // overall tilt

    // Haze (always behind, no spin)
    ctx.drawImage(bh.haze, -hf2, -hf2 * squash, bhDiam, bhDiam * squash);

    // Helper: draw disk in squashed+spun coordinate space
    const drawDisk = () => {
      ctx.scale(1, squash);
      ctx.rotate(spin);
      ctx.drawImage(bh.disk, -hf2, -hf2, bhDiam, bhDiam);
    };

    // BACK HALF: clip to y < 0 (behind the hole in screen space)
    ctx.save();
    ctx.beginPath();
    ctx.rect(-clipM, -clipM, clipM * 2, clipM); // top half
    ctx.clip();
    drawDisk();
    ctx.restore();

    // Event horizon (absolute black, screen space)
    ctx.fillStyle = "#010005";
    ctx.beginPath();
    ctx.arc(0, 0, bhEhWorld, 0, Math.PI * 2);
    ctx.fill();

    // Photon ring
    ctx.save();
    ctx.shadowColor = "rgba(255, 180, 80, 0.9)";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "rgba(255, 210, 140, 0.6)";
    ctx.lineWidth = Math.max(2, bhScale);
    ctx.beginPath();
    ctx.arc(0, 0, bhEhWorld * 1.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "rgba(255, 240, 200, 0.3)";
    ctx.lineWidth = Math.max(1, bhScale * 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, bhEhWorld * 1.02, 0, Math.PI * 2);
    ctx.stroke();

    // FRONT HALF: clip to y > 0 (in front of the hole)
    ctx.save();
    ctx.beginPath();
    ctx.rect(-clipM, 0, clipM * 2, clipM); // bottom half
    ctx.clip();
    drawDisk();
    ctx.restore();

    ctx.restore();

    // ═══ CELESTIAL BODIES (procedurally scattered, draw if visible) ═══
    for (const b of this._bodies) {
      const bx = b.x, by = b.y, bs = b.sz;
      if (bx + bs < vx0 || bx - bs > vx0 + vw || by + bs < vy0 || by - bs > vy0 + vh) continue;

      let sprite;
      switch (b.type) {
        case "cookie":     sprite = this._cookiePlanetSprite; break;
        case "cookieMoon": sprite = this._cookieMoonSprite; break;
        case "blue":       sprite = this._planetSprite; break;
        case "green":      sprite = this._planet3Sprite; break;
        case "purple":     sprite = this._planet4Sprite; break;
        case "mars":       sprite = this._planet2Sprite; break;
        case "ringed":     sprite = this._ringedSprite; break;
        case "donut":      sprite = this._donutSprite; break;
        case "squircle":   sprite = this._squircleSprite; break;
        case "galaxy":     sprite = this._galaxySprite; break;
        default:           sprite = this._planetSprite; break;
      }

      ctx.save();
      ctx.globalAlpha = b.a;
      ctx.translate(bx, by);
      if (b.type === "galaxy") {
        ctx.rotate(b.rot);
        ctx.drawImage(sprite, -bs / 2, -bs / 4, bs, bs / 2);
      } else if (b.type === "ringed" || b.type === "donut") {
        ctx.rotate(b.rot);
        ctx.drawImage(sprite, -bs / 2, -bs / 2, bs, bs);
      } else {
        ctx.drawImage(sprite, -bs / 2, -bs / 2, bs, bs);
      }
      ctx.restore();
    }

    // ═══ COOKIE CRUMBS (placed in visible area) ════════════
    for (const cr of this._crumbs) {
      cr.x += cr.drift.x; cr.y += cr.drift.y;
      cr.rot += cr.rotSpd * 16;
      if (cr.x < -0.05) cr.x = 1.05; if (cr.x > 1.05) cr.x = -0.05;
      if (cr.y < -0.05) cr.y = 1.05; if (cr.y > 1.05) cr.y = -0.05;
      const csx = vx0 + cr.x * vw, csy = vy0 + cr.y * vh;
      const csz = cr.sz * Math.min(vw, vh) * 0.4;
      ctx.save();
      ctx.globalAlpha = cr.a;
      ctx.translate(csx, csy);
      ctx.rotate(cr.rot);
      ctx.drawImage(this._cookieCrumbSprite, -csz / 2, -csz / 2, csz, csz);
      ctx.restore();
    }

    // ═══ STARS (placed in visible area, always fills view) ══
    for (const s of this._stars) {
      const a = s.base + Math.sin(ts * s.freq + s.phase) * 0.25;
      if (a < 0.02) continue;
      s.y -= s.drift * 0.016;
      if (s.y < -0.05) s.y = 1.05;

      // Map star 0-1 coords to the visible area so they always fill the view
      const sx = vx0 + s.x * vw;
      const sy = vy0 + s.y * vh;
      const alpha = clamp(a, 0, 1);

      if (s.layer === 2) {
        const sprSz = s.r * 18 * alpha;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * 0.8;
        if (s.hue) {
          const tg = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 5);
          tg.addColorStop(0, `hsla(${s.hue},60%,75%,${alpha * 0.4})`);
          tg.addColorStop(1, "transparent");
          ctx.fillStyle = tg;
          ctx.fillRect(sx - s.r * 5, sy - s.r * 5, s.r * 10, s.r * 10);
        }
        ctx.drawImage(this._spikeSprite, sx - sprSz / 2, sy - sprSz / 2, sprSz, sprSz);
        ctx.restore();
        continue;
      }

      if (s.layer === 1 && s.r > 0.9) {
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 2.5);
        gr.addColorStop(0, `rgba(220,215,245,${alpha * 0.5})`);
        gr.addColorStop(1, "transparent");
        ctx.fillStyle = gr;
        ctx.fillRect(sx - s.r * 2.5, sy - s.r * 2.5, s.r * 5, s.r * 5);
      }

      ctx.fillStyle = s.hue
        ? `hsla(${s.hue},50%,78%,${alpha})`
        : `rgba(225,220,245,${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ═══ SHOOTING STARS (in visible area) ═══════════════════
    this._nextShoot -= 16;
    if (this._nextShoot <= 0 && this._shootingStars.length < 3) {
      const fromLeft = Math.random() > 0.5;
      this._shootingStars.push({
        x: fromLeft ? -0.05 : 1.05, y: 0.05 + Math.random() * 0.5,
        vx: (fromLeft ? 1 : -1) * (0.2 + Math.random() * 0.35),
        vy: 0.06 + Math.random() * 0.12, life: 1,
        decay: 0.005 + Math.random() * 0.004,
        len: 0.06 + Math.random() * 0.1,
        hue: Math.random() < 0.5 ? 0 : 210 + Math.random() * 50,
        width: 1.2 + Math.random() * 1.5,
      });
      this._nextShoot = 3000 + Math.random() * 6000;
    }
    for (let i = this._shootingStars.length - 1; i >= 0; i--) {
      const ss = this._shootingStars[i];
      ss.x += ss.vx * 0.016; ss.y += ss.vy * 0.016; ss.life -= ss.decay;
      if (ss.life <= 0) { this._shootingStars.splice(i, 1); continue; }
      const sx = vx0 + ss.x * vw, sy = vy0 + ss.y * vh;
      const tx = vx0 + (ss.x - ss.vx * ss.len) * vw, ty = vy0 + (ss.y - ss.vy * ss.len) * vh;
      const grd = ctx.createLinearGradient(tx, ty, sx, sy);
      const col = ss.hue ? `hsla(${ss.hue},65%,85%,` : "rgba(255,250,240,";
      grd.addColorStop(0, "transparent");
      grd.addColorStop(0.4, col + (ss.life * 0.3) + ")");
      grd.addColorStop(1, col + (ss.life * 0.85) + ")");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = grd; ctx.lineWidth = ss.width; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.fillStyle = col + (ss.life * 0.9) + ")";
      ctx.beginPath(); ctx.arc(sx, sy, ss.width * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // ── Tooltip ───────────────────────────────────────────────

  _createTooltip(ctr) {
    this._tooltip = document.createElement("div");
    this._tooltip.className = "pt-tip";
    ctr.appendChild(this._tooltip);
  }

  _showTip(u, e) {
    if (this._grabbed) return; // don't show while dragging
    const pr = this.game.prestige;
    const owned = pr.hasUpgrade(u.id), buy = pr.canBuyUpgrade(u.id);
    const chips = pr.getSpendableChips();
    const met = !u.requires?.length || u.requires.every(r => pr.hasUpgrade(r));

    let h = `<strong>${u.name}</strong><p>${u.desc}</p>`;
    if (owned) {
      h += `<div class="pt-tip-owned">Owned</div>`;
    } else {
      h += `<div class="pt-tip-cost">\uD83C\uDF6A ${formatNumberInWords(u.cost)} chips</div>`;
      if (!met) {
        const miss = u.requires.filter(r => !pr.hasUpgrade(r))
          .map(r => heavenlyUpgrades.find(x => x.id === r)?.name || r);
        h += `<div class="pt-tip-req">Requires: ${miss.join(", ")}</div>`;
      } else if (chips < u.cost) {
        h += `<div class="pt-tip-req">Need ${formatNumberInWords(u.cost - chips)} more</div>`;
      } else if (buy) {
        h += `<div class="pt-tip-buy">Click to purchase</div>`;
      }
    }
    this._tooltip.innerHTML = h;
    this._tooltip.classList.add("show");
    this._moveTip(e);
  }

  _moveTip(e) {
    const tip = this._tooltip, ctr = this._container;
    if (!tip || !ctr) return;
    const r = ctr.getBoundingClientRect();
    let x = e.clientX - r.left + 18, y = e.clientY - r.top - 8;
    if (x + tip.offsetWidth > r.width - 10) x = e.clientX - r.left - tip.offsetWidth - 18;
    if (y + tip.offsetHeight > r.height - 10) y = r.height - tip.offsetHeight - 10;
    if (y < 6) y = 6;
    tip.style.transform = `translate(${x}px,${y}px)`;
  }

  _hideTip() { this._tooltip?.classList.remove("show"); }

  // ── Purchase ──────────────────────────────────────────────

  _buy(id) {
    const pr = this.game.prestige;
    if (!pr.canBuyUpgrade(id) || !pr.buyUpgrade(id)) return;

    this.game.soundManager.prestigeUpgrade();
    this.game.calculateCPS();
    this.game.updateLeftPanel();
    this.game.saveGame();

    const chipEl = document.getElementById("heavenly-available-chips");
    if (chipEl) {
      chipEl.textContent = formatNumberInWords(pr.getSpendableChips());
      chipEl.classList.remove("heavenly-chip-flash");
      void chipEl.offsetWidth;
      chipEl.classList.add("heavenly-chip-flash");
    }

    const n = this._nodes.get(id);
    if (n) {
      n.rect.classList.add("pt-rect--flash");
      setTimeout(() => n.rect.classList.remove("pt-rect--flash"), 500);
    }
    this.refresh();
  }

  // ── Controls ──────────────────────────────────────────────

  _createControls(ctr) {
    const bar = document.createElement("div");
    bar.className = "pt-controls";

    this._resetBtn = mkBtn("\u21BA", "Reset layout");   // ↺
    this._resetBtn.classList.add("pt-reset-btn");
    this._resetBtn.addEventListener("click", () => {
      this._resetLayout();
      this._nodesMoved = false;
      this.game._ptPhysCache = null;
      this._updateResetBtn();
    });

    const fit = mkBtn("\u2922", "Fit to view");
    fit.addEventListener("click", () => this._fitToView());

    const zIn = mkBtn("+", "Zoom in");
    zIn.addEventListener("click", () => this._zoomBy(1.2));

    const zOut = mkBtn("\u2013", "Zoom out");
    zOut.addEventListener("click", () => this._zoomBy(0.8));

    this._progressEl = document.createElement("span");
    this._progressEl.className = "pt-progress";
    this._updateProgress();
    this._updateResetBtn();

    bar.append(this._progressEl, this._resetBtn, fit, zIn, zOut);
    ctr.appendChild(bar);
  }

  _updateResetBtn() {
    if (!this._resetBtn) return;
    if (this._nodesMoved) {
      this._resetBtn.classList.add("pt-reset-btn--active");
    } else {
      this._resetBtn.classList.remove("pt-reset-btn--active");
    }
  }

  _updateProgress() {
    if (!this._progressEl) return;
    this._progressEl.textContent =
      `${this.game.prestige.getHeavenlyUpgradeCount()} / ${heavenlyUpgrades.length}`;
  }

  // ── Events ────────────────────────────────────────────────

  _bindEvents() {
    // Wheel zoom — accumulates into target, animation loop smoothly lerps
    this._svg.addEventListener("wheel", e => {
      e.preventDefault();
      const r = this._svg.getBoundingClientRect();
      const factor = e.deltaY > 0 ? 0.94 : 1.06;
      this._zoomToward(factor, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // Pan starts on SVG background (nodes stopPropagation)
    this._svg.addEventListener("mousedown", e => {
      if (e.button !== 0) return;
      this._panning = { sx: e.clientX, sy: e.clientY, px: this._pan.x, py: this._pan.y };
      this._svg.style.cursor = "grabbing";
    });

    // Unified mousemove: node-drag OR pan
    this._boundMove = e => {
      if (this._grabbed) {
        const sv = this._mouseToSvg(e);
        const p = this._phys.get(this._grabbed);
        if (p) { p.x = sv.x - this._grabOff.x; p.y = sv.y - this._grabOff.y; }
        this._hideTip();
      } else if (this._panning) {
        this._pan.x = this._panning.px + (e.clientX - this._panning.sx);
        this._pan.y = this._panning.py + (e.clientY - this._panning.sy);
        this._applyViewTransform();
      }
    };
    window.addEventListener("mousemove", this._boundMove);

    // Unified mouseup
    this._boundUp = e => {
      if (this._grabbed) {
        const dx = e.clientX - this._grabStart.x;
        const dy = e.clientY - this._grabStart.y;
        const dt = performance.now() - this._grabStart.t;
        const wasClick = dt < CLICK_MS && Math.hypot(dx, dy) < CLICK_PX;
        if (wasClick) {
          this._buy(this._grabbed);
        } else {
          this._nodesMoved = true;
          this._updateResetBtn();
          this._savePhysics();
        }
        this._grabbed = null;
        this._svg.style.cursor = "grab";
      }
      if (this._panning) {
        this._panning = null;
        this._svg.style.cursor = "grab";
      }
    };
    window.addEventListener("mouseup", this._boundUp);

    // ── Touch ───────────────────────────────────────────────
    this._svg.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        // Check if touch is on a node
        const target = document.elementFromPoint(t.clientX, t.clientY);
        const nodeG = target?.closest?.(".pt-node");
        if (nodeG) {
          const id = nodeG.getAttribute("data-id");
          if (id) {
            const sv = this._touchToSvg(t);
            const p = this._phys.get(id);
            if (p) {
              this._grabbed = id;
              this._grabOff = { x: sv.x - p.x, y: sv.y - p.y };
              this._grabStart = { x: t.clientX, y: t.clientY, t: performance.now() };
              return;
            }
          }
        }
        this._panning = { sx: t.clientX, sy: t.clientY, px: this._pan.x, py: this._pan.y };
      } else if (e.touches.length === 2) {
        this._grabbed = null;
        this._panning = null;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this._pinch = { d0: Math.hypot(dx, dy), z0: this._zoom };
      }
    }, { passive: true });

    this._svg.addEventListener("touchmove", e => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (this._grabbed) {
          const sv = this._touchToSvg(t);
          const p = this._phys.get(this._grabbed);
          if (p) { p.x = sv.x - this._grabOff.x; p.y = sv.y - this._grabOff.y; }
        } else if (this._panning) {
          this._pan.x = this._panning.px + (t.clientX - this._panning.sx);
          this._pan.y = this._panning.py + (t.clientY - this._panning.sy);
          this._applyViewTransform();
        }
      } else if (e.touches.length === 2 && this._pinch) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this._zoom = clamp(this._pinch.z0 * Math.hypot(dx, dy) / this._pinch.d0, 0.15, 3);
        this._zoomTarget = this._zoom; // sync target for pinch (instant, not animated)
        this._applyViewTransform();
      }
    }, { passive: true });

    this._svg.addEventListener("touchend", e => {
      if (this._grabbed && e.touches.length === 0) {
        const dx = e.changedTouches[0].clientX - this._grabStart.x;
        const dy = e.changedTouches[0].clientY - this._grabStart.y;
        const dt = performance.now() - this._grabStart.t;
        if (dt < CLICK_MS && Math.hypot(dx, dy) < CLICK_PX) {
          this._buy(this._grabbed);
        } else {
          this._nodesMoved = true;
          this._updateResetBtn();
          this._savePhysics();
        }
        this._grabbed = null;
      }
      this._panning = null;
      this._pinch = null;
    }, { passive: true });
  }

  _mouseToSvg(e) {
    const r = this._svg.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - this._pan.x) / this._zoom,
      y: (e.clientY - r.top - this._pan.y) / this._zoom,
    };
  }

  _touchToSvg(t) {
    const r = this._svg.getBoundingClientRect();
    return {
      x: (t.clientX - r.left - this._pan.x) / this._zoom,
      y: (t.clientY - r.top - this._pan.y) / this._zoom,
    };
  }

  // ── Pan & Zoom (animated) ──────────────────────────────────

  _zoomBy(factor) {
    const r = this._container.getBoundingClientRect();
    this._zoomToward(factor, r.width / 2, r.height / 2);
  }

  /** Set a target zoom — the animation loop lerps toward it smoothly */
  _zoomToward(factor, cx, cy) {
    const oldTarget = this._zoomTarget;
    this._zoomTarget = clamp(this._zoomTarget * factor, 0.15, 3);
    // Adjust pan target so zoom centers on (cx, cy)
    const ratio = this._zoomTarget / oldTarget;
    const px = this._panTarget ? this._panTarget.x : this._pan.x;
    const py = this._panTarget ? this._panTarget.y : this._pan.y;
    this._panTarget = {
      x: cx - (cx - px) * ratio,
      y: cy - (cy - py) * ratio,
    };
  }

  /** Called each frame from the animation loop to smoothly interpolate zoom/pan */
  _animateZoom() {
    const LERP = 0.18; // 0 = no movement, 1 = instant snap
    const EPS = 0.001;

    // Lerp zoom
    const dz = this._zoomTarget - this._zoom;
    if (Math.abs(dz) > EPS) {
      this._zoom += dz * LERP;
    } else {
      this._zoom = this._zoomTarget;
    }

    // Lerp pan (only when panTarget is set, i.e., during zoom or fit-to-view)
    if (this._panTarget && !this._panning) {
      const dx = this._panTarget.x - this._pan.x;
      const dy = this._panTarget.y - this._pan.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        this._pan.x += dx * LERP;
        this._pan.y += dy * LERP;
      } else {
        this._pan.x = this._panTarget.x;
        this._pan.y = this._panTarget.y;
        this._panTarget = null; // done animating
      }
    }

    this._viewG.setAttribute("transform",
      `translate(${this._pan.x},${this._pan.y}) scale(${this._zoom})`);
  }

  /** Instant transform apply (used during manual panning) */
  _applyViewTransform() {
    this._zoomTarget = this._zoom; // sync target so animation doesn't fight
    this._panTarget = null;
    this._viewG.setAttribute("transform",
      `translate(${this._pan.x},${this._pan.y}) scale(${this._zoom})`);
  }

  _fitToView() {
    const c = this._container;
    if (!c) return;
    const cw = c.clientWidth, ch = c.clientHeight;
    if (!cw || !ch) return;

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const h of Object.values(HOME)) {
      x0 = Math.min(x0, h.x - NODE_W / 2); x1 = Math.max(x1, h.x + NODE_W / 2);
      y0 = Math.min(y0, h.y - NODE_H / 2); y1 = Math.max(y1, h.y + NODE_H / 2);
    }
    const tw = x1 - x0 + 80, th = y1 - y0 + 80;
    this._zoomTarget = Math.min(cw / tw, ch / th, 1.15);
    this._panTarget = {
      x: (cw - tw * this._zoomTarget) / 2 - (x0 - 40) * this._zoomTarget,
      y: (ch - th * this._zoomTarget) / 2 - (y0 - 40) * this._zoomTarget,
    };
  }
}

// ── Module helpers ──────────────────────────────────────────

function mkSvg(tag, attrs = {}) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function mkBtn(text, title) {
  const b = document.createElement("button");
  b.className = "pt-ctrl-btn";
  b.textContent = text;
  b.title = title;
  return b;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function rectCls(owned, buy, met, broke) {
  let c = "pt-rect";
  if (owned)      c += " pt-rect--owned";
  else if (buy)   c += " pt-rect--buy";
  else if (broke) c += " pt-rect--broke";
  else if (!met)  c += " pt-rect--locked";
  return c;
}

function bezier(x1, y1, x2, y2) {
  const by1 = y1 + NODE_H / 2 + 1, by2 = y2 - NODE_H / 2 - 1;
  const dy = Math.abs(by2 - by1) * 0.42;
  return `M${x1},${by1} C${x1},${by1 + dy} ${x2},${by2 - dy} ${x2},${by2}`;
}

// ── Simplex 2D noise (minimal implementation) ───────────────
// Based on Stefan Gustavson's simplex noise. Produces values in [-1, 1].
const _G2 = (3 - Math.sqrt(3)) / 6;
const _grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
const _perm = new Uint8Array(512);
{ const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
}

function _simplex2(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s), j = Math.floor(yin + s);
  const tt = (i + j) * _G2;
  const x0 = xin - (i - tt), y0 = yin - (j - tt);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + _G2, y1 = y0 - j1 + _G2;
  const x2 = x0 - 1 + 2 * _G2, y2 = y0 - 1 + 2 * _G2;
  const ii = i & 255, jj = j & 255;
  const gi0 = _grad[_perm[ii + _perm[jj]] % 8];
  const gi1 = _grad[_perm[ii + i1 + _perm[jj + j1]] % 8];
  const gi2 = _grad[_perm[ii + 1 + _perm[jj + 1]] % 8];
  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * (gi0[0] * x0 + gi0[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * (gi1[0] * x1 + gi1[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * (gi2[0] * x2 + gi2[1] * y2); }
  return 70 * (n0 + n1 + n2);
}

function _fbm(x, y, octaves, lac, gain) {
  let v = 0, a = 1, f = 1, mx = 0;
  for (let i = 0; i < octaves; i++) {
    v += a * _simplex2(x * f, y * f);
    mx += a; a *= gain; f *= lac;
  }
  return (v / mx + 1) * 0.5; // normalize to [0, 1]
}
