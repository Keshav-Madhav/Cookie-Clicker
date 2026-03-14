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
    // Create a GainNode that all compositions route through.
    // On apocalypse transitions, we swap this node to orphan old oscillators.
    this._out = ctx.createGain();
    this._out.gain.value = 1.0;
    this._out.connect(outputNode);
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
    const dest = this._outDest;
    const t = ctx.currentTime;

    // Fade out old node
    oldOut.gain.setValueAtTime(oldOut.gain.value, t);
    oldOut.gain.linearRampToValueAtTime(0.001, t + 0.30);

    // Disconnect old node right after fade completes — orphans all old oscillators
    setTimeout(() => { try { oldOut.disconnect(); } catch (_) {} }, 320);

    // Create fresh output node
    setTimeout(() => {
      const fresh = ctx.createGain();
      fresh.gain.setValueAtTime(1.0, ctx.currentTime);
      fresh.connect(dest);
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

    // Fresh output node
    const fresh = ctx.createGain();
    fresh.gain.value = 1.0;
    fresh.connect(this._outDest);
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

  static _COMPOSITIONS = [
    'gentleArc',       'callAndResponse',  'fallingLeaves',
    'spreadArpeggio',  'lullaby',          'freeWander',
    'ripple',          'musicBox',         'cascade',
    'echoReflection',  'starlight',        'hymn',
    'distantRain',     'meadowWalk',       'frozenLake',
  ];

  static _DARK_COMPOSITIONS = [
    'darkDrone',       'tensePulse',       'hauntedArpeggio',
    'doomRiff',        'witchBells',       'voidEcho',
    'grindMotor',      'eldrChant',
    'bloodMoon',       'chaosCluster',     'grandmaWhisper',
    'abyssalRumble',   'sirenicCall',      'cryptOrgan',
  ];

  // Pretty display names for each composition.
  static _DISPLAY_NAMES = {
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

  // ═══════════════════════════════════════════════════════════
  //  COMPOSITIONS
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
    const noteEnd = delay + dur + 0.5;
    if (noteEnd > this._maxNoteEnd) this._maxNoteEnd = noteEnd;

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
    vib.start(t); vib.stop(t + dur + 0.5);

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
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.015);
    g.gain.setTargetAtTime(volume * 0.48, t + 0.12, 0.6);
    g.gain.setTargetAtTime(volume * 0.15, t + dur * 0.45, dur * 0.22);
    g.gain.setTargetAtTime(0.001, t + dur * 0.75, dur * 0.18);

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
    osc.stop(t + dur + 0.5);

    // ── Detuned unison — chorus thickness ──
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.007, t);
    osc2.frequency.exponentialRampToValueAtTime(freq * 1.002, t + 0.05);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(volume * 0.45, t + 0.025);
    g2.gain.setTargetAtTime(volume * 0.15, t + dur * 0.35, dur * 0.18);
    g2.gain.setTargetAtTime(0.001, t + dur * 0.65, dur * 0.18);
    osc2.connect(ws).connect(lp);
    osc2.connect(g2).connect(out);
    osc2.start(t);
    osc2.stop(t + dur + 0.5);

    // ── Flat-side detuned voice — wider, more ominous ──
    const osc3 = ctx.createOscillator();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(freq * 0.994, t);
    osc3.frequency.exponentialRampToValueAtTime(freq * 0.998, t + 0.06);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.001, t);
    g3.gain.linearRampToValueAtTime(volume * 0.30, t + 0.030);
    g3.gain.setTargetAtTime(0.001, t + dur * 0.40, dur * 0.20);
    osc3.connect(ws).connect(lp);
    osc3.connect(g3).connect(out);
    osc3.start(t);
    osc3.stop(t + dur + 0.4);

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
    nGain.gain.setValueAtTime(volume * 0.35, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
    nSrc.connect(nFilt).connect(nGain).connect(out);
    nSrc.start(t); nSrc.stop(t + noiseDur + 0.01);

    // ── Sub-octave sine — physical low-end weight ──
    if (freq < 350) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq * 0.5, t);
      const gs = ctx.createGain();
      gs.gain.setValueAtTime(0.001, t);
      gs.gain.linearRampToValueAtTime(volume * 0.32, t + 0.030);
      gs.gain.setTargetAtTime(volume * 0.12, t + dur * 0.25, dur * 0.18);
      gs.gain.setTargetAtTime(0.001, t + dur * 0.50, dur * 0.20);
      sub.connect(gs).connect(out);
      sub.start(t); sub.stop(t + dur + 0.3);
    }

    // ── Overtone shimmer — high harmonic that fades in late ──
    if (freq < 500 && Math.random() < 0.6) {
      const ot = ctx.createOscillator();
      ot.type = 'sine';
      ot.frequency.setValueAtTime(freq * 5.01, t);
      const go = ctx.createGain();
      go.gain.setValueAtTime(0.001, t);
      go.gain.setTargetAtTime(volume * 0.04, t + dur * 0.2, dur * 0.15);
      go.gain.setTargetAtTime(0.001, t + dur * 0.5, dur * 0.15);
      ot.connect(go).connect(out);
      ot.start(t); ot.stop(t + dur * 0.7);
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
  //  NOTE RENDERER — delicate piano-like tone (normal mode)
  // ═══════════════════════════════════════════════════════════

  _note(freq, volume = 0.010, delay = 0) {
    const ctx = this._ctx;
    const out = this._out;
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const dur = 5.0 + Math.random() * 5.0;                    // 5–10 s — C418-style long sustain
    // Track when this note's audio actually ends (for accurate progress bar)
    const noteEnd = delay + dur + 1.0;
    if (noteEnd > this._maxNoteEnd) this._maxNoteEnd = noteEnd;

    // ── Warm sine fundamental with gentle attack ──
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.050);         // softer 50ms attack
    g.gain.setTargetAtTime(volume * 0.58, t + 0.050, 1.2);    // slower decay into sustain
    g.gain.setTargetAtTime(0.001, t + dur * 0.55, dur * 0.28);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 1.0);

    // ── Chorus detune — adds C418 warmth/width ──
    const chorus = ctx.createOscillator();
    chorus.type = 'sine';
    chorus.frequency.setValueAtTime(freq * 1.0015, t);         // +2.6 cents sharp
    const gc = ctx.createGain();
    gc.gain.setValueAtTime(0.001, t);
    gc.gain.linearRampToValueAtTime(volume * 0.18, t + 0.065);
    gc.gain.setTargetAtTime(volume * 0.10, t + 0.065, 1.5);
    gc.gain.setTargetAtTime(0.001, t + dur * 0.50, dur * 0.25);
    chorus.connect(gc).connect(out);
    chorus.start(t);
    chorus.stop(t + dur + 0.8);

    // Flat-side chorus voice — widens the stereo image perception
    const chorus2 = ctx.createOscillator();
    chorus2.type = 'sine';
    chorus2.frequency.setValueAtTime(freq * 0.9985, t);        // -2.6 cents flat
    const gc2 = ctx.createGain();
    gc2.gain.setValueAtTime(0.001, t);
    gc2.gain.linearRampToValueAtTime(volume * 0.14, t + 0.070);
    gc2.gain.setTargetAtTime(volume * 0.08, t + 0.070, 1.5);
    gc2.gain.setTargetAtTime(0.001, t + dur * 0.48, dur * 0.24);
    chorus2.connect(gc2).connect(out);
    chorus2.start(t);
    chorus2.stop(t + dur + 0.8);

    // ── Piano "pluck" attack — softer hammer, more felt-like ──
    const pluck = ctx.createOscillator();
    pluck.type = 'sine';
    pluck.frequency.setValueAtTime(freq * 4.5, t);
    pluck.frequency.exponentialRampToValueAtTime(freq, t + 0.022);
    const gp = ctx.createGain();
    gp.gain.setValueAtTime(volume * 0.14, t);
    gp.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
    pluck.connect(gp).connect(out);
    pluck.start(t); pluck.stop(t + 0.04);

    // ── Octave partial — warm, longer sustain for body ──
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.002, t);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(volume * 0.075, t + 0.040);
    g2.gain.setTargetAtTime(volume * 0.035, t + 0.040, 0.9);
    g2.gain.setTargetAtTime(0.001, t + dur * 0.38, dur * 0.18);
    osc2.connect(g2).connect(out);
    osc2.start(t);
    osc2.stop(t + dur * 0.55);

    // ── Fifth partial — body ──
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3.001, t);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.001, t);
    g3.gain.linearRampToValueAtTime(volume * 0.025, t + 0.030);
    g3.gain.setTargetAtTime(0.001, t + 0.18, dur * 0.10);
    osc3.connect(g3).connect(out);
    osc3.start(t);
    osc3.stop(t + dur * 0.32);

    // ── Seventh partial — shimmering overtone colour ──
    const osc4 = ctx.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(freq * 4.001, t);
    const g4 = ctx.createGain();
    g4.gain.setValueAtTime(0.001, t);
    g4.gain.linearRampToValueAtTime(volume * 0.010, t + 0.022);
    g4.gain.setTargetAtTime(0.001, t + 0.10, dur * 0.07);
    osc4.connect(g4).connect(out);
    osc4.start(t);
    osc4.stop(t + dur * 0.20);

    // ── Reverb ghost — delayed echo note for spaciousness ──
    const rev = ctx.createOscillator();
    rev.type = 'sine';
    rev.frequency.setValueAtTime(freq, t + 0.18);
    const gr = ctx.createGain();
    gr.gain.setValueAtTime(0.001, t + 0.18);
    gr.gain.linearRampToValueAtTime(volume * 0.06, t + 0.22);
    gr.gain.setTargetAtTime(0.001, t + dur * 0.40, dur * 0.30);
    rev.connect(gr).connect(out);
    rev.start(t + 0.18);
    rev.stop(t + dur + 0.5);
  }
}
