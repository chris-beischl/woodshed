import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { playChords } from "../../audio/player";
import { createChordCapture, type CaptureEvent } from "../../evaluation/capture";
import { gradeAttempt } from "../../evaluation/grading";
import { requiredCount } from "../../evaluation/match";
import { createProgressionRunner, type RunnerState } from "../../evaluation/runner";
import type { Rating } from "../../evaluation/types";
import { totalMovement } from "../../evaluation/voiceLeading";
import { subscribeAll, useInput } from "../../input/store";
import type { Key } from "../../theory/keys";
import { midiOf, stackPitches } from "../../theory/pitch";
import { ChordSymbol, NumeralSymbol } from "../../ui/ChordSymbol";
import { displayDegree, displayKey, displayNote, displaySuffix } from "../../ui/music";
import { t } from "../../ui/strings";
import type { PlayChordInstance } from "../play_chord/resolve";
import type { ManifestTemplate } from "../schema";
import type { ExerciseOutcome } from "../types";
import { useAdvance, usePedal } from "../useAdvance";
import { loadBest, saveBest } from "./best";

// VexFlow is large and only needed after an attempt.
const ChordNotation = lazy(() => import("../../notation/ChordNotation").then((m) => ({ default: m.ChordNotation })));

type Tone = "idle" | "correct" | "wrong";

interface Props {
  template: ManifestTemplate;
  keyToken: string;
  musicKey: Key;
  chords: PlayChordInstance[];
  maxAttemptsPerChord?: number;
  onSubmit(outcome: ExerciseOutcome): void;
}

/** Plays one chord or a progression: shared by play_chord and play_progression. */
export function ChordRun({ template, keyToken, musicKey, chords, maxAttemptsPerChord = 3, onSubmit }: Props) {
  const settleMs = useInput((s) => s.settleMs);
  const [state, setState] = useState<RunnerState | null>(null);
  const [abandoned, setAbandoned] = useState(false);
  const [override, setOverride] = useState<Rating | null>(null);
  const started = useRef(performance.now());
  const finishedAt = useRef<number | null>(null);
  const pedalUsed = useRef(false);
  const progression = chords.length > 1;
  const bestKey = `${template.id}@${keyToken}`;
  const [previousBest] = useState(() => loadBest(bestKey));

  useEffect(() => {
    started.current = performance.now();
    finishedAt.current = null;
    pedalUsed.current = false;
    setState(null);
    setAbandoned(false);
    setOverride(null);

    const minNotes = Math.min(...chords.map((c) => c.spec.minNotes ?? requiredCount(c.spec)));
    const capture = createChordCapture({ settleMs, minNotes });
    const runner = createProgressionRunner(chords.map((c) => c.spec), { maxAttemptsPerChord });
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
  }, [chords, settleMs, maxAttemptsPerChord]);

  const done = abandoned || (state?.done ?? false);
  const index = state?.index ?? 0;
  const progress = state?.chords ?? chords.map(() => ({ mistakes: 0, failed: false, correct: false, results: [] }));
  const current = progress[Math.min(index, chords.length - 1)]!;
  const lastResult = current.results.at(-1);
  const durationMs = (finishedAt.current ?? performance.now()) - started.current;
  const allCorrect = progress.every((c) => c.correct);
  const totalMistakes = progress.reduce((n, c) => n + c.mistakes, 0);
  const computed = done ? gradeAttempt({ chords: progress, durationMs, targetSeconds: template.targetSeconds, abandoned }) : null;

  // What the player actually voiced, per chord (the matching settled chord).
  const voicings = useMemo(
    () => progress.map((c) => (c.correct ? c.results.at(-1)!.played.map((p) => p.midi) : null)),
    [progress],
  );
  const movement = progression && allCorrect ? totalMovement(voicings as number[][]) : null;
  const newBest = movement !== null && (previousBest === null || movement < previousBest);
  useEffect(() => {
    if (done && newBest && movement !== null) saveBest(bestKey, movement);
  }, [done, newBest, movement, bestKey]);

  const solution = useMemo(() => chords.map((c) => stackPitches(c.tones, 3).map(midiOf)), [chords]);
  const labels = useMemo(() => chords.map((c) => displayNote(c.spec.root) + displaySuffix(c.spec.quality)), [chords]);

  function toneOf(i: number): Tone {
    const c = progress[i]!;
    if (c.correct) return "correct";
    if (c.failed || (i === index && done && !c.correct)) return "wrong";
    return "idle";
  }

  const clean = done && !abandoned && allCorrect && totalMistakes === 0;
  const advance = useAdvance(clean, submit);
  const giveUp = () => {
    finishedAt.current = performance.now();
    setAbandoned(true);
  };
  usePedal(done ? advance : giveUp);

  function submit() {
    if (!computed) return;
    onSubmit({
      rating: override ?? computed,
      durationMs: Math.round(durationMs),
      attempts: totalMistakes + progress.filter((c) => c.correct).length,
      clean,
      details: {
        type: template.type,
        key: keyToken,
        chords: chords.map((c) => c.symbol),
        computedRating: computed,
        overridden: override !== null && override !== computed,
        abandoned,
        results: progress.map((c) => c.results),
        voicings,
        movement,
        pedalUsed: pedalUsed.current,
        settleMs,
      },
    });
  }

  const size = progression ? "text-[clamp(3.5rem,10vw,7.5rem)]" : "text-[clamp(7rem,24vw,15rem)]";
  const symbols = chords.map((c, i) => {
    const tone = toneOf(i);
    const dim = progression && !done && i > index ? "opacity-30" : "";
    const active = progression && !done && i === index ? "underline decoration-brass decoration-[0.06em] underline-offset-[0.12em]" : "";
    return (
      <span key={i} className={`${dim} ${active}`}>
        {template.prompt.kind === "roman" ? (
          <NumeralSymbol numeral={c.numeral} quality={c.spec.quality} tone={tone} className={size} />
        ) : (
          <ChordSymbol root={c.spec.root} quality={c.spec.quality} tone={tone} className={size} />
        )}
      </span>
    );
  });

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div>
        <p className="condensed text-xl text-paper-dim">{t.exercise.play}</p>
        <div key={done ? "done" : "open"} className={done && allCorrect ? "stamp origin-left" : ""}>
          <div className={`flex flex-wrap items-end ${progression ? "gap-x-6 gap-y-2" : "gap-x-8"}`}>
            {symbols}
            {template.prompt.kind === "roman" && (
              <span className="condensed pb-[0.15em] text-[clamp(2rem,6vw,4.5rem)] leading-none font-bold">
                {t.exercise.in} {displayKey(musicKey)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex min-h-8 flex-wrap items-center gap-4" aria-live="polite">
          <span className="flex gap-1.5" aria-label={t.exercise.mistakes(current.mistakes)}>
            {Array.from({ length: maxAttemptsPerChord }, (_, i) => (
              <span key={i} className={`h-3 w-3 rounded-full border-2 ${i < current.mistakes ? "border-signal bg-signal" : "border-paper-dim/50"}`} />
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
            <span className={`condensed text-2xl font-bold ${allCorrect ? "text-sage" : "text-signal"}`}>
              {allCorrect ? (totalMistakes === 0 ? t.exercise.correct : t.exercise.correctAfter(totalMistakes)) : t.exercise.failed}
            </span>
          )}
          {done && progression && allCorrect && movement === null && (
            <span className="text-paper-dim">{t.exercise.movementUnavailable}</span>
          )}
          {done && movement !== null && (
            <span className="condensed text-xl">
              {t.exercise.movement(movement)}
              {newBest && <strong className="ml-2 rounded-full bg-brass px-2.5 py-0.5 text-night">{t.exercise.newBest}</strong>}
              {!newBest && previousBest !== null && <span className="ml-2 text-paper-dim">{t.exercise.best(previousBest)}</span>}
            </span>
          )}
        </div>
      </div>

      {done && computed && (
        <div className="flex flex-col gap-5 md:items-end">
          <div className="rounded-sm bg-paper px-4 pt-2 pb-3 text-night shadow-[6px_6px_0_var(--color-brass)]">
            <Suspense fallback={<div className="h-[170px] w-[286px]" />}>
              <ChordNotation chords={chords.map((c) => c.tones)} labels={progression ? labels : undefined} caption={t.exercise.answer} />
            </Suspense>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void playChords(allCorrect ? (voicings as number[][]) : solution)}
              className="rounded-full border border-paper/40 px-4 py-2 text-sm hover:border-paper"
            >
              {allCorrect ? t.exercise.listenYours : t.exercise.listenSolution}
            </button>
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
            <button onClick={advance} autoFocus className="rounded-full bg-brass px-7 py-2.5 font-bold text-night hover:bg-brass-deep">
              {t.exercise.next}
            </button>
          </div>
        </div>
      )}

      {!done && (
        <button
          onClick={giveUp}
          className="justify-self-start text-sm text-paper-dim underline underline-offset-4 hover:text-paper md:justify-self-end"
        >
          {t.exercise.giveUp}
        </button>
      )}
    </div>
  );
}
