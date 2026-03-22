import { MINI_GAME_SETTINGS, TRIVIA_QUESTIONS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** Trivia mixin */
export const TriviaMixin = {
/* ════════════════════════════════════════════════════════════
   🧠  TRIVIA  — expanded questions, shuffled options
   ════════════════════════════════════════════════════════════ */
_trivia() {
  const cfg = MINI_GAME_SETTINGS.trivia;
  const questions = TRIVIA_QUESTIONS;

  const trivia = questions[Math.floor(Math.random() * questions.length)];
  const correctAnswer = trivia.a[trivia.correct];

  // Fisher-Yates shuffle for proper randomization
  const shuffled = [...trivia.a];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const correctIdx = shuffled.indexOf(correctAnswer);

  const btnsHtml = shuffled.map((a, i) =>
    `<button class="trivia-btn" data-idx="${i}">${a}</button>`
  ).join("");

  const overlay = this._show(`
    <div class="mini-game-card">
      <div class="mini-title">🧠 Cookie Trivia</div>
      <div class="trivia-question">${trivia.q}</div>
      <div class="trivia-answers">${btnsHtml}</div>
      <div class="mini-result" id="trivia-result"></div>
    </div>
  `);
  if (!overlay) return;
  this.game.soundManager.triviaQuestionAppear();

  let answered = false;
  let autoCloseTimer = null;

  overlay.querySelectorAll(".trivia-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (answered) return;
      answered = true;
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      const idx = parseInt(btn.dataset.idx);
      const resultEl = document.getElementById("trivia-result");

      overlay.querySelectorAll(".trivia-btn").forEach((b, i) => {
        if (i === correctIdx) b.classList.add("trivia-correct");
        else b.classList.add("trivia-wrong");
        b.disabled = true;
      });

      if (idx === correctIdx) {
        this.game.soundManager.triviaCorrect();
        const r = this._giveReward("great", "trivia");
        if (resultEl) {
          resultEl.textContent = `✅ Correct! +${formatNumberInWords(r)} cookies!`;
          resultEl.classList.add("mini-win");
        }
      } else {
        this.game.soundManager.triviaWrong();
        if (resultEl) resultEl.textContent = `❌ Nope! It's ${correctAnswer}.`;
      }
      setTimeout(() => this._close(), cfg.resultDisplayMs);
    });
  });

  autoCloseTimer = setTimeout(() => {
    if (!answered) {
      answered = true;
      this.game.soundManager.triviaTimeUp();
      const resultEl = document.getElementById("trivia-result");
      if (resultEl) resultEl.textContent = "⏰ Time's up!";
      overlay.querySelectorAll(".trivia-btn").forEach((b, i) => {
        if (i === correctIdx) b.classList.add("trivia-correct");
        else b.classList.add("trivia-wrong");
        b.disabled = true;
      });
      setTimeout(() => this._close(), cfg.timeUpDisplayMs);
    }
  }, cfg.autoCloseMs);
  this._activeCleanup = () => { answered = true; if (autoCloseTimer) clearTimeout(autoCloseTimer); };
}

};
