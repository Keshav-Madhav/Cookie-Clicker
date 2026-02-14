/**
 * Canvas-drawn icons for each building type.
 * Each function draws a unique icon on a given canvas context.
 * Call getBuildingIcon(name, size) to get a <canvas> element with the icon.
 */

const iconCache = new Map();

/** Get (or create) a canvas icon for a building */
export function getBuildingIcon(buildingName, size = 48) {
  const key = `${buildingName}_${size}`;
  const dpr = window.devicePixelRatio || 1;

  if (!iconCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const drawFn = iconDrawers[buildingName];
    if (drawFn) {
      drawFn(ctx, size);
    } else {
      drawDefaultIcon(ctx, size);
    }
    iconCache.set(key, canvas);
  }

  // Create a fresh canvas and copy the cached pixels onto it
  const src = iconCache.get(key);
  const copy = document.createElement('canvas');
  copy.width = src.width;
  copy.height = src.height;
  copy.style.width = `${size}px`;
  copy.style.height = `${size}px`;
  copy.getContext('2d').drawImage(src, 0, 0);
  return copy;
}

/** Clear the cache (e.g. on DPR change) */
export function clearIconCache() {
  iconCache.clear();
}

/* ─── Helper functions ─── */

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function star(ctx, cx, cy, outerR, innerR, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Draw a mini cookie at (x,y) with given radius */
function miniCookie(ctx, x, y, r) {
  // Cookie body
  circle(ctx, x, y, r);
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
  g.addColorStop(0, '#e8b84c');
  g.addColorStop(1, '#c49030');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#a07020';
  ctx.lineWidth = Math.max(0.5, r * 0.12);
  ctx.stroke();
  // Chocolate chips
  ctx.fillStyle = '#5a3818';
  const chips = [
    [-0.35, -0.3], [0.3, 0.15], [-0.1, 0.35], [0.25, -0.35]
  ];
  chips.forEach(([cx2, cy2]) => {
    circle(ctx, x + r * cx2, y + r * cy2, r * 0.15);
    ctx.fill();
  });
}

/* ─── Individual building icon drawers ─── */

const iconDrawers = {

  /* ── Cursor ── Mechanical clicking hand */
  Cursor(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Robotic arm base
    ctx.fillStyle = '#888';
    roundRect(ctx, cx - 5 * sc, cy + 8 * sc, 10 * sc, 16 * sc, 2 * sc);
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1 * sc;
    ctx.stroke();

    // Mechanical joint
    circle(ctx, cx, cy + 8 * sc, 4 * sc);
    ctx.fillStyle = '#999';
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1 * sc;
    ctx.stroke();
    // Bolt detail
    circle(ctx, cx, cy + 8 * sc, 1.5 * sc);
    ctx.fillStyle = '#bbb';
    ctx.fill();

    // Finger pressing down
    ctx.save();
    ctx.translate(cx, cy + 4 * sc);
    ctx.rotate(-0.1);
    // Finger body
    roundRect(ctx, -4 * sc, -18 * sc, 8 * sc, 18 * sc, 3 * sc);
    ctx.fillStyle = '#aaa';
    ctx.fill();
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 1 * sc;
    ctx.stroke();
    // Finger segments
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.8 * sc;
    ctx.beginPath(); ctx.moveTo(-3 * sc, -6 * sc); ctx.lineTo(3 * sc, -6 * sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3 * sc, -12 * sc); ctx.lineTo(3 * sc, -12 * sc); ctx.stroke();
    // Fingertip
    circle(ctx, 0, -18 * sc, 4 * sc);
    ctx.fillStyle = '#bbb';
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.stroke();
    ctx.restore();

    // Cookie being clicked
    miniCookie(ctx, cx, cy - 16 * sc, 5 * sc);

    // Click impact lines
    ctx.strokeStyle = 'rgba(255,215,0,0.6)';
    ctx.lineWidth = 1 * sc;
    const impacts = [[-8, -18], [8, -18], [-10, -12], [10, -12]];
    impacts.forEach(([ix, iy]) => {
      ctx.beginPath();
      ctx.moveTo(cx + ix * sc, cy + iy * sc);
      ctx.lineTo(cx + ix * 1.5 * sc, cy + iy * 1.3 * sc);
      ctx.stroke();
    });
  },

  /* ── Grandma ── with cookie in hand */
  Grandma(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Hair (gray bun)
    circle(ctx, cx, cy - 6 * sc, 11 * sc);
    ctx.fillStyle = '#c0b0a0';
    ctx.fill();

    // Face
    circle(ctx, cx, cy - 2 * sc, 9 * sc);
    ctx.fillStyle = '#f5d5b8';
    ctx.fill();

    // Glasses
    ctx.strokeStyle = '#6a5040';
    ctx.lineWidth = 1.3 * sc;
    circle(ctx, cx - 4 * sc, cy - 3 * sc, 3 * sc);
    ctx.stroke();
    circle(ctx, cx + 4 * sc, cy - 3 * sc, 3 * sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 1 * sc, cy - 3 * sc);
    ctx.lineTo(cx + 1 * sc, cy - 3 * sc);
    ctx.stroke();

    // Smile
    ctx.beginPath();
    ctx.arc(cx, cy - 0.5 * sc, 4 * sc, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = '#a07060';
    ctx.lineWidth = 1 * sc;
    ctx.stroke();

    // Hair bun on top
    circle(ctx, cx, cy - 15 * sc, 5 * sc);
    ctx.fillStyle = '#b0a090';
    ctx.fill();

    // Body / apron
    ctx.beginPath();
    ctx.moveTo(cx - 10 * sc, cy + 7 * sc);
    ctx.quadraticCurveTo(cx, cy + 4 * sc, cx + 10 * sc, cy + 7 * sc);
    ctx.lineTo(cx + 12 * sc, cy + 20 * sc);
    ctx.lineTo(cx - 12 * sc, cy + 20 * sc);
    ctx.closePath();
    ctx.fillStyle = '#8b6f5e';
    ctx.fill();

    // Apron
    ctx.beginPath();
    ctx.moveTo(cx - 7 * sc, cy + 8 * sc);
    ctx.lineTo(cx + 7 * sc, cy + 8 * sc);
    ctx.lineTo(cx + 8 * sc, cy + 20 * sc);
    ctx.lineTo(cx - 8 * sc, cy + 20 * sc);
    ctx.closePath();
    ctx.fillStyle = '#f0e6d8';
    ctx.fill();

    // Arm holding out a cookie
    ctx.strokeStyle = '#f5d5b8';
    ctx.lineWidth = 3 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 10 * sc, cy + 10 * sc);
    ctx.quadraticCurveTo(cx + 16 * sc, cy + 6 * sc, cx + 17 * sc, cy + 2 * sc);
    ctx.stroke();

    // Cookie in hand
    miniCookie(ctx, cx + 17 * sc, cy - 1 * sc, 4 * sc);
  },

  /* ── Farm ── */
  Farm(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, cy);
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(1, '#c8e8ff');
    roundRect(ctx, 2 * sc, 2 * sc, s - 4 * sc, s / 2 - 2 * sc, 3 * sc);
    ctx.fillStyle = sky;
    ctx.fill();

    // Ground
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(2 * sc, cy, s - 4 * sc, s / 2 - 2 * sc);

    // Furrows
    ctx.strokeStyle = '#6b4f10';
    ctx.lineWidth = 1 * sc;
    for (let i = 0; i < 4; i++) {
      const y = cy + 5 * sc + i * 5 * sc;
      ctx.beginPath();
      ctx.moveTo(4 * sc, y);
      ctx.lineTo(s - 4 * sc, y);
      ctx.stroke();
    }

    // Cookie plants (3)
    for (let i = 0; i < 3; i++) {
      const px = 10 * sc + i * 14 * sc;
      const py = cy - 2 * sc;
      // Stem
      ctx.strokeStyle = '#2d8a2d';
      ctx.lineWidth = 1.5 * sc;
      ctx.beginPath();
      ctx.moveTo(px, cy + 3 * sc);
      ctx.lineTo(px, py - 4 * sc);
      ctx.stroke();
      // Leaf
      ctx.fillStyle = '#3cb43c';
      ctx.beginPath();
      ctx.ellipse(px + 3 * sc, py, 3 * sc, 1.5 * sc, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Cookie fruit
      circle(ctx, px, py - 6 * sc, 3.5 * sc);
      ctx.fillStyle = '#d4a043';
      ctx.fill();
      ctx.strokeStyle = '#a07830';
      ctx.lineWidth = 0.7 * sc;
      ctx.stroke();
      // Chips
      circle(ctx, px - 1 * sc, py - 7 * sc, 0.8 * sc);
      ctx.fillStyle = '#6b4520';
      ctx.fill();
      circle(ctx, px + 1 * sc, py - 5 * sc, 0.8 * sc);
      ctx.fill();
    }
  },

  /* ── Factory ── */
  Factory(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Main building
    roundRect(ctx, 6 * sc, 16 * sc, 36 * sc, 26 * sc, 2 * sc);
    ctx.fillStyle = '#7a6050';
    ctx.fill();
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 1.2 * sc;
    ctx.stroke();

    // Roof — saw-tooth
    ctx.beginPath();
    ctx.moveTo(4 * sc, 18 * sc);
    for (let i = 0; i < 3; i++) {
      const bx = 4 * sc + i * 14 * sc;
      ctx.lineTo(bx + 7 * sc, 6 * sc);
      ctx.lineTo(bx + 14 * sc, 18 * sc);
    }
    ctx.closePath();
    ctx.fillStyle = '#8b7260';
    ctx.fill();
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 1 * sc;
    ctx.stroke();

    // Chimney
    ctx.fillStyle = '#6a5040';
    ctx.fillRect(34 * sc, 4 * sc, 6 * sc, 14 * sc);

    // Smoke puffs
    ctx.fillStyle = 'rgba(200,200,200,0.5)';
    circle(ctx, 37 * sc, 3 * sc, 3 * sc); ctx.fill();
    circle(ctx, 39 * sc, -1 * sc, 2.5 * sc); ctx.fill();
    circle(ctx, 36 * sc, -3 * sc, 2 * sc); ctx.fill();

    // Windows
    ctx.fillStyle = '#ffd870';
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillRect(10 * sc + c * 10 * sc, 22 * sc + r * 9 * sc, 5 * sc, 4 * sc);
      }
    }

    // Door
    ctx.fillStyle = '#50382a';
    roundRect(ctx, 20 * sc, 33 * sc, 8 * sc, 9 * sc, 1 * sc);
    ctx.fill();

    // Cookie on conveyor belt coming out
    miniCookie(ctx, 14 * sc, 38 * sc, 3 * sc);
    miniCookie(ctx, 36 * sc, 38 * sc, 2.5 * sc);
  },

  /* ── Mine ── Big tunnel entrance */
  Mine(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Rock face / cliff
    roundRect(ctx, 2 * sc, 2 * sc, s - 4 * sc, s - 4 * sc, 4 * sc);
    ctx.fillStyle = '#6a5a42';
    ctx.fill();

    // Rock texture layers
    ctx.strokeStyle = '#5a4a32';
    ctx.lineWidth = 0.8 * sc;
    for (let i = 0; i < 5; i++) {
      const y = 6 * sc + i * 9 * sc;
      ctx.beginPath();
      ctx.moveTo(4 * sc, y);
      ctx.quadraticCurveTo(cx + (i % 2 ? 4 : -4) * sc, y + 3 * sc, s - 4 * sc, y);
      ctx.stroke();
    }

    // Big dark tunnel opening
    ctx.beginPath();
    ctx.arc(cx, cy + 4 * sc, 14 * sc, Math.PI, 0);
    ctx.lineTo(cx + 14 * sc, s - 6 * sc);
    ctx.lineTo(cx - 14 * sc, s - 6 * sc);
    ctx.closePath();
    const tunnelGrad = ctx.createRadialGradient(cx, cy + 4 * sc, 2 * sc, cx, cy + 4 * sc, 14 * sc);
    tunnelGrad.addColorStop(0, '#0a0604');
    tunnelGrad.addColorStop(1, '#1a1008');
    ctx.fillStyle = tunnelGrad;
    ctx.fill();

    // Tunnel arch stones
    ctx.strokeStyle = '#8a7a60';
    ctx.lineWidth = 2.5 * sc;
    ctx.beginPath();
    ctx.arc(cx, cy + 4 * sc, 14 * sc, Math.PI, 0);
    ctx.stroke();

    // Arch keystone details
    ctx.fillStyle = '#7a6a50';
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI + (i * Math.PI) / 7 + Math.PI / 14;
      const bx = cx + 14 * sc * Math.cos(angle);
      const by = cy + 4 * sc + 14 * sc * Math.sin(angle);
      ctx.fillRect(bx - 1.5 * sc, by - 1.5 * sc, 3 * sc, 3 * sc);
    }

    // Rails going into tunnel
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.2 * sc;
    // Left rail
    ctx.beginPath();
    ctx.moveTo(cx - 12 * sc, s - 2 * sc);
    ctx.lineTo(cx - 4 * sc, cy + 8 * sc);
    ctx.stroke();
    // Right rail
    ctx.beginPath();
    ctx.moveTo(cx + 12 * sc, s - 2 * sc);
    ctx.lineTo(cx + 4 * sc, cy + 8 * sc);
    ctx.stroke();
    // Cross ties
    for (let i = 0; i < 3; i++) {
      const t = 0.25 + i * 0.25;
      const lx = cx - 12 * sc + t * 8 * sc;
      const rx = cx + 12 * sc - t * 8 * sc;
      const ty = s - 2 * sc + t * (cy + 8 * sc - s + 2 * sc);
      ctx.beginPath();
      ctx.moveTo(lx - 1 * sc, ty);
      ctx.lineTo(rx + 1 * sc, ty);
      ctx.stroke();
    }

    // Lantern glow at tunnel top
    const lanternGlow = ctx.createRadialGradient(cx, cy - 6 * sc, 0, cx, cy - 6 * sc, 6 * sc);
    lanternGlow.addColorStop(0, 'rgba(255,200,80,0.5)');
    lanternGlow.addColorStop(1, 'rgba(255,160,40,0)');
    circle(ctx, cx, cy - 6 * sc, 6 * sc);
    ctx.fillStyle = lanternGlow;
    ctx.fill();
    // Lantern
    ctx.fillStyle = '#ffc040';
    ctx.fillRect(cx - 1.5 * sc, cy - 10 * sc, 3 * sc, 4 * sc);

    // Cookie ore embedded in rock wall
    miniCookie(ctx, 6 * sc, 10 * sc, 3.5 * sc);
    miniCookie(ctx, s - 8 * sc, 14 * sc, 3 * sc);
  },

  /* ── Shipment ── */
  Shipment(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Starry space background
    ctx.fillStyle = '#0a0a2a';
    roundRect(ctx, 2 * sc, 2 * sc, s - 4 * sc, s - 4 * sc, 4 * sc);
    ctx.fill();
    // Stars
    ctx.fillStyle = '#fff';
    const starPositions = [[8,8],[35,6],[12,38],[40,30],[20,10],[30,40],[42,15],[6,28]];
    starPositions.forEach(([x, y]) => {
      circle(ctx, x * sc, y * sc, 0.7 * sc);
      ctx.fill();
    });

    // Rocket body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.3);
    // Fuselage
    ctx.beginPath();
    ctx.moveTo(0, -14 * sc);
    ctx.quadraticCurveTo(6 * sc, -8 * sc, 6 * sc, 6 * sc);
    ctx.lineTo(-6 * sc, 6 * sc);
    ctx.quadraticCurveTo(-6 * sc, -8 * sc, 0, -14 * sc);
    ctx.closePath();
    ctx.fillStyle = '#e8e0d0';
    ctx.fill();
    ctx.strokeStyle = '#8a7a6a';
    ctx.lineWidth = 1 * sc;
    ctx.stroke();

    // Nose cone
    ctx.beginPath();
    ctx.moveTo(0, -14 * sc);
    ctx.quadraticCurveTo(3 * sc, -11 * sc, 3 * sc, -8 * sc);
    ctx.lineTo(-3 * sc, -8 * sc);
    ctx.quadraticCurveTo(-3 * sc, -11 * sc, 0, -14 * sc);
    ctx.fillStyle = '#c8463c';
    ctx.fill();

    // Window — a cookie peeking through
    miniCookie(ctx, 0, -2 * sc, 2.8 * sc);

    // Fins
    ctx.fillStyle = '#c8463c';
    ctx.beginPath();
    ctx.moveTo(-6 * sc, 4 * sc);
    ctx.lineTo(-10 * sc, 10 * sc);
    ctx.lineTo(-4 * sc, 6 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6 * sc, 4 * sc);
    ctx.lineTo(10 * sc, 10 * sc);
    ctx.lineTo(4 * sc, 6 * sc);
    ctx.closePath();
    ctx.fill();

    // Flame
    ctx.fillStyle = '#ff9020';
    ctx.beginPath();
    ctx.moveTo(-3 * sc, 6 * sc);
    ctx.quadraticCurveTo(0, 16 * sc, 3 * sc, 6 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.moveTo(-1.5 * sc, 6 * sc);
    ctx.quadraticCurveTo(0, 12 * sc, 1.5 * sc, 6 * sc);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  /* ── Alchemy Lab ── */
  'Alchemy Lab'(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Flask body
    ctx.beginPath();
    ctx.moveTo(cx - 4 * sc, 8 * sc);
    ctx.lineTo(cx - 4 * sc, 18 * sc);
    ctx.quadraticCurveTo(cx - 16 * sc, 28 * sc, cx - 14 * sc, 38 * sc);
    ctx.lineTo(cx + 14 * sc, 38 * sc);
    ctx.quadraticCurveTo(cx + 16 * sc, 28 * sc, cx + 4 * sc, 18 * sc);
    ctx.lineTo(cx + 4 * sc, 8 * sc);
    ctx.closePath();
    ctx.fillStyle = 'rgba(160,220,255,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#80b0d0';
    ctx.lineWidth = 1.5 * sc;
    ctx.stroke();

    // Liquid inside
    ctx.beginPath();
    ctx.moveTo(cx - 12 * sc, 30 * sc);
    ctx.quadraticCurveTo(cx, 26 * sc, cx + 12 * sc, 30 * sc);
    ctx.lineTo(cx + 13 * sc, 38 * sc);
    ctx.lineTo(cx - 13 * sc, 38 * sc);
    ctx.closePath();
    ctx.fillStyle = '#9040cc';
    ctx.fill();

    // Bubbles
    ctx.fillStyle = 'rgba(200,160,255,0.6)';
    circle(ctx, cx - 4 * sc, 33 * sc, 2 * sc); ctx.fill();
    circle(ctx, cx + 5 * sc, 31 * sc, 1.5 * sc); ctx.fill();
    circle(ctx, cx, 28 * sc, 1 * sc); ctx.fill();

    // Flask opening ring
    ctx.strokeStyle = '#80b0d0';
    ctx.lineWidth = 2 * sc;
    ctx.beginPath();
    ctx.moveTo(cx - 5 * sc, 8 * sc);
    ctx.lineTo(cx + 5 * sc, 8 * sc);
    ctx.stroke();

    // Gold sparkles
    ctx.fillStyle = '#ffd700';
    star(ctx, cx - 8 * sc, 14 * sc, 3 * sc, 1.2 * sc, 4);
    ctx.fill();
    star(ctx, cx + 10 * sc, 20 * sc, 2.5 * sc, 1 * sc, 4);
    ctx.fill();
    star(ctx, cx, 5 * sc, 2 * sc, 0.8 * sc, 4);
    ctx.fill();

    // Gold cookie floating above flask
    miniCookie(ctx, cx + 12 * sc, 10 * sc, 3.5 * sc);
  },

  /* ── Portal ── */
  Portal(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, 4 * sc, cx, cy, 20 * sc);
    glow.addColorStop(0, 'rgba(160,60,220,0.6)');
    glow.addColorStop(0.5, 'rgba(100,20,180,0.3)');
    glow.addColorStop(1, 'rgba(60,0,120,0)');
    circle(ctx, cx, cy, 20 * sc);
    ctx.fillStyle = glow;
    ctx.fill();

    // Portal ring
    ctx.strokeStyle = '#b060e0';
    ctx.lineWidth = 3 * sc;
    circle(ctx, cx, cy, 14 * sc);
    ctx.stroke();

    // Inner swirl portal
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12 * sc);
    inner.addColorStop(0, '#220044');
    inner.addColorStop(0.4, '#4a0088');
    inner.addColorStop(1, '#8030c0');
    circle(ctx, cx, cy, 12 * sc);
    ctx.fillStyle = inner;
    ctx.fill();

    // Swirl lines
    ctx.strokeStyle = 'rgba(200,140,255,0.5)';
    ctx.lineWidth = 1.2 * sc;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const startAngle = (i * Math.PI * 2) / 3;
      for (let t = 0; t < 1; t += 0.02) {
        const angle = startAngle + t * Math.PI * 2;
        const r = t * 11 * sc;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Center cookie swirling in the portal
    miniCookie(ctx, cx, cy, 4 * sc);
  },

  /* ── Time Machine ── Cookie clock face */
  'Time Machine'(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Clock body (outer rim)
    circle(ctx, cx, cy, 17 * sc);
    ctx.fillStyle = '#3a3040';
    ctx.fill();
    ctx.strokeStyle = '#b8a060';
    ctx.lineWidth = 2 * sc;
    ctx.stroke();

    // Cookie as the clock face!
    circle(ctx, cx, cy, 14 * sc);
    const cookieFace = ctx.createRadialGradient(cx - 3 * sc, cy - 3 * sc, 0, cx, cy, 14 * sc);
    cookieFace.addColorStop(0, '#e8b84c');
    cookieFace.addColorStop(1, '#c49030');
    ctx.fillStyle = cookieFace;
    ctx.fill();

    // Chocolate chip hour markers
    ctx.fillStyle = '#5a3818';
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
      const mx = cx + 11 * sc * Math.cos(angle);
      const my = cy + 11 * sc * Math.sin(angle);
      circle(ctx, mx, my, 1.3 * sc);
      ctx.fill();
    }

    // Extra chips scattered on cookie face
    ctx.fillStyle = '#5a3818';
    circle(ctx, cx - 5 * sc, cy + 3 * sc, 1.5 * sc); ctx.fill();
    circle(ctx, cx + 3 * sc, cy - 5 * sc, 1.2 * sc); ctx.fill();
    circle(ctx, cx + 6 * sc, cy + 5 * sc, 1 * sc); ctx.fill();

    // Hour hand
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 2.2 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const hAngle = -Math.PI / 3;
    ctx.lineTo(cx + 7 * sc * Math.cos(hAngle), cy + 7 * sc * Math.sin(hAngle));
    ctx.stroke();

    // Minute hand
    ctx.lineWidth = 1.5 * sc;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const mAngle = Math.PI / 6;
    ctx.lineTo(cx + 10 * sc * Math.cos(mAngle), cy + 10 * sc * Math.sin(mAngle));
    ctx.stroke();

    // Center cap
    circle(ctx, cx, cy, 1.8 * sc);
    ctx.fillStyle = '#b8a060';
    ctx.fill();

    // Time vortex swirls around
    ctx.strokeStyle = 'rgba(100,180,255,0.4)';
    ctx.lineWidth = 1.5 * sc;
    ctx.beginPath();
    ctx.arc(cx, cy, 20 * sc, -0.5, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 21 * sc, 2, 3.2);
    ctx.stroke();

    // Lightning sparks
    ctx.strokeStyle = 'rgba(100,200,255,0.6)';
    ctx.lineWidth = 1 * sc;
    ctx.beginPath();
    ctx.moveTo(cx + 18 * sc, cy - 8 * sc);
    ctx.lineTo(cx + 16 * sc, cy - 4 * sc);
    ctx.lineTo(cx + 20 * sc, cy - 3 * sc);
    ctx.lineTo(cx + 17 * sc, cy + 2 * sc);
    ctx.stroke();
  },

  /* ── Antimatter Condenser ── */
  'Antimatter Condenser'(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Dark background aura
    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22 * sc);
    aura.addColorStop(0, '#1a0030');
    aura.addColorStop(0.6, '#0d001a');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    circle(ctx, cx, cy, 22 * sc);
    ctx.fillStyle = aura;
    ctx.fill();

    // Atom rings
    ctx.strokeStyle = 'rgba(0,200,255,0.5)';
    ctx.lineWidth = 1.2 * sc;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 16 * sc, 6 * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Nucleus glow
    const nGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6 * sc);
    nGlow.addColorStop(0, '#ff4060');
    nGlow.addColorStop(0.5, '#cc2040');
    nGlow.addColorStop(1, 'rgba(200,0,40,0)');
    circle(ctx, cx, cy, 6 * sc);
    ctx.fillStyle = nGlow;
    ctx.fill();

    // Core
    circle(ctx, cx, cy, 3 * sc);
    ctx.fillStyle = '#ff6080';
    ctx.fill();

    // Cookie electrons orbiting!
    const electrons = [[-14, 3], [10, -8], [4, 12]];
    electrons.forEach(([ex, ey]) => {
      miniCookie(ctx, cx + ex * sc, cy + ey * sc, 2.5 * sc);
    });

    // Energy sparks
    ctx.strokeStyle = 'rgba(255,100,150,0.4)';
    ctx.lineWidth = 0.8 * sc;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI * 2) / 6;
      ctx.beginPath();
      ctx.moveTo(cx + 5 * sc * Math.cos(angle), cy + 5 * sc * Math.sin(angle));
      ctx.lineTo(cx + 9 * sc * Math.cos(angle), cy + 9 * sc * Math.sin(angle));
      ctx.stroke();
    }
  },

  /* ── Prism ── Triangle cookie that refracts light */
  Prism(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Triangle cookie shape
    ctx.beginPath();
    ctx.moveTo(cx, 6 * sc);
    ctx.lineTo(cx + 17 * sc, 38 * sc);
    ctx.lineTo(cx - 17 * sc, 38 * sc);
    ctx.closePath();
    const cookieGrad = ctx.createLinearGradient(cx, 6 * sc, cx, 38 * sc);
    cookieGrad.addColorStop(0, '#e8b84c');
    cookieGrad.addColorStop(1, '#c49030');
    ctx.fillStyle = cookieGrad;
    ctx.fill();
    ctx.strokeStyle = '#a07020';
    ctx.lineWidth = 1.5 * sc;
    ctx.stroke();

    // Chocolate chips on cookie triangle
    ctx.fillStyle = '#5a3818';
    const chipPositions = [
      [0, -8], [-5, 6], [5, 6], [0, 2], [-8, 12], [8, 12], [0, 14], [-3, -2], [3, 10]
    ];
    chipPositions.forEach(([cx2, cy2]) => {
      circle(ctx, cx + cx2 * sc, cy + cy2 * sc, 1.3 * sc);
      ctx.fill();
    });

    // Cookie surface texture – subtle baked edge
    ctx.strokeStyle = 'rgba(160,112,32,0.3)';
    ctx.lineWidth = 0.6 * sc;
    ctx.beginPath();
    ctx.moveTo(cx - 10 * sc, 28 * sc);
    ctx.lineTo(cx + 10 * sc, 28 * sc);
    ctx.stroke();

    // Incoming white light beam
    ctx.strokeStyle = '#ffffee';
    ctx.lineWidth = 2.5 * sc;
    ctx.beginPath();
    ctx.moveTo(2 * sc, cy - 4 * sc);
    ctx.lineTo(cx - 6 * sc, cy + 2 * sc);
    ctx.stroke();

    // Rainbow output beams
    const colors = ['#ff0000', '#ff8000', '#ffff00', '#00cc00', '#0066ff', '#8000ff'];
    colors.forEach((color, i) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3 * sc;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + 6 * sc, cy + 2 * sc);
      const endY = cy - 10 * sc + i * 6 * sc;
      ctx.lineTo(s - 3 * sc, endY);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Glassy shine
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(cx - 2 * sc, 10 * sc);
    ctx.lineTo(cx + 4 * sc, 10 * sc);
    ctx.lineTo(cx + 10 * sc, 30 * sc);
    ctx.lineTo(cx, 30 * sc);
    ctx.closePath();
    ctx.fill();
  },

  /* ── Chancemaker ── */
  Chancemaker(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Four-leaf clover
    ctx.fillStyle = '#2ecc40';
    const petalR = 8 * sc;
    const offsets = [
      [0, -petalR * 0.7],
      [0, petalR * 0.7],
      [-petalR * 0.7, 0],
      [petalR * 0.7, 0],
    ];
    offsets.forEach(([ox, oy]) => {
      circle(ctx, cx + ox, cy - 4 * sc + oy, petalR);
      ctx.fill();
    });

    // Darker vein centers
    ctx.fillStyle = '#27ae36';
    offsets.forEach(([ox, oy]) => {
      circle(ctx, cx + ox, cy - 4 * sc + oy, petalR * 0.5);
      ctx.fill();
    });

    // Stem
    ctx.strokeStyle = '#1a8c28';
    ctx.lineWidth = 2.5 * sc;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4 * sc);
    ctx.quadraticCurveTo(cx + 3 * sc, cy + 14 * sc, cx - 2 * sc, cy + 22 * sc);
    ctx.stroke();

    // Sparkles / stars
    ctx.fillStyle = '#ffd700';
    star(ctx, cx + 14 * sc, cy - 14 * sc, 3.5 * sc, 1.4 * sc, 4);
    ctx.fill();
    star(ctx, cx - 12 * sc, cy - 10 * sc, 2.5 * sc, 1 * sc, 4);
    ctx.fill();
    star(ctx, cx + 10 * sc, cy + 8 * sc, 2 * sc, 0.8 * sc, 4);
    ctx.fill();

    // Lucky golden cookie at clover center
    miniCookie(ctx, cx, cy - 4 * sc, 3.5 * sc);
  },

  /* ── Fractal Engine ── */
  'Fractal Engine'(ctx, s) {
    const cx = s / 2, cy = s / 2;
    const sc = s / 48;

    // Draw nested cookies (fractal-like)
    function drawCookie(x, y, r, depth) {
      if (depth <= 0 || r < 2) return;

      // Cookie circle
      circle(ctx, x, y, r);
      const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
      grad.addColorStop(0, '#e8b84c');
      grad.addColorStop(1, '#c49030');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#a07020';
      ctx.lineWidth = Math.max(0.5, r * 0.08);
      ctx.stroke();

      // Chocolate chips
      if (r > 3) {
        ctx.fillStyle = '#5a3818';
        const chipCount = Math.min(depth + 1, 5);
        for (let i = 0; i < chipCount; i++) {
          const angle = (i * Math.PI * 2) / chipCount + 0.4;
          const cr = r * 0.55;
          circle(ctx, x + cr * Math.cos(angle), y + cr * Math.sin(angle), r * 0.12);
          ctx.fill();
        }
      }

      // Recursive smaller cookies
      if (depth > 1) {
        const subR = r * 0.35;
        const subDist = r * 0.42;
        for (let i = 0; i < 3; i++) {
          const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
          drawCookie(
            x + subDist * Math.cos(angle),
            y + subDist * Math.sin(angle),
            subR,
            depth - 1
          );
        }
      }
    }

    drawCookie(cx, cy, 18 * sc, 3);

    // Infinity symbol hint
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 1.5 * sc;
    ctx.beginPath();
    ctx.moveTo(cx - 6 * sc, s - 6 * sc);
    ctx.bezierCurveTo(cx - 12 * sc, s - 12 * sc, cx - 2 * sc, s - 12 * sc, cx, s - 6 * sc);
    ctx.bezierCurveTo(cx + 2 * sc, s - 12 * sc, cx + 12 * sc, s - 12 * sc, cx + 6 * sc, s - 6 * sc);
    ctx.stroke();
  },
};

/* ── Default fallback icon ── */
function drawDefaultIcon(ctx, s) {
  const cx = s / 2, cy = s / 2;
  const sc = s / 48;
  circle(ctx, cx, cy, 14 * sc);
  ctx.fillStyle = '#d4a040';
  ctx.fill();
  ctx.strokeStyle = '#a07020';
  ctx.lineWidth = 1.5 * sc;
  ctx.stroke();

  // Chocolate chips
  ctx.fillStyle = '#5a3818';
  circle(ctx, cx - 4 * sc, cy - 3 * sc, 2 * sc); ctx.fill();
  circle(ctx, cx + 5 * sc, cy + 1 * sc, 2 * sc); ctx.fill();
  circle(ctx, cx - 1 * sc, cy + 5 * sc, 1.8 * sc); ctx.fill();
  circle(ctx, cx + 2 * sc, cy - 6 * sc, 1.5 * sc); ctx.fill();
}

/* ════════════════════════════════════════════════════════════════
   Row background drawers — wide panoramic scenes per building type
   drawn in the same quirky canvas style as the icons.
   Called via getRowBackground(name, width, height).
   ════════════════════════════════════════════════════════════════ */

const rowBgCache = new Map();

/** Get (or create) a canvas row background for a building type */
export function getRowBackground(buildingName, w, h) {
  const dpr = window.devicePixelRatio || 1;
  const key = `${buildingName}_${w}_${h}_${dpr}`;
  if (rowBgCache.has(key)) return rowBgCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const drawFn = rowBgDrawers[buildingName];
  if (drawFn) {
    drawFn(ctx, w, h);
  } else {
    drawDefaultRowBg(ctx, w, h);
  }
  rowBgCache.set(key, canvas);
  return canvas;
}

/** Clear row bg cache (on resize) */
export function clearRowBgCache() {
  rowBgCache.clear();
}

/* ─── Row background drawers ─── */

const rowBgDrawers = {

  /* ── Cursor: Tech desk with monitors & keyboards ── */
  Cursor(ctx, w, h) {
    // Dark desk background
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, w, h);

    // Desk surface
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, h * 0.6, w, h * 0.4);

    // Grid lines (matrix/tech feel)
    ctx.strokeStyle = 'rgba(0,255,136,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 10) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Monitors scattered along desk
    const monitorCount = Math.floor(w / 80);
    for (let i = 0; i < monitorCount; i++) {
      const mx = 20 + i * 70 + Math.sin(i * 2.3) * 15;
      const my = h * 0.25;
      const mw = 30, mh = 20;
      // Monitor body
      roundRect(ctx, mx, my, mw, mh, 2);
      ctx.fillStyle = '#2a2a3e';
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Screen
      ctx.fillStyle = i % 3 === 0 ? '#0a2a1a' : i % 3 === 1 ? '#1a0a2a' : '#0a1a2a';
      ctx.fillRect(mx + 2, my + 2, mw - 4, mh - 5);
      // Green text lines
      ctx.fillStyle = 'rgba(0,255,100,0.3)';
      for (let l = 0; l < 3; l++) {
        const lw = 8 + Math.sin(i + l) * 6;
        ctx.fillRect(mx + 4, my + 4 + l * 4, lw, 1.5);
      }
      // Stand
      ctx.fillStyle = '#444';
      ctx.fillRect(mx + mw / 2 - 2, my + mh, 4, 6);
      ctx.fillRect(mx + mw / 2 - 6, my + mh + 5, 12, 2);
    }

    // Scattered mouse cursors
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < Math.floor(w / 100); i++) {
      const cx2 = 50 + i * 95;
      const cy2 = h * 0.7 + Math.sin(i * 3) * 5;
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(cx2, cy2 + 10);
      ctx.lineTo(cx2 + 4, cy2 + 7);
      ctx.lineTo(cx2 + 7, cy2 + 12);
      ctx.lineTo(cx2 + 9, cy2 + 11);
      ctx.lineTo(cx2 + 6, cy2 + 6);
      ctx.lineTo(cx2 + 10, cy2 + 5);
      ctx.closePath();
      ctx.fill();
    }
  },

  /* ── Grandma: Bakery kitchen with shelves & pies ── */
  Grandma(ctx, w, h) {
    // Warm bakery wall
    ctx.fillStyle = '#5a3a28';
    ctx.fillRect(0, 0, w, h);

    // Wallpaper pattern (small diamonds)
    ctx.fillStyle = 'rgba(255,220,180,0.07)';
    for (let y = 0; y < h; y += 12) {
      for (let x = 0; x < w; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x + 6, y); ctx.lineTo(x + 12, y + 6);
        ctx.lineTo(x + 6, y + 12); ctx.lineTo(x, y + 6);
        ctx.closePath(); ctx.fill();
      }
    }

    // Counter / shelf at bottom
    ctx.fillStyle = '#7a5a42';
    ctx.fillRect(0, h * 0.65, w, h * 0.35);
    ctx.strokeStyle = '#6a4a32';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.65); ctx.lineTo(w, h * 0.65);
    ctx.stroke();

    // Checkered tablecloth strip
    const clothY = h * 0.65;
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = (x / 8) % 2 === 0 ? 'rgba(200,60,60,0.2)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, clothY, 8, 4);
    }

    // Shelves with cookies/pies
    const shelfCount = Math.floor(w / 60);
    for (let i = 0; i < shelfCount; i++) {
      const sx = 15 + i * 55;
      // Shelf board
      ctx.fillStyle = '#6a4a32';
      ctx.fillRect(sx - 5, h * 0.32, 40, 3);
      // Items on shelf
      if (i % 3 === 0) {
        // Pie
        ctx.beginPath();
        ctx.ellipse(sx + 15, h * 0.3, 10, 5, 0, Math.PI, 0);
        ctx.fillStyle = '#c49030';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(sx + 15, h * 0.3, 10, 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#daa850';
        ctx.fill();
      } else if (i % 3 === 1) {
        // Cookie jar
        roundRect(ctx, sx + 5, h * 0.15, 14, 16, 3);
        ctx.fillStyle = 'rgba(180,140,100,0.4)';
        ctx.fill();
        ctx.strokeStyle = '#8a6a4a';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Lid
        ctx.fillStyle = '#8a6a4a';
        ctx.fillRect(sx + 4, h * 0.14, 16, 3);
      } else {
        // Rolling pin
        ctx.fillStyle = '#c0a080';
        ctx.fillRect(sx + 3, h * 0.28, 24, 4);
        circle(ctx, sx + 3, h * 0.3, 3);
        ctx.fill();
        circle(ctx, sx + 27, h * 0.3, 3);
        ctx.fill();
      }
    }

    // Steam/warmth wisps
    ctx.strokeStyle = 'rgba(255,240,220,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const sx = w * 0.15 + i * w * 0.22;
      ctx.beginPath();
      ctx.moveTo(sx, h * 0.55);
      ctx.quadraticCurveTo(sx + 5, h * 0.45, sx - 3, h * 0.35);
      ctx.stroke();
    }
  },

  /* ── Farm: Seamless field — icons sit on the ground as cookie plants ── */
  Farm(ctx, w, h) {
    // Sky — upper 35%
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    sky.addColorStop(0, '#6bb8d9');
    sky.addColorStop(1, '#a8d8ea');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.35);

    // Sun (subtle)
    const sunGlow = ctx.createRadialGradient(w * 0.88, h * 0.08, 0, w * 0.88, h * 0.08, h * 0.18);
    sunGlow.addColorStop(0, 'rgba(255,240,100,0.35)');
    sunGlow.addColorStop(1, 'rgba(255,240,100,0)');
    circle(ctx, w * 0.88, h * 0.08, h * 0.18);
    ctx.fillStyle = sunGlow;
    ctx.fill();

    // Distant hills at horizon
    ctx.fillStyle = '#6a9a30';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.35);
    for (let x = 0; x <= w; x += 40) {
      ctx.lineTo(x, h * 0.33 + Math.sin(x * 0.03) * h * 0.04);
    }
    ctx.lineTo(w, h * 0.4);
    ctx.lineTo(0, h * 0.4);
    ctx.closePath();
    ctx.fill();

    // Ground — starts at ~38%, same soil color as the Farm icon
    const ground = ctx.createLinearGradient(0, h * 0.38, 0, h);
    ground.addColorStop(0, '#8B6914');
    ground.addColorStop(0.4, '#7a5c10');
    ground.addColorStop(1, '#6b4f0e');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.38, w, h * 0.62);

    // Furrow lines across soil
    ctx.strokeStyle = 'rgba(90,65,12,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const fy = h * 0.52 + i * h * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(w, fy);
      ctx.stroke();
    }

    // Green grass tufts along the ground line — icons "grow" from here
    ctx.fillStyle = '#4a8a20';
    for (let x = 0; x < w; x += 6) {
      const gh = 3 + Math.sin(x * 0.4) * 2;
      ctx.fillRect(x, h * 0.38 - gh, 3, gh);
    }

    // Fence at the back
    ctx.fillStyle = 'rgba(90,60,20,0.3)';
    for (let i = 0; i < Math.floor(w / 45) + 1; i++) {
      ctx.fillRect(i * 45, h * 0.28, 2, h * 0.12);
    }
    ctx.strokeStyle = 'rgba(90,60,20,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.32);
    ctx.lineTo(w, h * 0.32);
    ctx.stroke();

    // Tiny background cookie seedlings (very muted, so icon plants pop)
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < Math.floor(w / 50); i++) {
      const sx = 25 + i * 48;
      ctx.strokeStyle = '#2d7a2d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, h * 0.52);
      ctx.lineTo(sx, h * 0.42);
      ctx.stroke();
      ctx.fillStyle = '#3a9a3a';
      ctx.beginPath();
      ctx.ellipse(sx + 3, h * 0.44, 3, 1.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  /* ── Factory: Industrial interior with conveyor belts ── */
  Factory(ctx, w, h) {
    // Industrial wall
    ctx.fillStyle = '#4a3a30';
    ctx.fillRect(0, 0, w, h);

    // Brick pattern
    ctx.strokeStyle = 'rgba(60,40,25,0.3)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < h; y += 8) {
      const offset = (y / 8) % 2 === 0 ? 0 : 10;
      for (let x = -10; x < w + 10; x += 20) {
        ctx.strokeRect(x + offset, y, 20, 8);
      }
    }

    // Conveyor belt at bottom
    ctx.fillStyle = '#333';
    ctx.fillRect(0, h * 0.7, w, h * 0.15);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h * 0.7); ctx.lineTo(w, h * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h * 0.85); ctx.lineTo(w, h * 0.85); ctx.stroke();
    // Belt rollers
    for (let x = 0; x < w; x += 15) {
      ctx.strokeStyle = 'rgba(100,100,100,0.4)';
      ctx.beginPath(); ctx.moveTo(x, h * 0.7); ctx.lineTo(x, h * 0.85); ctx.stroke();
    }

    // Cookies on conveyor
    const cookieCount = Math.floor(w / 40);
    for (let i = 0; i < cookieCount; i++) {
      miniCookie(ctx, 20 + i * 38 + Math.sin(i * 1.7) * 8, h * 0.72, 4);
    }

    // Pipes along top
    ctx.fillStyle = '#666';
    ctx.fillRect(0, 2, w, 5);
    ctx.fillStyle = '#777';
    ctx.fillRect(0, 2, w, 2);
    // Pipe joints
    for (let x = 0; x < w; x += 40) {
      ctx.fillStyle = '#888';
      ctx.fillRect(x, 0, 8, 8);
    }

    // Saw-tooth ceiling segments
    ctx.fillStyle = '#5a4a3a';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    for (let i = 0; i < Math.ceil(w / 50); i++) {
      ctx.lineTo(i * 50 + 25, 16);
      ctx.lineTo((i + 1) * 50, 8);
    }
    ctx.lineTo(w, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Gears
    for (let i = 0; i < Math.floor(w / 120); i++) {
      const gx = 60 + i * 110;
      const gy = h * 0.45;
      ctx.strokeStyle = 'rgba(150,130,100,0.25)';
      ctx.lineWidth = 2;
      circle(ctx, gx, gy, 10);
      ctx.stroke();
      circle(ctx, gx, gy, 3);
      ctx.fillStyle = 'rgba(150,130,100,0.2)';
      ctx.fill();
      // Teeth
      for (let t = 0; t < 8; t++) {
        const angle = (t * Math.PI * 2) / 8;
        ctx.beginPath();
        ctx.moveTo(gx + 9 * Math.cos(angle), gy + 9 * Math.sin(angle));
        ctx.lineTo(gx + 13 * Math.cos(angle), gy + 13 * Math.sin(angle));
        ctx.stroke();
      }
    }
  },

  /* ── Mine: Underground cavern with ore veins ── */
  Mine(ctx, w, h) {
    // Rock background
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(0, 0, w, h);

    // Rock layers
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = 3 + i * (h / 5);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < w; x += 30) {
        ctx.quadraticCurveTo(x + 15, y + (i % 2 ? 4 : -4), x + 30, y);
      }
      ctx.stroke();
    }

    // Gold/cookie ore veins
    ctx.fillStyle = 'rgba(255,200,80,0.2)';
    const oreCount = Math.floor(w / 50);
    for (let i = 0; i < oreCount; i++) {
      const ox = 20 + i * 45 + Math.sin(i * 2.7) * 10;
      const oy = h * 0.3 + Math.cos(i * 1.8) * h * 0.2;
      ctx.beginPath();
      ctx.ellipse(ox, oy, 8, 4, Math.sin(i) * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Sparkle
      ctx.fillStyle = 'rgba(255,215,0,0.3)';
      circle(ctx, ox + 3, oy - 2, 1.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,200,80,0.2)';
    }

    // Track rails at bottom
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h * 0.85); ctx.lineTo(w, h * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h * 0.92); ctx.lineTo(w, h * 0.92); ctx.stroke();
    // Ties
    ctx.strokeStyle = '#4a3820';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 15) {
      ctx.beginPath(); ctx.moveTo(x, h * 0.83); ctx.lineTo(x, h * 0.94); ctx.stroke();
    }

    // Lanterns
    for (let i = 0; i < Math.floor(w / 100); i++) {
      const lx = 50 + i * 90;
      const ly = h * 0.15;
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 15);
      glow.addColorStop(0, 'rgba(255,200,80,0.25)');
      glow.addColorStop(1, 'rgba(255,160,40,0)');
      circle(ctx, lx, ly, 15);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.fillStyle = '#ffc040';
      ctx.fillRect(lx - 2, ly - 3, 4, 6);
    }

    // Cookie ores (bigger)
    for (let i = 0; i < Math.floor(w / 80); i++) {
      miniCookie(ctx, 35 + i * 75 + Math.sin(i * 3.1) * 15, h * 0.55 + Math.cos(i * 2) * 8, 5);
    }
  },

  /* ── Shipment: Vast cosmic expanse — nebulas, galaxies, comets ── */
  Shipment(ctx, w, h) {
    // Deep space gradient — rich blues and purples
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#050520');
    bg.addColorStop(0.3, '#0a0a30');
    bg.addColorStop(0.7, '#08082e');
    bg.addColorStop(1, '#050518');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Large diffuse nebula clouds (3 overlapping)
    const nebulas = [
      { x: w * 0.2, y: h * 0.4, r: h * 1.2, c1: 'rgba(120,40,180,0.15)', c2: 'rgba(80,20,140,0)' },
      { x: w * 0.65, y: h * 0.3, r: h * 1.0, c1: 'rgba(40,80,200,0.12)', c2: 'rgba(20,40,100,0)' },
      { x: w * 0.85, y: h * 0.7, r: h * 0.9, c1: 'rgba(180,60,80,0.08)', c2: 'rgba(100,20,40,0)' },
    ];
    nebulas.forEach(n => {
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      grad.addColorStop(0, n.c1);
      grad.addColorStop(0.6, n.c2);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    // Milky Way band — diagonal haze across the scene
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(-0.2);
    const milky = ctx.createLinearGradient(0, -h * 0.3, 0, h * 0.3);
    milky.addColorStop(0, 'rgba(150,140,200,0)');
    milky.addColorStop(0.3, 'rgba(150,140,200,0.04)');
    milky.addColorStop(0.5, 'rgba(180,170,220,0.07)');
    milky.addColorStop(0.7, 'rgba(150,140,200,0.04)');
    milky.addColorStop(1, 'rgba(150,140,200,0)');
    ctx.fillStyle = milky;
    ctx.fillRect(-w, -h * 0.3, w * 3, h * 0.6);
    ctx.restore();

    // Dense star field — many tiny stars, varied brightness and warmth
    for (let i = 0; i < Math.floor(w / 2.5); i++) {
      const sx = Math.sin(i * 7.13 + 0.5) * w * 0.5 + w * 0.5;
      const sy = Math.cos(i * 4.37 + 0.3) * h * 0.5 + h * 0.5;
      const brightness = 0.15 + Math.sin(i * 2.1) * 0.15 + Math.cos(i * 3.7) * 0.1;
      const size = 0.3 + Math.sin(i * 5.3) * 0.3;
      // Slightly warm or cool tint
      const tint = i % 5;
      if (tint === 0) ctx.fillStyle = `rgba(255,220,180,${brightness + 0.1})`;
      else if (tint === 1) ctx.fillStyle = `rgba(180,200,255,${brightness + 0.05})`;
      else ctx.fillStyle = `rgba(255,255,255,${brightness})`;
      circle(ctx, sx, sy, size);
      ctx.fill();
    }

    // Brighter feature stars with glow halos
    const featureStars = [
      { x: w * 0.15, y: h * 0.2, r: 1.5, hue: '200,220,255' },
      { x: w * 0.4, y: h * 0.15, r: 1.2, hue: '255,240,200' },
      { x: w * 0.55, y: h * 0.75, r: 1.3, hue: '255,200,200' },
      { x: w * 0.9, y: h * 0.35, r: 1.0, hue: '200,200,255' },
    ];
    featureStars.forEach(fs => {
      if (fs.x > w) return;
      // Halo
      const halo = ctx.createRadialGradient(fs.x, fs.y, 0, fs.x, fs.y, fs.r * 6);
      halo.addColorStop(0, `rgba(${fs.hue},0.25)`);
      halo.addColorStop(1, `rgba(${fs.hue},0)`);
      circle(ctx, fs.x, fs.y, fs.r * 6);
      ctx.fillStyle = halo;
      ctx.fill();
      // Star cross
      ctx.strokeStyle = `rgba(${fs.hue},0.3)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(fs.x - fs.r * 4, fs.y); ctx.lineTo(fs.x + fs.r * 4, fs.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fs.x, fs.y - fs.r * 4); ctx.lineTo(fs.x, fs.y + fs.r * 4); ctx.stroke();
      // Core
      circle(ctx, fs.x, fs.y, fs.r);
      ctx.fillStyle = `rgba(${fs.hue},0.6)`;
      ctx.fill();
    });

    // Planets with atmosphere glow
    // Large gas giant
    const p1x = w * 0.72, p1y = h * 0.42;
    // Atmosphere glow
    const atmo = ctx.createRadialGradient(p1x, p1y, 8, p1x, p1y, 16);
    atmo.addColorStop(0, 'rgba(100,140,200,0)');
    atmo.addColorStop(0.7, 'rgba(80,120,200,0.06)');
    atmo.addColorStop(1, 'rgba(60,100,180,0)');
    circle(ctx, p1x, p1y, 16);
    ctx.fillStyle = atmo;
    ctx.fill();
    // Planet body
    circle(ctx, p1x, p1y, 9);
    const pGrad = ctx.createRadialGradient(p1x - 3, p1y - 3, 0, p1x, p1y, 9);
    pGrad.addColorStop(0, '#8eaad0');
    pGrad.addColorStop(0.5, '#5a7aa0');
    pGrad.addColorStop(1, '#2a4a6a');
    ctx.fillStyle = pGrad;
    ctx.fill();
    // Cloud bands
    ctx.strokeStyle = 'rgba(140,170,210,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p1x, p1y, 6, -0.3, 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(p1x, p1y, 3, 0.5, 2.0); ctx.stroke();
    // Ring system
    ctx.strokeStyle = 'rgba(180,200,230,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(p1x, p1y, 15, 3.5, 0.25, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,180,210,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(p1x, p1y, 18, 4.5, 0.25, 0, Math.PI * 2); ctx.stroke();

    // Small rocky planet
    const p2x = w * 0.28, p2y = h * 0.68;
    circle(ctx, p2x, p2y, 5);
    const p2Grad = ctx.createRadialGradient(p2x - 1, p2y - 1, 0, p2x, p2y, 5);
    p2Grad.addColorStop(0, '#c0a080');
    p2Grad.addColorStop(1, '#6a5040');
    ctx.fillStyle = p2Grad;
    ctx.fill();

    // Comet streaks
    for (let i = 0; i < Math.max(2, Math.floor(w / 120)); i++) {
      const cx2 = 40 + i * 110 + Math.sin(i * 3.7) * 20;
      const cy2 = h * 0.2 + Math.cos(i * 2.3) * h * 0.15;
      // Tail
      const tailGrad = ctx.createLinearGradient(cx2 - 35, cy2 + 10, cx2, cy2);
      tailGrad.addColorStop(0, 'rgba(100,180,255,0)');
      tailGrad.addColorStop(1, 'rgba(200,230,255,0.2)');
      ctx.strokeStyle = tailGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx2 - 35, cy2 + 10);
      ctx.quadraticCurveTo(cx2 - 15, cy2 + 5, cx2, cy2);
      ctx.stroke();
      // Wider dim tail
      ctx.strokeStyle = 'rgba(100,160,255,0.06)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx2 - 30, cy2 + 8);
      ctx.quadraticCurveTo(cx2 - 12, cy2 + 4, cx2, cy2);
      ctx.stroke();
      // Comet head
      const headGlow = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, 4);
      headGlow.addColorStop(0, 'rgba(220,240,255,0.5)');
      headGlow.addColorStop(1, 'rgba(150,200,255,0)');
      circle(ctx, cx2, cy2, 4);
      ctx.fillStyle = headGlow;
      ctx.fill();
      circle(ctx, cx2, cy2, 1.2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    }

    // Rocket ships — small but detailed
    for (let i = 0; i < Math.floor(w / 160); i++) {
      const rx = 70 + i * 150;
      const ry = h * 0.55 + Math.sin(i * 2.5) * h * 0.15;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(-0.4 + i * 0.2);
      // Flame
      ctx.fillStyle = 'rgba(255,140,40,0.3)';
      ctx.beginPath();
      ctx.moveTo(-2, 5);
      ctx.quadraticCurveTo(0, 12, 2, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,80,0.25)';
      ctx.beginPath();
      ctx.moveTo(-1, 5);
      ctx.quadraticCurveTo(0, 9, 1, 5);
      ctx.fill();
      // Body
      ctx.fillStyle = 'rgba(220,220,230,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(3, -3, 3, 4);
      ctx.lineTo(-3, 4);
      ctx.quadraticCurveTo(-3, -3, 0, -6);
      ctx.fill();
      // Nose
      ctx.fillStyle = 'rgba(200,80,60,0.3)';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(1.5, -4, 1.5, -2);
      ctx.lineTo(-1.5, -2);
      ctx.quadraticCurveTo(-1.5, -4, 0, -6);
      ctx.fill();
      ctx.restore();
    }

    // Distant galaxy spiral
    const gx = w * 0.45, gy = h * 0.25;
    ctx.strokeStyle = 'rgba(180,160,220,0.08)';
    ctx.lineWidth = 1.5;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let t = 0; t < 1; t += 0.02) {
        const angle = t * Math.PI * 4 + arm * Math.PI;
        const r = t * 12;
        const x = gx + r * Math.cos(angle);
        const y = gy + r * 0.5 * Math.sin(angle);
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Galaxy core glow
    const galGlow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 5);
    galGlow.addColorStop(0, 'rgba(200,190,240,0.15)');
    galGlow.addColorStop(1, 'rgba(150,140,200,0)');
    circle(ctx, gx, gy, 5);
    ctx.fillStyle = galGlow;
    ctx.fill();
  },

  /* ── Alchemy Lab: Mystical workshop — muted bg flasks, icon pops ── */
  'Alchemy Lab'(ctx, w, h) {
    // Richer purple stone room
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#201038');
    bg.addColorStop(1, '#180828');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle stone texture
    ctx.strokeStyle = 'rgba(60,30,80,0.35)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < h; y += 10) {
      const off = (y / 10) % 2 === 0 ? 0 : 12;
      for (let x = -12; x < w + 12; x += 24) {
        ctx.strokeRect(x + off, y, 24, 10);
      }
    }

    // Stone floor
    ctx.fillStyle = '#281840';
    ctx.fillRect(0, h * 0.75, w, h * 0.25);

    // Ambient magical glow from floor
    const floorGlow = ctx.createLinearGradient(0, h * 0.75, 0, h);
    floorGlow.addColorStop(0, 'rgba(150,60,220,0.08)');
    floorGlow.addColorStop(1, 'rgba(100,30,180,0.02)');
    ctx.fillStyle = floorGlow;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);

    // Wooden shelves (two rows) — brighter
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(0, h * 0.22, w, 3);
    ctx.fillRect(0, h * 0.55, w, 3);

    // Background flasks — brighter colors
    const shapes = ['round', 'tall', 'wide', 'erlenmeyer', 'vial'];
    const mutedColors = [
      'rgba(100,50,140,0.4)', 'rgba(50,90,110,0.35)', 'rgba(80,40,70,0.38)',
      'rgba(70,70,50,0.35)', 'rgba(60,35,90,0.4)', 'rgba(40,80,80,0.3)'
    ];

    // Top shelf flasks
    for (let i = 0; i < Math.floor(w / 30); i++) {
      const fx = 10 + i * 28 + Math.sin(i * 2.3) * 4;
      const fy = h * 0.2;
      const shape = shapes[i % shapes.length];
      const col = mutedColors[i % mutedColors.length];
      ctx.fillStyle = col;
      ctx.strokeStyle = 'rgba(120,80,160,0.3)';
      ctx.lineWidth = 0.8;
      if (shape === 'round') {
        circle(ctx, fx, fy - 5, 6); ctx.fill(); ctx.stroke();
        ctx.fillRect(fx - 2, fy - 12, 4, 4);
      } else if (shape === 'tall') {
        roundRect(ctx, fx - 3, fy - 16, 6, 14, 2); ctx.fill(); ctx.stroke();
      } else if (shape === 'wide') {
        ctx.beginPath();
        ctx.moveTo(fx - 3, fy - 14); ctx.lineTo(fx - 3, fy - 8);
        ctx.lineTo(fx - 7, fy - 2); ctx.lineTo(fx + 7, fy - 2);
        ctx.lineTo(fx + 3, fy - 8); ctx.lineTo(fx + 3, fy - 14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (shape === 'erlenmeyer') {
        ctx.beginPath();
        ctx.moveTo(fx - 2, fy - 14); ctx.lineTo(fx - 2, fy - 8);
        ctx.lineTo(fx - 6, fy - 1); ctx.lineTo(fx + 6, fy - 1);
        ctx.lineTo(fx + 2, fy - 8); ctx.lineTo(fx + 2, fy - 14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(fx - 1.5, fy - 14, 3, 12); ctx.strokeRect(fx - 1.5, fy - 14, 3, 12);
      }
    }

    // Bottom shelf — different set
    for (let i = 0; i < Math.floor(w / 35); i++) {
      const fx = 15 + i * 32 + Math.cos(i * 1.7) * 5;
      const fy = h * 0.53;
      const shape = shapes[(i + 2) % shapes.length];
      const col = mutedColors[(i + 3) % mutedColors.length];
      ctx.fillStyle = col;
      ctx.strokeStyle = 'rgba(120,80,160,0.25)';
      ctx.lineWidth = 0.6;
      if (shape === 'round') {
        circle(ctx, fx, fy - 5, 7); ctx.fill(); ctx.stroke();
      } else if (shape === 'tall') {
        roundRect(ctx, fx - 3, fy - 18, 6, 16, 2); ctx.fill(); ctx.stroke();
      } else if (shape === 'wide') {
        ctx.beginPath();
        ctx.moveTo(fx - 3, fy - 14); ctx.lineTo(fx - 8, fy - 2);
        ctx.lineTo(fx + 8, fy - 2); ctx.lineTo(fx + 3, fy - 14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        roundRect(ctx, fx - 4, fy - 12, 8, 10, 3); ctx.fill(); ctx.stroke();
      }
    }

    // Floating sparkle motes — brighter
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#d0b0ff';
    for (let i = 0; i < Math.floor(w / 35); i++) {
      const sx = 20 + i * 32;
      const sy = h * 0.35 + Math.sin(i * 2.7) * h * 0.15;
      star(ctx, sx, sy, 2.5, 1, 4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Glowing alchemical circles on floor (no pentagrams)
    for (let i = 0; i < Math.floor(w / 80); i++) {
      const cx2 = 40 + i * 75;
      const cy2 = h * 0.86;
      // Outer glow
      const cGlow = ctx.createRadialGradient(cx2, cy2, 6, cx2, cy2, 16);
      cGlow.addColorStop(0, 'rgba(160,80,255,0.1)');
      cGlow.addColorStop(1, 'rgba(160,80,255,0)');
      circle(ctx, cx2, cy2, 16);
      ctx.fillStyle = cGlow;
      ctx.fill();
      // Outer ring
      ctx.strokeStyle = 'rgba(160,80,255,0.18)';
      ctx.lineWidth = 1;
      circle(ctx, cx2, cy2, 14);
      ctx.stroke();
      // Inner ring
      ctx.strokeStyle = 'rgba(160,80,255,0.12)';
      circle(ctx, cx2, cy2, 9);
      ctx.stroke();
      // Center dot
      circle(ctx, cx2, cy2, 2);
      ctx.fillStyle = 'rgba(180,100,255,0.2)';
      ctx.fill();
      // Cardinal dots around inner ring
      for (let d = 0; d < 4; d++) {
        const angle = (d * Math.PI * 2) / 4;
        circle(ctx, cx2 + 9 * Math.cos(angle), cy2 + 9 * Math.sin(angle), 1.2);
        ctx.fillStyle = 'rgba(180,100,255,0.15)';
        ctx.fill();
      }
    }

    // Dripping liquid from shelf edges — brighter
    ctx.fillStyle = 'rgba(140,60,220,0.2)';
    for (let i = 0; i < Math.floor(w / 70); i++) {
      const dx = 35 + i * 65;
      ctx.beginPath();
      ctx.moveTo(dx, h * 0.56);
      ctx.quadraticCurveTo(dx + 1, h * 0.62, dx, h * 0.65);
      ctx.quadraticCurveTo(dx - 1, h * 0.62, dx, h * 0.56);
      ctx.fill();
    }
  },

  /* ── Portal: Eldritch void with rifts, floating islands, tentacles ── */
  Portal(ctx, w, h) {
    // Richer void gradient
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0c0028');
    bg.addColorStop(0.5, '#180048');
    bg.addColorStop(1, '#0c0028');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Dimensional rift cracks — brighter
    ctx.strokeStyle = 'rgba(220,100,255,0.22)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < Math.floor(w / 60); i++) {
      const rx = i * 55 + 20;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 8, h * 0.2);
      ctx.lineTo(rx + 3, h * 0.35);
      ctx.lineTo(rx + 12, h * 0.5);
      ctx.stroke();
      const riftGlow = ctx.createLinearGradient(rx - 5, 0, rx + 15, h * 0.5);
      riftGlow.addColorStop(0, 'rgba(200,80,255,0)');
      riftGlow.addColorStop(0.5, 'rgba(200,80,255,0.1)');
      riftGlow.addColorStop(1, 'rgba(200,80,255,0)');
      ctx.fillStyle = riftGlow;
      ctx.fillRect(rx - 8, 0, 28, h * 0.5);
    }

    // Floating stone platforms — brighter
    for (let i = 0; i < Math.floor(w / 90); i++) {
      const px = 30 + i * 85;
      const py = h * 0.7 + Math.sin(i * 2.3) * h * 0.08;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(px + 2, py + 8, 18, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#241840';
      ctx.beginPath();
      ctx.ellipse(px, py, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,100,240,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,120,255,0.2)';
      ctx.fillRect(px - 6, py - 1, 3, 2);
      ctx.fillRect(px + 3, py - 1, 3, 2);
    }

    // Larger portal vortexes — brighter
    const portalCount = Math.max(2, Math.floor(w / 90));
    for (let p = 0; p < portalCount; p++) {
      const px = 45 + p * 85;
      const py = h * 0.38 + Math.sin(p * 1.7) * h * 0.12;
      const pr = 12 + (p % 3) * 4;

      const glow = ctx.createRadialGradient(px, py, 0, px, py, pr * 2.5);
      glow.addColorStop(0, 'rgba(180,80,240,0.3)');
      glow.addColorStop(0.5, 'rgba(120,30,200,0.12)');
      glow.addColorStop(1, 'rgba(80,0,150,0)');
      circle(ctx, px, py, pr * 2.5);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.strokeStyle = 'rgba(200,120,255,0.4)';
      ctx.lineWidth = 2;
      circle(ctx, px, py, pr);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(170,80,230,0.25)';
      ctx.lineWidth = 1;
      circle(ctx, px, py, pr * 1.2);
      ctx.stroke();

      const inner = ctx.createRadialGradient(px, py, 0, px, py, pr * 0.7);
      inner.addColorStop(0, '#100028');
      inner.addColorStop(1, '#280058');
      circle(ctx, px, py, pr * 0.7);
      ctx.fillStyle = inner;
      ctx.fill();

      ctx.strokeStyle = 'rgba(220,160,255,0.25)';
      ctx.lineWidth = 0.8;
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.03) {
          const angle = t * Math.PI * 3 + arm * Math.PI * 0.5 + p;
          const r = t * pr * 0.65;
          const x = px + r * Math.cos(angle);
          const y = py + r * Math.sin(angle);
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(200,120,255,0.15)';
      ctx.lineWidth = 1;
      for (let t = 0; t < 5; t++) {
        const angle = (t * Math.PI * 2) / 5 + p * 0.7;
        ctx.beginPath();
        ctx.moveTo(px + pr * Math.cos(angle), py + pr * Math.sin(angle));
        ctx.quadraticCurveTo(
          px + pr * 2.2 * Math.cos(angle + 0.3),
          py + pr * 2.2 * Math.sin(angle + 0.3),
          px + pr * 3 * Math.cos(angle + 0.15),
          py + pr * 3 * Math.sin(angle + 0.15)
        );
        ctx.stroke();
      }
    }

    // Floating particles — brighter
    ctx.fillStyle = 'rgba(200,120,255,0.18)';
    for (let i = 0; i < Math.floor(w / 8); i++) {
      const px = Math.sin(i * 5.7) * w * 0.5 + w * 0.5;
      const py = Math.cos(i * 3.2) * h * 0.5 + h * 0.5;
      const size = 0.6 + Math.sin(i * 1.3) * 0.5;
      circle(ctx, px, py, size);
      ctx.fill();
    }

    // Eldritch tentacle hints — brighter
    ctx.strokeStyle = 'rgba(140,60,200,0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ty = h * 0.6 + i * 12;
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.bezierCurveTo(15, ty - 10, 25, ty + 10, 40, ty - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w, ty + 5);
      ctx.bezierCurveTo(w - 15, ty - 5, w - 25, ty + 15, w - 40, ty);
      ctx.stroke();
    }
  },

  /* ── Time Machine: Clockwork gears & timepieces ── */
  'Time Machine'(ctx, w, h) {
    // Richer steampunk bronze/blue gradient
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#141e30');
    bg.addColorStop(0.5, '#243348');
    bg.addColorStop(1, '#141e30');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Time-stream lines — brighter
    for (let i = 0; i < Math.floor(w / 12); i++) {
      const ty = Math.sin(i * 3.7) * h * 0.5 + h * 0.5;
      const len = 20 + Math.sin(i * 2.1) * 15;
      const tx = Math.sin(i * 7.3) * w * 0.5 + w * 0.5;
      ctx.strokeStyle = `rgba(120,200,255,${0.06 + Math.sin(i) * 0.04})`;
      ctx.lineWidth = 0.5 + Math.sin(i * 1.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + len, ty);
      ctx.stroke();
    }

    // Large interlocking gears — brighter alphas
    const gearSets = [
      { x: w * 0.15, y: h * 0.35, r: 22, t: 12, alpha: 0.22 },
      { x: w * 0.15 + 28, y: h * 0.55, r: 16, t: 10, alpha: 0.18 },
      { x: w * 0.5, y: h * 0.6, r: 26, t: 14, alpha: 0.15 },
      { x: w * 0.5 + 18, y: h * 0.3, r: 14, t: 8, alpha: 0.18 },
      { x: w * 0.8, y: h * 0.4, r: 20, t: 11, alpha: 0.2 },
      { x: w * 0.8 - 10, y: h * 0.65, r: 12, t: 8, alpha: 0.16 },
    ];
    // Only render gears that fit
    gearSets.forEach(g => {
      if (g.x > w + 30) return;
      ctx.strokeStyle = `rgba(184,160,96,${g.alpha})`;
      ctx.lineWidth = 1.5;
      // Outer ring
      circle(ctx, g.x, g.y, g.r);
      ctx.stroke();
      // Inner ring
      circle(ctx, g.x, g.y, g.r * 0.6);
      ctx.stroke();
      // Hub
      circle(ctx, g.x, g.y, g.r * 0.15);
      ctx.fillStyle = `rgba(184,160,96,${g.alpha * 0.8})`;
      ctx.fill();
      // Spokes
      ctx.lineWidth = 1;
      for (let s = 0; s < 4; s++) {
        const angle = (s * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(g.x + g.r * 0.15 * Math.cos(angle), g.y + g.r * 0.15 * Math.sin(angle));
        ctx.lineTo(g.x + g.r * 0.6 * Math.cos(angle), g.y + g.r * 0.6 * Math.sin(angle));
        ctx.stroke();
      }
      // Teeth
      ctx.lineWidth = 1.5;
      for (let t = 0; t < g.t; t++) {
        const angle = (t * Math.PI * 2) / g.t;
        ctx.beginPath();
        ctx.moveTo(g.x + g.r * Math.cos(angle), g.y + g.r * Math.sin(angle));
        ctx.lineTo(g.x + (g.r + 4) * Math.cos(angle), g.y + (g.r + 4) * Math.sin(angle));
        ctx.stroke();
      }
    });

    // Clock faces scattered at different sizes
    const clocks = [
      { x: w * 0.3, y: h * 0.2, r: 10 },
      { x: w * 0.6, y: h * 0.15, r: 8 },
      { x: w * 0.85, y: h * 0.75, r: 12 },
      { x: w * 0.1, y: h * 0.7, r: 7 },
    ];
    clocks.forEach(c => {
      if (c.x > w + 15) return;
      circle(ctx, c.x, c.y, c.r);
      ctx.fillStyle = 'rgba(232,184,76,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,175,110,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let d = 0; d < 12; d++) {
        const angle = (d * Math.PI * 2) / 12 - Math.PI / 2;
        circle(ctx, c.x + c.r * 0.75 * Math.cos(angle), c.y + c.r * 0.75 * Math.sin(angle), 0.8);
        ctx.fillStyle = 'rgba(200,175,110,0.35)';
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(200,175,110,0.4)';
      ctx.lineWidth = 1;
      const h1 = -Math.PI / 3 + c.x * 0.01;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.r * 0.5 * Math.cos(h1), c.y + c.r * 0.5 * Math.sin(h1)); ctx.stroke();
      const h2 = Math.PI / 5 + c.x * 0.02;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.r * 0.7 * Math.cos(h2), c.y + c.r * 0.7 * Math.sin(h2)); ctx.stroke();
    });

    // Time vortex ripples — brighter
    const vcx = w * 0.5, vcy = h * 0.5;
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = `rgba(120,200,255,${0.06 + i * 0.008})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(vcx, vcy, 15 + i * 12, i * 0.6, i * 0.6 + 1.2);
      ctx.stroke();
    }

    // Lightning/energy sparks — brighter
    ctx.strokeStyle = 'rgba(120,220,255,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.floor(w / 100); i++) {
      const lx = 50 + i * 90;
      const ly = h * 0.3;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 4, ly + 6);
      ctx.lineTo(lx - 2, ly + 8);
      ctx.lineTo(lx + 5, ly + 16);
      ctx.stroke();
    }

    // Floating Roman numeral hints — brighter
    ctx.fillStyle = 'rgba(200,175,110,0.12)';
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    const numerals = ['XII', 'III', 'VI', 'IX'];
    for (let i = 0; i < Math.min(numerals.length, Math.floor(w / 80)); i++) {
      ctx.fillText(numerals[i], 40 + i * 75, h * 0.9);
    }
  },

  /* ── Antimatter Condenser: Particle collider tunnel ── */
  'Antimatter Condenser'(ctx, w, h) {
    // Richer dark base with subtle gradient
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0c0020');
    bg.addColorStop(0.5, '#10002a');
    bg.addColorStop(1, '#0c0020');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Collider ring/tube — brighter
    ctx.strokeStyle = 'rgba(0,220,255,0.2)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 2, w * 0.45, h * 1.5, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // Inner glow on ring
    ctx.strokeStyle = 'rgba(0,180,255,0.08)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 2, w * 0.45, h * 1.5, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Energy beams — brighter with glow
    ctx.strokeStyle = 'rgba(255,80,120,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,60,100,0.06)';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();

    // Atom symbols — brighter
    for (let i = 0; i < Math.floor(w / 90); i++) {
      const ax = 45 + i * 85;
      const ay = h * 0.4 + Math.sin(i * 2.5) * h * 0.15;
      ctx.strokeStyle = 'rgba(0,220,255,0.28)';
      ctx.lineWidth = 0.8;
      for (let r = 0; r < 3; r++) {
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate((r * Math.PI) / 3);
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // Nucleus glow
      const nGlow = ctx.createRadialGradient(ax, ay, 0, ax, ay, 5);
      nGlow.addColorStop(0, 'rgba(255,80,120,0.4)');
      nGlow.addColorStop(1, 'rgba(255,60,100,0)');
      circle(ctx, ax, ay, 5);
      ctx.fillStyle = nGlow;
      ctx.fill();
      circle(ctx, ax, ay, 2);
      ctx.fillStyle = 'rgba(255,80,130,0.5)';
      ctx.fill();
    }

    // Particle trails — brighter
    ctx.strokeStyle = 'rgba(0,220,255,0.12)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.sin(i * 3.7) * w, 0);
      ctx.quadraticCurveTo(w * 0.5, h * 0.5, Math.cos(i * 2.3) * w, h);
      ctx.stroke();
    }

    // Extra energy sparks
    ctx.fillStyle = 'rgba(0,220,255,0.15)';
    for (let i = 0; i < Math.floor(w / 15); i++) {
      const sx = Math.sin(i * 4.3) * w * 0.5 + w * 0.5;
      const sy = Math.cos(i * 2.9) * h * 0.5 + h * 0.5;
      circle(ctx, sx, sy, 0.8);
      ctx.fill();
    }
  },

  /* ── Prism: Luminous crystal gallery — light refracting everywhere ── */
  Prism(ctx, w, h) {
    // Deep indigo-violet base with warmth
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#100820');
    bg.addColorStop(0.3, '#14102a');
    bg.addColorStop(0.7, '#121028');
    bg.addColorStop(1, '#0c0818');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Ambient prismatic wash — diagonal rainbow gradient overlay
    const wash = ctx.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, 'rgba(255,50,50,0.03)');
    wash.addColorStop(0.17, 'rgba(255,140,30,0.03)');
    wash.addColorStop(0.33, 'rgba(255,240,60,0.025)');
    wash.addColorStop(0.5, 'rgba(50,210,80,0.025)');
    wash.addColorStop(0.67, 'rgba(50,120,255,0.03)');
    wash.addColorStop(0.83, 'rgba(140,50,255,0.03)');
    wash.addColorStop(1, 'rgba(255,50,100,0.02)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    // Floor — polished dark surface with reflections
    const floor = ctx.createLinearGradient(0, h * 0.72, 0, h);
    floor.addColorStop(0, '#18143a');
    floor.addColorStop(1, '#0e0a22');
    ctx.fillStyle = floor;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // Continuous rainbow light beams — sweeping diagonally across the scene
    const beamColors = [
      { r: 255, g: 60, b: 60 },
      { r: 255, g: 150, b: 40 },
      { r: 255, g: 240, b: 60 },
      { r: 60, g: 220, b: 90 },
      { r: 60, g: 130, b: 255 },
      { r: 150, g: 60, b: 255 },
    ];
    // Beams from left side fanning across
    for (let b = 0; b < beamColors.length; b++) {
      const { r, g, b: bl } = beamColors[b];
      const startY = h * 0.35;
      const endY = h * 0.1 + b * (h * 0.14);
      // Main beam
      ctx.strokeStyle = `rgba(${r},${g},${bl},0.14)`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.lineTo(w, endY);
      ctx.stroke();
      // Beam glow haze
      ctx.strokeStyle = `rgba(${r},${g},${bl},0.04)`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.lineTo(w, endY);
      ctx.stroke();
    }

    // Crystal cluster formations rising from floor
    const crystalCount = Math.floor(w / 40);
    for (let i = 0; i < crystalCount; i++) {
      const cx2 = 18 + i * 38 + Math.sin(i * 2.7) * 8;
      const baseY = h * 0.74 + Math.sin(i * 1.3) * h * 0.03;
      const hue = (i / crystalCount) * 360;

      // Each cluster has 2-3 crystals
      const clusterSize = 2 + (i % 2);
      for (let c = 0; c < clusterSize; c++) {
        const offX = (c - 1) * (3 + c);
        const cH = 18 + Math.sin(i * 3.1 + c * 1.5) * 14 + c * 3;
        const cW = 3 + (c % 2) * 2;
        const cHue = hue + c * 25;

        // Crystal body
        ctx.beginPath();
        ctx.moveTo(cx2 + offX - cW, baseY);
        ctx.lineTo(cx2 + offX - cW * 0.5, baseY - cH);
        ctx.lineTo(cx2 + offX, baseY - cH - 4);
        ctx.lineTo(cx2 + offX + cW * 0.5, baseY - cH);
        ctx.lineTo(cx2 + offX + cW, baseY);
        ctx.closePath();

        // Filled with translucent hue
        ctx.fillStyle = `hsla(${cHue}, 75%, 60%, 0.2)`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${cHue}, 65%, 75%, 0.4)`;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        // Inner highlight facet
        ctx.beginPath();
        ctx.moveTo(cx2 + offX - cW * 0.2, baseY);
        ctx.lineTo(cx2 + offX, baseY - cH * 0.8);
        ctx.lineTo(cx2 + offX + cW * 0.3, baseY);
        ctx.closePath();
        ctx.fillStyle = `hsla(${cHue}, 55%, 85%, 0.1)`;
        ctx.fill();
      }

      // Tiny glow at crystal tips
      const tipGlow = ctx.createRadialGradient(cx2, baseY - 22, 0, cx2, baseY - 22, 6);
      tipGlow.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.15)`);
      tipGlow.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`);
      circle(ctx, cx2, baseY - 22, 6);
      ctx.fillStyle = tipGlow;
      ctx.fill();
    }

    // Prismatic light pools on floor — larger, more vivid
    for (let i = 0; i < Math.floor(w / 25); i++) {
      const lx = 10 + i * 23 + Math.sin(i * 1.7) * 4;
      const ly = h * 0.84 + Math.sin(i * 2.1) * 4;
      const hue = (i * 50) % 360;
      const poolR = 6 + Math.sin(i * 1.3) * 3;
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, poolR);
      glow.addColorStop(0, `hsla(${hue}, 85%, 65%, 0.2)`);
      glow.addColorStop(0.6, `hsla(${hue}, 85%, 65%, 0.06)`);
      glow.addColorStop(1, `hsla(${hue}, 85%, 65%, 0)`);
      circle(ctx, lx, ly, poolR);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Floating prismatic sparkles
    for (let i = 0; i < Math.floor(w / 15); i++) {
      const sx = Math.sin(i * 6.3) * w * 0.5 + w * 0.5;
      const sy = Math.cos(i * 3.7) * h * 0.5 + h * 0.5;
      const sparkHue = (i * 45) % 360;
      ctx.fillStyle = `hsla(${sparkHue}, 80%, 80%, 0.25)`;
      star(ctx, sx, sy, 1.5, 0.6, 4);
      ctx.fill();
    }

    // Ceiling stalactite crystals (hanging down)
    for (let i = 0; i < Math.floor(w / 70); i++) {
      const cx2 = 35 + i * 65;
      const cH = 10 + Math.sin(i * 2.5) * 6;
      const hue = (i * 80 + 180) % 360;
      ctx.beginPath();
      ctx.moveTo(cx2 - 3, 0);
      ctx.lineTo(cx2, cH);
      ctx.lineTo(cx2 + 3, 0);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, 60%, 60%, 0.15)`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 50%, 70%, 0.25)`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  },

  /* ── Chancemaker: Mystical lucky garden with golden magic ── */
  Chancemaker(ctx, w, h) {
    // Rich emerald gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0a1e10');
    bg.addColorStop(0.6, '#143020');
    bg.addColorStop(1, '#0c2818');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Magical golden ambient glow from above
    const topGlow = ctx.createRadialGradient(w * 0.5, -h * 0.2, 0, w * 0.5, -h * 0.2, h);
    topGlow.addColorStop(0, 'rgba(255,215,0,0.06)');
    topGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, w, h);

    // Lush grass texture at bottom
    ctx.fillStyle = '#0f2a14';
    ctx.fillRect(0, h * 0.7, w, h * 0.3);

    // Grass blades — brighter, denser
    for (let x = 0; x < w; x += 4) {
      const bh = 6 + Math.sin(x * 0.3) * 4;
      ctx.strokeStyle = `rgba(50,200,70,${0.15 + Math.sin(x * 0.7) * 0.05})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + 2, h - bh, x + 1, h - bh - 4);
      ctx.stroke();
    }

    // Top hats — scattered lucky gentleman hats
    for (let i = 0; i < Math.floor(w / 90); i++) {
      const hx = 30 + i * 85 + Math.sin(i * 2.7) * 10;
      const hy = h * 0.42 + Math.cos(i * 1.9) * h * 0.08;
      const hs = 12 + (i % 3) * 2;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate((Math.sin(i * 1.3) * 0.15));
      // Hat brim
      ctx.fillStyle = `rgba(15,12,8,${0.6 + (i % 2) * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(0, hs * 0.4, hs * 1.2, hs * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hat body
      roundRect(ctx, -hs * 0.55, -hs * 0.7, hs * 1.1, hs * 1.1, 1);
      const hatGrad = ctx.createLinearGradient(-hs * 0.55, -hs * 0.7, -hs * 0.55, hs * 0.4);
      hatGrad.addColorStop(0, `rgba(25,20,15,${0.55 + (i % 2) * 0.08})`);
      hatGrad.addColorStop(1, `rgba(10,8,5,${0.65 + (i % 2) * 0.08})`);
      ctx.fillStyle = hatGrad;
      ctx.fill();
      // Hat outline
      ctx.strokeStyle = `rgba(60,50,30,${0.35 + (i % 2) * 0.05})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Hat band — golden, brighter
      ctx.fillStyle = 'rgba(220,185,50,0.5)';
      ctx.fillRect(-hs * 0.55, hs * 0.12, hs * 1.1, hs * 0.2);
      // Band buckle
      ctx.strokeStyle = 'rgba(255,220,80,0.45)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-hs * 0.1, hs * 0.12, hs * 0.2, hs * 0.2);
      // Hat shine highlight
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(-hs * 0.35, -hs * 0.6, hs * 0.25, hs * 0.7);
      ctx.restore();
    }

    // Beer mugs — celebratory lucky tankards
    for (let i = 0; i < Math.floor(w / 110); i++) {
      const mx = 65 + i * 105 + Math.sin(i * 3.5) * 8;
      const my = h * 0.62 + Math.cos(i * 2.3) * h * 0.06;
      const ms = 7 + (i % 2) * 2;
      ctx.save();
      ctx.translate(mx, my);
      // Mug body
      roundRect(ctx, -ms * 0.5, -ms * 0.5, ms, ms * 1.1, 1.5);
      const mugGrad = ctx.createLinearGradient(-ms * 0.5, 0, ms * 0.5, 0);
      mugGrad.addColorStop(0, 'rgba(180,140,50,0.22)');
      mugGrad.addColorStop(0.5, 'rgba(220,180,70,0.28)');
      mugGrad.addColorStop(1, 'rgba(160,120,40,0.2)');
      ctx.fillStyle = mugGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,160,50,0.3)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Handle
      ctx.strokeStyle = 'rgba(200,160,50,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ms * 0.65, 0, ms * 0.35, -1.2, 1.2);
      ctx.stroke();
      // Foam on top
      ctx.fillStyle = 'rgba(255,250,220,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, -ms * 0.5, ms * 0.55, ms * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Lucky boots — scattered wee boots
    for (let i = 0; i < Math.floor(w / 130); i++) {
      const bx = 45 + i * 125;
      const by = h * 0.8 + Math.cos(i * 1.7) * h * 0.04;
      const bs = 7 + (i % 2);
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(i % 2 === 0 ? 1 : -1, 1);
      // Boot shaft
      ctx.fillStyle = `rgba(120,70,30,${0.25 + (i % 2) * 0.05})`;
      ctx.beginPath();
      ctx.moveTo(-bs * 0.3, -bs * 0.8);
      ctx.lineTo(bs * 0.15, -bs * 0.8);
      ctx.lineTo(bs * 0.15, bs * 0.15);
      ctx.lineTo(-bs * 0.3, bs * 0.15);
      ctx.closePath();
      ctx.fill();
      // Boot toe
      ctx.beginPath();
      ctx.moveTo(-bs * 0.3, bs * 0.15);
      ctx.lineTo(bs * 0.6, bs * 0.15);
      ctx.quadraticCurveTo(bs * 0.7, bs * 0.4, bs * 0.5, bs * 0.45);
      ctx.lineTo(-bs * 0.3, bs * 0.45);
      ctx.closePath();
      ctx.fill();
      // Boot top cuff
      ctx.fillStyle = 'rgba(160,100,40,0.2)';
      ctx.fillRect(-bs * 0.35, -bs * 0.85, bs * 0.55, bs * 0.15);
      // Buckle
      ctx.strokeStyle = 'rgba(220,190,60,0.3)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-bs * 0.1, -bs * 0.2, bs * 0.22, bs * 0.2);
      ctx.restore();
    }

    // Golden coins scattered
    for (let i = 0; i < Math.floor(w / 45); i++) {
      const coinX = 20 + i * 42 + Math.sin(i * 3.1) * 8;
      const coinY = h * 0.78 + Math.cos(i * 2.1) * h * 0.06;
      circle(ctx, coinX, coinY, 4);
      const coinGrad = ctx.createRadialGradient(coinX - 1, coinY - 1, 0, coinX, coinY, 4);
      coinGrad.addColorStop(0, 'rgba(255,230,80,0.35)');
      coinGrad.addColorStop(1, 'rgba(200,160,30,0.2)');
      ctx.fillStyle = coinGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,140,20,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Horseshoes — brighter, golden
    for (let i = 0; i < Math.floor(w / 100); i++) {
      const hx = 50 + i * 95;
      const hy = h * 0.18;
      ctx.strokeStyle = 'rgba(220,200,80,0.3)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 8, 0.3, Math.PI - 0.3);
      ctx.stroke();
      // Horseshoe dots
      ctx.fillStyle = 'rgba(220,200,80,0.25)';
      circle(ctx, hx - 6, hy + 5, 1.5);
      ctx.fill();
      circle(ctx, hx + 6, hy + 5, 1.5);
      ctx.fill();
    }

    // Lucky dice
    for (let i = 0; i < Math.floor(w / 120); i++) {
      const dx = 80 + i * 110;
      const dy = h * 0.32;
      roundRect(ctx, dx - 5, dy - 5, 10, 10, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Pips
      ctx.fillStyle = 'rgba(255,215,0,0.3)';
      circle(ctx, dx - 2, dy - 2, 1);
      ctx.fill();
      circle(ctx, dx + 2, dy + 2, 1);
      ctx.fill();
      circle(ctx, dx, dy, 1);
      ctx.fill();
    }

    // Gold sparkle stars — brighter, more numerous
    ctx.fillStyle = 'rgba(255,220,50,0.35)';
    for (let i = 0; i < Math.floor(w / 30); i++) {
      const sx = 15 + i * 28 + Math.sin(i * 4.3) * 5;
      const sy = h * 0.15 + Math.cos(i * 1.7) * h * 0.12 + Math.sin(i * 2.9) * h * 0.08;
      const sr = 2 + Math.sin(i * 1.9) * 1.2;
      star(ctx, sx, sy, sr, sr * 0.4, 4);
      ctx.fill();
    }

    // Magical particle trail
    ctx.fillStyle = 'rgba(255,215,0,0.1)';
    for (let i = 0; i < Math.floor(w / 12); i++) {
      const px = Math.sin(i * 5.1) * w * 0.5 + w * 0.5;
      const py = Math.cos(i * 3.3) * h * 0.5 + h * 0.5;
      circle(ctx, px, py, 0.8);
      ctx.fill();
    }
  },

  /* ── Fractal Engine: Mathematical fractal cosmos ── */
  'Fractal Engine'(ctx, w, h) {
    // Deep dark background with warm mathematical tones
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#140e06');
    bg.addColorStop(0.3, '#1e1408');
    bg.addColorStop(0.7, '#1a1010');
    bg.addColorStop(1, '#140e06');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Graph paper grid — fading recursive subdivisions
    for (let level = 0; level < 4; level++) {
      const size = 60 / Math.pow(2, level);
      const alpha = 0.08 - level * 0.018;
      if (alpha <= 0) break;
      ctx.strokeStyle = `rgba(200,160,60,${alpha})`;
      ctx.lineWidth = level === 0 ? 0.8 : 0.4;
      for (let x = 0; x < w; x += size) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += size) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }

    // Sierpinski triangles
    function drawSierpinski(x, y, size, depth) {
      if (depth <= 0 || size < 3) {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.5);
        ctx.lineTo(x - size * 0.5, y + size * 0.4);
        ctx.lineTo(x + size * 0.5, y + size * 0.4);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,200,60,${0.06 + depth * 0.02})`;
        ctx.fill();
        return;
      }
      const half = size * 0.5;
      drawSierpinski(x, y - half * 0.3, half, depth - 1);
      drawSierpinski(x - half * 0.5, y + half * 0.3, half, depth - 1);
      drawSierpinski(x + half * 0.5, y + half * 0.3, half, depth - 1);
    }
    const sierpCount = Math.max(1, Math.floor(w / 190));
    for (let i = 0; i < sierpCount; i++) {
      drawSierpinski(80 + i * 180, h * 0.38, 32, 3);
    }

    // Golden spiral (Fibonacci)
    function drawGoldenSpiral(cx, cy, maxR, turns) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,210,80,0.15)';
      ctx.lineWidth = 1.2;
      const phi = 1.618033988749;
      for (let t = 0; t < turns * Math.PI * 2; t += 0.05) {
        const r = maxR * Math.pow(phi, t / (Math.PI * 2)) / Math.pow(phi, turns);
        const px = cx + r * Math.cos(t);
        const py = cy + r * Math.sin(t);
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    const spiralCount = Math.max(1, Math.floor(w / 240));
    for (let i = 0; i < spiralCount; i++) {
      drawGoldenSpiral(110 + i * 230, h * 0.5, 28, 3);
      // Glow behind spiral center
      const glow = ctx.createRadialGradient(110 + i * 230, h * 0.5, 0, 110 + i * 230, h * 0.5, 30);
      glow.addColorStop(0, 'rgba(255,200,60,0.06)');
      glow.addColorStop(1, 'rgba(255,200,60,0)');
      circle(ctx, 110 + i * 230, h * 0.5, 30);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Koch snowflake segments along the bottom
    function drawKochLine(x1, y1, x2, y2, depth) {
      if (depth <= 0) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return;
      }
      const dx = x2 - x1, dy = y2 - y1;
      const ax = x1 + dx / 3, ay = y1 + dy / 3;
      const bx = x1 + dx * 2 / 3, by = y1 + dy * 2 / 3;
      const px = (ax + bx) / 2 - (by - ay) * 0.866;
      const py = (ay + by) / 2 + (bx - ax) * 0.866;
      drawKochLine(x1, y1, ax, ay, depth - 1);
      drawKochLine(ax, ay, px, py, depth - 1);
      drawKochLine(px, py, bx, by, depth - 1);
      drawKochLine(bx, by, x2, y2, depth - 1);
    }
    ctx.strokeStyle = 'rgba(200,170,80,0.12)';
    ctx.lineWidth = 0.6;
    const kochSegW = Math.min(160, w / 2.5);
    const kochCount = Math.max(1, Math.floor(w / kochSegW));
    for (let i = 0; i < kochCount; i++) {
      drawKochLine(i * kochSegW + 10, h * 0.82, (i + 1) * kochSegW - 10, h * 0.82, 3);
    }

    // Recursive square fractals — squares within squares, rotated
    function drawRecursiveSquare(x, y, size, depth, rot) {
      if (depth <= 0 || size < 2) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.strokeStyle = `rgba(220,180,60,${0.06 + depth * 0.03})`;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(-size / 2, -size / 2, size, size);
      ctx.restore();
      // 4 smaller squares at corners, each rotated
      if (depth > 1) {
        const sub = size * 0.42;
        const off = size * 0.38;
        const nextRot = rot + Math.PI / 6;
        drawRecursiveSquare(x - off, y - off, sub, depth - 1, nextRot);
        drawRecursiveSquare(x + off, y - off, sub, depth - 1, nextRot);
        drawRecursiveSquare(x - off, y + off, sub, depth - 1, nextRot);
        drawRecursiveSquare(x + off, y + off, sub, depth - 1, nextRot);
      }
    }
    const sqCount = Math.max(1, Math.floor(w / 155));
    for (let i = 0; i < sqCount; i++) {
      drawRecursiveSquare(75 + i * 150, h * 0.55, 24, 3, Math.PI / 8 + i * 0.2);
    }

    // Mathematical symbols — larger, more visible, varied fonts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mathSymbols = [
      { s: '∞', size: 14 }, { s: 'π', size: 12 }, { s: '∑', size: 13 },
      { s: '∫', size: 14 }, { s: 'φ', size: 12 }, { s: '√', size: 12 },
      { s: 'Δ', size: 11 }, { s: 'Ω', size: 11 }, { s: 'λ', size: 12 },
      { s: '∂', size: 12 }
    ];
    for (let i = 0; i < Math.min(mathSymbols.length, Math.floor(w / 65)); i++) {
      const sym = mathSymbols[i % mathSymbols.length];
      ctx.font = `${sym.size}px serif`;
      ctx.fillStyle = `rgba(220,190,100,${0.1 + Math.sin(i * 1.3) * 0.03})`;
      const sx = 30 + i * 62 + Math.sin(i * 2.1) * 8;
      const sy = h * 0.18 + Math.cos(i * 1.7) * h * 0.08;
      ctx.fillText(sym.s, sx, sy);
    }

    // Floating golden dust
    ctx.fillStyle = 'rgba(255,210,60,0.1)';
    for (let i = 0; i < Math.floor(w / 12); i++) {
      const px = Math.sin(i * 4.7) * w * 0.5 + w * 0.5;
      const py = Math.cos(i * 3.1) * h * 0.5 + h * 0.5;
      circle(ctx, px, py, 0.6 + Math.sin(i * 2.3) * 0.3);
      ctx.fill();
    }
  },
};

function drawDefaultRowBg(ctx, w, h) {
  ctx.fillStyle = '#2c1a0c';
  ctx.fillRect(0, 0, w, h);
  // Simple cookie pattern
  for (let i = 0; i < Math.floor(w / 50); i++) {
    miniCookie(ctx, 25 + i * 45, h * 0.5, 5);
  }
}
