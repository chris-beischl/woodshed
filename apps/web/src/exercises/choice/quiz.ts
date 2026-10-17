import { MAJOR_KEYS, type Key } from "../../theory/keys";
import { LETTERS, mod12, naturalPitchClass, pitchClass, sameNote, type Accidental, type SpelledNote } from "../../theory/note";
import { majorScale } from "../../theory/scale";

export type Ask = "degree_note" | "note_degree" | "fifth_up" | "fourth_up" | "key_signature";

/** Circle-of-fifths asks draw a different major key per question instead of using the card's key. */
export const CIRCLE_ASKS: readonly Ask[] = ["fifth_up", "fourth_up", "key_signature"];

export type Question =
  | { ask: "degree_note"; degree: number; answer: SpelledNote; options: SpelledNote[] }
  | { ask: "note_degree"; note: SpelledNote; answer: number; options: number[] }
  | { ask: "fifth_up" | "fourth_up"; tonic: SpelledNote; answer: SpelledNote; options: SpelledNote[] }
  /** answer: number of sharps (> 0) or flats (< 0) in the major key signature. */
  | { ask: "key_signature"; tonic: SpelledNote; answer: number; options: number[] };

/** Deterministic PRNG (mulberry32) so quizzes are reproducible in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Enharmonic spellings with at most one accidental (G♭ for F♯; none for G). */
function enharmonics(n: SpelledNote): SpelledNote[] {
  const pc = pitchClass(n);
  return LETTERS.flatMap((letter) => {
    const d = mod12(pc - naturalPitchClass(letter));
    const acc = d > 6 ? d - 12 : d;
    return Math.abs(acc) <= 1 && letter !== n.letter ? [{ letter, accidental: acc as Accidental }] : [];
  });
}

/**
 * Wrong answers that teach spelling: the enharmonic twin, the same letter with another
 * accidental, then neighbouring scale degrees.
 */
function noteDistractors(answer: SpelledNote, scale: SpelledNote[], degree: number): SpelledNote[] {
  const sameLetter = ([-1, 0, 1] as const)
    .filter((a) => a !== answer.accidental)
    .map((accidental) => ({ letter: answer.letter, accidental }));
  const neighbours = [scale[(degree + 5) % 7]!, scale[degree % 7]!];
  const out: SpelledNote[] = [];
  for (const n of [...enharmonics(answer), ...sameLetter, ...neighbours]) {
    if (!sameNote(n, answer) && !out.some((o) => sameNote(o, n))) out.push(n);
  }
  return out.slice(0, 3);
}

/** Sharps (> 0) or flats (< 0) of a major key, counted from its spelled scale. */
export function keySignature(tonic: SpelledNote): number {
  return majorScale(tonic).reduce((n, note) => n + note.accidental, 0);
}

/** Wrong key signatures: the enharmonic opposite (6♭ vs 6♯), then neighbours on the circle. */
function signatureDistractors(answer: number): number[] {
  const out: number[] = [];
  for (const n of [-answer, answer + Math.sign(answer || 1), answer - Math.sign(answer || 1), answer + 2 * Math.sign(answer || 1), -answer - 1, answer - 2]) {
    if (n !== answer && Math.abs(n) <= 7 && !out.includes(n)) out.push(n);
  }
  return out.slice(0, 3);
}

function makeCircleQuiz(ask: "fifth_up" | "fourth_up" | "key_signature", rounds: number, rnd: () => number): Question[] {
  const questions: Question[] = [];
  let prev = -1;
  for (let i = 0; i < rounds; i++) {
    let k = Math.floor(rnd() * MAJOR_KEYS.length);
    if (k === prev) k = (k + 1) % MAJOR_KEYS.length;
    prev = k;
    const tonic = MAJOR_KEYS[k]!.tonic;
    if (ask === "key_signature") {
      const answer = keySignature(tonic);
      questions.push({ ask, tonic, answer, options: shuffle([answer, ...signatureDistractors(answer)], rnd) });
    } else {
      // Fifth = 5th degree, fourth = 4th degree of the tonic's major scale: letter arithmetic, never pitch class.
      const degree = ask === "fifth_up" ? 5 : 4;
      const scale = majorScale(tonic);
      const answer = scale[degree - 1]!;
      questions.push({ ask, tonic, answer, options: shuffle([answer, ...noteDistractors(answer, scale, degree)], rnd) });
    }
  }
  return questions;
}

export function makeQuiz(key: Key, ask: Ask, degrees: number[], rounds: number, rnd: () => number): Question[] {
  if (ask === "fifth_up" || ask === "fourth_up" || ask === "key_signature") return makeCircleQuiz(ask, rounds, rnd);
  const scale = majorScale(key.tonic);
  const questions: Question[] = [];
  let prev = -1;
  for (let i = 0; i < rounds; i++) {
    const pool = degrees.length > 1 ? degrees.filter((d) => d !== prev) : degrees;
    const degree = pool[Math.floor(rnd() * pool.length)]!;
    prev = degree;
    const note = scale[degree - 1]!;
    if (ask === "degree_note") {
      questions.push({ ask, degree, answer: note, options: shuffle([note, ...noteDistractors(note, scale, degree)], rnd) });
    } else {
      const others = shuffle([1, 2, 3, 4, 5, 6, 7].filter((d) => d !== degree), rnd).slice(0, 3);
      questions.push({ ask, note, answer: degree, options: shuffle([degree, ...others], rnd) });
    }
  }
  return questions;
}
