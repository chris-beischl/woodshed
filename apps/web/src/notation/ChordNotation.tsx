import { useEffect, useRef } from "react";
import { Accidental, Annotation, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import type { SpelledNote } from "../theory/note";
import { stackPitches } from "../theory/pitch";
import { displayNote } from "../ui/music";

const VF_ACCIDENTAL = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" } as const;
const SCALE = 1.3;

/** VexFlow keys for spelled tones stacked upward from `octave`. */
export function stackKeys(tones: SpelledNote[], octave = 4): string[] {
  return stackPitches(tones, octave).map((p) => `${p.letter.toLowerCase()}${VF_ACCIDENTAL[p.accidental]}/${p.octave}`);
}

/** One or more spelled chords as whole notes on a treble staff, each labelled. */
export function ChordNotation({ chords, labels, caption }: { chords: SpelledNote[][]; labels?: string[]; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = 70 + chords.length * 90;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width * SCALE, 130 * SCALE);
    const ctx = renderer.getContext();
    ctx.scale(SCALE, SCALE);
    const stave = new Stave(5, 10, width - 10).addClef("treble");
    stave.setContext(ctx).draw();

    const notes = chords.map((tones, ci) => {
      const note = new StaveNote({ keys: stackKeys(tones), duration: "w" });
      tones.forEach((n, i) => {
        if (n.accidental !== 0) note.addModifier(new Accidental(VF_ACCIDENTAL[n.accidental]), i);
      });
      const label = labels?.[ci];
      if (label) note.addModifier(new Annotation(label).setVerticalJustification(Annotation.VerticalJustify.BOTTOM));
      return note;
    });
    const voice = new Voice({ numBeats: 4 * chords.length, beatValue: 4 }).addTickables(notes);
    new Formatter().joinVoices([voice]).format([voice], width - 80);
    voice.draw(ctx, stave);
  }, [chords, labels, width]);

  return (
    <figure className="inline-block">
      <div ref={ref} aria-label={chords.map((c) => c.map(displayNote).join(" ")).join(", ")} />
      {caption && (
        <figcaption className="condensed text-center text-base">
          {caption}
          {chords.length === 1 && <>: <strong>{chords[0]!.map(displayNote).join("  ")}</strong></>}
        </figcaption>
      )}
    </figure>
  );
}
