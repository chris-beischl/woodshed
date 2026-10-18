import { Children, createContext, isValidElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { subscribeAll, subscribeControl, useInput } from "../input/store";
import { t } from "../ui/strings";

/** Exercises run only on the active slide; elsewhere (and outside decks) this is always true. */
export const SlideContext = createContext({ active: true });

/** `---` in a lesson body ends a slide (MDX renders it as `hr`). */
export function SlideBreak() {
  return null;
}

/** Splits rendered MDX children at slide breaks; whitespace between elements is dropped. */
export function splitSlides(children: ReactNode): ReactNode[][] {
  const slides: ReactNode[][] = [[]];
  for (const node of Children.toArray(children)) {
    if (isValidElement(node) && node.type === SlideBreak) slides.push([]);
    else if (typeof node !== "string" || node.trim() !== "") slides.at(-1)!.push(node);
  }
  return slides.filter((s) => s.length > 0);
}

const PEDAL_COOLDOWN_MS = 400;

export interface Slide {
  content: ReactNode;
  /** The pedal belongs to the exercise on this slide while "Pedal = next" is on. */
  hasExercise: boolean;
}

/** One slide per screen, snapping; forward with pedal, A0, → / ↓ / Space; back with B♭0, ← / ↑. */
export function SlideDeck({ slides }: { slides: Slide[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const pedalNext = useInput((s) => s.pedalNext);

  const go = useCallback(
    (delta: number) => {
      const target = Math.max(0, Math.min(slides.length - 1, current + delta));
      // Next slide's heading lands exactly at the top. No CSS snapping: it overshoots tall slides.
      const el = sections.current[target];
      if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop, behavior: "smooth" });
    },
    [current, slides.length],
  );

  // The current slide is the last one whose top has reached the top of the view.
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const line = el.scrollTop + 8;
    let i = 0;
    sections.current.forEach((s, n) => {
      if (s && s.offsetTop <= line) i = n;
    });
    setCurrent(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === " " && e.target instanceof HTMLButtonElement) return; // Space presses the focused button
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) go(1);
      else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) go(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => subscribeControl((c) => go(c === "next" ? 1 : -1)), [go]);

  const pedalAdvances = !(pedalNext && slides[current]?.hasExercise);
  useEffect(() => {
    if (!pedalAdvances) return;
    let last = -Infinity;
    return subscribeAll((e) => {
      if (e.type !== "sustain" || !e.on || e.t - last < PEDAL_COOLDOWN_MS) return;
      last = e.t;
      go(1);
    });
  }, [pedalAdvances, go]);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="relative h-full overflow-y-auto">
        {slides.map((slide, i) => (
          <section
            key={i}
            ref={(el) => {
              sections.current[i] = el;
            }}
            data-index={i}
            aria-current={i === current ? "step" : undefined}
            className="min-h-full pt-2 pb-16"
          >
            <div className="lesson slide mx-auto w-full max-w-3xl">
              <SlideContext.Provider value={{ active: i === current }}>{slide.content}</SlideContext.Provider>
            </div>
          </section>
        ))}
      </div>
      <nav className="pointer-events-none absolute right-0 bottom-3 flex items-center gap-3 text-sm text-paper-dim">
        <span className="hidden sm:inline">{pedalAdvances ? t.lesson.navHint : t.lesson.navHintExercise}</span>
        <button onClick={() => go(-1)} disabled={current === 0} aria-label={t.lesson.prevSlide} className="pointer-events-auto rounded-full border border-night-3 px-3 py-1 hover:border-paper disabled:opacity-30">
          ↑
        </button>
        <span className="condensed tabular-nums">{t.lesson.slide(current + 1, slides.length)}</span>
        <button onClick={() => go(1)} disabled={current === slides.length - 1} aria-label={t.lesson.nextSlide} className="pointer-events-auto rounded-full bg-brass px-3 py-1 font-bold text-night disabled:opacity-30">
          ↓
        </button>
      </nav>
    </div>
  );
}
