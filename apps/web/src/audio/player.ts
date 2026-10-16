import { create } from "zustand";

/** Notes currently sounding from playback; the on-screen keyboard highlights them. */
export const usePlayback = create<{ notes: number[] }>(() => ({ notes: [] }));

type ToneModule = typeof import("tone");
type Instrument = { triggerAttackRelease(notes: string[], duration: number, time?: number): unknown };

const SAMPLES = "https://tonejs.github.io/audio/salamander/";
let ready: Promise<{ Tone: ToneModule; piano: Instrument }> | null = null;

/** Lazily load Tone.js and the Salamander grand; fall back to a synth if samples fail. */
function load() {
  ready ??= (async () => {
    const Tone = await import("tone");
    await Tone.start();
    const urls: Record<string, string> = {};
    for (let o = 1; o <= 7; o++) {
      for (const [n, f] of [["C", "C"], ["D#", "Ds"], ["F#", "Fs"], ["A", "A"]] as const) urls[`${n}${o}`] = `${f}${o}.mp3`;
    }
    try {
      const sampler = new Tone.Sampler({ urls, baseUrl: SAMPLES, release: 1.2 }).toDestination();
      await Promise.race([Tone.loaded(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000))]);
      return { Tone, piano: sampler };
    } catch {
      return { Tone, piano: new Tone.PolySynth(Tone.Synth).toDestination() };
    }
  })();
  return ready;
}

let token = 0;

/** Play chords one after another (a single chord is a one-element list). */
export async function playChords(chords: number[][], secondsEach = 1.4): Promise<void> {
  const { Tone, piano } = await load();
  const mine = ++token;
  const names = (midi: number[]) => midi.map((m) => Tone.Frequency(m, "midi").toNote());
  for (const chord of chords) {
    if (mine !== token) return; // a newer playback took over
    usePlayback.setState({ notes: chord });
    piano.triggerAttackRelease(names(chord), secondsEach * 0.95);
    await new Promise((r) => setTimeout(r, secondsEach * 1000));
  }
  if (mine === token) usePlayback.setState({ notes: [] });
}

/** Play a single line, note by note. */
export function playLine(notes: number[], bpm = 120): Promise<void> {
  return playChords(notes.map((n) => [n]), 60 / bpm / 2);
}
