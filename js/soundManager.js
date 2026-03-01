/**
 * SoundManager — procedural audio via Web Audio API (no audio files).
 * Every public method checks `this.game.settings.sound` before playing.
 * AudioContext is lazily initialised on first user gesture (autoplay policy).
 *
 * Cookie click plays sequential notes from a long classical melody medley.
 * The position persists across saves via game.stats.melodyIndex.
 */
export class SoundManager {
  constructor(game) {
    this.game = game;
    this._ctx = null;
    this._melody = buildMelody();
  }

  /** Lazily create / resume AudioContext (must follow a user gesture). */
  _ensureContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  }

  _canPlay() {
    return !!this.game.settings.sound;
  }

  // ─── helpers ──────────────────────────────────────────────

  _playTone(type, startHz, endHz, duration, volume = 0.08, delay = 0) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startHz, now);
    if (startHz !== endHz) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endHz, 1), now + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  _playNoise(duration, volume = 0.04, delay = 0, filterFreq = 2000) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime + delay;
    const sampleRate = ctx.sampleRate;
    const len = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }

  _playSequence(type, freqs, noteDuration, volume = 0.06) {
    freqs.forEach((hz, i) => {
      this._playTone(type, hz, hz, noteDuration * 0.85, volume, i * noteDuration);
    });
  }

  // ─── public sound events ──────────────────────────────────

  /**
   * Cookie click — plays the next note in the melody.
   * Soft sine, gentle and warm. The melody loops when exhausted.
   */
  click() {
    if (!this._canPlay()) return;
    const idx = this.game.stats.melodyIndex || 0;
    const midi = this._melody[idx % this._melody.length];
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    this._playTone('sine', freq, freq, 0.12, 0.05);
    this.game.stats.melodyIndex = (idx + 1) % this._melody.length;
  }

  /** Building purchase — soft single "doop" */
  purchase() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 350, 280, 0.1, 0.06);
  }

  /** Upgrade bought — gentle two-note rising chime */
  upgrade() {
    if (!this._canPlay()) return;
    this._playTone('sine', 440, 440, 0.12, 0.06);
    this._playTone('sine', 660, 660, 0.15, 0.07, 0.1);
  }

  /** Achievement unlocked — warm major chord bloom */
  achievement() {
    if (!this._canPlay()) return;
    this._playTone('sine', 330, 330, 0.4, 0.05);
    this._playTone('sine', 415, 415, 0.35, 0.05, 0.08);
    this._playTone('sine', 494, 494, 0.3, 0.06, 0.16);
    this._playTone('triangle', 660, 660, 0.3, 0.04, 0.24);
  }

  /** Golden cookie clicked — sparkly shimmer */
  goldenCookie() {
    if (!this._canPlay()) return;
    this._playTone('sine', 880, 1100, 0.25, 0.05);
    this._playTone('sine', 890, 1110, 0.25, 0.04);
    this._playNoise(0.15, 0.03, 0, 3000);
  }

  /** Frenzy started — low rumble swell */
  frenzy() {
    if (!this._canPlay()) return;
    this._playTone('triangle', 120, 300, 0.35, 0.07);
    this._playTone('sine', 200, 500, 0.25, 0.04, 0.15);
  }

  /** Mini-game win — playful ascending three-note motif */
  miniGameWin() {
    if (!this._canPlay()) return;
    this._playSequence('triangle', [392, 494, 588], 0.1, 0.06);
  }

  /** Prestige — slow deep bloom into bright resolve */
  prestige() {
    if (!this._canPlay()) return;
    this._playTone('sine', 165, 220, 0.5, 0.06);
    this._playTone('sine', 330, 440, 0.5, 0.07, 0.4);
    this._playTone('triangle', 440, 550, 0.4, 0.05, 0.7);
    this._playNoise(0.5, 0.03, 0.6, 1500);
  }
}

// ─── melody data ────────────────────────────────────────────
// MIDI note numbers. Each click advances one note.
// A medley of classical themes, ~600 notes total.

function buildMelody() {
  // ── 1. Beethoven — Ode to Joy (Symphony No. 9, 4th movement) ──
  const odeToJoy = [
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62,
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60,
    62, 62, 64, 60, 62, 64, 65, 64, 60, 62, 64, 65, 64, 62, 60, 62, 55,
    64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60,
  ];

  // ── 2. Bach — Cello Suite No. 1, Prelude (opening) ──
  const bachCello = [
    60, 64, 67, 72, 76, 67, 72, 76,
    60, 62, 67, 72, 76, 67, 72, 76,
    60, 64, 69, 72, 76, 69, 72, 76,
    60, 64, 67, 72, 76, 67, 72, 76,
    60, 62, 65, 69, 74, 65, 69, 74,
    59, 62, 67, 72, 74, 67, 72, 74,
    59, 62, 67, 72, 76, 67, 72, 76,
    60, 64, 67, 72, 76, 67, 72, 76,
  ];

  // ── 3. Mozart — Eine Kleine Nachtmusik (opening) ──
  const eineKleine = [
    67, 62, 62, 67, 62, 62, 67, 62, 67, 71, 74,
    72, 69, 69, 74, 69, 69, 74, 69, 72, 74, 67,
    62, 67, 71, 74, 79, 74, 71, 67,
    62, 67, 71, 74, 79, 74, 71, 67,
    69, 74, 72, 67, 69, 74, 72, 67,
    69, 67, 66, 67,
  ];

  // ── 4. Pachelbel — Canon in D (treble melody) ──
  const canon = [
    78, 76, 74, 73, 71, 69, 71, 73,
    66, 68, 69, 66, 69, 71,
    73, 74, 73, 71, 69, 68, 66, 68,
    69, 66, 69, 71, 73, 74, 76, 78,
    74, 73, 74, 78, 76, 74, 73, 71,
    69, 71, 73, 74, 73, 71, 69, 68,
  ];

  // ── 5. Debussy — Clair de Lune (opening motif) ──
  const clairDeLune = [
    68, 70, 73, 75, 73, 70, 68, 66,
    68, 70, 73, 75, 77, 75, 73, 70,
    68, 66, 63, 61, 63, 66, 68, 70,
    73, 75, 73, 70, 68, 66, 63, 61,
  ];

  // ── 6. Grieg — Morning Mood (Peer Gynt) ──
  const morningMood = [
    64, 66, 68, 69, 71, 69, 68, 66,
    64, 66, 68, 69, 71, 76, 74, 71,
    69, 68, 66, 64, 66, 68, 69, 71,
    69, 68, 66, 64, 62, 64, 66, 68,
    64, 66, 68, 69, 71, 69, 68, 66,
  ];

  // ── 7. Dvořák — New World Symphony (Largo, "Going Home") ──
  const newWorld = [
    64, 66, 69, 69, 71, 69, 66, 64,
    62, 64, 66, 64, 62, 59,
    64, 66, 69, 69, 71, 69, 66, 64,
    62, 64, 66, 69, 66, 64,
    62, 59, 62, 64, 66, 64, 62, 59,
    57, 59, 62, 64, 62, 59, 57,
  ];

  // ── 8. Tchaikovsky — Swan Lake (theme) ──
  const swanLake = [
    64, 71, 69, 68, 69, 71, 76, 74,
    73, 71, 69, 68, 69, 71, 64,
    64, 71, 69, 68, 69, 71, 76, 74,
    73, 71, 73, 74, 76,
    76, 74, 73, 71, 69, 68, 69, 71,
    73, 74, 73, 71, 69, 68, 66, 64,
  ];

  // ── 9. Beethoven — Moonlight Sonata (1st movement, treble) ──
  const moonlight = [
    68, 61, 64, 68, 61, 64, 68, 61, 64, 68, 61, 64,
    68, 61, 64, 68, 61, 64, 68, 61, 64, 68, 61, 64,
    69, 61, 64, 69, 61, 64, 69, 61, 64, 69, 61, 64,
    68, 59, 64, 68, 59, 64, 68, 59, 64, 68, 59, 64,
  ];

  // ── 10. Vivaldi — Spring (Four Seasons, opening) ──
  const spring = [
    64, 64, 64, 62, 64, 67, 67, 67,
    65, 67, 72, 71, 69, 71, 67,
    64, 64, 64, 62, 64, 67, 67, 67,
    65, 67, 72, 71, 69, 71, 67,
    69, 71, 72, 69, 71, 72, 74,
    72, 71, 69, 67, 69, 71, 67,
  ];

  // ── 11. Chopin — Nocturne Op. 9 No. 2 (melody) ──
  const nocturne = [
    75, 72, 68, 67, 68, 72, 75, 72,
    80, 79, 77, 75, 72, 68, 67, 68,
    72, 75, 77, 79, 80, 79, 77, 75,
    72, 68, 67, 63, 65, 67, 68, 72,
  ];

  // ── 12. Satie — Gymnopédie No. 1 (melody) ──
  const gymnopedie = [
    71, 69, 66, 62, 64, 66, 69, 71,
    74, 71, 69, 66, 62, 64, 66, 69,
    71, 74, 76, 74, 71, 69, 66, 62,
    64, 66, 62, 59, 57, 59, 62, 66,
  ];

  return [
    ...odeToJoy,
    ...bachCello,
    ...eineKleine,
    ...canon,
    ...clairDeLune,
    ...morningMood,
    ...newWorld,
    ...swanLake,
    ...moonlight,
    ...spring,
    ...nocturne,
    ...gymnopedie,
  ];
}
