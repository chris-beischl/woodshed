import { NavLink, Route, Routes } from "react-router";
import { useInput } from "./input/store";
import { DevPage } from "./practice/DevPage";
import { PracticePage } from "./practice/PracticePage";
import { PianoKeyboard } from "./ui/PianoKeyboard";
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

export function App() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `condensed text-lg ${isActive ? "text-paper underline decoration-brass decoration-2 underline-offset-8" : "text-paper-dim hover:text-paper"}`;
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 pt-5 pb-4 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex items-baseline gap-6">
          <span className="display text-4xl text-brass">{t.appName}</span>
          <NavLink to="/" end className={link}>{t.nav.practice}</NavLink>
          <NavLink to="/dev" className={link}>{t.nav.dev}</NavLink>
        </nav>
        <MidiPicker />
      </header>
      <main className="flex flex-1 flex-col justify-center">
        <Routes>
          <Route path="/" element={<PracticePage />} />
          <Route path="/dev" element={<DevPage />} />
        </Routes>
      </main>
      <PianoKeyboard />
    </div>
  );
}
