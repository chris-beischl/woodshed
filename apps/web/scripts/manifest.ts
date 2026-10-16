import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import { degreePitchClass, type DegreeToken } from "../src/theory/degrees";
import { keysInIntroOrder, keyToken, parseKeyName, type Key, type Mode } from "../src/theory/keys";
import { majorScale } from "../src/theory/scale";
import { pitchClass } from "../src/theory/note";
import { resolvePlayChord } from "../src/exercises/play_chord/resolve";
import { resolvePlayLine } from "../src/exercises/play_line/resolve";
import {
  lessonFrontmatterSchema,
  PARAM_SCHEMAS,
  templateBaseSchema,
  type Lesson,
  type Manifest,
  type ManifestTemplate,
  type PlayChordParams,
} from "../src/exercises/schema";

export interface SourceFile {
  path: string;
  content: string;
}

export class ManifestError extends Error {
  constructor(public readonly errors: string[]) {
    super(`invalid content:\n  - ${errors.join("\n  - ")}`);
    this.name = "ManifestError";
  }
}

const describe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A ChordSpec must not contain two tokens with the same pitch class (§ 3.3). */
function pitchClassCollisions(tones: DegreeToken[], rootPc: number): string[] {
  const seen = new Map<number, DegreeToken>();
  const errors: string[] = [];
  for (const t of tones) {
    const pc = degreePitchClass(rootPc, t);
    const other = seen.get(pc);
    if (other) errors.push(`degrees ${other} and ${t} share a pitch class`);
    seen.set(pc, t);
  }
  return errors;
}

/** The chords a template plays, as play_chord params — so every type shares one check. */
function chordsOf(type: string, params: unknown): PlayChordParams[] {
  if (type === "play_chord") return [PARAM_SCHEMAS.play_chord.parse(params)];
  if (type === "play_line") {
    const p = PARAM_SCHEMAS.play_line.parse(params);
    return p.over.map((chord) => ({ chord, voicing: "any", constraints: {} }));
  }
  if (type === "play_progression") {
    const p = PARAM_SCHEMAS.play_progression.parse(params);
    return p.progression.map((chord) => ({ chord, voicing: p.voicing, constraints: p.constraints }));
  }
  return [];
}

/** Instantiate every key: catches bad numerals, spelling range overflow, preset misuse. */
function validateInstances(type: string, mode: Mode, params: unknown, keys: Key[]): string[] {
  const errors: string[] = [];
  if (type === "choice" && mode !== "major") errors.push("choice quizzes support major keys only (minor: unit 4)");
  for (const key of keys) {
    try {
      if (type === "choice") majorScale(key.tonic);
    } catch (e) {
      errors.push(`${keyToken(key)}: ${describe(e)}`);
    }
    if (type === "play_line") {
      try {
        resolvePlayLine(PARAM_SCHEMAS.play_line.parse(params), key);
      } catch (e) {
        errors.push(`${keyToken(key)}: ${describe(e)}`);
      }
    }
    for (const chord of chordsOf(type, params)) {
      const at = `${keyToken(key)} ${chord.chord}`;
      try {
        const inst = resolvePlayChord(chord, key);
        const tones = Object.keys(inst.spec.tones) as DegreeToken[];
        errors.push(...pitchClassCollisions(tones, pitchClass(inst.spec.root)).map((e) => `${at}: ${e}`));
      } catch (e) {
        errors.push(`${at}: ${describe(e)}`);
      }
    }
  }
  return errors;
}

/** IDs double as file names so lessons and templates can be found by ID. */
function checkFileName(file: SourceFile, id: string, errors: string[]): void {
  const base = file.path.split("/").pop()!.replace(/\.(yaml|mdx)$/, "");
  if (base !== id) errors.push(`${file.path}: file name must equal id "${id}"`);
}

function parseTemplate(file: SourceFile, errors: string[]): ManifestTemplate | null {
  const at = (msg: string) => errors.push(`${file.path}: ${msg}`);
  let raw: unknown;
  try {
    raw = parseYaml(file.content);
  } catch (e) {
    at(describe(e));
    return null;
  }
  const base = templateBaseSchema.safeParse(raw);
  if (!base.success) {
    at(base.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return null;
  }
  const t = base.data;
  const baseKeys = new Set(Object.keys(templateBaseSchema.shape));
  const paramsRaw = Object.fromEntries(Object.entries(raw as object).filter(([k]) => !baseKeys.has(k)));
  const params = PARAM_SCHEMAS[t.type].safeParse(paramsRaw);
  if (!params.success) {
    at(params.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return null;
  }

  let keys: Key[];
  try {
    const all = keysInIntroOrder(t.mode);
    keys = t.keys === "all" ? all : all.filter((k) => (t.keys as string[]).some((n) => parseKeyName(n, t.mode) === k));
  } catch (e) {
    at(describe(e));
    return null;
  }
  checkFileName(file, t.id, errors);
  for (const e of validateInstances(t.type, t.mode, params.data, keys)) at(e);
  return { ...t, keys: keys.map(keyToken), params: params.data as Record<string, unknown> };
}

function parseLesson(file: SourceFile, errors: string[]): Lesson | null {
  const m = /^---\n([\s\S]*?)\n---/.exec(file.content);
  if (!m) {
    errors.push(`${file.path}: missing frontmatter`);
    return null;
  }
  const parsed = lessonFrontmatterSchema.safeParse(parseYaml(m[1]!));
  if (!parsed.success) {
    errors.push(`${file.path}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    return null;
  }
  checkFileName(file, parsed.data.id, errors);
  return parsed.data;
}

function duplicates(ids: string[]): string[] {
  return ids.filter((id, i) => ids.indexOf(id) !== i);
}

/** Pure manifest build (ARCHITECTURE § 5.4). Throws ManifestError listing every problem. */
export function buildManifest(exercises: SourceFile[], lessons: SourceFile[]): Manifest {
  const errors: string[] = [];
  const templates = exercises.map((f) => parseTemplate(f, errors)).filter((t) => t !== null);
  // `<id>.mdx` is the German lesson (with frontmatter); `<id>.en.mdx` its English body.
  const isEnglish = (f: SourceFile) => f.path.endsWith(".en.mdx");
  const english = new Set(lessons.filter(isEnglish).map((f) => f.path.replace(/\.en\.mdx$/, ".mdx")));
  for (const f of lessons) {
    if (!isEnglish(f) && !english.has(f.path)) errors.push(`${f.path}: missing English version ${f.path.replace(/\.mdx$/, ".en.mdx")}`);
  }
  const lessonList = lessons
    .filter((f) => !isEnglish(f))
    .map((f) => parseLesson(f, errors))
    .filter((l) => l !== null)
    .sort((a, b) => a.order - b.order);

  for (const id of duplicates(templates.map((t) => t.id))) errors.push(`duplicate template id ${id}`);
  for (const id of duplicates(lessonList.map((l) => l.id))) errors.push(`duplicate lesson id ${id}`);
  for (const o of duplicates(lessonList.map((l) => String(l.order)))) errors.push(`duplicate lesson order ${o}`);

  const templateIds = new Set(templates.map((t) => t.id));
  const lessonIds = new Set(lessonList.map((l) => l.id));
  for (const l of lessonList) {
    for (const id of l.introduces) if (!templateIds.has(id)) errors.push(`lesson ${l.id} introduces unknown template ${id}`);
    for (const id of l.prerequisites) if (!lessonIds.has(id)) errors.push(`lesson ${l.id} requires unknown lesson ${id}`);
  }
  if (errors.length > 0) throw new ManifestError(errors);

  const hash = createHash("sha256");
  for (const f of [...exercises, ...lessons].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(f.path).update("\0").update(f.content).update("\0");
  }
  return { version: hash.digest("hex"), templates: templates.sort((a, b) => a.id.localeCompare(b.id)), lessons: lessonList };
}
