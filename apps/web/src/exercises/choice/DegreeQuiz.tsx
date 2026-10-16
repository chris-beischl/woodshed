import { useEffect, useMemo, useRef, useState } from "react";
import { gradeQuiz } from "../../evaluation/grading";
import type { Rating } from "../../evaluation/types";
import { parseKeyToken } from "../../theory/keys";
import { sameNote } from "../../theory/note";
import { displayKey, displayNote } from "../../ui/music";
import { t } from "../../ui/strings";
import { choiceParams } from "../schema";
import type { ExerciseProps } from "../types";
import { useAdvance } from "../useAdvance";
import { makeQuiz, seededRandom, type Question } from "./quiz";

function isCorrect(q: Question, option: number): boolean {
  return q.ask === "degree_note" ? sameNote(q.options[option]!, q.answer) : q.options[option] === q.answer;
}

function optionLabel(q: Question, i: number): string {
  return q.ask === "degree_note" ? displayNote(q.options[i]!) : t.quiz.degree(q.options[i]!);
}

/** Speed round of scale-degree questions (type `choice`). */
export function DegreeQuiz({ template, keyToken, onSubmit }: ExerciseProps) {
  const key = useMemo(() => parseKeyToken(keyToken, template.mode), [keyToken, template.mode]);
  const params = useMemo(() => choiceParams.parse(template.params), [template.params]);
  // Randomness lives here, at the edge; the generator itself is pure and seeded.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const questions = useMemo(
    () => makeQuiz(key, params.ask, params.degrees, params.rounds, seededRandom(seed)),
    [key, params, seed],
  );

  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [override, setOverride] = useState<Rating | null>(null);
  const started = useRef(performance.now());
  const finishedAt = useRef<number | null>(null);
  const done = index >= questions.length;
  const q = questions[Math.min(index, questions.length - 1)]!;

  function answer(option: number) {
    if (picked !== null || done) return;
    setPicked(option);
    const right = isCorrect(q, option);
    if (!right) setMistakes((m) => m + 1);
    setCombo((c) => (right ? c + 1 : 0));
    setTimeout(
      () => {
        setPicked(null);
        setIndex((i) => {
          if (i + 1 >= questions.length) finishedAt.current = performance.now();
          return i + 1;
        });
      },
      right ? 450 : 1300, // a wrong answer stays up long enough to read the right one
    );
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) answer(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const durationMs = (finishedAt.current ?? performance.now()) - started.current;
  const computed = done ? gradeQuiz({ mistakes, rounds: questions.length, durationMs, targetSeconds: template.targetSeconds }) : null;
  const advance = useAdvance(done && mistakes === 0, () => {
    if (!computed) return;
    onSubmit({
      rating: override ?? computed,
      durationMs: Math.round(durationMs),
      attempts: questions.length,
      clean: mistakes === 0,
      details: { type: "choice", key: keyToken, ask: params.ask, seed, mistakes, rounds: questions.length, computedRating: computed },
    });
  });

  if (done && computed) {
    return (
      <div className="space-y-6">
        <p className="display stamp origin-left text-[clamp(5rem,16vw,10rem)] text-sage">
          {questions.length - mistakes}/{questions.length}
        </p>
        <p className="condensed text-2xl">{t.quiz.summary(Math.round(durationMs / 1000))}</p>
        <div className="flex flex-wrap items-center gap-3">
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
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-baseline gap-4 text-paper-dim">
        <span className="condensed text-xl tabular-nums">{t.quiz.round(index + 1, questions.length)}</span>
        {combo >= 3 && <span className="condensed rounded-full bg-sage px-3 py-0.5 font-bold text-night">{t.quiz.combo(combo)}</span>}
      </div>
      <div>
        <p className="condensed text-2xl text-paper-dim">{q.ask === "degree_note" ? t.quiz.whichNote : t.quiz.whichDegree}</p>
        <p className="flex flex-wrap items-end gap-x-6">
          <span className="display text-[clamp(5rem,16vw,10rem)]">{q.ask === "degree_note" ? t.quiz.degree(q.degree) : displayNote(q.note)}</span>
          <span className="condensed pb-[0.2em] text-[clamp(2rem,6vw,4rem)] leading-none font-bold">
            {t.exercise.in} {displayKey(key)}
          </span>
        </p>
      </div>
      <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {q.options.map((_, i) => {
          const right = isCorrect(q, i);
          const state = picked === null ? "idle" : right ? "right" : picked === i ? "wrong" : "idle";
          return (
            <button
              key={i}
              onClick={() => answer(i)}
              className={`condensed rounded-md border-2 py-4 text-4xl font-bold transition-colors ${
                state === "right"
                  ? "border-sage bg-sage text-night"
                  : state === "wrong"
                    ? "border-signal bg-signal text-night"
                    : "border-night-3 bg-night-2 hover:border-paper-dim"
              }`}
            >
              <span className="mr-2 align-top text-sm text-paper-dim">{i + 1}</span>
              {optionLabel(q, i)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
