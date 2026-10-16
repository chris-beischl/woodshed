import { lazy, Suspense, useMemo } from "react";
import { Link, useParams } from "react-router";
import { useCompleteLesson, useProgress } from "../progress/client";
import { useManifest } from "../content/useManifest";
import { t } from "../ui/strings";
import { lessonComponents } from "./components";
import { lessonModule } from "./registry";

export function LessonPage() {
  const { id = "" } = useParams();
  const manifest = useManifest();
  const progress = useProgress();
  const complete = useCompleteLesson();
  const Body = useMemo(() => {
    const load = lessonModule(id);
    return load ? lazy(load) : null;
  }, [id]);

  const lesson = manifest.data?.lessons.find((l) => l.id === id);
  if (manifest.isPending) return <p className="text-paper-dim">{t.practice.loading}</p>;
  if (!lesson || !Body) return <p className="text-signal">{t.lesson.notFound}</p>;
  const done = progress.data?.completed_lessons.includes(id) ?? false;

  return (
    <article className="mx-auto w-full max-w-3xl">
      <header className="mb-10 space-y-2">
        <p className="condensed text-xl text-brass">
          <Link to="/kurs" className="hover:underline">{t.course.unit(lesson.unit)}</Link>
        </p>
        <h1 className="display text-[clamp(3.5rem,9vw,6.5rem)]">{lesson.title}</h1>
        <p className="text-paper-dim">{t.course.minutes(lesson.estimatedMinutes)}</p>
      </header>

      <div className="lesson">
        <Suspense fallback={<p className="text-paper-dim">{t.practice.loading}</p>}>
          <Body components={lessonComponents} />
        </Suspense>
      </div>

      <footer className="mt-16 flex flex-wrap items-center gap-4 border-t border-night-3 pt-8">
        {done || complete.isSuccess ? (
          <>
            <p className="condensed text-2xl font-bold text-sage">
              {complete.data ? t.lesson.cardsCreated(complete.data.cards_created) : t.course.done}
            </p>
            <Link to="/" className="rounded-full bg-brass px-6 py-2.5 font-bold text-night hover:bg-brass-deep">
              {t.lesson.toPractice}
            </Link>
          </>
        ) : (
          <>
            <button
              onClick={() => complete.mutate(id)}
              disabled={complete.isPending}
              className="rounded-full bg-brass px-6 py-2.5 font-bold text-night hover:bg-brass-deep disabled:opacity-50"
            >
              {t.lesson.complete}
            </button>
            <p className="text-sm text-paper-dim">{t.lesson.completeHint}</p>
          </>
        )}
        {complete.isError && <p className="text-signal">{complete.error.message}</p>}
      </footer>
    </article>
  );
}
