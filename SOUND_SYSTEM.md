# Sound System Implementation Guide

A reference document describing how the Cookie Clicker sound system is built. This covers architecture, patterns, and techniques — not the specific sounds themselves. Use this as a blueprint for implementing a sound system in another game.

---

## 1. Architecture Overview

The sound system is **fully procedural** — no audio files are used. All sounds are synthesized at runtime using the **Web Audio API**. This eliminates asset loading, reduces bundle size, and allows dynamic sound generation.

### Key Files

| File | Role |
|------|------|
| `soundManager.js` | Core sound engine — synthesis primitives, audio bus routing, all event sound methods |
| `gameMusic.js` | Generative background melody engine (algorithmic composition) |
| `symphonies.js` | Music piece database (note sequences, BPM, metadata) |
| `notes.js` | MIDI note constants and transpose utility |
| `game.js` | Settings binding, initialization, sound trigger calls from game logic |

---

## 2. Sound Manager Class

A single `SoundManager` class owns all audio. It receives a reference to the game instance and exposes named methods for every sound event.

### Lazy Initialization

The Web Audio `AudioContext` is **not** created on construction. Instead, a method like `_ensureContext()` initializes it on the first sound call. This handles browser autoplay policies — the context is created in response to a user interaction.

```
constructor(game) {
  this.game = game;
  this._ctx = null;          // AudioContext, lazy
  this._musicPlaying = false;
  this._ambientActive = false;
}

_ensureContext() {
  if (this._ctx) return;
  this._ctx = new AudioContext();
  // Create gain nodes, buses, etc.
}
```

---

## 3. Audio Bus / Channel System

Audio is routed through **three independent gain nodes** (buses), each with its own volume control and toggle. This allows players to mix categories independently.

```
                                     +---> destination (speakers)
                                     |
Effects Bus  (effectsBus)  ----------+
Music Bus    (musicBus)    ----------+
  |-- Melody Sub-Bus (melodyBus)     |
Ambient Bus  (ambientBus)  ----------+
```

### Bus Definitions

| Bus | Purpose | Default Volume |
|-----|---------|----------------|
| **Effects** | All game event sounds — clicks, purchases, achievements, UI, mini-games | 0.75 |
| **Music** | Background music — composed pieces and generative melody | 0.80 |
| **Ambient** | Environmental soundscape — drones, pads, random bakery events | 0.30 |

### Sub-Bus: Melody Ducking

The generative melody runs on a **sub-bus** under the music bus. When the player is actively interacting, the melody volume is ducked (reduced to ~15%) via an exponential ramp, then restored after inactivity. This prevents the melody from clashing with interaction-driven sounds.

---

## 4. Synthesis Primitives

The SoundManager exposes a small set of low-level synthesis methods. All game sounds are built by combining these primitives.

### Core Methods

| Method | What It Does |
|--------|-------------|
| `_playTone(type, startHz, endHz, duration, volume, delay)` | Oscillator with frequency sweep (sine, triangle, square, sawtooth) |
| `_playNoise(duration, volume, delay, freq)` | White noise through a lowpass filter |
| `_playHissNoise(duration, volume, delay, freq)` | White noise through a highpass filter |
| `_playBandNoise(duration, volume, delay, centerFreq, Q)` | White noise through a bandpass filter |
| `_playFM(carrierHz, modRatio, modDepth, duration, volume, delay, type)` | FM synthesis — modulator controls carrier frequency for metallic/bell tones |
| `_playVowel(fundamental, f1, f2, f3, duration, volume, delay)` | Formant synthesis — sawtooth source through 3 bandpass filters for vowel-like sounds |

### Envelope Shaping

All primitives use gain envelopes via `setTargetAtTime()` and `linearRampToValueAtTime()` for attack/decay/release curves. Nodes are scheduled for cleanup using `stop()` after the sound finishes.

### How Sounds Are Composed

Each game event method calls one or more primitives with specific parameters. For example, an achievement sound might layer 4 ascending tones with staggered delays. A purchase sound might use a single tone whose pitch is parameterized by the item tier.

---

## 5. Music System

Two independent music layers run simultaneously:

### A. Composed Piece Playback

- A database of pieces, each defined as `{ name, bpm, notes[] }` where notes are MIDI numbers
- A tick function advances to the next note at the piece's BPM interval
- Player interaction (clicking) immediately plays the next note and resets the timer
- This creates a hybrid: the music plays automatically but the player can "drive" it rhythmically
- Pieces loop seamlessly using cumulative note index tracking

### B. Generative Melody

- A separate `GameMusic` class with multiple compositional algorithms
- Each algorithm generates a short phrase from a pentatonic scale pool
- A new algorithm is randomly selected every 5-17 seconds
- Notes are rendered as warm layered oscillators (fundamental + octave partial + fifth partial)
- Runs independently of the composed piece layer

### Melody Ducking

When the player is actively clicking, the generative melody volume is ramped down. After ~1.8 seconds of inactivity, it ramps back up. This keeps the soundscape responsive without being overwhelming.

---

## 6. Ambient Soundscape

The ambient system creates an environmental atmosphere using several layered components:

### Components

| Layer | Technique | Behavior |
|-------|-----------|----------|
| **Pad Chords** | Multiple detuned triangle oscillators | Chord changes every 18-32 seconds with smooth crossfades |
| **Bass Drone** | Sine oscillator with vibrato LFO | Follows chord root |
| **Room Tone** | Looped noise buffer through sweeping lowpass filter | Continuous, slow LFO modulates cutoff |
| **Shimmer** | Looped noise buffer through highpass filter | Very quiet, adds air |
| **Breathing LFO** | Master gain modulation | ~18-second volume swell cycle |
| **Random Events** | Weighted random sound triggers | Every 4-12 seconds, a random environmental sound plays (crackle, hiss, pop, etc.) |

### Random Ambient Events

A pool of short sound events with weighted probabilities. A scheduler picks one at random intervals. Each event is built from the same synthesis primitives (filtered noise, FM pops, tone sweeps). This creates organic, non-repeating environmental audio.

---

## 7. Event Sound Registration

Sounds are not registered in a lookup table — they are **direct named methods** on the SoundManager. Game code calls them explicitly.

### Pattern

```javascript
// In SoundManager
achievement() {
  this._ensureContext();
  if (!this.game.settings.soundEffects) return;
  // ... synthesis calls ...
}

// In game code
this.soundManager.achievement();
```

### Categories of Event Sounds

- **Core gameplay** — click, purchase, upgrade, prestige
- **Events** — achievement unlock, golden cookie, frenzy activation
- **UI** — button click, panel open/close, tab switch, navigation
- **Mini-games** — each mini-game has its own set (start, action, win, lose, etc.)
- **Building-specific** — each building type has a unique info sound, parameterized by index

### Parameterized Sounds

Some sounds accept parameters to vary their output:
- `purchase(count, buildingIndex)` — pitch shifts based on tier and quantity
- `upgrade(level)` — pitch rises with upgrade level
- `buildingInfo(index)` — unique timbre per building using different FM synthesis parameters

---

## 8. Settings & Volume Control

### UI Elements

Three toggle checkboxes and three volume sliders:
- Music (on/off + volume)
- Sound Effects (on/off + volume)
- Ambient (on/off + volume)

### Binding Pattern

```javascript
// Toggle binding
_bindToggle("setting-music", "music", () => {
  if (this.settings.music) this.soundManager.startMusic();
  else this.soundManager.stopMusic();
});

// Slider binding
_bindSlider("vol-music", "musicVolume", (v) => {
  this.soundManager.setMusicVolume(v);
});
```

### Volume Methods

Each bus has a setter that updates its gain node:
- `setMusicVolume(v)` — 0 to 1
- `setEffectsVolume(v)` — 0 to 1
- `setAmbientVolume(v)` — 0 to 1

### Guard Pattern

Every sound method checks the relevant setting before producing audio:

```javascript
click() {
  this._ensureContext();
  if (!this.game.settings.soundEffects) return;
  // ...
}
```

---

## 9. Note / Pitch System

### MIDI Constants

A `notes.js` file exports named constants for every MIDI note across usable octaves (C2 through B7), including sharp/flat aliases.

```javascript
export const C4 = 60;
export const Cs4 = 61;  // C#4
export const Db4 = 61;  // Same as C#4
```

### Transpose Utility

A helper function shifts an array of MIDI notes by a number of semitones:

```javascript
export function transpose(notes, semitones) {
  return notes.map(n => n + semitones);
}
```

### MIDI to Frequency

Standard conversion: `freq = 440 * 2^((midi - 69) / 12)`

---

## 10. Adapting This System for Another Game

### What to Keep

1. **Lazy AudioContext init** — essential for browser autoplay policies
2. **Bus routing architecture** — independent volume control per category is a must
3. **Synthesis primitives** — the core `_playTone`, `_playNoise`, `_playFM` methods are reusable building blocks
4. **Guard pattern** — always check settings before generating audio
5. **Named method approach** — one method per game event keeps the API clear and discoverable
6. **Ambient soundscape structure** — layered drones + random events creates rich environments

### What to Adapt

1. **Music system** — replace composed pieces with genre-appropriate music data; replace generative melody algorithms with ones suited to your game's mood
2. **Ambient events** — swap bakery sounds for environment-appropriate events (for a spy/horror game: distant footsteps, creaking doors, radio static, breathing, metallic clanks)
3. **Ambient pads** — change chord voicings and timbres to match genre (minor keys, dissonant intervals, darker oscillator types)
4. **Event sounds** — design new sounds for your game's specific events while using the same synthesis primitive toolkit
5. **Ducking behavior** — adapt what triggers ducking based on your game's interaction model

### Adding File-Based Audio (Optional)

If you need sampled audio alongside procedural sounds:

```javascript
// Load an audio buffer
async loadSound(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return this._ctx.decodeAudioData(arrayBuffer);
}

// Play a loaded buffer through a bus
playBuffer(buffer, bus, volume = 1) {
  const source = this._ctx.createBufferSource();
  const gain = this._ctx.createGain();
  gain.gain.value = volume;
  source.buffer = buffer;
  source.connect(gain).connect(bus);
  source.start();
  return source;
}
```

This lets you mix procedural and sampled audio through the same bus system.
