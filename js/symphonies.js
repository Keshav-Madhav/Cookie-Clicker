/**
 * Symphony library — classical pieces for the background music system.
 *
 * Each piece is { name, bpm, notes[] } where notes are MIDI numbers.
 * Uses readable note names from notes.js for easy editing.
 *
 * 25 pieces — each significantly longer than a quick snippet so
 * they work as continuous background music while baking cookies.
 */

import N, { transpose } from './notes.js';

const {
  // Octave 2
  C2, Cs2, Db2, D2, Ds2, Eb2, E2, F2, Fs2, Gb2, G2, Gs2, Ab2, A2, As2, Bb2, B2,
  // Octave 3
  C3, Cs3, Db3, D3, Ds3, Eb3, E3, F3, Fs3, Gb3, G3, Gs3, Ab3, A3, As3, Bb3, B3,
  // Octave 4
  C4, Cs4, Db4, D4, Ds4, Eb4, E4, F4, Fs4, Gb4, G4, Gs4, Ab4, A4, As4, Bb4, B4,
  // Octave 5
  C5, Cs5, Db5, D5, Ds5, Eb5, E5, F5, Fs5, Gb5, G5, Gs5, Ab5, A5, As5, Bb5, B5,
  // Octave 6
  C6, Cs6, Db6, D6, Ds6, Eb6, E6, F6, Fs6, Gb6, G6, Gs6, Ab6, A6, As6, Bb6, B6,
  // Octave 7
  C7, Cs7, Db7, D7, Ds7, Eb7, E7, F7, Fs7, Gb7, G7, Gs7, Ab7, A7, As7, Bb7, B7,
} = N;

// ═══════════════════════════════════════════════════════════════
// 1. BEETHOVEN — ODE TO JOY  (Symphony No. 9, 4th mvt)
//    Key: C major  |  BPM: 120
// ═══════════════════════════════════════════════════════════════
const ode_a   = [E4,E4,F4,G4, G4,F4,E4,D4, C4,C4,D4,E4, E4,D4,D4];
const ode_a2  = [E4,E4,F4,G4, G4,F4,E4,D4, C4,C4,D4,E4, D4,C4,C4];
const ode_b   = [D4,D4,E4,C4, D4,E4,F4,E4,C4, D4,E4,F4,E4,D4, C4,D4,G3];
const ode_end = [G4,A4,G4,F4,E4,D4, E4,F4,G4,G4,F4, E4,D4,C4,D4,C4];
const ode_br  = [C4,E4,G4,C5,G4,E4,C4,D4, E4,G4,C5,E5,C5,G4,E4,D4];

// ═══════════════════════════════════════════════════════════════
// 2. BACH — CELLO SUITE NO. 1, PRELUDE
//    Key: G major  |  BPM: 100
// ═══════════════════════════════════════════════════════════════
const bach_a = [
  G3,B3,D4,G4,D4,B3,D4,B3,  G3,C4,E4,G4,E4,C4,E4,C4,
  G3,C4,D4,Fs4,D4,C4,D4,C4, G3,B3,D4,G4,D4,B3,D4,B3,
  G3,A3,D4,Fs4,D4,A3,D4,A3, G3,A3,D4,G4,D4,A3,D4,A3,
];
const bach_b = [
  G3,B3,C4,E4,C4,B3,C4,B3,  G3,B3,C4,D4,C4,B3,C4,B3,
  F3,A3,D4,Fs4,D4,A3,D4,A3, F3,G3,C4,E4,C4,G3,C4,G3,
  E3,G3,B3,D4,B3,G3,B3,G3,  E3,A3,C4,E4,C4,A3,C4,A3,
];
const bach_c = [
  F3,A3,C4,F4,C4,A3,C4,A3,  F3,A3,D4,Fs4,D4,A3,D4,A3,
  G3,D4,Fs4,A4,Fs4,D4,Fs4,D4, G3,B3,D4,G4,D4,B3,D4,B3,
  A3,C4,E4,A4,E4,C4,E4,C4,  A3,D4,Fs4,A4,Fs4,D4,Fs4,D4,
];
const bach_d = [
  G3,B3,D4,G4,D4,B3,D4,B3,  G3,C4,E4,G4,E4,C4,E4,C4,
  G3,C4,D4,Fs4,D4,C4,D4,C4, G3,B3,D4,G4,D4,B3,D4,G4,
];

// ═══════════════════════════════════════════════════════════════
// 3. MOZART — EINE KLEINE NACHTMUSIK  (1st mvt Allegro)
//    Key: G major  |  BPM: 132
// ═══════════════════════════════════════════════════════════════
const ek_fan = [G4,D4,D4, G4,D4,D4, G4,D4,G4,B4,D5];
const ek_ctr = [C5,A4,A4, D5,A4,A4, D5,A4,C5,D5,G4];
const ek_dev = [D4,G4,B4,D5,G5,D5,B4,G4];
const ek_br  = [A4,D5,C5,G4, A4,D5,C5,G4, A4,G4,Fs4,G4];
const ek_2nd = [D5,D5,E5,Fs5,G5,Fs5,E5,D5,C5,B4,C5,D5];
const ek_cl  = [G5,Fs5,G5,D5,E5,D5,B4,A4,G4,Fs4,G4,B4,D5,G5];
const ek_tr  = [B4,C5,D5,E5,D5,C5,B4,A4, G4,A4,B4,C5,D5,E5,Fs5,G5];

// ═══════════════════════════════════════════════════════════════
// 4. PACHELBEL — CANON IN D
//    Key: D major  |  BPM: 84
// ═══════════════════════════════════════════════════════════════
const can_v1 = [Fs5,E5,D5,Cs5,B4,A4,B4,Cs5, Fs4,Gs4,A4,Fs4,A4,B4,Cs5,D5];
const can_v2 = [Cs5,B4,A4,Gs4,Fs4,E4,Fs4,Gs4, A4,Fs4,A4,B4,Cs5,D5,E5,Fs5];
const can_v3 = [D5,Cs5,D5,Fs5,E5,D5,Cs5,B4, A4,B4,Cs5,D5,Cs5,B4,A4,Gs4];
const can_v4 = [Fs4,Gs4,A4,B4,Cs5,D5,E5,Fs5, Fs5,E5,D5,Cs5,B4,A4,Gs4,Fs4];
const can_bass = [D4,A3,B3,Fs3,G3,D3,G3,A3, D4,Fs4,A4,D5,A4,Fs4,D4,A3];

// ═══════════════════════════════════════════════════════════════
// 5. DEBUSSY — CLAIR DE LUNE
//    Key: Db major  |  BPM: 66
// ═══════════════════════════════════════════════════════════════
const cl_a = [Ab4,Bb4,Db5,Eb5,Db5,Bb4,Ab4,F4, Ab4,Bb4,Db5,Eb5,F5,Eb5,Db5,Bb4];
const cl_b = [Ab4,F4,Db4,Bb3,Db4,F4,Ab4,Bb4, Db5,Eb5,Db5,Bb4,Ab4,F4,Db4,Bb3];
const cl_c = [Ab3,Bb3,Db4,Eb4,F4,Eb4,Db4,Bb3, Db4,Eb4,F4,Ab4,Bb4,Ab4,F4,Eb4];
const cl_d = [Ab4,Bb4,C5,Db5,Eb5,F5,Ab5,Bb5, Ab5,F5,Eb5,Db5,Bb4,Ab4,F4,F4];
const cl_e = [Db5,Bb4,Ab4,F4,Db4,Bb3,Bb3,Ab3];
const cl_f = [F4,Ab4,Bb4,Db5,F5,Eb5,Db5,Bb4, Ab4,F4,Eb4,Db4,Bb3,Ab3,Bb3,Db4];

// ═══════════════════════════════════════════════════════════════
// 6. GRIEG — MORNING MOOD  (Peer Gynt Suite)
//    Key: E major  |  BPM: 80
// ═══════════════════════════════════════════════════════════════
const mm_a    = [E4,Fs4,Gs4,A4,B4,A4,Gs4,Fs4];
const mm_a2   = [E4,Fs4,Gs4,A4,B4,E5,Cs5,B4];
const mm_d    = [A4,Gs4,Fs4,E4,Fs4,Gs4,A4,B4];
const mm_r    = [A4,Gs4,Fs4,E4,D4,E4,Fs4,Gs4];
const mm_dev  = [E4,Fs4,Gs4,A4,B4,Cs5,E5,Cs5, B4,A4,Gs4,Fs4,E4,Fs4,Gs4,B4];
const mm_coda = [E5,Cs5,B4,A4,Gs4,Fs4,E4,D4, E4,Fs4,Gs4,A4,B4,Cs5,E5];
const mm_br   = [Gs4,A4,B4,Cs5,B4,A4,Gs4,Fs4, E4,Gs4,B4,E5,B4,Gs4,E4,Fs4];

// ═══════════════════════════════════════════════════════════════
// 7. DVOŘÁK — NEW WORLD SYMPHONY, LARGO  ("Going Home")
//    Key: E major range  |  BPM: 66
// ═══════════════════════════════════════════════════════════════
const nw_a   = [E4,Fs4,A4,A4,B4,A4,Fs4,E4, D4,E4,Fs4,E4,D4,B3];
const nw_a2  = [E4,Fs4,A4,A4,B4,A4,Fs4,E4, D4,E4,Fs4,A4,Fs4,E4];
const nw_b   = [D4,B3,D4,E4,Fs4,E4,D4,B3, A3,B3,D4,E4,D4,B3,A3];
const nw_end = [D4,E4,Fs4,A4,B4,A4,Fs4,E4,D4,B3,A3,G3];
const nw_c   = [B4,A4,Fs4,E4,D4,E4,Fs4,A4, B4,Cs5,D5,Cs5,B4,A4,Fs4,E4];

// ═══════════════════════════════════════════════════════════════
// 8. TCHAIKOVSKY — SWAN LAKE THEME
//    Key: A minor  |  BPM: 76
// ═══════════════════════════════════════════════════════════════
const sw_a   = [E4,B4,A4,Gs4,A4,B4,E5,D5, Cs5,B4,A4,Gs4,A4,B4,E4];
const sw_a2  = [E4,B4,A4,Gs4,A4,B4,E5,D5, Cs5,B4,Cs5,D5,E5];
const sw_b   = [E5,D5,Cs5,B4,A4,Gs4,A4,B4, Cs5,D5,Cs5,B4,A4,Gs4,Fs4,E4];
const sw_dev = [E5,Fs5,E5,D5,Cs5,B4,A4,B4, Cs5,D5,E5,Fs5,E5,D5,Cs5,B4];
const sw_end = [Cs5,B4,A4,Gs4,Fs4,E4,D4,E4,Fs4,Gs4,A4,B4,E4];
const sw_br  = [A4,B4,Cs5,E5,Cs5,B4,A4,Gs4, Fs4,Gs4,A4,B4,Cs5,D5,E5,D5];

// ═══════════════════════════════════════════════════════════════
// 9. BEETHOVEN — MOONLIGHT SONATA, 1st mvt
//    Key: C# minor  |  BPM: 96
// ═══════════════════════════════════════════════════════════════
const ms_1 = [Gs4,Cs4,E4, Gs4,Cs4,E4, Gs4,Cs4,E4, Gs4,Cs4,E4];  // i   (C#m)
const ms_2 = [A4,Cs4,E4,  A4,Cs4,E4,  A4,Cs4,E4,  A4,Cs4,E4];   // bVI
const ms_3 = [A4,Cs4,Fs4, A4,Cs4,Fs4, A4,Cs4,Fs4, A4,Cs4,Fs4];  // iv  (F#m)
const ms_4 = [Gs4,B3,Eb4, Gs4,B3,Eb4, Gs4,B3,Eb4, Gs4,B3,Eb4];  // V   (G#)
const ms_5 = [Gs4,E4,Cs4, Gs4,E4,Cs4, Gs4,E4,Cs4, Gs4,E4,Cs4];  // i inv
const ms_6 = [B4,E4,Gs4,  B4,E4,Gs4,  B4,E4,Gs4,  B4,E4,Gs4];   // III (E)
const ms_7 = [Bb4,Eb4,Fs4,Bb4,Eb4,Fs4,Bb4,Eb4,Fs4,Bb4,Eb4,Fs4]; // ii  (D#m)
const ms_8 = [Gs4,C4,Eb4, Gs4,C4,Eb4, Gs4,C4,Eb4, Gs4,C4,Eb4];  // V7
const ms_9 = [Fs4,Cs4,E4, Fs4,Cs4,E4, Fs4,Cs4,E4, Fs4,Cs4,E4];  // iv6

// ═══════════════════════════════════════════════════════════════
// 10. VIVALDI — SPRING, 1st mvt  (Four Seasons)
//     Key: E major  |  BPM: 120
// ═══════════════════════════════════════════════════════════════
const sp_a   = [E4,E4,E4,D4,E4, G4,G4,G4,F4,G4, C5,B4,A4,B4,G4];
const sp_b   = [E5,Fs5,E5,D5,C5,D5,E5, D5,E5,D5,C5,B4,C5,D5];
const sp_dev = [A4,B4,C5,A4,B4,C5,D5, C5,B4,A4,G4,A4,B4,G4];
const sp_end = [E5,D5,C5,B4,A4,G4,A4,B4,C5,D5,E5,G5,E5];
const sp_tr  = [G4,A4,B4,C5,D5,E5,D5,C5, B4,A4,G4,F4,E4,D4,E4,G4];

// ═══════════════════════════════════════════════════════════════
// 11. CHOPIN — NOCTURNE OP. 9 NO. 2
//     Key: Eb major  |  BPM: 72
// ═══════════════════════════════════════════════════════════════
const nc_a   = [Eb5,C5,Ab4,G4,Ab4,C5,Eb5,C5, Ab5,G5,F5,Eb5,C5,Ab4,G4,Ab4];
const nc_b   = [C5,Eb5,F5,G5,Ab5,G5,F5,Eb5, C5,Ab4,G4,Eb4,F4,G4,Ab4,C5];
const nc_c   = [Eb5,F5,G5,Ab5,Bb5,Ab5,G5,F5, Eb5,C5,Bb4,Ab4,G4,Ab4,Bb4,C5];
const nc_end = [C5,Eb5,F5,Ab5,Bb5,C6,Bb5,Ab5, F5,Eb5,C5,Ab4,G4,F4,Eb4];
const nc_d   = [G4,Ab4,Bb4,C5,Eb5,C5,Bb4,Ab4, G4,F4,Eb4,F4,G4,Ab4,Bb4,Eb5];

// ═══════════════════════════════════════════════════════════════
// 12. SATIE — GYMNOPÉDIE NO. 1
//     Key: D major  |  BPM: 72
// ═══════════════════════════════════════════════════════════════
const gy_a   = [Fs5,E5,Cs5,A4,B4,Cs5,E5,Fs5, A5,Fs5,E5,Cs5,A4,B4,Cs5,E5];
const gy_b   = [Fs5,A5,B5,A5,Fs5,E5,Cs5,A4, B4,Cs5,A4,Fs4,E4,Fs4,A4,Cs5];
const gy_c   = [D5,B4,A4,Fs4,E4,Fs4,A4,B4, D5,E5,Fs5,E5,D5,B4,A4,Fs4];
const gy_end = [Fs5,E5,Cs5,A4,B4,Cs5,E5,Fs5, A5,Fs5,E5,Cs5,A4,Fs4,E4,D4];
const gy_d   = [E5,Cs5,A4,Fs4,D4,Fs4,A4,Cs5, E5,Fs5,A5,Fs5,E5,Cs5,B4,A4];

// ═══════════════════════════════════════════════════════════════
// 13. MOZART — TURKISH MARCH  (Piano Sonata No. 11, 3rd mvt)
//     Key: A minor  |  BPM: 140
// ═══════════════════════════════════════════════════════════════
const tm_a   = [B4,A4,Gs4,A4,C5,  B4,A4,Gs4,A4,C5, B4,A4,Gs4,A4,C5,E5];
const tm_a2  = [D5,C5,B4,C5,E5,  D5,C5,B4,C5,E5,  D5,C5,B4,C5,E5,A5];
const tm_b   = [A5,G5,Fs5,G5,A5,G5,Fs5,E5, D5,E5,Fs5,G5,A5,B5,A5,G5];
const tm_c   = [Fs5,E5,D5,Cs5,D5,E5,Fs5,G5, A5,G5,Fs5,E5,D5,Cs5,B4,A4];
const tm_end = [E5,D5,C5,B4,A4,Gs4,A4,B4, C5,D5,E5,D5,C5,B4,A4];
const tm_d   = [A4,C5,E5,A5,E5,C5,A4,B4, C5,E5,A5,C6,A5,E5,C5,B4];

// ═══════════════════════════════════════════════════════════════
// 14. BEETHOVEN — FÜR ELISE
//     Key: A minor  |  BPM: 100
// ═══════════════════════════════════════════════════════════════
const fe_a   = [E5,Ds5,E5,Ds5,E5,B4,D5,C5,A4];
const fe_a2  = [C4,E4,A4,B4, E4,Gs4,B4,C5];
const fe_b   = [E5,Ds5,E5,Ds5,E5,B4,D5,C5,A4];
const fe_c   = [C4,E4,A4,B4, E4,C5,B4,A4];
const fe_dev = [B4,C5,D5,E5, C5,D5,E5,F5, E5,D5,C5,B4, A4,B4,C5,D5];
const fe_end = [E5,Ds5,E5,Ds5,E5,B4,D5,C5,A4, C4,E4,A4,B4, E4,C5,B4,A4];
const fe_br  = [A4,C5,E5,A5,E5,C5,A4,G4, F4,A4,C5,F5,C5,A4,F4,E4];

// ═══════════════════════════════════════════════════════════════
// 15. BACH — TOCCATA AND FUGUE IN D MINOR  (opening)
//     Key: D minor  |  BPM: 88
// ═══════════════════════════════════════════════════════════════
const tf_a   = [A4,G4,A4, D4,Cs4,D4,E4,F4,Cs4,D4];
const tf_b   = [A4,G4,F4,E4,D4,Cs4,D4, A3,Bb3,A3,G3,F3,E3,D3];
const tf_c   = [D4,E4,F4,G4,A4,Bb4,A4,G4, F4,E4,D4,E4,F4,G4,A4,Bb4];
const tf_d   = [C5,Bb4,A4,G4,F4,E4,D4,C4, Bb3,A3,G3,A3,Bb3,C4,D4,E4];
const tf_end = [F4,G4,A4,Bb4,C5,D5,C5,Bb4, A4,G4,F4,E4,D4,C4,Bb3,A3];
const tf_e   = [D4,F4,A4,D5,A4,F4,D4,E4, F4,A4,D5,F5,D5,A4,F4,D4];

// ═══════════════════════════════════════════════════════════════
// 16. HANDEL — HALLELUJAH CHORUS  (Messiah)
//     Key: D major  |  BPM: 108
// ═══════════════════════════════════════════════════════════════
const hc_a   = [A4,A4,A4,A4,A4, Fs4,Fs4,D4, A4,A4,A4,A4,A4,Fs4,D4];
const hc_b   = [D5,D5,D5,D5,Cs5,D5, B4,B4,A4,A4,Fs4,D4];
const hc_c   = [A4,B4,Cs5,D5,E5,D5,Cs5,B4, A4,Gs4,A4,B4,Cs5,D5,E5,Fs5];
const hc_end = [D5,Cs5,B4,A4,B4,Cs5,D5, A4,B4,A4,Gs4,Fs4,E4,D4];
const hc_d   = [D5,E5,Fs5,G5,Fs5,E5,D5,Cs5, B4,A4,B4,Cs5,D5,E5,Fs5,D5];

// ═══════════════════════════════════════════════════════════════
// 17. TCHAIKOVSKY — NUTCRACKER, DANCE OF THE SUGAR PLUM FAIRY
//     Key: E minor  |  BPM: 112
// ═══════════════════════════════════════════════════════════════
const sp_f_a = [E5,Ds5,E5,B4, E5,Ds5,E5,B4, E5,Fs5,E5,Ds5,E5,B4,Gs4];
const sp_f_b = [A4,B4,C5,D5,E5,D5,C5,B4, A4,Gs4,A4,B4,C5,D5,E5,Fs5];
const sp_f_c = [G5,Fs5,E5,Ds5,E5,Fs5,G5,A5, G5,Fs5,E5,Ds5,E5,B4,E4];
const sp_f_end = [E5,Ds5,E5,B4,Gs4,A4,B4, E5,Ds5,E5,Fs5,E5,Ds5,E5,B4];
const sp_f_d = [B4,C5,D5,E5,Fs5,G5,Fs5,E5, D5,C5,B4,A4,Gs4,A4,B4,E5];

// ═══════════════════════════════════════════════════════════════
// 18. BEETHOVEN — SYMPHONY NO. 5  (opening motif developed)
//     Key: C minor  |  BPM: 108
// ═══════════════════════════════════════════════════════════════
const b5_a   = [G4,G4,G4,Eb4, F4,F4,F4,D4];
const b5_b   = [G4,G4,G4,Eb4, Ab4,Ab4,Ab4,G4,F4,F4,F4,D4];
const b5_c   = [Eb4,G4,Bb4,Eb5,D5,C5,Bb4,Ab4, G4,F4,Eb4,D4,C4,D4,Eb4,F4];
const b5_d   = [G4,Ab4,Bb4,C5,D5,Eb5,D5,C5, Bb4,Ab4,G4,F4,Eb4,D4,C4,Bb3];
const b5_end = [G4,G4,G4,Eb4, Ab4,Ab4,G4,G4, F4,F4,Eb4,Eb4, D4,D4,C4];
const b5_e   = [C4,Eb4,G4,C5,Eb5,C5,G4,Eb4, D4,F4,Ab4,D5,F5,D5,Ab4,F4];

// ═══════════════════════════════════════════════════════════════
// 19. SCHUBERT — AVE MARIA
//     Key: Bb major  |  BPM: 60
// ═══════════════════════════════════════════════════════════════
const av_a   = [D5,D5,D5,C5,Bb4, A4,Bb4,C5,D5,F5, Eb5,D5,C5,Bb4,A4,Bb4];
const av_b   = [D5,Eb5,F5,Eb5,D5,C5, Bb4,A4,G4,A4,Bb4,C5,D5,Eb5];
const av_c   = [F5,Eb5,D5,C5,Bb4,A4,G4,F4, G4,A4,Bb4,C5,D5,Eb5,D5,C5];
const av_end = [Bb4,C5,D5,Eb5,F5,Eb5,D5,C5, Bb4,A4,G4,F4,G4,A4,Bb4];
const av_d   = [G4,A4,Bb4,D5,F5,D5,Bb4,A4, G4,Bb4,D5,F5,Eb5,D5,C5,Bb4];

// ═══════════════════════════════════════════════════════════════
// 20. BRAHMS — LULLABY  (Wiegenlied)
//     Key: Eb major  |  BPM: 68
// ═══════════════════════════════════════════════════════════════
const bl_a   = [Eb4,Eb4,G4,Eb4,Eb4,G4, Eb4,G4,C5,Bb4,Ab4,G4];
const bl_b   = [F4,F4,Ab4,F4,F4,Ab4, F4,Ab4,D5,C5,Bb4,Ab4];
const bl_c   = [G4,Ab4,Bb4,C5,Bb4,Ab4,G4,F4, Eb4,F4,G4,Ab4,Bb4,C5,Bb4,Ab4];
const bl_end = [G4,Bb4,Eb5,D5,C5,Bb4,Ab4,G4, F4,Eb4,F4,G4,Ab4,Bb4,Eb4];
const bl_d   = [Eb4,G4,Bb4,Eb5,Bb4,G4,Eb4,F4, G4,Bb4,Eb5,G5,Eb5,Bb4,G4,F4];

// ═══════════════════════════════════════════════════════════════
// 21. DEBUSSY — ARABESQUE NO. 1
//     Key: E major  |  BPM: 76
// ═══════════════════════════════════════════════════════════════
const ar_a = [E4,Fs4,Gs4,Cs5,B4,Gs4, Fs4,E4,Cs4,E4,Fs4,Gs4];
const ar_b = [Cs5,Ds5,E5,Gs5,Fs5,E5, Ds5,Cs5,B4,Gs4,Fs4,E4];
const ar_c = [E5,Ds5,Cs5,B4,A4,Gs4, A4,B4,Cs5,E5,Fs5,Gs5];
const ar_d = [Fs5,E5,Cs5,B4,A4,Gs4,Fs4,E4, Fs4,Gs4,A4,B4,Cs5,Ds5,E5,Fs5];
const ar_e = [Gs5,Fs5,E5,Ds5,Cs5,B4,A4,B4, Cs5,E5,Gs5,E5,Cs5,B4,Gs4,E4];

// ═══════════════════════════════════════════════════════════════
// 22. TCHAIKOVSKY — WALTZ OF THE FLOWERS  (Nutcracker)
//     Key: D major  |  BPM: 84
// ═══════════════════════════════════════════════════════════════
const wf_a = [D5,Cs5,D5,E5,Fs5,A5, G5,Fs5,E5,D5,Cs5,B4];
const wf_b = [A4,B4,Cs5,D5,E5,Fs5, G5,Fs5,E5,D5,Cs5,D5];
const wf_c = [Fs5,G5,A5,B5,A5,G5, Fs5,E5,D5,Cs5,B4,A4];
const wf_d = [B4,Cs5,D5,E5,Fs5,G5,A5,G5, Fs5,E5,D5,Cs5,B4,A4,G4,Fs4];
const wf_e = [D4,Fs4,A4,D5,Fs5,A5, G5,E5,Cs5,A4,Fs4,D4];

// ═══════════════════════════════════════════════════════════════
// 23. GRIEG — IN THE HALL OF THE MOUNTAIN KING
//     Key: B minor  |  BPM: 90
// ═══════════════════════════════════════════════════════════════
const mk_a = [B3,Cs4,D4,E4,Fs4,D4,Fs4,E4, B3,Cs4,D4,E4,Fs4,D4,Fs4,B4];
const mk_b = [A4,Fs4,A4,Gs4, E4,Gs4,E4,Gs4, B3,Cs4,D4,E4,Fs4,D4,Fs4,E4];
const mk_c = [B4,A4,Gs4,Fs4,E4,D4,Cs4,B3, Cs4,D4,E4,Fs4,G4,A4,B4,Cs5];
const mk_d = [D5,Cs5,B4,A4,G4,Fs4,E4,D4, Cs4,D4,E4,Fs4,G4,A4,B4,D5];
const mk_e = [Fs5,E5,D5,Cs5,B4,A4,G4,Fs4, E4,D4,Cs4,B3,Cs4,D4,E4,Fs4];

// ═══════════════════════════════════════════════════════════════
// 24. MOZART — LACRIMOSA  (Requiem in D minor)
//     Key: D minor  |  BPM: 66
// ═══════════════════════════════════════════════════════════════
const la_a = [D4,D4,Cs4,D4,E4,F4, F4,E4,D4,C4,Bb3,A3];
const la_b = [D4,E4,F4,G4,A4,Bb4, A4,G4,F4,E4,D4,Cs4];
const la_c = [F4,G4,A4,Bb4,C5,D5, C5,Bb4,A4,G4,F4,E4];
const la_d = [D5,C5,Bb4,A4,G4,F4,E4,D4, Cs4,D4,E4,F4,G4,A4,Bb4,C5];
const la_e = [A4,Bb4,C5,D5,Eb5,D5,C5,Bb4, A4,G4,F4,E4,D4,Cs4,D4,D4];

// ═══════════════════════════════════════════════════════════════
// 25. BEETHOVEN — PATHÉTIQUE SONATA, 2nd mvt (Adagio cantabile)
//     Key: Ab major  |  BPM: 60
// ═══════════════════════════════════════════════════════════════
const pa_a = [Ab4,Bb4,C5,Db5,C5,Bb4,Ab4,G4, Ab4,Bb4,C5,Eb5,Db5,C5,Bb4,Ab4];
const pa_b = [G4,Ab4,Bb4,C5,Db5,Eb5,Db5,C5, Bb4,Ab4,G4,F4,Eb4,F4,G4,Ab4];
const pa_c = [Eb5,Db5,C5,Bb4,Ab4,G4,F4,G4, Ab4,Bb4,C5,Db5,Eb5,F5,Eb5,Db5];
const pa_d = [C5,Bb4,Ab4,G4,Ab4,Bb4,C5,Db5, Eb5,Db5,C5,Bb4,Ab4,G4,Ab4,Bb4];
const pa_e = [F5,Eb5,Db5,C5,Bb4,Ab4,G4,Ab4, Bb4,C5,Db5,Eb5,F5,Eb5,Db5,C5];


// ═══════════════════════════════════════════════════════════════
// COMPOSE — extended arrangements with repeats & transpositions
// ═══════════════════════════════════════════════════════════════

export const symphonies = [
  // 1. Ode to Joy
  { name: 'Ode to Joy',        bpm: 120, notes: [
      ...ode_a, ...ode_a2, ...ode_b, ...ode_a2,
      ...ode_br,
      ...transpose(ode_a,12), ...transpose(ode_a2,12),
      ...transpose(ode_b,12), ...transpose(ode_a2,12),
      ...ode_br,
      ...ode_a, ...ode_a2, ...ode_b, ...ode_end,
      ...transpose(ode_a,12), ...transpose(ode_a2,12),
      ...transpose(ode_b,12), ...ode_end,
      ...ode_br, ...ode_a, ...ode_a2, ...ode_end,
  ]},

  // 2. Cello Suite
  { name: 'Cello Suite No. 1', bpm: 100, notes: [
      ...bach_a, ...bach_b, ...bach_c, ...bach_d,
      ...transpose(bach_a,12), ...transpose(bach_b,12),
      ...bach_c, ...bach_d,
      ...bach_a, ...bach_b, ...bach_c, ...bach_d,
  ]},

  // 3. Eine Kleine
  { name: 'Eine Kleine',       bpm: 132, notes: [
      ...ek_fan, ...ek_ctr, ...ek_dev, ...ek_dev,
      ...ek_br, ...ek_fan, ...ek_ctr, ...ek_2nd,
      ...ek_tr,
      ...ek_cl, ...ek_dev, ...ek_br, ...ek_cl,
      ...ek_fan, ...ek_ctr, ...ek_2nd, ...ek_cl,
      ...ek_tr,
      ...ek_dev, ...ek_br, ...ek_fan, ...ek_cl,
      ...ek_2nd, ...ek_tr, ...ek_cl,
  ]},

  // 4. Canon in D
  { name: 'Canon in D',        bpm: 84,  notes: [
      ...can_bass,
      ...can_v1, ...can_v2, ...can_v3, ...can_v4,
      ...can_bass,
      ...can_v1, ...can_v2, ...can_v3, ...can_v4,
      ...can_v3, ...can_v1, ...can_v4, ...can_v2,
      ...can_bass,
      ...transpose(can_v1,-12), ...transpose(can_v2,-12),
      ...can_v3, ...can_v4,
  ]},

  // 5. Clair de Lune
  { name: 'Clair de Lune',     bpm: 66,  notes: [
      ...cl_a, ...cl_b, ...cl_a, ...cl_c,
      ...cl_f,
      ...cl_d, ...cl_a, ...cl_b, ...cl_c,
      ...cl_f,
      ...cl_a, ...cl_d, ...cl_b,
      ...cl_f, ...cl_c, ...cl_e,
  ]},

  // 6. Morning Mood
  { name: 'Morning Mood',      bpm: 80,  notes: [
      ...mm_a, ...mm_a2, ...mm_d, ...mm_r,
      ...mm_br,
      ...mm_dev, ...mm_a, ...mm_a2, ...mm_d,
      ...mm_coda,
      ...mm_br,
      ...mm_a, ...mm_a2, ...mm_dev,
      ...mm_a, ...mm_d, ...mm_r,
      ...mm_br, ...mm_coda,
      ...transpose(mm_a,12), ...transpose(mm_a2,12), ...mm_coda,
  ]},

  // 7. Going Home
  { name: 'Going Home',        bpm: 66,  notes: [
      ...nw_a, ...nw_a2, ...nw_b, ...nw_a,
      ...nw_c,
      ...nw_a2, ...nw_b, ...nw_a, ...nw_a2,
      ...nw_c,
      ...nw_b, ...nw_a,
      ...transpose(nw_a,12), ...transpose(nw_a2,12),
      ...nw_c, ...nw_end,
  ]},

  // 8. Swan Lake
  { name: 'Swan Lake',         bpm: 76,  notes: [
      ...sw_a, ...sw_a2, ...sw_b, ...sw_a,
      ...sw_br,
      ...sw_dev, ...sw_b, ...sw_a, ...sw_a2,
      ...sw_br,
      ...sw_dev, ...sw_b, ...sw_a,
      ...transpose(sw_a,12), ...transpose(sw_b,12),
      ...sw_br, ...sw_end,
  ]},

  // 9. Moonlight Sonata
  { name: 'Moonlight Sonata',  bpm: 96,  notes: [
      ...ms_1, ...ms_1, ...ms_2, ...ms_2,
      ...ms_3, ...ms_3, ...ms_4, ...ms_4,
      ...ms_5, ...ms_5, ...ms_6, ...ms_6,
      ...ms_7, ...ms_7, ...ms_8, ...ms_8,
      ...ms_9, ...ms_9,
      ...ms_1, ...ms_1, ...ms_4, ...ms_1,
      ...ms_2, ...ms_3, ...ms_5, ...ms_6,
      ...ms_7, ...ms_8, ...ms_9, ...ms_1, ...ms_4,
      ...ms_1, ...ms_2, ...ms_3, ...ms_8, ...ms_1,
  ]},

  // 10. Spring
  { name: 'Spring',            bpm: 120, notes: [
      ...sp_a, ...sp_b, ...sp_dev,
      ...sp_tr,
      ...sp_a, ...sp_b, ...sp_dev,
      ...sp_tr,
      ...sp_a, ...sp_end,
      ...sp_a, ...sp_b, ...sp_dev, ...sp_end,
      ...sp_tr,
      ...sp_a, ...sp_dev, ...sp_b, ...sp_end,
  ]},

  // 11. Nocturne Op. 9
  { name: 'Nocturne Op. 9',    bpm: 72,  notes: [
      ...nc_a, ...nc_b, ...nc_c,
      ...nc_d,
      ...nc_a, ...nc_b, ...nc_c,
      ...nc_d,
      ...nc_a, ...nc_b, ...nc_end,
      ...nc_d, ...nc_c, ...nc_a, ...nc_end,
  ]},

  // 12. Gymnopédie No. 1
  { name: 'Gymnopédie No. 1',  bpm: 72,  notes: [
      ...gy_a, ...gy_b, ...gy_a, ...gy_c,
      ...gy_d,
      ...gy_b, ...gy_a, ...gy_c, ...gy_b,
      ...gy_d,
      ...gy_a, ...gy_c, ...gy_d, ...gy_end,
  ]},

  // 13. Turkish March
  { name: 'Turkish March',     bpm: 140, notes: [
      ...tm_a, ...tm_a2, ...tm_b, ...tm_c,
      ...tm_d,
      ...tm_a, ...tm_a2, ...tm_b, ...tm_c,
      ...tm_d,
      ...tm_b, ...tm_a, ...tm_a2, ...tm_c,
      ...tm_d, ...tm_b, ...tm_end,
  ]},

  // 14. Für Elise
  { name: 'Für Elise',         bpm: 100, notes: [
      ...fe_a, ...fe_a2, ...fe_b, ...fe_c,
      ...fe_br,
      ...fe_dev, ...fe_a, ...fe_a2, ...fe_b, ...fe_c,
      ...fe_br,
      ...fe_dev, ...fe_end,
      ...fe_br, ...fe_a, ...fe_dev, ...fe_end,
  ]},

  // 15. Toccata & Fugue
  { name: 'Toccata & Fugue',   bpm: 88,  notes: [
      ...tf_a, ...tf_b, ...tf_c, ...tf_d,
      ...tf_e,
      ...tf_a, ...tf_c, ...tf_d, ...tf_b,
      ...tf_e,
      ...tf_c, ...tf_d, ...tf_end,
      ...tf_e, ...tf_a, ...tf_end,
  ]},

  // 16. Hallelujah
  { name: 'Hallelujah',        bpm: 108, notes: [
      ...hc_a, ...hc_b, ...hc_c, ...hc_a,
      ...hc_d,
      ...hc_b, ...hc_c, ...hc_a, ...hc_b,
      ...hc_d,
      ...hc_c, ...hc_end,
      ...hc_d, ...hc_a, ...hc_c, ...hc_end,
  ]},

  // 17. Sugar Plum Fairy
  { name: 'Sugar Plum Fairy',  bpm: 112, notes: [
      ...sp_f_a, ...sp_f_b, ...sp_f_c,
      ...sp_f_d,
      ...sp_f_a, ...sp_f_b, ...sp_f_c,
      ...sp_f_d,
      ...sp_f_a, ...sp_f_b, ...sp_f_end,
      ...sp_f_d, ...sp_f_c, ...sp_f_end,
  ]},

  // 18. Symphony No. 5
  { name: 'Symphony No. 5',    bpm: 108, notes: [
      ...b5_a, ...b5_b, ...b5_c, ...b5_d,
      ...b5_e,
      ...b5_a, ...b5_b, ...b5_c, ...b5_d,
      ...b5_e,
      ...b5_c, ...b5_d, ...b5_end,
      ...b5_e, ...b5_a, ...b5_c, ...b5_end,
  ]},

  // 19. Ave Maria
  { name: 'Ave Maria',         bpm: 60,  notes: [
      ...av_a, ...av_b, ...av_c, ...av_a,
      ...av_d,
      ...av_b, ...av_c, ...av_a, ...av_b,
      ...av_d,
      ...av_c, ...av_end,
      ...av_d, ...av_a, ...av_c, ...av_end,
  ]},

  // 20. Brahms Lullaby
  { name: 'Brahms Lullaby',    bpm: 68,  notes: [
      ...bl_a, ...bl_b, ...bl_c, ...bl_a,
      ...bl_d,
      ...bl_b, ...bl_c, ...bl_a, ...bl_b,
      ...bl_d,
      ...bl_c, ...bl_end,
      ...bl_d, ...bl_a, ...bl_c, ...bl_end,
  ]},

  // ─── NEW PIECES ─────────────────────────────────────────────

  // 21. Arabesque No. 1
  { name: 'Arabesque No. 1',   bpm: 76,  notes: [
      ...ar_a, ...ar_b, ...ar_c, ...ar_d,
      ...ar_e,
      ...ar_a, ...ar_b, ...ar_c, ...ar_d,
      ...ar_e,
      ...transpose(ar_a,12), ...transpose(ar_b,12),
      ...ar_d, ...ar_e,
      ...ar_c, ...ar_a, ...ar_e,
  ]},

  // 22. Waltz of the Flowers
  { name: 'Waltz of the Flowers', bpm: 84, notes: [
      ...wf_a, ...wf_b, ...wf_c, ...wf_d,
      ...wf_e,
      ...wf_a, ...wf_b, ...wf_c, ...wf_d,
      ...wf_e,
      ...transpose(wf_a,12), ...transpose(wf_b,12),
      ...wf_c, ...wf_d, ...wf_e,
      ...wf_a, ...wf_c, ...wf_e,
  ]},

  // 23. Hall of the Mountain King
  { name: 'Mountain King',     bpm: 90,  notes: [
      ...mk_a, ...mk_b, ...mk_c,
      ...mk_a, ...mk_b, ...mk_c,
      ...mk_d, ...mk_e,
      ...mk_a, ...mk_b, ...mk_c,
      ...mk_d, ...mk_e,
      ...transpose(mk_a,12), ...transpose(mk_b,12),
      ...mk_d, ...mk_e, ...mk_c,
  ]},

  // 24. Lacrimosa
  { name: 'Lacrimosa',         bpm: 66,  notes: [
      ...la_a, ...la_b, ...la_c, ...la_d,
      ...la_e,
      ...la_a, ...la_b, ...la_c, ...la_d,
      ...la_e,
      ...transpose(la_a,12), ...transpose(la_b,12),
      ...la_d, ...la_e,
      ...la_c, ...la_a, ...la_e,
  ]},

  // 25. Pathétique Sonata
  { name: 'Pathétique',        bpm: 60,  notes: [
      ...pa_a, ...pa_b, ...pa_c, ...pa_d,
      ...pa_e,
      ...pa_a, ...pa_b, ...pa_c, ...pa_d,
      ...pa_e,
      ...pa_c, ...pa_d, ...pa_e,
      ...pa_a, ...pa_b, ...pa_e,
  ]},
];
