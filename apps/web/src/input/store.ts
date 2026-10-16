import { create } from "zustand";
import { DEFAULT_SETTLE_MS } from "../evaluation/capture";
import { listMidiInputs, ReplayInputSource, VirtualKeyboardInputSource, WebMidiInputSource } from "./sources";
import type { InputSource, NoteEvent } from "./types";
import { t } from "../ui/strings";

const LAST_DEVICE = "woodshed.midiDevice";
const SETTLE = "woodshed.settleMs";

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: setting just isn't remembered */
  }
}

export const virtualKeyboard = new VirtualKeyboardInputSource();
export const replaySource = new ReplayInputSource();

interface InputState {
  midiSources: WebMidiInputSource[];
  midiError: string | null;
  selectedMidi: string | null;
  selectMidi(id: string): void;
  held: number[];
  sustain: boolean;
  settleMs: number;
  connectMidi(): Promise<void>;
  setSettleMs(ms: number): void;
}

/** All sources feed one stream; evaluation never knows where notes came from. */
const listeners = new Set<(e: NoteEvent) => void>();
export function subscribeAll(handler: (e: NoteEvent) => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export const useInput = create<InputState>((set, get) => {
  function attach(source: InputSource) {
    source.subscribe((e) => {
      if (source instanceof WebMidiInputSource && source.id !== get().selectedMidi) return;
      if (e.type === "noteOn") set({ held: [...new Set([...get().held, e.midi])].sort((a, b) => a - b) });
      if (e.type === "noteOff") set({ held: get().held.filter((m) => m !== e.midi) });
      if (e.type === "sustain") set({ sustain: e.on });
      for (const l of listeners) l(e);
    });
  }
  attach(virtualKeyboard);
  attach(replaySource);

  return {
    midiSources: [],
    midiError: null,
    selectedMidi: load(LAST_DEVICE),
    selectMidi(id) {
      save(LAST_DEVICE, id);
      set({ selectedMidi: id, held: [] });
    },
    held: [],
    sustain: false,
    settleMs: Number(load(SETTLE)) || DEFAULT_SETTLE_MS,
    async connectMidi() {
      try {
        const inputs = await listMidiInputs();
        if (inputs.length === 0 && !("requestMIDIAccess" in navigator)) {
          set({ midiError: t.input.noWebMidi });
          return;
        }
        get().midiSources.forEach((s) => s.close());
        const sources = inputs.map((p) => new WebMidiInputSource(p));
        sources.forEach(attach);
        const remembered = sources.find((s) => s.id === get().selectedMidi);
        set({ midiSources: sources, midiError: null, selectedMidi: remembered?.id ?? sources[0]?.id ?? null });
      } catch (e) {
        set({ midiError: e instanceof Error ? e.message : String(e) });
      }
    },
    setSettleMs(ms) {
      save(SETTLE, String(ms));
      set({ settleMs: ms });
    },
  };
});
