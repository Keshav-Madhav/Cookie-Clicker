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
