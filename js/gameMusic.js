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
    this._out = outputNode;
    this._active = false;
    this._timer = null;
    this._currentName = '';
    this._apocalypseMode = 0; // 0 = normal, 1-3 = grandmapocalypse stage
    this._lastDuration = 40;  // estimated seconds of last composition
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

  /** Set apocalypse mode: 0 = normal, 1-3 = stage.
   *  Fast crossfade (~300 ms) into a new composition from the new pool. */
  setApocalypseMode(stage) {
    const prev = this._apocalypseMode;
    this._apocalypseMode = stage;
    if (prev === stage || !this._active) return;

    // Kill pending schedule
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }

    // Fast fade-out of current audio (300 ms)
    const ctx = this._ctx;
    if (ctx && this._out) {
      const t = ctx.currentTime;
      this._out.gain.setValueAtTime(this._out.gain.value, t);
      this._out.gain.linearRampToValueAtTime(0.001, t + 0.30);
      // Restore gain after fade, then play new composition
      setTimeout(() => {
        if (!this._active) return;
        this._out.gain.setValueAtTime(1.0, ctx.currentTime);
        this._play();
        this._schedule();
      }, 350);
    }
  }

  start() {
    if (this._active) return;
    this._active = true;
    // Play a first composition after a short warm-up, then switch to normal scheduling.
    // This makes each refresh feel distinct immediately rather than waiting 5–17 s.
    this._timer = setTimeout(() => {
      if (!this._active) return;
      this._play();
      this._schedule();
    }, 1000 + Math.random() * 2000);
  }

  stop() {
    this._active = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  _schedule() {
    if (!this._active) return;
    // Gap AFTER a composition finishes before the next one starts.
    // Compositions are now 30-120s, so the gap is just breathing room.
    const stage = this._apocalypseMode || 0;
    const minGap = stage >= 3 ? 3000 : stage >= 2 ? 4000 : stage >= 1 ? 5000 : 6000;
    const maxExtra = stage >= 3 ? 5000 : stage >= 2 ? 8000 : stage >= 1 ? 10000 : 14000;
    // Add the last composition's estimated duration so we don't overlap
    const compositionDuration = (this._lastDuration || 40) * 1000;
    const delay = compositionDuration + minGap + Math.random() * maxExtra;
    this._timer = setTimeout(() => {
      if (!this._active) return;
      this._play();
      this._schedule();
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
    this[name]();
    this._lastDuration = GameMusic._DURATIONS[name] || 45;
  }

  // Estimated durations (seconds) for scheduling gaps.
  // Updated as compositions are extended to feature-length.
  static _DURATIONS = {
    // Feature-length compositions (passacaglia structure, 50-100s)
    gentleArc: 70, callAndResponse: 75, lullaby: 80, musicBox: 55,
    starlight: 95, hymn: 65, distantRain: 85, frozenLake: 100,
    // Extended but not yet full passacaglia (30-50s)
    fallingLeaves: 45, spreadArpeggio: 40, freeWander: 50,
    ripple: 40, cascade: 40, echoReflection: 45, meadowWalk: 45,
    // Dark compositions (shorter, more intense, 25-50s)
    darkDrone: 40, tensePulse: 35, hauntedArpeggio: 45, doomRiff: 40,
    witchBells: 35, voidEcho: 55, grindMotor: 35, eldrChant: 50,
    bloodMoon: 40, chaosCluster: 35, grandmaWhisper: 45, abyssalRumble: 35,
    sirenicCall: 35, cryptOrgan: 30,
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
    const t = ctx.currentTime + delay;
    const dur = 2.5 + Math.random() * 3.5;                    // longer sustain for more weight
    const out = this._out;

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

  // ── 1. Dark Drone — layered minor cluster with pitch wobble, sub layers, and high feedback ──
  darkDrone() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const rootIdx = Math.floor(Math.random() * 5);
    const root = P[rootIdx];

    // Sub-octave foundation — deep, physical
    this._darkNote(root * 0.5, vol * 0.48, 0);
    // Sub-sub bass pulse
    this._darkNote(root * 0.25, vol * 0.22, 0.3 + Math.random() * 0.3);

    // Root — with micro-drift to simulate feedback wobble
    this._darkNote(root, vol, 0.1);
    this._darkNote(root * 1.003, vol * 0.45, 0.9 + Math.random() * 0.4);
    this._darkNote(root * 0.997, vol * 0.35, 1.8 + Math.random() * 0.5);
    // Second drift wave — evolving texture
    this._darkNote(root * 1.005, vol * 0.28, 3.2 + Math.random() * 0.6);
    this._darkNote(root * 0.994, vol * 0.20, 4.0 + Math.random() * 0.7);

    // Minor third — menacing warmth
    this._darkNote(root * 1.189, vol * 0.62, 0.4 + Math.random() * 0.4);

    // Fifth — stability that somehow still unsettles
    this._darkNote(root * 1.498, vol * 0.42, 1.0 + Math.random() * 0.6);

    // Flat seventh — adds dread
    this._darkNote(root * 1.782, vol * 0.32, 1.6 + Math.random() * 0.8);

    // Minor ninth — extreme tension at the top
    this._darkNote(root * 2.059, vol * 0.18, 2.0 + Math.random() * 0.8);

    // Dissonant cluster that slowly drifts in
    if (Math.random() < 0.75) {
      const dis = root * (1 + Math.random() * 0.07);
      this._darkNote(dis, vol * 0.25, 2.4 + Math.random() * 1.2);
      this._darkNote(dis * 1.012, vol * 0.15, 3.0 + Math.random() * 1.2);
      this._darkNote(dis * 0.988, vol * 0.10, 3.8 + Math.random() * 1.2);
    }

    // High feedback whine
    if (Math.random() < 0.60) {
      this._darkNote(root * 4, vol * 0.08, 1.2 + Math.random() * 0.8);
    }
    // Second feedback voice — detuned, creating beats
    if (Math.random() < 0.40) {
      this._darkNote(root * 4.03, vol * 0.05, 2.0 + Math.random() * 1.0);
    }

    // Late low rumble — the drone settling into permanent unease
    this._darkNote(root * 0.5, vol * 0.30, 4.5 + Math.random() * 1.5);
  }

  // ── 2. Tense Pulse — five phases with accents, ghost notes, and escalating tension ──
  tensePulse() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.011 + Math.random() * 0.004;
    const rootIdx = 3 + Math.floor(Math.random() * 6);
    const root = P[rootIdx];
    const fifth     = root * 1.498;
    const minor3rd  = root * 1.189;
    const tritone   = root * Math.pow(2, 6 / 12);

    const phases = [
      { pat: [1,0,0,1,0,1,0,0],                         volMult: 0.48 }, // sparse intro
      { pat: [1,0,1,1,0,1,0,1,1,0,0,1,1,1,0,1],         volMult: 0.75 }, // building
      { pat: [1,0,1,1,1,1,0,1,1,1,0,1,1,1,1,1],         volMult: 0.90 }, // full intensity
      { pat: [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0],         volMult: 0.42 }, // breakdown
      { pat: [1,1,0,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,1,1], volMult: 1.00 }, // dense climax
    ];

    const interval = 0.15 + Math.random() * 0.05;
    let t = 0;

    // Sub bass underpinning the whole piece
    this._darkNote(root * 0.5, vol * 0.25, 0);

    for (let pi = 0; pi < phases.length; pi++) {
      const phase = phases[pi];
      for (let i = 0; i < phase.pat.length; i++) {
        if (phase.pat[i]) {
          const accent = i % 4 === 0;
          let hz = (i % 5 === 0) ? fifth : (i % 7 === 0) ? minor3rd : root;
          // Tritone intrusion in later phases — increasing dread
          if (pi >= 2 && i % 9 === 0) hz = tritone;
          this._darkNote(hz, vol * phase.volMult * (accent ? 0.85 : 0.45 + Math.random() * 0.30), t);

          // Ghost note — very quiet echo between beats
          if (Math.random() < 0.18 && pi >= 1) {
            this._darkNote(hz * 1.003, vol * phase.volMult * 0.12, t + interval * 0.5);
          }
        }
        t += interval;
      }
      // Sub bass restatement between phases
      if (pi < phases.length - 1) {
        this._darkNote(root * 0.5, vol * 0.20, t);
      }
      t += 0.35 + Math.random() * 0.45;
    }

    // Final crash — layered impact
    this._darkNote(root * 0.25, vol * 0.50, t + 0.08);
    this._darkNote(root * 0.5, vol * 0.90, t + 0.10);
    this._darkNote(root, vol * 0.65, t + 0.13);
    this._darkNote(fifth, vol * 0.35, t + 0.16);
  }

  // ── 3. Haunted Arpeggio — escalating wrong notes, chromatic slides, and disintegrating echo ──
  hauntedArpeggio() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const rootIdx = 6 + Math.floor(Math.random() * 6);
    let t = 0;
    const intervals = [0, 3, 5, 7, 10, 12];
    const passes = 4 + Math.floor(Math.random() * 3); // 4–6

    // Opening low drone beneath the arpeggio
    this._darkNote(P[rootIdx] * 0.5, vol * 0.28, 0);

    for (let p = 0; p < passes; p++) {
      const order = p % 2 === 0 ? intervals : [...intervals].reverse();
      // Each pass gets slightly faster — tension building
      const baseSpeed = 0.30 - p * 0.02;

      for (let ni = 0; ni < order.length; ni++) {
        const semi = order[ni];
        let hz = P[rootIdx] * Math.pow(2, semi / 12);
        // Wrong note probability escalates exponentially
        const wrongChance = 0.08 + p * 0.08;
        if (Math.random() < wrongChance) {
          const wrongSemi = Math.random() < 0.5 ? 1 : -1;
          hz *= Math.pow(2, wrongSemi / 12);
        }
        const noteVol = vol * (0.35 + Math.random() * 0.45);
        this._darkNote(hz, noteVol, t);

        // Echo ghost on later passes — the arpeggio remembering itself wrong
        if (p >= 2 && Math.random() < 0.30) {
          this._darkNote(hz * (1 + (Math.random() - 0.5) * 0.02), noteVol * 0.18, t + 0.20);
        }

        t += Math.max(0.15, baseSpeed + Math.random() * 0.18);
      }

      // Chromatic descent between passes — 4 notes sliding down
      if (p < passes - 1) {
        const topHz = P[rootIdx] * Math.pow(2, 12 / 12);
        const slideLen = 3 + Math.floor(Math.random() * 2);
        for (let s = 0; s < slideLen; s++) {
          this._darkNote(topHz * Math.pow(2, -s / 12), vol * 0.25, t);
          t += 0.14 + Math.random() * 0.08;
        }
      }

      // Drone re-anchor between passes
      if (p % 2 === 0 && p < passes - 1) {
        this._darkNote(P[rootIdx] * 0.5, vol * 0.18, t);
      }

      t += 0.8 + Math.random() * 1.2;
    }

    // Final — root and minor third held together, unresolved
    t += 0.3;
    this._darkNote(P[rootIdx] * 0.5, vol * 0.35, t);
    this._darkNote(P[rootIdx], vol * 0.72, t + 0.05);
    this._darkNote(P[rootIdx] * 1.189, vol * 0.42, t + 0.15);
    // Tritone ghost — the last thing you hear
    this._darkNote(P[rootIdx] * Math.pow(2, 6 / 12), vol * 0.15, t + 0.8);
  }

  // ── 4. Doom Riff — 3–4 reps with bass walks, power chords, and breakdown section ──
  doomRiff() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.012 + Math.random() * 0.004;
    // E–G–A–Bb–E doom progression (added flat 5th approach)
    const roots = [P[0], P[2], P[3], P[3] * Math.pow(2, 1 / 12), P[0]];
    const repeats = 3 + Math.floor(Math.random() * 2);
    let t = 0;

    // Opening sub-bass hit
    this._darkNote(P[0] * 0.5, vol * 0.55, 0);

    for (let rep = 0; rep < repeats; rep++) {
      const repVol = vol * (0.75 + rep * 0.08);
      const timing = rep === 0 ? 0.75 + Math.random() * 0.25 : 0.50 + Math.random() * 0.16;

      for (let i = 0; i < roots.length; i++) {
        const root = roots[i];
        // Power chord: root + fifth + octave
        this._darkNote(root, repVol, t);
        this._darkNote(root * 1.498, repVol * 0.55, t + 0.020);
        if (rep >= 2) {
          this._darkNote(root * 2, repVol * 0.30, t + 0.035); // octave doubles on later reps
        }

        // Bass walk between chords
        if (i < roots.length - 1 && Math.random() < 0.55) {
          const walkSemi = Math.random() < 0.5 ? 1 : 2;
          const walk = root * Math.pow(2, walkSemi / 12);
          this._darkNote(walk, repVol * 0.30, t + timing * 0.60);
        }

        t += timing;
      }

      // Riff-ending sustain with feedback
      this._darkNote(P[0], repVol * 0.78, t);
      this._darkNote(P[0] * 1.498, repVol * 0.50, t + 0.03);
      this._darkNote(P[0] * 2, repVol * 0.25, t + 0.06);
      t += 1.2 + Math.random() * 0.6;

      // Breakdown after second rep — sparse, menacing
      if (rep === 1) {
        t += 0.3;
        for (let b = 0; b < 4; b++) {
          this._darkNote(P[0], vol * 0.55, t);
          t += 0.55 + Math.random() * 0.35;
          // Muted ghost between hits
          if (Math.random() < 0.5) {
            this._darkNote(P[0] * 1.003, vol * 0.12, t - 0.15);
          }
        }
        t += 0.5;
      }
    }

    // Final massive hit — layered
    this._darkNote(P[0] * 0.25, vol * 0.40, t);
    this._darkNote(P[0] * 0.5, vol * 0.75, t + 0.03);
    this._darkNote(P[0], vol * 0.90, t + 0.06);
    this._darkNote(P[0] * 1.498, vol * 0.50, t + 0.09);
  }

  // ── 5. Witch Bells — four groups with mod sweep, sympathetic resonance, and decay trails ──
  witchBells() {
    const ctx = this._ctx;
    const vol = 0.007 + Math.random() * 0.003;

    const groups = [
      { freqBase: 160, freqRange: 100, count: 3, modRatio: 1.414 },  // low tolling
      { freqBase: 650, freqRange: 400, count: 4, modRatio: 2.756 },  // high answer
      { freqBase: 400, freqRange: 220, count: 5, modRatio: 1.618 },  // cluster (golden ratio)
      { freqBase: 250, freqRange: 180, count: 3, modRatio: 3.141 },  // deep resonance (pi ratio)
    ];

    let t = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi];
      for (let i = 0; i < grp.count; i++) {
        const freq = grp.freqBase + Math.random() * grp.freqRange;
        const dur = 1.8 + Math.random() * 2.8;
        const ct = ctx.currentTime + t;

        const mod = ctx.createOscillator();
        mod.frequency.setValueAtTime(freq * grp.modRatio, ct);
        mod.frequency.linearRampToValueAtTime(
          freq * grp.modRatio * (0.70 + Math.random() * 0.55), ct + dur);

        const modG = ctx.createGain();
        modG.gain.setValueAtTime(freq * 3.5, ct);
        modG.gain.exponentialRampToValueAtTime(1, ct + dur);
        mod.connect(modG);

        const car = ctx.createOscillator();
        car.type = 'sine';
        car.frequency.setValueAtTime(freq, ct);
        modG.connect(car.frequency);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, ct);
        g.gain.linearRampToValueAtTime(vol, ct + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
        car.connect(g).connect(this._out);
        mod.start(ct); car.start(ct);
        mod.stop(ct + dur + 0.1); car.stop(ct + dur + 0.1);

        // Sympathetic resonance — a second bell ringing in response
        if (Math.random() < 0.35) {
          const sympFreq = freq * (1.498 + Math.random() * 0.1);
          const sympDur = dur * 0.6;
          const sympT = ct + 0.15 + Math.random() * 0.25;
          const sympMod = ctx.createOscillator();
          sympMod.frequency.setValueAtTime(sympFreq * grp.modRatio * 0.9, sympT);
          const sympModG = ctx.createGain();
          sympModG.gain.setValueAtTime(sympFreq * 1.5, sympT);
          sympModG.gain.exponentialRampToValueAtTime(1, sympT + sympDur);
          sympMod.connect(sympModG);
          const sympCar = ctx.createOscillator();
          sympCar.type = 'sine';
          sympCar.frequency.setValueAtTime(sympFreq, sympT);
          sympModG.connect(sympCar.frequency);
          const sympG = ctx.createGain();
          sympG.gain.setValueAtTime(0.001, sympT);
          sympG.gain.linearRampToValueAtTime(vol * 0.25, sympT + 0.008);
          sympG.gain.exponentialRampToValueAtTime(0.001, sympT + sympDur);
          sympCar.connect(sympG).connect(this._out);
          sympMod.start(sympT); sympCar.start(sympT);
          sympMod.stop(sympT + sympDur + 0.1); sympCar.stop(sympT + sympDur + 0.1);
        }

        t += 0.45 + Math.random() * 1.3;
      }
      t += 0.80 + Math.random() * 1.3;
    }
  }

  // ── 6. Void Echo — 4-tier echoes, deep drone, wrong-pitch ghosts, and void whispers ──
  voidEcho() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.008 + Math.random() * 0.004;
    const count = 6 + Math.floor(Math.random() * 5); // 6–10
    let t = 0;

    // Persistent low drone beneath everything
    this._darkNote(P[1 + Math.floor(Math.random() * 3)], vol * 0.18, 0);
    // Second drone voice — detuned for beating
    this._darkNote(P[1 + Math.floor(Math.random() * 3)] * 1.004, vol * 0.10, 0.5);

    for (let i = 0; i < count; i++) {
      const idx = Math.max(0, Math.min(P.length - 1, 8 + Math.floor(Math.random() * 8)));
      const hz = P[idx];
      const noteVol = vol * (0.7 + Math.random() * 0.3);

      this._darkNote(hz, noteVol, t);
      // Four increasingly detuned echoes
      this._darkNote(hz * 1.001, noteVol * 0.30, t + 0.38 + Math.random() * 0.12);
      this._darkNote(hz * 0.999, noteVol * 0.15, t + 0.82 + Math.random() * 0.14);
      this._darkNote(hz * 1.002, noteVol * 0.07, t + 1.35 + Math.random() * 0.18);
      this._darkNote(hz * 0.998, noteVol * 0.03, t + 1.95 + Math.random() * 0.22);

      // Tritone ghost echo
      if (Math.random() < 0.35) {
        this._darkNote(hz * Math.pow(2, 6 / 12), noteVol * 0.12, t + 0.55 + Math.random() * 0.18);
      }

      // Minor second ghost — creeping dissonance
      if (Math.random() < 0.22) {
        this._darkNote(hz * Math.pow(2, 1 / 12), noteVol * 0.08, t + 1.0 + Math.random() * 0.20);
      }

      // Void whisper — very high, barely perceptible harmonic
      if (Math.random() < 0.25) {
        this._darkNote(hz * 4.01, noteVol * 0.04, t + 0.65);
      }

      // Drone re-anchor every 3rd note
      if (i % 3 === 0) {
        this._darkNote(P[Math.floor(Math.random() * 3)], vol * 0.12, t + 0.20);
      }

      t += 3.2 + Math.random() * 3.5;
    }

    // Final void — just the drone, everything else gone
    this._darkNote(P[1], vol * 0.15, t);
  }

  // ── 7. Grind Motor — full grind, half-time, breakdown, gear-change rebuild, and overload ──
  grindMotor() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.003;
    const rootIdx = Math.floor(Math.random() * 4);
    const root = P[rootIdx];
    const fifth    = root * 1.498;
    const minor3rd = root * 1.189;
    const flat7    = root * 1.782;
    const tritone  = root * Math.pow(2, 6 / 12);
    const tempo = 0.13 + Math.random() * 0.04;
    let t = 0;

    // Phase 1: full grind — cycling root/fifth/3rd/7th
    const beatsFull = 18 + Math.floor(Math.random() * 8);
    for (let i = 0; i < beatsFull; i++) {
      const accent = i % 4 === 0;
      const hz = [root, minor3rd, fifth, flat7][i % 4];
      this._darkNote(hz, vol * (accent ? 0.90 : 0.42), t);
      // Ghost double on accents
      if (accent && Math.random() < 0.4) {
        this._darkNote(hz * 1.003, vol * 0.15, t + tempo * 0.35);
      }
      t += tempo;
    }

    // Phase 2: half-time section — heavy, spaced out
    t += 0.20;
    for (let i = 0; i < 8; i++) {
      const accent = i % 2 === 0;
      const hz = accent ? root : fifth;
      this._darkNote(hz, vol * (accent ? 0.85 : 0.50), t);
      if (accent) this._darkNote(hz * 0.5, vol * 0.30, t + 0.02); // sub weight
      t += tempo * 2.2;
    }

    // Phase 3: breakdown — sudden sparse hits
    t += 0.30 + Math.random() * 0.35;
    for (let i = 0; i < 5; i++) {
      this._darkNote(root, vol * 0.48, t);
      // Tritone stab on last breakdown hit
      if (i === 4) this._darkNote(tritone, vol * 0.30, t + 0.03);
      t += 0.55 + Math.random() * 0.45;
    }

    // Phase 4: gear change — accelerating back
    t += 0.15;
    let gearTempo = tempo * 1.8;
    const gearBeats = 14 + Math.floor(Math.random() * 8);
    for (let i = 0; i < gearBeats; i++) {
      const accent = i % 4 === 0;
      const hz = accent ? root : (i % 3 === 0 ? minor3rd : fifth);
      this._darkNote(hz, vol * (accent ? 0.92 : 0.48), t);
      t += gearTempo;
      gearTempo = Math.max(tempo * 0.75, gearTempo * 0.93);
    }

    // Phase 5: overload — everything at once, then silence
    t += 0.05;
    this._darkNote(root * 0.25, vol * 0.35, t);
    this._darkNote(root * 0.5, vol * 0.75, t + 0.02);
    this._darkNote(root, vol * 0.55, t + 0.04);
    this._darkNote(fifth, vol * 0.40, t + 0.06);
    this._darkNote(minor3rd, vol * 0.30, t + 0.08);
  }

  // ── 8. Elder Chant — expanded choral voices with vowel morphing, harmonics, and unresolved finale ──
  eldrChant() {
    const ctx = this._ctx;
    const vol = 0.010 + Math.random() * 0.004;
    const vowels = [
      { f1: 830,  f2: 1170, f3: 2500 },  // "ah"
      { f1: 430,  f2: 980,  f3: 2500 },  // "oh"
      { f1: 330,  f2: 1260, f3: 2500 },  // "oo"
      { f1: 660,  f2: 1700, f3: 2500 },  // "ay"
      { f1: 280,  f2: 2230, f3: 2800 },  // "ee" — new, piercing
    ];
    const fundamentals = [52, 58, 65, 73, 82, 87];
    let t = 0;
    const syllableCount = 7 + Math.floor(Math.random() * 5);

    // Low drone voice throughout — the elder's constant murmur
    const droneFreq = fundamentals[0];
    const droneDur = syllableCount * 3.5;
    const droneCt = ctx.currentTime;
    const droneSrc = ctx.createOscillator();
    droneSrc.type = 'sawtooth';
    droneSrc.frequency.setValueAtTime(droneFreq, droneCt);
    const droneBp = ctx.createBiquadFilter();
    droneBp.type = 'bandpass'; droneBp.frequency.value = 330; droneBp.Q.value = 6;
    const droneG = ctx.createGain();
    droneG.gain.setValueAtTime(0.001, droneCt);
    droneG.gain.linearRampToValueAtTime(vol * 0.12, droneCt + 1.0);
    droneG.gain.setValueAtTime(vol * 0.12, droneCt + droneDur - 1.0);
    droneG.gain.exponentialRampToValueAtTime(0.001, droneCt + droneDur);
    droneSrc.connect(droneBp).connect(droneG).connect(this._out);
    droneSrc.start(droneCt); droneSrc.stop(droneCt + droneDur + 0.1);

    for (let i = 0; i < syllableCount; i++) {
      const fund = fundamentals[Math.floor(Math.random() * fundamentals.length)];
      const vIdx = Math.floor(Math.random() * vowels.length);
      const vowel = vowels[vIdx];
      const nextVowel = vowels[(vIdx + 1) % vowels.length];
      const dur = 2.0 + Math.random() * 3.0;
      const ct = ctx.currentTime + t;

      // Primary voice — glottal sawtooth with slow vibrato
      const src = ctx.createOscillator();
      src.type = 'sawtooth';
      src.frequency.setValueAtTime(fund, ct);
      const vib = ctx.createOscillator();
      vib.frequency.value = 4.0 + Math.random() * 2.5;
      const vibG = ctx.createGain();
      vibG.gain.setValueAtTime(0, ct);
      vibG.gain.linearRampToValueAtTime(fund * 0.022, ct + dur * 0.3);
      vib.connect(vibG).connect(src.frequency);
      vib.start(ct); vib.stop(ct + dur + 0.1);

      // Second choir voice — staggered, detuned
      if (Math.random() < 0.70) {
        const src2 = ctx.createOscillator();
        src2.type = 'sawtooth';
        src2.frequency.setValueAtTime(fund * (1 + (Math.random() - 0.5) * 0.05), ct + 0.09);
        for (const fFreq of [vowel.f1, vowel.f2]) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = fFreq; bp.Q.value = 10;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, ct + 0.09);
          g.gain.linearRampToValueAtTime(vol * 0.22, ct + 0.30);
          g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
          src2.connect(bp).connect(g).connect(this._out);
        }
        src2.start(ct + 0.09); src2.stop(ct + dur + 0.1);
      }

      // Third choir voice — fifth above, adds harmonic depth
      if (Math.random() < 0.40) {
        const src3 = ctx.createOscillator();
        src3.type = 'sawtooth';
        src3.frequency.setValueAtTime(fund * 1.498, ct + 0.15);
        const bp3 = ctx.createBiquadFilter();
        bp3.type = 'bandpass'; bp3.frequency.value = vowel.f1 * 1.3; bp3.Q.value = 8;
        const g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.001, ct + 0.15);
        g3.gain.linearRampToValueAtTime(vol * 0.14, ct + 0.40);
        g3.gain.exponentialRampToValueAtTime(0.001, ct + dur * 0.8);
        src3.connect(bp3).connect(g3).connect(this._out);
        src3.start(ct + 0.15); src3.stop(ct + dur + 0.1);
      }

      // Formant filters with vowel morph
      const formantPairs = [
        [vowel.f1, nextVowel.f1],
        [vowel.f2, nextVowel.f2],
        [vowel.f3, nextVowel.f3],
      ];
      for (let fi = 0; fi < formantPairs.length; fi++) {
        const [fStart, fEnd] = formantPairs[fi];
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(fStart, ct);
        bp.frequency.linearRampToValueAtTime(fEnd, ct + dur * 0.8);
        bp.Q.value = 12;
        const fVol = fi === 0 ? 0.50 : fi === 1 ? 0.35 : 0.18;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, ct);
        g.gain.linearRampToValueAtTime(vol * fVol, ct + 0.20);
        g.gain.setValueAtTime(vol * fVol, ct + dur * 0.60);
        g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
        src.connect(bp).connect(g).connect(this._out);
      }
      src.start(ct); src.stop(ct + dur + 0.1);

      t += dur + 0.4 + Math.random() * 1.5;
    }

    // Final syllable — rises without resolving, ominous
    if (Math.random() < 0.78) {
      const fund = fundamentals[fundamentals.length - 1];
      const ct = ctx.currentTime + t;
      const dur = 2.8;
      const src = ctx.createOscillator();
      src.type = 'sawtooth';
      src.frequency.setValueAtTime(fund, ct);
      src.frequency.linearRampToValueAtTime(fund * 1.18, ct + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 830; bp.Q.value = 8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(vol * 0.45, ct + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
      src.connect(bp).connect(g).connect(this._out);
      src.start(ct); src.stop(ct + dur + 0.1);
    }
  }

  // ── 9. Blood Moon — tritone melody with bass drone, ascending dread, and ritual ending ──
  bloodMoon() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const rootIdx = 6 + Math.floor(Math.random() * 6);
    const root = P[rootIdx];
    let t = 0;
    const count = 7 + Math.floor(Math.random() * 5);

    // Ominous bass drone throughout
    this._darkNote(root * 0.5, vol * 0.25, 0);

    for (let i = 0; i < count; i++) {
      const progress = i / count;
      const tritone = root * Math.pow(2, 6 / 12);
      const minor2nd = root * Math.pow(2, 1 / 12);
      // Volume builds with each iteration
      const iterVol = vol * (0.75 + progress * 0.25);

      this._darkNote(root, iterVol, t);
      t += 0.30 + Math.random() * 0.20;

      this._darkNote(tritone, iterVol * 0.85, t);
      t += 0.40 + Math.random() * 0.25;

      // Chromatic semitone crunch
      if (Math.random() < 0.65) {
        this._darkNote(minor2nd, iterVol * 0.48, t);
        t += 0.24 + Math.random() * 0.14;
      }

      // Higher tritone echo
      if (Math.random() < 0.45) {
        this._darkNote(tritone * 2, iterVol * 0.28, t + 0.06);
      }

      // Ascending chromatic figure in later iterations — rising dread
      if (progress > 0.5 && Math.random() < 0.40) {
        for (let s = 0; s < 3; s++) {
          this._darkNote(root * Math.pow(2, (s + 1) / 12), iterVol * 0.22, t + 0.15 * s);
        }
      }

      // Sub-bass pulse on every other phrase
      if (i % 2 === 0) {
        this._darkNote(root * 0.25, iterVol * 0.20, t + 0.08);
      }

      t += 1.1 + Math.random() * 1.4;
    }

    // Ritual ending — root and tritone stacked, then silence
    t += 0.2;
    this._darkNote(root * 0.5, vol * 0.45, t);
    this._darkNote(root, vol * 0.70, t + 0.03);
    this._darkNote(root * Math.pow(2, 6 / 12), vol * 0.55, t + 0.06);
    this._darkNote(root * 2, vol * 0.30, t + 0.09);
  }

  // ── 10. Chaos Cluster — dissonant bursts with escalating density and aftershock ──
  chaosCluster() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.008 + Math.random() * 0.003;
    const bursts = 4 + Math.floor(Math.random() * 3);
    let t = 0;

    for (let b = 0; b < bursts; b++) {
      const centerIdx = 8 + Math.floor(Math.random() * 8);
      // Each burst gets denser
      const notesInBurst = 4 + b + Math.floor(Math.random() * 5);
      const burstVol = vol * (0.70 + b * 0.08);

      for (let i = 0; i < notesInBurst; i++) {
        const offset = Math.floor(Math.random() * 7) - 3;
        const idx = Math.max(0, Math.min(P.length - 1, centerIdx + offset));
        const detune = (Math.random() - 0.5) * 0.05;
        this._darkNote(P[idx] * (1 + detune), burstVol * (0.30 + Math.random() * 0.50), t);
        // Occasional double-hit within burst
        if (Math.random() < 0.20) {
          this._darkNote(P[idx] * (1 - detune), burstVol * 0.18, t + 0.02);
        }
        t += 0.06 + Math.random() * 0.06;
      }

      // Resolving thud with sub weight
      t += 0.25 + Math.random() * 0.30;
      const thudIdx = Math.max(0, centerIdx - 4);
      this._darkNote(P[thudIdx], burstVol * 0.62, t);
      this._darkNote(P[Math.max(0, thudIdx - 3)], burstVol * 0.28, t + 0.03);

      // Aftershock — faint, scattered echoes of the burst
      if (Math.random() < 0.50) {
        for (let a = 0; a < 2 + Math.floor(Math.random() * 2); a++) {
          const aIdx = Math.max(0, Math.min(P.length - 1, centerIdx + Math.floor(Math.random() * 5) - 2));
          this._darkNote(P[aIdx], burstVol * 0.10, t + 0.4 + a * 0.25 + Math.random() * 0.15);
        }
      }

      t += 1.5 + Math.random() * 2.0;
    }

    // Final mega-cluster — all notes at once
    t += 0.3;
    for (let i = 0; i < 6; i++) {
      const idx = Math.max(0, Math.min(P.length - 1, 6 + Math.floor(Math.random() * 10)));
      this._darkNote(P[idx], vol * 0.35, t + i * 0.03);
    }
  }

  // ── 11. Grandma's Whisper — layered sub-bass with tremolo, breath overtones, and creaking ──
  grandmaWhisper() {
    const ctx = this._ctx;
    const vol = 0.013 + Math.random() * 0.005;
    const fundamentals = [27.5, 32.7, 36.7, 41.2];
    const count = 4 + Math.floor(Math.random() * 3);
    let t = 0;

    for (let i = 0; i < count; i++) {
      const fund = fundamentals[Math.floor(Math.random() * fundamentals.length)];
      const dur = 3.0 + Math.random() * 3.5;
      const ct = ctx.currentTime + t;

      // Sub-bass body with LFO tremolo
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fund, ct);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 2.5 + Math.random() * 2.5;
      const lfoG = ctx.createGain();
      lfoG.gain.value = vol * 0.35;
      lfo.connect(lfoG);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ct);
      g.gain.linearRampToValueAtTime(vol, ct + 0.6);
      g.gain.setValueAtTime(vol, ct + dur - 0.8);
      g.gain.linearRampToValueAtTime(0, ct + dur);
      lfoG.connect(g.gain);

      osc.connect(g).connect(this._out);
      lfo.start(ct); lfo.stop(ct + dur + 0.1);
      osc.start(ct); osc.stop(ct + dur + 0.1);

      // Detuned sub-bass layer — beating creates unease
      const osc1b = ctx.createOscillator();
      osc1b.type = 'sine';
      osc1b.frequency.setValueAtTime(fund * 1.008, ct);
      const g1b = ctx.createGain();
      g1b.gain.setValueAtTime(0, ct);
      g1b.gain.linearRampToValueAtTime(vol * 0.40, ct + 0.8);
      g1b.gain.setValueAtTime(vol * 0.40, ct + dur - 1.0);
      g1b.gain.linearRampToValueAtTime(0, ct + dur);
      osc1b.connect(g1b).connect(this._out);
      osc1b.start(ct); osc1b.stop(ct + dur + 0.1);

      // High "breath" overtone — ghostly
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(fund * 3 + Math.random() * 25, ct);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, ct);
      g2.gain.linearRampToValueAtTime(vol * 0.18, ct + 0.7);
      g2.gain.exponentialRampToValueAtTime(0.001, ct + dur * 0.75);
      osc2.connect(g2).connect(this._out);
      osc2.start(ct); osc2.stop(ct + dur);

      // Second breath — higher, more sibilant
      if (Math.random() < 0.55) {
        const osc3 = ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(fund * 5 + Math.random() * 40, ct + dur * 0.2);
        const g3 = ctx.createGain();
        g3.gain.setValueAtTime(0, ct + dur * 0.2);
        g3.gain.linearRampToValueAtTime(vol * 0.08, ct + dur * 0.35);
        g3.gain.exponentialRampToValueAtTime(0.001, ct + dur * 0.65);
        osc3.connect(g3).connect(this._out);
        osc3.start(ct + dur * 0.2); osc3.stop(ct + dur);
      }

      // Creak — filtered noise burst between some whispers
      if (Math.random() < 0.35 && i > 0) {
        const creakDur = 0.12 + Math.random() * 0.08;
        const creakT = ct - 0.15;
        const nBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * creakDur), ctx.sampleRate);
        const nd = nBuf.getChannelData(0);
        for (let j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
        const nSrc = ctx.createBufferSource();
        nSrc.buffer = nBuf;
        const nFilt = ctx.createBiquadFilter();
        nFilt.type = 'bandpass'; nFilt.frequency.value = 300 + Math.random() * 200; nFilt.Q.value = 12;
        const nG = ctx.createGain();
        nG.gain.setValueAtTime(vol * 0.15, creakT);
        nG.gain.exponentialRampToValueAtTime(0.001, creakT + creakDur);
        nSrc.connect(nFilt).connect(nG).connect(this._out);
        nSrc.start(creakT); nSrc.stop(creakT + creakDur + 0.01);
      }

      t += dur + 0.4 + Math.random() * 1.2;
    }
  }

  // ── 12. Abyssal Rumble — two waves of accelerating pulses with overtone build and massive crash ──
  abyssalRumble() {
    const ctx = this._ctx;
    const vol = 0.011 + Math.random() * 0.004;
    const baseFreq = 40 + Math.random() * 30;
    let t = 0;

    // Wave 1: slower, building
    const beats1 = 10 + Math.floor(Math.random() * 6);
    let tempo = 0.45;
    const accel = 0.94;

    for (let i = 0; i < beats1; i++) {
      const accent = i % 4 === 0;
      const freq = accent ? baseFreq : baseFreq * (1 + (i % 2) * 0.498);
      const ct = ctx.currentTime + t;
      const dur = 0.28 + Math.random() * 0.15;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ct);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.42, ct + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(vol * (accent ? 0.90 : 0.45), ct + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);

      osc.connect(g).connect(this._out);
      osc.start(ct); osc.stop(ct + dur + 0.1);

      // Overtone layer builds in later beats
      if (i > beats1 * 0.5) {
        const ot = ctx.createOscillator();
        ot.type = 'sine';
        ot.frequency.setValueAtTime(freq * 3, ct);
        ot.frequency.exponentialRampToValueAtTime(freq * 2, ct + dur * 0.5);
        const og = ctx.createGain();
        og.gain.setValueAtTime(vol * 0.12, ct);
        og.gain.exponentialRampToValueAtTime(0.001, ct + dur * 0.6);
        ot.connect(og).connect(this._out);
        ot.start(ct); ot.stop(ct + dur + 0.1);
      }

      t += tempo;
      tempo = Math.max(0.12, tempo * accel);
    }

    // Pause — the abyss exhales
    t += 0.6 + Math.random() * 0.5;
    this._darkNote(baseFreq * 0.5, vol * 0.35, t);
    t += 1.2 + Math.random() * 0.8;

    // Wave 2: faster, more intense, with sub-bass
    const beats2 = 14 + Math.floor(Math.random() * 8);
    tempo = 0.30;
    const accel2 = 0.92;

    for (let i = 0; i < beats2; i++) {
      const accent = i % 3 === 0;
      const freq = accent ? baseFreq : baseFreq * (1 + (i % 2) * 0.498);
      const ct = ctx.currentTime + t;
      const dur = 0.22 + Math.random() * 0.12;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ct);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.38, ct + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(vol * (accent ? 1.0 : 0.55), ct + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);

      osc.connect(g).connect(this._out);
      osc.start(ct); osc.stop(ct + dur + 0.1);

      // Sub-bass weight on accents
      if (accent) {
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(freq * 0.5, ct);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(vol * 0.30, ct);
        sg.gain.exponentialRampToValueAtTime(0.001, ct + dur * 1.5);
        sub.connect(sg).connect(this._out);
        sub.start(ct); sub.stop(ct + dur * 1.5 + 0.1);
      }

      t += tempo;
      tempo = Math.max(0.08, tempo * accel2);
    }

    // Massive final crash — layered
    this._darkNote(baseFreq * 0.25, vol * 0.50, t + 0.05);
    this._darkNote(baseFreq * 0.5, vol * 0.95, t + 0.08);
    this._darkNote(baseFreq, vol * 0.60, t + 0.12);
  }

  // ── 13. Sirenic Call — bright beginning warping into darkness with echo trails and bass pull ──
  sirenicCall() {
    const ctx = this._ctx;
    const vol = 0.009 + Math.random() * 0.003;
    const count = 7 + Math.floor(Math.random() * 4);
    let t = 0;

    for (let i = 0; i < count; i++) {
      const progress = i / count;
      const freq = 650 - progress * 480 + Math.random() * 80;
      const dur = 1.0 + Math.random() * 1.5;
      const ct = ctx.currentTime + t;

      // Modulation ratio grows more inharmonic
      const modRatio = 1.414 + progress * 6;
      const mod = ctx.createOscillator();
      mod.frequency.setValueAtTime(freq * modRatio, ct);
      // Modulator sweep — more complex FM spectrum
      mod.frequency.linearRampToValueAtTime(freq * modRatio * (0.8 + progress * 0.4), ct + dur);

      const modG = ctx.createGain();
      modG.gain.setValueAtTime(freq * 0.5, ct);
      modG.gain.linearRampToValueAtTime(freq * (1 + progress * 10), ct + dur * 0.35);
      modG.gain.exponentialRampToValueAtTime(1, ct + dur);
      mod.connect(modG);

      const car = ctx.createOscillator();
      car.type = progress > 0.45 ? 'sawtooth' : 'sine';
      car.frequency.setValueAtTime(freq, ct);
      modG.connect(car.frequency);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(vol * (1 - progress * 0.20), ct + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);

      car.connect(g).connect(this._out);
      mod.start(ct); car.start(ct);
      mod.stop(ct + dur + 0.1); car.stop(ct + dur + 0.1);

      // Echo trail — the siren's call reflecting
      if (Math.random() < 0.45) {
        const echoDur = dur * 0.5;
        const echoT = ct + 0.25 + Math.random() * 0.15;
        const echoMod = ctx.createOscillator();
        echoMod.frequency.setValueAtTime(freq * modRatio * 0.9, echoT);
        const echoModG = ctx.createGain();
        echoModG.gain.setValueAtTime(freq * 0.3, echoT);
        echoModG.gain.exponentialRampToValueAtTime(1, echoT + echoDur);
        echoMod.connect(echoModG);
        const echoCar = ctx.createOscillator();
        echoCar.type = 'sine';
        echoCar.frequency.setValueAtTime(freq * 1.002, echoT);
        echoModG.connect(echoCar.frequency);
        const echoG = ctx.createGain();
        echoG.gain.setValueAtTime(0.001, echoT);
        echoG.gain.linearRampToValueAtTime(vol * 0.18, echoT + 0.01);
        echoG.gain.exponentialRampToValueAtTime(0.001, echoT + echoDur);
        echoCar.connect(echoG).connect(this._out);
        echoMod.start(echoT); echoCar.start(echoT);
        echoMod.stop(echoT + echoDur + 0.1); echoCar.stop(echoT + echoDur + 0.1);
      }

      // Bass pull — the siren dragging you down
      if (progress > 0.4 && Math.random() < 0.50) {
        this._darkNote(freq * 0.25, vol * 0.18, t + 0.10);
      }

      t += 0.7 + Math.random() * 1.0;
    }

    // Final dark note — the siren consumed
    this._darkNote(80 + Math.random() * 30, vol * 0.40, t + 0.2);
  }

  // ── 14. Crypt Organ — slow doom-chord progression with pedal bass, tremulant, and dust ──
  cryptOrgan() {
    const ctx = this._ctx;
    const vol = 0.008 + Math.random() * 0.003;
    const roots = [65.4, 73.4, 87.3, 98.0];
    const root = roots[Math.floor(Math.random() * roots.length)];

    // Chord shapes: i – bVII – bVI – v – iv
    const chords = [
      [0, 3, 7],    // i
      [-2, 1, 5],   // bVII
      [-4, -1, 3],  // bVI
      [-5, -2, 2],  // v
      [-5, 0, 3],   // iv
    ];
    const progression = Math.random() < 0.35
      ? [0, 1, 2, 3, 4, 0]
      : Math.random() < 0.5
        ? [0, 2, 1, 3, 0]
        : [0, 4, 2, 3, 1, 0];

    let t = 0;

    // Pedal bass drone throughout — the organ's lowest pipe
    const pedalDur = progression.length * 2.5;
    const pedalCt = ctx.currentTime;
    const pedalOsc = ctx.createOscillator();
    pedalOsc.type = 'square';
    pedalOsc.frequency.setValueAtTime(root * 0.5, pedalCt);
    const pedalLp = ctx.createBiquadFilter();
    pedalLp.type = 'lowpass'; pedalLp.frequency.value = root; pedalLp.Q.value = 0.5;
    const pedalG = ctx.createGain();
    pedalG.gain.setValueAtTime(0.001, pedalCt);
    pedalG.gain.linearRampToValueAtTime(vol * 0.15, pedalCt + 0.5);
    pedalG.gain.setValueAtTime(vol * 0.15, pedalCt + pedalDur - 0.5);
    pedalG.gain.exponentialRampToValueAtTime(0.001, pedalCt + pedalDur);
    pedalOsc.connect(pedalLp).connect(pedalG).connect(this._out);
    pedalOsc.start(pedalCt); pedalOsc.stop(pedalCt + pedalDur + 0.1);

    for (let ci = 0; ci < progression.length; ci++) {
      const chordIdx = progression[ci];
      const chord = chords[chordIdx];
      const dur = 1.8 + Math.random() * 1.2;
      const ct = ctx.currentTime + t;
      // Volume arc — swell mid-progression
      const chordArc = Math.sin(Math.PI * ci / progression.length);
      const chordVol = vol * (0.80 + chordArc * 0.20);

      for (const semi of chord) {
        const freq = root * Math.pow(2, semi / 12);

        // Main organ voice
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ct);
        osc.detune.setValueAtTime((Math.random() - 0.5) * 12, ct);

        // Tremulant — slow amplitude modulation like a real pipe organ
        const trem = ctx.createOscillator();
        trem.frequency.value = 5.5 + Math.random() * 1.5;
        const tremG = ctx.createGain();
        tremG.gain.value = chordVol * 0.06;
        trem.connect(tremG);

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = freq * 3.5;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, ct);
        g.gain.linearRampToValueAtTime(chordVol * 0.35, ct + 0.08);
        g.gain.setValueAtTime(chordVol * 0.35, ct + dur - 0.30);
        g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
        tremG.connect(g.gain);

        osc.connect(lp).connect(g).connect(this._out);
        trem.start(ct); trem.stop(ct + dur + 0.1);
        osc.start(ct); osc.stop(ct + dur + 0.1);

        // Second rank — detuned octave above for fullness
        if (Math.random() < 0.45) {
          const osc2 = ctx.createOscillator();
          osc2.type = 'square';
          osc2.frequency.setValueAtTime(freq * 2.003, ct);
          const lp2 = ctx.createBiquadFilter();
          lp2.type = 'lowpass'; lp2.frequency.value = freq * 4;
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.001, ct);
          g2.gain.linearRampToValueAtTime(chordVol * 0.12, ct + 0.10);
          g2.gain.setValueAtTime(chordVol * 0.12, ct + dur - 0.35);
          g2.gain.exponentialRampToValueAtTime(0.001, ct + dur);
          osc2.connect(lp2).connect(g2).connect(this._out);
          osc2.start(ct); osc2.stop(ct + dur + 0.1);
        }
      }

      t += dur + 0.15 + Math.random() * 0.35;
    }

    // Dust settling — faint noise after the last chord
    const dustDur = 0.3 + Math.random() * 0.2;
    const dustT = ctx.currentTime + t;
    const dustBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dustDur), ctx.sampleRate);
    const dd = dustBuf.getChannelData(0);
    for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    const dustSrc = ctx.createBufferSource();
    dustSrc.buffer = dustBuf;
    const dustFilt = ctx.createBiquadFilter();
    dustFilt.type = 'lowpass'; dustFilt.frequency.value = 400;
    const dustG = ctx.createGain();
    dustG.gain.setValueAtTime(vol * 0.08, dustT);
    dustG.gain.exponentialRampToValueAtTime(0.001, dustT + dustDur);
    dustSrc.connect(dustFilt).connect(dustG).connect(this._out);
    dustSrc.start(dustT); dustSrc.stop(dustT + dustDur + 0.01);
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
  }

  // ═══════════════════════════════════════════════════════════
  //  NOTE RENDERER — delicate piano-like tone (normal mode)
  // ═══════════════════════════════════════════════════════════

  _note(freq, volume = 0.010, delay = 0) {
    const ctx = this._ctx;
    const t = ctx.currentTime + delay;
    const dur = 5.0 + Math.random() * 5.0;                    // 5–10 s — C418-style long sustain
    const out = this._out;

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
