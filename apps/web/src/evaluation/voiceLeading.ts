/**
 * Total semitone movement between two voicings with the same number of notes, pairing
 * voices bottom-up. Shown as a score, never a failure criterion. null if sizes differ.
 */
export function voiceMovement(from: number[], to: number[]): number | null {
  if (from.length !== to.length || from.length === 0) return null;
  const a = [...from].sort((x, y) => x - y);
  const b = [...to].sort((x, y) => x - y);
  return a.reduce((sum, n, i) => sum + Math.abs(n - b[i]!), 0);
}

/** Sum over consecutive chords; null if any pair is not comparable. */
export function totalMovement(voicings: number[][]): number | null {
  let total = 0;
  for (let i = 1; i < voicings.length; i++) {
    const m = voiceMovement(voicings[i - 1]!, voicings[i]!);
    if (m === null) return null;
    total += m;
  }
  return total;
}
