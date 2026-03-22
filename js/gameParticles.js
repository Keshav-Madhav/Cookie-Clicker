import { PARTICLES } from "./config.js";
import { formatNumberInWords } from "./utils.js";

export const ParticlesMixin = {
initParticles() {
  this._particles = [];
  const canvas = document.getElementById("cookie-particles");
  if (!canvas) return;
  const container = document.getElementById("cookie-container");
  const resize = () => {
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
  };
  resize();
  window.addEventListener("resize", resize);
  const ctx = canvas.getContext("2d");

  // Ambient floating particles
  for (let i = 0; i < PARTICLES.ambientCount; i++) {
    this._particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.5 + 1,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4 - 0.2,
      alpha: Math.random() * 0.5 + 0.2,
      color: ['#f8c471', '#e67e22', '#d4a76a', '#ffd700'][Math.floor(Math.random() * 4)],
      life: 1,
      maxLife: 1,
      ambient: true,
    });
  }

  const animLoop = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let i = 0;
    while (i < this._particles.length) {
      const p = this._particles[i];
      p.x += p.dx;
      p.y += p.dy;
      if (!p.ambient) {
        if (p.gravity) p.dy += p.gravity;
        p.life -= 0.02;
        if (p.life <= 0) {
          // Swap-and-pop: faster than splice for large arrays
          const last = this._particles.length - 1;
          if (i !== last) this._particles[i] = this._particles[last];
          this._particles.length = last;
          continue;
        }
      } else {
        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }
      const alpha = p.ambient ? p.alpha : p.alpha * p.life;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      i++;
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(animLoop);
  };
  animLoop();
},

spawnClickParticles(event) {
  const canvas = document.getElementById("cookie-particles");
  if (!canvas) return;
  // Skip if too many particles already active
  if (this._particles.length >= this._particleMaxNonAmbient + PARTICLES.ambientCount) return;
  const rect = canvas.getBoundingClientRect();
  const cx = event.clientX - rect.left;
  const cy = event.clientY - rect.top;
  const colors = ['#f8c471', '#e67e22', '#ffd700', '#fff8dc', '#d4a76a', '#ffe082', '#ffb347'];
  // Big burst particles with varied sizes and slight gravity
  for (let i = 0; i < PARTICLES.clickBurstCount; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLES.clickBurstCount + (Math.random() - 0.5) * 0.6;
    const speed = Math.random() * 4 + 2;
    const size = Math.random() * 4 + 1;
    this._particles.push({
      x: cx, y: cy,
      r: size,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed - 1.5,
      alpha: 0.9,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      maxLife: 1,
      ambient: false,
      gravity: PARTICLES.burstGravity,
    });
  }
  // Larger "sparkle" particles
  for (let i = 0; i < PARTICLES.clickSparkleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 0.8;
    this._particles.push({
      x: cx, y: cy,
      r: Math.random() * 2 + 3,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed - 0.8,
      alpha: 1,
      color: '#ffd700',
      life: 1,
      maxLife: 1,
      ambient: false,
      gravity: PARTICLES.sparkleGravity,
    });
  }
},

spawnClickRipple(event) {
  const container = document.getElementById("cookie-container");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  // Spawn two ripples with slight delay for layered effect
  for (let i = 0; i < 2; i++) {
    setTimeout(() => {
      const ripple = document.createElement("div");
      ripple.classList.add("cookie-ripple");
      if (i === 1) ripple.classList.add("cookie-ripple-delayed");
      ripple.style.left = x + "px";
      ripple.style.top = y + "px";
      container.appendChild(ripple);
      setTimeout(() => ripple.remove(), PARTICLES.rippleRemovalMs);
    }, i * PARTICLES.rippleLayerDelayMs);
  }
},

createFloatingText(event, text, isSpecial = false) {
  // Cap concurrent floating texts to prevent DOM bloat
  if (!this._floatingTexts) this._floatingTexts = [];
  while (this._floatingTexts.length >= 8) {
    const oldest = this._floatingTexts.shift();
    oldest.remove();
  }

  const floatingText = document.createElement("span");
  floatingText.textContent = text;
  floatingText.classList.add("cookie-text");
  if (isSpecial) floatingText.classList.add("special-text");

  let x = event.clientX;
  let y = event.clientY;
  // Synthetic clicks (keyboard Space/Enter) have 0,0 — fall back to cookie center
  if (!x && !y) {
    const btn = document.getElementById('cookie-button');
    if (btn) {
      const r = btn.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height * 0.3;
    }
  }
  floatingText.style.left = `${x}px`;
  floatingText.style.top = `${y}px`;

  document.body.appendChild(floatingText);
  this._floatingTexts.push(floatingText);
  setTimeout(() => {
    floatingText.remove();
    const idx = this._floatingTexts.indexOf(floatingText);
    if (idx !== -1) this._floatingTexts.splice(idx, 1);
  }, PARTICLES.floatingTextDurationMs);
}

};
