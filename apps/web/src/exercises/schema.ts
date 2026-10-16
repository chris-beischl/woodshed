import { z } from "zod";
import { DEGREE_TOKENS, type DegreeToken } from "../theory/degrees";
import { PRESETS } from "../evaluation/types";

const kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case");
const degree = z.enum(DEGREE_TOKENS as [DegreeToken, ...DegreeToken[]]);
/** Every user-facing content string exists in each UI language (src/ui/i18n.ts). */
const localized = z.object({ de: z.string().min(1), en: z.string().min(1) }).strict();

/** Overrides of the resolved ChordSpec (template `constraints:` block). */
export const constraintsSchema = z
  .object({
    tones: z.partialRecord(degree, z.enum(["required", "optional", "forbidden"])),
    extras: z.enum(["forbid", "allowTensions", "allowAny"]),
    allowDoubling: z.boolean(),
    bass: z.array(degree).min(1),
    order: z.array(z.array(degree).min(1)).min(1),
    maxSpan: z.number().int().positive(),
    minNotes: z.number().int().positive(),
  })
  .partial()
  .strict();

export const playChordParams = z
  .object({
    chord: z.string().min(1), // roman numeral, e.g. "V:7"
    voicing: z.enum(PRESETS as unknown as ["any", ...string[]]),
    constraints: constraintsSchema.default({}),
  })
  .strict();

export const playProgressionParams = z
  .object({
    progression: z.array(z.string().min(1)).min(2), // roman numerals, e.g. ["ii:m7", "V:7", "I:maj7"]
    voicing: playChordParams.shape.voicing,
    constraints: constraintsSchema.default({}),
    maxAttemptsPerChord: z.number().int().positive().default(3),
  })
  .strict();

export const choiceParams = z
  .object({
    ask: z.enum(["degree_note", "note_degree"]),
    degrees: z.array(z.number().int().min(1).max(7)).min(1).default([1, 2, 3, 4, 5, 6, 7]),
    rounds: z.number().int().min(1).max(30).default(8),
  })
  .strict();

export const playLineParams = z
  .object({
    ref: z.enum(["key", "chord"]).default("key"),
    over: z.array(z.string().min(1)).default([]), // roman numerals; ref "chord" uses the first
    notes: z.array(degree).min(2),
    contour: z.array(z.union([z.literal(-1), z.literal(0), z.literal(1)])),
    onMistake: z.enum(["restart", "retry"]).default("restart"),
    maxMistakes: z.number().int().positive().default(3),
  })
  .strict()
  .refine((p) => p.contour.length === p.notes.length - 1, { message: "contour needs notes.length - 1 entries" })
  .refine((p) => p.ref === "key" || p.over.length > 0, { message: 'ref "chord" needs an `over` chord' });

/** Each exercise type registers its YAML params schema here (ARCHITECTURE § 5.1). */
export const PARAM_SCHEMAS = {
  play_chord: playChordParams,
  play_progression: playProgressionParams,
  choice: choiceParams,
  play_line: playLineParams,
} as const;

export type ExerciseType = keyof typeof PARAM_SCHEMAS;
export const EXERCISE_TYPES = Object.keys(PARAM_SCHEMAS) as [ExerciseType, ...ExerciseType[]];

/** Fields common to every template YAML; the rest are type params. */
export const templateBaseSchema = z.object({
  id: kebab,
  type: z.enum(EXERCISE_TYPES),
  title: localized,
  tags: z.array(z.string()).default([]),
  importance: z.number().int().min(1).max(5),
  targetSeconds: z.number().positive(),
  estimatedSeconds: z.number().positive(),
  mode: z.enum(["major", "minor"]),
  keys: z.union([z.literal("all"), z.array(z.string()).min(1)]),
  prompt: z.object({ kind: z.enum(["symbol", "roman", "notation", "audio"]) }).strict(),
  response: z.object({ kind: z.enum(["play", "choice"]) }).strict(),
  deprecated: z.boolean().default(false),
});

export const lessonFrontmatterSchema = z
  .object({
    id: kebab,
    title: localized,
    order: z.number().int().nonnegative(),
    estimatedMinutes: z.number().positive(),
    unit: z.number().int().min(1).max(6),
    introduces: z.array(kebab).default([]),
    prerequisites: z.array(kebab).default([]),
    hidden: z.boolean().default(false),
  })
  .strict();

/** The built manifest (ARCHITECTURE § 5.4). `keys` are resolved card key tokens. */
export const manifestSchema = z.object({
  version: z.string(),
  templates: z.array(
    templateBaseSchema.extend({
      keys: z.array(z.string()),
      params: z.record(z.string(), z.unknown()),
    }),
  ),
  lessons: z.array(lessonFrontmatterSchema),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestTemplate = Manifest["templates"][number];
export type Lesson = z.infer<typeof lessonFrontmatterSchema>;
export type PlayChordParams = z.infer<typeof playChordParams>;
export type PlayProgressionParams = z.infer<typeof playProgressionParams>;
export type ChoiceParams = z.infer<typeof choiceParams>;
export type PlayLineParams = z.infer<typeof playLineParams>;
