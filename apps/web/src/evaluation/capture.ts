import type { NoteEvent } from "../input/types";

export interface CaptureEvent {
  kind: "settled" | "committed";
  notes: number[]; // sorted ascending
  t: number;
}

export interface CaptureOptions {
  settleMs?: number;
  minNotes?: number;
}

export const DEFAULT_SETTLE_MS = 120;

/**
 * Chord segmentation (ARCHITECTURE § 4.4). Pure: time only enters through event
 * timestamps and `advance(t)`; the caller drives a timer.
 *
 * - every note-on restarts the settle timer; on expiry → "settled" (all held keys)
 * - the first note-on / note-off after settling → "committed" (the settled set)
 */
export function createChordCapture(opts: CaptureOptions = {}) {
  const settleMs = opts.settleMs ?? DEFAULT_SETTLE_MS;
  const minNotes = opts.minNotes ?? 1;
  const held = new Set<number>();
  let deadline: number | null = null;
  let pending: number[] | null = null;
  let lastCommitted: string | null = null;

  const sorted = () => [...held].sort((a, b) => a - b);

  function advance(t: number): CaptureEvent[] {
    if (deadline === null || t < deadline) return [];
    const at = deadline;
    deadline = null;
    if (held.size < minNotes) return [];
    pending = sorted();
    return [{ kind: "settled", notes: pending, t: at }];
  }

  function commit(t: number): CaptureEvent[] {
    if (!pending) return [];
    const notes = pending;
    pending = null;
    const id = notes.join(",");
    if (id === lastCommitted) return [];
    lastCommitted = id;
    return [{ kind: "committed", notes, t }];
  }

  function push(e: NoteEvent): CaptureEvent[] {
    const out = advance(e.t);
    if (e.type === "noteOn") {
      out.push(...commit(e.t));
      held.add(e.midi);
      deadline = e.t + settleMs;
    } else if (e.type === "noteOff") {
      out.push(...commit(e.t));
      held.delete(e.midi);
    }
    return out;
  }

  return { push, advance, held: sorted };
}

export type ChordCapture = ReturnType<typeof createChordCapture>;
