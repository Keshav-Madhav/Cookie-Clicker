import { Game } from "./js/game.js";
import { formatNumberInWords } from "./js/utils.js";

document.addEventListener('DOMContentLoaded', function() {
  const globalTooltip = document.createElement('div');
  globalTooltip.id = 'global-tooltip';
  globalTooltip.style.cssText = `
    position: fixed;
    background: rgba(52, 73, 94, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    z-index: 10000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    max-width: 250px;
    text-align: center;
  `;
  document.body.appendChild(globalTooltip);

  document.body.addEventListener('mouseover', function(e) {
    const button = e.target.closest('.upgrade-btn');
    if (button) {
      const effect = button.dataset.tooltipEffect;
      const cost = button.dataset.tooltipCost;
      const disabledReason = button.dataset.disabledReason || '';
      const nextTier = button.dataset.tooltipNextTier || '';
      const requirement = button.dataset.tooltipRequirement || '';
      const condition = button.dataset.tooltipCondition || '';
      
      if (effect && cost) {
        let html = `<p>${effect}</p><p>Cost: ${formatNumberInWords(cost)}</p>`;
        if (condition) html += `<p style="color:#f0c040;font-size:11px">🔒 Requires: ${condition}</p>`;
        if (nextTier) html += `<p style="color:#f8c471;font-size:11px">${nextTier}</p>`;
        if (requirement) html += `<p style="color:#d5c4a1;font-size:11px">${requirement}</p>`;
        if (disabledReason && !condition) html += `<p style="color:#e74c3c;font-size:11px">${disabledReason}</p>`;
        
        globalTooltip.innerHTML = html;
        globalTooltip.style.opacity = '1';
        
        const rect = button.getBoundingClientRect();
        globalTooltip.style.left = rect.left + (rect.width / 2) - (globalTooltip.offsetWidth / 2) + 'px';
        globalTooltip.style.top = rect.top - globalTooltip.offsetHeight - 10 + 'px';
      }
    }

    // Building tooltips
    const building = e.target.closest('.building');
    if (building) {
      const nameP = building.querySelector('.name_p');
      const priceP = building.querySelector('.price_p');
      if (nameP && priceP) {
        globalTooltip.innerHTML = `<p>${nameP.textContent}</p><p>${priceP.textContent}</p>`;
        globalTooltip.style.opacity = '1';
        const rect = building.getBoundingClientRect();
        globalTooltip.style.left = rect.left + (rect.width / 2) - (globalTooltip.offsetWidth / 2) + 'px';
        globalTooltip.style.top = rect.top - globalTooltip.offsetHeight - 10 + 'px';
      }
    }
  });

  document.body.addEventListener('mouseout', function(e) {
    if (e.target.closest('.upgrade-btn') || e.target.closest('.building')) {
      globalTooltip.style.opacity = '0';
    }
  });

  // Touch support: long-press to show tooltip on mobile
  let touchTimer = null;
  let touchTarget = null;
  document.body.addEventListener('touchstart', function(e) {
    const btn = e.target.closest('.upgrade-btn') || e.target.closest('.building');
    if (!btn) return;
    touchTarget = btn;
    touchTimer = setTimeout(() => {
      // Simulate a mouseover to trigger tooltip
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      // Auto-hide after 2.5s
      setTimeout(() => { globalTooltip.style.opacity = '0'; }, 2500);
    }, 400);
  }, { passive: true });

  document.body.addEventListener('touchend', function() {
    clearTimeout(touchTimer);
    touchTarget = null;
  }, { passive: true });

  document.body.addEventListener('touchmove', function() {
    clearTimeout(touchTimer);
    touchTarget = null;
    globalTooltip.style.opacity = '0';
  }, { passive: true });
});

const game = new Game();
game._saveLoaded.then(() => {
  game.start();
  setupMobileNav(game);
});

/* ═══════════════════════════════════════════════════
   MOBILE TAB NAVIGATION
   ═══════════════════════════════════════════════════ */
function setupMobileNav(game) {
  const nav = document.getElementById('mobile-nav');
  if (!nav) return;

  const tabs = nav.querySelectorAll('.mobile-tab');
  const panels = {
    'click-area': document.getElementById('click-area'),
    'stats':      document.getElementById('stats'),
    'shop':       document.getElementById('shop'),
  };

  let activeTab = 'click-area';

  function isMobile() {
    return window.innerWidth <= 900;
  }

  function applyMobileClasses() {
    if (isMobile()) {
      Object.entries(panels).forEach(([key, panel]) => {
        if (key === activeTab) {
          panel.classList.add('mobile-active');
        } else {
          panel.classList.remove('mobile-active');
        }
      });
    } else {
      // Desktop — remove all mobile classes
      Object.values(panels).forEach(p => p.classList.remove('mobile-active'));
    }
  }

  function switchTab(targetTab) {
    if (targetTab === activeTab && isMobile()) return;
    activeTab = targetTab;

    // Update tab buttons
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === targetTab);
    });

    // Switch panels
    applyMobileClasses();

    // Trigger canvas resize after panel is visible
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Haptic feedback on mobile (if available)
    if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  }

  // Tab click handlers
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Handle window resize: apply / remove mobile classes
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyMobileClasses, 100);
  });

  // Initial setup
  applyMobileClasses();

  // ── Badge system: show dots on tabs when something interesting happens ──
  function updateShopBadge() {
    if (!isMobile() || activeTab === 'shop') return;
    const shopTab = nav.querySelector('[data-tab="shop"]');

    // Count affordable upgrades + buildings
    let affordable = 0;
    game.upgrades.forEach(u => {
      if (u.level < u.getEffectiveMaxLevel() && game.cookies >= u.cost) affordable++;
    });
    game.buildings.forEach(b => {
      if (game.cookies >= b.cost) affordable++;
    });

    // Remove existing badge
    const oldBadge = shopTab.querySelector('.mobile-tab-badge');
    if (oldBadge) oldBadge.remove();

    if (affordable > 0) {
      const badge = document.createElement('span');
      badge.className = 'mobile-tab-badge';
      badge.textContent = affordable > 9 ? '9+' : affordable;
      shopTab.appendChild(badge);
    }
  }

  // Update shop badge every 2 seconds
  setInterval(updateShopBadge, 2000);

  // Expose for golden cookie badge from visualEffects + tutorial tab switching
  game._mobileNav = {
    showGoldenBadge() {
      if (!isMobile() || activeTab === 'stats') return;
      const watchTab = nav.querySelector('[data-tab="stats"]');
      if (watchTab.querySelector('.mobile-tab-badge')) return;
      const badge = document.createElement('span');
      badge.className = 'mobile-tab-badge golden';
      badge.textContent = '🍪';
      watchTab.appendChild(badge);
    },
    clearGoldenBadge() {
      const watchTab = nav.querySelector('[data-tab="stats"]');
      const badge = watchTab.querySelector('.mobile-tab-badge.golden');
      if (badge) badge.remove();
    },
    switchTab(tab) { switchTab(tab); },
    isMobile() { return isMobile(); },
    get activeTab() { return activeTab; },
  };
}