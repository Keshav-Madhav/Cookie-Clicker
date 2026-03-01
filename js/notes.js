/**
 * Note library — MIDI note constants and helpers.
 *
 * Usage:
 *   import N, { transpose } from './notes.js';
 *   const { C4, D4, E4 } = N;
 *
 * Every chromatic pitch from C2 (36) to B7 (107) is available.
 * Black keys have both sharp and flat aliases (Cs4 = Db4 = 61).
 */

const SHARP = ['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B'];
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

const N = {};

for (let oct = 2; oct <= 7; oct++) {
  for (let i = 0; i < 12; i++) {
    const midi = (oct + 1) * 12 + i;
    N[SHARP[i] + oct] = midi;
    if (FLAT[i] !== SHARP[i]) N[FLAT[i] + oct] = midi;
  }
}

export default N;

/** Transpose an array of MIDI notes by a number of semitones. */
export function transpose(notes, semitones) {
  return notes.map(n => n + semitones);
}
