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
});

const game = new Game();
game._saveLoaded.then(() => game.start());