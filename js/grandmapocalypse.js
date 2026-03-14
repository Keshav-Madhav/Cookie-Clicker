import { CookieNum } from "./cookieNum.js";
import { GRANDMAPOCALYPSE } from "./config.js";
import { grandmaResearchChain } from "./gameData.js";
import { formatNumberInWords } from "./utils.js";

export class GrandmapocalypseManager {
  constructor(game) {
    this.game = game;
    this.stage = 0;
    this.researchPurchased = new Set();
    this.elderPledgeActive = false;
    this.pledgeEndTime = 0;
    this._pledgeTimer = null;
    this._previousStage = 0;
    this.pledgeCount = 0;
    this.covenantActive = false;
    this._covenantPenaltyApplied = false;
    this._apocalypseStartTime = 0;
  }

  getStage() {
    return this.stage;
  }

  getResearchChain() {
    return grandmaResearchChain;
  }

  hasResearch(id) {
    return this.researchPurchased.has(id);
  }

  canPurchaseResearch(id) {
    if (this.hasResearch(id)) return false;
    const item = grandmaResearchChain.find(r => r.id === id);
    if (!item) return false;
    if (this.covenantActive) return false;

    if (item.requires) {
      for (const req of item.requires) {
        if (req.type === "grandmapocalypseStage" && this.stage < req.min) return false;
        if (req.type === "building") {
          const b = this.game.buildings.find(b => b.name === req.name);
          if (!b || b.count < req.min) return false;
        }
      }
    }

    const cost = this.getResearchCost(id);
    return this.game.cookies.gte(cost);
  }

  getResearchCost(id) {
    const idx = grandmaResearchChain.findIndex(r => r.id === id);
    return CookieNum.from(GRANDMAPOCALYPSE.researchCosts[idx] || 0);
  }

  purchaseResearch(id) {
    if (!this.canPurchaseResearch(id)) return false;
    const cost = this.getResearchCost(id);
    this.game.cookies = this.game.cookies.sub(cost);
    this.researchPurchased.add(id);

    const newStage = this._computeStageFromResearch();
    if (newStage > this.stage) {
      this.stage = newStage;
      this._previousStage = newStage;
      this._onStageChange(newStage);
    }

    this._applyResearchBoosts();
    this.game.calculateCPS();
    this.game.saveGame();
    this._renderResearchPanel();
    return true;
  }

  _computeStageFromResearch() {
    if (this.researchPurchased.has("elderPact")) return 3;
    if (this.researchPurchased.has("communalBrainsweep")) return 2;
    if (this.researchPurchased.has("bingoCenter")) return 1;
    return 0;
  }

  _applyResearchBoosts() {
    let grandmaBoost = 1;
    for (const item of grandmaResearchChain) {
      if (this.researchPurchased.has(item.id) && item.grandmaBoost > 1) {
        grandmaBoost *= item.grandmaBoost;
      }
    }
    this.game._grandmapocalypseGrandmaBoost = grandmaBoost;
  }

  _onStageChange(newStage) {
    this.applyStageTheme(newStage);

    if (this.game.soundManager && this.game.soundManager.stageTransition) {
      this.game.soundManager.stageTransition(newStage);
    }

    const msg = GRANDMAPOCALYPSE.stageTransitionMessages[newStage];
    if (msg && this.game.visualEffects && this.game.visualEffects.showStageTransitionText) {
      this.game.visualEffects.showStageTransitionText(msg);
    }

    this.game.achievementManager.check();

    // Track when the apocalypse started (for the header counter)
    if (newStage >= 1 && !this._apocalypseStartTime) {
      this._apocalypseStartTime = Date.now();
    }

    // Tutorial tips per stage
    if (this.game.tutorial) {
      if (newStage === 1) this.game.tutorial.triggerEvent('grandmapocalypseStage1');
      else if (newStage === 2) this.game.tutorial.triggerEvent('grandmapocalypseStage2');
      else if (newStage === 3) this.game.tutorial.triggerEvent('grandmapocalypseStage3');
    }

    if (this.game.wrinklerManager) {
      this.game.wrinklerManager.onStageChange(newStage);
    }

    if (this.game.visualEffects && this.game.visualEffects.updateNewsPool) {
      this.game.visualEffects.updateNewsPool();
    }
  }

  applyStageTheme(stage) {
    const theme = GRANDMAPOCALYPSE.themes[stage];
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty('--gp-bg-tint', theme.bgTint);
    root.style.setProperty('--gp-cookie-filter', theme.cookieFilter);
    root.style.setProperty('--gp-vignette', String(theme.vignetteIntensity));
    if (theme.milkColor) {
      root.style.setProperty('--milk-override-color', theme.milkColor);
    } else {
      root.style.removeProperty('--milk-override-color');
    }
    document.body.classList.remove('grandma-stage-0', 'grandma-stage-1', 'grandma-stage-2', 'grandma-stage-3');
    document.body.classList.add(`grandma-stage-${stage}`);
  }

  getWrathCookieProbability() {
    if (this.elderPledgeActive || this.covenantActive) return 0;
    return GRANDMAPOCALYPSE.wrathCookieProbability[this.stage] || 0;
  }

  // ── Elder Pledge ──

  getElderPledgeCost() {
    let baseCost = GRANDMAPOCALYPSE.pledgeBaseCost;
    baseCost *= Math.pow(GRANDMAPOCALYPSE.pledgeCostMultiplier, this.pledgeCount);
    const discount = this.game.prestige ? this.game.prestige.getElderPledgeDiscount() : 0;
    return CookieNum.from(Math.floor(baseCost * (1 - discount)));
  }

  elderPledge() {
    if (this.stage === 0) return false;
    if (this.elderPledgeActive) return false;
    const cost = this.getElderPledgeCost();
    if (this.game.cookies.lt(cost)) return false;

    this.game.cookies = this.game.cookies.sub(cost);
    this.elderPledgeActive = true;
    this._previousStage = this.stage;
    this.pledgeCount++;
    // Each pledge is shorter than the last
    const decayMult = Math.pow(GRANDMAPOCALYPSE.pledgeDurationDecayPerUse || 1, this.pledgeCount - 1);
    const pledgeDuration = Math.max(3 * 60 * 1000, GRANDMAPOCALYPSE.pledgeDurationMs * decayMult); // min 3 minutes
    this.pledgeEndTime = Date.now() + pledgeDuration;

    this.applyStageTheme(0);
    if (this.game.soundManager && this.game.soundManager.elderPledge) {
      this.game.soundManager.elderPledge();
    }
    this.game.stats.elderPledgesUsed = (this.game.stats.elderPledgesUsed || 0) + 1;
    this.game.achievementManager.check();
    // Tutorial: first pledge
    if (this.game.stats.elderPledgesUsed === 1 && this.game.tutorial) {
      this.game.tutorial.triggerEvent('elderPledgeFirst');
    }

    // Clear existing wrinklers during pledge
    if (this.game.wrinklerManager) {
      this.game.wrinklerManager.onStageChange(0);
    }

    clearTimeout(this._pledgeTimer);
    this._pledgeTimer = setTimeout(() => this.expirePledge(), GRANDMAPOCALYPSE.pledgeDurationMs);
    this._renderResearchPanel();
    this.game.saveGame();
    return true;
  }

  expirePledge() {
    this.elderPledgeActive = false;
    this._apocalypseStartTime = Date.now(); // restart the counter
    this.applyStageTheme(this._previousStage);
    if (this.game.visualEffects && this.game.visualEffects.showStageTransitionText) {
      this.game.visualEffects.showStageTransitionText("The grandmas remember. Their patience is gone.");
    }
    if (this.game.wrinklerManager) {
      this.game.wrinklerManager.onStageChange(this._previousStage);
    }
    this._renderResearchPanel();
    this.game.saveGame();
  }

  // ── Elder Covenant ──

  elderCovenant() {
    if (this.covenantActive) return false;
    // Must have reached at least stage 1 through research
    if (this._previousStage === 0 && this.stage === 0) return false;
    this._previousStage = this._previousStage || this.stage;
    this.covenantActive = true;
    this._covenantPenaltyApplied = true;
    this.game.globalCpsMultiplier *= (1 - GRANDMAPOCALYPSE.covenantCpsPenalty);
    this.applyStageTheme(0);
    if (this.game.soundManager && this.game.soundManager.elderCovenant) {
      this.game.soundManager.elderCovenant();
    }
    this.game.stats.elderCovenantSigned = true;
    this.game.calculateCPS();
    this.game.achievementManager.check();
    clearTimeout(this._pledgeTimer);
    this.elderPledgeActive = false;

    if (this.game.wrinklerManager) {
      this.game.wrinklerManager.onStageChange(0);
    }

    this._renderResearchPanel();
    this.game.saveGame();
    return true;
  }

  revokeCovenant() {
    if (!this.covenantActive) return false;
    this.covenantActive = false;
    if (this._covenantPenaltyApplied) {
      this.game.globalCpsMultiplier /= (1 - GRANDMAPOCALYPSE.covenantCpsPenalty);
      this._covenantPenaltyApplied = false;
    }
    this.applyStageTheme(this._previousStage);
    if (this.game.wrinklerManager) {
      this.game.wrinklerManager.onStageChange(this._previousStage);
    }
    this.game.calculateCPS();
    this._renderResearchPanel();
    this.game.saveGame();
    return true;
  }

  // ── Tick (called every second from main game loop) ──

  tick() {
    if (this.elderPledgeActive && Date.now() >= this.pledgeEndTime) {
      this.expirePledge();
    }
    // Always update header elements (visible even when panel collapsed)
    this._updateHeaderBadge();
  }

  // ── Research Panel UI ──

  _initToggle() {
    if (this._toggleInitialized) return;
    const toggleBtn = document.getElementById("gp-toggle-btn");
    const panel = document.getElementById("grandmapocalypse-panel");
    if (!toggleBtn || !panel) return;
    this._toggleInitialized = true;
    this._panelOpen = false;

    toggleBtn.addEventListener("click", () => {
      this._panelOpen = !this._panelOpen;
      panel.classList.toggle("gp-expanded", this._panelOpen);
      // Render when opening
      if (this._panelOpen) this._renderResearchPanel();
      if (this.game.soundManager) this.game.soundManager.uiClick();
    });
  }

  _renderResearchPanel() {
    this._initToggle();
    const panel = document.getElementById("grandmapocalypse-panel");
    if (!panel) return;

    const grandmaBuilding = this.game.buildings.find(b => b.name === "Grandma");
    const grandmaCount = grandmaBuilding ? grandmaBuilding.count : 0;
    const shouldShow = grandmaCount >= 1;
    panel.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;

    // Tutorial: first time research panel appears
    if (shouldShow && !this._tutorialResearchShown && this.game.tutorial) {
      this._tutorialResearchShown = true;
      this.game.tutorial.triggerEvent('grandmaResearchAvailable');
    }

    // Update header text based on stage
    const headerText = panel.querySelector(".gp-header-text");
    if (headerText) {
      const effectiveStage = (this.elderPledgeActive || this.covenantActive) ? 0 : this.stage;
      const labels = ['Grandma Research', 'Displeased...', 'Angered!', 'ELDER PACT'];
      headerText.textContent = labels[effectiveStage] || labels[0];
    }

    // Always refresh header elements
    this._updateHeaderBadge();

    // Don't rebuild DOM if section is collapsed
    if (!this._panelOpen) return;

    // Research list — purchased items collapse into a summary
    const list = document.getElementById("gp-research-list");
    if (list) {
      list.innerHTML = "";

      const purchasedItems = grandmaResearchChain.filter(r => this.hasResearch(r.id));
      const unpurchasedItems = grandmaResearchChain.filter(r => !this.hasResearch(r.id));

      // Purchased summary (collapsed)
      if (purchasedItems.length > 0) {
        const summary = document.createElement("div");
        summary.className = "gp-purchased-summary";
        const totalBoost = purchasedItems.reduce((m, r) => m * (r.grandmaBoost > 1 ? r.grandmaBoost : 1), 1);
        summary.innerHTML = `<span class="gp-summary-label">Researched: ${purchasedItems.length}/${grandmaResearchChain.length}</span>` +
          (totalBoost > 1 ? `<span class="gp-summary-boost">×${totalBoost} grandma CPS</span>` : '');
        list.appendChild(summary);
      }

      // Unpurchased items — full display
      for (const item of unpurchasedItems) {
        const cost = this.getResearchCost(item.id);

        let reqMet = true;
        if (item.requires) {
          for (const req of item.requires) {
            if (req.type === "grandmapocalypseStage" && this.stage < req.min) { reqMet = false; break; }
            if (req.type === "building") {
              const b = this.game.buildings.find(b => b.name === req.name);
              if (!b || b.count < req.min) { reqMet = false; break; }
            }
          }
        }

        const row = document.createElement("div");
        row.className = `gp-research-item${!reqMet ? " locked" : ""}`;

        const canAfford = this.game.cookies.gte(cost);
        const canBuy = reqMet && canAfford && !this.covenantActive;

        // Show requirement hints for locked items
        let reqHint = '';
        if (!reqMet && item.requires) {
          const hints = item.requires.map(req => {
            if (req.type === "grandmapocalypseStage") return `Stage ${req.min}`;
            if (req.type === "building") {
              const b = this.game.buildings.find(b => b.name === req.name);
              return `${req.name} ×${req.min}` + (b ? ` (${b.count})` : '');
            }
            return '';
          }).filter(Boolean);
          reqHint = `<div class="gp-research-req">Requires: ${hints.join(', ')}</div>`;
        }

        row.innerHTML = `
          <div class="gp-research-info">
            <span class="gp-research-name">${item.name}</span>
            <div class="gp-research-desc">${item.desc}</div>
            ${reqHint}
          </div>
          ${reqMet ? `<button class="gp-research-buy-btn" data-id="${item.id}" ${!canBuy ? "disabled" : ""}>${formatNumberInWords(cost)}</button>` : ""}
          ${!reqMet ? `<span class="gp-research-locked">Locked</span>` : ""}
        `;

        if (canBuy) {
          const btn = row.querySelector(".gp-research-buy-btn");
          btn.addEventListener("click", () => {
            this.purchaseResearch(item.id);
            if (this.game.soundManager) this.game.soundManager.upgrade(1);
          });
        }
        list.appendChild(row);
      }
    }

    // Pledge / Covenant / Revoke buttons
    const pledgeBtn = document.getElementById("gp-pledge-btn");
    const covenantBtn = document.getElementById("gp-covenant-btn");
    const revokeBtn = document.getElementById("gp-revoke-btn");
    const pledgeTimer = document.getElementById("gp-pledge-timer");

    if (pledgeBtn) {
      const show = this.stage >= 1 && !this.covenantActive && !this.elderPledgeActive;
      pledgeBtn.classList.toggle("hidden", !show);
      if (show) {
        pledgeBtn.textContent = `Elder Pledge (${formatNumberInWords(this.getElderPledgeCost())})`;
        pledgeBtn.onclick = () => {
          if (!this.elderPledge() && this.game.soundManager) this.game.soundManager.uiClick();
        };
      }
    }

    if (covenantBtn) {
      const show = this.stage >= 1 && !this.covenantActive && !this.elderPledgeActive;
      covenantBtn.classList.toggle("hidden", !show);
      if (show) {
        covenantBtn.onclick = () => {
          if (confirm(`Sign the Elder Covenant? -${GRANDMAPOCALYPSE.covenantCpsPenalty * 100}% CPS permanently (revokable), but grandmas calm down.`)) {
            this.elderCovenant();
          }
        };
      }
    }

    if (revokeBtn) {
      revokeBtn.classList.toggle("hidden", !this.covenantActive);
      if (this.covenantActive) {
        revokeBtn.onclick = () => {
          if (confirm("Revoke the Elder Covenant? The grandmas will remember.")) {
            this.revokeCovenant();
          }
        };
      }
    }

    if (pledgeTimer) {
      pledgeTimer.classList.toggle("hidden", !this.elderPledgeActive);
    }
  }

  _updateHeaderBadge() {
    // Stage badge — always update
    const badge = document.getElementById("gp-stage-badge");
    if (badge) {
      const effectiveStage = (this.elderPledgeActive || this.covenantActive) ? 0 : this.stage;
      badge.textContent = effectiveStage;
      badge.className = `gp-stage-indicator stage-${effectiveStage}`;
    }

    // Pledge timer OR apocalypse duration in header
    const el = document.getElementById("gp-pledge-timer");
    if (!el) return;

    if (this.elderPledgeActive) {
      // Show peace countdown (green)
      el.classList.remove("hidden", "gp-pledge-bar-danger");
      const remaining = Math.max(0, Math.ceil((this.pledgeEndTime - Date.now()) / 1000));
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      el.textContent = `☮ ${mins}:${String(secs).padStart(2, '0')}`;
    } else if (this.stage >= 1 && !this.covenantActive) {
      // Show apocalypse duration (red, counting up)
      el.classList.remove("hidden");
      el.classList.add("gp-pledge-bar-danger");
      if (!this._apocalypseStartTime) this._apocalypseStartTime = Date.now();
      const elapsed = Math.floor((Date.now() - this._apocalypseStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      el.textContent = `☠ ${mins}:${String(secs).padStart(2, '0')}`;
    } else {
      el.classList.add("hidden");
    }
  }

  // ── Save / Load ──

  getSaveData() {
    return {
      stage: this.stage,
      researchPurchased: [...this.researchPurchased],
      elderPledgeActive: this.elderPledgeActive,
      pledgeEndTime: this.pledgeEndTime,
      pledgeCount: this.pledgeCount,
      covenantActive: this.covenantActive,
      _covenantPenaltyApplied: this._covenantPenaltyApplied,
      _previousStage: this._previousStage,
      _apocalypseStartTime: this._apocalypseStartTime || 0,
    };
  }

  loadSaveData(data) {
    if (!data) return;
    this.stage = data.stage || 0;
    this.researchPurchased = new Set(data.researchPurchased || []);
    this.elderPledgeActive = data.elderPledgeActive || false;
    this.pledgeEndTime = data.pledgeEndTime || 0;
    this.pledgeCount = data.pledgeCount || 0;
    this.covenantActive = data.covenantActive || false;
    this._covenantPenaltyApplied = data._covenantPenaltyApplied || false;
    this._previousStage = data._previousStage || this.stage;
    this._apocalypseStartTime = data._apocalypseStartTime || 0;
    this._applyResearchBoosts();

    // Restore pledge timer if still active
    if (this.elderPledgeActive && this.pledgeEndTime > Date.now()) {
      const remaining = this.pledgeEndTime - Date.now();
      this._pledgeTimer = setTimeout(() => this.expirePledge(), remaining);
    } else if (this.elderPledgeActive) {
      // Pledge expired while offline
      this.elderPledgeActive = false;
    }

    // Re-apply covenant penalty if it was saved as applied
    // (globalCpsMultiplier is saved and restored, so the penalty is already baked in)
    // We just need the flag to be correct for revokeCovenant()

    // Apply theme on load (deferred to after DOM is ready)
    requestAnimationFrame(() => {
      const effectiveStage = (this.elderPledgeActive || this.covenantActive) ? 0 : this.stage;
      this.applyStageTheme(effectiveStage);
      this._renderResearchPanel();
    });
  }
}
