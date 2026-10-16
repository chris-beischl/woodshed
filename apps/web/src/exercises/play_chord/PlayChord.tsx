import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createChordCapture, type CaptureEvent } from "../../evaluation/capture";
import { gradeAttempt } from "../../evaluation/grading";
import { requiredCount } from "../../evaluation/match";
import { createProgressionRunner, type RunnerState } from "../../evaluation/runner";
import type { Rating } from "../../evaluation/types";
import { subscribeAll, useInput } from "../../input/store";
import { formatKey, parseKeyToken } from "../../theory/keys";
import { t } from "../../ui/strings";
import { playChordParams } from "../schema";
import type { ExerciseProps } from "../types";
import { resolvePlayChord } from "./resolve";

// VexFlow is large and only needed after an attempt.
const ChordNotation = lazy(() => import("../../notation/ChordNotation").then((m) => ({ default: m.ChordNotation })));

export function PlayChord({ template, keyToken, onSubmit }: ExerciseProps) {
  const settleMs = useInput((s) => s.settleMs);
  const key = useMemo(() => parseKeyToken(keyToken, template.mode), [keyToken, template.mode]);
  const instance = useMemo(() => resolvePlayChord(playChordParams.parse(template.params), key), [template.params, key]);

  const [state, setState] = useState<RunnerState | null>(null);
  const [abandoned, setAbandoned] = useState(false);
  const [override, setOverride] = useState<Rating | null>(null);
  const started = useRef(performance.now());
  const finishedAt = useRef<number | null>(null);
  const pedalUsed = useRef(false);

  useEffect(() => {
    started.current = performance.now();
    finishedAt.current = null;
    pedalUsed.current = false;
    setState(null);
    setAbandoned(false);
    setOverride(null);

    const capture = createChordCapture({ settleMs, minNotes: instance.spec.minNotes ?? requiredCount(instance.spec) });
    const runner = createProgressionRunner([instance.spec]);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handle = (events: CaptureEvent[]) => {
      if (events.length === 0) return;
      events.forEach(runner.onCapture);
      const s = runner.state();
      if (s.done && finishedAt.current === null) finishedAt.current = performance.now();
      setState(s);
    };

    const unsubscribe = subscribeAll((e) => {
      if (finishedAt.current !== null) return;
      if (e.type === "sustain" && e.on) pedalUsed.current = true;
      handle(capture.push(e));
      if (e.type === "noteOn") {
        clearTimeout(timer);
        timer = setTimeout(() => handle(capture.advance(e.t + settleMs)), settleMs + 5);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [instance, settleMs]);

  const done = abandoned || (state?.done ?? false);
  const chord = state?.chords[0];
  const durationMs = (finishedAt.current ?? performance.now()) - started.current;
  const computed = done
    ? gradeAttempt({ chords: state?.chords ?? [{ mistakes: 0, failed: true }], durationMs, targetSeconds: template.targetSeconds, abandoned })
    : null;
  const lastResult = chord?.results.at(-1);

  function submit() {
    if (!computed) return;
    onSubmit({
      rating: override ?? computed,
      durationMs: Math.round(durationMs),
      attempts: (chord?.mistakes ?? 0) + (chord?.correct ? 1 : 0),
      details: {
        type: "play_chord",
        key: keyToken,
        symbol: instance.symbol,
        computedRating: computed,
        overridden: override !== null && override !== computed,
        abandoned,
        results: chord?.results ?? [],
        pedalUsed: pedalUsed.current,
        settleMs,
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-stone-500">{t.exercise.play}</p>
        <p className="text-5xl font-semibold tracking-tight">
          {template.prompt.kind === "roman" ? instance.roman : instance.symbol}
        </p>
        {template.prompt.kind === "roman" && <p className="mt-1 text-xl text-stone-600">{t.exercise.in} {formatKey(key)}</p>}
        {(chord?.mistakes ?? 0) > 0 && !done && <p className="mt-2 text-red-600">{t.exercise.mistakes(chord!.mistakes)}</p>}
      </div>

      {lastResult && !lastResult.correct && (
        <div className="mx-auto max-w-md rounded bg-red-50 p-3 text-sm text-red-800">
          {lastResult.missing.length > 0 && <p>{t.exercise.missing}: {lastResult.missing.join(", ")}</p>}
          {lastResult.forbidden.length > 0 && <p>{t.exercise.forbidden}: {lastResult.forbidden.join(", ")}</p>}
          {lastResult.unexpected.length > 0 && <p>{t.exercise.unexpected}: {lastResult.unexpected.length}</p>}
          {lastResult.violations.includes("bass") && <p>{t.exercise.bassWrong}</p>}
        </div>
      )}

      {done && computed && (
        <div className="space-y-4 text-center">
          <p className={`text-2xl font-semibold ${chord?.correct ? "text-green-700" : "text-red-700"}`}>
            {chord?.correct ? t.exercise.correct : t.exercise.failed}
          </p>
          <Suspense fallback={<div className="h-[150px]" />}>
            <ChordNotation tones={instance.tones} label={`${t.exercise.answer} ${instance.symbol}`} />
          </Suspense>
          <div>
            <p className="mb-2 text-sm text-stone-500">{t.exercise.rating}</p>
            <div className="flex justify-center gap-2">
              {(["again", "hard", "good", "easy"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setOverride(r)}
                  className={`rounded px-3 py-1 ${(override ?? computed) === r ? "bg-stone-800 text-white" : "bg-stone-200"}`}
                >
                  {t.ratings[r]}
                </button>
              ))}
            </div>
          </div>
          <button onClick={submit} className="rounded bg-amber-500 px-6 py-2 font-semibold text-white" autoFocus>
            {t.exercise.next}
          </button>
        </div>
      )}

      {!done && (
        <div className="text-center">
          <button
            onClick={() => {
              finishedAt.current = performance.now();
              setAbandoned(true);
            }} className="text-sm text-stone-500 underline">
            {t.exercise.giveUp}
          </button>
        </div>
      )}
    </div>
  );
}
