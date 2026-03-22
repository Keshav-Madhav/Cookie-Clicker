import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** EmojiMemory mixin */
export const EmojiMemoryMixin = {
/* ════════════════════════════════════════════════════════════
   🧠  EMOJI MEMORY  — 5 pairs (10 cards)
   ════════════════════════════════════════════════════════════ */
_emojiMemory() {
  const cfg = MINI_GAME_SETTINGS.emojiMemory;
  const pool = [...cfg.emojiPool];
  // Fisher-Yates to pick pairs
  const shuffledPool = [...pool];
  for (let i = shuffledPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
  }
  const chosen = shuffledPool.slice(0, cfg.totalPairs);
  const cards = [...chosen, ...chosen];
  // Shuffle cards
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  let flipped = [];
  let matched = 0;
  let checking = false;
  let moves = 0;
  const totalPairs = cfg.totalPairs;

  const cardsHtml = cards.map((_, i) =>
    `<div class="memory-card" data-idx="${i}">❓</div>`
  ).join("");

  const overlay = this._show(`
    <div class="mini-game-card mini-memory-card">
      <div class="mini-title">🧠 Memory Match! <span class="mini-sub" id="memory-moves">0 moves</span></div>
      <div class="memory-grid memory-grid-5">${cardsHtml}</div>
      <div class="mini-result" id="memory-result"></div>
    </div>
  `);
  if (!overlay) return;

  overlay.querySelectorAll(".memory-card").forEach(card => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(card.dataset.idx);
      if (checking || card.classList.contains("memory-flipped") || card.classList.contains("memory-matched")) return;

      card.textContent = cards[idx];
      card.classList.add("memory-flipped");
      this.game.soundManager.memoryFlip();
      flipped.push({ idx, card });

      if (flipped.length === 2) {
        checking = true;
        moves++;
        const movesEl = document.getElementById("memory-moves");
        if (movesEl) movesEl.textContent = `${moves} moves`;

        const [a, b] = flipped;
        if (cards[a.idx] === cards[b.idx]) {
          this.game.soundManager.memoryMatch();
          a.card.classList.add("memory-matched");
          b.card.classList.add("memory-matched");
          matched++;
          flipped = [];
          checking = false;
          if (matched === totalPairs) {
            this.game.soundManager.memoryCelebration();
            const res = document.getElementById("memory-result");
            let tier = moves <= cfg.greatMovesThreshold ? "great" : "normal";
            const r = this._giveReward(tier, "memory");
            if (res) {
              const ratingMsg = moves <= cfg.greatMovesThreshold ? "🎉 Incredible memory!" : moves <= 12 ? "🎉 Well done!" : "🎉 All matched!";
              res.textContent = `${ratingMsg} +${formatNumberInWords(r)} cookies!`;
              res.classList.add("mini-win");
            }
            setTimeout(() => this._close(), cfg.resultDisplayMs);
          }
        } else {
          this.game.soundManager.memoryMismatch();
          setTimeout(() => {
            a.card.textContent = "❓";
            b.card.textContent = "❓";
            a.card.classList.remove("memory-flipped");
            b.card.classList.remove("memory-flipped");
            flipped = [];
            checking = false;
          }, cfg.mismatchDelayMs);
        }
      }
    });
  });

  // Auto-close after 25 seconds
  const memAutoClose = setTimeout(() => {
    if (matched < totalPairs) {
      const res = document.getElementById("memory-result");
      if (res) res.textContent = `⏰ Time's up! Found ${matched}/${totalPairs} pairs.`;
      if (matched >= cfg.partialRewardMinPairs) {
        const r = this._giveReward("normal", "memory");
        if (res) res.textContent += ` +${formatNumberInWords(r)}!`;
      }
      setTimeout(() => this._close(), cfg.timeUpDisplayMs);
    }
  }, cfg.autoCloseMs);
  this._activeCleanup = () => { matched = totalPairs; clearTimeout(memAutoClose); };
}

};
