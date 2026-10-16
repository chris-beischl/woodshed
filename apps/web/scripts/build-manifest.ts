import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { manifestSchema } from "../src/exercises/schema";
import { buildManifest, ManifestError, type SourceFile } from "./manifest";

const root = resolve(import.meta.dirname, "../../..");
const outDir = resolve(import.meta.dirname, "../public");

function read(dir: string, ext: string): SourceFile[] {
  const abs = join(root, dir);
  return readdirSync(abs)
    .filter((f) => f.endsWith(ext))
    .map((f) => ({ path: relative(root, join(abs, f)), content: readFileSync(join(abs, f), "utf8") }));
}

try {
  const manifest = buildManifest(read("content/exercises", ".yaml"), read("content/lessons", ".mdx"));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(join(outDir, "manifest.schema.json"), JSON.stringify(z.toJSONSchema(manifestSchema), null, 2) + "\n");
  console.log(`manifest: ${manifest.templates.length} templates, ${manifest.lessons.length} lessons (${manifest.version.slice(0, 8)})`);
} catch (e) {
  console.error(e instanceof ManifestError ? e.message : e);
  process.exit(1);
}
