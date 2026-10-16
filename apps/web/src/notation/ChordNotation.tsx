import { useEffect, useRef } from "react";
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import { formatNote, letterIndex, type SpelledNote } from "../theory/note";

const VF_ACCIDENTAL = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" } as const;

/** Stack spelled chord tones upward from `octave`, one letter step at a time. */
export function stackKeys(tones: SpelledNote[], octave = 4): string[] {
  let current = octave;
  let prev = -1;
  return tones.map((n) => {
    const li = letterIndex(n.letter);
    if (prev !== -1 && li <= prev) current++;
    prev = li;
    return `${n.letter.toLowerCase()}${VF_ACCIDENTAL[n.accidental]}/${current}`;
  });
}

/** Renders a spelled chord as a whole-note chord on a treble staff. */
export function ChordNotation({ tones, label }: { tones: SpelledNote[]; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(220, 150);
    const ctx = renderer.getContext();
    const stave = new Stave(10, 20, 200).addClef("treble");
    stave.setContext(ctx).draw();

    const note = new StaveNote({ keys: stackKeys(tones), duration: "w" });
    tones.forEach((n, i) => {
      if (n.accidental !== 0) note.addModifier(new Accidental(VF_ACCIDENTAL[n.accidental]), i);
    });
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note]);
    new Formatter().joinVoices([voice]).format([voice], 150);
    voice.draw(ctx, stave);
  }, [tones]);

  return (
    <figure className="inline-block">
      <div ref={ref} aria-label={tones.map(formatNote).join(" ")} />
      {label && <figcaption className="text-center text-sm text-stone-600">{label}: {tones.map(formatNote).join(" – ")}</figcaption>}
    </figure>
  );
}
