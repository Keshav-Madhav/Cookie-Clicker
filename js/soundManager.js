/**
 * SoundManager — procedural audio via Web Audio API (no audio files).
 *
 * Every cookie click plays the next melody note — the music goes
 * exactly as fast as you click.  Sync bonus (1.5×) rewards clicking
 * at the piece's own BPM (±20 %).
 *
 * If you're spam-clicking way faster (>3× the BPM), the music
 * switches to auto-play at the correct tempo so it stays pleasant
 * as ambient background music.
 */
import { symphonies } from './symphonies.js';

export class SoundManager {
  constructor(game) {
    this.game = game;
    this._ctx = null;
    this._pieces = symphonies;
    this._totalNotes = this._pieces.reduce((s, p) => s + p.notes.length, 0);
    this._clickTimes = [];      // timestamps for rhythm / BPM calc
    this._lastPieceIdx = -1;    // detect piece changes for UI
    this._autoPlaying = false;  // auto-play mode active
    this._autoTimer = null;     // setTimeout id for auto-play
    this._lastNoteTime = 0;     // performance.now() of last played note
  }

  // ─── context ──────────────────────────────────────────────

  _ensureContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  _canPlay() { return !!this.game.settings.sound; }

  // ─── tone helpers ─────────────────────────────────────────

  _playTone(type, startHz, endHz, duration, volume = 0.08, delay = 0) {
    const ctx = this._ensureContext();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, t);
    if (startHz !== endHz) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endHz, 1), t + duration);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  _playNoise(duration, volume = 0.04, delay = 0, freq = 2000) {
    const ctx = this._ensureContext();
    const t = ctx.currentTime + delay;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + duration);
  }

  _playSequence(type, freqs, dur, vol = 0.06) {
    freqs.forEach((hz, i) => this._playTone(type, hz, hz, dur * 0.85, vol, i * dur));
  }

  // ─── melody note (warm music-box tone) ────────────────────

  _playMelodyNote(freq) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    const dur = 0.22;
    const vol = 0.08;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 3, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, now);
    g2.gain.linearRampToValueAtTime(vol * 0.12, now + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.6);
    osc2.connect(g2).connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + dur * 0.6);
  }

  // ─── piece / melody helpers ───────────────────────────────

  _getCurrentPiece() {
    return this._getPieceAt((this.game.stats.melodyIndex || 0) % this._totalNotes);
  }

  _getPieceAt(idx) {
    let cum = 0;
    for (let i = 0; i < this._pieces.length; i++) {
      if (idx < cum + this._pieces[i].notes.length) {
        return { piece: this._pieces[i], noteIdx: idx - cum, pieceIdx: i };
      }
      cum += this._pieces[i].notes.length;
    }
    return { piece: this._pieces[0], noteIdx: 0, pieceIdx: 0 };
  }

  getCurrentPieceName() { return this._getCurrentPiece().piece.name; }
  getCurrentBPM()       { return this._getCurrentPiece().piece.bpm; }
  /** Sync target = piece's own BPM. */
  getTargetClickBPM()   { return this.getCurrentBPM(); }
  /** True when auto-play is driving the melody. */
  isAutoPlaying()       { return this._autoPlaying; }

  pieceChanged() {
    const cur = this._getCurrentPiece().pieceIdx;
    const changed = cur !== this._lastPieceIdx;
    this._lastPieceIdx = cur;
    return changed;
  }

  // ─── rhythm detection ─────────────────────────────────────

  /**
   * Sync bonus when clicking at the piece's BPM ±20 %.
   * Not awarded during auto-play.
   */
  isInSync() {
    if (!this.game.settings.sound) return false;
    if (this._autoPlaying) return false;
    if (this._clickTimes.length < 4) return false;

    const recent = this._clickTimes.slice(-6);
    const span = recent[recent.length - 1] - recent[0];
    const avgInterval = span / (recent.length - 1);

    const target = 60000 / this.getCurrentBPM();
    return avgInterval >= target * 0.8 && avgInterval <= target * 1.2;
  }

  getClickBPM() {
    if (this._clickTimes.length < 2) return 0;
    const recent = this._clickTimes.slice(-6);
    const span = recent[recent.length - 1] - recent[0];
    if (span <= 0) return 0;
    return Math.round(60000 / (span / (recent.length - 1)));
  }

  syncTimedOut() {
    if (this._clickTimes.length === 0) return true;
    const last = this._clickTimes[this._clickTimes.length - 1];
    return Date.now() - last > (60000 / this.getCurrentBPM()) * 2.5;
  }

  // ─── auto-play with tempo ramp ─────────────────────────────

  _startAutoPlay() {
    if (this._autoPlaying) return;
    this._autoPlaying = true;
    this._lastNoteTime = performance.now();
    // Start at the user's current click rate, will ramp toward piece BPM
    this._autoBPM = Math.min(this.getClickBPM() || this.getCurrentBPM(), this.getCurrentBPM() * 4);
    this._autoPlayTick();
  }

  _autoPlayTick() {
    if (!this._autoPlaying || !this._canPlay()) {
      this._autoPlaying = false;
      return;
    }
    this._advanceNote();
    this._lastNoteTime = performance.now();

    // Ease _autoBPM toward the piece's natural BPM (~15% per tick)
    const target = this.getCurrentBPM();
    this._autoBPM += (target - this._autoBPM) * 0.15;
    if (Math.abs(this._autoBPM - target) < 1) this._autoBPM = target;

    const ms = 60000 / this._autoBPM;
    this._autoTimer = setTimeout(() => this._autoPlayTick(), ms);
  }

  stopAutoPlay() {
    this._autoPlaying = false;
    if (this._autoTimer) {
      clearTimeout(this._autoTimer);
      this._autoTimer = null;
    }
  }

  // ─── shared note playback ─────────────────────────────────

  _advanceNote() {
    const { piece, noteIdx } = this._getCurrentPiece();
    const midi = piece.notes[noteIdx];
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    this._playMelodyNote(freq);
    this.game.stats.melodyIndex = ((this.game.stats.melodyIndex || 0) + 1) % this._totalNotes;
  }

  // ─── public sound events ──────────────────────────────────

  /**
   * Cookie click.
   * - Normal speed: each click = next note.
   * - Fast speed (>2× BPM): auto-play ramps from click rate → piece BPM.
   * - Slowing back down: auto-play stops, min-gap prevents double notes.
   */
  click() {
    if (!this._canPlay()) return;

    this._clickTimes.push(Date.now());
    if (this._clickTimes.length > 12) this._clickTimes.shift();

    const cpm = this.getClickBPM();
    const threshold = this.getCurrentBPM() * 2;

    if (cpm > threshold && this._clickTimes.length >= 4) {
      if (!this._autoPlaying) this._startAutoPlay();
      return;
    }

    // Transitioning back to manual — stop auto-play
    if (this._autoPlaying) this.stopAutoPlay();

    // Minimum gap from last note to avoid double-hits on transition
    const gap = performance.now() - (this._lastNoteTime || 0);
    const minGap = 60000 / (this.getCurrentBPM() * 2.5); // ~40% of a beat
    if (gap < minGap) return;

    this._advanceNote();
    this._lastNoteTime = performance.now();
  }

  purchase() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 350, 280, 0.1, 0.06);
  }

  upgrade() {
    if (!this._canPlay()) return;
    this._playTone('sine', 440, 440, 0.12, 0.06);
    this._playTone('sine', 660, 660, 0.15, 0.07, 0.1);
  }

  achievement() {
    if (!this._canPlay()) return;
    this._playTone('sine', 330, 330, 0.4, 0.05);
    this._playTone('sine', 415, 415, 0.35, 0.05, 0.08);
    this._playTone('sine', 494, 494, 0.3, 0.06, 0.16);
    this._playTone('triangle', 660, 660, 0.3, 0.04, 0.24);
  }

  goldenCookie() {
    if (!this._canPlay()) return;
    // Sparkle shimmer layer
    this._playTone('sine', 1047, 1568, 0.3, 0.06);
    this._playTone('sine', 1320, 1760, 0.25, 0.05, 0.05);
    // Chime arpeggio
    this._playTone('triangle', 880, 880, 0.15, 0.05, 0.1);
    this._playTone('triangle', 1109, 1109, 0.15, 0.05, 0.18);
    this._playTone('triangle', 1319, 1319, 0.15, 0.05, 0.26);
    this._playTone('sine', 1760, 1760, 0.2, 0.06, 0.34);
    // Sparkle noise
    this._playNoise(0.25, 0.04, 0.05, 4000);
    this._playNoise(0.15, 0.03, 0.3, 5000);
  }

  luckyClick() {
    if (!this._canPlay()) return;
    // Similar to golden but shorter, one sweep + chime
    this._playTone('sine', 880, 1320, 0.2, 0.05);
    this._playTone('triangle', 1047, 1047, 0.12, 0.04, 0.08);
    this._playTone('triangle', 1319, 1319, 0.12, 0.04, 0.16);
    this._playNoise(0.12, 0.03, 0.05, 3500);
  }

  frenzy() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 120, 300, 0.35, 0.07);
    this._playTone('sine', 200, 500, 0.25, 0.04, 0.15);
  }

  miniGameWin() {
    if (!this._canPlay()) return;
    this._playSequence('triangle', [392, 494, 588], 0.1, 0.06);
  }

  prestige() {
    if (!this._canPlay()) return;
    // Grand ascending flare — layered octave climb
    this._playTone('sine', 131, 165, 0.4, 0.05);
    this._playTone('sine', 165, 220, 0.4, 0.06, 0.15);
    this._playTone('sine', 220, 330, 0.4, 0.06, 0.35);
    this._playTone('sine', 330, 440, 0.35, 0.07, 0.55);
    this._playTone('triangle', 440, 660, 0.35, 0.05, 0.75);
    this._playTone('sine', 660, 880, 0.3, 0.06, 0.95);
    // Final shimmer chord
    this._playTone('sine', 880, 880, 0.5, 0.05, 1.1);
    this._playTone('sine', 1109, 1109, 0.4, 0.04, 1.15);
    this._playTone('triangle', 1319, 1319, 0.35, 0.04, 1.2);
    // Noise wash
    this._playNoise(0.6, 0.03, 0.8, 2000);
    this._playNoise(0.3, 0.03, 1.1, 4000);
  }

  prestigeUpgrade() {
    if (!this._canPlay()) return;
    // Richer than normal upgrade — resonant chord with shimmer
    this._playTone('sine', 440, 440, 0.18, 0.06);
    this._playTone('sine', 554, 554, 0.18, 0.05, 0.04);
    this._playTone('sine', 660, 660, 0.2, 0.06, 0.08);
    this._playTone('triangle', 880, 880, 0.25, 0.04, 0.14);
    this._playNoise(0.1, 0.02, 0.12, 3000);
  }

  // ─── UI interaction sounds ──────────────────────────────

  uiClick() {
    if (!this._canPlay()) return;
    this._playTone('sine', 600, 500, 0.04, 0.03);
  }

  panelOpen() {
    if (!this._canPlay()) return;
    this._playTone('sine', 300, 500, 0.08, 0.04);
    this._playTone('triangle', 400, 600, 0.06, 0.02, 0.02);
  }

  panelClose() {
    if (!this._canPlay()) return;
    this._playTone('sine', 500, 300, 0.08, 0.03);
  }

  // ─── Tutorial (gentle, informational) ────────────────────

  tutorialNext() {
    if (!this._canPlay()) return;
    this._playTone('sine', 480, 640, 0.1, 0.05);
    this._playNoise(0.06, 0.02, 0.02, 2000);
  }

  tutorialSkip() {
    if (!this._canPlay()) return;
    this._playTone('sine', 500, 350, 0.1, 0.04);
    this._playTone('triangle', 400, 250, 0.1, 0.03, 0.02);
  }

  // ─── News / Reporter ─────────────────────────────────────

  anchorHairClick() {
    if (!this._canPlay()) return;
    this._playTone('sine', 300, 800, 0.1, 0.05);
    this._playTone('sine', 800, 300, 0.1, 0.05, 0.1);
    this._playTone('triangle', 500, 600, 0.08, 0.03, 0.05);
  }

  newsPlayDice() {
    if (!this._canPlay()) return;
    this._playNoise(0.04, 0.04, 0, 3000);
    this._playNoise(0.04, 0.04, 0.06, 3000);
    this._playNoise(0.04, 0.04, 0.12, 3000);
    this._playTone('triangle', 500, 600, 0.08, 0.03, 0.16);
  }

  // ─── Slot Machine (casino — triangle waves, bright) ──────

  slotReelTick() {
    if (!this._canPlay()) return;
    this._playTone('square', 800, 780, 0.02, 0.03);
  }

  slotReelStop() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 600, 400, 0.08, 0.05);
    this._playTone('square', 200, 200, 0.04, 0.03, 0.02);
  }

  slotJackpot() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 523, 523, 0.12, 0.06);
    this._playTone('triangle', 659, 659, 0.12, 0.06, 0.1);
    this._playTone('triangle', 784, 784, 0.12, 0.06, 0.2);
    this._playTone('triangle', 1047, 1047, 0.2, 0.07, 0.3);
    this._playNoise(0.2, 0.04, 0.3, 4000);
  }

  slotPairWin() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 523, 523, 0.1, 0.05);
    this._playTone('triangle', 659, 659, 0.12, 0.05, 0.08);
  }

  slotLoss() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 300, 200, 0.15, 0.04);
  }

  slotSpinAgain() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 440, 550, 0.06, 0.04);
    this._playTone('triangle', 550, 660, 0.06, 0.04, 0.06);
  }

  slotCashOut() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 660, 440, 0.1, 0.05);
    this._playNoise(0.08, 0.03, 0.04, 3000);
  }

  // ─── Speed Click (energetic — sawtooth, high freq) ───────

  speedCountdownTick() {
    if (!this._canPlay()) return;
    this._playTone('square', 880, 880, 0.06, 0.04);
  }

  speedGo() {
    if (!this._canPlay()) return;
    this._playTone('sawtooth', 440, 880, 0.15, 0.06);
    this._playNoise(0.08, 0.04, 0.05, 4000);
  }

  speedTap() {
    if (!this._canPlay()) return;
    this._playTone('square', 1200, 1000, 0.02, 0.03);
  }

  speedEnd() {
    if (!this._canPlay()) return;
    this._playTone('sawtooth', 880, 220, 0.3, 0.05);
    this._playTone('sine', 330, 330, 0.2, 0.04, 0.15);
  }

  // ─── Cookie Catch (playful — sine, airy) ─────────────────

  catchCookieSpawn() {
    if (!this._canPlay()) return;
    this._playTone('sine', 1200, 1500, 0.05, 0.03);
  }

  catchCookieCaught() {
    if (!this._canPlay()) return;
    this._playTone('sine', 700, 900, 0.06, 0.04);
    this._playTone('sine', 900, 1100, 0.06, 0.04, 0.04);
  }

  catchCookieMissed() {
    if (!this._canPlay()) return;
    this._playTone('sine', 600, 300, 0.1, 0.03);
  }

  // ─── Trivia (quiz show — clean bells) ────────────────────

  triviaQuestionAppear() {
    if (!this._canPlay()) return;
    this._playTone('sine', 660, 660, 0.1, 0.04);
    this._playTone('sine', 880, 880, 0.12, 0.05, 0.08);
  }

  triviaCorrect() {
    if (!this._canPlay()) return;
    this._playTone('sine', 523, 523, 0.1, 0.05);
    this._playTone('sine', 784, 784, 0.12, 0.06, 0.08);
  }

  triviaWrong() {
    if (!this._canPlay()) return;
    this._playTone('sawtooth', 180, 150, 0.2, 0.04);
  }

  triviaTimeUp() {
    if (!this._canPlay()) return;
    this._playTone('sine', 440, 440, 0.1, 0.04);
    this._playTone('sine', 330, 330, 0.1, 0.04, 0.1);
    this._playTone('sine', 220, 220, 0.15, 0.04, 0.2);
  }

  // ─── Emoji Memory (mystical — warm sine, gentle) ─────────

  memoryFlip() {
    if (!this._canPlay()) return;
    this._playTone('sine', 400, 600, 0.08, 0.04);
    this._playNoise(0.03, 0.02, 0.02, 2500);
  }

  memoryMatch() {
    if (!this._canPlay()) return;
    this._playTone('sine', 523, 523, 0.12, 0.05);
    this._playTone('sine', 659, 659, 0.12, 0.05, 0.08);
    this._playTone('sine', 784, 784, 0.15, 0.05, 0.16);
  }

  memoryMismatch() {
    if (!this._canPlay()) return;
    this._playTone('sine', 400, 300, 0.1, 0.03);
    this._playTone('sine', 350, 250, 0.1, 0.03, 0.05);
  }

  memoryCelebration() {
    if (!this._canPlay()) return;
    this._playTone('sine', 523, 523, 0.1, 0.05);
    this._playTone('sine', 659, 659, 0.1, 0.05, 0.08);
    this._playTone('sine', 784, 784, 0.1, 0.05, 0.16);
    this._playTone('sine', 1047, 1047, 0.1, 0.06, 0.24);
    this._playTone('sine', 1319, 1319, 0.15, 0.06, 0.32);
    this._playNoise(0.15, 0.03, 0.3, 5000);
  }

  // ─── Cookie Cutter (crafty — noise textures) ─────────────

  cutterDrawStroke() {
    if (!this._canPlay()) return;
    const now = performance.now();
    if (now - (this._lastCutterStroke || 0) < 100) return;
    this._lastCutterStroke = now;
    this._playNoise(0.04, 0.03, 0, 1500);
  }

  cutterShapeComplete() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 350, 500, 0.1, 0.05);
    this._playTone('sine', 500, 500, 0.08, 0.04, 0.05);
    this._playNoise(0.06, 0.03, 0.08, 2000);
  }

  // ─── Cookie Defense (militaristic — square/sawtooth) ──────

  defenseSelectTower() {
    if (!this._canPlay()) return;
    this._playTone('square', 500, 600, 0.04, 0.04);
  }

  defensePlaceTower() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 250, 180, 0.08, 0.05);
    this._playNoise(0.04, 0.03, 0.02, 1200);
  }

  defenseBattleStart() {
    if (!this._canPlay()) return;
    this._playTone('sawtooth', 220, 330, 0.2, 0.05);
    this._playTone('sawtooth', 165, 248, 0.2, 0.04, 0.02);
    this._playNoise(0.15, 0.03, 0.1, 1500);
  }

  defenseTowerFire() {
    if (!this._canPlay()) return;
    this._playTone('square', 1000, 400, 0.04, 0.03);
  }

  defenseEnemyHit() {
    if (!this._canPlay()) return;
    this._playNoise(0.03, 0.03, 0, 800);
  }

  defenseEnemyDestroyed() {
    if (!this._canPlay()) return;
    this._playTone('sawtooth', 300, 100, 0.08, 0.04);
    this._playNoise(0.06, 0.03, 0.02, 2000);
  }

  defenseLifeLost() {
    if (!this._canPlay()) return;
    this._playTone('square', 330, 220, 0.1, 0.05);
    this._playTone('square', 220, 165, 0.12, 0.05, 0.08);
  }

  defenseBattleResult() {
    if (!this._canPlay()) return;
    this._playTone('sawtooth', 330, 660, 0.15, 0.05);
    this._playTone('triangle', 440, 880, 0.15, 0.04, 0.1);
  }

  // ─── Grandma's Kitchen (warm/homey — low sine, cozy) ─────

  kitchenOvenOn() {
    if (!this._canPlay()) return;
    this._playTone('sine', 180, 250, 0.15, 0.04);
    this._playTone('triangle', 220, 280, 0.1, 0.03, 0.05);
  }

  kitchenCookieReady() {
    if (!this._canPlay()) return;
    this._playTone('sine', 1047, 1047, 0.25, 0.05);
  }

  kitchenPerfect() {
    if (!this._canPlay()) return;
    this._playTone('sine', 784, 784, 0.1, 0.05);
    this._playTone('sine', 1047, 1047, 0.1, 0.05, 0.08);
    this._playTone('sine', 1319, 1319, 0.12, 0.06, 0.16);
  }

  kitchenGood() {
    if (!this._canPlay()) return;
    this._playTone('sine', 784, 784, 0.12, 0.05);
  }

  kitchenRaw() {
    if (!this._canPlay()) return;
    this._playTone('sine', 200, 160, 0.1, 0.04);
    this._playNoise(0.06, 0.02, 0.02, 600);
  }

  kitchenBurnt() {
    if (!this._canPlay()) return;
    this._playNoise(0.15, 0.04, 0, 3000);
    this._playTone('triangle', 250, 150, 0.12, 0.03, 0.05);
  }

  // ─── Math Baker (academic — triangle, precise) ───────────

  mathQuestionAppear() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 700, 750, 0.06, 0.04);
    this._playNoise(0.03, 0.02, 0.02, 4000);
  }

  mathCorrect() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 600, 600, 0.08, 0.05);
    this._playTone('triangle', 900, 900, 0.08, 0.05, 0.06);
    this._playTone('triangle', 1200, 1200, 0.1, 0.06, 0.12);
  }

  mathWrong() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 220, 160, 0.12, 0.04);
  }

  mathFastBonus() {
    if (!this._canPlay()) return;
    this._playTone('sine', 1000, 1500, 0.08, 0.05);
    this._playNoise(0.05, 0.03, 0.03, 5000);
  }

  mathTimeUp() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 500, 500, 0.08, 0.04);
    this._playTone('triangle', 400, 400, 0.08, 0.04, 0.08);
    this._playTone('triangle', 300, 300, 0.1, 0.04, 0.16);
  }

  // ─── Settings / Menu Buttons ─────────────────────────────

  replayTutorial() {
    if (!this._canPlay()) return;
    this._playTone('sine', 600, 400, 0.08, 0.04);
    this._playTone('sine', 400, 600, 0.08, 0.04, 0.08);
  }

  exportSave() {
    if (!this._canPlay()) return;
    this._playTone('sine', 400, 700, 0.1, 0.04);
    this._playNoise(0.06, 0.02, 0.04, 3000);
  }

  importSave() {
    if (!this._canPlay()) return;
    this._playTone('sine', 700, 400, 0.1, 0.04);
    this._playNoise(0.06, 0.02, 0.04, 3000);
  }

  wipeSave() {
    if (!this._canPlay()) return;
    this._playTone('sawtooth', 100, 60, 0.25, 0.04);
    this._playNoise(0.2, 0.03, 0.05, 400);
  }

  // ─── Debug / Prestige / Other ────────────────────────────

  debugPanelOpen() {
    if (!this._canPlay()) return;
    this._playTone('square', 200, 800, 0.06, 0.04);
    this._playTone('square', 800, 200, 0.06, 0.04, 0.06);
    this._playNoise(0.08, 0.03, 0.04, 3000);
  }

  debugAction() {
    if (!this._canPlay()) return;
    this._playTone('square', 600, 700, 0.04, 0.04);
    this._playTone('square', 700, 800, 0.04, 0.04, 0.04);
  }

  prestigeConfirm() {
    if (!this._canPlay()) return;
    this._playTone('sine', 220, 220, 0.3, 0.05);
    this._playTone('sine', 277, 277, 0.3, 0.05, 0.02);
    this._playTone('sine', 330, 330, 0.35, 0.05, 0.04);
  }

  mobileTabSwitch() {
    if (!this._canPlay()) return;
    this._playTone('sine', 500, 550, 0.04, 0.03);
  }

  upgradePageNav() {
    if (!this._canPlay()) return;
    this._playTone('sine', 550, 620, 0.06, 0.03);
    this._playNoise(0.03, 0.02, 0.02, 2500);
  }
}
