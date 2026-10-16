import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { playLine } from "../../audio/player";
import { gradeAttempt } from "../../evaluation/grading";
import { createLineRunner, nextPitch, type LineState } from "../../evaluation/line";
import type { Rating } from "../../evaluation/types";
import { subscribeAll } from "../../input/store";
import { parseKeyToken } from "../../theory/keys";
import { displayKey, displayNote } from "../../ui/music";
import { t } from "../../ui/strings";
import { playLineParams } from "../schema";
import type { ExerciseProps } from "../types";
import { useAdvance } from "../useAdvance";
import { loadBest, saveBest } from "../chords/best";
import { resolvePlayLine } from "./resolve";

const LineNotation = lazy(() => import("../../notation/LineNotation").then((m) => ({ default: m.LineNotation })));

/** Reference register for notation/playback: start at the tonic around C4. */
function referenceMidi(pcs: number[], contour: (-1 | 0 | 1)[]): number[] {
  const out = [60 + pcs[0]! - (pcs[0]! > 6 ? 12 : 0)];
  for (let i = 1; i < pcs.length; i++) out.push(nextPitch(out[i - 1]!, pcs[i]!, contour[i - 1]!));
  return out;
}

/** Scales and licks (type `play_line`, ARCHITECTURE § 5.5). */
export function PlayLine({ template, keyToken, onSubmit }: ExerciseProps) {
  const key = useMemo(() => parseKeyToken(keyToken, template.mode), [keyToken, template.mode]);
  const instance = useMemo(() => resolvePlayLine(playLineParams.parse(template.params), key), [template.params, key]);
  const reference = useMemo(() => referenceMidi(instance.spec.pcs, instance.spec.contour), [instance]);

  const [state, setState] = useState<LineState | null>(null);
  const [abandoned, setAbandoned] = useState(false);
  const [override, setOverride] = useState<Rating | null>(null);
  const startedAt = useRef<number | null>(null);
  const bestKey = `time:${template.id}@${keyToken}`;
  const [previousBest] = useState(() => loadBest(bestKey));
  const finishedAt = useRef<number | null>(null);

  useEffect(() => {
    startedAt.current = null;
    finishedAt.current = null;
    setState(null);
    setAbandoned(false);
    setOverride(null);
    const runner = createLineRunner(instance.spec);
    return subscribeAll((e) => {
      if (e.type !== "noteOn" || finishedAt.current !== null) return;
      startedAt.current ??= e.t; // the clock starts with the first note
      runner.onNote(e.midi);
      const s = runner.state();
      if (s.done) finishedAt.current = e.t;
      setState(s);
    });
  }, [instance]);

  const total = instance.notes.length;
  const position = state?.position ?? 0;
  const mistakes = state?.mistakes ?? 0;
  const done = abandoned || (state?.done ?? false);
  const success = done && !abandoned && !(state?.failed ?? false);
  const lastWrong = state?.wrong.at(-1);
  const showExpected = !done && lastWrong !== undefined && lastWrong.position === position;
  const durationMs = (finishedAt.current ?? performance.now()) - (startedAt.current ?? performance.now());
  const clean = success && mistakes === 0;
  const seconds = Math.round(durationMs / 100) / 10;
  const newBest = clean && (previousBest === null || seconds < previousBest);
  useEffect(() => {
    if (newBest) saveBest(bestKey, seconds);
  }, [newBest, bestKey, seconds]);
  const computed = done
    ? gradeAttempt({ chords: [{ mistakes, failed: !success }], durationMs, targetSeconds: template.targetSeconds, abandoned })
    : null;

  const advance = useAdvance(clean, () => {
    if (!computed) return;
    onSubmit({
      rating: override ?? computed,
      durationMs: Math.round(durationMs),
      attempts: mistakes + (success ? 1 : 0),
      clean,
      details: {
        type: "play_line",
        key: keyToken,
        computedRating: computed,
        overridden: override !== null && override !== computed,
        abandoned,
        mistakes,
        wrong: state?.wrong ?? [],
        played: state?.played ?? [],
      },
    });
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="condensed text-xl text-paper-dim">{t.exercise.play}</p>
        <p key={success ? "done" : "open"} className={`display text-[clamp(4.5rem,13vw,9rem)] ${success ? "stamp origin-left text-sage" : ""}`}>
          {displayKey(key)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" aria-label={t.line.progress(position, total)}>
        {instance.notes.map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full transition-colors ${i < position ? "bg-sage" : i === position && !done ? "border-2 border-brass" : "border-2 border-night-3"}`}
          />
        ))}
        <span className="condensed ml-3 text-lg text-paper-dim tabular-nums">{t.line.progress(position, total)}</span>
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-4" aria-live="polite">
        <span className="flex gap-1.5" aria-label={t.exercise.mistakes(mistakes)}>
          {Array.from({ length: instance.spec.maxMistakes }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full border-2 ${i < mistakes ? "border-signal bg-signal" : "border-paper-dim/50"}`} />
          ))}
        </span>
        {showExpected && (
          <span className="text-signal">{t.line.expected(displayNote(instance.notes[position]!))}</span>
        )}
        {done && (
          <span className={`condensed text-2xl font-bold ${success ? "text-sage" : "text-signal"}`}>
            {success ? (mistakes === 0 ? t.exercise.correct : t.exercise.correctAfter(mistakes)) : t.exercise.failed}
          </span>
        )}
        {success && (
          <span className="condensed text-xl">
            {t.line.time(seconds.toFixed(1))}
            {newBest && <strong className="ml-2 rounded-full bg-brass px-2.5 py-0.5 text-night">{t.line.newBest}</strong>}
            {!newBest && previousBest !== null && <span className="ml-2 text-paper-dim">{t.line.best(previousBest.toFixed(1))}</span>}
          </span>
        )}
      </div>

      {done && computed && (
        <div className="space-y-5">
          <div className="inline-block max-w-full rounded-sm bg-paper px-3 py-2 text-night shadow-[6px_6px_0_var(--color-brass)]">
            <Suspense fallback={<div className="h-[144px]" />}>
              <LineNotation notes={instance.notes} midi={reference} />
            </Suspense>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => void playLine(reference, 160)} className="rounded-full border border-paper/40 px-4 py-2 text-sm hover:border-paper">
              {t.exercise.listenSolution}
            </button>
            <div role="radiogroup" aria-label={t.exercise.rating} className="flex overflow-hidden rounded-full border border-night-3">
              {(["again", "hard", "good", "easy"] as const).map((r) => (
                <button
                  key={r}
                  role="radio"
                  aria-checked={(override ?? computed) === r}
                  onClick={() => setOverride(r)}
                  className={`px-4 py-2 text-sm ${(override ?? computed) === r ? "bg-paper text-night" : "text-paper-dim hover:text-paper"}`}
                >
                  {t.ratings[r]}
                </button>
              ))}
            </div>
            <button
              autoFocus
              className="rounded-full bg-brass px-7 py-2.5 font-bold text-night hover:bg-brass-deep"
              onClick={advance}
            >
              {t.exercise.next}
            </button>
          </div>
        </div>
      )}

      {!done && (
        <button
          onClick={() => {
            finishedAt.current = performance.now();
            setAbandoned(true);
          }}
          className="text-sm text-paper-dim underline underline-offset-4 hover:text-paper"
        >
          {t.exercise.giveUp}
        </button>
      )}
    </div>
  );
}
