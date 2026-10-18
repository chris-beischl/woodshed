import { isValidElement, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import type { MDXContent } from "mdx/types";
import { Link, useParams } from "react-router";
import { useCompleteLesson, useProgress } from "../progress/client";
import { useManifest } from "../content/useManifest";
import { loc } from "../ui/i18n";
import { t } from "../ui/strings";
import { Exercise, lessonComponents } from "./components";
import { lessonModule } from "./registry";
import { SlideBreak, SlideDeck, splitSlides, type Slide } from "./SlideDeck";

function useLessonBody(id: string): MDXContent | null | undefined {
  const [body, setBody] = useState<{ id: string; content: MDXContent | null }>();
  useEffect(() => {
    let live = true;
    const load = lessonModule(id);
    if (!load) setBody({ id, content: null });
    else void load().then((m) => live && setBody({ id, content: m.default }));
    return () => {
      live = false;
    };
  }, [id]);
  return body?.id === id ? body.content : undefined;
}

const hasExercise = (nodes: ReactNode[]) => nodes.some((n) => isValidElement(n) && n.type === Exercise);

export function LessonPage() {
  const { id = "" } = useParams();
  const manifest = useManifest();
  const progress = useProgress();
  const complete = useCompleteLesson();
  const Body = useLessonBody(id);
  const lesson = manifest.data?.lessons.find((l) => l.id === id);

  // Rendering the MDX function directly yields its top-level elements, which `---` splits into slides.
  const bodySlides = useMemo(() => {
    if (!Body) return [];
    const tree = Body({ components: { ...lessonComponents, hr: SlideBreak } }) as ReactElement<{ children?: ReactNode }>;
    return splitSlides(tree.props.children);
  }, [Body]);

  if (manifest.isPending || Body === undefined) return <p className="text-paper-dim">{t.practice.loading}</p>;
  if (!lesson || !Body) return <p className="text-signal">{t.lesson.notFound}</p>;
  const done = progress.data?.completed_lessons.includes(id) ?? false;

  const slides: Slide[] = [
    {
      hasExercise: false,
      content: (
        <header className="space-y-4">
          <p className="condensed text-xl text-brass">
            <Link to="/kurs" className="hover:underline">{t.course.unit(lesson.unit)}</Link>
          </p>
          <h1 className="display text-[clamp(3.5rem,9vw,6.5rem)]">{loc(lesson.title)}</h1>
          <p className="text-paper-dim">{t.course.minutes(lesson.estimatedMinutes)}</p>
          <p className="pt-6 text-lg">{t.lesson.howToNavigate}</p>
        </header>
      ),
    },
    ...bodySlides.map((nodes) => ({ content: nodes, hasExercise: hasExercise(nodes) })),
    {
      hasExercise: false,
      content: (
        <footer className="flex flex-col items-start gap-5">
          <h2>{loc(lesson.title)}</h2>
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
      ),
    },
  ];

  // key = id: a new lesson starts at its first slide.
  return <SlideDeck key={id} slides={slides} />;
}
