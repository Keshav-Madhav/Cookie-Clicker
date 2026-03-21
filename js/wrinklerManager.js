import { GRANDMAPOCALYPSE } from "./config.js";
import { formatNumberInWords } from "./utils.js";
import { CookieNum } from "./cookieNum.js";

/** Format milliseconds elapsed into a human-readable duration */
function _formatAge(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

export class WrinklerManager {
  constructor(game) {
    this.game = game;
    this.wrinklers = [];
    this._nextId = 0;
    this._canvas = null;
    this._ctx = null;
    this._animFrame = null;
    this._spawnTimer = null;
    this._spawnInterval = GRANDMAPOCALYPSE.wrinklerSpawnIntervalBase * 1000;
  }

  init() {
    const container = document.getElementById("cookie-container");
    if (!container) return;

    this._canvas = document.createElement("canvas");
    this._canvas.id = "wrinkler-canvas";
    this._canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;";
    container.style.position = "relative";
    container.appendChild(this._canvas);

    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._startRenderLoop();
    this._setupClickDetection(container);
    this._setupHoverDetection(container);

    // If stage is already active on load, start spawning
    if (this.game.grandmapocalypse && this.game.grandmapocalypse.stage >= 1 &&
        !this.game.grandmapocalypse.elderPledgeActive && !this.game.grandmapocalypse.covenantActive) {
      this.onStageChange(this.game.grandmapocalypse.stage);
    }
  }

  _resize() {
    if (!this._canvas || !this._canvas.parentElement) return;
    const rect = this._canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // not yet laid out
    const dpr = window.devicePixelRatio || 1;
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._canvas.style.width = rect.width + 'px';
    this._canvas.style.height = rect.height + 'px';
    this._displayW = rect.width;
    this._displayH = rect.height;
    this._ctx = this._canvas.getContext("2d");
    if (this._ctx) {
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  onStageChange(stage) {
    if (stage === 0) {
      this._stopSpawning();
      // Release all wrinklers when calmed, returning stored cookies
      this.releaseAll();
    } else {
      this._spawnInterval = (GRANDMAPOCALYPSE.wrinklerSpawnIntervalBase * 1000) / stage;
      this._startSpawning();
    }
  }

  _startSpawning() {
    this._stopSpawning();
    const attempt = () => {
      const gp = this.game.grandmapocalypse;
      if (gp && gp.stage >= 1 && !gp.elderPledgeActive && !gp.covenantActive) {
        if (this.wrinklers.length < GRANDMAPOCALYPSE.maxWrinklers &&
            Math.random() < GRANDMAPOCALYPSE.wrinklerSpawnChancePerAttempt) {
          this._spawnWrinkler();
        }
      }
      this._spawnTimer = setTimeout(attempt, this._spawnInterval);
    };
    this._spawnTimer = setTimeout(attempt, this._spawnInterval);
  }

  _stopSpawning() {
    clearTimeout(this._spawnTimer);
    this._spawnTimer = null;
  }

  _spawnWrinkler() {
    const isShiny = Math.random() < GRANDMAPOCALYPSE.shinyWrinklerChance;
    const gpStage = this.game.grandmapocalypse ? this.game.grandmapocalypse.stage : 0;
    const isElder = !isShiny && gpStage >= 3 && Math.random() < GRANDMAPOCALYPSE.elderWrinklerChance;
    const angle = Math.random() * Math.PI * 2;

    const sizeMin = isElder ? GRANDMAPOCALYPSE.elderWrinklerSizeMin : GRANDMAPOCALYPSE.wrinklerSizeMin;
    const sizeMax = isElder ? GRANDMAPOCALYPSE.elderWrinklerSizeMax : GRANDMAPOCALYPSE.wrinklerSizeMax;
    const size = sizeMin + Math.random() * (sizeMax - sizeMin);

    const wrinkler = {
      id: this._nextId++,
      angle,
      size,
      shiny: isShiny,
      elder: isElder,
      cookiesEaten: CookieNum.ZERO,
      phase: Math.random() * Math.PI * 2,
      wobblePhase: Math.random() * Math.PI * 2,
      spawnTime: Date.now(),
    };
    this.wrinklers.push(wrinkler);

    if (this.game.soundManager && this.game.soundManager.wrinklerSpawn) {
      this.game.soundManager.wrinklerSpawn();
    }
    this.game.stats.wrinklersFed = (this.game.stats.wrinklersFed || 0) + 1;
    // Tutorial: first wrinkler
    if (this.game.stats.wrinklersFed === 1 && this.game.tutorial) {
      this.game.tutorial.triggerEvent('wrinklerFirst');
    }
    // Only check achievements on first wrinkler spawn (avoid per-spawn overhead)
    if (this.game.stats.wrinklersFed === 1 || this.wrinklers.length === GRANDMAPOCALYPSE.maxWrinklers) {
      this.game.achievementManager.check();
    }
  }

  update(dtMs) {
    const gp = this.game.grandmapocalypse;
    if (!gp || gp.stage === 0 || gp.elderPledgeActive || gp.covenantActive) return;

    const cps = this.game.getEffectiveCPS();
    const dtSec = CookieNum.from(dtMs / 1000);
    const normalDrain = CookieNum.from(GRANDMAPOCALYPSE.wrinklerCpsDrainFraction);
    const elderDrain = CookieNum.from(GRANDMAPOCALYPSE.elderWrinklerDrainFraction);

    for (const w of this.wrinklers) {
      const drain = w.elder ? elderDrain : normalDrain;
      w.cookiesEaten = w.cookiesEaten.add(cps.mul(drain).mul(dtSec));
      w.wobblePhase += 0.05;
      w.phase += w.elder ? 0.05 : 0.03; // elder wrinklers move faster
    }
  }

  popWrinkler(id) {
    const idx = this.wrinklers.findIndex(w => w.id === id);
    if (idx === -1) return;
    const w = this.wrinklers[idx];

    const returnMult = w.shiny ? GRANDMAPOCALYPSE.shinyReturnMultiplier
      : w.elder ? GRANDMAPOCALYPSE.elderWrinklerReturnMultiplier
      : GRANDMAPOCALYPSE.wrinklerReturnMultiplier;
    const prestigeBonus = this.game.prestige && this.game.prestige.getWrinklerReturnBonus
      ? this.game.prestige.getWrinklerReturnBonus() : 1;

    const returned = w.cookiesEaten.mul(returnMult * prestigeBonus);

    this.game.cookies = this.game.cookies.add(returned);
    this.game.stats.totalCookiesBaked = this.game.stats.totalCookiesBaked.add(returned);
    this.game.stats.wrinklersPopped = (this.game.stats.wrinklersPopped || 0) + 1;
    if (w.shiny) {
      this.game.stats.shinyWrinklersPopped = (this.game.stats.shinyWrinklersPopped || 0) + 1;
    }

    // Check big pop: wrinkler ate >= 1 hour of current CPS
    const oneHourCps = this.game.getEffectiveCPS().mul(3600);
    if (w.cookiesEaten.gte(oneHourCps)) {
      this.game.stats.wrinklerBigPop = (this.game.stats.wrinklerBigPop || 0) + 1;
    }

    this.wrinklers.splice(idx, 1);

    if (this.game.soundManager && this.game.soundManager.wrinklerPop) {
      this.game.soundManager.wrinklerPop();
    }
    this.game.updateCookieCount();
    this.game.achievementManager.check();

    // Show floating text
    if (this.game.createFloatingText) {
      const btn = document.getElementById("cookie-button");
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const fakeEvent = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 4 };
        this.game.createFloatingText(fakeEvent, `+${formatNumberInWords(returned)} (wrinkler)`, true);
      }
    }
  }

  /**
   * Release every wrinkler at once — returns their stored cookies in a single
   * batch (one pop sound, one floating label) and clears the canvas.
   * Called by Elder Pledge and Elder Covenant so the player isn't penalised for
   * having wrinklers when they decide to make peace.
   */
  releaseAll() {
    this._stopSpawning();
    if (this.wrinklers.length === 0) {
      this.wrinklers = [];
      return;
    }

    let totalCookies = CookieNum.ZERO;
    const count = this.wrinklers.length;
    const shinyCount = this.wrinklers.filter(w => w.shiny).length;

    for (const w of this.wrinklers) {
      const returnMult = w.shiny  ? GRANDMAPOCALYPSE.shinyReturnMultiplier
        : w.elder ? GRANDMAPOCALYPSE.elderWrinklerReturnMultiplier
        :           GRANDMAPOCALYPSE.wrinklerReturnMultiplier;
      const prestigeBonus = this.game.prestige && this.game.prestige.getWrinklerReturnBonus
        ? this.game.prestige.getWrinklerReturnBonus() : 1;
      totalCookies = totalCookies.add(w.cookiesEaten.mul(returnMult * prestigeBonus));
    }

    this.wrinklers = [];

    if (count > 0) {
      this.game.cookies = this.game.cookies.add(totalCookies);
      this.game.stats.totalCookiesBaked = this.game.stats.totalCookiesBaked.add(totalCookies);
      this.game.stats.wrinklersPopped = (this.game.stats.wrinklersPopped || 0) + count;

      // Track shiny wrinkler pops for achievements
      if (shinyCount > 0) {
        this.game.stats.shinyWrinklersPopped = (this.game.stats.shinyWrinklersPopped || 0) + shinyCount;
      }

      if (this.game.soundManager && this.game.soundManager.wrinklerPop) {
        this.game.soundManager.wrinklerPop();
      }

      if (this.game.createFloatingText) {
        const btn = document.getElementById("cookie-button");
        if (btn) {
          const rect = btn.getBoundingClientRect();
          const ev = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 4 };
          const label = count > 1
            ? `+${formatNumberInWords(totalCookies)} (${count} wrinklers released)`
            : `+${formatNumberInWords(totalCookies)} (wrinkler released)`;
          this.game.createFloatingText(ev, label, true);
        }
      }

      this.game.updateCookieCount();
      this.game.achievementManager.check();
    }
  }

  getWrinklerCount() {
    return this.wrinklers.length;
  }

  getShinyCount() {
    return this.wrinklers.filter(w => w.shiny).length;
  }

  getTotalCookiesEaten() {
    return this.wrinklers.reduce((sum, w) => sum.add(w.cookiesEaten), CookieNum.ZERO);
  }

  // ── Click Detection ──

  _setupClickDetection(container) {
    container.addEventListener("click", (e) => {
      if (!this._canvas || this.wrinklers.length === 0) return;

      const rect = this._canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const cw = rect.width;
      const ch = rect.height;
      const cookieCX = cw / 2;
      const cookieCY = ch / 2;
      const cookieR = Math.min(cw, ch) * 0.35;

      // Check wrinklers from front to back (last drawn = on top)
      for (let i = this.wrinklers.length - 1; i >= 0; i--) {
        const w = this.wrinklers[i];
        const wx = cookieCX + Math.cos(w.angle) * cookieR * 0.85;
        const wy = cookieCY + Math.sin(w.angle) * cookieR * 0.85;
        const dist = Math.hypot(cx - wx, cy - wy);
        if (dist < w.size * 0.8) {
          this.popWrinkler(w.id);
          e.stopPropagation();
          return;
        }
      }
    }, true); // capture phase so we can intercept before cookie click
  }

  // ── Hover Tooltip ──

  _setupHoverDetection(container) {
    const canvas = this._canvas;
    if (!canvas) return;

    canvas.style.pointerEvents = 'auto';

    // Pass through clicks to the cookie button underneath
    canvas.addEventListener('click', (e) => {
      // Check if we hit a wrinkler — if not, forward click to cookie button
      if (this.wrinklers.length > 0) {
        const rect = this._canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const cw = rect.width, ch = rect.height;
        const cookieCX = cw / 2, cookieCY = ch / 2;
        const cookieR = Math.min(cw, ch) * 0.35;
        for (let i = this.wrinklers.length - 1; i >= 0; i--) {
          const w = this.wrinklers[i];
          const wx = cookieCX + Math.cos(w.angle) * cookieR * 0.85;
          const wy = cookieCY + Math.sin(w.angle) * cookieR * 0.85;
          if (Math.hypot(cx - wx, cy - wy) < w.size * 0.8) {
            this.popWrinkler(w.id);
            return; // wrinkler was hit, don't forward
          }
        }
      }
      // No wrinkler hit — forward click to cookie button
      const btn = document.getElementById('cookie-button');
      if (btn) btn.click();
    });

    canvas.addEventListener('mousemove', (e) => {
      const tooltip = document.getElementById('global-tooltip');
      if (!tooltip || !this._canvas || this.wrinklers.length === 0) {
        if (tooltip) tooltip.style.opacity = '0';
        return;
      }

      const rect = this._canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const cw = rect.width;
      const ch = rect.height;
      const cookieCX = cw / 2;
      const cookieCY = ch / 2;
      const cookieR = Math.min(cw, ch) * 0.35;

      let found = null;
      for (let i = this.wrinklers.length - 1; i >= 0; i--) {
        const w = this.wrinklers[i];
        const wx = cookieCX + Math.cos(w.angle) * cookieR * 0.85;
        const wy = cookieCY + Math.sin(w.angle) * cookieR * 0.85;
        const dist = Math.hypot(cx - wx, cy - wy);
        if (dist < w.size * 0.8) { found = w; break; }
      }

      if (found) {
        const type = found.shiny ? '✨ Shiny Wrinkler' : found.elder ? '👹 Elder Wrinkler' : '🐛 Wrinkler';
        const returnMult = found.shiny ? GRANDMAPOCALYPSE.shinyReturnMultiplier
          : found.elder ? GRANDMAPOCALYPSE.elderWrinklerReturnMultiplier
          : GRANDMAPOCALYPSE.wrinklerReturnMultiplier;
        const age = _formatAge(Date.now() - found.spawnTime);
        const eaten = formatNumberInWords(found.cookiesEaten);

        tooltip.innerHTML = `<p style="font-weight:bold">${type}</p>`
          + `<p style="font-size:11px">Cookies eaten: ${eaten}</p>`
          + `<p style="font-size:11px">Return: ${(returnMult * 100).toFixed(0)}%</p>`
          + `<p style="font-size:11px;color:#aaa">Age: ${age}</p>`
          + `<p style="font-size:10px;color:#f8c471">Click to pop</p>`;
        tooltip.style.opacity = '1';
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
      } else {
        tooltip.style.opacity = '0';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      const tooltip = document.getElementById('global-tooltip');
      if (tooltip) tooltip.style.opacity = '0';
    });
  }

  // ── Render Loop ──

  _startRenderLoop() {
    this._stopRenderLoop();
    let last = 0;
    const loop = (ts) => {
      this._animFrame = requestAnimationFrame(loop);
      if (ts - last < 32) return; // ~30fps
      last = ts;
      this._renderFrame();
    };
    this._animFrame = requestAnimationFrame(loop);
  }

  _stopRenderLoop() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  _renderFrame() {
    const ctx = this._ctx;
    if (!ctx || !this._canvas) return;

    const W = this._displayW || 0;
    const H = this._displayH || 0;
    if (W === 0 || H === 0) return;
    ctx.clearRect(0, 0, W, H);

    if (this.wrinklers.length === 0) return;

    const cookieCX = W / 2;
    const cookieCY = H / 2;
    const cookieR = Math.min(W, H) * 0.35;

    for (const w of this.wrinklers) {
      const baseX = cookieCX + Math.cos(w.angle) * cookieR * 0.85;
      const baseY = cookieCY + Math.sin(w.angle) * cookieR * 0.85;
      const wobble = Math.sin(w.wobblePhase) * 3;
      const breathe = 1 + Math.sin(w.phase * 1.5) * 0.04;
      const sx = baseX + Math.cos(w.angle + Math.PI / 2) * wobble;
      const sy = baseY + Math.sin(w.angle + Math.PI / 2) * wobble;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(w.angle + Math.PI / 2);
      ctx.scale(breathe, 1);

      // Shadow beneath wrinkler
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(2, 2, w.size * 0.48, w.size * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body gradient — sickly organic tones, elder wrinklers are dark crimson
      const grad = ctx.createRadialGradient(0, -w.size * 0.1, w.size * 0.1, 0, 0, w.size * 0.8);
      if (w.shiny) {
        grad.addColorStop(0, '#fff0a0');
        grad.addColorStop(0.3, '#e8c020');
        grad.addColorStop(0.7, '#b08010');
        grad.addColorStop(1, '#6a4a00');
      } else if (w.elder) {
        grad.addColorStop(0, '#8a2020');
        grad.addColorStop(0.3, '#601010');
        grad.addColorStop(0.7, '#400808');
        grad.addColorStop(1, '#1a0000');
      } else {
        grad.addColorStop(0, '#a06848');
        grad.addColorStop(0.3, '#7a4828');
        grad.addColorStop(0.7, '#5a3018');
        grad.addColorStop(1, '#2a1408');
      }

      // Body — tapered slug shape using bezier
      const bw = w.size * 0.44;
      const bh = w.size * 0.76;
      ctx.beginPath();
      ctx.moveTo(0, -bh);
      ctx.bezierCurveTo(bw * 1.2, -bh * 0.6, bw * 1.1, bh * 0.4, bw * 0.4, bh);
      ctx.bezierCurveTo(bw * 0.1, bh * 1.1, -bw * 0.1, bh * 1.1, -bw * 0.4, bh);
      ctx.bezierCurveTo(-bw * 1.1, bh * 0.4, -bw * 1.2, -bh * 0.6, 0, -bh);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle body outline
      ctx.strokeStyle = w.shiny ? 'rgba(180,140,0,0.3)' : w.elder ? 'rgba(150,0,0,0.4)' : 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Segment ridges — organic wrinkles
      ctx.strokeStyle = w.shiny ? 'rgba(200,160,0,0.2)' : w.elder ? 'rgba(200,0,0,0.15)' : 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.6;
      for (let i = -2; i <= 2; i++) {
        const y = i * w.size * 0.14;
        const ridge = Math.cos(i * 0.8) * bw * 0.7;
        ctx.beginPath();
        ctx.moveTo(-ridge, y);
        ctx.quadraticCurveTo(0, y + 2, ridge, y);
        ctx.stroke();
      }

      // Eyes — slightly different sizes for asymmetry
      const eyeY = -w.size * 0.38;
      ctx.fillStyle = w.shiny ? '#fff8a0' : w.elder ? '#ff0000' : '#ff3300';
      ctx.shadowColor = w.shiny ? 'rgba(255,230,0,0.6)' : w.elder ? 'rgba(255,0,0,0.8)' : 'rgba(200,40,0,0.5)';
      ctx.shadowBlur = w.elder ? 8 : 4; // elder eyes glow more intensely
      ctx.beginPath();
      ctx.arc(-w.size * 0.13, eyeY, w.size * 0.07, 0, Math.PI * 2);
      ctx.arc(w.size * 0.13, eyeY, w.size * 0.065, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Pupils — track toward cookie center with slight animation
      const pupilShift = Math.sin(w.phase) * w.size * 0.015;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-w.size * 0.13 + pupilShift, eyeY, w.size * 0.03, 0, Math.PI * 2);
      ctx.arc(w.size * 0.13 + pupilShift, eyeY, w.size * 0.028, 0, Math.PI * 2);
      ctx.fill();

      // Mouth / proboscis — feeding connection toward cookie
      const mouthY = w.size * 0.55;
      const feedLen = cookieR * 0.12 * (1 + Math.sin(w.phase * 2) * 0.15);
      ctx.strokeStyle = w.shiny ? 'rgba(180,150,0,0.5)' : 'rgba(80,30,10,0.5)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, mouthY);
      ctx.quadraticCurveTo(Math.sin(w.wobblePhase * 0.7) * 4, mouthY + feedLen * 0.5, 0, mouthY + feedLen);
      ctx.stroke();

      // Shiny sparkle particles
      if (w.shiny) {
        const sparkle = (Math.sin(w.phase * 3) + 1) * 2.5;
        ctx.fillStyle = 'rgba(255,255,200,0.8)';
        ctx.beginPath();
        ctx.arc(-w.size * 0.25, -w.size * 0.55, sparkle, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w.size * 0.2, -w.size * 0.15, sparkle * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // ── Save / Load ──

  getSaveData() {
    return {
      wrinklers: this.wrinklers.map(w => ({
        id: w.id,
        angle: w.angle,
        size: w.size,
        shiny: w.shiny,
        elder: w.elder || false,
        cookiesEaten: w.cookiesEaten.toJSON(),
        spawnTime: w.spawnTime,
      })),
      _nextId: this._nextId,
    };
  }

  loadSaveData(data) {
    if (!data) return;
    this._nextId = data._nextId || 0;
    this.wrinklers = (data.wrinklers || []).map(w => ({
      ...w,
      cookiesEaten: CookieNum.fromJSON(w.cookiesEaten || 0),
      phase: Math.random() * Math.PI * 2,
      wobblePhase: Math.random() * Math.PI * 2,
    }));
  }
}
