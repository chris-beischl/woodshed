import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { manifestSchema } from "../exercises/schema";
import { WORKOUT } from "./KeyWorkoutPage";

it("every key-workout exercise exists, is major and offered in all 12 keys", () => {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/manifest.json"), "utf8")));
  for (const id of WORKOUT) {
    const tpl = manifest.templates.find((t) => t.id === id);
    expect(tpl, id).toBeDefined();
    expect(tpl!.mode, id).toBe("major");
    expect(tpl!.keys, id).toHaveLength(12);
  }
});
