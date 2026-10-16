/** Per-viewer personal bests (voice-leading movement); a convenience, not progress data. */
const PREFIX = "woodshed.best.";

export function loadBest(id: string): number | null {
  try {
    const v = localStorage.getItem(PREFIX + id);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

export function saveBest(id: string, value: number): void {
  try {
    localStorage.setItem(PREFIX + id, String(value));
  } catch {
    /* storage unavailable: best just isn't remembered */
  }
}
