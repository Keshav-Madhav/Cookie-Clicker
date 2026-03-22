import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** CookieLaunch mixin */
export const CookieLaunchMixin = {
/* ════════════════════════════════════════════════════════════
   🚀  COOKIE LAUNCH — slingshot projectile with bounce physics
   ════════════════════════════════════════════════════════════
   3 rounds. Flat ground, walls bounce cookie back.
   Drag back to aim + set power, release to launch.
   Cookie bounces and rolls — score counted when it stops.
*/

_cookieLaunch() {
  const C = MINI_GAME_SETTINGS.cookieLaunch;
  const snd = this.game.soundManager;
  const GY = C.groundY;
  const launcherY = GY - 8; // cookie sits just above ground

  const state = {
    round: 0,
    totalScore: 0,
    roundScores: [],
    phase: 'aim',     // 'aim' | 'flight' | 'rolling' | 'scored'
    wind: 0,
    targetX: 0,
    wallBounced: false,
    obstacle: null,
    dragging: false,
    dragX: 0, dragY: 0,
    px: 0, py: 0, vx: 0, vy: 0,
    bounces: 0,
    trail: [],
    // Wind particles — simulate same physics as cookie for real reference
    windParticles: [],
    windSpawnTimer: 0,
    animFrame: null,
    canvas: null, ctx: null,
    _cleanup: null,
  };

  const initRound = () => {
    state.phase = 'aim';
    state.wind = C.windMin + Math.random() * (C.windMax - C.windMin);
    // Random distance between launcher and target
    const dist = C.targetDistMin + Math.random() * (C.targetDistMax - C.targetDistMin);
    state.targetX = Math.min(C.canvasWidth - 30, C.launcherX + dist);
    state.dragging = false;
    state.trail = [];
    state.px = C.launcherX;
    state.py = launcherY;
    state.vx = 0;
    state.vy = 0;
    state.bounces = 0;
    state.wallBounced = false;

    // Obstacle on round 3
    if (state.round + 1 >= C.obstacleRound) {
      const frac = C.obstacleXFracMin + Math.random() * (C.obstacleXFracMax - C.obstacleXFracMin);
      const ox = C.launcherX + (state.targetX - C.launcherX) * frac;
      const hFrac = C.obstacleHeightMin + Math.random() * (C.obstacleHeightMax - C.obstacleHeightMin);
      state.obstacle = { x: ox, height: GY * hFrac };
    } else {
      state.obstacle = null;
    }
    // Reset wind particles for new wind
    state.windParticles = [];
    state.windSpawnTimer = 0;
  };

  // Wind particle system — drift horizontally to show wind direction/strength
  const spawnWindParticle = () => {
    const w = state.wind;
    if (Math.abs(w) < 0.01) return;
    const fromLeft = w > 0;
    const x = fromLeft ? -5 : C.canvasWidth + 5;
    const y = 20 + Math.random() * (GY - 40);
    // Horizontal speed proportional to wind, with slight variation
    const speed = (Math.abs(w) * 25) + Math.random() * 1.5;
    const vx = (fromLeft ? 1 : -1) * speed;
    // Slight vertical wobble, no gravity
    const vy = (Math.random() - 0.5) * 0.3;
    state.windParticles.push({
      x, y, vx, vy,
      wobbleAmp: 0.2 + Math.random() * 0.4,
      wobbleSpeed: 0.04 + Math.random() * 0.04,
      life: 0, maxLife: 100 + Math.random() * 80,
      size: 1 + Math.random() * 1.5,
      opacity: 0.1 + Math.random() * 0.15,
    });
  };

  const updateWindParticles = () => {
    const w = state.wind;
    state.windSpawnTimer++;
    const spawnRate = Math.abs(w) > 0.04 ? 3 : 6;
    if (state.windSpawnTimer % spawnRate === 0 && Math.abs(w) > 0.01) {
      spawnWindParticle();
    }
    if (state.windParticles.length > 35) {
      state.windParticles = state.windParticles.slice(-35);
    }
    for (let i = state.windParticles.length - 1; i >= 0; i--) {
      const p = state.windParticles[i];
      p.x += p.vx;
      // Gentle vertical wobble (like dust/leaves in wind)
      p.y += p.vy + Math.sin(p.life * p.wobbleSpeed) * p.wobbleAmp;
      p.life++;
      if (p.life > p.maxLife || p.x < -20 || p.x > C.canvasWidth + 20) {
        state.windParticles.splice(i, 1);
      }
    }
  };

  initRound();

  const render = () => {
    const windLabel = state.wind > 0.02 ? 'Wind >>>' : state.wind < -0.02 ? '<<< Wind' : 'Calm';
    const windStrength = Math.abs(state.wind) < 0.02 ? '' :
      Math.abs(state.wind) < 0.04 ? ' (light)' : ' (strong)';

    this._show(`<div class="mini-game-card launch-card">
      <div class="mini-title">Cookie Launch <span class="mini-sub">Round ${state.round + 1}/${C.rounds}</span></div>
      <div class="launch-info">
        <span class="launch-wind">${windLabel}${windStrength}</span>
        <span class="launch-score">Score: ${state.totalScore}</span>
      </div>
      <canvas id="launch-canvas" width="${C.canvasWidth}" height="${C.canvasHeight}" class="launch-canvas"></canvas>
      <div class="launch-hint" id="launch-hint">Drag back from the cookie to aim, release to launch!${state.obstacle ? ' (Watch the wall!)' : ''}</div>
    </div>`);

    state.canvas = document.getElementById('launch-canvas');
    state.ctx = state.canvas.getContext('2d');
    this._launchDraw(state, C, launcherY);
    this._launchBind(state, C, snd, initRound, render, launcherY, updateWindParticles);

    // Animate wind particles during aim phase
    const aimLoop = () => {
      if (state.phase !== 'aim' || !state.ctx) return;
      updateWindParticles();
      this._launchDraw(state, C, launcherY);
      state.animFrame = requestAnimationFrame(aimLoop);
    };
    state.animFrame = requestAnimationFrame(aimLoop);
  };

  render();
},

_launchDraw(state, C, launcherY) {
  const ctx = state.ctx;
  if (!ctx) return;
  const W = C.canvasWidth, H = C.canvasHeight, GY = C.groundY;

  ctx.clearRect(0, 0, W, H);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GY);
  sky.addColorStop(0, '#0d0620');
  sky.addColorStop(0.5, '#1a0d30');
  sky.addColorStop(1, '#2d1a0a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GY);

  // Moon
  ctx.beginPath();
  ctx.arc(W - 60, 40, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,240,200,0.12)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 60, 40, 14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,240,200,0.08)';
  ctx.fill();

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137.5 + 43) % W;
    const sy = (i * 73.3 + 17) % (GY * 0.4);
    const sz = (i % 3 === 0) ? 2 : 1;
    ctx.fillRect(sx, sy, sz, sz);
  }

  // Distant hills silhouette
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.moveTo(0, GY);
  for (let x = 0; x <= W; x += 20) {
    const h = Math.sin(x * 0.008) * 25 + Math.sin(x * 0.02 + 1) * 12 + 30;
    ctx.lineTo(x, GY - h);
  }
  ctx.lineTo(W, GY);
  ctx.fill();

  // Ground — layered for depth
  const ground = ctx.createLinearGradient(0, GY, 0, H);
  ground.addColorStop(0, '#5a3921');
  ground.addColorStop(0.3, '#4a2e18');
  ground.addColorStop(1, '#3a2010');
  ctx.fillStyle = ground;
  ctx.fillRect(0, GY, W, H - GY);
  // Ground surface highlight
  ctx.fillStyle = '#7a4f2e';
  ctx.fillRect(0, GY, W, 2);
  ctx.fillStyle = 'rgba(139,94,52,0.4)';
  ctx.fillRect(0, GY + 2, W, 1);
  // Grass tufts
  ctx.fillStyle = '#4a7a3a';
  for (let i = 0; i < W; i += 14) {
    const tx2 = i + (i * 7 % 9);
    ctx.fillRect(tx2, GY - 3, 1.5, 5);
    ctx.fillStyle = '#3d6b2e';
    ctx.fillRect(tx2 + 3, GY - 2, 1, 4);
    ctx.fillStyle = '#4a7a3a';
  }

  // Wind arrow — centered in the play area (between launcher and canvas middle height)
  if (Math.abs(state.wind) > 0.02) {
    const dir = state.wind > 0 ? 1 : -1;
    const mag = Math.min(1, Math.abs(state.wind) / 0.06);
    const arrowLen = 20 + mag * 20;
    ctx.save();
    ctx.strokeStyle = `rgba(173,216,230,${0.3 + mag * 0.4})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    // Center of play area
    const wx = (C.launcherX + state.targetX) / 2;
    const wy = GY / 2;
    ctx.beginPath();
    ctx.moveTo(wx - dir * arrowLen, wy);
    ctx.lineTo(wx + dir * arrowLen, wy);
    ctx.lineTo(wx + dir * (arrowLen - 8), wy - 6);
    ctx.moveTo(wx + dir * arrowLen, wy);
    ctx.lineTo(wx + dir * (arrowLen - 8), wy + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    // Wind label
    ctx.font = '10px sans-serif';
    ctx.fillStyle = `rgba(173,216,230,${0.4 + mag * 0.3})`;
    ctx.textAlign = 'center';
    ctx.fillText('WIND', wx, wy - 12);
    ctx.restore();
  }

  // Wind particles — streaks showing wind direction and speed
  for (const p of state.windParticles) {
    const a = p.opacity;
    // Draw as a short streak in direction of travel
    const len = Math.min(8, Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 2.5);
    const ang = Math.atan2(p.vy, p.vx);
    ctx.strokeStyle = `rgba(200,220,240,${a.toFixed(3)})`;
    ctx.lineWidth = p.size * 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(ang) * len, p.y - Math.sin(ang) * len);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  // Obstacle wall (round 3+)
  if (state.obstacle) {
    const ob = state.obstacle;
    const obTop = GY - ob.height;
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(ob.x - C.obstacleWidth / 2, obTop, C.obstacleWidth, ob.height);
    // Brick lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    for (let y = obTop; y < GY; y += 10) {
      const offset = (Math.floor((y - obTop) / 10) % 2) * 5;
      ctx.beginPath();
      ctx.moveTo(ob.x - C.obstacleWidth / 2, y);
      ctx.lineTo(ob.x + C.obstacleWidth / 2, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ob.x - C.obstacleWidth / 2 + offset, y);
      ctx.lineTo(ob.x - C.obstacleWidth / 2 + offset, y + 10);
      ctx.stroke();
    }
    // Top cap
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(ob.x - C.obstacleWidth / 2 - 2, obTop - 3, C.obstacleWidth + 4, 5);
  }

  // Target rings (on ground)
  const tx = state.targetX;
  ctx.beginPath();
  ctx.arc(tx, GY, C.okRadius, Math.PI, 0);
  ctx.fillStyle = 'rgba(96,165,250,0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(96,165,250,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx, GY, C.greatRadius, Math.PI, 0);
  ctx.fillStyle = 'rgba(74,222,128,0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(74,222,128,0.4)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx, GY, C.bullseyeRadius, Math.PI, 0);
  ctx.fillStyle = 'rgba(255,215,0,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Flag pole
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tx, GY);
  ctx.lineTo(tx, GY - 35);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(tx, GY - 35);
  ctx.lineTo(tx + 14, GY - 30);
  ctx.lineTo(tx, GY - 25);
  ctx.fill();

  // Launcher slingshot fork
  ctx.strokeStyle = '#8b5e34';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(C.launcherX - 10, GY);
  ctx.lineTo(C.launcherX - 8, GY - 18);
  ctx.moveTo(C.launcherX + 10, GY);
  ctx.lineTo(C.launcherX + 8, GY - 18);
  ctx.stroke();

  // Trail — fading gradient
  if (state.trail.length > 2) {
    const tLen = state.trail.length;
    for (let i = 1; i < tLen; i++) {
      const alpha = (i / tLen) * 0.4;
      ctx.strokeStyle = `rgba(255,200,100,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1 + (i / tLen) * 1.5;
      ctx.beginPath();
      ctx.moveTo(state.trail[i - 1].x, state.trail[i - 1].y);
      ctx.lineTo(state.trail[i].x, state.trail[i].y);
      ctx.stroke();
    }
  }

  // ── Cookie + aim UI ──
  if (state.phase === 'aim') {
    ctx.font = '20px serif';
    ctx.textAlign = 'center';

    if (state.dragging) {
      const dx = C.launcherX - state.dragX;
      const dy = launcherY - state.dragY;
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), C.maxDrag);
      const ang = Math.atan2(dy, dx);

      // Rubber bands
      ctx.strokeStyle = '#c89050';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(C.launcherX - 8, launcherY - 10);
      ctx.lineTo(state.dragX, state.dragY);
      ctx.moveTo(C.launcherX + 8, launcherY - 10);
      ctx.lineTo(state.dragX, state.dragY);
      ctx.stroke();

      // Power bar
      const power = dist / C.maxDrag;
      ctx.fillStyle = power > 0.7 ? '#ef4444' : power > 0.4 ? '#ffd700' : '#4ade80';
      ctx.fillRect(10, H - 16, power * 50, 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(10, H - 16, 50, 5);

      // Trajectory preview — limited frames, does NOT include wind
      const pvx = Math.cos(ang) * dist * C.powerScale;
      const pvy = Math.sin(ang) * dist * C.powerScale;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      let ppx = C.launcherX, ppy = launcherY, svx = pvx, svy = pvy;
      ctx.moveTo(ppx, ppy);
      for (let t = 0; t < C.previewMaxFrames; t++) {
        ppx += svx; ppy += svy;
        svy += C.gravity;
        if (ppy > GY || ppx > W || ppx < 0) break;
        ctx.lineTo(ppx, ppy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Cookie at drag point
      ctx.fillText('🍪', state.dragX, state.dragY + 2);
    } else {
      ctx.fillText('🍪', C.launcherX, launcherY + 2);
    }
  } else if (state.phase === 'flight' || state.phase === 'rolling') {
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍪', state.px, state.py + 2);
  } else if (state.phase === 'scored') {
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍪', state.px, state.py + 2);

    const lastScore = state.roundScores[state.roundScores.length - 1];
    if (lastScore !== undefined) {
      ctx.font = 'bold 14px sans-serif';
      const isTrick = state.wallBounced && lastScore > 0;
      ctx.fillStyle = lastScore >= C.bullseyePoints ? '#ffd700' :
                      lastScore >= C.greatPoints ? '#4ade80' :
                      lastScore > 0 ? '#60a5fa' : '#ef4444';
      const label = lastScore >= C.bullseyePoints ? 'BULLSEYE!' :
                    lastScore >= C.greatPoints ? 'Great!' :
                    lastScore > 0 ? 'OK' : 'Miss!';
      const trickLabel = isTrick ? ' TRICKSHOT!' : '';
      ctx.fillText(`${label}${trickLabel} +${lastScore}`, state.px, state.py - 18);
    }
  }
},

_launchBind(state, C, snd, initRound, render, launcherY, updateWindParticles) {
  const canvas = state.canvas;
  if (!canvas) return;
  const W = C.canvasWidth, GY = C.groundY;
  const halfOb = C.obstacleWidth / 2;

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = C.canvasWidth / rect.width;
    const scaleY = C.canvasHeight / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const nextRound = () => {
    state.round++;
    if (state.round >= C.rounds) {
      this._launchFinish(state, C);
    } else {
      initRound();
      render();
    }
  };

  // Obstacle collision check — returns true if collided (and adjusts velocity)
  const checkObstacle = () => {
    if (!state.obstacle) return false;
    const ob = state.obstacle;
    const obLeft = ob.x - halfOb;
    const obRight = ob.x + halfOb;
    const obTop = GY - ob.height;

    // Only check if cookie is within obstacle X range and below its top
    if (state.px >= obLeft - 6 && state.px <= obRight + 6 && state.py >= obTop) {
      // Determine which side we hit from
      const fromLeft = state.vx > 0 && state.px <= ob.x;
      const fromRight = state.vx < 0 && state.px >= ob.x;
      if (fromLeft || fromRight) {
        state.vx = -state.vx * C.wallBounce;
        state.px = fromLeft ? obLeft - 7 : obRight + 7;
        state.wallBounced = true;
        snd.launchBounce();
        return true;
      }
      // Hit from top
      if (state.vy > 0 && state.py <= obTop + 8) {
        state.vy = -state.vy * C.bounceRestitution;
        state.py = obTop - 1;
        snd.launchBounce();
        return true;
      }
    }
    return false;
  };

  const onStart = (e) => {
    if (state.phase !== 'aim') return;
    e.preventDefault();
    state.dragging = true;
    const p = getPos(e);
    state.dragX = p.x;
    state.dragY = p.y;
    this._launchDraw(state, C, launcherY);
  };

  let lastStretchTick = 0;
  const onMove = (e) => {
    if (!state.dragging || state.phase !== 'aim') return;
    e.preventDefault();
    const p = getPos(e);
    state.dragX = p.x;
    state.dragY = p.y;

    // Stretch sound — throttled, pitch scales with power
    const now = Date.now();
    if (now - lastStretchTick > 80) {
      const dx2 = C.launcherX - state.dragX;
      const dy2 = launcherY - state.dragY;
      const d = Math.min(Math.sqrt(dx2 * dx2 + dy2 * dy2), C.maxDrag);
      if (d > 15) {
        snd.launchStretch(d / C.maxDrag);
        lastStretchTick = now;
      }
    }

    this._launchDraw(state, C, launcherY);
  };

  const onEnd = () => {
    if (!state.dragging || state.phase !== 'aim') return;
    state.dragging = false;

    const dx = C.launcherX - state.dragX;
    const dy = launcherY - state.dragY;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), C.maxDrag);

    if (dist < 15) {
      this._launchDraw(state, C, launcherY);
      return;
    }

    const ang = Math.atan2(dy, dx);
    state.vx = Math.cos(ang) * dist * C.powerScale;
    state.vy = Math.sin(ang) * dist * C.powerScale;
    state.px = C.launcherX;
    state.py = launcherY;
    state.trail = [{ x: state.px, y: state.py }];
    state.bounces = 0;
    state.wallBounced = false;
    // Cancel aim animation loop before starting flight
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
    state.phase = 'flight';
    snd.launchFire();
    // Wind whoosh — intensity based on wind strength
    const windStr = Math.min(1, Math.abs(state.wind) / 0.06);
    snd.launchWindWhoosh(windStr);

    const hint = document.getElementById('launch-hint');
    if (hint) hint.textContent = '';

    const scoreAndEnd = () => {
      state.phase = 'scored';
      const hitDist = Math.abs(state.px - state.targetX);
      let pts = C.missPoints;
      if (hitDist <= C.bullseyeRadius) { pts = C.bullseyePoints; snd.launchBullseye(); }
      else if (hitDist <= C.greatRadius) { pts = C.greatPoints; snd.launchHit(); }
      else if (hitDist <= C.okRadius) { pts = C.okPoints; snd.launchHit(); }
      else { snd.launchMiss(); }

      // Trickshot bonus for wall bounces
      if (state.wallBounced && pts > 0) {
        pts += C.trickshotBonus;
      }

      state.roundScores.push(pts);
      state.totalScore += pts;
      this._launchDraw(state, C, launcherY);
      setTimeout(nextRound, 1400);
    };

    const step = () => {
      if (state.phase !== 'flight' && state.phase !== 'rolling') return;
      updateWindParticles();

      if (state.phase === 'flight') {
        state.vx += state.wind;
        state.vy += C.gravity;
        state.px += state.vx;
        state.py += state.vy;
        state.trail.push({ x: state.px, y: state.py });

        // Wall bounces (left and right)
        if (state.px <= 6) {
          state.px = 6;
          state.vx = Math.abs(state.vx) * C.wallBounce;
          state.wallBounced = true;
          snd.launchBounce();
        } else if (state.px >= W - 6) {
          state.px = W - 6;
          state.vx = -Math.abs(state.vx) * C.wallBounce;
          state.wallBounced = true;
          snd.launchBounce();
        }

        // Obstacle collision
        checkObstacle();

        // Ground bounce
        if (state.py >= GY) {
          state.py = GY;
          state.bounces++;

          if (Math.abs(state.vy) > 1.5 && state.bounces <= C.maxBounces) {
            state.vy = -state.vy * C.bounceRestitution;
            state.vx *= C.bounceFriction;
            snd.launchBounce();
          } else {
            state.vy = 0;
            state.phase = 'rolling';
          }
        }
      }

      if (state.phase === 'rolling') {
        state.vx *= C.rollFriction;
        state.px += state.vx;
        state.py = GY;

        // Wall bounces while rolling
        if (state.px <= 6) {
          state.px = 6;
          state.vx = Math.abs(state.vx) * C.wallBounce;
          state.wallBounced = true;
        } else if (state.px >= W - 6) {
          state.px = W - 6;
          state.vx = -Math.abs(state.vx) * C.wallBounce;
          state.wallBounced = true;
        }

        // Obstacle collision while rolling
        if (state.obstacle) {
          const ob = state.obstacle;
          const obLeft = ob.x - halfOb;
          const obRight = ob.x + halfOb;
          if (state.px >= obLeft - 6 && state.px <= obRight + 6) {
            state.vx = -state.vx * C.wallBounce;
            state.px = state.vx > 0 ? obRight + 7 : obLeft - 7;
            state.wallBounced = true;
          }
        }

        // Stopped?
        if (Math.abs(state.vx) < C.rollStopThreshold) {
          state.vx = 0;
          scoreAndEnd();
          return;
        }
      }

      this._launchDraw(state, C, launcherY);
      state.animFrame = requestAnimationFrame(step);
    };

    state.animFrame = requestAnimationFrame(step);
  };

  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);

  state._cleanup = () => {
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchend', onEnd);
  };
  this._activeCleanup = () => state._cleanup();
},

_launchFinish(state, C) {
  if (state._cleanup) state._cleanup();
  const score = state.totalScore;
  let tier = null;
  if (score >= C.legendaryThreshold) tier = 'legendary';
  else if (score >= C.epicThreshold) tier = 'epic';
  else if (score >= C.greatThreshold) tier = 'great';
  else if (score >= C.normalThreshold) tier = 'normal';

  const tierLabels = { legendary: 'LEGENDARY!', epic: 'EPIC!', great: 'GREAT!', normal: 'Nice!' };

  let rewardHtml = '';
  if (tier) {
    let reward = this._giveReward(tier, 'cookieLaunch');
    // Cookie Launch has higher payouts due to skill ceiling (bounce prediction, wind, obstacles)
    const launchBonus = Math.floor(reward * 0.5);
    this.game.cookies = this.game.cookies.add(launchBonus);
    this.game.stats.totalCookiesBaked = this.game.stats.totalCookiesBaked.add(launchBonus);
    this.game.updateCookieCount();
    this.game.achievementManager.check();
    reward += launchBonus;
    rewardHtml = `<div class="mini-reward">+${formatNumberInWords(reward)} cookies</div>`;
  }

  const roundDetails = state.roundScores.map((s) => {
    const base = s > C.trickshotBonus ? s - C.trickshotBonus : s;
    const isTrick = s > 0 && s !== base;
    const label = base >= C.bullseyePoints ? 'Bullseye' : base >= C.greatPoints ? 'Great' : base > 0 ? 'OK' : 'Miss';
    return `<span class="launch-round-score">${label} ${s}${isTrick ? ' (trick!)' : ''}</span>`;
  }).join('');

  this._show(`<div class="mini-game-card launch-card">
    <div class="mini-title">Cookie Launch</div>
    <div class="launch-result">
      <div class="launch-result-tier">${tier ? tierLabels[tier] : 'Keep practicing!'}</div>
      <div class="launch-result-total">Total: ${score} pts</div>
      <div class="launch-round-scores">${roundDetails}</div>
      ${rewardHtml}
    </div>
  </div>`);
  setTimeout(() => this._close(), C.resultDisplayMs);
}

};
