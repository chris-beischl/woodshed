import { fifthOf, QUALITY_TONES, seventhOf, thirdOf, type Quality } from "../theory/chords";
import type { DegreeToken } from "../theory/degrees";
import type { SpelledNote } from "../theory/note";
import type { ChordSpec, Preset, ToneRole } from "./types";

export class PresetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetError";
  }
}

function roles(entries: [DegreeToken, ToneRole][]): ChordSpec["tones"] {
  return Object.fromEntries(entries) as ChordSpec["tones"];
}

function allRequired(quality: Quality): [DegreeToken, ToneRole][] {
  return QUALITY_TONES[quality].map((t) => [t, "required"]);
}

/** Every quality tone not listed explicitly becomes forbidden. */
function onlyThese(quality: Quality, entries: [DegreeToken, ToneRole][]): ChordSpec["tones"] {
  const listed = new Set(entries.map(([t]) => t));
  const rest = QUALITY_TONES[quality].filter((t) => !listed.has(t)).map((t): [DegreeToken, ToneRole] => [t, "forbidden"]);
  return roles([...entries, ...rest]);
}

function requireSeventh(quality: Quality, preset: Preset): DegreeToken {
  const seventh = seventhOf(quality);
  if (!seventh) throw new PresetError(`${preset} is not defined for the triad quality ${quality}`);
  return seventh;
}

/** Resolve a voicing preset into a flat ChordSpec (ARCHITECTURE § 4.2). */
export function resolveChordSpec(
  root: SpelledNote,
  quality: Quality,
  preset: Preset,
  overrides: Partial<ChordSpec> = {},
): ChordSpec {
  const base = { root, quality, extras: "forbid" as const, allowDoubling: true };
  const third = thirdOf(quality);
  let spec: ChordSpec;

  switch (preset) {
    case "any":
      // THEORY-DECISION: only the literal "5" is optional; b5/#5 define the quality. #3
      spec = { ...base, tones: roles(QUALITY_TONES[quality].map((t) => [t, t === "5" ? "optional" : "required"])) };
      break;
    case "root_position":
      spec = { ...base, tones: roles(allRequired(quality)), bass: ["1"] };
      break;
    case "inversion_1":
      spec = { ...base, tones: roles(allRequired(quality)), bass: [third] };
      break;
    case "inversion_2":
      spec = { ...base, tones: roles(allRequired(quality)), bass: [fifthOf(quality)] };
      break;
    case "inversion_3":
      spec = { ...base, tones: roles(allRequired(quality)), bass: [requireSeventh(quality, preset)] };
      break;
    case "shell": {
      // THEORY-DECISION: shell needs a 7th (6 on 6-chords); rejected for triads. #4
      const seventh = requireSeventh(quality, preset);
      spec = { ...base, tones: onlyThese(quality, [["1", "required"], [third, "required"], [seventh, "required"]]), bass: ["1"] };
      break;
    }
    case "guide_tones": {
      const seventh = requireSeventh(quality, preset);
      spec = { ...base, tones: onlyThese(quality, [[third, "required"], [seventh, "required"]]) };
      break;
    }
    case "rootless_a":
    case "rootless_b": {
      if (quality === "m7b5" || quality === "dim7") {
        throw new PresetError(`${preset} on ${quality} needs an owner THEORY-DECISION; unsupported`);
      }
      const seventh = requireSeventh(quality, preset);
      const fifth = fifthOf(quality);
      // On 6-chords the 13 is the "7th" slot itself, so the fifth slot is just the 5.
      const fifthSlot: DegreeToken[] = seventh === "6" ? [fifth] : [fifth, "13"];
      const order = preset === "rootless_a"
        ? [[third], fifthSlot, [seventh], ["9"]]
        : [[seventh], ["9"], [third], fifthSlot];
      const tones: [DegreeToken, ToneRole][] = [
        ["1", "forbidden"], [third, "required"], [seventh, "required"], ["9", "required"],
        ...fifthSlot.map((t): [DegreeToken, ToneRole] => [t, "optional"]),
      ];
      spec = { ...base, tones: onlyThese(quality, tones), order: order as DegreeToken[][] };
      break;
    }
  }
  // `tones` overrides merge per token; every other field replaces the preset's value.
  return { ...spec, ...overrides, tones: { ...spec.tones, ...overrides.tones } };
}
