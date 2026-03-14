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

  // ── 1. Gentle Arc — three mirrored arcs with dynamic swell, pedal tones, and harmony ──

  gentleArc() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    const ascending = Math.random() > 0.4;
    let idx = 3 + Math.floor(Math.random() * (P.length - 6));
    const homeIdx = idx;
    let t = 0;

    // Deep pedal tone anchors the whole piece — C418 signature
    this._note(P[this._ci(homeIdx - 3)], vol * 0.22, t);

    for (let arc = 0; arc < 3; arc++) {
      const count = 8 + Math.floor(Math.random() * 8);
      const dir = arc % 2 === 0 ? ascending : !ascending;

      for (let i = 0; i < count; i++) {
        const swell = Math.sin(Math.PI * i / count);
        const noteVol = vol * (0.45 + swell * 0.55);

        // Grace note — soft leading tone before some main notes
        if (Math.random() < 0.15) {
          const grace = this._ci(idx + (Math.random() < 0.5 ? -1 : 1));
          this._note(P[grace], noteVol * 0.18, t - 0.08);
        }

        this._note(P[idx], noteVol, t);

        // Harmony a third or fifth above
        if (Math.random() < 0.28) {
          const interval = Math.random() < 0.6 ? 2 : 4;
          this._note(P[this._ci(idx + interval)], noteVol * 0.28, t + 0.03);
        }

        // Occasional pedal bass re-anchor
        if (i % 5 === 0 && Math.random() < 0.4) {
          this._note(P[this._ci(homeIdx - 3)], vol * 0.18, t + 0.06);
        }

        t += 0.65 + Math.random() * 1.4;
        // Longer contemplative pauses every few notes
        if (i > 0 && i % 4 === 0) t += 1.0 + Math.random() * 1.8;

        const first = i < count / 2;
        const up = dir ? first : !first;
        if (up) idx = this._ci(idx + (Math.random() < 0.7 ? 1 : 2));
        else     idx = this._ci(idx - (Math.random() < 0.7 ? 1 : 2));
      }

      // Breath between arcs — longer, more contemplative
      t += 2.5 + Math.random() * 3.0;

      // Re-anchor pedal between arcs
      if (arc < 2) {
        this._note(P[this._ci(homeIdx - 3)], vol * 0.16, t - 0.5);
      }
    }

    // Final resolution — gentle fifth chord
    this._note(P[homeIdx], vol * 0.35, t);
    this._note(P[this._ci(homeIdx + 4)], vol * 0.20, t + 0.04);
  }

  // ── 2. Call & Response — motif, three answers with increasing distance, coda with harmony ──

  callAndResponse() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    const len = 4 + Math.floor(Math.random() * 3);
    const start = 4 + Math.floor(Math.random() * (P.length - 8));
    let t = 0;

    // Low pedal tone sets the harmonic foundation
    this._note(P[this._ci(start - 4)], vol * 0.20, t);

    // Build and play the "call" motif
    const motif = [];
    let idx = start;
    for (let i = 0; i < len; i++) {
      motif.push(idx);
      this._note(P[idx], vol * (0.7 + Math.random() * 0.3), t);
      // Occasional dyad on the call — makes it more memorable
      if (i === 0 || (i === len - 1 && Math.random() < 0.5)) {
        this._note(P[this._ci(idx + 2)], vol * 0.25, t + 0.03);
      }
      t += 0.60 + Math.random() * 0.80;
      idx = this._ci(idx + 1);
    }

    // First response — shifted up or down, with breathing space
    t += 2.0 + Math.random() * 2.5;
    const shift = Math.random() > 0.5 ? 2 : -1;
    for (let i = 0; i < len; i++) {
      const ri = Math.random() > 0.3 ? motif[i] + shift : motif[len - 1 - i] + shift;
      this._note(P[this._ci(ri)], vol * (0.6 + Math.random() * 0.4), t);
      t += 0.55 + Math.random() * 0.75;
    }

    // Second response — further shift, softer, like across a valley
    t += 2.2 + Math.random() * 2.5;
    const shift2 = shift > 0 ? shift + 2 : shift - 2;
    // Re-anchor bass
    this._note(P[this._ci(start - 3)], vol * 0.16, t - 0.3);
    for (let i = 0; i < len; i++) {
      this._note(P[this._ci(motif[i] + shift2)], vol * (0.35 + Math.random() * 0.25), t);
      t += 0.50 + Math.random() * 0.65;
    }

    // Third response — barely a whisper, very distant echo
    t += 2.8 + Math.random() * 3.0;
    const shift3 = shift2 + (shift > 0 ? 2 : -2);
    const len3 = Math.max(2, len - 2);
    for (let i = 0; i < len3; i++) {
      this._note(P[this._ci(motif[i] + shift3)], vol * (0.15 + Math.random() * 0.12), t);
      t += 0.45 + Math.random() * 0.55;
    }

    // Coda — gentle four-note resolution with harmony
    t += 1.5 + Math.random() * 1.5;
    const c = start + Math.floor(Math.random() * 3);
    this._note(P[this._ci(c)], vol * 0.55, t);
    t += 1.0 + Math.random() * 0.8;
    this._note(P[this._ci(c + 2)], vol * 0.42, t);
    this._note(P[this._ci(c + 4)], vol * 0.22, t + 0.04);
    t += 0.85 + Math.random() * 0.7;
    this._note(P[this._ci(c + 1)], vol * 0.32, t);
    t += 0.75 + Math.random() * 0.6;
    this._note(P[this._ci(c)], vol * 0.25, t);
  }

  // ── 3. Falling Leaves — long descent with catches, flutter pairs, updrafts, and fading volume ──

  fallingLeaves() {
    const P = GameMusic.POOL;
    const count = 14 + Math.floor(Math.random() * 10);
    const vol = 0.009 + Math.random() * 0.005;
    let idx = this._ci(Math.floor(P.length * 0.70 + Math.random() * P.length * 0.25));
    const startIdx = idx;
    let t = 0;

    // Opening high shimmer — the wind that shakes the tree
    this._note(P[this._ci(idx + 2)], vol * 0.18, t);
    this._note(P[this._ci(idx + 3)], vol * 0.12, t + 0.15);
    t += 1.2 + Math.random() * 1.0;

    for (let i = 0; i < count; i++) {
      const progress = i / count;
      // Volume fades gently as leaves settle, with slight swell at midpoint
      const midSwell = 1.0 + 0.25 * Math.sin(Math.PI * progress);
      const noteVol = vol * (0.50 + 0.50 * (1 - progress)) * midSwell * (0.6 + Math.random() * 0.4);
      this._note(P[idx], noteVol, t);

      // Catch sparkle — third or fifth above
      if (Math.random() < 0.22) {
        const interval = Math.random() < 0.7 ? 2 : 4;
        this._note(P[this._ci(idx + interval)], noteVol * 0.25, t + 0.20 + Math.random() * 0.15);
      }

      // Flutter pair — two notes in quick succession
      if (Math.random() < 0.20) {
        const flutter = this._ci(idx + (Math.random() < 0.5 ? 1 : -1));
        this._note(P[flutter], noteVol * 0.35, t + 0.30 + Math.random() * 0.15);
      }

      // Low bass anchor every 6 notes — ground beneath the leaves
      if (i % 6 === 0 && idx > 4) {
        this._note(P[this._ci(1 + Math.floor(Math.random() * 3))], vol * 0.15, t + 0.05);
      }

      // Updraft moment — brief rise before continuing to fall
      if (i > count * 0.4 && i < count * 0.7 && Math.random() < 0.15) {
        t += 0.3;
        idx = this._ci(idx + 2);
        this._note(P[idx], noteVol * 0.6, t);
        t += 0.25;
        idx = this._ci(idx + 1);
        this._note(P[idx], noteVol * 0.4, t);
      }

      t += 0.70 + Math.random() * 1.2;
      if (i % 3 === 2) t += 0.8 + Math.random() * 1.2;
      // Occasional long contemplative pause
      if (Math.random() < 0.08) t += 2.0 + Math.random() * 2.5;

      const r = Math.random();
      if (r < 0.68)       idx = this._ci(idx - 1);
      else if (r < 0.83)  idx = this._ci(idx + 1);
      // else: repeat (leaf hovering)
    }

    // Final settling — two very quiet notes
    t += 1.0;
    this._note(P[idx], vol * 0.15, t);
    t += 1.2 + Math.random() * 0.8;
    this._note(P[this._ci(idx - 1)], vol * 0.08, t);
  }

  // ── 4. Spread Arpeggio — chord fans with counter-voice, bass pedal, and peak stab ──

  spreadArpeggio() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const root = 2 + Math.floor(Math.random() * 4);
    const tones = [root, root + 2, root + 4, root + 7];
    if (Math.random() > 0.30) tones.push(root + 9);
    if (Math.random() > 0.55) tones.push(root + 11); // extended to 6th

    let t = 0;
    const passes = 4 + Math.floor(Math.random() * 2); // 4–5 passes

    // Bass pedal opens the piece
    this._note(P[this._ci(root - 3)], vol * 0.22, t);

    for (let p = 0; p < passes; p++) {
      const order = p % 2 === 0 ? [...tones] : [...tones].reverse();
      // Volume arc across passes — swell to middle then recede
      const passArc = Math.sin(Math.PI * p / passes);
      const passVol = vol * (0.55 + passArc * 0.45);

      for (let n = 0; n < order.length; n++) {
        const mainVol = passVol * (0.55 + Math.random() * 0.45);
        this._note(P[this._ci(order[n])], mainVol, t);

        // Counter-voice on later passes
        if (p >= passes - 2 && Math.random() < 0.38) {
          const contra = this._ci(order[n] + (p % 2 === 0 ? -2 : 2));
          this._note(P[contra], mainVol * 0.25, t + 0.06);
        }

        t += 0.75 + Math.random() * 1.1;
      }

      // Chord stab at sweep peak
      const peak = this._ci(Math.max(...order));
      this._note(P[peak], passVol * 0.45, t);
      this._note(P[this._ci(peak - 2)], passVol * 0.25, t + 0.03);

      // Bass re-anchor between passes
      if (p < passes - 1 && Math.random() < 0.6) {
        this._note(P[this._ci(root - 3)], vol * 0.16, t + 0.10);
      }

      t += 1.5 + Math.random() * 2.2;
    }

    // Final soft open chord — root + third + fifth ringing out
    this._note(P[this._ci(root)], vol * 0.30, t);
    this._note(P[this._ci(root + 2)], vol * 0.20, t + 0.04);
    this._note(P[this._ci(root + 4)], vol * 0.14, t + 0.08);
  }

  // ── 5. Lullaby — rocking 3-feel with bass anchors, harmony, and starlight sparkles ──

  lullaby() {
    const P = GameMusic.POOL;
    const count = 14 + Math.floor(Math.random() * 8);
    const vol = 0.007 + Math.random() * 0.004;
    let idx = 5 + Math.floor(Math.random() * (P.length - 8));
    const homeIdx = idx;
    let t = 0;

    // Opening bass warmth — sets the cradle rocking
    this._note(P[this._ci(homeIdx - 4)], vol * 0.20, t);
    t += 0.8 + Math.random() * 0.5;

    for (let i = 0; i < count; i++) {
      const swell = Math.sin(Math.PI * i / count + 0.3);
      const noteVol = vol * (0.40 + swell * 0.60);

      this._note(P[idx], noteVol, t);

      // Rocking bass anchor every 3rd note
      if (i % 3 === 0 && idx > 3) {
        this._note(P[this._ci(idx - 3)], noteVol * 0.35, t + 0.05);
      }

      // Harmony on the rocking upbeat — soft third
      if (i % 3 === 1 && Math.random() < 0.35) {
        this._note(P[this._ci(idx + 2)], noteVol * 0.22, t + 0.03);
      }

      // High sparkle on occasional downbeats
      if (i % 4 === 0 && Math.random() < 0.45 && idx < P.length - 5) {
        this._note(P[this._ci(idx + 5)], noteVol * 0.18, t + 0.35 + Math.random() * 0.20);
      }

      // Deep bass pedal restatement at the dynamic peak
      if (i === Math.floor(count / 2)) {
        this._note(P[this._ci(homeIdx - 5)], vol * 0.18, t + 0.08);
      }

      // Rocking feel: alternate long-short gaps (3/4 lilt) — wider spacing
      t += (i % 2 === 0) ? 1.3 + Math.random() * 0.75 : 0.80 + Math.random() * 0.60;
      // Occasional extra-long pause — the breath between lullaby phrases
      if (i % 6 === 5) t += 1.2 + Math.random() * 1.5;

      if (i % 2 === 0) idx = this._ci(idx + (Math.random() < 0.6 ? 1 : 2));
      else              idx = this._ci(idx - 1);
    }

    // Gentle close — two notes fading into sleep
    t += 1.0 + Math.random() * 0.8;
    this._note(P[this._ci(idx)], vol * 0.30, t);
    t += 1.5 + Math.random() * 1.0;
    this._note(P[this._ci(homeIdx)], vol * 0.15, t);
  }

  // ── 6. Free Wander — four-section journey with pedal tones and harmonic landmarks ──

  freeWander() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    let idx = 5 + Math.floor(Math.random() * (P.length - 10));
    const home = idx;
    let t = 0;

    // Opening home pedal — the place you start from
    this._note(P[this._ci(home - 3)], vol * 0.18, t);

    // 4 sections: neutral meander | wander away | far reaches | drift back
    for (let sec = 0; sec < 4; sec++) {
      const count = 6 + Math.floor(Math.random() * 8);

      for (let i = 0; i < count; i++) {
        const noteVol = vol * (0.55 + Math.random() * 0.45);
        this._note(P[idx], noteVol, t);

        // Harmonic color — dyads on some notes
        if (Math.random() < 0.20) {
          const interval = Math.random() < 0.6 ? 2 : 4;
          this._note(P[this._ci(idx + interval)], noteVol * 0.22, t + 0.04);
        }

        // Pedal anchor at section boundaries
        if (i === 0 && sec > 0) {
          this._note(P[this._ci(home - 3)], vol * 0.14, t + 0.06);
        }

        t += 0.65 + Math.random() * 1.3;
        if (Math.random() < 0.20) t += 1.2 + Math.random() * 2.0;
        if (i > 0 && i % 4 === 0) t += 0.8 + Math.random() * 1.2;

        const r = Math.random();
        if (sec === 1) {
          if (r < 0.55)      idx = this._ci(idx + 1);
          else if (r < 0.80) idx = this._ci(idx - 1);
          else                idx = this._ci(idx + 2);
        } else if (sec === 2) {
          // Far reaches — wider leaps, more adventurous
          if (r < 0.40)      idx = this._ci(idx + 2);
          else if (r < 0.65) idx = this._ci(idx - 1);
          else if (r < 0.85) idx = this._ci(idx + 3);
          else                idx = this._ci(idx - 2);
        } else if (sec === 3) {
          const towardHome = idx > home ? -1 : 1;
          if (r < 0.55)      idx = this._ci(idx + towardHome);
          else if (r < 0.80) idx = this._ci(idx - towardHome);
          else                idx = this._ci(idx + towardHome * 2);
        } else {
          if (r < 0.40)      idx = this._ci(idx + 1);
          else if (r < 0.72) idx = this._ci(idx - 1);
          else if (r < 0.85) idx = this._ci(idx + 2 + Math.floor(Math.random() * 2));
        }

        if (idx < 2) idx = this._ci(idx + 1);
        if (idx > P.length - 2) idx = this._ci(idx - 1);
      }

      t += 2.5 + Math.random() * 3.0;
    }

    // Arrival home — root with fifth harmony
    this._note(P[home], vol * 0.35, t);
    this._note(P[this._ci(home + 4)], vol * 0.18, t + 0.05);
  }

  // ── 7. Ripple — two stone drops, expanding/contracting with harmonic reflections ──

  ripple() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.005;
    const center = 5 + Math.floor(Math.random() * (P.length - 10));
    const maxRings = 6 + Math.floor(Math.random() * 3); // 6–8
    let t = 0;

    // Drop the stone — center note with harmonic splash
    this._note(P[center], vol, t);
    this._note(P[this._ci(center + 2)], vol * 0.25, t + 0.05);
    // Deep bass — the stone sinking
    this._note(P[this._ci(center - 5)], vol * 0.18, t + 0.08);
    t += 1.0 + Math.random() * 0.7;

    // Expanding phase — wider spacing for contemplation
    for (let r = 1; r <= maxRings; r++) {
      const lo = this._ci(center - r);
      const hi = this._ci(center + r);
      const softer = vol * (0.45 + 0.55 / (r + 1));

      if (r % 2 === 0) {
        this._note(P[hi], softer * (0.7 + Math.random() * 0.3), t);
        t += 0.35 + Math.random() * 0.35;
        this._note(P[lo], softer * (0.7 + Math.random() * 0.3), t);
      } else {
        this._note(P[lo], softer * (0.7 + Math.random() * 0.3), t);
        t += 0.35 + Math.random() * 0.35;
        this._note(P[hi], softer * (0.7 + Math.random() * 0.3), t);
      }
      // Reflection harmonic on every other ring
      if (r % 2 === 0 && Math.random() < 0.4) {
        this._note(P[this._ci(center)], softer * 0.15, t + 0.12);
      }
      t += 0.65 + Math.random() * 0.80;
    }

    // Silence — ripple travels across the pond
    t += 1.5 + Math.random() * 2.0;

    // Second stone — smaller, offset
    const center2 = this._ci(center + (Math.random() < 0.5 ? 2 : -2));
    this._note(P[center2], vol * 0.65, t);
    t += 0.8 + Math.random() * 0.5;

    // Second smaller expanding phase
    const rings2 = Math.floor(maxRings * 0.6);
    for (let r = 1; r <= rings2; r++) {
      const lo = this._ci(center2 - r);
      const hi = this._ci(center2 + r);
      const softer = vol * (0.30 + 0.30 / (r + 1));
      this._note(P[lo], softer, t);
      t += 0.30 + Math.random() * 0.25;
      this._note(P[hi], softer, t);
      t += 0.55 + Math.random() * 0.65;
    }

    // Long contemplative silence
    t += 2.0 + Math.random() * 2.5;

    // Contracting phase — all ripples returning inward
    for (let r = maxRings; r >= 1; r--) {
      const lo = this._ci(center - r);
      const hi = this._ci(center + r);
      const faint = vol * (0.12 + 0.12 / r);

      this._note(P[hi], faint * (0.6 + Math.random() * 0.4), t);
      t += 0.28 + Math.random() * 0.25;
      this._note(P[lo], faint * (0.6 + Math.random() * 0.4), t);
      t += 0.45 + Math.random() * 0.55;
    }

    // Center returns — barely a whisper, with a harmonic ghost
    t += 0.5 + Math.random() * 0.6;
    this._note(P[center], vol * 0.30, t);
    this._note(P[this._ci(center + 4)], vol * 0.10, t + 0.08);
  }

  // ── 8. Music Box — A-B-A structure with bass, crescendo arc, and winding-down coda ──

  musicBox() {
    const P = GameMusic.POOL;
    const vol = 0.008 + Math.random() * 0.004;
    const baseIdx = 7 + Math.floor(Math.random() * 5);
    const patLen = 5 + Math.floor(Math.random() * 3);

    // Build pattern A
    const patternA = [];
    let idx = baseIdx;
    for (let i = 0; i < patLen; i++) {
      patternA.push(idx);
      const step = Math.random() < 0.6 ? 1 : (Math.random() < 0.5 ? 2 : -1);
      idx = this._ci(idx + step);
    }

    // Pattern B — stepwise descent variation
    const patternB = patternA.map(n => this._ci(n - 1 - Math.floor(Math.random() * 2)));

    // Pattern C — inverted (mirror) of A
    const patternC = patternA.map(n => this._ci(baseIdx + (baseIdx - n)));

    let t = 0;
    const totalReps = 5 + Math.floor(Math.random() * 3); // 5–7 repeats

    for (let rep = 0; rep < totalReps; rep++) {
      const mid = Math.floor(totalReps / 2);
      const useB = rep === mid;
      const useC = rep === mid + 1;
      const pat = useB ? patternB : useC ? patternC : patternA;

      // Volume arc: swell to midpoint, then gently decay
      const progress = rep / totalReps;
      const repVol = vol * (progress < 0.5
        ? 0.50 + progress * 1.0
        : 1.0 - (progress - 0.5) * 0.55);

      // Bass pedal at start of each repeat
      if (rep % 2 === 0) {
        this._note(P[this._ci(baseIdx - 4)], repVol * 0.22, t - 0.04);
      }

      for (let i = 0; i < pat.length; i++) {
        let ni = pat[i];
        if (rep > 0 && Math.random() < 0.14) ni = this._ci(ni + (Math.random() < 0.5 ? 1 : -1));
        this._note(P[ni], repVol * (0.55 + Math.random() * 0.45), t);

        // Occasional harmony on stressed notes
        if (i === 0 && Math.random() < 0.3) {
          this._note(P[this._ci(ni + 2)], repVol * 0.20, t + 0.03);
        }

        t += 0.35 + Math.random() * 0.30;
      }
      t += 0.65 + Math.random() * 0.95;
    }

    // Winding-down coda — the music box slowing to a stop
    t += 0.8 + Math.random() * 0.5;
    let codaTempo = 0.40;
    for (let i = 0; i < Math.min(4, patternA.length); i++) {
      this._note(P[patternA[i]], vol * (0.35 - i * 0.06), t);
      t += codaTempo;
      codaTempo += 0.15 + Math.random() * 0.10; // slowing down
    }
  }

  // ── 9. Cascade — alternating runs with harmonic landings, bass anchors, and a final waterfall ──

  cascade() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.005;
    const rounds = 4 + Math.floor(Math.random() * 3); // 4–6 cascades
    let t = 0;

    // Opening bass foundation
    this._note(P[this._ci(2)], vol * 0.18, t);

    for (let r = 0; r < rounds; r++) {
      const descending = (r % 2 === 0 || Math.random() < 0.65);
      let idx = descending
        ? this._ci(P.length - 2 - Math.floor(Math.random() * 5))
        : this._ci(1 + Math.floor(Math.random() * 5));
      const runLen = 6 + Math.floor(Math.random() * 6);

      // Arc the speed — start slow, quicken, then slow for landing
      for (let i = 0; i < runLen; i++) {
        const arcPos = i / runLen;
        const speed = arcPos < 0.3
          ? 0.22 + Math.random() * 0.12
          : arcPos > 0.7
            ? 0.18 + Math.random() * 0.10
            : 0.12 + Math.random() * 0.07;
        const noteVol = vol * (0.30 + Math.random() * 0.30 + arcPos * 0.15);
        this._note(P[idx], noteVol, t);
        t += speed;
        idx = this._ci(descending ? idx - 1 : idx + 1);
      }

      // Landing note — held and full with harmony
      t += 0.10;
      this._note(P[idx], vol * (0.75 + Math.random() * 0.25), t);

      // Landing harmony — third and sometimes fifth
      if (Math.random() < 0.55) {
        this._note(P[this._ci(idx + 2)], vol * 0.30, t + 0.04);
      }
      if (Math.random() < 0.25) {
        this._note(P[this._ci(idx + 4)], vol * 0.18, t + 0.07);
      }

      // Bass re-anchor after landing
      if (r % 2 === 0) {
        this._note(P[this._ci(1 + Math.floor(Math.random() * 3))], vol * 0.15, t + 0.10);
      }

      t += 2.8 + Math.random() * 3.0;
    }

    // Final long waterfall — one continuous descent
    let finalIdx = this._ci(P.length - 2);
    for (let i = 0; i < 8; i++) {
      this._note(P[finalIdx], vol * (0.20 - i * 0.02), t);
      t += 0.18 + i * 0.03;
      finalIdx = this._ci(finalIdx - 1);
    }
  }

  // ── 10. Echo Reflection — three echo tiers, bass shadows, and merging chord finale ──

  echoReflection() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    const count = 9 + Math.floor(Math.random() * 6); // 9–14
    let idx = 3 + Math.floor(Math.random() * (P.length - 8));
    let t = 0;

    // Deep opening tone — the cave walls that create the echo
    this._note(P[this._ci(idx - 4)], vol * 0.16, t);
    t += 0.8;

    for (let i = 0; i < count; i++) {
      const arc = Math.sin(Math.PI * i / count);
      const mainVol = vol * (0.50 + arc * 0.50);

      // Main note
      this._note(P[idx], mainVol, t);

      // First echo — octave up, softer
      this._note(P[this._ci(idx + 5)], mainVol * 0.25, t + 0.32 + Math.random() * 0.20);

      // Second echo — two octaves up, very faint
      if (Math.random() < 0.65) {
        this._note(P[this._ci(idx + 10)], mainVol * 0.09, t + 0.68 + Math.random() * 0.20);
      }

      // Third echo — three octaves (if in range), ghostly
      if (Math.random() < 0.30 && idx + 15 < P.length) {
        this._note(P[this._ci(idx + 15)], mainVol * 0.04, t + 1.10 + Math.random() * 0.25);
      }

      // Alternative interval echo — fourth or sixth
      if (Math.random() < 0.28) {
        const altEcho = this._ci(idx + (Math.random() < 0.5 ? 3 : 4));
        this._note(P[altEcho], mainVol * 0.14, t + 0.48 + Math.random() * 0.15);
      }

      // Bass shadow — deep reflection of the main note
      if (i % 3 === 0 && idx > 4) {
        this._note(P[this._ci(idx - 5)], mainVol * 0.14, t + 0.15);
      }

      t += 1.4 + Math.random() * 1.2;
      // Occasional long reverberant pause
      if (Math.random() < 0.12) t += 2.0 + Math.random() * 2.0;

      const r = Math.random();
      if (r < 0.45)      idx = this._ci(idx + 1);
      else if (r < 0.80) idx = this._ci(idx - 1);
      else                idx = this._ci(idx + 2);
    }

    // Final chord where all echoes merge — full triad with bass
    t += 1.2 + Math.random() * 1.0;
    this._note(P[this._ci(idx - 5)], vol * 0.20, t);
    this._note(P[idx], vol * 0.45, t + 0.02);
    this._note(P[this._ci(idx + 2)], vol * 0.28, t + 0.05);
    this._note(P[this._ci(idx + 4)], vol * 0.18, t + 0.08);
  }

  // ── 11. Starlight — vast, sparse, with deep pedals, clusters, and constellations ──

  starlight() {
    const P = GameMusic.POOL;
    const vol = 0.006 + Math.random() * 0.004;
    const count = 14 + Math.floor(Math.random() * 10); // 14–23 twinkles
    let t = 0;

    // Opening deep space tone — the vastness before stars appear
    this._note(P[this._ci(1)], vol * 0.18, t);
    t += 2.0 + Math.random() * 1.5;

    for (let i = 0; i < count; i++) {
      const arc = Math.sin(Math.PI * i / count);
      const noteVol = vol * (0.30 + arc * 0.70);

      const idx = this._ci(Math.floor(P.length * 0.45) + Math.floor(Math.random() * (P.length * 0.55)));
      this._note(P[idx], noteVol * (0.5 + Math.random() * 0.5), t);

      // Quick pair twinkle
      if (Math.random() < 0.30) {
        t += 0.22 + Math.random() * 0.22;
        this._note(P[this._ci(idx + (Math.random() < 0.5 ? 1 : -1))], noteVol * 0.45, t);
      }

      // Constellation cluster — 3 nearby stars near the peak
      if (i > count * 0.35 && i < count * 0.65 && Math.random() < 0.22) {
        t += 0.18 + Math.random() * 0.15;
        this._note(P[this._ci(idx + 2)], noteVol * 0.30, t);
        t += 0.15 + Math.random() * 0.12;
        this._note(P[this._ci(idx + 1)], noteVol * 0.22, t);
      }

      // Harmony dyad — two stars shining together
      if (Math.random() < 0.18) {
        this._note(P[this._ci(idx + 4)], noteVol * 0.20, t + 0.04);
      }

      // Deep pedal tone — the void between stars
      if (i % 4 === 0 && Math.random() < 0.55) {
        this._note(P[this._ci(1 + Math.floor(Math.random() * 4))], vol * 0.22, t + 0.08);
      }

      // Shooting star — rare quick ascending pair
      if (Math.random() < 0.08) {
        const shootStart = this._ci(idx - 2);
        this._note(P[shootStart], noteVol * 0.25, t + 0.5);
        this._note(P[this._ci(shootStart + 3)], noteVol * 0.15, t + 0.65);
      }

      t += 1.8 + Math.random() * 3.2;
      // Extra-long pause for spaciousness
      if (Math.random() < 0.10) t += 2.5 + Math.random() * 3.0;
    }

    // Final fading star
    t += 1.0;
    this._note(P[this._ci(P.length - 3 + Math.floor(Math.random() * 3))], vol * 0.12, t);
  }

  // ── 12. Hymn — A-A-B-A-C structure with full harmony, bass, and "Amen" cadence ──

  hymn() {
    const P = GameMusic.POOL;
    const vol = 0.011 + Math.random() * 0.004;
    let idx = 4 + Math.floor(Math.random() * 4);
    const homeIdx = idx;
    let t = 0;

    // Opening bass pedal
    this._note(P[this._ci(homeIdx - 4)], vol * 0.22, t);

    // 5 bars: A – A – B – A – C (coda variation)
    for (let bar = 0; bar < 5; bar++) {
      const isB = bar === 2;
      const isC = bar === 4;
      if (isB) idx = this._ci(homeIdx + 2);
      if (isC) idx = this._ci(homeIdx - 1); // C drops down — reflective

      const beats = isC ? 3 : 4; // C section is shorter — winding down

      for (let beat = 0; beat < beats; beat++) {
        const beatVol = vol * (0.55 + Math.random() * 0.45);
        this._note(P[idx], beatVol, t);

        // Harmony on strong beats — third or fifth
        if (beat % 2 === 0 && Math.random() < 0.58) {
          const interval = Math.random() < 0.65 ? 2 : 4;
          this._note(P[this._ci(idx + interval)], beatVol * 0.32, t + 0.03);
        }

        // Bass note on beat 1 — grounding
        if (beat === 0 && idx > 4) {
          this._note(P[this._ci(idx - 4)], beatVol * 0.25, t + 0.05);
        }

        // Grace note approach — makes the melody sing
        if (beat === 2 && Math.random() < 0.25) {
          this._note(P[this._ci(idx - 1)], beatVol * 0.15, t - 0.06);
        }

        t += 1.0 + Math.random() * 0.75;

        const r = Math.random();
        if (isB) {
          if (r < 0.50)      idx = this._ci(idx + 1);
          else if (r < 0.75) idx = this._ci(idx - 1);
          else                idx = this._ci(idx + 2);
        } else if (isC) {
          // C gravitates downward — settling
          if (r < 0.55)      idx = this._ci(idx - 1);
          else if (r < 0.80) idx = this._ci(idx + 1);
          else                idx = this._ci(idx - 2);
        } else {
          if (r < 0.40)       idx = this._ci(idx + 1);
          else if (r < 0.75)  idx = this._ci(idx - 1);
          else if (r < 0.88)  idx = this._ci(idx + 2);
        }
      }

      t += 1.0 + Math.random() * 1.4;
      if (isB) idx = homeIdx;
    }

    // "Amen" cadence — IV → I with full voicing
    t += 0.5;
    this._note(P[this._ci(homeIdx - 4)], vol * 0.25, t);       // bass
    this._note(P[this._ci(homeIdx + 3)], vol * 0.55, t + 0.02); // IV
    this._note(P[this._ci(homeIdx + 5)], vol * 0.35, t + 0.05);
    t += 1.5 + Math.random() * 0.8;
    this._note(P[this._ci(homeIdx - 5)], vol * 0.22, t);       // bass
    this._note(P[homeIdx], vol * 0.65, t + 0.02);               // I
    this._note(P[this._ci(homeIdx + 2)], vol * 0.40, t + 0.05);
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

  // ── 13. Distant Rain — sparse high drips over a low sustained hum ──

  distantRain() {
    const P = GameMusic.POOL;
    const vol = 0.007 + Math.random() * 0.004;
    let t = 0;

    // Low sustained hum — the sky before rain
    const humIdx = this._ci(1 + Math.floor(Math.random() * 3));
    this._note(P[humIdx], vol * 0.22, t);

    t += 1.5 + Math.random() * 1.5;

    // Rain drops — mostly high register, sparse, irregular timing
    const drops = 16 + Math.floor(Math.random() * 12);
    for (let i = 0; i < drops; i++) {
      const progress = i / drops;
      // Rain intensifies mid-piece then eases
      const intensity = Math.sin(Math.PI * progress);
      const dropIdx = this._ci(Math.floor(P.length * 0.55) + Math.floor(Math.random() * (P.length * 0.45)));
      const dropVol = vol * (0.25 + intensity * 0.55) * (0.5 + Math.random() * 0.5);

      this._note(P[dropIdx], dropVol, t);

      // Occasional double drop — two drops landing close together
      if (Math.random() < 0.22) {
        const near = this._ci(dropIdx + (Math.random() < 0.5 ? 1 : -1));
        this._note(P[near], dropVol * 0.55, t + 0.12 + Math.random() * 0.10);
      }

      // Puddle ripple — lower note responding to a drop
      if (Math.random() < 0.15) {
        this._note(P[this._ci(dropIdx - 4)], dropVol * 0.25, t + 0.25 + Math.random() * 0.15);
      }

      // Low hum re-anchor every 5 drops
      if (i % 5 === 0 && i > 0) {
        this._note(P[humIdx], vol * 0.16, t + 0.08);
      }

      // Irregular spacing — key to the rain feel
      const baseGap = intensity > 0.5 ? 0.8 : 1.6;
      t += baseGap + Math.random() * (intensity > 0.5 ? 1.5 : 3.0);

      // Occasional long pause — a break in the clouds
      if (Math.random() < 0.08) t += 3.0 + Math.random() * 3.0;
    }

    // Final few drops, very quiet, rain passing
    t += 1.5;
    for (let i = 0; i < 3; i++) {
      const idx = this._ci(Math.floor(P.length * 0.6) + Math.floor(Math.random() * 5));
      this._note(P[idx], vol * (0.12 - i * 0.03), t);
      t += 2.0 + Math.random() * 2.5;
    }
  }

  // ── 14. Meadow Walk — wide intervals, bright and pastoral with birdsong sparkles ──

  meadowWalk() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.004;
    let idx = 3 + Math.floor(Math.random() * 4);
    let t = 0;

    // Opening — wide interval leap upward, like stepping into sunlight
    this._note(P[idx], vol * 0.45, t);
    t += 0.8 + Math.random() * 0.5;
    this._note(P[this._ci(idx + 5)], vol * 0.55, t);
    t += 1.2 + Math.random() * 1.0;

    // Walking melody — alternates between low grounded steps and high reaches
    const steps = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < steps; i++) {
      const arc = Math.sin(Math.PI * i / steps);
      const noteVol = vol * (0.45 + arc * 0.55);

      this._note(P[idx], noteVol, t);

      // Wide interval harmony — fourths and fifths, open and pastoral
      if (Math.random() < 0.30) {
        const interval = Math.random() < 0.5 ? 3 : 4; // fourth or fifth
        this._note(P[this._ci(idx + interval)], noteVol * 0.28, t + 0.04);
      }

      // Birdsong sparkle — very high, quick pair
      if (Math.random() < 0.12 && i > 2) {
        const birdIdx = this._ci(P.length - 3 + Math.floor(Math.random() * 3));
        this._note(P[birdIdx], vol * 0.15, t + 0.5 + Math.random() * 0.3);
        this._note(P[this._ci(birdIdx - 1)], vol * 0.10, t + 0.65 + Math.random() * 0.2);
      }

      // Bass anchor every 4th step — the ground beneath your feet
      if (i % 4 === 0 && idx > 3) {
        this._note(P[this._ci(idx - 4)], noteVol * 0.20, t + 0.06);
      }

      // Wide step movement — bigger leaps than normal
      const r = Math.random();
      if (r < 0.30)      idx = this._ci(idx + 2);
      else if (r < 0.50) idx = this._ci(idx - 1);
      else if (r < 0.70) idx = this._ci(idx + 3);
      else if (r < 0.85) idx = this._ci(idx - 2);
      else                idx = this._ci(idx + 1);

      t += 0.9 + Math.random() * 1.5;
      // Long pause to take in the view
      if (Math.random() < 0.10) t += 2.5 + Math.random() * 2.5;
    }

    // Settling chord — arrived at the hilltop
    t += 1.5;
    this._note(P[this._ci(idx - 4)], vol * 0.18, t);
    this._note(P[idx], vol * 0.35, t + 0.03);
    this._note(P[this._ci(idx + 2)], vol * 0.25, t + 0.06);
    this._note(P[this._ci(idx + 4)], vol * 0.18, t + 0.09);
  }

  // ── 15. Frozen Lake — crystalline, minimal, with deep resonance underneath ──

  frozenLake() {
    const P = GameMusic.POOL;
    const vol = 0.006 + Math.random() * 0.004;
    let t = 0;

    // Deep ice resonance — the lake groaning beneath
    this._note(P[this._ci(0)], vol * 0.22, t);
    this._note(P[this._ci(1)], vol * 0.14, t + 0.8);
    t += 2.0 + Math.random() * 1.5;

    // Crystal notes — very high, very sparse, with huge gaps
    const crystals = 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < crystals; i++) {
      const progress = i / crystals;
      const arc = Math.sin(Math.PI * progress);

      // High register — ice crystals catching light
      const idx = this._ci(Math.floor(P.length * 0.6) + Math.floor(Math.random() * (P.length * 0.4)));
      const noteVol = vol * (0.30 + arc * 0.50) * (0.5 + Math.random() * 0.5);

      this._note(P[idx], noteVol, t);

      // Ice crack — quick descending pair
      if (Math.random() < 0.18) {
        this._note(P[this._ci(idx - 1)], noteVol * 0.40, t + 0.10);
        this._note(P[this._ci(idx - 2)], noteVol * 0.20, t + 0.18);
      }

      // Harmonic overtone — the ice ringing
      if (Math.random() < 0.25) {
        this._note(P[this._ci(idx + 5)], noteVol * 0.15, t + 0.06);
      }

      // Deep resonance re-anchor every 4 notes
      if (i % 4 === 0) {
        const deepIdx = this._ci(Math.floor(Math.random() * 3));
        this._note(P[deepIdx], vol * 0.16, t + 0.10);
      }

      // Very long gaps — the silence IS the music
      t += 2.5 + Math.random() * 4.0;

      // Extra-long pause sometimes — pure stillness
      if (Math.random() < 0.12) t += 4.0 + Math.random() * 4.0;
    }

    // Final — ice settling, two very distant notes
    t += 2.0;
    this._note(P[this._ci(P.length - 2)], vol * 0.10, t);
    t += 3.0 + Math.random() * 2.0;
    this._note(P[this._ci(0)], vol * 0.12, t);
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
