import { letterIndex, naturalPitchClass, type SpelledNote, type SpelledPitch } from "./note";

/** MIDI number of a spelled pitch; the octave belongs to the letter (Cb4 = 59, B#3 = 60). */
export function midiOf(p: SpelledPitch): number {
  return 12 * (p.octave + 1) + naturalPitchClass(p.letter) + p.accidental;
}

/** Stack spelled notes upward from `octave`, one letter step at a time (close position). */
export function stackPitches(tones: SpelledNote[], octave = 4): SpelledPitch[] {
  let current = octave;
  let prev = -1;
  return tones.map((n) => {
    const li = letterIndex(n.letter);
    if (prev !== -1 && li <= prev) current++;
    prev = li;
    return { ...n, octave: current };
  });
}
