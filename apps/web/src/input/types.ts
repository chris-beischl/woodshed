/** ARCHITECTURE § 2. `t` is in ms on a monotonic clock (DOMHighResTimeStamp). */
export type NoteEvent =
  | { type: "noteOn"; midi: number; velocity: number; t: number }
  | { type: "noteOff"; midi: number; t: number }
  | { type: "sustain"; on: boolean; t: number }; // CC64

export interface InputSource {
  id: string;
  label: string;
  subscribe(handler: (e: NoteEvent) => void): () => void;
}
