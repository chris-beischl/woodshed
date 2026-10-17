import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { usePostReview } from "../progress/client";
import { playChords } from "../audio/player";
import { useManifest } from "../content/useManifest";
import { EXERCISE_COMPONENTS } from "../exercises/registry";
import { useInput } from "../input/store";
import { usePedal } from "../exercises/useAdvance";
import type { ExerciseOutcome } from "../exercises/types";
import { chordTones } from "../theory/chords";
import { keyToken, parseKeyName, type Mode } from "../theory/keys";
import { midiOf, stackPitches } from "../theory/pitch";
import { resolveRoman } from "../theory/roman";
import { ChordSymbol } from "../ui/ChordSymbol";
import { displayKey, displayNote, displaySuffix } from "../ui/music";
import { t } from "../ui/strings";
import { loc } from "../ui/i18n";

const ChordNotation = lazy(() => import("../notation/ChordNotation").then((m) => ({ default: m.ChordNotation })));

function useChords(progression: string[], keyName: string, mode: Mode) {
  return useMemo(() => {
    const key = parseKeyName(keyName, mode);
    const chords = progression.map((rn) => resolveRoman(key, rn));
    return { key, chords, tones: chords.map((c) => chordTones(c.root, c.quality)) };
  }, [progression, keyName, mode]);
}

/** Chord(s) with notation and a play button. `chords` are roman numerals in `keyName`. */
export function ChordDemo({ chords: progression, keyName = "C", mode = "major", octave = 4, caption }: {
  chords: string[];
  keyName?: string;
  mode?: Mode;
  octave?: number;
  caption?: string;
}) {
  const { key, chords, tones } = useChords(progression, keyName, mode);
  const midi = tones.map((tt) => stackPitches(tt, octave).map(midiOf));
  return (
    <figure className="not-prose my-8 flex flex-wrap items-center gap-6 rounded-sm border-l-4 border-brass bg-night-2 p-5">
      <div className="flex flex-wrap items-end gap-x-5">
        {chords.map((c, i) => (
          <ChordSymbol key={i} root={c.root} quality={c.quality} className="text-6xl" />
        ))}
      </div>
      <div className="rounded-sm bg-paper px-2 text-night">
        <Suspense fallback={<div className="h-[170px] w-[200px]" />}>
          <ChordNotation chords={tones} labels={chords.map((c) => displayNote(c.root) + displaySuffix(c.quality))} />
        </Suspense>
      </div>
      <div className="space-y-2">
        <button onClick={() => void playChords(midi)} className="rounded-full bg-brass px-5 py-2 font-bold text-night hover:bg-brass-deep">
          ▶ {t.lesson.listen}
        </button>
        <figcaption className="text-sm text-paper-dim">{caption ?? displayKey(key)}</figcaption>
      </div>
    </figure>
  );
}

/** A short highlighted note inside a lesson. */
export function Callout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <aside className="not-prose my-6 rounded-sm bg-paper px-5 py-4 text-night">
      {title && <p className="condensed mb-1 text-lg font-bold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </aside>
  );
}

/**
 * An exercise template inline. Attempts are logged with source "lesson" (no FSRS
 * update); "Nächste Tonart" walks through the template's keys.
 */
export function Exercise({ id, keyName, startToken, rootPosition }: { id: string; keyName?: string; startToken?: string; rootPosition?: boolean }) {
  const manifest = useManifest();
  const postReview = usePostReview();
  const template = manifest.data?.templates.find((tpl) => tpl.id === id);
  const token0 = startToken ?? (template && keyName ? keyToken(parseKeyName(keyName, template.mode)) : undefined);
  const startIndex = template && token0 ? Math.max(0, template.keys.indexOf(token0)) : 0;
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<ExerciseOutcome | null>(null);
  const rapidFire = useInput((s) => s.rapidFire);
  const nextKey = () => {
    setResult(null);
    setOffset((o) => o + 1);
  };
  usePedal(result ? nextKey : null);

  if (!template) return <p className="text-signal">Unknown exercise {id}</p>;
  const Component = EXERCISE_COMPONENTS[template.type];
  const token = template.keys[(startIndex + offset) % template.keys.length]!;

  function submit(o: ExerciseOutcome) {
    // Rapid fire: the exercise already showed its result, go straight to the next key.
    if (rapidFire && o.clean) setOffset((n) => n + 1);
    else setResult(o);
    postReview.mutate({ card_id: `${template!.id}@${token}`, rating: o.rating, duration_ms: o.durationMs, source: "lesson" });
  }

  return (
    <section className="not-prose my-10 rounded-sm border-2 border-night-3 p-5 sm:p-8">
      <p className="condensed mb-6 text-lg text-brass">{loc(template.title)}</p>
      {result ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className={`condensed text-3xl font-bold ${result.clean ? "text-sage" : "text-paper"}`}>
            {result.clean ? t.exercise.correct : t.ratings[result.rating]}
          </p>
          <button
            autoFocus
            onClick={nextKey}
            className="rounded-full bg-brass px-6 py-2 font-bold text-night hover:bg-brass-deep"
          >
            {t.lesson.nextKey}
          </button>
        </div>
      ) : (
        <Component key={`${token}#${offset}`} template={template} keyToken={token} onSubmit={submit} rootPosition={rootPosition} />
      )}
    </section>
  );
}

export const lessonComponents = { ChordDemo, Callout, Exercise };
