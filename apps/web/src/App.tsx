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
        <select value={selectedMidi ?? ""} onChange={(e) => selectMidi(e.target.value)} className="rounded border px-2 py-1" aria-label={t.input.device}>
          {midiSources.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      ) : (
        <button onClick={connectMidi} className="rounded bg-stone-800 px-3 py-1 text-white">{t.input.connectMidi}</button>
      )}
      {midiError && <span className="text-red-700">{midiError}</span>}
    </div>
  );
}

export function App() {
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? "font-semibold" : "text-stone-500");
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <nav className="flex items-baseline gap-4">
          <span className="text-lg font-bold">{t.appName}</span>
          <NavLink to="/" end className={link}>{t.nav.practice}</NavLink>
          <NavLink to="/dev" className={link}>{t.nav.dev}</NavLink>
        </nav>
        <MidiPicker />
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<PracticePage />} />
          <Route path="/dev" element={<DevPage />} />
        </Routes>
      </main>
      <PianoKeyboard />
    </div>
  );
}
