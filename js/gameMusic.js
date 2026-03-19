/**
 * GameMusic — generative background melodies for the cookie clicker.
 *
 * Each "composition" is a self-contained phrase generator that schedules
 * a series of piano-like notes.  The engine picks one at random every
 * few seconds, producing an endless, ever-varying Minecraft-style
 * soundtrack.
 *
 * All audio routes through the supplied output GainNode so the main
 * SoundManager can duck it during cookie clicks.
 */

export class GameMusic {
  /** @param {AudioContext} ctx  @param {GainNode} outputNode */
  constructor(ctx, outputNode) {
    this._ctx = ctx;
    this._outDest = outputNode;  // the destination node we connect through

    // ── Master chain tuned for MacBook M4 speakers ──
    // M4 speakers resonate ~2-4kHz and distort easily on transients.
    // Chain: compressor → notch → hi-shelf → lo-shelf → low-pass → limiter → gain

    // Stage 1: Compressor — tames summed oscillator peaks
    this._compressor = ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -20;   // catch more peaks
    this._compressor.knee.value = 10;
    this._compressor.ratio.value = 8;         // firmer ratio
    this._compressor.attack.value = 0.002;
    this._compressor.release.value = 0.12;

    // Stage 2: Parametric notch at 3.2kHz — the M4 speaker resonance peak.
    // Narrow cut right where the speakers ring and distort most.
    this._notch = ctx.createBiquadFilter();
    this._notch.type = 'peaking';
    this._notch.frequency.value = 3200;
    this._notch.Q.value = 2.0;               // narrow: targets just the resonance
    this._notch.gain.value = -5.0;            // -5 dB surgical cut

    // Stage 3: High-shelf — broader treble taming above 2kHz
    this._hiShelf = ctx.createBiquadFilter();
    this._hiShelf.type = 'highshelf';
    this._hiShelf.frequency.value = 2000;
    this._hiShelf.gain.value = -5.5;

    // Stage 4: Low-shelf cut — M4 speakers can't reproduce sub-bass cleanly,
    // the energy just causes excursion distortion. Trim below 120Hz.
    this._loShelf = ctx.createBiquadFilter();
    this._loShelf.type = 'highpass';
    this._loShelf.frequency.value = 80;       // roll off rumble
    this._loShelf.Q.value = 0.7;              // gentle Butterworth slope

    // Stage 5: Low-pass safety net — nothing useful above 8kHz on laptop speakers
    this._lpSafety = ctx.createBiquadFilter();
    this._lpSafety.type = 'lowpass';
    this._lpSafety.frequency.value = 8000;
    this._lpSafety.Q.value = 0.5;             // gentle slope, no resonant peak

    // Stage 6: Brick-wall limiter — absolute ceiling, nothing peaks through
    this._limiter = ctx.createDynamicsCompressor();
    this._limiter.threshold.value = -4;
    this._limiter.knee.value = 0;             // hard knee = true limiter
    this._limiter.ratio.value = 20;
    this._limiter.attack.value = 0.0005;      // 0.5ms — catches even the fastest transient
    this._limiter.release.value = 0.06;

    this._makeupGain = ctx.createGain();
    this._makeupGain.gain.value = 3.2;        // compensate for EQ cuts

    this._compressor
      .connect(this._notch)
      .connect(this._hiShelf)
      .connect(this._loShelf)
      .connect(this._lpSafety)
      .connect(this._limiter)
      .connect(this._makeupGain)
      .connect(outputNode);

    // Create a GainNode that all compositions route through.
    // On apocalypse transitions, we swap this node to orphan old oscillators.
    this._out = ctx.createGain();
    this._out.gain.value = 1.0;
    this._out.connect(this._compressor);
    this._active = false;
    this._timer = null;
    this._currentName = '';
    this._apocalypseMode = 0; // 0 = normal, 1-3 = grandmapocalypse stage
    this._lastDuration = 40;  // estimated seconds of last composition
    this._maxNoteEnd = 0;     // tracks the latest scheduled note end time
  }

  // ─── note pools ─────────────────────────────────────────────
  // Normal: C major pentatonic across octaves 3–6.
  static POOL = [
    130.8, 146.8, 164.8, 196.0, 220.0,           // octave 3
    261.6, 293.7, 329.6, 392.0, 440.0,           // octave 4
    523.3, 587.3, 659.3, 784.0, 880.0,           // octave 5
    1046.5, 1174.7, 1318.5,                       // octave 6 (sparkle)
  ];

  // Apocalypse: E natural minor / phrygian — dark, tense, metal-friendly
  static DARK_POOL = [
    82.4, 87.3, 98.0, 110.0, 123.5, 130.8,       // octave 2-3 (low growl range)
    146.8, 164.8, 174.6, 196.0, 220.0, 246.9,    // octave 3
    261.6, 293.7, 329.6, 349.2, 392.0, 440.0,    // octave 4
    493.9, 523.3, 587.3, 659.3,                   // octave 5
  ];

  // ─── lifecycle ──────────────────────────────────────────────

  /**
   * Fade out all currently playing notes (300ms), then swap the output node
   * so old oscillators are orphaned. Returns a promise-like setTimeout callback.
   * @param {Function} [onReady] — called when the fresh node is ready for new notes.
   */
  _fadeAndSwap(onReady) {
    const ctx = this._ctx;
    if (!ctx || !this._out) { if (onReady) onReady(); return; }

    const oldOut = this._out;
    const t = ctx.currentTime;

    // Fade out old node
    oldOut.gain.setValueAtTime(oldOut.gain.value, t);
    oldOut.gain.linearRampToValueAtTime(0.001, t + 0.30);

    // Disconnect old node right after fade completes — orphans all old oscillators
    setTimeout(() => { try { oldOut.disconnect(); } catch (_) {} }, 320);

    // Create fresh output node — routes through compressor chain
    setTimeout(() => {
      const fresh = ctx.createGain();
      fresh.gain.setValueAtTime(1.0, ctx.currentTime);
      fresh.connect(this._compressor);
      this._out = fresh;
      if (onReady) onReady();
    }, 350);
  }

  /** Set apocalypse mode: 0 = normal, 1-3 = stage.
   *  Fast crossfade into a new composition from the new pool. */
  setApocalypseMode(stage) {
    const prev = this._apocalypseMode;
    this._apocalypseMode = stage;
    if (prev === stage || !this._active) return;

    if (this._timer) { clearTimeout(this._timer); this._timer = null; }

    // Generation counter prevents stale callbacks if called rapidly
    this._swapGen = (this._swapGen || 0) + 1;
    const gen = this._swapGen;
    this._fadeAndSwap(() => {
      if (!this._active || this._swapGen !== gen) return;
      this._safePlay();
      this._schedule();
    });
  }

  /** Play a specific composition by name, fading out any current notes first. */
  playTrack(name) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._swapGen = (this._swapGen || 0) + 1;
    const gen = this._swapGen;
    const displayNames = this.constructor._DISPLAY_NAMES || {};
    this._fadeAndSwap(() => {
      if (this._swapGen !== gen) return; // stale callback
      if (typeof this[name] === 'function') {
        this._currentName = displayNames[name] || name;
        try {
          this._lastDuration = this._runComposition(name) || 30;
        } catch (e) {
          console.error(`[GameMusic] Composition "${name}" failed:`, e);
          this._lastDuration = 5;
          this._currentName = '';
        }
        this._playStartTime = performance.now();
      }
    });
  }

  /** Play a composition instantly — no fade, immediate swap.
   *  Used by the music player UI for responsive track switching.
   *  Auto-resumes normal scheduling after the track finishes. */
  playTrackInstant(name) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    const ctx = this._ctx;
    if (!ctx) return;

    // Disconnect old output immediately — kills all in-flight notes
    try { this._out.disconnect(); } catch (_) {}

    // Fresh output node — routes through compressor chain
    const fresh = ctx.createGain();
    fresh.gain.value = 1.0;
    fresh.connect(this._compressor);
    this._out = fresh;

    // Play
    const displayNames = this.constructor._DISPLAY_NAMES || {};
    if (typeof this[name] === 'function') {
      this._currentName = displayNames[name] || name;
      try {
        this._lastDuration = this._runComposition(name) || 30;
      } catch (e) {
        console.error(`[GameMusic] Composition "${name}" failed:`, e);
        this._lastDuration = 5;
        this._currentName = '';
      }
      this._playStartTime = performance.now();
    } else {
      // Invalid track name — clear state, don't break scheduling
      console.error(`[GameMusic] Unknown composition "${name}"`);
      this._currentName = '';
      this._playStartTime = null;
      this._lastDuration = 3;
    }

    // Auto-resume normal scheduling after this track ends (only if engine is active)
    if (this._active) {
      this._timer = setTimeout(() => {
        if (!this._active) return;
        this._safePlay();
        this._schedule();
      }, (this._lastDuration || 5) * 1000 + 3000);
    }
  }

  /** Run a composition and compute its real duration (including note tails). */
  _runComposition(name) {
    this._maxNoteEnd = 0;
    const t = this[name]();
    // Real duration = max of (returned t, latest note end time).
    // If no _note/_darkNote was called (raw Web Audio compositions), add a tail estimate.
    const fromT = (typeof t === 'number' && t > 0) ? t : 0;
    const tail = this._maxNoteEnd > 0 ? this._maxNoteEnd : fromT + 4;
    return Math.max(fromT, tail);
  }

  /** Returns progress 0-1 of the current composition, or -1 if not playing. */
  getProgress() {
    if (!this._playStartTime || !this._lastDuration) return -1;
    const elapsed = (performance.now() - this._playStartTime) / 1000;
    if (elapsed > this._lastDuration) return 1;
    return elapsed / this._lastDuration;
  }

  /** Returns elapsed seconds since current track started. */
  getElapsed() {
    if (!this._playStartTime) return 0;
    return (performance.now() - this._playStartTime) / 1000;
  }

  start() {
    if (this._active) return;
    this._active = true;
    // Play a first composition after a short warm-up, then switch to normal scheduling.
    // This makes each refresh feel distinct immediately rather than waiting 5–17 s.
    this._timer = setTimeout(() => {
      if (!this._active) return;
      this._safePlay();
      this._schedule();
    }, 1000 + Math.random() * 2000);
  }

  stop() {
    this._active = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  /** Wrap _play in try-catch so a broken composition never kills the scheduling chain. */
  _safePlay() {
    try {
      this._play();
    } catch (e) {
      console.error('[GameMusic] Composition failed, skipping:', e);
      this._currentName = '';
      this._lastDuration = 5; // retry quickly
    }
  }

  _schedule() {
    if (!this._active) return;
    const stage = this._apocalypseMode || 0;
    const minGap = stage >= 3 ? 2000 : stage >= 2 ? 3000 : stage >= 1 ? 3000 : 4000;
    const maxExtra = stage >= 3 ? 3000 : stage >= 2 ? 4000 : stage >= 1 ? 5000 : 6000;
    const compositionDuration = (this._lastDuration || 30) * 1000;
    const delay = compositionDuration + minGap + Math.random() * maxExtra;
    this._timer = setTimeout(() => {
      if (!this._active) return;
      this._safePlay();
      this._schedule(); // Always reschedule even if _safePlay caught an error
    }, delay);
  }

  // ─── composition picker ─────────────────────────────────────
  // Weighted random — every composition has an equal-ish chance.

  // Volume I — Classic pentatonic passacaglia compositions
  static _VOL1 = [
    'gentleArc',       'callAndResponse',  'fallingLeaves',
    'spreadArpeggio',  'lullaby',          'freeWander',
    'ripple',          'musicBox',         'cascade',
    'echoReflection',  'starlight',        'hymn',
    'distantRain',     'meadowWalk',       'frozenLake',
  ];

  // Volume II — Dark / Grandmapocalypse compositions
  static _VOL2 = [
    'darkDrone',       'tensePulse',       'hauntedArpeggio',
    'doomRiff',        'witchBells',       'voidEcho',
    'grindMotor',      'eldrChant',
    'bloodMoon',       'chaosCluster',     'grandmaWhisper',
    'abyssalRumble',   'sirenicCall',      'cryptOrgan',
  ];

  // Volume III — Distinct keys & chord progressions
  static _VOL3 = [
    'morningFields',   'quietRooms',       'paperBoats',
    'goldenHour',      'cloudAtlas',       'porcelain',
    'sundial',         'tidal',            'origami',
    'hearthlight',     'compassRose',      'ceramic',
    'windowpane',      'featherfall',      'stillWater',
  ];

  // Combined lists for playback (backward compat)
  static _COMPOSITIONS = [...GameMusic._VOL1, ...GameMusic._VOL3];
  static _DARK_COMPOSITIONS = GameMusic._VOL2;

  // Pretty display names for each composition.
  static _DISPLAY_NAMES = {
    morningFields:   'Morning Fields',
    quietRooms:      'Quiet Rooms',
    paperBoats:      'Paper Boats',
    goldenHour:      'Golden Hour',
    cloudAtlas:      'Cloud Atlas',
    porcelain:       'Porcelain',
    sundial:         'Sundial',
    tidal:           'Tidal',
    origami:         'Origami',
    hearthlight:     'Hearthlight',
    compassRose:     'Compass Rose',
    ceramic:         'Ceramic',
    windowpane:      'Windowpane',
    featherfall:     'Featherfall',
    stillWater:      'Still Water',
    gentleArc:       'Gentle Arc',
    callAndResponse: 'Call & Response',
    fallingLeaves:   'Falling Leaves',
    spreadArpeggio:  'Spread Arpeggio',
    lullaby:         'Lullaby',
    freeWander:      'Free Wander',
    ripple:          'Ripple',
    musicBox:        'Music Box',
    cascade:         'Cascade',
    echoReflection:  'Echo Reflection',
    starlight:       'Starlight',
    hymn:            'Hymn',
    distantRain:     'Distant Rain',
    meadowWalk:      'Meadow Walk',
    frozenLake:      'Frozen Lake',
    // Dark compositions
    darkDrone:       'Dark Drone',
    tensePulse:      'Tense Pulse',
    hauntedArpeggio: 'Haunted Arpeggio',
    doomRiff:        'Doom Riff',
    witchBells:      'Witch Bells',
    voidEcho:        'Void Echo',
    grindMotor:      'Grind Motor',
    eldrChant:       'Elder Chant',
    bloodMoon:       'Blood Moon',
    chaosCluster:    'Chaos Cluster',
    grandmaWhisper:  "Grandma's Whisper",
    abyssalRumble:   'Abyssal Rumble',
    sirenicCall:     'Sirenic Call',
    cryptOrgan:      'Crypt Organ',
  };

  getCurrentName() { return this._currentName; }

  _play() {
    const stage = this._apocalypseMode || 0;
    let list;
    if (stage >= 2) {
      list = GameMusic._DARK_COMPOSITIONS;
    } else if (stage === 1) {
      list = Math.random() < 0.5 ? GameMusic._DARK_COMPOSITIONS : GameMusic._COMPOSITIONS;
    } else {
      list = GameMusic._COMPOSITIONS;
    }
    const name = list[Math.floor(Math.random() * list.length)];
    this._currentName = GameMusic._DISPLAY_NAMES[name] || name;
    this._lastDuration = this._runComposition(name) || (GameMusic._DURATIONS[name] || 30);
    this._playStartTime = performance.now();
  }

  // Fallback duration estimates (seconds). Actual durations come from return t;
  // at runtime — these are only used if a composition doesn't return a value.
  static _DURATIONS = {
    morningFields: 100, quietRooms: 90, paperBoats: 95, goldenHour: 85,
    cloudAtlas: 110, porcelain: 80, sundial: 90, tidal: 105,
    origami: 90, hearthlight: 100, compassRose: 95, ceramic: 80,
    windowpane: 90, featherfall: 85, stillWater: 110,
    gentleArc: 55, callAndResponse: 60, lullaby: 65, musicBox: 45,
    starlight: 80, hymn: 55, distantRain: 70, frozenLake: 80,
    fallingLeaves: 50, spreadArpeggio: 45, freeWander: 55,
    ripple: 45, cascade: 40, echoReflection: 50, meadowWalk: 45,
    darkDrone: 30, tensePulse: 20, hauntedArpeggio: 25, doomRiff: 25,
    witchBells: 20, voidEcho: 40, grindMotor: 20, eldrChant: 40,
    bloodMoon: 25, chaosCluster: 15, grandmaWhisper: 35, abyssalRumble: 20,
    sirenicCall: 15, cryptOrgan: 25,
  };

  // ─── helper: clamp index into pool ──────────────────────────

  _ci(i) { return Math.max(0, Math.min(i, GameMusic.POOL.length - 1)); }

  /** Scale-index clamp for key-specific compositions. */
  _si(S, i) { return S[Math.max(0, Math.min(i, S.length - 1))]; }

  // ═══════════════════════════════════════════════════════════
  //  COMPOSITIONS — each in its own key with real chord progressions
  // ═══════════════════════════════════════════════════════════

  // ── 1. Morning Fields — D major, arpeggiated chords, Sweden-inspired ──

  // ── 1. Morning Fields — D major, arpeggiated broken chords (Sweden-inspired) ──

  morningFields() {
    // D major scale across octaves 2-6
    const S = [
      73.42, 82.41, 92.50, 98.00, 110.00, 123.47, 138.59,
      146.83, 164.81, 185.00, 196.00, 220.00, 246.94, 277.18,
      293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 554.37,
      587.33, 659.26, 739.99, 783.99, 880.00, 987.77, 1108.73,
      1174.66
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.009 + Math.random() * 0.003;
    let t = 0;

    // Progression: D - A/C# - Bm - G  |  D - F#m - G - A
    const prog1 = [
      { b: 7, ch: [14, 18, 21] },       // D: D3, D4-A4-D5
      { b: 13, ch: [16, 18, 22] },       // A/C#: C#4, F#4-A4-E5
      { b: 12, ch: [14, 16, 21] },       // Bm: B3, D4-F#4-D5
      { b: 10, ch: [14, 17, 19] },       // G: G3, D4-G4-B4
    ];
    const prog2 = [
      { b: 7, ch: [14, 18, 21] },       // D
      { b: 9, ch: [16, 18, 20] },        // F#m: F#3, F#4-A4-C#5
      { b: 10, ch: [14, 17, 19] },       // G
      { b: 11, ch: [16, 18, 22] },       // A: A3, F#4-A4-E5
    ];

    // Section A: Solo broken chords — gentle, sparse
    for (let bar = 0; bar < 4; bar++) {
      const c = prog1[bar];
      const v = vol * (0.45 + bar * 0.06);
      this._note(n(c.b), v * 0.5, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * (0.55 + Math.random() * 0.3),
          t + 0.9 + i * (0.7 + Math.random() * 0.2));
      }
      t += 5.8 + Math.random() * 1.2;
    }

    // Section B: Add singing melody over same progression
    const mel = [21, 22, 24, 22, 21, 19, 18, 21];
    for (let bar = 0; bar < 4; bar++) {
      const c = prog1[bar];
      const v = vol * 0.72;
      this._note(n(c.b), v * 0.42, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.22, t + 0.35 + i * 0.09);
      }
      for (let m = 0; m < 2; m++) {
        this._note(n(mel[bar * 2 + m]), v * (0.68 + Math.random() * 0.25),
          t + 1.6 + m * (1.9 + Math.random() * 0.5));
      }
      t += 6.2 + Math.random() * 1.0;
    }

    // Section C: New progression, climax — richer chords, stronger melody
    const mel2 = [24, 25, 24, 22, 21, 22, 24, 21];
    for (let bar = 0; bar < 4; bar++) {
      const c = prog2[bar];
      const v = vol * (bar === 2 || bar === 3 ? 1.0 : 0.82);
      this._note(n(c.b), v * 0.48, t);
      this._note(n(c.b - 7), v * 0.22, t + 0.04); // octave-lower doubling
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.3, t + 0.45 + i * (0.6 + Math.random() * 0.15));
      }
      for (let m = 0; m < 2; m++) {
        this._note(n(mel2[bar * 2 + m]), v * (0.72 + Math.random() * 0.22),
          t + 1.9 + m * (1.7 + Math.random() * 0.4));
      }
      t += 6.5 + Math.random() * 1.0;
    }

    // Coda — D chord dissolving
    const cv = vol * 0.32;
    this._note(n(7), cv * 0.45, t);
    this._note(n(14), cv * 0.55, t + 1.2);
    this._note(n(18), cv * 0.35, t + 2.6);
    this._note(n(21), cv * 0.2, t + 4.0);
    t += 9.0;
    return t;
  }

  // ── 2. Quiet Rooms — A major, sparse & intimate (Wet Hands-inspired) ──

  quietRooms() {
    // A major scale
    const S = [
      110.00, 123.47, 138.59, 146.83, 164.81, 185.00, 207.65,
      220.00, 246.94, 277.18, 293.66, 329.63, 369.99, 415.30,
      440.00, 493.88, 554.37, 587.33, 659.26, 739.99, 830.61,
      880.00, 987.77, 1108.73, 1174.66
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.008 + Math.random() * 0.003;
    let t = 0;

    // Progression: A - E/G# - F#m - D  (I - V6 - vi - IV)
    // Very sparse — mostly single notes with long silences

    // Phrase 1: Single melody notes, no harmony — a question in the dark
    const phrase1 = [14, 16, 18, 16, 14, 12, 11, 14]; // A4 C#5 E5 C#5 A4 F#4 E4 A4
    const timing1 = [3.2, 2.0, 2.8, 1.5, 2.5, 3.0, 2.2, 4.0];
    for (let i = 0; i < phrase1.length; i++) {
      this._note(n(phrase1[i]), vol * (0.4 + Math.random() * 0.2), t);
      t += timing1[i] * (0.9 + Math.random() * 0.2);
    }
    t += 3.0 + Math.random() * 2.0;

    // Phrase 2: Same melody, now with a bass note at start of each pair
    const bass2 = [7, 6, 5, 3]; // A3, G#3, F#3, D3
    for (let i = 0; i < 4; i++) {
      this._note(n(bass2[i]), vol * 0.35, t);
      this._note(n(phrase1[i * 2]), vol * (0.5 + Math.random() * 0.2), t + 0.8);
      this._note(n(phrase1[i * 2 + 1]), vol * (0.45 + Math.random() * 0.2),
        t + 0.8 + timing1[i * 2] * 0.5);
      t += 5.5 + Math.random() * 1.5;
    }
    t += 2.5 + Math.random() * 1.5;

    // Phrase 3: Add gentle thirds — warmth enters
    const mel3 = [18, 19, 18, 16, 14, 16, 18, 14]; // E5 F#5 E5 C#5 A4 C#5 E5 A4
    const harm3 = [16, 17, 16, 14, 12, 14, 16, 12]; // thirds below
    for (let i = 0; i < 8; i++) {
      if (i === 0 || i === 4) {
        this._note(n(7), vol * 0.38, t); // A3 bass at phrase starts
      }
      this._note(n(mel3[i]), vol * (0.55 + Math.random() * 0.2), t);
      if (i % 2 === 0) {
        this._note(n(harm3[i]), vol * 0.2, t + 0.05);
      }
      t += (2.2 + Math.random() * 0.8) * (i >= 6 ? 1.3 : 1.0);
    }
    t += 3.0 + Math.random() * 2.0;

    // Phrase 4: Returning to sparseness — just a few notes, fading
    this._note(n(14), vol * 0.35, t);      // A4
    t += 3.5 + Math.random() * 1.5;
    this._note(n(16), vol * 0.25, t);      // C#5
    t += 3.0 + Math.random() * 1.5;
    this._note(n(7), vol * 0.2, t);        // A3
    this._note(n(14), vol * 0.15, t + 0.8); // A4
    t += 6.0;
    return t;
  }

  // ── 3. Paper Boats — C major, playful bouncing melody (Mice on Venus-inspired) ──

  paperBoats() {
    // C major scale
    const S = [
      130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94,
      261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88,
      523.25, 587.33, 659.26, 698.46, 783.99, 880.00, 987.77,
      1046.50, 1174.66, 1318.51
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.009 + Math.random() * 0.003;
    let t = 0;

    // Progression: C - Am - F - G | C - Em - Dm - G7
    // Bouncy, playful melody with wider intervals

    // Intro: Dancing high notes alone
    const dance = [14, 16, 18, 16, 14, 12, 14, 11];
    const danceT = [0.6, 0.5, 0.8, 0.45, 0.6, 0.7, 0.55, 1.2];
    for (let i = 0; i < dance.length; i++) {
      this._note(n(dance[i]), vol * (0.35 + Math.random() * 0.15), t);
      t += danceT[i] * (0.9 + Math.random() * 0.2);
    }
    t += 2.0 + Math.random() * 1.0;

    // Section A: Melody with simple bass — C-Am-F-G
    const bassA = [
      { b: 0, notes: [14, 16, 18, 16] },     // C: C3 bass, C5-E5-G5-E5
      { b: 5, notes: [14, 16, 19, 16] },     // Am: A3 bass, C5-E5-A5-E5
      { b: 3, notes: [14, 17, 19, 17] },     // F: F3 bass, C5-F5-A5-F5
      { b: 4, notes: [14, 16, 18, 16] },     // G: G3 bass, C5-E5-G5-E5
    ];
    for (let rep = 0; rep < 2; rep++) {
      const rv = vol * (rep === 0 ? 0.6 : 0.8);
      for (let bar = 0; bar < 4; bar++) {
        const c = bassA[bar];
        this._note(n(c.b), rv * 0.4, t);
        // Quick bouncing melody
        for (let m = 0; m < c.notes.length; m++) {
          this._note(n(c.notes[m]), rv * (0.5 + Math.random() * 0.3),
            t + 0.6 + m * (0.55 + Math.random() * 0.15));
        }
        // Second rep: add harmony
        if (rep === 1 && (bar === 0 || bar === 2)) {
          this._note(n(c.notes[0] + 2), rv * 0.18, t + 0.65);
        }
        t += 3.8 + Math.random() * 0.8;
      }
      t += 1.5 + Math.random() * 1.0;
    }

    // Section B: New progression C-Em-Dm-G with higher melody
    const melB = [
      [18, 19, 21, 19, 18],    // G5-A5-C6-A5-G5
      [16, 18, 19, 18, 16],    // E5-G5-A5-G5-E5
      [15, 17, 18, 17, 15],    // D5-F5-G5-F5-D5
      [16, 18, 19, 18, 16],    // E5-G5-A5-G5-E5
    ];
    const bassB = [7, 9, 8, 11]; // C4, E4, D4, B4
    for (let bar = 0; bar < 4; bar++) {
      const v = vol * (bar === 2 ? 1.0 : 0.85);
      this._note(n(bassB[bar]), v * 0.35, t);
      if (bar === 2) this._note(n(bassB[bar] - 7), v * 0.22, t + 0.04);
      for (let m = 0; m < melB[bar].length; m++) {
        this._note(n(melB[bar][m]), v * (0.55 + Math.random() * 0.28),
          t + 0.5 + m * (0.5 + Math.random() * 0.12));
      }
      t += 4.2 + Math.random() * 0.8;
    }

    // Coda: Opening dance melody returns, softer
    for (let i = 0; i < 5; i++) {
      this._note(n(dance[i]), vol * (0.25 - i * 0.03), t);
      t += danceT[i] * 1.3;
    }
    t += 5.0;
    return t;
  }

  // ── 4. Golden Hour — G major, warm chords with weaving melody ──

  goldenHour() {
    // G major scale
    const S = [
      98.00, 110.00, 123.47, 130.81, 146.83, 164.81, 185.00,
      196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 369.99,
      392.00, 440.00, 493.88, 523.25, 587.33, 659.26, 739.99,
      783.99, 880.00, 987.77, 1046.50, 1174.66
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.009 + Math.random() * 0.003;
    let t = 0;

    // Progression: G - D/F# - Em - C | G - Bm - C - D
    // G=0,A=1,B=2,C=3,D=4,E=5,F#=6 per octave
    const chords = [
      // G - D/F# - Em - C
      { b: 7, ch: [14, 16, 18] },       // G: G3 bass, G4-B4-D5
      { b: 13, ch: [11, 15, 18] },       // D/F#: F#3 bass, D4-A4-D5
      { b: 12, ch: [14, 16, 18] },       // Em: E4 bass, G4-B4-D5 (shared tones)
      { b: 10, ch: [12, 14, 17] },       // C: C4 bass, E4-G4-C5
    ];
    const chords2 = [
      // G - Bm - C - D
      { b: 7, ch: [14, 16, 18] },       // G
      { b: 9, ch: [11, 13, 16] },        // Bm: B3 bass, D4-F#4-B4
      { b: 10, ch: [12, 14, 17] },       // C
      { b: 11, ch: [13, 15, 18] },       // D: D4 bass, F#4-A4-D5
    ];

    // Section A: Warm block chords, gentle — settling light
    for (let bar = 0; bar < 4; bar++) {
      const c = chords[bar];
      const v = vol * (0.5 + bar * 0.05);
      this._note(n(c.b), v * 0.48, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * (0.32 + Math.random() * 0.12), t + 0.06 + i * 0.04);
      }
      t += 5.0 + Math.random() * 1.0;
    }

    // Section B: Add melody weaving over the chords
    const mel = [18, 19, 21, 19, 18, 16, 14, 18]; // D5 E5 G5 E5 D5 B4 G4 D5
    for (let bar = 0; bar < 4; bar++) {
      const c = chords[bar];
      const v = vol * 0.75;
      this._note(n(c.b), v * 0.42, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.2, t + 0.08 + i * 0.04);
      }
      // Two melody notes per bar
      this._note(n(mel[bar * 2]), v * (0.62 + Math.random() * 0.2), t + 1.2);
      this._note(n(mel[bar * 2 + 1]), v * (0.55 + Math.random() * 0.2),
        t + 2.8 + Math.random() * 0.4);
      t += 5.5 + Math.random() * 1.0;
    }

    // Section C: Second progression, climax build
    const mel2 = [21, 22, 21, 19, 18, 19, 21, 18]; // G5 A5 G5 E5 D5 E5 G5 D5
    for (let bar = 0; bar < 4; bar++) {
      const c = chords2[bar];
      const v = vol * (bar >= 2 ? 1.0 : 0.85);
      this._note(n(c.b), v * 0.5, t);
      if (bar >= 2) this._note(n(c.b - 7), v * 0.2, t + 0.03);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.28, t + 0.1 + i * 0.05);
      }
      this._note(n(mel2[bar * 2]), v * (0.7 + Math.random() * 0.2), t + 1.0);
      this._note(n(mel2[bar * 2 + 1]), v * (0.6 + Math.random() * 0.2),
        t + 2.5 + Math.random() * 0.4);
      t += 5.5 + Math.random() * 1.0;
    }

    // Coda: Soft G chord, the last ray of light
    this._note(n(7), vol * 0.3, t);
    this._note(n(14), vol * 0.25, t + 0.5);
    this._note(n(16), vol * 0.18, t + 1.2);
    this._note(n(21), vol * 0.12, t + 2.0);
    t += 7.5;
    return t;
  }

  // ── 5. Cloud Atlas — E minor, building layers (Aria Math-inspired) ──

  cloudAtlas() {
    // E natural minor scale
    const S = [
      82.41, 92.50, 98.00, 110.00, 123.47, 130.81, 146.83,
      164.81, 185.00, 196.00, 220.00, 246.94, 261.63, 293.66,
      329.63, 369.99, 392.00, 440.00, 493.88, 523.25, 587.33,
      659.26, 739.99, 783.99, 880.00, 987.77, 1046.50, 1174.66
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.008 + Math.random() * 0.003;
    let t = 0;

    // Progression: Em - C - G - D | Em - Am - B(maj) - Em
    // Chord voicings for E minor: E=0,F#=1,G=2,A=3,B=4,C=5,D=6 per octave
    const prog = [
      { b: 7, ch: [14, 16, 18] },       // Em: E3, E4-G4-B4
      { b: 12, ch: [14, 16, 19] },       // C: C4, E4-G4-D5
      { b: 9, ch: [14, 16, 18] },        // G: G3, E4-G4-B4
      { b: 13, ch: [15, 17, 20] },       // D: D4, F#4-A4-D5
    ];
    const prog2 = [
      { b: 7, ch: [14, 16, 18] },       // Em
      { b: 10, ch: [14, 17, 19] },       // Am: A3, E4-A4-D5
      { b: 11, ch: [15, 18, 20] },       // B: B3, F#4-B4-D5 (V of Em)
      { b: 7, ch: [14, 16, 18] },        // Em
    ];

    // Layer 1: Single voice arpeggio pattern — the first thread
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * 0.45;
      // Rising arpeggio through chord tones
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * (0.5 + Math.random() * 0.2),
          t + i * (0.75 + Math.random() * 0.15));
      }
      t += 4.5 + Math.random() * 0.8;
    }
    t += 1.5;

    // Layer 2: Add bass, arpeggio continues — two threads
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * 0.62;
      this._note(n(c.b), v * 0.45, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * (0.45 + Math.random() * 0.2),
          t + 0.5 + i * (0.7 + Math.random() * 0.12));
      }
      // Add a descending echo after each arpeggio
      this._note(n(c.ch[2]), v * 0.2, t + 3.0);
      this._note(n(c.ch[1]), v * 0.15, t + 3.5);
      t += 5.0 + Math.random() * 0.8;
    }
    t += 1.5;

    // Layer 3: Full texture — bass, arpeggios, AND melody on top
    const mel = [21, 23, 25, 23, 21, 20, 18, 21]; // E5-G5-B5-G5-E5-D5-B4-E5
    for (let bar = 0; bar < 4; bar++) {
      const c = prog2[bar];
      const v = vol * (bar === 2 ? 1.0 : 0.82);
      // Bass
      this._note(n(c.b), v * 0.48, t);
      // Arpeggiated chord
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.28, t + 0.4 + i * 0.55);
      }
      // Melody
      this._note(n(mel[bar * 2]), v * (0.65 + Math.random() * 0.2), t + 1.8);
      this._note(n(mel[bar * 2 + 1]), v * (0.55 + Math.random() * 0.2), t + 3.2);
      t += 5.5 + Math.random() * 0.8;
    }

    // Layer 4: Peak — everything plays, thicker chords
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * 1.0;
      this._note(n(c.b), v * 0.5, t);
      this._note(n(c.b - 7), v * 0.2, t + 0.03);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.32, t + 0.3 + i * 0.45);
        // Octave doubling on peak
        if (bar === 2 && i === 2) {
          this._note(n(c.ch[i] + 7), v * 0.12, t + 0.35 + i * 0.45);
        }
      }
      // High melody continues
      const highMel = [25, 23, 21, 23, 25, 24, 21, 25];
      this._note(n(highMel[bar * 2]), v * 0.6, t + 1.5);
      this._note(n(highMel[bar * 2 + 1]), v * 0.5, t + 2.8);
      t += 5.5 + Math.random() * 0.8;
    }

    // Coda: Strip back to single voice — the last thread
    this._note(n(14), vol * 0.3, t);       // E4
    t += 2.5;
    this._note(n(16), vol * 0.22, t);      // G4
    t += 2.0;
    this._note(n(18), vol * 0.15, t);      // B4
    t += 3.0;
    this._note(n(14), vol * 0.1, t);       // E4
    t += 6.0;
    return t;
  }

  // ── 6. Porcelain — Bb major, delicate Satie-like 3/4 feel ──

  porcelain() {
    // Bb major scale
    const S = [
      116.54, 130.81, 146.83, 155.56, 174.61, 196.00, 220.00,
      233.08, 261.63, 293.66, 311.13, 349.23, 392.00, 440.00,
      466.16, 523.25, 587.33, 622.25, 698.46, 783.99, 880.00,
      932.33, 1046.50, 1174.66
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.008 + Math.random() * 0.003;
    let t = 0;

    // Bb=0,C=1,D=2,Eb=3,F=4,G=5,A=6 per octave
    // Progression: Bb - Gm - Eb - F | Dm - Gm - Cm - F

    // Satie pattern: bass... chord... chord... (3/4 waltz)
    const bars = [
      { b: 7, ch: [9, 11] },        // Bb: Bb3, D4-F4
      { b: 12, ch: [9, 14] },       // Gm: G4, D4-Bb4
      { b: 10, ch: [12, 14] },      // Eb: Eb4, G4-Bb4
      { b: 11, ch: [13, 15] },      // F: F4, A4-C5
      { b: 9, ch: [11, 14] },       // Dm: D4, F4-Bb4
      { b: 12, ch: [9, 14] },       // Gm
      { b: 8, ch: [10, 14] },       // Cm: C4, Eb4-Bb4
      { b: 11, ch: [13, 15] },      // F
    ];

    // Melody that floats over the waltz
    const mel = [16, 18, 16, 15, 14, 16, 18, 15, 14, 16, 19, 18, 16, 15, 14, 16];

    // Section A: Waltz accompaniment alone
    for (let bar = 0; bar < 4; bar++) {
      const c = bars[bar];
      const v = vol * 0.5;
      this._note(n(c.b), v * 0.55, t);
      this._note(n(c.ch[0]), v * 0.32, t + 1.0);
      this._note(n(c.ch[1]), v * 0.28, t + 1.0 + 0.04);
      this._note(n(c.ch[0]), v * 0.25, t + 2.0);
      this._note(n(c.ch[1]), v * 0.22, t + 2.0 + 0.04);
      t += 3.6 + Math.random() * 0.5;
    }
    t += 1.5;

    // Section B: Add melody
    for (let bar = 0; bar < 8; bar++) {
      const c = bars[bar];
      const v = vol * (bar >= 4 ? 0.85 : 0.7);
      // Waltz bass-chord-chord
      this._note(n(c.b), v * 0.48, t);
      this._note(n(c.ch[0]), v * 0.28, t + 1.0);
      this._note(n(c.ch[1]), v * 0.25, t + 1.05);
      this._note(n(c.ch[0]), v * 0.22, t + 2.0);
      this._note(n(c.ch[1]), v * 0.2, t + 2.05);
      // Melody
      this._note(n(mel[bar * 2]), v * (0.55 + Math.random() * 0.2), t + 0.3);
      this._note(n(mel[bar * 2 + 1]), v * (0.45 + Math.random() * 0.2), t + 1.8);
      t += 3.8 + Math.random() * 0.5;
    }

    // Coda: Just melody, no accompaniment — fragile
    this._note(n(16), vol * 0.3, t);
    t += 2.5;
    this._note(n(14), vol * 0.22, t);
    t += 2.0;
    this._note(n(7), vol * 0.15, t);
    t += 5.0;
    return t;
  }

  // ── 7. Sundial — F lydian, ethereal sustained chords ──

  sundial() {
    // F lydian scale (F G A B C D E — note the B natural, not Bb)
    const S = [
      87.31, 98.00, 110.00, 123.47, 130.81, 146.83, 164.81,
      174.61, 196.00, 220.00, 246.94, 261.63, 293.66, 329.63,
      349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.26,
      698.46, 783.99, 880.00, 987.77, 1046.50
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.008 + Math.random() * 0.003;
    let t = 0;

    // F=0,G=1,A=2,B=3,C=4,D=5,E=6 per octave
    // The B natural (#4) is the characteristic lydian color
    // Progression: F - G - Am - C | F - G - Em - F
    const chords = [
      { b: 7, tones: [14, 16, 18] },    // F: F3, F4-A4-C5
      { b: 8, tones: [15, 17, 19] },    // G: G3, G4-B4-D5 (the B natural!)
      { b: 9, tones: [14, 16, 18] },    // Am: A3, F4-A4-C5 (reharmonized)
      { b: 11, tones: [14, 16, 18] },   // C: C4, F4-A4-C5
      { b: 7, tones: [14, 16, 18] },    // F
      { b: 8, tones: [15, 17, 19] },    // G (with B natural again)
      { b: 13, tones: [16, 18, 20] },   // Em: E4, A4-C5-E5
      { b: 7, tones: [14, 16, 18] },    // F
    ];

    // Section A: Sustained chords, very slow — time moves differently here
    for (let bar = 0; bar < 4; bar++) {
      const c = chords[bar];
      const v = vol * (0.45 + bar * 0.08);
      this._note(n(c.b), v * 0.45, t);
      for (let i = 0; i < c.tones.length; i++) {
        this._note(n(c.tones[i]), v * (0.35 + Math.random() * 0.15),
          t + 0.3 + i * (0.2 + Math.random() * 0.1));
      }
      t += 6.5 + Math.random() * 1.5;
    }
    t += 2.0;

    // Section B: Same chords, now with a high melody that uses the #4
    const mel = [18, 20, 21, 20, 18, 17, 18, 20, 21, 22, 21, 18, 17, 18, 20, 18];
    for (let bar = 0; bar < 8; bar++) {
      const c = chords[bar];
      const v = vol * (bar >= 4 ? 0.9 : 0.72);
      this._note(n(c.b), v * 0.42, t);
      for (let i = 0; i < c.tones.length; i++) {
        this._note(n(c.tones[i]), v * 0.25, t + 0.25 + i * 0.12);
      }
      // Melody
      this._note(n(mel[bar * 2]), v * (0.55 + Math.random() * 0.2), t + 1.0);
      this._note(n(mel[bar * 2 + 1]), v * (0.48 + Math.random() * 0.2),
        t + 2.8 + Math.random() * 0.5);
      t += 5.5 + Math.random() * 1.0;
    }

    // Coda: F major chord with the #4 (B natural) — the sundial's shadow
    this._note(n(7), vol * 0.3, t);       // F3
    this._note(n(14), vol * 0.25, t + 0.5);  // F4
    this._note(n(17), vol * 0.2, t + 1.5);   // B4 — the lydian note, shimmering
    this._note(n(18), vol * 0.15, t + 2.5);  // C5
    t += 8.0;
    return t;
  }

  // ── 8. Tidal — A minor, deep bass waves (Subwoofer Lullaby-inspired) ──

  tidal() {
    // A natural minor scale
    const S = [
      110.00, 123.47, 130.81, 146.83, 164.81, 174.61, 196.00,
      220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00,
      440.00, 493.88, 523.25, 587.33, 659.26, 698.46, 783.99,
      880.00
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.009 + Math.random() * 0.003;
    let t = 0;

    // A=0,B=1,C=2,D=3,E=4,F=5,G=6 per octave
    // Progression: Am - F - C - G | Am - Dm - E(maj) - Am
    // Deep bass, slow, oceanic

    // Opening: Deep bass wave alone
    this._note(n(0), vol * 0.5, t);         // A2 bass
    this._note(n(7), vol * 0.3, t + 1.5);   // A3
    t += 5.0 + Math.random() * 2.0;

    // Section A: Bass waves with sparse high notes — tidal pull
    const tides = [
      { b: 0, high: [14, 16] },          // Am: A2 bass, A4-C5
      { b: 5, high: [14, 16] },          // F: F3 bass, A4-C5
      { b: 2, high: [16, 18] },          // C: C3 bass, C5-E5
      { b: 6, high: [14, 16] },          // G: G3 bass, A4-C5
    ];
    for (let wave = 0; wave < 2; wave++) {
      for (let bar = 0; bar < 4; bar++) {
        const c = tides[bar];
        const v = vol * (wave === 0 ? 0.55 : 0.75);
        // Deep bass swell
        this._note(n(c.b), v * 0.6, t);
        if (wave === 1) this._note(n(c.b + 7), v * 0.3, t + 0.5);
        // Sparse high notes — sea spray
        this._note(n(c.high[0]), v * (0.35 + Math.random() * 0.15), t + 2.5);
        if (wave === 1 || Math.random() < 0.5) {
          this._note(n(c.high[1]), v * (0.25 + Math.random() * 0.12),
            t + 3.8 + Math.random() * 0.5);
        }
        t += 6.5 + Math.random() * 1.5;
      }
      t += 2.0 + Math.random() * 1.5;
    }

    // Section B: Storm swell — Am-Dm-E-Am, fuller
    const storm = [
      { b: 0, mid: [7, 9], high: [14, 16, 18] },   // Am
      { b: 3, mid: [7, 10], high: [14, 17, 18] },   // Dm
      { b: 4, mid: [8, 11], high: [15, 18, 20] },   // E(major — raise G# for dominant)
      { b: 0, mid: [7, 9], high: [14, 16, 18] },    // Am
    ];
    for (let bar = 0; bar < 4; bar++) {
      const c = storm[bar];
      const v = vol * (bar === 2 ? 1.0 : 0.85);
      // Bass
      this._note(n(c.b), v * 0.6, t);
      // Mid-range chord
      for (let i = 0; i < c.mid.length; i++) {
        this._note(n(c.mid[i]), v * 0.32, t + 0.8 + i * 0.3);
      }
      // High spray
      for (let i = 0; i < c.high.length; i++) {
        this._note(n(c.high[i]), v * (0.3 + Math.random() * 0.15),
          t + 2.0 + i * (0.7 + Math.random() * 0.2));
      }
      t += 7.0 + Math.random() * 1.0;
    }

    // Coda: Tide receding — just bass notes, further and further apart
    this._note(n(0), vol * 0.4, t);         // A2
    t += 4.0;
    this._note(n(7), vol * 0.25, t);        // A3
    t += 5.0;
    this._note(n(0), vol * 0.15, t);        // A2
    t += 7.0;
    return t;
  }

  // ── 9. Origami — Eb major, layered voices building gradually ──

  origami() {
    // Eb major scale
    const S = [
      155.56, 174.61, 196.00, 207.65, 233.08, 261.63, 293.66,
      311.13, 349.23, 392.00, 415.30, 466.16, 523.25, 587.33,
      622.25, 698.46, 783.99, 830.61, 932.33, 1046.50, 1174.66
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.009 + Math.random() * 0.003;
    let t = 0;

    // Eb=0,F=1,G=2,Ab=3,Bb=4,C=5,D=6 per octave
    // Progression: Eb - Cm - Ab - Bb (I - vi - IV - V)
    const prog = [
      { b: 7, ch: [9, 11, 14] },        // Eb: Eb3, G4-Bb4-Eb5
      { b: 12, ch: [9, 11, 14] },       // Cm: C4, G4-Bb4-Eb5
      { b: 10, ch: [9, 12, 14] },       // Ab: Ab3, G4-C5-Eb5
      { b: 11, ch: [9, 13, 14] },       // Bb: Bb3, G4-D5-Eb5
    ];

    // Fold 1: Single voice — one clean line
    const line1 = [14, 13, 11, 9, 11, 13, 14, 12]; // Eb5-D5-Bb4-G4-Bb4-D5-Eb5-C5
    for (let i = 0; i < 8; i++) {
      this._note(n(line1[i]), vol * (0.38 + Math.random() * 0.12),
        t);
      t += 2.0 + Math.random() * 0.8;
    }
    t += 2.0;

    // Fold 2: Add bass voice — two layers
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * 0.6;
      this._note(n(c.b), v * 0.45, t);
      this._note(n(line1[bar * 2]), v * 0.5, t + 1.0);
      this._note(n(line1[bar * 2 + 1]), v * 0.4, t + 2.5);
      t += 4.5 + Math.random() * 0.8;
    }
    t += 1.5;

    // Fold 3: Add inner voice — three layers
    const inner = [11, 12, 11, 9, 11, 13, 12, 11]; // Bb4-C5-Bb4-G4
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * 0.78;
      this._note(n(c.b), v * 0.45, t);
      this._note(n(line1[bar * 2]), v * 0.48, t + 0.8);
      this._note(n(inner[bar * 2]), v * 0.3, t + 1.2);
      this._note(n(line1[bar * 2 + 1]), v * 0.4, t + 2.2);
      this._note(n(inner[bar * 2 + 1]), v * 0.25, t + 2.8);
      t += 4.8 + Math.random() * 0.8;
    }
    t += 1.5;

    // Fold 4: Full — all voices, chords complete
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * (bar === 2 ? 1.0 : 0.88);
      this._note(n(c.b), v * 0.5, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.3, t + 0.3 + i * 0.15);
      }
      // High melody
      this._note(n(line1[bar * 2] + 7), v * 0.25, t + 1.5);
      t += 5.0 + Math.random() * 0.8;
    }

    // Unfold: Strip back to single note
    this._note(n(14), vol * 0.3, t);
    t += 3.5;
    this._note(n(7), vol * 0.18, t);
    t += 5.0;
    return t;
  }

  // ── 10. Hearthlight — D minor → D major, emotional shift from cold to warm ──

  hearthlight() {
    // D minor scale (first half)
    const Sm = [
      146.83, 164.81, 174.61, 196.00, 220.00, 233.08, 261.63,
      293.66, 329.63, 349.23, 392.00, 440.00, 466.16, 523.25,
      587.33, 659.26, 698.46, 783.99, 880.00, 932.33, 1046.50
    ];
    // D major scale (second half)
    const SM = [
      146.83, 164.81, 185.00, 196.00, 220.00, 246.94, 277.18,
      293.66, 329.63, 369.99, 392.00, 440.00, 493.88, 554.37,
      587.33, 659.26, 739.99, 783.99, 880.00, 987.77, 1108.73
    ];
    const vol = 0.009 + Math.random() * 0.003;
    let t = 0;

    // D=0,E=1,F=2,G=3,A=4,Bb=5,C=6 per octave (minor)
    // Dm - Bb - F - C (i - bVI - bIII - bVII)
    const nmn = (i) => this._si(Sm, i);

    // Cold section — D minor, sparse and somber
    const coldProg = [
      { b: 7, ch: [10, 12, 14] },       // Dm: D3, G4-Bb4-D5
      { b: 12, ch: [8, 12, 14] },       // Bb: Bb3, E4-Bb4-D5
      { b: 9, ch: [11, 14, 16] },       // F: F3, A4-D5-F5
      { b: 13, ch: [9, 12, 14] },       // C: C4, F4-Bb4-D5
    ];

    for (let bar = 0; bar < 4; bar++) {
      const c = coldProg[bar];
      const v = vol * 0.6;
      this._note(nmn(c.b), v * 0.45, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(nmn(c.ch[i]), v * (0.3 + Math.random() * 0.12),
          t + 0.8 + i * (0.6 + Math.random() * 0.15));
      }
      t += 5.5 + Math.random() * 1.0;
    }

    // Cold melody
    const coldMel = [14, 13, 12, 10, 12, 14, 13, 12]; // D5-C5-Bb4-G4
    for (let bar = 0; bar < 4; bar++) {
      const c = coldProg[bar];
      const v = vol * 0.7;
      this._note(nmn(c.b), v * 0.4, t);
      for (let i = 0; i < 2; i++) {
        this._note(nmn(c.ch[i]), v * 0.22, t + 0.3 + i * 0.06);
      }
      this._note(nmn(coldMel[bar * 2]), v * (0.55 + Math.random() * 0.18), t + 1.5);
      this._note(nmn(coldMel[bar * 2 + 1]), v * (0.45 + Math.random() * 0.18), t + 3.2);
      t += 6.0 + Math.random() * 1.0;
    }
    t += 3.0; // Pause before the shift

    // Warm section — D major, the hearth is lit
    const nmj = (i) => this._si(SM, i);
    // D - G - A - D (I - IV - V - I)
    const warmProg = [
      { b: 7, ch: [11, 14, 16] },       // D: D3, A4-D5-F#5
      { b: 10, ch: [11, 14, 17] },      // G: G3, A4-D5-G5
      { b: 11, ch: [12, 14, 16] },      // A: A3, B4-D5-F#5
      { b: 7, ch: [11, 14, 18] },       // D: D3, A4-D5-A5
    ];
    const warmMel = [14, 16, 18, 16, 14, 12, 14, 11]; // D5-F#5-A5-F#5-D5-B4-D5-A4

    for (let bar = 0; bar < 4; bar++) {
      const c = warmProg[bar];
      const v = vol * (bar === 3 ? 1.0 : 0.85);
      this._note(nmj(c.b), v * 0.5, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(nmj(c.ch[i]), v * (0.3 + Math.random() * 0.1),
          t + 0.4 + i * 0.5);
      }
      this._note(nmj(warmMel[bar * 2]), v * (0.65 + Math.random() * 0.2), t + 1.8);
      this._note(nmj(warmMel[bar * 2 + 1]), v * (0.55 + Math.random() * 0.2), t + 3.3);
      t += 6.0 + Math.random() * 1.0;
    }

    // Coda: Warm D major chord, glowing
    this._note(nmj(7), vol * 0.35, t);
    this._note(nmj(14), vol * 0.3, t + 0.8);
    this._note(nmj(16), vol * 0.22, t + 1.5);
    this._note(nmj(18), vol * 0.15, t + 2.5);
    t += 8.0;
    return t;
  }

  // ── 11. Compass Rose — B dorian, modal & searching (Alpha-inspired) ──

  compassRose() {
    // B dorian scale (B C# D E F# G# A)
    const S = [
      123.47, 138.59, 146.83, 164.81, 185.00, 207.65, 220.00,
      246.94, 277.18, 293.66, 329.63, 369.99, 415.30, 440.00,
      493.88, 554.37, 587.33, 659.26, 739.99, 830.61, 880.00,
      987.77
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.009 + Math.random() * 0.003;
    let t = 0;

    // B=0,C#=1,D=2,E=3,F#=4,G#=5,A=6 per octave
    // The G# (raised 6th) is what makes dorian bittersweet
    // Progression: Bm - G - A - F#m | Bm - E - A - Bm
    const prog1 = [
      { b: 7, ch: [9, 11, 14] },        // Bm: B3, D4-F#4-B4
      { b: 12, ch: [9, 11, 14] },       // G: G#3(close), D4-F#4-B4
      { b: 13, ch: [8, 11, 15] },       // A: A3, C#4-F#4-C#5
      { b: 11, ch: [8, 13, 14] },       // F#m: F#3, C#4-A4-B4
    ];
    const prog2 = [
      { b: 7, ch: [9, 11, 14] },        // Bm
      { b: 10, ch: [12, 14, 16] },      // E: E3, G#4-B4-D5
      { b: 13, ch: [8, 11, 15] },       // A
      { b: 7, ch: [9, 11, 14] },        // Bm
    ];

    // Section A: Searching melody — the compass needle swings
    const search = [14, 16, 17, 16, 14, 12, 11, 14]; // B4-D5-E5-D5-B4-G#4-F#4-B4
    for (let bar = 0; bar < 4; bar++) {
      const c = prog1[bar];
      const v = vol * (0.5 + bar * 0.07);
      this._note(n(c.b), v * 0.42, t);
      for (let m = 0; m < 2; m++) {
        this._note(n(search[bar * 2 + m]), v * (0.55 + Math.random() * 0.2),
          t + 1.0 + m * (1.8 + Math.random() * 0.5));
      }
      t += 5.5 + Math.random() * 1.2;
    }
    t += 2.0;

    // Section B: Melody with arpeggiated chords — gaining direction
    for (let bar = 0; bar < 4; bar++) {
      const c = prog1[bar];
      const v = vol * 0.75;
      this._note(n(c.b), v * 0.45, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.25, t + 0.5 + i * 0.4);
      }
      this._note(n(search[bar * 2]), v * (0.6 + Math.random() * 0.2), t + 1.8);
      this._note(n(search[bar * 2 + 1]), v * (0.5 + Math.random() * 0.2), t + 3.2);
      t += 5.8 + Math.random() * 1.0;
    }
    t += 1.5;

    // Section C: Second progression, climax — found true north
    const found = [17, 18, 19, 18, 17, 16, 14, 17]; // E5-F#5-G#5-F#5-E5-D5-B4-E5
    for (let bar = 0; bar < 4; bar++) {
      const c = prog2[bar];
      const v = vol * (bar === 1 || bar === 2 ? 1.0 : 0.85);
      this._note(n(c.b), v * 0.5, t);
      if (bar >= 1) this._note(n(c.b - 7), v * 0.2, t + 0.04);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.3, t + 0.4 + i * 0.35);
      }
      this._note(n(found[bar * 2]), v * (0.68 + Math.random() * 0.2), t + 1.5);
      this._note(n(found[bar * 2 + 1]), v * (0.58 + Math.random() * 0.2), t + 3.0);
      t += 6.0 + Math.random() * 1.0;
    }

    // Coda: Bm chord, the compass settles
    this._note(n(7), vol * 0.35, t);
    this._note(n(9), vol * 0.25, t + 0.5);
    this._note(n(14), vol * 0.15, t + 1.5);
    t += 7.0;
    return t;
  }

  // ── 12. Ceramic — F major, simple warm repeating pattern ──

  ceramic() {
    // F major scale
    const S = [
      87.31, 98.00, 110.00, 116.54, 130.81, 146.83, 164.81,
      174.61, 196.00, 220.00, 233.08, 261.63, 293.66, 329.63,
      349.23, 392.00, 440.00, 466.16, 523.25, 587.33, 659.26,
      698.46, 783.99
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.009 + Math.random() * 0.003;
    let t = 0;

    // F=0,G=1,A=2,Bb=3,C=4,D=5,E=6 per octave
    // Progression: F - Dm - Bb - C (I - vi - IV - V)
    const prog = [
      { b: 7, ch: [9, 11, 14] },        // F: F3, A4-C5-F5
      { b: 12, ch: [8, 11, 14] },       // Dm: D4, A4-C5-F5 (shared tones)
      { b: 10, ch: [9, 12, 14] },       // Bb: Bb3, A4-D5-F5
      { b: 11, ch: [9, 13, 16] },       // C: C4, A4-E5-A5
    ];

    // Simple repeating arpeggio pattern — like a potter's wheel, round and round
    // Each pass adds slightly more ornamentation

    for (let pass = 0; pass < 4; pass++) {
      const pv = vol * [0.45, 0.65, 0.85, 0.5][pass];
      for (let bar = 0; bar < 4; bar++) {
        const c = prog[bar];
        // Bass
        this._note(n(c.b), pv * 0.48, t);
        // Arpeggio up through chord
        for (let i = 0; i < c.ch.length; i++) {
          this._note(n(c.ch[i]), pv * (0.35 + Math.random() * 0.15),
            t + 0.6 + i * (0.55 + Math.random() * 0.1));
        }
        // Pass 2+: Add a descending answer
        if (pass >= 1) {
          this._note(n(c.ch[2]), pv * 0.25, t + 2.6);
          this._note(n(c.ch[1]), pv * 0.2, t + 3.1);
        }
        // Pass 3 (climax): Melody note on top
        if (pass === 2) {
          const topMel = [14, 16, 15, 14]; // F5-A5-G5-F5
          this._note(n(topMel[bar]), pv * 0.5, t + 1.5);
        }
        // Pass 4 (winding down): Fewer notes
        if (pass === 3 && bar >= 2) {
          t += 5.5 + Math.random() * 1.5;
          continue;
        }
        t += 4.5 + Math.random() * 0.8;
      }
      t += 2.0 + Math.random() * 1.5;
    }

    // Final F chord
    this._note(n(7), vol * 0.25, t);
    this._note(n(14), vol * 0.18, t + 0.5);
    t += 6.0;
    return t;
  }



  // ═══════════════════════════════════════════════════════════
  //  CLASSIC COMPOSITIONS — original C pentatonic passacaglia style
  // ═══════════════════════════════════════════════════════════

  // ── 1. Gentle Arc — passacaglia: rising-falling motif over unresolved bass cycle ──
  //    Identity: the ascending 3rd→5th→6th shape, always recognizable.

  gentleArc() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.004;
    // Random root → different key each play, but same intervals → same soul
    const root = 3 + Math.floor(Math.random() * 4);
    // FIXED MOTIF — this IS Gentle Arc's identity (pool index offsets from root)
    const motif = [0, 2, 4, 5, 4, 2, 1, 0];
    // Bass cycle — vi → IV → II → V feel, avoids resolving to I
    const bass = [-4, -2, -5, -3];
    // Base rhythm — the shape of time (jittered ±20% each play)
    const rhythm = [1.3, 0.9, 1.1, 1.5, 1.0, 1.2, 0.8, 1.8];
    let t = 0;

    // 5 passes: bare → +bass → +harmony → full(climax) → strip-back
    for (let pass = 0; pass < 5; pass++) {
      const passVol = [0.50, 0.65, 0.80, 1.0, 0.45][pass] * vol;
      const bassOn = pass >= 1 && pass <= 3;
      const harmonyOn = pass >= 2 && pass <= 3;
      const sparkle = pass === 3;
      const isStrip = pass === 4;

      // Bass pedal at start of each pass (when active)
      if (bassOn) {
        const bi = bass[pass % bass.length];
        this._note(P[this._ci(root + bi)], passVol * 0.28, t);
      }

      for (let n = 0; n < motif.length; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Per-pass variation — the "dream shift"
        // Pass 2: octave up on the peak note (index 3)
        if (pass === 2 && n === 3) noteIdx = this._ci(noteIdx + 5);
        // Pass 3 (climax): slight ornament — grace note before beat 0
        if (pass === 3 && n === 0) {
          this._note(P[this._ci(noteIdx - 1)], passVol * 0.18, t - 0.07);
        }
        // Pass 4 (strip-back): one note changed — the memory is slightly different
        if (isStrip && n === 5) noteIdx = this._ci(root + motif[n] + 1);

        this._note(P[noteIdx], passVol * (0.65 + Math.random() * 0.35), t);

        // Harmony third — only on harmony passes, on strong beats
        if (harmonyOn && (n === 0 || n === 3 || n === 6) && Math.random() < 0.70) {
          this._note(P[this._ci(noteIdx + 2)], passVol * 0.25, t + 0.04);
        }

        // High sparkle on climax pass
        if (sparkle && n === 4 && Math.random() < 0.55) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.14, t + 0.20);
        }

        // Timing: fixed rhythm shape with ±20% jitter
        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.80 + Math.random() * 0.40);
      }

      // Bass resolution at end of pass
      if (bassOn) {
        const bi = bass[(pass + 1) % bass.length];
        this._note(P[this._ci(root + bi)], passVol * 0.22, t);
      }

      // Breath between passes — longer for strip-back approach
      t += pass === 3 ? 3.5 + Math.random() * 2.0 : 2.0 + Math.random() * 1.5;
    }

    // Coda — just root and fifth, hanging in the air
    this._note(P[this._ci(root)], vol * 0.30, t);
    this._note(P[this._ci(root + 4)], vol * 0.18, t + 0.05);
      return t;
  }

  // ── 2. Call & Response — passacaglia: fixed call, transposed responses, fading echoes ──
  //    Identity: the call phrase (0,1,3,2,4) — always the same question, different answers.

  callAndResponse() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const root = 4 + Math.floor(Math.random() * 4);
    // FIXED CALL — this IS Call & Response's identity
    const call = [0, 1, 3, 2, 4];
    // Response shifts — each answer transposes the call differently
    const shifts = [2, -1, 4, -3];
    // Bass — unresolved cycle
    const bass = [-4, -3, -5, -2];
    // Call rhythm — the question has a specific cadence
    const callRhythm = [0.75, 0.60, 0.85, 0.55, 1.2];
    let t = 0;

    // 4 rounds: each round = call + response, getting further apart
    for (let round = 0; round < 4; round++) {
      const roundVol = [0.60, 0.80, 1.0, 0.55][round] * vol;
      const hasBass = round >= 1 && round <= 2;
      const hasHarmony = round === 2;

      // Bass pedal
      if (hasBass) {
        this._note(P[this._ci(root + bass[round % bass.length])], roundVol * 0.25, t);
      }

      // ── THE CALL (always the same melody) ──
      for (let n = 0; n < call.length; n++) {
        const noteIdx = this._ci(root + call[n]);
        this._note(P[noteIdx], roundVol * (0.65 + Math.random() * 0.35), t);

        // Harmony on first and last note during peak
        if (hasHarmony && (n === 0 || n === call.length - 1)) {
          this._note(P[this._ci(noteIdx + 2)], roundVol * 0.22, t + 0.04);
        }

        t += callRhythm[n] * (0.85 + Math.random() * 0.30);
      }

      // Silence — waiting for the response
      t += 2.0 + Math.random() * 1.5 + round * 0.8;

      // ── THE RESPONSE (same shape, shifted pitch — a familiar answer in a new key) ──
      const shift = shifts[round];
      const responseVol = roundVol * (0.75 - round * 0.10);
      // Later responses play fewer notes — fading memory
      const responseLen = Math.max(3, call.length - round);

      for (let n = 0; n < responseLen; n++) {
        let noteIdx = this._ci(root + call[n] + shift);
        // Round 2+: slight variation in the response — the answer evolves
        if (round >= 2 && n === 2) noteIdx = this._ci(noteIdx + 1);

        this._note(P[noteIdx], responseVol * (0.55 + Math.random() * 0.45), t);
        t += callRhythm[n] * (0.90 + Math.random() * 0.25);
      }

      // Bass resolution
      if (hasBass) {
        this._note(P[this._ci(root + bass[(round + 1) % bass.length])], roundVol * 0.18, t);
      }

      // Long breath between rounds
      t += 3.0 + Math.random() * 2.5;
    }

    // Coda — just the first two notes of the call, a final whisper of the question
    t += 1.5;
    this._note(P[this._ci(root + call[0])], vol * 0.25, t);
    t += callRhythm[0];
    this._note(P[this._ci(root + call[1])], vol * 0.15, t);
      return t;
  }

  // ── 3. Falling Leaves — passacaglia: descending motif repeated with fading volume ──
  //    Identity: the tumbling shape (0, -1, 1, -2, -1, -3, -2, -4) — always falling.

  fallingLeaves() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const root = 10 + Math.floor(Math.random() * 3); // start high
    // FIXED MOTIF — the leaf's tumble pattern (down with catches)
    const motif = [0, -1, 1, -2, -1, -3, -2, -4];
    // Ground bass — the earth below
    const bass = [-8, -7, -9, -6];
    // Rhythm — irregular like a leaf drifting
    const rhythm = [1.1, 0.7, 1.3, 0.6, 1.0, 1.5, 0.8, 1.8];
    let t = 0;

    // Wind shimmer — the tree shaking
    this._note(P[this._ci(root + 2)], vol * 0.18, t);
    this._note(P[this._ci(root + 3)], vol * 0.12, t + 0.15);
    t += 2.0 + Math.random() * 1.0;

    // 5 passes: first leaf → more leaves → updraft → many leaves(peak) → settling
    for (let pass = 0; pass < 5; pass++) {
      // Volume fades across passes — leaves settling
      const passVol = [0.55, 0.75, 0.65, 1.0, 0.35][pass] * vol;
      const hasBass = pass >= 1 && pass <= 3;
      const isUpdraft = pass === 2;
      const isPeak = pass === 3;

      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.22, t);
      }

      // Each pass the motif starts slightly lower — the tree is emptying
      const drift = -pass;

      for (let n = 0; n < motif.length; n++) {
        let noteIdx = this._ci(root + motif[n] + drift);

        // Updraft pass: the "catch" notes (positive offsets) go higher
        if (isUpdraft && motif[n] > 0) noteIdx = this._ci(noteIdx + 2);
        // Peak: flutter pair on the catch notes
        if (isPeak && motif[n] >= 0 && Math.random() < 0.50) {
          this._note(P[this._ci(noteIdx + 1)], passVol * 0.25, t + 0.15);
        }

        this._note(P[noteIdx], passVol * (0.50 + Math.random() * 0.50), t);

        // Sparkle catch on some notes
        if ((n === 2 || n === 4) && Math.random() < 0.40) {
          this._note(P[this._ci(noteIdx + 2)], passVol * 0.18, t + 0.20 + Math.random() * 0.10);
        }

        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.80 + Math.random() * 0.40);
      }

      t += 2.5 + Math.random() * 2.0;
    }

    // Final — the last leaf, the first note of the motif, barely audible
    t += 1.5;
    this._note(P[this._ci(root + motif[0] - 5)], vol * 0.10, t);
      return t;
  }

  // ── 4. Spread Arpeggio — passacaglia: chord fan motif, ascending then descending ──
  //    Identity: the spread shape (0, 2, 4, 7, 4, 2) — a hand opening and closing.

  spreadArpeggio() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.003;
    const root = 2 + Math.floor(Math.random() * 4);
    // FIXED MOTIF — the chord fan, always the same intervals
    const motif = [0, 2, 4, 7, 4, 2, 0, -1];
    // Bass — open fifths, unresolved
    const bass = [-3, -5, -2, -4];
    // Rhythm — accelerates up, decelerates down (the fan shape)
    const rhythm = [1.0, 0.75, 0.60, 0.55, 0.60, 0.75, 1.0, 1.6];
    let t = 0;

    // 5 passes: bare → +bass → +counter(contrary motion) → full(climax) → fade
    for (let pass = 0; pass < 5; pass++) {
      const passVol = [0.45, 0.60, 0.78, 1.0, 0.38][pass] * vol;
      const hasBass = pass >= 1 && pass <= 3;
      const hasCounter = pass >= 2 && pass <= 3;
      const isClimax = pass === 3;
      const isFade = pass === 4;

      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.25, t);
      }

      const notesToPlay = isFade ? 5 : motif.length;

      for (let n = 0; n < notesToPlay; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Climax: the peak note (index 3) gets octave doubling
        if (isClimax && n === 3) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.16, t + 0.04);
        }
        // Counter-voice — moves opposite to the motif
        if (hasCounter && (n === 1 || n === 5) && Math.random() < 0.55) {
          const contra = this._ci(noteIdx + (motif[n] > 2 ? -2 : 2));
          this._note(P[contra], passVol * 0.22, t + 0.05);
        }
        // Fade: notes drift lower — the hand relaxing
        if (isFade) noteIdx = this._ci(noteIdx - 1);

        this._note(P[noteIdx], passVol * (0.55 + Math.random() * 0.45), t);

        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.82 + Math.random() * 0.36);
      }

      // Chord stab at peak of climax
      if (isClimax) {
        const peak = this._ci(root + 7);
        this._note(P[peak], passVol * 0.40, t);
        this._note(P[this._ci(peak - 2)], passVol * 0.22, t + 0.03);
      }

      if (hasBass) {
        this._note(P[this._ci(root + bass[(pass + 1) % bass.length])], passVol * 0.18, t + 0.08);
      }

      t += 2.0 + Math.random() * 2.0;
    }

    // Final open chord
    this._note(P[this._ci(root)], vol * 0.25, t);
    this._note(P[this._ci(root + 2)], vol * 0.18, t + 0.04);
    this._note(P[this._ci(root + 4)], vol * 0.12, t + 0.08);
      return t;
  }

  // ── 5. Lullaby — passacaglia: rocking motif in 3-feel with bass warmth ──
  //    Identity: the rocking shape (up, up, down, rest, up, down, down) — a cradle.

  lullaby() {
    const P = GameMusic.POOL;
    const vol = 0.008 + Math.random() * 0.003;
    const root = 5 + Math.floor(Math.random() * 3);
    // FIXED MOTIF — Lullaby's rocking cradle (gentle 3/4 feel)
    const motif = [0, 2, 3, 1, 3, 2, 0, -1];
    // Warm bass — low, simple, like a heartbeat
    const bass = [-4, -3, -5, -4];
    // 3/4 rocking rhythm: long-short-short-long-short-short-long-long
    const rhythm = [1.4, 0.85, 0.90, 1.5, 0.80, 0.95, 1.3, 1.8];
    let t = 0;

    // 6 passes: hum → cradle → +bass → +harmony(warmth) → +sparkle(peak) → sleep
    for (let pass = 0; pass < 6; pass++) {
      const passVol = [0.35, 0.50, 0.65, 0.85, 1.0, 0.28][pass] * vol;
      const hasBass = pass >= 2 && pass <= 4;
      const hasHarmony = pass >= 3 && pass <= 4;
      const hasStar = pass === 4;
      const isSleep = pass === 5;

      // Bass warmth at pass start
      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.30, t);
      }

      // Sleep pass: only first 5 notes, very soft, slowing
      const notesToPlay = isSleep ? 5 : motif.length;
      let sleepSlow = 0;

      for (let n = 0; n < notesToPlay; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Pass 3: the 4th note (the "rest" position) gets a harmony third
        if (pass === 3 && n === 3) {
          this._note(P[this._ci(noteIdx + 2)], passVol * 0.22, t + 0.04);
        }
        // Pass 4 (peak): octave sparkle on the high note
        if (hasStar && n === 2) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.14, t + 0.30 + Math.random() * 0.15);
        }
        // Sleep pass: each note slightly lower than intended — drifting off
        if (isSleep && n >= 3) noteIdx = this._ci(noteIdx - 1);

        this._note(P[noteIdx], passVol * (0.55 + Math.random() * 0.45), t);

        // Rocking bass on every 3rd note (the downbeat of each 3/4 measure)
        if (hasBass && n % 3 === 0) {
          this._note(P[this._ci(root + bass[(pass + n) % bass.length])], passVol * 0.22, t + 0.05);
        }

        // Harmony third on upbeats during warm passes
        if (hasHarmony && n % 3 === 1 && Math.random() < 0.55) {
          this._note(P[this._ci(noteIdx + 2)], passVol * 0.18, t + 0.03);
        }

        const baseT = rhythm[n % rhythm.length];
        if (isSleep) sleepSlow += 0.12;
        t += baseT * (0.85 + Math.random() * 0.30) + sleepSlow;
      }

      // Breath between passes — the rocking pause
      t += pass === 4 ? 3.0 + Math.random() * 2.0 : 2.0 + Math.random() * 1.5;
    }

    // Final note — the baby is asleep, just the root, barely there
    t += 1.0;
    this._note(P[this._ci(root)], vol * 0.12, t);
      return t;
  }

  // ── 6. Free Wander — passacaglia: a walking motif that ventures out and returns ──
  //    Identity: the wanderer's step (0, 1, 3, 2, 4, 3, 1, 0) — always the same gait.

  freeWander() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const root = 5 + Math.floor(Math.random() * 3);
    // FIXED MOTIF — the wanderer's path (out and back)
    const motif = [0, 1, 3, 2, 4, 3, 1, 0];
    // Each section transposes the motif further from home
    const sectionShifts = [0, 2, 5, 3, 0]; // home → near → far → returning → home
    // Bass — home anchor
    const bass = [-4, -3, -5, -2];
    // Walking rhythm — steady with slight limp
    const rhythm = [1.2, 0.9, 1.1, 1.0, 1.3, 0.85, 1.0, 1.6];
    let t = 0;

    // 5 sections: home → wander near → far reaches → return → home again
    for (let sec = 0; sec < 5; sec++) {
      const shift = sectionShifts[sec];
      const secVol = [0.50, 0.70, 1.0, 0.75, 0.40][sec] * vol;
      const hasBass = sec >= 1 && sec <= 3;
      const isFar = sec === 2;
      const isHome = sec === 0 || sec === 4;

      // Home pedal at start of home sections
      if (isHome) {
        this._note(P[this._ci(root + bass[0])], secVol * 0.25, t);
      }
      if (hasBass) {
        this._note(P[this._ci(root + bass[sec % bass.length])], secVol * 0.22, t);
      }

      for (let n = 0; n < motif.length; n++) {
        let noteIdx = this._ci(root + motif[n] + shift);

        // Far reaches: wider leap on note 4 — the adventure moment
        if (isFar && n === 4) noteIdx = this._ci(noteIdx + 2);
        // Return home: notes gravitate lower — weariness
        if (sec === 3 && n >= 5) noteIdx = this._ci(noteIdx - 1);
        // Final home: the path is slightly different — you've changed
        if (sec === 4 && n === 3) noteIdx = this._ci(noteIdx + 1);

        this._note(P[noteIdx], secVol * (0.55 + Math.random() * 0.45), t);

        // Harmonic color on far reaches
        if (isFar && (n === 2 || n === 4) && Math.random() < 0.50) {
          this._note(P[this._ci(noteIdx + 2)], secVol * 0.20, t + 0.04);
        }

        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.80 + Math.random() * 0.40);
        // Occasional long pause to take in the view
        if (n === 4 && Math.random() < 0.30) t += 1.5 + Math.random() * 1.5;
      }

      t += 2.5 + Math.random() * 2.5;
    }

    // Arrival — root and fifth, home but different
    this._note(P[this._ci(root)], vol * 0.28, t);
    this._note(P[this._ci(root + 4)], vol * 0.16, t + 0.05);
      return t;
  }

  // ── 7. Ripple — passacaglia: symmetric expand/contract motif, like concentric circles ──
  //    Identity: the ripple shape — center, ±1, ±2, ±3 — always symmetric.

  ripple() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const root = 6 + Math.floor(Math.random() * 3);
    // FIXED MOTIF — the ripple: center out to edge and back (symmetric pairs)
    const motif = [0, 1, -1, 2, -2, 3, -3, 0]; // expand then return
    // Deep bass — the depth of the pond
    const bass = [-5, -4, -6, -3];
    // Rhythm — pairs close together, gaps between rings
    const rhythm = [1.0, 0.35, 0.45, 0.35, 0.50, 0.35, 0.55, 2.0];
    let t = 0;

    // 5 passes: stone drop → first ripple → second ripple → wide rings(peak) → stillness
    for (let pass = 0; pass < 5; pass++) {
      const passVol = [0.55, 0.65, 0.80, 1.0, 0.30][pass] * vol;
      const hasBass = pass >= 1 && pass <= 3;
      const isPeak = pass === 3;
      const isStill = pass === 4;

      // Stone drop: the center note, louder than the rest
      if (pass === 0) {
        this._note(P[this._ci(root)], passVol * 1.2, t);
        this._note(P[this._ci(root - 5)], passVol * 0.25, t + 0.08); // depth splash
        t += 1.5 + Math.random() * 0.8;
      }

      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.22, t);
      }

      // Each pass the ripple expands further — multiply the offsets
      const spread = 1 + pass * 0.3;
      const notesToPlay = isStill ? 4 : motif.length;

      for (let n = 0; n < notesToPlay; n++) {
        const offset = Math.round(motif[n] * spread);
        let noteIdx = this._ci(root + offset);

        // Peak: harmony on the widest ring notes
        if (isPeak && Math.abs(motif[n]) >= 2 && Math.random() < 0.50) {
          this._note(P[this._ci(noteIdx + 2)], passVol * 0.18, t + 0.06);
        }
        // Peak: center echo when returning to 0
        if (isPeak && motif[n] === 0 && n > 0) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.10, t + 0.12);
        }

        this._note(P[noteIdx], passVol * (0.50 + Math.random() * 0.50), t);

        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.80 + Math.random() * 0.40);
      }

      t += pass === 3 ? 3.5 + Math.random() * 2.0 : 2.0 + Math.random() * 1.5;
    }

    // Final center note — the pond is still again
    this._note(P[this._ci(root)], vol * 0.18, t);
      return t;
  }

  // ── 8. Music Box — passacaglia: mechanical pattern that winds up, plays, and winds down ──
  //    Identity: the stepwise ascending turn (0,1,2,3,2,1), like a cylinder's pins.

  musicBox() {
    const P = GameMusic.POOL;
    const vol = 0.008 + Math.random() * 0.003;
    const root = 7 + Math.floor(Math.random() * 4);
    // FIXED MOTIF — Music Box's cylinder pattern (stepwise, mechanical)
    const motifA = [0, 1, 3, 4, 3, 1];
    // B section — the cylinder's other side (inversion)
    const motifB = [0, -1, -2, -3, -2, 0];
    // Bass — simple pendulum
    const bass = [-4, -3, -5, -4];
    // Mechanical rhythm — very regular, slight swing
    const rhythm = [0.48, 0.42, 0.48, 0.55, 0.42, 0.52];
    let t = 0;

    // 7 passes: wind-up(slow) → A → A+bass → B → A+harmony(climax) → A(strip) → wind-down(slow)
    for (let pass = 0; pass < 7; pass++) {
      const isWindUp = pass === 0;
      const isWindDown = pass === 6;
      const isB = pass === 3;
      const isClimax = pass === 4;
      const isStrip = pass === 5;
      const motif = isB ? motifB : motifA;
      const passVol = [0.30, 0.55, 0.70, 0.65, 1.0, 0.45, 0.25][pass] * vol;
      const hasBass = pass >= 2 && pass <= 4;
      const hasHarmony = pass === 4;

      // Bass at pass start
      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.25, t);
      }

      // Wind-up/down: play fewer notes, slower
      const notesToPlay = (isWindUp || isWindDown) ? 4 : motif.length;
      const tempoMult = isWindUp ? 1.8 : isWindDown ? 2.2 : 1.0;
      // Wind-down decelerates per note
      let windSlowdown = 0;

      for (let n = 0; n < notesToPlay; n++) {
        let noteIdx = this._ci(root + motif[n % motif.length]);

        // Climax: octave doubling on the peak
        if (isClimax && n === 3) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.18, t + 0.03);
        }
        // Strip-back: last note shifts up — the box almost remembers wrong
        if (isStrip && n === motif.length - 1) noteIdx = this._ci(noteIdx + 1);

        this._note(P[noteIdx], passVol * (0.60 + Math.random() * 0.40), t);

        // Harmony on strong beats during climax
        if (hasHarmony && (n === 0 || n === 3) && Math.random() < 0.65) {
          this._note(P[this._ci(noteIdx + 2)], passVol * 0.22, t + 0.04);
        }

        const baseT = rhythm[n % rhythm.length] * tempoMult;
        if (isWindDown) windSlowdown += 0.08;
        t += baseT * (0.88 + Math.random() * 0.24) + windSlowdown;
      }

      // Short breath between mechanical cycles
      t += (isWindUp || isWindDown) ? 1.5 + Math.random() * 1.0 : 0.8 + Math.random() * 0.6;
    }

    // Final click — the box stops
    t += 0.5;
    this._note(P[this._ci(root + motifA[0])], vol * 0.12, t);
      return t;
  }

  // ── 9. Cascade — passacaglia: descending run motif with landing chords ──
  //    Identity: the waterfall shape — 7 rapid steps down, then a held landing.

  cascade() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const root = 12 + Math.floor(Math.random() * 3); // start high to fall
    // FIXED MOTIF — the cascade: rapid descent then landing
    const motif = [0, -1, -2, -3, -4, -5, -6, -7];
    // Landing notes — where each cascade pools (different each pass)
    const landings = [-7, -5, -8, -6, -9];
    // Bass — deep pools
    const bass = [-9, -8, -10, -7];
    // Rhythm — accelerates down the fall, slow on landing
    const rhythm = [0.22, 0.18, 0.15, 0.13, 0.12, 0.13, 0.15, 0.20];
    let t = 0;

    // 5 passes: trickle → stream → falls → torrent(peak) → calm pool
    for (let pass = 0; pass < 5; pass++) {
      const passVol = [0.40, 0.60, 0.80, 1.0, 0.35][pass] * vol;
      const hasBass = pass >= 1 && pass <= 3;
      const isTorrent = pass === 3;
      const isCalm = pass === 4;

      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.22, t);
      }

      // Each pass starts from a slightly different height
      const startShift = pass < 3 ? 0 : (pass === 3 ? 1 : -2);
      const notesToPlay = isCalm ? 5 : motif.length;

      for (let n = 0; n < notesToPlay; n++) {
        let noteIdx = this._ci(root + motif[n] + startShift);

        // Torrent: occasional splash note (random high sparkle)
        if (isTorrent && n === 3 && Math.random() < 0.50) {
          this._note(P[this._ci(noteIdx + 6)], passVol * 0.15, t + 0.05);
        }

        this._note(P[noteIdx], passVol * (0.45 + Math.random() * 0.55), t);

        const baseT = rhythm[n % rhythm.length];
        // Calm: everything slower
        const tempoMult = isCalm ? 2.5 : isTorrent ? 0.80 : 1.0;
        t += baseT * tempoMult * (0.85 + Math.random() * 0.30);
      }

      // Landing chord
      const landIdx = this._ci(root + landings[pass]);
      t += 0.10;
      this._note(P[landIdx], passVol * 0.80, t);
      if (Math.random() < 0.60) {
        this._note(P[this._ci(landIdx + 2)], passVol * 0.30, t + 0.04);
      }

      t += 2.5 + Math.random() * 2.5;
    }

    // Final: one last drop, the first note of the motif, echoing
    this._note(P[this._ci(root + motif[0])], vol * 0.15, t);
      return t;
  }

  // ── 10. Echo Reflection — passacaglia: call motif with tiered echoes at fixed intervals ──
  //    Identity: the echo shape — note, then 5th-up echo, then octave echo — always 3 tiers.

  echoReflection() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const root = 4 + Math.floor(Math.random() * 3);
    // FIXED MOTIF — the source sounds that create echoes
    const motif = [0, 2, 1, 3, 0, 4, 2, -1];
    // Echo intervals — always the same reflections
    const echoUp = [5, 10]; // 5th-up echo, octave echo
    const echoDelay = [0.32, 0.70]; // delay times
    const echoVol = [0.25, 0.09]; // volumes
    // Bass — the cave walls
    const bass = [-5, -4, -6, -3];
    // Rhythm — slow, reverberant
    const rhythm = [1.6, 1.3, 1.8, 1.2, 1.5, 1.4, 1.7, 2.2];
    let t = 0;

    // Cave opening tone
    this._note(P[this._ci(root + bass[0])], vol * 0.18, t);
    t += 1.5 + Math.random() * 1.0;

    // 5 passes: whisper → clear → +bass → full echoes(peak) → fading
    for (let pass = 0; pass < 5; pass++) {
      const passVol = [0.38, 0.55, 0.72, 1.0, 0.32][pass] * vol;
      const echoTiers = [1, 1, 2, 2, 1][pass]; // how many echo tiers are active
      const hasBass = pass >= 2 && pass <= 3;
      const isPeak = pass === 3;

      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.22, t);
      }

      const notesToPlay = pass === 4 ? 5 : motif.length;

      for (let n = 0; n < notesToPlay; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Peak: one note gets an extra alternative echo at a 4th
        if (isPeak && n === 3) {
          this._note(P[this._ci(noteIdx + 3)], passVol * 0.14, t + 0.48);
        }

        this._note(P[noteIdx], passVol * (0.55 + Math.random() * 0.45), t);

        // Fixed echo reflections — always the same intervals, always recognizable
        for (let e = 0; e < echoTiers; e++) {
          if (Math.random() < 0.75) { // slight randomness in whether echo appears
            this._note(P[this._ci(noteIdx + echoUp[e])],
              passVol * echoVol[e], t + echoDelay[e] * (0.85 + Math.random() * 0.30));
          }
        }

        // Bass shadow every 3rd note
        if (hasBass && n % 3 === 0) {
          this._note(P[this._ci(noteIdx - 5)], passVol * 0.12, t + 0.15);
        }

        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.82 + Math.random() * 0.36);
      }

      t += 2.5 + Math.random() * 2.0;
    }

    // Final merging chord — all echoes converge
    t += 1.0;
    this._note(P[this._ci(root - 5)], vol * 0.18, t);
    this._note(P[this._ci(root)], vol * 0.38, t + 0.02);
    this._note(P[this._ci(root + 2)], vol * 0.25, t + 0.05);
    this._note(P[this._ci(root + 4)], vol * 0.16, t + 0.08);
      return t;
  }

  // ── 11. Starlight — passacaglia: sparse high motif over deep void pedals ──
  //    Identity: the wide-leap twinkle shape (up 5, down 2, up 3), like Orion.

  starlight() {
    const P = GameMusic.POOL;
    const vol = 0.007 + Math.random() * 0.003;
    const root = 8 + Math.floor(Math.random() * 3); // high register
    // FIXED MOTIF — Starlight's constellation pattern (wide leaps)
    const motif = [0, 5, 3, 6, 2, 7, 4, 1];
    // Deep bass cycle — the void
    const bass = [-7, -6, -8, -5];
    // Very slow rhythm — vast spaces between stars
    const rhythm = [2.8, 2.2, 3.0, 1.8, 2.5, 3.2, 2.0, 3.8];
    let t = 0;

    // Opening void — deep pedal before any stars
    this._note(P[this._ci(root + bass[0])], vol * 0.20, t);
    t += 3.5 + Math.random() * 2.0;

    // 6 passes: appearing → brightening → constellation → full sky → clouds → last star
    for (let pass = 0; pass < 6; pass++) {
      const passVol = [0.35, 0.50, 0.70, 1.0, 0.55, 0.25][pass] * vol;
      const hasBass = pass >= 1 && pass <= 4;
      const hasTwinkle = pass >= 2 && pass <= 4;
      const isFullSky = pass === 3;
      const isLast = pass === 5;

      // Void bass at pass start
      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.30, t);
      }

      for (let n = 0; n < motif.length; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Pass 3 (full sky): peak note gets octave doubling
        if (isFullSky && (n === 3 || n === 5)) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.12, t + 0.08);
        }
        // Pass 4: constellation shifts — notes 2,4 move up one (the sky rotating)
        if (pass === 4 && (n === 2 || n === 4)) noteIdx = this._ci(noteIdx + 1);
        // Last pass: only play half the motif — stars fading
        if (isLast && n >= 5) break;

        this._note(P[noteIdx], passVol * (0.5 + Math.random() * 0.5), t);

        // Twinkle pair — quick neighbor note
        if (hasTwinkle && (n === 1 || n === 5) && Math.random() < 0.60) {
          const neighbor = this._ci(noteIdx + (Math.random() < 0.5 ? 1 : -1));
          this._note(P[neighbor], passVol * 0.30, t + 0.22 + Math.random() * 0.15);
        }

        // Shooting star on climax pass — rare ascending run
        if (isFullSky && n === 6 && Math.random() < 0.45) {
          for (let s = 0; s < 3; s++) {
            this._note(P[this._ci(noteIdx - 2 + s)], passVol * (0.18 - s * 0.04), t + 0.5 + s * 0.15);
          }
        }

        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.80 + Math.random() * 0.40);
      }

      // Deep bass between passes
      if (hasBass && pass < 5) {
        this._note(P[this._ci(root + bass[(pass + 1) % bass.length])], passVol * 0.22, t);
      }

      // Breath between passes — very long, the sky is patient
      t += pass === 3 ? 4.5 + Math.random() * 2.5 : 3.0 + Math.random() * 2.0;
    }

    // Final single note — the last star before dawn
    this._note(P[this._ci(root + motif[0])], vol * 0.15, t);
      return t;
  }

  // ── 12. Hymn — passacaglia: A-A-B-A with fixed chorale motif and Amen cadence ──
  //    Identity: the hymn melody (0,2,4,3,1,2,0) — a congregation's voice.

  hymn() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const root = 4 + Math.floor(Math.random() * 3);
    // FIXED MOTIF — Hymn's chorale melody
    const motifA = [0, 2, 4, 3, 1, 2, 0];
    // B section — a third higher, searching
    const motifB = [2, 4, 6, 5, 3, 4, 2];
    // Bass cycle — I-vi-IV-V (hymn-like)
    const bass = [-5, -3, -2, -4];
    // Stately rhythm — regular, dignified
    const rhythm = [1.1, 0.9, 1.0, 1.2, 0.9, 1.0, 1.5];
    let t = 0;

    // 5 sections: A → A+bass → B → A+harmony(climax) → A(quiet) → Amen
    for (let sec = 0; sec < 5; sec++) {
      const isB = sec === 2;
      const isClimax = sec === 3;
      const isQuiet = sec === 4;
      const motif = isB ? motifB : motifA;
      const secVol = [0.50, 0.65, 0.72, 1.0, 0.40][sec] * vol;
      const hasBass = sec >= 1 && sec <= 3;
      const hasHarmony = sec >= 3;

      // Bass at section start
      if (hasBass) {
        this._note(P[this._ci(root + bass[sec % bass.length])], secVol * 0.28, t);
      }

      for (let n = 0; n < motif.length; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Climax: octave doubling on the peak (note 2, which is the highest)
        if (isClimax && n === 2) {
          this._note(P[this._ci(noteIdx + 5)], secVol * 0.18, t + 0.04);
        }
        // Quiet: last note drifts down — the hymn settling
        if (isQuiet && n === motif.length - 1) noteIdx = this._ci(noteIdx - 1);

        this._note(P[noteIdx], secVol * (0.60 + Math.random() * 0.40), t);

        // Harmony third on strong beats
        if (hasHarmony && (n === 0 || n === 2 || n === 4) && Math.random() < 0.65) {
          this._note(P[this._ci(noteIdx + 2)], secVol * 0.25, t + 0.03);
        }

        // Bass on beat 1 and midpoint
        if (hasBass && (n === 0 || n === 3)) {
          this._note(P[this._ci(root + bass[(sec + n) % bass.length])], secVol * 0.20, t + 0.05);
        }

        t += rhythm[n] * (0.85 + Math.random() * 0.30);
      }

      // Breath between sections
      t += sec === 3 ? 3.0 + Math.random() * 2.0 : 2.0 + Math.random() * 1.5;
    }

    // "Amen" cadence — IV → I, always the same resolution
    t += 1.0;
    // IV chord
    this._note(P[this._ci(root - 4)], vol * 0.22, t);
    this._note(P[this._ci(root + 3)], vol * 0.50, t + 0.02);
    this._note(P[this._ci(root + 5)], vol * 0.32, t + 0.05);
    t += 1.8 + Math.random() * 0.8;
    // I chord
    this._note(P[this._ci(root - 5)], vol * 0.20, t);
    this._note(P[this._ci(root)], vol * 0.58, t + 0.02);
    this._note(P[this._ci(root + 2)], vol * 0.38, t + 0.05);
    this._note(P[this._ci(root + 4)], vol * 0.25, t + 0.08);
      return t;
  }

  // ── 13. Distant Rain — passacaglia: a rain pattern that builds, pours, and passes ──
  //    Identity: the drip-drip-drop shape (high, high, low) — always the same rain.

  distantRain() {
    const P = GameMusic.POOL;
    const vol = 0.007 + Math.random() * 0.003;
    const root = 10 + Math.floor(Math.random() * 3); // high register for drops
    // FIXED MOTIF — Rain's drip pattern (high sparse drops with puddle responses)
    const motif = [0, 2, -3, 1, 3, -2, 0, -4];
    // Deep sky bass — the cloud layer
    const bass = [-8, -7, -9, -6];
    // Rain rhythm — irregular but recognizable (the specific pattern of THIS rain)
    const rhythm = [1.8, 1.2, 2.5, 0.9, 1.5, 2.2, 1.6, 3.0];
    let t = 0;

    // Sky before rain — low hum
    this._note(P[this._ci(root + bass[0])], vol * 0.20, t);
    t += 3.0 + Math.random() * 2.0;

    // 6 passes: first drops → drizzle → rain → pour(climax) → easing → last drops
    for (let pass = 0; pass < 6; pass++) {
      const passVol = [0.28, 0.45, 0.65, 1.0, 0.50, 0.22][pass] * vol;
      const hasBass = pass >= 1 && pass <= 4;
      const isPour = pass === 3;
      const isLast = pass === 5;

      // Cloud bass
      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.25, t);
      }

      // Last drops: only play half the motif
      const notesToPlay = isLast ? 4 : motif.length;
      // Pour: faster rhythm
      const tempoMult = isPour ? 0.65 : isLast ? 1.4 : 1.0;

      for (let n = 0; n < notesToPlay; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Pass 2: the "puddle" notes (negative offsets) get a ripple echo
        if (pass === 2 && motif[n] < 0) {
          this._note(P[this._ci(noteIdx - 1)], passVol * 0.18, t + 0.20 + Math.random() * 0.10);
        }
        // Pour: every drop gets a double-hit echo (heavy rain)
        if (isPour && Math.random() < 0.55) {
          const echo = this._ci(noteIdx + (Math.random() < 0.5 ? 1 : -1));
          this._note(P[echo], passVol * 0.30, t + 0.10 + Math.random() * 0.08);
        }
        // Pour: higher notes shimmer (rain catching light)
        if (isPour && motif[n] >= 2) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.10, t + 0.06);
        }
        // Last drops: notes drift slightly flat — the rain losing energy
        if (isLast && n >= 2) noteIdx = this._ci(noteIdx - 1);

        this._note(P[noteIdx], passVol * (0.45 + Math.random() * 0.55), t);

        const baseT = rhythm[n % rhythm.length] * tempoMult;
        t += baseT * (0.80 + Math.random() * 0.40);
      }

      // Cloud bass between passes
      if (hasBass && pass < 5) {
        this._note(P[this._ci(root + bass[(pass + 1) % bass.length])], passVol * 0.18, t);
      }

      // Gap between rain waves
      t += isPour ? 2.0 + Math.random() * 1.5 : 3.0 + Math.random() * 2.5;
    }

    // After-rain silence... then one final drop
    t += 4.0 + Math.random() * 3.0;
    this._note(P[this._ci(root + motif[0])], vol * 0.10, t);
      return t;
  }

  // ── 14. Meadow Walk — passacaglia: wide-leap pastoral motif with birdsong ──
  //    Identity: the open-stride shape (0, 3, 1, 5, 2, 4, 0) — big steps, open sky.

  meadowWalk() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.003;
    const root = 3 + Math.floor(Math.random() * 3);
    // FIXED MOTIF — wide pastoral leaps (open fourths and fifths)
    const motif = [0, 3, 1, 5, 2, 4, 0, -1];
    // Birdsong motif — fixed high sparkle pattern (always the same bird)
    const bird = [14, 13, 15, 13];
    // Bass — the ground, wide open
    const bass = [-4, -3, -5, -2];
    // Walking rhythm — steady, unhurried
    const rhythm = [1.3, 1.0, 1.4, 0.9, 1.2, 1.1, 1.3, 1.8];
    let t = 0;

    // 5 passes: sunrise → walking → open field → hilltop(peak) → settling
    for (let pass = 0; pass < 5; pass++) {
      const passVol = [0.42, 0.60, 0.78, 1.0, 0.38][pass] * vol;
      const hasBass = pass >= 1 && pass <= 3;
      const hasBird = pass >= 2 && pass <= 3;
      const isPeak = pass === 3;

      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.22, t);
      }

      const notesToPlay = pass === 4 ? 5 : motif.length;

      for (let n = 0; n < notesToPlay; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Peak: the high note (index 3, offset +5) gets open-fifth harmony
        if (isPeak && n === 3) {
          this._note(P[this._ci(noteIdx + 4)], passVol * 0.20, t + 0.04);
        }
        // Settling: notes pulled down by gravity
        if (pass === 4 && n >= 3) noteIdx = this._ci(noteIdx - 1);

        this._note(P[noteIdx], passVol * (0.55 + Math.random() * 0.45), t);

        // Birdsong — always the same bird call, fixed intervals
        if (hasBird && n === 4 && Math.random() < 0.55) {
          for (let b = 0; b < bird.length; b++) {
            this._note(P[this._ci(bird[b])], passVol * 0.12, t + 0.5 + b * 0.15);
          }
        }

        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.82 + Math.random() * 0.36);
        // Occasional vista pause
        if (n === 3 && Math.random() < 0.25) t += 1.5 + Math.random() * 1.5;
      }

      t += 2.5 + Math.random() * 2.0;
    }

    // Hilltop chord — arrived, looking out
    t += 1.0;
    this._note(P[this._ci(root - 4)], vol * 0.16, t);
    this._note(P[this._ci(root)], vol * 0.30, t + 0.03);
    this._note(P[this._ci(root + 2)], vol * 0.22, t + 0.06);
    this._note(P[this._ci(root + 4)], vol * 0.15, t + 0.09);
      return t;
  }

  // ── 15. Frozen Lake — passacaglia: crystalline descending motif over deep ice drone ──
  //    Identity: the falling-fifth shape (high → drop → step → drop), like ice cracking.

  frozenLake() {
    const P = GameMusic.POOL;
    const vol = 0.007 + Math.random() * 0.003;
    const root = 10 + Math.floor(Math.random() * 3); // high crystalline register
    // FIXED MOTIF — Frozen Lake's identity: descending with a catch
    const motif = [0, -2, -1, -4, -3, -5, -2, -6];
    // Deep ice bass — very low, barely there
    const bass = [-9, -8, -10, -7];
    // Rhythm — slow with one quick "crack" pair
    const rhythm = [3.2, 1.5, 2.8, 1.2, 2.5, 3.5, 1.8, 4.0];
    let t = 0;

    // Opening ice groan — deep resonance
    this._note(P[this._ci(root + bass[0])], vol * 0.22, t);
    this._note(P[this._ci(root + bass[1])], vol * 0.14, t + 1.2);
    t += 4.0 + Math.random() * 2.0;

    // 5 passes: silence → crystal → reflection → resonance(climax) → settling
    for (let pass = 0; pass < 5; pass++) {
      const passVol = [0.30, 0.50, 0.70, 1.0, 0.30][pass] * vol;
      const hasBass = pass >= 1 && pass <= 3;
      const hasRing = pass >= 2 && pass <= 3;
      const isClimax = pass === 3;
      const isSettling = pass === 4;

      // Ice bass drone
      if (hasBass) {
        this._note(P[this._ci(root + bass[pass % bass.length])], passVol * 0.28, t);
      }

      const notesToPlay = isSettling ? 5 : motif.length;
      for (let n = 0; n < notesToPlay; n++) {
        let noteIdx = this._ci(root + motif[n]);

        // Pass 2 (reflection): mirror the descent — some notes go UP instead
        if (pass === 2 && (n === 2 || n === 4)) noteIdx = this._ci(root + Math.abs(motif[n]));
        // Pass 3 (climax): octave doubling on the deep notes
        if (isClimax && motif[n] <= -4) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.15, t + 0.06);
        }
        // Pass 4 (settling): all notes one step higher — the ice refreezing differently
        if (isSettling) noteIdx = this._ci(noteIdx + 1);

        this._note(P[noteIdx], passVol * (0.50 + Math.random() * 0.50), t);

        // Ice ring — harmonic overtone on some notes
        if (hasRing && (n === 0 || n === 3 || n === 7) && Math.random() < 0.55) {
          this._note(P[this._ci(noteIdx + 5)], passVol * 0.12, t + 0.08);
        }

        // Crack pair — quick descending double on the short-rhythm notes
        if (rhythm[n % rhythm.length] < 1.5 && Math.random() < 0.40) {
          this._note(P[this._ci(noteIdx - 1)], passVol * 0.25, t + 0.10);
        }

        const baseT = rhythm[n % rhythm.length];
        t += baseT * (0.80 + Math.random() * 0.40);
      }

      // Deep ice groan between passes
      if (hasBass) {
        this._note(P[this._ci(root + bass[(pass + 2) % bass.length])], passVol * 0.18, t);
      }

      // Long silence — the lake is vast and still
      t += pass === 3 ? 5.0 + Math.random() * 3.0 : 4.0 + Math.random() * 2.5;
    }

    // Final: the very first note, alone, an octave lower — the lake remembers
    this._note(P[this._ci(root + motif[0] - 5)], vol * 0.15, t);
      return t;
  }

  // ═══════════════════════════════════════════════════════════
  //  NOTE RENDERER — delicate piano-like tone
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  //  DARK COMPOSITIONS — Grandmapocalypse soundtrack
  // ═══════════════════════════════════════════════════════════

  // ── Dark note renderer — gritty, overdriven, metallic with pitch-drop envelope ──
  _darkNote(freq, volume = 0.012, delay = 0) {
    const ctx = this._ctx;
    const out = this._out;
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const dur = 2.5 + Math.random() * 3.5;                    // longer sustain for more weight
    // Track when this note's audio actually ends
    const noteEnd = delay + dur + 1.5;
    if (noteEnd > this._maxNoteEnd) this._maxNoteEnd = noteEnd;

    const tail = dur * 0.35 + 1.0;                            // stop padding

    // Pitch-drop at attack — metal/industrial character (string hitting the fret)
    const pitchDrop = 1.018 + Math.random() * 0.022;

    // ── Sawtooth fundamental — harsh, overdriven ──
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * pitchDrop, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.05);

    // Slow pitch vibrato — unease
    const vib = ctx.createOscillator();
    vib.frequency.value = 3.5 + Math.random() * 2.5;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(freq * 0.008, t + dur * 0.3);
    vibG.gain.setTargetAtTime(freq * 0.015, t + dur * 0.3, dur * 0.3);
    vib.connect(vibG).connect(osc.frequency);
    vib.start(t); vib.stop(t + dur + tail);

    // ── Asymmetric waveshaper — warm even harmonics + grit ──
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const x = (i / 256) - 1;
      curve[i] = Math.tanh(x * 3.2) + 0.08 * Math.sin(x * Math.PI * 2.5);
    }
    ws.curve = curve;
    ws.oversample = '4x';

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(volume, t, 0.005);                  // ~5ms smooth rise
    g.gain.setTargetAtTime(volume * 0.48, t + 0.12, 0.6);
    g.gain.setTargetAtTime(volume * 0.15, t + dur * 0.45, dur * 0.22);
    g.gain.setTargetAtTime(0, t + dur * 0.75, dur * 0.16);

    // ── Resonant low-pass — sweeps down with resonance peak ──
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 6, t);
    lp.frequency.setTargetAtTime(freq * 1.8, t + 0.06, dur * 0.22);
    lp.frequency.setTargetAtTime(freq * 0.8, t + dur * 0.5, dur * 0.3);
    lp.Q.setValueAtTime(2.5, t);
    lp.Q.setTargetAtTime(0.8, t + dur * 0.3, dur * 0.2);

    osc.connect(ws).connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + tail);

    // ── Detuned unison — chorus thickness ──
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.007, t);
    osc2.frequency.exponentialRampToValueAtTime(freq * 1.002, t + 0.05);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.setTargetAtTime(volume * 0.45, t, 0.008);
    g2.gain.setTargetAtTime(volume * 0.15, t + dur * 0.35, dur * 0.18);
    g2.gain.setTargetAtTime(0, t + dur * 0.65, dur * 0.16);
    osc2.connect(ws).connect(lp);
    osc2.connect(g2).connect(out);
    osc2.start(t);
    osc2.stop(t + dur + tail);

    // ── Flat-side detuned voice — wider, more ominous ──
    const osc3 = ctx.createOscillator();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(freq * 0.994, t);
    osc3.frequency.exponentialRampToValueAtTime(freq * 0.998, t + 0.06);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0, t);
    g3.gain.setTargetAtTime(volume * 0.30, t, 0.010);
    g3.gain.setTargetAtTime(0, t + dur * 0.40, dur * 0.18);
    osc3.connect(ws).connect(lp);
    osc3.connect(g3).connect(out);
    osc3.start(t);
    osc3.stop(t + dur + tail);

    // ── Noise burst at attack — percussive grit ──
    const noiseDur = 0.06 + Math.random() * 0.04;
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseDur), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = noiseBuf;
    const nFilt = ctx.createBiquadFilter();
    nFilt.type = 'bandpass'; nFilt.frequency.value = freq * 2.5; nFilt.Q.value = 2.0;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0, t);
    nGain.gain.setTargetAtTime(volume * 0.30, t, 0.001);       // fast but smooth
    nGain.gain.setTargetAtTime(0, t + 0.005, noiseDur * 0.3);
    nSrc.connect(nFilt).connect(nGain).connect(out);
    nSrc.start(t); nSrc.stop(t + noiseDur + 0.05);

    // ── Sub-octave sine — physical low-end weight ──
    if (freq < 350) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq * 0.5, t);
      const gs = ctx.createGain();
      gs.gain.setValueAtTime(0, t);
      gs.gain.setTargetAtTime(volume * 0.32, t, 0.010);
      gs.gain.setTargetAtTime(volume * 0.12, t + dur * 0.25, dur * 0.18);
      gs.gain.setTargetAtTime(0, t + dur * 0.50, dur * 0.18);
      sub.connect(gs).connect(out);
      sub.start(t); sub.stop(t + dur + tail);
    }

    // ── Overtone shimmer — high harmonic that fades in late ──
    if (freq < 500 && Math.random() < 0.6) {
      const ot = ctx.createOscillator();
      ot.type = 'sine';
      ot.frequency.setValueAtTime(freq * 5.01, t);
      const go = ctx.createGain();
      go.gain.setValueAtTime(0, t);
      go.gain.setTargetAtTime(volume * 0.04, t + dur * 0.2, dur * 0.15);
      go.gain.setTargetAtTime(0, t + dur * 0.5, dur * 0.13);
      ot.connect(go).connect(out);
      ot.start(t); ot.stop(t + dur * 0.7 + tail);
    }
  }

  // ── 1. Dark Drone — passacaglia: fixed cluster that builds and wobbles ──
  //    Identity: root → minor3rd → 5th → flat7 — always the same dread chord, always recognized.
  darkDrone() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const root = P[Math.floor(Math.random() * 5)];
    // FIXED CHORD — Dark Drone's identity (semitone intervals from root)
    const chord = [0, 3, 7, 10, 13]; // root, min3, 5th, flat7, min9
    // Drift pattern — fixed detuning amounts
    const drifts = [1.003, 0.997, 1.005, 0.994];
    let t = 0;

    // 3 passes: emergence → full dread → decay
    for (let pass = 0; pass < 3; pass++) {
      const passVol = [0.55, 1.0, 0.40][pass] * vol;
      const chordNotes = pass === 0 ? 3 : pass === 1 ? chord.length : 2;

      // Sub foundation
      this._darkNote(root * 0.5, passVol * 0.42, t);

      for (let c = 0; c < chordNotes; c++) {
        const hz = root * Math.pow(2, chord[c] / 12);
        this._darkNote(hz, passVol * (0.65 - c * 0.08), t + 0.1 + c * 0.5);

        // Fixed drift on full pass — always the same wobble
        if (pass === 1 && c < drifts.length) {
          this._darkNote(hz * drifts[c], passVol * 0.30, t + 1.5 + c * 0.6);
        }
      }

      // High feedback on full pass
      if (pass === 1) {
        this._darkNote(root * 4, passVol * 0.07, t + 1.2);
        this._darkNote(root * 4.03, passVol * 0.04, t + 2.0);
      }

      t += 8.0 + Math.random() * 4.0;
    }
      return t;
  }

  // ── 2. Tense Pulse — passacaglia: fixed rhythm pattern with pitch cycle ──
  //    Identity: the pulse pattern [1,0,0,1,0,1] — always the same heartbeat of dread.
  tensePulse() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.011 + Math.random() * 0.004;
    const root = P[3 + Math.floor(Math.random() * 6)];
    // FIXED PITCH CYCLE — the notes that rotate through the rhythm
    const pitchCycle = [1.0, 1.0, 1.498, 1.0, 1.189, 1.0]; // root, root, 5th, root, min3, root
    // FIXED RHYTHM — the pulse identity
    const rhythmPat = [1,0,0,1,0,1,0,0,1,0,1,1];
    const interval = 0.16;
    let t = 0;

    this._darkNote(root * 0.5, vol * 0.25, 0);

    // 4 passes: sparse → building → full → breakdown → crash
    for (let pass = 0; pass < 4; pass++) {
      const passVol = [0.45, 0.72, 1.0, 0.50][pass] * vol;
      // Later passes play the pattern 2x
      const reps = pass <= 1 ? 1 : 2;

      for (let rep = 0; rep < reps; rep++) {
        let pitchIdx = 0;
        for (let i = 0; i < rhythmPat.length; i++) {
          if (rhythmPat[i]) {
            const accent = i % 4 === 0;
            const hz = root * pitchCycle[pitchIdx % pitchCycle.length];
            // Tritone intrusion on pass 2+
            const finalHz = (pass >= 2 && pitchIdx === 4) ? root * Math.pow(2, 6/12) : hz;
            this._darkNote(finalHz, passVol * (accent ? 0.85 : 0.48), t);
            pitchIdx++;
          }
          t += interval;
        }
      }

      this._darkNote(root * 0.5, passVol * 0.20, t);
      t += 0.8 + Math.random() * 0.5;
    }

    // Crash
    this._darkNote(root * 0.25, vol * 0.50, t);
    this._darkNote(root * 0.5, vol * 0.90, t + 0.03);
    this._darkNote(root, vol * 0.65, t + 0.06);
      return t;
  }

  // ── 3. Haunted Arpeggio — passacaglia: fixed arpeggio that decays more each pass ──
  //    Identity: the arpeggio shape [0,3,5,7,10,12] — always the same dark chord, increasingly wrong.
  hauntedArpeggio() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const root = P[6 + Math.floor(Math.random() * 6)];
    // FIXED ARPEGGIO — the haunted chord (semitones)
    const arp = [0, 3, 5, 7, 10, 12];
    // Chromatic slide — always the same 3-note descent between passes
    const slide = [12, 11, 10];
    let t = 0;

    this._darkNote(root * 0.5, vol * 0.28, 0);

    // 5 passes: clean → slight wrong → more wrong → very wrong → disintegrated
    for (let pass = 0; pass < 5; pass++) {
      const passVol = [0.50, 0.65, 0.80, 1.0, 0.45][pass] * vol;
      const order = pass % 2 === 0 ? arp : [...arp].reverse();
      const wrongChance = pass * 0.10; // 0%, 10%, 20%, 30%, 40%
      const speed = 0.32 - pass * 0.025;

      for (const semi of order) {
        let hz = root * Math.pow(2, semi / 12);
        // Fixed wrong-note rule: if wrong, always shift by +1 semitone (deterministic)
        if (Math.random() < wrongChance) hz *= Math.pow(2, 1 / 12);
        this._darkNote(hz, passVol * (0.40 + Math.random() * 0.40), t);

        // Ghost echo on passes 2+
        if (pass >= 2 && Math.random() < 0.30) {
          this._darkNote(hz * 1.003, passVol * 0.15, t + 0.20);
        }
        t += Math.max(0.15, speed + Math.random() * 0.15);
      }

      // Fixed chromatic slide between passes
      if (pass < 4) {
        for (const semi of slide) {
          this._darkNote(root * Math.pow(2, semi / 12), vol * 0.22, t);
          t += 0.14;
        }
      }

      if (pass % 2 === 0) this._darkNote(root * 0.5, passVol * 0.18, t);
      t += 1.2 + Math.random() * 1.0;
    }

    // Unresolved ending — root + min3 + tritone ghost
    this._darkNote(root, vol * 0.70, t);
    this._darkNote(root * 1.189, vol * 0.42, t + 0.12);
    this._darkNote(root * Math.pow(2, 6 / 12), vol * 0.15, t + 0.8);
      return t;
  }

  // ── 4. Doom Riff — passacaglia: fixed E-G-A-E power chord progression ──
  //    Identity: the riff [E,G,A,E] — always the same doom, building heavier each pass.
  doomRiff() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.012 + Math.random() * 0.003;
    const E = P[Math.floor(Math.random() * 3)]; // random low root
    // FIXED RIFF — the doom progression (semitone intervals from root)
    const riff = [0, 3, 5, 0]; // root, min3rd, 4th, root
    // FIXED walk notes between chords
    const walks = [1, 2, -2, 0]; // semitone passing tones
    const timing = 0.60;
    let t = 0;

    this._darkNote(E * 0.5, vol * 0.50, 0);

    // 4 passes: bare → power chords → +walks+breakdown → heavy(climax)
    for (let pass = 0; pass < 4; pass++) {
      const passVol = [0.60, 0.78, 0.85, 1.0][pass] * vol;
      const hasFifth = pass >= 1;
      const hasOctave = pass >= 3;
      const hasWalk = pass >= 2;

      for (let i = 0; i < riff.length; i++) {
        const hz = E * Math.pow(2, riff[i] / 12);
        this._darkNote(hz, passVol, t);
        if (hasFifth) this._darkNote(hz * 1.498, passVol * 0.52, t + 0.02);
        if (hasOctave) this._darkNote(hz * 2, passVol * 0.28, t + 0.035);

        // Fixed walk between chords
        if (hasWalk && i < riff.length - 1) {
          const walkHz = hz * Math.pow(2, walks[i] / 12);
          this._darkNote(walkHz, passVol * 0.28, t + timing * 0.62);
        }

        t += timing * (0.90 + Math.random() * 0.20);
      }

      // Riff sustain
      this._darkNote(E, passVol * 0.75, t);
      this._darkNote(E * 1.498, passVol * 0.48, t + 0.03);
      t += 1.5 + Math.random() * 0.8;

      // Breakdown on pass 2
      if (pass === 2) {
        for (let b = 0; b < 4; b++) {
          this._darkNote(E, vol * 0.52, t);
          t += 0.55 + Math.random() * 0.25;
        }
        t += 0.5;
      }
    }

    // Final layered crash
    this._darkNote(E * 0.25, vol * 0.40, t);
    this._darkNote(E * 0.5, vol * 0.78, t + 0.03);
    this._darkNote(E, vol * 0.90, t + 0.06);
      return t;
  }

  // ── 5. Witch Bells — passacaglia: fixed bell frequencies in call-and-answer pattern ──
  //    Identity: the 3 bell pitches [200, 680, 420] — always the same bells, different resonance.
  witchBells() {
    const ctx = this._ctx;
    const vol = 0.007 + Math.random() * 0.003;
    // FIXED BELL FREQUENCIES — always the same bells (transposed slightly by random offset)
    const offset = 0.9 + Math.random() * 0.2; // ±10% pitch shift
    const bells = [
      { freq: 200 * offset, modRatio: 1.414, dur: 2.2 }, // low toll
      { freq: 680 * offset, modRatio: 2.756, dur: 1.8 }, // high answer
      { freq: 420 * offset, modRatio: 1.618, dur: 2.5 }, // middle (golden ratio)
    ];
    // FIXED SEQUENCE — always toll in this order
    const sequence = [0, 1, 2, 0, 2, 1, 0, 1, 2, 2, 0, 1, 0];
    // Fixed rhythm
    const rhythm = [1.5, 0.8, 1.2, 1.8, 0.9, 1.0, 2.0, 0.7, 1.1, 0.6, 1.5, 0.8, 2.2];
    let t = 0;

    for (let i = 0; i < sequence.length; i++) {
      const bell = bells[sequence[i]];
      const dur = bell.dur + Math.random() * 0.5;
      const ct = ctx.currentTime + t;
      // Volume arc across the sequence
      const arc = Math.sin(Math.PI * i / sequence.length);
      const bellVol = vol * (0.50 + arc * 0.50);

      const mod = ctx.createOscillator();
      mod.frequency.setValueAtTime(bell.freq * bell.modRatio, ct);
      mod.frequency.linearRampToValueAtTime(bell.freq * bell.modRatio * 0.82, ct + dur);
      const modG = ctx.createGain();
      modG.gain.setValueAtTime(bell.freq * 3.5, ct);
      modG.gain.exponentialRampToValueAtTime(1, ct + dur);
      mod.connect(modG);
      const car = ctx.createOscillator();
      car.type = 'sine';
      car.frequency.setValueAtTime(bell.freq, ct);
      modG.connect(car.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(bellVol, ct + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
      car.connect(g).connect(this._out);
      mod.start(ct); car.start(ct);
      mod.stop(ct + dur + 0.1); car.stop(ct + dur + 0.1);

      // Sympathetic resonance on every other toll
      if (i % 2 === 0 && Math.random() < 0.45) {
        const sympFreq = bell.freq * 1.498;
        const sympDur = dur * 0.5;
        const sympT = ct + 0.18;
        const sympCar = ctx.createOscillator();
        sympCar.type = 'sine';
        sympCar.frequency.setValueAtTime(sympFreq, sympT);
        const sympG = ctx.createGain();
        sympG.gain.setValueAtTime(0.001, sympT);
        sympG.gain.linearRampToValueAtTime(bellVol * 0.20, sympT + 0.008);
        sympG.gain.exponentialRampToValueAtTime(0.001, sympT + sympDur);
        sympCar.connect(sympG).connect(this._out);
        sympCar.start(sympT); sympCar.stop(sympT + sympDur + 0.1);
      }

      t += rhythm[i] * (0.85 + Math.random() * 0.30);
    }
      return t;
  }

  // ── 6. Void Echo — passacaglia: fixed source notes with tiered detuned echoes ──
  //    Identity: the echo shape — source, then 3 fixed detuned reflections — always the same void.
  voidEcho() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.008 + Math.random() * 0.003;
    const root = P[8 + Math.floor(Math.random() * 4)];
    // FIXED MOTIF — the source notes (semitones from root)
    const motif = [0, 5, -3, 7, 2, -5, 3, 0];
    // Fixed echo detunings
    const echoes = [
      { detune: 1.001, vol: 0.28, delay: 0.38 },
      { detune: 0.999, vol: 0.13, delay: 0.82 },
      { detune: 1.002, vol: 0.06, delay: 1.35 },
    ];
    // Slow rhythm — vast cave
    const rhythm = [3.5, 2.8, 3.8, 2.5, 3.2, 4.0, 2.8, 4.5];
    let t = 0;

    // Drone foundation
    this._darkNote(root * 0.25, vol * 0.18, 0);

    // 4 passes: whisper → echoes → full void → fading
    for (let pass = 0; pass < 4; pass++) {
      const passVol = [0.40, 0.65, 1.0, 0.35][pass] * vol;
      const echoCount = [1, 2, 3, 1][pass];
      const notesToPlay = pass === 3 ? 5 : motif.length;

      for (let n = 0; n < notesToPlay; n++) {
        const hz = root * Math.pow(2, motif[n] / 12);
        this._darkNote(hz, passVol * (0.60 + Math.random() * 0.40), t);

        for (let e = 0; e < echoCount; e++) {
          this._darkNote(hz * echoes[e].detune, passVol * echoes[e].vol,
            t + echoes[e].delay * (0.90 + Math.random() * 0.20));
        }

        // Tritone ghost on full pass
        if (pass === 2 && (n === 2 || n === 5) && Math.random() < 0.40) {
          this._darkNote(hz * Math.pow(2, 6 / 12), passVol * 0.10, t + 0.55);
        }

        t += rhythm[n % rhythm.length] * (0.82 + Math.random() * 0.36);
      }

      this._darkNote(root * 0.25, passVol * 0.12, t);
      t += 3.0 + Math.random() * 2.0;
    }

    this._darkNote(root * 0.25, vol * 0.12, t);
      return t;
  }

  // ── 7. Grind Motor — passacaglia: fixed 4-note grind cycle with phases ──
  //    Identity: the grind cycle [root, min3, 5th, flat7] — always the same machine.
  grindMotor() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.003;
    const root = P[Math.floor(Math.random() * 4)];
    // FIXED GRIND CYCLE — the machine's rhythm (ratio from root)
    const cycle = [1.0, 1.189, 1.498, 1.782]; // root, min3, 5th, flat7
    const tempo = 0.14;
    let t = 0;

    // 4 phases: grind → half-time → breakdown → accelerate → crash
    // Phase 1: grind (3 reps of the cycle)
    for (let rep = 0; rep < 3; rep++) {
      for (let c = 0; c < cycle.length; c++) {
        const accent = c === 0;
        this._darkNote(root * cycle[c], vol * (accent ? 0.85 : 0.42), t);
        t += tempo;
      }
    }
    // Phase 2: half-time (cycle at 2x tempo)
    t += 0.2;
    for (let c = 0; c < cycle.length * 2; c++) {
      const hz = root * cycle[c % cycle.length];
      const accent = c % 2 === 0;
      this._darkNote(hz, vol * (accent ? 0.80 : 0.45), t);
      if (accent) this._darkNote(hz * 0.5, vol * 0.28, t + 0.02);
      t += tempo * 2.2;
    }
    // Phase 3: breakdown (just root, sparse)
    t += 0.3;
    for (let i = 0; i < 4; i++) {
      this._darkNote(root, vol * 0.50, t);
      t += 0.55;
    }
    this._darkNote(root * Math.pow(2, 6/12), vol * 0.30, t); // tritone stab
    t += 0.5;
    // Phase 4: accelerate (cycle getting faster)
    let accelTempo = tempo * 1.6;
    for (let rep = 0; rep < 3; rep++) {
      for (let c = 0; c < cycle.length; c++) {
        this._darkNote(root * cycle[c], vol * (c === 0 ? 0.90 : 0.48), t);
        t += accelTempo;
      }
      accelTempo = Math.max(tempo * 0.8, accelTempo * 0.85);
    }
    // Crash
    this._darkNote(root * 0.25, vol * 0.35, t);
    this._darkNote(root * 0.5, vol * 0.75, t + 0.02);
    this._darkNote(root, vol * 0.55, t + 0.04);
      return t;
  }

  // ── 8. Elder Chant — passacaglia: fixed syllable sequence with formant synthesis ──
  //    Identity: the chant sequence [ah,oh,oo,ay,ah,oh,oo] — always the same prayer.
  eldrChant() {
    const ctx = this._ctx;
    const vol = 0.010 + Math.random() * 0.004;
    const vowels = [
      { f1: 830,  f2: 1170, f3: 2500 },  // "ah"
      { f1: 430,  f2: 980,  f3: 2500 },  // "oh"
      { f1: 330,  f2: 1260, f3: 2500 },  // "oo"
      { f1: 660,  f2: 1700, f3: 2500 },  // "ay"
    ];
    // FIXED CHANT SEQUENCE — vowel indices and relative fundamentals
    const chantVowels = [0, 1, 2, 3, 0, 1, 2, 0]; // ah, oh, oo, ay, ah, oh, oo, ah
    const chantPitches = [0, 0, -2, 3, 0, 2, -2, 5]; // semitones from base
    const baseFund = 58 + Math.floor(Math.random() * 3) * 7; // 58, 65, or 72
    let t = 0;

    // Drone
    const droneDur = chantVowels.length * 4.0;
    const droneCt = ctx.currentTime;
    const droneSrc = ctx.createOscillator();
    droneSrc.type = 'sawtooth';
    droneSrc.frequency.setValueAtTime(baseFund * 0.5, droneCt);
    const droneBp = ctx.createBiquadFilter();
    droneBp.type = 'bandpass'; droneBp.frequency.value = 330; droneBp.Q.value = 6;
    const droneG = ctx.createGain();
    droneG.gain.setValueAtTime(0.001, droneCt);
    droneG.gain.linearRampToValueAtTime(vol * 0.12, droneCt + 1.0);
    droneG.gain.setValueAtTime(vol * 0.12, droneCt + droneDur - 1.0);
    droneG.gain.exponentialRampToValueAtTime(0.001, droneCt + droneDur);
    droneSrc.connect(droneBp).connect(droneG).connect(this._out);
    droneSrc.start(droneCt); droneSrc.stop(droneCt + droneDur + 0.1);

    // Two passes: quiet chant → full chant with choir
    for (let pass = 0; pass < 2; pass++) {
      const passVol = pass === 0 ? vol * 0.55 : vol;
      const hasChoir = pass === 1;

      for (let i = 0; i < chantVowels.length; i++) {
        const fund = baseFund * Math.pow(2, chantPitches[i] / 12);
        const vIdx = chantVowels[i];
        const vowel = vowels[vIdx];
        const nextVowel = vowels[(vIdx + 1) % vowels.length];
        const dur = 2.2 + Math.random() * 1.5;
        const ct = ctx.currentTime + t;

        const src = ctx.createOscillator();
        src.type = 'sawtooth';
        src.frequency.setValueAtTime(fund, ct);
        const vib = ctx.createOscillator();
        vib.frequency.value = 4.5;
        const vibG = ctx.createGain();
        vibG.gain.value = fund * 0.018;
        vib.connect(vibG).connect(src.frequency);
        vib.start(ct); vib.stop(ct + dur + 0.1);

        // Choir voice on second pass
        if (hasChoir && Math.random() < 0.65) {
          const src2 = ctx.createOscillator();
          src2.type = 'sawtooth';
          src2.frequency.setValueAtTime(fund * 1.003, ct + 0.09);
          const bp2 = ctx.createBiquadFilter();
          bp2.type = 'bandpass'; bp2.frequency.value = vowel.f1; bp2.Q.value = 10;
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.001, ct + 0.09);
          g2.gain.linearRampToValueAtTime(passVol * 0.20, ct + 0.30);
          g2.gain.exponentialRampToValueAtTime(0.001, ct + dur);
          src2.connect(bp2).connect(g2).connect(this._out);
          src2.start(ct + 0.09); src2.stop(ct + dur + 0.1);
        }

        // Formant filters
        for (const [fStart, fEnd] of [[vowel.f1, nextVowel.f1], [vowel.f2, nextVowel.f2]]) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(fStart, ct);
          bp.frequency.linearRampToValueAtTime(fEnd, ct + dur * 0.8);
          bp.Q.value = 12;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, ct);
          g.gain.linearRampToValueAtTime(passVol * 0.45, ct + 0.20);
          g.gain.setValueAtTime(passVol * 0.45, ct + dur * 0.60);
          g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
          src.connect(bp).connect(g).connect(this._out);
        }
        src.start(ct); src.stop(ct + dur + 0.1);

        t += dur + 0.5 + Math.random() * 1.0;
      }
      t += 2.0 + Math.random() * 1.5;
    }

    // Final rising syllable — unresolved
    const ct = ctx.currentTime + t;
    const dur = 2.5;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(baseFund, ct);
    src.frequency.linearRampToValueAtTime(baseFund * 1.15, ct + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 830; bp.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, ct);
    g.gain.linearRampToValueAtTime(vol * 0.42, ct + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
    src.connect(bp).connect(g).connect(this._out);
    src.start(ct); src.stop(ct + dur + 0.1);
      return t;
  }

  // ── 9. Blood Moon — passacaglia: fixed tritone-root alternation ──
  //    Identity: root→tritone→minor2nd — always the devil's interval, always recognized.
  bloodMoon() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const root = P[6 + Math.floor(Math.random() * 6)];
    // FIXED MOTIF — the ritual (semitones from root)
    const motif = [0, 6, 1, 0, 6, 1, 0, 6]; // root, tritone, min2nd — repeating
    // Fixed rhythm — ritualistic
    const rhythm = [0.35, 0.45, 0.28, 0.40, 0.42, 0.30, 0.38, 0.50];
    let t = 0;

    this._darkNote(root * 0.5, vol * 0.25, 0);

    // 4 passes: whisper ritual → building → full dread → ritual ending
    for (let pass = 0; pass < 4; pass++) {
      const passVol = [0.48, 0.70, 1.0, 0.60][pass] * vol;

      for (let n = 0; n < motif.length; n++) {
        const hz = root * Math.pow(2, motif[n] / 12);
        this._darkNote(hz, passVol * (0.55 + Math.random() * 0.45), t);

        // Octave echo on full pass
        if (pass === 2 && motif[n] === 6) {
          this._darkNote(hz * 2, passVol * 0.25, t + 0.06);
        }
        // Ascending chromatic on later passes
        if (pass >= 2 && n === 6 && Math.random() < 0.45) {
          for (let s = 1; s <= 3; s++) {
            this._darkNote(root * Math.pow(2, s / 12), passVol * 0.20, t + 0.15 * s);
          }
        }

        t += rhythm[n] * (0.85 + Math.random() * 0.30);
      }

      if (pass % 2 === 0) this._darkNote(root * 0.25, passVol * 0.20, t);
      t += 1.5 + Math.random() * 1.2;
    }

    // Ritual ending — stacked root + tritone
    this._darkNote(root * 0.5, vol * 0.45, t);
    this._darkNote(root, vol * 0.70, t + 0.03);
    this._darkNote(root * Math.pow(2, 6 / 12), vol * 0.55, t + 0.06);
      return t;
  }

  // ── 10. Chaos Cluster — passacaglia: fixed burst centers with escalating density ──
  //    Identity: the 4 burst centers [8,12,10,14] — always the same explosions.
  chaosCluster() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.008 + Math.random() * 0.003;
    // FIXED BURST CENTERS — always explode at the same pitches
    const centers = [8, 12, 10, 14];
    // Fixed offsets within each burst — the shrapnel pattern
    const shrapnel = [-2, 1, -3, 2, -1, 3, 0];
    let t = 0;

    for (let b = 0; b < centers.length; b++) {
      const centerIdx = Math.min(P.length - 1, centers[b]);
      const burstVol = vol * (0.65 + b * 0.10);
      // Each burst plays more of the shrapnel pattern
      const notesInBurst = 3 + b * 1;

      for (let i = 0; i < notesInBurst; i++) {
        const idx = Math.max(0, Math.min(P.length - 1, centerIdx + shrapnel[i % shrapnel.length]));
        this._darkNote(P[idx], burstVol * (0.35 + Math.random() * 0.45), t);
        t += 0.06 + Math.random() * 0.05;
      }

      // Fixed thud — always 4 below center
      t += 0.25;
      this._darkNote(P[Math.max(0, centerIdx - 4)], burstVol * 0.60, t);
      t += 1.8 + Math.random() * 1.5;
    }

    // Final mega-cluster at all centers simultaneously
    t += 0.3;
    for (let b = 0; b < centers.length; b++) {
      this._darkNote(P[Math.min(P.length - 1, centers[b])], vol * 0.35, t + b * 0.03);
    }
      return t;
  }

  // ── 11. Grandma's Whisper — passacaglia: fixed sub-bass sequence with breath overtones ──
  //    Identity: the whisper frequencies [27.5, 36.7, 32.7, 41.2] — always the same old voice.
  grandmaWhisper() {
    const ctx = this._ctx;
    const vol = 0.013 + Math.random() * 0.004;
    // FIXED WHISPER SEQUENCE — always the same fundamentals in the same order
    const whispers = [27.5, 36.7, 32.7, 41.2, 27.5, 32.7];
    // Fixed overtone ratios for breath sounds
    const breathRatios = [3.0, 5.0, 3.5, 4.5, 3.2, 5.5];
    let t = 0;

    // 2 passes: barely there → present with breath
    for (let pass = 0; pass < 2; pass++) {
      const passVol = pass === 0 ? vol * 0.55 : vol;

      for (let i = 0; i < whispers.length; i++) {
        const fund = whispers[i];
        const dur = 3.2 + Math.random() * 1.5;
        const ct = ctx.currentTime + t;

        // Sub-bass with tremolo
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fund, ct);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 3.0;
        const lfoG = ctx.createGain();
        lfoG.gain.value = passVol * 0.32;
        lfo.connect(lfoG);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ct);
        g.gain.linearRampToValueAtTime(passVol, ct + 0.6);
        g.gain.setValueAtTime(passVol, ct + dur - 0.8);
        g.gain.linearRampToValueAtTime(0, ct + dur);
        lfoG.connect(g.gain);
        osc.connect(g).connect(this._out);
        lfo.start(ct); lfo.stop(ct + dur + 0.1);
        osc.start(ct); osc.stop(ct + dur + 0.1);

        // Detuned beating layer
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(fund * 1.008, ct);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0, ct);
        g2.gain.linearRampToValueAtTime(passVol * 0.38, ct + 0.8);
        g2.gain.linearRampToValueAtTime(0, ct + dur);
        osc2.connect(g2).connect(this._out);
        osc2.start(ct); osc2.stop(ct + dur + 0.1);

        // Fixed breath overtone — always the same harmonic for each whisper
        if (pass === 1) {
          const osc3 = ctx.createOscillator();
          osc3.type = 'sine';
          osc3.frequency.setValueAtTime(fund * breathRatios[i], ct);
          const g3 = ctx.createGain();
          g3.gain.setValueAtTime(0, ct);
          g3.gain.linearRampToValueAtTime(passVol * 0.15, ct + 0.7);
          g3.gain.exponentialRampToValueAtTime(0.001, ct + dur * 0.75);
          osc3.connect(g3).connect(this._out);
          osc3.start(ct); osc3.stop(ct + dur);
        }

        t += dur + 0.5 + Math.random() * 0.8;
      }
      t += 2.0 + Math.random() * 1.5;
    }
      return t;
  }

  // ── 12. Abyssal Rumble — passacaglia: fixed 2-wave accelerating pulse pattern ──
  //    Identity: the accent pattern [1,0,0,1] and the fixed base frequency — always the same quake.
  abyssalRumble() {
    const ctx = this._ctx;
    const vol = 0.011 + Math.random() * 0.003;
    const baseFreq = 40 + Math.floor(Math.random() * 3) * 10; // 40, 50, or 60
    // FIXED PITCH CYCLE — the rumble's harmonic content
    const pitchCycle = [1.0, 1.498, 1.0, 1.189]; // root, 5th, root, min3
    let t = 0;

    // 2 waves, each with fixed beat count and acceleration
    const waves = [
      { beats: 12, startTempo: 0.42, accel: 0.94, vol: 0.70 },
      { beats: 16, startTempo: 0.30, accel: 0.92, vol: 1.00 },
    ];

    for (let w = 0; w < waves.length; w++) {
      const wave = waves[w];
      let tempo = wave.startTempo;

      for (let i = 0; i < wave.beats; i++) {
        const freq = baseFreq * pitchCycle[i % pitchCycle.length];
        const accent = i % 4 === 0;
        const ct = ctx.currentTime + t;
        const dur = 0.25;

        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ct);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.42, ct + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, ct);
        g.gain.linearRampToValueAtTime(vol * wave.vol * (accent ? 0.90 : 0.48), ct + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
        osc.connect(g).connect(this._out);
        osc.start(ct); osc.stop(ct + dur + 0.1);

        // Sub weight on accents in wave 2
        if (w === 1 && accent) {
          const sub = ctx.createOscillator();
          sub.type = 'sine';
          sub.frequency.setValueAtTime(freq * 0.5, ct);
          const sg = ctx.createGain();
          sg.gain.setValueAtTime(vol * 0.28, ct);
          sg.gain.exponentialRampToValueAtTime(0.001, ct + dur * 1.5);
          sub.connect(sg).connect(this._out);
          sub.start(ct); sub.stop(ct + dur * 1.5 + 0.1);
        }

        t += tempo;
        tempo = Math.max(0.08, tempo * wave.accel);
      }

      // Pause between waves
      if (w === 0) {
        this._darkNote(baseFreq * 0.5, vol * 0.35, t);
        t += 1.5 + Math.random() * 0.8;
      }
    }

    // Crash
    this._darkNote(baseFreq * 0.25, vol * 0.48, t);
    this._darkNote(baseFreq * 0.5, vol * 0.90, t + 0.05);
    this._darkNote(baseFreq, vol * 0.55, t + 0.10);
      return t;
  }

  // ── 13. Sirenic Call — passacaglia: fixed descending frequency sequence with FM warping ──
  //    Identity: the siren's descent [650, 580, 500, 400, 300, 220, 160] — always the same lure.
  sirenicCall() {
    const ctx = this._ctx;
    const vol = 0.009 + Math.random() * 0.003;
    const offset = 0.9 + Math.random() * 0.2;
    // FIXED SIREN FREQUENCIES — the descent into darkness
    const freqs = [650, 580, 500, 400, 300, 220, 160].map(f => f * offset);
    let t = 0;

    for (let i = 0; i < freqs.length; i++) {
      const progress = i / freqs.length;
      const freq = freqs[i];
      const dur = 1.2 + Math.random() * 1.0;
      const ct = ctx.currentTime + t;

      const modRatio = 1.414 + progress * 5;
      const mod = ctx.createOscillator();
      mod.frequency.setValueAtTime(freq * modRatio, ct);
      mod.frequency.linearRampToValueAtTime(freq * modRatio * 0.85, ct + dur);
      const modG = ctx.createGain();
      modG.gain.setValueAtTime(freq * 0.5, ct);
      modG.gain.linearRampToValueAtTime(freq * (1 + progress * 8), ct + dur * 0.35);
      modG.gain.exponentialRampToValueAtTime(1, ct + dur);
      mod.connect(modG);

      const car = ctx.createOscillator();
      car.type = progress > 0.45 ? 'sawtooth' : 'sine';
      car.frequency.setValueAtTime(freq, ct);
      modG.connect(car.frequency);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(vol * (1 - progress * 0.18), ct + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
      car.connect(g).connect(this._out);
      mod.start(ct); car.start(ct);
      mod.stop(ct + dur + 0.1); car.stop(ct + dur + 0.1);

      // Bass pull on later notes
      if (progress > 0.4) {
        this._darkNote(freq * 0.25, vol * 0.18, t + 0.10);
      }

      t += 0.8 + Math.random() * 0.8;
    }

    this._darkNote(80 * offset, vol * 0.38, t + 0.2);
      return t;
  }

  // ── 14. Crypt Organ — passacaglia: fixed chord progression played twice (quiet then full) ──
  //    Identity: the progression i–bVII–bVI–v — always the same doom chords.
  cryptOrgan() {
    const ctx = this._ctx;
    const vol = 0.008 + Math.random() * 0.003;
    const roots = [65.4, 73.4, 87.3, 98.0];
    const root = roots[Math.floor(Math.random() * roots.length)];
    // FIXED PROGRESSION — always the same doom sequence
    const chords = [
      [0, 3, 7],    // i
      [-2, 1, 5],   // bVII
      [-4, -1, 3],  // bVI
      [-5, -2, 2],  // v
    ];
    const progression = [0, 1, 2, 3, 0]; // always i-bVII-bVI-v-i
    let t = 0;

    // 2 passes: quiet organ → full organ with pedal bass and tremulant
    for (let pass = 0; pass < 2; pass++) {
      const passVol = pass === 0 ? vol * 0.55 : vol;
      const hasPedal = pass === 1;

      // Pedal bass on full pass
      if (hasPedal) {
        const pedalDur = progression.length * 2.5;
        const pedalCt = ctx.currentTime + t;
        const pedalOsc = ctx.createOscillator();
        pedalOsc.type = 'square';
        pedalOsc.frequency.setValueAtTime(root * 0.5, pedalCt);
        const pedalLp = ctx.createBiquadFilter();
        pedalLp.type = 'lowpass'; pedalLp.frequency.value = root; pedalLp.Q.value = 0.5;
        const pedalG = ctx.createGain();
        pedalG.gain.setValueAtTime(0.001, pedalCt);
        pedalG.gain.linearRampToValueAtTime(passVol * 0.15, pedalCt + 0.5);
        pedalG.gain.setValueAtTime(passVol * 0.15, pedalCt + pedalDur - 0.5);
        pedalG.gain.exponentialRampToValueAtTime(0.001, pedalCt + pedalDur);
        pedalOsc.connect(pedalLp).connect(pedalG).connect(this._out);
        pedalOsc.start(pedalCt); pedalOsc.stop(pedalCt + pedalDur + 0.1);
      }

      for (let ci = 0; ci < progression.length; ci++) {
        const chord = chords[progression[ci]];
        const dur = 2.0 + Math.random() * 0.8;
        const ct = ctx.currentTime + t;
        const chordArc = Math.sin(Math.PI * ci / progression.length);
        const chordVol = passVol * (0.80 + chordArc * 0.20);

        for (const semi of chord) {
          const freq = root * Math.pow(2, semi / 12);
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, ct);
          osc.detune.setValueAtTime((Math.random() - 0.5) * 8, ct);

          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = freq * 3.5;

          // Tremulant on full pass
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, ct);
          g.gain.linearRampToValueAtTime(chordVol * 0.35, ct + 0.08);
          g.gain.setValueAtTime(chordVol * 0.35, ct + dur - 0.30);
          g.gain.exponentialRampToValueAtTime(0.001, ct + dur);

          if (hasPedal) {
            const trem = ctx.createOscillator();
            trem.frequency.value = 5.5;
            const tremG = ctx.createGain();
            tremG.gain.value = chordVol * 0.06;
            trem.connect(tremG).connect(g.gain);
            trem.start(ct); trem.stop(ct + dur + 0.1);
          }

          osc.connect(lp).connect(g).connect(this._out);
          osc.start(ct); osc.stop(ct + dur + 0.1);
        }

        t += dur + 0.2 + Math.random() * 0.3;
      }
      t += 2.0 + Math.random() * 1.5;
    }
      return t;
  }

  // ── 13. Windowpane — Ab major, wide intervals, dreamy & spacious ──

  windowpane() {
    // Ab major scale
    const S = [
      103.83, 116.54, 130.81, 138.59, 155.56, 174.61, 196.00,
      207.65, 233.08, 261.63, 277.18, 311.13, 349.23, 392.00,
      415.30, 466.16, 523.25, 554.37, 622.25, 698.46, 783.99,
      830.61, 932.33, 1046.50
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.008 + Math.random() * 0.003;
    let t = 0;

    // Ab=0,Bb=1,C=2,Db=3,Eb=4,F=5,G=6 per octave
    // Progression: Ab - Fm - Db - Eb (I - vi - IV - V)
    const prog = [
      { b: 7, ch: [14, 16, 18] },       // Ab: Ab3, Ab4-C5-Eb5
      { b: 12, ch: [14, 16, 18] },      // Fm: F4, Ab4-C5-Eb5
      { b: 10, ch: [14, 16, 18] },      // Db: Db4, Ab4-C5-Eb5
      { b: 11, ch: [14, 16, 19] },      // Eb: Eb4, Ab4-C5-F5
    ];

    // Wide-interval melody — looking through glass at a vast view
    const mel = [14, 18, 16, 21, 18, 14, 16, 18]; // Ab4-Eb5-C5-Ab5-Eb5-Ab4-C5-Eb5

    // Section A: Spacious chords alone — the window glass
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * (0.45 + bar * 0.06);
      this._note(n(c.b), v * 0.45, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * (0.3 + Math.random() * 0.1),
          t + 0.5 + i * (0.35 + Math.random() * 0.1));
      }
      t += 6.0 + Math.random() * 1.5;
    }
    t += 2.0;

    // Section B: Add wide-leaping melody — what you see through the glass
    for (let rep = 0; rep < 2; rep++) {
      for (let bar = 0; bar < 4; bar++) {
        const c = prog[bar];
        const v = vol * (rep === 0 ? 0.7 : 0.9);
        this._note(n(c.b), v * 0.42, t);
        for (let i = 0; i < c.ch.length; i++) {
          this._note(n(c.ch[i]), v * 0.22, t + 0.3 + i * 0.08);
        }
        // Wide melody
        this._note(n(mel[bar * 2]), v * (0.55 + Math.random() * 0.2), t + 1.2);
        this._note(n(mel[bar * 2 + 1]), v * (0.45 + Math.random() * 0.2),
          t + 3.0 + Math.random() * 0.5);
        // Second pass: add rain-like high sparkle
        if (rep === 1 && Math.random() < 0.5) {
          this._note(n(mel[bar * 2] + 7), v * 0.12, t + 2.0 + Math.random() * 0.5);
        }
        t += 5.5 + Math.random() * 1.0;
      }
      t += 1.5 + Math.random() * 1.0;
    }

    // Coda: The view fading as rain starts
    this._note(n(14), vol * 0.25, t);
    t += 3.0;
    this._note(n(7), vol * 0.18, t);
    t += 2.5;
    this._note(n(14), vol * 0.1, t);
    t += 5.0;
    return t;
  }

  // ── 14. Featherfall — E major, gentle descending motifs ──

  featherfall() {
    // E major scale
    const S = [
      82.41, 92.50, 103.83, 110.00, 123.47, 138.59, 155.56,
      164.81, 185.00, 207.65, 220.00, 246.94, 277.18, 311.13,
      329.63, 369.99, 415.30, 440.00, 493.88, 554.37, 622.25,
      659.26, 739.99, 830.61, 880.00
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.008 + Math.random() * 0.003;
    let t = 0;

    // E=0,F#=1,G#=2,A=3,B=4,C#=5,D#=6 per octave
    // Progression: E - B - C#m - A (I - V - vi - IV)
    const prog = [
      { b: 7, ch: [14, 16, 18] },       // E: E3, E4-G#4-B4
      { b: 11, ch: [15, 18, 20] },      // B: B3, F#4-B4-D#5
      { b: 12, ch: [14, 16, 19] },      // C#m: C#4, E4-G#4-C#5
      { b: 10, ch: [14, 17, 18] },      // A: A3, E4-A4-B4
    ];

    // Descending melody — feathers drifting down
    const fall1 = [21, 20, 18, 17, 16, 15, 14, 12]; // E5-D#5-B4-A4-G#4-F#4-E4-C#4
    const fall2 = [20, 19, 18, 16, 15, 14, 12, 11]; // D#5-C#5-B4-G#4-F#4-E4-C#4-B3

    // Section A: Falling melody alone — weightless
    for (let i = 0; i < 8; i++) {
      this._note(n(fall1[i]), vol * (0.4 + Math.random() * 0.1),
        t);
      t += (1.2 + Math.random() * 0.5) * (1.0 + i * 0.05); // Gradually slower
    }
    t += 3.0;

    // Section B: Add bass and chords — the air has texture
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * 0.72;
      this._note(n(c.b), v * 0.42, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.25, t + 0.4 + i * 0.3);
      }
      // Descending melody fragment
      for (let m = 0; m < 2; m++) {
        this._note(n(fall1[bar * 2 + m]), v * (0.55 + Math.random() * 0.2),
          t + 1.5 + m * (1.3 + Math.random() * 0.3));
      }
      t += 5.5 + Math.random() * 1.0;
    }
    t += 1.5;

    // Section C: Second falling melody, richer — the ground approaches
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * (bar === 2 ? 1.0 : 0.85);
      this._note(n(c.b), v * 0.48, t);
      if (bar >= 2) this._note(n(c.b - 7), v * 0.18, t + 0.04);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.28, t + 0.3 + i * 0.25);
      }
      for (let m = 0; m < 2; m++) {
        this._note(n(fall2[bar * 2 + m]), v * (0.6 + Math.random() * 0.2),
          t + 1.5 + m * (1.2 + Math.random() * 0.3));
      }
      t += 5.5 + Math.random() * 1.0;
    }

    // Coda: The feather lands — lowest note, barely there
    this._note(n(14), vol * 0.25, t);
    t += 2.5;
    this._note(n(11), vol * 0.18, t);
    t += 2.0;
    this._note(n(7), vol * 0.1, t);
    t += 6.0;
    return t;
  }

  // ── 15. Still Water — Db major, very slow & contemplative ──

  stillWater() {
    // Db major scale
    const S = [
      138.59, 155.56, 174.61, 185.00, 207.65, 233.08, 261.63,
      277.18, 311.13, 349.23, 369.99, 415.30, 466.16, 523.25,
      554.37, 622.25, 698.46, 739.99, 830.61, 932.33, 1046.50,
      1108.73
    ];
    const n = (i) => this._si(S, i);
    const vol = 0.007 + Math.random() * 0.003;
    let t = 0;

    // Db=0,Eb=1,F=2,Gb=3,Ab=4,Bb=5,C=6 per octave
    // Progression: Db - Ab - Bbm - Gb (I - V - vi - IV)
    const prog = [
      { b: 7, ch: [11, 14, 16] },       // Db: Db3, Ab4-Db5-F5
      { b: 11, ch: [9, 13, 16] },       // Ab: Ab3, F4-C5-F5
      { b: 12, ch: [8, 11, 14] },       // Bbm: Bb3, Eb4-Ab4-Db5
      { b: 10, ch: [9, 12, 14] },       // Gb: Gb3, F4-Bb4-Db5
    ];

    // Opening: Single Db, like dropping a stone into still water
    this._note(n(7), vol * 0.4, t);
    t += 5.0 + Math.random() * 2.0;

    // Section A: Very slow chords — the water barely moves
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * (0.4 + bar * 0.05);
      this._note(n(c.b), v * 0.5, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * (0.3 + Math.random() * 0.1),
          t + 1.0 + i * (0.5 + Math.random() * 0.2));
      }
      t += 7.5 + Math.random() * 2.0;
    }
    t += 2.5;

    // Section B: Melody appears like a reflection — barely visible
    const reflect = [14, 16, 18, 16, 14, 12, 11, 14]; // Db5-F5-Ab5-F5-Db5-Bb4-Ab4-Db5
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * 0.7;
      this._note(n(c.b), v * 0.45, t);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.22, t + 0.5 + i * 0.15);
      }
      this._note(n(reflect[bar * 2]), v * (0.45 + Math.random() * 0.18),
        t + 2.0 + Math.random() * 0.5);
      this._note(n(reflect[bar * 2 + 1]), v * (0.38 + Math.random() * 0.15),
        t + 4.5 + Math.random() * 0.8);
      t += 7.0 + Math.random() * 1.5;
    }
    t += 2.0;

    // Section C: Gentle climax — the reflection is clear now
    for (let bar = 0; bar < 4; bar++) {
      const c = prog[bar];
      const v = vol * (bar === 1 || bar === 2 ? 0.9 : 0.75);
      this._note(n(c.b), v * 0.5, t);
      if (bar >= 1) this._note(n(c.b - 7), v * 0.18, t + 0.04);
      for (let i = 0; i < c.ch.length; i++) {
        this._note(n(c.ch[i]), v * 0.28, t + 0.4 + i * 0.3);
      }
      // Melody with a gentle ornament
      this._note(n(reflect[bar * 2]), v * (0.55 + Math.random() * 0.15), t + 1.8);
      if (bar === 2) {
        this._note(n(reflect[bar * 2] + 1), v * 0.15, t + 1.65); // grace note
      }
      this._note(n(reflect[bar * 2 + 1]), v * (0.45 + Math.random() * 0.15), t + 4.0);
      t += 7.5 + Math.random() * 1.5;
    }

    // Coda: The water is still again
    this._note(n(14), vol * 0.22, t);
    t += 4.0;
    this._note(n(7), vol * 0.15, t);
    t += 5.0;
    this._note(n(14), vol * 0.08, t);
    t += 8.0;
    return t;
  }


  // ═══════════════════════════════════════════════════════════
  //  NOTE RENDERER — delicate piano-like tone (normal mode)
  // ═══════════════════════════════════════════════════════════

  _note(freq, volume = 0.010, delay = 0) {
    const ctx = this._ctx;
    const out = this._out;
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const dur = 5.0 + Math.random() * 5.0;                    // 5–10 s — C418-style long sustain
    // Track when this note's audio actually ends (for accurate progress bar)
    const noteEnd = delay + dur + 1.5;
    if (noteEnd > this._maxNoteEnd) this._maxNoteEnd = noteEnd;

    // Tail padding — oscillators live longer than their gain envelope
    // so the gain always reaches ~0 before the oscillator stops (no click).
    const tail = dur * 0.4 + 1.5;

    // ── Warm sine fundamental with gentle attack ──
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(volume, t, 0.015);                  // smooth exponential rise (~50ms)
    g.gain.setTargetAtTime(volume * 0.58, t + 0.060, 1.2);    // decay into sustain
    g.gain.setTargetAtTime(0, t + dur * 0.55, dur * 0.25);    // fade to true zero
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + tail);

    // ── Chorus detune — adds C418 warmth/width ──
    const chorus = ctx.createOscillator();
    chorus.type = 'sine';
    chorus.frequency.setValueAtTime(freq * 1.0015, t);         // +2.6 cents sharp
    const gc = ctx.createGain();
    gc.gain.setValueAtTime(0, t);
    gc.gain.setTargetAtTime(volume * 0.18, t, 0.020);
    gc.gain.setTargetAtTime(volume * 0.10, t + 0.070, 1.5);
    gc.gain.setTargetAtTime(0, t + dur * 0.50, dur * 0.22);
    chorus.connect(gc).connect(out);
    chorus.start(t);
    chorus.stop(t + dur + tail);

    // Flat-side chorus voice — widens the stereo image perception
    const chorus2 = ctx.createOscillator();
    chorus2.type = 'sine';
    chorus2.frequency.setValueAtTime(freq * 0.9985, t);        // -2.6 cents flat
    const gc2 = ctx.createGain();
    gc2.gain.setValueAtTime(0, t);
    gc2.gain.setTargetAtTime(volume * 0.14, t, 0.022);
    gc2.gain.setTargetAtTime(volume * 0.08, t + 0.075, 1.5);
    gc2.gain.setTargetAtTime(0, t + dur * 0.48, dur * 0.22);
    chorus2.connect(gc2).connect(out);
    chorus2.start(t);
    chorus2.stop(t + dur + tail);

    // ── Piano "pluck" attack — softer hammer, felt-like ──
    const pluck = ctx.createOscillator();
    pluck.type = 'sine';
    pluck.frequency.setValueAtTime(freq * 4.5, t);
    pluck.frequency.exponentialRampToValueAtTime(freq * 1.01, t + 0.025);
    const gp = ctx.createGain();
    gp.gain.setValueAtTime(0, t);
    gp.gain.setTargetAtTime(volume * 0.12, t, 0.002);          // ~2ms rise (no click)
    gp.gain.setTargetAtTime(0, t + 0.006, 0.008);              // smooth exponential decay
    pluck.connect(gp).connect(out);
    pluck.start(t); pluck.stop(t + 0.08);                      // generous stop padding

    // ── Octave partial — warm, longer sustain for body ──
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.002, t);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.setTargetAtTime(volume * 0.075, t, 0.012);
    g2.gain.setTargetAtTime(volume * 0.035, t + 0.045, 0.9);
    g2.gain.setTargetAtTime(0, t + dur * 0.38, dur * 0.16);
    osc2.connect(g2).connect(out);
    osc2.start(t);
    osc2.stop(t + dur * 0.55 + tail);

    // ── Fifth partial — body ──
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3.001, t);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0, t);
    g3.gain.setTargetAtTime(volume * 0.025, t, 0.010);
    g3.gain.setTargetAtTime(0, t + 0.18, dur * 0.08);
    osc3.connect(g3).connect(out);
    osc3.start(t);
    osc3.stop(t + dur * 0.32 + tail);

    // ── Seventh partial — shimmering overtone colour ──
    const osc4 = ctx.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(freq * 4.001, t);
    const g4 = ctx.createGain();
    g4.gain.setValueAtTime(0, t);
    g4.gain.setTargetAtTime(volume * 0.010, t, 0.008);
    g4.gain.setTargetAtTime(0, t + 0.10, dur * 0.06);
    osc4.connect(g4).connect(out);
    osc4.start(t);
    osc4.stop(t + dur * 0.20 + tail);

    // ── Reverb ghost — delayed echo note for spaciousness ──
    const rev = ctx.createOscillator();
    rev.type = 'sine';
    rev.frequency.setValueAtTime(freq, t + 0.18);
    const gr = ctx.createGain();
    gr.gain.setValueAtTime(0, t + 0.18);
    gr.gain.setTargetAtTime(volume * 0.06, t + 0.18, 0.015);
    gr.gain.setTargetAtTime(0, t + dur * 0.40, dur * 0.28);
    rev.connect(gr).connect(out);
    rev.start(t + 0.18);
    rev.stop(t + dur + tail);
  }
}
