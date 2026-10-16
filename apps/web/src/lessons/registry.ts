import type { MDXContent } from "mdx/types";
import { lang } from "../ui/i18n";

// Lesson bodies live in /content/lessons; metadata comes from the manifest.
const modules = import.meta.glob<{ default: MDXContent }>("../../../../content/lessons/*.mdx");

/** `<id>.mdx` is German, `<id>.en.mdx` English (the manifest build requires both). */
export function lessonModule(id: string): (() => Promise<{ default: MDXContent }>) | undefined {
  const file = lang === "en" ? `/${id}.en.mdx` : `/${id}.mdx`;
  return Object.entries(modules).find(([path]) => path.endsWith(file))?.[1];
}
