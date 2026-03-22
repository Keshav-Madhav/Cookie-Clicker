import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** CookieCutter mixin */
export const CookieCutterMixin = {
/* ════════════════════════════════════════════════════════════
   ✂️  COOKIE CUTTER  — Drawing/Tracing game!
   Draw over the dashed outline - closer = higher score!
   ════════════════════════════════════════════════════════════ */
_cookieCutter() {
  const cfg = MINI_GAME_SETTINGS.cookieCutter;
  const durationSec = cfg.durationMs / 1000;
  const size = cfg.canvasSize;
  
  // Pick a random shape
  const shapeName = cfg.shapes[Math.floor(Math.random() * cfg.shapes.length)];

  const overlay = this._show(`
    <div class="mini-game-card mini-cutter-card">
      <div class="mini-title">✂️ Cookie Cutter! <span class="mini-sub">Draw the ${shapeName}!</span></div>
      <div class="cutter-instructions">
        Draw over the dashed line. The closer you trace, the higher your score!
      </div>
      <div class="cutter-stats">
        <span>Accuracy: <span id="cutter-accuracy" class="cutter-accuracy-value">--</span>%</span>
        <span>Coverage: <span id="cutter-coverage">0</span>%</span>
      </div>
      <div class="cutter-canvas-wrap" id="cutter-wrap">
        <canvas id="cutter-canvas" width="${size}" height="${size}"></canvas>
      </div>
      <div class="mini-timer-bar"><div class="mini-timer-fill" id="cutter-timer"></div></div>
      <div class="mini-result" id="cutter-result"></div>
    </div>
  `);
  if (!overlay) return;

  const canvas = document.getElementById('cutter-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Generate path points for the shape
  const pathPoints = this._generateShapePath(shapeName, size, cfg.pathResolution);
  
  let active = true;
  let isDrawing = false;
  let userPath = []; // Store all user drawing points
  let lastPos = null;
  
  // For scoring
  const pointScores = new Array(pathPoints.length).fill(null); // null = not covered, 0-1 = accuracy
  
  // Cookie texture (generate once)
  const texturePoints = [];
  for (let i = 0; i < 30; i++) {
    texturePoints.push({
      x: Math.random() * size,
      y: Math.random() * size,
      r: 2 + Math.random() * 5
    });
  }

  // Draw everything
  const drawAll = () => {
    ctx.clearRect(0, 0, size, size);
    
    // Draw cookie background
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(0, 0, size, size);
    
    // Draw subtle cookie texture
    ctx.fillStyle = 'rgba(139, 90, 43, 0.15)';
    texturePoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw the dashed shape outline
    ctx.strokeStyle = '#5a3921';
    ctx.lineWidth = cfg.shapeLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([12, 8]); // Dashed line
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    if (!pathPoints._open) ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]); // Reset
    
    // Draw user's path with color coding based on accuracy
    if (userPath.length > 1) {
      ctx.lineWidth = cfg.drawLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      for (let i = 1; i < userPath.length; i++) {
        const prev = userPath[i - 1];
        const curr = userPath[i];
        
        // Color based on accuracy (green = good, yellow = ok, red = bad)
        const accuracy = curr.accuracy;
        let color;
        if (accuracy >= 0.8) {
          color = '#22c55e'; // Green
        } else if (accuracy >= 0.5) {
          color = '#eab308'; // Yellow
        } else if (accuracy >= 0.2) {
          color = '#f97316'; // Orange
        } else {
          color = '#ef4444'; // Red
        }
        
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
    }
  };

  const updateStats = () => {
    const accuracyEl = document.getElementById('cutter-accuracy');
    const coverageEl = document.getElementById('cutter-coverage');
    
    // Calculate coverage (how many path points have been traced near)
    const coveredPoints = pointScores.filter(s => s !== null).length;
    const coverage = Math.round((coveredPoints / pathPoints.length) * 100);
    if (coverageEl) coverageEl.textContent = coverage;
    
    // Calculate average accuracy of covered points
    const scores = pointScores.filter(s => s !== null);
    if (scores.length > 0) {
      const avgAccuracy = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
      if (accuracyEl) {
        accuracyEl.textContent = avgAccuracy;
        // Color code the accuracy
        if (avgAccuracy >= 75) accuracyEl.style.color = '#22c55e';
        else if (avgAccuracy >= 50) accuracyEl.style.color = '#eab308';
        else accuracyEl.style.color = '#ef4444';
      }
    }
  };

  const getCanvasPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const scorePoint = (pos) => {
    // Find closest path point and calculate accuracy
    let minDist = Infinity;
    let closestIdx = -1;
    
    for (let i = 0; i < pathPoints.length; i++) {
      const dx = pos.x - pathPoints[i].x;
      const dy = pos.y - pathPoints[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    
    // Calculate accuracy (1 = perfect, 0 = at max distance)
    const accuracy = Math.max(0, 1 - (minDist / cfg.maxScoringDistance));
    
    // Update the score for nearby path points
    for (let i = Math.max(0, closestIdx - 1); i <= Math.min(pathPoints.length - 1, closestIdx + 1); i++) {
      if (pointScores[i] === null || accuracy > pointScores[i]) {
        pointScores[i] = accuracy;
      }
    }
    
    return accuracy;
  };

  const handleMove = (e) => {
    if (!active || !isDrawing) return;
    e.preventDefault();

    const pos = getCanvasPos(e);
    const accuracy = scorePoint(pos);

    userPath.push({ x: pos.x, y: pos.y, accuracy });
    lastPos = pos;
    this.game.soundManager.cutterDrawStroke();

    drawAll();
    updateStats();
  };

  const handleStart = (e) => {
    if (!active) return;
    e.preventDefault();
    
    isDrawing = true;
    const pos = getCanvasPos(e);
    const accuracy = scorePoint(pos);
    userPath.push({ x: pos.x, y: pos.y, accuracy });
    lastPos = pos;
    
    drawAll();
    updateStats();
  };

  const handleEnd = () => {
    isDrawing = false;
    lastPos = null;
  };

  // Event listeners
  canvas.addEventListener('mousedown', handleStart);
  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('mouseup', handleEnd);
  canvas.addEventListener('mouseleave', handleEnd);
  canvas.addEventListener('touchstart', handleStart, { passive: false });
  canvas.addEventListener('touchmove', handleMove, { passive: false });
  canvas.addEventListener('touchend', handleEnd);

  // Initial draw
  drawAll();

  // Start timer
  requestAnimationFrame(() => {
    const bar = document.getElementById("cutter-timer");
    if (bar) { bar.style.transition = `width ${durationSec}s linear`; bar.style.width = "0%"; }
  });

  // Time's up
  const cutterEndTimer = setTimeout(() => {
    if (active) {
      active = false;
      this._finishCookieCutter(pointScores, cfg);
    }
  }, cfg.durationMs);
  this._activeCleanup = () => { active = false; clearTimeout(cutterEndTimer); };
},

_generateShapePath(shapeName, size, resolution) {
  const points = [];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  
  switch (shapeName) {
    case 'circle':
      for (let i = 0; i < resolution; i++) {
        const angle = (i / resolution) * Math.PI * 2;
        points.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r
        });
      }
      break;
      
    case 'star':
      const starPoints = 5;
      const innerR = r * 0.4;
      for (let i = 0; i < resolution; i++) {
        const angle = (i / resolution) * Math.PI * 2 - Math.PI / 2;
        const pointIndex = (i / resolution) * starPoints * 2;
        const isOuter = Math.floor(pointIndex) % 2 === 0;
        const currentR = isOuter ? r : innerR;
        const nextIsOuter = Math.floor(pointIndex + 1) % 2 === 0;
        const nextR = nextIsOuter ? r : innerR;
        const t = pointIndex % 1;
        const interpR = currentR + (nextR - currentR) * t;
        points.push({
          x: cx + Math.cos(angle) * interpR,
          y: cy + Math.sin(angle) * interpR
        });
      }
      break;
      
    case 'heart':
      for (let i = 0; i < resolution; i++) {
        const t = (i / resolution) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        points.push({
          x: cx + x * (r / 17),
          y: cy + y * (r / 17)
        });
      }
      break;
      
    case 'umbrella': {
      // Dome arc (top half semicircle, from left to right)
      const domeY = cy - r * 0.15;
      for (let i = 0; i <= resolution * 0.5; i++) {
        const angle = Math.PI + (i / (resolution * 0.5)) * Math.PI;
        points.push({
          x: cx + Math.cos(angle) * r,
          y: domeY + Math.sin(angle) * r * 0.7
        });
      }
      // Handle (straight line down from center of dome)
      const umbHandleTop = domeY;
      const umbHandleBottom = cy + r * 0.85;
      for (let i = 0; i <= resolution * 0.3; i++) {
        const t = i / (resolution * 0.3);
        points.push({
          x: cx,
          y: umbHandleTop + t * (umbHandleBottom - umbHandleTop)
        });
      }
      // Hook curve at bottom
      for (let i = 0; i <= resolution * 0.2; i++) {
        const angle = -Math.PI / 2 + (i / (resolution * 0.2)) * Math.PI;
        points.push({
          x: cx - r * 0.15 + Math.cos(angle) * r * 0.15,
          y: umbHandleBottom + Math.sin(angle) * r * 0.15
        });
      }
      // Mark as open shape (no closePath)
      points._open = true;
      break;
    }
      
    case 'triangle':
      const triPoints = [
        { x: cx, y: cy - r },
        { x: cx + r * 0.87, y: cy + r * 0.5 },
        { x: cx - r * 0.87, y: cy + r * 0.5 }
      ];
      const perSide = Math.floor(resolution / 3);
      for (let side = 0; side < 3; side++) {
        const start = triPoints[side];
        const end = triPoints[(side + 1) % 3];
        for (let i = 0; i < perSide; i++) {
          const t = i / perSide;
          points.push({
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          });
        }
      }
      break;
      
    case 'diamond':
      const diamondPts = [
        { x: cx, y: cy - r },        // top
        { x: cx + r * 0.7, y: cy },  // right
        { x: cx, y: cy + r },        // bottom
        { x: cx - r * 0.7, y: cy }   // left
      ];
      const perDiamondSide = Math.floor(resolution / 4);
      for (let side = 0; side < 4; side++) {
        const start = diamondPts[side];
        const end = diamondPts[(side + 1) % 4];
        for (let i = 0; i < perDiamondSide; i++) {
          const t = i / perDiamondSide;
          points.push({
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          });
        }
      }
      break;
      
    case 'hexagon':
      for (let i = 0; i < resolution; i++) {
        const angle = (i / resolution) * Math.PI * 2 - Math.PI / 2;
        const segment = Math.floor((i / resolution) * 6);
        const segmentAngle = (segment / 6) * Math.PI * 2 - Math.PI / 2;
        const nextSegmentAngle = ((segment + 1) / 6) * Math.PI * 2 - Math.PI / 2;
        const segmentProgress = ((i / resolution) * 6) % 1;
        
        const x1 = cx + Math.cos(segmentAngle) * r;
        const y1 = cy + Math.sin(segmentAngle) * r;
        const x2 = cx + Math.cos(nextSegmentAngle) * r;
        const y2 = cy + Math.sin(nextSegmentAngle) * r;
        
        points.push({
          x: x1 + (x2 - x1) * segmentProgress,
          y: y1 + (y2 - y1) * segmentProgress
        });
      }
      break;
      
    case 'crescent':
      // Outer arc (larger)
      for (let i = 0; i < resolution * 0.7; i++) {
        const angle = Math.PI * 0.2 + (i / (resolution * 0.7)) * Math.PI * 1.6;
        points.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r
        });
      }
      // Inner arc (smaller, offset) going back
      for (let i = 0; i < resolution * 0.3; i++) {
        const angle = Math.PI * 1.8 - (i / (resolution * 0.3)) * Math.PI * 1.6;
        const innerR = r * 0.6;
        const offsetX = r * 0.3;
        points.push({
          x: cx + offsetX + Math.cos(angle) * innerR,
          y: cy + Math.sin(angle) * innerR
        });
      }
      break;
      
    case 'flower':
      const petals = 5;
      const innerFlowerR = r * 0.4;
      for (let i = 0; i < resolution; i++) {
        const angle = (i / resolution) * Math.PI * 2;
        const petalPhase = (angle * petals) % (Math.PI * 2);
        const petalR = innerFlowerR + (r - innerFlowerR) * Math.pow(Math.sin(petalPhase / 2), 2);
        points.push({
          x: cx + Math.cos(angle) * petalR,
          y: cy + Math.sin(angle) * petalR
        });
      }
      break;
      
    case 'cross':
      const armWidth = r * 0.35;
      const crossPts = [
        { x: cx - armWidth, y: cy - r },      // top-left of top arm
        { x: cx + armWidth, y: cy - r },      // top-right of top arm
        { x: cx + armWidth, y: cy - armWidth }, // inner top-right
        { x: cx + r, y: cy - armWidth },      // right arm top
        { x: cx + r, y: cy + armWidth },      // right arm bottom
        { x: cx + armWidth, y: cy + armWidth }, // inner bottom-right
        { x: cx + armWidth, y: cy + r },      // bottom-right of bottom arm
        { x: cx - armWidth, y: cy + r },      // bottom-left of bottom arm
        { x: cx - armWidth, y: cy + armWidth }, // inner bottom-left
        { x: cx - r, y: cy + armWidth },      // left arm bottom
        { x: cx - r, y: cy - armWidth },      // left arm top
        { x: cx - armWidth, y: cy - armWidth }  // inner top-left
      ];
      const perCrossSide = Math.floor(resolution / 12);
      for (let side = 0; side < 12; side++) {
        const start = crossPts[side];
        const end = crossPts[(side + 1) % 12];
        for (let i = 0; i < perCrossSide; i++) {
          const t = i / perCrossSide;
          points.push({
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t
          });
        }
      }
      break;
  }
  
  return points;
},

_finishCookieCutter(pointScores, cfg) {
  this.game.soundManager.cutterShapeComplete();
  const resultEl = document.getElementById('cutter-result');
  
  // Calculate final score
  const coveredPoints = pointScores.filter(s => s !== null);
  const coverage = coveredPoints.length / pointScores.length;
  const avgAccuracy = coveredPoints.length > 0 
    ? coveredPoints.reduce((a, b) => a + b, 0) / coveredPoints.length 
    : 0;
  
  // Final score combines coverage and accuracy
  const finalScore = Math.round((coverage * 0.4 + avgAccuracy * 0.6) * 100);
  
  // Track best accuracy for achievement
  if (finalScore > (this.game.stats.cutterBestAccuracy || 0)) {
    this.game.stats.cutterBestAccuracy = finalScore;
  }

  // Easter egg: perfectionist (99% accuracy)
  if (finalScore === 99 && this.game.tutorial) {
    this.game.tutorial.triggerEvent('perfectionist99');
  }

  let tier = null;
  let msg = '';

  if (finalScore >= cfg.legendaryThreshold) {
    tier = 'legendary';
    msg = `🏆 LEGENDARY! ${finalScore}% score!`;
  } else if (finalScore >= cfg.epicThreshold) {
    tier = 'epic';
    msg = `⭐ EPIC! ${finalScore}% score!`;
  } else if (finalScore >= cfg.greatThreshold) {
    tier = 'great';
    msg = `✂️ Great! ${finalScore}% score!`;
  } else if (finalScore >= cfg.normalThreshold) {
    tier = 'normal';
    msg = `🍪 Not bad! ${finalScore}% score`;
  } else {
    msg = `😅 ${finalScore}% - Keep practicing!`;
  }

  if (tier) {
    const r = this._giveReward(tier, 'cookieCutter');
    if (resultEl) {
      resultEl.textContent = `${msg} +${formatNumberInWords(r)} cookies!`;
      resultEl.classList.add('mini-win');
    }
  } else {
    if (resultEl) resultEl.textContent = msg;
  }

  this.game.achievementManager.check();
  setTimeout(() => this._close(), cfg.resultDisplayMs);
}

};
