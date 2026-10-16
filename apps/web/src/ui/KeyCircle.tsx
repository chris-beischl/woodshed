import { KEY_INTRO_PCS, keyForPitchClass } from "../theory/keys";
import { displayNote } from "./music";

export type KeyResult = "clean" | "shaky" | "missed";
const FILL: Record<KeyResult, string> = {
  clean: "var(--color-sage)",
  shaky: "var(--color-brass)",
  missed: "var(--color-signal)",
};

/** Circle of fourths; each key's segment shows how it went (by pitch class). */
export function KeyCircle({ results, size = 260 }: { results: Map<number, KeyResult>; size?: number }) {
  const r = size / 2;
  const segment = (i: number) => {
    const a0 = ((i - 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
    const [ro, ri] = [r - 4, r * 0.58];
    const p = (rad: number, a: number) => `${r + rad * Math.cos(a)} ${r + rad * Math.sin(a)}`;
    return `M ${p(ro, a0)} A ${ro} ${ro} 0 0 1 ${p(ro, a1)} L ${p(ri, a1)} A ${ri} ${ri} 0 0 0 ${p(ri, a0)} Z`;
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Quartenzirkel">
      {KEY_INTRO_PCS.map((pc, i) => {
        const result = results.get(pc);
        const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
        const lr = r * 0.79;
        return (
          <g key={pc}>
            <path d={segment(i)} fill={result ? FILL[result] : "var(--color-night-2)"} stroke="var(--color-night)" strokeWidth={3} />
            <text
              x={r + lr * Math.cos(a)}
              y={r + lr * Math.sin(a)}
              textAnchor="middle"
              dominantBaseline="central"
              className="condensed"
              fontWeight={700}
              fontSize={size / 15}
              fill={result ? "var(--color-night)" : "var(--color-paper-dim)"}
            >
              {displayNote(keyForPitchClass(pc, "major").tonic)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
