import { useEffect, useState } from "react";
import { useInput, virtualKeyboard } from "../input/store";
import { t } from "./strings";

const BLACK = new Set([1, 3, 6, 8, 10]);
// Computer keyboard → MIDI (C4 = 60). "y" too, for German QWERTZ layouts.
const KEYMAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, z: 68, y: 68, h: 69, u: 70, j: 71, k: 72,
};

/** On-screen keyboard: shows held keys from every source; doubles as virtual input. */
export function PianoKeyboard({ from = 48, to = 84 }: { from?: number; to?: number }) {
  const held = useInput((s) => s.held);
  const sustain = useInput((s) => s.sustain);
  const [latched, setLatched] = useState<Set<number>>(new Set());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const midi = KEYMAP[e.key.toLowerCase()];
      if (midi === undefined || e.repeat || e.metaKey || e.ctrlKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      virtualKeyboard.press(midi);
    };
    const up = (e: KeyboardEvent) => {
      const midi = KEYMAP[e.key.toLowerCase()];
      if (midi !== undefined) virtualKeyboard.release(midi);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function toggle(midi: number) {
    const next = new Set(latched);
    if (next.has(midi)) {
      next.delete(midi);
      virtualKeyboard.release(midi);
    } else {
      next.add(midi);
      virtualKeyboard.press(midi);
    }
    setLatched(next);
  }

  const keys = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const whites = keys.filter((m) => !BLACK.has(m % 12));
  const whiteWidth = 100 / whites.length;

  return (
    <div className="select-none">
      <div className="relative h-28 w-full">
        {whites.map((m, i) => (
          <button
            key={m}
            aria-label={`MIDI ${m}`}
            onClick={() => toggle(m)}
            className={`absolute top-0 h-full rounded-b border border-stone-400 ${held.includes(m) ? "bg-amber-400" : "bg-white"}`}
            style={{ left: `${i * whiteWidth}%`, width: `${whiteWidth}%` }}
          >
            {m % 12 === 0 && <span className="absolute bottom-1 left-0 right-0 text-[10px] text-stone-500">C{m / 12 - 1}</span>}
          </button>
        ))}
        {keys
          .filter((m) => BLACK.has(m % 12))
          .map((m) => {
            const leftWhites = whites.filter((w) => w < m).length;
            return (
              <button
                key={m}
                aria-label={`MIDI ${m}`}
                onClick={() => toggle(m)}
                className={`absolute top-0 z-10 h-[62%] rounded-b ${held.includes(m) ? "bg-amber-500" : "bg-stone-900"}`}
                style={{ left: `${leftWhites * whiteWidth - whiteWidth * 0.3}%`, width: `${whiteWidth * 0.6}%` }}
              />
            );
          })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-stone-500">
        <span>{t.input.virtualHint}</span>
        <span className={sustain ? "font-semibold text-amber-600" : ""}>{t.input.sustain}: {sustain ? "●" : "○"}</span>
      </div>
    </div>
  );
}
