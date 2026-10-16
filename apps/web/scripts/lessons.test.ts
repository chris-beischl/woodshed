import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { mdxOptions } from "../mdx.config";

const dir = resolve(import.meta.dirname, "../../../content/lessons");
const lessons = readdirSync(dir).filter((f) => f.endsWith(".mdx"));

describe.each(lessons)("lesson %s", (file) => {
  const source = readFileSync(join(dir, file), "utf8");

  it("compiles with the app's MDX options", async () => {
    await expect(compile(source, mdxOptions)).resolves.toBeDefined();
  });

  it("renders Markdown tables as tables, not text", async () => {
    const code = String(await compile(source, mdxOptions));
    const hasTable = /^\|.*\|\s*$/m.test(source);
    expect(code.includes("_components.table")).toBe(hasTable);
    expect(code).not.toContain("|---|");
  });
});
