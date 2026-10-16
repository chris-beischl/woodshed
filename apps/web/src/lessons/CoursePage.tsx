import { Link } from "react-router";
import { useProgress } from "../api/client";
import { useManifest } from "../content/useManifest";
import { t } from "../ui/strings";

/** Course overview: units in order, lessons with their status. */
export function CoursePage() {
  const manifest = useManifest();
  const progress = useProgress();
  if (manifest.isPending) return <p className="text-paper-dim">{t.practice.loading}</p>;
  if (manifest.isError) return <p className="text-signal">{manifest.error.message}</p>;

  const completed = new Set(progress.data?.completed_lessons ?? []);
  const lessons = manifest.data.lessons.filter((l) => !l.hidden);
  const units = [...new Set(lessons.map((l) => l.unit))].sort((a, b) => a - b);

  return (
    <div className="space-y-14">
      <h1 className="display text-7xl">{t.course.title}</h1>
      {units.map((unit) => (
        <section key={unit} className="grid gap-6 md:grid-cols-[9rem_minmax(0,1fr)]">
          <div>
            <p className="display text-[7rem] text-brass">{unit}</p>
            <p className="condensed text-xl font-bold">{t.course.units[unit - 1]}</p>
          </div>
          <ol className="divide-y divide-night-3 border-y border-night-3">
            {lessons
              .filter((l) => l.unit === unit)
              .map((l) => {
                const done = completed.has(l.id);
                const ready = l.prerequisites.every((p) => completed.has(p));
                return (
                  <li key={l.id}>
                    <Link to={`/lektion/${l.id}`} className="flex items-baseline gap-4 py-4 hover:bg-night-2">
                      <span className={`h-3 w-3 shrink-0 rounded-full ${done ? "bg-sage" : ready ? "border-2 border-brass" : "border-2 border-night-3"}`} aria-hidden />
                      <span className={`condensed flex-1 text-2xl font-bold ${ready || done ? "" : "text-paper-dim"}`}>{l.title}</span>
                      <span className="text-sm text-paper-dim">
                        {done ? t.course.done : ready ? t.course.minutes(l.estimatedMinutes) : t.course.locked}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </div>
  );
}
