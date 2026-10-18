import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluate } from "@mdx-js/mdx";
import type { ReactElement, ReactNode } from "react";
import * as runtime from "react/jsx-runtime";
import { describe, expect, it } from "vitest";
import { mdxOptions } from "../mdx.config";
import { SlideBreak, splitSlides } from "../src/lessons/SlideDeck";

const dir = resolve(import.meta.dirname, "../../../content/lessons");
const ids = readdirSync(dir)
  .filter((f) => f.endsWith(".mdx") && !f.endsWith(".en.mdx"))
  .map((f) => f.replace(/\.mdx$/, ""));

/** Renders a lesson exactly like LessonPage does (MDX function call, `---` → SlideBreak). */
async function slidesOf(file: string): Promise<ReactNode[][]> {
  const { default: Body } = await evaluate(readFileSync(join(dir, file), "utf8"), { ...runtime, ...mdxOptions });
  const stub = () => null;
  const tree = Body({ components: { hr: SlideBreak, Exercise: stub, ChordDemo: stub, Callout: stub, CircleOfFifths: stub } }) as ReactElement<{ children?: ReactNode }>;
  return splitSlides(tree.props.children);
}

describe.each(ids)("lesson %s as slides", (id) => {
  it("German and English have the same slides", async () => {
    const [de, en] = await Promise.all([slidesOf(`${id}.mdx`), slidesOf(`${id}.en.mdx`)]);
    expect(de.length).toBeGreaterThan(0);
    expect(en.length).toBe(de.length);
  });
});

it("splits major-scale-degrees into one slide per idea", async () => {
  expect(await slidesOf("major-scale-degrees.mdx")).toHaveLength(10);
});
