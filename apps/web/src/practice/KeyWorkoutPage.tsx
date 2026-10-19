import { useState } from "react";
import { useManifest } from "../content/useManifest";
import { EXERCISE_COMPONENTS } from "../exercises/registry";
import type { ExerciseOutcome } from "../exercises/types";
import { usePostReview } from "../progress/client";
import { keysInIntroOrder, keyToken, parseKeyToken } from "../theory/keys";
import { pitchClass } from "../theory/note";
import { loc } from "../ui/i18n";
import { KeyCircle, type KeyResult } from "../ui/KeyCircle";
import { displayKey, displayNote } from "../ui/music";
import { t } from "../ui/strings";

/**
 * One key, many angles: head first (degrees), then fingers (scales), chords, progressions.
 * Templates missing from the manifest or not offered in the key are skipped.
 */
export const WORKOUT = [
  "scale-degree-note",
  "scale-note-degree",
  "scale-major",
  "scale-major-pentatonic",
  "triads-major",
  "diatonic-triads-ladder",
  "dominant-seventh-roman",
  "cadence-i-iv-v-i",
  "ii-v-i-major",
  "turnaround-i-vi-ii-v",
  "pop-i-v-vi-iv",
  "blues-changes",
];

const KEYS = keysInIntroOrder("major").map(keyToken);

function randomKey(exclude: string | null, done: ReadonlySet<string>): string {
  const fresh = KEYS.filter((k) => k !== exclude && !done.has(k));
  const pool = fresh.length > 0 ? fresh : KEYS.filter((k) => k !== exclude);
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function KeyWorkoutPage() {
  const manifest = useManifest();
  const postReview = usePostReview();
  const [key, setKey] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [clean, setClean] = useState(0);
  // Keys finished this session, coloured on the circle like the daily summary.
  const [finished, setFinished] = useState(new Map<string, KeyResult>());

  if (manifest.isPending) return <p className="text-paper-dim">{t.practice.loading}</p>;
  if (manifest.isError) return <p className="text-signal">{manifest.error.message}</p>;

  const start = (k: string) => {
    setKey(k);
    setStep(0);
    setClean(0);
  };
  const circle = new Map([...finished].map(([k, r]) => [pitchClass(parseKeyToken(k, "major").tonic), r]));
  const picker = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.free.startKey}>
      <button onClick={() => start(randomKey(key, new Set(finished.keys())))} className="rounded-full bg-brass px-5 py-2 font-bold text-night hover:bg-brass-deep">
        🎲 {t.workout.random}
      </button>
      {KEYS.map((k) => (
        <button key={k} onClick={() => start(k)} className={`rounded-full border px-3 py-1 text-sm ${finished.has(k) ? "border-sage" : "border-night-3"} hover:border-paper`}>
          {displayNote(parseKeyToken(k, "major").tonic)}
        </button>
      ))}
    </div>
  );

  if (key === null) {
    return (
      <div className="max-w-3xl space-y-8">
        <h1 className="display text-7xl">{t.workout.title}</h1>
        <p className="text-lg text-paper-dim">{t.workout.intro}</p>
        {picker}
      </div>
    );
  }

  const musicKey = parseKeyToken(key, "major");
  const steps = WORKOUT.map((id) => manifest.data.templates.find((tpl) => tpl.id === id)).filter(
    (tpl) => tpl !== undefined && !tpl.deprecated && tpl.keys.includes(key),
  );

  if (step >= steps.length) {
    return (
      <div className="grid items-center gap-10 md:grid-cols-[auto_minmax(0,1fr)]">
        <KeyCircle results={circle} />
        <div className="space-y-5">
          <h1 className="display text-7xl">{t.workout.done(displayKey(musicKey))}</h1>
          <p className="text-xl">{t.workout.summary(clean, steps.length)}</p>
          {picker}
        </div>
      </div>
    );
  }

  const template = steps[step]!;
  const Exercise = EXERCISE_COMPONENTS[template.type];

  function submit(o: ExerciseOutcome) {
    postReview.mutate({ card_id: `${template.id}@${key}`, rating: o.rating, duration_ms: o.durationMs, source: "lesson" });
    const cleanNow = clean + (o.clean ? 1 : 0);
    setClean(cleanNow);
    if (step + 1 >= steps.length) {
      const result: KeyResult = cleanNow === steps.length ? "clean" : cleanNow >= steps.length / 2 ? "shaky" : "missed";
      setFinished((m) => new Map(m).set(key!, result));
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="display text-5xl text-brass">{displayKey(musicKey)}</h1>
        <span className="condensed text-lg text-paper-dim tabular-nums">{t.workout.step(step + 1, steps.length)}</span>
        <button onClick={() => setKey(null)} className="ml-auto text-sm text-paper-dim underline underline-offset-4 hover:text-paper">
          {t.workout.otherKey}
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-night-2" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={step}>
        <div className="h-full bg-brass transition-[width] duration-300" style={{ width: `${(step / steps.length) * 100}%` }} />
      </div>
      <p className="condensed -mb-4 text-lg text-brass">{loc(template.title)}</p>
      {/* key = step: every exercise starts fresh. */}
      <Exercise key={`${key}#${step}`} template={template} keyToken={key} onSubmit={submit} />
    </div>
  );
}
