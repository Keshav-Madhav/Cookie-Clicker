# Ambient-as-Base Music System

The ambient drone and generative melodies run on independent clocks (ambient chord changes every 18-32s, melodies on their own schedule). Since they're naturally desynchronized, combining them as layers creates emergent harmonic combinations that are never the same twice.

## Core Concept

Instead of ambient and melody being independent audio layers that happen to overlap, the ambient becomes the **harmonic foundation** that melodies are built on top of. Melodies derive their note pool from the current ambient chord, so every note is harmonically related to the drone underneath.

Because the two systems cycle at different rates, they drift in and out of alignment — like two pendulums with different periods. This creates organic tension-release cycles without explicit programming.

## Architecture

### 1. Harmonic Awareness Layer

- Add `getAmbientState()` to `SoundManager` — exposes `{ chord, chordIdx, bassFreq, padFreqs }`
- `GameMusic` reads this before generating each composition
- Instead of a fixed `POOL`, compositions derive their note pool from the current ambient chord

### 2. Adaptive Note Pool

```
Ambient Chord: [130.8, 329.6, 392.0, 493.9] (Cmaj7)
        |
        v  derive pool
Melody Pool = chord tones + scale extensions + octave spread
            = [130.8, 164.8, 196.0, 261.6, 293.7, 329.6, 392.0,
               440.0, 493.9, 523.3, 587.3, 659.3, 784.0, ...]
```

- When ambient chord changes (4s ramp), the melody pool transitions too
- Notes already ringing keep their pitch — only NEW notes use the updated pool
- Melodies gradually shift key to match ambient, creating smooth modulation

### 3. Consonance Modes

| Mode | Pool Derivation | Feel |
|------|----------------|------|
| **Tight** (default) | Chord tones + diatonic scale | Always consonant, warm |
| **Loose** | Adds chromatic passing tones | Occasional tension that resolves |
| **Drift** | Pool slowly diverges from ambient | Building unease, snaps back at chord change |

### 4. Phase Interaction Rules

- **Ride the modulation**: When a melody starts near an ambient chord change, its notes shift with the chord ramp
- **Bass deference**: Compositions skip their own bass pedal when ambient bass is audible — avoids muddiness
- **Silence sharing**: During long melody pauses, ambient fills the space naturally — the two breathe together
- **Coincidence moments**: When melody and ambient accidentally land on the same note simultaneously, it creates a natural accent

### 5. Apocalypse Integration

| Stage | Mode | Ambient Behavior | Result |
|-------|------|-----------------|--------|
| 0 (Normal) | Tight | Standard warm progression | Melodies and ambient in gentle harmony |
| 1 (Displeased) | Loose | Minor substitutions in chord progression | Occasional clashing, uneasy |
| 2 (Angered) | Drift | Chords darken, slower progression | Melody and ambient actively pull apart |
| 3 (Elder Pact) | Drift + Inversion | Tritone substitutions, reversed progression | Maximum dissonance, dark melodies built on "wrong" notes |

### 6. Implementation Steps

1. **`SoundManager.getAmbientState()`** — returns current chord, index, bass freq, pad freqs
2. **`GameMusic._derivePool(ambientState, mode)`** — returns frequency array derived from ambient
3. **Modify `_play()`** — calls `_derivePool()` before each composition instead of using static `POOL`
4. **Pool transition logic** — notes in flight keep old pool, new notes use updated pool
5. **`ambientAwareness` setting** — toggle so users can enable/disable (off = current behavior)
6. **Ambient chord event emitter** — `SoundManager` fires event on chord change that `GameMusic` listens to
7. **Apocalypse pool variants** — dark pool derivation that clashes with ambient intentionally

### 7. Why This Works Musically

- **Uniqueness**: Every session produces unique harmonic journeys since ambient and melody cycles have different lengths (like polyrhythm but with harmony)
- **Accidental beauty**: Slight misalignment creates moments where a melody note lands perfectly on an ambient chord change
- **Natural arc**: The two systems drift in and out of sync over minutes, creating organic tension-release without explicit programming
- **Depth without complexity**: The listener hears rich, evolving harmony that sounds composed, but it's just two simple systems interacting

### 8. Technical Considerations

- Pool derivation must be fast (called before each composition) — precompute pools for each chord
- Ambient chord ramp (4s) is much slower than melody note spacing — pool changes are gradual
- When ambient is disabled, fall back to static `POOL` / `DARK_POOL` (current behavior)
- Memory: pool arrays are small (~20 floats), no concern
