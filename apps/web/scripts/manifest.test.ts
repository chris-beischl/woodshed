import { describe, expect, it } from "vitest";
import { buildManifest, ManifestError, type SourceFile } from "./manifest";

const template = (id: string, extra: string, mode = "major"): SourceFile => ({
  path: `content/exercises/${id}.yaml`,
  content: `id: ${id}
type: play_chord
title: T
importance: 3
targetSeconds: 5
estimatedSeconds: 10
mode: ${mode}
keys: all
prompt: { kind: symbol }
response: { kind: play }
${extra}
`,
});

const lesson = (id: string, introduces: string[], order = 1): SourceFile => ({
  path: `content/lessons/${id}.mdx`,
  content: `---\nid: ${id}\ntitle: L\norder: ${order}\nunit: 1\nestimatedMinutes: 10\nintroduces: [${introduces.join(", ")}]\n---\n\nBody`,
});

function errorsOf(exercises: SourceFile[], lessons: SourceFile[] = []): string[] {
  try {
    buildManifest(exercises, lessons);
    return [];
  } catch (e) {
    if (e instanceof ManifestError) return e.errors;
    throw e;
  }
}

describe("buildManifest", () => {
  it("builds a valid manifest with key tokens in introduction order", () => {
    const m = buildManifest(
      [template("a", 'chord: "V:7"\nvoicing: root_position'), template("b", 'chord: "i:m"\nvoicing: any', "minor")],
      [lesson("l", ["a", "b"])],
    );
    expect(m.templates.find((t) => t.id === "a")!.keys).toEqual(["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G"]);
    expect(m.templates.find((t) => t.id === "b")!.keys).toEqual(["C", "F", "Bb", "Eb", "Gs", "Cs", "Fs", "B", "E", "A", "D", "G"]);
    expect(m.version).toMatch(/^[0-9a-f]{64}$/);
  });

  it("restricts to an explicit key list", () => {
    const m = buildManifest([template("a", 'chord: "I:maj"\nvoicing: any').content.replace("keys: all", "keys: [C, Gb]")].map((content) => ({ path: "content/exercises/a.yaml", content })), []);
    expect(m.templates[0]!.keys).toEqual(["C", "Gb"]);
  });

  it("rejects spelling overflow: IV:dim7 in Gb is Cbdim7 with Bbbb", () => {
    expect(errorsOf([template("a", 'chord: "IV:dim7"\nvoicing: any')]).join()).toMatch(/Gb IV:dim7: .*cannot be spelled/);
  });

  it("rejects presets that do not apply to the quality", () => {
    expect(errorsOf([template("a", 'chord: "I:maj"\nvoicing: shell')]).length).toBe(12);
  });

  it("rejects pitch-class collisions introduced by constraints", () => {
    const errors = errorsOf([template("a", 'chord: "ii:m7"\nvoicing: any\nconstraints: { tones: { "#9": optional } }')]);
    expect(errors.join()).toMatch(/share a pitch class/);
  });

  it("validates every chord of a progression in every key", () => {
    const t = template("a", 'progression: ["I:maj", "IV:dim7"]\nvoicing: any');
    const errors = errorsOf([{ ...t, content: t.content.replace("type: play_chord", "type: play_progression") }]);
    expect(errors.join()).toMatch(/Gb IV:dim7/);
  });

  it("requires file name = id", () => {
    expect(errorsOf([{ ...template("a", 'chord: "I:maj"\nvoicing: any'), path: "content/exercises/b.yaml" }])).toEqual([
      'content/exercises/b.yaml: file name must equal id "a"',
    ]);
  });

  it("rejects bad numerals, unknown keys and broken references", () => {
    expect(errorsOf([template("a", 'chord: "VIII:7"\nvoicing: any')]).length).toBeGreaterThan(0);
    expect(errorsOf([template("a", 'chord: "I:maj"\nvoicing: any').content.replace("keys: all", "keys: [F#]")].map((content) => ({ path: "content/exercises/a.yaml", content })))).toHaveLength(1);
    expect(errorsOf([template("a", 'chord: "I:maj"\nvoicing: any')], [lesson("l", ["missing"])])).toEqual([
      "lesson l introduces unknown template missing",
    ]);
    const dup = template("a", 'chord: "I:maj"\nvoicing: any');
    expect(errorsOf([dup, { ...dup, path: "content/exercises/sub/a.yaml" }])).toEqual(["duplicate template id a"]);
  });
});
