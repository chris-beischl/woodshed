import type { Quality } from "../theory/chords";
import type { SpelledNote } from "../theory/note";
import { displayAccidental, displayNumeral, displaySuffix } from "./music";

type Tone = "idle" | "correct" | "wrong";
const TONE: Record<Tone, string> = { idle: "text-paper", correct: "text-sage", wrong: "text-signal" };

/** Lead-sheet chord symbol: huge root, raised accidental and quality. */
export function ChordSymbol({ root, quality, tone = "idle", className = "" }: {
  root: SpelledNote;
  quality: Quality;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={`display inline-flex items-start ${TONE[tone]} ${className}`} aria-label={`${root.letter}${displayAccidental(root)}${displaySuffix(quality)}`}>
      <span>{root.letter}</span>
      {root.accidental !== 0 && <span className="pt-[0.04em] text-[0.5em]">{displayAccidental(root)}</span>}
      {/* Extensions are raised like a superscript; a minor triad's "m" sits on the baseline. */}
      <span className={`condensed text-[0.42em] font-bold ${quality === "m" ? "self-end pb-[0.12em]" : "pt-[0.08em]"}`}>
        {displaySuffix(quality)}
      </span>
    </span>
  );
}

/** Roman numeral prompt: "V⁷", "♭II⁷". */
export function NumeralSymbol({ numeral, quality, tone = "idle", className = "" }: {
  numeral: string;
  quality: Quality;
  tone?: Tone;
  className?: string;
}) {
  const triad = quality === "maj" || quality === "m";
  return (
    <span className={`display inline-flex items-start ${TONE[tone]} ${className}`}>
      <span>{displayNumeral(numeral)}</span>
      {!triad && <span className="condensed pt-[0.06em] text-[0.42em] font-bold">{displaySuffix(quality)}</span>}
    </span>
  );
}
