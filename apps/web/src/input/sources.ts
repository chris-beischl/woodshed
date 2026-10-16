import type { InputSource, NoteEvent } from "./types";

type Handler = (e: NoteEvent) => void;

/** Fan-out helper shared by all sources. */
class Emitter {
  private handlers = new Set<Handler>();
  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  emit(e: NoteEvent): void {
    for (const h of this.handlers) h(e);
  }
}

/** Decode a raw MIDI message. Note-on with velocity 0 is a note-off. */
export function decodeMidi(data: Uint8Array, t: number): NoteEvent | null {
  const [status = 0, d1 = 0, d2 = 0] = data;
  const kind = status & 0xf0;
  if (kind === 0x90 && d2 > 0) return { type: "noteOn", midi: d1, velocity: d2, t };
  if (kind === 0x80 || (kind === 0x90 && d2 === 0)) return { type: "noteOff", midi: d1, t };
  if (kind === 0xb0 && d1 === 64) return { type: "sustain", on: d2 >= 64, t };
  return null;
}

export class WebMidiInputSource implements InputSource {
  private emitter = new Emitter();
  private listener = (e: MIDIMessageEvent) => {
    const event = e.data && decodeMidi(e.data, e.timeStamp);
    if (event) this.emitter.emit(event);
  };

  constructor(private readonly port: MIDIInput) {
    port.addEventListener("midimessage", this.listener);
  }

  get id() {
    return `midi:${this.port.id}`;
  }
  get label() {
    return this.port.name ?? "MIDI";
  }
  subscribe(handler: Handler) {
    return this.emitter.subscribe(handler);
  }
  close() {
    this.port.removeEventListener("midimessage", this.listener);
  }
}

export async function listMidiInputs(): Promise<MIDIInput[]> {
  if (!("requestMIDIAccess" in navigator)) return [];
  const access = await navigator.requestMIDIAccess();
  return [...access.inputs.values()];
}

/** On-screen and computer-keyboard input; `press`/`release` are called by the UI. */
export class VirtualKeyboardInputSource implements InputSource {
  readonly id = "virtual";
  readonly label = "Virtuelle Tastatur";
  private emitter = new Emitter();
  subscribe(handler: Handler) {
    return this.emitter.subscribe(handler);
  }
  press(midi: number) {
    this.emitter.emit({ type: "noteOn", midi, velocity: 80, t: performance.now() });
  }
  release(midi: number) {
    this.emitter.emit({ type: "noteOff", midi, t: performance.now() });
  }
}

/** Replays a recorded NoteEvent array with its original relative timing. */
export class ReplayInputSource implements InputSource {
  readonly id = "replay";
  readonly label = "Wiedergabe";
  private emitter = new Emitter();
  subscribe(handler: Handler) {
    return this.emitter.subscribe(handler);
  }
  play(events: NoteEvent[]): () => void {
    const t0 = events[0]?.t ?? 0;
    const start = performance.now();
    const timers = events.map((e) =>
      setTimeout(() => this.emitter.emit({ ...e, t: start + (e.t - t0) }), e.t - t0),
    );
    return () => timers.forEach(clearTimeout);
  }
}

/** Dev recorder: capture real sessions as JSON fixtures (src/input/fixtures/). */
export function createRecorder(subscribe: InputSource["subscribe"]) {
  const events: NoteEvent[] = [];
  const stop = subscribe((e) => events.push(e));
  return { stop: () => (stop(), events) };
}
