import { Game } from "./js/game.js";

document.addEventListener('DOMContentLoaded', function() {
  // Create a single global tooltip element
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
    max-width: 220px;
    text-align: center;
  `;
  document.body.appendChild(globalTooltip);

  // Use event delegation instead of direct event listeners
  document.body.addEventListener('mouseover', function(e) {
    // Check if the target is an upgrade button
    if (e.target.classList.contains('upgrade-btn')) {
      const button = e.target;
      
      // Get tooltip data from attributes
      const effect = button.dataset.tooltipEffect;
      const cost = button.dataset.tooltipCost;
      
      if (effect && cost) {
        globalTooltip.textContent = `${effect} (Cost: ${cost})`;
        globalTooltip.style.opacity = '1';
        
        // Position the tooltip above the button
        const rect = button.getBoundingClientRect();
        globalTooltip.style.left = rect.left + (rect.width / 2) - (globalTooltip.offsetWidth / 2) + 'px';
        globalTooltip.style.top = rect.top - globalTooltip.offsetHeight - 10 + 'px';
      }
    }
  });

  document.body.addEventListener('mouseout', function(e) {
    // Check if the target is an upgrade button
    if (e.target.classList.contains('upgrade-btn')) {
      globalTooltip.style.opacity = '0';
    }
  });
});

const game = new Game();
game.start();