import { useState } from "react";
import { useCompleteLesson, usePlan, usePostReview } from "../api/client";
import { useManifest } from "../content/useManifest";
import { EXERCISE_COMPONENTS } from "../exercises/registry";
import type { ExerciseOutcome } from "../exercises/types";
import { t } from "../ui/strings";

/** Runs today's plan card by card and posts each review (ARCHITECTURE § 7). */
export function PracticePage() {
  const plan = usePlan();
  const manifest = useManifest();
  const postReview = usePostReview();
  const completeLesson = useCompleteLesson();
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<{ id: string; outcome: ExerciseOutcome } | null>(null);

  if (plan.isPending || manifest.isPending) return <p>{t.practice.loading}</p>;
  if (plan.isError) return <p className="text-red-700">{t.practice.error}: {plan.error.message}</p>;
  if (manifest.isError) return <p className="text-red-700">{manifest.error.message}</p>;

  const items = plan.data.items;
  const mismatch = plan.data.content_version !== manifest.data.version;
  const firstLesson = manifest.data.lessons[0];

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <p>{t.practice.empty}</p>
        {firstLesson && (
          <button
            className="rounded bg-stone-200 px-3 py-1 text-sm"
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
    return (
      <div className="space-y-2">
        <p className="text-2xl font-semibold">{t.practice.done}</p>
        {plan.data.overflow > 0 && <p className="text-stone-600">{t.practice.overflow(plan.data.overflow)}</p>}
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
          setPending(null);
          setIndex((i) => i + 1);
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      {mismatch && <p className="rounded bg-amber-100 p-2 text-sm">{t.practice.contentMismatch}</p>}
      <p className="text-sm text-stone-500">{t.practice.progress(index + 1, items.length)}</p>
      {Exercise && template ? (
        // key = card id: each card gets fresh exercise state.
        <Exercise key={item.card_id} template={template} keyToken={item.key} onSubmit={(o) => save(crypto.randomUUID(), o)} />
      ) : (
        <p className="text-red-700">Unknown template {item.template_id}</p>
      )}
      {postReview.isError && pending && (
        // Retrying reuses the same review id, so the server applies it at most once.
        <button className="rounded bg-red-100 px-3 py-1 text-red-800" onClick={() => save(pending.id, pending.outcome)}>
          {t.practice.saveError}
        </button>
      )}
    </div>
  );
}
