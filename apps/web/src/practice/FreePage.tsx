import { useState } from "react";
import { Link, useParams } from "react-router";
import { useManifest } from "../content/useManifest";
import { EXERCISE_TYPES } from "../exercises/schema";
import { Exercise } from "../lessons/components";
import { parseKeyToken } from "../theory/keys";
import { loc } from "../ui/i18n";
import { displayNote } from "../ui/music";
import { t } from "../ui/strings";

/** Every exercise, playable without a lesson; attempts are logged like lesson attempts (no FSRS update). */
export function FreePage() {
  const manifest = useManifest();
  if (manifest.isPending) return <p className="text-paper-dim">{t.practice.loading}</p>;
  if (manifest.isError) return <p className="text-signal">{manifest.error.message}</p>;
  const templates = manifest.data.templates.filter((tpl) => !tpl.deprecated);

  return (
    <div className="space-y-14">
      <header className="max-w-2xl space-y-3">
        <h1 className="display text-7xl">{t.free.title}</h1>
        <p className="text-paper-dim">{t.free.intro}</p>
      </header>
      {EXERCISE_TYPES.map((type) => {
        const group = templates.filter((tpl) => tpl.type === type).sort((a, b) => b.importance - a.importance || loc(a.title).localeCompare(loc(b.title)));
        if (group.length === 0) return null;
        return (
          <section key={type} className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
            <h2 className="condensed text-2xl font-bold text-brass">{t.free.categories[type]}</h2>
            <ul className="divide-y divide-night-3 border-y border-night-3">
              {group.map((tpl) => (
                <li key={tpl.id}>
                  <Link to={`/frei/${tpl.id}`} className="flex items-baseline gap-4 py-4 hover:bg-night-2">
                    <span className="condensed flex-1 text-2xl font-bold">{loc(tpl.title)}</span>
                    <span className="text-sm text-paper-dim">{t.free.keys(tpl.keys.length)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function FreeExercisePage() {
  const { id = "" } = useParams();
  const manifest = useManifest();
  const [start, setStart] = useState<string | null>(null);
  if (manifest.isPending) return <p className="text-paper-dim">{t.practice.loading}</p>;
  const template = manifest.data?.templates.find((tpl) => tpl.id === id);
  if (!template) return <p className="text-signal">{t.free.notFound}</p>;
  const current = start ?? template.keys[0]!;
  const pickRandom = () => {
    const others = template.keys.filter((k) => k !== current);
    setStart(others[Math.floor(Math.random() * others.length)] ?? current);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link to="/frei" className="condensed text-lg text-brass hover:underline">← {t.free.back}</Link>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.free.startKey}>
        {template.keys.map((k) => (
          <button
            key={k}
            onClick={() => setStart(k)}
            aria-pressed={k === current}
            className={`rounded-full border px-3 py-1 text-sm ${k === current ? "border-brass bg-brass font-bold text-night" : "border-night-3 hover:border-paper"}`}
          >
            {displayNote(parseKeyToken(k, template.mode).tonic)}{template.mode === "minor" ? "m" : ""}
          </button>
        ))}
        <button onClick={pickRandom} className="rounded-full border border-paper/40 px-3 py-1 text-sm hover:border-paper">
          🎲 {t.free.randomKey}
        </button>
      </div>
      {/* key = start: picking a key starts a fresh round there. */}
      <Exercise key={current} id={template.id} startToken={current} />
    </div>
  );
}
