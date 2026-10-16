import { useEffect, useRef } from "react";
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import type { SpelledNote } from "../theory/note";
import { midiOf } from "../theory/pitch";
import { displayNote } from "../ui/music";

const VF_ACCIDENTAL = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" } as const;
const SCALE = 1.2;

/** Octave per note, following the line's MIDI register (the letter owns the octave). */
function octaveOf(n: SpelledNote, midi: number): number {
  for (let o = -1; o <= 9; o++) if (midiOf({ ...n, octave: o }) === midi) return o;
  return 4;
}

/** A monophonic line as quarter notes, one accidental per note (no key signature). */
export function LineNotation({ notes, midi }: { notes: SpelledNote[]; midi: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = 60 + notes.length * 38;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width * SCALE, 120 * SCALE);
    const ctx = renderer.getContext();
    ctx.scale(SCALE, SCALE);
    const stave = new Stave(5, 5, width - 10).addClef("treble");
    stave.setContext(ctx).draw();
    const staveNotes = notes.map((n, i) => {
      const note = new StaveNote({ keys: [`${n.letter.toLowerCase()}${VF_ACCIDENTAL[n.accidental]}/${octaveOf(n, midi[i]!)}`], duration: "q" });
      if (n.accidental !== 0) note.addModifier(new Accidental(VF_ACCIDENTAL[n.accidental]), 0);
      return note;
    });
    const voice = new Voice({ numBeats: notes.length, beatValue: 4 }).addTickables(staveNotes);
    new Formatter().joinVoices([voice]).format([voice], width - 70);
    voice.draw(ctx, stave);
  }, [notes, midi, width]);

  return <div ref={ref} className="max-w-full overflow-x-auto" aria-label={notes.map(displayNote).join(" ")} />;
}
