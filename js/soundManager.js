/**
 * SoundManager — procedural audio via Web Audio API (no audio files).
 *
 * Three independent layers controlled by separate settings:
 *
 *   Music  — symphonies (background + click-driven) PLUS generative
 *            Minecraft-style piano melodies.
 *   Ambient — warm bakery drone (pad chords, bass, room tone, shimmer)
 *            plus random bakery sound events.
 *   Sound Effects — purchase, upgrade, achievement, golden cookie, etc.
 *
 * Sync bonus (1.5×) rewards clicking at the piece's BPM (±20 %).
 */
import { symphonies } from './symphonies.js';
import { GameMusic } from './gameMusic.js';

export class SoundManager {
  constructor(game) {
    this.game = game;
    this._ctx = null;
    this._pieces = symphonies;
    this._totalNotes = this._pieces.reduce((s, p) => s + p.notes.length, 0);
    this._clickTimes = [];      // timestamps for rhythm / BPM calc
    this._lastPieceIdx = -1;    // detect piece changes for UI
    this._lastNoteTime = 0;     // performance.now() of last played note

    // Background music — symphony plays continuously at piece BPM
    this._musicPlaying = false;
    this._musicTimer = null;

    // Ambient soundscape — drone, shimmer, bakery events
    this._ambientActive = false;
    this._ambientNodes = [];        // { node, gain } for cleanup
    this._ambientEventTimer = null;
    this._ambientPadOscs = [];      // pad oscillators (freq-rampable)
    this._ambientBassOsc = null;    // bass oscillator reference
    this._ambientChordIdx = 0;      // current chord in progression
    this._ambientChordTimer = null;

    // Generative melody engine (created lazily)
    this._gameMusic = null;

    // Volume buses (created lazily in _ensureContext)
    this._musicBus = null;
    this._melodyBus = null;   // generative melody → _musicBus (ducked while clicking)
    this._effectsBus = null;
    this._ambientBus = null;
    this._currentBus = null;  // temporary routing override
    this._melodyDuckTimer = null;
  }

  // ─── context ──────────────────────────────────────────────

  _ensureContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    // Create volume bus GainNodes on first use
    if (!this._musicBus) {
      this._musicBus = this._ctx.createGain();
      this._musicBus.gain.value = this.game.settings.musicVolume ?? 0.5;
      this._musicBus.connect(this._ctx.destination);
      // Melody sub-bus: generative melodies route here, then to _musicBus.
      // This bus gets ducked while the player is clicking the cookie.
      this._melodyBus = this._ctx.createGain();
      this._melodyBus.gain.value = 1.0;
      this._melodyBus.connect(this._musicBus);
    }
    if (!this._effectsBus) {
      this._effectsBus = this._ctx.createGain();
      this._effectsBus.gain.value = this.game.settings.effectsVolume ?? 1.0;
      this._effectsBus.connect(this._ctx.destination);
    }
    if (!this._ambientBus) {
      this._ambientBus = this._ctx.createGain();
      this._ambientBus.gain.value = this.game.settings.ambientVolume ?? 0.5;
      this._ambientBus.connect(this._ctx.destination);
    }
    return this._ctx;
  }

  /** Returns the current output bus for tone helpers. */
  _out() {
    return this._currentBus || this._effectsBus || this._ctx?.destination;
  }

  _canPlayMusic()   { return !!this.game.settings.music; }
  _canPlayEffects() { return !!this.game.settings.soundEffects; }
  _canPlayAmbient() { return !!this.game.settings.ambient; }

  setMusicVolume(v)   { if (this._musicBus)   this._musicBus.gain.value = v; }
  setEffectsVolume(v) { if (this._effectsBus) this._effectsBus.gain.value = v; }
  setAmbientVolume(v) { if (this._ambientBus) this._ambientBus.gain.value = v; }

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
    osc.connect(g).connect(this._out());
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
    src.connect(f).connect(g).connect(this._out());
    src.start(t);
    src.stop(t + duration);
  }

  _playSequence(type, freqs, dur, vol = 0.06) {
    freqs.forEach((hz, i) => this._playTone(type, hz, hz, dur * 0.85, vol, i * dur));
  }

  /**
   * Formant synthesis — simulates a vowel by running a glottal buzz
   * (sawtooth at fundamental) through parallel bandpass filters at
   * F1 / F2 / F3, producing recognizable vocal sounds.
   *
   *   vowel reference (adult male):
   *     "ah" [ɑ]  F1=830  F2=1170  F3=2500
   *     "ee" [i]  F1=280  F2=2230  F3=2800
   *     "oh" [o]  F1=430  F2=980   F3=2500
   *     "oo" [u]  F1=330  F2=1260  F3=2500
   *     "eh" [ɛ]  F1=600  F2=1930  F3=2500
   */
  _playVowel(fundamental, f1, f2, f3, duration, volume = 0.06, delay = 0) {
    const ctx = this._ensureContext();
    const t = ctx.currentTime + delay;
    // Glottal source — sawtooth simulates vocal cord buzz
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(fundamental, t);
    // Three parallel formant bandpass filters
    const formants = [
      { freq: f1, q: 12, gain: volume },
      { freq: f2, q: 15, gain: volume * 0.7 },
      { freq: f3, q: 18, gain: volume * 0.3 },
    ];
    for (const fm of formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = fm.freq; bp.Q.value = fm.q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(fm.gain, t + 0.01);
      g.gain.setValueAtTime(fm.gain, t + duration * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.connect(bp).connect(g).connect(this._out());
    }
    src.start(t);
    src.stop(t + duration);
  }

  /**
   * FM synthesis — carrier oscillator whose frequency is modulated by
   * another oscillator.  Produces metallic, bell-like, or complex tones
   * impossible with simple waveforms.
   *
   *   Metallic / bell:  modRatio ≈ 1.4, high modDepth
   *   Gong / deep bell:  low carrier, modRatio ≈ 2.5
   *   Electric buzz:     modRatio = integer, moderate depth
   */
  _playFM(carrierHz, modRatio, modDepth, duration, volume = 0.06, delay = 0, type = 'sine') {
    const ctx = this._ensureContext();
    const t = ctx.currentTime + delay;
    // Modulator
    const mod = ctx.createOscillator();
    mod.frequency.setValueAtTime(carrierHz * modRatio, t);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(modDepth, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + duration);
    mod.connect(modGain);
    // Carrier
    const carrier = ctx.createOscillator();
    carrier.type = type;
    carrier.frequency.setValueAtTime(carrierHz, t);
    modGain.connect(carrier.frequency);  // FM connection
    // Output envelope
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    carrier.connect(g).connect(this._out());
    mod.start(t);
    carrier.start(t);
    mod.stop(t + duration);
    carrier.stop(t + duration);
  }

  /** Noise burst with bandpass filter — for textured impacts. */
  _playBandNoise(duration, volume = 0.04, delay = 0, centerFreq = 1000, Q = 1) {
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
    f.type = 'bandpass'; f.frequency.value = centerFreq; f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(f).connect(g).connect(this._out());
    src.start(t);
    src.stop(t + duration);
  }

  /** Highpass-filtered noise — hisses, air, sparkle. */
  _playHissNoise(duration, volume = 0.04, delay = 0, freq = 4000) {
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
    f.type = 'highpass'; f.frequency.value = freq; f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(f).connect(g).connect(this._out());
    src.start(t);
    src.stop(t + duration);
  }

  // ─── symphony note (warm music-box tone) ─────────────────

  _playSymphonyNote(freq) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    const dur = 0.22;
    const vol = 0.08;
    const out = this._musicBus || ctx.destination;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + dur);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 3, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, now);
    g2.gain.linearRampToValueAtTime(vol * 0.12, now + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.6);
    osc2.connect(g2).connect(out);
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
  getCurrentPieceIndex() { return this._getCurrentPiece().pieceIdx; }
  getGenerativeMelodyName() { return this._gameMusic ? this._gameMusic.getCurrentName() : ''; }
  getPieces() { return this._pieces; }

  /** Jump to the start of a specific symphony by index. */
  playSymphony(pieceIdx) {
    if (pieceIdx < 0 || pieceIdx >= this._pieces.length) return;
    // Calculate the global melodyIndex for the first note of this piece
    let idx = 0;
    for (let i = 0; i < pieceIdx; i++) idx += this._pieces[i].notes.length;
    this.game.stats.melodyIndex = idx;
    // Ensure music is playing
    if (!this._musicPlaying) this.startMusic();
  }
  getCurrentBPM()       { return this._getCurrentPiece().piece.bpm; }
  /** Sync target = piece's own BPM. */
  getTargetClickBPM()   { return this.getCurrentBPM(); }
  /** True when background music is playing and user isn't actively clicking. */
  isAutoPlaying() {
    if (!this._musicPlaying) return false;
    if (this._clickTimes.length === 0) return true;
    const last = this._clickTimes[this._clickTimes.length - 1];
    const beatMs = 60000 / this.getCurrentBPM();
    return Date.now() - last > beatMs * 2.5;
  }

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
    if (!this.game.settings.music) return false;
    if (this.isAutoPlaying()) return false;
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

  // ─── background music (always-on symphony) ──────────────────

  /** Start the background music timer — symphony plays at piece BPM. */
  startMusic() {
    if (this._musicPlaying || !this._canPlayMusic()) return;
    this._ensureContext();
    this._musicPlaying = true;
    this._musicTick();
  }

  /** Stop the background music timer. */
  stopMusic() {
    this._musicPlaying = false;
    if (this._musicTimer) {
      clearTimeout(this._musicTimer);
      this._musicTimer = null;
    }
  }

  _musicTick() {
    if (!this._musicPlaying || !this._canPlayMusic()) {
      this._musicPlaying = false;
      return;
    }
    this._advanceNote();
    this._lastNoteTime = performance.now();
    const ms = 60000 / this.getCurrentBPM();
    this._musicTimer = setTimeout(() => this._musicTick(), ms);
  }

  /** Legacy alias. */
  stopAutoPlay() { this.stopMusic(); }

  // ─── shared note playback ─────────────────────────────────

  _advanceNote() {
    const { piece, noteIdx } = this._getCurrentPiece();
    const midi = piece.notes[noteIdx];
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    this._playSymphonyNote(freq);
    this.game.stats.melodyIndex = ((this.game.stats.melodyIndex || 0) + 1) % this._totalNotes;
  }

  // ─── public sound events ──────────────────────────────────

  /**
   * Cookie click.
   * Each click plays the next note immediately and resets the background
   * music timer so it waits a full beat before the next auto-note.
   * Min-gap prevents double-hits from rapid clicking.
   */
  click() {
    if (!this._canPlayMusic()) return;

    this._clickTimes.push(Date.now());
    if (this._clickTimes.length > 12) this._clickTimes.shift();

    // Ensure background music is running
    if (!this._musicPlaying) this.startMusic();

    // Minimum gap from last note to avoid double-hits
    const gap = performance.now() - (this._lastNoteTime || 0);
    const minGap = 60000 / (this.getCurrentBPM() * 2.5); // ~40% of a beat
    if (gap < minGap) return;

    // Play note immediately
    this._advanceNote();
    this._lastNoteTime = performance.now();

    // Reset background timer so it waits a full beat from now
    if (this._musicTimer) clearTimeout(this._musicTimer);
    const ms = 60000 / this.getCurrentBPM();
    this._musicTimer = setTimeout(() => this._musicTick(), ms);

    // Duck generative melodies while clicking
    this._duckMelody();
  }

  /** Smoothly lower melody volume while clicking, restore after inactivity. */
  _duckMelody() {
    if (!this._melodyBus) return;
    const ctx = this._ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // Quick duck down to 15%
    this._melodyBus.gain.cancelScheduledValues(t);
    this._melodyBus.gain.setTargetAtTime(0.15, t, 0.08);

    // Reset the restore timer — melody comes back ~1.8 s after last click
    if (this._melodyDuckTimer) clearTimeout(this._melodyDuckTimer);
    this._melodyDuckTimer = setTimeout(() => {
      if (!this._ctx) return;
      const rt = this._ctx.currentTime;
      this._melodyBus.gain.cancelScheduledValues(rt);
      this._melodyBus.gain.setTargetAtTime(1.0, rt, 0.6);   // slow fade back
      this._melodyDuckTimer = null;
    }, 1800);
  }

  // ─── initialization (call from game.start) ─────────────────

  /** Start music & ambient immediately; fall back to first interaction if browser blocks autoplay. */
  init() {
    this._ensureContext();

    const startAll = () => {
      if (this._canPlayMusic() && !this._musicPlaying) this.startMusic();
      if (this._canPlayMusic()) this.startMelody();
      if (this._canPlayAmbient() && !this._ambientActive) this.startAmbient();
    };

    // Try starting right away
    startAll();

    // If the browser suspended the context, also listen for first interaction
    if (this._ctx.state !== 'running') {
      const onInteract = () => {
        this._ctx.resume().then(() => startAll());
        document.removeEventListener('click', onInteract);
        document.removeEventListener('keydown', onInteract);
      };
      document.addEventListener('click', onInteract);
      document.addEventListener('keydown', onInteract);
    }
  }

  // ─── generative melody (Music setting) ──────────────────────

  /** Start the generative melody engine. */
  startMelody() {
    if (!this._canPlayMusic()) return;
    this._ensureContext();
    if (!this._gameMusic) {
      this._gameMusic = new GameMusic(this._ctx, this._melodyBus || this._musicBus);
      // Restore the correct apocalypse stage from save data.
      // loadSaveData calls applyStageTheme via requestAnimationFrame, but _gameMusic
      // doesn't exist yet at that point, so we sync it explicitly here.
      if (this.game.grandmapocalypse) {
        const gp = this.game.grandmapocalypse;
        const effectiveStage = (gp.elderPledgeActive || gp.covenantActive)
          ? 0
          : gp.getStage();
        this._gameMusic.setApocalypseMode(effectiveStage);
      }
    }
    this._gameMusic.start();
  }

  /** Stop the generative melody engine. */
  stopMelody() {
    if (this._gameMusic) this._gameMusic.stop();
  }

  // ─── ambient soundscape ─────────────────────────────────────

  // Smooth voice-led chord progression.  Each entry is
  //   [bass Hz, pad-voice 1 Hz, pad-voice 2 Hz, pad-voice 3 Hz]
  // Designed so at most 2 voices move per change, and never all
  // downward — prevents the "saddening dip" after bright chords.
  // Bass stays C3-F3, pads stay E4-C5.
  static _AMBIENT_CHORDS = [
    [130.8, 329.6, 392.0, 493.9],  // Cmaj7
    [130.8, 329.6, 440.0, 523.3],  // Am7/C    (G→A, B→C: gentle rise)
    [146.8, 349.2, 440.0, 523.3],  // Fmaj7    (bass+step, E→F: rise)
    [146.8, 349.2, 392.0, 493.9],  // Dm11     (A→G, C→B: ease back)
    [164.8, 329.6, 392.0, 493.9],  // Em7      (bass+step, F→E: settle)
    [164.8, 329.6, 440.0, 523.3],  // Am/E     (G→A, B→C: lift)
    [174.6, 349.2, 440.0, 523.3],  // Fmaj7    (bass+step, E→F: rise)
    [174.6, 349.2, 392.0, 493.9],  // Bb6/F    (A→G, C→B: gentle ease)
    [146.8, 329.6, 392.0, 523.3],  // Gsus4/D  (bass-step, F→E, B→C: mixed)
    [130.8, 329.6, 392.0, 493.9],  // Cmaj7    (home: bass-step, C→B)
  ];

  /** Start the ambient soundscape (drone + shimmer + bakery events). */
  startAmbient() {
    if (this._ambientActive) return;
    this._ensureContext();
    this._ambientActive = true;
    this._ambientChordIdx = Math.floor(Math.random() * SoundManager._AMBIENT_CHORDS.length);
    this._createAmbientDrone();
    this._scheduleAmbientChord();
    this._scheduleAmbientEvent();
  }

  /** Stop the ambient soundscape, fade out all layers. */
  stopAmbient() {
    this._ambientActive = false;
    const ctx = this._ctx;
    if (ctx) {
      const t = ctx.currentTime;
      for (const { node, gain } of this._ambientNodes) {
        try { gain.gain.setTargetAtTime(0, t, 0.3); } catch (_) {}
        setTimeout(() => { try { node.stop(); } catch (_) {} }, 1000);
      }
    }
    this._ambientNodes = [];
    this._ambientPadOscs = [];
    this._ambientBassOsc = null;
    for (const k of ['_ambientEventTimer', '_ambientChordTimer']) {
      if (this[k]) { clearTimeout(this[k]); this[k] = null; }
    }
  }

  _createNoiseBuffer(seconds) {
    const ctx = this._ensureContext();
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── ambient drone (evolving pad + bass + noise + shimmer) ───

  _createAmbientDrone() {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    const chord = SoundManager._AMBIENT_CHORDS[this._ambientChordIdx];

    // ── Master gain with slow breathing LFO ──
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(1, now + 5);   // fade in
    master.connect(this._ambientBus || ctx.destination);

    const breathLFO = ctx.createOscillator();
    breathLFO.type = 'sine';
    breathLFO.frequency.setValueAtTime(0.055, now);     // ~18 s full cycle
    const breathDepth = ctx.createGain();
    breathDepth.gain.setValueAtTime(0.18, now);          // ±18 % volume swell
    breathLFO.connect(breathDepth).connect(master.gain);
    breathLFO.start(now);
    this._ambientNodes.push({ node: breathLFO, gain: breathDepth });

    // ── Bass drone (sine + vibrato) ──
    const bassOsc = ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(chord[0], now);
    const bassVib = ctx.createOscillator();
    bassVib.frequency.setValueAtTime(0.25, now);
    const bassVibG = ctx.createGain();
    bassVibG.gain.setValueAtTime(1.2, now);
    bassVib.connect(bassVibG).connect(bassOsc.frequency);
    bassVib.start(now);
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.012, now);
    bassOsc.connect(bassGain).connect(master);
    bassOsc.start(now);
    this._ambientBassOsc = bassOsc;
    this._ambientNodes.push({ node: bassOsc, gain: bassGain });
    this._ambientNodes.push({ node: bassVib, gain: bassVibG });

    // ── Pad voices (3 detuned triangle-wave pairs → chord tones) ──
    this._ambientPadOscs = [];
    for (let i = 1; i <= 3; i++) {
      const freq = chord[i];
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now);
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 1.004, now); // gentle chorus detune
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.006, now);
      osc1.connect(g);
      osc2.connect(g);
      g.connect(master);
      osc1.start(now);
      osc2.start(now);
      this._ambientPadOscs.push({ osc1, osc2 });
      this._ambientNodes.push({ node: osc1, gain: g });
      this._ambientNodes.push({ node: osc2, gain: g });
    }

    // ── Room tone (noise with slowly-sweeping lowpass) ──
    const roomBuf = this._createNoiseBuffer(4);
    const roomSrc = ctx.createBufferSource();
    roomSrc.buffer = roomBuf;
    roomSrc.loop = true;
    const roomLP = ctx.createBiquadFilter();
    roomLP.type = 'lowpass';
    roomLP.frequency.setValueAtTime(200, now);
    const filterLFO = ctx.createOscillator();
    filterLFO.type = 'sine';
    filterLFO.frequency.setValueAtTime(0.025, now);     // ~40 s sweep
    const filterDepth = ctx.createGain();
    filterDepth.gain.setValueAtTime(120, now);           // ±120 Hz
    filterLFO.connect(filterDepth).connect(roomLP.frequency);
    filterLFO.start(now);
    const roomGain = ctx.createGain();
    roomGain.gain.setValueAtTime(0.003, now);
    roomSrc.connect(roomLP).connect(roomGain).connect(master);
    roomSrc.start(now);
    this._ambientNodes.push({ node: roomSrc, gain: roomGain });
    this._ambientNodes.push({ node: filterLFO, gain: filterDepth });

    // ── High shimmer sparkle ──
    const shimBuf = this._createNoiseBuffer(3);
    const shimSrc = ctx.createBufferSource();
    shimSrc.buffer = shimBuf;
    shimSrc.loop = true;
    const shimHP = ctx.createBiquadFilter();
    shimHP.type = 'highpass';
    shimHP.frequency.setValueAtTime(5500, now);
    const shimGain = ctx.createGain();
    shimGain.gain.setValueAtTime(0.0008, now);
    shimSrc.connect(shimHP).connect(shimGain).connect(master);
    shimSrc.start(now);
    this._ambientNodes.push({ node: shimSrc, gain: shimGain });
  }

  // ── chord progression (smooth frequency ramps) ─────────────

  _scheduleAmbientChord() {
    if (!this._ambientActive) return;
    const delay = 18000 + Math.random() * 14000; // 18–32 s
    this._ambientChordTimer = setTimeout(() => {
      if (!this._ambientActive) return;
      this._ambientChordChange();
      this._scheduleAmbientChord();
    }, delay);
  }

  _ambientChordChange() {
    const chords = SoundManager._AMBIENT_CHORDS;
    this._ambientChordIdx = (this._ambientChordIdx + 1) % chords.length;
    const chord = chords[this._ambientChordIdx];
    const ctx = this._ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const ramp = 4; // 4-second crossfade

    // Ramp bass
    if (this._ambientBassOsc) {
      this._ambientBassOsc.frequency.exponentialRampToValueAtTime(
        chord[0], t + ramp);
    }
    // Ramp pad voices
    for (let i = 0; i < this._ambientPadOscs.length; i++) {
      const { osc1, osc2 } = this._ambientPadOscs[i];
      const f = chord[i + 1];
      osc1.frequency.exponentialRampToValueAtTime(f, t + ramp);
      osc2.frequency.exponentialRampToValueAtTime(f * 1.004, t + ramp);
    }
  }

  // ── bakery sound events ────────────────────────────────────

  _scheduleAmbientEvent() {
    if (!this._ambientActive) return;
    const delay = 4000 + Math.random() * 8000; // 4–12 s
    this._ambientEventTimer = setTimeout(() => {
      if (!this._ambientActive) return;
      this._playAmbientEvent();
      this._scheduleAmbientEvent();
    }, delay);
  }

  _playAmbientEvent() {
    if (!this._canPlayAmbient()) return;
    this._currentBus = this._ambientBus;        // route through ambient bus
    const vol = 0.014 + Math.random() * 0.012;
    const pick = Math.random();

    if (pick < 0.22) {
      // Crackle / pop
      this._playBandNoise(0.03 + Math.random() * 0.04, vol, 0,
        800 + Math.random() * 1200, 2);
      if (Math.random() > 0.5) {
        this._playBandNoise(0.02, vol * 0.6, 0.06,
          1000 + Math.random() * 800, 3);
      }
    } else if (pick < 0.36) {
      // Gentle steam hiss
      this._playHissNoise(0.12 + Math.random() * 0.18, vol * 0.5, 0,
        3000 + Math.random() * 2000);
    } else if (pick < 0.46) {
      // Soft bubble pop
      this._playFM(180 + Math.random() * 120, 2, 60, 0.08, vol * 0.7);
    } else if (pick < 0.55) {
      // Distant timer ding
      this._playTone('sine', 1350 + Math.random() * 250, 1200, 0.35, vol * 0.4);
    } else if (pick < 0.64) {
      // Cookie sheet scrape
      this._playBandNoise(0.18, vol * 0.35, 0, 2200 + Math.random() * 800, 0.5);
      this._playFM(280, 3.5, 120, 0.12, vol * 0.25, 0.04);
    } else if (pick < 0.73) {
      // Butter sizzle
      this._playNoise(0.08 + Math.random() * 0.12, vol * 0.4, 0, 3200);
    } else if (pick < 0.82) {
      // Soft wooden knock
      this._playFM(120, 1.4, 200, 0.06, vol * 0.6);
      this._playBandNoise(0.04, vol * 0.3, 0.02, 600, 1.5);
    } else if (pick < 0.91) {
      // Oven door creak
      this._playTone('sawtooth', 60, 90, 0.25, vol * 0.2);
      this._playBandNoise(0.15, vol * 0.2, 0.05, 400, 0.8);
    } else {
      // Resonant harmonic bell (new — musical event)
      const bellFreq = [329.6, 392.0, 440.0, 523.3][Math.floor(Math.random() * 4)];
      this._playFM(bellFreq, 1.4, bellFreq * 0.8, 1.2, vol * 0.3);
    }
    this._currentBus = null;                    // reset routing
  }

  // ─── public sound events ──────────────────────────────────

  purchase(count = 1, buildingIndex = 0) {
    if (!this._canPlayEffects()) return;
    // Base pitch rises 2 semitones per building tier (cursor=0, grandma=+2, farm=+4, ...)
    // Then quarter-semitone per count owned
    const tierShift = buildingIndex * 2;
    const countShift = Math.min(count, 200) * 0.25;
    const pitch = Math.pow(1.0595, tierShift + countShift);
    this._playTone('triangle', 250 * pitch, 200 * pitch, 0.1, 0.06);
  }

  upgrade(level = 1) {
    if (!this._canPlayEffects()) return;
    // Each level raises pitch by a semitone (ratio ≈ 1.0595)
    const pitch = Math.pow(1.0595, Math.min(level - 1, 24));
    this._playTone('sine', 440 * pitch, 440 * pitch, 0.12, 0.06);
    this._playTone('sine', 660 * pitch, 660 * pitch, 0.15, 0.07, 0.1);
  }

  achievement() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 330, 330, 0.4, 0.05);
    this._playTone('sine', 415, 415, 0.35, 0.05, 0.08);
    this._playTone('sine', 494, 494, 0.3, 0.06, 0.16);
    this._playTone('triangle', 660, 660, 0.3, 0.04, 0.24);
  }

  goldenCookie() {
    if (!this._canPlayEffects()) return;
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
    if (!this._canPlayEffects()) return;
    // Similar to golden but shorter, one sweep + chime
    this._playTone('sine', 880, 1320, 0.2, 0.05);
    this._playTone('triangle', 1047, 1047, 0.12, 0.04, 0.08);
    this._playTone('triangle', 1319, 1319, 0.12, 0.04, 0.16);
    this._playNoise(0.12, 0.03, 0.05, 3500);
  }

  frenzy() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 120, 300, 0.35, 0.07);
    this._playTone('sine', 200, 500, 0.25, 0.04, 0.15);
  }

  miniGameWin() {
    if (!this._canPlayEffects()) return;
    this._playSequence('triangle', [392, 494, 588], 0.1, 0.06);
  }

  prestige() {
    if (!this._canPlayEffects()) return;
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
    if (!this._canPlayEffects()) return;
    // Richer than normal upgrade — resonant chord with shimmer
    this._playTone('sine', 440, 440, 0.18, 0.06);
    this._playTone('sine', 554, 554, 0.18, 0.05, 0.04);
    this._playTone('sine', 660, 660, 0.2, 0.06, 0.08);
    this._playTone('triangle', 880, 880, 0.25, 0.04, 0.14);
    this._playNoise(0.1, 0.02, 0.12, 3000);
  }

  // ─── UI interaction sounds ──────────────────────────────

  uiClick() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 600, 500, 0.04, 0.03);
  }

  panelOpen() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 300, 500, 0.08, 0.04);
    this._playTone('triangle', 400, 600, 0.06, 0.02, 0.02);
  }

  panelClose() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 500, 300, 0.08, 0.03);
  }

  // ─── Tutorial (gentle, informational) ────────────────────

  tutorialNext() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 480, 640, 0.1, 0.05);
    this._playNoise(0.06, 0.02, 0.02, 2000);
  }

  tutorialSkip() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 500, 350, 0.1, 0.04);
    this._playTone('triangle', 400, 250, 0.1, 0.03, 0.02);
  }

  // ─── News / Reporter ─────────────────────────────────────

  anchorHairClick() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 300, 800, 0.1, 0.05);
    this._playTone('sine', 800, 300, 0.1, 0.05, 0.1);
    this._playTone('triangle', 500, 600, 0.08, 0.03, 0.05);
  }

  /** First time clicking the anchor — special discovery chime. */
  anchorGreetFirst() {
    if (!this._canPlayEffects()) return;
    // Warm hello jingle — rising thirds
    this._playTone('sine', 392, 392, 0.15, 0.06);
    this._playTone('sine', 494, 494, 0.15, 0.06, 0.12);
    this._playTone('sine', 588, 588, 0.15, 0.06, 0.24);
    this._playTone('triangle', 784, 784, 0.25, 0.05, 0.36);
    this._playNoise(0.12, 0.02, 0.36, 3500);
    // Tiny sparkle
    this._playTone('sine', 1568, 1200, 0.15, 0.03, 0.48);
  }

  /** Subsequent anchor clicks — short cheerful chirp. */
  anchorGreet() {
    if (!this._canPlayEffects()) return;
    const pitch = 0.9 + Math.random() * 0.3;
    this._playTone('sine', 520 * pitch, 620 * pitch, 0.06, 0.04);
    this._playTone('triangle', 660 * pitch, 720 * pitch, 0.05, 0.03, 0.04);
  }

  newsPlayDice() {
    if (!this._canPlayEffects()) return;
    this._playNoise(0.04, 0.04, 0, 3000);
    this._playNoise(0.04, 0.04, 0.06, 3000);
    this._playNoise(0.04, 0.04, 0.12, 3000);
    this._playTone('triangle', 500, 600, 0.08, 0.03, 0.16);
  }

  // ─── Slot Machine (casino — triangle waves, bright) ──────

  slotReelTick() {
    if (!this._canPlayEffects()) return;
    this._playTone('square', 800, 780, 0.02, 0.03);
  }

  slotReelStop() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 600, 400, 0.08, 0.05);
    this._playTone('square', 200, 200, 0.04, 0.03, 0.02);
  }

  slotJackpot() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 523, 523, 0.12, 0.06);
    this._playTone('triangle', 659, 659, 0.12, 0.06, 0.1);
    this._playTone('triangle', 784, 784, 0.12, 0.06, 0.2);
    this._playTone('triangle', 1047, 1047, 0.2, 0.07, 0.3);
    this._playNoise(0.2, 0.04, 0.3, 4000);
  }

  slotPairWin() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 523, 523, 0.1, 0.05);
    this._playTone('triangle', 659, 659, 0.12, 0.05, 0.08);
  }

  slotLoss() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 300, 200, 0.15, 0.04);
  }

  slotSpinAgain() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 440, 550, 0.06, 0.04);
    this._playTone('triangle', 550, 660, 0.06, 0.04, 0.06);
  }

  slotCashOut() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 660, 440, 0.1, 0.05);
    this._playNoise(0.08, 0.03, 0.04, 3000);
  }

  // ─── Speed Click (energetic — sawtooth, high freq) ───────

  speedCountdownTick() {
    if (!this._canPlayEffects()) return;
    this._playTone('square', 880, 880, 0.06, 0.04);
  }

  speedGo() {
    if (!this._canPlayEffects()) return;
    this._playTone('sawtooth', 440, 880, 0.15, 0.06);
    this._playNoise(0.08, 0.04, 0.05, 4000);
  }

  speedTap() {
    if (!this._canPlayEffects()) return;
    this._playTone('square', 1200, 1000, 0.02, 0.03);
  }

  speedEnd() {
    if (!this._canPlayEffects()) return;
    this._playTone('sawtooth', 880, 220, 0.3, 0.05);
    this._playTone('sine', 330, 330, 0.2, 0.04, 0.15);
  }

  // ─── Cookie Catch (playful — sine, airy) ─────────────────

  catchCookieSpawn() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 1200, 1500, 0.05, 0.03);
  }

  catchCookieCaught() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 700, 900, 0.06, 0.04);
    this._playTone('sine', 900, 1100, 0.06, 0.04, 0.04);
  }

  catchCookieMissed() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 600, 300, 0.1, 0.03);
  }

  // ─── Trivia (quiz show — clean bells) ────────────────────

  triviaQuestionAppear() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 660, 660, 0.1, 0.04);
    this._playTone('sine', 880, 880, 0.12, 0.05, 0.08);
  }

  triviaCorrect() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 523, 523, 0.1, 0.05);
    this._playTone('sine', 784, 784, 0.12, 0.06, 0.08);
  }

  triviaWrong() {
    if (!this._canPlayEffects()) return;
    this._playTone('sawtooth', 180, 150, 0.2, 0.04);
  }

  triviaTimeUp() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 440, 440, 0.1, 0.04);
    this._playTone('sine', 330, 330, 0.1, 0.04, 0.1);
    this._playTone('sine', 220, 220, 0.15, 0.04, 0.2);
  }

  // ─── Emoji Memory (mystical — warm sine, gentle) ─────────

  memoryFlip() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 400, 600, 0.08, 0.04);
    this._playNoise(0.03, 0.02, 0.02, 2500);
  }

  memoryMatch() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 523, 523, 0.12, 0.05);
    this._playTone('sine', 659, 659, 0.12, 0.05, 0.08);
    this._playTone('sine', 784, 784, 0.15, 0.05, 0.16);
  }

  memoryMismatch() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 400, 300, 0.1, 0.03);
    this._playTone('sine', 350, 250, 0.1, 0.03, 0.05);
  }

  memoryCelebration() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 523, 523, 0.1, 0.05);
    this._playTone('sine', 659, 659, 0.1, 0.05, 0.08);
    this._playTone('sine', 784, 784, 0.1, 0.05, 0.16);
    this._playTone('sine', 1047, 1047, 0.1, 0.06, 0.24);
    this._playTone('sine', 1319, 1319, 0.15, 0.06, 0.32);
    this._playNoise(0.15, 0.03, 0.3, 5000);
  }

  // ─── Cookie Cutter (crafty — noise textures) ─────────────

  cutterDrawStroke() {
    if (!this._canPlayEffects()) return;
    const now = performance.now();
    if (now - (this._lastCutterStroke || 0) < 100) return;
    this._lastCutterStroke = now;
    this._playNoise(0.04, 0.03, 0, 1500);
  }

  cutterShapeComplete() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 350, 500, 0.1, 0.05);
    this._playTone('sine', 500, 500, 0.08, 0.04, 0.05);
    this._playNoise(0.06, 0.03, 0.08, 2000);
  }

  // ─── Cookie Defense (militaristic — square/sawtooth) ──────

  defenseSelectTower() {
    if (!this._canPlayEffects()) return;
    this._playTone('square', 500, 600, 0.04, 0.04);
  }

  defensePlaceTower() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 250, 180, 0.08, 0.05);
    this._playNoise(0.04, 0.03, 0.02, 1200);
  }

  defenseBattleStart() {
    if (!this._canPlayEffects()) return;
    this._playTone('sawtooth', 220, 330, 0.2, 0.05);
    this._playTone('sawtooth', 165, 248, 0.2, 0.04, 0.02);
    this._playNoise(0.15, 0.03, 0.1, 1500);
  }

  defenseTowerFire() {
    if (!this._canPlayEffects()) return;
    this._playTone('square', 1000, 400, 0.04, 0.03);
  }

  defenseEnemyHit() {
    if (!this._canPlayEffects()) return;
    this._playNoise(0.03, 0.03, 0, 800);
  }

  defenseEnemyDestroyed() {
    if (!this._canPlayEffects()) return;
    this._playTone('sawtooth', 300, 100, 0.08, 0.04);
    this._playNoise(0.06, 0.03, 0.02, 2000);
  }

  defenseLifeLost() {
    if (!this._canPlayEffects()) return;
    this._playTone('square', 330, 220, 0.1, 0.05);
    this._playTone('square', 220, 165, 0.12, 0.05, 0.08);
  }

  defenseBattleResult() {
    if (!this._canPlayEffects()) return;
    this._playTone('sawtooth', 330, 660, 0.15, 0.05);
    this._playTone('triangle', 440, 880, 0.15, 0.04, 0.1);
  }

  // ─── Grandma's Kitchen (warm/homey — low sine, cozy) ─────

  kitchenOvenOn() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 180, 250, 0.15, 0.04);
    this._playTone('triangle', 220, 280, 0.1, 0.03, 0.05);
  }

  kitchenCookieReady() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 1047, 1047, 0.25, 0.05);
  }

  kitchenPerfect() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 784, 784, 0.1, 0.05);
    this._playTone('sine', 1047, 1047, 0.1, 0.05, 0.08);
    this._playTone('sine', 1319, 1319, 0.12, 0.06, 0.16);
  }

  kitchenGood() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 784, 784, 0.12, 0.05);
  }

  kitchenRaw() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 200, 160, 0.1, 0.04);
    this._playNoise(0.06, 0.02, 0.02, 600);
  }

  kitchenBurnt() {
    if (!this._canPlayEffects()) return;
    this._playNoise(0.15, 0.04, 0, 3000);
    this._playTone('triangle', 250, 150, 0.12, 0.03, 0.05);
  }

  // ─── Math Baker (academic — triangle, precise) ───────────

  mathQuestionAppear() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 700, 750, 0.06, 0.04);
    this._playNoise(0.03, 0.02, 0.02, 4000);
  }

  mathCorrect() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 600, 600, 0.08, 0.05);
    this._playTone('triangle', 900, 900, 0.08, 0.05, 0.06);
    this._playTone('triangle', 1200, 1200, 0.1, 0.06, 0.12);
  }

  mathWrong() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 220, 160, 0.12, 0.04);
  }

  mathFastBonus() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 1000, 1500, 0.08, 0.05);
    this._playNoise(0.05, 0.03, 0.03, 5000);
  }

  mathTimeUp() {
    if (!this._canPlayEffects()) return;
    this._playTone('triangle', 500, 500, 0.08, 0.04);
    this._playTone('triangle', 400, 400, 0.08, 0.04, 0.08);
    this._playTone('triangle', 300, 300, 0.1, 0.04, 0.16);
  }

  // ─── Settings / Menu Buttons ─────────────────────────────

  replayTutorial() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 600, 400, 0.08, 0.04);
    this._playTone('sine', 400, 600, 0.08, 0.04, 0.08);
  }

  exportSave() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 400, 700, 0.1, 0.04);
    this._playNoise(0.06, 0.02, 0.04, 3000);
  }

  importSave() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 700, 400, 0.1, 0.04);
    this._playNoise(0.06, 0.02, 0.04, 3000);
  }

  wipeSave() {
    if (!this._canPlayEffects()) return;
    this._playTone('sawtooth', 100, 60, 0.25, 0.04);
    this._playNoise(0.2, 0.03, 0.05, 400);
  }

  // ─── Debug / Prestige / Other ────────────────────────────

  debugPanelOpen() {
    if (!this._canPlayEffects()) return;
    this._playTone('square', 200, 800, 0.06, 0.04);
    this._playTone('square', 800, 200, 0.06, 0.04, 0.06);
    this._playNoise(0.08, 0.03, 0.04, 3000);
  }

  debugAction() {
    if (!this._canPlayEffects()) return;
    this._playTone('square', 600, 700, 0.04, 0.04);
    this._playTone('square', 700, 800, 0.04, 0.04, 0.04);
  }

  prestigeConfirm() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 220, 220, 0.3, 0.05);
    this._playTone('sine', 277, 277, 0.3, 0.05, 0.02);
    this._playTone('sine', 330, 330, 0.35, 0.05, 0.04);
  }

  mobileTabSwitch() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 500, 550, 0.04, 0.03);
  }

  upgradePageNav() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 550, 620, 0.06, 0.03);
    this._playNoise(0.03, 0.02, 0.02, 2500);
  }

  // ─── Building info sounds ─────────────────────────────────

  /** Dispatch to per-building sound by index. */
  buildingInfo(index) {
    const fn = this._buildingSounds[index];
    if (fn) fn.call(this);
    else this.panelOpen(); // fallback
  }

  get _buildingSounds() {
    return [
      this._bldCursor,
      this._bldGrandma,
      this._bldFarm,
      this._bldFactory,
      this._bldMine,
      this._bldShipment,
      this._bldAlchemyLab,
      this._bldPortal,
      this._bldTimeMachine,
      this._bldAntimatter,
      this._bldPrism,
      this._bldChancemaker,
      this._bldFractalEngine,
      this._bldIdleverse,
      this._bldCortexBaker,
      this._bldRealityBender,
    ];
  }

  // ── Cursor — rapid-fire mouse clicking, keyboard mashing ──
  _bldCursor() {
    if (!this._canPlayEffects()) return;
    // Staccato mouse clicks — FM plastic snap transients, accelerating
    const times = [0, 0.05, 0.09, 0.12, 0.15, 0.175, 0.2, 0.22, 0.235, 0.25, 0.26, 0.27];
    times.forEach((t, i) => {
      this._playFM(1800 + (i % 3) * 200, 1.41, 600, 0.02, 0.05, t);
      this._playBandNoise(0.01, 0.025, t + 0.006, 5000, 4);
    });
    // Keyboard key mashing — lower FM thumps mixed in
    this._playFM(400, 4, 200, 0.025, 0.03, 0.03);
    this._playFM(450, 4, 180, 0.025, 0.03, 0.1);
    this._playFM(380, 4, 220, 0.025, 0.025, 0.16);
  }

  // ── Grandma — warm chuckling "heh heh heh" laughter (formant) ──
  _bldGrandma() {
    if (!this._canPlayEffects()) return;
    // Each syllable = formant vowel [ɑ] (F1=830 F2=1170 F3=2500)
    // Pitch arc: rises to peak then trails off, each syllable shorter
    const laughs = [
      { f0: 230, dur: 0.13, t: 0,    v: 0.06 },
      { f0: 255, dur: 0.11, t: 0.15, v: 0.07 },
      { f0: 270, dur: 0.10, t: 0.28, v: 0.065 },
      { f0: 250, dur: 0.11, t: 0.40, v: 0.055 },
      { f0: 230, dur: 0.13, t: 0.53, v: 0.04 },
      { f0: 215, dur: 0.18, t: 0.68, v: 0.03 },
    ];
    for (const s of laughs) {
      // Breathy "h" onset
      this._playHissNoise(0.03, s.v * 0.5, s.t, 2500);
      // Voiced vowel
      this._playVowel(s.f0, 830, 1170, 2500, s.dur, s.v, s.t + 0.02);
    }
    // Warm hum underneath
    this._playTone('sine', 220, 215, 0.7, 0.012, 0.05);
  }

  // ── Farm — rooster crow (formant), rustling wheat, tractor putt-putt ──
  _bldFarm() {
    if (!this._canPlayEffects()) return;
    // Rooster crow — formant "er-er-er-errr" rising then falling
    // [ɛ] vowel: F1=600 F2=1930 F3=2500
    this._playVowel(350, 600, 1930, 2500, 0.08, 0.04, 0);      // "er"
    this._playVowel(420, 600, 1930, 2500, 0.08, 0.045, 0.08);  // "er" higher
    this._playVowel(480, 600, 1930, 2500, 0.06, 0.05, 0.16);   // "er" peak
    this._playVowel(500, 830, 1170, 2500, 0.22, 0.05, 0.22);   // "rrrrr" sustained
    this._playVowel(400, 830, 1170, 2500, 0.15, 0.03, 0.4);    // falling tail
    // Wind rustling through crops
    this._playNoise(0.5, 0.025, 0.05, 600);
    this._playBandNoise(0.4, 0.02, 0.1, 400, 1.5);
    // Tractor putt-putt — low FM engine chugging
    for (let i = 0; i < 4; i++) {
      this._playFM(50, 1.5, 30, 0.06, 0.03, 0.55 + i * 0.1);
      this._playNoise(0.03, 0.02, 0.57 + i * 0.1, 300);
    }
  }

  // ── Factory — big stamping press, steam release, assembly line ──
  _bldFactory() {
    if (!this._canPlayEffects()) return;
    // Heavy stamping press — FM metal impact + ring-out
    this._playFM(80, 1.41, 400, 0.06, 0.07, 0.05);
    this._playBandNoise(0.04, 0.06, 0.05, 1500, 3);
    this._playFM(500, 1.41, 250, 0.25, 0.03, 0.08);  // metallic ring
    // Steam valve release — loud hiss
    this._playHissNoise(0.2, 0.05, 0.15, 2500);
    this._playNoise(0.15, 0.03, 0.15, 1200);
    // Second press stamp
    this._playFM(75, 1.41, 350, 0.06, 0.06, 0.35);
    this._playBandNoise(0.04, 0.05, 0.35, 1400, 3);
    this._playFM(480, 1.41, 200, 0.2, 0.025, 0.38);
    // Assembly line conveyor — rhythmic belt clatter
    for (let i = 0; i < 6; i++) {
      this._playFM(600, 2.5, 100, 0.012, 0.02, 0.18 + i * 0.065);
    }
    // Big machinery hum
    this._playTone('sawtooth', 55, 50, 0.6, 0.035);
    this._playTone('sawtooth', 82, 78, 0.55, 0.025, 0.02);
    // Alarm horn honk
    this._playVowel(150, 500, 1500, 2500, 0.08, 0.03, 0.6);
  }

  // ── Mine — pickaxe clangs (FM metal-on-stone), cave echo, minecart ──
  _bldMine() {
    if (!this._canPlayEffects()) return;
    // CLANG 1 — pickaxe hit: FM metallic strike + stone crack
    this._playFM(900, 1.41, 900, 0.18, 0.07, 0);
    this._playFM(1200, 2.76, 500, 0.12, 0.035, 0.005);
    this._playBandNoise(0.06, 0.06, 0.01, 3000, 4);
    // Cave echo 1 (quieter, delayed)
    this._playFM(880, 1.41, 600, 0.14, 0.025, 0.18);
    this._playFM(860, 1.41, 400, 0.1, 0.012, 0.32);
    // CLANG 2 — different pitch
    this._playFM(800, 1.41, 800, 0.18, 0.06, 0.25);
    this._playFM(1100, 2.76, 400, 0.12, 0.03, 0.255);
    this._playBandNoise(0.05, 0.05, 0.26, 2800, 4);
    // Cave echo 2
    this._playFM(780, 1.41, 500, 0.14, 0.02, 0.42);
    // Rock crumble — cascading rubble
    this._playNoise(0.18, 0.035, 0.3, 1200);
    this._playBandNoise(0.15, 0.025, 0.35, 600, 1.5);
    // Dripping water plops
    this._playTone('sine', 2200, 1400, 0.04, 0.03, 0.12);
    this._playTone('sine', 2500, 1600, 0.035, 0.025, 0.48);
  }

  // ── Shipment — full rocket launch: countdown beeps → ignition → liftoff roar ──
  _bldShipment() {
    if (!this._canPlayEffects()) return;
    // ── Countdown beeps: 3 — 2 — 1 ──
    this._playTone('sine', 800, 800, 0.08, 0.04, 0);
    this._playTone('sine', 800, 800, 0.08, 0.04, 0.18);
    this._playTone('sine', 1200, 1200, 0.12, 0.05, 0.36); // "1" is higher + longer

    // ── Ignition sequence (rumbling growl building) ──
    // Deep combustion rumble — grows from nothing
    this._playFM(35, 1, 15, 0.6, 0.02, 0.45);
    this._playFM(50, 1.5, 20, 0.55, 0.025, 0.48);
    this._playFM(70, 1, 25, 0.5, 0.03, 0.52);
    // Low-end shake
    this._playNoise(0.55, 0.03, 0.45, 200);
    this._playBandNoise(0.5, 0.025, 0.5, 150, 1);

    // ── Main engine roar (wall of noise, broadband) ──
    this._playNoise(0.5, 0.055, 0.6, 1500);
    this._playNoise(0.45, 0.05, 0.62, 3000);
    this._playHissNoise(0.4, 0.04, 0.65, 2000);
    this._playBandNoise(0.45, 0.035, 0.6, 800, 1);
    // Crackling flame texture
    this._playBandNoise(0.35, 0.03, 0.65, 4000, 3);
    this._playBandNoise(0.3, 0.025, 0.7, 5000, 4);

    // ── Liftoff: ascending pitch sweep (rocket climbing away) ──
    this._playTone('sine', 100, 2000, 0.45, 0.04, 0.7);
    this._playTone('triangle', 150, 2500, 0.4, 0.025, 0.72);
    this._playFM(80, 1.5, 60, 0.4, 0.03, 0.7);

    // ── Fade into distance (noise fading, high-freq receding) ──
    this._playHissNoise(0.25, 0.02, 0.95, 3000);
    this._playBandNoise(0.2, 0.015, 1.0, 1500, 2);
  }

  // ── Alchemy Lab — potion bubbling, glass flask clink, magical transmutation ──
  _bldAlchemyLab() {
    if (!this._canPlayEffects()) return;
    // Bubbling liquid — FM pops at irregular intervals (like boiling water)
    const pops = [0, 0.06, 0.1, 0.13, 0.19, 0.22, 0.28, 0.31, 0.37, 0.4, 0.45, 0.48];
    pops.forEach((t, i) => {
      const size = 200 + Math.sin(i * 2.1) * 150;
      this._playFM(size, 2, size * 2, 0.03, 0.035, t);
    });
    // Glass flask clink — FM bell tones
    this._playFM(2200, 1.41, 600, 0.2, 0.04, 0.15);
    this._playFM(3300, 2.76, 300, 0.15, 0.02, 0.155);
    // Pouring liquid — sustained noise band
    this._playBandNoise(0.2, 0.03, 0.5, 3000, 2);
    this._playHissNoise(0.15, 0.02, 0.55, 4000);
    // Magical transmutation — shimmering ascending sweep
    this._playFM(400, 3, 500, 0.25, 0.03, 0.3);
    this._playFM(600, 3, 700, 0.2, 0.025, 0.35);
    this._playFM(900, 3, 900, 0.18, 0.02, 0.4);
    // Fizzing reaction
    this._playBandNoise(0.3, 0.02, 0.15, 3500, 2);
  }

  // ── Portal — otherworldly void opening, ghostly whispers, reality warping ──
  _bldPortal() {
    if (!this._canPlayEffects()) return;
    // Deep void bass drone — ominous, dissonant
    this._playFM(40, 1.01, 20, 0.7, 0.05, 0);
    this._playFM(60, 1.5, 30, 0.6, 0.03, 0.02);
    this._playTone('sine', 40, 40, 0.7, 0.04, 0.01);
    // Dimensional rip — harsh tearing screech
    this._playFM(100, 3.1, 600, 0.15, 0.045, 0.12);
    this._playFM(150, 4.7, 800, 0.12, 0.035, 0.14);
    this._playNoise(0.1, 0.04, 0.12, 1500);
    // Ghost whispers — formant vowels, barely audible
    this._playVowel(90, 330, 1260, 2500, 0.25, 0.02, 0.2);   // "ooh"
    this._playVowel(95, 830, 1170, 2500, 0.2, 0.018, 0.35);  // "aah"
    this._playVowel(85, 600, 1930, 2500, 0.15, 0.015, 0.5);  // "ehh"
    // Reality wobble — beating frequencies
    this._playTone('sine', 200, 200, 0.4, 0.02, 0.15);
    this._playTone('sine', 203, 203, 0.4, 0.02, 0.15);
    // Howling wind from the other side
    this._playNoise(0.5, 0.025, 0.1, 250);
  }

  // ── Time Machine — clock tick-tock, gears winding, rewind whoosh, deep bell ──
  _bldTimeMachine() {
    if (!this._canPlayEffects()) return;
    // Clock tick-tock — FM woodblock percussion
    for (let i = 0; i < 6; i++) {
      this._playFM(i % 2 ? 400 : 500, 4, 300, 0.025, 0.04, i * 0.085);
    }
    // Gears winding up — accelerating FM metallic whirr
    this._playFM(150, 3.1, 100, 0.35, 0.02, 0.05);
    this._playFM(200, 2.5, 80, 0.3, 0.015, 0.08);
    // Time rewind whoosh — descending sweep + rush of air
    this._playTone('sine', 1800, 150, 0.3, 0.04, 0.35);
    this._playTone('triangle', 1400, 120, 0.3, 0.025, 0.36);
    this._playHissNoise(0.25, 0.03, 0.35, 2500);
    // Deep temporal bell — FM with bell partials
    this._playFM(523, 1.41, 400, 0.5, 0.04, 0.55);
    this._playFM(1047, 2.76, 200, 0.35, 0.02, 0.56);
    this._playTone('sine', 523, 523, 0.45, 0.025, 0.56);
    this._playTone('sine', 1047, 1047, 0.35, 0.015, 0.57);
  }

  // ── Antimatter Condenser — particle accelerator hum, collisions, electric arcs ──
  _bldAntimatter() {
    if (!this._canPlayEffects()) return;
    // Accelerator hum — deep layered drone
    this._playFM(50, 1, 10, 0.7, 0.05, 0);
    this._playFM(100, 2, 15, 0.6, 0.03, 0.02);
    this._playTone('sine', 50, 50, 0.7, 0.04, 0.01);
    // Particle beam charging up — ascending whine
    this._playTone('sine', 200, 4000, 0.35, 0.025, 0.08);
    this._playTone('sine', 300, 5000, 0.3, 0.02, 0.1);
    // Collision snaps — violent FM transients
    this._playFM(3000, 5.3, 2000, 0.025, 0.055, 0.15);
    this._playHissNoise(0.025, 0.045, 0.15, 8000);
    this._playFM(3500, 4.1, 2500, 0.025, 0.05, 0.28);
    this._playHissNoise(0.025, 0.04, 0.28, 9000);
    this._playFM(2800, 6.7, 1800, 0.03, 0.045, 0.41);
    this._playHissNoise(0.03, 0.035, 0.41, 7000);
    // Electrical arcing
    this._playFM(400, 7, 1500, 0.05, 0.035, 0.2);
    this._playFM(500, 5, 2000, 0.04, 0.03, 0.35);
    // Energy field texture
    this._playBandNoise(0.5, 0.015, 0.1, 200, 2);
  }

  // ── Prism — light beam firing, crystal chime cascade, rainbow shimmer ──
  _bldPrism() {
    if (!this._canPlayEffects()) return;
    // Light beam powering up — ascending pure sine whine
    this._playTone('sine', 500, 4000, 0.2, 0.03, 0);
    this._playTone('sine', 600, 5000, 0.18, 0.02, 0.02);
    // Refraction — FM crystal bells ascending through the spectrum
    const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
    notes.forEach((hz, i) => {
      this._playFM(hz, 1.41, 300, 0.25, 0.035, 0.15 + i * 0.05);
      this._playFM(hz * 2, 2.76, 150, 0.15, 0.015, 0.16 + i * 0.05);
    });
    // Sustained crystal resonance
    this._playFM(2093, 1.41, 200, 0.4, 0.025, 0.5);
    this._playFM(2637, 1.41, 150, 0.35, 0.02, 0.53);
    // Rainbow shimmer — high sparkle
    this._playHissNoise(0.2, 0.025, 0.2, 6000);
    this._playHissNoise(0.15, 0.02, 0.35, 8000);
    this._playHissNoise(0.12, 0.015, 0.5, 10000);
  }

  // ── Chancemaker — dice rolling, slot lever pull, coin flip, lucky jingle ──
  _bldChancemaker() {
    if (!this._canPlayEffects()) return;
    // Dice rolling on felt — rattling FM clatter
    for (let i = 0; i < 8; i++) {
      this._playFM(400 + i * 40, 4, 200, 0.02, 0.03, i * 0.025);
      this._playBandNoise(0.015, 0.02, i * 0.025, 2000 + i * 150, 5);
    }
    // Slot lever pull — clunky mechanism
    this._playFM(200, 2, 150, 0.08, 0.04, 0.2);
    this._playBandNoise(0.04, 0.03, 0.21, 800, 2);
    // Spinning coin — FM metallic ring, getting faster
    this._playFM(3000, 1.41, 500, 0.1, 0.035, 0.3);
    this._playFM(3000, 1.41, 400, 0.07, 0.03, 0.38);
    this._playFM(3000, 1.41, 300, 0.05, 0.025, 0.43);
    this._playFM(3000, 1.41, 200, 0.02, 0.02, 0.46);
    // Winner jingle — ascending lucky chime
    this._playFM(659, 1.41, 200, 0.15, 0.04, 0.52);
    this._playFM(784, 1.41, 200, 0.15, 0.04, 0.6);
    this._playFM(988, 1.41, 250, 0.15, 0.045, 0.68);
    this._playFM(1319, 1.41, 300, 0.2, 0.05, 0.76);
    this._playHissNoise(0.12, 0.025, 0.76, 5000);
  }

  // ── Fractal Engine — recursive computing: self-similar motif + data crunch ──
  _bldFractalEngine() {
    if (!this._canPlayEffects()) return;
    // Same 3-note motif simultaneously at 3 octaves (self-similarity)
    const motif = [440, 523, 440];
    const octaves = [0.5, 1, 2];
    for (const oct of octaves) {
      motif.forEach((hz, i) => {
        this._playFM(hz * oct, 2, hz * oct * 0.5, 0.08, 0.025, i * 0.05);
      });
    }
    // Data crunching — rapid staccato digital bursts
    for (let i = 0; i < 12; i++) {
      this._playFM(880 * (1 + (i % 3) * 0.25), 5, 880, 0.012, 0.02, 0.2 + i * 0.018);
    }
    // Recursive sweep — each iteration shorter (converging)
    this._playFM(200, 3, 400, 0.15, 0.025, 0.4);
    this._playFM(400, 3, 300, 0.1, 0.02, 0.45);
    this._playFM(600, 3, 200, 0.07, 0.015, 0.48);
    this._playFM(800, 3, 100, 0.05, 0.012, 0.5);
    // Resolution tone
    this._playFM(660, 1.5, 100, 0.2, 0.025, 0.55);
  }

  // ── Idleverse — ambient cosmic choir, parallel dimension echoes ──
  _bldIdleverse() {
    if (!this._canPlayEffects()) return;
    // Warm pad chord
    this._playFM(174, 1, 5, 0.8, 0.03, 0);
    this._playFM(220, 1, 5, 0.75, 0.025, 0.03);
    this._playFM(261, 1, 5, 0.7, 0.02, 0.06);
    this._playFM(330, 1, 5, 0.65, 0.015, 0.09);
    // Ghostly choir — formant "oooh" at drifting pitches
    this._playVowel(130, 330, 1260, 2500, 0.4, 0.02, 0.15);
    this._playVowel(138, 330, 1260, 2500, 0.35, 0.018, 0.25);
    this._playVowel(123, 330, 1260, 2500, 0.3, 0.015, 0.35);
    // Void breathing
    this._playNoise(0.5, 0.02, 0.1, 400);
    this._playBandNoise(0.4, 0.015, 0.2, 250, 1.5);
    // Cosmic shimmer
    this._playFM(2093, 1.41, 100, 0.25, 0.008, 0.4);
    this._playFM(2637, 1.41, 80, 0.2, 0.006, 0.45);
  }

  // ── Cortex Baker — brain thinking: synapse zaps, brainwave, neural "mmm" hum ──
  _bldCortexBaker() {
    if (!this._canPlayEffects()) return;
    // Synaptic firing — rapid electrical zap bursts
    const zaps = [0, 0.03, 0.05, 0.12, 0.14, 0.18, 0.25, 0.27, 0.29, 0.35];
    zaps.forEach((t) => {
      this._playFM(1500 + Math.random() * 1000, 7, 2000, 0.02, 0.04, t);
      this._playHissNoise(0.012, 0.025, t + 0.005, 8000);
    });
    // Brainwave oscillation — slow FM tremolo
    this._playFM(300, 0.033, 60, 0.5, 0.025, 0.05);
    this._playFM(450, 0.025, 40, 0.4, 0.02, 0.1);
    // Thinking "hmmmm" — nasal formant vowel
    // [i] closed-mouth: F1=280 F2=2230 F3=2800
    this._playVowel(110, 280, 2230, 2800, 0.25, 0.02, 0.15);
    this._playVowel(115, 280, 2230, 2800, 0.2, 0.015, 0.38);
    // Neural processing clicks
    for (let i = 0; i < 6; i++) {
      this._playFM(1000, 5, 500, 0.015, 0.02, 0.4 + i * 0.04);
    }
    // Brain static
    this._playBandNoise(0.3, 0.02, 0.1, 2500, 3);
  }

  // ── Reality Bender — glitch chaos, reality cracking, broken voices, reforming ──
  _bldRealityBender() {
    if (!this._canPlayEffects()) return;
    // Glitch cascade — chaotic FM at wild pitches + ratios
    const glitches = [
      [100, 7.3], [2500, 0.3], [300, 11], [4000, 0.1], [150, 5.7],
      [3200, 0.7], [80, 13], [1800, 1.3], [5000, 0.05], [200, 9],
    ];
    glitches.forEach(([hz, ratio], i) => {
      this._playFM(hz, ratio, hz * 2, 0.025, 0.04, i * 0.03);
    });
    // Reality cracking — harsh FM screech + noise burst
    this._playFM(100, 11, 3000, 0.12, 0.05, 0.15);
    this._playFM(3000, 0.1, 2000, 0.1, 0.04, 0.17);
    this._playNoise(0.08, 0.06, 0.15, 2000);
    this._playHissNoise(0.06, 0.05, 0.16, 4000);
    // Distorted broken voice — formants at wrong fundamentals
    this._playVowel(70, 830, 1170, 2500, 0.1, 0.025, 0.28);
    this._playVowel(200, 280, 2230, 2800, 0.08, 0.02, 0.35);
    this._playVowel(50, 600, 1930, 2500, 0.1, 0.02, 0.42);
    // Glass-shattering FM
    this._playFM(4000, 5.3, 3000, 0.04, 0.05, 0.3);
    this._playFM(5000, 7.1, 4000, 0.04, 0.04, 0.33);
    this._playFM(3500, 6.7, 2500, 0.04, 0.035, 0.36);
    // Unstable oscillation wobble
    this._playFM(200, 1.01, 200, 0.06, 0.03, 0.5);
    this._playFM(200, 1.01, 200, 0.06, 0.03, 0.56);
    this._playFM(200, 1.01, 200, 0.06, 0.025, 0.62);
    // Reality reforming — stabilizing bell
    this._playFM(440, 1.41, 300, 0.25, 0.03, 0.68);
    this._playFM(554, 1.41, 200, 0.2, 0.025, 0.72);
    this._playFM(659, 1.41, 100, 0.2, 0.02, 0.76);
  }

  // ─── Element-specific ambient hover sounds ──────────────
  //
  // Subtle, low-volume textures that play while hovering over
  // specific areas.  Routed through the ambient bus so the
  // ambient volume / toggle controls them.

  /** Shop panel — soft coin jingle & register hum. */
  shopAmbientTick() {
    if (!this._canPlayAmbient()) return;
    this._currentBus = this._ambientBus;
    const pick = Math.random();
    const v = 0.012;
    if (pick < 0.35) {
      // Tiny coin clink
      this._playTone('triangle', 2800 + Math.random() * 600, 2200, 0.04, v);
      if (Math.random() > 0.5)
        this._playTone('triangle', 3200 + Math.random() * 400, 2600, 0.03, v * 0.7, 0.03);
    } else if (pick < 0.6) {
      // Cash register ka-ching (tiny)
      this._playBandNoise(0.025, v * 0.6, 0, 3500, 3);
      this._playTone('sine', 1800, 1400, 0.05, v * 0.5, 0.02);
    } else if (pick < 0.8) {
      // Paper rustle
      this._playHissNoise(0.06, v * 0.5, 0, 5000);
    } else {
      // Shelf creak
      this._playFM(120 + Math.random() * 60, 2.5, 40, 0.08, v * 0.4);
    }
    this._currentBus = null;
  }

  /** News broadcast area — static crackle & muffled voice. */
  newsAmbientTick() {
    if (!this._canPlayAmbient()) return;
    this._currentBus = this._ambientBus;
    const pick = Math.random();
    const v = 0.01;
    if (pick < 0.35) {
      // TV static crackle
      this._playBandNoise(0.04 + Math.random() * 0.03, v, 0,
        1500 + Math.random() * 1500, 0.8);
    } else if (pick < 0.6) {
      // Muffled broadcast voice (distant vowel)
      const f0 = 100 + Math.random() * 60;
      this._playVowel(f0, 500 + Math.random() * 200, 1500 + Math.random() * 400,
        2500, 0.06 + Math.random() * 0.04, v * 0.6);
    } else if (pick < 0.8) {
      // Signal blip
      this._playTone('sine', 1000, 1000, 0.02, v * 0.5);
      this._playTone('sine', 1000, 1000, 0.02, v * 0.5, 0.06);
    } else {
      // Tape hiss
      this._playHissNoise(0.08, v * 0.4, 0, 6000);
    }
    this._currentBus = null;
  }

  /** Cookie / bake area — warm oven hum & dough sounds. */
  bakeAmbientTick() {
    if (!this._canPlayAmbient()) return;
    this._currentBus = this._ambientBus;
    const pick = Math.random();
    const v = 0.01;
    if (pick < 0.35) {
      // Oven hum
      this._playFM(55 + Math.random() * 10, 1, 8, 0.12, v * 0.5);
    } else if (pick < 0.6) {
      // Dough squish
      this._playBandNoise(0.05, v * 0.6, 0, 600 + Math.random() * 400, 1.5);
      this._playFM(100 + Math.random() * 50, 2, 30, 0.06, v * 0.4, 0.02);
    } else if (pick < 0.8) {
      // Timer tick
      this._playTone('triangle', 1200, 1100, 0.015, v * 0.5);
    } else {
      // Cookie cooling sizzle
      this._playHissNoise(0.05, v * 0.35, 0, 3500 + Math.random() * 1500);
    }
    this._currentBus = null;
  }

  // ─── Grandmapocalypse Sounds ──────────────────────────────
  //
  //  Design: procedural dark/metal aesthetic using FM synthesis
  //  for guitar-like distortion, formants for eerie vocals,
  //  and layered sequences for mini-riffs. Cool, not annoying.

  /** Distorted power chord — FM synthesis with high mod depth. */
  _playPowerChord(rootHz, duration, volume = 0.05, delay = 0) {
    // Root + fifth (×1.5) + octave (×2) with distortion via FM
    this._playFM(rootHz, 1, 80, duration, volume, delay, 'sawtooth');
    this._playFM(rootHz * 1.5, 1, 60, duration, volume * 0.7, delay);
    this._playFM(rootHz * 2, 1.5, 40, duration * 0.8, volume * 0.4, delay);
    // Gritty noise bed for texture
    this._playBandNoise(duration * 0.5, volume * 0.3, delay, rootHz * 2, 2);
  }

  /** Quick palm-muted chug — percussive guitar hit. */
  _playChug(hz, volume = 0.04, delay = 0) {
    this._playFM(hz, 2, 120, 0.08, volume, delay, 'sawtooth');
    this._playBandNoise(0.06, volume * 0.5, delay, hz * 1.5, 4);
  }

  wrinklerSpawn() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    // Slimy emergence — wet bandnoise + low FM growl + descending glide
    this._playBandNoise(0.25, 0.04, 0, 350, 2.5);
    this._playFM(100, 3, 50, 0.5, 0.03, 0.05);
    this._playTone('sine', 200, 60, 0.6, 0.03, 0.02);
  }

  wrinklerPop() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    // Satisfying squelch-pop + reward arpeggio (ascending minor)
    this._playBandNoise(0.1, 0.07, 0, 500, 4);
    this._playFM(200, 1.4, 80, 0.08, 0.06, 0.01);  // metallic pop
    // Reward sparkle — ascending notes
    this._playTone('sine', 330, 330, 0.12, 0.05, 0.08);   // E4
    this._playTone('sine', 392, 392, 0.12, 0.05, 0.15);   // G4
    this._playTone('sine', 494, 494, 0.12, 0.05, 0.22);   // B4
    this._playTone('triangle', 659, 659, 0.18, 0.04, 0.29); // E5 (ring out)
  }

  wrathCookie() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    // Menacing power chord stab — E minor (82 Hz root)
    this._playPowerChord(82, 0.6, 0.05);
    // Eerie vocal whisper after the hit
    this._playVowel(90, 600, 1000, 2500, 0.4, 0.02, 0.3);
    // Reverse-style noise swell
    this._playNoise(0.3, 0.01, 0, 150);
    this._playNoise(0.2, 0.04, 0.15, 300);
  }

  /** Wrath cookie positive outcome — dark but triumphant. */
  wrathCookieWin() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    // Quick ascending power riff — E-G-A-B
    this._playChug(82, 0.04, 0);
    this._playChug(98, 0.04, 0.1);
    this._playChug(110, 0.05, 0.2);
    this._playPowerChord(123, 0.5, 0.04, 0.3); // B2 ring out
  }

  elderPledge() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    // Relief — clean descending arpeggio (Am → C → G → Em)
    // Like putting down a heavy guitar and picking up an acoustic
    this._playTone('sine', 440, 440, 0.2, 0.05, 0);     // A4
    this._playTone('sine', 392, 392, 0.2, 0.05, 0.12);  // G4
    this._playTone('sine', 330, 330, 0.2, 0.05, 0.24);  // E4
    this._playTone('sine', 262, 262, 0.25, 0.05, 0.36); // C4
    this._playTone('triangle', 196, 196, 0.4, 0.04, 0.48); // G3 (warm resolution)
    // Gentle shimmer
    this._playHissNoise(0.3, 0.015, 0.36, 5000);
  }

  elderCovenant() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    // Solemn pact — deep sustained power chord with slow fade
    this._playPowerChord(55, 2.5, 0.05);  // A1 — very low, ominous
    // Slow tolling bell via FM
    this._playFM(220, 1.4, 200, 1.5, 0.04, 0.3);
    this._playFM(220, 1.4, 200, 1.2, 0.03, 1.0);
    // Dark vocal drone — "ooh"
    this._playVowel(65, 330, 1260, 2500, 2.0, 0.03, 0.5);
  }

  stageTransition(stage) {
    if (!this._canPlayEffects()) return;
    this._ensureContext();

    if (stage === 1) {
      // Ominous intro riff — two palm-muted chugs + sustained minor chord
      // Like the opening of a metal track
      this._playChug(82, 0.04, 0);       // E2
      this._playChug(82, 0.04, 0.15);    // E2 again
      this._playPowerChord(82, 1.0, 0.04, 0.35);  // E minor ring
      // Eerie whisper underneath
      this._playVowel(82, 830, 1170, 2500, 0.8, 0.015, 0.5); // "ah"
    }

    else if (stage === 2) {
      // Heavier — descending chromatic riff (E-Eb-D-Db) + crash
      this._playChug(82, 0.05, 0);       // E2
      this._playChug(78, 0.05, 0.12);    // Eb2
      this._playChug(73, 0.05, 0.24);    // D2
      this._playPowerChord(69, 1.2, 0.05, 0.36); // Db2 — tritone from root, evil
      // Crash cymbal
      this._playHissNoise(0.8, 0.04, 0.36, 6000);
      this._playBandNoise(0.6, 0.03, 0.36, 3000, 1.5);
      // Growl vocal
      this._playVowel(55, 600, 1000, 2500, 0.6, 0.02, 0.6); // low "eh"
    }

    else if (stage === 3) {
      // Full breakdown — rapid palm mutes into massive sustained chord
      // The "oh shit" moment
      const chugs = [82, 82, 98, 82, 82, 110, 82, 82];
      chugs.forEach((hz, i) => this._playChug(hz, 0.05, i * 0.08));
      const riffEnd = chugs.length * 0.08;
      // Massive open chord — E5 power chord with extra dissonance
      this._playPowerChord(82, 2.5, 0.06, riffEnd);
      this._playFM(87, 1, 100, 2.0, 0.03, riffEnd); // slight detune for thickness
      // Double kick drum hits
      this._playFM(40, 2, 200, 0.06, 0.06, riffEnd);
      this._playFM(40, 2, 200, 0.06, 0.06, riffEnd + 0.08);
      // Cymbal crash + ride
      this._playHissNoise(1.5, 0.05, riffEnd, 7000);
      this._playBandNoise(1.0, 0.03, riffEnd, 4000, 1.5);
      // Demonic vocal — low "ooh" sliding down
      this._playVowel(60, 330, 1260, 2500, 2.0, 0.03, riffEnd + 0.2);
      this._playVowel(45, 430, 980, 2500, 1.5, 0.02, riffEnd + 1.0);
    }
  }

  // ─── Dungeon crawl sounds ─────────────────────────────────

  /** Player attack — quick slash whoosh + thud impact */
  dungeonAttack() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playNoise(0.08, 0.05, 0, 3000);          // whoosh
    this._playTone('triangle', 200, 80, 0.1, 0.06, 0.05); // thud
  }

  /** Critical hit — sharper slash + metallic ring + impact */
  dungeonCrit() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playNoise(0.06, 0.06, 0, 4500);           // sharp whoosh
    this._playFM(400, 2.5, 100, 0.15, 0.05, 0.03);  // metallic ring
    this._playTone('sawtooth', 250, 60, 0.12, 0.06, 0.04); // heavy thud
  }

  /** Player blocks — solid clank + bass thump */
  dungeonBlock() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playFM(300, 1.2, 80, 0.08, 0.06);         // metallic clank
    this._playTone('triangle', 120, 60, 0.15, 0.05, 0.03); // bass thump
  }

  /** Player takes damage — dull impact + low grunt */
  dungeonHurt() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playTone('sine', 150, 60, 0.12, 0.05);    // impact
    this._playNoise(0.06, 0.04, 0.02, 800);         // crunch
  }

  /** Heavy attack from enemy — deeper, more menacing */
  dungeonHeavy() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playTone('sawtooth', 80, 40, 0.25, 0.06);  // deep rumble
    this._playNoise(0.1, 0.05, 0.05, 600);           // crunch
    this._playFM(120, 1.5, 200, 0.15, 0.04, 0.08);  // growl
  }

  /** Potion heal — bubbly shimmer */
  dungeonHeal() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playTone('sine', 523, 784, 0.2, 0.05);     // rising sparkle
    this._playTone('sine', 659, 988, 0.18, 0.04, 0.06);
    this._playNoise(0.08, 0.02, 0.04, 5000);         // fizz
  }

  /** Enemy defeated — satisfying thud + victory sparkle */
  dungeonKill() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playNoise(0.12, 0.06, 0, 500);            // collapse
    this._playTone('sine', 330, 330, 0.1, 0.05, 0.1);
    this._playTone('sine', 440, 440, 0.1, 0.04, 0.16);
    this._playTone('triangle', 554, 554, 0.12, 0.04, 0.22);
  }

  /** Player death — low descending doom */
  dungeonDeath() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playTone('sawtooth', 200, 50, 0.5, 0.05);
    this._playTone('sine', 150, 40, 0.6, 0.04, 0.1);
    this._playNoise(0.3, 0.03, 0.2, 300);
  }

  /** Loot pickup — cheerful ding */
  dungeonLoot() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playTone('sine', 660, 660, 0.1, 0.05);
    this._playTone('sine', 880, 880, 0.12, 0.05, 0.08);
  }

  /** Flee — quick descending run */
  dungeonFlee() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playTone('triangle', 500, 200, 0.15, 0.04);
    this._playTone('triangle', 400, 150, 0.12, 0.03, 0.08);
  }

  /** Dungeon victory — triumphant fanfare */
  dungeonVictory() {
    if (!this._canPlayEffects()) return;
    this._ensureContext();
    this._playTone('sine', 262, 262, 0.15, 0.05);     // C
    this._playTone('sine', 330, 330, 0.15, 0.05, 0.1); // E
    this._playTone('sine', 392, 392, 0.15, 0.05, 0.2); // G
    this._playTone('sine', 523, 523, 0.2, 0.06, 0.3);  // C5
    this._playTone('triangle', 660, 660, 0.25, 0.04, 0.4); // E5 ring
    this._playNoise(0.15, 0.02, 0.35, 4000);            // sparkle
  }

  // ── Safe Cracker sounds ──────────────────────────────────

  /** Normal detent tick — soft sine click like cursor, no harshness */
  safeDialTick() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 800, 600, 0.015, 0.02);
  }

  /** Near-target tick — warmer, slightly deeper sine click */
  safeTumblerNear() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 500, 350, 0.025, 0.03);
    this._playTone('sine', 250, 180, 0.03, 0.02);
  }

  /** On-target tumbler hit — deep soft thud, you're on the right number */
  safeTumblerHit() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 220, 130, 0.05, 0.04);
    this._playTone('sine', 350, 250, 0.04, 0.03);
    this._playNoise(0.03, 0.015, 0, 1000);
  }

  /** Subtle click during hold progression — building tension */
  safeTumblerClick() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 400, 300, 0.02, 0.02);
    this._playNoise(0.01, 0.008, 0, 2000);
  }

  /** Number cracked — satisfying tumbler lock chime */
  safeCrackNum() {
    if (!this._canPlayEffects()) return;
    // Soft metallic tumbler fall
    this._playTone('sine', 180, 100, 0.1, 0.04);
    this._playNoise(0.06, 0.02, 0, 800);
    // Warm chime
    this._playTone('sine', 523, 523, 0.15, 0.05, 0.06);
    this._playTone('triangle', 659, 659, 0.12, 0.04, 0.12);
    this._playTone('sine', 784, 784, 0.1, 0.03, 0.18);
  }

  // ── Cookie Launch sounds ─────────────────────────────────

  /** Slingshot stretch — rising tone as you pull back, call with power 0-1 */
  launchStretch(power) {
    if (!this._canPlayEffects()) return;
    const freq = 150 + power * 400;
    this._playTone('sine', freq, freq + 30, 0.04, 0.02);
  }

  /** Slingshot release — elastic twang snap */
  launchFire() {
    if (!this._canPlayEffects()) return;
    // Rubber band snap
    this._playTone('sine', 400, 800, 0.06, 0.05);
    this._playTone('sine', 250, 500, 0.05, 0.03, 0.01);
    this._playTone('triangle', 600, 1200, 0.03, 0.02, 0.02);
    this._playNoise(0.04, 0.03, 0, 3000);
  }

  /** Wind whoosh — call with wind strength 0-1, pitch/volume scales */
  launchWindWhoosh(strength) {
    if (!this._canPlayEffects()) return;
    if (strength < 0.1) return;
    const vol = 0.01 + strength * 0.025;
    const freq = 300 + strength * 600;
    this._playBandNoise(0.3, vol, 0, freq, 0.8);
  }

  /** Ground bounce thud */
  launchBounce() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 120, 70, 0.06, 0.04);
    this._playNoise(0.03, 0.02, 0, 600);
  }

  /** Hit the target zone */
  launchHit() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 440, 440, 0.1, 0.04);
    this._playTone('triangle', 554, 554, 0.08, 0.03, 0.05);
    this._playNoise(0.06, 0.02, 0.02, 1500);
  }

  /** Bullseye! */
  launchBullseye() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 523, 523, 0.12, 0.05);
    this._playTone('sine', 659, 659, 0.12, 0.05, 0.08);
    this._playTone('triangle', 784, 784, 0.15, 0.04, 0.16);
    this._playTone('sine', 1047, 1047, 0.1, 0.03, 0.24);
    this._playNoise(0.1, 0.02, 0.2, 4000);
  }

  /** Missed the target */
  launchMiss() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 300, 180, 0.12, 0.04);
    this._playNoise(0.08, 0.02, 0.02, 800);
  }

  /** Vault fully cracked — heavy mechanism + triumphant ascension */
  safeCrackOpen() {
    if (!this._canPlayEffects()) return;
    // Heavy vault bolt mechanism — deep sine thud
    this._playTone('sine', 80, 60, 0.25, 0.05);
    this._playNoise(0.18, 0.03, 0, 500);
    this._playTone('sine', 150, 100, 0.12, 0.03, 0.05);
    // Mechanism release
    this._playNoise(0.1, 0.03, 0.15, 1200);
    this._playTone('sine', 200, 150, 0.08, 0.03, 0.15);
    // Triumphant ascending chime
    this._playTone('sine', 330, 330, 0.15, 0.05, 0.3);
    this._playTone('sine', 440, 440, 0.15, 0.05, 0.4);
    this._playTone('sine', 554, 554, 0.15, 0.05, 0.5);
    this._playTone('triangle', 660, 660, 0.2, 0.04, 0.6);
    this._playTone('sine', 880, 880, 0.2, 0.04, 0.7);
    this._playNoise(0.12, 0.02, 0.65, 4000);
  }

  // ── Cookie Wordle sounds ───────────────────────────────────

  /** Soft key tap for typing a letter */
  wordleType() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 600, 500, 0.025, 0.025);
  }

  /** Backspace/delete — slightly lower */
  wordleDelete() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 400, 300, 0.03, 0.025);
  }

  /** Tile reveal: correct position — bright chime */
  wordleCorrect() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 660, 660, 0.08, 0.04);
    this._playTone('triangle', 880, 880, 0.06, 0.02, 0.02);
  }

  /** Tile reveal: present but wrong position — warm mid tone */
  wordlePresent() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 440, 440, 0.07, 0.03);
    this._playTone('sine', 554, 554, 0.05, 0.02, 0.02);
  }

  /** Tile reveal: absent — dull low thud */
  wordleAbsent() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 220, 180, 0.05, 0.025);
  }

  /** Invalid submission (not enough letters, etc.) */
  wordleInvalid() {
    if (!this._canPlayEffects()) return;
    this._playTone('sine', 300, 200, 0.08, 0.03);
    this._playTone('sine', 250, 180, 0.06, 0.025, 0.05);
  }
}
