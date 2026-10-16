import type { MDXContent } from "mdx/types";

// Lesson bodies live in /content/lessons; metadata comes from the manifest.
const modules = import.meta.glob<{ default: MDXContent }>("../../../../content/lessons/*.mdx");

export function lessonModule(id: string): (() => Promise<{ default: MDXContent }>) | undefined {
  return Object.entries(modules).find(([path]) => path.endsWith(`/${id}.mdx`))?.[1];
}
