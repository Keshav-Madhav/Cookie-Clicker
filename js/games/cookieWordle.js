import { MINI_GAME_SETTINGS } from "../config.js";
import { formatNumberInWords } from "../utils.js";

/** CookieWordle mixin */
export const CookieWordleMixin = {
/* ════════════════════════════════════════════════════════════
   📝  COOKIE WORDLE — guess a 5-letter baking word in 6 tries
   ════════════════════════════════════════════════════════════ */

_cookieWordle() {
  const C = MINI_GAME_SETTINGS.cookieWordle;
  const snd = this.game.soundManager;
  const answer = C.words[Math.floor(Math.random() * C.words.length)];

  const state = {
    guesses: [],
    results: [],
    current: '',
    done: false,
    won: false,
    letterStates: {},
    _cleanup: null,
  };

  // ── Build initial DOM (once) ──
  let gridHtml = '';
  for (let row = 0; row < C.maxGuesses; row++) {
    gridHtml += '<div class="wordle-row">';
    for (let col = 0; col < C.wordLength; col++) {
      gridHtml += `<div class="wordle-cell" id="wc-${row}-${col}"></div>`;
    }
    gridHtml += '</div>';
  }

  const kbRows = [
    'QWERTYUIOP'.split(''),
    'ASDFGHJKL'.split(''),
    ['ENTER', ...'ZXCVBNM'.split(''), 'DEL'],
  ];
  let kbHtml = '';
  for (const kbRow of kbRows) {
    kbHtml += '<div class="wordle-kb-row">';
    for (const key of kbRow) {
      const wide = (key === 'ENTER' || key === 'DEL') ? ' wordle-key-wide' : '';
      kbHtml += `<button class="wordle-key${wide}" id="wk-${key}" data-key="${key}">${key === 'DEL' ? '⌫' : key}</button>`;
    }
    kbHtml += '</div>';
  }

  this._show(`<div class="mini-game-card wordle-card">
    <div class="mini-title">Cookie Wordle <button class="wordle-help-btn" id="wordle-help">?</button></div>
    <div class="wordle-grid">${gridHtml}</div>
    <div class="wordle-message" id="wordle-msg"></div>
    <div class="wordle-keyboard" id="wordle-kb">${kbHtml}</div>
  </div>`);

  // Help tooltip — hover-based like dungeon crawler
  const helpBtn = document.getElementById('wordle-help');
  if (helpBtn) {
    const showTip = () => {
      let tip = document.getElementById('wordle-tooltip');
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 'wordle-tooltip';
        tip.className = 'wordle-tooltip';
        tip.innerHTML = `
          <div class="wordle-tip-title">How to Play</div>
          <p>Guess a 5-letter baking word in 6 tries.</p>
          <p>Type a word and press <b>Enter</b> to submit.</p>
          <div class="wordle-tip-grid">
            <div class="wordle-tip-item"><span class="wordle-tip-swatch" style="background:#538d4e"></span><span>Green = correct letter, correct spot</span></div>
            <div class="wordle-tip-item"><span class="wordle-tip-swatch" style="background:#b59f3b"></span><span>Yellow = correct letter, wrong spot</span></div>
            <div class="wordle-tip-item"><span class="wordle-tip-swatch" style="background:rgba(58,58,60,0.8)"></span><span>Gray = letter not in word</span></div>
          </div>
          <div class="wordle-tip-footer">All words are baking/cookie themed!</div>`;
        document.body.appendChild(tip);
      }
      const r = helpBtn.getBoundingClientRect();
      tip.style.top = (r.bottom + 8) + 'px';
      tip.style.left = Math.max(8, r.left - 140) + 'px';
      tip.style.opacity = '1';
      tip.style.pointerEvents = 'auto';
    };
    const hideTip = () => {
      const tip = document.getElementById('wordle-tooltip');
      if (tip) { tip.style.opacity = '0'; tip.style.pointerEvents = 'none'; }
    };
    helpBtn.addEventListener('mouseenter', showTip);
    helpBtn.addEventListener('mouseleave', hideTip);
    helpBtn.addEventListener('click', (e) => { e.stopPropagation(); showTip(); });
  }

  // ── In-place UI updates (no DOM rebuild) ──
  const updateGrid = () => {
    for (let row = 0; row < C.maxGuesses; row++) {
      for (let col = 0; col < C.wordLength; col++) {
        const cell = document.getElementById(`wc-${row}-${col}`);
        if (!cell) continue;

        if (row < state.guesses.length) {
          cell.textContent = state.guesses[row][col];
          cell.className = `wordle-cell wordle-${state.results[row][col]} wordle-reveal`;
          cell.style.animationDelay = `${col * 0.1}s`;
        } else if (row === state.guesses.length) {
          cell.textContent = col < state.current.length ? state.current[col] : '';
          cell.className = col < state.current.length ? 'wordle-cell wordle-filled' : 'wordle-cell';
          cell.style.animationDelay = '';
        } else {
          cell.textContent = '';
          cell.className = 'wordle-cell';
          cell.style.animationDelay = '';
        }
      }
    }
  };

  const updateKeyboard = () => {
    for (const key in state.letterStates) {
      const el = document.getElementById(`wk-${key}`);
      if (el) {
        el.className = el.className.replace(/\s*wordle-key-(correct|present|absent)/g, '');
        el.classList.add(`wordle-key-${state.letterStates[key]}`);
      }
    }
  };

  const showMessage = (text) => {
    const msg = document.getElementById('wordle-msg');
    if (msg) { msg.textContent = text; setTimeout(() => { if (msg) msg.textContent = ''; }, 1500); }
  };

  // ── Key handler ──
  const handleKey = (key) => {
    if (state.done) return;

    if (key === 'DEL') {
      if (state.current.length > 0) {
        state.current = state.current.slice(0, -1);
        snd.wordleDelete();
        updateGrid();
      }
      return;
    }

    if (key === 'ENTER') {
      if (state.current.length < C.wordLength) {
        showMessage('Not enough letters');
        snd.wordleInvalid();
        const rows = document.querySelectorAll('.wordle-row');
        const curRow = rows[state.guesses.length];
        if (curRow) {
          curRow.classList.remove('wordle-shake');
          void curRow.offsetWidth;
          curRow.classList.add('wordle-shake');
        }
        return;
      }

      const guess = state.current;
      const result = this._wordleEvaluate(guess, answer);
      state.guesses.push(guess);
      state.results.push(result);

      for (let i = 0; i < C.wordLength; i++) {
        const letter = guess[i];
        const r = result[i];
        const prev = state.letterStates[letter];
        if (r === 'correct') state.letterStates[letter] = 'correct';
        else if (r === 'present' && prev !== 'correct') state.letterStates[letter] = 'present';
        else if (!prev) state.letterStates[letter] = 'absent';
      }

      state.current = '';
      updateGrid();
      updateKeyboard();

      // Play reveal sounds — staggered per tile
      const correctCount = result.filter(r => r === 'correct').length;
      for (let i = 0; i < C.wordLength; i++) {
        setTimeout(() => {
          if (result[i] === 'correct') snd.wordleCorrect();
          else if (result[i] === 'present') snd.wordlePresent();
          else snd.wordleAbsent();
        }, i * 100);
      }

      if (guess === answer) {
        state.done = true;
        state.won = true;
        setTimeout(() => snd.miniGameWin(), C.wordLength * 100 + 100);
        setTimeout(() => this._wordleFinish(state, C, answer), 1500);
        return;
      }

      if (state.guesses.length >= C.maxGuesses) {
        state.done = true;
        setTimeout(() => {
          showMessage(`It was ${answer}`);
          snd.wordleInvalid();
        }, C.wordLength * 100 + 100);
        setTimeout(() => this._wordleFinish(state, C, answer), 2500);
        return;
      }

      return;
    }

    // Letter input
    if (state.current.length < C.wordLength) {
      state.current += key;
      snd.wordleType();
      updateGrid();
    }
  };

  // ── Bind on-screen keyboard (once) ──
  document.querySelectorAll('.wordle-key').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleKey(btn.dataset.key);
    });
  });

  // ── Bind physical keyboard (once) ──
  const keyHandler = (e) => {
    if (state.done) return;
    const k = e.key.toUpperCase();
    if (k === 'ENTER') handleKey('ENTER');
    else if (k === 'BACKSPACE') handleKey('DEL');
    else if (/^[A-Z]$/.test(k)) handleKey(k);
  };
  document.addEventListener('keydown', keyHandler);
  state._cleanup = () => document.removeEventListener('keydown', keyHandler);
  this._activeCleanup = () => state._cleanup();
},

_wordleEvaluate(guess, answer) {
  const result = new Array(guess.length).fill('absent');
  const answerArr = answer.split('');

  // First pass: correct positions
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
      answerArr[i] = null;
    }
  }
  // Second pass: present but wrong position
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    const idx = answerArr.indexOf(guess[i]);
    if (idx !== -1) {
      result[i] = 'present';
      answerArr[idx] = null;
    }
  }
  return result;
},

_wordleFinish(state, C, answer = '') {
  if (state._cleanup) state._cleanup();

  let tier = null;
  if (state.won) {
    const g = state.guesses.length;
    if (g <= C.legendaryGuesses) tier = 'legendary';
    else if (g <= C.epicGuesses) tier = 'epic';
    else if (g <= C.greatGuesses) tier = 'great';
    else tier = 'normal';
  }

  const tierLabels = { legendary: 'LEGENDARY!', epic: 'EPIC!', great: 'GREAT!', normal: 'Nice!' };

  let rewardHtml = '';
  if (tier) {
    const reward = this._giveReward(tier, 'cookieWordle');
    rewardHtml = `<div class="mini-reward">+${formatNumberInWords(reward)} cookies</div>`;
  }

  const gridEmoji = state.results.map(row =>
    row.map(r => r === 'correct' ? '🟩' : r === 'present' ? '🟨' : '⬛').join('')
  ).join('<br>');

  this._show(`<div class="mini-game-card wordle-card">
    <div class="mini-title">Cookie Wordle</div>
    <div class="wordle-result">
      <div class="wordle-result-tier">${state.won ? tierLabels[tier] : 'Better luck next time!'}</div>
      <div class="wordle-result-guesses">${state.won ? `${state.guesses.length}/${C.maxGuesses} guesses` : `The word was <b>${answer}</b>`}</div>
      <div class="wordle-result-grid">${gridEmoji}</div>
      ${rewardHtml}
    </div>
  </div>`);
  setTimeout(() => this._close(), C.resultDisplayMs);
}

};
