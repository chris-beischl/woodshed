import { NavLink, Route, Routes } from "react-router";
import { useInput } from "./input/store";
import { CoursePage } from "./lessons/CoursePage";
import { LessonPage } from "./lessons/LessonPage";
import { DevPage } from "./practice/DevPage";
import { FreeExercisePage, FreePage } from "./practice/FreePage";
import { PracticePage } from "./practice/PracticePage";
import { SettingsPage } from "./practice/SettingsPage";
import { PianoKeyboard } from "./ui/PianoKeyboard";
import { lang, LANGS, setLang } from "./ui/i18n";
import { t } from "./ui/strings";

function MidiPicker() {
  const { midiSources, midiError, selectedMidi, connectMidi, selectMidi } = useInput();
  return (
    <div className="flex items-center gap-2 text-sm">
      {midiSources.length > 0 ? (
        <select value={selectedMidi ?? ""} onChange={(e) => selectMidi(e.target.value)} className="rounded-full border border-night-3 bg-night-2 px-3 py-1.5" aria-label={t.input.device}>
          {midiSources.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      ) : (
        <button onClick={connectMidi} className="rounded-full border border-paper/40 px-4 py-1.5 hover:border-paper">{t.input.connectMidi}</button>
      )}
      {midiSources.length > 0 && <span className="h-2 w-2 rounded-full bg-sage" aria-hidden />}
      {midiError && <span className="text-signal">{midiError}</span>}
    </div>
  );
}

function Toggle({ on, set, label, hint }: { on: boolean; set: (on: boolean) => void; label: string; hint: string }) {
  return (
    <button
      onClick={() => set(!on)}
      aria-pressed={on}
      title={hint}
      className={`rounded-full border px-4 py-1.5 text-sm ${on ? "border-brass bg-brass font-bold text-night" : "border-paper/40 hover:border-paper"}`}
    >
      {label}
    </button>
  );
}

function PlayToggles() {
  const { rapidFire, setRapidFire, pedalNext, setPedalNext, rootPosition, setRootPosition } = useInput();
  return (
    <>
      <Toggle on={rapidFire} set={setRapidFire} label={`⚡ ${t.input.rapidFire}`} hint={t.input.rapidFireHint} />
      <Toggle on={pedalNext} set={setPedalNext} label={t.input.pedalNext} hint={t.input.pedalNextHint} />
      <Toggle on={rootPosition} set={setRootPosition} label={t.input.rootPosition} hint={t.input.rootPositionHint} />
    </>
  );
}

export function App() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `condensed text-lg ${isActive ? "text-paper underline decoration-brass decoration-2 underline-offset-8" : "text-paper-dim hover:text-paper"}`;
  return (
    <div className="mx-auto flex h-dvh max-w-6xl flex-col gap-6 px-4 pt-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex items-baseline gap-6">
          <span className="display text-4xl text-brass">{t.appName}</span>
          <NavLink to="/" end className={link}>{t.nav.practice}</NavLink>
          <NavLink to="/kurs" className={link}>{t.nav.course}</NavLink>
          <NavLink to="/frei" className={link}>{t.nav.free}</NavLink>
          <NavLink to="/einstellungen" className={link}>{t.nav.settings}</NavLink>
          <NavLink to="/dev" className={link}>{t.nav.dev}</NavLink>
        </nav>
        <div className="flex items-center gap-4">
          <PlayToggles />
          <MidiPicker />
          <div className="flex gap-1 text-sm" role="group" aria-label={t.language}>
            {LANGS.map((l) => (
              <button
                key={l}
                onClick={() => l !== lang && setLang(l)}
                aria-pressed={l === lang}
                className={`condensed rounded-full px-2.5 py-1 uppercase ${l === lang ? "bg-paper font-bold text-night" : "text-paper-dim hover:text-paper"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>
      {/* Pages scroll here, between header and keyboard; lesson slides fill exactly this area. */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Routes>
          {/* The practice screen floats in the middle like a record sleeve; other pages read top-down. */}
          <Route path="/" element={<div className="my-auto"><PracticePage /></div>} />
          <Route path="/kurs" element={<CoursePage />} />
          <Route path="/lektion/:id" element={<LessonPage />} />
          <Route path="/frei" element={<FreePage />} />
          <Route path="/frei/:id" element={<FreeExercisePage />} />
          <Route path="/einstellungen" element={<SettingsPage />} />
          <Route path="/dev" element={<DevPage />} />
        </Routes>
      </main>
      {/* Pinned so held keys stay visible while scrolling through a lesson. */}
      <div className="-mx-4 shrink-0 bg-night/95 px-4 pt-3 pb-3 sm:-mx-8 sm:px-8">
        <PianoKeyboard />
      </div>
    </div>
  );
}
