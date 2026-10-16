import { useState } from "react";
import { useCompleteLesson, usePlan, usePostReview } from "../api/client";
import { useManifest } from "../content/useManifest";
import { EXERCISE_COMPONENTS } from "../exercises/registry";
import type { ExerciseOutcome } from "../exercises/types";
import { parseKeyToken } from "../theory/keys";
import { pitchClass } from "../theory/note";
import { KeyCircle, type KeyResult } from "../ui/KeyCircle";
import { t } from "../ui/strings";

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
  const completeLesson = useCompleteLesson();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<CardResult[]>([]);
  const [streak, setStreak] = useState(0);
  const [pending, setPending] = useState<{ id: string; outcome: ExerciseOutcome } | null>(null);

  if (plan.isPending || manifest.isPending) return <p className="text-paper-dim">{t.practice.loading}</p>;
  if (plan.isError) return <p className="text-signal">{t.practice.error}: {plan.error.message}</p>;
  if (manifest.isError) return <p className="text-signal">{manifest.error.message}</p>;

  const items = plan.data.items;
  const mismatch = plan.data.content_version !== manifest.data.version;
  const firstLesson = manifest.data.lessons[0];

  if (items.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="display text-7xl">{t.practice.empty}</h1>
        <p className="text-paper-dim">{t.practice.emptyHint}</p>
        {firstLesson && (
          <button
            className="rounded-full bg-brass px-6 py-2.5 font-bold text-night hover:bg-brass-deep disabled:opacity-50"
            disabled={completeLesson.isPending}
            onClick={() => completeLesson.mutate(firstLesson.id)}
          >
            {t.practice.completeSampleLesson}
          </button>
        )}
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
        </div>
      </div>
    );
  }

  const item = items[index]!;
  const template = manifest.data.templates.find((tpl) => tpl.id === item.template_id);
  const Exercise = template && EXERCISE_COMPONENTS[template.type];

  function save(id: string, outcome: ExerciseOutcome) {
    setPending({ id, outcome });
    postReview.mutate(
      {
        id,
        card_id: item.card_id,
        rating: outcome.rating,
        duration_ms: outcome.durationMs,
        attempts: outcome.attempts,
        details: outcome.details,
        source: "review",
      },
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

      {mismatch && <p className="rounded-sm bg-brass/15 px-3 py-2 text-sm text-brass">{t.practice.contentMismatch}</p>}

      {Exercise && template ? (
        // key = card id: each card gets fresh exercise state.
        <Exercise key={item.card_id} template={template} keyToken={item.key} onSubmit={(o) => save(crypto.randomUUID(), o)} />
      ) : (
        <p className="text-signal">Unknown template {item.template_id}</p>
      )}

      {postReview.isError && pending && (
        // Retrying reuses the same review id, so the server applies it at most once.
        <button className="rounded-full bg-signal px-4 py-2 font-bold text-night" onClick={() => save(pending.id, pending.outcome)}>
          {t.practice.saveError}
        </button>
      )}
    </div>
  );
}
