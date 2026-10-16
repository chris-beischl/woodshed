import { z } from "zod";
import { DEGREE_TOKENS, type DegreeToken } from "../theory/degrees";
import { PRESETS } from "../evaluation/types";

const kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case");
const degree = z.enum(DEGREE_TOKENS as [DegreeToken, ...DegreeToken[]]);

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

/** Each exercise type registers its YAML params schema here (ARCHITECTURE § 5.1). */
export const PARAM_SCHEMAS = {
  play_chord: playChordParams,
} as const;

export type ExerciseType = keyof typeof PARAM_SCHEMAS;
export const EXERCISE_TYPES = Object.keys(PARAM_SCHEMAS) as [ExerciseType, ...ExerciseType[]];

/** Fields common to every template YAML; the rest are type params. */
export const templateBaseSchema = z.object({
  id: kebab,
  type: z.enum(EXERCISE_TYPES),
  title: z.string().min(1),
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
    title: z.string().min(1),
    order: z.number().int().nonnegative(),
    estimatedMinutes: z.number().positive(),
    introduces: z.array(kebab).default([]),
    prerequisites: z.array(kebab).default([]),
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
