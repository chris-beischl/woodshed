import { useState } from "react";
import { Link } from "react-router";
import { usePlan, usePostReview, type Plan } from "../progress/client";
import { useManifest } from "../content/useManifest";
import { EXERCISE_COMPONENTS } from "../exercises/registry";
import type { ExerciseOutcome } from "../exercises/types";
import { parseKeyToken } from "../theory/keys";
import { pitchClass } from "../theory/note";
import { KeyCircle, type KeyResult } from "../ui/KeyCircle";
import { t } from "../ui/strings";
import { loc } from "../ui/i18n";

interface CardResult {
  pc: number;
  result: KeyResult;
}

const WORST: KeyResult[] = ["missed", "shaky", "clean"];

function keyMap(results: CardResult[]): Map<number, KeyResult> {
  const map = new Map<number, KeyResult>();
  for (const { pc, result } of results) {
    const prev = map.get(pc);
    if (!prev || WORST.indexOf(result) < WORST.indexOf(prev)) map.set(pc, result);
  }
  return map;
}

/** Runs today's plan card by card and posts each review (ARCHITECTURE § 7). */
export function PracticePage() {
  const plan = usePlan();
  const manifest = useManifest();
  const postReview = usePostReview();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<CardResult[]>([]);
  const [streak, setStreak] = useState(0);
  const [pending, setPending] = useState<ExerciseOutcome | null>(null);

  // Manifest first: the plan waits for it, so a manifest error would otherwise load forever.
  if (manifest.isError) return <p className="text-signal">{manifest.error.message}</p>;
  if (plan.isPending || manifest.isPending) return <p className="text-paper-dim">{t.practice.loading}</p>;
  if (plan.isError) return <p className="text-signal">{t.practice.error}: {plan.error.message}</p>;

  const items = plan.data.items;
  if (items.length === 0) {
    return (
      <div className="max-w-xl space-y-6">
        <h1 className="display text-7xl">{t.practice.empty}</h1>
        {plan.data.next_lesson ? <NextLesson lesson={plan.data.next_lesson} /> : <p className="text-paper-dim">{t.practice.emptyHint}</p>}
      </div>
    );
  }

  if (index >= items.length) {
    const clean = results.filter((r) => r.result === "clean").length;
    return (
      <div className="grid items-center gap-10 md:grid-cols-[auto_minmax(0,1fr)]">
        <KeyCircle results={keyMap(results)} />
        <div className="space-y-3">
          <h1 className="display text-8xl">{t.practice.done}</h1>
          <p className="text-xl">{t.practice.doneSummary(clean, results.length)}</p>
          {plan.data.overflow > 0 && <p className="text-paper-dim">{t.practice.overflow(plan.data.overflow)}</p>}
          {plan.data.next_lesson && <NextLesson lesson={plan.data.next_lesson} />}
        </div>
      </div>
    );
  }

  const item = items[index]!;
  const template = manifest.data.templates.find((tpl) => tpl.id === item.template_id);
  const Exercise = template && EXERCISE_COMPONENTS[template.type];

  function save(outcome: ExerciseOutcome) {
    setPending(outcome);
    postReview.mutate(
      { card_id: item.card_id, rating: outcome.rating, duration_ms: outcome.durationMs, source: "review" },
      {
        onSuccess: () => {
          if (template) {
            const pc = pitchClass(parseKeyToken(item.key, template.mode).tonic);
            const result: KeyResult = outcome.clean ? "clean" : outcome.rating === "again" ? "missed" : "shaky";
            setResults((r) => [...r, { pc, result }]);
          }
          setStreak((s) => (outcome.clean ? s + 1 : 0));
          setPending(null);
          setIndex((i) => i + 1);
        },
      },
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-night-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={index}
          aria-label={t.practice.progress(index + 1, items.length)}
        >
          <div className="h-full bg-brass transition-[width] duration-300" style={{ width: `${(index / items.length) * 100}%` }} />
        </div>
        <span className="condensed text-paper-dim tabular-nums">{t.practice.progress(index + 1, items.length)}</span>
        {streak >= 2 && <span className="condensed rounded-full bg-sage px-3 py-0.5 font-bold text-night">{t.practice.streak(streak)}</span>}
      </div>

      {template && <p className="condensed -mb-6 text-lg text-brass">{loc(template.title)}</p>}
      {Exercise && template ? (
        // key = card id: each card gets fresh exercise state.
        <Exercise key={item.card_id} template={template} keyToken={item.key} onSubmit={save} />
      ) : (
        <p className="text-signal">Unknown template {item.template_id}</p>
      )}

      {postReview.isError && pending && (
        <button className="rounded-full bg-signal px-4 py-2 font-bold text-night" onClick={() => save(pending)}>
          {t.practice.saveError}
        </button>
      )}
    </div>
  );
}

function NextLesson({ lesson }: { lesson: NonNullable<Plan["next_lesson"]> }) {
  return (
    <div className="space-y-2 pt-4">
      <p className="condensed text-lg text-paper-dim">{t.practice.nextLesson}</p>
      <p className="condensed text-3xl font-bold">{loc(lesson.title)}</p>
      <p className="text-paper-dim">{t.course.minutes(lesson.estimatedMinutes)}</p>
      <Link to={`/lektion/${lesson.id}`} className="inline-block rounded-full bg-brass px-6 py-2.5 font-bold text-night hover:bg-brass-deep">
        {t.practice.startLesson}
      </Link>
    </div>
  );
}
