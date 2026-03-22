import { MINI_GAME_SETTINGS, MATH_OPERATIONS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** MathBaker mixin */
export const MathBakerMixin = {
/* ════════════════════════════════════════════════════════════
   🧮  MATH BAKER  — solve math problems for cookies!
   Higher reward for longer gameplay!
   ════════════════════════════════════════════════════════════ */
_mathBaker() {
  const cfg = MINI_GAME_SETTINGS.mathBaker;
  const durationSec = cfg.durationMs / 1000;

  const overlay = this._show(`
    <div class="mini-game-card mini-math-card">
      <div class="mini-title">🧮 Math Baker! <span class="mini-sub">Calculate recipe portions!</span></div>
      <div class="math-problem" id="math-problem">Loading...</div>
      <div class="math-answers" id="math-answers"></div>
      <div class="math-stats">
        <span>⭐ Score: <span id="math-score">0</span></span>
        <span>✅ Correct: <span id="math-correct">0</span></span>
        <span>❌ Wrong: <span id="math-wrong">0</span></span>
      </div>
      <div class="mini-timer-bar"><div class="mini-timer-fill" id="math-timer"></div></div>
      <div class="math-question-timer"><div class="math-question-fill" id="math-q-timer"></div></div>
      <div class="mini-result" id="math-result"></div>
    </div>
  `);
  if (!overlay) return;

  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let questionNum = 0;
  let active = true;
  let questionTimeout = null;
  let questionStartTime = 0;

  // Start main timer
  requestAnimationFrame(() => {
    const bar = document.getElementById("math-timer");
    if (bar) { bar.style.transition = `width ${durationSec}s linear`; bar.style.width = "0%"; }
  });

  const updateStats = () => {
    const scoreEl = document.getElementById('math-score');
    const correctEl = document.getElementById('math-correct');
    const wrongEl = document.getElementById('math-wrong');
    if (scoreEl) scoreEl.textContent = score;
    if (correctEl) correctEl.textContent = correctCount;
    if (wrongEl) wrongEl.textContent = wrongCount;
  };

  const getDifficulty = () => {
    if (questionNum < cfg.easyQuestionsCount) return 'easy';
    if (questionNum < cfg.easyQuestionsCount + cfg.mediumQuestionsCount) return 'medium';
    return 'hard';
  };

  const generateQuestion = () => {
    const difficulty = getDifficulty();
    const ops = MATH_OPERATIONS[difficulty];
    const op = ops[Math.floor(Math.random() * ops.length)];
    
    let maxNum;
    if (difficulty === 'easy') maxNum = cfg.easyMaxNumber;
    else if (difficulty === 'medium') maxNum = cfg.mediumMaxNumber;
    else maxNum = cfg.hardMaxNumber;

    let a, b, answer;
    
    switch (op) {
      case '+':
        // Avoid trivial: both numbers at least 3
        a = Math.floor(Math.random() * (maxNum - 3)) + 3;
        b = Math.floor(Math.random() * (maxNum - 3)) + 3;
        answer = a + b;
        break;
      case '-':
        // Ensure a > b and both meaningful (avoid x - 0, x - 1)
        a = Math.floor(Math.random() * (maxNum - 5)) + 8;
        b = Math.floor(Math.random() * (a - 4)) + 2; // b is at least 2, leaves result >= 2
        answer = a - b;
        break;
      case '×':
        // Avoid ×1 and ×0: both numbers at least 2, max 12 for reasonable difficulty
        a = Math.floor(Math.random() * 10) + 2; // 2-11
        b = Math.floor(Math.random() * 10) + 2; // 2-11
        answer = a * b;
        break;
      case '÷':
        // Avoid ÷1: divisor at least 2, result at least 2
        b = Math.floor(Math.random() * 10) + 2; // 2-11
        answer = Math.floor(Math.random() * 10) + 2; // result 2-11
        a = b * answer; // Ensure clean division
        break;
    }

    return { a, b, op, answer };
  };

  const generateWrongAnswers = (correctAnswer) => {
    const wrongs = new Set();
    const variance = Math.max(10, Math.abs(correctAnswer) * 0.3);
    
    while (wrongs.size < 3) {
      let wrong;
      const r = Math.random();
      if (r < 0.3) {
        // Close to correct
        wrong = correctAnswer + Math.floor(Math.random() * 5) + 1;
      } else if (r < 0.6) {
        wrong = correctAnswer - Math.floor(Math.random() * 5) - 1;
      } else {
        // Random in range
        wrong = correctAnswer + Math.floor((Math.random() - 0.5) * variance * 2);
      }
      if (wrong !== correctAnswer && wrong >= 0) {
        wrongs.add(wrong);
      }
    }
    return Array.from(wrongs);
  };

  const showQuestion = () => {
    if (!active) return;
    this.game.soundManager.mathQuestionAppear();

    const q = generateQuestion();
    const wrongAnswers = generateWrongAnswers(q.answer);
    const allAnswers = [q.answer, ...wrongAnswers];
    
    // Shuffle answers
    for (let i = allAnswers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
    }

    const problemEl = document.getElementById('math-problem');
    const answersEl = document.getElementById('math-answers');
    
    if (problemEl) {
      problemEl.textContent = `${q.a} ${q.op} ${q.b} = ?`;
      problemEl.classList.remove('math-correct', 'math-wrong');
    }

    if (answersEl) {
      answersEl.innerHTML = allAnswers.map(ans => 
        `<button class="math-btn" data-answer="${ans}">${ans}</button>`
      ).join('');

      answersEl.querySelectorAll('.math-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!active) return;
          
          const selected = parseInt(btn.dataset.answer);
          const timeTaken = Date.now() - questionStartTime;
          
          clearTimeout(questionTimeout);
          
          answersEl.querySelectorAll('.math-btn').forEach(b => {
            b.disabled = true;
            if (parseInt(b.dataset.answer) === q.answer) {
              b.classList.add('math-btn-correct');
            }
          });

          if (selected === q.answer) {
            correctCount++;
            let points = cfg.correctPoints;
            if (timeTaken < 3000) {
              points += cfg.fastBonusPoints;
              this.game.soundManager.mathFastBonus();
            } else {
              this.game.soundManager.mathCorrect();
            }
            score += points;
            if (problemEl) {
              problemEl.classList.add('math-correct');
              problemEl.textContent = `✅ +${points}!`;
            }
          } else {
            this.game.soundManager.mathWrong();
            wrongCount++;
            score = Math.max(0, score - cfg.wrongPenalty);
            btn.classList.add('math-btn-wrong');
            if (problemEl) {
              problemEl.classList.add('math-wrong');
              problemEl.textContent = `❌ It was ${q.answer}`;
            }
          }

          updateStats();
          questionNum++;

          setTimeout(() => {
            if (active) showQuestion();
          }, 800);
        });
      });
    }

    // Question timer
    const qTimer = document.getElementById('math-q-timer');
    if (qTimer) {
      qTimer.style.transition = 'none';
      qTimer.style.width = '100%';
      requestAnimationFrame(() => {
        qTimer.style.transition = `width ${cfg.questionTimeMs}ms linear`;
        qTimer.style.width = '0%';
      });
    }

    questionStartTime = Date.now();
    questionTimeout = setTimeout(() => {
      if (!active) return;
      this.game.soundManager.mathTimeUp();
      wrongCount++;
      score = Math.max(0, score - cfg.wrongPenalty);
      if (problemEl) {
        problemEl.classList.add('math-wrong');
        problemEl.textContent = `⏰ Time! Answer: ${q.answer}`;
      }
      updateStats();
      questionNum++;
      setTimeout(() => {
        if (active) showQuestion();
      }, 800);
    }, cfg.questionTimeMs);
  };

  // Start first question
  showQuestion();

  // Game end
  const mathEndTimer = setTimeout(() => {
    if (active) {
      active = false;
      clearTimeout(questionTimeout);
      this._finishMathBaker(score, correctCount, wrongCount, cfg);
    }
  }, cfg.durationMs);
  this._activeCleanup = () => { active = false; clearTimeout(mathEndTimer); clearTimeout(questionTimeout); };
},

_finishMathBaker(score, correctCount, wrongCount, cfg) {
  const resultEl = document.getElementById('math-result');
  let tier = null;
  let msg = '';

  if (score >= cfg.legendaryThreshold) {
    tier = 'legendary';
    msg = '🏆 LEGENDARY! Math genius!';
  } else if (score >= cfg.epicThreshold) {
    tier = 'epic';
    msg = '⭐ EPIC! Calculator brain!';
  } else if (score >= cfg.greatThreshold) {
    tier = 'great';
    msg = '🧮 Great math skills!';
  } else if (score >= cfg.normalThreshold) {
    tier = 'normal';
    msg = '📊 Not bad, mathematician!';
  } else {
    msg = '😅 Math is hard! Keep trying!';
  }

  if (tier) {
    const r = this._giveReward(tier, 'mathBaker');
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
