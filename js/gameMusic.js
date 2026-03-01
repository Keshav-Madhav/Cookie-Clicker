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
  }

  // ─── note pool ──────────────────────────────────────────────
  // C major pentatonic across octaves 3–6.

  static POOL = [
    130.8, 146.8, 164.8, 196.0, 220.0,           // octave 3
    261.6, 293.7, 329.6, 392.0, 440.0,           // octave 4
    523.3, 587.3, 659.3, 784.0, 880.0,           // octave 5
    1046.5, 1174.7, 1318.5,                       // octave 6 (sparkle)
  ];

  // ─── lifecycle ──────────────────────────────────────────────

  start() {
    if (this._active) return;
    this._active = true;
    this._schedule();
  }

  stop() {
    this._active = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  _schedule() {
    if (!this._active) return;
    const delay = 5000 + Math.random() * 12000;             // 5–17 s
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
  };

  getCurrentName() { return this._currentName; }

  _play() {
    const list = GameMusic._COMPOSITIONS;
    const name = list[Math.floor(Math.random() * list.length)];
    this._currentName = GameMusic._DISPLAY_NAMES[name] || name;
    this[name]();
  }

  // ─── helper: clamp index into pool ──────────────────────────

  _ci(i) { return Math.max(0, Math.min(i, GameMusic.POOL.length - 1)); }

  // ═══════════════════════════════════════════════════════════
  //  COMPOSITIONS
  // ═══════════════════════════════════════════════════════════

  // ── 1. Gentle Arc — ascending then descending (or vice-versa) ──

  gentleArc() {
    const P = GameMusic.POOL;
    const count = 8 + Math.floor(Math.random() * 10);
    const vol = 0.010 + Math.random() * 0.005;
    let idx = 3 + Math.floor(Math.random() * (P.length - 6));
    let t = 0;
    const ascending = Math.random() > 0.4;

    for (let i = 0; i < count; i++) {
      this._note(P[idx], vol * (0.6 + Math.random() * 0.4), t);
      t += 0.5 + Math.random() * 1.1;
      if (i > 0 && i % 4 === 0) t += 0.6 + Math.random() * 1.0;

      const first = i < count / 2;
      const up = ascending ? first : !first;
      if (up) idx = this._ci(idx + (Math.random() < 0.7 ? 1 : 2));
      else     idx = this._ci(idx - (Math.random() < 0.7 ? 1 : 2));
    }
  }

  // ── 2. Call & Response — motif, pause, answer ──

  callAndResponse() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    const len = 3 + Math.floor(Math.random() * 3);
    const start = 4 + Math.floor(Math.random() * (P.length - 8));

    let t = 0;
    const motif = [];
    let idx = start;
    for (let i = 0; i < len; i++) {
      motif.push(idx);
      this._note(P[idx], vol * (0.7 + Math.random() * 0.3), t);
      t += 0.5 + Math.random() * 0.6;
      idx = this._ci(idx + 1);
    }

    t += 1.2 + Math.random() * 1.5;

    const shift = Math.random() > 0.5 ? 2 : -1;
    for (let i = 0; i < len; i++) {
      const ri = Math.random() > 0.3
        ? motif[i] + shift
        : motif[len - 1 - i] + shift;
      this._note(P[this._ci(ri)], vol * (0.6 + Math.random() * 0.4), t);
      t += 0.5 + Math.random() * 0.6;
    }

    if (Math.random() < 0.6) {
      t += 0.8 + Math.random() * 1.0;
      const c = start + Math.floor(Math.random() * 3);
      this._note(P[this._ci(c)], vol * 0.5, t);
      t += 1.0 + Math.random() * 0.8;
      this._note(P[this._ci(c + 2)], vol * 0.4, t);
    }
  }

  // ── 3. Falling Leaves — gentle descending sequence ──

  fallingLeaves() {
    const P = GameMusic.POOL;
    const count = 7 + Math.floor(Math.random() * 8);
    const vol = 0.009 + Math.random() * 0.005;
    let idx = this._ci(Math.floor(P.length * 0.6 + Math.random() * P.length * 0.3));
    let t = 0;

    for (let i = 0; i < count; i++) {
      this._note(P[idx], vol * (0.6 + Math.random() * 0.4), t);
      t += 0.6 + Math.random() * 1.0;
      if (i % 3 === 2) t += 0.5 + Math.random() * 0.8;

      if (Math.random() < 0.75) idx = this._ci(idx - 1);
      else                       idx = this._ci(idx + 1);
    }
  }

  // ── 4. Spread Arpeggio — chord tones fanned across registers ──

  spreadArpeggio() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.004;
    const root = 2 + Math.floor(Math.random() * 4);
    const tones = [root, root + 2, root + 4, root + 7];
    if (Math.random() > 0.4) tones.push(root + 9);

    let t = 0;
    const passes = 2 + Math.floor(Math.random() * 2);
    for (let p = 0; p < passes; p++) {
      const order = p % 2 === 0 ? [...tones] : [...tones].reverse();
      for (const n of order) {
        this._note(P[this._ci(n)], vol * (0.55 + Math.random() * 0.45), t);
        t += 0.7 + Math.random() * 0.9;
      }
      t += 1.0 + Math.random() * 1.5;
    }
  }

  // ── 5. Lullaby — very slow, extra delicate ──

  lullaby() {
    const P = GameMusic.POOL;
    const count = 6 + Math.floor(Math.random() * 6);
    const vol = 0.007 + Math.random() * 0.004;
    let idx = 5 + Math.floor(Math.random() * (P.length - 8));
    let t = 0;

    for (let i = 0; i < count; i++) {
      this._note(P[idx], vol * (0.5 + Math.random() * 0.5), t);
      t += 1.2 + Math.random() * 1.8;

      if (i % 2 === 0) idx = this._ci(idx + (Math.random() < 0.6 ? 1 : 2));
      else              idx = this._ci(idx - 1);
    }
  }

  // ── 6. Free Wander — long Minecraft-style contemplative phrase ──

  freeWander() {
    const P = GameMusic.POOL;
    const count = 10 + Math.floor(Math.random() * 12);
    const vol = 0.010 + Math.random() * 0.005;
    let idx = 3 + Math.floor(Math.random() * (P.length - 6));
    let t = 0;

    for (let i = 0; i < count; i++) {
      this._note(P[idx], vol * (0.6 + Math.random() * 0.4), t);
      t += 0.5 + Math.random() * 1.0;
      if (Math.random() < 0.18) t += 0.8 + Math.random() * 1.2;
      if (i > 0 && i % 4 === 0) t += 0.4 + Math.random() * 0.8;

      const r = Math.random();
      if (r < 0.40)      idx = this._ci(idx + 1);
      else if (r < 0.72) idx = this._ci(idx - 1);
      else if (r < 0.85) idx = this._ci(idx + 2 + Math.floor(Math.random() * 2));
      // else: repeat

      if (idx < 3 && Math.random() < 0.5) idx++;
      if (idx > P.length - 3 && Math.random() < 0.5) idx--;
    }
  }

  // ── 7. Ripple — expands outward from a center note ──

  ripple() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.005;
    const center = 5 + Math.floor(Math.random() * (P.length - 10));
    const rings = 4 + Math.floor(Math.random() * 4);        // 4–7 rings out
    let t = 0;

    // Center note first
    this._note(P[center], vol, t);
    t += 0.8 + Math.random() * 0.5;

    for (let r = 1; r <= rings; r++) {
      const lo = this._ci(center - r);
      const hi = this._ci(center + r);
      const softer = vol * (0.45 + 0.55 / (r + 1));

      // Alternate: high first or low first
      if (r % 2 === 0) {
        this._note(P[hi], softer * (0.7 + Math.random() * 0.3), t);
        t += 0.35 + Math.random() * 0.35;
        this._note(P[lo], softer * (0.7 + Math.random() * 0.3), t);
      } else {
        this._note(P[lo], softer * (0.7 + Math.random() * 0.3), t);
        t += 0.35 + Math.random() * 0.35;
        this._note(P[hi], softer * (0.7 + Math.random() * 0.3), t);
      }
      t += 0.6 + Math.random() * 0.8;
    }

    // Resolve back to center
    t += 0.3 + Math.random() * 0.6;
    this._note(P[center], vol * 0.5, t);
  }

  // ── 8. Music Box — repeating pattern with tiny variations ──

  musicBox() {
    const P = GameMusic.POOL;
    const vol = 0.008 + Math.random() * 0.004;
    // Build a short 4-6 note pattern in the upper register
    const baseIdx = 7 + Math.floor(Math.random() * 5);
    const patLen = 4 + Math.floor(Math.random() * 3);
    const pattern = [];
    let idx = baseIdx;
    for (let i = 0; i < patLen; i++) {
      pattern.push(idx);
      const step = Math.random() < 0.6 ? 1 : (Math.random() < 0.5 ? 2 : -1);
      idx = this._ci(idx + step);
    }

    let t = 0;
    const repeats = 3 + Math.floor(Math.random() * 3);      // 3–5 repeats
    for (let rep = 0; rep < repeats; rep++) {
      for (let i = 0; i < patLen; i++) {
        // Occasional variation: shift a note by 1
        let ni = pattern[i];
        if (rep > 0 && Math.random() < 0.15) ni = this._ci(ni + (Math.random() < 0.5 ? 1 : -1));
        this._note(P[ni], vol * (0.6 + Math.random() * 0.4), t);
        t += 0.3 + Math.random() * 0.25;
      }
      // Small pause between repeats
      t += 0.5 + Math.random() * 0.8;

      // Gradually softer each repeat
      // (handled by note volume randomization)
    }
  }

  // ── 9. Cascade — quick descending run, then a long held note ──

  cascade() {
    const P = GameMusic.POOL;
    const vol = 0.009 + Math.random() * 0.005;
    const rounds = 2 + Math.floor(Math.random() * 3);       // 2–4 cascades
    let t = 0;

    for (let r = 0; r < rounds; r++) {
      // Start high, run down 5-8 notes quickly
      let idx = this._ci(P.length - 3 - Math.floor(Math.random() * 5));
      const runLen = 5 + Math.floor(Math.random() * 4);

      for (let i = 0; i < runLen; i++) {
        this._note(P[idx], vol * (0.4 + Math.random() * 0.3), t);
        t += 0.15 + Math.random() * 0.12;                    // fast run
        idx = this._ci(idx - 1);
      }

      // Long held landing note
      t += 0.1;
      this._note(P[idx], vol * (0.7 + Math.random() * 0.3), t);

      // Long pause before next cascade
      t += 2.5 + Math.random() * 2.0;
    }
  }

  // ── 10. Echo Reflection — note, then quieter repeat higher ──

  echoReflection() {
    const P = GameMusic.POOL;
    const vol = 0.010 + Math.random() * 0.005;
    const count = 5 + Math.floor(Math.random() * 5);
    let idx = 3 + Math.floor(Math.random() * (P.length - 8));
    let t = 0;

    for (let i = 0; i < count; i++) {
      // Main note
      this._note(P[idx], vol * (0.6 + Math.random() * 0.4), t);

      // Echo — softer, an octave (5 steps in pentatonic) higher
      const echoIdx = this._ci(idx + 5);
      this._note(P[echoIdx], vol * 0.25, t + 0.35 + Math.random() * 0.25);

      t += 1.2 + Math.random() * 1.0;

      // Gentle step motion
      const r = Math.random();
      if (r < 0.45)      idx = this._ci(idx + 1);
      else if (r < 0.80) idx = this._ci(idx - 1);
      else                idx = this._ci(idx + 2);
    }
  }

  // ── 11. Starlight — high register twinkles with long silences ──

  starlight() {
    const P = GameMusic.POOL;
    const vol = 0.006 + Math.random() * 0.004;              // very soft
    const count = 8 + Math.floor(Math.random() * 8);
    let t = 0;

    for (let i = 0; i < count; i++) {
      // Pick from upper half of pool
      const idx = this._ci(Math.floor(P.length * 0.5) + Math.floor(Math.random() * (P.length * 0.5)));
      this._note(P[idx], vol * (0.4 + Math.random() * 0.6), t);

      // Mostly long silences, occasional quick pair
      if (Math.random() < 0.25) {
        t += 0.3 + Math.random() * 0.3;                      // quick second twinkle
        const idx2 = this._ci(idx + (Math.random() < 0.5 ? 1 : -1));
        this._note(P[idx2], vol * 0.5, t);
      }

      t += 1.5 + Math.random() * 3.0;                        // long silence
    }
  }

  // ── 12. Hymn — slow, stately, mostly stepwise ──

  hymn() {
    const P = GameMusic.POOL;
    const count = 8 + Math.floor(Math.random() * 6);
    const vol = 0.011 + Math.random() * 0.004;
    let idx = 4 + Math.floor(Math.random() * 4);             // start in mid-range
    let t = 0;

    for (let i = 0; i < count; i++) {
      this._note(P[idx], vol * (0.6 + Math.random() * 0.4), t);

      // Occasionally play two notes together for a hymn-like chord
      if (Math.random() < 0.3) {
        const harmony = this._ci(idx + (Math.random() < 0.5 ? 2 : 4));
        this._note(P[harmony], vol * 0.4, t + 0.02);
      }

      t += 0.9 + Math.random() * 0.8;
      if (i % 4 === 3) t += 0.8 + Math.random() * 1.0;      // phrase break

      // Mostly stepwise
      const r = Math.random();
      if (r < 0.4)      idx = this._ci(idx + 1);
      else if (r < 0.75) idx = this._ci(idx - 1);
      else if (r < 0.85) idx = this._ci(idx + 2);
      // else: repeat
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  NOTE RENDERER — delicate piano-like tone
  // ═══════════════════════════════════════════════════════════

  _note(freq, volume = 0.010, delay = 0) {
    const ctx = this._ctx;
    const t = ctx.currentTime + delay;
    const dur = 3.0 + Math.random() * 3.0;                    // 3–6 s
    const out = this._out;

    // Warm sine fundamental
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.035);
    g.gain.setTargetAtTime(volume * 0.50, t + 0.035, 0.7);
    g.gain.setTargetAtTime(0.001, t + dur * 0.6, dur * 0.22);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.5);

    // Soft octave partial — warmth
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.002, t);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(volume * 0.055, t + 0.03);
    g2.gain.setTargetAtTime(0.001, t + 0.25, dur * 0.16);
    osc2.connect(g2).connect(out);
    osc2.start(t);
    osc2.stop(t + dur * 0.45);

    // Very faint fifth partial — body
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 3.001, t);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.001, t);
    g3.gain.linearRampToValueAtTime(volume * 0.018, t + 0.025);
    g3.gain.setTargetAtTime(0.001, t + 0.12, dur * 0.09);
    osc3.connect(g3).connect(out);
    osc3.start(t);
    osc3.stop(t + dur * 0.25);
  }
}
