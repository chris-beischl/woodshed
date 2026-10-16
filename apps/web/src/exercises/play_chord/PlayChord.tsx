import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createChordCapture, type CaptureEvent } from "../../evaluation/capture";
import { gradeAttempt } from "../../evaluation/grading";
import { requiredCount } from "../../evaluation/match";
import { createProgressionRunner, type RunnerState } from "../../evaluation/runner";
import type { Rating } from "../../evaluation/types";
import { subscribeAll, useInput } from "../../input/store";
import { parseKeyToken } from "../../theory/keys";
import { ChordSymbol, NumeralSymbol } from "../../ui/ChordSymbol";
import { displayDegree, displayKey } from "../../ui/music";
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
      clean: !abandoned && (chord?.correct ?? false) && (chord?.mistakes ?? 0) === 0,
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

  const tone = done ? (chord?.correct ? "correct" : "wrong") : lastResult && !lastResult.correct ? "wrong" : "idle";
  const mistakes = chord?.mistakes ?? 0;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div>
        <p className="condensed text-xl text-paper-dim">{t.exercise.play}</p>
        <div key={done ? "done" : "open"} className={done && chord?.correct ? "stamp origin-left" : ""}>
          {template.prompt.kind === "roman" ? (
            <div className="flex flex-wrap items-end gap-x-8">
              <NumeralSymbol numeral={instance.numeral} quality={instance.spec.quality} tone={tone} className="text-[clamp(7rem,24vw,15rem)]" />
              <span className="condensed pb-[0.15em] text-[clamp(2.5rem,7vw,4.5rem)] leading-none font-bold">
                {t.exercise.in} {displayKey(key)}
              </span>
            </div>
          ) : (
            <ChordSymbol root={instance.spec.root} quality={instance.spec.quality} tone={tone} className="text-[clamp(7rem,24vw,15rem)]" />
          )}
        </div>

        <div className="mt-4 flex min-h-8 items-center gap-4" aria-live="polite">
          <span className="flex gap-1.5" aria-label={t.exercise.mistakes(mistakes)}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-3 w-3 rounded-full border-2 ${i < mistakes ? "border-signal bg-signal" : "border-paper-dim/50"}`} />
            ))}
          </span>
          {lastResult && !lastResult.correct && !done && (
            <span className="text-signal">
              {[
                lastResult.missing.length > 0 && `${t.exercise.missing}: ${lastResult.missing.map(displayDegree).join(", ")}`,
                lastResult.forbidden.length > 0 && `${t.exercise.forbidden}: ${lastResult.forbidden.map(displayDegree).join(", ")}`,
                lastResult.unexpected.length > 0 && `${t.exercise.unexpected}: ${lastResult.unexpected.length}`,
                lastResult.violations.includes("bass") && t.exercise.bassWrong,
              ]
                .filter(Boolean)
                .join(" — ")}
            </span>
          )}
          {done && (
            <span className={`condensed text-2xl font-bold ${chord?.correct ? "text-sage" : "text-signal"}`}>
              {chord?.correct ? (mistakes === 0 ? t.exercise.correct : t.exercise.correctAfter(mistakes)) : t.exercise.failed}
            </span>
          )}
        </div>
      </div>

      {done && computed && (
        <div className="flex flex-col gap-5 md:items-end">
          <div className="rounded-sm bg-paper px-4 pt-2 pb-3 text-night shadow-[6px_6px_0_var(--color-brass)]">
            <Suspense fallback={<div className="h-[170px] w-[286px]" />}>
              <ChordNotation tones={instance.tones} label={t.exercise.answer} />
            </Suspense>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label={t.exercise.rating} className="flex overflow-hidden rounded-full border border-night-3">
              {(["again", "hard", "good", "easy"] as const).map((r) => (
                <button
                  key={r}
                  role="radio"
                  aria-checked={(override ?? computed) === r}
                  onClick={() => setOverride(r)}
                  className={`px-4 py-2 text-sm transition-colors ${(override ?? computed) === r ? "bg-paper text-night" : "text-paper-dim hover:text-paper"}`}
                >
                  {t.ratings[r]}
                </button>
              ))}
            </div>
            <button onClick={submit} autoFocus className="rounded-full bg-brass px-7 py-2.5 font-bold text-night hover:bg-brass-deep">
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
          className="justify-self-start text-sm text-paper-dim underline underline-offset-4 hover:text-paper md:justify-self-end"
        >
          {t.exercise.giveUp}
        </button>
      )}
    </div>
  );
}
