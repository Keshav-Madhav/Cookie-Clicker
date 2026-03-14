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

  /** Set apocalypse mode: 0 = normal, 1-3 = stage. Changes note pool and composition list. */
  setApocalypseMode(stage) {
    this._apocalypseMode = stage;
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
    // Apocalypse: shorter gaps, more frequent, more urgent
    const stage = this._apocalypseMode || 0;
    const minDelay = stage >= 3 ? 2000 : stage >= 2 ? 3000 : stage >= 1 ? 4000 : 5000;
    const maxExtra = stage >= 3 ? 5000 : stage >= 2 ? 7000 : stage >= 1 ? 9000 : 12000;
    const delay = minDelay + Math.random() * maxExtra;
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
      // Stage 2-3: only dark compositions
      list = GameMusic._DARK_COMPOSITIONS;
    } else if (stage === 1) {
      // Stage 1: mix of normal and dark (50/50)
      list = Math.random() < 0.5 ? GameMusic._DARK_COMPOSITIONS : GameMusic._COMPOSITIONS;
    } else {
      list = GameMusic._COMPOSITIONS;
    }
    const name = list[Math.floor(Math.random() * list.length)];
    this._currentName = GameMusic._DISPLAY_NAMES[name] || name;
    this[name]();
  }

  // ─── helper: clamp index into pool ──────────────────────────

  _ci(i) { return Math.max(0, Math.min(i, GameMusic.POOL.length - 1)); }

  // ═══════════════════════════════════════════════════════════
  //  COMPOSITIONS
  // ═══════════════════════════════════════════════════════════

  // ── 1. Gentle Arc — two mirrored arcs with dynamic swell and occasional harmony ──

  gentleArc() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    const ascending = Math.random() > 0.4;
    let idx = 3 + Math.floor(Math.random() * (P.length - 6));
    let t = 0;

    for (let arc = 0; arc < 2; arc++) {
      const count = 7 + Math.floor(Math.random() * 7);
      const dir = arc === 0 ? ascending : !ascending;

      for (let i = 0; i < count; i++) {
        // Volume swells to peak at midpoint of each arc
        const swell = Math.sin(Math.PI * i / count);
        const noteVol = vol * (0.5 + swell * 0.5);

        this._note(P[idx], noteVol, t);

        // Occasional harmony a third above — adds warmth without cluttering
        if (Math.random() < 0.22) {
          this._note(P[this._ci(idx + 2)], noteVol * 0.32, t + 0.02);
        }

        t += 0.45 + Math.random() * 0.95;
        if (i > 0 && i % 4 === 0) t += 0.5 + Math.random() * 0.9;

        const first = i < count / 2;
        const up = dir ? first : !first;
        if (up) idx = this._ci(idx + (Math.random() < 0.7 ? 1 : 2));
        else     idx = this._ci(idx - (Math.random() < 0.7 ? 1 : 2));
      }

      // Breath between arcs
      t += 1.8 + Math.random() * 2.0;
    }
  }

  // ── 2. Call & Response — motif, two answers, final coda ──

  callAndResponse() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    const len = 3 + Math.floor(Math.random() * 3);
    const start = 4 + Math.floor(Math.random() * (P.length - 8));
    let t = 0;

    // Build and play the "call" motif
    const motif = [];
    let idx = start;
    for (let i = 0; i < len; i++) {
      motif.push(idx);
      this._note(P[idx], vol * (0.7 + Math.random() * 0.3), t);
      t += 0.45 + Math.random() * 0.55;
      idx = this._ci(idx + 1);
    }

    // First response — shifted up or down
    t += 1.1 + Math.random() * 1.4;
    const shift = Math.random() > 0.5 ? 2 : -1;
    for (let i = 0; i < len; i++) {
      const ri = Math.random() > 0.3 ? motif[i] + shift : motif[len - 1 - i] + shift;
      this._note(P[this._ci(ri)], vol * (0.6 + Math.random() * 0.4), t);
      t += 0.45 + Math.random() * 0.55;
    }

    // Second response — further shift, shorter and softer, like a distant echo
    t += 1.4 + Math.random() * 1.5;
    const shift2 = shift > 0 ? shift + 2 : shift - 2;
    const len2 = Math.max(2, len - 1);
    for (let i = 0; i < len2; i++) {
      this._note(P[this._ci(motif[i] + shift2)], vol * (0.38 + Math.random() * 0.25), t);
      t += 0.35 + Math.random() * 0.45;
    }

    // Coda — a gentle three-note resolution back home
    t += 0.9 + Math.random() * 1.0;
    const c = start + Math.floor(Math.random() * 3);
    this._note(P[this._ci(c)], vol * 0.55, t);
    t += 0.8 + Math.random() * 0.6;
    this._note(P[this._ci(c + 2)], vol * 0.42, t);
    t += 0.65 + Math.random() * 0.5;
    this._note(P[this._ci(c)], vol * 0.28, t);
  }

  // ── 3. Falling Leaves — descent with catches, flutter pairs, and fading volume ──

  fallingLeaves() {
    const P = GameMusic.POOL;
    const count = 11 + Math.floor(Math.random() * 8);
    const vol = 0.009 + Math.random() * 0.005;
    let idx = this._ci(Math.floor(P.length * 0.65 + Math.random() * P.length * 0.25));
    let t = 0;

    for (let i = 0; i < count; i++) {
      // Volume fades gently as leaves settle
      const noteVol = vol * (0.55 + 0.45 * (1 - i / count)) * (0.6 + Math.random() * 0.4);
      this._note(P[idx], noteVol, t);

      // Occasional high sparkle "catch" before continuing the fall
      if (Math.random() < 0.2) {
        this._note(P[this._ci(idx + 2)], noteVol * 0.3, t + 0.18 + Math.random() * 0.12);
      }

      // Flutter pair — two notes in quick succession
      if (Math.random() < 0.18) {
        const flutter = this._ci(idx + (Math.random() < 0.5 ? 1 : -1));
        this._note(P[flutter], noteVol * 0.4, t + 0.28 + Math.random() * 0.14);
      }

      t += 0.55 + Math.random() * 0.85;
      if (i % 3 === 2) t += 0.4 + Math.random() * 0.65;

      // Mostly falls, occasionally catches briefly
      const r = Math.random();
      if (r < 0.70)       idx = this._ci(idx - 1);
      else if (r < 0.85)  idx = this._ci(idx + 1);
      // else: repeat (leaf hovering)
    }
  }

  // ── 4. Spread Arpeggio — chord fans with counter-voice and peak stab ──

  spreadArpeggio() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const root = 2 + Math.floor(Math.random() * 4);
    const tones = [root, root + 2, root + 4, root + 7];
    if (Math.random() > 0.35) tones.push(root + 9);

    let t = 0;
    const passes = 3 + Math.floor(Math.random() * 2); // 3–4 passes
    for (let p = 0; p < passes; p++) {
      const order = p % 2 === 0 ? [...tones] : [...tones].reverse();
      for (let n = 0; n < order.length; n++) {
        const mainVol = vol * (0.55 + Math.random() * 0.45);
        this._note(P[this._ci(order[n])], mainVol, t);

        // On the last pass, a counter-voice moves in the opposite direction
        if (p === passes - 1 && Math.random() < 0.35) {
          const contra = this._ci(order[n] + (p % 2 === 0 ? -2 : 2));
          this._note(P[contra], mainVol * 0.28, t + 0.07);
        }

        t += 0.65 + Math.random() * 0.8;
      }

      // Brief chord stab at the top of each sweep
      const peak = this._ci(Math.max(...order));
      this._note(P[peak], vol * 0.48, t);
      this._note(P[this._ci(peak - 2)], vol * 0.28, t + 0.03);
      t += 1.1 + Math.random() * 1.4;
    }
  }

  // ── 5. Lullaby — rocking 3-feel with bass anchors and high sparkles ──

  lullaby() {
    const P = GameMusic.POOL;
    const count = 11 + Math.floor(Math.random() * 6);
    const vol = 0.007 + Math.random() * 0.004;
    let idx = 5 + Math.floor(Math.random() * (P.length - 8));
    let t = 0;

    for (let i = 0; i < count; i++) {
      // Gentle volume swell — peaks around midpoint
      const swell = Math.sin(Math.PI * i / count + 0.3);
      const noteVol = vol * (0.45 + swell * 0.55);

      this._note(P[idx], noteVol, t);

      // Rocking bass anchor every 3rd note — low warmth
      if (i % 3 === 0 && idx > 3) {
        this._note(P[this._ci(idx - 3)], noteVol * 0.38, t + 0.05);
      }

      // High sparkle on occasional downbeats — a little star blink
      if (i % 4 === 0 && Math.random() < 0.4 && idx < P.length - 5) {
        this._note(P[this._ci(idx + 5)], noteVol * 0.22, t + 0.32 + Math.random() * 0.15);
      }

      // Rocking feel: alternate long-short gaps (3/4 lilt)
      t += (i % 2 === 0) ? 1.0 + Math.random() * 0.55 : 0.65 + Math.random() * 0.45;

      if (i % 2 === 0) idx = this._ci(idx + (Math.random() < 0.6 ? 1 : 2));
      else              idx = this._ci(idx - 1);
    }

    // Final held note — the baby's asleep
    t += 0.5 + Math.random() * 0.4;
    this._note(P[this._ci(idx)], vol * 0.35, t);
  }

  // ── 6. Free Wander — three-section journey: neutral, drift away, return home ──

  freeWander() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    let idx = 5 + Math.floor(Math.random() * (P.length - 10));
    const home = idx;
    let t = 0;

    // 3 sections: neutral meander | wander away | drift back
    for (let sec = 0; sec < 3; sec++) {
      const count = 5 + Math.floor(Math.random() * 7);

      for (let i = 0; i < count; i++) {
        this._note(P[idx], vol * (0.6 + Math.random() * 0.4), t);
        t += 0.5 + Math.random() * 1.0;
        if (Math.random() < 0.18) t += 0.8 + Math.random() * 1.2;
        if (i > 0 && i % 4 === 0) t += 0.4 + Math.random() * 0.8;

        const r = Math.random();
        if (sec === 1) {
          // Wandering away — biased upward
          if (r < 0.55)      idx = this._ci(idx + 1);
          else if (r < 0.80) idx = this._ci(idx - 1);
          else                idx = this._ci(idx + 2);
        } else if (sec === 2) {
          // Returning home — gravitates toward start
          const towardHome = idx > home ? -1 : 1;
          if (r < 0.55)      idx = this._ci(idx + towardHome);
          else if (r < 0.80) idx = this._ci(idx - towardHome);
          else                idx = this._ci(idx + towardHome * 2);
        } else {
          // Neutral wander
          if (r < 0.40)      idx = this._ci(idx + 1);
          else if (r < 0.72) idx = this._ci(idx - 1);
          else if (r < 0.85) idx = this._ci(idx + 2 + Math.floor(Math.random() * 2));
        }

        if (idx < 2) idx = this._ci(idx + 1);
        if (idx > P.length - 2) idx = this._ci(idx - 1);
      }

      // Longer breath between sections
      t += 1.5 + Math.random() * 2.0;
    }
  }

  // ── 7. Ripple — expands out then contracts back to center ──

  ripple() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.005;
    const center = 5 + Math.floor(Math.random() * (P.length - 10));
    const maxRings = 5 + Math.floor(Math.random() * 3); // 5–7
    let t = 0;

    // Drop the stone — center note
    this._note(P[center], vol, t);
    t += 0.7 + Math.random() * 0.5;

    // Expanding phase
    for (let r = 1; r <= maxRings; r++) {
      const lo = this._ci(center - r);
      const hi = this._ci(center + r);
      const softer = vol * (0.45 + 0.55 / (r + 1));

      if (r % 2 === 0) {
        this._note(P[hi], softer * (0.7 + Math.random() * 0.3), t);
        t += 0.27 + Math.random() * 0.27;
        this._note(P[lo], softer * (0.7 + Math.random() * 0.3), t);
      } else {
        this._note(P[lo], softer * (0.7 + Math.random() * 0.3), t);
        t += 0.27 + Math.random() * 0.27;
        this._note(P[hi], softer * (0.7 + Math.random() * 0.3), t);
      }
      t += 0.48 + Math.random() * 0.55;
    }

    // Silence — ripple travels across the pond
    t += 0.9 + Math.random() * 1.2;

    // Contracting phase — returning inward, softer
    for (let r = maxRings; r >= 1; r--) {
      const lo = this._ci(center - r);
      const hi = this._ci(center + r);
      const faint = vol * (0.15 + 0.15 / r);

      if (r % 2 === 0) {
        this._note(P[lo], faint * (0.6 + Math.random() * 0.4), t);
        t += 0.22 + Math.random() * 0.20;
        this._note(P[hi], faint * (0.6 + Math.random() * 0.4), t);
      } else {
        this._note(P[hi], faint * (0.6 + Math.random() * 0.4), t);
        t += 0.22 + Math.random() * 0.20;
        this._note(P[lo], faint * (0.6 + Math.random() * 0.4), t);
      }
      t += 0.38 + Math.random() * 0.42;
    }

    // Center returns — barely a whisper
    t += 0.3 + Math.random() * 0.4;
    this._note(P[center], vol * 0.4, t);
  }

  // ── 8. Music Box — A pattern repeated, B section, crescendo then fade ──

  musicBox() {
    const P = GameMusic.POOL;
    const vol = 0.008 + Math.random() * 0.004;
    const baseIdx = 7 + Math.floor(Math.random() * 5);
    const patLen = 4 + Math.floor(Math.random() * 3);

    // Build pattern A
    const patternA = [];
    let idx = baseIdx;
    for (let i = 0; i < patLen; i++) {
      patternA.push(idx);
      const step = Math.random() < 0.6 ? 1 : (Math.random() < 0.5 ? 2 : -1);
      idx = this._ci(idx + step);
    }

    // Pattern B — a stepwise descent variation
    const patternB = patternA.map(n => this._ci(n - 1 - Math.floor(Math.random() * 2)));

    let t = 0;
    const totalReps = 4 + Math.floor(Math.random() * 3); // 4–6 repeats total

    for (let rep = 0; rep < totalReps; rep++) {
      // Middle rep is the B section
      const useB = rep === Math.floor(totalReps / 2);
      const pat = useB ? patternB : patternA;

      // Volume arc: swell to midpoint, then gently decay
      const progress = rep / totalReps;
      const repVol = vol * (progress < 0.5
        ? 0.55 + progress * 0.90
        : 1.0 - (progress - 0.5) * 0.5);

      for (let i = 0; i < pat.length; i++) {
        let ni = pat[i];
        if (rep > 0 && Math.random() < 0.12) ni = this._ci(ni + (Math.random() < 0.5 ? 1 : -1));
        this._note(P[ni], repVol * (0.6 + Math.random() * 0.4), t);
        t += 0.27 + Math.random() * 0.20;
      }
      t += 0.45 + Math.random() * 0.65;
    }
  }

  // ── 9. Cascade — alternating descending/ascending runs with harmonic landing ──

  cascade() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.005;
    const rounds = 3 + Math.floor(Math.random() * 3); // 3–5 cascades
    let t = 0;

    for (let r = 0; r < rounds; r++) {
      // Alternate descending and ascending runs — adds variety
      const descending = (r % 2 === 0 || Math.random() < 0.65);
      let idx = descending
        ? this._ci(P.length - 2 - Math.floor(Math.random() * 5))
        : this._ci(1 + Math.floor(Math.random() * 5));
      const runLen = 5 + Math.floor(Math.random() * 5);

      // Later runs get slightly faster
      const speed = r < rounds / 2
        ? 0.17 + Math.random() * 0.10
        : 0.11 + Math.random() * 0.07;

      for (let i = 0; i < runLen; i++) {
        this._note(P[idx], vol * (0.33 + Math.random() * 0.28), t);
        t += speed;
        idx = this._ci(descending ? idx - 1 : idx + 1);
      }

      // Landing note — held and full
      t += 0.08;
      this._note(P[idx], vol * (0.75 + Math.random() * 0.25), t);

      // Harmony on the landing — adds resonance
      if (Math.random() < 0.48) {
        this._note(P[this._ci(idx + 2)], vol * 0.33, t + 0.04);
      }

      t += 2.3 + Math.random() * 2.2;
    }
  }

  // ── 10. Echo Reflection — two echo tiers and a final merging chord ──

  echoReflection() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    const count = 7 + Math.floor(Math.random() * 5); // 7–11
    let idx = 3 + Math.floor(Math.random() * (P.length - 8));
    let t = 0;

    for (let i = 0; i < count; i++) {
      const mainVol = vol * (0.6 + Math.random() * 0.4);

      // Main note
      this._note(P[idx], mainVol, t);

      // First echo — 5 steps up (pentatonic octave), softer
      this._note(P[this._ci(idx + 5)], mainVol * 0.27, t + 0.30 + Math.random() * 0.18);

      // Second echo — 10 steps up (two octaves), very faint
      if (Math.random() < 0.60) {
        this._note(P[this._ci(idx + 10)], mainVol * 0.10, t + 0.62 + Math.random() * 0.18);
      }

      // Occasional alternative interval echo — fourth or sixth
      if (Math.random() < 0.25) {
        const altEcho = this._ci(idx + (Math.random() < 0.5 ? 3 : 4));
        this._note(P[altEcho], mainVol * 0.16, t + 0.44 + Math.random() * 0.14);
      }

      t += 1.1 + Math.random() * 0.85;

      const r = Math.random();
      if (r < 0.45)      idx = this._ci(idx + 1);
      else if (r < 0.80) idx = this._ci(idx - 1);
      else                idx = this._ci(idx + 2);
    }

    // Final chord where all echoes merge — root + third + fifth
    t += 0.8 + Math.random() * 0.7;
    this._note(P[idx], vol * 0.48, t);
    this._note(P[this._ci(idx + 2)], vol * 0.28, t + 0.03);
    this._note(P[this._ci(idx + 4)], vol * 0.18, t + 0.06);
  }

  // ── 11. Starlight — volume arc, low pedal tones, occasional clusters ──

  starlight() {
    const P = GameMusic.POOL;
    const vol = 0.006 + Math.random() * 0.004;
    const count = 11 + Math.floor(Math.random() * 8); // 11–18 twinkles
    let t = 0;

    for (let i = 0; i < count; i++) {
      // Volume swells to a gentle peak then fades — like eyes adjusting
      const arc = Math.sin(Math.PI * i / count);
      const noteVol = vol * (0.35 + arc * 0.65);

      const idx = this._ci(Math.floor(P.length * 0.5) + Math.floor(Math.random() * (P.length * 0.5)));
      this._note(P[idx], noteVol * (0.5 + Math.random() * 0.5), t);

      // Quick pair twinkle
      if (Math.random() < 0.28) {
        t += 0.20 + Math.random() * 0.20;
        this._note(P[this._ci(idx + (Math.random() < 0.5 ? 1 : -1))], noteVol * 0.5, t);
      }

      // Three-star cluster near the peak
      if (i > count * 0.38 && i < count * 0.65 && Math.random() < 0.20) {
        t += 0.16 + Math.random() * 0.14;
        this._note(P[this._ci(idx + 2)], noteVol * 0.32, t);
      }

      // Deep pedal tone — a low anchor star every 5th note
      if (i % 5 === 0 && Math.random() < 0.5) {
        this._note(P[this._ci(2 + Math.floor(Math.random() * 4))], vol * 0.28, t + 0.06);
      }

      t += 1.4 + Math.random() * 2.6;
    }
  }

  // ── 12. Hymn — A-A-B-A structure with bass, harmony, and "Amen" cadence ──

  hymn() {
    const P = GameMusic.POOL;
    const vol = 0.011 + Math.random() * 0.004;
    let idx = 4 + Math.floor(Math.random() * 4);
    const homeIdx = idx;
    let t = 0;

    // 4 bars: A – A – B – A
    for (let bar = 0; bar < 4; bar++) {
      const isB = bar === 2;
      if (isB) idx = this._ci(homeIdx + 2); // B section steps up a third

      for (let beat = 0; beat < 4; beat++) {
        this._note(P[idx], vol * (0.6 + Math.random() * 0.4), t);

        // Harmony on strong beats — third or fifth above
        if (beat % 2 === 0 && Math.random() < 0.52) {
          this._note(P[this._ci(idx + 2)], vol * 0.36, t + 0.02);
        }

        // Bass note on beat 1 of each bar — grounding the chord
        if (beat === 0 && idx > 4) {
          this._note(P[this._ci(idx - 4)], vol * 0.28, t + 0.04);
        }

        t += 0.85 + Math.random() * 0.60;

        const r = Math.random();
        if (isB) {
          if (r < 0.50)      idx = this._ci(idx + 1);
          else if (r < 0.75) idx = this._ci(idx - 1);
          else                idx = this._ci(idx + 2);
        } else {
          if (r < 0.40)       idx = this._ci(idx + 1);
          else if (r < 0.75)  idx = this._ci(idx - 1);
          else if (r < 0.88)  idx = this._ci(idx + 2);
        }
      }

      t += 0.65 + Math.random() * 0.95;
      if (isB) idx = homeIdx; // return home after B
    }

    // "Amen" cadence — IV → I
    t += 0.25;
    this._note(P[this._ci(homeIdx + 3)], vol * 0.58, t);       // IV
    this._note(P[this._ci(homeIdx + 5)], vol * 0.38, t + 0.04);
    t += 1.1 + Math.random() * 0.55;
    this._note(P[homeIdx], vol * 0.68, t);                       // I
    this._note(P[this._ci(homeIdx + 2)], vol * 0.42, t + 0.04);
    this._note(P[this._ci(homeIdx + 4)], vol * 0.28, t + 0.08);
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
    const dur = 1.8 + Math.random() * 2.5;                    // slightly longer
    const out = this._out;

    // Pitch-drop at attack — metal/industrial character (string hitting the fret)
    const pitchDrop = 1.015 + Math.random() * 0.015;

    // Sawtooth fundamental — harsh, overdriven
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * pitchDrop, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);

    // Waveshaper — soft clip (tanh)
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 2.8);
    }
    ws.curve = curve;
    ws.oversample = '2x';

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.018);
    g.gain.setTargetAtTime(volume * 0.42, t + 0.14, 0.52);
    g.gain.setTargetAtTime(0.001, t + dur * 0.52, dur * 0.26);

    // Low-pass — warm but gritty; sweeps down after attack
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 5, t);
    lp.frequency.setTargetAtTime(freq * 1.4, t + 0.08, dur * 0.28);
    lp.Q.value = 1.8;

    osc.connect(ws).connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.35);

    // Detuned unison — chorus thickness
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.006, t);
    osc2.frequency.exponentialRampToValueAtTime(freq * 1.001, t + 0.04);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(volume * 0.42, t + 0.028);
    g2.gain.setTargetAtTime(0.001, t + dur * 0.42, dur * 0.22);
    osc2.connect(lp);
    osc2.connect(g2).connect(out);
    osc2.start(t);
    osc2.stop(t + dur + 0.35);

    // Sub-octave sine — physical low-end weight for lower frequencies
    if (freq < 300) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq * 0.5, t);
      const gs = ctx.createGain();
      gs.gain.setValueAtTime(0.001, t);
      gs.gain.linearRampToValueAtTime(volume * 0.28, t + 0.025);
      gs.gain.setTargetAtTime(0.001, t + dur * 0.35, dur * 0.20);
      sub.connect(gs).connect(out);
      sub.start(t); sub.stop(t + dur + 0.2);
    }
  }

  // ── 1. Dark Drone — layered minor cluster with pitch wobble and sub-octave ──
  darkDrone() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const rootIdx = Math.floor(Math.random() * 5);
    const root = P[rootIdx];

    // Sub-octave foundation — deep, physical
    this._darkNote(root * 0.5, vol * 0.45, 0);

    // Root — with micro-drift to simulate feedback wobble
    this._darkNote(root, vol, 0.1);
    this._darkNote(root * 1.003, vol * 0.45, 0.9 + Math.random() * 0.4);  // drift sharp
    this._darkNote(root * 0.997, vol * 0.35, 1.8 + Math.random() * 0.5);  // drift flat

    // Minor third — menacing warmth
    this._darkNote(root * 1.189, vol * 0.62, 0.4 + Math.random() * 0.4);

    // Fifth — stability that somehow still unsettles
    this._darkNote(root * 1.498, vol * 0.42, 1.0 + Math.random() * 0.6);

    // Flat seventh — adds dread
    this._darkNote(root * 1.782, vol * 0.32, 1.6 + Math.random() * 0.8);

    // Dissonant cluster that slowly drifts in
    if (Math.random() < 0.7) {
      const dis = root * (1 + Math.random() * 0.07);
      this._darkNote(dis, vol * 0.22, 2.4 + Math.random() * 1.5);
      this._darkNote(dis * 1.012, vol * 0.12, 3.2 + Math.random() * 1.5);
    }

    // High whine — like feedback squealing
    if (Math.random() < 0.55) {
      this._darkNote(root * 4, vol * 0.07, 1.2 + Math.random() * 1.0);
    }
  }

  // ── 2. Tense Pulse — four phases: sparse intro, full pattern, breakdown, buildup ──
  tensePulse() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.011 + Math.random() * 0.004;
    const rootIdx = 3 + Math.floor(Math.random() * 6);
    const root = P[rootIdx];
    const fifth     = root * 1.498;
    const minor3rd  = root * 1.189;

    const phases = [
      { pat: [1,0,0,1,0,1,0,0],                         volMult: 0.55 }, // sparse
      { pat: [1,0,1,1,0,1,0,1,1,0,0,1,1,1,0,1],         volMult: 0.80 }, // full
      { pat: [1,0,0,0,1,0,0,0,1,0,1,0,0,0,1,0],         volMult: 0.50 }, // breakdown
      { pat: [1,1,0,1,1,1,0,1,1,1,1,0,1,1,1,1],         volMult: 1.00 }, // dense buildup
    ];

    const interval = 0.16 + Math.random() * 0.06;
    let t = 0;

    for (const phase of phases) {
      for (let i = 0; i < phase.pat.length; i++) {
        if (phase.pat[i]) {
          const hz = (i % 5 === 0) ? fifth : (i % 7 === 0) ? minor3rd : root;
          this._darkNote(hz, vol * phase.volMult * (0.5 + Math.random() * 0.35), t);
        }
        t += interval;
      }
      t += 0.28 + Math.random() * 0.35;
    }

    // Final resolving crash
    this._darkNote(root * 0.5, vol * 0.88, t + 0.1);
    this._darkNote(root, vol * 0.60, t + 0.14);
  }

  // ── 3. Haunted Arpeggio — more passes, escalating wrong notes, chromatic descent ──
  hauntedArpeggio() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const rootIdx = 6 + Math.floor(Math.random() * 6);
    let t = 0;
    const intervals = [0, 3, 5, 7, 10, 12];
    const passes = 3 + Math.floor(Math.random() * 3); // 3–5

    for (let p = 0; p < passes; p++) {
      const order = p % 2 === 0 ? intervals : [...intervals].reverse();

      for (const semi of order) {
        let hz = P[rootIdx] * Math.pow(2, semi / 12);
        // Wrong note probability escalates with each pass
        const wrongChance = 0.10 + p * 0.07;
        if (Math.random() < wrongChance) hz *= Math.pow(2, (Math.random() < 0.5 ? 1 : -1) / 12);
        this._darkNote(hz, vol * (0.4 + Math.random() * 0.4), t);
        t += 0.28 + Math.random() * 0.20;
      }

      // Chromatic descent between passes — three notes sliding down
      if (p < passes - 1) {
        const topHz = P[rootIdx] * Math.pow(2, 12 / 12);
        for (let s = 0; s < 3; s++) {
          this._darkNote(topHz * Math.pow(2, -s / 12), vol * 0.28, t);
          t += 0.16 + Math.random() * 0.10;
        }
      }

      t += 0.7 + Math.random() * 1.0;
    }

    // Final held root — resolution that doesn't resolve
    t += 0.2;
    this._darkNote(P[rootIdx], vol * 0.70, t);
    this._darkNote(P[rootIdx] * 1.189, vol * 0.38, t + 0.12);
  }

  // ── 4. Doom Riff — 2–3 full repetitions with bass walk and growing heaviness ──
  doomRiff() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.012 + Math.random() * 0.004;
    // E–G–A–E doom progression
    const roots = [P[0], P[2], P[3], P[0]];
    const repeats = 2 + Math.floor(Math.random() * 2);
    let t = 0;

    for (let rep = 0; rep < repeats; rep++) {
      const repVol = vol * (0.80 + rep * 0.10);
      // First rep is slower/heavier; subsequent tighter
      const timing = rep === 0 ? 0.72 + Math.random() * 0.25 : 0.52 + Math.random() * 0.18;

      for (let i = 0; i < roots.length; i++) {
        const root = roots[i];
        this._darkNote(root, repVol, t);
        this._darkNote(root * 1.498, repVol * 0.58, t + 0.025);  // fifth

        // Bass walk between chords — chromatic passing tone
        if (i < roots.length - 1 && Math.random() < 0.52) {
          const walk = root * Math.pow(2, (Math.random() < 0.5 ? 1 : 2) / 12);
          this._darkNote(walk, repVol * 0.32, t + timing * 0.62);
        }

        t += timing;
      }

      // Riff-ending sustain
      this._darkNote(P[0], repVol * 0.75, t);
      this._darkNote(P[0] * 1.498, repVol * 0.48, t + 0.03);
      t += 1.4 + Math.random() * 0.7;
    }
  }

  // ── 5. Witch Bells — three groups (low call, high answer, cluster) with mod sweep ──
  witchBells() {
    const ctx = this._ctx;
    const vol = 0.007 + Math.random() * 0.003;

    // Three distinct bell timbres that call and answer each other
    const groups = [
      { freqBase: 180, freqRange: 120, count: 3, modRatio: 1.414 },  // low call
      { freqBase: 650, freqRange: 380, count: 4, modRatio: 2.756 },  // high answer
      { freqBase: 400, freqRange: 220, count: 5, modRatio: 1.618 },  // cluster (golden ratio)
    ];

    let t = 0;
    for (const grp of groups) {
      for (let i = 0; i < grp.count; i++) {
        const freq = grp.freqBase + Math.random() * grp.freqRange;
        const dur = 1.3 + Math.random() * 2.2;
        const ct = ctx.currentTime + t;

        const mod = ctx.createOscillator();
        mod.frequency.setValueAtTime(freq * grp.modRatio, ct);
        // Sweep the modulator — eerie metallic shimmer
        mod.frequency.linearRampToValueAtTime(
          freq * grp.modRatio * (0.75 + Math.random() * 0.5), ct + dur);

        const modG = ctx.createGain();
        modG.gain.setValueAtTime(freq * 3, ct);
        modG.gain.exponentialRampToValueAtTime(1, ct + dur);
        mod.connect(modG);

        const car = ctx.createOscillator();
        car.type = 'sine';
        car.frequency.setValueAtTime(freq, ct);
        modG.connect(car.frequency);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, ct);
        g.gain.linearRampToValueAtTime(vol, ct + 0.006);
        g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
        car.connect(g).connect(this._out);
        mod.start(ct); car.start(ct);
        mod.stop(ct + dur + 0.1); car.stop(ct + dur + 0.1);

        t += 0.38 + Math.random() * 1.1;
      }
      // Gap between bell groups — the call hangs in the air
      t += 0.65 + Math.random() * 1.0;
    }
  }

  // ── 6. Void Echo — 3-tier detuned echoes, low drone, occasional wrong-pitch ghost ──
  voidEcho() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.008 + Math.random() * 0.004;
    const count = 5 + Math.floor(Math.random() * 4); // 5–8
    let t = 0;

    // A barely-audible drone rumbles beneath the whole piece
    this._darkNote(P[1 + Math.floor(Math.random() * 3)], vol * 0.14, 0);

    for (let i = 0; i < count; i++) {
      const idx = Math.max(0, Math.min(P.length - 1, 8 + Math.floor(Math.random() * 8)));
      const hz = P[idx];

      this._darkNote(hz, vol, t);
      // Three increasingly detuned echoes — like sound bouncing off cave walls
      this._darkNote(hz * 1.001, vol * 0.32, t + 0.36 + Math.random() * 0.10);
      this._darkNote(hz * 0.999, vol * 0.13, t + 0.78 + Math.random() * 0.12);
      this._darkNote(hz * 1.002, vol * 0.05, t + 1.28 + Math.random() * 0.15);

      // Occasional "wrong" ghost echo at a tritone — deeply unsettling
      if (Math.random() < 0.32) {
        this._darkNote(hz * Math.pow(2, 6 / 12), vol * 0.11, t + 0.52 + Math.random() * 0.15);
      }

      t += 2.9 + Math.random() * 3.0;
    }
  }

  // ── 7. Grind Motor — grind phase, breakdown, gear-change rebuild ──
  grindMotor() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.003;
    const rootIdx = Math.floor(Math.random() * 4);
    const root = P[rootIdx];
    const fifth    = root * 1.498;
    const minor3rd = root * 1.189;
    const flat7    = root * 1.782;
    const tempo = 0.13 + Math.random() * 0.05;
    let t = 0;

    // Phase 1: full grind — cycling root/fifth/3rd/7th pattern
    const beatsFull = 16 + Math.floor(Math.random() * 8);
    for (let i = 0; i < beatsFull; i++) {
      const accent = i % 4 === 0;
      const hz = [root, minor3rd, fifth, flat7][i % 4];
      this._darkNote(hz, vol * (accent ? 0.88 : 0.45), t);
      t += tempo;
    }

    // Phase 2: breakdown — sudden sparse hits, eerie space
    t += 0.28 + Math.random() * 0.3;
    for (let i = 0; i < 4; i++) {
      this._darkNote(root, vol * 0.50, t);
      t += 0.50 + Math.random() * 0.40;
    }

    // Phase 3: gear change — starts slow then accelerates back to grind speed
    t += 0.18;
    let gearTempo = tempo * 1.6;
    const gearBeats = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < gearBeats; i++) {
      const accent = i % 4 === 0;
      this._darkNote(accent ? root : fifth, vol * (accent ? 0.92 : 0.50), t);
      t += gearTempo;
      gearTempo = Math.max(tempo * 0.8, gearTempo * 0.94);
    }

    // Final crash — two overlapping hits
    t += 0.04;
    this._darkNote(root * 0.5, vol * 0.72, t);
    this._darkNote(root, vol * 0.48, t + 0.04);
  }

  // ── 8. Elder Chant — choral voices with vowel morphing and unresolved finale ──
  eldrChant() {
    const ctx = this._ctx;
    const vol = 0.010 + Math.random() * 0.004;
    const vowels = [
      { f1: 830,  f2: 1170, f3: 2500 },  // "ah"
      { f1: 430,  f2: 980,  f3: 2500 },  // "oh"
      { f1: 330,  f2: 1260, f3: 2500 },  // "oo"
      { f1: 660,  f2: 1700, f3: 2500 },  // "ay"
    ];
    const fundamentals = [58, 65, 73, 82, 87];
    let t = 0;
    const syllableCount = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < syllableCount; i++) {
      const fund = fundamentals[Math.floor(Math.random() * fundamentals.length)];
      const vIdx = Math.floor(Math.random() * vowels.length);
      const vowel = vowels[vIdx];
      // Morph toward the next vowel over the duration
      const nextVowel = vowels[(vIdx + 1) % vowels.length];
      const dur = 1.8 + Math.random() * 2.5;
      const ct = ctx.currentTime + t;

      // Primary voice — glottal sawtooth with slow vibrato
      const src = ctx.createOscillator();
      src.type = 'sawtooth';
      src.frequency.setValueAtTime(fund, ct);
      const vib = ctx.createOscillator();
      vib.frequency.value = 4.5 + Math.random() * 2;
      const vibG = ctx.createGain();
      vibG.gain.value = fund * 0.018;
      vib.connect(vibG).connect(src.frequency);
      vib.start(ct); vib.stop(ct + dur + 0.1);

      // Second choir voice — staggered, detuned, adds choral thickness
      if (Math.random() < 0.65) {
        const src2 = ctx.createOscillator();
        src2.type = 'sawtooth';
        src2.frequency.setValueAtTime(fund * (1 + (Math.random() - 0.5) * 0.04), ct + 0.09);
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

      // Formant filters with vowel morph — formants sweep from current to next vowel
      const formantPairs = [
        [vowel.f1, nextVowel.f1],
        [vowel.f2, nextVowel.f2],
        [vowel.f3, nextVowel.f3],
      ];
      for (const [fStart, fEnd] of formantPairs) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(fStart, ct);
        bp.frequency.linearRampToValueAtTime(fEnd, ct + dur * 0.8);
        bp.Q.value = 12;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, ct);
        g.gain.linearRampToValueAtTime(vol * 0.5, ct + 0.18);
        g.gain.setValueAtTime(vol * 0.5, ct + dur * 0.65);
        g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
        src.connect(bp).connect(g).connect(this._out);
      }
      src.start(ct); src.stop(ct + dur + 0.1);

      t += dur + 0.3 + Math.random() * 1.2;
    }

    // Final syllable — rises without resolving, ominous
    if (Math.random() < 0.72) {
      const fund = fundamentals[fundamentals.length - 1];
      const ct = ctx.currentTime + t;
      const dur = 2.2;
      const src = ctx.createOscillator();
      src.type = 'sawtooth';
      src.frequency.setValueAtTime(fund, ct);
      src.frequency.linearRampToValueAtTime(fund * 1.14, ct + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 830; bp.Q.value = 8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(vol * 0.42, ct + 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);
      src.connect(bp).connect(g).connect(this._out);
      src.start(ct); src.stop(ct + dur + 0.1);
    }
  }

  // ── 9. Blood Moon — tritone (devil's interval) melody ──
  bloodMoon() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.010 + Math.random() * 0.004;
    const rootIdx = 6 + Math.floor(Math.random() * 6);
    const root = P[rootIdx];
    let t = 0;
    const count = 5 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      // Tritone = 6 semitones (the devil's interval) — maximally unstable
      const tritone = root * Math.pow(2, 6 / 12);
      const minor2nd = root * Math.pow(2, 1 / 12);

      this._darkNote(root, vol, t);
      t += 0.28 + Math.random() * 0.18;

      this._darkNote(tritone, vol * 0.85, t);
      t += 0.38 + Math.random() * 0.25;

      // Chromatic semitone step — extra unsettling crunch
      if (Math.random() < 0.65) {
        this._darkNote(minor2nd, vol * 0.5, t);
        t += 0.22 + Math.random() * 0.12;
      }

      // Occasional higher tritone echo
      if (Math.random() < 0.4) {
        this._darkNote(tritone * 2, vol * 0.3, t + 0.05);
      }

      t += 0.9 + Math.random() * 1.2;
    }
  }

  // ── 10. Chaos Cluster — dissonant rapid note bursts ──
  chaosCluster() {
    const P = GameMusic.DARK_POOL;
    const vol = 0.008 + Math.random() * 0.003;
    const bursts = 3 + Math.floor(Math.random() * 3);
    let t = 0;

    for (let b = 0; b < bursts; b++) {
      const centerIdx = 8 + Math.floor(Math.random() * 8);
      const notesInBurst = 4 + Math.floor(Math.random() * 5);

      for (let i = 0; i < notesInBurst; i++) {
        const offset = Math.floor(Math.random() * 7) - 3;
        const idx = Math.max(0, Math.min(P.length - 1, centerIdx + offset));
        const detune = (Math.random() - 0.5) * 0.04;
        this._darkNote(P[idx] * (1 + detune), vol * (0.35 + Math.random() * 0.45), t);
        t += 0.07 + Math.random() * 0.07;
      }

      // Brief silence between bursts, then a single resolving thud
      t += 0.3 + Math.random() * 0.3;
      this._darkNote(P[Math.max(0, centerIdx - 4)], vol * 0.6, t);
      t += 1.5 + Math.random() * 1.8;
    }
  }

  // ── 11. Grandma's Whisper — sub-bass with tremolo, barely perceptible ──
  grandmaWhisper() {
    const ctx = this._ctx;
    const vol = 0.013 + Math.random() * 0.005;
    // Very low sub-bass — A0 to E1 range
    const fundamentals = [27.5, 32.7, 36.7, 41.2];
    const count = 3 + Math.floor(Math.random() * 3);
    let t = 0;

    for (let i = 0; i < count; i++) {
      const fund = fundamentals[Math.floor(Math.random() * fundamentals.length)];
      const dur = 2.5 + Math.random() * 2.5;
      const ct = ctx.currentTime + t;

      // Sub-bass body with LFO tremolo
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fund, ct);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 3 + Math.random() * 2;
      const lfoG = ctx.createGain();
      lfoG.gain.value = vol * 0.3;
      lfo.connect(lfoG);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ct);
      g.gain.linearRampToValueAtTime(vol, ct + 0.5);
      g.gain.setValueAtTime(vol, ct + dur - 0.6);
      g.gain.linearRampToValueAtTime(0, ct + dur);
      lfoG.connect(g.gain);

      osc.connect(g).connect(this._out);
      lfo.start(ct); lfo.stop(ct + dur + 0.1);
      osc.start(ct); osc.stop(ct + dur + 0.1);

      // High "breath" overtone — ghostly
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(fund * 3 + Math.random() * 20, ct);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, ct);
      g2.gain.linearRampToValueAtTime(vol * 0.15, ct + 0.6);
      g2.gain.exponentialRampToValueAtTime(0.001, ct + dur * 0.8);
      osc2.connect(g2).connect(this._out);
      osc2.start(ct); osc2.stop(ct + dur);

      t += dur + 0.3 + Math.random() * 1.0;
    }
  }

  // ── 12. Abyssal Rumble — rhythmic low pulses that accelerate ──
  abyssalRumble() {
    const ctx = this._ctx;
    const vol = 0.011 + Math.random() * 0.004;
    const baseFreq = 40 + Math.random() * 30;
    const beats = 12 + Math.floor(Math.random() * 8);
    let t = 0;
    let tempo = 0.4;          // starts slow
    const accel = 0.93;       // tightens each beat

    for (let i = 0; i < beats; i++) {
      const accent = i % 4 === 0;
      const freq = accent ? baseFreq : baseFreq * (1 + (i % 2) * 0.498);
      const ct = ctx.currentTime + t;
      const dur = 0.25 + Math.random() * 0.15;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ct);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, ct + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(vol * (accent ? 1.0 : 0.5), ct + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);

      osc.connect(g).connect(this._out);
      osc.start(ct); osc.stop(ct + dur + 0.1);

      t += tempo;
      tempo = Math.max(0.1, tempo * accel);
    }

    // Final crash — held low note
    this._darkNote(baseFreq * 0.5, vol * 0.9, t + 0.08);
  }

  // ── 13. Sirenic Call — starts bright, warps into darkness ──
  sirenicCall() {
    const ctx = this._ctx;
    const vol = 0.009 + Math.random() * 0.003;
    const count = 5 + Math.floor(Math.random() * 4);
    let t = 0;

    for (let i = 0; i < count; i++) {
      const progress = i / count;                         // 0 → 1
      const freq = 600 - progress * 420 + Math.random() * 80;
      const dur = 0.8 + Math.random() * 1.2;
      const ct = ctx.currentTime + t;

      // Modulation ratio grows more inharmonic as piece progresses
      const modRatio = 1.414 + progress * 5;
      const mod = ctx.createOscillator();
      mod.frequency.setValueAtTime(freq * modRatio, ct);

      const modG = ctx.createGain();
      modG.gain.setValueAtTime(freq * 0.5, ct);
      modG.gain.linearRampToValueAtTime(freq * (1 + progress * 8), ct + dur * 0.4);
      modG.gain.exponentialRampToValueAtTime(1, ct + dur);
      mod.connect(modG);

      const car = ctx.createOscillator();
      car.type = progress > 0.5 ? 'sawtooth' : 'sine';
      car.frequency.setValueAtTime(freq, ct);
      modG.connect(car.frequency);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ct);
      g.gain.linearRampToValueAtTime(vol * (1 - progress * 0.25), ct + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, ct + dur);

      car.connect(g).connect(this._out);
      mod.start(ct); car.start(ct);
      mod.stop(ct + dur + 0.1); car.stop(ct + dur + 0.1);

      t += 0.6 + Math.random() * 0.8;
    }
  }

  // ── 14. Crypt Organ — slow minor doom-chord progression ──
  cryptOrgan() {
    const ctx = this._ctx;
    const vol = 0.008 + Math.random() * 0.003;
    // C2 / D2 / F2 / G2 — low organ roots
    const roots = [65.4, 73.4, 87.3, 98.0];
    const root = roots[Math.floor(Math.random() * roots.length)];

    // Chord shapes as semitone intervals: i – bVII – bVI – v
    const chords = [
      [0, 3, 7],    // i   (root minor)
      [-2, 1, 5],   // bVII
      [-4, -1, 3],  // bVI
      [-5, -2, 2],  // v
    ];
    const progression = Math.random() < 0.5
      ? [0, 1, 2, 3, 0]
      : [0, 2, 1, 3];

    let t = 0;
    for (const chordIdx of progression) {
      const chord = chords[chordIdx];
      const dur = 1.5 + Math.random() * 1.0;
      const ct = ctx.currentTime + t;

      for (const semi of chord) {
        const freq = root * Math.pow(2, semi / 12);

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ct);
        osc.detune.setValueAtTime((Math.random() - 0.5) * 10, ct);

        // Soften the square wave through a low-pass
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = freq * 3;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, ct);
        g.gain.linearRampToValueAtTime(vol * 0.35, ct + 0.06);
        g.gain.setValueAtTime(vol * 0.35, ct + dur - 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, ct + dur);

        osc.connect(lp).connect(g).connect(this._out);
        osc.start(ct); osc.stop(ct + dur + 0.1);
      }

      t += dur + 0.1 + Math.random() * 0.3;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  NOTE RENDERER — delicate piano-like tone (normal mode)
  // ═══════════════════════════════════════════════════════════

  _note(freq, volume = 0.010, delay = 0) {
    const ctx = this._ctx;
    const t = ctx.currentTime + delay;
    const dur = 3.5 + Math.random() * 3.5;                    // 3.5–7 s — longer sustain
    const out = this._out;

    // Warm sine fundamental
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.030);
    g.gain.setTargetAtTime(volume * 0.52, t + 0.030, 0.75);
    g.gain.setTargetAtTime(0.001, t + dur * 0.62, dur * 0.22);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.5);

    // Piano "pluck" attack — brief FM chirp at note onset adds realistic hammer strike
    const pluck = ctx.createOscillator();
    pluck.type = 'sine';
    pluck.frequency.setValueAtTime(freq * 6.0, t);
    pluck.frequency.exponentialRampToValueAtTime(freq, t + 0.018);
    const gp = ctx.createGain();
    gp.gain.setValueAtTime(volume * 0.18, t);
    gp.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    pluck.connect(gp).connect(out);
    pluck.start(t); pluck.stop(t + 0.03);

    // Octave partial — warmth
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.002, t);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(volume * 0.060, t + 0.028);
    g2.gain.setTargetAtTime(0.001, t + 0.28, dur * 0.16);
    osc2.connect(g2).connect(out);
    osc2.start(t);
    osc2.stop(t + dur * 0.48);

    // Fifth partial — body
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3.001, t);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.001, t);
    g3.gain.linearRampToValueAtTime(volume * 0.020, t + 0.022);
    g3.gain.setTargetAtTime(0.001, t + 0.13, dur * 0.09);
    osc3.connect(g3).connect(out);
    osc3.start(t);
    osc3.stop(t + dur * 0.28);

    // Very faint major-seventh partial — shimmering overtone colour
    const osc4 = ctx.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(freq * 4.001, t);
    const g4 = ctx.createGain();
    g4.gain.setValueAtTime(0.001, t);
    g4.gain.linearRampToValueAtTime(volume * 0.008, t + 0.018);
    g4.gain.setTargetAtTime(0.001, t + 0.08, dur * 0.06);
    osc4.connect(g4).connect(out);
    osc4.start(t);
    osc4.stop(t + dur * 0.18);
  }
}
