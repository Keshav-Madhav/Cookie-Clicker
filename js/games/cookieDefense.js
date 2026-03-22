import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** CookieDefense mixin */
export const CookieDefenseMixin = {
/* ════════════════════════════════════════════════════════════
   🛡️  COOKIE DEFENSE  — Mini Tower Defense!
   Place towers strategically, defend against critters!
   ════════════════════════════════════════════════════════════ */
_cookieDefense() {
  const cfg = MINI_GAME_SETTINGS.cookieDefense;
  
  // Generate a random path through the grid
  const path = this._generateDefensePath(cfg.gridCols, cfg.gridRows);
  
  // Fixed number of towers allowed
  const towersAllowed = cfg.towersAllowed;
  
  // Build grid HTML
  let gridHtml = '';
  const pathSet = new Set(path.map(p => `${p.x},${p.y}`));
  for (let y = 0; y < cfg.gridRows; y++) {
    for (let x = 0; x < cfg.gridCols; x++) {
      const isPath = pathSet.has(`${x},${y}`);
      const isStart = path[0].x === x && path[0].y === y;
      const isEnd = path[path.length - 1].x === x && path[path.length - 1].y === y;
      let cellClass = 'td-cell';
      if (isPath) cellClass += ' td-path';
      if (isStart) cellClass += ' td-start';
      if (isEnd) cellClass += ' td-end';
      gridHtml += `<div class="${cellClass}" data-x="${x}" data-y="${y}">${isStart ? '🚪' : isEnd ? '🍪' : ''}</div>`;
    }
  }

  // Tower selection buttons with detailed stats
  const towerBtns = cfg.towers.map(t => 
    `<button class="td-tower-btn" data-tower="${t.id}" style="--tower-color: ${t.color}">
      <div class="td-tower-header">
        <span class="td-tower-emoji">${t.emoji}</span>
        <span class="td-tower-name">${t.name}</span>
      </div>
      <div class="td-tower-desc">${t.desc}</div>
      <div class="td-tower-details">${t.details}</div>
    </button>`
  ).join('');

  const overlay = this._show(`
    <div class="mini-game-card mini-td-card">
      <div class="mini-title">🛡️ Cookie Defense!</div>
      <div class="td-phase-indicator" id="td-phase-indicator">
        <span class="td-phase-icon">📋</span>
        <span class="td-phase-text" id="td-phase">PLANNING PHASE</span>
      </div>
      <div class="td-instructions" id="td-instructions">
        <strong>How to play:</strong> Select a tower type below, then click on a <span class="td-highlight">brown cell</span> (not the path) to place it. Click a placed tower to remove it.
      </div>
      <div class="td-stats">
        <span class="td-stat">🍪 <span id="td-lives">${cfg.startingLives}</span></span>
        <span class="td-stat">🗼 <span id="td-towers-left">${towersAllowed}</span></span>
        <span class="td-stat">🐛 <span id="td-enemies">0</span>/${cfg.totalEnemies}</span>
      </div>
      <div class="td-tower-select" id="td-tower-select">${towerBtns}</div>
      <div class="td-grid-wrapper">
        <div class="td-grid" id="td-grid" style="grid-template-columns: repeat(${cfg.gridCols}, 1fr);">${gridHtml}</div>
        <div class="td-projectiles" id="td-projectiles"></div>
      </div>
      <div class="td-controls" id="td-controls">
        <button class="td-start-btn" id="td-start-btn">⚔️ Start Battle!</button>
      </div>
      <div class="mini-timer-bar"><div class="mini-timer-fill" id="td-timer"></div></div>
      <div class="mini-result" id="td-result"></div>
    </div>
  `);
  if (!overlay) return;

  let phase = 'planning';
  let lives = cfg.startingLives;
  let towersLeft = towersAllowed;
  let selectedTower = null;
  let placedTowers = [];
  let enemies = [];
  let enemiesSpawned = 0;
  let enemiesKilled = 0;
  let active = true;
  let battleLoop = null;
  let spawnInterval = null;
  let lastTime = 0;

  // Start planning timer
  const planTimerBar = document.getElementById('td-timer');
  if (planTimerBar) {
    planTimerBar.style.transition = `width ${cfg.planningPhaseMs / 1000}s linear`;
    planTimerBar.style.width = '0%';
  }

  const updateStats = () => {
    const livesEl = document.getElementById('td-lives');
    const towersEl = document.getElementById('td-towers-left');
    const enemiesEl = document.getElementById('td-enemies');
    if (livesEl) livesEl.textContent = lives;
    if (towersEl) towersEl.textContent = towersLeft;
    if (enemiesEl) enemiesEl.textContent = enemiesKilled;
  };

  // Tower selection
  overlay.querySelectorAll('.td-tower-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (phase !== 'planning') return;
      this.game.soundManager.defenseSelectTower();

      overlay.querySelectorAll('.td-tower-btn').forEach(b => b.classList.remove('td-selected'));
      btn.classList.add('td-selected');
      selectedTower = btn.dataset.tower;
      
      // Show range preview on grid
      const towerType = cfg.towers.find(t => t.id === selectedTower);
      overlay.querySelectorAll('.td-cell').forEach(cell => {
        cell.classList.remove('td-in-range');
      });
    });
  });

  // Grid cell click - place or remove tower
  overlay.querySelectorAll('.td-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      if (phase !== 'planning') return;

      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);

      // Click on existing tower = remove it
      if (cell.classList.contains('td-has-tower')) {
        cell.classList.remove('td-has-tower');
        cell.style.removeProperty('--tower-color');
        cell.innerHTML = '';
        placedTowers = placedTowers.filter(t => t.x !== x || t.y !== y);
        towersLeft++;
        updateStats();
        this.game.soundManager.uiClick();
        return;
      }

      if (!selectedTower || towersLeft <= 0) return;
      if (cell.classList.contains('td-path')) return;

      const towerType = cfg.towers.find(t => t.id === selectedTower);
      if (!towerType) return;

      this.game.soundManager.defensePlaceTower();
      cell.classList.add('td-has-tower');
      cell.style.setProperty('--tower-color', towerType.color);
      cell.innerHTML = `
        <span class="td-placed-tower">${towerType.emoji}</span>
        <div class="td-tower-range" style="--range: ${towerType.range}"></div>
      `;
      placedTowers.push({ x, y, type: towerType, element: cell, lastFired: 0 });

      towersLeft--;
      updateStats();

      overlay.querySelectorAll('.td-tower-btn').forEach(b => b.classList.remove('td-selected'));
      selectedTower = null;
    });
  });

  // Start battle button
  const startBtn = document.getElementById('td-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (placedTowers.length === 0) {
        const resultEl = document.getElementById('td-result');
        if (resultEl) {
          resultEl.textContent = '⚠️ Place at least one tower first!';
          setTimeout(() => { if (resultEl.textContent.includes('Place')) resultEl.textContent = ''; }, 2000);
        }
        return;
      }
      startBattle();
    });
  }

  const startBattle = () => {
    if (phase === 'battle') return;
    phase = 'battle';
    this.game.soundManager.defenseBattleStart();

    const phaseEl = document.getElementById('td-phase');
    const phaseIndicator = document.getElementById('td-phase-indicator');
    const instrEl = document.getElementById('td-instructions');
    const selectEl = document.getElementById('td-tower-select');
    const controlsEl = document.getElementById('td-controls');
    
    if (phaseEl) phaseEl.textContent = 'BATTLE!';
    if (phaseIndicator) phaseIndicator.classList.add('td-battle-phase');
    if (instrEl) instrEl.innerHTML = 'Towers attack automatically. Protect your cookies!';
    if (selectEl) selectEl.style.visibility = 'hidden';
    if (controlsEl) controlsEl.style.visibility = 'hidden';

    // Hide timer bar — battle ends when all enemies are dealt with
    const timerBar = document.getElementById('td-timer');
    if (timerBar) timerBar.style.display = 'none';

    spawnInterval = setInterval(spawnEnemy, cfg.enemySpawnIntervalMs);
    spawnEnemy();

    lastTime = performance.now();
    battleLoop = requestAnimationFrame(updateBattle);
  };

  const spawnEnemy = () => {
    if (!active || enemiesSpawned >= cfg.totalEnemies) return;

    const enemyType = cfg.enemies[Math.floor(Math.random() * cfg.enemies.length)];
    const grid = document.getElementById('td-grid');
    if (!grid) return;

    const enemy = document.createElement('div');
    enemy.className = 'td-enemy';
    enemy.innerHTML = `
      <span class="td-enemy-sprite">${enemyType.emoji}</span>
      <div class="td-enemy-health-bar">
        <div class="td-enemy-health-fill" style="width: 100%"></div>
      </div>
    `;
    
    const startCell = path[0];
    const cellWidth = 100 / cfg.gridCols;
    const cellHeight = 100 / cfg.gridRows;
    enemy.style.left = `${startCell.x * cellWidth + cellWidth / 2}%`;
    enemy.style.top = `${startCell.y * cellHeight + cellHeight / 2}%`;
    
    grid.appendChild(enemy);
    
    enemies.push({
      element: enemy,
      healthBar: enemy.querySelector('.td-enemy-health-fill'),
      pathIndex: 0,
      pathProgress: 0,
      health: enemyType.health,
      maxHealth: enemyType.health,
      speed: enemyType.speed * cfg.enemyBaseSpeed,
      type: enemyType
    });
    
    enemiesSpawned++;
  };

  const createProjectile = (fromX, fromY, toX, toY, color) => {
    const projectiles = document.getElementById('td-projectiles');
    if (!projectiles) return;
    
    const proj = document.createElement('div');
    proj.className = 'td-projectile';
    proj.style.setProperty('--from-x', `${fromX}%`);
    proj.style.setProperty('--from-y', `${fromY}%`);
    proj.style.setProperty('--to-x', `${toX}%`);
    proj.style.setProperty('--to-y', `${toY}%`);
    proj.style.background = color;
    projectiles.appendChild(proj);
    
    setTimeout(() => proj.remove(), 200);
  };

  const updateBattle = (currentTime) => {
    if (!active || phase !== 'battle') return;

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    const cellWidth = 100 / cfg.gridCols;
    const cellHeight = 100 / cfg.gridRows;

    // Move enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      
      if (enemy.pathIndex >= path.length - 1) {
        lives--;
        this.game.soundManager.defenseLifeLost();
        enemy.element.classList.add('td-enemy-escaped');
        setTimeout(() => enemy.element.remove(), 300);
        enemies.splice(i, 1);
        updateStats();
        
        if (lives <= 0) {
          endBattle();
          return;
        }
        continue;
      }

      enemy.pathProgress += enemy.speed * deltaTime;
      
      while (enemy.pathProgress >= 1 && enemy.pathIndex < path.length - 1) {
        enemy.pathProgress -= 1;
        enemy.pathIndex++;
      }

      const currentCell = path[enemy.pathIndex];
      const nextCell = path[Math.min(enemy.pathIndex + 1, path.length - 1)];
      const progress = Math.min(enemy.pathProgress, 1);
      
      const x = currentCell.x + (nextCell.x - currentCell.x) * progress;
      const y = currentCell.y + (nextCell.y - currentCell.y) * progress;
      
      enemy.element.style.left = `${x * cellWidth + cellWidth / 2}%`;
      enemy.element.style.top = `${y * cellHeight + cellHeight / 2}%`;
      enemy.x = x;
      enemy.y = y;
    }

    // Towers attack
    placedTowers.forEach(tower => {
      if (currentTime - tower.lastFired < tower.type.fireRate) return;
      
      let closestEnemy = null;
      let closestDist = Infinity;
      
      enemies.forEach(enemy => {
        if (enemy.x === undefined) return;
        const dx = enemy.x - tower.x;
        const dy = enemy.y - tower.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= tower.type.range && dist < closestDist) {
          closestDist = dist;
          closestEnemy = enemy;
        }
      });

      if (closestEnemy) {
        tower.lastFired = currentTime;
        this.game.soundManager.defenseTowerFire();

        // Visual effects
        tower.element.classList.add('td-tower-fire');
        setTimeout(() => tower.element.classList.remove('td-tower-fire'), 100);

        // Projectile
        const towerX = tower.x * cellWidth + cellWidth / 2;
        const towerY = tower.y * cellHeight + cellHeight / 2;
        const enemyX = closestEnemy.x * cellWidth + cellWidth / 2;
        const enemyY = closestEnemy.y * cellHeight + cellHeight / 2;
        createProjectile(towerX, towerY, enemyX, enemyY, tower.type.color);

        // Damage
        closestEnemy.health -= tower.type.damage;
        this.game.soundManager.defenseEnemyHit();
        closestEnemy.element.classList.add('td-enemy-hit');
        setTimeout(() => closestEnemy.element.classList.remove('td-enemy-hit'), 100);
        
        // Update health bar
        const healthPct = Math.max(0, (closestEnemy.health / closestEnemy.maxHealth) * 100);
        if (closestEnemy.healthBar) {
          closestEnemy.healthBar.style.width = `${healthPct}%`;
        }
        
        if (closestEnemy.health <= 0) {
          this.game.soundManager.defenseEnemyDestroyed();
          enemiesKilled++;
          closestEnemy.element.classList.add('td-enemy-dead');
          setTimeout(() => closestEnemy.element.remove(), 200);
          enemies = enemies.filter(e => e !== closestEnemy);
          updateStats();
        }
      }
    });

    // End when all enemies spawned and none remain on board
    if (enemiesSpawned >= cfg.totalEnemies && enemies.length === 0) {
      endBattle();
      return;
    }

    if (active) {
      battleLoop = requestAnimationFrame(updateBattle);
    }
  };

  const endBattle = () => {
    active = false;
    phase = 'ended';
    clearInterval(spawnInterval);
    cancelAnimationFrame(battleLoop);
    
    this._finishCookieDefense(lives, cfg);
  };

  // Auto-start battle after planning phase
  const planningTimer = setTimeout(() => {
    if (active && phase === 'planning') {
      startBattle();
    }
  }, cfg.planningPhaseMs);

  // Register cleanup for ESC
  this._activeCleanup = () => {
    active = false;
    clearTimeout(planningTimer);
    if (spawnInterval) clearInterval(spawnInterval);
    if (battleLoop) cancelAnimationFrame(battleLoop);
  };
},

_generateDefensePath(cols, rows) {
  const path = [];
  let x = 0;
  let y = Math.floor(Math.random() * (rows - 2)) + 1; // Random start row (not edges)
  
  path.push({ x, y });
  
  let lastDir = 'right';
  
  while (x < cols - 1) {
    const canUp = y > 0 && lastDir !== 'down';
    const canDown = y < rows - 1 && lastDir !== 'up';
    
    const rand = Math.random();
    
    if (rand < 0.5) {
      x++;
      lastDir = 'right';
    } else if (rand < 0.7 && canUp) {
      y--;
      lastDir = 'up';
    } else if (rand < 0.9 && canDown) {
      y++;
      lastDir = 'down';
    } else {
      x++;
      lastDir = 'right';
    }
    
    const last = path[path.length - 1];
    if (last.x !== x || last.y !== y) {
      path.push({ x, y });
    }
  }
  
  return path;
},

_finishCookieDefense(lives, cfg) {
  this.game.soundManager.defenseBattleResult();
  const resultEl = document.getElementById('td-result');
  let tier = null;
  let msg = '';

  if (lives <= 0) {
    msg = '😱 All cookies stolen!';
  } else if (lives >= cfg.legendaryLives) {
    tier = 'legendary';
    msg = '🏆 PERFECT DEFENSE!';
  } else if (lives >= cfg.epicLives) {
    tier = 'epic';
    msg = '⭐ EPIC! Almost perfect!';
  } else if (lives >= cfg.greatLives) {
    tier = 'great';
    msg = '🛡️ Great defense!';
  } else if (lives >= cfg.normalLives) {
    tier = 'normal';
    msg = '👍 Cookies defended!';
  }

  if (tier) {
    const r = this._giveReward(tier, 'cookieDefense');
    if (resultEl) {
      resultEl.textContent = `${msg} +${formatNumberInWords(r)} cookies!`;
      resultEl.classList.add('mini-win');
    }
  } else {
    if (resultEl) resultEl.textContent = msg;
  }

  setTimeout(() => this._close(), cfg.resultDisplayMs);
}

};
