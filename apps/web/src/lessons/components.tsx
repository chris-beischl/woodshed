import { lazy, Suspense, useContext, useMemo, useState, type ReactNode } from "react";
import { usePostReview } from "../progress/client";
import { playChords } from "../audio/player";
import { useManifest } from "../content/useManifest";
import { EXERCISE_COMPONENTS } from "../exercises/registry";
import type { ExerciseOutcome } from "../exercises/types";
import { chordTones } from "../theory/chords";
import { keyToken, parseKeyName, type Mode } from "../theory/keys";
import { midiOf, stackPitches } from "../theory/pitch";
import { resolveRoman } from "../theory/roman";
import { ChordSymbol } from "../ui/ChordSymbol";
import { displayKey, displayNote, displaySuffix } from "../ui/music";
import { t } from "../ui/strings";
import { loc } from "../ui/i18n";
import { SlideContext } from "./SlideDeck";

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
 * update); after each attempt ("Next" on its result) it moves on to the template's next key.
 */
export function Exercise({ id, keyName, startToken, rootPosition }: { id: string; keyName?: string; startToken?: string; rootPosition?: boolean }) {
  const manifest = useManifest();
  const postReview = usePostReview();
  const template = manifest.data?.templates.find((tpl) => tpl.id === id);
  const token0 = startToken ?? (template && keyName ? keyToken(parseKeyName(keyName, template.mode)) : undefined);
  const startIndex = template && token0 ? Math.max(0, template.keys.indexOf(token0)) : 0;
  const [offset, setOffset] = useState(0);
  const { active } = useContext(SlideContext);

  if (!template) return <p className="text-signal">Unknown exercise {id}</p>;
  const Component = EXERCISE_COMPONENTS[template.type];
  const token = template.keys[(startIndex + offset) % template.keys.length]!;

  function submit(o: ExerciseOutcome) {
    // The exercise already showed its result: go straight to the next key.
    setOffset((n) => n + 1);
    postReview.mutate({ card_id: `${template!.id}@${token}`, rating: o.rating, duration_ms: o.durationMs, source: "lesson" });
  }

  return (
    <section className="not-prose my-10 rounded-sm border-2 border-night-3 p-5 sm:p-8">
      <p className="condensed mb-6 text-lg text-brass">{loc(template.title)}</p>
      {/* Off-slide exercises don't listen, so playing only ever answers the visible one. */}
      {!active ? <p className="text-paper-dim">{t.lesson.exerciseWaiting}</p> : <Component key={`${token}#${offset}`} template={template} keyToken={token} onSubmit={submit} rootPosition={rootPosition} />}
    </section>
  );
}

/** Clockwise: one fifth up and one more ♯ (or one ♭ fewer) per step. Display only. */
const CIRCLE = [
  ["C", "0"], ["G", "1♯"], ["D", "2♯"], ["A", "3♯"], ["E", "4♯"], ["B", "5♯"],
  ["F♯ / G♭", "6♯ / 6♭"], ["D♭", "5♭"], ["A♭", "4♭"], ["E♭", "3♭"], ["B♭", "2♭"], ["F", "1♭"],
] as const;

/** The circle of fifths as a clock face; `highlight` marks one position (index from C). */
export function CircleOfFifths({ highlight }: { highlight?: number }) {
  const size = 340;
  const c = size / 2;
  const at = (i: number, radius: number) => {
    const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
    return [c + radius * Math.cos(a), c + radius * Math.sin(a)] as const;
  };
  return (
    <figure className="not-prose my-8 flex justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={t.lesson.circleLabel} className="max-w-full">
        <circle cx={c} cy={c} r={c - 6} fill="var(--color-night-2)" stroke="var(--color-brass)" strokeWidth={3} />
        <circle cx={c} cy={c} r={c * 0.42} fill="none" stroke="var(--color-night-3)" strokeWidth={2} />
        {CIRCLE.map(([key, sig], i) => {
          const [x, y] = at(i, c * 0.72);
          const [sx, sy] = at(i, c * 0.5);
          const on = i === highlight;
          return (
            <g key={key}>
              {on && <circle cx={x} cy={y} r={26} fill="var(--color-brass)" />}
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="condensed" fontWeight={700} fontSize={key.length > 2 ? 15 : 24} fill={on ? "var(--color-night)" : "var(--color-paper)"}>
                {key}
              </text>
              <text x={sx} y={sy} textAnchor="middle" dominantBaseline="central" fontSize={key.length > 2 ? 10 : 13} fill="var(--color-paper-dim)">
                {sig}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export const lessonComponents = { ChordDemo, Callout, Exercise, CircleOfFifths };
